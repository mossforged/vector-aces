// The engine's tiny "virtual machine".
//
// state.queue  : list of pending steps { t: 'stepName', ...data }
// state.prompt : a decision some player must make, or null
//
// advance() runs steps until a prompt appears (or the game ends).
// A prompt looks like:
//   { player, kind, text, options: [{ id, label, ...extra }], onChoose: 'choiceName', data }
// The UI renders options; the player answers with { type: 'CHOOSE', player, choice, payload }.
// CHOICES[onChoose](state, data, choice, payload) applies the answer.
//
// Feature modules export { steps, choices } and are registered in engine/index.js.

export const STEPS = {};
export const CHOICES = {};

export function register(mod) {
  Object.assign(STEPS, mod.steps || {});
  Object.assign(CHOICES, mod.choices || {});
}

/** Insert steps at the FRONT of the queue (run next, in the given order). */
export function push(state, ...steps) { state.queue.unshift(...steps); }

/** Append steps to the BACK of the queue. */
export function enqueue(state, ...steps) { state.queue.push(...steps); }

export function ask(state, prompt) { state.prompt = prompt; }

export function log(state, text) {
  state.log.push({ round: state.round, text });
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
}

/** Events are transient hints for the renderer (animations, dice popups). Cleared every action. */
export function emit(state, ev) { state.events.push(ev); }

export class RuleError extends Error {}

export function advance(state) {
  let guard = 0;
  while (!state.prompt && state.queue.length && !state.winner) {
    if (++guard > 10000) throw new Error('engine loop guard tripped');
    const step = state.queue.shift();
    const fn = STEPS[step.t];
    if (!fn) throw new Error(`unknown step ${step.t}`);
    fn(state, step);
  }
}

/**
 * Generic choice prompt with a continuation: when the player picks an option,
 * `then` is pushed as the next step with `choice` (the option id) added.
 * A "skip" option is added unless skip === false.
 */
export function pick(state, { player, ship = null, kind = 'pick', text, options, then, skip = 'Skip' }) {
  if (!options.length) return;
  ask(state, {
    player, ship, kind, text,
    options: skip ? [...options, { id: 'skip', label: skip }] : options,
    onChoose: 'pick', data: { then },
  });
}

CHOICES.pick = (state, data, choice) => {
  if (choice !== 'skip') push(state, { ...data.then, choice });
};

/** Step descriptor for a card-defined step (see engine/cards). */
export const cardStep = (card, name, data = {}) => ({ t: `card:${card}:${name}`, ...data });
