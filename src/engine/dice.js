// Eight-sided custom dice.
import { randInt } from './rng.js';

export const ATTACK_FACES = ['hit', 'hit', 'hit', 'crit', 'focus', 'focus', 'blank', 'blank'];
export const DEFENSE_FACES = ['evade', 'evade', 'evade', 'focus', 'focus', 'blank', 'blank', 'blank'];

export const rollFace = (state, kind) => (kind === 'attack' ? ATTACK_FACES : DEFENSE_FACES)[randInt(state, 8)];

export function rollDice(state, kind, n) {
  const dice = [];
  for (let i = 0; i < n; i++) dice.push({ face: rollFace(state, kind), rerolled: false });
  return dice;
}

/** Reroll dice matching `pred` that haven't been rerolled this attack. Returns count rerolled. */
export function rerollWhere(state, dice, kind, pred) {
  let n = 0;
  for (const d of dice) if (!d.rerolled && pred(d)) { d.face = rollFace(state, kind); d.rerolled = true; n++; }
  return n;
}

export function changeFaces(dice, from, to, max = Infinity) {
  let n = 0;
  for (const d of dice) if (n < max && d.face === from) { d.face = to; n++; }
  return n;
}

export const count = (dice, face) => dice.filter(d => d.face === face).length;
