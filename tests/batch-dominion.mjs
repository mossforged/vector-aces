// Tests for the trickiest "dominion" batch cards. Run via tests/run.mjs (or directly).
import assert from 'node:assert/strict';
import { newGame, applyAction, attackOptions, validateSquad, slotsFor, entryPoints } from '../src/engine/index.js';
import { advance } from '../src/engine/flow.js';
import { stageOptions } from '../src/engine/combat.js';
import { availableActions } from '../src/engine/actions.js';
import { sufferDamage } from '../src/engine/damage.js';

const test = (name, fn) => { fn(); console.log('  ✓', name); };

function setup(p1, p2, poses, factions = ['dominion', 'league']) {
  let s = newGame({ seed: 9, seats: [{ faction: factions[0], squad: p1 }, { faction: factions[1], squad: p2 }] });
  while (s.prompt?.kind === 'deploy') s = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }).state;
  s.shipOrder.forEach((id, i) => { if (poses[i]) s.ships[id].pose = { ...poses[i] }; });
  s.prompt = null; s.queue = [];
  return s;
}
const choose = (s, choice) => { const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice }); assert.ok(!r.error, r.error); return r.state; };
const run = (s, ...steps) => { s.prompt = null; s.queue = steps; advance(s); return s; };
const attack = (s, atk, def, extra = {}) => ({ attacker: atk, defender: def, weapon: 'primary', band: 2, used: [], bonusDice: 0, attackDice: [], defenseDice: [], dealt: [], arc: 'front', ...extra });
const ids = opts => opts.map(o => o.id);

console.log('batch: dominion');

test('squad rules: Hornet Mk. X discounts the System it adds; Mantis X7 strips cannon and missile slots', () => {
  assert.equal(entryPoints({ pilot: 'cmdr_alvos', upgrades: ['hornet_mkx', 'fire_control'] }), 25 + 0 + 0);
  assert.deepEqual(validateSquad('dominion', [{ pilot: 'cmdr_alvos', upgrades: ['hornet_mkx', 'fire_control'] }]), []);
  const slots = slotsFor('varek_stoll', ['mantis_x7']);
  assert.ok(!slots.includes('cannon') && !slots.includes('missile') && slots.includes('elite'));
  assert.ok(validateSquad('dominion', [{ pilot: 'varek_stoll', upgrades: ['mantis_x7', 'ion_projector'] }]).length);
});

test('“Sigma Lead”: an enemy it has locked cannot modify dice attacking it', () => {
  const s = setup([{ pilot: 'sigma_lead', upgrades: [] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.ships.s1.lockOn = 's2'; s.ships.s2.tokens.focus = 1; s.phase = 'combat';
  s.attack = attack(s, 's2', 's1', { attackDice: [{ face: 'focus' }, { face: 'blank' }] });
  assert.deepEqual(stageOptions(s, 'attack').options, []);
  s.ships.s1.lockOn = null;
  assert.ok(ids(stageOptions(s, 'attack').options).includes('focus'));
});

test('Corvin Drax: enemies at Range 1 lose focus/evade actions and token spending', () => {
  const s = setup([{ pilot: 'corvin_drax', upgrades: [] }], [{ pilot: 'azure_novice', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 430, h: Math.PI }]);
  const acts = ids(availableActions(s, s.ships.s2));
  assert.ok(!acts.includes('focus') && acts.includes('lock'));
  s.ships.s2.tokens.focus = 1; s.phase = 'combat';
  s.attack = attack(s, 's2', 's1', { band: 1, attackDice: [{ face: 'focus' }] });
  assert.ok(!ids(stageOptions(s, 'attack').options).includes('focus'));
});

test('Quick Shot fires at an enemy that just finished its maneuver in front of you, but not in combat', () => {
  let s = setup([{ pilot: 'lash', upgrades: ['quick_shot'] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 600, h: 0 }, { x: 400, y: 540, h: Math.PI }]);
  s.phase = 'combat';
  assert.ok(!attackOptions(s, s.ships.s1).some(o => o.weapon === 'quick_shot'), 'not a normal combat weapon');
  s.phase = 'activation'; s.dials = { s2: '1S' };
  s.ships.s2.pose = { x: 400, y: 420, h: Math.PI }; // flies 1-straight towards the Wasp, ending at Range 1 in its arc
  s = run(s, { t: 'move', ship: 's2', key: '1S', color: 'w' });
  while (s.prompt && !/Quick Shot/.test(s.prompt.text)) s = choose(s, s.prompt.options.at(-1).id);
  assert.ok(s.prompt, 'Quick Shot offered');
  s = choose(s, 'yes');
  assert.ok(s.prompt.options.some(o => o.id === 's2|quick_shot'));
});

test('Fire Link: a wingmate fires a lock weapon at a ship the Fire Link ship has locked', () => {
  const s = setup([{ pilot: 'delta_lead', upgrades: ['fire_link'] }, { pilot: 'mu_squadron', upgrades: ['seeker_torpedo'] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 300, y: 600, h: 0 }, { x: 420, y: 600, h: 0 }, { x: 420, y: 380, h: Math.PI }]);
  assert.ok(!attackOptions(s, s.ships.s2).some(o => o.weapon === 'seeker_torpedo'));
  s.ships.s1.lockOn = 's3';
  assert.ok(attackOptions(s, s.ships.s2).some(o => o.weapon === 'seeker_torpedo'));
});

test('Dark Mark: the next critical in an attack is replaced by the held Pilot card', () => {
  const s = setup([{ pilot: 'vorrak', upgrades: [] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.ships.s2.conditions.push({ id: 'dark_mark', from: 's1', card: 'blinded' });
  s.ships.s2.shields = 0;
  s.attack = attack(s, 's1', 's2');
  sufferDamage(s, s.ships.s2, 0, 1);
  assert.ok(s.ships.s2.damage.some(c => c.card === 'blinded' && c.faceup));
  assert.equal(s.ships.s2.conditions.length, 0);
});

test('The Interrogator’s Range 3 primary attack counts as Range 1 (+1 die, no defense bonus)', () => {
  const s = setup([{ pilot: 'interrogator', upgrades: [] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 600, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.attack = attack(s, 's1', 's2', { band: 3 });
  run(s, { t: 'rollAttack' });
  assert.equal(s.attack.attackDice.length, 3);
  run(s, { t: 'rollDefense' });
  assert.equal(s.attack.defenseDice.length, 1, 'Ironwood agility 1, no Range 3 bonus');
});

test('Kesta Morne strips the defender’s blanks and focus results in the attacker-modifies-defense step', () => {
  const s = setup([{ pilot: 'lt_kesta_morne', upgrades: [] }], [{ pilot: 'grove_defender', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.ships.s1.tokens.focus = 1;
  s.attack = attack(s, 's1', 's2', { attackDice: [{ face: 'hit' }], defenseDice: [{ face: 'focus' }, { face: 'blank' }, { face: 'evade' }] });
  const o = stageOptions(s, 'atkOnDefense').options.find(x => x.id === 'kesta');
  assert.ok(o);
  o.apply(s, s.attack);
  assert.deepEqual(s.attack.defenseDice.map(d => d.face), ['evade']);
  assert.equal(s.ships.s1.tokens.focus, 0);
});
