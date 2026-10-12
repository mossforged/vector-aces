// Combat phase: declare target → roll/modify attack → roll/modify defense → compare → damage.
// The live attack is kept in state.attack so the UI can draw the dice tray.
import { UPGRADES } from '../data/upgrades.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { rollDice, rerollWhere, changeFaces, count, rollFace } from './dice.js';
import { sufferDamage, resolvePendingDestroys, flipFacedown } from './damage.js';
import { skillOrder } from './activation.js';
import { polygonsIntersect } from './geometry.js';
import * as AB from './abilities.js';
import {
  liveShips, shipName, effectiveSkill, attackGeometry, activeUpgrades, hasFaceup, stat,
  obstaclePolys, shipPoly,
} from './queries.js';

export function attackOptions(state, ship) {
  const opts = [];
  for (const e of liveShips(state)) {
    if (e.owner === ship.owner) continue;
    const g = attackGeometry(state, ship, e);
    if (!g || !g.band || g.touching) continue;
    const tag = `R${g.band}${g.obstructed ? ', obstructed' : ''}`;
    opts.push({ id: `${e.id}|primary`, label: `${shipName(e)} — primary (${tag})`, target: e.id, weapon: 'primary' });
    for (const u of activeUpgrades(ship)) {
      const w = UPGRADES[u].weapon;
      if (!w || g.band < w.minRange || g.band > w.maxRange) continue;
      if (w.requiresLock && ship.lockOn !== e.id) continue;
      opts.push({ id: `${e.id}|${u}`, label: `${shipName(e)} — ${UPGRADES[u].name} (${tag})`, target: e.id, weapon: u });
    }
  }
  return opts;
}

const onObstacle = (state, ship) => obstaclePolys(state).some(o => polygonsIntersect(shipPoly(ship), o));

function attackModOptions(state) {
  const a = state.attack, atk = state.ships[a.attacker];
  const dice = a.attackDice, opts = [];
  const freshBlanks = dice.some(d => d.face === 'blank' && !d.rerolled);
  const freshFocus = dice.some(d => d.face === 'focus' && !d.rerolled);
  const hasFocus = count(dice, 'focus') > 0;
  if (atk.lockOn === a.defender && !a.used.includes('lock') && (freshBlanks || freshFocus)) {
    if (freshBlanks) opts.push({ id: 'lock:blank', label: 'Spend lock: reroll blanks' });
    if (freshFocus) opts.push({ id: 'lock:all', label: 'Spend lock: reroll blanks + focus' });
  }
  if (atk.tokens.focus > 0 && hasFocus && !a.used.includes('focus')) opts.push({ id: 'focus', label: 'Spend focus: focus → hit' });
  return [...AB.attackModOptions(state, a), ...opts];
}

function defenseModOptions(state) {
  const a = state.attack, def = state.ships[a.defender];
  const dice = a.defenseDice, opts = [];
  const hasFocus = count(dice, 'focus') > 0;
  opts.push(...AB.defenseModOptions(state, a));
  if (def.tokens.focus > 0 && hasFocus && !a.used.includes('dfocus')) opts.push({ id: 'dfocus', label: 'Spend focus: focus → evade' });
  if (def.tokens.evade > 0 && !a.used.includes('devade')) opts.push({ id: 'devade', label: 'Spend evade: add an evade' });
  return opts;
}

export const steps = {
  combatPhase(state) {
    state.phase = 'combat';
    state.combatSkill = null;
    for (const s of liveShips(state)) {
      if (hasFaceup(s, 'console_blaze')) {
        const f = rollFace(state, 'attack');
        log(state, `Console Blaze: ${shipName(s)} rolls ${f}.`);
        if (f === 'hit') sufferDamage(state, s, 1, 0);
      }
    }
    push(state, ...skillOrder(state, -1).map(s => ({ t: 'attackStep', ship: s.id })), { t: 'finishCombat' });
  },

  attackStep(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const sk = effectiveSkill(state, ship);
    if (state.combatSkill !== null && sk !== state.combatSkill) resolvePendingDestroys(state);
    if (ship.destroyed || state.winner) return;
    state.combatSkill = sk;
    if (onObstacle(state, ship)) { ship.round.attacked = true; log(state, `${shipName(ship)} is sitting on an asteroid and cannot attack.`); return; }
    const opts = attackOptions(state, ship);
    if (!opts.length) { ship.round.attacked = true; return; }
    ask(state, {
      player: ship.owner, kind: 'declareAttack', ship: ship.id,
      text: `${shipName(ship)} may attack.`,
      options: [...opts, { id: 'hold', label: 'Hold fire' }],
      onChoose: 'declareAttack', data: { ship: ship.id },
    });
  },

  rollAttack(state) {
    const a = state.attack, atk = state.ships[a.attacker], def = state.ships[a.defender];
    let n;
    if (a.weapon === 'primary') {
      n = stat(state, atk, 'attack') + (a.band === 1 ? 1 : 0);
    } else {
      const w = UPGRADES[a.weapon].weapon;
      n = w.attack;
      if (w.requiresLock) { atk.lockOn = null; a.used.push('lock'); }
      if (w.discard) atk.upgrades.find(u => u.id === a.weapon && !u.discarded).discarded = true;
    }
    n += AB.attackDiceBonus(state, a);
    if (hasFaceup(atk, 'blinded')) { n = 0; flipFacedown(state, atk, 'blinded'); log(state, `${shipName(atk)} is blinded and fires wild!`); }
    a.attackDice = rollDice(state, 'attack', Math.max(0, n));
    emit(state, { type: 'attackDice', dice: a.attackDice.map(d => d.face) });
    log(state, `${shipName(atk)} attacks ${shipName(def)} at Range ${a.band}: rolls ${a.attackDice.map(d => d.face).join(', ') || 'nothing'}.`);
  },

  modAttack(state) {
    const opts = attackModOptions(state);
    if (!opts.length) return;
    const a = state.attack;
    ask(state, { player: state.ships[a.attacker].owner, kind: 'modAttack', text: 'Modify your attack dice.', options: [...opts, { id: 'done', label: 'Done' }], onChoose: 'modAttack', data: {} });
  },

  rollDefense(state) {
    const a = state.attack, atk = state.ships[a.attacker], def = state.ships[a.defender];
    let n = Math.max(0, stat(state, def, 'agility') + AB.defenseDiceDelta(state, a));
    if (a.weapon === 'primary' && a.band === 3) n += 1;
    if (a.obstructed) n += 1;
    a.defenseDice = rollDice(state, 'defense', n);
    emit(state, { type: 'defenseDice', dice: a.defenseDice.map(d => d.face) });
    log(state, `${shipName(def)} rolls ${a.defenseDice.map(d => d.face).join(', ') || 'no'} defense dice.`);
  },

  modDefense(state) {
    const opts = defenseModOptions(state);
    if (!opts.length) return;
    const a = state.attack;
    ask(state, { player: state.ships[a.defender].owner, kind: 'modDefense', text: 'Modify your defense dice.', options: [...opts, { id: 'done', label: 'Done' }], onChoose: 'modDefense', data: {} });
  },

  resolveAttack(state) {
    const a = state.attack, def = state.ships[a.defender];
    let hits = count(a.attackDice, 'hit'), crits = count(a.attackDice, 'crit');
    let evades = count(a.defenseDice, 'evade');
    const cancelHits = Math.min(hits, evades); hits -= cancelHits; evades -= cancelHits;
    const cancelCrits = Math.min(crits, evades); crits -= cancelCrits;
    a.result = { hits, crits };
    state.lastAttack = JSON.parse(JSON.stringify(a));
    emit(state, { type: 'attackResult', attacker: a.attacker, defender: a.defender, hits, crits });
    if (hits + crits === 0) log(state, `The attack misses ${shipName(def)}.`);
    else { log(state, `${shipName(def)} is hit: ${hits} damage, ${crits} critical.`); sufferDamage(state, def, hits, crits); }
    state.attack = null;
  },

  finishCombat(state) {
    resolvePendingDestroys(state);
    state.combatSkill = null;
    push(state, { t: 'endPhase' });
  },
};

export const choices = {
  declareAttack(state, data, choice) {
    const ship = state.ships[data.ship];
    ship.round.attacked = true;
    if (choice === 'hold') { log(state, `${shipName(ship)} holds fire.`); return; }
    const opt = attackOptions(state, ship).find(o => o.id === choice);
    if (!opt) throw new RuleError('illegal attack');
    const g = attackGeometry(state, ship, state.ships[opt.target]);
    state.attack = { attacker: ship.id, defender: opt.target, weapon: opt.weapon, band: g.band, obstructed: g.obstructed, line: g.line, attackDice: [], defenseDice: [], used: [] };
    push(state, { t: 'rollAttack' }, { t: 'modAttack' }, { t: 'rollDefense' }, { t: 'modDefense' }, { t: 'resolveAttack' });
  },

  modAttack(state, data, choice) {
    if (choice === 'done') return;
    const a = state.attack, atk = state.ships[a.attacker];
    switch (choice) {
      case 'lock:blank': case 'lock:all':
        rerollWhere(state, a.attackDice, 'attack', d => d.face === 'blank' || (choice === 'lock:all' && d.face === 'focus'));
        atk.lockOn = null; a.used.push('lock'); break;
      case 'focus': changeFaces(a.attackDice, 'focus', 'hit'); atk.tokens.focus--; a.used.push('focus'); break;
      default: if (!AB.applyAttackMod(state, a, choice)) throw new RuleError('unknown modifier');
    }
    emit(state, { type: 'attackDice', dice: a.attackDice.map(d => d.face) });
    push(state, { t: 'modAttack' });
  },

  modDefense(state, data, choice) {
    if (choice === 'done') return;
    const a = state.attack, def = state.ships[a.defender];
    switch (choice) {
      case 'dfocus': changeFaces(a.defenseDice, 'focus', 'evade'); def.tokens.focus--; a.used.push('dfocus'); break;
      case 'devade': a.defenseDice.push({ face: 'evade', rerolled: false, added: true }); def.tokens.evade--; a.used.push('devade'); break;
      default: if (!AB.applyDefenseMod(state, a, choice)) throw new RuleError('unknown modifier');
    }
    emit(state, { type: 'defenseDice', dice: a.defenseDice.map(d => d.face) });
    push(state, { t: 'modDefense' });
  },
};
