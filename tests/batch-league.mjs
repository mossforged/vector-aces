// Tests for the trickiest "league" batch cards. Run via tests/run.mjs (or directly).
import assert from 'node:assert/strict';
import { newGame, applyAction, Q, attackOptions, validateSquad, slotsFor } from '../src/engine/index.js';
import { advance } from '../src/engine/flow.js';
import { addStress } from '../src/engine/effects.js';
import { dropOrdnance } from '../src/engine/ordnance.js';

const test = (name, fn) => { fn(); console.log('  ✓', name); };

/** Two-seat game, everything deployed at the given poses, nothing pending. */
function setup(p1, p2, poses, factions = ['league', 'dominion']) {
  let s = newGame({ seed: 5, seats: [{ faction: factions[0], squad: p1 }, { faction: factions[1], squad: p2 }] });
  while (s.prompt?.kind === 'deploy') s = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }).state;
  s.shipOrder.forEach((id, i) => { if (poses[i]) s.ships[id].pose = { ...poses[i] }; });
  s.prompt = null; s.queue = [];
  return s;
}
const choose = (s, choice) => { const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice }); assert.ok(!r.error, r.error); return r.state; };
const run = (s, ...steps) => { s.prompt = null; s.queue = steps; advance(s); return s; };
const optionIds = s => (s.prompt?.options || []).map(o => o.id);

console.log('batch: league');

test('slot-granting upgrades: Mentor Drone adds an Elite slot and respects its limits', () => {
  assert.ok(slotsFor('pip_calloway', ['mentor_drone']).includes('elite'));
  assert.deepEqual(validateSquad('league', [{ pilot: 'pip_calloway', upgrades: ['mentor_drone', 'deadeye'] }]), []);
  assert.ok(validateSquad('league', [{ pilot: 'pip_calloway', upgrades: ['deadeye'] }]).length, 'no elite slot without the drone');
  assert.ok(validateSquad('league', [{ pilot: 'dax_merrow', upgrades: ['mentor_drone'] }]).length, 'pilot already has an elite slot');
  assert.deepEqual(validateSquad('league', [{ pilot: 'bastion_squadron', upgrades: ['sabra_crew', 'proton_bombs', 'seismic_charges', 'thermal_charges'] }]), []);
});

test('Nessa Dane fires torpedoes at a ship outside her firing arc', () => {
  const s = setup([{ pilot: 'nessa_dane', upgrades: ['seeker_torpedo'] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 400, h: 0 }, { x: 400, y: 560, h: 0 }]); // enemy directly behind at Range 2
  s.ships.s1.lockOn = 's2';
  const opts = attackOptions(s, s.ships.s1);
  assert.ok(opts.some(o => o.weapon === 'seeker_torpedo'));
  assert.ok(!opts.some(o => o.weapon === 'primary'));
});

test('Servo Wings: open wings turn a revealed 3-turn into a red Tallon roll (off-dial maneuver)', () => {
  let s = setup([{ pilot: 'hollow_peak', upgrades: ['servo_wings'] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 300, y: 600, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s.phase = 'activation'; s.dials = { s1: '3TR' };
  s = run(s, { t: 'activate', ship: 's1' });
  assert.equal(s.prompt.text.includes('Servo Wings'), true); // flip offer first
  s = choose(s, 'skip');
  assert.ok(optionIds(s).includes('3TRR'));
  s = choose(s, '3TRR');
  while (s.prompt && s.prompt.kind !== 'action') s = choose(s, s.prompt.options.at(-1).id);
  assert.equal(s.ships.s1.stress, 1, 'red maneuver adds stress');
  assert.equal(Math.round(((s.ships.s1.pose.h * 180 / Math.PI) % 360 + 360) % 360), 180, 'turned 90° then rolled 90° more');
});

test('Pinned Down: the defender rolls 1 fewer die against anyone but Captain Rask', () => {
  const s = setup([{ pilot: 'captain_rask', upgrades: [] }, { pilot: 'grove_defender', upgrades: [] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 520, y: 500, h: 0 }, { x: 460, y: 300, h: Math.PI }]);
  s.ships.s3.conditions.push({ id: 'pinned_down', from: 's1' });
  s.ships.s1.round.raskAttacked = true;
  s.phase = 'combat';
  s.attack = { attacker: 's3', defender: 's2', weapon: 'primary', band: 2, used: [], bonusDice: 0, attackDice: [], defenseDice: [], dealt: [] };
  run(s, { t: 'rollAttack' });
  assert.equal(s.attack.attackDice.length, 1, 'Wasp rolls 2 − 1');
  s.attack = { attacker: 's3', defender: 's1', weapon: 'primary', band: 2, used: [], bonusDice: 0, attackDice: [], defenseDice: [], dealt: [] };
  run(s, { t: 'rollAttack' });
  assert.equal(s.attack.attackDice.length, 2, 'full dice against Rask, and the condition drops');
  assert.equal(s.ships.s3.conditions.length, 0);
});

test('Twin Turret: each hitting volley deals exactly 1 damage, and it fires twice', () => {
  let s = setup([{ pilot: 'bastion_squadron', upgrades: ['twin_turret'] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 260, h: Math.PI }]);
  s.phase = 'combat'; s.combatSkill = null;
  s = run(s, { t: 'attackStep', ship: 's1' });
  const opt = s.prompt.options.find(o => o.id.endsWith('|twin_turret'));
  assert.ok(opt, 'twin turret offered at Range 2–3');
  s = choose(s, opt.id);
  let volleys = 0, guard = 0;
  while (s.prompt && guard++ < 40) {
    if (s.prompt.kind === 'modAttack' || s.prompt.kind === 'modDefense' || s.prompt.kind === 'modAttackDef' || s.prompt.kind === 'attackPrep' || s.prompt.kind === 'onHit') s = choose(s, 'done');
    else s = choose(s, s.prompt.options.at(-1).id);
  }
  volleys = s.log.filter(l => /attacks .* at Range/.test(l.text)).length;
  assert.equal(volleys, 2);
  const lost = 3 - Q.hullDamage(s.ships.s2) + 0;
  assert.ok(Q.hullDamage(s.ships.s2) <= 2, `at most 1 damage per volley (took ${Q.hullDamage(s.ships.s2)}, ${lost})`);
});

test('Dumbfire Rockets: card dice mods are suppressed, focus still works', () => {
  const s = setup([{ pilot: 'grove_liberator', upgrades: ['dumbfire_rockets', 'grove_commandos'] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 500, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.ships.s1.tokens.focus = 1;
  s.phase = 'combat';
  s.attack = { attacker: 's1', defender: 's2', weapon: 'dumbfire_rockets', band: 2, used: [], bonusDice: 0, defenseDice: [], dealt: [],
    attackDice: [{ face: 'focus' }, { face: 'focus' }, { face: 'blank' }] };
  run(s, { t: 'atkStage', stage: 'attack' });
  assert.deepEqual(optionIds(s), ['focus', 'done']);
});

test('Captain Rhone holds back a friendly bomb that would only hit his own side', () => {
  const s = setup([{ pilot: 'captain_rhone', upgrades: ['seismic_charges'] }, { pilot: 'grove_defender', upgrades: [] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 400, h: 0 }, { x: 480, y: 470, h: 0 }, { x: 800, y: 100, h: 0 }]);
  dropOrdnance(s, s.ships.s1, 'seismic');
  run(s, { t: 'detonateBombs' });
  assert.equal(s.ordnance.length, 1, 'bomb stays on the table');
  run(s, { t: 'detonateBombs' });
  assert.equal(s.ordnance.length, 0, 'once per round: a second detonation in the same round goes off');
});

test('AX-9 coordinates a stressed wingmate: takes 2 stress, clears 1, then the wingmate acts', () => {
  let s = setup([{ pilot: 'ax9', upgrades: [] }, { pilot: 'grove_defender', upgrades: [] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 400, y: 400, h: 0 }, { x: 480, y: 400, h: 0 }, { x: 800, y: 100, h: 0 }]);
  addStress(s, s.ships.s2); s.queue = [];
  s = run(s, { t: 'actionStep', ship: 's1' });
  assert.ok(optionIds(s).includes('ax9'));
  s = choose(s, 'ax9');
  s = choose(s, 's2');
  assert.equal(s.ships.s1.stress, 2);
  assert.equal(s.ships.s2.stress, 0);
  assert.equal(s.prompt.kind, 'action');
  assert.equal(s.prompt.ship, 's2');
});
