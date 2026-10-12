// Game creation, obstacle placement and deployment.
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';
import { FACTIONS, DEFAULT_INITIATIVE_FACTION } from '../data/factions.js';
import { buildDamageDeck } from '../data/damageDeck.js';
import { CONFIG, ASTEROIDS } from '../data/config.js';
import { shuffle, nextRandom, seedFromString } from './rng.js';
import { push, enqueue, ask, log, RuleError } from './flow.js';
import { basePolygon, placeShape, polygonsIntersect, polygonInsideBoard, distanceToEdge } from './geometry.js';
import { shipList, pilot, obstaclePolys, overlapsAnyShip, effectiveSkill, shipName, stat } from './queries.js';

export const ENGINE_VERSION = 2;

export function squadPoints(squad) {
  return squad.reduce((n, e) => n + PILOTS[e.pilot].cost + (e.upgrades || []).reduce((m, u) => m + UPGRADES[u].cost, 0), 0);
}

/** Upgrade ids a pilot could legally equip in some slot (ignores uniqueness and points). */
export function upgradeAllowed(pilotId, upgradeId) {
  const p = PILOTS[pilotId], u = UPGRADES[upgradeId], ch = SHIPS[p.ship];
  if (u.faction && u.faction !== ch.faction) return false;
  if (u.ships && !u.ships.includes(p.ship)) return false;
  if (u.sizes && !u.sizes.includes(ch.size)) return false;
  return p.slots.includes(u.slot);
}

/** Returns a list of human-readable problems with a squad (empty = legal). */
export function validateSquad(faction, squad, pointLimit = Infinity) {
  const errs = [];
  if (!squad.length) errs.push('Squad has no ships.');
  const uniques = new Set();
  for (const e of squad) {
    const p = PILOTS[e.pilot];
    if (!p) { errs.push(`Unknown pilot ${e.pilot}`); continue; }
    const ch = SHIPS[p.ship];
    if (ch.faction !== faction) errs.push(`${p.name} is not a ${FACTIONS[faction].short} pilot.`);
    const names = [p.unique ? p.name : null, ...(e.upgrades || []).map(u => (UPGRADES[u]?.unique ? UPGRADES[u].name : null))].filter(Boolean);
    for (const n of names) { if (uniques.has(n)) errs.push(`Only one "${n}" allowed.`); uniques.add(n); }
    const slots = p.slots.slice();
    for (const u of e.upgrades || []) {
      const def = UPGRADES[u];
      if (!def) { errs.push(`Unknown upgrade ${u}`); continue; }
      if (!upgradeAllowed(e.pilot, u)) { errs.push(`${def.name} can't be fitted to ${p.name}.`); continue; }
      const i = slots.indexOf(def.slot);
      if (i < 0) errs.push(`${p.name} has no free ${def.slot} slot for ${def.name}.`); else slots.splice(i, 1);
    }
  }
  if (squadPoints(squad) > pointLimit) errs.push(`Squad is ${squadPoints(squad)} points (limit ${pointLimit}).`);
  return errs;
}

/**
 * Create a new game state. Nothing here is random except via state.rng, so
 * two peers calling createGame with the same options get identical states.
 *  opts = { seed, squads: { league: [...], dominion: [...] }, names: {...}, obstacles: bool }
 */
export function createGame(opts) {
  const playerOrder = ['league', 'dominion'];
  const points = Object.fromEntries(playerOrder.map(p => [p, squadPoints(opts.squads[p])]));
  const initiative = points.league === points.dominion ? DEFAULT_INITIATIVE_FACTION
    : (points.league < points.dominion ? 'league' : 'dominion');

  const state = {
    v: ENGINE_VERSION,
    rng: typeof opts.seed === 'number' ? opts.seed >>> 0 : seedFromString(opts.seed ?? 'vector-aces'),
    round: 0,
    phase: 'setup',
    playerOrder,
    players: Object.fromEntries(playerOrder.map(p => [p, {
      id: p, name: opts.names?.[p] || FACTIONS[p].short, points: points[p],
      edge: p === 'league' ? 'bottom' : 'top',
    }])),
    initiative,
    ships: {}, shipOrder: [],
    obstacles: [],
    touches: [],
    damageDeck: [], damageDiscard: [],
    dials: {},
    planning: { submitted: {} },
    attack: null,
    combatSkill: null,
    queue: [], prompt: null, uid: 1, skillOverride: {},
    log: [], events: [],
    winner: null,
    options: { obstacles: !!opts.obstacles },
  };

  let n = 0;
  for (const p of playerOrder) {
    const counts = {};
    for (const e of opts.squads[p]) counts[e.pilot] = (counts[e.pilot] || 0) + 1;
    const seen = {};
    for (const e of opts.squads[p]) {
      const id = `s${++n}`;
      const pd = PILOTS[e.pilot];
      seen[e.pilot] = (seen[e.pilot] || 0) + 1;
      state.ships[id] = {
        id, owner: p, pilot: e.pilot, chassis: pd.ship,
        tag: counts[e.pilot] > 1 ? seen[e.pilot] : null,
        upgrades: (e.upgrades || []).map(u => ({ id: u, discarded: false })),
        shields: 0, ion: 0,
        damage: [], stress: 0, tokens: { focus: 0, evade: 0 },
        lockOn: null,
        pose: null, deployed: false, destroyed: false, pendingDestroy: false, fled: false,
        round: freshRound(),
      };
      state.shipOrder.push(id);
      state.ships[id].shields = stat(state, state.ships[id], 'maxShields');
    }
  }

  state.damageDeck = shuffle(state, buildDamageDeck());
  log(state, `${state.players[initiative].name} (${FACTIONS[initiative].short}) has initiative.`);

  if (state.options.obstacles) {
    let who = initiative;
    for (let i = 0; i < CONFIG.obstacleCount; i++) {
      enqueue(state, { t: 'placeObstacle', player: who, shape: i });
      who = who === 'league' ? 'dominion' : 'league';
    }
  }
  enqueue(state, { t: 'beginDeploy' });
  return state;
}

export function freshRound() {
  return { actionsUsed: [], skipAction: false, agilityBonus: 0, attackBonus: 0, deadeye: false, attacked: false, revealed: null, maneuver: null };
}

// ---------------- obstacles ----------------

function obstacleValid(state, o) {
  const poly = placeShape(ASTEROIDS[o.shape], o.x, o.y, o.rot);
  if (!polygonInsideBoard(poly)) return 'Obstacle must be on the table.';
  if (distanceToEdge(poly) < CONFIG.obstacleEdgeClearance * CONFIG.rangeBand) return 'Obstacles cannot be within Range 1-2 of an edge.';
  if (obstaclePolys(state).some(p => polygonsIntersect(p, poly))) return 'Obstacles cannot overlap.';
  return null;
}

function randomObstacle(state, shape) {
  const W = CONFIG.playArea, m = CONFIG.obstacleEdgeClearance * CONFIG.rangeBand + 45;
  for (let i = 0; i < 400; i++) {
    const o = { shape, x: m + nextRandom(state) * (W - 2 * m), y: m + nextRandom(state) * (W - 2 * m), rot: nextRandom(state) * Math.PI * 2 };
    if (!obstacleValid(state, o)) return o;
  }
  throw new Error('could not place obstacle');
}

// ---------------- deployment ----------------

export function deployZone(state, player) {
  const W = CONFIG.playArea, depth = CONFIG.rangeBand * CONFIG.setupDepth;
  return state.players[player].edge === 'bottom' ? { x0: 0, x1: W, y0: W - depth, y1: W } : { x0: 0, x1: W, y0: 0, y1: depth };
}

function deployValid(state, ship, pose) {
  const poly = basePolygon(pose, SHIPS[ship.chassis].size);
  const z = deployZone(state, ship.owner);
  if (!poly.every(p => p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1)) return 'Ship must be entirely inside your setup area.';
  if (overlapsAnyShip(state, poly, ship.id)) return 'Ships cannot overlap.';
  return null;
}

function autoDeployPose(state, ship) {
  const mine = shipList(state).filter(s => s.owner === ship.owner);
  const k = mine.indexOf(ship), W = CONFIG.playArea;
  const bottom = state.players[ship.owner].edge === 'bottom';
  const base = { x: (W * (k + 1)) / (mine.length + 1), y: bottom ? W - 50 : 50, h: bottom ? 0 : Math.PI };
  for (let i = 0; i < 200; i++) {
    const pose = i === 0 ? base : { ...base, x: 30 + nextRandom(state) * (W - 60) };
    if (!deployValid(state, ship, pose)) return pose;
  }
  throw new Error('no deploy spot');
}

function deployOrder(state) {
  const others = p => (p === state.initiative ? 0 : 1);
  return shipList(state).slice().sort((a, b) =>
    pilot(a).skill - pilot(b).skill || others(a.owner) - others(b.owner) || state.shipOrder.indexOf(a.id) - state.shipOrder.indexOf(b.id));
}

export const steps = {
  placeObstacle(state, s) {
    state.phase = 'obstacles';
    ask(state, {
      player: s.player, kind: 'placeObstacle',
      text: `Place asteroid ${s.shape + 1} of ${CONFIG.obstacleCount} (not within Range 1–2 of any edge).`,
      options: [{ id: 'auto', label: 'Random spot' }],
      onChoose: 'placeObstacle', data: { shape: s.shape },
    });
  },
  beginDeploy(state) {
    state.phase = 'deploy';
    push(state, ...deployOrder(state).map(sh => ({ t: 'deployShip', ship: sh.id })), { t: 'startRound' });
  },
  deployShip(state, s) {
    const ship = state.ships[s.ship];
    ask(state, {
      player: ship.owner, kind: 'deploy', ship: ship.id,
      text: `Deploy ${shipName(ship)} (pilot skill ${pilot(ship).skill}) inside your setup area.`,
      options: [{ id: 'auto', label: 'Auto-place' }],
      onChoose: 'deployShip', data: { ship: ship.id },
    });
  },
};

export const choices = {
  placeObstacle(state, data, choice, payload) {
    const o = choice === 'auto' ? randomObstacle(state, data.shape) : { shape: data.shape, x: +payload.x, y: +payload.y, rot: +payload.rot || 0 };
    const err = obstacleValid(state, o);
    if (err) throw new RuleError(err);
    state.obstacles.push({ id: `o${state.obstacles.length + 1}`, ...o });
  },
  deployShip(state, data, choice, payload) {
    const ship = state.ships[data.ship];
    const pose = choice === 'auto' ? autoDeployPose(state, ship) : { x: +payload.x, y: +payload.y, h: +payload.h || 0 };
    const err = deployValid(state, ship, pose);
    if (err) throw new RuleError(err);
    ship.pose = pose; ship.deployed = true;
    log(state, `${shipName(ship)} deployed.`);
  },
};

export { effectiveSkill };
