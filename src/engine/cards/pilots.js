// Pilot abilities. One entry per ability id (see data/pilots.js). Hook reference: engine/hooks.js.
import { pick, cardStep, log, push } from '../flow.js';
import { count } from '../dice.js';
import {
  shipName, inArc, rangeBetween, friendsInRange, liveShips, attackGeometry,
} from '../queries.js';
import {
  attacker, defender, once, mark, rerollOptions, changeOption, freeAction, acquireLock, attackRerollAllowed, addStress,
} from '../effects.js';

const isAttacker = (owner, a) => a.attacker === owner.id;
const isDefender = (owner, a) => a.defender === owner.id;
const friendlyAttacker = (state, owner, a) => !isAttacker(owner, a) && attacker(state, a).owner === owner.owner;
const r = (state, x, y) => rangeBetween(x, y).band;
const shipOpts = ships => ships.map(s => ({ id: s.id, label: shipName(s), target: s.id }));

export default {
  // ---------------- League ----------------
  ivo_strand: {
    defenseDice: (state, owner, a, n) => (isAttacker(owner, a) ? n - 1 : n),
  },
  oren_vask: {
    onSpendFocus: (state, ship) => {
      const friends = friendsInRange(state, ship, 1, 2);
      return friends.length ? [cardStep('oren_vask', 'offer', { ship: ship.id })] : [];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: pass the spent focus token to a wingmate?`,
          options: shipOpts(friendsInRange(state, ship, 1, 2)), then: cardStep('oren_vask', 'give'), skip: 'Discard it' });
      },
      give(state, s) {
        const t = state.ships[s.choice]; t.tokens.focus++;
        log(state, `${shipName(t)} receives a passed focus token.`);
      },
    },
  },
  tobin_hale: {
    startCombat: (state, owner) => (owner.drewFire ? [] : [cardStep('tobin_hale', 'offer', { ship: owner.id })]),
    canTarget(state, owner, atk, target, ok) {
      if (!ok || !owner.round.drawingFire || target.id === owner.id || target.owner !== owner.owner || atk.owner === owner.owner) return ok;
      if (r(state, owner, target) !== 1) return ok;
      const g = attackGeometry(state, atk, owner);
      return g && g.band ? false : ok;
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: draw fire this round (once per game)?`,
          options: [{ id: 'yes', label: 'Draw fire' }], then: cardStep('tobin_hale', 'go', { ship: ship.id }), skip: 'Not now' });
      },
      go(state, s) {
        const ship = state.ships[s.ship];
        ship.drewFire = true; ship.round.drawingFire = true;
        log(state, `${shipName(ship)} draws enemy fire!`);
      },
    },
  },
  kestrel_vane: {
    options: (state, owner, a, stage) => (stage === 'defense' && isDefender(owner, a) ? changeOption(a, 'kestrel', 'Kestrel Vane', 'defense', 'focus', 'evade', 1) : []),
  },
  sela_marrow: {
    afterAction: (state, ship, action) => (action === 'lock' && friendsInRange(state, ship, 1, 2).length ? [cardStep('sela_marrow', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: which wingmate also acquires a lock?`,
          options: shipOpts(friendsInRange(state, ship, 1, 2)), then: { t: 'lockPrompt' } });
      },
    },
  },
  brannoc_teague: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.band >= 2 && attackRerollAllowed(state, a)
      ? rerollOptions(a, 'brannoc', 'Brannoc Teague', 'attack', ['blank'], Infinity) : []),
  },
  juno_arkady: { actWhileStressed: true },
  pell_rusk: { attackWhileTouching: true },
  odo_ravel: {
    compare(state, owner, a, rules) { if (isAttacker(owner, a) && count(a.attackDice, 'crit') > 0) rules.uncancelableCrits = Math.max(rules.uncancelableCrits, 1); },
  },
  nadia_fenn: {
    options(state, owner, a, stage) {
      if (owner.stress < 1) return [];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) return rerollOptions(a, 'nadia', 'Nadia Fenn', 'attack', ['blank', 'focus'], 1);
      if (stage === 'defense' && isDefender(owner, a)) return rerollOptions(a, 'nadia', 'Nadia Fenn', 'defense', ['blank', 'focus'], 1);
      return [];
    },
  },
  yara_lisk: {
    startCombat: (state, owner) => (friendsInRange(state, owner, 1, 3).length ? [cardStep('yara_lisk', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: which wingmate fights at pilot skill 12 this phase?`,
          options: shipOpts(friendsInRange(state, ship, 1, 3)), then: cardStep('yara_lisk', 'go') });
      },
      go(state, s) { state.skillOverride[s.choice] = 12; log(state, `${shipName(state.ships[s.choice])} fights at pilot skill 12 this phase.`); },
    },
  },
  bram_talley: {
    startCombat: (state, owner) => (owner.tokens.focus > 0 && friendsInRange(state, owner, 1, 3).length ? [cardStep('bram_talley', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: give a focus token to a wingmate?`,
          options: shipOpts(friendsInRange(state, ship, 1, 3)), then: cardStep('bram_talley', 'go', { from: ship.id }) });
      },
      go(state, s) {
        const from = state.ships[s.from], to = state.ships[s.choice];
        if (from.tokens.focus < 1) return;
        from.tokens.focus--; to.tokens.focus++;
        log(state, `${shipName(from)} passes a focus token to ${shipName(to)}.`);
      },
    },
  },
  cass_varrin: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !friendlyAttacker(state, owner, a) || owner.stress > 0 || !once(a, 'cass')) return [];
      const b = r(state, owner, attacker(state, a));
      if (!b || b > 3) return [];
      return [{ id: 'cass', label: 'Cass Varrin: take 1 stress, +1 attack die', apply(st, a2) { addStress(st, st.ships[owner.id]); a2.bonusDice++; mark(a2, 'cass'); } }];
    },
  },
  rook_halloran: { alwaysHits: (state, ship) => true },
  mae_coll: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) && friendsInRange(state, owner, 1, 1).length ? [cardStep('mae_coll', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: which wingmate gets a free action?`,
          options: shipOpts(friendsInRange(state, ship, 1, 1)), then: cardStep('mae_coll', 'go') });
      },
      go(state, s) { push(state, freeAction(state.ships[s.choice], 'Mae Coll: free action')); },
    },
  },
  oriel_sabe: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) && !isAttacker(owner, a)) return [];
      const def = defender(state, a);
      if (def.owner === owner.owner) return [];
      const g = attackGeometry(state, owner, def);
      if (!g || !g.band) return [];
      return changeOption(a, 'oriel', 'Oriel Sabe', 'attack', 'hit', 'crit', 1);
    },
  },
  tam_keller: {
    endPhase: (state, owner) => [cardStep('tam_keller', 'offer', { ship: owner.id })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        push(state, { t: 'bonusAttack', ship: ship.id, reason: 'Tam Keller: end-phase attack', after: cardStep('tam_keller', 'lockout', { ship: ship.id }) });
      },
      lockout(state, s) { state.ships[s.ship].noAttackRound = state.round + 1; },
    },
  },

  // ---------------- Dominion ----------------
  gash: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.band === 1 ? changeOption(a, 'gash', 'Gash', 'attack', 'hit', 'crit', 1) : []),
  },
  hollow: {
    afterManeuver: (state, ship, color, info) => (color === 'g' && !info.blocked ? [freeAction(ship, 'Hollow: free focus', { only: ['focus'] })] : []),
  },
  vex: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && !inArc(defender(state, a), owner) ? n + 1 : n),
  },
  wraith: {
    forbidAttackRerolls: (state, ship, a) => a.defender === ship.id,
  },
  brute: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.band === 1 ? n + 1 : n),
  },
  packleader: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) || a.weapon !== 'primary' || !attackRerollAllowed(state, a)) return [];
      if (r(state, owner, attacker(state, a)) !== 1) return [];
      return rerollOptions(a, `pack:${owner.id}`, 'Packleader', 'attack', ['blank', 'focus'], 1);
    },
  },
  ostrava: { faceupDrawThree: true },
  lord_vahl: { actionsPerTurn: (state, ship, n) => Math.max(n, 2) },
  grimm_varo: { delayDestruction: true },
  ilsa_morrow: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) ? [freeAction(owner, 'Ilsa Morrow: free boost or barrel roll', { only: ['boost', 'roll'] })] : []),
  },
  baron_kessick: {
    // Gaining focus whenever stressed is always beneficial, so it is automatic.
    onStress(state, ship) { ship.tokens.focus++; log(state, `${shipName(ship)} turns the pressure into focus.`); return []; },
  },
  captain_vorne: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) || a.weapon === 'primary' || !attackRerollAllowed(state, a)) return [];
      if (r(state, owner, attacker(state, a)) !== 1) return [];
      return rerollOptions(a, `vorne:${owner.id}`, 'Captain Vorne', 'attack', ['blank', 'focus'], 2);
    },
  },
  major_taal: {
    weaponRange: (state, ship, w, rng) => [Math.max(1, rng[0] - 1), Math.min(3, rng[1] + 1)],
  },
  colonel_drath: {
    options(state, owner, a, stage) {
      if (stage !== 'afterRoll' || !isAttacker(owner, a) || owner.lockOn === a.defender || !once(a, 'drath')) return [];
      const locked = liveShips(state).some(s => s.id !== owner.id && s.owner === owner.owner && s.lockOn === a.defender);
      if (!locked) return [];
      return [{ id: 'drath', label: 'Colonel Drath: acquire a lock on the defender', apply(st, a2) { acquireLock(st, st.ships[owner.id], st.ships[a2.defender]); mark(a2, 'drath'); } }];
    },
  },
  ardan_voss: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) && a.dealt.length && owner.tokens.focus > 0 && !defender(state, a).destroyed
      ? [cardStep('ardan_voss', 'offer', { ship: owner.id, target: a.defender, uids: a.dealt.slice() })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.target];
        if (ship.destroyed || t.destroyed || ship.tokens.focus < 1) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: spend focus to flip the ${s.uids.length} damage card(s) you dealt faceup?`,
          options: [{ id: 'yes', label: 'Flip them faceup' }], then: cardStep('ardan_voss', 'go', { ship: s.ship, target: s.target, uids: s.uids }) });
      },
      go(state, s) { push(state, { t: 'flipFaceup', ship: s.target, uids: s.uids, payer: s.ship }); },
    },
  },
};

