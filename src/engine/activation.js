// Round structure: Planning → Activation → (combat.js) → End.
// Activation per ship (lowest skill first):
//   ionized? fly a white 1-straight, no reveal
//   else: before-reveal effects → reveal (+ on-reveal effects) → stress check → move
//   move → obstacles / bumps → stress → after-maneuver effects → action step
import { dialFor, parseManeuver, SHIPS } from '../data/ships.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { buildPath, barrelRollPoses } from './maneuvers.js';
import { checkMines } from './ordnance.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect, closestPoints } from './geometry.js';
import { rollFace } from './dice.js';
import { sufferDamage, destroyShip } from './damage.js';
import { freshRound } from './setup.js';
import { ownSteps, everyone, flag, fold } from './hooks.js';
import { addStress } from './effects.js';
import {
  liveShips, shipName, chassis, enemyOf, effectiveSkill, maneuverColor, hasFaceup, obstaclePolys, shipPoly, shipList,
  overlapsAnyShip,
} from './queries.js';

/** Where a cloaked ship may decloak: barrel roll with the 2-straight template, or 2 straight ahead. */
export function decloakPositions(state, ship) {
  const size = chassis(ship).size;
  const rocks = flag(state, ship, 'phaseRocks') ? [] : obstaclePolys(state);
  const clear = poly => polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id) && !rocks.some(o => polygonsIntersect(poly, o));
  const out = barrelRollPoses(ship.pose, size, 2).map(r => ({ id: r.id, label: `Roll ${r.side} · ${r.label}`, pose: r.pose }));
  const ahead = buildPath(ship.pose, { speed: 2, bearing: 'S' }, size);
  out.push({ id: 'ahead', label: 'Straight ahead (2)', pose: ahead.final, template: ahead.templatePoly });
  return fold(state, ship, 'decloakPositions', out).filter(o => clear(basePolygon(o.pose, size)) && !(o.template && rocks.some(p => polygonsIntersect(o.template, p))));
}

/** Ships in pilot-skill order; ties: initiative player first, then squad order. */
export function skillOrder(state, dir = 1) {
  const ini = p => (p === state.initiative ? 0 : 1);
  return liveShips(state).sort((a, b) =>
    dir * (effectiveSkill(state, a) - effectiveSkill(state, b)) || ini(a.owner) - ini(b.owner) || state.shipOrder.indexOf(a.id) - state.shipOrder.indexOf(b.id));
}

/** Ships that need a dial this round (ionized ships fly a forced maneuver instead). */
export const needsDial = s => !(s.ion > 0);

/** Validate a player's dial choices: one legal maneuver per live ship they own. */
export function validateDials(state, player, dials) {
  for (const s of liveShips(state).filter(x => x.owner === player && needsDial(x))) {
    const key = dials?.[s.id];
    if (!key || !SHIPS[s.chassis].dial.some(c => c.startsWith(key + ':'))) throw new RuleError(`No legal maneuver chosen for ${shipName(s)}.`);
  }
}

export function submitDials(state, player, dials) {
  if (state.phase !== 'planning') throw new RuleError('Not the Planning phase.');
  if (state.planning.submitted[player]) throw new RuleError('Dials already submitted.');
  validateDials(state, player, dials);
  state.planning.submitted[player] = true;
  for (const s of liveShips(state).filter(x => x.owner === player && needsDial(x))) state.dials[s.id] = dials[s.id];
  log(state, `${state.players[player].name} locks in their dials.`);
  if (state.playerOrder.every(p => state.planning.submitted[p] || !liveShips(state).some(s => s.owner === p))) {
    state.prompt = null;
    push(state, { t: 'activationPhase' });
  }
}

const ION_MANEUVER = { key: '1S', speed: 1, bearing: 'S', color: 'w' };
// Off-dial maneuvers (a card may turn e.g. a 3-turn into a 3 Tallon roll) are parsed from the key.
const maneuverFor = (ship, key) => dialFor(ship.chassis).find(m => m.key === key) || parseManeuver(`${key}:w`);

export const steps = {
  startRound(state) {
    state.round++;
    state.phase = 'planning';
    state.dials = {};
    state.planning = { submitted: {} };
    state.skillOverride = {};
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
    const order = skillOrder(state, 1);
    push(state,
      ...everyone(state, 'startActivation'),
      ...order.filter(s => s.cloaked).map(s => ({ t: 'decloak', ship: s.id })),
      ...order.map(s => ({ t: 'activate', ship: s.id })),
      { t: 'detonateBombs' },
      { t: 'combatPhase' });
  },

  decloak(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed || !ship.cloaked) return;
    const opts = decloakPositions(state, ship).map(o => ({ id: o.id, label: o.label, pose: o.pose }));
    if (!opts.length) return;
    ask(state, { player: ship.owner, kind: 'rollPosition', ship: ship.id, text: `${shipName(ship)} may decloak (then it can attack again, but loses +2 agility).`,
      options: [...opts, { id: 'stay', label: 'Stay cloaked' }], onChoose: 'decloak', data: { ship: ship.id } });
  },

  activate(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    if (ship.ion > 0) {
      ship.round.revealed = '1S';
      log(state, `${shipName(ship)} is ionized and drifts forward.`);
      push(state, { t: 'move', ship: ship.id, key: '1S', color: 'w', ion: true });
      return;
    }
    push(state, ...ownSteps(state, ship, 'beforeReveal'), { t: 'reveal', ship: ship.id });
  },

  reveal(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const m = maneuverFor(ship, state.dials[ship.id]);
    ship.round.revealed = m.key;
    ship.round.maneuver = { key: m.key, color: maneuverColor(state, ship, m) };
    emit(state, { type: 'reveal', ship: ship.id, key: m.key });
    push(state, ...ownSteps(state, ship, 'onReveal', m), { t: 'stressCheck', ship: ship.id });
  },

  stressCheck(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const mv = ship.round.maneuver;
    if (ship.stress > 0 && mv.color === 'r' && !flag(state, ship, 'redWhileStressed')) {
      const opp = enemyOf(state, ship.owner);
      const opts = dialFor(ship.chassis).filter(x => maneuverColor(state, ship, x) !== 'r')
        .map(x => ({ id: x.key, label: x.key, maneuver: { ...x, color: maneuverColor(state, ship, x) } }));
      log(state, `${shipName(ship)} is stressed and revealed a red maneuver — opponent picks a replacement.`);
      ask(state, { player: opp, kind: 'overrideManeuver', ship: ship.id, text: `${shipName(ship)} is stressed: choose a non-red maneuver for it.`, options: opts, onChoose: 'overrideManeuver', data: { ship: ship.id } });
      return;
    }
    push(state, { t: 'move', ship: ship.id, key: mv.key, color: mv.color });
  },

  move(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const m = s.ion ? ION_MANEUVER : maneuverFor(ship, s.key);
    ship.round.moved = true;
    const color = s.color ?? maneuverColor(state, ship, m);
    const size = chassis(ship).size;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);

    let path = buildPath(ship.pose, m, size);
    let final = path.final, endU = path.length, bumped = [];
    const overlapping = pose => liveShips(state).filter(o => o.id !== ship.id && polygonsIntersect(basePolygon(pose, size), shipPoly(o)));

    if (overlapping(final).length) {
      if (path.rotates) path = buildPath(ship.pose, m, size, { basic: true }); // bumped loops/rolls lose their flip
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
    if (!bumped.length && path.rotates) samples.push(final);
    emit(state, { type: 'move', ship: ship.id, path: samples, from, key: m.key, color });
    ship.pose = final;

    log(state, `${shipName(ship)} executes ${m.key}${bumped.length ? ` and bumps into ${bumped.map(shipName).join(', ')}` : ''}.`);

    if (!polygonInsideBoard(basePolygon(final, size))) { destroyShip(state, ship, 'fled'); return; }

    const obs = ship.round.ignoreObstacles ? [] : obstaclePolys(state);
    const tpl = bumped.length || !path.templatePoly.length ? null : path.templatePoly;
    const hitObstacle = obs.some(o => polygonsIntersect(basePolygon(final, size), o) || (tpl && polygonsIntersect(tpl, o)));

    if (s.ion) { ship.ion = 0; }
    checkMines(state, ship, tpl ? [tpl] : []);
    if (ship.destroyed) return;
    // Pattern-analyser style cards take the red-maneuver stress after the action step instead.
    const lateStress = color === 'r' && flag(state, ship, 'delayStress');
    if (color === 'r' && !lateStress) addStress(state, ship);
    if (color === 'g' && ship.stress > 0) ship.stress--;
    if (bumped.length || hitObstacle) ship.round.skipAction = true;

    const after = [];
    if (hitObstacle) after.push({ t: 'obstacleHit', ship: ship.id });
    if ((bumped.length || hitObstacle) && hasFaceup(ship, 'dazed')) after.push({ t: 'simpleDamage', ship: ship.id, hits: 1, why: 'Dazed' });
    if (color === 'r' && hasFaceup(ship, 'hull_breach')) after.push({ t: 'rollForDamage', ship: ship.id, why: 'Hull Breach' });
    after.push(...ownSteps(state, ship, 'afterManeuver', color, { blocked: ship.round.skipAction, bumped: bumped.length > 0 }));
    after.push(...everyone(state, 'anyManeuver', ship, color, { bumped: bumped.length > 0, hitObstacle }));
    push(state, ...after, ...(s.slam ? [] : [{ t: 'actionStep', ship: ship.id }]), ...(lateStress ? [{ t: 'stressStep', ship: ship.id }] : []));
  },

  obstacleHit(state, s) {
    const ship = state.ships[s.ship];
    const f = rollFace(state, 'attack');
    emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Asteroid impact' });
    log(state, `${shipName(ship)} hits an asteroid and rolls ${f}.`);
    if (f === 'hit') sufferDamage(state, ship, 1, 0);
    if (f === 'crit' && !flag(state, ship, 'phaseRocks')) sufferDamage(state, ship, 0, 1);
  },
  simpleDamage(state, s) {
    const ship = state.ships[s.ship];
    log(state, `${shipName(ship)} suffers damage (${s.why}).`);
    sufferDamage(state, ship, s.hits || 0, s.crits || 0);
  },
  rollForDamage(state, s) {
    const ship = state.ships[s.ship];
    const f = rollFace(state, 'attack');
    emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: s.why });
    log(state, `${s.why}: ${shipName(ship)} rolls ${f}.`);
    if (f === 'hit') sufferDamage(state, ship, 1, 0);
  },

  endPhase(state) {
    state.phase = 'end';
    push(state, ...everyone(state, 'endPhase'), { t: 'endCleanup' });
  },
  endCleanup(state) {
    for (const s of shipList(state)) {
      if (!flag(state, s, 'keepFocus')) s.tokens.focus = 0;
      s.tokens.evade = 0;
      s.disarmed = false; s.jam = 0; s.tractor = 0;
    }
    push(state, { t: 'startRound' });
  },
};

export const choices = {
  decloak(state, data, choice) {
    if (choice === 'stay') return;
    const ship = state.ships[data.ship];
    const o = decloakPositions(state, ship).find(x => x.id === choice);
    if (!o) throw new RuleError('cannot decloak there');
    const from = ship.pose;
    ship.pose = o.pose; ship.cloaked = false;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
    emit(state, { type: 'move', ship: ship.id, path: [from, o.pose] });
    emit(state, { type: 'decloak', ship: ship.id });
    log(state, `${shipName(ship)} decloaks!`);
    checkMines(state, ship, o.template ? [o.template] : []);
  },
  overrideManeuver(state, data, choice) {
    const ship = state.ships[data.ship];
    const m = maneuverFor(ship, choice);
    push(state, { t: 'move', ship: data.ship, key: choice, color: maneuverColor(state, ship, m) });
  },
};

export { parseManeuver };
