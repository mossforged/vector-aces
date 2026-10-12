// Combat phase.
//   start-of-combat card effects → combat order (skill, high→low) → each ship may attack.
// Attack sequence (state.attack holds the live attack `a`):
//   declare (pay costs) → stage preRoll → roll attack → forced changes → stage afterRoll
//   → stage defOnAttack (defender modifies attack dice) → stage attack (attacker modifies)
//   → roll defense → stage defense → compare → stage onHit → deal damage → after-attack effects
// "Stages" collect options from core rules + every card (hooks.js) and let the deciding
// player apply them one at a time until they press Done.
import { UPGRADES } from '../data/upgrades.js';
import { CARDS } from './cards/index.js';
import { push, ask, log, emit, RuleError } from './flow.js';
import { rollDice, count, rollFace } from './dice.js';
import { sufferDamage, resolvePendingDestroys, destroyShip } from './damage.js';
import { skillOrder } from './activation.js';
import { polygonsIntersect } from './geometry.js';
import { cardsOf, everyone, foldAll, fold } from './hooks.js';
import {
  liveShips, shipName, effectiveSkill, attackGeometry, frontGeometry, turretGeometry, hasFaceup, stat, obstaclePolys, shipPoly, hasFlag,
} from './queries.js';
import { spendFocus, spendLock, attackRerollAllowed, attackFocusAllowed, rerollOptions, once, mark } from './effects.js';

const STAGE_KIND = { preRoll: 'attackPrep', afterRoll: 'modAttack', defOnAttack: 'modAttackDef', attack: 'modAttack', defense: 'modDefense', onHit: 'onHit' };
const STAGE_TEXT = {
  preRoll: 'Before rolling: use any effects?', afterRoll: 'After rolling: use any effects?',
  defOnAttack: 'Modify the attacker’s dice?', attack: 'Modify your attack dice.', defense: 'Modify your defense dice.',
  onHit: 'The attack hits. Use any effects?',
};
const ATTACKER_STAGES = ['preRoll', 'afterRoll', 'attack'];

const onObstacle = (state, ship) => obstaclePolys(state).some(o => polygonsIntersect(shipPoly(ship), o));
const weaponDef = a => (a.weapon === 'primary' ? {} : CARDS[a.weapon]?.weapon || {});

// ---------------- target & weapon selection ----------------

/** Every legal (target, weapon) choice for `ship`. `only` limits weapons (e.g. ['primary']). */
export function attackOptions(state, ship, { only = null } = {}) {
  const opts = [];
  if (ship.noAttackRound === state.round || ship.cloaked || ship.disarmed) return opts;
  const touchOk = hasFlag(state, ship, 'attackWhileTouching');
  for (const e of liveShips(state)) {
    if (e.owner === ship.owner) continue;
    if (!foldAll(state, 'canTarget', true, ship, e)) continue;
    const g = attackGeometry(state, ship, e);
    const tag = geo => `R${geo.band}${geo.obstructed ? ', obstructed' : ''}`;
    const blocked = geo => geo.touching && !(touchOk && g && g.band);
    if (g && g.band && !blocked(g) && (!only || only.includes('primary'))) {
      opts.push({ id: `${e.id}|primary`, label: `${shipName(e)} — primary (${tag(g)})`, target: e.id, weapon: 'primary' });
    }
    for (const u of ship.upgrades) {
      const w = UPGRADES[u.id].weapon;
      if (u.discarded || !w || (only && !only.includes(u.id))) continue;
      const geo = w.turret ? turretGeometry(state, ship, e) : frontGeometry(state, ship, e);
      if (!geo || !geo.band || blocked(geo)) continue;
      const [lo, hi] = fold(state, ship, 'weaponRange', [w.minRange, w.maxRange], w);
      if (geo.band < lo || geo.band > hi) continue;
      let pay = w.cost;
      if (w.cost === 'lock' && ship.lockOn !== e.id) {
        if (hasFlag(state, ship, 'lockCostAsFocus') && ship.tokens.focus > 0) pay = 'focus'; else continue;
      }
      if (pay === 'focus' && ship.tokens.focus < 1) continue;
      const suffix = pay === 'focus' && w.cost === 'lock' ? '|f' : '';
      opts.push({ id: `${e.id}|${u.id}${suffix}`, label: `${shipName(e)} — ${UPGRADES[u.id].name} (${tag(geo)})${suffix ? ' · pay focus' : ''}`, target: e.id, weapon: u.id, pay });
    }
  }
  return opts;
}

function beginAttack(state, ship, opt, extra = {}) {
  const target = state.ships[opt.target];
  const w = opt.weapon === 'primary' ? null : UPGRADES[opt.weapon].weapon;
  const geo = !w ? attackGeometry(state, ship, target) : w.turret ? turretGeometry(state, ship, target) : frontGeometry(state, ship, target);
  const a = state.attack = {
    attacker: ship.id, defender: target.id, weapon: opt.weapon, band: geo.band, obstructed: geo.obstructed, line: geo.line, arc: geo.arc || 'front',
    attackDice: [], defenseDice: [], used: [], bonusDice: 0, hit: false, dealt: [], result: null, ...extra,
  };
  if (w && !a.second) {
    if (opt.pay === 'focus') spendFocus(state, ship);
    else if (w.cost === 'lock' && w.spend) { mark(a, 'lock'); spendLock(state, ship); }
    if (w.discard) {
      if (hasFlag(state, ship, 'discardOnlyOnHit')) a.discardIfHit = true;
      else ship.upgrades.find(u => u.id === opt.weapon && !u.discarded).discarded = true;
    }
  }
  push(state,
    { t: 'atkStage', stage: 'preRoll' }, { t: 'rollAttack' }, { t: 'atkStage', stage: 'afterRoll' },
    { t: 'atkStage', stage: 'defOnAttack' }, { t: 'atkStage', stage: 'attack' },
    { t: 'rollDefense' }, { t: 'atkStage', stage: 'defense' },
    { t: 'compareAttack' }, { t: 'atkStage', stage: 'onHit' }, { t: 'dealDamage' }, { t: 'afterAttack' });
}

// ---------------- stage options ----------------

function coreOptions(state, a, stage) {
  const atk = state.ships[a.attacker], def = state.ships[a.defender];
  const opts = [];
  if (stage === 'attack') {
    if (atk.lockOn === a.defender && once(a, 'lock') && attackRerollAllowed(state, a)) {
      for (const o of rerollOptions(a, 'lock', 'Spend lock', 'attack', ['blank', 'focus'], Infinity)) {
        const apply = o.apply;
        opts.push({ ...o, apply(st, a2) { apply(st, a2); spendLock(st, st.ships[a2.attacker]); } });
      }
    }
    if (atk.tokens.focus > 0 && count(a.attackDice, 'focus') && once(a, 'focus') && attackFocusAllowed(state, a)) {
      opts.push({ id: 'focus', label: 'Spend focus: all focus → hit', apply(st, a2) {
        for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'hit';
        mark(a2, 'focus'); spendFocus(st, st.ships[a2.attacker]);
      } });
    }
  }
  if (stage === 'defense') {
    if (def.tokens.focus > 0 && count(a.defenseDice, 'focus') && once(a, 'dfocus')) {
      opts.push({ id: 'dfocus', label: 'Spend focus: all focus → evade', apply(st, a2) {
        for (const d of a2.defenseDice) if (d.face === 'focus') d.face = 'evade';
        mark(a2, 'dfocus'); spendFocus(st, st.ships[a2.defender]);
      } });
    }
    if (def.tokens.evade > 0 && !weaponDef(a).noEvadeTokens) {
      opts.push({ id: `devade${def.tokens.evade}`, label: 'Spend evade: add an evade', apply(st, a2) {
        a2.defenseDice.push({ face: 'evade', rerolled: false, added: true }); st.ships[a2.defender].tokens.evade--;
      } });
    }
  }
  return opts;
}

export function stageOptions(state, stage) {
  const a = state.attack; if (!a) return { player: null, options: [] };
  const atk = state.ships[a.attacker], def = state.ships[a.defender];
  const player = ATTACKER_STAGES.includes(stage) ? atk.owner : def.owner;
  const options = [...coreOptions(state, a, stage)];
  if (ATTACKER_STAGES.includes(stage) && weaponDef(a).options) options.push(...weaponDef(a).options(state, a, stage));
  for (const s of liveShips(state)) {
    if (s.owner !== player) continue;
    for (const c of cardsOf(s)) if (c.options) options.push(...c.options(state, s, a, stage));
  }
  return { player, options };
}

// ---------------- steps ----------------

export const steps = {
  combatPhase(state) {
    state.phase = 'combat';
    state.combatSkill = null;
    state.skillOverride = {};
    for (const s of liveShips(state)) {
      if (hasFaceup(s, 'console_blaze')) {
        const f = rollFace(state, 'attack');
        emit(state, { type: 'roll', ship: s.id, faces: [f], reason: 'Console Blaze' });
        log(state, `Console Blaze: ${shipName(s)} rolls ${f}.`);
        if (f === 'hit') sufferDamage(state, s, 1, 0);
      }
    }
    push(state, ...everyone(state, 'startCombat'), { t: 'combatOrder' });
  },

  combatOrder(state) {
    push(state, ...skillOrder(state, -1).map(s => ({ t: 'attackStep', ship: s.id })), { t: 'finishCombat' });
  },

  attackStep(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed) return;
    const sk = effectiveSkill(state, ship);
    if (state.combatSkill !== null && sk !== state.combatSkill) resolvePendingDestroys(state);
    if (ship.destroyed || state.winner) return;
    state.combatSkill = sk;
    if (ship.round.attacked || ship.round.noMoreAttacks) return;
    if (onObstacle(state, ship)) { ship.round.attacked = true; log(state, `${shipName(ship)} is sitting on an asteroid and cannot attack.`); return; }
    const opts = attackOptions(state, ship);
    if (!opts.length) { ship.round.attacked = true; return; }
    ask(state, {
      player: ship.owner, kind: 'declareAttack', ship: ship.id, text: `${shipName(ship)} may attack.`,
      options: [...opts, { id: 'hold', label: 'Hold fire' }], onChoose: 'declareAttack', data: { ship: ship.id },
    });
  },

  /** Extra attack granted by a card. data: { ship, only?, reason, bonusFrom?, after? } */
  bonusAttack(state, s) {
    const ship = state.ships[s.ship];
    if (ship.destroyed || state.winner || onObstacle(state, ship)) return;
    const opts = attackOptions(state, ship, { only: s.only || null });
    if (!opts.length) return;
    ask(state, {
      player: ship.owner, kind: 'declareAttack', ship: ship.id, text: s.reason || `${shipName(ship)} may attack again.`,
      options: [...opts, { id: 'hold', label: 'Hold fire' }], onChoose: 'declareBonus', data: { ship: ship.id, only: s.only || null, bonusFrom: s.bonusFrom || null, after: s.after || null },
    });
  },

  repeatAttack(state, s) {
    const ship = state.ships[s.ship], t = state.ships[s.target];
    if (ship.destroyed || t.destroyed || state.winner) return;
    const w = UPGRADES[s.weapon].weapon;
    const geo = w.turret ? turretGeometry(state, ship, t) : frontGeometry(state, ship, t);
    if (!geo || !geo.band || geo.band < w.minRange || geo.band > w.maxRange) return;
    log(state, `${shipName(ship)} fires a second volley.`);
    beginAttack(state, ship, { target: t.id, weapon: s.weapon }, { second: true });
  },

  atkStage(state, s) {
    if (!state.attack) return;
    const { player, options } = stageOptions(state, s.stage);
    if (!options.length) return;
    ask(state, {
      player, kind: STAGE_KIND[s.stage], ship: ATTACKER_STAGES.includes(s.stage) ? state.attack.attacker : state.attack.defender,
      text: STAGE_TEXT[s.stage], options: [...options.map(o => ({ id: o.id, label: o.label })), { id: 'done', label: 'Done' }],
      onChoose: 'atkStage', data: { stage: s.stage },
    });
  },

  rollAttack(state) {
    const a = state.attack, atk = state.ships[a.attacker], def = state.ships[a.defender];
    let n = a.weapon === 'primary' ? stat(state, atk, 'attack') + (a.band === 1 ? 1 : 0) : UPGRADES[a.weapon].weapon.attack;
    n = foldAll(state, 'attackDice', n + a.bonusDice, a);
    if (hasFaceup(atk, 'blinded')) {
      n = 0;
      const c = atk.damage.find(d => d.faceup && d.card === 'blinded'); c.faceup = false;
      log(state, `${shipName(atk)} is blinded and fires wild!`);
    }
    a.attackDice = rollDice(state, 'attack', Math.max(0, n));
    weaponDef(a).afterRollForced?.(state, a);
    emit(state, { type: 'attackDice', dice: a.attackDice.map(d => ({ ...d })), roll: true, attacker: a.attacker, defender: a.defender, band: a.band, weapon: a.weapon, obstructed: a.obstructed });
    log(state, `${shipName(atk)} attacks ${shipName(def)} at Range ${a.band}: rolls ${a.attackDice.map(d => d.face).join(', ') || 'nothing'}.`);
  },

  rollDefense(state) {
    const a = state.attack, def = state.ships[a.defender];
    let n = Math.max(0, foldAll(state, 'defenseDice', stat(state, def, 'agility'), a));
    if (a.weapon === 'primary' && a.band === 3) n += 1;
    if (a.obstructed) n += 1;
    a.defenseDice = rollDice(state, 'defense', n);
    emit(state, { type: 'defenseDice', dice: a.defenseDice.map(d => ({ ...d })), roll: true });
    log(state, `${shipName(def)} rolls ${a.defenseDice.map(d => d.face).join(', ') || 'no'} defense dice.`);
  },

  compareAttack(state) {
    const a = state.attack;
    const rules = { uncancelableHits: 0, uncancelableCrits: 0, critsFirst: false };
    weaponDef(a).compare?.(state, a, rules);
    for (const s of liveShips(state)) for (const c of cardsOf(s)) c.compare?.(state, s, a, rules);
    const hits = count(a.attackDice, 'hit'), crits = count(a.attackDice, 'crit');
    let evades = count(a.defenseDice, 'evade');
    let hc = hits - Math.min(hits, rules.uncancelableHits), cc = crits - Math.min(crits, rules.uncancelableCrits);
    const order = rules.critsFirst ? ['c', 'h'] : ['h', 'c'];
    for (const k of order) {
      if (k === 'h') { const x = Math.min(hc, evades); hc -= x; evades -= x; } else { const x = Math.min(cc, evades); cc -= x; evades -= x; }
    }
    let rh = hc + Math.min(hits, rules.uncancelableHits), rc = cc + Math.min(crits, rules.uncancelableCrits);
    // Reinforce: an attacker in the reinforced half loses 1 more hit (or crit) if any would land.
    const def = state.ships[a.defender], atkShip = state.ships[a.attacker];
    if (def.round.reinforce && rh + rc > 0) {
      const ahead = (atkShip.pose.x - def.pose.x) * Math.sin(def.pose.h) - (atkShip.pose.y - def.pose.y) * Math.cos(def.pose.h) >= 0;
      if ((def.round.reinforce === 'fore') === ahead) { if (rh > 0) rh--; else rc--; a.reinforced = true; }
    }
    a.hit = rh + rc > 0 || hasFlag(state, state.ships[a.attacker], 'alwaysHits');
    const ion = weaponDef(a).ion;
    if (ion && rh + rc > 0) { rh = 1; rc = 0; a.ion = ion; }
    a.result = { hits: rh, crits: rc };
  },

  dealDamage(state) {
    const a = state.attack, atk = state.ships[a.attacker], def = state.ships[a.defender];
    const { hits, crits } = a.result;
    if (a.discardIfHit && a.hit) { const u = atk.upgrades.find(x => x.id === a.weapon && !x.discarded); if (u) u.discarded = true; }
    state.lastAttack = JSON.parse(JSON.stringify(a));
    emit(state, { type: 'attackResult', attacker: a.attacker, defender: a.defender, hits, crits, hit: a.hit, ion: a.ion || 0 });
    if (a.redirect) {
      const r = state.ships[a.redirect.ship];
      log(state, `${shipName(r)} takes the hit for ${shipName(def)}!`);
      sufferDamage(state, r, 0, a.redirect.crits);
    }
    if (hits + crits === 0) log(state, a.hit ? `${shipName(def)} is hit but shrugs it off.` : `The attack misses ${shipName(def)}.`);
    else {
      log(state, `${shipName(def)} is hit: ${hits} damage, ${crits} critical.`);
      sufferDamage(state, def, hits, crits, { attacker: atk, track: a.dealt });
    }
    if (a.ion && !def.destroyed) { def.ion = (def.ion || 0) + a.ion; log(state, `${shipName(def)} is ionized (${a.ion} ion token${a.ion > 1 ? 's' : ''}).`); }
  },

  afterAttack(state) {
    const a = state.attack; if (!a) return;
    const out = [...everyone(state, 'afterAttack', a)];
    const w = weaponDef(a);
    if (w.afterAttack) out.push(...w.afterAttack(state, a));
    if (w.twice && !a.second) out.push({ t: 'repeatAttack', ship: a.attacker, target: a.defender, weapon: a.weapon });
    state.attack = null;
    push(state, ...out);
  },

  splashDamage(state, s) {
    for (const id of s.ships) {
      const t = state.ships[id];
      if (!t.destroyed) { log(state, `${shipName(t)} is caught in the blast (${s.why}).`); sufferDamage(state, t, 1, 0); }
    }
  },

  finishCombat(state) {
    resolvePendingDestroys(state);
    for (const s of liveShips(state)) if (s.delayedDestroy) destroyShip(state, s);
    state.combatSkill = null;
    state.skillOverride = {};
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
    beginAttack(state, ship, opt);
  },

  declareBonus(state, data, choice) {
    const ship = state.ships[data.ship];
    if (choice === 'hold') return;
    ship.round.noMoreAttacks = true;
    if (data.after) push(state, data.after);
    const opt = attackOptions(state, ship, { only: data.only }).find(o => o.id === choice);
    if (!opt) throw new RuleError('illegal attack');
    beginAttack(state, ship, opt, { bonus: true, bonusFrom: data.bonusFrom });
  },

  atkStage(state, data, choice) {
    if (choice === 'done') return;
    const { options } = stageOptions(state, data.stage);
    const opt = options.find(o => o.id === choice);
    if (!opt) throw new RuleError('That option is no longer available.');
    push(state, { t: 'atkStage', stage: data.stage });
    opt.apply(state, state.attack);
    const a = state.attack;
    const which = ['defense'].includes(data.stage) ? 'defenseDice' : 'attackDice';
    emit(state, { type: which, dice: a[which].map(d => ({ ...d })), mod: choice });
  },
};

