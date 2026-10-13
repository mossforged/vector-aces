// Suffering damage, Damage cards, destruction and victory.
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { UPGRADES } from '../data/upgrades.js';
import { shuffle } from './rng.js';
import { rollFace } from './dice.js';
import { log, emit, push } from './flow.js';
import { cardsOf, flag, fold, everyone } from './hooks.js';
import { addStress } from './effects.js';
import { chassis, hullDamage, shipName, shipList, effectiveSkill } from './queries.js';

// Worst-first ranking used when an ability lets the attacker choose which card to deal.
const SEVERITY = ['direct_hit', 'console_blaze', 'smoke_cockpit', 'blinded', 'weapons_fault', 'sensor_burnout', 'head_wound',
  'engine_fault', 'ruptured_plating', 'hull_breach', 'dazed', 'munitions_jam', 'minor_explosion', 'thruster_fire'];

function drawCard(state) {
  if (!state.damageDeck.length) {
    if (!state.damageDiscard.length) return null;
    state.damageDeck = shuffle(state, state.damageDiscard);
    state.damageDiscard = [];
  }
  return state.damageDeck.pop();
}

/**
 * Suffer `hits` normal then `crits` critical damage, one at a time (shields first).
 * opts.attacker: the attacking ship (for "choose the faceup card" effects)
 * opts.track:    array that receives the uid of every Damage card dealt
 */
export function sufferDamage(state, ship, hits, crits = 0, opts = {}) {
  const seq = [...Array(hits).fill(false), ...Array(crits).fill(true)];
  if (seq.length && !ship.destroyed && !(state.attack && state.attack.defender === ship.id)) push(state, ...everyone(state, 'anyDamaged', ship));
  for (const crit of seq) {
    if (ship.destroyed) return;
    if (ship.shields > 0) {
      ship.shields--;
      emit(state, { type: 'shield', ship: ship.id });
      log(state, `${shipName(ship)} loses a shield.`);
    } else dealCard(state, ship, crit, opts);
    checkDestroyed(state, ship);
  }
}

/** Deal a Damage card straight to the hull (ignores shields), e.g. proton bombs. */
export function dealDamageCard(state, ship, faceup = true) {
  if (ship.destroyed) return;
  dealCard(state, ship, faceup, {});
  checkDestroyed(state, ship);
}

function dealCard(state, ship, crit, opts) {
  const deckEmpty = !state.damageDeck.length && !state.damageDiscard.length;
  let card = drawCard(state);
  if (!card) { // component limitation: track abstractly
    ship.damage.push({ card: 'direct_hit', faceup: false, round: state.round, proxy: true, uid: state.uid++ });
    return;
  }
  // takeFaceup (receiving ship) / dealFaceup (attacker): this card is dealt faceup even if it isn't a critical.
  const faceup = !deckEmpty && (crit || flag(state, ship, 'takeFaceup', opts) || (!!opts.attacker && flag(state, opts.attacker, 'dealFaceup', ship)));
  if (faceup && opts.attacker && flag(state, opts.attacker, 'faceupDrawThree')) {
    const drawn = [card, drawCard(state), drawCard(state)].filter(Boolean);
    drawn.sort((x, y) => SEVERITY.indexOf(x) - SEVERITY.indexOf(y));
    card = drawn.shift();
    state.damageDiscard.push(...drawn);
    log(state, `${shipName(opts.attacker)} picks the nastiest of ${drawn.length + 1} damage cards.`);
  }
  for (const c of cardsOf(ship)) {
    if (c.onDealt?.(state, ship, card, faceup, DAMAGE_CARDS[card]) === 'discard') {
      state.damageDiscard.push(card);
      if (faceup) log(state, `${shipName(ship)} shrugs off ${DAMAGE_CARDS[card].name}.`);
      return;
    }
  }
  const entry = { card, faceup, round: state.round, uid: state.uid++ };
  ship.damage.push(entry);
  opts.track?.push(entry.uid);
  emit(state, { type: 'damage', ship: ship.id, card, faceup });
  if (faceup) {
    log(state, `${shipName(ship)} suffers a critical hit: ${DAMAGE_CARDS[card].name}.`);
    resolveFaceup(state, ship, entry);
  } else log(state, `${shipName(ship)} takes 1 damage.`);
}

/** Immediate effects of a card that becomes faceup. Ongoing effects are read by queries. */
export function resolveFaceup(state, ship, c) {
  switch (c.card) {
    case 'thruster_fire':
      addStress(state, ship); c.faceup = false;
      break;
    case 'munitions_jam': {
      const w = ship.upgrades.find(u => !u.discarded && UPGRADES[u.id].weapon);
      if (w) { w.discarded = true; log(state, `${UPGRADES[w.id].name} is lost.`); }
      c.faceup = false;
      break;
    }
    case 'minor_explosion': {
      c.faceup = false;
      const f = rollFace(state, 'attack');
      emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Minor Explosion' });
      log(state, `Minor explosion roll: ${f}.`);
      if (f === 'hit') sufferDamage(state, ship, 1, 0);
      break;
    }
    default: break;
  }
}

/** Flip specific facedown cards (by uid) faceup and resolve them. */
export function flipFaceup(state, ship, uids) {
  for (const c of ship.damage) {
    if (!uids.includes(c.uid) || c.faceup || c.proxy || ship.destroyed) continue;
    c.faceup = true;
    log(state, `${shipName(ship)}: ${DAMAGE_CARDS[c.card].name} flips faceup!`);
    emit(state, { type: 'damage', ship: ship.id, card: c.card, faceup: true });
    resolveFaceup(state, ship, c);
  }
  checkDestroyed(state, ship);
}

export function flipFacedown(state, ship, cardId) {
  const c = ship.damage.find(d => d.faceup && d.card === cardId);
  if (c) { c.faceup = false; log(state, `${shipName(ship)} repairs ${DAMAGE_CARDS[cardId].name}.`); }
}

export function checkDestroyed(state, ship) {
  if (ship.destroyed || ship.pendingDestroy || ship.delayedDestroy) return;
  if (hullDamage(ship) < fold(state, ship, 'stat', chassis(ship).hull, 'hull')) return;
  if (flag(state, ship, 'delayDestruction')) {
    ship.delayedDestroy = true;
    log(state, `${shipName(ship)} is wrecked but fights on until the end of combat!`);
    return;
  }
  if (state.phase === 'combat' && state.combatSkill === effectiveSkill(state, ship) && !ship.round.attacked) {
    ship.pendingDestroy = true; // simultaneous attack rule
    log(state, `${shipName(ship)} is crippled but still gets to fire this round.`);
    return;
  }
  destroyShip(state, ship);
}

export function destroyShip(state, ship, reason = 'destroyed') {
  if (ship.destroyed) return;
  const own = []; for (const c of cardsOf(ship)) if (c.onDestroyed) own.push(...(c.onDestroyed(state, ship) || []));
  ship.destroyed = true; ship.pendingDestroy = false; ship.delayedDestroy = false;
  if (reason === 'fled') ship.fled = true;
  for (const s of shipList(state)) if (s.lockOn === ship.id) s.lockOn = null;
  ship.lockOn = null;
  state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
  for (const c of ship.damage) if (!c.proxy) state.damageDiscard.push(c.card);
  ship.damage = [];
  emit(state, { type: 'destroyed', ship: ship.id, reason });
  log(state, `${shipName(ship)} ${reason === 'fled' ? 'flew off the battlefield and is lost' : 'is destroyed'}!`);
  checkVictory(state);
  if (!state.winner) push(state, ...own, ...everyone(state, 'anyDestroyed', ship));
}

export function resolvePendingDestroys(state) {
  for (const s of shipList(state)) if (s.pendingDestroy) destroyShip(state, s);
}

export function checkVictory(state) {
  if (state.winner || state.phase === 'setup' || state.phase === 'deploy' || state.phase === 'obstacles') return;
  const alive = p => shipList(state).some(s => s.owner === p && !s.destroyed);
  const [a, b] = state.playerOrder;
  const la = alive(a), lb = alive(b);
  if (la && lb) return;
  state.winner = !la && !lb ? state.initiative : (la ? a : b);
  state.phase = 'over';
  state.prompt = null;
  log(state, `${state.players[state.winner].name} wins!`);
}

export const steps = {
  flipFaceup(state, s) {
    const ship = state.ships[s.ship];
    if (s.payer) { const p = state.ships[s.payer]; if (p.tokens.focus < 1) return; p.tokens.focus--; }
    if (!ship.destroyed) flipFaceup(state, ship, s.uids);
  },
};
