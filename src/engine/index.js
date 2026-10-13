// Public engine API. Everything outside src/engine should only import from here.
//
//   const state = newGame(opts)                 // deterministic from opts.seed
//   const { state: next, error } = applyAction(state, action)
//
// Actions (all plain JSON, safe to send over the network):
//   { type: 'SUBMIT_DIALS', player, dials: { shipId: '2BL', ... } }
//   { type: 'CHOOSE', player, choice: optionId | 'place', payload? }
//   { type: 'CONCEDE', player }
//
// The state is never mutated in place; applyAction returns a fresh object.
import { register, advance, CHOICES, RuleError } from './flow.js';
import * as setup from './setup.js';
import * as activation from './activation.js';
import * as actions from './actions.js';
import * as combat from './combat.js';
import * as damage from './damage.js';
import * as ordnance from './ordnance.js';
import { log } from './flow.js';

for (const mod of [setup, activation, actions, combat, damage, ordnance]) register(mod);

export function newGame(opts) {
  const state = setup.createGame(opts);
  advance(state);
  return state;
}

export function applyAction(state, action) {
  const next = structuredClone(state);
  next.events = [];
  try {
    if (next.winner) throw new RuleError('The game is over.');
    switch (action.type) {
      case 'SUBMIT_DIALS':
        activation.submitDials(next, action.player, action.dials);
        break;
      case 'CHOOSE': {
        const p = next.prompt;
        if (!p || p.kind === 'planning') throw new RuleError('Nothing to choose right now.');
        if (p.player !== action.player) throw new RuleError('Not your decision.');
        const placing = action.choice === 'place' && (p.kind === 'deploy' || p.kind === 'placeObstacle');
        if (!placing && !p.options.some(o => o.id === action.choice)) throw new RuleError('Not a valid option.');
        next.prompt = null;
        CHOICES[p.onChoose](next, p.data, action.choice, action.payload || {});
        break;
      }
      case 'CONCEDE': {
        next.winner = next.playerOrder.find(x => x !== action.player);
        next.phase = 'over'; next.prompt = null;
        log(next, `${next.players[action.player].name} concedes.`);
        break;
      }
      default: throw new RuleError(`Unknown action ${action.type}`);
    }
    advance(next);
    return { state: next, error: null };
  } catch (e) {
    if (e instanceof RuleError) return { state, error: e.message };
    throw e;
  }
}

/** Which players are being waited on (for "waiting for opponent…" UI). */
export function waitingOn(state) {
  if (state.winner || !state.prompt) return [];
  if (state.prompt.kind === 'planning') return state.prompt.players.filter(p => !state.planning.submitted[p]);
  return [state.prompt.player];
}

export { squadPoints, validateSquad, upgradeAllowed, slotsFor, deployZone, ENGINE_VERSION } from './setup.js';
export { needsDial } from './activation.js';
export { availableActions } from './actions.js';
export { attackOptions } from './combat.js';
export * as Q from './queries.js';
export { buildPath, barrelRollPoses } from './maneuvers.js';
export * as G from './geometry.js';
