// Drones (astromech slot), crew, systems, modifications and titles. Hook reference: engine/hooks.js.
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollFace, count } from '../dice.js';
import { DAMAGE_CARDS } from '../../data/damageDeck.js';
import { dialFor } from '../../data/ships.js';
import { randInt } from '../rng.js';
import {
  shipName, inArc, rangeBetween, effectiveSkill, stat, attackGeometry, enemiesInRange, maneuverColor,
} from '../queries.js';
import { defender, once, mark, rerollOptions, changeOption, freeAction, addStress, spendLock, acquireLock } from '../effects.js';

const isAttacker = (owner, a) => a.attacker === owner.id;
const isDefender = (owner, a) => a.defender === owner.id;
const discardUpgrade = (ship, id) => { const u = ship.upgrades.find(x => x.id === id && !x.discarded); if (u) u.discarded = true; };
const yesNo = label => [{ id: 'yes', label }];

/** Offer a "may" ability as a yes/skip prompt that runs cardStep(card, 'go', data) on yes. */
const offer = (card, text, label) => (state, s) => {
  const ship = state.ships[s.ship]; if (ship.destroyed) return;
  const { t, ...data } = s;
  pick(state, { player: ship.owner, ship: ship.id, text: text(state, ship, s), options: yesNo(label), then: cardStep(card, 'go', data) });
};

function bonusAttackAfterMiss(card, reason) {
  return (state, owner, a) => (isAttacker(owner, a) && !a.hit && !a.bonus && !a.second && !owner.round.noMoreAttacks
    ? [{ t: 'bonusAttack', ship: owner.id, only: ['primary'], reason, bonusFrom: card }] : []);
}

export default {
  // ---------------- drones ----------------
  nav_drone: { maneuverColor: (state, ship, m, c) => (m.speed <= 2 ? 'g' : c) },
  repair_drone: {
    afterManeuver(state, ship, color) {
      if (color !== 'g' || ship.shields >= stat(state, ship, 'maxShields')) return [];
      ship.shields++; log(state, `${shipName(ship)}'s Repair Drone restores a shield.`);
      return [];
    },
  },
  deflector_drone: {
    actions: { deflector_drone: { label: 'Deflector Drone: +1 agility this round', can: () => true,
      perform(state, ship) { ship.round.agilityBonus += 1; log(state, `${shipName(ship)}'s drone boosts its agility.`); } } },
  },
  patch_drone: {
    actions: { patch_drone: {
      label: 'Patch Drone: try to discard a facedown Damage card',
      can: (state, ship) => ship.damage.some(c => !c.faceup),
      perform(state, ship) {
        const f = rollFace(state, 'defense');
        const ok = f === 'evade' || f === 'focus';
        emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Patch Drone', success: ok, kind: 'defense' });
        if (!ok) { log(state, `${shipName(ship)}'s Patch Drone fails (${f}).`); return; }
        const i = ship.damage.findIndex(c => !c.faceup);
        const [c] = ship.damage.splice(i, 1);
        if (!c.proxy) state.damageDiscard.push(c.card);
        log(state, `${shipName(ship)}'s Patch Drone repairs 1 damage.`);
      },
    } },
  },
  tracker_drone: {
    onSpendLock(state, ship, targetId) {
      const f = rollFace(state, 'defense');
      emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Tracker Drone', success: f === 'evade', kind: 'defense' });
      const t = state.ships[targetId];
      if (f === 'evade' && t && !t.destroyed) {
        acquireLock(state, ship, t);
        if (state.attack?.attacker === ship.id) mark(state.attack, 'lock');
      }
      return [];
    },
  },
  maintenance_drone: {
    endPhase: (state, owner) => (owner.damage.some(c => c.faceup && DAMAGE_CARDS[c.card].trait === 'ship') ? [cardStep('maintenance_drone', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; if (ship.destroyed) return;
        const cards = ship.damage.filter(c => c.faceup && DAMAGE_CARDS[c.card].trait === 'ship');
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: Maintenance Drone flips which card facedown?`,
          options: cards.map(c => ({ id: String(c.uid), label: DAMAGE_CARDS[c.card].name })), then: cardStep('maintenance_drone', 'go', { ship: ship.id }) });
      },
      go(state, s) {
        const c = state.ships[s.ship].damage.find(x => String(x.uid) === s.choice);
        if (c) { c.faceup = false; log(state, `${shipName(state.ships[s.ship])} patches ${DAMAGE_CARDS[c.card].name}.`); }
      },
    },
  },
  jammer_drone: {
    options(state, owner, a, stage) {
      if (stage !== 'defOnAttack' || !isDefender(owner, a) || owner.lockOn !== a.attacker || owner.round.jammer) return [];
      if (!a.attackDice.some(d => (d.face === 'hit' || d.face === 'crit') && !d.rerolled && !d.noReroll)) return [];
      return [{ id: 'jammer', label: 'Jammer Drone: spend lock, attacker rerolls all hits/crits', apply(st, a2) {
        const me = st.ships[owner.id];
        me.round.jammer = true; spendLock(st, me);
        for (const d of a2.attackDice) if ((d.face === 'hit' || d.face === 'crit') && !d.rerolled && !d.noReroll) { d.face = rollFace(st, 'attack'); d.rerolled = true; }
        mark(a2, 'jammer');
      } }];
    },
  },
  hunter_drone: {
    actions: { hunter_drone: {
      label: 'Hunter Drone: lock an enemy that has you in its arc, then boost',
      can: (state, ship) => enemiesInRange(state, ship, 1, 2).some(e => attackGeometry(state, e, ship)),
      perform(state, ship) {
        const opts = enemiesInRange(state, ship, 1, 2).filter(e => attackGeometry(state, e, ship)).map(e => ({ id: e.id, label: shipName(e), target: e.id }));
        pick(state, { player: ship.owner, ship: ship.id, text: 'Hunter Drone: lock onto which enemy?', options: opts, then: cardStep('hunter_drone', 'go', { ship: ship.id }), skip: false });
      },
    } },
    steps: {
      go(state, s) {
        const ship = state.ships[s.ship];
        acquireLock(state, ship, state.ships[s.choice]);
        push(state, freeAction(ship, 'Hunter Drone: free boost', { only: ['boost'], grant: ['boost'] }));
      },
    },
  },
  gyro_drone: {
    onReveal: (state, ship) => (ship.round.maneuver.color === 'g' ? [freeAction(ship, 'Gyro Drone: free barrel roll', { only: ['roll'], grant: ['roll'] })] : []),
  },
  pathfinder_drone: {
    beforeReveal: (state, ship) => (state.obstacles.length ? [cardStep('pathfinder_drone', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('pathfinder_drone', (st, ship) => `${shipName(ship)}: discard Pathfinder Drone to ignore asteroids this round?`, 'Ignore asteroids'),
      go(state, s) { const ship = state.ships[s.ship]; ship.round.ignoreObstacles = true; discardUpgrade(ship, 'pathfinder_drone'); log(state, `${shipName(ship)} plots a path through the rocks.`); },
    },
  },

  // ---------------- crew ----------------
  tail_gunner: { afterAttack: bonusAttackAfterMiss('tail_gunner', 'Tail Gunner: attack again with your primary weapon') },
  ace_gunner: {
    afterAttack: bonusAttackAfterMiss('ace_gunner', 'Ace Gunner: attack again with your primary weapon'),
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.bonusFrom === 'ace_gunner' ? changeOption(a, 'ace_gunner', 'Ace Gunner', 'attack', 'focus', 'hit', 1) : []),
  },
  hired_copilot: {
    options: (state, owner, a, stage) => (stage === 'attack' && isAttacker(owner, a) && a.band === 3 ? changeOption(a, 'copilot', 'Hired Copilot', 'attack', 'hit', 'crit', 1) : []),
  },
  veteran_copilot: { maneuverColor: (state, ship, m, c) => (m.bearing === 'S' ? 'g' : c) },
  loyal_mechanic: {
    onDealt(state, ship) {
      discardUpgrade(ship, 'loyal_mechanic');
      ship.shields = Math.min(stat(state, ship, 'maxShields'), ship.shields + 1);
      log(state, `${shipName(ship)}'s Loyal Mechanic patches the damage and restores a shield.`);
      return 'discard';
    },
  },
  scout_officer: { focusGain: (state, ship, n) => n + 1 },
  demolitions_expert: {
    actions: { demolitions_expert: {
      label: 'Demolitions Expert: sabotage an enemy at Range 1',
      can: (state, ship) => enemiesInRange(state, ship, 1, 1).some(e => e.damage.some(c => !c.faceup && !c.proxy)),
      perform(state, ship) {
        const opts = enemiesInRange(state, ship, 1, 1).filter(e => e.damage.some(c => !c.faceup && !c.proxy)).map(e => ({ id: e.id, label: shipName(e), target: e.id }));
        pick(state, { player: ship.owner, ship: ship.id, text: 'Sabotage which enemy?', options: opts, then: cardStep('demolitions_expert', 'go', { ship: ship.id }), skip: false });
      },
    } },
    steps: {
      go(state, s) {
        const ship = state.ships[s.ship], t = state.ships[s.choice];
        const f = rollFace(state, 'attack');
        const ok = f === 'hit' || f === 'crit';
        emit(state, { type: 'roll', ship: ship.id, faces: [f], reason: 'Sabotage', success: ok });
        if (!ok) { log(state, `${shipName(ship)}'s sabotage fails.`); return; }
        const down = t.damage.filter(c => !c.faceup && !c.proxy);
        const c = down[randInt(state, down.length)];
        push(state, { t: 'flipFaceup', ship: t.id, uids: [c.uid] });
      },
    },
  },
  drill_instructor: {
    options(state, owner, a, stage) {
      if (stage !== 'defense' || !isDefender(owner, a)) return [];
      const low = effectiveSkill(state, state.ships[a.attacker]) <= 2;
      return rerollOptions(a, 'drill', 'Drill Instructor', 'defense', low ? ['blank', 'focus'] : ['focus'], 1);
    },
  },
  astrogator: {
    onReveal(state, ship) {
      const cur = ship.round.maneuver;
      const b = cur.key.replace(/^\d+/, '');
      const alts = dialFor(ship.chassis).filter(m => m.bearing === b && m.key !== cur.key && !(ship.stress > 0 && maneuverColor(state, ship, m) === 'r'));
      return alts.length ? [cardStep('astrogator', 'offer', { ship: ship.id })] : [];
    },
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        const cur = ship.round.maneuver, b = cur.key.replace(/^\d+/, '');
        const alts = dialFor(ship.chassis).filter(m => m.bearing === b && m.key !== cur.key && !(ship.stress > 0 && maneuverColor(state, ship, m) === 'r'));
        pick(state, { player: ship.owner, ship: ship.id, kind: 'overrideManeuver', text: `${shipName(ship)}: Astrogator can change the speed of ${cur.key}.`,
          options: alts.map(m => ({ id: m.key, label: m.key, maneuver: { ...m, color: maneuverColor(state, ship, m) } })), then: cardStep('astrogator', 'go', { ship: ship.id }), skip: `Keep ${cur.key}` });
      },
      go(state, s) {
        const ship = state.ships[s.ship];
        const m = dialFor(ship.chassis).find(x => x.key === s.choice);
        ship.round.maneuver = { key: m.key, color: maneuverColor(state, ship, m) };
        ship.round.revealed = m.key;
        log(state, `${shipName(ship)}'s Astrogator adjusts to ${m.key}.`);
      },
    },
  },
  fire_coordinator: {
    afterAttack(state, owner, a) {
      const def = defender(state, a);
      if (isAttacker(owner, a) && a.band === 2 && !def.destroyed && inArc(owner, def)) { addStress(state, def); log(state, `${shipName(def)} is rattled (+1 stress).`); }
      return [];
    },
  },

  // ---------------- systems ----------------
  fire_control: {
    afterAttack: (state, owner, a) => (isAttacker(owner, a) && !defender(state, a).destroyed && owner.lockOn !== a.defender && rangeBetween(owner, defender(state, a)).band
      ? [cardStep('fire_control', 'offer', { ship: owner.id, target: a.defender })] : []),
    steps: {
      offer: offer('fire_control', (st, ship, s) => `${shipName(ship)}: Fire Control Computer — lock onto ${shipName(st.ships[s.target])}?`, 'Acquire lock'),
      go(state, s) { const t = state.ships[s.target]; if (!t.destroyed) acquireLock(state, state.ships[s.ship], t); },
    },
  },
  longrange_scanner: {
    beforeReveal: (state, ship) => (ship.stress === 0 ? [cardStep('longrange_scanner', 'offer', { ship: ship.id })] : []),
    steps: {
      offer: offer('longrange_scanner', (st, ship) => `${shipName(ship)}: take a free action now (and skip your action step this round)?`, 'Act now'),
      go(state, s) { push(state, freeAction(state.ships[s.ship], 'Long-Range Scanner: free action', { markSkip: true })); },
    },
  },
  scrambler: {
    options(state, owner, a, stage) {
      if (stage !== 'defOnAttack' || !isDefender(owner, a) || !once(a, 'scrambler') || !count(a.attackDice, 'hit')) return [];
      return [{ id: 'scrambler', label: 'Scrambler: change 1 attacker hit → focus', apply(st, a2) {
        const d = a2.attackDice.find(x => x.face === 'hit'); d.face = 'focus'; d.noReroll = true; mark(a2, 'scrambler');
      } }];
    },
  },

  // ---------------- modifications & titles ----------------
  baffle_plating: {
    stat: (state, ship, which, v) => (which === 'agility' ? v + 1 : v),
    afterAttack(state, owner, a) {
      if (isDefender(owner, a) && a.hit) { discardUpgrade(owner, 'baffle_plating'); log(state, `${shipName(owner)}'s Baffle Plating is torn away.`); }
      return [];
    },
  },
  reinforced_shields: { stat: (state, ship, which, v) => (which === 'maxShields' ? v + 1 : v) },
  afterburners: { actionBar: (state, ship, list) => (list.includes('boost') ? list : [...list, 'boost']) },
  safety_interlock: { discardOnlyOnHit: true },
  wanderer: { keepFocus: true },
};

