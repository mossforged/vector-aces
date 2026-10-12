// Builds src/data/gen/<batch>.js for every batch in catalog/ from the community
// xwing-data set + our catalog.
//
//   git clone --depth 1 https://github.com/guidokessels/xwing-data /tmp/xwing-data
//   node tools/xwing-import/build.mjs /tmp/xwing-data            # all batches
//   node tools/xwing-import/build.mjs /tmp/xwing-data league     # just one (others untouched)
//
// The dataset files are read as JSON (never executed). Only mechanics are copied:
// stats, actions, arcs, dials, costs, slots, weapon values, restrictions. Names, text and
// art come from catalog/*.js. Original names are written separately for the
// "original names" display toggle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as MAPS from './maps.js';
import { BATCHES } from './catalog.js';

const dataDir = path.join(process.argv[2] || '', 'data');
if (!fs.existsSync(path.join(dataDir, 'ships.js'))) {
  console.error('usage: node tools/xwing-import/build.mjs <path to xwing-data checkout> [batch]');
  process.exit(1);
}
const only = process.argv[3];
const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
const S = byId(read('ships.js')), P = byId(read('pilots.js')), U = byId(read('upgrades.js')), C = byId(read('conditions.js'));

const cats = {};
for (const b of BATCHES) cats[b] = await import(pathToFileURL(path.join(here, 'catalog', `${b}.js`)).href);

// Ship ids are global: a batch may add pilots to another batch's ship.
const shipIdByName = {};
for (const b of BATCHES) for (const [dsId, c] of Object.entries(cats[b].SHIPS)) shipIdByName[S[dsId].name] = c.id;
// Every ship has an implicit Modification slot; ships with any title card get a Title slot.
const titleShips = new Set();
for (const b of BATCHES) for (const id of Object.keys(cats[b].UPGRADES)) if (U[id].slot === 'Title') (U[id].ship || []).forEach(n => titleShips.add(n));

// "1BG" → "1BL:g"
const BEARING = { T: 'TL', B: 'BL', F: 'S', N: 'BR', Y: 'TR', K: 'K', L: 'SL', P: 'SR', E: 'TRL', R: 'TRR', A: 'RBL', S: 'RS', D: 'RBR', O: 'ST' };
function dial(codes, name) {
  return codes.map(c => {
    const speed = parseInt(c, 10), b = c.slice(String(speed).length, -1), col = c.slice(-1).toLowerCase();
    if (!BEARING[b]) throw new Error(`${name}: unsupported maneuver ${c}`);
    return `${speed}${BEARING[b]}:${col}`;
  });
}
const range = r => { const [a, b] = String(r).split('-').map(Number); return [a, b ?? a]; };

function buildBatch(cat) {
  const ships = {}, pilots = {}, upgrades = {}, conditions = {};
  for (const [dsId, c] of Object.entries(cat.SHIPS)) {
    const s = S[dsId];
    ships[c.id] = {
      id: c.id, name: c.name, factions: [...new Set(s.faction.map(f => MAPS.FACTION_MAP[f]).filter(Boolean))], size: s.size,
      attack: s.attack, agility: s.agility, hull: s.hull, shields: s.shields,
      actions: s.actions.map(a => MAPS.ACTION_MAP[a]).filter(Boolean),
      arcs: (s.firing_arcs || ['Front']).map(a => MAPS.ARC_MAP[a]).filter(Boolean),
      art: c.art || c.id,
      dial: dial(s.dial, s.name),
    };
  }
  for (const [dsId, c] of Object.entries(cat.PILOTS)) {
    const p = P[dsId];
    const ship = shipIdByName[p.ship];
    if (!ship) throw new Error(`pilot ${dsId}: ship ${p.ship} is not in any batch`);
    pilots[c.id] = {
      id: c.id, ship, faction: MAPS.FACTION_MAP[p.faction], name: c.name, skill: p.skill, cost: p.points,
      ...(p.unique ? { unique: true } : {}),
      slots: [...p.slots.map(x => MAPS.SLOT_MAP[x]).filter(Boolean), 'mod', ...(titleShips.has(p.ship) ? ['title'] : [])],
      ...(c.text ? { ability: c.id, text: c.text } : { text: '' }),
    };
  }
  for (const [dsId, c] of Object.entries(cat.UPGRADES)) {
    const u = U[dsId];
    const out = { id: c.id, slot: MAPS.SLOT_MAP[u.slot], name: c.name, cost: u.points };
    if (u.unique) out.unique = true;
    if (u.faction) out.faction = MAPS.FACTION_MAP[u.faction];
    if (u.ship) out.ships = u.ship.map(n => shipIdByName[n]).filter(Boolean);
    if (u.size) out.sizes = u.size;
    if (c.ordnance) { out.ordnance = c.ordnance; if (c.mine) out.mine = true; if (c.keep) out.keep = true; }
    if (c.weapon) {
      const [minRange, maxRange] = range(u.range);
      out.weapon = { attack: u.attack, minRange, maxRange, cost: null, spend: false, discard: false, turret: false, ...c.weapon };
    }
    out.text = c.text;
    upgrades[c.id] = out;
  }
  for (const [dsId, c] of Object.entries(cat.CONDITIONS || {})) conditions[c.id] = { id: c.id, name: c.name, text: c.text, ...(C[dsId]?.unique ? { unique: true } : {}) };
  const originals = {
    ships: Object.fromEntries(Object.entries(cat.SHIPS).map(([d, c]) => [c.id, S[d].name])),
    pilots: Object.fromEntries(Object.entries(cat.PILOTS).map(([d, c]) => [c.id, P[d].name])),
    upgrades: Object.fromEntries(Object.entries(cat.UPGRADES).map(([d, c]) => [c.id, U[d].name])),
    conditions: Object.fromEntries(Object.entries(cat.CONDITIONS || {}).map(([d, c]) => [c.id, C[d].name])),
  };
  return { ships, pilots, upgrades, conditions, originals };
}

const block = (name, obj) => `export const ${name} = {\n${Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n};\n`;
const destDir = path.join(here, '../../src/data/gen');
fs.mkdirSync(destDir, { recursive: true });

fs.writeFileSync(path.join(destDir, 'originals-static.js'), `// Original names for damage cards and upgrade slots (display toggle only). GENERATED from tools/xwing-import/maps.js.
export const DAMAGE_ORIGINALS = ${JSON.stringify(MAPS.DAMAGE_ORIGINALS, null, 1)};
export const SLOT_ORIGINALS = ${JSON.stringify(Object.fromEntries(Object.entries(MAPS.SLOT_MAP).map(([o, u]) => [u, o])), null, 1)};
`);

for (const b of BATCHES) {
  if (only && b !== only) continue;
  const r = buildBatch(cats[b]);
  const out = `// GENERATED by tools/xwing-import/build.mjs from catalog/${b}.js — do not edit by hand.
// Mechanics from the community xwing-data set (github.com/guidokessels/xwing-data).
// ORIGINALS holds the original names, used only by the "original names" display toggle.

${block('SHIPS', r.ships)}
${block('PILOTS', r.pilots)}
${block('UPGRADES', r.upgrades)}
${block('CONDITIONS', r.conditions)}
export const ORIGINALS = ${JSON.stringify(r.originals)};
`;
  fs.writeFileSync(path.join(destDir, `${b}.js`), out);
  console.log(`gen/${b}.js: ${Object.keys(r.ships).length} ships, ${Object.keys(r.pilots).length} pilots, ${Object.keys(r.upgrades).length} upgrades, ${Object.keys(r.conditions).length} conditions`);
}
