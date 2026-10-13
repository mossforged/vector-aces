// Card behaviour for the "dominion" batch (pilot abilities, upgrades, conditions owned by that batch —
// see docs/WORKSTREAMS.md → A). One entry per card id; hook reference: src/engine/hooks.js.
// Shared helpers: src/engine/effects.js (dice options, tokens, tractor), engine/ordnance.js (bombs).
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollFace, rollDice, count } from '../dice.js';
import { sufferDamage, dealDamageCard, resolveFaceup } from '../damage.js';
import { DAMAGE_CARDS } from '../../data/damageDeck.js';
import { dialFor } from '../../data/ships.js';
import { UPGRADES } from '../../data/upgrades.js';
import { ORDNANCE } from '../../data/ordnance.js';
import { CONFIG } from '../../data/config.js';
import { randInt, shuffle } from '../rng.js';
import { barrelRollPoses, buildPath } from '../maneuvers.js';
import { checkMines, dropOrdnance } from '../ordnance.js';
import {
  basePolygon, polygonInsideBoard, polygonsIntersect, closestPoints, bandFor, clipPolygon, arcPolygon, add, mul, fwd,
} from '../geometry.js';
import {
  shipName, inArc, rangeBetween, friendsInRange, enemiesInRange, liveShips, stat, maneuverColor, obstaclePolys, shipPoly,
  actionBar, activeUpgrades, chassis, overlapsAnyShip, areTouching, hasFlag,
} from '../queries.js';
import {
  attacker, defender, once, mark, rerollOptions, changeOption, freeAction, acquireLock, attackRerollAllowed,
  addStress, spendFocus, spendLock,
} from '../effects.js';
import { CARDS } from './index.js';

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
const condition = (ship, id) => (ship.conditions || []).find(c => c.id === id);
const dropCondition = (ship, id) => { ship.conditions = (ship.conditions || []).filter(c => c.id !== id); };
const enemy = (owner, s) => s.owner !== owner.owner;
const inRearArc = (a, b) => clipPolygon(shipPoly(b), arcPolygon({ ...a.pose, h: a.pose.h + Math.PI })).length >= 3;
const firstRound = state => state.round === 1;

const offer = (card, text, label) => (state, s) => {
  const ship = state.ships[s.ship]; if (!ship || ship.destroyed) return;
  const { t, ...data } = s;
  pick(state, { player: ship.owner, ship: ship.id, text: text(state, ship, s), options: yesNo(label), then: cardStep(card, 'go', data) });
};

/** Prompt to change this round's revealed maneuver; `color` (optional) forces the new colour. */
function switchManeuver(state, ship, card, alts, text, extra = {}) {
  const cur = ship.round.maneuver;
  pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text,
    options: alts.map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: extra.color || m.color } })),
    then: cardStep(card, 'switch', { ship: ship.id, ...extra }), skip: `Keep ${cur.key}` });
}
function applySwitch(state, s) {
  const ship = state.ships[s.ship];
  const onDial = dialFor(ship.chassis).find(x => x.key === s.choice);
  ship.round.maneuver = { key: s.choice, color: s.color || (onDial ? maneuverColor(state, ship, onDial) : ship.round.maneuver.color) };
  ship.round.revealed = s.choice;
  log(state, `${shipName(ship)} switches to ${s.choice}.`);
}
/** Same-bearing maneuver at another speed, flown with the current colour (may be off the dial). */
const offDial = (ship, speed, bearing) => ({ key: `${speed}${bearing}`, speed, bearing, color: ship.round.maneuver.color });

// ---------------- custom repositions (angled / long barrel rolls) ----------------
function clearPose(state, ship, pose) {
  const poly = basePolygon(pose, chassis(ship).size);
  const rocks = hasFlag(state, ship, 'phaseRocks') ? [] : obstaclePolys(state);
  return polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id) && !rocks.some(o => polygonsIntersect(poly, o));
}
const shifted = (poses, d) => poses.flatMap(r => [-1, 1].map(k => ({ ...r, id: `${r.id}${k < 0 ? 'b' : 'f'}`, label: `${r.label}, angled ${k < 0 ? 'back' : 'forward'}`, pose: { ...r.pose, ...add(r.pose, mul(fwd(r.pose.h), k * d)) } })));
const rollVariants = {
  corvo: (state, ship) => shifted(barrelRollPoses(ship.pose, chassis(ship).size).filter(r => r.label === 'centre'), 20).filter(r => clearPose(state, ship, r.pose)),
  kappa: (state, ship) => barrelRollPoses(ship.pose, chassis(ship).size, 2).filter(r => clearPose(state, ship, r.pose)),
};
function customRoll(card, variant, label, stress) {
  return {
    actions: {
      [card]: {
        label,
        can: (state, ship) => actionBar(state, ship).includes('roll') && !ship.round.actionsUsed.includes('roll') && rollVariants[variant](state, ship).length > 0,
        perform(state, ship) {
          ship.round.actionsUsed.push('roll');
          const opts = rollVariants[variant](state, ship).map(r => ({ id: r.id, label: `${r.side} · ${r.label}`, pose: r.pose }));
          pick(state, { player: ship.owner, ship: ship.id, kind: 'rollPosition', text: `${label}: where?`, options: opts, then: cardStep(card, 'roll', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: {
      roll(state, s) {
        const ship = state.ships[s.ship];
        const r = rollVariants[variant](state, ship).find(x => x.id === s.choice); if (!r) return;
        const from = ship.pose; ship.pose = r.pose;
        state.touches = state.touches.filter(([x, y]) => x !== ship.id && y !== ship.id);
        emit(state, { type: 'move', ship: ship.id, path: [from, r.pose] });
        log(state, `${shipName(ship)} barrel rolls ${r.side}.`);
        if (stress) addStress(state, ship);
        checkMines(state, ship);
      },
    },
  };
}

// ---------------- conditions handed out by cards ----------------
const PILOT_CARD_PREF = ['blinded', 'head_wound', 'smoke_cockpit', 'dazed'];
function assignDarkMark(state, target, from) {
  if (target.destroyed || liveShips(state).some(s => condition(s, 'dark_mark'))) return;
  const pool = state.damageDeck;
  const want = [...PILOT_CARD_PREF, ...Object.keys(DAMAGE_CARDS).filter(k => DAMAGE_CARDS[k].trait === 'pilot')].find(k => DAMAGE_CARDS[k]?.trait === 'pilot' && pool.includes(k));
  if (!want) return;
  pool.splice(pool.indexOf(want), 1);
  state.damageDeck = shuffle(state, pool);
  target.conditions.push({ id: 'dark_mark', from, card: want });
  log(state, `${shipName(target)} is marked: ${DAMAGE_CARDS[want].name} awaits its next critical hit.`);
}
/** Shield-loss watcher used by abilities that react to losing a shield during an attack. */
const shieldWatch = key => (state, owner, a, n) => { if (isDefender(owner, a)) owner.round[key] = owner.shields; return n; };
const lostShield = (owner, key) => owner.round[key] !== undefined && owner.shields < owner.round[key];
/** One-off "at the start of the game" choices, made at the start of the first Activation phase. */
const atStart = (card, fn) => (state, owner) => (firstRound(state) && !owner[`started_${card}`] ? ((owner[`started_${card}`] = true), fn(state, owner)) : []);

// ---------------- Momentum / Tovar Brisk helpers ----------------
function restoreElite(state, ship) {
  if (ship.round.tovar) return [];
  const u = ship.upgrades.find(x => x.discarded && UPGRADES[x.id].slot === 'elite');
  if (u) { u.discarded = false; ship.round.tovar = true; log(state, `${shipName(ship)} restores ${UPGRADES[u.id].name}.`); }
  return [];
}
const mineIds = ship => ship.upgrades.filter(u => !u.discarded && UPGRADES[u.id].mine).map(u => u.id);
const capTokens = (ship, kind) => { if (ship.tokens[kind] > 1) ship.tokens[kind] = 1; };

export default {
  // ================================================================ pilots
  lt_corvo: customRoll('lt_corvo', 'corvo', 'Barrel roll at an angle (Corvo, +1 stress)', true),
  kappa_ace: customRoll('kappa_ace', 'kappa', 'Long barrel roll (2-straight)', false),
  teodor_halm: {
    onReveal: (state, ship) => (ship.round.maneuver.key.endsWith('K') && !ship.round.maneuver.key.endsWith('RK') ? [cardStep('teodor_halm', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], cur = speedOf(ship);
        switchManeuver(state, ship, 'teodor_halm', [1, 3, 5].filter(n => n !== cur).map(n => offDial(ship, n, 'K')), `${shipName(ship)}: fly the reverse turn at another speed?`, { color: ship.round.maneuver.color });
      },
      switch: applySwitch,
    },
  },
  kiran_vos: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || a.band < 2 || owner.tokens.evade < 1 || !once(a, 'kiran')) return [];
      return [{ id: 'kiran', label: 'Kiran Vos: spend an evade token, add a hit', apply(st, a2) { st.ships[owner.id].tokens.evade--; addDie(a2.attackDice, 'hit'); mark(a2, 'kiran'); } }];
    },
  },
  corvin_drax: {
    denyTokens: (state, owner, ship, ctx, a, v) => v || (enemy(owner, ship) && band(owner, ship) === 1
      && ['attackFocus', 'defenseFocus', 'evadeToken', 'action:focus', 'action:evade'].includes(ctx)),
  },
  reverb: {
    decloakPositions(state, ship, list) {
      const size = chassis(ship).size;
      const banks = ['BL', 'BR'].map(b => { const p = buildPath(ship.pose, { speed: 2, bearing: b }, size); return { id: `bank${b}`, label: `2-bank ${b === 'BL' ? 'left' : 'right'}`, pose: p.final, template: p.templatePoly }; });
      return [...list.filter(o => o.id !== 'ahead'), ...banks];
    },
  },
  murmur: { afterAttack(state, owner, a) { if (isAttacker(owner, a) && a.hit && !owner.destroyed) { owner.tokens.focus++; log(state, `${shipName(owner)} gains focus.`); } return []; } },
  cmdr_alvos: {
    startCombat: (state, owner) => (enemiesInRange(state, owner, 1, 1).some(e => owner.lockOn !== e.id) ? [cardStep('cmdr_alvos', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: lock onto an enemy at Range 1?`, options: shipOpts(enemiesInRange(state, ship, 1, 1)), then: cardStep('cmdr_alvos', 'go', { ship: ship.id }) });
      },
      go(state, s) { acquireLock(state, state.ships[s.ship], state.ships[s.choice]); },
    },
  },
  lt_coltane: {
    endPhase(state, owner) {
      const t = owner.lockOn && state.ships[owner.lockOn];
      return t && !t.destroyed && t.damage.some(c => !c.faceup && !c.proxy) ? [cardStep('lt_coltane', 'offer', { ship: owner.id, target: t.id })] : [];
    },
    steps: {
      offer: offer('lt_coltane', (st, ship, s) => `${shipName(ship)}: spend your lock to flip a facedown Damage card on ${shipName(st.ships[s.target])}?`, 'Flip a card'),
      go(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.target];
        const down = t.damage.filter(c => !c.faceup && !c.proxy); if (!down.length) return;
        spendLock(state, ship);
        push(state, { t: 'flipFaceup', ship: t.id, uids: [down[randInt(state, down.length)].uid] });
      },
    },
  },
  zerek_thorn: {
    attackDice: (state, owner, a, n) => (enemy(owner, attacker(state, a)) && a.weapon === 'primary' && a.band === 1 && band(owner, attacker(state, a)) === 1 ? n - 1 : n),
  },
  juna_halcyon: {
    onReveal: (state, ship) => [cardStep('juna_halcyon', 'offer', { ship: ship.id })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], cur = ship.round.maneuver, b = cur.key.replace(/^\d+/, ''), sp = speedOf(ship);
        const alts = dialFor(ship.chassis).filter(m => m.bearing === b && Math.abs(m.speed - sp) === 1 && m.speed >= 1);
        if (alts.length) switchManeuver(state, ship, 'juna_halcyon', alts.map(m => ({ ...m, color: maneuverColor(state, ship, m) })), `${shipName(ship)}: change speed by 1?`);
      },
      switch: applySwitch,
    },
  },
  twinlock: {
    afterAction(state, ship, action) { if (action === 'lock' && ship.lockOn) ship.twinSpare = ship.lockOn; return []; },
    onSpendLock(state, ship, target) {
      const t = state.ships[target];
      if (ship.twinSpare === target && t && !t.destroyed) { ship.twinSpare = null; ship.lockOn = target; log(state, `${shipName(ship)} still has a second lock on ${shipName(t)}.`); }
      return [];
    },
  },
  hailstorm: { afterDrop: (state, ship) => [freeAction(ship, '“Hailstorm”: free barrel roll', { only: ['roll'], grant: ['roll'] })] },
  delta_lead: {
    startCombat(state, owner) {
      for (const f of friendsInRange(state, owner, 1, 1)) if (f.stress > 0) { f.stress--; log(state, `${shipName(f)} is steadied by “Delta Lead” (−1 stress).`); }
      return [];
    },
  },
  sigma_ace: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.tokens.focus < 1 || owner.lockOn !== a.defender || !once(a, 'sigma_ace') || owner.round.noTokenMods) return [];
      return [{ id: 'sigma_ace', label: '“Sigma Ace”: spend focus and lock — every result becomes a critical', apply(st, a2) {
        for (const d of a2.attackDice) d.face = 'crit';
        mark(a2, 'sigma_ace'); mark(a2, 'lock'); mark(a2, 'focus');
        spendFocus(st, st.ships[owner.id]); spendLock(st, st.ships[owner.id]);
      } }];
    },
  },
  sigma_lead: {
    blockMods(state, owner, a, side, v) {
      if (v) return v;
      if (side === 'attacker') return a.defender === owner.id && owner.lockOn === a.attacker;
      return a.attacker === owner.id && owner.lockOn === a.defender;
    },
  },
  delta_ace: { stat: (state, ship, which, v) => (which === 'skill' && ship.damage.length === 0 ? 12 : v) },
  kappa_lead: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !isAttacker(owner, a) || owner.stress > 0 || !once(a, 'kappa_lead')) return [];
      return [{ id: 'kappa_lead', label: '“Kappa Lead”: take 1 stress, +1 attack die', apply(st, a2) { addStress(st, st.ships[owner.id]); a2.bonusDice++; mark(a2, 'kappa_lead'); } }];
    },
  },
  interrogator: {
    attackDice(state, owner, a, n) {
      if (!isAttacker(owner, a) || a.weapon !== 'primary' || a.band < 2) return n;
      a.band = 1; // counts as Range 1 for the rest of the attack (no Range 3 defense bonus either)
      return n + 1;
    },
  },
  varik_rudd: { afterAttack: (state, owner, a) => (isDefender(owner, a) && !owner.destroyed ? [freeAction(owner, 'Varik Rudd: free action')] : []) },
  lash: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && defender(state, a).damage.length > 0 ? n + 1 : n) },
  mauler: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !a.attackDice.length || !once(a, 'mauler')) return [];
      const crit = count(a.attackDice, 'crit') > 0;
      return [{ id: 'mauler', label: `“Mauler”: cancel all dice${crit ? ' — deal a facedown Damage card' : ''}`, apply(st, a2) {
        a2.attackDice = []; mark(a2, 'mauler');
        if (crit) dealDamageCard(st, st.ships[a2.defender], false);
      } }];
    },
  },
  fledge: {
    startActivation(state, owner) {
      for (const f of liveShips(state).filter(s => s.owner === owner.owner && s.chassis === 'wasp' && s.id !== owner.id && !condition(s, 'fledge_link'))) f.conditions.push({ id: 'fledge_link', from: owner.id });
      return [];
    },
  },
  fledge_link: { // lets a friendly Wasp borrow the action on “Fledge”'s Elite card
    actions: {
      fledge_link: {
        label: 'Borrow “Fledge”’s Elite action',
        can: (state, ship) => { const r = fledgeAction(state, ship); return !!r && r.def.can(state, ship); },
        perform(state, ship) { const r = fledgeAction(state, ship); if (r) r.def.perform(state, ship); },
      },
    },
  },
  tailer: {
    anySpendFocus(state, owner, ship) {
      if (ship.id !== owner.id && ship.owner === owner.owner && !owner.destroyed && band(owner, ship) === 1) { owner.tokens.focus++; log(state, `${shipName(owner)} picks up focus from its wingmate.`); }
      return [];
    },
  },
  tovar_brisk: {
    afterAttack: (state, owner) => restoreElite(state, owner),
    afterManeuver: (state, ship) => restoreElite(state, ship),
    afterAction: (state, ship) => restoreElite(state, ship),
    endPhase: (state, owner) => restoreElite(state, owner),
  },
  cinderfall: {
    onReveal: (state, ship) => (mineIds(ship).length ? [freeAction(ship, '“Cinderfall”: free mine drop', { only: mineIds(ship) })] : []),
    afterAction: (state, ship, action) => (mineIds(ship).length && !mineIds(ship).includes(action) ? [freeAction(ship, '“Cinderfall”: free mine drop', { only: mineIds(ship) })] : []),
  },
  varek_stoll: { faceupDrawThree: true },
  countess_ilvane: {
    onReveal: (state, ship) => (ship.round.maneuver.key.match(/^\d+S$/) ? [cardStep('countess_ilvane', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) { const ship = state.ships[s.ship]; switchManeuver(state, ship, 'countess_ilvane', [offDial(ship, speedOf(ship), 'K')], `${shipName(ship)}: fly the straight as a reverse turn?`, { color: ship.round.maneuver.color }); },
      switch: applySwitch,
    },
  },
  snapfire: {
    attackDice: shieldWatch('snapShields'),
    afterAttack(state, owner, a) {
      if (!isDefender(owner, a) || owner.destroyed || owner.round.snapfire || !lostShield(owner, 'snapShields')) return [];
      owner.round.snapfire = true;
      return [{ t: 'bonusAttack', ship: owner.id, only: ['primary'], reason: '“Snapfire”: return fire', after: cardStep('snapfire', 'restore', { ship: owner.id, prev: !!owner.round.noMoreAttacks }) }];
    },
    steps: { restore(state, s) { state.ships[s.ship].round.noMoreAttacks = s.prev; } },
  },
  tailwind: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.arc === 'rear' && once(a, 'tailwind')
      ? [{ id: 'tailwind', label: '“Tailwind”: add a critical result', apply(st, a2) { addDie(a2.attackDice, 'crit'); mark(a2, 'tailwind'); } }] : []),
  },
  marquise: {}, // read by Flex Ailerons
  fuse: {
    options(state, owner, a, stage) {
      if (stage !== 'defense' || !isDefender(owner, a) || owner.stress > 0 || !a.attackDice.length || !once(a, 'fuse')) return [];
      return [{ id: 'fuse', label: '“Fuse”: suffer 1 damage, cancel every attack result', apply(st, a2) {
        const me = st.ships[owner.id]; a2.attackDice = []; mark(a2, 'fuse');
        sufferDamage(st, me, 1, 0); if (!me.destroyed) addStress(st, me);
      } }];
    },
  },
  high_card: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && owner.damage.length <= 1 ? n + 1 : n) },
  lt_kesta_morne: {
    options(state, owner, a, stage) {
      if (stage !== 'atkOnDefense' || !isAttacker(owner, a) || owner.tokens.focus < 1 || !a.defenseDice.some(d => d.face === 'blank' || d.face === 'focus') || !once(a, 'kesta')) return [];
      return [{ id: 'kesta', label: 'Kesta Morne: spend focus, cancel the defender’s blanks and focus results', apply(st, a2) {
        a2.defenseDice = a2.defenseDice.filter(d => d.face !== 'blank' && d.face !== 'focus'); mark(a2, 'kesta'); spendFocus(st, st.ships[owner.id]);
      } }];
    },
  },
  two_edge: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.weapon === 'primary' || a.hit || owner.round.twoEdge || owner.destroyed) return [];
      owner.round.twoEdge = true;
      const others = ['primary', ...owner.upgrades.filter(u => !u.discarded && UPGRADES[u.id].weapon && u.id !== a.weapon).map(u => u.id)];
      return [{ t: 'bonusAttack', ship: owner.id, only: others, reason: '“Two-Edge”: attack with a different weapon' }];
    },
  },
  major_vandrel: { defenseDice: (state, owner, a, n) => (isDefender(owner, a) && owner.disarmed ? n + 1 : n) },
  lt_varsi: {
    afterAction: (state, ship, action) => ((action === 'slam' || action === 'reload') && ship.disarmed && ship.stress === 0 ? [cardStep('lt_varsi', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('lt_varsi', (st, ship) => `${shipName(ship)}: take 1 stress to re-enable your weapons?`, 'Take stress'),
      go(state, s) { const ship = state.ships[s.ship]; addStress(state, ship); ship.disarmed = false; log(state, `${shipName(ship)} brings its weapons back online.`); },
    },
  },
  vorrak: {
    afterAttack(state, owner, a) {
      if (!isDefender(owner, a) || !a.hit || owner.round.vorrak) return [];
      owner.round.vorrak = true;
      assignDarkMark(state, attacker(state, a), owner.id);
      return [];
    },
  },
  dimmer: { defenseDice(state, owner, a, n) { if (isAttacker(owner, a) && a.obstructed) { a.obstructed = false; return n - 2; } return n; } },
  major_vesmar: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'attack' || !isAttacker(owner, a) || d.tokens.focus || d.tokens.evade) return [];
      return [...changeOption(a, 'vesmar', 'Major Vesmar', 'attack', 'blank', 'hit', 1), ...changeOption(a, 'vesmar', 'Major Vesmar', 'attack', 'focus', 'hit', 1).map(o => ({ ...o, id: 'vesmar:f' }))];
    },
  },
  captain_ferrin: {
    afterRollForced(state, owner, a, kind) {
      if (kind === 'defense' && isDefender(owner, a) && attacker(state, a).jam > 0) { addDie(a.defenseDice, 'evade'); log(state, `${shipName(owner)} reads the jammed attacker (+1 evade).`); }
    },
  },
  steward: {
    anyManeuver: (state, owner, ship, color, info) => (ship.id !== owner.id && ship.owner === owner.owner && speedOf(ship) === 1 && !info.bumped && band(owner, ship) === 1 && (owner.tokens.focus || owner.tokens.evade)
      ? [cardStep('steward', 'offer', { ship: owner.id, target: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.target];
        const opts = [];
        if (ship.tokens.focus) opts.push({ id: 'focus', label: 'Pass a focus token' });
        if (ship.tokens.evade) opts.push({ id: 'evade', label: 'Pass an evade token' });
        pick(state, { player: ship.owner, ship: ship.id, text: `“Steward”: pass a token to ${shipName(t)}?`, options: opts, then: cardStep('steward', 'go', { ship: ship.id, target: t.id }) });
      },
      go(state, s) { const ship = state.ships[s.ship], t = state.ships[s.target]; if (ship.tokens[s.choice] > 0) { ship.tokens[s.choice]--; t.tokens[s.choice]++; log(state, `${shipName(t)} receives a ${s.choice} token.`); } },
    },
  },

  // ================================================================ elite talents
  pounce: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'preRoll' || !isAttacker(owner, a) || owner.stress > 0 || d.tokens.focus || d.tokens.evade || !once(a, 'pounce')) return [];
      return [{ id: 'pounce', label: 'Pounce: take 1 stress, +1 attack die', apply(st, a2) { addStress(st, st.ships[owner.id]); a2.bonusDice++; mark(a2, 'pounce'); } }];
    },
  },
  locked_in: {
    onReveal: (state, ship) => [cardStep('locked_in', 'offer', { ship: ship.id })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], sp = speedOf(ship);
        const alts = dialFor(ship.chassis).filter(m => m.speed === sp && m.key !== ship.round.maneuver.key);
        if (alts.length) switchManeuver(state, ship, 'locked_in', alts, `${shipName(ship)}: Locked In — switch to another speed-${sp} maneuver (it becomes red)?`, { color: 'r' });
      },
      switch: applySwitch,
    },
  },
  solo_flier: {
    options(state, owner, a, stage) {
      if (friendsInRange(state, owner, 1, 2).length) return [];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) return rerollOptions(a, 'solo', 'Solo Flier', 'attack', ['blank'], 1);
      if (stage === 'defense' && isDefender(owner, a)) return rerollOptions(a, 'solo', 'Solo Flier', 'defense', ['blank'], 1);
      return [];
    },
  },
  merciless: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || !a.hit) return [];
      const d = defender(state, a);
      return liveShips(state).some(s => s.id !== d.id && s.id !== owner.id && band(d, s) === 1) ? [cardStep('merciless', 'pick', { ship: owner.id, target: d.id })] : [];
    },
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship], d = state.ships[s.target];
        const opts = liveShips(state).filter(x => x.id !== d.id && x.id !== ship.id && band(d, x) === 1);
        pick(state, { player: ship.owner, ship: ship.id, text: 'Merciless: which ship near the defender suffers 1 damage?', options: shipOpts(opts), then: cardStep('merciless', 'go'), skip: false });
      },
      go(state, s) { const t = state.ships[s.choice]; log(state, `${shipName(t)} is caught by the follow-through.`); sufferDamage(state, t, 1, 0); },
    },
  },
  menace: {
    defenseDice: (state, owner, a, n) => (enemy(owner, defender(state, a)) && areTouching(state, owner.id, a.defender) ? n - 1 : n),
  },
  calculated_shot: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.tokens.focus < 1 || !count(a.attackDice, 'focus') || !once(a, 'calc')) return [];
      return [{ id: 'calc', label: 'Calculated Shot: spend focus, 1 focus → critical', apply(st, a2) { a2.attackDice.find(d => d.face === 'focus').face = 'crit'; mark(a2, 'calc'); spendFocus(st, st.ships[owner.id]); } }];
    },
  },
  snap_reverse: {
    afterManeuver: (state, ship, color) => (color === 'w' || color === 'g' ? [cardStep('snap_reverse', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('snap_reverse', (st, ship) => `${shipName(ship)}: discard Snap Reverse to spin 180° (+1 stress)?`, 'Spin around'),
      go(state, s) {
        const ship = state.ships[s.ship]; discardUpgrade(ship, 'snap_reverse');
        const from = ship.pose; ship.pose = { ...ship.pose, h: ship.pose.h + Math.PI };
        emit(state, { type: 'move', ship: ship.id, path: [from, ship.pose] });
        log(state, `${shipName(ship)} snaps around!`); addStress(state, ship);
      },
    },
  },
  marksman: {
    options(state, owner, a, stage) {
      if (stage !== 'atkOnDefense' || !isAttacker(owner, a) || !count(a.defenseDice, 'evade') || !inArc(owner, defender(state, a)) || !once(a, 'marksman')) return [];
      return [{ id: 'marksman', label: 'Marksman: discard to cancel 1 evade result', apply(st, a2) { a2.defenseDice.splice(a2.defenseDice.findIndex(d => d.face === 'evade'), 1); mark(a2, 'marksman'); discardUpgrade(st.ships[owner.id], 'marksman'); } }];
    },
  },
  cool_head: {
    onStress: (state, ship) => [cardStep('cool_head', 'offer', { ship: ship.id })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed || !activeUpgrades(ship).includes('cool_head')) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: discard Cool Head for a token?`, options: [{ id: 'focus', label: 'Gain focus' }, { id: 'evade', label: 'Gain evade' }], then: cardStep('cool_head', 'go', { ship: ship.id }) });
      },
      go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, 'cool_head'); ship.tokens[s.choice]++; log(state, `${shipName(ship)} keeps a cool head (+1 ${s.choice}).`); },
    },
  },
  feint: {
    options: (state, owner, a, stage) => (stage === 'atkOnDefense' && isAttacker(owner, a) && owner.tokens.evade > 0 ? changeOption(a, 'feint', 'Feint', 'defense', 'evade', 'focus', 1) : []),
  },
  flex_minus: { stat: (state, ship, which, v) => (which === 'skill' ? v - 1 : v) },
  flex_plus: { stat: (state, ship, which, v) => (which === 'skill' ? v + 1 : v) },
  fury: {
    actions: { fury: { label: 'Fury: +1 focus and 2 stress; reroll up to 3 attack dice this round', can: () => true,
      perform(state, ship) { ship.tokens.focus++; ship.round.fury = true; addStress(state, ship, 2); log(state, `${shipName(ship)} flies into a fury.`); } } },
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && owner.round.fury && attackRerollAllowed(state, a) ? rerollOptions(a, 'fury', 'Fury', 'attack', ['blank', 'focus'], 3) : []),
  },
  old_grudge: {
    startActivation: atStart('old_grudge', (state, owner) => [cardStep('old_grudge', 'pick', { ship: owner.id })]),
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Old Grudge: which enemy owes you a debt?', options: shipOpts(liveShips(state).filter(e => enemy(ship, e))), then: cardStep('old_grudge', 'go', { ship: ship.id }), skip: false });
      },
      go(state, s) { const t = state.ships[s.choice]; t.conditions.push({ id: 'blood_debt', from: s.ship }); log(state, `${shipName(t)} has a debt to pay.`); },
    },
    options(state, owner, a, stage) {
      const d = defender(state, a);
      return stage === 'attack' && isAttacker(owner, a) && (d.conditions || []).some(c => c.id === 'blood_debt' && c.from === owner.id) ? changeOption(a, 'grudge', 'Old Grudge', 'attack', 'focus', 'crit', 1) : [];
    },
  },
  quick_shot: {
    weapon: { noAttackMods: true },
    // Usable only during the Activation phase, right after an enemy maneuvers (see anyManeuver).
    weaponRange: (state, ship, w, rng) => (w === UPGRADES.quick_shot.weapon && !(ship.round.quickShotOn && state.phase === 'activation') ? [9, 9] : rng),
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && owner.round.quickShotOn && state.phase === 'activation' && target.id !== owner.round.quickTarget ? false : ok),
    anyManeuver(state, owner, ship) {
      if (!enemy(owner, ship) || owner.destroyed || owner.round.quickUsed || state.phase !== 'activation') return [];
      const cp = closestPoints(shipPoly(owner), shipPoly(ship));
      if (bandFor(cp.d) !== 1 || clipPolygon(shipPoly(ship), arcPolygon(owner.pose)).length < 3 || areTouching(state, owner.id, ship.id)) return [];
      return [cardStep('quick_shot', 'offer', { ship: owner.id, target: ship.id })];
    },
    steps: {
      offer: offer('quick_shot', (st, ship, s) => `${shipName(ship)}: Quick Shot at ${shipName(st.ships[s.target])}?`, 'Fire'),
      go(state, s) {
        const ship = state.ships[s.ship];
        ship.round.quickUsed = true; ship.round.quickShotOn = true; ship.round.quickTarget = s.target;
        push(state, { t: 'bonusAttack', ship: ship.id, only: ['quick_shot'], reason: 'Quick Shot', after: cardStep('quick_shot', 'done', { ship: ship.id, prev: !!ship.round.noMoreAttacks }) }, cardStep('quick_shot', 'done', { ship: ship.id, prev: !!ship.round.noMoreAttacks }));
      },
      done(state, s) { const r = state.ships[s.ship].round; r.quickShotOn = false; r.quickTarget = null; r.noMoreAttacks = s.prev; },
    },
  },
  bank_shot: { attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.obstructed ? n + 1 : n) },
  hive_leader: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !isAttacker(owner, a) || a.weapon !== 'primary' || !once(a, 'hive')) return [];
      const d = defender(state, a);
      const helpers = friendsInRange(state, owner, 1, 3).filter(f => f.tokens.evade > 0 && inArc(f, d) && inBand(f, d, 1, 3)).slice(0, 2);
      if (!helpers.length) return [];
      return [{ id: 'hive', label: `Hive Leader: wingmates give ${helpers.length} evade token(s) for +${helpers.length} dice`, apply(st, a2) {
        for (const h of helpers) st.ships[h.id].tokens.evade--; a2.bonusDice += helpers.length; mark(a2, 'hive');
      } }];
    },
  },
  mastery: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.stress > 0 || !count(a.attackDice, 'focus') || !once(a, 'mastery')) return [];
      return [{ id: 'mastery', label: 'Mastery: all focus → hit', apply(st, a2) { for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'hit'; mark(a2, 'mastery'); } }];
    },
  },
  momentum: {
    afterAction: (state, ship, action) => ((action === 'boost' || action === 'roll') && ship.momentum !== 'spent' ? [cardStep('momentum', 'gain', { ship: ship.id })] : []),
    endPhase: (state, owner) => (owner.momentum === 'spent' && (owner.tokens.focus || owner.tokens.evade) ? [cardStep('momentum', 'ready', { ship: owner.id })] : []),
    steps: {
      gain(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: Momentum — gain a token (spends the card)?`, options: [{ id: 'focus', label: 'Gain focus' }, { id: 'evade', label: 'Gain evade' }], then: cardStep('momentum', 'gained', { ship: ship.id }) });
      },
      gained(state, s) { const ship = state.ships[s.ship]; ship.tokens[s.choice]++; ship.momentum = 'spent'; log(state, `${shipName(ship)} rides its momentum (+1 ${s.choice}).`); },
      ready(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        const opts = ['focus', 'evade'].filter(k => ship.tokens[k] > 0).map(k => ({ id: k, label: `Spend ${k} to ready Momentum` }));
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: ready Momentum again?`, options: opts, then: cardStep('momentum', 'readied', { ship: ship.id }) });
      },
      readied(state, s) { const ship = state.ships[s.ship]; if (ship.tokens[s.choice] > 0) { ship.tokens[s.choice]--; ship.momentum = 'ready'; } },
    },
  },
  saturation_fire: {
    afterAttack(state, owner, a) {
      const slot = UPGRADES[a.weapon]?.slot;
      if (!isAttacker(owner, a) || a.hit || (slot !== 'torpedo' && slot !== 'missile')) return [];
      const d = defender(state, a), cost = UPGRADES[a.weapon].cost;
      for (const s of liveShips(state).filter(x => x.id !== d.id && band(d, x) === 1 && stat(state, x, 'agility') < cost)) {
        const f = rollFace(state, 'attack');
        emit(state, { type: 'roll', ship: s.id, faces: [f], reason: 'Saturation Fire' });
        if (f === 'hit') sufferDamage(state, s, 1, 0); else if (f === 'crit') sufferDamage(state, s, 0, 1);
      }
      return [];
    },
  },
  rock_dancer: {
    actions: { rock_dancer: {
      label: 'Rock Dancer: evade tokens for nearby asteroids',
      can: (state, ship) => rocksNear(state, ship) > 0,
      perform(state, ship) { const n = Math.min(2, rocksNear(state, ship)); ship.tokens.evade += n; log(state, `${shipName(ship)} weaves between the rocks (+${n} evade).`); },
    } },
  },

  // ================================================================ systems
  deep_scopes: { stat: (state, ship, which, v) => (which === 'skill' && state.phase === 'activation' ? 0 : v) },
  fire_solver: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !once(a, 'solver')) return [];
      return [{ id: 'solver', label: 'Fire Solver: replace your dice with 2 hits', apply(st, a2) {
        a2.attackDice = [{ face: 'hit', rerolled: true, noReroll: true, added: true }, { face: 'hit', rerolled: true, noReroll: true, added: true }];
        for (const k of ['solver', 'focus', 'lock']) mark(a2, k);
      } }];
    },
  },
  hornet_suite: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || a.weapon !== 'primary' || owner.lockOn !== a.defender || !once(a, 'suite') || !once(a, 'lock')) return [];
      return [{ id: 'suite', label: 'Hornet Targeting Suite: add a critical (no lock spending this attack)', apply(st, a2) { addDie(a2.attackDice, 'crit'); mark(a2, 'suite'); mark(a2, 'lock'); } }];
    },
  },
  dampener: {
    onStress: (state, ship) => [cardStep('dampener', 'offer', { ship: ship.id })],
    steps: {
      offer: offer('dampener', (st, ship) => `${shipName(ship)}: Dampener — suffer 1 damage to discard the stress token?`, 'Suffer damage'),
      go(state, s) { const ship = state.ships[s.ship]; if (ship.stress < 1) return; ship.stress--; sufferDamage(state, ship, 1, 0); },
    },
  },
  rock_skimmer: { phaseRocks: true },
  mine_planner: {
    startActivation: atStart('mine_planner', (state, owner) => (mineIds(owner).length ? [cardStep('mine_planner', 'offer', { ship: owner.id })] : [])),
    steps: {
      offer: offer('mine_planner', (st, ship) => `${shipName(ship)}: lay your mines ahead of you now?`, 'Lay mines'),
      go(state, s) {
        const ship = state.ships[s.ship];
        const spot = add(ship.pose, mul(fwd(ship.pose.h), CONFIG.baseSize.small / 2 + 2 * CONFIG.rangeBand));
        if (liveShips(state).some(e => enemy(ship, e) && closestPoints([spot], shipPoly(e)).d <= 3 * CONFIG.rangeBand)) { log(state, `${shipName(ship)} can't lay mines that close to the enemy.`); return; }
        for (const id of mineIds(ship)) {
          const before = state.ordnance.length;
          dropOrdnance(state, ship, UPGRADES[id].ordnance);
          const def = ORDNANCE[UPGRADES[id].ordnance];
          const depth = def.shape.type === 'circle' ? def.shape.r * 2 : def.shape.h;
          const shift = mul(fwd(ship.pose.h), CONFIG.baseSize.small + CONFIG.straightPerSpeed + depth / 2 + 2 * CONFIG.rangeBand);
          for (const tok of state.ordnance.slice(before)) { tok.x += shift.x; tok.y += shift.y; }
          discardUpgrade(ship, id);
        }
      },
    },
  },
  launch_computer: { launchBombs: true },
  target_jammer: {
    startActivation: (state, owner) => (owner.disarmed || !liveShips(state).some(x => x.id !== owner.id && inBand(owner, x, 1, 3)) ? [] : [cardStep('target_jammer', 'offer', { ship: owner.id })]),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: disable your weapons this round to scramble a ship's sensors?`,
          options: shipOpts(liveShips(state).filter(x => x.id !== ship.id && inBand(ship, x, 1, 3))), then: cardStep('target_jammer', 'go', { ship: ship.id }) });
      },
      go(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.choice];
        ship.disarmed = true; dropCondition(t, 'scrambled_sensors'); t.conditions.push({ id: 'scrambled_sensors', from: ship.id });
        log(state, `${shipName(ship)} scrambles ${shipName(t)}'s sensors.`);
      },
    },
  },
  thrust_damper: {
    options(state, owner, a, stage) {
      if (stage !== 'defense' || !isDefender(owner, a) || owner.stress > 3 || !once(a, 'damper')) return [];
      return [{ id: 'damper', label: 'Thrust Damper: take 1 stress — your dice become a single evade', apply(st, a2) {
        a2.defenseDice = [{ face: 'evade', rerolled: true, noReroll: true, added: true }]; mark(a2, 'damper'); mark(a2, 'dfocus'); addStress(st, st.ships[owner.id]);
      } }];
    },
  },

  // ================================================================ tech
  signal_relay: {
    endPhase(state, owner) { owner.relayEvade = owner.tokens.evade > 0 ? 1 : 0; return []; },
    startActivation(state, owner) { if (owner.relayEvade) { owner.tokens.evade = Math.max(owner.tokens.evade, 1); owner.relayEvade = 0; } return []; },
    afterAction(state, ship) { capTokens(ship, 'evade'); return []; },
    startCombat(state, owner) { capTokens(owner, 'evade'); return []; },
  },
  guidance_uplink: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.tokens.focus < 1 || !count(a.attackDice, 'blank') || !once(a, 'uplink')) return [];
      return [{ id: 'uplink', label: 'Guidance Uplink: spend focus, 1 blank → hit', apply(st, a2) { a2.attackDice.find(d => d.face === 'blank').face = 'hit'; mark(a2, 'uplink'); spendFocus(st, st.ships[owner.id]); } }];
    },
  },
  evasion_sensors: {
    options(state, owner, a, stage) {
      if (stage !== 'defense' || !isDefender(owner, a) || owner.tokens.focus < 1 || !count(a.defenseDice, 'blank') || !once(a, 'esensors')) return [];
      return [{ id: 'esensors', label: 'Evasion Sensors: spend focus, 1 blank → evade', apply(st, a2) { a2.defenseDice.find(d => d.face === 'blank').face = 'evade'; mark(a2, 'esensors'); spendFocus(st, st.ships[owner.id]); } }];
    },
  },
  hot_thrusters: { stressedAction: (state, ship, id) => (id === 'boost' || id === 'roll') && ship.stress < 3 },
  pattern_reader: { delayStress: true },
  fire_link: {
    lockCostWaived: (state, owner, ship, target, wid, v) => v || (ship.id !== owner.id && ship.owner === owner.owner && owner.lockOn === target.id && inBand(owner, ship, 1, 2)),
  },
  wideband_scanner: {
    startActivation: atStart('wideband_scanner', (state, owner) => {
      for (const f of friendsInRange(state, owner, 1, 2)) f.tokens.focus++;
      log(state, `${shipName(owner)}'s scanner briefs nearby wingmates (+1 focus each).`);
      return [];
    }),
  },
  focus_optics: {
    keepFocus: true,
    afterAction(state, ship) { capTokens(ship, 'focus'); return []; },
    startCombat(state, owner) { capTokens(owner, 'focus'); return []; },
  },
  hunter_sense: {
    combatActive(state, owner, ship) {
      if (!enemy(owner, ship) || owner.destroyed || owner.lockOn !== ship.id || !inArc(owner, ship) || !inBand(owner, ship, 1, 2)) return [];
      const bar = actionBar(state, owner).filter(x => x === 'boost' || x === 'roll');
      return bar.length ? [cardStep('hunter_sense', 'offer', { ship: owner.id, target: ship.id })] : [];
    },
    steps: {
      offer: offer('hunter_sense', (st, ship, s) => `${shipName(ship)}: spend your lock on ${shipName(st.ships[s.target])} to reposition?`, 'Spend lock'),
      go(state, s) {
        const ship = state.ships[s.ship]; if (ship.lockOn !== s.target) return;
        spendLock(state, ship);
        const bar = actionBar(state, ship).filter(x => x === 'boost' || x === 'roll');
        push(state, freeAction(ship, 'Hunter Sense: free boost or barrel roll', { only: bar }));
      },
    },
  },

  // ================================================================ crew
  lord_varr: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) && enemy(owner, defender(state, a)) && !defender(state, a).destroyed && !owner.destroyed
      ? [cardStep('lord_varr', 'offer', { ship: owner.id, target: a.defender })] : []),
    steps: {
      offer: offer('lord_varr', (st, ship, s) => `${shipName(ship)}: Lord Varr — suffer 2 damage to give ${shipName(st.ships[s.target])} 1 critical?`, 'Do it'),
      go(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.target];
        sufferDamage(state, ship, 2, 0);
        if (!t.destroyed) { log(state, `${shipName(t)} is crushed by an unseen grip.`); sufferDamage(state, t, 0, 1); }
      },
    },
  },
  captive_agitator: {
    attackDice(state, owner, a, n) {
      if (isDefender(owner, a) && !owner.round.captive) { owner.round.captive = true; addStress(state, attacker(state, a)); log(state, `${shipName(attacker(state, a))} hesitates to fire at the captive's ship (+1 stress).`); }
      return n;
    },
  },
  mara_venn: {
    endPhase(state, owner) { for (const e of enemiesInRange(state, owner, 1, 1)) if (e.stress === 0) { addStress(state, e); log(state, `${shipName(e)} is unnerved by Mara Venn (+1 stress).`); } return []; },
  },
  wing_officer: {
    actions: { wing_officer: {
      label: 'Wing Officer: hand out focus (then +1 stress)', can: (state, ship) => friendsInRange(state, ship, 1, 2).length > 0,
      perform(state, ship) { push(state, cardStep('wing_officer', 'pick', { ship: ship.id, chosen: [] }), { t: 'stressStep', ship: ship.id }); },
    } },
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship];
        const opts = friendsInRange(state, ship, 1, 2).filter(f => !s.chosen.includes(f.id));
        pick(state, { player: ship.owner, ship: ship.id, text: `Wing Officer: focus for which wingmate? (${2 - s.chosen.length} left)`, options: shipOpts(opts), then: cardStep('wing_officer', 'go', { ship: s.ship, chosen: s.chosen }), skip: 'Done' });
      },
      go(state, s) {
        state.ships[s.choice].tokens.focus++;
        const chosen = [...s.chosen, s.choice];
        if (chosen.length < 2) push(state, cardStep('wing_officer', 'pick', { ship: s.ship, chosen }));
      },
    },
  },
  director_isra: {
    startCombat: (state, owner) => (owner.shields === 0 && owner.damage.length > 0 ? [freeAction(owner, 'Director Isra: free evade', { only: ['evade'], grant: ['evade'] })] : []),
  },
  governor_jerrod: {
    onDealt(state, ship, card, faceup) {
      if (!faceup) return undefined;
      discardUpgrade(ship, 'governor_jerrod');
      ship.damage.push({ card, faceup: false, round: state.round, uid: state.uid++ });
      emit(state, { type: 'damage', ship: ship.id, card, faceup: false });
      log(state, `${shipName(ship)}'s Governor Jerrod contains the critical (facedown).`);
      push(state, cardStep('governor_jerrod', 'fix', { card })); // the card stays on the ship: take it back out of the discard pile
      return 'discard';
    },
    steps: { fix(state, s) { const i = state.damageDiscard.lastIndexOf(s.card); if (i >= 0) state.damageDiscard.splice(i, 1); } },
  },
  sovereign: {
    options(state, owner, a, stage) {
      if (owner.round.sovereign) return [];
      if (stage === 'preRoll' && attacker(state, a).owner === owner.owner && a.sovereign === undefined) {
        return ['crit', 'hit', 'focus'].map(f => ({ id: `sovereign:${f}`, label: `The Sovereign: name “${f}”`, apply(st, a2) { a2.sovereign = { kind: 'attack', face: f }; st.ships[owner.id].round.sovereign = true; } }));
      }
      if (stage === 'defOnAttack' && defender(state, a).owner === owner.owner && a.sovereign === undefined) {
        return ['evade', 'focus'].map(f => ({ id: `sovereign:${f}`, label: `The Sovereign: name “${f}”`, apply(st, a2) { a2.sovereign = { kind: 'defense', face: f }; st.ships[owner.id].round.sovereign = true; } }));
      }
      return [];
    },
    afterRollForced(state, owner, a, kind) {
      const sv = a.sovereign;
      if (!sv || sv.done || sv.kind !== kind) return;
      const dice = kind === 'attack' ? a.attackDice : a.defenseDice;
      const d = dice.find(x => x.face !== sv.face) || dice[0];
      if (!d) return;
      d.face = sv.face; d.noReroll = true; sv.done = true;
      log(state, `The Sovereign's will: one die shows ${sv.face}.`);
    },
  },
  agent_kaldor: {
    startActivation: atStart('agent_kaldor', (state, owner) => [cardStep('agent_kaldor', 'pick', { ship: owner.id })]),
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Agent Kaldor: mark which enemy?', options: shipOpts(liveShips(state).filter(e => enemy(ship, e))), then: cardStep('agent_kaldor', 'go', { ship: ship.id }), skip: false });
      },
      go(state, s) { state.ships[s.ship].kaldor = s.choice; log(state, `${shipName(state.ships[s.ship])} studies ${shipName(state.ships[s.choice])}.`); },
    },
    options(state, owner, a, stage) {
      if (stage === 'attack' && isAttacker(owner, a) && a.defender === owner.kaldor) return changeOption(a, 'kaldor', 'Agent Kaldor', 'attack', 'focus', 'hit', 1);
      if (stage === 'defense' && isDefender(owner, a) && a.attacker === owner.kaldor) return changeOption(a, 'kaldor', 'Agent Kaldor', 'defense', 'focus', 'evade', 1);
      return [];
    },
  },
  admiral_chiran: {
    actions: { admiral_chiran: { label: 'Rear Admiral Chiran: fly a white 1-straight', can: () => true,
      perform(state, ship) { push(state, { t: 'move', ship: ship.id, key: '1S', color: 'w', slam: true }); } } },
  },
  sensor_officer: {
    afterManeuver: (state, ship, color) => (color === 'g' && friendsInRange(state, ship, 1, 1).length ? [cardStep('sensor_officer', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Sensor Officer: which wingmate acquires a lock?', options: shipOpts(friendsInRange(state, ship, 1, 1)), then: { t: 'lockPrompt' } });
      },
    },
  },
  vorrak_crew: {
    actions: { vorrak_crew: {
      label: 'Vorrak: mark an enemy (Dark Mark)',
      can: (state, ship) => enemiesInRange(state, ship, 1, 3).length > 0 && !liveShips(state).some(s => condition(s, 'dark_mark')),
      perform(state, ship) { pick(state, { player: ship.owner, ship: ship.id, text: 'Mark which enemy?', options: shipOpts(enemiesInRange(state, ship, 1, 3)), then: cardStep('vorrak_crew', 'go', { ship: ship.id }), skip: false }); },
    } },
    steps: { go(state, s) { assignDarkMark(state, state.ships[s.choice], s.ship); } },
  },
  general_hakar: {
    actions: { general_hakar: {
      label: 'General Hakar: rally up to 3 wingmates (then +1 stress)', can: (state, ship) => friendsInRange(state, ship, 1, 2).length > 0,
      perform(state, ship) { push(state, cardStep('general_hakar', 'pick', { ship: ship.id, chosen: [] }), { t: 'stressStep', ship: ship.id }); },
    } },
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship];
        const opts = friendsInRange(state, ship, 1, 2).filter(f => !s.chosen.includes(f.id));
        if (!opts.length || s.chosen.length >= 3) { push(state, cardStep('general_hakar', 'fervor', { ship: s.ship, chosen: s.chosen })); return; }
        const done = s.chosen.length ? [{ id: 'done', label: 'Done' }] : [];
        pick(state, { player: ship.owner, ship: ship.id, text: `General Hakar: focus for which wingmate? (${3 - s.chosen.length} left)`, options: [...shipOpts(opts), ...done],
          then: cardStep('general_hakar', 'go', { ship: s.ship, chosen: s.chosen }), skip: done.length ? false : 'Skip' });
      },
      go(state, s) {
        if (s.choice === 'done') { push(state, cardStep('general_hakar', 'fervor', { ship: s.ship, chosen: s.chosen })); return; }
        state.ships[s.choice].tokens.focus++;
        push(state, cardStep('general_hakar', 'pick', { ship: s.ship, chosen: [...s.chosen, s.choice] }));
      },
      fervor(state, s) {
        const ship = state.ships[s.ship];
        if (!s.chosen.length) return;
        pick(state, { player: ship.owner, ship: ship.id, text: 'Which rallied ship gets Zealot’s Fervor?', options: shipOpts(s.chosen.map(id => state.ships[id]).filter(x => !x.destroyed)), then: cardStep('general_hakar', 'zeal'), skip: false });
      },
      zeal(state, s) { const t = state.ships[s.choice]; if (!condition(t, 'zealots_fervor')) t.conditions.push({ id: 'zealots_fervor', from: null }); log(state, `${shipName(t)} burns with zeal.`); },
    },
  },
  director_kresh: {
    startActivation: atStart('director_kresh', (state, owner) => (liveShips(state).some(f => f.owner === owner.owner && chassis(f).shields <= 3) ? [cardStep('director_kresh', 'pick', { ship: owner.id })] : [])),
    steps: {
      pick(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Director Kresh: which ship gets Prototype Tuning?', options: shipOpts(liveShips(state).filter(f => f.owner === ship.owner && chassis(f).shields <= 3)), then: cardStep('director_kresh', 'go', { ship: ship.id }), skip: false });
      },
      go(state, s) { const t = state.ships[s.choice]; t.conditions.push({ id: 'prototype_tuning', from: s.ship }); t.shields++; log(state, `${shipName(t)} gets prototype tuning (+1 shield).`); },
    },
  },
  shadow_troopers: {
    attackDice(state, owner, a, n) {
      const d = defender(state, a), atk = attacker(state, a);
      if (d.id !== owner.id && d.owner === owner.owner && band(owner, d) === 1 && enemy(owner, atk) && inArc(atk, owner) && inBand(atk, owner, 1, 3) && once(a, `troopers:${owner.id}`)) {
        mark(a, `troopers:${owner.id}`); addStress(state, atk); log(state, `${shipName(atk)} takes fire from Shadow Troopers (+1 stress).`);
      }
      return n;
    },
  },
  tactics_officer: { actionBar: (state, ship, list) => (list.includes('coordinate') ? list : [...list, 'coordinate']) },
  intel_slicer: {
    afterAction(state, ship, action) {
      if (action !== 'jam') return [];
      return slicerTargets(state, ship).length ? [cardStep('intel_slicer', 'offer', { ship: ship.id })] : [];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: 'Intel Slicer: jam which nearby ship too?', options: shipOpts(slicerTargets(state, ship)), then: cardStep('intel_slicer', 'go') });
      },
      go(state, s) { const t = state.ships[s.choice]; t.jam = 1; log(state, `${shipName(t)} is jammed by a slicer.`); },
    },
  },

  // ================================================================ titles & modifications
  phase_shroud: { afterAttack: (state, owner, a) => (isAttacker(owner, a) && !owner.destroyed ? [freeAction(owner, 'Phase Shroud: free cloak', { only: ['cloak'], grant: ['cloak'] })] : []) },
  twin_drive: { maneuverColor: (state, ship, m, c) => (m.bearing === 'BL' || m.bearing === 'BR' ? 'g' : c) },
  stiletto_v1: { afterAction: (state, ship, action) => (action === 'lock' ? [freeAction(ship, 'Stiletto V1: free evade', { only: ['evade'], grant: ['evade'] })] : []) },
  mantis_x7: {
    afterManeuver: (state, ship, color, info) => (speedOf(ship) >= 3 && speedOf(ship) <= 5 && !info.blocked ? [freeAction(ship, 'Mantis X7: free evade', { only: ['evade'], grant: ['evade'] })] : []),
  },
  mantis_d: {
    afterAttack(state, owner, a) {
      const u = UPGRADES[a.weapon];
      if (!isAttacker(owner, a) || !u || u.slot !== 'cannon' || u.cost > 3 || owner.round.mantisD || owner.destroyed) return [];
      owner.round.mantisD = true;
      return [{ t: 'bonusAttack', ship: owner.id, only: ['primary'], reason: 'Mantis D: follow up with your primary weapon' }];
    },
  },
  black_ops_drill: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !isAttacker(owner, a) || a.weapon !== 'primary' || a.arc !== 'front' || a.bonus || !once(a, 'drill')) return [];
      return [{ id: 'drill', label: 'Black Ops Drill: +1 attack die (no rear-arc follow-up)', apply(st, a2) { a2.bonusDice++; st.ships[owner.id].round.drillDie = true; mark(a2, 'drill'); } }];
    },
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.weapon !== 'primary' || a.arc !== 'front' || a.bonus || owner.round.drillDie || owner.destroyed) return [];
      owner.round.drillRear = true;
      return [{ t: 'bonusAttack', ship: owner.id, only: ['primary'], reason: 'Black Ops Drill: attack from your rear arc' }];
    },
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && owner.round.drillRear && !inRearArc(owner, target) ? false : ok),
  },
  flex_ailerons: ailerons('flex_ailerons'),
  reaver_ailerons: { ...ailerons('reaver_ailerons'), maneuverColor: (state, ship, m, c) => (m.speed === 3 && (m.bearing === 'BL' || m.bearing === 'BR') ? 'w' : c) },
  light_frame: {
    afterRollForced(state, owner, a, kind) {
      if (kind === 'defense' && isDefender(owner, a) && a.defenseDice.length < a.attackDice.length) {
        const [d] = rollDice(state, 'defense', 1); d.added = true; a.defenseDice.push(d);
        log(state, `${shipName(owner)}'s light frame jinks (+1 defense die: ${d.face}).`);
      }
    },
  },
  vanguard_mark: {
    options(state, owner, a, stage) {
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) {
        const inSights = liveShips(state).filter(s => s.id !== owner.id && inArc(owner, s) && inBand(owner, s, 1, 3));
        return inSights.length === 1 && inSights[0].id === a.defender ? rerollOptions(a, 'vanguard', 'Vanguard Mark', 'attack', ['blank', 'focus'], 1) : [];
      }
      if (stage === 'defense' && isDefender(owner, a) && a.defenseDice.length && once(a, 'vanguard_d')) {
        return [{ id: 'vanguard_d', label: 'Vanguard Mark: discard to reroll all defense dice', apply(st, a2) {
          for (const d of a2.defenseDice) if (!d.noReroll) { d.face = rollFace(st, 'defense'); d.rerolled = true; }
          mark(a2, 'vanguard_d'); discardUpgrade(st.ships[owner.id], 'vanguard_mark');
        } }];
      }
      return [];
    },
  },

  // ================================================================ conditions
  dark_mark: {
    onDealt(state, ship, card, faceup) {
      const c = condition(ship, 'dark_mark');
      if (!c || !faceup || !state.attack || state.attack.defender !== ship.id) return undefined;
      dropCondition(ship, 'dark_mark');
      const entry = { card: c.card, faceup: true, round: state.round, uid: state.uid++ };
      ship.damage.push(entry);
      emit(state, { type: 'damage', ship: ship.id, card: c.card, faceup: true });
      log(state, `The Dark Mark takes hold: ${shipName(ship)} suffers ${DAMAGE_CARDS[c.card].name}.`);
      resolveFaceup(state, ship, entry);
      return 'discard';
    },
  },
  zealots_fervor: {
    denyTokens: (state, owner, ship, ctx, a, v) => v || (ship.id === owner.id && ctx === 'defenseFocus'),
    compare(state, owner, a, rules) { if (isAttacker(owner, a) && a.used.includes('focus') && count(a.attackDice, 'hit')) { rules.uncancelableHits = Math.max(rules.uncancelableHits, 1); rules.critsFirst = true; } },
    endPhase(state, owner) { dropCondition(owner, 'zealots_fervor'); return []; },
  },
  blood_debt: {},
  scrambled_sensors: {
    blockMods(state, owner, a, side, v) {
      const c = condition(owner, 'scrambled_sensors');
      return v || (!!c && side === 'attacker' && a.attacker === owner.id && a.defender === c.from && a.band === 1);
    },
    endPhase(state, owner) { dropCondition(owner, 'scrambled_sensors'); return []; },
  },
  prototype_tuning: {
    stat: (state, ship, which, v) => (which === 'maxShields' && condition(ship, 'prototype_tuning') ? v + 1 : v),
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'attack' || !isAttacker(owner, a) || a.weapon !== 'primary' || owner.round.tuning || d.shields < 1 || !a.attackDice.length) return [];
      return [{ id: 'tuning', label: 'Prototype Tuning: spend 1 die to strip a shield', apply(st, a2) {
        const order = ['blank', 'focus', 'hit', 'crit'];
        const i = a2.attackDice.findIndex(x => x.face === order.find(f => a2.attackDice.some(y => y.face === f)));
        a2.attackDice.splice(i, 1); st.ships[owner.id].round.tuning = true;
        const t = st.ships[a2.defender]; if (t.shields > 0) { t.shields--; log(st, `${shipName(t)} loses a shield to the tuned guns.`); }
      } }];
    },
    afterAttack(state, owner, a) {
      const d = defender(state, a);
      if (!isAttacker(owner, a) || a.weapon !== 'primary' || d.destroyed) return [];
      const kresh = liveShips(state).filter(f => f.owner === owner.owner && activeUpgrades(f).includes('director_kresh') && (f.id === owner.id || inBand(f, owner, 1, 2)) && f.lockOn !== d.id);
      return kresh.length ? [cardStep('prototype_tuning', 'offer', { ship: kresh[0].id, target: d.id })] : [];
    },
    steps: {
      offer: offer('prototype_tuning', (st, ship, s) => `${shipName(ship)}: Director Kresh — lock onto ${shipName(st.ships[s.target])}?`, 'Acquire lock'),
      go(state, s) { const t = state.ships[s.target]; if (!t.destroyed) acquireLock(state, state.ships[s.ship], t); },
    },
  },
};

function ailerons(card) {
  return {
    beforeReveal: (state, ship) => (ship.stress === 0 ? [cardStep(card, 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        const opts = [['1BL', 'BL'], ['1S', 'S'], ['1BR', 'BR']].map(([key, bearing]) => ({ id: key, label: `${key} (white)`, maneuver: { key, speed: 1, bearing, color: 'w' } }));
        const optional = ship.pilot === 'marquise';
        pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text: `${shipName(ship)}: ailerons — fly a white 1-bank or 1-straight before revealing${optional ? ' (optional)' : ''}.`,
          options: opts, then: cardStep(card, 'go', { ship: ship.id }), skip: optional ? 'Ignore the ailerons' : false });
      },
      go(state, s) { push(state, { t: 'move', ship: s.ship, key: s.choice, color: 'w', slam: true }); },
    },
  };
}
function fledgeAction(state, ship) {
  const c = condition(ship, 'fledge_link'); if (!c) return null;
  const src = state.ships[c.from];
  if (!src || src.destroyed || !inBand(ship, src, 1, 3)) return null;
  for (const id of activeUpgrades(src)) if (UPGRADES[id].slot === 'elite' && CARDS[id]?.actions?.[id]) return { id, def: CARDS[id].actions[id] };
  return null;
}
const rocksNear = (state, ship) => obstaclePolys(state).filter(p => bandFor(closestPoints(shipPoly(ship), p).d) === 1).length;
const slicerTargets = (state, ship) => {
  const jammedFoes = liveShips(state).filter(e => enemy(ship, e) && e.jam > 0);
  return liveShips(state).filter(x => !(x.jam > 0) && jammedFoes.some(e => e.id !== x.id && band(e, x) === 1));
};
