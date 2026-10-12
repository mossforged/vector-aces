// Card coverage simulation: many bot games with random squads; reports which cards
// ever appeared and which card options were ever offered. Run: node tests/cards.mjs [games]
import { newGame, applyAction, waitingOn } from '../src/engine/index.js';
import { botAction, randomSquad } from '../src/ai/simpleBot.js';
import { PILOTS } from '../src/data/pilots.js';
import { UPGRADES } from '../src/data/upgrades.js';

function mulberry(seed) { return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function runCardSim(games = 600, { quiet = false } = {}) {
  const seen = new Set(), offered = new Map();
  let finished = 0, rounds = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry(9000 + g);
    const squads = { league: await randomSquad('league', rng), dominion: await randomSquad('dominion', rng) };
    for (const f of Object.values(squads)) for (const e of f) { seen.add(e.pilot); e.upgrades.forEach(u => seen.add(u)); }
    let s = newGame({ seed: g * 7 + 1, squads, obstacles: g % 2 === 0 });
    for (let i = 0; i < 6000 && !s.winner && s.round <= 30; i++) {
      const p = waitingOn(s)[0];
      if (s.prompt?.options) for (const o of s.prompt.options) { const k = o.id.split(':')[0]; offered.set(k, (offered.get(k) || 0) + 1); }
      const a = botAction(s, p, rng);
      const r = applyAction(s, a);
      if (r.error) throw new Error(`game ${g}: ${r.error} on ${JSON.stringify(a)} (prompt ${s.prompt?.kind})`);
      s = r.state;
    }
    if (s.winner) finished++;
    rounds += s.round;
  }
  const all = [...Object.keys(PILOTS), ...Object.keys(UPGRADES)];
  const never = all.filter(id => !seen.has(id));
  if (!quiet) {
    console.log(`    ${finished}/${games} finished, avg ${(rounds / games).toFixed(1)} rounds`);
    if (never.length) console.log('    never drafted:', never.join(', '));
  }
  return { finished, never, offered };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { offered } = await runCardSim(Number(process.argv[2] || 600));
  const ids = [...offered.entries()].sort((a, b) => a[1] - b[1]);
  console.log('option ids offered (fewest first):', ids.slice(0, 60).map(([k, v]) => `${k}:${v}`).join('  '));
}
