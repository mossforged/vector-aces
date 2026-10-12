// Read-only helpers shared by engine modules and the UI.
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { ASTEROIDS, CONFIG } from '../data/config.js';
import { basePolygon, placeShape, polygonsIntersect, arcPolygon, clipPolygon, closestPoints, bandFor, segmentHitsPolygon, bullseyePolygon } from './geometry.js';
import { fold, flag } from './hooks.js';

export const chassis = s => SHIPS[s.chassis];
export const pilot = s => PILOTS[s.pilot];
export const shipList = state => state.shipOrder.map(id => state.ships[id]);
export const onBoard = s => !s.destroyed && s.deployed;
export const liveShips = state => shipList(state).filter(onBoard);
export const enemyOf = (state, player) => state.playerOrder.find(p => p !== player);
export const shipName = s => pilot(s).name + (s.tag ? ` #${s.tag}` : '');

export const faceupCards = s => s.damage.filter(c => c.faceup);
export const hasFaceup = (s, id) => s.damage.some(c => c.faceup && c.card === id);

/** Damage cards count toward hull; faceup Direct Hit counts double. */
export const hullDamage = s => s.damage.reduce((n, c) => n + (c.faceup && c.card === 'direct_hit' ? 2 : 1), 0);

export const abilityActive = s => !hasFaceup(s, 'head_wound');

export function hasAbility(s, id) {
  return abilityActive(s) && pilot(s).ability === id;
}

/** Active (not discarded) upgrade ids; elite upgrades are switched off by Head Wound. */
export function activeUpgrades(s) {
  return s.upgrades.filter(u => !u.discarded && (UPGRADES[u.id].slot !== 'elite' || abilityActive(s))).map(u => u.id);
}
export const hasUpgrade = (s, id) => activeUpgrades(s).includes(id);

/** Pilot skill now: base + cards, Smoke in the Cockpit, and combat-phase overrides. */
export function effectiveSkill(state, s) {
  const smoke = s.damage.find(c => c.faceup && c.card === 'smoke_cockpit' && c.round < state.round);
  if (smoke) return 0;
  const o = state.skillOverride?.[s.id];
  if (o !== undefined) return o;
  return fold(state, s, 'stat', pilot(s).skill, 'skill');
}

/** Base pilot skill before overrides (used by swap / copy effects). */
export const naturalSkill = (state, s) => fold(state, s, 'stat', pilot(s).skill, 'skill');

export function stat(state, s, which) {
  let v = which === 'maxShields' ? chassis(s).shields : chassis(s)[which];
  if (which === 'agility') {
    if (hasFaceup(s, 'ruptured_plating')) v -= 1;
    v += s.round.agilityBonus || 0;
    if (s.cloaked) v += 2;
    v -= s.tractor || 0;
  }
  if (which === 'attack') {
    if (hasFaceup(s, 'weapons_fault')) v -= 1;
    v += s.round.attackBonus || 0;
  }
  v = fold(state, s, 'stat', v, which);
  return Math.max(0, v);
}

export function maneuverColor(state, s, m) {
  let c = m.color;
  if (hasFaceup(s, 'engine_fault') && (m.bearing === 'TL' || m.bearing === 'TR')) c = 'r';
  return fold(state, s, 'maneuverColor', c, m);
}

/** Action bar after modifications (e.g. Afterburners adds boost). */
export const actionBar = (state, s) => fold(state, s, 'actionBar', chassis(s).actions.slice());

export const hasFlag = (state, s, f, ...args) => flag(state, s, f, ...args);

export const shipPoly = s => basePolygon(s.pose, chassis(s).size);

export function obstaclePolys(state) {
  return state.obstacles.map(o => placeShape(ASTEROIDS[o.shape], o.x, o.y, o.rot));
}

export function overlapsAnyShip(state, poly, exceptId) {
  return liveShips(state).some(o => o.id !== exceptId && polygonsIntersect(poly, shipPoly(o)));
}
export function overlapsAnyObstacle(state, poly) {
  return obstaclePolys(state).some(o => polygonsIntersect(poly, o));
}

/** Bases touching after a bump (they can't shoot each other until one moves away). */
export const areTouching = (state, a, b) => state.touches.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export const friendly = (a, b) => a.owner === b.owner;

/** Friendly ships (other than s) within Range lo..hi of s. */
export function friendsInRange(state, s, lo = 1, hi = 3) {
  return liveShips(state).filter(o => o.id !== s.id && o.owner === s.owner && (b => b && b >= lo && b <= hi)(rangeBetween(s, o).band));
}
export function enemiesInRange(state, s, lo = 1, hi = 3) {
  return liveShips(state).filter(o => o.owner !== s.owner && (b => b && b >= lo && b <= hi)(rangeBetween(s, o).band));
}

/** 360° range (used for target locks). */
export function rangeBetween(a, b) {
  const { d } = closestPoints(shipPoly(a), shipPoly(b));
  return { d, band: bandFor(d) };
}

// ---------------- firing arcs ----------------
// arcs per chassis: 'front' (primary), 'rear' (auxiliary rear), 'front180' (auxiliary 180°),
// 'turret' (primary turret: attacks in any direction), 'bullseye' (narrow strip inside the front arc).
export const arcsOf = s => chassis(s).arcs || ['front'];

/** Polygons for the arcs a ship can fire its primary weapon from. */
export function arcPolys(s) {
  const out = [];
  for (const a of arcsOf(s)) {
    if (a === 'front') out.push(['front', arcPolygon(s.pose)]);
    else if (a === 'rear') out.push(['rear', arcPolygon({ ...s.pose, h: s.pose.h + Math.PI })]);
    else if (a === 'front180') out.push(['front180', arcPolygon(s.pose, 90)]);
  }
  return out;
}

/** b is inside any of a's firing arcs (front or auxiliary). Turret primaries count everything. */
export function inArc(a, b) {
  if (arcsOf(a).includes('turret')) return true;
  return arcPolys(a).some(([, poly]) => clipPolygon(shipPoly(b), poly).length >= 3);
}
/** b is inside a's front (primary) arc only. */
export const inFrontArc = (a, b) => clipPolygon(shipPoly(b), arcPolygon(a.pose)).length >= 3;
/** b is inside a's bullseye arc. */
export const inBullseye = (a, b) => clipPolygon(shipPoly(b), bullseyePolygon(a.pose, chassis(a).size)).length >= 3;

/**
 * Primary-weapon attack geometry from a to b, using whichever of a's arcs gives the
 * shortest range. Returns null if b is in none of them; otherwise
 * { d, band, obstructed, touching, line:{a,b}, arc }.
 */
export function attackGeometry(state, a, b) {
  if (arcsOf(a).includes('turret')) return { ...turretGeometry(state, a, b), arc: 'turret' };
  let best = null;
  for (const [arc, poly] of arcPolys(a)) {
    const part = clipPolygon(shipPoly(b), poly);
    if (part.length < 3) continue;
    const cp = closestPoints(shipPoly(a), part);
    if (!best || cp.d < best.cp.d) best = { cp, arc };
  }
  if (!best) return null;
  const { cp, arc } = best;
  const obstructed = cp.d > 0 && obstaclePolys(state).some(o => segmentHitsPolygon(cp.a, cp.b, o));
  return { d: cp.d, band: bandFor(cp.d), obstructed, touching: areTouching(state, a.id, b.id), line: { a: cp.a, b: cp.b }, arc };
}

/** Front-arc-only geometry (for secondary weapons, which fire from the primary arc). */
export function frontGeometry(state, a, b) {
  const part = clipPolygon(shipPoly(b), arcPolygon(a.pose));
  if (part.length < 3) return null;
  const cp = closestPoints(shipPoly(a), part);
  const obstructed = cp.d > 0 && obstaclePolys(state).some(o => segmentHitsPolygon(cp.a, cp.b, o));
  return { d: cp.d, band: bandFor(cp.d), obstructed, touching: areTouching(state, a.id, b.id), line: { a: cp.a, b: cp.b }, arc: 'front' };
}

/** 360° geometry for turret weapons: closest points between bases. */
export function turretGeometry(state, a, b) {
  const cp = closestPoints(shipPoly(a), shipPoly(b));
  const obstructed = cp.d > 0 && obstaclePolys(state).some(o => segmentHitsPolygon(cp.a, cp.b, o));
  return { d: cp.d, band: bandFor(cp.d), obstructed, touching: areTouching(state, a.id, b.id), line: { a: cp.a, b: cp.b } };
}

export function damageCardDef(id) { return DAMAGE_CARDS[id]; }
export { CONFIG };
