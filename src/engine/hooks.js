// Card hook registry. Every pilot ability and upgrade is a plain object in
// src/engine/cards/*.js, keyed by its id, with any of the hooks below.
// The rules modules call these hooks at fixed points; a card only implements
// the ones it needs. "owner" is always the ship that has the card.
//
// VALUE hooks (own ship only; fold a value through the ship's cards):
//   stat(state, ship, which, v)          which: 'attack' | 'agility' | 'skill' | 'maxShields'
//   maneuverColor(state, ship, m, color)
//   actionBar(state, ship, list)          list of action ids ('focus','lock','roll','evade','boost')
//   actionsPerTurn(state, ship, n)
//   focusGain(state, ship, n)            tokens gained by a focus action
//   weaponRange(state, ship, w, [min,max])
//   boostTemplates(state, ship, [[bearing,label],...])   lockTargets(state, ship, ships[])
// FLAG hooks (own ship; true if any card says so):
//   actWhileStressed, attackWhileTouching, alwaysHits, delayDestruction, keepFocus,
//   lockCostAsFocus, forbidAttackRerolls (as defender: also blocks focus), faceupDrawThree (as attacker),
//   discardOnlyOnHit, turretWeapon(upgradeId) (that secondary fires outside the arc), redWhileStressed,
//   attackOnObstacle
// WEAPON effects are NOT hooks on the owner: they live under `weapon: {...}` and combat looks them
//   up by the weapon being fired (see cards/weapons.js).
// ATTACK hooks (called for EVERY ship on the table; check roles via a.attacker / a.defender):
//   attackDice(state, owner, a, n) → n          defenseDice(state, owner, a, n) → n
//   options(state, owner, a, stage) → [{ id, label, apply(state, a) }]
//       stage: 'preRoll' | 'afterRoll' | 'defOnAttack' | 'attack' | 'defense' | 'onHit'
//       Only cards whose owner belongs to the deciding player are asked
//       (attacker's player for preRoll/afterRoll/attack, defender's for the rest).
//       Each option must mark itself used (a.used) so it cannot repeat forever.
//   afterRollForced(state, owner, a)            mandatory changes right after rolling
//   compare(state, owner, a, rules)             rules: { uncancelableHits, uncancelableCrits, critsFirst }
//   canTarget(state, owner, attacker, target, ok) → ok (return false to forbid this target)
//   afterAttack(state, owner, a) → steps[]
// EVENT hooks (own ship) returning steps[] to run next (may be empty):
//   beforeReveal, onReveal(m) (may edit ship.round.maneuver), afterManeuver(color, {blocked, bumped}),
//   afterAction(actionId),
//   onSpendFocus, onSpendLock(targetId), onStress
// onDealt(state, ship, cardId, faceup, cardDef) → 'discard' to throw the dealt Damage card away
// PHASE hooks (every ship) returning steps[]:  startActivation, startCombat, endPhase
// WATCH hooks (every ship; owner 2nd arg) returning steps[]:
//   anyManeuver(ship, color, {bumped, hitObstacle})  after any ship's maneuver
//   anyAction(ship, actionId)                         after any ship performs an action
// ORDNANCE (every ship): bombDetonates(tok, victims, ok) → ok (false = it stays on the table this round)
//   onDetonate(tok, victims)  side effects only, right before a bomb/mine resolves
// WEAPON extras (cards/weapons.js): replaceDamage(state, a) — on a hit, run this instead of normal damage;
//   onlyFocusMods: attacker may only spend focus normally to modify dice
// CARD ACTIONS: actions: { [actionId]: { label, can(state, ship), perform(state, ship) } }
// CARD STEPS:   steps: { name(state, step) }  — run them with cardStep(cardId, name, data)
import { CARDS } from './cards/index.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';

/** Card defs active on a ship: its pilot ability (unless switched off) and active upgrades. */
export function cardsOf(ship) {
  const out = [];
  const pilotOn = !ship.damage.some(c => c.faceup && c.card === 'head_wound');
  const ab = PILOTS[ship.pilot].ability;
  if (ab && pilotOn && CARDS[ab]) out.push(CARDS[ab]);
  for (const u of ship.upgrades) {
    if (u.discarded || !CARDS[u.id]) continue;
    if (UPGRADES[u.id].slot === 'elite' && !pilotOn) continue;
    out.push(CARDS[u.id]);
  }
  // Condition cards assigned to this ship (ship.conditions = [{ id, from }]) behave like its own cards.
  for (const c of ship.conditions || []) if (CARDS[c.id]) out.push(CARDS[c.id]);
  return out;
}

export function fold(state, ship, hook, value, ...args) {
  for (const c of cardsOf(ship)) if (c[hook]) value = c[hook](state, ship, ...args, value);
  return value;
}

export function flag(state, ship, hook, ...args) {
  return cardsOf(ship).some(c => (typeof c[hook] === 'function' ? c[hook](state, ship, ...args) : c[hook] === true));
}

/** Collect step lists from one ship's cards. */
export function ownSteps(state, ship, hook, ...args) {
  const out = [];
  for (const c of cardsOf(ship)) if (c[hook]) out.push(...(c[hook](state, ship, ...args) || []));
  return out;
}

/** Collect from every live ship's cards (owner passed as 2nd arg). */
export function everyone(state, hook, ...args) {
  const out = [];
  for (const id of state.shipOrder) {
    const s = state.ships[id];
    if (s.destroyed || !s.deployed) continue;
    for (const c of cardsOf(s)) if (c[hook]) { const r = c[hook](state, s, ...args); if (Array.isArray(r)) out.push(...r); }
  }
  return out;
}

/** Fold a value through every live ship's cards (owner passed as 2nd arg). */
export function foldAll(state, hook, value, ...args) {
  for (const id of state.shipOrder) {
    const s = state.ships[id];
    if (s.destroyed || !s.deployed) continue;
    for (const c of cardsOf(s)) if (c[hook]) value = c[hook](state, s, ...args, value);
  }
  return value;
}

/** Card-provided actions available to a ship (id → def). */
export function cardActions(ship) {
  const out = {};
  for (const c of cardsOf(ship)) Object.assign(out, c.actions || {});
  return out;
}
