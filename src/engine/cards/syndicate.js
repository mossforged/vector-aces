// Card behaviour for the "syndicate" batch (pilot abilities, upgrades, conditions owned by that batch —
// see docs/WORKSTREAMS.md → A). One entry per card id; hook reference: src/engine/hooks.js.
// Shared helpers: src/engine/effects.js (dice options, tokens, tractor), engine/ordnance.js (bombs).
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollFace, rollDice, count } from '../dice.js';
import { sufferDamage, dealDamageCard } from '../damage.js';
import { DAMAGE_CARDS } from '../../data/damageDeck.js';
import { dialFor } from '../../data/ships.js';
import { PILOTS } from '../../data/pilots.js';
import { UPGRADES } from '../../data/upgrades.js';
import { ORDNANCE } from '../../data/ordnance.js';
import { barrelRollPoses } from '../maneuvers.js';
import { checkMines, dropOrdnance, ordnancePolys } from '../ordnance.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect, segmentHitsPolygon, add, mul, fwd, right } from '../geometry.js';
import {
  shipName, inArc, inFrontArc, inBullseye, rangeBetween, friendsInRange, enemiesInRange, liveShips, stat, maneuverColor,
  obstaclePolys, actionBar, activeUpgrades, chassis, overlapsAnyShip, areTouching, naturalSkill, hasFlag, effectiveSkill,
} from '../queries.js';
import {
  attacker, defender, once, mark, rerollOptions, rerollFaces, changeOption, freeAction, acquireLock, attackRerollAllowed,
  addStress, spendFocus, spendLock, applyTractor,
} from '../effects.js';
import { CARDS } from './index.js';
import { upgradeAllowed } from '../setup.js';

const isAttacker = (owner, a) => a.attacker === owner.id;
const isDefender = (owner, a) => a.defender === owner.id;
const band = (x, y) => rangeBetween(x, y).band;
const inBand = (x, y, lo, hi) => { const b = band(x, y); return !!b && b >= lo && b <= hi; };
const shipOpts = ships => ships.map(s => ({ id: s.id, label: shipName(s), target: s.id }));
const yesNo = label => [{ id: 'yes', label }];
const discardUpgrade = (ship, id) => { const u = ship.upgrades.find(x => x.id === id && !x.discarded); if (u) u.discarded = true; };
const addDie = (dice, face) => dice.push({ face, rerolled: false, added: true });
const maxShields = (state, s) => stat(state, s, 'maxShields');
const speedOf = ship => (ship.round.revealed ? parseInt(ship.round.revealed, 10) || 0 : 0);
const enemy = (owner, s) => s.owner !== owner.owner;
const nearby = (state, ship) => liveShips(state).filter(s => s.id !== ship.id && band(ship, s) === 1);
const roll1 = (state, ship, reason, kind = 'attack') => { const f = rollFace(state, kind); emit(state, { type: 'roll', ship: ship.id, faces: [f], reason, kind }); return f; };
const firstRound = state => state.round === 1;

const offer = (card, text, label) => (state, s) => {
  const ship = state.ships[s.ship]; if (!ship || ship.destroyed) return;
  const { t, ...data } = s;
  pick(state, { player: ship.owner, ship: ship.id, text: text(state, ship, s), options: yesNo(label), then: cardStep(card, 'go', data) });
};
/** Turn a dealt card facedown (card-level "flip it facedown" effects): call from onDealt and return 'discard'. */
function keepFacedown(state, ship, card, card2step) {
  ship.damage.push({ card, faceup: false, round: state.round, uid: state.uid++ });
  emit(state, { type: 'damage', ship: ship.id, card, faceup: false });
  push(state, cardStep(card2step, 'unDiscard', { card }));
  return 'discard';
}
const unDiscard = (state, s) => { const i = state.damageDiscard.lastIndexOf(s.card); if (i >= 0) state.damageDiscard.splice(i, 1); };

// ---------------- Tweek: “Mimicked” forwards every hook to the copied pilot ability ----------------
const VALUE_HOOKS = ['stat', 'maneuverColor', 'actionBar', 'actionsPerTurn', 'focusGain', 'weaponRange', 'boostTemplates', 'lockTargets', 'decloakPositions', 'deploySkill',
  'attackDice', 'defenseDice', 'canTarget', 'denyTokens', 'blockMods', 'lockCostWaived', 'bombDetonates', 'bombRoll'];
const STEP_HOOKS = ['beforeReveal', 'onReveal', 'afterManeuver', 'afterAction', 'onSpendFocus', 'onSpendLock', 'onStress', 'startCombat', 'endPhase', 'startActivation',
  'afterAttack', 'anyManeuver', 'anyAction', 'anySpendFocus', 'combatActive', 'anyActivate', 'anyDamaged', 'anyDestroyed', 'afterDrop', 'afterDecloak', 'onLocked', 'onDestroyed', 'onDetonate'];
const FLAG_HOOKS = ['actWhileStressed', 'attackWhileTouching', 'alwaysHits', 'delayDestruction', 'keepFocus', 'lockCostAsFocus', 'forbidAttackRerolls', 'faceupDrawThree',
  'discardOnlyOnHit', 'turretWeapon', 'redWhileStressed', 'attackOnObstacle', 'stressedAction', 'delayStress', 'phaseRocks', 'launchBombs', 'takeFaceup', 'dealFaceup', 'longDrop', 'ignoreBomb'];
const mimicOf = ship => (ship.tweek?.mode === 'mimicked' && ship.tweek.ability && ship.tweek.ability !== 'tweek' ? CARDS[ship.tweek.ability] : null);
const tweek = {
  startActivation: (state, owner) => (firstRound(state) && !owner.tweek ? [cardStep('tweek', 'pickEnemy', { ship: owner.id })] : []),
  steps: {
    pickEnemy(state, s) {
      const ship = state.ships[s.ship];
      ship.tweek = { mode: null };
      pick(state, { player: ship.owner, ship: ship.id, text: 'Tweek: which enemy pilot do you study?', options: shipOpts(liveShips(state).filter(e => enemy(ship, e))), then: cardStep('tweek', 'pickMode', { ship: ship.id }), skip: false });
    },
    pickMode(state, s) {
      const ship = state.ships[s.ship], t = state.ships[s.choice];
      pick(state, { player: ship.owner, ship: ship.id, text: `Tweek: copy ${shipName(t)}'s…`,
        options: [{ id: 'shadowed', label: `pilot skill (${naturalSkill(state, t)})` }, ...(PILOTS[t.pilot].ability ? [{ id: 'mimicked', label: 'pilot ability' }] : [])],
        then: cardStep('tweek', 'go', { ship: ship.id, target: t.id }), skip: false });
    },
    go(state, s) {
      const ship = state.ships[s.ship], t = state.ships[s.target];
      ship.tweek = { mode: s.choice, target: t.id, skill: naturalSkill(state, t), ability: PILOTS[t.pilot].ability };
      t.conditions.push({ id: s.choice, from: ship.id });
      log(state, `Tweek ${s.choice === 'shadowed' ? 'shadows' : 'mimics'} ${shipName(t)}.`);
    },
  },
};
for (const h of VALUE_HOOKS) {
  tweek[h] = (state, ship, ...args) => {
    const v = args[args.length - 1];
    if (h === 'stat' && ship.tweek?.mode === 'shadowed' && args[0] === 'skill') return ship.tweek.skill;
    const c = mimicOf(ship);
    return c?.[h] ? c[h](state, ship, ...args) : v;
  };
}
const startActivationOwn = tweek.startActivation;
for (const h of STEP_HOOKS) {
  const own = h === 'startActivation' ? startActivationOwn : null;
  tweek[h] = (state, ship, ...args) => { const c = mimicOf(ship); return [...(own ? own(state, ship) : []), ...((c?.[h] && c[h](state, ship, ...args)) || [])]; };
}
for (const h of FLAG_HOOKS) tweek[h] = (state, ship, ...args) => { const c = mimicOf(ship); return !!c && (typeof c[h] === 'function' ? !!c[h](state, ship, ...args) : c[h] === true); };
tweek.options = (state, owner, a, stage) => { const c = mimicOf(owner); return c?.options ? c.options(state, owner, a, stage) : []; };
tweek.compare = (state, owner, a, rules) => mimicOf(owner)?.compare?.(state, owner, a, rules);
tweek.afterRollForced = (state, owner, a, kind) => mimicOf(owner)?.afterRollForced?.(state, owner, a, kind);
tweek.onDealt = (state, ship, ...args) => mimicOf(ship)?.onDealt?.(state, ship, ...args);

// ---------------- angled barrel roll (Adder Mk. II) ----------------
function clearPose(state, ship, pose) {
  const poly = basePolygon(pose, chassis(ship).size);
  const rocks = hasFlag(state, ship, 'phaseRocks') ? [] : obstaclePolys(state);
  return polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id) && !rocks.some(o => polygonsIntersect(poly, o));
}
const angledRolls = (state, ship) => barrelRollPoses(ship.pose, chassis(ship).size).filter(r => r.label === 'centre')
  .flatMap(r => [-1, 1].map(k => ({ ...r, id: `${r.id}${k < 0 ? 'b' : 'f'}`, label: `angled ${k < 0 ? 'back' : 'forward'}`, pose: { ...r.pose, ...add(r.pose, mul(fwd(r.pose.h), k * 20)) } })))
  .filter(r => clearPose(state, ship, r.pose));

// ---------------- Matriarch: one spare token per Illicit card in the squad ----------------
function matriarchRestore(state, owner) {
  if (owner.destroyed) return [];
  if (!owner.matriarch) owner.matriarch = liveShips(state).filter(s => s.owner === owner.owner).flatMap(s => s.upgrades.filter(u => UPGRADES[u.id].slot === 'illicit').map(u => `${s.id}:${u.id}`));
  for (const key of owner.matriarch.slice()) {
    const [sid, uid] = key.split(':'); const s = state.ships[sid];
    const u = s && !s.destroyed && s.upgrades.find(x => x.id === uid);
    if (u && u.discarded) { u.discarded = false; owner.matriarch.splice(owner.matriarch.indexOf(key), 1); log(state, `${shipName(s)} spends a spare to keep ${UPGRADES[uid].name}.`); }
  }
  return [];
}
const timedBombs = ship => ship.upgrades.filter(u => !u.discarded && UPGRADES[u.id].ordnance && !UPGRADES[u.id].mine).map(u => u.id);
const ordnanceCards = ship => ship.upgrades.filter(u => !u.discarded && UPGRADES[u.id].ordnance).map(u => u.id);
const upgradeActionIds = ship => ship.upgrades.filter(u => !u.discarded && CARDS[u.id]?.actions?.[u.id]).map(u => u.id);
/** Shared "instead of attacking" pattern (Feedback Coil, Ion Pulse Rig). */
const insteadOfAttacking = (card, can) => (state, owner, ship) => (ship.id === owner.id && !owner.round.attacked && !owner.round.noMoreAttacks && can(state, owner) ? [cardStep(card, 'offer', { ship: owner.id })] : []);

export default {
  // ================================================================ pilots
  prince_zirox: {
    options(state, owner, a, stage) {
      if (stage !== 'onHit' || !isDefender(owner, a) || !a.result || a.result.hits + a.result.crits < 1 || !once(a, 'zirox')) return [];
      const crit = a.result.crits > 0;
      return friendsInRange(state, owner, 1, 1).map(f => ({ id: `zirox:${f.id}`, label: `Prince Zirox: ${shipName(f)} takes 1 ${crit ? 'critical' : 'hit'}`,
        apply(st, a2) { if (crit) a2.result.crits--; else a2.result.hits--; mark(a2, 'zirox'); sufferDamage(st, st.ships[f.id], crit ? 0 : 1, crit ? 1 : 0); } }));
    },
  },
  gurra: { startCombat(state, owner) { if (enemiesInRange(state, owner, 1, 1).length) { owner.tokens.focus++; log(state, `${shipName(owner)} gains focus up close.`); } return []; } },
  dalen_oberon: {
    onReveal(state, ship) {
      const m = ship.round.maneuver.key.match(/^(\d+)(BL|BR|TL|TR|SL|SR)$/);
      return m && ship.stress === 0 ? [cardStep('dalen_oberon', 'offer', { ship: ship.id, speed: +m[1], side: m[2].endsWith('L') ? 'L' : 'R' })] : [];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], key = `${s.speed}TR${s.side}`;
        pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text: `${shipName(ship)}: fly it as a red Tallon roll?`,
          options: [{ id: key, label: `${key} (red)`, maneuver: { key, speed: s.speed, bearing: `TR${s.side}`, color: 'r' } }], then: cardStep('dalen_oberon', 'go', { ship: ship.id }), skip: 'Keep it' });
      },
      go(state, s) { const ship = state.ships[s.ship]; ship.round.maneuver = { key: s.choice, color: 'r' }; ship.round.revealed = s.choice; log(state, `${shipName(ship)} twists into a Tallon roll.`); },
    },
  },
  tweek,
  ndari_sulek: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && !friendsInRange(state, owner, 1, 2).length ? n + 1 : n) },
  kato_leech: {
    startCombat: (state, owner) => (tokenOpts(friendsInRange(state, owner, 1, 2)).length ? [cardStep('kato_leech', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Kato Leech: take which token?', options: tokenOpts(friendsInRange(state, ship, 1, 2)), then: cardStep('kato_leech', 'go', { ship: ship.id }) }); },
      go: takeToken,
    },
  },
  seressa: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      return stage === 'defense' && d.id !== owner.id && d.owner === owner.owner && band(owner, d) === 1 ? rerollOptions(a, `seressa:${owner.id}`, 'Seressa', 'defense', ['blank', 'focus'], 1) : [];
    },
  },
  laetha_ashe: { afterAttack(state, owner, a) { if (isDefender(owner, a) && !a.hit && !owner.destroyed) { owner.tokens.evade++; log(state, `${shipName(owner)} slips away (+1 evade).`); } return []; } },
  red_genesis: {
    afterAction(state, ship, action) {
      const t = action === 'lock' && ship.lockOn && state.ships[ship.lockOn];
      if (t) { ship.tokens.focus = Math.max(ship.tokens.focus, t.tokens.focus); ship.tokens.evade = Math.max(ship.tokens.evade, t.tokens.evade); log(state, `${shipName(ship)} matches ${shipName(t)}'s tokens.`); }
      return [];
    },
  },
  inalda: {
    options(state, owner, a, stage) {
      if (owner.shields < 1 || !once(a, 'inalda')) return [];
      const go = which => [{ id: 'inalda', label: 'Inalda: spend a shield, reroll your blanks and focus results', apply(st, a2) {
        st.ships[owner.id].shields--; rerollFaces(st, which === 'attack' ? a2.attackDice : a2.defenseDice, which, ['blank', 'focus']); mark(a2, 'inalda');
      } }];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a) && a.attackDice.some(d => d.face === 'blank' || d.face === 'focus')) return go('attack');
      if (stage === 'defense' && isDefender(owner, a) && a.defenseDice.some(d => d.face === 'blank' || d.face === 'focus')) return go('defense');
      return [];
    },
  },
  quin_jast: {
    startCombat: (state, owner) => (owner.upgrades.some(u => u.discarded && ['torpedo', 'missile'].includes(UPGRADES[u.id].slot)) ? [cardStep('quin_jast', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: disable weapons this round to restore which card?`,
          options: ship.upgrades.filter(u => u.discarded && ['torpedo', 'missile'].includes(UPGRADES[u.id].slot)).map(u => ({ id: u.id, label: UPGRADES[u.id].name })), then: cardStep('quin_jast', 'go', { ship: ship.id }) });
      },
      go(state, s) { const ship = state.ships[s.ship]; const u = ship.upgrades.find(x => x.id === s.choice && x.discarded); if (u) { u.discarded = false; ship.disarmed = true; log(state, `${shipName(ship)} reloads ${UPGRADES[u.id].name}.`); } },
    },
  },
  sunny_bounds: {
    afterRollForced(state, owner, a, kind) {
      if (owner.round.sunny || !(kind === 'attack' ? isAttacker(owner, a) : isDefender(owner, a))) return;
      const dice = kind === 'attack' ? a.attackDice : a.defenseDice;
      if (dice.length && dice.every(d => d.face === dice[0].face)) { owner.round.sunny = true; addDie(dice, dice[0].face); log(state, `Sunny Bounds rolls a matching set (+1 ${dice[0].face}).`); }
    },
  },
  dreya_rent: {
    onSpendLock: (state, ship) => [cardStep('dreya_rent', 'offer', { ship: ship.id })],
    steps: {
      offer: offer('dreya_rent', (st, ship) => `${shipName(ship)}: take 1 stress to acquire a new lock?`, 'Re-lock'),
      go(state, s) { addStress(state, state.ships[s.ship]); push(state, { t: 'lockPrompt', ship: s.ship }); },
    },
  },
  kavell: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && !inFrontArc(owner, defender(state, a)) ? n + 1 : n) },
  dace_bonner: {
    afterAttack: (state, owner, a) => (a.ion && enemy(owner, defender(state, a)) && !defender(state, a).destroyed && owner.stress === 0 && inBand(owner, defender(state, a), 1, 3)
      ? [cardStep('dace_bonner', 'offer', { ship: owner.id, target: a.defender })] : []),
    steps: {
      offer: offer('dace_bonner', (st, ship, s) => `${shipName(ship)}: take 1 stress to make ${shipName(st.ships[s.target])} suffer 1 damage?`, 'Do it'),
      go(state, s) { addStress(state, state.ships[s.ship]); const t = state.ships[s.target]; if (!t.destroyed) sufferDamage(state, t, 1, 0); },
    },
  },
  palo_godal: {
    startCombat: (state, owner) => (tokenOpts(enemiesInRange(state, owner, 1, 2)).length ? [cardStep('palo_godal', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Palo Godal: steal which token?', options: tokenOpts(enemiesInRange(state, ship, 1, 2)), then: cardStep('palo_godal', 'go', { ship: ship.id }) }); },
      go: takeToken,
    },
  },
  torvil_mux: {
    startCombat: (state, owner) => (enemiesInRange(state, owner, 1, 2).length ? [cardStep('torvil_mux', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Torvil Mux: whose pilot skill drops to 0 this phase?', options: shipOpts(enemiesInRange(state, ship, 1, 2)), then: cardStep('torvil_mux', 'go') }); },
      go(state, s) { state.skillOverride[s.choice] = 0; log(state, `${shipName(state.ships[s.choice])} is thrown off its timing (pilot skill 0).`); },
    },
  },
  grall_hunter: { defenseDice: (state, owner, a, n) => (isDefender(owner, a) && inArc(owner, attacker(state, a)) ? n + 1 : n) },
  talos_cobra: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.weapon === 'primary' && a.band === 1 ? n + 1 : n),
    defenseDice: (state, owner, a, n) => (isDefender(owner, a) && a.weapon === 'primary' && a.band === 3 ? n + 1 : n),
  },
  viktor_haal: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a);
      if (isDefender(owner, a) && !atk.destroyed && a.defenseDice.filter(d => !d.added).length !== 2) { addStress(state, atk); log(state, `${shipName(atk)} is rattled by Viktor Haal (+1 stress).`); }
      return [];
    },
  },
  captain_jostar: {
    anyDamaged(state, owner, ship) {
      if (state.attack || !enemy(owner, ship) || owner.round.jostar || owner.destroyed || state.phase === 'end') return [];
      return [cardStep('captain_jostar', 'offer', { ship: owner.id, target: ship.id })];
    },
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && owner.round.jostarTarget && target.id !== owner.round.jostarTarget ? false : ok),
    steps: {
      offer: offer('captain_jostar', (st, ship, s) => `${shipName(ship)}: attack the damaged ${shipName(st.ships[s.target])}?`, 'Attack'),
      go(state, s) {
        const ship = state.ships[s.ship]; if (state.ships[s.target].destroyed) return;
        ship.round.jostar = true; ship.round.jostarTarget = s.target;
        const done = cardStep('captain_jostar', 'done', { ship: ship.id, prev: !!ship.round.noMoreAttacks });
        push(state, { t: 'bonusAttack', ship: ship.id, reason: 'Captain Jostar: pounce on the damaged ship', after: done }, done);
      },
      done(state, s) { const r = state.ships[s.ship].round; r.jostarTarget = null; r.noMoreAttacks = s.prev; },
    },
  },
  zukas: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !isAttacker(owner, a) || !once(a, 'zukas')) return [];
      return [{ id: 'zukas', label: 'Zukas: +1 attack die (the defender also gets +1 die)', apply(st, a2) { a2.bonusDice++; a2.zukas = true; mark(a2, 'zukas'); } }];
    },
    defenseDice: (state, owner, a, n) => (isAttacker(owner, a) && a.zukas ? n + 1 : n),
  },
  unit_q7: {
    endPhase: (state, owner) => (owner.stress > 0 && nearby(state, owner).length ? [cardStep('unit_q7', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Unit Q-7: pass a stress token to which ship?', options: shipOpts(nearby(state, ship)), then: cardStep('unit_q7', 'go', { ship: ship.id }) }); },
      go(state, s) { const ship = state.ships[s.ship]; if (ship.stress < 1) return; ship.stress--; addStress(state, state.ships[s.choice]); log(state, `${shipName(ship)} passes its stress to ${shipName(state.ships[s.choice])}.`); },
    },
  },
  fennick_rowe_syn: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.band === 1 ? n + 1 : n),
    defenseDice: (state, owner, a, n) => (isDefender(owner, a) && a.band === 1 ? n + 1 : n),
  },
  kade_solus: { afterManeuver(state, ship, color) { if (color === 'r') { ship.tokens.focus += 2; log(state, `${shipName(ship)} thrives on danger (+2 focus).`); } return []; } },
  old_tereck: {
    startCombat: (state, owner) => (tereckTargets(state, owner).length ? [cardStep('old_tereck', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Old Tereck: strip which enemy’s tokens?', options: shipOpts(tereckTargets(state, ship)), then: cardStep('old_tereck', 'go') }); },
      go(state, s) { const t = state.ships[s.choice]; t.tokens.focus = 0; t.tokens.evade = 0; log(state, `${shipName(t)} loses its focus and evade tokens.`); },
    },
  },
  ungar_plott: {
    startCombat(state, owner) {
      for (const s of liveShips(state).filter(x => x.id !== owner.id && areTouching(state, owner.id, x.id))) applyTractor(state, s, owner.owner);
      return [];
    },
  },
  constable_zuvo: {
    onReveal: (state, ship) => (/^\d+(RS|RBL|RBR)$/.test(ship.round.maneuver.key) && ordnanceCards(ship).length ? [cardStep('constable_zuvo', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: drop ordnance ahead of you?`, options: ordnanceCards(ship).map(id => ({ id, label: UPGRADES[id].name })), then: cardStep('constable_zuvo', 'go', { ship: ship.id }) });
      },
      go(state, s) { const ship = state.ships[s.ship]; dropOrdnance(state, ship, UPGRADES[s.choice].ordnance, { front: true }); if (!UPGRADES[s.choice].keep) discardUpgrade(ship, s.choice); },
    },
  },
  sarko_plank: {
    defenseDice(state, owner, a, n) {
      if (!isDefender(owner, a)) return n;
      const sp = speedOf(owner), ag = stat(state, owner, 'agility');
      return sp > ag ? n + (sp - ag) : n;
    },
  },
  captain_rhone_syn: {
    ignoreBomb: (state, ship, tok) => tok.owner === ship.owner,
    afterRollForced(state, owner, a, kind) {
      const d = defender(state, a);
      if (kind !== 'defense' || d.owner !== owner.owner || !a.line || !once(a, `rhone:${owner.id}`)) return;
      if (state.ordnance.some(tok => tok.owner === owner.owner && segmentHitsPolygon(a.line.a, a.line.b, ordnancePolys(tok)))) {
        mark(a, `rhone:${owner.id}`); addDie(a.defenseDice, 'evade'); log(state, `${shipName(d)} hides behind a friendly bomb (+1 evade).`);
      }
    },
  },
  sol_sixa: {
    afterDrop: (state, ship, type) => [cardStep('sol_sixa', 'offer', { ship: ship.id, n: ORDNANCE[type].cluster || 1 })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: slide the dropped token(s)?`, options: [{ id: 'L', label: 'Rear-left' }, { id: 'R', label: 'Rear-right' }], then: cardStep('sol_sixa', 'go', { ship: ship.id, n: s.n }), skip: 'Leave it' });
      },
      go(state, s) {
        const ship = state.ships[s.ship], k = s.choice === 'L' ? -1 : 1;
        const d = add(mul(right(ship.pose.h), k * 30), mul(fwd(ship.pose.h), 15));
        for (const tok of state.ordnance.filter(t => t.by === ship.id).slice(-s.n)) { tok.x += d.x; tok.y += d.y; tok.h += k * Math.PI / 2; }
      },
    },
  },
  torin_kulda: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || owner.destroyed) return [];
      return liveShips(state).filter(e => enemy(owner, e) && inBullseye(owner, e) && inBand(owner, e, 1, 3)).map(e => cardStep('torin_kulda', 'choose', { ship: e.id }));
    },
    steps: {
      choose(state, s) {
        const e = state.ships[s.ship]; if (e.destroyed) return;
        pick(state, { player: e.owner, ship: e.id, text: `${shipName(e)} is in Torin Kulda's sights: suffer 1 damage or lose your focus and evade tokens?`,
          options: [{ id: 'damage', label: 'Suffer 1 damage' }, { id: 'tokens', label: 'Lose focus and evade tokens' }], then: cardStep('torin_kulda', 'go', { ship: e.id }), skip: false });
      },
      go(state, s) { const e = state.ships[s.ship]; if (s.choice === 'damage') sufferDamage(state, e, 1, 0); else { e.tokens.focus = 0; e.tokens.evade = 0; } },
    },
  },
  dalen_oberon_gharial: {
    startCombat: (state, owner) => (bullseyeFoes(state, owner).length ? [cardStep('dalen_oberon_gharial', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Dalen Oberon: lock onto which enemy in your bullseye?', options: shipOpts(bullseyeFoes(state, ship)), then: cardStep('dalen_oberon_gharial', 'go', { ship: ship.id }) }); },
      go(state, s) { acquireLock(state, state.ships[s.ship], state.ships[s.choice]); },
    },
  },

  // ================================================================ crew
  fire_engineer: {
    afterAction: (state, ship, action) => (action === 'lock' && ship.lockOn && enemiesInRange(state, ship, 1, 3).some(e => e.id !== ship.lockOn) ? [cardStep('fire_engineer', 'offer', { ship: ship.id })] : []),
    attackDice(state, owner, a, n) {
      if (isAttacker(owner, a) && owner.secondLock === a.defender && owner.lockOn !== a.defender) { [owner.lockOn, owner.secondLock] = [owner.secondLock, owner.lockOn]; }
      return n;
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Fire Engineer: hold a second lock on which ship?', options: shipOpts(enemiesInRange(state, ship, 1, 3).filter(e => e.id !== ship.lockOn)), then: cardStep('fire_engineer', 'go', { ship: ship.id }) });
      },
      go(state, s) { state.ships[s.ship].secondLock = s.choice; log(state, `${shipName(state.ships[s.ship])} also locks onto ${shipName(state.ships[s.choice])}.`); },
    },
  },
  informant: {
    startActivation: (state, owner) => (enemiesInRange(state, owner, 1, 2).some(e => state.dials[e.id]) ? [cardStep('informant', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Informant: whose plan do you peek at?', options: shipOpts(enemiesInRange(state, ship, 1, 2).filter(e => state.dials[e.id])), then: cardStep('informant', 'show', { ship: ship.id }) });
      },
      show(state, s) {
        const ship = state.ships[s.ship], e = state.ships[s.choice];
        pick(state, { player: ship.owner, ship: ship.id, text: `Informant: ${shipName(e)} will fly ${state.dials[e.id]}.`, options: [{ id: 'ok', label: 'Got it' }], then: cardStep('informant', 'noop'), skip: false });
      },
      noop() {},
    },
  },
  bomb_chief: { longDrop: true },
  rear_gunner: { defenseDice: (state, owner, a, n) => (isAttacker(owner, a) && a.arc === 'rear' ? n - 1 : n) },
  ace_copilot: {
    afterRollForced(state, owner, a, kind) {
      if (kind === 'defense' && isAttacker(owner, a) && a.weapon === 'primary') {
        const d = defender(state, a);
        if (d.tokens.focus > 0) { for (const x of a.defenseDice) if (x.face === 'focus') x.face = 'evade'; mark(a, 'dfocus'); spendFocus(state, d); log(state, `${shipName(d)} is forced to spend a focus token.`); }
      }
      if (kind === 'attack' && isDefender(owner, a)) {
        const k = attacker(state, a);
        if (k.tokens.focus > 0) { for (const x of a.attackDice) if (x.face === 'focus') x.face = 'hit'; mark(a, 'focus'); spendFocus(state, k); log(state, `${shipName(k)} is forced to spend a focus token.`); }
      }
    },
  },
  ops_specialist: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a);
      if (a.hit || atk.owner !== owner.owner || atk.id === owner.id || !inBand(owner, atk, 1, 2) || owner.destroyed) return [];
      return [cardStep('ops_specialist', 'offer', { ship: owner.id, attacker: atk.id })];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], atk = state.ships[s.attacker];
        const opts = liveShips(state).filter(f => f.owner === ship.owner && (f.id === atk.id || inBand(atk, f, 1, 3)));
        pick(state, { player: ship.owner, ship: ship.id, text: 'Ops Specialist: who gets a focus token?', options: shipOpts(opts), then: cardStep('ops_specialist', 'go') });
      },
      go(state, s) { state.ships[s.choice].tokens.focus++; log(state, `${shipName(state.ships[s.choice])} gets a focus token.`); },
    },
  },
  rousing_recruit: {
    anyManeuver(state, owner, ship, color) {
      if (color === 'g' && ship.owner === owner.owner && ship.id !== owner.id && ship.stress > 0 && !owner.round.rousing && inBand(owner, ship, 1, 2)) {
        owner.round.rousing = true; ship.stress--; log(state, `${shipName(ship)} is rallied (−1 more stress).`);
      }
      return [];
    },
  },
  bosh: {
    anyActivate: (state, owner, ship) => (ship.id !== owner.id && areTouching(state, owner.id, ship.id) && state.dials[ship.id] ? [cardStep('bosh', 'offer', { ship: owner.id, target: ship.id })] : []),
    steps: {
      offer: offer('bosh', (st, ship, s) => `${shipName(ship)}: Bosh — force ${shipName(st.ships[s.target])} to nudge its dial?`, 'Nudge it'),
      go(state, s) {
        const t = state.ships[s.target], dial = dialFor(t.chassis), i = dial.findIndex(m => m.key === state.dials[t.id]);
        const opts = [dial[(i + dial.length - 1) % dial.length], dial[(i + 1) % dial.length]].filter((m, k, arr) => arr.findIndex(x => x.key === m.key) === k);
        pick(state, { player: t.owner, ship: t.id, kind: 'overrideManeuver', text: `${shipName(t)}: Bosh forces you to an adjacent maneuver.`,
          options: opts.map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: maneuverColor(state, t, m) } })), then: cardStep('bosh', 'set', { target: t.id }), skip: false });
      },
      set(state, s) { const t = state.ships[s.target]; state.dials[t.id] = s.choice; t.round.redOk = true; log(state, `${shipName(t)}'s plan is nudged.`); },
    },
  },
  breach_tech: {
    onDealt(state, ship, card, faceup) {
      if (!faceup || !(ship.round.breach || ship.round.reinforce)) return undefined;
      if (!ship.round.breach) { ship.round.reinforce = null; ship.round.breach = true; }
      log(state, `${shipName(ship)}'s Breach Tech seals the breach (facedown).`);
      return keepFacedown(state, ship, card, 'breach_tech');
    },
    steps: { unDiscard },
  },
  pace_droid: { deploySkill: () => 8 },
  greel: {
    dealFaceup(state, owner) {
      if (!state.attack || state.attack.attacker !== owner.id || owner.round.greelAttacked || owner.round.greelA) return false;
      owner.round.greelA = true; return true;
    },
    takeFaceup(state, owner) {
      if (!state.attack || state.attack.defender !== owner.id || owner.round.greelDefended || owner.round.greelD) return false;
      owner.round.greelD = true; return true;
    },
    afterAttack(state, owner, a) { if (isAttacker(owner, a)) owner.round.greelAttacked = true; if (isDefender(owner, a)) owner.round.greelDefended = true; return []; },
  },
  backalley_mechanic: { afterManeuver(state, ship, color) { if (color === 'r') { ship.tokens.focus++; log(state, `${shipName(ship)}'s mechanic keeps things running (+1 focus).`); } return []; } },
  sentry_droid: { afterManeuver: (state, ship, color) => (color === 'g' ? [{ t: 'lockPrompt', ship: ship.id }] : []) },
  brosk: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.hit || owner.destroyed) return [];
      if (owner.stress === 0) addStress(state, owner);
      owner.tokens.focus++;
      const d = defender(state, a); if (!d.destroyed) acquireLock(state, owner, d);
      return [];
    },
  },
  zukas_crew: {
    options(state, owner, a, stage) {
      if (stage !== 'atkOnDefense' || !isAttacker(owner, a) || owner.stress > 0 || !once(a, 'zukas_crew')) return [];
      const n = a.defenseDice.filter(d => d.face === 'evade' && !d.noReroll && !d.rerolled).length;
      return Array.from({ length: n }, (_, i) => i + 1).map(k => ({ id: `zukas_crew:${k}`, label: `Zukas: take ${k} stress, defender rerolls ${k} evade${k > 1 ? 's' : ''}`, apply(st, a2) {
        rerollFaces(st, a2.defenseDice, 'defense', ['evade'], k); addStress(st, st.ships[owner.id], k); mark(a2, 'zukas_crew');
      } }));
    },
  },
  unit_q7_crew: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'attack' || !isAttacker(owner, a) || a.parked || !once(a, 'q7')) return [];
      return ['evade', 'focus'].filter(k => d.tokens[k] > 0).map(k => ({ id: `q7:${k}`, label: `Unit Q-7: take 1 ion, pin the defender's ${k} token`, apply(st, a2) {
        const me = st.ships[owner.id], t = st.ships[a2.defender];
        me.ion = (me.ion || 0) + 1; t.tokens[k]--; a2.parked = { ship: t.id, k }; mark(a2, 'q7');
      } }));
    },
    afterAttack(state, owner, a) { if (isAttacker(owner, a) && a.parked) { const t = state.ships[a.parked.ship]; if (!t.destroyed) t.tokens[a.parked.k]++; } return []; },
  },
  rook_varga: {
    afterAttack(state, owner, a) {
      const d = defender(state, a);
      if (!isAttacker(owner, a) || d.destroyed || !d.damage.some(c => a.dealt.includes(c.uid) && c.faceup) || !d.upgrades.some(u => !u.discarded)) return [];
      return [cardStep('rook_varga', 'offer', { ship: owner.id, target: d.id })];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], d = state.ships[s.target];
        pick(state, { player: ship.owner, ship: ship.id, text: `Rook Varga: discard this card to strip which of ${shipName(d)}'s upgrades?`, options: d.upgrades.filter(u => !u.discarded).map(u => ({ id: u.id, label: UPGRADES[u.id].name })), then: cardStep('rook_varga', 'go', s) });
      },
      go(state, s) { discardUpgrade(state.ships[s.ship], 'rook_varga'); discardUpgrade(state.ships[s.target], s.choice); log(state, `${shipName(state.ships[s.target])} loses ${UPGRADES[s.choice].name}.`); },
    },
  },
  plodder: {
    actions: {
      plodder: { label: '“Plodder”: store a shield token on the card', can: () => true, perform(state, ship) { ship.plodder = (ship.plodder || 0) + 1; log(state, `${shipName(ship)}'s droid stores a shield charge (${ship.plodder}).`); } },
      plodder_use: { label: '“Plodder”: recover a stored shield', can: (state, ship) => ship.plodder > 0 && ship.shields < maxShields(state, ship),
        perform(state, ship) { ship.plodder--; ship.shields++; log(state, `${shipName(ship)} recovers a shield from its droid.`); } },
    },
  },
  dennick: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)
      ? rerollOptions(a, 'dennick', 'Dennick', 'attack', ['blank', 'focus'], PILOTS[defender(state, a).pilot].unique ? 2 : 1) : []),
  },
  latta_rizz: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'defense' || !isDefender(owner, a) || atk.stress < 1 || !once(a, 'latta')) return [];
      return [{ id: 'latta', label: 'Latta Rizz: remove 1 attacker stress, add an evade', apply(st, a2) { st.ships[a2.attacker].stress--; addDie(a2.defenseDice, 'evade'); mark(a2, 'latta'); } }];
    },
  },
  kessa_onyx: {
    endPhase: (state, owner) => (kessaTargets(state, owner).length ? [cardStep('kessa_onyx', 'offer', { ship: owner.id })] : []),
    startActivation(state, owner) { for (const s of liveShips(state)) if (s.keepTractor && s.keepTractorBy === owner.id) { s.tractor = s.keepTractor; s.keepTractor = 0; } return []; },
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Kessa Onyx: which enemy stays tractored?', options: shipOpts(kessaTargets(state, ship)), then: cardStep('kessa_onyx', 'go', { ship: ship.id }) }); },
      go(state, s) { const t = state.ships[s.choice]; t.keepTractor = t.tractor; t.keepTractorBy = s.ship; log(state, `${shipName(t)} stays caught in the tractor beam.`); },
    },
  },
  ungar_crew: {
    afterManeuver: (state, ship, color, info) => (info.bumped && liveShips(state).some(e => enemy(ship, e) && areTouching(state, ship.id, e.id)) ? [cardStep('ungar_crew', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('ungar_crew', (st, ship) => `${shipName(ship)}: suffer 1 damage for a free action?`, 'Do it'),
      go(state, s) { const ship = state.ships[s.ship]; sufferDamage(state, ship, 1, 0); if (!ship.destroyed) push(state, freeAction(ship, 'Ungar Plott: free action')); },
    },
  },
  fixer_vizz: {
    endPhase: (state, owner) => (owner.upgrades.some(u => !u.discarded && UPGRADES[u.id].slot === 'illicit') ? [cardStep('fixer_vizz', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: 'Fixer Vizz: discard to swap which Illicit card?', options: ship.upgrades.filter(u => !u.discarded && UPGRADES[u.id].slot === 'illicit').map(u => ({ id: u.id, label: UPGRADES[u.id].name })), then: cardStep('fixer_vizz', 'swap', { ship: ship.id }) });
      },
      swap(state, s) {
        const ship = state.ships[s.ship], have = ship.upgrades.map(u => u.id);
        const opts = Object.values(UPGRADES).filter(u => u.slot === 'illicit' && u.cost <= UPGRADES[s.choice].cost && !have.includes(u.id) && upgradeAllowed(ship.pilot, u.id, have.filter(x => x !== s.choice)));
        if (!opts.length) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `Swap ${UPGRADES[s.choice].name} for…`, options: opts.map(u => ({ id: u.id, label: `${u.name} (${u.cost})` })), then: cardStep('fixer_vizz', 'go', { ship: ship.id, old: s.choice }) });
      },
      go(state, s) {
        const ship = state.ships[s.ship], u = ship.upgrades.find(x => x.id === s.old && !x.discarded); if (!u) return;
        u.id = s.choice; discardUpgrade(ship, 'fixer_vizz');
        log(state, `${shipName(ship)} trades ${UPGRADES[s.old].name} for ${UPGRADES[s.choice].name}.`);
      },
    },
  },
  matriarch: {
    afterAttack: (state, owner) => matriarchRestore(state, owner),
    anyAction: (state, owner) => matriarchRestore(state, owner),
    anyManeuver: (state, owner) => matriarchRestore(state, owner),
    startCombat: (state, owner) => matriarchRestore(state, owner),
    endPhase: (state, owner) => matriarchRestore(state, owner),
  },
  silas_bane: {
    bombRoll(state, owner, victim, tok, faces) {
      if (!tok || tok.owner !== owner.owner || !enemy(owner, victim) || owner.round.silas || !faces.some(f => f === 'blank' || f === 'focus')) return faces;
      owner.round.silas = true;
      log(state, `Silas Bane makes ${shipName(victim)} reroll its misses.`);
      return faces.map(f => (f === 'blank' || f === 'focus' ? rollFace(state, 'attack') : f));
    },
  },
  darrok: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.stress > 0 || !attackRerollAllowed(state, a) || !once(a, 'darrok')) return [];
      const n = a.attackDice.filter(d => (d.face === 'blank' || d.face === 'focus') && !d.rerolled && !d.noReroll).length;
      return Array.from({ length: n }, (_, i) => i + 1).map(k => ({ id: `darrok:${k}`, label: `Darrok: take ${k} stress, reroll ${k} di${k > 1 ? 'ce' : 'e'}`, apply(st, a2) {
        rerollFaces(st, a2.attackDice, 'attack', ['blank', 'focus'], k); addStress(st, st.ships[owner.id], k); mark(a2, 'darrok');
      } }));
    },
    afterAttack(state, owner, a) { if (isAttacker(owner, a) && a.hit && owner.stress > 0) { owner.stress--; log(state, `${shipName(owner)} savours the hit (−1 stress).`); } return []; },
  },

  // ================================================================ illicit
  brake_thrusters: {
    onReveal: (state, ship) => [cardStep('brake_thrusters', 'offer', { ship: ship.id })],
    steps: {
      offer: offer('brake_thrusters', (st, ship) => `${shipName(ship)}: discard Brake Thrusters to stop dead (white 0, +1 stress)?`, 'Full stop'),
      go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, 'brake_thrusters'); ship.round.maneuver = { key: '0ST', color: 'w' }; ship.round.revealed = '0ST'; addStress(state, ship); log(state, `${shipName(ship)} slams on the brakes.`); },
    },
  },
  spite_charge: {
    onDestroyed(state, ship) { const around = nearby(state, ship).map(s => s.id); return around.length ? [{ t: 'splashDamage', ships: around, why: 'Spite Charge' }] : []; },
  },
  feedback_coil: {
    combatActive: insteadOfAttacking('feedback_coil', (state, owner) => enemiesInRange(state, owner, 1, 1).length > 0),
    steps: {
      offer: offer('feedback_coil', (st, ship) => `${shipName(ship)}: skip your attack to overload the Feedback Coil (+1 ion, 1 damage to you and an enemy at Range 1)?`, 'Overload'),
      go(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Feedback Coil: which enemy?', options: shipOpts(enemiesInRange(state, ship, 1, 1)), then: cardStep('feedback_coil', 'zap', { ship: ship.id }), skip: false });
      },
      zap(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.choice];
        ship.round.attacked = true; ship.ion = (ship.ion || 0) + 1;
        sufferDamage(state, ship, 1, 0); if (!t.destroyed) sufferDamage(state, t, 1, 0);
        log(state, `${shipName(ship)} discharges into ${shipName(t)}.`);
      },
    },
  },
  snap_blaster: { weapon: {} },
  sparkdust: {
    startCombat: (state, owner) => [cardStep('sparkdust', 'offer', { ship: owner.id })],
    steps: {
      offer: offer('sparkdust', (st, ship) => `${shipName(ship)}: use Sparkdust (+1 stress; focus results become hits/evades this round)?`, 'Use it'),
      go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, 'sparkdust'); addStress(state, ship); ship.round.sparkdust = true; log(state, `${shipName(ship)}'s pilot sees everything in slow motion.`); },
    },
    options(state, owner, a, stage) {
      if (!owner.round.sparkdust) return [];
      if (stage === 'attack' && isAttacker(owner, a)) return changeOption(a, 'spark', 'Sparkdust', 'attack', 'focus', 'hit', Infinity);
      if (stage === 'defense' && isDefender(owner, a)) return changeOption(a, 'spark', 'Sparkdust', 'defense', 'focus', 'evade', Infinity);
      return [];
    },
  },
  stolen_cloak: {
    actions: { stolen_cloak: { label: 'Stolen Cloak: cloak', can: (state, ship) => !ship.cloaked, perform(state, ship) { ship.cloaked = true; emit(state, { type: 'cloak', ship: ship.id }); log(state, `${shipName(ship)} vanishes behind a stolen cloak.`); } } },
    endPhase(state, owner) {
      const f = roll1(state, owner, 'Stolen Cloak');
      if (f === 'focus') { discardUpgrade(owner, 'stolen_cloak'); if (owner.cloaked) { owner.cloaked = false; emit(state, { type: 'decloak', ship: owner.id }); } log(state, `${shipName(owner)}'s stolen cloak burns out.`); }
      return [];
    },
  },
  slicer_kit: {
    actions: { slicer_kit: {
      label: 'Slicer Kit: hack a stressed enemy', can: (state, ship) => enemiesInRange(state, ship, 1, 2).some(e => e.stress > 0),
      perform(state, ship) { pick(state, { player: ship.owner, ship: ship.id, text: 'Slicer Kit: hack which enemy?', options: shipOpts(enemiesInRange(state, ship, 1, 2).filter(e => e.stress > 0)), then: cardStep('slicer_kit', 'go', { ship: ship.id }), skip: false }); },
    } },
    steps: {
      go(state, s) {
        const t = state.ships[s.choice], f = roll1(state, state.ships[s.ship], 'Slicer Kit');
        if (f === 'hit' || f === 'crit') { t.stress = Math.max(0, t.stress - 1); dealDamageCard(state, t, false); log(state, `${shipName(t)}'s systems are sliced.`); }
      },
    },
  },
  ion_pulse_rig: {
    combatActive: insteadOfAttacking('ion_pulse_rig', (state, owner) => nearby(state, owner).length > 0),
    steps: {
      offer: offer('ion_pulse_rig', (st, ship) => `${shipName(ship)}: skip your attack to fire the Ion Pulse Rig (2 ion tokens to every ship at Range 1)?`, 'Pulse'),
      go(state, s) {
        const ship = state.ships[s.ship];
        discardUpgrade(ship, 'ion_pulse_rig'); ship.round.attacked = true;
        for (const t of nearby(state, ship)) t.ion = (t.ion || 0) + 2;
        log(state, `${shipName(ship)} releases an ion pulse!`);
      },
    },
  },
  salvage_claw: {
    anyDestroyed(state, owner, ship) {
      if (owner.destroyed || !ship.pose || !inBand(owner, ship, 1, 2)) return [];
      return clawable(owner).length ? [cardStep('salvage_claw', 'offer', { ship: owner.id })] : [];
    },
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Salvage Claw: restore which card?', options: clawable(ship).map(u => ({ id: u.id, label: UPGRADES[u.id].name })), then: cardStep('salvage_claw', 'go', { ship: ship.id }) }); },
      go(state, s) {
        const ship = state.ships[s.ship], u = ship.upgrades.find(x => x.id === s.choice && x.discarded); if (u) u.discarded = false;
        const f = roll1(state, ship, 'Salvage Claw');
        log(state, `${shipName(ship)} salvages ${UPGRADES[s.choice].name}${f === 'blank' ? ', but the claw breaks' : ''}.`);
        if (f === 'blank') discardUpgrade(ship, 'salvage_claw');
      },
    },
  },
  ion_vents: { endPhase(state, owner) { if (owner.ion > 0 && enemiesInRange(state, owner, 1, 1).length) { owner.ion--; log(state, `${shipName(owner)} vents an ion charge.`); } return []; } },
  blackmarket_implants: {
    beforeReveal: (state, ship) => (ship.stress > 0 ? [cardStep('blackmarket_implants', 'offer', { ship: ship.id })] : []),
    actWhileStressed: (state, ship) => !!ship.round.implants,
    redWhileStressed: (state, ship) => !!ship.round.implants,
    steps: {
      offer: offer('blackmarket_implants', (st, ship) => `${shipName(ship)}: burn the implants (+1 stress; act and fly red while stressed this round)?`, 'Burn them'),
      go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, 'blackmarket_implants'); addStress(state, ship); ship.round.implants = true; },
    },
  },

  // ================================================================ salvaged drones
  rattled_droid: { maneuverColor: (state, ship, m, c) => (m.speed === 3 ? 'g' : c) },
  wizard_droid: {
    afterManeuver: (state, ship, color, info) => (!info.bumped && timedBombs(ship).length ? [cardStep('wizard_droid', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: '“Wizard”: drop which bomb now?', options: timedBombs(ship).map(id => ({ id, label: UPGRADES[id].name })), then: cardStep('wizard_droid', 'go', { ship: ship.id }) }); },
      go(state, s) { const ship = state.ships[s.ship]; dropOrdnance(state, ship, UPGRADES[s.choice].ordnance); discardUpgrade(ship, s.choice); },
    },
  },
  junk_drone: {
    onDealt(state, ship, card, faceup, def) {
      if (!faceup || def.trait !== 'ship') return undefined;
      discardUpgrade(ship, 'junk_drone'); log(state, `${shipName(ship)}'s Junk Drone patches ${def.name}.`);
      return 'discard';
    },
  },
  farm_drone: {
    onSpendFocus(state, ship) {
      const a = state.attack;
      if (a && a.attacker === ship.id && ship.lockOn !== a.defender) acquireLock(state, ship, state.ships[a.defender]);
      return [];
    },
  },
  wrangler_drone: {
    options(state, owner, a, stage) {
      if (stage !== 'atkOnDefense' || !isAttacker(owner, a) || owner.lockOn !== a.defender || !once(a, 'wrangler')) return [];
      return rerollOptions(a, 'wrangler', 'Wrangler Drone (spend lock): defender rerolls', 'defense', ['evade', 'focus'], Infinity)
        .map(o => ({ ...o, apply(st, a2) { o.apply(st, a2); spendLock(st, st.ships[owner.id]); } }));
    },
  },
  spiteful_drone: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a);
      if (!isDefender(owner, a) || owner.round.spite || owner.destroyed || atk.destroyed) return [];
      owner.round.spite = true;
      const f = roll1(state, owner, 'Spiteful Drone');
      if (f === 'hit') sufferDamage(state, atk, 1, 0);
      if (f === 'crit') { sufferDamage(state, atk, 1, 0); sufferDamage(state, owner, 1, 0); }
      return [];
    },
  },
  overclocked_drone: {
    onSpendFocus: (state, ship) => (state.phase === 'combat' ? [cardStep('overclocked_drone', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('overclocked_drone', (st, ship) => `${shipName(ship)}: take 1 stress to regain a focus token?`, 'Overclock'),
      go(state, s) { const ship = state.ships[s.ship]; addStress(state, ship); ship.tokens.focus++; },
    },
  },
  loader_drone: {
    stressedAction: (state, ship, id) => ['torpedo', 'bomb'].includes(UPGRADES[id]?.slot),
    afterAction: (state, ship, action) => (ship.stress > 0 && ['torpedo', 'bomb'].includes(UPGRADES[action]?.slot) ? [cardStep('loader_drone', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('loader_drone', (st, ship) => `${shipName(ship)}: discard Loader Drone to remove 1 stress?`, 'Discard'),
      go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, 'loader_drone'); if (ship.stress > 0) ship.stress--; },
    },
  },
  rogue_drone: { lockTargets: (state, ship, list) => [...list, ...friendsInRange(state, ship, 1, 3).filter(f => !list.includes(f))] },

  // ================================================================ modifications
  targeting_pod: { actionBar: (state, ship, list) => (list.includes('lock') ? list : [...list, 'lock']) },
  armor_plating: { stat: (state, ship, which, v) => (which === 'hull' ? v + 1 : v) },
  shroud_accelerator: {
    afterAction: (state, ship, action) => (action === 'cloak' || action === 'stolen_cloak' ? [freeAction(ship, 'Shroud Accelerator: free evade', { only: ['evade'], grant: ['evade'] })] : []),
    afterDecloak: (state, ship) => [freeAction(ship, 'Shroud Accelerator: free evade', { only: ['evade'], grant: ['evade'] })],
  },
  jury_interface: {
    afterAction(state, ship, action) {
      if (ship.round.jury || ship.stress > 0) return [];
      const ids = upgradeActionIds(ship).filter(id => id !== action);
      if (!ids.length) return [];
      ship.round.jury = true;
      return [freeAction(ship, 'Jury-rigged Interface: free upgrade action (then +1 stress)', { only: ids, stressAfter: true })];
    },
  },
  jink_thrusters: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'defense' || !isDefender(owner, a) || (inArc(atk, owner) && a.band < 3)) return [];
      return changeOption(a, 'jink', 'Jink Thrusters', 'defense', 'blank', 'evade', 1);
    },
  },
  slam_booster: {
    afterManeuver(state, ship, color, info) {
      if (!ship.round.actionsUsed.includes('slam') || info.blocked || ship.round.slamBoost) return [];
      ship.round.slamBoost = true;
      return [freeAction(ship, 'SLAM Booster: free action', { only: actionBar(state, ship) })];
    },
  },
  far_scanners: {
    lockTargets: (state, ship, list) => liveShips(state).filter(o => o.owner !== ship.owner && (b => !b || b >= 3)(band(ship, o))),
  },
  seeker_chips: {
    options(state, owner, a, stage) {
      const slot = UPGRADES[a.weapon]?.slot;
      if (stage !== 'attack' || !isAttacker(owner, a) || (slot !== 'torpedo' && slot !== 'missile') || owner.round.chips) return [];
      const to = stat(state, owner, 'attack') >= 3 ? 'crit' : 'hit';
      const from = ['blank', 'focus', 'hit'].find(f => f !== to && a.attackDice.some(d => d.face === f));
      if (!from) return [];
      return [{ id: 'chips', label: `Seeker Chips: 1 ${from} → ${to}`, apply(st, a2) { a2.attackDice.find(d => d.face === from).face = to; st.ships[owner.id].round.chips = true; } }];
    },
  },
  vector_thrusters: { actionBar: (state, ship, list) => (list.includes('roll') ? list : [...list, 'roll']) },
  pulse_shield: {
    endPhase: (state, owner) => (owner.shields < maxShields(state, owner) ? [cardStep('pulse_shield', 'offer', { ship: owner.id })] : []),
    steps: {
      offer: offer('pulse_shield', (st, ship) => `${shipName(ship)}: take 1 ion token to recover a shield?`, 'Recharge'),
      go(state, s) { const ship = state.ships[s.ship]; ship.ion = (ship.ion || 0) + 1; ship.shields++; },
    },
  },
  chameleon_skin: {
    onLocked(state, ship, by) {
      if (liveShips(state).filter(e => enemy(ship, e) && e.lockOn === ship.id).length !== 1) return [];
      const f = roll1(state, ship, 'Chameleon Skin', 'defense');
      if (f === 'evade') { by.lockOn = null; log(state, `${shipName(ship)} shimmers out of ${shipName(by)}'s lock.`); }
      return [];
    },
  },

  // ================================================================ elite & cannon
  shield_wing: {
    startCombat: (state, owner) => (owner.tokens.focus > 0 && wingTargets(state, owner).length ? [cardStep('shield_wing', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; pick(state, { player: ship.owner, ship: ship.id, text: 'Shield Wing: spend focus to cover which wingmate (+1 agility)?', options: shipOpts(wingTargets(state, ship)), then: cardStep('shield_wing', 'go', { ship: ship.id }) }); },
      go(state, s) { const ship = state.ships[s.ship]; if (ship.tokens.focus < 1) return; spendFocus(state, ship); state.ships[s.choice].round.agilityBonus += 1; log(state, `${shipName(ship)} covers ${shipName(state.ships[s.choice])}.`); },
    },
  },
  mind_link: {
    onStress(state, ship) { for (const f of linked(state, ship)) if (f.stress === 0) addStress(state, f); return []; },
    afterAction(state, ship, action) { if (action === 'focus') for (const f of linked(state, ship)) if (f.tokens.focus === 0) f.tokens.focus++; return []; },
  },
  undaunted: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'attack' || !isAttacker(owner, a) || a.band !== 1 || !inArc(owner, d) || !inArc(d, owner) || !once(a, 'undaunted')) return [];
      return [{ id: 'undaunted', label: 'Undaunted: add a hit result', apply(st, a2) { addDie(a2.attackDice, 'hit'); mark(a2, 'undaunted'); } }];
    },
  },
  arc_lancer: {
    weapon: {
      afterAttack(state, a) {
        const atk = attacker(state, a); atk.arcLancer = 'recharging';
        const d = defender(state, a);
        const near = liveShips(state).filter(s => s.id !== d.id && s.id !== atk.id && band(d, s) === 1);
        return a.hit && near.length ? [cardStep('arc_lancer', 'arc', { ship: atk.id, target: d.id })] : [];
      },
    },
    weaponRange: (state, ship, w, rng) => (w === UPGRADES.arc_lancer.weapon && ship.arcLancer === 'recharging' ? [9, 9] : rng),
    startCombat: (state, owner) => (owner.arcLancer === 'recharging' && !owner.disarmed ? [cardStep('arc_lancer', 'offer', { ship: owner.id })] : []),
    steps: {
      arc(state, s) {
        const ship = state.ships[s.ship], d = state.ships[s.target];
        const near = liveShips(state).filter(x => x.id !== d.id && x.id !== ship.id && band(d, x) === 1);
        pick(state, { player: ship.owner, ship: ship.id, text: 'Arc Lancer: the arc jumps to which ship?', options: shipOpts(near), then: cardStep('arc_lancer', 'zap'), skip: false });
      },
      zap(state, s) { sufferDamage(state, state.ships[s.choice], 1, 0); },
      offer: offer('arc_lancer', (st, ship) => `${shipName(ship)}: disable your weapons this round to recharge the Arc Lancer?`, 'Recharge'),
      go(state, s) { const ship = state.ships[s.ship]; ship.disarmed = true; ship.arcLancer = 'ready'; log(state, `${shipName(ship)} recharges its Arc Lancer.`); },
    },
  },

  // ================================================================ titles & modifications for Syndicate ships
  heavy_gnat: { stat: (state, ship, which, v) => (which === 'hull' ? v + 1 : v) },
  fog_stalker: { actionBar: (state, ship, list) => (list.includes('roll') ? list : [...list, 'roll']) },
  dawnguard_shield: {
    afterRollForced(state, owner, a, kind) {
      const atk = attacker(state, a);
      if (kind === 'defense' && isDefender(owner, a) && a.band === 1 && inArc(atk, owner) && inArc(owner, atk)) { addDie(a.defenseDice, 'evade'); log(state, `${shipName(owner)}'s guard holds (+1 evade).`); }
    },
  },
  tug_beam: {
    actions: { tug_beam: {
      label: 'Tug Beam Array: tractor a ship at Range 1 in your arc', can: (state, ship) => tugTargets(state, ship).length > 0,
      perform(state, ship) { pick(state, { player: ship.owner, ship: ship.id, text: 'Tug Beam: which ship?', options: shipOpts(tugTargets(state, ship)), then: cardStep('tug_beam', 'go', { ship: ship.id }), skip: false }); },
    } },
    steps: { go(state, s) { applyTractor(state, state.ships[s.choice], state.ships[s.ship].owner); } },
  },
  light_gnat: {
    takeFaceup: true,
    maneuverColor: (state, ship, m, c) => (m.bearing === 'BL' || m.bearing === 'BR' ? 'g' : c),
  },
  adder_mk2: {
    denyTokens: (state, owner, ship, ctx, a, v) => v || (ship.id === owner.id && ctx === 'action:roll'),
    actions: { adder_mk2: {
      label: 'Barrel roll (angled, Adder Mk. II)',
      can: (state, ship) => actionBar(state, ship).includes('roll') && !ship.round.actionsUsed.includes('roll') && angledRolls(state, ship).length > 0,
      perform(state, ship) {
        ship.round.actionsUsed.push('roll');
        pick(state, { player: ship.owner, ship: ship.id, kind: 'rollPosition', text: 'Angled barrel roll: where?', options: angledRolls(state, ship).map(r => ({ id: r.id, label: `${r.side} · ${r.label}`, pose: r.pose })), then: cardStep('adder_mk2', 'roll', { ship: ship.id }), skip: false });
      },
    } },
    steps: {
      roll(state, s) {
        const ship = state.ships[s.ship], r = angledRolls(state, ship).find(x => x.id === s.choice); if (!r) return;
        const from = ship.pose; ship.pose = r.pose;
        state.touches = state.touches.filter(([x, y]) => x !== ship.id && y !== ship.id);
        emit(state, { type: 'move', ship: ship.id, path: [from, r.pose] });
        log(state, `${shipName(ship)} barrel rolls ${r.side}.`);
        checkMines(state, ship);
      },
    },
  },
  collector: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a);
      if (isDefender(owner, a) && !atk.destroyed && !owner.destroyed && inBullseye(owner, atk)) { addStress(state, atk); log(state, `${shipName(atk)} is caught in the Collector's sights (+1 stress).`); }
      return [];
    },
  },
  mayhem: {}, gilded_raptor: {}, venom: {},

  // ================================================================ conditions (display markers for Tweek)
  mimicked: {}, shadowed: {},
};

function tokenOpts(ships) {
  return ships.flatMap(s => ['focus', 'evade'].filter(k => s.tokens[k] > 0).map(k => ({ id: `${s.id}:${k}`, label: `${shipName(s)}: ${k} token` })));
}
function takeToken(state, s) {
  const [sid, k] = s.choice.split(':'); const from = state.ships[sid], me = state.ships[s.ship];
  if (from.tokens[k] > 0) { from.tokens[k]--; me.tokens[k]++; log(state, `${shipName(me)} takes a ${k} token from ${shipName(from)}.`); }
}
const tereckTargets = (state, ship) => enemiesInRange(state, ship, 1, 1).filter(e => inArc(e, ship) && (e.tokens.focus || e.tokens.evade));
const bullseyeFoes = (state, ship) => liveShips(state).filter(e => enemy(ship, e) && inBullseye(ship, e) && inBand(ship, e, 1, 3) && ship.lockOn !== e.id);
const kessaTargets = (state, ship) => enemiesInRange(state, ship, 1, 2).filter(e => inArc(ship, e) && e.tractor > 0);
const clawable = ship => ship.upgrades.filter(u => u.discarded && (['torpedo', 'missile', 'bomb', 'cannon', 'turret', 'mod'].includes(UPGRADES[u.id].slot)));
const wingTargets = (state, ship) => friendsInRange(state, ship, 1, 1).filter(f => effectiveSkill(state, f) > effectiveSkill(state, ship));
const linked = (state, ship) => liveShips(state).filter(f => f.id !== ship.id && f.owner === ship.owner && activeUpgrades(f).includes('mind_link'));
const tugTargets = (state, ship) => liveShips(state).filter(o => o.id !== ship.id && band(ship, o) === 1 && inFrontArc(ship, o));
