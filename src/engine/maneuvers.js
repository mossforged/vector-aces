// Maneuver templates as parametric paths.
// A path is described by the position of the ship's REAR edge midpoint along the
// template centre-line at arc-length u. u = 0 is the start of the template (the
// front edge of the base before moving); u = length is the end. Negative u runs
// straight back to the starting pose (u = -base), which is how bump back-off works.
import { CONFIG } from '../data/config.js';
import { add, mul, fwd, right, rotate, DEG, baseSize } from './geometry.js';

const ARC = { B: 45 * DEG, T: 90 * DEG };

// Every bearing = a basic template shape (geometry) + an optional rotation at the end.
//   K   reverse turn: straight, then 180°
//   SL/SR  Segnor's loop: bank, then 180°
//   TRL/TRR Tallon roll: turn, then a further 90° in the turn's direction
//   RBL/RS/RBR reverse maneuvers: the template runs backwards from the rear edge
//   ST  stationary (speed 0): the ship stays put
export const GEOMETRY = { S: 'S', K: 'S', BL: 'BL', BR: 'BR', TL: 'TL', TR: 'TR', SL: 'BL', SR: 'BR', TRL: 'TL', TRR: 'TR', RS: 'S', RBL: 'BR', RBR: 'BL', ST: 'ST' };
const END_ROTATION = { K: Math.PI, SL: Math.PI, SR: Math.PI, TRL: -Math.PI / 2, TRR: Math.PI / 2 };
export const isReverse = b => b === 'RS' || b === 'RBL' || b === 'RBR';

export function templateLength(m) {
  const g = GEOMETRY[m.bearing] || m.bearing;
  if (g === 'ST') return 0;
  if (g === 'S') return CONFIG.straightPerSpeed * m.speed;
  const kind = g[0];
  const r = kind === 'B' ? CONFIG.bankRadius[m.speed] : CONFIG.turnRadius[m.speed];
  return r * ARC[kind];
}

/**
 * Build the path for a maneuver from a starting pose.
 * Returns { length, base, poseAt(u), final, templatePoly, bearing, rotates }.
 *  - poseAt(u): ship pose with its rear midpoint at u along the template (u in [-base, length])
 *  - final: pose at u = length, including any end rotation (K-turn, loop, roll)
 *  - opts.basic: drop the end rotation (how bumped loops/rolls/K-turns resolve)
 */
export function buildPath(pose, m, size = 'small', { asStraight = false, basic = asStraight } = {}) {
  const L = baseSize(size);
  const bearing = m.bearing;
  if (bearing === 'ST') {
    const still = () => ({ ...pose });
    return { length: 0, base: L, poseAt: still, final: { ...pose }, templatePoly: [], bearing, rotates: false };
  }
  const rev = isReverse(bearing);
  const h0 = rev ? pose.h + Math.PI : pose.h;
  const geo = GEOMETRY[bearing] || bearing;
  const front = add(pose, mul(fwd(h0), L / 2));          // template start point (rear edge for reverse)
  const length = templateLength({ ...m, bearing: geo });

  let pointAt; // u >= 0 -> {p, h}
  if (geo === 'S') {
    pointAt = u => ({ p: add(front, mul(fwd(h0), u)), h: h0 });
  } else {
    const kind = geo[0], dir = geo[1] === 'R' ? 1 : -1;
    const r = kind === 'B' ? CONFIG.bankRadius[m.speed] : CONFIG.turnRadius[m.speed];
    const centre = add(front, mul(right(h0), r * dir));
    const v0 = { x: front.x - centre.x, y: front.y - centre.y };
    pointAt = u => {
      const phi = (u / r) * dir;
      return { p: add(centre, rotate(v0, phi)), h: h0 + phi };
    };
  }

  const flip = rev ? Math.PI : 0;
  const poseAt = u => {
    if (u <= 0) {
      const p = add(front, mul(fwd(h0), u));
      const c = add(p, mul(fwd(h0), L / 2));
      return { x: c.x, y: c.y, h: h0 - flip };
    }
    const { p, h } = pointAt(Math.min(u, length));
    const c = add(p, mul(fwd(h), L / 2));
    return { x: c.x, y: c.y, h: h - flip };
  };

  const end = poseAt(length);
  const rot = basic ? 0 : (END_ROTATION[bearing] || 0);
  const final = { ...end, h: end.h + rot };

  // Template outline: centre-line offset ±width/2, sampled.
  const W = CONFIG.templateWidth / 2, N = 12, leftSide = [], rightSide = [];
  for (let i = 0; i <= N; i++) {
    const { p, h } = pointAt((length * i) / N);
    leftSide.push(add(p, mul(right(h), -W)));
    rightSide.push(add(p, mul(right(h), W)));
  }
  const templatePoly = [...leftSide, ...rightSide.reverse()];

  return { length, base: L, poseAt, final, templatePoly, bearing, rotates: rot !== 0 };
}

/** Barrel-roll destinations: left/right × back/centre/forward offsets. */
export function barrelRollPoses(pose, size = 'small', speed = 1) {
  const L = baseSize(size);
  const shift = L + CONFIG.straightPerSpeed * speed;   // base width + straight template (1, or 2 for decloak)
  const out = [];
  for (const side of [-1, 1]) {
    for (const [label, off] of [['back', -L / 2], ['centre', 0], ['forward', L / 2]]) {
      const c = add(add(pose, mul(right(pose.h), side * shift)), mul(fwd(pose.h), off));
      out.push({ id: `${side < 0 ? 'L' : 'R'}-${label}`, side: side < 0 ? 'left' : 'right', label, pose: { x: c.x, y: c.y, h: pose.h } });
    }
  }
  return out;
}

/** Sample poses for animation along a path from start to final (K flip at the end). */
export function samplePath(path, steps = 24) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(path.poseAt(-path.base + ((path.length + path.base) * i) / steps));
  if (path.rotates) out.push(path.final);
  return out;
}
