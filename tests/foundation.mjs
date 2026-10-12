// Tests for the "all small ships" foundation: new maneuvers, arcs, actions, tokens, bombs, mines, seats.
// Uses a test-only chassis injected into the data tables (no real ship has every feature).
import assert from 'node:assert/strict';
import { newGame, applyAction, Q, attackOptions } from '../src/engine/index.js';
import { STEPS, advance } from '../src/engine/flow.js';
import { SHIPS } from '../src/data/ships.js';
import { PILOTS } from '../src/data/pilots.js';
import { buildPath } from '../src/engine/maneuvers.js';
import { dropOrdnance } from '../src/engine/ordnance.js';
import { applyTractor } from '../src/engine/effects.js';

const results = [];
const test = (name, fn) => { fn(); results.push(name); console.log('  ✓', name); };
const near = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const deg = h => Math.round(((h * 180 / Math.PI) % 360 + 360) % 360);

SHIPS.testbird = {
  id: 'testbird', name: 'Testbird', factions: ['league'], size: 'small', attack: 3, agility: 2, hull: 9, shields: 0,
  actions: ['focus', 'slam', 'cloak', 'reload', 'jam', 'coordinate', 'reinforce'], arcs: ['front', 'rear'], art: 'generic',
  dial: ['1S:w', '2S:g', '3SL:r', '3TRR:r', '1RS:r', '0ST:r', '2BL:w', '2BR:w'],
};
PILOTS.test_ace = { id: 'test_ace', ship: 'testbird', faction: 'league', name: 'Test Ace', skill: 5, cost: 20, slots: ['torpedo', 'bomb', 'bomb'], text: '' };
PILOTS.test_wing = { id: 'test_wing', ship: 'testbird', faction: 'league', name: 'Test Wing', skill: 2, cost: 18, slots: [], text: '' };

/** Two-seat game with given squads, everything deployed at the given poses. */
function setup(p1, p2, poses, seats = ['league', 'dominion']) {
  let s = newGame({ seed: 11, seats: [{ faction: seats[0], squad: p1 }, { faction: seats[1], squad: p2 }] });
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
/** Answer prompts with their last option ("pass"/"done"/"skip") until `until(s)` or a new planning phase. */
const passUntil = (s, until) => { let g = 0; while (s.prompt && s.prompt.kind !== 'planning' && !until(s) && g++ < 60) s = choose(s, s.prompt.options.at(-1).id); return s; };
const actionPrompt = id => s => s.prompt?.kind === 'action' && s.prompt.ship === id;

console.log('foundation');

test('maneuvers: Segnor’s loop, Tallon roll, reverse and stationary end poses', () => {
  const P = { x: 400, y: 400, h: 0 };
  const loop = buildPath(P, { speed: 3, bearing: 'SL' }).final, bank = buildPath(P, { speed: 3, bearing: 'BL' }).final;
  near(loop.x, bank.x); near(loop.y, bank.y); assert.equal(deg(loop.h), 135);
  assert.equal(deg(buildPath(P, { speed: 3, bearing: 'TRR' }).final.h), 180);
  const rev = buildPath(P, { speed: 1, bearing: 'RS' }).final; near(rev.y, 480); assert.equal(deg(rev.h), 0);
  const st = buildPath(P, { speed: 0, bearing: 'ST' }).final; near(st.x, 400); near(st.y, 400);
});

test('stationary red maneuver: ship stays put and gains stress', () => {
  let s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 300, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s = dials(s, { s1: '0ST', s2: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  near(s.ships.s1.pose.x, 300); near(s.ships.s1.pose.y, 700);
  assert.equal(s.ships.s1.stress, 1);
});

test('arcs: rear auxiliary, 180°, turret and bullseye', () => {
  const s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 400, y: 500, h: 0 }, { x: 400, y: 650, h: 0 }]);
  assert.ok(attackOptions(s, s.ships.s1).some(o => o.weapon === 'primary'), 'rear arc target');
  SHIPS.testbird.arcs = ['front'];
  assert.ok(!attackOptions(s, s.ships.s1).some(o => o.weapon === 'primary'), 'no rear arc → no shot');
  s.ships.s2.pose = { x: 560, y: 420, h: 0 }; // well off to the side
  SHIPS.testbird.arcs = ['front180'];
  assert.ok(Q.attackGeometry(s, s.ships.s1, s.ships.s2));
  SHIPS.testbird.arcs = ['turret'];
  s.ships.s2.pose = { x: 400, y: 650, h: 0 };
  assert.equal(Q.attackGeometry(s, s.ships.s1, s.ships.s2).arc, 'turret');
  SHIPS.testbird.arcs = ['front', 'bullseye'];
  s.ships.s2.pose = { x: 400, y: 300, h: 0 };
  assert.ok(Q.inBullseye(s.ships.s1, s.ships.s2));
  s.ships.s2.pose = { x: 470, y: 300, h: 0 };
  assert.ok(!Q.inBullseye(s.ships.s1, s.ships.s2) && Q.inArc(s.ships.s1, s.ships.s2));
  SHIPS.testbird.arcs = ['front', 'rear'];
});

test('SLAM: second maneuver of the same speed, no further action, weapons disabled', () => {
  let s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 300, y: 750, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s = dials(s, { s1: '2S', s2: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  const y0 = s.ships.s1.pose.y;
  s = choose(s, 'slam');
  assert.ok(s.prompt.options.some(o => o.id === '2BL'));
  s.ships.s2.pose = { x: 300, y: 450, h: Math.PI }; // put a target dead ahead
  s = choose(s, '2S');
  near(s.ships.s1.pose.y, y0 - 120);
  assert.ok(!(s.prompt?.kind === 'action' && s.prompt.ship === 's1'), 'no second action step');
  s = passUntil(s, () => false);
  assert.ok(!s.log.some(l => /^Test Ace attacks/.test(l.text)), 'weapons disabled for the round');
  assert.equal(s.ships.s1.disarmed, false, 'token cleared in the End phase');
});

test('cloak: +2 agility, no attacks; decloak at the start of the next Activation phase', () => {
  let s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 300, y: 700, h: 0 }, { x: 300, y: 450, h: Math.PI }]);
  s = dials(s, { s1: '1S', s2: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  s = choose(s, 'cloak');
  assert.equal(Q.stat(s, s.ships.s1, 'agility'), 4);
  assert.equal(attackOptions(s, s.ships.s1).length, 0);
  s = passUntil(s, () => false);
  assert.equal(s.prompt.kind, 'planning');
  s = dials(s, { s1: '1S', s2: '1TR' });
  assert.equal(s.prompt.kind, 'rollPosition');
  const y0 = s.ships.s1.pose.y;
  s = choose(s, 'ahead');
  assert.equal(s.ships.s1.cloaked, false);
  near(s.ships.s1.pose.y, y0 - 120);
});

test('reload restores a spent torpedo and disables weapons', () => {
  let s = setup([{ pilot: 'test_ace', upgrades: ['seeker_torpedo'] }], [{ pilot: 'cadet' }], [{ x: 300, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s.ships.s1.upgrades[0].discarded = true;
  s = dials(s, { s1: '1S', s2: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  s = choose(s, 'reload');
  s.ships.s2.pose = { x: 300, y: 450, h: Math.PI };
  s = choose(s, 'seeker_torpedo');
  assert.equal(s.ships.s1.upgrades[0].discarded, false);
  s = passUntil(s, () => false);
  assert.ok(s.log.some(l => /reloads Seeker Torpedoes/.test(l.text)));
  assert.ok(!s.log.some(l => /^Test Ace attacks/.test(l.text)), 'weapons disabled after reloading');
});

test('jam: the jammed ship’s next focus is cancelled', () => {
  let s = setup([{ pilot: 'test_wing' }], [{ pilot: 'night_squadron' }], [{ x: 400, y: 600, h: 0 }, { x: 400, y: 420, h: Math.PI }]);
  s = dials(s, { s1: '2BL', s2: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  s = choose(s, 'jam'); s = choose(s, 's2');
  assert.equal(s.ships.s2.jam, 2);
  s = passUntil(s, actionPrompt('s2'));
  s = choose(s, 'focus');
  assert.equal(s.ships.s2.tokens.focus, 0);
  assert.equal(s.ships.s2.jam, 1);
});

test('coordinate gives a wingmate a free action', () => {
  let s = setup([{ pilot: 'test_ace' }, { pilot: 'test_wing' }], [{ pilot: 'cadet' }],
    [{ x: 300, y: 700, h: 0 }, { x: 400, y: 700, h: 0 }, { x: 700, y: 150, h: Math.PI }]);
  s = dials(s, { s1: '1S', s2: '1S', s3: '1TL' });
  s = passUntil(s, actionPrompt('s1'));
  s = choose(s, 'coordinate'); s = choose(s, 's2');
  assert.equal(s.prompt.kind, 'action'); assert.equal(s.prompt.ship, 's2');
});

test('reinforce removes a hit from attacks in the chosen half', () => {
  const s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 400, y: 600, h: 0 }, { x: 400, y: 450, h: Math.PI }]);
  s.ships.s1.round.reinforce = 'fore';
  s.attack = { attacker: 's2', defender: 's1', weapon: 'primary', band: 2, used: [], bonusDice: 0, dealt: [],
    attackDice: [{ face: 'hit' }, { face: 'hit' }], defenseDice: [] };
  STEPS.compareAttack(s);
  assert.deepEqual(s.attack.result, { hits: 1, crits: 0 });
  s.ships.s1.round.reinforce = 'aft';
  s.attack.result = null; STEPS.compareAttack(s);
  assert.deepEqual(s.attack.result, { hits: 2, crits: 0 });
});

test('tractor beam: −1 agility and the assigning player may drag the ship', () => {
  let s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 400, y: 600, h: 0 }, { x: 400, y: 300, h: Math.PI }]);
  s.prompt = null; s.queue = [];
  applyTractor(s, s.ships.s2, 'p1'); advance(s);
  assert.equal(Q.stat(s, s.ships.s2, 'agility'), 2);
  assert.equal(s.prompt.kind, 'rollPosition'); assert.equal(s.prompt.player, 'p1');
  s = choose(s, 'S');
  near(s.ships.s2.pose.y, 380); // pulled 1 straight along its own heading (it faces down the table)
});

test('bombs detonate at the end of Activation; mines when a ship flies over them', () => {
  const s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }, { pilot: 'cadet' }],
    [{ x: 400, y: 600, h: 0 }, { x: 400, y: 720, h: 0 }, { x: 750, y: 600, h: 0 }]);
  dropOrdnance(s, s.ships.s1, 'seismic');
  assert.equal(s.ordnance.length, 1);
  s.prompt = null; s.queue = [];
  STEPS.detonateBombs(s);
  assert.equal(s.ordnance.length, 0);
  assert.equal(s.ships.s2.damage.length, 1, 'ship right behind is hit');
  assert.equal(s.ships.s3.damage.length, 0, 'far ship is not');
  assert.equal(s.ships.s1.damage.length, 1, 'the dropper is in range too');
});

test('proximity mine detonates on the ship that moves onto it', () => {
  let s = setup([{ pilot: 'test_ace' }], [{ pilot: 'cadet' }], [{ x: 400, y: 500, h: 0 }, { x: 400, y: 420, h: Math.PI }]);
  dropOrdnance(s, s.ships.s1, 'prox_mine');
  const mineY = s.ordnance[0].y;
  s.ships.s1.pose = { x: 150, y: 500, h: 0 };      // dropper moves out of the way
  s = dials(s, { s1: '1S', s2: '4S' });             // cadet flies straight down across the mine
  s = passUntil(s, () => s.ordnance.length === 0 || s.round > 1);
  assert.equal(s.ordnance.length, 0, `mine at y=${mineY} should have gone off`);
  assert.ok(s.log.some(l => /Proximity mine/.test(l.text)));
});

test('mirror match: both players can pick the same faction and get distinct colours', () => {
  const s = setup([{ pilot: 'fledgling' }], [{ pilot: 'crimson_wing' }], [], ['league', 'league']);
  assert.equal(s.players.p1.faction, 'league'); assert.equal(s.players.p2.faction, 'league');
  assert.notEqual(s.players.p1.color, s.players.p2.color);
  assert.ok(['p1', 'p2'].includes(s.initiative));
});

test('120 bot games with every new action, bombs and mines run without errors', async () => {});
{
  const { botAction } = await import('../src/ai/simpleBot.js');
  const { waitingOn } = await import('../src/engine/index.js');
  let rngSeed = 7; const rng = () => ((rngSeed = (rngSeed * 16807) % 2147483647) / 2147483647);
  const bombs = ['seismic_charges', 'proton_bombs', 'ion_bombs', 'thermal_charges', 'bomblet_launcher', 'proximity_mines', 'snare_net', 'cluster_mines'];
  let finished = 0;
  for (let g = 0; g < 120; g++) {
    const b = () => bombs[Math.floor(rng() * bombs.length)];
    const p1 = [{ pilot: 'test_ace', upgrades: ['seeker_torpedo', b(), b()] }, { pilot: 'test_wing', upgrades: [] }];
    const p2 = [{ pilot: 'major_taal', upgrades: [b()] }, { pilot: 'captain_vorne', upgrades: [b()] }, { pilot: 'gash', upgrades: [] }];
    let s = newGame({ seed: 300 + g, obstacles: g % 2 === 0, seats: [{ faction: 'league', squad: p1 }, { faction: 'dominion', squad: p2 }] });
    for (let i = 0; i < 5000 && !s.winner && s.round <= 25; i++) {
      const a = botAction(s, waitingOn(s)[0], rng);
      const r = applyAction(s, a);
      if (r.error) throw new Error(`game ${g}: ${r.error} on ${JSON.stringify(a)} (prompt ${s.prompt?.kind} ${s.prompt?.text})`);
      s = r.state;
    }
    if (s.winner) finished++;
  }
  console.log(`    ${finished}/120 finished`);
}

delete SHIPS.testbird; delete PILOTS.test_ace; delete PILOTS.test_wing;
console.log(`  ${results.length} foundation tests passed`);
