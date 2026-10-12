// Pilot abilities and upgrade effects, gathered in one place so new content
// only touches this file (+ data). Each hook is called by the rules modules:
//
//   attackDiceBonus(state, a)        combat.js  → extra attack dice
//   defenseDiceDelta(state, a)       combat.js  → +/- defense dice
//   attackModOptions(state, a)       combat.js  → ability options during "modify attack dice"
//   applyAttackMod(state, a, id)     combat.js
//   defenseModOptions(state, a)      combat.js
//   applyDefenseMod(state, a, id)    combat.js
//   afterManeuver(state, ship, color, { blocked })  activation.js → extra steps after moving
//
// `a` is the live attack context (state.attack): { attacker, defender, weapon, band, obstructed,
// attackDice, defenseDice, used: [] }. Use `a.used` to make an effect once-per-attack.
//
// To add a pilot: data/pilots.js entry with ability: 'my_id', then handle 'my_id' below.
import { changeFaces, count } from './dice.js';
import { hasAbility, activeUpgrades, inArc, chassis, hasUpgrade } from './queries.js';

export function attackDiceBonus(state, a) {
  const atk = state.ships[a.attacker], def = state.ships[a.defender];
  let n = 0;
  if (hasAbility(atk, 'brute') && a.band === 1) n += 1;
  if (hasAbility(atk, 'vex') && !inArc(def, atk)) n += 1;
  return n;
}

export function defenseDiceDelta(state, a) {
  const atk = state.ships[a.attacker];
  let n = 0;
  if (hasAbility(atk, 'ivo_strand')) n -= 1;  // "reduce agility by 1" (applied before range/obstacle bonuses)
  return n;
}

export function attackModOptions(state, a) {
  const atk = state.ships[a.attacker];
  const hasFocus = count(a.attackDice, 'focus') > 0;
  const opts = [];
  if (atk.round.deadeye && activeUpgrades(atk).includes('deadeye') && hasFocus && !a.used.includes('deadeye'))
    opts.push({ id: 'deadeye', label: 'Deadeye: 1 focus → crit, rest → hit' });
  if (a.weapon === 'seeker_torpedo' && hasFocus && !a.used.includes('torpedo'))
    opts.push({ id: 'torpedo', label: 'Torpedo: 1 focus → crit' });
  return opts;
}

export function applyAttackMod(state, a, id) {
  switch (id) {
    case 'deadeye': changeFaces(a.attackDice, 'focus', 'crit', 1); changeFaces(a.attackDice, 'focus', 'hit'); break;
    case 'torpedo': changeFaces(a.attackDice, 'focus', 'crit', 1); break;
    default: return false;
  }
  a.used.push(id);
  return true;
}

export function defenseModOptions(state, a) {
  const def = state.ships[a.defender];
  const opts = [];
  if (hasAbility(def, 'kestrel_vane') && count(a.defenseDice, 'focus') > 0 && !a.used.includes('kestrel'))
    opts.push({ id: 'kestrel', label: 'Kestrel Vane: 1 focus → evade' });
  return opts;
}

export function applyDefenseMod(state, a, id) {
  switch (id) {
    case 'kestrel': changeFaces(a.defenseDice, 'focus', 'evade', 1); break;
    default: return false;
  }
  a.used.push(id);
  return true;
}

/** Steps to run after a ship executes a maneuver (before its action). */
export function afterManeuver(state, ship, color, { blocked }) {
  const out = [];
  if (color === 'g' && hasUpgrade(ship, 'repair_drone') && ship.shields < chassis(ship).shields) out.push({ t: 'repairDrone', ship: ship.id });
  if (color === 'g' && hasAbility(ship, 'hollow') && !blocked) out.push({ t: 'freeAction', ship: ship.id, only: ['focus'], reason: 'Hollow: free focus' });
  return out;
}
