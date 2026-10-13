// Tests for large ships: 80 mm bases, mobile arcs, docking, the reserve fighter and tricky pilots.
import assert from 'node:assert/strict';
import { newGame, applyAction, Q } from '../src/engine/index.js';
import { advance } from '../src/engine/flow.js';
import { buildPath, barrelRollPoses } from '../src/engine/maneuvers.js';
import { availableActions } from '../src/engine/actions.js';
import { sufferDamage, destroyShip } from '../src/engine/damage.js';

const test = (name, fn) => { fn(); console.log('  ✓', name); };
const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

function setup(p1, p2, poses, factions = ['league', 'syndicate']) {
  let s = newGame({ seed: 21, seats: [{ faction: factions[0], squad: p1 }, { faction: factions[1], squad: p2 }] });
  while (s.prompt?.kind === 'deploy') s = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice: 'auto' }).state;
  const onTable = s.shipOrder.filter(id => s.ships[id].deployed);
  onTable.forEach((id, i) => { if (poses[i]) s.ships[id].pose = { ...poses[i] }; });
  s.prompt = null; s.queue = [];
  return s;
}
const choose = (s, choice) => { const r = applyAction(s, { type: 'CHOOSE', player: s.prompt.player, choice }); assert.ok(!r.error, r.error); return r.state; };
const run = (s, ...steps) => { s.prompt = null; s.queue = steps; advance(s); return s; };

console.log('batch: large ships');

test('large bases: 1-straight moves 120 mm (template + base), barrel roll shifts 120 mm sideways', () => {
  const P = { x: 400, y: 600, h: 0 };
  near(P.y - buildPath(P, { speed: 1, bearing: 'S' }, 'large').final.y, 120);
  const r = barrelRollPoses(P, 'large').find(x => x.id === 'R-centre');
  near(r.pose.x - P.x, 120);
});

test('mobile arc: the Prowler rotates its arc and can then shoot sideways', () => {
  let s = setup([{ pilot: 'azure_novice', upgrades: [] }], [{ pilot: 'shadowdock_hunter', upgrades: [] }],
    [{ x: 600, y: 400, h: 0 }, { x: 400, y: 400, h: 0 }]);
  const prowler = s.ships.s2;
  assert.ok(!Q.inArc(prowler, s.ships.s1));
  s = run(s, { t: 'actionStep', ship: 's2' });
  s = choose(s, 'rotate');
  s = choose(s, 'right');
  assert.equal(s.ships.s2.mobileArc, 'right');
  assert.ok(Q.inArc(s.ships.s2, s.ships.s1));
});

test('docking: a Skiff with Lifeboat starts docked; the Hearth gets a rear arc and can launch it', () => {
  let s = setup([{ pilot: 'hesta_vael_hearth', upgrades: ['mothership'] }, { pilot: 'sabra_wenn', upgrades: ['lifeboat'] }], [{ pilot: 'comet_soldier', upgrades: [] }],
    [{ x: 450, y: 450, h: 0 }, { x: 800, y: 100, h: 0 }]);
  const skiff = s.shipOrder.map(id => s.ships[id]).find(x => x.pilot === 'sabra_wenn');
  assert.equal(skiff.deployed, false);
  assert.ok(Q.arcsOf(s.ships.s1).includes('rear'));
  s.phase = 'activation';
  s = run(s, { t: 'move', ship: 's1', key: '1S', color: 'g' });
  while (s.prompt && !/launch/.test(s.prompt.text)) s = choose(s, s.prompt.options.at(-1).id);
  s = choose(s, s.prompt.options[0].id);
  const sk = s.ships[skiff.id];
  assert.ok(sk.deployed && sk.pose && !sk.dockedOn);
  assert.ok(sk.pose.y > s.ships.s1.pose.y, 'launched from the rear');
  assert.ok(!Q.arcsOf(s.ships.s1).includes('rear'));
});

test('Hound’s Lair: the reserve fighter launches when the Hulk dies and uses its skill', () => {
  const s = setup([{ pilot: 'azure_novice', upgrades: [] }], [{ pilot: 'brosk_pilot', upgrades: ['hounds_lair'] }],
    [{ x: 200, y: 700, h: 0 }, { x: 500, y: 300, h: Math.PI }], ['league', 'syndicate']);
  const pup = Object.values(s.ships).find(x => x.reserve);
  assert.ok(pup && !pup.deployed);
  s.phase = 'activation';
  destroyShip(s, s.ships.s2); advance(s);
  assert.ok(!s.winner, 'the reserve fighter keeps the Syndicate in the game');
  assert.ok(s.ships[pup.id].deployed);
  assert.equal(Q.effectiveSkill(s, s.ships[pup.id]), 7);
});

test('Tal Trevan survives the first fatal blow with 4 fresh facedown cards', () => {
  const s = setup([{ pilot: 'azure_novice', upgrades: [] }], [{ pilot: 'tal_trevan', upgrades: [] }, { pilot: 'contract_scout', upgrades: [] }],
    [{ x: 200, y: 700, h: 0 }, { x: 500, y: 300, h: 0 }, { x: 700, y: 200, h: 0 }]);
  const t = s.ships.s2; t.shields = 0; s.phase = 'activation';
  sufferDamage(s, t, 8, 0);
  assert.ok(!t.destroyed);
  assert.equal(t.damage.length, 4);
  sufferDamage(s, t, 1, 0);
  assert.ok(t.destroyed, 'only once');
});

test('Screen Jammer: a large ship in the line of fire obstructs the attack', () => {
  const s = setup([{ pilot: 'azure_novice', upgrades: [] }], [{ pilot: 'scaled_slaver', upgrades: ['screen_jammer'] }, { pilot: 'comet_soldier', upgrades: [] }],
    [{ x: 400, y: 700, h: 0 }, { x: 400, y: 560, h: 0 }, { x: 400, y: 420, h: 0 }]);
  const g = Q.attackGeometry(s, s.ships.s1, s.ships.s3);
  assert.ok(g && g.obstructed, 'line passes through the Hulk');
  s.ships.s2.upgrades[0].discarded = true;
  assert.equal(Q.attackGeometry(s, s.ships.s1, s.ships.s3).obstructed, false, 'no jammer, no obstruction');
});

test('Captain Kagen: enemies that lock must lock onto him if they can', () => {
  let s = setup([{ pilot: 'azure_novice', upgrades: [] }], [{ pilot: 'captain_kagen', upgrades: [] }, { pilot: 'shade_squadron', upgrades: [] }],
    [{ x: 400, y: 600, h: 0 }, { x: 250, y: 400, h: 0 }, { x: 500, y: 450, h: 0 }], ['league', 'dominion']);
  assert.ok(availableActions(s, s.ships.s1).some(a => a.id === 'lock'));
  s = run(s, { t: 'lockPrompt', ship: 's1' });
  assert.deepEqual(s.prompt.options.map(o => o.id), ['s2']);
});
