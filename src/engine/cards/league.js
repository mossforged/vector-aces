// Card behaviour for the "league" batch (pilot abilities, upgrades, conditions owned by that batch —
// see docs/WORKSTREAMS.md → A). One entry per card id; hook reference: src/engine/hooks.js.
// Shared helpers: src/engine/effects.js (dice options, tokens, tractor), engine/ordnance.js (bombs).
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollFace, rollDice, count } from '../dice.js';
import { sufferDamage, dealDamageCard } from '../damage.js';
import { dialFor } from '../../data/ships.js';
import { UPGRADES } from '../../data/upgrades.js';
import { randInt } from '../rng.js';
import { closestPoints, bandFor, clipPolygon, arcPolygon } from '../geometry.js';
import {
  shipName, inArc, inFrontArc, rangeBetween, friendsInRange, enemiesInRange, liveShips, stat, effectiveSkill,
  maneuverColor, obstaclePolys, shipPoly, actionBar, activeUpgrades,
} from '../queries.js';
import {
  attacker, defender, once, mark, rerollOptions, changeOption, freeAction, acquireLock, attackRerollAllowed, attackFocusAllowed,
  addStress, spendFocus, spendLock, applyTractor,
} from '../effects.js';

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
const condition = (ship, id) => (ship.conditions || []).find(c => c.id === id);
const dropCondition = (ship, id) => { ship.conditions = (ship.conditions || []).filter(c => c.id !== id); };

/** A "may" ability as a yes/skip prompt that runs cardStep(card, 'go', data) on yes. */
const offer = (card, text, label) => (state, s) => {
  const ship = state.ships[s.ship]; if (!ship || ship.destroyed) return;
  const { t, ...data } = s;
  pick(state, { player: ship.owner, ship: ship.id, text: text(state, ship, s), options: yesNo(label), then: cardStep(card, 'go', data) });
};

/** Prompt to switch this round's revealed maneuver to one of `alts` (dial entries). */
function switchManeuver(state, ship, card, alts, text) {
  const cur = ship.round.maneuver;
  pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text,
    options: alts.map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: maneuverColor(state, ship, m) } })),
    then: cardStep(card, 'switch', { ship: ship.id }), skip: `Keep ${cur.key}` });
}
function applySwitch(state, s) {
  const ship = state.ships[s.ship];
  const m = dialFor(ship.chassis).find(x => x.key === s.choice);
  if (!m) return;
  ship.round.maneuver = { key: m.key, color: maneuverColor(state, ship, m) };
  ship.round.revealed = m.key;
  log(state, `${shipName(ship)} switches to ${m.key}.`);
}

// ---------------- shared ability bodies (several pilots carry the same one) ----------------
const ezo = {
  options: (state, owner, a, stage) => (stage === 'defense' && isDefender(owner, a) && owner.stress > 0 ? changeOption(a, 'ezo', 'Ezo Brightwater', 'defense', 'focus', 'evade', 2) : []),
};
const bruiser = { compare(state, owner, a, rules) { if (isDefender(owner, a)) rules.critsFirst = true; } };
const sabra = { beforeReveal: (state, ship) => [freeAction(ship, 'Sabra Wenn: free boost or barrel roll before revealing', { only: ['boost', 'roll'] })] };
const cal = {
  options(state, owner, a, stage) {
    if (owner.tokens.focus < 1) return [];
    if (stage === 'attack' && isAttacker(owner, a)) return changeOption(a, 'cal', 'Cal Ardent', 'attack', 'focus', 'hit', 1);
    if (stage === 'defense' && isDefender(owner, a)) return changeOption(a, 'cal', 'Cal Ardent', 'defense', 'focus', 'evade', 1);
    return [];
  },
};

// ---------------- Servo Wings (two-sided card; side stored on the ship) ----------------
const servoSide = ship => ship.servo || 'open';
const flipServo = (state, ship) => { ship.servo = servoSide(ship) === 'open' ? 'closed' : 'open'; log(state, `${shipName(ship)} ${ship.servo === 'open' ? 'opens' : 'closes'} its Servo Wings.`); };
const hasServo = ship => activeUpgrades(ship).includes('servo_wings');

// ---------------- Spare Munitions: one spare round per ordnance card ----------------
function spareRestore(state, ship) {
  if (!ship.spare) ship.spare = ship.upgrades.filter(u => u.id !== 'spare_munitions' && ['torpedo', 'missile', 'bomb'].includes(UPGRADES[u.id].slot)).map(u => u.id);
  for (const id of ship.spare.slice()) {
    const u = ship.upgrades.find(x => x.id === id);
    if (u && u.discarded) { u.discarded = false; ship.spare.splice(ship.spare.indexOf(id), 1); log(state, `${shipName(ship)} loads a spare round for ${UPGRADES[id].name}.`); }
  }
  return [];
}

// ---------------- weapons: "if this hits, X instead of damage" helpers ----------------
const jamOne = (state, s) => { s.jam = (s.jam || 0) + 1; log(state, `${shipName(s)} is jammed.`); };
const nearby = (state, ship) => liveShips(state).filter(s => s.id !== ship.id && band(ship, s) === 1);

export default {
  // ================================================================ pilots
  dax_merrow: {
    afterAttack(state, owner, a) {
      const d = defender(state, a);
      if (!isAttacker(owner, a) || d.destroyed || !(d.tokens.focus || d.tokens.evade || d.lockOn)) return [];
      return [cardStep('dax_merrow', 'offer', { ship: owner.id, target: d.id })];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], d = state.ships[s.target];
        if (ship.destroyed || d.destroyed) return;
        const opts = [];
        if (d.tokens.focus) opts.push({ id: 'focus', label: 'Strip a focus token' });
        if (d.tokens.evade) opts.push({ id: 'evade', label: 'Strip an evade token' });
        if (d.lockOn) opts.push({ id: 'lock', label: 'Break its target lock' });
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: strip a token from ${shipName(d)}?`, options: opts, then: cardStep('dax_merrow', 'go', { target: d.id }) });
      },
      go(state, s) {
        const d = state.ships[s.target];
        if (s.choice === 'lock') d.lockOn = null; else if (d.tokens[s.choice] > 0) d.tokens[s.choice]--;
        log(state, `${shipName(d)} loses its ${s.choice === 'lock' ? 'target lock' : `${s.choice} token`}.`);
      },
    },
  },
  hollis_brack: {
    onStress: (state, ship) => [cardStep('hollis_brack', 'offer', { ship: ship.id })],
    steps: {
      offer: offer('hollis_brack', (st, ship) => `${shipName(ship)}: shake off the stress token (roll 1 attack die — a hit deals you a facedown Damage card)?`, 'Shake it off'),
      go(state, s) {
        const ship = state.ships[s.ship]; if (ship.stress < 1) return;
        ship.stress--;
        const f = rollFace(state, 'attack');
        emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Hollis Brack', success: f !== 'hit' });
        log(state, `${shipName(ship)} shrugs off stress and rolls ${f}.`);
        if (f === 'hit') dealDamageCard(state, ship, false);
      },
    },
  },
  pip_calloway: {
    afterAction(state, ship, action) { if (action === 'lock' && ship.stress > 0) { ship.stress--; log(state, `${shipName(ship)} calms down (−1 stress).`); } return []; },
    onSpendLock(state, ship) { if (ship.stress > 0) { ship.stress--; log(state, `${shipName(ship)} calms down (−1 stress).`); } return []; },
  },
  rell_tamsin: {
    options(state, owner, a, stage) {
      if (stage !== 'defOnAttack' || !isDefender(owner, a) || owner.lockOn === a.attacker || !once(a, 'rell')) return [];
      return [{ id: 'rell', label: 'Rell Tamsin: lock onto the attacker', apply(st, a2) { acquireLock(st, st.ships[owner.id], st.ships[a2.attacker]); mark(a2, 'rell'); } }];
    },
  },
  kulbo_sperr: {
    afterAction: (state, ship, action) => ((action === 'boost' || action === 'roll') && hasServo(ship) ? [cardStep('kulbo_sperr', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('kulbo_sperr', (st, ship) => `${shipName(ship)}: flip Servo Wings to ${servoSide(ship) === 'open' ? 'closed' : 'open'}?`, 'Flip'),
      go(state, s) { flipServo(state, state.ships[s.ship]); },
    },
  },
  levan_tenz: {
    afterAction: (state, ship, action) => (action === 'boost' ? [cardStep('levan_tenz', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('levan_tenz', (st, ship) => `${shipName(ship)}: take 1 stress to gain an evade token?`, 'Take stress, gain evade'),
      go(state, s) { const ship = state.ships[s.ship]; addStress(state, ship); ship.tokens.evade++; log(state, `${shipName(ship)} trades stress for an evade token.`); },
    },
  },
  edro_tubb: {
    beforeReveal: (state, ship) => (ship.tokens.focus > 0 ? [freeAction(ship, 'Edro Tubb: free action')] : []),
  },
  jory_falk: {
    afterAction: (state, ship, action) => (action === 'focus' ? [freeAction(ship, 'Jory Falk: free boost or barrel roll', { only: ['boost', 'roll'] })] : []),
  },
  sola_gemm: {
    stat: (state, ship, which, v) => (which === 'agility' && ship.pose && !ship.destroyed && enemiesInRange(state, ship, 1, 1).length ? v + 1 : v),
  },
  kael_farran: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.stress < 1 || !count(a.attackDice, 'focus') || !once(a, 'kael')) return [];
      return [{ id: 'kael', label: 'Kael Farran: remove 1 stress, all focus → hit', apply(st, a2) {
        st.ships[owner.id].stress--; for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'hit'; mark(a2, 'kael');
      } }];
    },
  },
  nessa_dane: { turretWeapon: (state, ship, uid) => UPGRADES[uid]?.slot === 'torpedo' },
  tukko_esseg: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) || owner.tokens.focus < 1 || !count(a.attackDice, 'focus')) return [];
      const atk = attacker(state, a);
      if (!once(a, 'focus') || !attackFocusAllowed(state, a) || atk.round.noTokenMods || !inBand(owner, atk, 1, 2)) return [];
      return [{ id: `tukko:${owner.id}`, label: `Tukko Esseg: spend his focus — all focus → hit`, apply(st, a2) {
        for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'hit';
        mark(a2, 'focus'); spendFocus(st, st.ships[owner.id]);
      } }];
    },
  },
  mira_donn: {
    options(state, owner, a, stage) {
      if (stage !== 'preRoll' || !isAttacker(owner, a) || owner.round.mira) return [];
      const opts = [];
      if (owner.shields > 0) opts.push({ id: 'mira:up', label: 'Mira Donn: spend 1 shield, +1 attack die', apply(st, a2) { const me = st.ships[owner.id]; me.shields--; me.round.mira = true; a2.bonusDice++; } });
      if (owner.shields < maxShields(state, owner)) opts.push({ id: 'mira:down', label: 'Mira Donn: roll 1 fewer die, recover 1 shield', apply(st, a2) { const me = st.ships[owner.id]; me.shields++; me.round.mira = true; a2.bonusDice--; } });
      return opts;
    },
  },
  cal_ardent: cal,
  cal_ardent_ace: cal,
  redcap: {
    // Watches the shield count across each attack it defends (shield loss from attacks only).
    attackDice(state, owner, a, n) { if (isDefender(owner, a)) owner.round.redcapShields = owner.shields; return n; },
    afterAttack(state, owner, a) {
      if (isDefender(owner, a) && !owner.round.redcap && owner.round.redcapShields !== undefined && owner.shields < owner.round.redcapShields) {
        owner.round.redcap = true; owner.tokens.evade++; log(state, `${shipName(owner)} turns the shield hit into an evade token.`);
      }
      return [];
    },
  },
  bluejay: { boostTemplates: (state, ship, list) => [...list, ['TL', 'Turn left'], ['TR', 'Turn right']] },
  elko_ast: { maneuverColor: (state, ship, m, c) => ((m.bearing === 'TRL' || m.bearing === 'TRR') && ship.stress === 0 ? 'w' : c) },
  jessa_pell: {
    options(state, owner, a, stage) {
      const n = friendsInRange(state, owner, 1, 1).length; if (!n) return [];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) return rerollOptions(a, 'jessa', 'Jessa Pell', 'attack', ['blank', 'focus'], n);
      if (stage === 'defense' && isDefender(owner, a)) return rerollOptions(a, 'jessa', 'Jessa Pell', 'defense', ['blank', 'focus'], n);
      return [];
    },
  },
  nimo_nunn: {
    onStress(state, ship) {
      if (ship.stress > 0 && enemiesInRange(state, ship, 1, 1).some(e => inArc(ship, e))) { ship.stress--; log(state, `${shipName(ship)} keeps cool with an enemy in its sights.`); }
      return [];
    },
  },
  snapline: {
    afterManeuver: (state, ship, color, info) => (speedOf(ship) >= 2 && speedOf(ship) <= 4 && !info.bumped ? [freeAction(ship, '“Snapline”: free boost', { only: ['boost'] })] : []),
  },
  ezo_brightwater: ezo,
  ezo_brightwater_tern: ezo,
  hesta_vael: {
    onReveal(state, ship) {
      const c = ship.round.maneuver.color;
      if (c !== 'g' && c !== 'r') return [];
      return [cardStep('hesta_vael', 'offer', { ship: ship.id, color: c })];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        const alts = dialFor(ship.chassis).filter(m => m.key !== ship.round.maneuver.key && maneuverColor(state, ship, m) === s.color);
        if (alts.length) switchManeuver(state, ship, 'hesta_vael', alts, `${shipName(ship)}: Hesta Vael may switch to another ${s.color === 'g' ? 'green' : 'red'} maneuver.`);
      },
      switch: applySwitch,
    },
  },
  sabra_wenn: sabra,
  sabra_wenn_wasp: sabra,
  bruiser_orrel: bruiser,
  bruiser_orrel_wasp: bruiser,
  bruiser_orrel_tern: bruiser,
  asha_tano: {
    startCombat: (state, owner) => (owner.tokens.focus > 0 && friendsInRange(state, owner, 1, 1).length ? [cardStep('asha_tano', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: spend a focus token to give which wingmate a free action?`,
          options: shipOpts(friendsInRange(state, ship, 1, 1)), then: cardStep('asha_tano', 'go', { ship: ship.id }) });
      },
      go(state, s) {
        const ship = state.ships[s.ship]; if (ship.tokens.focus < 1) return;
        spendFocus(state, ship); push(state, freeAction(state.ships[s.choice], 'Asha Tano: free action'));
      },
    },
  },
  captain_rask: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a)) return [];
      owner.round.raskAttacked = true;
      const d = defender(state, a);
      if (d.destroyed) return [];
      for (const s of liveShips(state)) s.conditions = (s.conditions || []).filter(c => !(c.id === 'pinned_down' && c.from === owner.id));
      d.conditions.push({ id: 'pinned_down', from: owner.id });
      log(state, `${shipName(d)} is pinned down.`);
      return [];
    },
  },
  shaya_brey: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !friendlyAttacker(state, owner, a) || owner.lockOn !== a.defender || !attackRerollAllowed(state, a)) return [];
      const atk = attacker(state, a);
      if (atk.round.noTokenMods || !inBand(owner, atk, 1, 2)) return [];
      return rerollOptions(a, `shaya:${owner.id}`, 'Shaya Brey’s lock', 'attack', ['blank', 'focus'], Infinity).map(o => ({ ...o, apply(st, a2) { o.apply(st, a2); spendLock(st, st.ships[owner.id]); } }));
    },
  },
  bran_stroll: {
    afterManeuver(state, ship) {
      if (ship.stress < 1) return [];
      const f = rollFace(state, 'attack');
      const ok = f === 'hit' || f === 'crit';
      emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Bran Stroll', success: ok });
      if (ok) { ship.stress--; log(state, `${shipName(ship)} steadies (−1 stress).`); }
      return [];
    },
  },
  thayne_kirrel: {
    afterAttack(state, owner, a) {
      const atk = attacker(state, a), d = defender(state, a);
      if (owner.destroyed || atk.owner === owner.owner || d.owner !== owner.owner || d.id === owner.id) return [];
      return inArc(owner, atk) && inBand(owner, atk, 1, 3) ? [freeAction(owner, 'Thayne Kirrel: free action')] : [];
    },
  },
  nora_wex: {
    options(state, owner, a, stage) {
      if (stage === 'attack' && isAttacker(owner, a) && owner.lockOn === a.defender && once(a, 'nora')) {
        return [{ id: 'nora', label: 'Nora Wex: spend lock, add a focus result', apply(st, a2) { spendLock(st, st.ships[owner.id]); addDie(a2.attackDice, 'focus'); mark(a2, 'nora'); } }];
      }
      if (stage === 'defense' && isDefender(owner, a) && owner.lockOn === a.attacker && once(a, 'nora')) {
        return [{ id: 'nora', label: 'Nora Wex: spend lock, add a focus result', apply(st, a2) { spendLock(st, st.ships[owner.id]); addDie(a2.defenseDice, 'focus'); mark(a2, 'nora'); } }];
      }
      return [];
    },
  },
  lowroot: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'defense' || d.id === owner.id || d.owner !== owner.owner || !owner.round.reinforce || band(owner, d) !== 1) return [];
      return [{ id: `lowroot:${owner.id}`, label: 'Lowroot: spend reinforce, add an evade', apply(st, a2) { st.ships[owner.id].round.reinforce = null; addDie(a2.defenseDice, 'evade'); } }];
    },
  },
  ironbark: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && owner.shields === 0 && owner.damage.length > 0 ? n + 1 : n),
  },
  captain_rhone: {
    bombDetonates(state, owner, tok, victims, ok) {
      if (!ok || tok.owner !== owner.owner || owner.round.rhone) return ok;
      const friends = victims.filter(s => s.owner === owner.owner).length, foes = victims.length - friends;
      if (friends > 0 && foes === 0) { owner.round.rhone = true; log(state, `${shipName(owner)} holds back a bomb to spare a wingmate.`); return false; }
      return ok;
    },
  },
  fennick_rowe: {
    options(state, owner, a, stage) {
      const atk = attacker(state, a);
      if (stage !== 'defOnAttack' || state.phase !== 'combat' || owner.stress > 0 || atk.round.noTokenMods || !once(a, 'fennick')) return [];
      if (!inArc(owner, atk) || !inBand(owner, atk, 1, 3)) return [];
      return [{ id: 'fennick', label: 'Fennick Rowe: take 1 stress — attacker can’t spend tokens this round', apply(st, a2) {
        addStress(st, st.ships[owner.id]); st.ships[a2.attacker].round.noTokenMods = true; mark(a2, 'fennick');
      } }];
    },
  },
  ax9: {
    actions: {
      ax9: {
        label: 'Coordinate (AX-9: take 2 stress, clear 1 from the wingmate)',
        can: (state, ship) => actionBar(state, ship).includes('coordinate') && !ship.round.actionsUsed.includes('coordinate') && friendsInRange(state, ship, 1, 2).some(o => o.stress > 0),
        perform(state, ship) {
          pick(state, { player: ship.owner, ship: ship.id, text: 'AX-9: coordinate which stressed wingmate?', options: shipOpts(friendsInRange(state, ship, 1, 2).filter(o => o.stress > 0)), then: cardStep('ax9', 'go', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: {
      go(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.choice];
        ship.round.actionsUsed.push('coordinate');
        addStress(state, ship, 2); t.stress = Math.max(0, t.stress - 1);
        log(state, `${shipName(ship)} takes the heat off ${shipName(t)}.`);
        push(state, freeAction(t, 'Coordinate: free action'));
      },
    },
  },

  // ================================================================ drones
  needle_drone: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'preRoll' || !isAttacker(owner, a) || !inArc(owner, d) || !once(a, 'needle')) return [];
      return [{ id: 'needle', label: 'Needle Drone: take 1 stress, give the defender 1 stress', apply(st, a2) { addStress(st, st.ships[owner.id]); addStress(st, st.ships[a2.defender]); mark(a2, 'needle'); } }];
    },
  },
  buffer_drone: {
    options(state, owner, a, stage) {
      if (stage !== 'onHit' || !isDefender(owner, a) || !a.result || a.result.hits < 3 || !once(a, 'buffer')) return [];
      const n = a.result.hits - 2;
      return [{ id: 'buffer', label: `Buffer Drone: cancel ${n} hit${n > 1 ? 's' : ''}, take ${n} stress`, apply(st, a2) { a2.result.hits = 2; addStress(st, st.ships[owner.id], n); mark(a2, 'buffer'); } }];
    },
  },
  siphon_drone: {
    endPhase(state, owner) {
      if (owner.tokens.focus > 0 && owner.shields < maxShields(state, owner)) { owner.tokens.focus--; owner.shields++; log(state, `${shipName(owner)}'s Siphon Drone turns focus into a shield.`); }
      return [];
    },
  },
  targeting_drone: { afterManeuver: (state, ship, color) => (color === 'r' ? [{ t: 'lockPrompt', ship: ship.id }] : []) },
  spotter_drone: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || a.weapon !== 'primary' || owner.round.spotter || !count(a.attackDice, 'focus')) return [];
      return [{ id: 'spotter', label: 'Spotter Drone: cancel a focus result, gain an evade token', apply(st, a2) {
        const me = st.ships[owner.id]; me.round.spotter = true; me.tokens.evade++;
        a2.attackDice.splice(a2.attackDice.findIndex(d => d.face === 'focus'), 1);
      } }];
    },
  },
  heckler_drone: {
    options(state, owner, a, stage) {
      if (stage !== 'defOnAttack' || owner.lockOn !== a.attacker || !once(a, `heckler:${owner.id}`)) return [];
      return ['crit', 'hit'].filter(f => a.attackDice.some(d => d.face === f && !d.rerolled && !d.noReroll)).map(f => ({
        id: `heckler:${owner.id}:${f}`, label: `Heckler Drone: attacker rerolls a ${f}`,
        apply(st, a2) { const d = a2.attackDice.find(x => x.face === f && !x.rerolled && !x.noReroll); d.face = rollFace(st, 'attack'); d.rerolled = true; mark(a2, `heckler:${owner.id}`); },
      }));
    },
  },
  scrap_drone: {
    actions: {
      scrap_drone: {
        label: 'Scrap Drone: discard an upgrade to recover a shield',
        can: (state, ship) => ship.shields < maxShields(state, ship) && ship.upgrades.some(u => !u.discarded && u.id !== 'scrap_drone'),
        perform(state, ship) {
          pick(state, { player: ship.owner, ship: ship.id, text: 'Scrap Drone: strip which upgrade for parts?',
            options: ship.upgrades.filter(u => !u.discarded && u.id !== 'scrap_drone').map(u => ({ id: u.id, label: UPGRADES[u.id].name })), then: cardStep('scrap_drone', 'go', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: { go(state, s) { const ship = state.ships[s.ship]; discardUpgrade(ship, s.choice); ship.shields++; log(state, `${shipName(ship)} scraps ${UPGRADES[s.choice].name} to restore a shield.`); } },
  },
  glide_drone: {
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && !inArc(owner, target) ? false : ok),
    afterManeuver: (state, ship, color, info) => (!info.blocked && !enemiesInRange(state, ship, 1, 3).some(e => inArc(ship, e))
      ? [freeAction(ship, 'Glide Drone: free boost or barrel roll', { only: ['boost', 'roll'] })] : []),
  },

  // ================================================================ torpedoes, missiles, cannons, turrets
  arc_torpedoes: {
    weapon: {
      afterAttack(state, a) {
        if (!a.hit) return [];
        const d = defender(state, a);
        for (const s of [d, ...(d.destroyed ? [] : nearby(state, d))]) if (!s.destroyed) { s.ion = (s.ion || 0) + 1; log(state, `${shipName(s)} is ionized by the arc burst.`); }
        return [];
      },
    },
  },
  searing_torpedoes: {
    weapon: { afterAttack(state, a) { const d = defender(state, a); if (a.hit && !d.destroyed && d.shields > 0) { d.shields--; log(state, `${shipName(d)} loses a shield to searing plasma.`); } return []; } },
  },
  spare_munitions: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) ? spareRestore(state, owner) : []),
    afterManeuver: (state, ship) => spareRestore(state, ship),
    afterAction: (state, ship) => spareRestore(state, ship),
  },
  quake_torpedo: {
    actions: {
      quake_torpedo: {
        label: 'Quake Torpedo: blast an asteroid',
        can: (state, ship) => quakeTargets(state, ship).length > 0,
        perform(state, ship) {
          const opts = quakeTargets(state, ship).map(i => ({ id: String(i), label: `Asteroid ${i + 1}` }));
          pick(state, { player: ship.owner, ship: ship.id, text: 'Quake Torpedo: which asteroid?', options: opts, then: cardStep('quake_torpedo', 'go', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: {
      go(state, s) {
        const ship = state.ships[s.ship], i = Number(s.choice);
        const poly = obstaclePolys(state)[i]; if (!poly) return;
        discardUpgrade(ship, 'quake_torpedo');
        const o = state.obstacles[i];
        emit(state, { type: 'detonate', ordnance: 'quake', x: o.x, y: o.y, kind: 'bomb' });
        state.obstacles.splice(i, 1);
        log(state, `${shipName(ship)} shatters an asteroid!`);
        for (const v of liveShips(state).filter(x => bandFor(closestPoints(shipPoly(x), poly).d) === 1)) {
          const f = rollFace(state, 'attack');
          emit(state, { type: 'roll', ship: v.id, faces: [f], reason: 'Asteroid shrapnel' });
          if (f === 'hit') sufferDamage(state, v, 1, 0); else if (f === 'crit') sufferDamage(state, v, 0, 1);
        }
      },
    },
  },
  flare_rockets: {
    weapon: {
      options: (state, a, stage) => (stage === 'preRoll' && once(a, 'w:flare') && stat(state, attacker(state, a), 'agility') > 0
        ? [{ id: 'w:flare', label: `Flare Rockets: +${Math.min(3, stat(state, attacker(state, a), 'agility'))} dice`, apply(st, a2) { a2.bonusDice += Math.min(3, stat(st, attacker(st, a2), 'agility')); mark(a2, 'w:flare'); } }] : []),
    },
  },
  lancehead_missiles: {
    weapon: { replaceDamage(state, a) { const d = defender(state, a); log(state, `Lancehead strike on ${shipName(d)}!`); dealDamageCard(state, d, true); } },
  },
  trace_darts: {
    weapon: {
      replaceDamage(state, a) {
        const atk = attacker(state, a);
        log(state, `${shipName(defender(state, a))} is tagged by trace darts.`);
        push(state, cardStep('trace_darts', 'offer', { ship: atk.id, target: a.defender, done: [] }));
      },
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.target];
        if (t.destroyed || ship.destroyed) return;
        const opts = friendsInRange(state, ship, 1, 2).filter(f => !s.done.includes(f.id) && f.lockOn !== t.id);
        pick(state, { player: ship.owner, ship: ship.id, text: `Trace Darts: which wingmate locks onto ${shipName(t)}?`, options: shipOpts(opts), then: cardStep('trace_darts', 'go', { ship: s.ship, target: s.target, done: s.done }), skip: 'Done' });
      },
      go(state, s) {
        acquireLock(state, state.ships[s.choice], state.ships[s.target]);
        push(state, cardStep('trace_darts', 'offer', { ship: s.ship, target: s.target, done: [...s.done, s.choice] }));
      },
    },
  },
  dumbfire_rockets: { weapon: { onlyFocusMods: true } },
  longhaul_missiles: {
    weapon: {
      options: (state, a, stage) => {
        const n = Math.min(4, speedOf(attacker(state, a)));
        return stage === 'preRoll' && n > 0 && once(a, 'w:longhaul') ? [{ id: 'w:longhaul', label: `Long-Haul Missiles: +${n} dice (speed ${n})`, apply(st, a2) { a2.bonusDice += n; mark(a2, 'w:longhaul'); } }] : [];
      },
    },
  },
  grapple_missiles: {
    weapon: {
      afterAttack(state, a) {
        const d = defender(state, a);
        if (a.hit && !d.destroyed && !condition(d, 'hooked')) { d.conditions.push({ id: 'hooked', from: a.attacker }); log(state, `${shipName(d)} is hooked by a grapple line!`); }
        return [];
      },
    },
  },
  static_missiles: {
    weapon: { replaceDamage(state, a) { const d = defender(state, a); for (const s of [d, ...nearby(state, d)]) jamOne(state, s); } },
  },
  needle_cannon: {
    weapon: {
      replaceDamage(state, a) {
        const d = defender(state, a), calm = d.stress === 0;
        log(state, `${shipName(d)} is peppered with needles.`);
        sufferDamage(state, d, 1, 0);
        if (calm && !d.destroyed) addStress(state, d);
      },
    },
  },
  wrecker_cannon: { weapon: { options: (state, a, stage) => (stage === 'attack' ? changeOption(a, 'w:wrecker', 'Wrecker Cannon', 'attack', 'hit', 'crit', 1) : []) } },
  tractor_projector: { weapon: { replaceDamage(state, a) { applyTractor(state, defender(state, a), attacker(state, a).owner); } } },
  interference_beam: { weapon: { replaceDamage(state, a) { jamOne(state, defender(state, a)); } } },
  linked_battery: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !attackRerollAllowed(state, a)) return [];
      if (a.weapon !== 'primary' && UPGRADES[a.weapon]?.slot !== 'cannon') return [];
      return rerollOptions(a, 'linked', 'Linked Battery', 'attack', ['blank', 'focus'], 1);
    },
  },
  scatter_turret: { weapon: { compare(state, a, rules) { rules.uncancelableHits = count(a.attackDice, 'hit'); rules.critsFirst = true; } } },
  twin_turret: { weapon: { twice: true, replaceDamage(state, a) { sufferDamage(state, defender(state, a), 1, 0); } } },
  dorsal_turret: {
    weapon: {},
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.weapon === 'dorsal_turret' && a.band === 1 ? n + 1 : n),
  },
  synced_turret: {
    weapon: {
      options(state, a, stage) {
        const atk = attacker(state, a);
        if (stage !== 'attack' || !inFrontArc(atk, defender(state, a)) || !attackRerollAllowed(state, a)) return [];
        return rerollOptions(a, 'w:synced', 'Synced Turret', 'attack', ['blank', 'focus'], stat(state, atk, 'attack'));
      },
    },
  },

  // ================================================================ crew
  tinker_bot: {
    endPhase: (state, owner) => (owner.shields === 0 && maxShields(state, owner) > 0 ? [cardStep('tinker_bot', 'offer', { ship: owner.id })] : []),
    steps: {
      offer: offer('tinker_bot', (st, ship) => `${shipName(ship)}: Tinker Bot restores a shield (roll 1 attack die — a hit flips a facedown Damage card)?`, 'Restore a shield'),
      go(state, s) {
        const ship = state.ships[s.ship]; ship.shields = 1;
        const f = rollFace(state, 'attack');
        emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Tinker Bot', success: f !== 'hit' });
        log(state, `${shipName(ship)}'s Tinker Bot restores a shield (rolled ${f}).`);
        const down = ship.damage.filter(c => !c.faceup && !c.proxy);
        if (f === 'hit' && down.length) push(state, { t: 'flipFaceup', ship: ship.id, uids: [down[randInt(state, down.length)].uid] });
      },
    },
  },
  protocol_bot: {
    options(state, owner, a, stage) {
      if (!isDefender(owner, a)) return [];
      if (stage === 'defOnAttack' && !owner.round.protocol && a.protocolGuess === undefined) {
        const max = Math.min(4, stat(state, owner, 'agility') + 1);
        return Array.from({ length: max + 1 }, (_, n) => ({ id: `protocol:${n}`, label: `Protocol Bot: predict ${n} evade${n === 1 ? '' : 's'}`,
          apply(st, a2) { a2.protocolGuess = n; st.ships[owner.id].round.protocol = true; } }));
      }
      if (stage === 'defense' && a.protocolGuess !== undefined) {
        if (a.protocolCount === undefined) a.protocolCount = count(a.defenseDice, 'evade');
        if (a.protocolCount !== a.protocolGuess || !once(a, 'protocol')) return [];
        return [{ id: 'protocol', label: 'Protocol Bot: prediction correct — add an evade', apply(st, a2) { addDie(a2.defenseDice, 'evade'); mark(a2, 'protocol'); } }];
      }
      return [];
    },
  },
  kip_kestrel: {
    onReveal(state, ship) { ship.round.kipStress = ship.stress; return []; },
    afterManeuver(state, ship, color) {
      if (color === 'g' && ship.round.kipStress > ship.stress) { ship.tokens.focus++; log(state, `${shipName(ship)} gains focus as the stress fades.`); }
      return [];
    },
  },
  jana_orr: {
    anyAction: (state, owner, ship, action) => (action === 'focus' && ship.owner === owner.owner && !owner.round.jana && ship.tokens.focus > 0 && (ship.id === owner.id || inBand(owner, ship, 1, 3))
      ? [cardStep('jana_orr', 'offer', { ship: owner.id, target: ship.id })] : []),
    steps: {
      offer: offer('jana_orr', (st, ship, s) => `${shipName(ship)}: Jana Orr — swap a focus token on ${shipName(st.ships[s.target])} for an evade token?`, 'Swap for evade'),
      go(state, s) {
        const t = state.ships[s.target]; if (t.tokens.focus < 1) return;
        state.ships[s.ship].round.jana = true; t.tokens.focus--; t.tokens.evade++;
        log(state, `${shipName(t)} swaps focus for an evade token.`);
      },
    },
  },
  dash_corran: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || owner.lockOn !== a.defender || !once(a, 'lock') || !count(a.attackDice, 'focus') || owner.round.noTokenMods) return [];
      return [{ id: 'dash', label: 'Dash Corran: spend lock, all focus → hit', apply(st, a2) {
        for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'hit'; mark(a2, 'lock'); spendLock(st, st.ships[owner.id]);
      } }];
    },
  },
  aria_vell: {
    startActivation: (state, owner) => [cardStep('aria_vell', 'offer', { ship: owner.id })],
    steps: {
      offer: offer('aria_vell', (st, ship) => `${shipName(ship)}: discard Lady Aria Vell — friendly ships treat red maneuvers as white this phase?`, 'Discard and rally'),
      go(state, s) {
        const ship = state.ships[s.ship];
        discardUpgrade(ship, 'aria_vell');
        for (const f of liveShips(state).filter(x => x.owner === ship.owner)) f.conditions.push({ id: 'aria_rally', from: ship.id, round: state.round });
        log(state, `${shipName(ship)} rallies the squadron: red maneuvers fly white this phase.`);
      },
    },
  },
  aria_rally: { // temporary effect handed out by Lady Aria Vell (lasts until the Combat phase)
    maneuverColor: (state, ship, m, c) => (c === 'r' && state.phase === 'activation' && (ship.conditions || []).some(x => x.id === 'aria_rally' && x.round === state.round) ? 'w' : c),
    startCombat(state, owner) { dropCondition(owner, 'aria_rally'); return []; },
  },
  lanno_castor: {
    actions: {
      lanno_castor: {
        label: 'Lanno Castor: roll 2 defense dice for tokens', can: () => true,
        perform(state, ship) {
          const faces = rollDice(state, 'defense', 2).map(d => d.face);
          emit(state, { type: 'roll', ship: ship.id, faces, reason: 'Lanno Castor', kind: 'defense' });
          const f = faces.filter(x => x === 'focus').length, e = faces.filter(x => x === 'evade').length;
          ship.tokens.focus += f; ship.tokens.evade += e;
          log(state, `${shipName(ship)} rolls ${faces.join(', ')}: +${f} focus, +${e} evade.`);
        },
      },
    },
  },
  dace_rendell: {
    attackOnObstacle: true,
    defenseDice: (state, owner, a, n) => (isAttacker(owner, a) && a.obstructed ? n - 1 : n),
  },
  lebo: {
    actions: {
      lebo: {
        label: '“Lebo”: free boost, then gain 1 ion token', can: () => true,
        perform(state, ship) { push(state, freeAction(ship, '“Lebo”: free boost', { only: ['boost'], grant: ['boost'] }), cardStep('lebo', 'ion', { ship: ship.id })); },
      },
    },
    steps: { ion(state, s) { const ship = state.ships[s.ship]; if (!ship.destroyed) { ship.ion = (ship.ion || 0) + 1; log(state, `${shipName(ship)} overloads its engines (+1 ion).`); } } },
  },
  kaen_jarro: {
    anyManeuver: (state, owner, ship, color) => (color === 'w' && ship.owner === owner.owner && ship.id !== owner.id && ship.stress > 0 && !owner.round.kaen && inBand(owner, ship, 1, 2)
      ? [cardStep('kaen_jarro', 'offer', { ship: owner.id, target: ship.id })] : []),
    steps: {
      offer: offer('kaen_jarro', (st, ship, s) => `${shipName(ship)}: Kaen Jarro — remove 1 stress from ${shipName(st.ships[s.target])}?`, 'Remove stress'),
      go(state, s) { const t = state.ships[s.target]; state.ships[s.ship].round.kaen = true; if (t.stress > 0) t.stress--; log(state, `${shipName(t)} is calmed (−1 stress).`); },
    },
  },
  bruiser_crew: { attackWhileTouching: true },
  ezo_crew: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && owner.stress > 0 ? changeOption(a, 'ezo_crew', 'Ezo Brightwater', 'attack', 'focus', 'crit', 1) : []),
  },
  sprocket: {
    actWhileStressed: true,
    afterAction(state, ship) { if (ship.stress > 0) { log(state, `${shipName(ship)}'s “Sprocket” pushes too hard.`); sufferDamage(state, ship, 1, 0); } return []; },
  },
  hesta_crew: { redWhileStressed: true },
  sabra_crew: {
    onDetonate(state, owner, tok, victims) {
      if (tok.owner !== owner.owner || owner.round.sabra) return [];
      const foe = victims.filter(s => s.owner !== owner.owner && !s.destroyed).sort((x, y) => (x.shields + x.damage.length) - (y.shields + y.damage.length))[0];
      if (foe) { owner.round.sabra = true; log(state, `Sabra Wenn's rigging scorches ${shipName(foe)}.`); sufferDamage(state, foe, 1, 0); }
      return [];
    },
  },
  jyna_esk: {
    actions: {
      jyna_esk: {
        label: 'Jyna Esk: hand out focus for enemies in your sights',
        can: (state, ship) => jynaCount(state, ship) > 0 && friendsInRange(state, ship, 1, 2).length > 0,
        perform(state, ship) {
          pick(state, { player: ship.owner, ship: ship.id, text: `Jyna Esk: which wingmate gets ${jynaCount(state, ship)} focus?`, options: shipOpts(friendsInRange(state, ship, 1, 2)), then: cardStep('jyna_esk', 'go', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: { go(state, s) { const n = jynaCount(state, state.ships[s.ship]); const t = state.ships[s.choice]; t.tokens.focus += n; log(state, `${shipName(t)} gains ${n} focus.`); } },
  },
  casso_andrel: {
    startActivation: (state, owner) => (owner.ion > 0 || !cassoTargets(state, owner).length ? [] : [cardStep('casso_andrel', 'pickEnemy', { ship: owner.id })]),
    steps: {
      pickEnemy(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: Casso Andrel — whose maneuver will you guess?`, options: shipOpts(cassoTargets(state, ship)), then: cardStep('casso_andrel', 'guess', { ship: ship.id }) });
      },
      guess(state, s) {
        const ship = state.ships[s.ship], e = state.ships[s.choice];
        pick(state, { player: ship.owner, ship: ship.id, text: `Guess ${shipName(e)}'s maneuver:`, options: dialFor(e.chassis).map(m => ({ id: m.key, label: m.key })),
          then: cardStep('casso_andrel', 'check', { ship: ship.id, enemy: e.id }), skip: false });
      },
      check(state, s) {
        const ship = state.ships[s.ship];
        const right = state.dials[s.enemy] === s.choice;
        log(state, `${shipName(ship)} guesses ${s.choice} for ${shipName(state.ships[s.enemy])} — ${right ? 'correct!' : 'wrong.'}`);
        if (!right) return;
        const opts = dialFor(ship.chassis).filter(m => m.key !== state.dials[ship.id] && !(ship.stress > 0 && maneuverColor(state, ship, m) === 'r'));
        pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text: `${shipName(ship)}: change your dial?`,
          options: opts.map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: maneuverColor(state, ship, m) } })), then: cardStep('casso_andrel', 'set', { ship: ship.id }), skip: 'Keep my dial' });
      },
      set(state, s) { state.dials[s.ship] = s.choice; log(state, `${shipName(state.ships[s.ship])} adjusts its plan.`); },
    },
  },
  wren_solace: {
    endPhase(state, owner) { if (owner.tokens.focus > 0) { owner.tokens.focus--; owner.wrenFocus = (owner.wrenFocus || 0) + 1; } return []; },
    startCombat(state, owner) { if (owner.wrenFocus > 0) { owner.wrenFocus--; owner.tokens.focus++; log(state, `${shipName(owner)} takes back a saved focus token.`); } return []; },
  },
  fen_marlow: {
    options(state, owner, a, stage) {
      if (stage === 'attack' && isAttacker(owner, a) && a.weapon === 'primary' && inArc(owner, defender(state, a)) && once(a, 'fen')) {
        return [{ id: 'fen', label: 'Fen Marlow: add a blank result', apply(st, a2) { addDie(a2.attackDice, 'blank'); mark(a2, 'fen'); } }];
      }
      if (stage === 'defense' && isDefender(owner, a) && inArc(owner, attacker(state, a)) && once(a, 'fen')) {
        return [{ id: 'fen', label: 'Fen Marlow: add a blank result', apply(st, a2) { addDie(a2.defenseDice, 'blank'); mark(a2, 'fen'); } }];
      }
      return [];
    },
  },
  rask_crew: {
    afterAttack(state, owner, a) { if (isAttacker(owner, a) && !a.hit) { owner.tokens.focus++; log(state, `${shipName(owner)} regroups (+1 focus).`); } return []; },
  },
  bodo_rake: {
    lockTargets(state, ship, list) {
      const friends = liveShips(state).filter(f => f.owner === ship.owner && f.id !== ship.id);
      const extra = liveShips(state).filter(e => e.owner !== ship.owner && !list.includes(e) && friends.some(f => inBand(f, e, 1, 3)));
      return [...list, ...extra];
    },
  },
  baz_malloch: {
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.hit || a.bonus || a.second || owner.round.noMoreAttacks) return [];
      owner.round.bazEx = a.defender;
      return [{ t: 'bonusAttack', ship: owner.id, only: ['primary'], reason: 'Baz Malloch: attack a different ship', bonusFrom: 'baz_malloch' }];
    },
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && owner.round.bazEx === target.id ? false : ok),
  },
  bastien_kell: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.band <= 2 ? changeOption(a, 'bastien', 'Bastien Kell', 'attack', 'hit', 'crit', 1) : []),
  },
  grove_commandos: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a) ? rerollOptions(a, 'commandos', 'Grove Commandos', 'attack', ['focus'], Infinity) : []),
  },
  sorrel_garr: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !count(a.attackDice, 'focus') || !once(a, 'sorrel')) return [];
      return [{ id: 'sorrel', label: 'Sorrel Garr: suffer 1 damage, all focus → critical', apply(st, a2) {
        for (const d of a2.attackDice) if (d.face === 'focus') d.face = 'crit'; mark(a2, 'sorrel'); sufferDamage(st, st.ships[owner.id], 1, 0);
      } }];
    },
  },
  magda_yarrow: {
    afterAttack: (state, owner, a) => (isDefender(owner, a) && !owner.destroyed && !attacker(state, a).destroyed && owner.lockOn !== a.attacker
      ? [cardStep('magda_yarrow', 'offer', { ship: owner.id, target: a.attacker })] : []),
    steps: {
      offer: offer('magda_yarrow', (st, ship, s) => `${shipName(ship)}: Magda Yarrow — lock onto ${shipName(st.ships[s.target])}?`, 'Acquire lock'),
      go(state, s) { const t = state.ships[s.target]; if (!t.destroyed) acquireLock(state, state.ships[s.ship], t); },
    },
  },

  // ================================================================ elite
  shield_bearer: {
    options(state, owner, a, stage) {
      const d = defender(state, a);
      if (stage !== 'onHit' || d.id === owner.id || d.owner !== owner.owner || !a.result || a.result.hits < 1 || band(owner, d) !== 1) return [];
      return [{ id: `bearer:${owner.id}`, label: `Shield Bearer: ${shipName(owner)} takes ${a.result.hits} hit(s) instead`, apply(st, a2) {
        const me = st.ships[owner.id], h = a2.result.hits;
        a2.result.hits = 0; discardUpgrade(me, 'shield_bearer');
        log(st, `${shipName(me)} throws itself in the line of fire!`);
        sufferDamage(st, me, h, 0);
      } }];
    },
  },

  // ================================================================ titles & modifications
  gunship_refit: {
    canTarget: (state, owner, atk, target, ok) => (ok && atk.id === owner.id && !inFrontArc(owner, target) ? false : ok),
    afterAttack(state, owner, a) {
      if (!isAttacker(owner, a) || a.weapon !== 'primary' || a.bonus) return [];
      const turrets = owner.upgrades.filter(u => !u.discarded && UPGRADES[u.id].weapon?.turret).map(u => u.id);
      return turrets.length ? [{ t: 'bonusAttack', ship: owner.id, only: turrets, reason: 'Gunship Refit: follow up with your turret', bonusFrom: 'gunship_refit' }] : [];
    },
  },
  integrated_drone: {
    onDealt(state, ship) {
      const d = ship.upgrades.find(u => !u.discarded && UPGRADES[u.id].slot === 'drone');
      if (!d) return undefined;
      d.discarded = true;
      log(state, `${shipName(ship)} sacrifices ${UPGRADES[d.id].name} to absorb the damage.`);
      return 'discard';
    },
  },
  night_ace: {
    afterAction(state, ship, action) {
      if (action !== 'boost' && action !== 'roll') return [];
      return nightAceTargets(state, ship).length ? [cardStep('night_ace', 'offer', { ship: ship.id })] : [];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: break an enemy lock on which wingmate?`, options: shipOpts(nightAceTargets(state, ship)), then: cardStep('night_ace', 'go') });
      },
      go(state, s) {
        const e = liveShips(state).find(x => x.lockOn === s.choice && x.owner !== state.ships[s.choice].owner);
        if (e) { e.lockOn = null; log(state, `${shipName(e)} loses its lock on ${shipName(state.ships[s.choice])}.`); }
      },
    },
  },
  field_overhaul: {
    attackDice: (state, owner, a, n) => (isAttacker(owner, a) && a.weapon === 'primary' && a.arc === 'front' ? n + 1 : n),
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.weapon === 'primary' && a.arc === 'rear' ? changeOption(a, 'overhaul', 'Field Overhaul', 'attack', 'focus', 'crit', 1) : []),
  },
  stolen_wasp: {
    canTarget: (state, owner, atk, target, ok) => (ok && target.id === owner.id && atk.owner !== owner.owner && effectiveSkill(state, atk) < effectiveSkill(state, owner) ? false : ok),
    afterAttack(state, owner, a) { if (isAttacker(owner, a)) { discardUpgrade(owner, 'stolen_wasp'); log(state, `${shipName(owner)}'s disguise is blown.`); } return []; },
    startCombat(state, owner) {
      if (!liveShips(state).some(s => s.owner === owner.owner && s.id !== owner.id)) { discardUpgrade(owner, 'stolen_wasp'); log(state, `${shipName(owner)} can no longer hide in the crowd.`); }
      return [];
    },
  },
  servo_wings: {
    stat: (state, ship, which, v) => (which === 'attack' && servoSide(ship) === 'closed' ? v - 1 : v),
    actionBar(state, ship, list) { const add = servoSide(ship) === 'open' ? 'roll' : 'boost'; return list.includes(add) ? list : [...list, add]; },
    maneuverColor: (state, ship, m, c) => (servoSide(ship) === 'closed' && m.speed === 2 && (m.bearing === 'BL' || m.bearing === 'BR') ? 'g' : c),
    beforeReveal: (state, ship) => [cardStep('servo_wings', 'flipOffer', { ship: ship.id })],
    onReveal(state, ship) {
      const k = ship.round.maneuver.key;
      return servoSide(ship) === 'open' && ship.stress === 0 && (k === '3TL' || k === '3TR') ? [cardStep('servo_wings', 'rollOffer', { ship: ship.id })] : [];
    },
    steps: {
      flipOffer: offer('servo_wings', (st, ship) => `${shipName(ship)}: flip Servo Wings to ${servoSide(ship) === 'open' ? 'closed' : 'open'}?`, 'Flip'),
      go(state, s) { flipServo(state, state.ships[s.ship]); },
      rollOffer(state, s) {
        const ship = state.ships[s.ship], k = ship.round.maneuver.key, to = k === '3TL' ? '3TRL' : '3TRR';
        pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text: `${shipName(ship)}: fly ${k} as a red ${to} (Tallon roll)?`,
          options: [{ id: to, label: `${to} (red)`, maneuver: { key: to, speed: 3, bearing: to.slice(1), color: 'r' } }], then: cardStep('servo_wings', 'roll', { ship: ship.id }), skip: `Keep ${k}` });
      },
      roll(state, s) { const ship = state.ships[s.ship]; ship.round.maneuver = { key: s.choice, color: 'r' }; ship.round.revealed = s.choice; log(state, `${shipName(ship)} snaps into a Tallon roll.`); },
    },
  },

  // ================================================================ conditions
  pinned_down: {
    attackDice(state, owner, a, n) {
      const c = condition(owner, 'pinned_down');
      if (!c || !isAttacker(owner, a)) return n;
      const src = state.ships[c.from];
      if (!src || src.destroyed || a.defender === c.from) { dropCondition(owner, 'pinned_down'); return n; }
      return n - 1;
    },
    endPhase(state, owner) {
      const c = condition(owner, 'pinned_down');
      const src = c && state.ships[c.from];
      if (c && (!src || src.destroyed || !src.round.raskAttacked)) { dropCondition(owner, 'pinned_down'); log(state, `${shipName(owner)} is no longer pinned down.`); }
      return [];
    },
  },
  hooked: {
    onDestroyed(state, ship) {
      const around = nearby(state, ship).map(s => s.id);
      return around.length ? [{ t: 'splashDamage', ships: around, why: 'Hooked wreck' }] : [];
    },
    afterAttack(state, owner, a) {
      if (!isDefender(owner, a) || !a.result || a.result.crits < 1 || owner.destroyed || !condition(owner, 'hooked')) return [];
      dropCondition(owner, 'hooked');
      log(state, `${shipName(owner)}'s grapple line tears loose!`);
      const around = nearby(state, owner).map(s => s.id);
      dealDamageCard(state, owner, false);
      return around.length ? [{ t: 'splashDamage', ships: around, why: 'Hooked' }] : [];
    },
    actions: {
      hooked: {
        label: 'Cut the grapple line (roll 1 attack die)', can: (state, ship) => !!condition(ship, 'hooked'),
        perform(state, ship) {
          dropCondition(ship, 'hooked');
          const f = rollFace(state, 'attack');
          emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Cut loose', success: f !== 'hit' && f !== 'crit' });
          log(state, `${shipName(ship)} cuts the grapple line (rolled ${f}).`);
          if (f === 'hit' || f === 'crit') sufferDamage(state, ship, 1, 0);
        },
      },
    },
  },
};

function quakeTargets(state, ship) {
  const sp = shipPoly(ship), arc = arcPolygon(ship.pose);
  return obstaclePolys(state).map((p, i) => [p, i]).filter(([p]) => { const b = bandFor(closestPoints(sp, p).d); return b && b <= 2 && clipPolygon(p, arc).length >= 3; }).map(([, i]) => i);
}
const jynaCount = (state, ship) => Math.min(3, enemiesInRange(state, ship, 1, 3).filter(e => inArc(ship, e)).length);
const cassoTargets = (state, ship) => enemiesInRange(state, ship, 1, 2).filter(e => state.dials[e.id]);
const nightAceTargets = (state, ship) => friendsInRange(state, ship, 1, 1).filter(f => liveShips(state).some(e => e.owner !== f.owner && e.lockOn === f.id));
