// Elite talents. Hook reference: engine/hooks.js.
import { pick, cardStep, log, push, emit } from '../flow.js';
import { rollDice, count } from '../dice.js';
import { buildPath } from '../maneuvers.js';
import { basePolygon, polygonInsideBoard, polygonsIntersect } from '../geometry.js';
import { sufferDamage } from '../damage.js';
import {
  shipName, inArc, rangeBetween, friendsInRange, liveShips, effectiveSkill, actionBar,
  overlapsAnyShip, obstaclePolys, chassis,
} from '../queries.js';
import {
  defender, once, mark, rerollOptions, freeAction, addStress, attackRerollAllowed,
} from '../effects.js';

const isAttacker = (owner, a) => a.attacker === owner.id;
const isDefender = (owner, a) => a.defender === owner.id;
const shipOpts = ships => ships.map(s => ({ id: s.id, label: shipName(s), target: s.id }));

function hotdogPoses(state, ship) {
  return ['TL', 'TR'].map(b => {
    const path = buildPath(ship.pose, { speed: 1, bearing: b }, chassis(ship).size);
    const poly = basePolygon(path.final, chassis(ship).size);
    const clear = polygonInsideBoard(poly) && !overlapsAnyShip(state, poly, ship.id)
      && !obstaclePolys(state).some(o => polygonsIntersect(poly, o) || polygonsIntersect(path.templatePoly, o));
    return clear ? { id: b, label: b === 'TL' ? 'Hard left' : 'Hard right', path } : null;
  }).filter(Boolean);
}

export default {
  iron_will: {
    onDealt: (state, ship, card, faceup, def) => (faceup && def.trait === 'pilot' ? 'discard' : undefined),
  },
  pack_tactics: {
    startCombat: (state, owner) => (friendsInRange(state, owner, 1, 1).length ? [cardStep('pack_tactics', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: which wingmate fights at your pilot skill this phase?`,
          options: shipOpts(friendsInRange(state, ship, 1, 1)), then: cardStep('pack_tactics', 'go', { ship: ship.id }) });
      },
      go(state, s) {
        state.skillOverride[s.choice] = effectiveSkill(state, state.ships[s.ship]);
        log(state, `${shipName(state.ships[s.choice])} matches ${shipName(state.ships[s.ship])}'s pilot skill this phase.`);
      },
    },
  },
  wing_commander: {
    actions: {
      wing_commander: {
        label: 'Wing Commander: give a free action',
        can: (state, ship) => friendsInRange(state, ship, 1, 2).some(o => effectiveSkill(state, o) < effectiveSkill(state, ship)),
        perform(state, ship) {
          const opts = friendsInRange(state, ship, 1, 2).filter(o => effectiveSkill(state, o) < effectiveSkill(state, ship));
          pick(state, { player: ship.owner, ship: ship.id, text: 'Which wingmate gets a free action?', options: shipOpts(opts), then: cardStep('wing_commander', 'go'), skip: false });
        },
      },
    },
    steps: { go(state, s) { push(state, freeAction(state.ships[s.choice], 'Wing Commander: free action')); } },
  },
  snap_roll: {
    actions: {
      snap_roll: {
        label: 'Snap Roll: free barrel roll',
        can: (state, ship) => !ship.round.actionsUsed.includes('roll'),
        perform(state, ship) {
          push(state, freeAction(ship, 'Snap Roll: barrel roll', { only: ['roll'], grant: ['roll'] }), cardStep('snap_roll', 'after', { ship: ship.id }));
        },
      },
    },
    steps: {
      after(state, s) {
        const ship = state.ships[s.ship];
        if (!actionBar(state, ship).includes('roll')) addStress(state, ship);
        const locker = liveShips(state).find(o => o.owner !== ship.owner && o.lockOn === ship.id);
        if (locker) { locker.lockOn = null; log(state, `${shipName(ship)} shakes off ${shipName(locker)}'s lock.`); }
      },
    },
  },
  deadeye: {
    actions: {
      deadeye: { label: 'Deadeye: line up the shot', can: () => true, perform(state, ship) { ship.round.deadeye = true; log(state, `${shipName(ship)} lines up a Deadeye shot.`); } },
    },
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !owner.round.deadeye || !once(a, 'deadeye') || !count(a.attackDice, 'focus')) return [];
      return [{ id: 'deadeye', label: 'Deadeye: 1 focus → crit, rest → hit', apply(st, a2) {
        let first = true;
        for (const d of a2.attackDice) if (d.face === 'focus') { d.face = first ? 'crit' : 'hit'; first = false; }
        mark(a2, 'deadeye');
      } }];
    },
  },
  hotdog: {
    actions: {
      hotdog: {
        label: 'Hotdog: hard 1-turn',
        can: (state, ship) => hotdogPoses(state, ship).length > 0,
        perform(state, ship) {
          pick(state, { player: ship.owner, ship: ship.id, kind: 'hotdog', text: 'Hotdog: which way?',
            options: hotdogPoses(state, ship).map(p => ({ id: p.id, label: p.label, pose: p.path.final })), then: cardStep('hotdog', 'go', { ship: ship.id }), skip: false });
        },
      },
    },
    steps: {
      go(state, s) {
        const ship = state.ships[s.ship];
        const p = hotdogPoses(state, ship).find(x => x.id === s.choice); if (!p) return;
        const samples = []; for (let i = 0; i <= 16; i++) samples.push(p.path.poseAt(-p.path.base + ((p.path.length + p.path.base) * i) / 16));
        emit(state, { type: 'move', ship: ship.id, path: samples });
        ship.pose = p.path.final;
        state.touches = state.touches.filter(([x, y]) => x !== ship.id && y !== ship.id);
        log(state, `${shipName(ship)} pulls a hotdog turn!`);
        addStress(state, ship);
        if (!actionBar(state, ship).includes('boost')) {
          const dice = rollDice(state, 'attack', 2).map(d => d.face);
          emit(state, { type: 'roll', ship: ship.id, faces: dice, reason: 'Hotdog strain' });
          sufferDamage(state, ship, dice.filter(f => f === 'hit').length, dice.filter(f => f === 'crit').length);
        }
      },
    },
  },
  slippery: {
    options(state, owner, a, stage) {
      if (stage !== 'defOnAttack' || !isDefender(owner, a) || owner.stress > 0 || !once(a, 'slippery')) return [];
      const dice = a.attackDice.filter(d => (d.face === 'crit' || d.face === 'hit') && !d.rerolled && !d.noReroll);
      if (!dice.length) return [];
      return [{ id: 'slippery', label: 'Slippery: take 1 stress, attacker rerolls 1 hit/crit', apply(st, a2) {
        const d = a2.attackDice.find(x => x.face === 'crit' && !x.rerolled && !x.noReroll) || a2.attackDice.find(x => x.face === 'hit' && !x.rerolled && !x.noReroll);
        if (d) { d.face = rollDice(st, 'attack', 1)[0].face; d.rerolled = true; }
        addStress(st, st.ships[owner.id]); mark(a2, 'slippery');
      } }];
    },
  },
  redline: {
    afterAction(state, ship, action) {
      if (ship.round.redline || action.startsWith('repair:')) return [];
      ship.round.redline = true;
      return [freeAction(ship, 'Redline: free action (then take 1 stress)', { only: actionBar(state, ship), stressAfter: true })];
    },
  },
  improviser: { lockCostAsFocus: true },
  all_in: {
    actions: {
      all_in: { label: 'All In: +1 attack, −1 agility this round', can: () => true,
        perform(state, ship) { ship.round.attackBonus = (ship.round.attackBonus || 0) + 1; ship.round.agilityBonus -= 1; log(state, `${shipName(ship)} goes all in.`); } },
    },
  },
  battle_reflexes: { stat: (state, ship, which, v) => (which === 'skill' ? v + 2 : v) },
  take_the_hit: {
    options(state, owner, a, stage) {
      if (stage !== 'onHit' || isDefender(owner, a) || defender(state, a).owner !== owner.owner || !a.result || a.result.crits < 1 || !once(a, 'tth')) return [];
      if (rangeBetween(owner, defender(state, a)).band !== 1) return [];
      return [{ id: 'tth', label: `Take the Hit: ${shipName(owner)} suffers 1 critical instead`, apply(st, a2) { a2.result.crits--; a2.redirect = { ship: owner.id, crits: 1 }; mark(a2, 'tth'); } }];
    },
  },
  adrenaline_surge: {
    onReveal: (state, ship, m) => (ship.round.maneuver.color === 'r' ? [cardStep('adrenaline_surge', 'offer', { ship: ship.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)} revealed a red maneuver. Discard Adrenaline Surge to fly it white?`,
          options: [{ id: 'yes', label: 'Fly it white' }], then: cardStep('adrenaline_surge', 'go', { ship: ship.id }), skip: 'Keep the card' });
      },
      go(state, s) {
        const ship = state.ships[s.ship];
        ship.round.maneuver.color = 'w';
        ship.upgrades.find(u => u.id === 'adrenaline_surge' && !u.discarded).discarded = true;
        log(state, `${shipName(ship)} rides an adrenaline surge.`);
      },
    },
  },
  steady_wingmate: {
    startCombat: (state, owner) => (friendsInRange(state, owner, 1, 1).some(o => o.stress > 0) ? [cardStep('steady_wingmate', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: remove a stress token from which wingmate?`,
          options: shipOpts(friendsInRange(state, ship, 1, 1).filter(o => o.stress > 0)), then: cardStep('steady_wingmate', 'go') });
      },
      go(state, s) { const t = state.ships[s.choice]; if (t.stress) t.stress--; log(state, `${shipName(t)} calms down (−1 stress).`); },
    },
  },
  swap_signal: {
    startCombat: (state, owner) => (friendsInRange(state, owner, 1, 2).length ? [cardStep('swap_signal', 'offer', { ship: owner.id })] : []),
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: swap pilot skill with a wingmate this phase?`,
          options: friendsInRange(state, ship, 1, 2).map(o => ({ id: o.id, label: `${shipName(o)} (skill ${effectiveSkill(state, o)})`, target: o.id })),
          then: cardStep('swap_signal', 'go', { ship: ship.id }) });
      },
      go(state, s) {
        const a = state.ships[s.ship], b = state.ships[s.choice];
        const sa = effectiveSkill(state, a), sb = effectiveSkill(state, b);
        state.skillOverride[a.id] = sb; state.skillOverride[b.id] = sa;
        log(state, `${shipName(a)} and ${shipName(b)} swap pilot skill (${sb} / ${sa}).`);
      },
    },
  },
  flank_angle: {
    defenseDice(state, owner, a, n) {
      if (!isAttacker(owner, a)) return n;
      const def = defender(state, a);
      return inArc(owner, def) && !inArc(def, owner) ? n - 1 : n;
    },
  },
  hunters_eye: {
    options(state, owner, a, stage) {
      if (stage !== 'attack' || !isAttacker(owner, a) || !attackRerollAllowed(state, a)) return [];
      const n = effectiveSkill(state, defender(state, a)) <= 2 ? 2 : 1;
      return rerollOptions(a, 'hunters_eye', 'Hunter’s Eye', 'attack', ['blank', 'focus'], n);
    },
  },
  live_wire: {
    options(state, owner, a, stage) {
      if (owner.stress < 1) return [];
      if (stage === 'attack' && isAttacker(owner, a) && attackRerollAllowed(state, a)) return rerollOptions(a, 'live_wire', 'Live Wire', 'attack', ['focus'], Infinity);
      if (stage === 'defense' && isDefender(owner, a)) return rerollOptions(a, 'live_wire', 'Live Wire', 'defense', ['focus'], Infinity);
      return [];
    },
  },
};

