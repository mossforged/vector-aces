// Read-only helpers shared by engine modules and the UI.
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { ASTEROIDS, CONFIG } from '../data/config.js';
import { basePolygon, placeShape, polygonsIntersect, arcPolygon, clipPolygon, closestPoints, bandFor, segmentHitsPolygon } from './geometry.js';
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

export function inArc(a, b) {
  return clipPolygon(shipPoly(b), arcPolygon(a.pose)).length >= 3;
}

/**
 * Attack geometry from attacker a to defender b (primary arc).
 * Returns null if b is outside the arc; otherwise { d, band, obstructed, touching, line:{a,b} }.
 */
export function attackGeometry(state, a, b) {
  const part = clipPolygon(shipPoly(b), arcPolygon(a.pose));
  if (part.length < 3) return null;
  const cp = closestPoints(shipPoly(a), part);
  const touching = areTouching(state, a.id, b.id);
  const band = bandFor(cp.d);
  const obstructed = cp.d > 0 && obstaclePolys(state).some(o => segmentHitsPolygon(cp.a, cp.b, o));
  return { d: cp.d, band, obstructed, touching, line: { a: cp.a, b: cp.b } };
}

/** 360° geometry for turret weapons: closest points between bases. */
export function turretGeometry(state, a, b) {
  const cp = closestPoints(shipPoly(a), shipPoly(b));
  const obstructed = cp.d > 0 && obstaclePolys(state).some(o => segmentHitsPolygon(cp.a, cp.b, o));
  return { d: cp.d, band: bandFor(cp.d), obstructed, touching: areTouching(state, a.id, b.id), line: { a: cp.a, b: cp.b } };
}

export function damageCardDef(id) { return DAMAGE_CARDS[id]; }
export { CONFIG };
