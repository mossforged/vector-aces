// Maneuver templates as parametric paths.
// A path is described by the position of the ship's REAR edge midpoint along the
// template centre-line at arc-length u. u = 0 is the start of the template (the
// front edge of the base before moving); u = length is the end. Negative u runs
// straight back to the starting pose (u = -base), which is how bump back-off works.
import { CONFIG } from '../data/config.js';
import { add, mul, fwd, right, rotate, DEG, baseSize } from './geometry.js';

const ARC = { B: 45 * DEG, T: 90 * DEG };

export function templateLength(m) {
  if (m.bearing === 'S' || m.bearing === 'K') return CONFIG.straightPerSpeed * m.speed;
  const kind = m.bearing[0];
  const r = kind === 'B' ? CONFIG.bankRadius[m.speed] : CONFIG.turnRadius[m.speed];
  return r * ARC[kind];
}

/**
 * Build the path for a maneuver from a starting pose.
 * Returns { length, poseAt(u), final, templatePoly }.
 *  - poseAt(u): ship pose with its rear midpoint at u along the template (u in [-base, length])
 *  - final: pose at u = length (with the 180° flip applied for K-turns)
 */
export function buildPath(pose, m, size = 'small', { asStraight = false } = {}) {
  const L = baseSize(size);
  const h0 = pose.h;
  const front = add(pose, mul(fwd(h0), L / 2));          // template start point
  const bearing = asStraight && m.bearing === 'K' ? 'S' : m.bearing;
  const length = templateLength({ ...m, bearing });

  let pointAt; // u >= 0 -> {p, h}
  if (bearing === 'S' || bearing === 'K') {
    pointAt = u => ({ p: add(front, mul(fwd(h0), u)), h: h0 });
  } else {
    const kind = bearing[0], dir = bearing[1] === 'R' ? 1 : -1;
    const r = kind === 'B' ? CONFIG.bankRadius[m.speed] : CONFIG.turnRadius[m.speed];
    const centre = add(front, mul(right(h0), r * dir));
    const v0 = { x: front.x - centre.x, y: front.y - centre.y };
    pointAt = u => {
      const phi = (u / r) * dir;
      return { p: add(centre, rotate(v0, phi)), h: h0 + phi };
    };
  }

  const poseAt = u => {
    if (u <= 0) {
      const p = add(front, mul(fwd(h0), u));
      const c = add(p, mul(fwd(h0), L / 2));
      return { x: c.x, y: c.y, h: h0 };
    }
    const { p, h } = pointAt(Math.min(u, length));
    const c = add(p, mul(fwd(h), L / 2));
    return { x: c.x, y: c.y, h };
  };

  const end = poseAt(length);
  const final = bearing === 'K' ? { ...end, h: end.h + Math.PI } : end;

  // Template outline: centre-line offset ±width/2, sampled.
  const W = CONFIG.templateWidth / 2, N = 12, leftSide = [], rightSide = [];
  for (let i = 0; i <= N; i++) {
    const { p, h } = pointAt((length * i) / N);
    leftSide.push(add(p, mul(right(h), -W)));
    rightSide.push(add(p, mul(right(h), W)));
  }
  const templatePoly = [...leftSide, ...rightSide.reverse()];

  return { length, base: L, poseAt, final, templatePoly, bearing };
}

/** Barrel-roll destinations: left/right × back/centre/forward offsets. */
export function barrelRollPoses(pose, size = 'small') {
  const L = baseSize(size);
  const shift = L + CONFIG.straightPerSpeed;           // base width + 1-straight template
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
  if (path.bearing === 'K') out.push(path.final);
  return out;
}
