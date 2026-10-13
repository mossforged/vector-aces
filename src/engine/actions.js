// The "Perform Action" step: action menus, free actions, and each action's effect.
// Actions come from the ship's action bar (focus, lock, roll, evade, boost), from cards
// (`actions` in engine/cards/*) and from repairable Damage cards.
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { barrelRollPoses, buildPath } from './maneuvers.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect } from './geometry.js';
import { rollFace } from './dice.js';
import { flipFacedown } from './damage.js';
import { cardActions, fold, ownSteps, everyone } from './hooks.js';
import { addStress, acquireLock, jammed, freeAction } from './effects.js';
import { checkMines } from './ordnance.js';
import { dialFor } from '../data/ships.js';
import { UPGRADES } from '../data/upgrades.js';
import {
  chassis, liveShips, shipName, hasFaceup, rangeBetween, actionBar, hasFlag, maneuverColor, friendsInRange, enemiesInRange,
  overlapsAnyShip, obstaclePolys, faceupCards, shipPoly,
} from './queries.js';

export const ACTION_LABELS = {
  focus: 'Focus', evade: 'Evade', lock: 'Target lock', roll: 'Barrel roll', boost: 'Boost', pass: 'Pass',
  slam: 'SLAM (second maneuver)', cloak: 'Cloak', reload: 'Reload', jam: 'Jam', coordinate: 'Coordinate', reinforce: 'Reinforce',
};

/** Weapon upgrades a Reload action could restore. */
const reloadable = ship => ship.upgrades.filter(u => u.discarded && ['torpedo', 'missile'].includes(UPGRADES[u.id].slot));
/** Maneuvers a SLAM could use: same speed as this round's maneuver. */
function slamOptions(state, ship) {
  if (!ship.round.moved || !ship.round.revealed) return [];
  const speed = parseInt(ship.round.revealed, 10);
  return dialFor(ship.chassis).filter(m => m.speed === speed && !(ship.stress > 0 && maneuverColor(state, ship, m) === 'r'));
}

function lockTargets(state, ship) {
  return fold(state, ship, 'lockTargets', liveShips(state).filter(o => o.owner !== ship.owner && rangeBetween(ship, o).band));
}

function clearOf(state, ship, poly, template = null) {
  const obs = obstaclePolys(state);
  return polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id)
    && !obs.some(o => polygonsIntersect(poly, o) || (template && polygonsIntersect(template, o)));
}

export function rollPositions(state, ship) {
  return barrelRollPoses(ship.pose, chassis(ship).size).filter(r => clearOf(state, ship, basePolygon(r.pose, chassis(ship).size)));
}

/** Tractor-beam drag: barrel roll or 1-straight boost; obstacles allowed, ships and the edge not. */
export function tractorPositions(state, ship) {
  const size = chassis(ship).size;
  const ok = pose => { const poly = basePolygon(pose, size); return polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id); };
  const out = barrelRollPoses(ship.pose, size).map(r => ({ id: r.id, label: `Roll ${r.side} · ${r.label}`, pose: r.pose }));
  out.push({ id: 'S', label: 'Pull forward (1 straight)', pose: buildPath(ship.pose, { speed: 1, bearing: 'S' }, size).final });
  return size === 'small' ? out.filter(o => ok(o.pose)) : [];
}

export function boostPositions(state, ship) {
  const size = chassis(ship).size;
  const templates = fold(state, ship, 'boostTemplates', [['BL', 'Bank left'], ['S', 'Straight'], ['BR', 'Bank right']]);
  return templates.map(([b, label]) => {
    const path = buildPath(ship.pose, { speed: 1, bearing: b }, size);
    return clearOf(state, ship, basePolygon(path.final, size), path.templatePoly) ? { id: b, label, pose: path.final, path } : null;
  }).filter(Boolean);
}

/** All actions this ship could take right now (excluding pass). `grant` adds actions not on the bar. */
export function availableActions(state, ship, { only = null, grant = [] } = {}) {
  if (ship.stress > 0 && !hasFlag(state, ship, 'actWhileStressed')) return [];
  const used = ship.round.actionsUsed;
  let list = [];
  if (!hasFaceup(ship, 'sensor_burnout')) {
    for (const a of new Set([...actionBar(state, ship), ...grant])) list.push({ id: a, label: ACTION_LABELS[a] });
    for (const [id, def] of Object.entries(cardActions(ship))) if (def.can(state, ship)) list.push({ id, label: def.label });
  }
  for (const c of faceupCards(ship)) if (DAMAGE_CARDS[c.card].repair) list.push({ id: `repair:${c.card}`, label: `Repair: ${DAMAGE_CARDS[c.card].name}` });
  list = list.filter((a, i) => list.findIndex(b => b.id === a.id) === i && !used.includes(a.id));
  if (only) list = list.filter(a => only.includes(a.id));
  return list.filter(a => {
    if (a.id === 'lock') return lockTargets(state, ship).length > 0;
    if (a.id === 'roll') return rollPositions(state, ship).length > 0;
    if (a.id === 'boost') return boostPositions(state, ship).length > 0;
    if (a.id === 'slam') return slamOptions(state, ship).length > 0;
    if (a.id === 'cloak') return !ship.cloaked;
    if (a.id === 'reload') return reloadable(ship).length > 0;
    if (a.id === 'jam') return enemiesInRange(state, ship, 1, 2).length > 0;
    if (a.id === 'coordinate') return friendsInRange(state, ship, 1, 2).length > 0;
    return true;
  });
}

/** Ask the ship's owner to pick an action (or a free action when `free`). */
export function askAction(state, ship, { free = false, only = null, grant = [], reason = '', extra = {} } = {}) {
  const opts = availableActions(state, ship, { only, grant });
  if (!opts.length) return;
  ask(state, {
    player: ship.owner, kind: 'action', ship: ship.id,
    text: free ? `${reason || 'Free action'} — ${shipName(ship)}` : `Choose an action for ${shipName(ship)}.`,
    options: [...opts, { id: 'pass', label: free ? 'Skip' : 'Pass' }],
    onChoose: 'action', data: { ship: ship.id, free, ...extra },
  });
}

export function performAction(state, ship, id) {
  ship.round.actionsUsed.push(id);
  switch (id) {
    case 'focus': {
      if (jammed(state, ship)) break;
      const n = fold(state, ship, 'focusGain', 1);
      ship.tokens.focus += n;
      log(state, `${shipName(ship)} focuses${n > 1 ? ` (+${n})` : ''}.`);
      break;
    }
    case 'evade': if (jammed(state, ship)) break; ship.tokens.evade++; log(state, `${shipName(ship)} prepares to evade.`); break;
    case 'cloak': ship.cloaked = true; emit(state, { type: 'cloak', ship: ship.id }); log(state, `${shipName(ship)} cloaks.`); break;
    case 'slam': {
      const opts = slamOptions(state, ship).map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: maneuverColor(state, ship, m) } }));
      ask(state, { player: ship.owner, kind: 'overrideManeuver', ship: ship.id, text: `${shipName(ship)}: SLAM — choose a second maneuver of the same speed (then weapons are disabled this round).`, options: opts, onChoose: 'slam', data: { ship: ship.id } });
      break;
    }
    case 'reload': {
      const opts = reloadable(ship).map(u => ({ id: u.id, label: UPGRADES[u.id].name }));
      ask(state, { player: ship.owner, kind: 'pick', ship: ship.id, text: 'Reload which weapon? (Weapons are disabled for the rest of this round.)', options: opts, onChoose: 'reload', data: { ship: ship.id } });
      break;
    }
    case 'jam': {
      const opts = enemiesInRange(state, ship, 1, 2).map(e => ({ id: e.id, label: `${shipName(e)} (jam ${e.jam || 0}/2)`, target: e.id }));
      ask(state, { player: ship.owner, kind: 'pick', ship: ship.id, text: 'Jam which enemy? (Up to 2 jam tokens: each one cancels its next focus, evade or lock.)', options: opts, onChoose: 'jam', data: { ship: ship.id } });
      break;
    }
    case 'coordinate': {
      const opts = friendsInRange(state, ship, 1, 2).map(o => ({ id: o.id, label: shipName(o), target: o.id }));
      ask(state, { player: ship.owner, kind: 'pick', ship: ship.id, text: 'Coordinate: which wingmate gets a free action?', options: opts, onChoose: 'coordinate', data: { ship: ship.id } });
      break;
    }
    case 'reinforce':
      ask(state, { player: ship.owner, kind: 'pick', ship: ship.id, text: 'Reinforce which half of the ship this round?',
        options: [{ id: 'fore', label: 'Fore (front half)' }, { id: 'aft', label: 'Aft (rear half)' }], onChoose: 'reinforce', data: { ship: ship.id } });
      break;
    case 'lock': push(state, { t: 'lockPrompt', ship: ship.id }); break;
    case 'roll': {
      const opts = rollPositions(state, ship).map(r => ({ id: r.id, label: `${r.side} · ${r.label}`, pose: r.pose }));
      ask(state, { player: ship.owner, kind: 'rollPosition', ship: ship.id, text: 'Barrel roll where?', options: opts, onChoose: 'rollPosition', data: { ship: ship.id } });
      break;
    }
    case 'boost': {
      const opts = boostPositions(state, ship).map(r => ({ id: r.id, label: r.label, pose: r.pose }));
      ask(state, { player: ship.owner, kind: 'rollPosition', ship: ship.id, text: 'Boost which way?', options: opts, onChoose: 'boostPosition', data: { ship: ship.id } });
      break;
    }
    default: {
      const card = cardActions(ship)[id];
      if (card) { card.perform(state, ship); break; }
      if (id.startsWith('repair:')) {
        const cardId = id.slice(7);
        const def = DAMAGE_CARDS[cardId];
        if (def.repairAlways) { flipFacedown(state, ship, cardId); break; }
        const f = rollFace(state, 'attack');
        const ok = f === 'hit' || (cardId === 'weapons_fault' && f === 'crit');
        emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: `Repair: ${def.name}`, success: ok });
        log(state, `${shipName(ship)} attempts repairs: rolled ${f}.`);
        if (ok) flipFacedown(state, ship, cardId);
        break;
      }
      throw new RuleError(`unknown action ${id}`);
    }
  }
}

export const steps = {
  actionStep(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed || ship.round.skipAction) return;
    const n = s.n || 1;
    if (n < fold(state, ship, 'actionsPerTurn', 1)) push(state, { t: 'actionStep', ship: ship.id, n: n + 1 });
    askAction(state, ship);
  },
  freeAction(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    askAction(state, ship, { free: true, only: s.only, grant: s.grant || [], reason: s.reason, extra: { stressAfter: !!s.stressAfter, markSkip: !!s.markSkip } });
  },
  afterAction(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    push(state, ...ownSteps(state, ship, 'afterAction', s.action), ...everyone(state, 'anyAction', ship, s.action));
  },
  lockPrompt(state, s) {
    const ship = state.ships[s.ship ?? s.choice];
    if (!ship || ship.destroyed) return;
    const opts = lockTargets(state, ship).map(o => ({ id: o.id, label: `${shipName(o)} (Range ${rangeBetween(ship, o).band})`, target: o.id }));
    if (!opts.length) return;
    ask(state, { player: ship.owner, kind: 'lockTarget', ship: ship.id, text: `${shipName(ship)}: lock onto which enemy?`, options: opts, onChoose: 'lockTarget', data: { ship: ship.id } });
  },
  stressStep(state, s) { addStress(state, state.ships[s.ship]); },
  tractorMove(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const opts = tractorPositions(state, ship).map(o => ({ id: o.id, label: o.label, pose: o.pose }));
    if (!opts.length) return;
    ask(state, { player: s.player, kind: 'rollPosition', ship: ship.id, text: `Tractor beam: drag ${shipName(ship)}?`,
      options: [...opts, { id: 'stay', label: 'Leave it' }], onChoose: 'tractorMove', data: { ship: ship.id } });
  },
};

export const choices = {
  action(state, data, choice) {
    if (choice === 'pass') return;
    const ship = state.ships[data.ship];
    if (data.stressAfter) push(state, { t: 'stressStep', ship: ship.id });
    if (data.markSkip) ship.round.skipAction = true;
    push(state, { t: 'afterAction', ship: ship.id, action: choice });
    performAction(state, ship, choice);
  },
  lockTarget(state, data, choice) {
    acquireLock(state, state.ships[data.ship], state.ships[choice]);
  },
  rollPosition(state, data, choice) {
    const ship = state.ships[data.ship];
    const r = rollPositions(state, ship).find(x => x.id === choice);
    if (!r) throw new RuleError('illegal barrel roll');
    const from = ship.pose;
    ship.pose = r.pose;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
    emit(state, { type: 'move', ship: ship.id, path: [from, r.pose] });
    log(state, `${shipName(ship)} barrel rolls ${r.side}.`);
    checkMines(state, ship);
  },
  tractorMove(state, data, choice) {
    if (choice === 'stay') return;
    const ship = state.ships[data.ship];
    const o = tractorPositions(state, ship).find(x => x.id === choice);
    if (!o) throw new RuleError('illegal tractor move');
    const from = ship.pose;
    ship.pose = o.pose;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
    emit(state, { type: 'move', ship: ship.id, path: [from, o.pose] });
    log(state, `${shipName(ship)} is dragged by the tractor beam.`);
    checkMines(state, ship);
    if (!ship.destroyed && obstaclePolys(state).some(p => polygonsIntersect(shipPoly(ship), p))) push(state, { t: 'obstacleHit', ship: ship.id });
  },
  slam(state, data, choice) {
    const ship = state.ships[data.ship];
    if (!slamOptions(state, ship).some(m => m.key === choice)) throw new RuleError('illegal SLAM');
    ship.disarmed = true;
    push(state, { t: 'move', ship: ship.id, key: choice, slam: true });
  },
  reload(state, data, choice) {
    const ship = state.ships[data.ship];
    const u = reloadable(ship).find(x => x.id === choice); if (!u) throw new RuleError('nothing to reload');
    u.discarded = false; ship.disarmed = true;
    log(state, `${shipName(ship)} reloads ${UPGRADES[u.id].name}.`);
  },
  jam(state, data, choice) {
    const t = state.ships[choice];
    t.jam = Math.max(t.jam || 0, 2);
    log(state, `${shipName(state.ships[data.ship])} jams ${shipName(t)}.`);
  },
  coordinate(state, data, choice) { push(state, freeAction(state.ships[choice], 'Coordinate: free action')); },
  reinforce(state, data, choice) {
    const ship = state.ships[data.ship];
    ship.round.reinforce = choice;
    log(state, `${shipName(ship)} reinforces its ${choice} shields.`);
  },
  boostPosition(state, data, choice) {
    const ship = state.ships[data.ship];
    const r = boostPositions(state, ship).find(x => x.id === choice);
    if (!r) throw new RuleError('illegal boost');
    const samples = [];
    for (let i = 0; i <= 12; i++) samples.push(r.path.poseAt(-r.path.base + ((r.path.length + r.path.base) * i) / 12));
    ship.pose = r.pose;
    state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
    emit(state, { type: 'move', ship: ship.id, path: samples });
    log(state, `${shipName(ship)} boosts (${r.label.toLowerCase()}).`);
    checkMines(state, ship, [r.path.templatePoly]);
  },
};
