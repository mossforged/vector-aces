// A very simple opponent / test driver. Picks sensible-but-random answers to any prompt.
// Used by tests (thousands of simulated games) and could back a "vs computer" mode.
import { SHIPS } from '../data/ships.js';
import { buildPath, Q, G } from '../engine/index.js';

function rand(rng) { return rng(); }

/**
 * Choose dials. Each legal maneuver that keeps the ship safely on the table is scored on where
 * it ends: enemies in its front arc at Range 1–2 (good), sitting in enemy arcs (bad), flying
 * onto rocks (bad), red maneuvers while stressed (bad), plus a little randomness so games vary.
 * Enemies are assumed to stay where they are — simple, but it makes the bot close and shoot.
 */
export function chooseDials(state, player, rng = Math.random) {
  const dials = {};
  const mine = Q.liveShips(state).filter(s => s.owner === player);
  const foes = Q.liveShips(state).filter(s => s.owner !== player);
  const rocks = Q.obstaclePolys(state);
  const inFront = (from, to, maxD) => {
    const v = { x: to.x - from.x, y: to.y - from.y }, d = Math.hypot(v.x, v.y);
    if (d > maxD) return false;
    const f = G.fwd(from.h);
    return (v.x * f.x + v.y * f.y) / (d || 1) > Math.cos(45 * G.DEG);
  };
  for (const s of mine) {
    const scored = SHIPS[s.chassis].dial.map(c => {
      const [key, color] = c.split(':');
      const m = { key, speed: parseInt(key, 10), bearing: key.replace(/^\d/, '') };
      const path = buildPath(s.pose, m, 'small');
      const f = path.final, poly = G.basePolygon(f, 'small');
      if (!G.polygonInsideBoard(poly) || G.distanceToEdge(poly) <= 15) return null;
      let score = rand(rng) * 60;
      const d = foes.length ? Math.min(...foes.map(e => Math.hypot(e.pose.x - f.x, e.pose.y - f.y))) : 0;
      score -= Math.abs(d - 160) * 0.4;
      for (const e of foes) {
        if (inFront(f, e.pose, 200)) score += 140; else if (inFront(f, e.pose, 300)) score += 70;
        if (inFront(e.pose, f, 300)) score -= 45;
      }
      if (rocks.some(r => G.polygonsIntersect(poly, r) || (path.templatePoly?.length && G.polygonsIntersect(path.templatePoly, r)))) score -= 260;
      if (color === 'r') score -= s.stress ? 500 : 35;
      if (color === 'g' && s.stress) score += 80;
      return { key, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
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
