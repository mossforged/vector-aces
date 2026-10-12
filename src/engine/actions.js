// The "Perform Action" step: action menus, free actions, and each action's effect.
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { barrelRollPoses } from './maneuvers.js';
import { basePolygon, polygonInsideBoard } from './geometry.js';
import { rollFace } from './dice.js';
import { flipFacedown } from './damage.js';
import {
  chassis, liveShips, shipName, hasFaceup, activeUpgrades, rangeBetween,
  overlapsAnyShip, overlapsAnyObstacle, faceupCards,
} from './queries.js';

export const ACTION_LABELS = {
  focus: 'Focus', evade: 'Evade', lock: 'Target lock', roll: 'Barrel roll',
  deflector_drone: 'Deflector Drone (+1 agility)', deadeye: 'Deadeye', pass: 'Pass',
};

function lockTargets(state, ship) {
  return liveShips(state).filter(o => o.owner !== ship.owner && rangeBetween(ship, o).band);
}

function rollPositions(state, ship) {
  return barrelRollPoses(ship.pose, chassis(ship).size).filter(r => {
    const poly = basePolygon(r.pose, chassis(ship).size);
    return polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id) && !overlapsAnyObstacle(state, poly);
  });
}

/** All actions this ship could take right now (excluding pass). */
export function availableActions(state, ship, { only = null } = {}) {
  if (ship.stress > 0) return [];
  const used = ship.round.actionsUsed;
  const repairs = faceupCards(ship)
    .filter(c => DAMAGE_CARDS[c.card].repair)
    .map(c => ({ id: `repair:${c.card}`, label: `Repair: ${DAMAGE_CARDS[c.card].name}` }));
  let list = [];
  if (!hasFaceup(ship, 'sensor_burnout')) {
    for (const a of chassis(ship).actions) list.push({ id: a, label: ACTION_LABELS[a] });
    for (const u of activeUpgrades(ship)) if (ACTION_LABELS[u] && u !== 'pass') list.push({ id: u, label: ACTION_LABELS[u] });
  }
  list.push(...repairs);
  list = list.filter((a, i) => list.findIndex(b => b.id === a.id) === i && !used.includes(a.id));
  if (only) list = list.filter(a => only.includes(a.id));
  return list.filter(a => {
    if (a.id === 'lock') return lockTargets(state, ship).length > 0;
    if (a.id === 'roll') return rollPositions(state, ship).length > 0;
    return true;
  });
}

/** Ask the ship's owner to pick an action (or a free action when `free`). */
export function askAction(state, ship, { free = false, only = null, reason = '' } = {}) {
  const opts = availableActions(state, ship, { only });
  if (!opts.length) return;
  ask(state, {
    player: ship.owner, kind: 'action', ship: ship.id,
    text: free ? `${reason || 'Free action'} for ${shipName(ship)}?` : `Choose an action for ${shipName(ship)}.`,
    options: [...opts, { id: 'pass', label: free ? 'Skip' : 'Pass' }],
    onChoose: 'action', data: { ship: ship.id, free },
  });
}

export function performAction(state, ship, id) {
  ship.round.actionsUsed.push(id);
  switch (id) {
    case 'focus': ship.tokens.focus++; log(state, `${shipName(ship)} focuses.`); break;
    case 'evade': ship.tokens.evade++; log(state, `${shipName(ship)} prepares to evade.`); break;
    case 'deflector_drone': ship.round.agilityBonus += 1; log(state, `${shipName(ship)}'s drone boosts agility.`); break;
    case 'deadeye': ship.round.deadeye = true; log(state, `${shipName(ship)} lines up a Deadeye shot.`); break;
    case 'lock': {
      const opts = lockTargets(state, ship).map(o => ({ id: o.id, label: `${shipName(o)} (Range ${rangeBetween(ship, o).band})`, target: o.id }));
      ask(state, { player: ship.owner, kind: 'lockTarget', ship: ship.id, text: 'Lock onto which enemy?', options: opts, onChoose: 'lockTarget', data: { ship: ship.id } });
      break;
    }
    case 'roll': {
      const opts = rollPositions(state, ship).map(r => ({ id: r.id, label: `${r.side} · ${r.label}`, pose: r.pose }));
      ask(state, { player: ship.owner, kind: 'rollPosition', ship: ship.id, text: 'Barrel roll where?', options: opts, onChoose: 'rollPosition', data: { ship: ship.id } });
      break;
    }
    default:
      if (id.startsWith('repair:')) {
        const card = id.slice(7);
        const def = DAMAGE_CARDS[card];
        if (def.repairAlways) { flipFacedown(state, ship, card); break; }
        const f = rollFace(state, 'attack');
        emit(state, { type: 'roll', ship: ship.id, faces: [f] });
        const ok = f === 'hit' || (card === 'weapons_fault' && f === 'crit');
        log(state, `${shipName(ship)} attempts repairs: rolled ${f}.`);
        if (ok) flipFacedown(state, ship, card);
        break;
      }
      throw new RuleError(`unknown action ${id}`);
  }
}

export const steps = {
  actionStep(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed || ship.round.skipAction) return;
    askAction(state, ship);
  },
  freeAction(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    askAction(state, ship, { free: true, only: s.only, reason: s.reason });
  },
};

export const choices = {
  action(state, data, choice) {
    if (choice === 'pass') return;
    const ship = state.ships[data.ship];
    performAction(state, ship, choice);
  },
  lockTarget(state, data, choice) {
    const ship = state.ships[data.ship];
    ship.lockOn = choice;
    emit(state, { type: 'lock', ship: ship.id, target: choice });
    log(state, `${shipName(ship)} locks onto ${shipName(state.ships[choice])}.`);
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
  },
};

export { push };
