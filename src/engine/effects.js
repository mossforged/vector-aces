// Shared building blocks for rules modules and cards: token changes that trigger
// card events, and ready-made dice-option builders.
import { push, log, emit } from './flow.js';
import { ownSteps, flag } from './hooks.js';
import { shipName } from './queries.js';
import { rollFace } from './dice.js';

// ---------------- tokens ----------------

export function addStress(state, ship, n = 1) {
  for (let i = 0; i < n; i++) {
    ship.stress++;
    push(state, ...ownSteps(state, ship, 'onStress'));
  }
}

export function spendFocus(state, ship) {
  ship.tokens.focus--;
  push(state, ...ownSteps(state, ship, 'onSpendFocus'));
}

export function spendLock(state, ship) {
  const target = ship.lockOn;
  ship.lockOn = null;
  push(state, ...ownSteps(state, ship, 'onSpendLock', target));
}

export function acquireLock(state, ship, target) {
  ship.lockOn = target.id;
  emit(state, { type: 'lock', ship: ship.id, target: target.id });
  log(state, `${shipName(ship)} locks onto ${shipName(target)}.`);
}

/** Step that offers a ship a free action (optionally restricted to `only`). */
export const freeAction = (ship, reason, extra = {}) => ({ t: 'freeAction', ship: ship.id, reason, ...extra });

// ---------------- attack context helpers ----------------

export const attacker = (state, a) => state.ships[a.attacker];
export const defender = (state, a) => state.ships[a.defender];
export const once = (a, key) => !a.used.includes(key);
export const mark = (a, key) => a.used.push(key);

/** True if the attacker is still allowed to reroll attack dice (some defenders forbid it). */
export const attackRerollAllowed = (state, a) => !flag(state, defender(state, a), 'forbidAttackRerolls', a);
export const attackFocusAllowed = (state, a) => !flag(state, defender(state, a), 'forbidAttackRerolls', a);

/** Reroll up to n dice whose faces are in `faces` (skipping dice already rerolled or locked). */
export function rerollFaces(state, dice, kind, faces, n = Infinity) {
  let k = 0;
  for (const f of faces) {
    for (const d of dice) {
      if (k >= n) return k;
      if (d.face === f && !d.rerolled && !d.noReroll) { d.face = rollFace(state, kind); d.rerolled = true; k++; }
    }
  }
  return k;
}

/** How many dice could be rerolled for these faces. */
export const rerollable = (dice, faces) => dice.filter(d => faces.includes(d.face) && !d.rerolled && !d.noReroll).length;

/**
 * Options for "reroll up to n dice". Offers one option per face that is present and,
 * when n > 1, a combined option (faces in priority order).
 *   key: unique key for a.used   label: card name   which: 'attack' | 'defense' (which dice)
 */
export function rerollOptions(a, key, label, which, faces, n) {
  if (!once(a, key)) return [];
  const dice = which === 'attack' ? a.attackDice : a.defenseDice;
  const opts = [];
  for (const f of faces) {
    const c = Math.min(n, rerollable(dice, [f]));
    if (c > 0) opts.push({
      id: `${key}:${f}`, label: `${label}: reroll ${c === 1 ? 'a' : c} ${f}${c > 1 ? 's' : ''}`,
      apply(state, a2) { rerollFaces(state, which === 'attack' ? a2.attackDice : a2.defenseDice, which, [f], n); mark(a2, key); },
    });
  }
  const total = Math.min(n, rerollable(dice, faces));
  if (n > 1 && opts.length > 1 && total > 1) opts.push({
    id: `${key}:mix`, label: `${label}: reroll ${total} (${faces.join(' then ')})`,
    apply(state, a2) { rerollFaces(state, which === 'attack' ? a2.attackDice : a2.defenseDice, which, faces, n); mark(a2, key); },
  });
  return opts;
}

/** Option to change up to n dice from one face to another. */
export function changeOption(a, key, label, which, from, to, n = 1) {
  const dice = which === 'attack' ? a.attackDice : a.defenseDice;
  if (!once(a, key) || !dice.some(d => d.face === from)) return [];
  return [{
    id: key, label: `${label}: ${n === Infinity ? 'all' : n} ${from} → ${to}`,
    apply(state, a2) {
      let k = 0;
      for (const d of which === 'attack' ? a2.attackDice : a2.defenseDice) if (k < n && d.face === from) { d.face = to; k++; }
      mark(a2, key);
    },
  }];
}
