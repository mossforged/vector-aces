// A very simple opponent / test driver. Picks sensible-but-random answers to any prompt.
// Used by tests (thousands of simulated games) and could back a "vs computer" mode.
import { SHIPS } from '../data/ships.js';
import { buildPath, Q, G } from '../engine/index.js';

function rand(rng) { return rng(); }

/** Choose dials that keep each ship on the table, preferring maneuvers toward enemies. */
export function chooseDials(state, player, rng = Math.random) {
  const dials = {};
  const mine = Q.liveShips(state).filter(s => s.owner === player);
  const foes = Q.liveShips(state).filter(s => s.owner !== player);
  for (const s of mine) {
    const opts = SHIPS[s.chassis].dial.map(c => c.split(':')[0]).filter(key => {
      const m = { key, speed: parseInt(key, 10), bearing: key.replace(/^\d/, '') };
      const p = buildPath(s.pose, m, 'small');
      const poly = G.basePolygon(p.final, 'small');
      return G.polygonInsideBoard(poly) && G.distanceToEdge(poly) > 15;
    });
    const scored = opts.map(key => {
      const m = { key, speed: parseInt(key, 10), bearing: key.replace(/^\d/, '') };
      const f = buildPath(s.pose, m, 'small').final;
      const d = foes.length ? Math.min(...foes.map(e => Math.hypot(e.pose.x - f.x, e.pose.y - f.y))) : 0;
      return { key, score: -Math.abs(d - 180) + rand(rng) * 120 };
    }).sort((a, b) => b.score - a.score);
    dials[s.id] = (scored[0] || { key: SHIPS[s.chassis].dial[0].split(':')[0] }).key;
  }
  return dials;
}

/** Answer the current prompt for `player` with an action object (or null if not their turn). */
export function botAction(state, player, rng = Math.random) {
  const p = state.prompt;
  if (!p) return null;
  if (p.kind === 'planning') {
    if (!p.players.includes(player) || state.planning.submitted[player]) return null;
    return { type: 'SUBMIT_DIALS', player, dials: chooseDials(state, player, rng) };
  }
  if (p.player !== player) return null;
  const opts = p.options;
  const pref = ['focus', 'lock', 'lock:blank', 'dfocus', 'devade', 'kestrel', 'deadeye', 'torpedo'];
  let pick = opts.find(o => pref.includes(o.id) && rand(rng) < 0.8);
  if (!pick && p.kind === 'declareAttack') pick = opts.find(o => o.id !== 'hold');
  if (!pick && (p.kind === 'modAttack' || p.kind === 'modDefense')) pick = opts.find(o => o.id !== 'done') || opts[0];
  if (!pick) pick = opts[Math.floor(rand(rng) * opts.length)];
  return { type: 'CHOOSE', player, choice: pick.id };
}

/** A random legal squad (≤ limit points), filling upgrade slots at random. */
export async function randomSquad(faction, rng = Math.random, limit = 100) {
  const { PILOTS } = await import('../data/pilots.js');
  const { UPGRADES } = await import('../data/upgrades.js');
  const { validateSquad, upgradeAllowed, squadPoints } = await import('../engine/index.js');
  const pilots = Object.values(PILOTS).filter(p => p.faction === faction);
  const pickOne = arr => arr[Math.floor(rng() * arr.length)];
  for (let tries = 0; tries < 200; tries++) {
    const squad = [];
    for (let i = 0; i < 8; i++) {
      const p = pickOne(pilots);
      const e = { pilot: p.id, upgrades: [] };
      const free = p.slots.slice();
      for (const slot of free) {
        if (rng() < 0.35) continue;
        const opts = Object.values(UPGRADES).filter(u => u.slot === slot && upgradeAllowed(p.id, u.id));
        if (opts.length) e.upgrades.push(pickOne(opts).id);
      }
      squad.push(e);
      if (validateSquad(faction, squad, limit).length) { squad.pop(); if (squadPoints(squad) > limit - 12) break; }
    }
    if (squad.length && !validateSquad(faction, squad, limit).length) return squad;
  }
  return [{ pilot: pilots[0].id, upgrades: [] }];
}
