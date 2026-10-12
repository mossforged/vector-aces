// Suffering damage, Damage cards, destruction and victory.
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { UPGRADES } from '../data/upgrades.js';
import { shuffle } from './rng.js';
import { rollFace } from './dice.js';
import { log, emit } from './flow.js';
import { chassis, hullDamage, hasUpgrade, shipName, shipList, effectiveSkill } from './queries.js';

function drawCard(state) {
  if (!state.damageDeck.length) {
    if (!state.damageDiscard.length) return null;
    state.damageDeck = shuffle(state, state.damageDiscard);
    state.damageDiscard = [];
  }
  return state.damageDeck.pop();
}

/** Suffer `hits` normal then `crits` critical damage, one at a time (shields first). */
export function sufferDamage(state, ship, hits, crits = 0) {
  const seq = [...Array(hits).fill(false), ...Array(crits).fill(true)];
  for (const crit of seq) {
    if (ship.destroyed) return;
    if (ship.shields > 0) {
      ship.shields--;
      emit(state, { type: 'shield', ship: ship.id });
      log(state, `${shipName(ship)} loses a shield.`);
    } else {
      const deckEmpty = !state.damageDeck.length && !state.damageDiscard.length;
      const card = drawCard(state);
      if (!card) { // component limitation: track abstractly
        ship.damage.push({ card: 'direct_hit', faceup: false, round: state.round, proxy: true });
      } else {
        const faceup = crit && !deckEmpty;
        ship.damage.push({ card, faceup, round: state.round });
        emit(state, { type: 'damage', ship: ship.id, card, faceup });
        if (faceup) {
          log(state, `${shipName(ship)} suffers a critical hit: ${DAMAGE_CARDS[card].name}.`);
          resolveFaceup(state, ship, ship.damage.length - 1);
        } else log(state, `${shipName(ship)} takes 1 damage.`);
      }
    }
    checkDestroyed(state, ship);
  }
}

/** Immediate effects of a card dealt faceup. Ongoing effects are read by queries/hooks. */
function resolveFaceup(state, ship, idx) {
  const c = ship.damage[idx];
  const def = DAMAGE_CARDS[c.card];
  if (def.trait === 'pilot' && hasUpgrade(ship, 'iron_will')) {
    ship.damage.splice(idx, 1);
    state.damageDiscard.push(c.card);
    log(state, `${shipName(ship)}'s Iron Will shrugs off ${def.name}.`);
    return;
  }
  switch (c.card) {
    case 'thruster_fire':
      ship.stress++; c.faceup = false;
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
      log(state, `Minor explosion roll: ${f}.`);
      if (f === 'hit') sufferDamage(state, ship, 1, 0);
      break;
    }
    default: break;
  }
}

export function flipFacedown(state, ship, cardId) {
  const c = ship.damage.find(d => d.faceup && d.card === cardId);
  if (c) { c.faceup = false; log(state, `${shipName(ship)} repairs ${DAMAGE_CARDS[cardId].name}.`); }
}

export function checkDestroyed(state, ship) {
  if (ship.destroyed || ship.pendingDestroy) return;
  if (hullDamage(ship) < chassis(ship).hull) return;
  if (state.phase === 'combat' && state.combatSkill === effectiveSkill(state, ship) && !ship.round.attacked) {
    ship.pendingDestroy = true; // simultaneous attack rule
    log(state, `${shipName(ship)} is crippled but still gets to fire this round.`);
    return;
  }
  destroyShip(state, ship);
}

export function destroyShip(state, ship, reason = 'destroyed') {
  if (ship.destroyed) return;
  ship.destroyed = true; ship.pendingDestroy = false;
  if (reason === 'fled') ship.fled = true;
  for (const s of shipList(state)) if (s.lockOn === ship.id) s.lockOn = null;
  ship.lockOn = null;
  state.touches = state.touches.filter(([a, b]) => a !== ship.id && b !== ship.id);
  for (const c of ship.damage) if (!c.proxy) state.damageDiscard.push(c.card);
  ship.damage = [];
  emit(state, { type: 'destroyed', ship: ship.id, reason });
  log(state, `${shipName(ship)} ${reason === 'fled' ? 'flew off the battlefield and is lost' : 'is destroyed'}!`);
  checkVictory(state);
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
