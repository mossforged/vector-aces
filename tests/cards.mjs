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
    const factions = [...new Set(Object.values(PILOTS).map(p => p.faction))];
    const f1 = factions[g % factions.length], f2 = factions[Math.floor(g / factions.length) % factions.length];
    const seats = [{ faction: f1, squad: await randomSquad(f1, rng) }, { faction: f2, squad: await randomSquad(f2, rng) }];
    for (const st of seats) for (const e of st.squad) { seen.add(e.pilot); e.upgrades.forEach(u => seen.add(u)); }
    let s = newGame({ seed: g * 7 + 1, seats, obstacles: g % 2 === 0 });
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
  // Coverage pass: every card the random games missed gets a game of its own (built around it).
  const all = [...Object.keys(PILOTS), ...Object.keys(UPGRADES)];
  const { upgradeAllowed, validateSquad } = await import('../src/engine/index.js');
  for (const [k, id] of all.filter(x => !seen.has(x)).entries()) {
    const rng = mulberry(77000 + k);
    let host = PILOTS[id] ? { pilot: id, upgrades: [] } : null;
    if (!host) {
      for (const p of Object.values(PILOTS)) {
        const pre = Object.values(UPGRADES).filter(u => u.grants && upgradeAllowed(p.id, u.id) && (u.grants.includes(UPGRADES[id].slot)));
        for (const extra of [[], ...pre.map(u => [u.id])]) {
          if (upgradeAllowed(p.id, id, extra) && !validateSquad(p.faction, [{ pilot: p.id, upgrades: [...extra, id] }]).length) { host = { pilot: p.id, upgrades: [...extra, id] }; break; }
        }
        if (host) break;
      }
    }
    if (!host) continue;
    const f1 = PILOTS[host.pilot].faction;
    const seats = [{ faction: f1, squad: [host, ...(await randomSquad(f1, rng, 60))].slice(0, 4) }, { faction: f1, squad: await randomSquad(f1, rng) }];
    if (validateSquad(f1, seats[0].squad).length) seats[0].squad = [host];
    for (const e of seats[0].squad) { seen.add(e.pilot); e.upgrades.forEach(u => seen.add(u)); }
    let s = newGame({ seed: 5000 + k, seats, obstacles: true });
    for (let i = 0; i < 6000 && !s.winner && s.round <= 30; i++) {
      const p = waitingOn(s)[0];
      const r = applyAction(s, botAction(s, p, rng));
      if (r.error) throw new Error(`coverage game for ${id}: ${r.error}`);
      s = r.state;
    }
  }
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
