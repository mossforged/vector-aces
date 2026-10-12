// Focused tests for stage-1 mechanics and a sample of card abilities.
import assert from 'node:assert/strict';
import { newGame, applyAction, Q } from '../src/engine/index.js';
import { STEPS, advance } from '../src/engine/flow.js';
import { stageOptions } from '../src/engine/combat.js';
import { sufferDamage } from '../src/engine/damage.js';

export const results = [];
const test = (name, fn) => { fn(); results.push(name); console.log('  ✓', name); };
const d = faces => faces.map(face => ({ face, rerolled: false }));

/** Game with both squads deployed at given poses (by squad order), ready for planning. */
function setup(league, dominion, poses) {
  let s = newGame({ seed: 5, squads: { league, dominion } });
  while (s.prompt?.kind === 'deploy') s = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }).state;
  s.shipOrder.forEach((id, i) => { if (poses[i]) s.ships[id].pose = { ...poses[i] }; });
  return s;
}
const choose = (s, choice) => { const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice }); assert.ok(!r.error, r.error); return r.state; };
const dials = (s, map) => {
  for (const p of s.playerOrder) {
    const mine = Object.fromEntries(Object.entries(map).filter(([id]) => s.ships[id].owner === p));
    const r = applyAction(s, { type: 'SUBMIT_DIALS', player: p, dials: mine }); assert.ok(!r.error, r.error); s = r.state;
  }
  return s;
};
const attackCtx = (s, atk, def, extra = {}) => ({ attacker: atk, defender: def, weapon: 'primary', band: 2, obstructed: false, attackDice: [], defenseDice: [], used: [], bonusDice: 0, hit: false, dealt: [], result: null, ...extra });

console.log('mechanics');

test('boost action moves the ship along a 1-speed template', () => {
  let s = setup([{ pilot: 'testbed', upgrades: [] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 300, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s = dials(s, { s1: '2S', s2: '1TL' });
  while (s.prompt.ship !== 's1') s = choose(s, s.prompt.options.at(-1).id);
  assert.ok(s.prompt.options.some(o => o.id === 'boost'));
  const y0 = s.ships.s1.pose.y;
  s = choose(s, 'boost');
  s = choose(s, 'S');
  assert.ok(Math.abs(s.ships.s1.pose.y - (y0 - 80)) < 0.01);
});

test('ionized ship needs no dial, drifts 1 straight, and clears ion', () => {
  let s = setup([{ pilot: 'fledgling', upgrades: [] }], [{ pilot: 'cadet', upgrades: [] }],
    [{ x: 300, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s.ships.s1.ion = 1;
  const y0 = s.ships.s1.pose.y;
  s = dials(s, { s2: '1TL' });
  while (s.prompt && s.ships.s1.ion) s = choose(s, s.prompt.options.at(-1).id);
  assert.equal(s.ships.s1.ion, 0);
  assert.ok(Math.abs(s.ships.s1.pose.y - (y0 - 80)) < 0.01);
});

test('Lord Commander Vahl gets two actions', () => {
  let s = setup([{ pilot: 'fledgling', upgrades: [] }], [{ pilot: 'lord_vahl', upgrades: [] }],
    [{ x: 300, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s = dials(s, { s1: '1S', s2: '2S' });
  while (s.prompt.ship !== 's2') s = choose(s, s.prompt.options.at(-1).id);
  s = choose(s, 'focus');
  assert.equal(s.prompt.kind, 'action');
  assert.equal(s.prompt.ship, 's2');
  assert.ok(!s.prompt.options.some(o => o.id === 'focus'));
});

test('compare: rotary blaster hits cannot be canceled', () => {
  const s = setup([{ pilot: 'pike_squadron', upgrades: ['rotary_blaster'] }], [{ pilot: 'cadet', upgrades: [] }], []);
  s.attack = attackCtx(s, 's1', 's2', { weapon: 'rotary_blaster', attackDice: d(['hit', 'hit']), defenseDice: d(['evade', 'evade']) });
  STEPS.compareAttack(s);
  assert.deepEqual(s.attack.result, { hits: 2, crits: 0 });
});

test('compare: Odo Ravel keeps 1 critical through evades; ion weapons deal 1 + ion', () => {
  const s = setup([{ pilot: 'odo_ravel', upgrades: ['ion_projector'] }], [{ pilot: 'cadet', upgrades: [] }], []);
  s.attack = attackCtx(s, 's1', 's2', { attackDice: d(['crit', 'hit']), defenseDice: d(['evade', 'evade']) });
  STEPS.compareAttack(s);
  assert.deepEqual(s.attack.result, { hits: 0, crits: 1 });
  s.attack = attackCtx(s, 's1', 's2', { weapon: 'ion_projector', attackDice: d(['hit', 'hit', 'crit']), defenseDice: d([]) });
  STEPS.compareAttack(s);
  assert.deepEqual(s.attack.result, { hits: 1, crits: 0 });
  assert.equal(s.attack.ion, 1);
});

test('Ivo Strand lowers defense dice; Kestrel Vane offers focus → evade', () => {
  const s = setup([{ pilot: 'ivo_strand', upgrades: [] }, { pilot: 'kestrel_vane', upgrades: [] }], [{ pilot: 'shade_squadron', upgrades: [] }],
    [{ x: 400, y: 700, h: 0 }, { x: 600, y: 700, h: 0 }, { x: 400, y: 450, h: Math.PI }]);
  s.attack = attackCtx(s, 's1', 's3');
  STEPS.rollDefense(s);
  assert.equal(s.attack.defenseDice.length, 2); // agility 3 − 1
  s.attack = attackCtx(s, 's3', 's2', { attackDice: d(['hit']), defenseDice: d(['focus', 'blank']) });
  assert.ok(stageOptions(s, 'defense').options.some(o => o.id === 'kestrel'));
});

test('"Wraith" stops the attacker spending focus or rerolling', () => {
  const s = setup([{ pilot: 'crimson_wing', upgrades: [] }], [{ pilot: 'wraith', upgrades: [] }], []);
  s.ships.s1.tokens.focus = 1; s.ships.s1.lockOn = 's2';
  s.attack = attackCtx(s, 's1', 's2', { attackDice: d(['focus', 'blank']) });
  assert.equal(stageOptions(s, 'attack').options.length, 0);
});

test('Loyal Mechanic discards the first damage card and restores a shield', () => {
  const s = setup([{ pilot: 'courier_runner', upgrades: ['loyal_mechanic'] }], [{ pilot: 'cadet', upgrades: [] }], []);
  const ship = s.ships.s1; ship.shields = 0;
  sufferDamage(s, ship, 1, 0);
  assert.equal(ship.damage.length, 0);
  assert.equal(ship.shields, 1);
  assert.ok(ship.upgrades.find(u => u.id === 'loyal_mechanic').discarded);
});

test('Grimm Varo survives until the end of combat', () => {
  const s = setup([{ pilot: 'fledgling', upgrades: [] }], [{ pilot: 'grimm_varo', upgrades: [] }], []);
  const g = s.ships.s2; s.phase = 'combat';
  sufferDamage(s, g, 5, 0);
  assert.equal(g.destroyed, false);
  assert.equal(g.delayedDestroy, true);
  s.queue = [{ t: 'finishCombat' }]; s.prompt = null;
  STEPS.finishCombat(s);
  assert.equal(g.destroyed, true);
});

test('Reinforced Shields raises starting shields; Afterburners adds boost', () => {
  const s = setup([{ pilot: 'fledgling', upgrades: ['reinforced_shields'] }], [{ pilot: 'cadet', upgrades: ['afterburners'] }], []);
  assert.equal(s.ships.s1.shields, 3);
  assert.ok(Q.actionBar(s, s.ships.s2).includes('boost'));
});

test('Swarm Rockets attack twice', () => {
  let s = setup([{ pilot: 'fledgling', upgrades: [] }], [{ pilot: 'crescent_squadron', upgrades: ['swarm_rockets'] }],
    [{ x: 400, y: 600, h: 0 }, { x: 400, y: 450, h: Math.PI }]);
  s.ships.s1.shields = 9; s.ships.s2.lockOn = 's1';
  s.phase = 'combat'; s.prompt = null; s.combatSkill = null; s.queue = [{ t: 'attackStep', ship: 's2' }];
  advance(s);
  s = choose(s, 's1|swarm_rockets');
  let volleys = 0, guard = 0;
  while (s.prompt && guard++ < 40) { if (s.prompt.kind === 'declareAttack') break; s = choose(s, s.prompt.options.at(-1).id); }
  volleys = s.log.filter(l => /attacks .* at Range/.test(l.text)).length;
  assert.equal(volleys, 2);
});

test('every preset squad is legal and within 100 points', async () => {});
{
  const { PRESET_SQUADS } = await import('../src/data/presets.js');
  const { validateSquad } = await import('../src/engine/index.js');
  for (const [f, ps] of Object.entries(PRESET_SQUADS)) for (const [k, p] of Object.entries(ps)) {
    const errs = validateSquad(f, p.ships, 100);
    assert.deepEqual(errs, [], `${f}/${k}: ${errs.join('; ')}`);
  }
}

console.log(`  ${results.length} mechanics tests passed`);
