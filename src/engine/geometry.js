// Pure 2D geometry in table millimetres. y grows DOWN (screen space).
// A pose is { x, y, h } where h is heading in radians:
//   h = 0 faces the top edge (forward = (0,-1)); increasing h turns right.
import { CONFIG } from '../data/config.js';

export const DEG = Math.PI / 180;

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = a => Math.hypot(a.x, a.y);
export const fwd = h => ({ x: Math.sin(h), y: -Math.cos(h) });
export const right = h => ({ x: Math.cos(h), y: Math.sin(h) });
export const rotate = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
export const normAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };

export function baseSize(size = 'small') { return CONFIG.baseSize[size]; }

/** Square base outline (4 corners, clockwise from front-left). */
export function basePolygon(pose, size = 'small') {
  const half = baseSize(size) / 2;
  const f = mul(fwd(pose.h), half), r = mul(right(pose.h), half);
  const c = { x: pose.x, y: pose.y };
  return [
    add(sub(c, r), f), add(add(c, r), f),
    sub(add(c, r), f), sub(sub(c, r), f),
  ];
}

/** Firing-arc wedge: apex at ship centre, ±arcHalfAngle, long enough to cover the table. */
export function arcPolygon(pose, halfAngleDeg = CONFIG.arcHalfAngle) {
  const R = CONFIG.playArea * 3;
  const c = { x: pose.x, y: pose.y };
  return [
    c,
    add(c, mul(fwd(pose.h - halfAngleDeg * DEG), R)),
    add(c, mul(fwd(pose.h), R)),
    add(c, mul(fwd(pose.h + halfAngleDeg * DEG), R)),
  ];
}

/** Bullseye arc: a straight strip `width` mm wide running forward from the front edge. */
export function bullseyePolygon(pose, size = 'small', width = 20) {
  const half = baseSize(size) / 2, R = CONFIG.playArea * 3;
  const f = fwd(pose.h), r = right(pose.h), c = { x: pose.x, y: pose.y };
  const front = add(c, mul(f, half));
  return [add(front, mul(r, -width / 2)), add(front, mul(r, width / 2)), add(add(front, mul(r, width / 2)), mul(f, R)), add(add(front, mul(r, -width / 2)), mul(f, R))];
}

/** Place a local-coordinate outline (e.g. an asteroid) at x,y with rotation. */
export function placeShape(points, x, y, rot = 0) {
  return points.map(([px, py]) => add(rotate({ x: px, y: py }, rot), { x, y }));
}

// ---------- intersection & distance (works for any simple polygon) ----------

function segIntersect(p1, p2, q1, q2) {
  const d1 = cross(sub(p2, p1), sub(q1, p1));
  const d2 = cross(sub(p2, p1), sub(q2, p1));
  const d3 = cross(sub(q2, q1), sub(p1, q1));
  const d4 = cross(sub(q2, q1), sub(p2, q1));
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonsIntersect(A, B) {
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i], a2 = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      if (segIntersect(a1, a2, B[j], B[(j + 1) % B.length])) return true;
    }
  }
  return pointInPolygon(A[0], B) || pointInPolygon(B[0], A);
}

function closestOnSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return add(a, mul(ab, t));
}

/** Closest pair of points between two polygons ({a, b, d}); d = 0 if they touch/overlap. */
export function closestPoints(A, B) {
  if (polygonsIntersect(A, B)) {
    // find a shared-ish point for the obstruction line: centre of nearest vertices
    return { a: A[0], b: A[0], d: 0 };
  }
  let best = { d: Infinity };
  const scan = (P, Q, swap) => {
    for (const p of P) {
      for (let j = 0; j < Q.length; j++) {
        const q = closestOnSegment(p, Q[j], Q[(j + 1) % Q.length]);
        const d = len(sub(p, q));
        if (d < best.d) best = swap ? { a: q, b: p, d } : { a: p, b: q, d };
      }
    }
  };
  scan(A, B, false);
  scan(B, A, true);
  return best;
}

export const polygonDistance = (A, B) => closestPoints(A, B).d;

/** Sutherland–Hodgman: clip `subject` by a CONVEX polygon `clip`. */
export function clipPolygon(subject, clip) {
  // ensure clip winding is consistent: compute signed area
  let area = 0;
  for (let i = 0; i < clip.length; i++) area += cross(clip[i], clip[(i + 1) % clip.length]);
  const sign = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const c1 = clip[i], c2 = clip[(i + 1) % clip.length];
    const inside = p => sign * cross(sub(c2, c1), sub(p, c1)) >= 0;
    const input = out; out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci) {
        if (!pi) out.push(lineHit(prev, cur, c1, c2));
        out.push(cur);
      } else if (pi) out.push(lineHit(prev, cur, c1, c2));
    }
  }
  return out;
}

function lineHit(p1, p2, q1, q2) {
  const r = sub(p2, p1), s = sub(q2, q1);
  const denom = cross(r, s) || 1e-9;
  const t = cross(sub(q1, p1), s) / denom;
  return add(p1, mul(r, t));
}

export function segmentHitsPolygon(a, b, poly) {
  for (let i = 0; i < poly.length; i++) if (segIntersect(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  return pointInPolygon(a, poly) || pointInPolygon(b, poly);
}

/** Range band from a distance: 1..3, or null when beyond the ruler. */
export function bandFor(d) {
  if (d > CONFIG.rangeBand * CONFIG.maxRange) return null;
  return Math.max(1, Math.ceil(d / CONFIG.rangeBand - 1e-9));
}

export function polygonInsideBoard(poly) {
  const W = CONFIG.playArea;
  return poly.every(p => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= W);
}

/** Smallest distance from any vertex of poly to the board edge (for setup/obstacle zones). */
export function distanceToEdge(poly) {
  const W = CONFIG.playArea;
  return Math.min(...poly.map(p => Math.min(p.x, p.y, W - p.x, W - p.y)));
}
