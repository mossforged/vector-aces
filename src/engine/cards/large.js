// Card behaviour for the "large" batch: large-ship pilots, large-only upgrades and titles, docking
// (Mothership + Lifeboat), the Hound's Lair reserve fighter and ability-sharing cards.
// One entry per card id; hook reference: src/engine/hooks.js.
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollFace, count } from '../dice.js';
import { sufferDamage, dealDamageCard, resolveFaceup } from '../damage.js';
import { DAMAGE_CARDS } from '../../data/damageDeck.js';
import { dialFor, SHIPS } from '../../data/ships.js';
import { PILOTS } from '../../data/pilots.js';
import { UPGRADES } from '../../data/upgrades.js';
import { ORDNANCE } from '../../data/ordnance.js';
import { CONFIG } from '../../data/config.js';
import { buildPath } from '../maneuvers.js';
import { checkMines, dropOrdnance, ordnancePolys } from '../ordnance.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect, closestPoints, bandFor, clipPolygon, arcPolygon, add, mul, fwd, right } from '../geometry.js';
import {
  shipName, inArc, inFrontArc, rangeBetween, friendsInRange, enemiesInRange, liveShips, shipList, stat, maneuverColor,
  obstaclePolys, shipPoly, actionBar, activeUpgrades, chassis, areTouching, naturalSkill, MOBILE_OFFSET,
} from '../queries.js';
import {
  attacker, defender, once, mark, rerollOptions, rerollFaces, changeOption, freeAction, acquireLock, attackRerollAllowed,
  addStress, spendFocus, spendLock, applyTractor,
} from '../effects.js';
import { CARDS } from './index.js';
import league from './league.js';
import dominion from './dominion.js';

const isAttacker = (owner, a) => a.attacker === owner.id;
const isDefender = (owner, a) => a.defender === owner.id;
const friendlyAttacker = (state, owner, a) => !isAttacker(owner, a) && attacker(state, a).owner === owner.owner;
const band = (x, y) => rangeBetween(x, y).band;
const inBand = (x, y, lo, hi) => { const b = band(x, y); return !!b && b >= lo && b <= hi; };
const shipOpts = ships => ships.map(s => ({ id: s.id, label: shipName(s), target: s.id }));
const yesNo = label => [{ id: 'yes', label }];
const discardUpgrade = (ship, id) => { const u = ship.upgrades.find(x => x.id === id && !x.discarded); if (u) u.discarded = true; };
const addDie = (dice, face) => dice.push({ face, rerolled: false, added: true });
const maxShields = (state, s) => stat(state, s, 'maxShields');
const speedOf = ship => (ship.round.revealed ? parseInt(ship.round.revealed, 10) || 0 : 0);
const enemy = (owner, s) => s.owner !== owner.owner;
const touchingFoes = (state, ship) => liveShips(state).filter(e => enemy(ship, e) && areTouching(state, ship.id, e.id));
const condition = (ship, id) => (ship.conditions || []).find(c => c.id === id);
const dropCondition = (ship, id) => { ship.conditions = (ship.conditions || []).filter(c => c.id !== id); };
const half = s => CONFIG.baseSize[chassis(s).size] / 2;
const roll1 = (state, ship, reason) => { const f = rollFace(state, 'attack'); emit(state, { type: 'roll', ship: ship.id, faces: [f], reason }); return f; };
const inMobileArc = (s, x) => clipPolygon(shipPoly(x), arcPolygon({ ...s.pose, h: s.pose.h + MOBILE_OFFSET[s.mobileArc || 'front'] })).length >= 3;

const offer = (card, text, label) => (state, s) => {
  const ship = state.ships[s.ship]; if (!ship || ship.destroyed) return;
  const { t, ...data } = s;
  pick(state, { player: ship.owner, ship: ship.id, text: text(state, ship, s), options: yesNo(label), then: cardStep(card, 'go', data) });
};
/** Run `step` after the attack in progress finishes (bonus attacks must not start mid-attack). */
function afterCurrentAttack(state, step) {
  const i = state.queue.findIndex(q => q.t === 'afterAttack');
  if (state.attack && i >= 0) state.queue.splice(i + 1, 0, step); else push(state, step);
}
/** A bonus attack that doesn't use up the ship's normal attack, optionally limited to one target. */
function extraAttack(state, ship, card, reason, target = null, only = null) {
  const done = cardStep(card, 'done', { ship: ship.id, prev: !!ship.round.noMoreAttacks });
  ship.round.extraTarget = target;
  push(state, { t: 'bonusAttack', ship: ship.id, reason, only, after: done }, done);
}
const extraDone = (state, s) => { const r = state.ships[s.ship].round; r.noMoreAttacks = s.prev; r.extraTarget = null; };
const extraTargetOnly = (state, owner, atk, target, ok) => (ok && atk.id === owner.id && owner.round.extraTarget && target.id !== owner.round.extraTarget ? false : ok);

/** Switch this round's revealed maneuver (alts may be off the dial). */
function switchManeuver(state, ship, card, alts, text) {
  pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text,
    options: alts.map(m => ({ id: m.key, label: `${m.key}${m.color === 'r' ? ' (red)' : ''}`, maneuver: m })), then: cardStep(card, 'switch', { ship: ship.id, colors: Object.fromEntries(alts.map(m => [m.key, m.color])) }), skip: `Keep ${ship.round.maneuver.key}` });
}
function applySwitch(state, s) {
  const ship = state.ships[s.ship];
  ship.round.maneuver = { key: s.choice, color: s.colors[s.choice] };
  ship.round.revealed = s.choice;
  log(state, `${shipName(ship)} switches to ${s.choice}.`);
}
const onDial = (state, ship, key) => { const m = dialFor(ship.chassis).find(x => x.key === key); return m ? { ...m, color: maneuverColor(state, ship, m) } : null; };

/** Turn a dealt card facedown: call from onDealt and return its result. */
function keepFacedown(state, ship, card, owner) {
  ship.damage.push({ card, faceup: false, round: state.round, uid: state.uid++ });
  emit(state, { type: 'damage', ship: ship.id, card, faceup: false });
  push(state, cardStep(owner, 'unDiscard', { card }));
  return 'discard';
}
const unDiscard = (state, s) => { const i = state.damageDiscard.lastIndexOf(s.card); if (i >= 0) state.damageDiscard.splice(i, 1); };
const SEVERITY = ['direct_hit', 'console_blaze', 'smoke_cockpit', 'blinded', 'weapons_fault', 'sensor_burnout', 'head_wound',
  'engine_fault', 'ruptured_plating', 'hull_breach', 'dazed', 'munitions_jam', 'minor_explosion', 'thruster_fire'];

// ---------------- placing a ship that isn't on the table yet (docked / reserve) ----------------
function placeClear(state, ship, pose, ignore = []) {
  const poly = basePolygon(pose, chassis(ship).size);
  return polygonInsideBoard(poly) && !liveShips(state).some(o => o.id !== ship.id && !ignore.includes(o.id) && polygonsIntersect(poly, shipPoly(o)));
}
/** Where a docked ship would end up launching from the carrier's rear with maneuver m. */
function launchPose(carrier, ship, m) {
  const start = { ...add(carrier.pose, mul(fwd(carrier.pose.h), -(half(carrier) + half(ship)))), h: carrier.pose.h + Math.PI };
  return buildPath(start, m, chassis(ship).size);
}
function putOnTable(state, ship, pose, from = null) {
  ship.pose = pose; ship.deployed = true;
  const carrier = state.ships[ship.dockedOn];
  if (carrier?.docked) carrier.docked = carrier.docked.filter(id => id !== ship.id);
  ship.dockedOn = null;
  emit(state, { type: 'move', ship: ship.id, path: from ? [from, pose] : [pose, pose] });
  checkMines(state, ship);
}
const dockedShips = (state, carrier) => (carrier.docked || []).map(id => state.ships[id]).filter(s => s && !s.destroyed && !s.deployed);
const launchOptions = (state, carrier, ship) => dialFor(ship.chassis)
  .filter(m => m.color !== 'r' && !['K', 'SL', 'SR', 'TRL', 'TRR', 'RS', 'RBL', 'RBR', 'ST'].includes(m.bearing))
  .map(m => ({ m, path: launchPose(carrier, ship, m) }))
  .filter(o => placeClear(state, ship, o.path.final, [carrier.id]) && !obstaclePolys(state).some(p => polygonsIntersect(basePolygon(o.path.final, 'small'), p)));
function mothership(kind) {
  const card = kind === 'ii' ? 'mothership_ii' : 'mothership';
  return {
    arcs: (state, ship, list) => ((ship.docked || []).length && !list.includes('rear') ? [...list, 'rear'] : list),
    afterManeuver: (state, ship) => (dockedShips(state, ship).length ? [cardStep(card, 'offer', { ship: ship.id })] : []),
    onDestroyed(state, ship) { // docked ships scramble out as the carrier goes down
      for (const d of dockedShips(state, ship)) {
        const o = launchOptions(state, ship, d)[0];
        if (!o) { d.destroyed = true; log(state, `${shipName(d)} is lost with its carrier.`); continue; }
        putOnTable(state, d, o.path.final, ship.pose);
        log(state, `${shipName(d)} launches in an emergency!`);
        dealDamageCard(state, d, false);
      }
      return [];
    },
    ...(kind === 'ii'
      ? { startCombat: (state, owner) => (dockedShips(state, owner).length && friendsInRange(state, owner, 1, 2).length ? [freeAction(owner, 'Mothership II: free coordinate', { only: ['coordinate'], grant: ['coordinate'] })] : []) }
      : { endPhase(state, owner) {
          if (!dockedShips(state, owner).length) return [];
          const turrets = owner.upgrades.filter(u => !u.discarded && UPGRADES[u.id].weapon?.turret).map(u => u.id);
          return turrets.length ? [{ t: 'bonusAttack', ship: owner.id, only: turrets, reason: 'Mothership: extra turret attack' }] : [];
        } }),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; const d = dockedShips(state, ship)[0]; if (!d) return;
        const opts = launchOptions(state, ship, d).map(o => ({ id: o.m.key, label: `Launch with ${o.m.key}`, pose: o.path.final }));
        pick(state, { player: ship.owner, ship: ship.id, kind: 'rollPosition', text: `${shipName(ship)}: launch ${shipName(d)} from your rear?`, options: opts, then: cardStep(card, 'launch', { ship: ship.id, docked: d.id }), skip: 'Keep it docked' });
      },
      launch(state, s) {
        const ship = state.ships[s.ship], d = state.ships[s.docked];
        const o = launchOptions(state, ship, d).find(x => x.m.key === s.choice); if (!o) return;
        const samples = []; for (let i = 0; i <= 16; i++) samples.push(o.path.poseAt(-o.path.base + ((o.path.length + o.path.base) * i) / 16));
        putOnTable(state, d, o.path.final);
        emit(state, { type: 'move', ship: d.id, path: samples });
        log(state, `${shipName(d)} launches from ${shipName(ship)}.`);
      },
    },
  };
}

// ---------------- borrowed pilot abilities (reserve fighter, Hunter Network) ----------------
const VALUE_HOOKS = ['stat', 'maneuverColor', 'actionBar', 'actionsPerTurn', 'focusGain', 'weaponRange', 'boostTemplates', 'lockTargets', 'decloakPositions', 'deploySkill',
  'attackDice', 'defenseDice', 'canTarget', 'denyTokens', 'blockMods', 'lockCostWaived', 'bombDetonates', 'bombRoll', 'anyLockTargets', 'rerollCap'];
const STEP_HOOKS = ['beforeReveal', 'onReveal', 'afterManeuver', 'afterAction', 'onSpendFocus', 'onSpendLock', 'onStress', 'startCombat', 'endPhase', 'startActivation',
  'afterAttack', 'anyManeuver', 'anyAction', 'anySpendFocus', 'combatActive', 'anyActivate', 'anyDamaged', 'anyDestroyed', 'afterDrop', 'afterDecloak', 'onLocked', 'onDestroyed', 'onDetonate', 'anyStress'];
const FLAG_HOOKS = ['actWhileStressed', 'attackWhileTouching', 'alwaysHits', 'delayDestruction', 'keepFocus', 'lockCostAsFocus', 'forbidAttackRerolls', 'faceupDrawThree',
  'discardOnlyOnHit', 'turretWeapon', 'redWhileStressed', 'attackOnObstacle', 'stressedAction', 'delayStress', 'phaseRocks', 'launchBombs', 'takeFaceup', 'dealFaceup', 'longDrop',
  'ignoreBomb', 'noPrimary', 'obstructs', 'friendReach', 'preventDestroy'];
/** Card that behaves like every card returned by `borrowed(state, ship)` (plus `own`). */
function borrower(borrowed, own = {}) {
  const card = { ...own };
  const list = (state, ship) => borrowed(state, ship).filter(Boolean);
  for (const h of VALUE_HOOKS) {
    const mine = own[h];
    card[h] = (state, ship, ...args) => {
      let v = mine ? mine(state, ship, ...args) : args[args.length - 1];
      for (const c of list(state, ship)) if (c[h]) v = c[h](state, ship, ...args.slice(0, -1), v);
      return v;
    };
  }
  for (const h of STEP_HOOKS) {
    const mine = own[h];
    card[h] = (state, ship, ...args) => [...(mine ? mine(state, ship, ...args) || [] : []), ...list(state, ship).flatMap(c => (c[h] && c[h](state, ship, ...args)) || [])];
  }
  for (const h of FLAG_HOOKS) card[h] = (state, ship, ...args) => list(state, ship).some(c => (typeof c[h] === 'function' ? !!c[h](state, ship, ...args) : c[h] === true));
  card.options = (state, owner, a, stage) => list(state, owner).flatMap(c => (c.options ? c.options(state, owner, a, stage) : []));
  card.compare = (state, owner, a, rules) => { for (const c of list(state, owner)) c.compare?.(state, owner, a, rules); };
  card.afterRollForced = (state, owner, a, kind) => { for (const c of list(state, owner)) c.afterRollForced?.(state, owner, a, kind); };
  card.onDealt = (state, ship, ...args) => { for (const c of list(state, ship)) { const r = c.onDealt?.(state, ship, ...args); if (r) return r; } return undefined; };
  return card;
}
const networkAbilities = (state, ship) => shipList(state)
  .filter(s => s.owner === ship.owner && s.id !== ship.id && s.upgrades.some(u => u.id === 'hunter_network'))
  .map(s => PILOTS[s.pilot].ability).filter(id => id && id !== PILOTS[ship.pilot].ability && CARDS[id]).map(id => CARDS[id]);

// ---------------- Bomb Silos (3 spare rounds per bomb card) ----------------
function silosRestore(state, ship) {
  if (!ship.silos) ship.silos = Object.fromEntries(ship.upgrades.filter(u => u.id !== 'bomb_silos' && UPGRADES[u.id].slot === 'bomb').map(u => [u.id, 3]));
  for (const [id, n] of Object.entries(ship.silos)) {
    const u = ship.upgrades.find(x => x.id === id);
    if (u && u.discarded && n > 0) { u.discarded = false; ship.silos[id] = n - 1; log(state, `${shipName(ship)} loads another ${UPGRADES[id].name} (${n - 1} left in the silo).`); }
  }
  return [];
}
/** Move the token(s) just dropped by `ship` by vector d (and optionally turn them). */
function shiftDropped(state, ship, n, d) {
  for (const tok of state.ordnance.filter(t => t.by === ship.id).slice(-n)) { tok.x += d.x; tok.y += d.y; }
}

export default {
  // ================================================================ Hauler
  chorrbak: { onDealt: (state, ship, card, faceup) => (faceup ? (log(state, `${shipName(ship)} shrugs off the critical (facedown).`), keepFacedown(state, ship, card, 'chorrbak')) : undefined), steps: { unDiscard } },
  landry_calver: {
    afterManeuver: (state, ship, color) => (color === 'g' && friendsInRange(state, ship, 1, 1).length ? [cardStep('landry_calver', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Landry Calver: which wingmate gets a free action?', options: shipOpts(friendsInRange(state, ship, 1, 1)), then: cardStep('landry_calver', 'go') }); },
      go(state, s) { const t = state.ships[s.choice]; push(state, freeAction(t, 'Landry Calver: free action', { only: actionBar(state, t) })); },
    },
  },
  jax_solent: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !attackRerollAllowed(state, a) || !once(a, 'jax') || !a.attackDice.some(d => !d.rerolled && !d.noReroll)) return [];
      return [{ id: 'jax', label: 'Jax Solent: reroll every die', apply(st, a2) { rerollFaces(st, a2.attackDice, 'attack', ['crit', 'hit', 'focus', 'blank']); mark(a2, 'jax'); } }];
    },
  },
  wren_solace_pilot: {
    options(state, owner, a, stage) {
      if (stage === 'attack' && isAttacker(owner, a) && inArc(owner, defender(state, a)) && attackRerollAllowed(state, a)) return rerollOptions(a, 'wren_p', 'Wren Solace', 'attack', ['blank'], 2);
      if (stage === 'defense' && isDefender(owner, a) && inArc(owner, attacker(state, a))) return rerollOptions(a, 'wren_p', 'Wren Solace', 'defense', ['blank'], 2);
      return [];
    },
  },
  jax_solent_old: {
    startActivation: (state, owner) => (state.round === 1 && !owner.relocated && relocateSpots(state, owner).length ? [cardStep('jax_solent_old', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; ship.relocated = true;
        pick(state, { player: ship.owner, ship: ship.id, kind: 'rollPosition', text: 'Jax Solent: relocate beyond Range 3 of every enemy?', options: relocateSpots(state, ship), then: cardStep('jax_solent_old', 'go', { ship: ship.id }), skip: 'Stay put' });
      },
      go(state, s) { const ship = state.ships[s.ship]; const o = relocateSpots(state, ship).find(x => x.id === s.choice); if (o) { const from = ship.pose; ship.pose = o.pose; emit(state, { type: 'move', ship: ship.id, path: [from, o.pose] }); log(state, `${shipName(ship)} slips into position.`); } },
    },
  },
  chorrbak_old: {
    anyDestroyed: (state, owner, ship) => (ship.owner === owner.owner && ship.id !== owner.id && !ship.fled && !owner.destroyed && ship.pose && inBand(owner, ship, 1, 3) ? [cardStep('chorrbak_old', 'wait', { ship: owner.id })] : []),
    canTarget: extraTargetOnly,
    steps: {
      wait(state, s) { afterCurrentAttack(state, cardStep('chorrbak_old', 'offer', { ship: s.ship })); },
      offer: offer('chorrbak_old', (st, ship) => `${shipName(ship)}: avenge your wingmate with an attack?`, 'Attack'),
      go(state, s) { extraAttack(state, state.ships[s.ship], 'chorrbak_old', 'Chorrbak: vengeance attack'); },
      done: extraDone,
    },
  },

  // ================================================================ Lantern
  vada_scarlow: {
    afterAttack(state, owner, a) {
      const d = defender(state, a);
      if (isAttacker(owner, a) && a.result && !d.destroyed && count(a.attackDice, 'crit') > a.result.crits) { addStress(state, d); log(state, `${shipName(d)} is shaken by Vada Scarlow (+1 stress).`); }
      return [];
    },
  },
  bram_kosk: {
    onReveal(state, ship) {
      const m = ship.round.maneuver.key.match(/^(\d)B([LR])$/);
      const alt = m && onDial(state, ship, `${m[1]}B${m[2] === 'L' ? 'R' : 'L'}`);
      return alt ? [cardStep('bram_kosk', 'offer', { ship: ship.id, key: alt.key })] : [];
    },
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; switchManeuver(state, ship, 'bram_kosk', [onDial(state, ship, s.key)], `${shipName(ship)}: bank the other way?`); },
      switch: applySwitch,
    },
  },
  krass_trellan: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.weapon !== 'primary' && attackRerollAllowed(state, a) ? rerollOptions(a, 'krass', 'Krass Trellan', 'attack', ['blank', 'focus'], 1) : []),
  },
  bram_kosk_syn: {
    options(state, owner, a, stage) {
      const n = enemiesInRange(state, owner, 1, 1).length; if (!n) return [];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) return rerollOptions(a, 'bram', 'Bram Kosk', 'attack', ['blank', 'focus'], n);
      if (stage === 'defense' && isDefender(owner, a)) return rerollOptions(a, 'bram', 'Bram Kosk', 'defense', ['blank', 'focus'], n);
      return [];
    },
  },
  vada_scarlow_syn: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.arc === 'rear' ? n + 1 : n) },
  emin_azzar: {
    afterDrop: (state, ship, type) => [cardStep('emin_azzar', 'offer', { ship: ship.id, n: ORDNANCE[type].cluster || 1 })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Emin Azzar: push the drop further out?', options: [{ id: 'S', label: '3 straight back' }, { id: 'L', label: 'Rear-left corner' }, { id: 'R', label: 'Rear-right corner' }], then: cardStep('emin_azzar', 'go', { ship: ship.id, n: s.n }), skip: 'Leave it' });
      },
      go(state, s) {
        const ship = state.ships[s.ship], back = mul(fwd(ship.pose.h), -2 * CONFIG.straightPerSpeed);
        const d = s.choice === 'S' ? back : add(mul(back, 0.6), mul(right(ship.pose.h), (s.choice === 'L' ? -1 : 1) * 70));
        shiftDropped(state, ship, s.n, d);
      },
    },
  },

  // ================================================================ Heron
  captain_kagen: {
    anyLockTargets: (state, owner, locker, list) => (enemy(owner, locker) && list.some(x => x.id === owner.id) ? list.filter(x => x.id === owner.id) : list),
  },
  colonel_jedran: {
    startCombat: (state, owner) => (owner.lockOn && friendsInRange(state, owner, 1, 1).some(f => !f.lockOn) ? [cardStep('colonel_jedran', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Colonel Jedran: hand your lock to which wingmate?', options: shipOpts(friendsInRange(state, ship, 1, 1).filter(f => !f.lockOn)), then: cardStep('colonel_jedran', 'go', { ship: ship.id }) }); },
      go(state, s) { const ship = state.ships[s.ship], t = state.ships[s.choice]; if (!ship.lockOn) return; t.lockOn = ship.lockOn; ship.lockOn = null; log(state, `${shipName(t)} takes over ${shipName(ship)}'s lock.`); },
    },
  },
  captain_yorrick: {
    anyStress: (state, owner, ship) => (ship.id !== owner.id && ship.owner === owner.owner && owner.stress <= 2 && !owner.destroyed && inBand(owner, ship, 1, 2) ? [cardStep('captain_yorrick', 'offer', { ship: owner.id, target: ship.id })] : []),
    steps: {
      offer: offer('captain_yorrick', (st, ship, s) => `${shipName(ship)}: take ${shipName(st.ships[s.target])}'s new stress token yourself?`, 'Take it'),
      go(state, s) { const t = state.ships[s.target], me = state.ships[s.ship]; if (t.stress < 1 || me.stress > 2) return; t.stress--; me.stress++; log(state, `${shipName(me)} takes the stress off ${shipName(t)}.`); },
    },
  },

  // ================================================================ Drifter
  dace_rendell_pilot: {
    beforeReveal(state, ship) { ship.round.ignoreObstacles = true; return []; },
    phaseRocks: true,
  },
  lebo_pilot: {
    onDealt(state, ship, card, faceup) {
      if (!faceup || !state.damageDeck.length) return undefined;
      const alt = state.damageDeck.pop();
      if (SEVERITY.indexOf(alt) <= SEVERITY.indexOf(card)) { state.damageDiscard.push(alt); return undefined; }
      const entry = { card: alt, faceup: true, round: state.round, uid: state.uid++ };
      ship.damage.push(entry);
      emit(state, { type: 'damage', ship: ship.id, card: alt, faceup: true });
      log(state, `“Lebo” keeps the milder card: ${DAMAGE_CARDS[alt].name}.`);
      resolveFaceup(state, ship, entry);
      return 'discard';
    },
  },
  aden_vrill: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.weapon === 'primary' && defender(state, a).stress > 0 ? n + 1 : n) },

  // ================================================================ Bastille
  admiral_chiran_pilot: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.band <= 2 ? changeOption(a, 'chiran_p', 'Rear Admiral Chiran', 'attack', 'focus', 'crit', 1) : []),
  },
  captain_oican: {
    afterManeuver(state, ship) { for (const e of touchingFoes(state, ship)) { log(state, `${shipName(e)} is rammed by ${shipName(ship)}.`); sufferDamage(state, e, 1, 0); } return []; },
  },
  commander_kenrick: { stat: (state, ship, which, v) => (which === 'agility' && ship.shields === 0 && ship.damage.length > 0 ? v + 1 : v) },

  // ================================================================ Mandible
  unit_h9a: {
    afterAttack(state, owner, a) {
      const d = defender(state, a);
      if (isAttacker(owner, a) && (d.destroyed || d.pendingDestroy) && owner.shields < maxShields(state, owner)) { owner.shields++; log(state, `${shipName(owner)} salvages a shield.`); }
      return [];
    },
  },
  unit_h9b: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.hit || owner.round.h9b || owner.destroyed) return [];
      const cannons = owner.upgrades.filter(u => !u.discarded && UPGRADES[u.id].slot === 'cannon' && UPGRADES[u.id].weapon).map(u => u.id);
      if (!cannons.length) return [];
      owner.round.h9b = true;
      return [{ t: 'bonusAttack', ship: owner.id, only: cannons, reason: 'Unit H-9B: follow up with a cannon' }];
    },
  },
  unit_h9c: { afterAction: (state, ship, action) => (action === 'boost' ? [freeAction(ship, 'Unit H-9C: free evade', { only: ['evade'], grant: ['evade'] })] : []) },
  unit_h9d: {
    onReveal: (state, ship) => (/^3S[LR]$/.test(ship.round.maneuver.key) ? [cardStep('unit_h9d', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship], k = ship.round.maneuver.key; switchManeuver(state, ship, 'unit_h9d', [{ key: `${k}T`, speed: 3, bearing: `${k.slice(1)}T`, color: ship.round.maneuver.color }], `${shipName(ship)}: fly the loop on a 3-turn template?`); },
      switch: applySwitch,
    },
  },

  // ================================================================ Hulk
  latta_rizz_pilot: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || attacker(state, a).owner !== owner.owner || owner.lockOn !== a.defender || a.lattaMinus || !once(a, 'latta_p')) return [];
      return [{ id: 'latta_p', label: 'Latta Rizz: spend lock, defender −1 agility', apply(st, a2) { spendLock(st, st.ships[owner.id]); a2.lattaMinus = owner.id; mark(a2, 'latta_p'); } }];
    },
    defenseDice: (state, owner, a, n) => (a.lattaMinus === owner.id ? n - 1 : n),
  },
  brosk_pilot: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !count(a.attackDice, 'crit') || !once(a, 'brosk_p')) return [];
      return [{ id: 'brosk_p', label: 'Brosk: trade 1 critical for 2 hits', apply(st, a2) {
        a2.attackDice.splice(a2.attackDice.findIndex(d => d.face === 'crit'), 1); addDie(a2.attackDice, 'hit'); addDie(a2.attackDice, 'hit'); mark(a2, 'brosk_p');
      } }];
    },
  },
  moraly_evan: { turretWeapon: (state, ship, uid) => UPGRADES[uid]?.slot === 'cannon' },

  // ================================================================ Hearth
  hesta_vael_hearth: league.hesta_vael,
  sprocket_pilot: {
    startCombat(state, owner) { for (const e of touchingFoes(state, owner)) { addStress(state, e); log(state, `${shipName(e)} is harassed by “Sprocket” (+1 stress).`); } return []; },
  },
  kaen_jarro_pilot: {
    attackDice(state, owner, a, n) {
      const atk = attacker(state, a), d = defender(state, a);
      if (enemy(owner, atk) && d.owner === owner.owner && owner.tokens.focus > 0 && inBand(owner, atk, 1, 2) && once(a, `kaen:${owner.id}`)) {
        mark(a, `kaen:${owner.id}`); spendFocus(state, owner); log(state, `${shipName(owner)} disrupts ${shipName(atk)}'s aim (−1 die).`);
        return n - 1;
      }
      return n;
    },
  },

  // ================================================================ Leaper
  dennick_pilot: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a);
      if (!isDefender(owner, a) || owner.round.dennickP || owner.destroyed || atk.destroyed || !inArc(owner, atk)) return [];
      owner.round.dennickP = true; owner.round.extraTarget = atk.id;
      return [{ t: 'bonusAttack', ship: owner.id, reason: 'Dennick: return fire', after: cardStep('dennick_pilot', 'done', { ship: owner.id, prev: !!owner.round.noMoreAttacks }) }, cardStep('dennick_pilot', 'done', { ship: owner.id, prev: !!owner.round.noMoreAttacks })];
    },
    canTarget: extraTargetOnly,
    steps: { done: extraDone },
  },
  manara: {
    startCombat: (state, owner) => ((owner.tokens.focus || owner.tokens.evade || owner.lockOn) && friendsInRange(state, owner, 1, 1).length ? [cardStep('manara', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Manara: hand all your tokens to which wingmate?', options: shipOpts(friendsInRange(state, ship, 1, 1)), then: cardStep('manara', 'go', { ship: ship.id }) }); },
      go(state, s) {
        const me = state.ships[s.ship], t = state.ships[s.choice];
        t.tokens.focus += me.tokens.focus; t.tokens.evade += me.tokens.evade; me.tokens.focus = 0; me.tokens.evade = 0;
        if (me.lockOn) { t.lockOn = me.lockOn; me.lockOn = null; }
        log(state, `${shipName(me)} hands its tokens to ${shipName(t)}.`);
      },
    },
  },
  tal_trevan: {
    preventDestroy(state, ship) {
      if (ship.trevan) return false;
      ship.trevan = true;
      for (const c of ship.damage) if (!c.proxy) state.damageDiscard.push(c.card);
      ship.damage = [];
      log(state, `${shipName(ship)} limps on, patched together!`);
      for (let i = 0; i < 4; i++) dealDamageCard(state, ship, false);
      return true;
    },
  },

  // ================================================================ Prowler
  sabra_wenn_prowler: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'defense' || !isDefender(owner, a) || !inMobileArc(owner, atk) || !inBand(owner, atk, 1, 2) || !once(a, 'sabra_p')) return [];
      return [{ id: 'sabra_p', label: 'Sabra Wenn: add a focus result', apply(st, a2) { addDie(a2.defenseDice, 'focus'); mark(a2, 'sabra_p'); } }];
    },
  },
  kessa_onyx_pilot: {
    startCombat: (state, owner) => (kessaTargets(state, owner).length ? [cardStep('kessa_onyx_pilot', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Kessa Onyx: tractor which ship?', options: shipOpts(kessaTargets(state, ship)), then: cardStep('kessa_onyx_pilot', 'go', { ship: ship.id }) }); },
      go(state, s) { applyTractor(state, state.ships[s.choice], state.ships[s.ship].owner); },
    },
  },
  ysolde_venn: {
    startCombat: (state, owner) => (ysoldeTargets(state, owner).length ? [cardStep('ysolde_venn', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Ysolde Venn: stress which ship?', options: shipOpts(ysoldeTargets(state, ship)), then: cardStep('ysolde_venn', 'go') }); },
      go(state, s) { addStress(state, state.ships[s.choice]); },
    },
  },

  // ================================================================ Raven
  vorrak_raven: dominion.vorrak,
  major_strand: { friendReach: true },
  lt_dorman: {
    startActivation: (state, owner) => (state.round === 1 && !owner.dormanUsed && liveShips(state).some(f => f.owner === owner.owner && f.id !== owner.id) ? [cardStep('lt_dorman', 'pickShip', { ship: owner.id })] : []),
    steps: {
      pickShip(state, s) {
        const ship = state.ships[s.ship]; ship.dormanUsed = true;
        pick(state, { player: ship.owner, ship: ship.id, text: 'Lieutenant Dorman: move which wingmate next to you?', options: shipOpts(liveShips(state).filter(f => f.owner === ship.owner && f.id !== ship.id)), then: cardStep('lt_dorman', 'pickSpot', { ship: ship.id }) });
      },
      pickSpot(state, s) {
        const ship = state.ships[s.ship], f = state.ships[s.choice];
        const opts = dormanSpots(state, ship, f);
        if (opts.length) pick(state, { player: ship.owner, ship: f.id, kind: 'rollPosition', text: `Place ${shipName(f)}:`, options: opts, then: cardStep('lt_dorman', 'go', { ship: ship.id, target: f.id }), skip: 'Leave it' });
      },
      go(state, s) { const f = state.ships[s.target]; const o = dormanSpots(state, state.ships[s.ship], f).find(x => x.id === s.choice); if (o) { const from = f.pose; f.pose = o.pose; emit(state, { type: 'move', ship: f.id, path: [from, o.pose] }); } },
    },
  },

  // ================================================================ Pelican
  casso_andrel_pilot: {
    startActivation: (state, owner) => (friendsInRange(state, owner, 1, 2).some(f => f.stress > 0) ? [cardStep('casso_andrel_pilot', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Casso Andrel: calm which wingmate?', options: shipOpts(friendsInRange(state, ship, 1, 2).filter(f => f.stress > 0)), then: cardStep('casso_andrel_pilot', 'go') }); },
      go(state, s) { const t = state.ships[s.choice]; if (t.stress > 0) t.stress--; log(state, `${shipName(t)} is calmed (−1 stress).`); },
    },
  },
  bodo_rake_pilot: {
    anyLockTargets(state, owner, locker, list) {
      if (locker.owner !== owner.owner) return list;
      const friends = liveShips(state).filter(f => f.owner === owner.owner);
      return [...list, ...liveShips(state).filter(e => enemy(owner, e) && !list.some(x => x.id === e.id) && friends.some(f => inBand(f, e, 1, 3)))];
    },
  },
  hef_tobin: {
    anyManeuver: (state, owner, ship, color, info) => (enemy(owner, ship) && info.bumped && areTouching(state, owner.id, ship.id) && !owner.destroyed ? [freeAction(owner, 'Hef Tobin: free action')] : []),
  },
  sorrel_garr_pilot: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) || !(atk.stress > 0 || atk.damage.length) || !inBand(owner, atk, 1, 2) || !attackRerollAllowed(state, a)) return [];
      return rerollOptions(a, `sorrel_p:${owner.id}`, 'Sorrel Garr', 'attack', ['blank', 'focus'], 1);
    },
  },
  benno_tubb: {
    afterAction: (state, ship, action) => (action === 'focus' && ship.tokens.focus > 0 && friendsInRange(state, ship, 1, 2).length ? [cardStep('benno_tubb', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Benno Tubb: pass a focus token to which wingmate?', options: shipOpts(friendsInRange(state, ship, 1, 2)), then: cardStep('benno_tubb', 'go', { ship: ship.id }) }); },
      go(state, s) { const me = state.ships[s.ship], t = state.ships[s.choice]; if (me.tokens.focus < 1) return; me.tokens.focus--; t.tokens.focus++; },
    },
  },
  magda_yarrow_pilot: { rerollCap: (state, owner, a, v) => v || (a.defender !== owner.id && inBand(owner, defender(state, a), 1, 2)) },

  // ================================================================ Thunderhead
  scarlet_lead: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'attack' || !isAttacker(owner, a) || !inArc(owner, d) || condition(d, 'shaken') || !a.attackDice.some(x => x.face === 'hit' || x.face === 'crit') || !once(a, 'scarlet')) return [];
      return [{ id: 'scarlet', label: '“Scarlet Lead”: spend a hit to give the defender “Shaken”', apply(st, a2) {
        const i = a2.attackDice.findIndex(x => x.face === 'hit'); a2.attackDice.splice(i >= 0 ? i : a2.attackDice.findIndex(x => x.face === 'crit'), 1);
        st.ships[a2.defender].conditions.push({ id: 'shaken', from: owner.id }); mark(a2, 'scarlet');
      } }];
    },
  },
  scarlet_specialist: {
    afterDrop: (state, ship, type) => (state.phase === 'activation' ? [cardStep('scarlet_specialist', 'offer', { ship: ship.id, n: ORDNANCE[type].cluster || 1, type })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: '“Scarlet Specialist”: move the bomb to another side of your ship?', options: [{ id: 'L', label: 'Left side' }, { id: 'R', label: 'Right side' }, { id: 'F', label: 'Front' }], then: cardStep('scarlet_specialist', 'go', s), skip: 'Leave it behind' });
      },
      go(state, s) {
        const ship = state.ships[s.ship], def = ORDNANCE[s.type], depth = def.shape.type === 'circle' ? def.shape.r * 2 : def.shape.h;
        const back = half(ship) + CONFIG.straightPerSpeed + depth / 2, side = half(ship) + depth / 2 + 1;
        const toks = state.ordnance.filter(t => t.by === ship.id).slice(-s.n);
        const target = s.choice === 'F' ? mul(fwd(ship.pose.h), side) : mul(right(ship.pose.h), (s.choice === 'L' ? -1 : 1) * side);
        const d = add(mul(fwd(ship.pose.h), back), target); // from behind the ship to the chosen side
        for (const tok of toks) { tok.x += d.x; tok.y += d.y; }
      },
    },
  },
  azure_lead: {
    defenseDice: (state, owner, a, n) => (isAttacker(owner, a) && state.ordnance.some(tok => bandFor(closestPoints(shipPoly(defender(state, a)), ordnancePolys(tok)).d) === 1) ? n - 1 : n),
  },

  // ================================================================ reserve fighter & ability sharing
  pup_pilot: borrower((state, ship) => [ship.borrow?.ability && ship.borrow.ability !== 'pup_pilot' ? CARDS[ship.borrow.ability] : null], {
    stat: (state, ship, which, v) => (which === 'skill' && ship.borrow ? ship.borrow.skill : v),
  }),
  hounds_lair: {
    onDestroyed(state, ship) {
      const pup = shipList(state).find(s => s.reserve && s.dockedOn === ship.id && !s.deployed && !s.destroyed);
      if (!pup || !placeClear(state, pup, ship.pose, [ship.id])) return [];
      pup.borrow = { skill: naturalSkill(state, ship), ability: PILOTS[ship.pilot].ability };
      putOnTable(state, pup, { ...ship.pose });
      pup.noAttackRound = state.round;
      log(state, `${shipName(pup)} launches from the wreck of ${shipName(ship)}!`);
      return [];
    },
  },
  hunter_network: borrower(networkAbilities),
  hunter_link: borrower(networkAbilities),

  // ================================================================ titles
  old_reliable: { actionBar: (state, ship, list) => (list.includes('evade') ? list : [...list, 'evade']) },
  old_reliable_mk2: {
    afterManeuver: (state, ship, color, info) => (/^3B[LR]$/.test(ship.round.revealed || '') && !info.bumped && ship.stress === 0 ? [cardStep('old_reliable_mk2', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('old_reliable_mk2', (st, ship) => `${shipName(ship)}: take 1 stress to spin 180°?`, 'Spin around'),
      go(state, s) { const ship = state.ships[s.ship]; const from = ship.pose; ship.pose = { ...ship.pose, h: ship.pose.h + Math.PI }; emit(state, { type: 'move', ship: ship.id, path: [from, ship.pose] }); addStress(state, ship); },
    },
  },
  signet: { lockTargets: (state, ship) => liveShips(state).filter(e => enemy(ship, e)) },
  wayward: {
    noPrimary: (state, ship) => ship.upgrades.some(u => !u.discarded && UPGRADES[u.id].slot === 'cannon' && UPGRADES[u.id].weapon),
    turretWeapon: (state, ship, uid) => UPGRADES[uid]?.slot === 'cannon',
  },
  unyielding: { afterManeuver: (state, ship, color, info) => (info.bumped ? [freeAction(ship, 'Unyielding: free action (then +1 stress)', { stressAfter: true })] : []) },
  hard_bargain: { stat: (state, ship, which, v) => (which === 'attack' ? v + 1 : v) },
  mothership: mothership('i'),
  mothership_ii: mothership('ii'),
  lifeboat: {}, lifeboat_ii: {}, jaws: {}, iron_maiden: {}, hidden_hold: {},
  shadow_hook: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) && a.hit && !defender(state, a).destroyed && inMobileArc(owner, defender(state, a)) && inBand(owner, defender(state, a), 1, 2)
      ? [cardStep('shadow_hook', 'offer', { ship: owner.id, target: a.defender })] : []),
    steps: {
      offer: offer('shadow_hook', (st, ship, s) => `${shipName(ship)}: hook ${shipName(st.ships[s.target])} with a tractor beam?`, 'Hook it'),
      go(state, s) { applyTractor(state, state.ships[s.target], state.ships[s.ship].owner); },
    },
  },
  black_raven: {
    endPhase: (state, owner) => (enemiesInRange(state, owner, 1, 2).some(e => e.stress === 0) ? [cardStep('black_raven', 'pickEnemy', { ship: owner.id })] : []),
    steps: {
      pickEnemy(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: 'Black Raven: pressure which unstressed enemy?', options: shipOpts(enemiesInRange(state, ship, 1, 2).filter(e => e.stress === 0)), then: cardStep('black_raven', 'victim', { ship: ship.id }) });
      },
      victim(state, s) {
        const ship = state.ships[s.ship], e = state.ships[s.choice];
        const opts = enemiesInRange(state, ship, 1, 2).filter(x => x.owner === e.owner);
        pick(state, { player: e.owner, ship: e.id, text: 'Black Raven: which of your ships takes the stress token?', options: shipOpts(opts), then: cardStep('black_raven', 'go'), skip: false });
      },
      go(state, s) { addStress(state, state.ships[s.choice]); },
    },
  },
  pivot_wings: {
    stat: (state, ship, which, v) => (which === 'agility' && (ship.pivot || 'open') === 'open' ? v + 1 : v),
    onReveal: (state, ship) => ((ship.pivot || 'open') === 'landing' && ship.round.maneuver.key === '0ST' ? [cardStep('pivot_wings', 'spinOffer', { ship: ship.id })] : []),
    afterManeuver: (state, ship) => [cardStep('pivot_wings', 'offer', { ship: ship.id })],
    steps: {
      offer: offer('pivot_wings', (st, ship) => `${shipName(ship)}: flip Pivot Wings to ${(ship.pivot || 'open') === 'open' ? 'landing' : 'open'}?`, 'Flip'),
      go(state, s) { const ship = state.ships[s.ship]; ship.pivot = (ship.pivot || 'open') === 'open' ? 'landing' : 'open'; log(state, `${shipName(ship)} sets its wings to ${ship.pivot}.`); },
      spinOffer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: spin 180° while stopped?`, options: yesNo('Spin around'), then: cardStep('pivot_wings', 'spin', { ship: ship.id }) });
      },
      spin(state, s) { const ship = state.ships[s.ship]; const from = ship.pose; ship.pose = { ...ship.pose, h: ship.pose.h + Math.PI }; emit(state, { type: 'move', ship: ship.id, path: [from, ship.pose] }); },
    },
  },
  crossfire_drill: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'defense' || !isDefender(owner, a) || !liveShips(state).some(f => f.owner === owner.owner && f.id !== owner.id && inBand(atk, f, 1, 2)) || !once(a, 'crossfire')) return [];
      return [{ id: 'crossfire', label: 'Crossfire Drill: add a focus result', apply(st, a2) { addDie(a2.defenseDice, 'focus'); mark(a2, 'crossfire'); } }];
    },
  },

  // ================================================================ modifications, systems, illicit, bombs
  rear_lasers: {
    anyManeuver(state, owner, ship, color, info) {
      if (!enemy(owner, ship) || !info.bumped || !areTouching(state, owner.id, ship.id)) return [];
      const f = roll1(state, owner, 'Rear Lasers');
      if (f === 'hit' || f === 'crit') { log(state, `${shipName(ship)} is scorched by rear lasers.`); sufferDamage(state, ship, 1, 0); }
      return [];
    },
  },
  ion_wake: {
    anyManeuver(state, owner, ship, color, info) {
      if (!enemy(owner, ship) || !info.bumped || !areTouching(state, owner.id, ship.id)) return [];
      const f = roll1(state, owner, 'Ion Wake Emitter');
      if (f === 'hit' || f === 'crit') { ship.ion = (ship.ion || 0) + 1; log(state, `${shipName(ship)} is ionized by the wake.`); }
      return [];
    },
  },
  chaff_pods: {
    startCombat: (state, owner) => [cardStep('chaff_pods', 'offer', { ship: owner.id })],
    steps: {
      offer: offer('chaff_pods', (st, ship) => `${shipName(ship)}: fire Chaff Pods (+1 agility this round, break an enemy lock)?`, 'Fire chaff'),
      go(state, s) {
        const ship = state.ships[s.ship]; discardUpgrade(ship, 'chaff_pods'); ship.round.agilityBonus += 1;
        const e = liveShips(state).find(x => enemy(ship, x) && x.lockOn === ship.id); if (e) e.lockOn = null;
        log(state, `${shipName(ship)} fills space with chaff.`);
      },
    },
  },
  screen_jammer: { obstructs: true },
  steering_fins: {
    onReveal(state, ship) {
      const m = ship.round.maneuver.key.match(/^(\d)T([LR])$/);
      const alt = m && onDial(state, ship, `${m[1]}B${m[2]}`);
      return alt ? [cardStep('steering_fins', 'offer', { ship: ship.id, key: alt.key })] : [];
    },
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; switchManeuver(state, ship, 'steering_fins', [onDial(state, ship, s.key)], `${shipName(ship)}: ease the turn into a bank?`); },
      switch: applySwitch,
    },
  },
  gyro_mount: {
    endPhase: (state, owner) => (speedOf(owner) >= 3 ? [cardStep('gyro_mount', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: 'Gyro Mount: rotate your mobile arc?', options: ['front', 'left', 'right', 'rear'].filter(k => k !== (ship.mobileArc || 'front')).map(k => ({ id: k, label: k })), then: cardStep('gyro_mount', 'go', { ship: ship.id }) });
      },
      go(state, s) { state.ships[s.ship].mobileArc = s.choice; },
    },
  },
  reactive_deflectors: {
    afterAttack(state, owner, a) {
      if (isDefender(owner, a) && a.result && a.result.hits + a.result.crits >= 3 && !owner.destroyed && owner.shields < maxShields(state, owner)) { owner.shields++; log(state, `${shipName(owner)}'s deflectors recharge.`); }
      return [];
    },
  },
  cargo_dump: {
    actions: { cargo_dump: { label: 'Cargo Dump: dump a cargo cloud', can: () => true, perform(state, ship) { dropOrdnance(state, ship, 'cargo'); discardUpgrade(ship, 'cargo_dump'); } } },
  },
  burnout_thrusters: {
    actionBar: (state, ship, list) => (list.includes('slam') ? list : [...list, 'slam']),
    afterAction(state, ship, action) { if (action === 'slam') { discardUpgrade(ship, 'burnout_thrusters'); log(state, `${shipName(ship)}'s thrusters burn out.`); } return []; },
  },
  bomb_silos: {
    afterManeuver: (state, ship) => silosRestore(state, ship),
    afterAction: (state, ship) => silosRestore(state, ship),
    startCombat: (state, owner) => silosRestore(state, owner),
  },
  blast_plating: {
    ignoreBomb(state, ship, tok) {
      if (tok.owner !== ship.owner) return false;
      const f = roll1(state, ship, 'Blast Plating');
      if (f === 'hit') { discardUpgrade(ship, 'blast_plating'); log(state, `${shipName(ship)}'s blast plating cracks.`); }
      return true;
    },
  },

  // ================================================================ condition
  shaken: {
    onDetonate(state, owner, tok, victims) {
      if (!victims.some(v => v.id === owner.id) || !condition(owner, 'shaken')) return [];
      dropCondition(owner, 'shaken');
      log(state, `${shipName(owner)} is shaken by the blast (+1 critical).`);
      sufferDamage(state, owner, 0, 1);
      return [];
    },
    actions: {
      shaken: {
        label: 'Shake it off (roll 1 attack die)', can: (state, ship) => !!condition(ship, 'shaken'),
        perform(state, ship) { const f = roll1(state, ship, 'Shake it off'); if (f === 'focus' || f === 'hit') { dropCondition(ship, 'shaken'); log(state, `${shipName(ship)} steadies its nerves.`); } },
      },
    },
  },
};

function relocateSpots(state, ship) {
  const W = CONFIG.playArea, out = [];
  for (const [id, x, y] of [['c', W / 2, W / 2], ['l', W * 0.25, W / 2], ['r', W * 0.75, W / 2], ['cl', W * 0.35, W * 0.4], ['cr', W * 0.65, W * 0.6]]) {
    const pose = { x, y, h: ship.pose.h };
    const poly = basePolygon(pose, chassis(ship).size);
    const far = liveShips(state).filter(e => enemy(ship, e)).every(e => closestPoints(poly, shipPoly(e)).d > 3 * CONFIG.rangeBand);
    if (far && placeClear(state, ship, pose) && !obstaclePolys(state).some(p => polygonsIntersect(poly, p))) out.push({ id, label: `Spot ${out.length + 1}`, pose });
  }
  return out;
}
const kessaTargets = (state, ship) => liveShips(state).filter(x => x.id !== ship.id && band(ship, x) === 1 && inFrontArc(ship, x) && inMobileArc(ship, x));
const ysoldeTargets = (state, ship) => liveShips(state).filter(x => x.id !== ship.id && inBand(ship, x, 1, 2) && inMobileArc(ship, x));
function dormanSpots(state, ship, f) {
  const gap = half(ship) + half(f) + 20;
  return [['L', 'Left of Dorman', -1], ['R', 'Right of Dorman', 1]].map(([id, label, k]) => ({ id, label, pose: { ...add(ship.pose, mul(right(ship.pose.h), k * gap)), h: ship.pose.h } }))
    .filter(o => placeClear(state, f, o.pose) && !obstaclePolys(state).some(p => polygonsIntersect(basePolygon(o.pose, chassis(f).size), p)));
}
