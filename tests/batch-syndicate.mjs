// Tests for the trickiest "syndicate" batch cards. Run via tests/run.mjs (or directly).
import assert from 'node:assert/strict';
import { newGame, applyAction, Q, validateSquad, entryPoints } from '../src/engine/index.js';
import { advance } from '../src/engine/flow.js';
import { stageOptions } from '../src/engine/combat.js';
import { sufferDamage, destroyShip } from '../src/engine/damage.js';
import { dropOrdnance } from '../src/engine/ordnance.js';

const test = (name, fn) => { fn(); console.log('  ✓', name); };

function setup(p1, p2, poses, factions = ['syndicate', 'league']) {
  let s = newGame({ seed: 13, seats: [{ faction: factions[0], squad: p1 }, { faction: factions[1], squad: p2 }] });
  while (s.prompt?.kind === 'deploy') s = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }).state;
  s.shipOrder.forEach((id, i) => { if (poses[i]) s.ships[id].pose = { ...poses[i] }; });
  s.prompt = null; s.queue = [];
  return s;
}
const choose = (s, choice) => { const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice }); assert.ok(!r.error, r.error); return r.state; };
const run = (s, ...steps) => { s.prompt = null; s.queue = steps; advance(s); return s; };
const attack = (atk, def, extra = {}) => ({ attacker: atk, defender: def, weapon: 'primary', band: 2, used: [], bonusDice: 0, attackDice: [], defenseDice: [], dealt: [], arc: 'front', ...extra });

console.log('batch: syndicate');

test('squad rules: Heavy Gnat adds ONE of cannon/torpedo/missile; Gilded Raptor discounts; Fog Stalker needs a Tractor Projector', () => {
  assert.deepEqual(validateSquad('syndicate', [{ pilot: 'seressa', upgrades: ['heavy_gnat', 'wrecker_cannon'] }]), []);
  assert.ok(validateSquad('syndicate', [{ pilot: 'seressa', upgrades: ['heavy_gnat', 'wrecker_cannon', 'seeker_torpedo'] }]).length);
  assert.equal(entryPoints({ pilot: 'comet_ace', upgrades: ['gilded_raptor', 'deadeye', 'shock_missiles'] }), 23 + 0 + (3 - 1) + (4 - 1));
  assert.ok(validateSquad('syndicate', [{ pilot: 'zukas', upgrades: ['fog_stalker'] }]).length);
  assert.deepEqual(validateSquad('syndicate', [{ pilot: 'zukas', upgrades: ['fog_stalker', 'tractor_projector'] }]), []);
});

test('Heavy Gnat / Armor Plating raise the hull a ship can take', () => {
  const s = setup([{ pilot: 'freeport_spacer', upgrades: ['heavy_gnat'] }], [{ pilot: 'azure_novice', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 800, y: 100, h: 0 }]);
  s.phase = 'activation';
  sufferDamage(s, s.ships.s1, 3, 0); // 1 shield + 2 hull (chassis hull 2)
  assert.ok(!s.ships.s1.destroyed, 'survives with 2 damage thanks to +1 hull');
  sufferDamage(s, s.ships.s1, 1, 0);
  assert.ok(s.ships.s1.destroyed);
});

test('Tweek (Mimicked) borrows an enemy pilot ability', () => {
  let s = setup([{ pilot: 'tweek', upgrades: [] }], [{ pilot: 'ironbark', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 400, h: Math.PI }]);
  s.round = 1; s.phase = 'activation';
  s = run(s, { t: 'card:tweek:pickEnemy', ship: 's1' });
  s = choose(s, 's2');
  s = choose(s, 'mimicked');
  assert.equal(s.ships.s1.tweek.ability, 'ironbark');
  s.ships.s1.shields = 0; s.ships.s1.damage.push({ card: 'direct_hit', faceup: false, round: 1, uid: 999 });
  s.attack = attack('s1', 's2', { band: 2 });
  run(s, { t: 'rollAttack' });
  assert.equal(s.attack.attackDice.length, 3 + 1, 'Adder 3 dice + Ironbark’s bonus die');
});

test('Spite Charge damages every ship at Range 1 when its ship is destroyed', () => {
  const s = setup([{ pilot: 'saltreef_pirate', upgrades: ['spite_charge'] }, { pilot: 'freeport_spacer', upgrades: [] }], [{ pilot: 'azure_novice', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 100, y: 800, h: 0 }, { x: 400, y: 440, h: 0 }]);
  const before = s.ships.s3.shields;
  destroyShip(s, s.ships.s1); advance(s);
  assert.equal(s.ships.s3.shields, before - 1);
});

test('Greel: the first Damage card dealt by its first attack of the round is faceup', () => {
  const s = setup([{ pilot: 'dace_bonner', upgrades: ['greel'] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  const def = s.ships.s2; def.shields = 0;
  s.attack = attack('s1', 's2');
  sufferDamage(s, def, 2, 0, { attacker: s.ships.s1, track: s.attack.dealt });
  const dealt = s.events.filter(e => e.type === 'damage' && e.ship === 's2');
  assert.deepEqual(dealt.slice(0, 2).map(e => e.faceup), [true, false], 'first card faceup, second facedown');
});

test('Unit Q-7 (crew) pins a defender token for the attack and hands it back afterwards', () => {
  const s = setup([{ pilot: 'zukas', upgrades: ['unit_q7_crew'] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.ships.s2.tokens.evade = 1;
  s.attack = attack('s1', 's2', { attackDice: [{ face: 'hit' }] });
  const o = stageOptions(s, 'attack').options.find(x => x.id === 'q7:evade');
  o.apply(s, s.attack);
  assert.equal(s.ships.s2.tokens.evade, 0);
  assert.equal(s.ships.s1.ion, 1);
  run(s, { t: 'afterAttack' });
  assert.equal(s.ships.s2.tokens.evade, 1);
});

test('Captain Rhone (Syndicate) ignores friendly bombs', () => {
  const s = setup([{ pilot: 'captain_rhone_syn', upgrades: ['seismic_charges'] }], [{ pilot: 'azure_novice', upgrades: [] }],
    [{ x: 400, y: 400, h: 0 }, { x: 420, y: 520, h: 0 }]);
  const mine = s.ships.s1.shields, theirs = s.ships.s2.shields;
  dropOrdnance(s, s.ships.s1, 'seismic');
  run(s, { t: 'detonateBombs' });
  assert.equal(s.ships.s1.shields, mine);
  assert.equal(s.ships.s2.shields, theirs - 1);
});
