// Secondary weapons. Stats (attack, range, cost, discard, turret) are data (data/upgrades.js);
// this file holds their special effects. Combat calls these through CARDS[a.weapon].weapon,
// so they work even after the card has been discarded to fire.
//   weapon.options(state, a, stage) → options      weapon.afterRollForced(state, a)
//   weapon.compare(state, a, rules)                weapon.afterAttack(state, a) → steps[]
//   weapon.ion: n (on hit: 1 damage + n ion tokens instead of normal damage)
//   weapon.noEvadeTokens: defender cannot spend evade tokens       weapon.twice: attack again
import { log } from '../flow.js';
import { count } from '../dice.js';
import { shipName, liveShips, rangeBetween, chassis } from '../queries.js';
import { changeOption, addStress, defender } from '../effects.js';

export default {
  seeker_torpedo: { weapon: { options: (state, a, stage) => (stage === 'attack' ? changeOption(a, 'w:seeker', 'Seeker Torpedoes', 'attack', 'focus', 'crit', 1) : []) } },
  breacher_torpedoes: { weapon: { options: (state, a, stage) => (stage === 'attack' ? changeOption(a, 'w:breacher', 'Breacher Torpedoes', 'attack', 'blank', 'focus', 3) : []) } },
  shrapnel_torpedoes: {
    weapon: {
      afterAttack(state, a) {
        const d = defender(state, a);
        if (!d.destroyed && chassis(d).hull <= 4) { addStress(state, d); log(state, `Shrapnel rattles ${shipName(d)} (+1 stress).`); }
        return [];
      },
    },
  },
  shock_missiles: { weapon: { options: (state, a, stage) => (stage === 'attack' ? changeOption(a, 'w:shock', 'Shock Missiles', 'attack', 'blank', 'hit', 1) : []) } },
  swarm_rockets: { weapon: { twice: true } },
  tracker_missiles: { weapon: { noEvadeTokens: true } },
  burst_missiles: {
    weapon: {
      afterAttack(state, a) {
        if (!a.hit) return [];
        const d = defender(state, a);
        const splash = liveShips(state).filter(s => s.id !== d.id && d.pose && rangeBetween(d, s).band === 1).map(s => s.id);
        return splash.length ? [{ t: 'splashDamage', ships: splash, why: 'Burst Missiles' }] : [];
      },
    },
  },
  ion_rockets: { weapon: { ion: 2 } },
  ion_projector: { weapon: { ion: 1 } },
  ion_turret: { weapon: { ion: 1 } },
  heavy_lance: {
    weapon: {
      afterRollForced(state, a) {
        if (count(a.attackDice, 'crit')) { for (const d of a.attackDice) if (d.face === 'crit') d.face = 'hit'; log(state, 'Heavy Lance Cannon: criticals become hits.'); }
      },
    },
  },
  rotary_blaster: {
    weapon: { compare(state, a, rules) { rules.uncancelableHits = count(a.attackDice, 'hit'); rules.critsFirst = true; } },
  },
  swivel_blaster: { weapon: {} },
};
