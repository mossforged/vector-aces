// Headless engine tests:  node tests/run.mjs
import assert from 'node:assert/strict';
import { newGame, applyAction, Q, G, buildPath, waitingOn } from '../src/engine/index.js';
import { PRESET_SQUADS } from '../src/data/presets.js';
import { botAction } from '../src/ai/simpleBot.js';

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name); throw e; } };
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

function mulberry(seed) { return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log('geometry');
test('straight 1 moves base + 40mm', () => {
  const p = buildPath({ x: 400, y: 800, h: 0 }, { speed: 1, bearing: 'S' }).final;
  near(p.x, 400); near(p.y, 800 - 40 - 40); near(p.h, 0);
});
test('turn right 1 ends rotated 90°', () => {
  const p = buildPath({ x: 400, y: 800, h: 0 }, { speed: 1, bearing: 'TR' }).final;
  near(p.h, Math.PI / 2); assert.ok(p.x > 400 && p.y < 800);
});
test('bank left 2 ends rotated -45°', () => {
  const p = buildPath({ x: 400, y: 800, h: 0 }, { speed: 2, bearing: 'BL' }).final;
  near(p.h, -Math.PI / 4); assert.ok(p.x < 400);
});
test('K-turn flips heading', () => {
  const p = buildPath({ x: 400, y: 800, h: 0 }, { speed: 4, bearing: 'K' }).final;
  near(p.h, Math.PI); near(p.y, 800 - 40 - 160);
});
test('range bands', () => {
  assert.equal(G.bandFor(0), 1); assert.equal(G.bandFor(100), 1); assert.equal(G.bandFor(100.5), 2);
  assert.equal(G.bandFor(300), 3); assert.equal(G.bandFor(301), null);
});

console.log('rules');
const intro = { league: PRESET_SQUADS.league.intro.ships, dominion: PRESET_SQUADS.dominion.intro.ships };

test('setup: initiative and deployment order', () => {
  const s = newGame({ seed: 1, squads: intro });
  assert.equal(s.initiative, 'dominion'); // 28 vs 28 → default faction
  assert.equal(s.prompt.kind, 'deploy');
  const lowest = Math.min(...Object.values(s.ships).map(x => Q.pilot(x).skill));
  assert.equal(Q.pilot(s.ships[s.prompt.ship]).skill, lowest); // lowest skill first
});

function deployAll(s) {
  while (s.prompt?.kind === 'deploy') ({ state: s } = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }));
  return s;
}

test('deploy outside zone is rejected', () => {
  const s = newGame({ seed: 2, squads: intro });
  const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'place', payload: { x: 400, y: 400, h: 0 } });
  assert.ok(r.error); assert.equal(r.state, s);
});

test('wrong player cannot answer', () => {
  const s = newGame({ seed: 2, squads: intro });
  const other = s.prompt.player === 'league' ? 'dominion' : 'league';
  assert.ok(applyAction(s, { type: 'CHOOSE', player: other, choice: 'auto' }).error);
});

test('planning waits for both, then activates lowest skill first', () => {
  let s = deployAll(newGame({ seed: 3, squads: intro }));
  assert.equal(s.phase, 'planning');
  assert.deepEqual(waitingOn(s).sort(), ['dominion', 'league']);
  const dials = p => Object.fromEntries(Q.liveShips(s).filter(x => x.owner === p).map(x => [x.id, '2S']));
  ({ state: s } = applyAction(s, { type: 'SUBMIT_DIALS', player: 'league', dials: dials('league') }));
  assert.equal(s.phase, 'planning');
  ({ state: s } = applyAction(s, { type: 'SUBMIT_DIALS', player: 'dominion', dials: dials('dominion') }));
  assert.equal(s.phase, 'activation');
  assert.equal(s.prompt.kind, 'action');
  assert.equal(Q.pilot(s.ships[s.prompt.ship]).skill, Math.min(...Object.values(s.ships).map(x => Q.pilot(x).skill)));
});

test('red maneuver gives stress; stressed ship has no actions', () => {
  let s = deployAll(newGame({ seed: 4, squads: intro }));
  const lancer = Q.liveShips(s).find(x => x.owner === 'league');
  const d = { league: { [lancer.id]: '4K' }, dominion: Object.fromEntries(Q.liveShips(s).filter(x => x.owner === 'dominion').map(x => [x.id, '1TL'])) };
  ({ state: s } = applyAction(s, { type: 'SUBMIT_DIALS', player: 'league', dials: d.league }));
  ({ state: s } = applyAction(s, { type: 'SUBMIT_DIALS', player: 'dominion', dials: d.dominion }));
  let guard = 0;
  while (s.phase === 'activation' && guard++ < 20) ({ state: s } = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: s.prompt.options.at(-1).id }));
  assert.equal(s.ships[lancer.id].stress, 1);
  near(s.ships[lancer.id].pose.h, Math.PI);
});

test('determinism: same seed + same actions = same state', () => {
  const run = () => { let s = newGame({ seed: 99, squads: intro }); const rng = mulberry(5);
    for (let i = 0; i < 400 && !s.winner; i++) { const p = waitingOn(s)[0]; const a = botAction(s, p, rng); s = applyAction(s, a).state; } return s; };
  const a = run(), b = run();
  delete a.events; delete b.events;
  assert.deepEqual(a, b);
});

function placeAt(s, poses) { // poses: shipId -> pose, applied in prompt order
  while (s.prompt?.kind === 'deploy') {
    const id = s.prompt.ship;
    const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' });
    s = r.state; s.ships[id].pose = { ...poses[id] }; // teleport for test set-ups
  }
  return s;
}
function playRound(s, dials, pick = () => null) {
  for (const p of s.playerOrder) {
    const mine = Object.fromEntries(Object.entries(dials).filter(([id]) => s.ships[id].owner === p && !s.ships[id].destroyed));
    ({ state: s } = applyAction(s, { type: 'SUBMIT_DIALS', player: p, dials: mine }));
  }
  let guard = 0;
  while (s.prompt && s.prompt.kind !== 'planning' && guard++ < 50) {
    const c = pick(s) ?? s.prompt.options.at(-1).id;
    const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: c });
    assert.ok(!r.error, r.error); s = r.state;
  }
  return s;
}

test('bump: mover backs off, touches, skips its action', () => {
  const duel = { league: [{ pilot: 'fledgling' }], dominion: [{ pilot: 'cadet' }] };
  let s = placeAt(newGame({ seed: 7, squads: duel }), { s1: { x: 400, y: 600, h: 0 }, s2: { x: 400, y: 480, h: Math.PI } });
  let cadetActed = false;
  s = playRound(s, { s1: '1BL', s2: '2S' }, st => { if (st.prompt.kind === 'action' && st.prompt.ship === 's2') cadetActed = true; return null; });
  assert.equal(cadetActed, false);
  assert.ok(s.log.some(l => /bumps into/.test(l.text)));
});

test('arc, range bands and obstruction geometry', () => {
  const duel = { league: [{ pilot: 'fledgling' }], dominion: [{ pilot: 'cadet' }] };
  let s = placeAt(newGame({ seed: 8, squads: duel }), { s1: { x: 400, y: 700, h: 0 }, s2: { x: 400, y: 630, h: Math.PI } });
  let g = Q.attackGeometry(s, s.ships.s1, s.ships.s2);
  assert.equal(g.band, 1);
  s.ships.s2.pose = { x: 400, y: 420, h: 0 };      // 240mm gap → range 3
  g = Q.attackGeometry(s, s.ships.s1, s.ships.s2);
  assert.equal(g.band, 3);
  assert.equal(Q.attackGeometry(s, s.ships.s2, s.ships.s1), null); // s2 faces away
  s.obstacles.push({ id: 'o1', shape: 0, x: 400, y: 560, rot: 0 });
  assert.equal(Q.attackGeometry(s, s.ships.s1, s.ships.s2).obstructed, true);
  s.ships.s2.pose = { x: 700, y: 650, h: 0 };      // off to the side → out of arc
  assert.equal(Q.attackGeometry(s, s.ships.s1, s.ships.s2), null);
});

console.log('simulation');
test('500 bot games finish without errors (with obstacles, both squad sizes)', () => {
  let rounds = 0, finished = 0, errors = 0;
  for (let g = 0; g < 500; g++) {
    const big = g % 2 === 0;
    const squads = big ? { league: PRESET_SQUADS.league.duo.ships, dominion: PRESET_SQUADS.dominion.swarm.ships } : intro;
    let s = newGame({ seed: g + 1000, squads, obstacles: g % 3 !== 0 });
    const rng = mulberry(g);
    for (let i = 0; i < 4000 && !s.winner; i++) {
      const p = waitingOn(s)[0];
      const a = botAction(s, p, rng);
      const r = applyAction(s, a);
      if (r.error) { errors++; throw new Error(`game ${g}: ${r.error} on ${JSON.stringify(a)} prompt=${s.prompt?.kind}`); }
      s = r.state;
      if (s.round > 40) break;
    }
    rounds += s.round;
    if (s.winner) finished++;
    // invariants
    for (const sh of Object.values(s.ships)) {
      assert.ok(sh.shields >= 0 && sh.stress >= 0 && sh.tokens.focus >= 0 && sh.tokens.evade >= 0);
      if (!sh.destroyed) assert.ok(Q.hullDamage(sh) < Q.chassis(sh).hull || sh.pendingDestroy);
    }
  }
  console.log(`    ${finished}/500 finished, avg ${(rounds / 500).toFixed(1)} rounds, ${errors} errors`);
  assert.ok(finished > 400);
});

console.log(`\n${passed} tests passed`);

console.log('network');
const { runNetTest } = await import('./net.mjs');
const n = await runNetTest(20);
console.log(`  ✓ ${n} two-client games stayed in sync with secret dials`);

await import('./mechanics.mjs');
console.log('cards');
const { runCardSim } = await import('./cards.mjs');
const sim = await runCardSim(250);
assert.equal(sim.never.length, 0, `cards never drafted: ${sim.never}`);
console.log('  ✓ 250 random-squad games ran without rule errors');
