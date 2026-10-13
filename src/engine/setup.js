// Game creation, obstacle placement and deployment.
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';
import { FACTIONS, TIE_INITIATIVE_FACTION } from '../data/factions.js';
import { buildDamageDeck } from '../data/damageDeck.js';
import { CONFIG, ASTEROIDS } from '../data/config.js';
import { shuffle, nextRandom, seedFromString } from './rng.js';
import { push, enqueue, ask, log, RuleError } from './flow.js';
import { basePolygon, placeShape, polygonsIntersect, polygonInsideBoard, distanceToEdge } from './geometry.js';
import { shipList, pilot, obstaclePolys, overlapsAnyShip, effectiveSkill, shipName, stat } from './queries.js';
import { fold } from './hooks.js';

export const ENGINE_VERSION = 2;

/** Points for one ship: pilot + upgrades, with `discount: { slot, amount }` cards lowering other upgrades (min 0). */
export function entryPoints(e) {
  const ups = (e.upgrades || []).filter(u => UPGRADES[u]);
  const discounts = ups.map(u => UPGRADES[u].discount).filter(Boolean);
  return PILOTS[e.pilot].cost + ups.reduce((m, u) => {
    let c = UPGRADES[u].cost;
    for (const d of discounts) if ((d.slot === '*' && UPGRADES[u].discount !== d) || UPGRADES[u].slot === d.slot) c = Math.max(0, c - d.amount);
    return m + c;
  }, 0);
}

export function squadPoints(squad) {
  return squad.reduce((n, e) => n + entryPoints(e), 0);
}

/**
 * Upgrade slots a pilot has with these upgrades fitted: its own bar plus any slots granted by
 * fitted upgrades (`grants: ['elite']`, e.g. a drone that adds an Elite slot).
 */
export function slotsFor(pilotId, upgradeIds = []) {
  let slots = PILOTS[pilotId].slots.slice();
  for (const u of upgradeIds) for (const g of UPGRADES[u]?.grants || []) slots.push(g);
  // grantsOneOf: the card adds ONE of these slots — whichever another fitted upgrade uses (all are offered until then).
  for (const u of upgradeIds) {
    const one = UPGRADES[u]?.grantsOneOf; if (!one) continue;
    const used = upgradeIds.map(x => UPGRADES[x]?.slot).find(sl => one.includes(sl) && !PILOTS[pilotId].slots.includes(sl));
    slots.push(...(used ? [used] : one));
  }
  for (const u of upgradeIds) for (const r of UPGRADES[u]?.removes || []) slots = slots.filter(x => x !== r); // e.g. a title that strips missile slots
  return slots;
}

/** Upgrade ids a pilot could legally equip in some slot (ignores uniqueness and points). */
export function upgradeAllowed(pilotId, upgradeId, upgradeIds = []) {
  const p = PILOTS[pilotId], u = UPGRADES[upgradeId], ch = SHIPS[p.ship];
  if (u.faction && u.faction !== p.faction) return false;
  if (u.ships && !u.ships.includes(p.ship)) return false;
  if (u.sizes && !u.sizes.includes(ch.size)) return false;
  if (u.minSkill && p.skill < u.minSkill) return false;
  if (u.noSlot && p.slots.includes(u.noSlot)) return false;
  if (u.maxHull && ch.hull > u.maxHull) return false;
  if (u.shieldValue !== undefined && ch.shields !== u.shieldValue) return false;
  if (u.needsAction && !ch.actions.includes(u.needsAction)) return false;
  if (u.needsSlots && !u.needsSlots.every(sl => p.slots.includes(sl))) return false;
  if (u.maxAgility !== undefined && ch.agility > u.maxAgility) return false;
  return slotsFor(pilotId, upgradeIds.filter(x => x !== upgradeId)).includes(u.slot);
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
    if (p.faction !== faction) errs.push(`${p.name} is not a ${FACTIONS[faction].short} pilot.`);
    const names = [p.unique ? p.name : null, ...(e.upgrades || []).map(u => (UPGRADES[u]?.unique ? UPGRADES[u].name : null))].filter(Boolean);
    for (const n of names) { if (uniques.has(n)) errs.push(`Only one "${n}" allowed.`); uniques.add(n); }
    if ((e.upgrades || []).some(u => !UPGRADES[u])) { errs.push(`Unknown upgrade in ${p.name}'s loadout`); continue; }
    const slots = slotsFor(e.pilot, e.upgrades || []);
    for (const u of e.upgrades || []) {
      const def = UPGRADES[u];
      if (!upgradeAllowed(e.pilot, u, e.upgrades)) { errs.push(`${def.name} can't be fitted to ${p.name}.`); continue; }
      const i = slots.indexOf(def.slot);
      if (i < 0) errs.push(`${p.name} has no free ${def.slot} slot for ${def.name}.`); else slots.splice(i, 1);
      if (def.requiresUpgrade && !(e.upgrades || []).includes(def.requiresUpgrade)) errs.push(`${def.name} needs ${UPGRADES[def.requiresUpgrade]?.name} fitted too.`);
    }
  }
  if (squadPoints(squad) > pointLimit) errs.push(`Squad is ${squadPoints(squad)} points (limit ${pointLimit}).`);
  return errs;
}

/**
 * Create a new game state. Nothing here is random except via state.rng, so
 * two peers calling createGame with the same options get identical states.
 *  opts = { seed, obstacles: bool, seats: [{ faction, name, squad }, { faction, name, squad }] }
 * Seat 1 ('p1') deploys at the bottom edge, seat 2 ('p2') at the top.
 * (Legacy shape { squads: { league, dominion }, names } is still accepted.)
 */
export function createGame(opts) {
  const seats = opts.seats || ['league', 'dominion'].map(f => ({ faction: f, name: opts.names?.[f], squad: opts.squads[f] }));
  const playerOrder = ['p1', 'p2'];
  const state = {
    v: ENGINE_VERSION,
    rng: typeof opts.seed === 'number' ? opts.seed >>> 0 : seedFromString(opts.seed ?? 'vector-aces'),
    round: 0,
    phase: 'setup',
    playerOrder,
    players: {},
    initiative: null,
    ships: {}, shipOrder: [],
    obstacles: [],
    ordnance: [],
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
  const mirror = seats[0].faction === seats[1].faction;
  playerOrder.forEach((p, i) => {
    const f = FACTIONS[seats[i].faction];
    const look = mirror && i === 1 ? f.alt : f;
    state.players[p] = {
      id: p, faction: f.id, name: seats[i].name || `${f.short}${mirror ? ` ${i + 1}` : ''}`,
      points: squadPoints(seats[i].squad), edge: i === 0 ? 'bottom' : 'top',
      color: look.color, arcColor: look.arcColor,
    };
  });
  const [a, b] = playerOrder.map(p => state.players[p]);
  if (a.points !== b.points) state.initiative = a.points < b.points ? 'p1' : 'p2';
  else if ((a.faction === TIE_INITIATIVE_FACTION) !== (b.faction === TIE_INITIATIVE_FACTION)) state.initiative = a.faction === TIE_INITIATIVE_FACTION ? 'p1' : 'p2';
  else state.initiative = nextRandom(state) < 0.5 ? 'p1' : 'p2';
  const initiative = state.initiative;
  const squads = { p1: seats[0].squad, p2: seats[1].squad };

  let n = 0;
  for (const p of playerOrder) {
    const counts = {};
    for (const e of squads[p]) counts[e.pilot] = (counts[e.pilot] || 0) + 1;
    const seen = {};
    for (const e of squads[p]) {
      const id = `s${++n}`;
      const pd = PILOTS[e.pilot];
      seen[e.pilot] = (seen[e.pilot] || 0) + 1;
      state.ships[id] = {
        id, owner: p, pilot: e.pilot, chassis: pd.ship,
        tag: counts[e.pilot] > 1 ? seen[e.pilot] : null,
        upgrades: (e.upgrades || []).map(u => ({ id: u, discarded: false })),
        shields: 0, ion: 0, conditions: [], cloaked: false, jam: 0, tractor: 0, disarmed: false,
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
  log(state, `${state.players[initiative].name} (${FACTIONS[state.players[initiative].faction].short}) has initiative.`);

  if (state.options.obstacles) {
    let who = initiative;
    for (let i = 0; i < CONFIG.obstacleCount; i++) {
      enqueue(state, { t: 'placeObstacle', player: who, shape: i });
      who = who === 'p1' ? 'p2' : 'p1';
    }
  }
  enqueue(state, { t: 'beginDeploy' });
  return state;
}

export function freshRound() {
  return { actionsUsed: [], skipAction: false, agilityBonus: 0, attackBonus: 0, deadeye: false, attacked: false, revealed: null, maneuver: null, reinforce: null, moved: false };
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
  const sk = s => fold(state, s, 'deploySkill', pilot(s).skill);
  return shipList(state).slice().sort((a, b) =>
    sk(a) - sk(b) || others(a.owner) - others(b.owner) || state.shipOrder.indexOf(a.id) - state.shipOrder.indexOf(b.id));
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
