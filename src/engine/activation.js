// Round structure: Planning → Activation → (combat.js) → End.
import { dialFor, parseManeuver, SHIPS } from '../data/ships.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { buildPath, samplePath } from './maneuvers.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect, closestPoints } from './geometry.js';
import { rollFace } from './dice.js';
import { sufferDamage, destroyShip } from './damage.js';
import { freshRound } from './setup.js';
import { afterManeuver } from './abilities.js';
import {
  liveShips, shipName, chassis, enemyOf, effectiveSkill, maneuverColor,
  hasFaceup, obstaclePolys, shipPoly, shipList,
} from './queries.js';

/** Ships in pilot-skill order; ties: initiative player first, then squad order. */
export function skillOrder(state, dir = 1) {
  const ini = p => (p === state.initiative ? 0 : 1);
  return liveShips(state).sort((a, b) =>
    dir * (effectiveSkill(state, a) - effectiveSkill(state, b)) || ini(a.owner) - ini(b.owner) || state.shipOrder.indexOf(a.id) - state.shipOrder.indexOf(b.id));
}

/** Validate a player's dial choices: one legal maneuver per live ship they own. */
export function validateDials(state, player, dials) {
  for (const s of liveShips(state).filter(x => x.owner === player)) {
    const key = dials?.[s.id];
    if (!key || !SHIPS[s.chassis].dial.some(c => c.startsWith(key + ':'))) throw new RuleError(`No legal maneuver chosen for ${shipName(s)}.`);
  }
}

export function submitDials(state, player, dials) {
  if (state.phase !== 'planning') throw new RuleError('Not the Planning phase.');
  if (state.planning.submitted[player]) throw new RuleError('Dials already submitted.');
  validateDials(state, player, dials);
  state.planning.submitted[player] = true;
  for (const s of liveShips(state).filter(x => x.owner === player)) state.dials[s.id] = dials[s.id];
  log(state, `${state.players[player].name} locks in their dials.`);
  if (state.playerOrder.every(p => state.planning.submitted[p] || !liveShips(state).some(s => s.owner === p))) {
    state.prompt = null;
    push(state, { t: 'activationPhase' });
  }
}

function maneuverFor(ship, key) {
  return dialFor(ship.chassis).find(m => m.key === key);
}

export const steps = {
  startRound(state) {
    state.round++;
    state.phase = 'planning';
    state.dials = {};
    state.planning = { submitted: {} };
    for (const s of shipList(state)) s.round = freshRound();
    log(state, `— Round ${state.round} —`);
    ask(state, {
      players: state.playerOrder.slice(), kind: 'planning',
      text: 'Secretly choose a maneuver for each of your ships.',
      options: [], onChoose: null, data: {},
    });
  },

  activationPhase(state) {
    state.phase = 'activation';
    push(state, ...skillOrder(state, 1).map(s => ({ t: 'activate', ship: s.id })), { t: 'combatPhase' });
  },

  activate(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const m = maneuverFor(ship, state.dials[ship.id]);
    ship.round.revealed = m.key;
    emit(state, { type: 'reveal', ship: ship.id, key: m.key });
    if (ship.stress > 0 && maneuverColor(state, ship, m) === 'r') {
      const opp = enemyOf(state, ship.owner);
      const opts = dialFor(ship.chassis).filter(x => maneuverColor(state, ship, x) !== 'r').map(x => ({ id: x.key, label: x.key, maneuver: x }));
      log(state, `${shipName(ship)} is stressed and revealed a red maneuver — opponent picks a replacement.`);
      ask(state, { player: opp, kind: 'overrideManeuver', ship: ship.id, text: `${shipName(ship)} is stressed: choose a non-red maneuver for it.`, options: opts, onChoose: 'overrideManeuver', data: { ship: ship.id } });
      return;
    }
    push(state, { t: 'move', ship: ship.id, key: m.key });
  },

  move(state, s) {
    const ship = state.ships[s.ship];
    const m = maneuverFor(ship, s.key);
    const color = maneuverColor(state, ship, m);
    const size = chassis(ship).size;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);

    let path = buildPath(ship.pose, m, size);
    let final = path.final, endU = path.length, bumped = [];
    const overlapping = pose => liveShips(state).filter(o => o.id !== ship.id && polygonsIntersect(basePolygon(pose, size), shipPoly(o)));

    if (overlapping(final).length) {
      if (m.bearing === 'K') path = buildPath(ship.pose, m, size, { asStraight: true });
      for (let u = path.length; u >= -path.base; u -= 0.5) {
        const pose = path.poseAt(u);
        if (!overlapping(pose).length) { final = pose; endU = u; break; }
      }
      const fp = basePolygon(final, size);
      bumped = liveShips(state).filter(o => o.id !== ship.id && closestPoints(fp, shipPoly(o)).d < 1.5);
      for (const o of bumped) state.touches.push([ship.id, o.id]);
    }

    const from = ship.pose;
    const samples = [];
    for (let i = 0; i <= 24; i++) samples.push(path.poseAt(-path.base + ((endU + path.base) * i) / 24));
    if (!bumped.length && path.bearing === 'K') samples.push(final);
    emit(state, { type: 'move', ship: ship.id, path: samples, from, key: m.key, color });
    ship.pose = final;

    log(state, `${shipName(ship)} executes ${m.key}${bumped.length ? ` and bumps into ${bumped.map(shipName).join(', ')}` : ''}.`);

    if (!polygonInsideBoard(basePolygon(final, size))) { destroyShip(state, ship, 'fled'); return; }

    const obs = obstaclePolys(state);
    const tpl = bumped.length ? null : path.templatePoly;
    const hitObstacle = obs.some(o => polygonsIntersect(basePolygon(final, size), o) || (tpl && polygonsIntersect(tpl, o)));

    if (color === 'r') ship.stress++;
    if (color === 'g' && ship.stress > 0) ship.stress--;
    if (bumped.length || hitObstacle) ship.round.skipAction = true;

    const after = [];
    if (hitObstacle) after.push({ t: 'obstacleHit', ship: ship.id });
    if ((bumped.length || hitObstacle) && hasFaceup(ship, 'dazed')) after.push({ t: 'simpleDamage', ship: ship.id, hits: 1, why: 'Dazed' });
    if (color === 'r' && hasFaceup(ship, 'hull_breach')) after.push({ t: 'rollForDamage', ship: ship.id, why: 'Hull Breach' });
    after.push(...afterManeuver(state, ship, color, { blocked: ship.round.skipAction }));
    push(state, ...after, { t: 'actionStep', ship: ship.id });
  },

  obstacleHit(state, s) {
    const ship = state.ships[s.ship];
    const f = rollFace(state, 'attack');
    emit(state, { type: 'roll', ship: ship.id, faces: [f] });
    log(state, `${shipName(ship)} hits an asteroid and rolls ${f}.`);
    if (f === 'hit') sufferDamage(state, ship, 1, 0);
    if (f === 'crit') sufferDamage(state, ship, 0, 1);
  },
  simpleDamage(state, s) {
    const ship = state.ships[s.ship];
    log(state, `${shipName(ship)} suffers damage (${s.why}).`);
    sufferDamage(state, ship, s.hits || 0, s.crits || 0);
  },
  rollForDamage(state, s) {
    const ship = state.ships[s.ship];
    const f = rollFace(state, 'attack');
    log(state, `${s.why}: ${shipName(ship)} rolls ${f}.`);
    if (f === 'hit') sufferDamage(state, ship, 1, 0);
  },
  repairDrone(state, s) {
    const ship = state.ships[s.ship];
    ship.shields++;
    log(state, `${shipName(ship)}'s Repair Drone restores a shield.`);
  },

  endPhase(state) {
    state.phase = 'end';
    for (const s of shipList(state)) { s.tokens.focus = 0; s.tokens.evade = 0; }
    push(state, { t: 'startRound' });
  },
};

export const choices = {
  overrideManeuver(state, data, choice) {
    push(state, { t: 'move', ship: data.ship, key: choice });
  },
};

export { parseManeuver };
