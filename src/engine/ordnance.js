// Bombs and mines on the table (state.ordnance).
//   dropOrdnance(state, ship, type)  – place token(s) behind the ship (1-straight template from the rear)
//   checkMines(state, ship, polys)   – after any repositioning; detonates mines the ship touched
//   step 'detonateBombs'             – end of the Activation phase: every bomb goes off
import { ORDNANCE } from '../data/ordnance.js';
import { CONFIG } from '../data/config.js';
import { push, log, emit } from './flow.js';
import { add, mul, fwd, right, polygonsIntersect, closestPoints, bandFor } from './geometry.js';
import { rollDice } from './dice.js';
import { sufferDamage, dealDamageCard } from './damage.js';
import { addStress } from './effects.js';
import { liveShips, shipName, shipPoly } from './queries.js';
import { everyone, foldAll } from './hooks.js';

/** Outline polygon(s) of a token. */
export function ordnancePolys(tok) {
  const def = ORDNANCE[tok.type];
  const f = fwd(tok.h), r = right(tok.h), c = { x: tok.x, y: tok.y };
  if (def.shape.type === 'circle') {
    const out = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; out.push(add(c, { x: Math.cos(a) * def.shape.r, y: Math.sin(a) * def.shape.r })); }
    return out;
  }
  const hw = def.shape.w / 2, hh = def.shape.h / 2;
  return [add(add(c, mul(r, -hw)), mul(f, hh)), add(add(c, mul(r, hw)), mul(f, hh)), add(add(c, mul(r, hw)), mul(f, -hh)), add(add(c, mul(r, -hw)), mul(f, -hh))];
}

const depth = def => (def.shape.type === 'circle' ? def.shape.r * 2 : def.shape.h);

/** Drop one ordnance card's token(s) behind the ship. */
export function dropOrdnance(state, ship, type) {
  const def = ORDNANCE[type];
  const half = CONFIG.baseSize.small / 2;
  const back = mul(fwd(ship.pose.h), -(half + CONFIG.straightPerSpeed + depth(def) / 2));
  const centre = add(ship.pose, back);
  const n = def.cluster || 1, gap = (def.shape.w || def.shape.r * 2) + 4;
  for (let i = 0; i < n; i++) {
    const off = mul(right(ship.pose.h), (i - (n - 1) / 2) * gap);
    const p = add(centre, off);
    state.ordnance.push({ id: `b${state.uid++}`, type, x: p.x, y: p.y, h: ship.pose.h, owner: ship.owner, round: state.round, by: ship.id });
  }
  emit(state, { type: 'drop', ship: ship.id, ordnance: type });
  log(state, `${shipName(ship)} drops ${n > 1 ? `${n} × ${def.name}` : `a ${def.name}`}.`);
}

const removeToken = (state, tok) => { state.ordnance = state.ordnance.filter(t => t.id !== tok.id); };

function rollAndSuffer(state, ship, n, why) {
  const faces = rollDice(state, 'attack', n).map(d => d.face);
  emit(state, { type: 'roll', ship: ship.id, faces, reason: why });
  log(state, `${why}: ${shipName(ship)} rolls ${faces.join(', ')}.`);
  sufferDamage(state, ship, faces.filter(f => f === 'hit').length, faces.filter(f => f === 'crit').length);
}

/** What each token does to one ship it affects. */
const EFFECTS = {
  seismic: (state, s) => sufferDamage(state, s, 1, 0),
  proton_bomb: (state, s) => dealDamageCard(state, s, true),
  ion_bomb: (state, s) => { s.ion = (s.ion || 0) + 2; log(state, `${shipName(s)} is ionized.`); },
  thermal: (state, s) => { sufferDamage(state, s, 1, 0); if (!s.destroyed) addStress(state, s); },
  bomblet: (state, s) => rollAndSuffer(state, s, 2, 'Bomblet'),
  prox_mine: (state, s) => rollAndSuffer(state, s, 3, 'Proximity mine'),
  snare_net: (state, s) => { sufferDamage(state, s, 1, 0); if (!s.destroyed) { s.ion = (s.ion || 0) + 2; s.round.skipAction = true; log(state, `${shipName(s)} is tangled in a snare net.`); } },
  cluster_mine: (state, s) => {
    const faces = rollDice(state, 'attack', 2).map(d => d.face);
    emit(state, { type: 'roll', ship: s.id, faces, reason: 'Cluster mine' });
    sufferDamage(state, s, faces.filter(f => f === 'hit' || f === 'crit').length, 0);
  },
};

function detonate(state, tok, victims) {
  const def = ORDNANCE[tok.type];
  everyone(state, 'onDetonate', tok, victims); // side effects only (e.g. extra damage nearby)
  removeToken(state, tok);
  emit(state, { type: 'detonate', ordnance: tok.type, x: tok.x, y: tok.y, kind: def.kind });
  log(state, `${def.name} detonates${victims.length ? '' : ' harmlessly'}!`);
  for (const s of victims) if (!s.destroyed) EFFECTS[tok.type](state, s);
}

/** Ships at Range 1 of a token. */
const inBlast = (state, tok) => liveShips(state).filter(s => bandFor(closestPoints(shipPoly(s), ordnancePolys(tok)).d) === 1);

/** Call after a ship moves/repositions. `extra` = template polygon(s) it moved along. */
export function checkMines(state, ship, extra = []) {
  if (ship.destroyed || !state.ordnance.length) return;
  const polys = [shipPoly(ship), ...extra.filter(p => p && p.length)];
  for (const tok of state.ordnance.slice()) {
    if (ORDNANCE[tok.type].kind !== 'mine') continue;
    const tp = ordnancePolys(tok);
    if (polys.some(p => polygonsIntersect(p, tp))) detonate(state, tok, [ship]);
  }
}

export const steps = {
  detonateBombs(state) {
    for (const tok of state.ordnance.slice()) {
      if (ORDNANCE[tok.type].kind !== 'bomb') continue;
      if (!foldAll(state, 'bombDetonates', true, tok, inBlast(state, tok))) { log(state, `${ORDNANCE[tok.type].name} is held back from detonating.`); continue; }
      detonate(state, tok, inBlast(state, tok));
      if (state.winner) return;
    }
  },
};

export { push };
