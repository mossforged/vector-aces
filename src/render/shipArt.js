// Ship "standees": each art key draws the ship in local coordinates.
// Local space: ship faces UP (-y), centred on 0,0, units = mm (a small base is 40×40).
//
// To use your own art instead, put an image path in IMAGE_OVERRIDES, e.g.
//   IMAGE_OVERRIDES.lancer = 'assets/lancer.png'   (top-down, nose up, transparent bg)
// The image is drawn scaled to fit the base. No other code changes needed.

export const IMAGE_OVERRIDES = {};

const imgCache = {};
function img(src) {
  if (!imgCache[src]) { const i = new Image(); i.src = src; imgCache[src] = i; }
  return imgCache[src];
}

export function drawShipArt(ctx, artKey, accent) {
  const src = IMAGE_OVERRIDES[artKey];
  if (src) {
    const i = img(src);
    if (i.complete && i.naturalWidth) { ctx.drawImage(i, -17, -17, 34, 34); return; }
  }
  (ART[artKey] || ART.generic)(ctx, accent);
}

const hull = '#d9dde4', hullDark = '#8c94a3', line = '#3b4250';

function stroke(ctx, w = 0.8) { ctx.lineWidth = w; ctx.strokeStyle = line; ctx.stroke(); }


// --- small drawing helpers for the newer ships ---
function poly(ctx, pts, fill, w = 0.8) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); stroke(ctx, w);
}
const mirror = pts => pts.map(([x, y]) => [-x, y]);
function both(ctx, pts, fill, w) { poly(ctx, pts, fill, w); poly(ctx, mirror(pts), fill, w); }
function canopy(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a3f5a'; ctx.fill(); }
function engine(ctx, x, y, r = 1.6) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#ffb35c'; ctx.fill(); }
function stripe(ctx, segs, accent, w = 1.5) {
  ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.lineWidth = w; ctx.strokeStyle = accent; ctx.stroke();
}

import dominionArt from './art/dominion.js';
import leagueArt from './art/league.js';
import syndicateArt from './art/syndicate.js';

export const helpers = { poly, both, mirror, canopy, engine, stripe, hull, hullDark, line, stroke };

const ART = {
  // Lancer: a forward-swept dart with a long nose and twin rear thrusters.
  lancer(ctx, accent) {
    // wings (forward-swept)
    ctx.beginPath();
    ctx.moveTo(-3, 4); ctx.lineTo(-16, -2); ctx.lineTo(-15, 3); ctx.lineTo(-4, 10); ctx.closePath();
    ctx.moveTo(3, 4); ctx.lineTo(16, -2); ctx.lineTo(15, 3); ctx.lineTo(4, 10); ctx.closePath();
    ctx.fillStyle = hullDark; ctx.fill(); stroke(ctx);
    // accent stripes on wings
    ctx.beginPath(); ctx.moveTo(-14, -1); ctx.lineTo(-9, 2); ctx.moveTo(14, -1); ctx.lineTo(9, 2);
    ctx.lineWidth = 1.6; ctx.strokeStyle = accent; ctx.stroke();
    // fuselage
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(3, -8); ctx.lineTo(4, 12); ctx.lineTo(-4, 12); ctx.lineTo(-3, -8); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    // canopy
    ctx.beginPath(); ctx.ellipse(0, -3, 1.6, 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a3f5a'; ctx.fill();
    // thrusters
    for (const x of [-5.5, 5.5]) {
      ctx.beginPath(); ctx.rect(x - 1.8, 8, 3.6, 7); ctx.fillStyle = hull; ctx.fill(); stroke(ctx, 0.6);
      ctx.beginPath(); ctx.arc(x, 15.5, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#ffb35c'; ctx.fill();
    }
  },

  // Wasp: segmented insect-like interceptor with two pairs of swept blade-wings.
  wasp(ctx, accent) {
    ctx.fillStyle = hullDark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(2 * s, -4); ctx.quadraticCurveTo(16 * s, -10, 17 * s, 2); ctx.quadraticCurveTo(10 * s, -1, 2 * s, 1); ctx.closePath();
      ctx.fill(); stroke(ctx, 0.6);
      ctx.beginPath();
      ctx.moveTo(2 * s, 3); ctx.quadraticCurveTo(12 * s, 4, 13 * s, 13); ctx.quadraticCurveTo(7 * s, 8, 2 * s, 7); ctx.closePath();
      ctx.fill(); stroke(ctx, 0.6);
    }
    // body segments: head, thorax, abdomen
    const seg = (y, rx, ry, c) => { ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); stroke(ctx, 0.6); };
    seg(9, 3.2, 7, hull);
    seg(-1, 3.8, 4.5, hull);
    seg(-9, 2.8, 3.2, hull);
    // abdomen bands
    ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(3, 7); ctx.moveTo(-2.8, 10.5); ctx.lineTo(2.8, 10.5);
    ctx.lineWidth = 1.4; ctx.strokeStyle = accent; ctx.stroke();
    // eye sensors
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath(); ctx.arc(-1.3, -10.5, 0.9, 0, Math.PI * 2); ctx.arc(1.3, -10.5, 0.9, 0, Math.PI * 2); ctx.fill();
    // stinger cannon
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -17); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
  },

  // ---------------- League ----------------
  // Bulwark: long armoured spine with a forward cockpit pod and two engine nacelles on outriggers.
  bulwark(ctx, accent) {
    both(ctx, [[2, 2], [13, 0], [13, 3], [2, 6]], hullDark);
    both(ctx, [[11, -6], [15, -6], [15, 15], [11, 15]], hull);
    poly(ctx, [[0, -18], [4, -12], [4, 8], [-4, 8], [-4, -12]], hull);
    stripe(ctx, [[-3, -6, 3, -6], [-3, -3, 3, -3]], accent);
    canopy(ctx, 0, -12, 1.8, 2.6);
    engine(ctx, 13, 15.5, 1.8); engine(ctx, -13, 15.5, 1.8);
  },
  // Dart: compact wedge interceptor with two side engine pods.
  dart(ctx, accent) {
    poly(ctx, [[0, -17], [12, 8], [8, 12], [-8, 12], [-12, 8]], hull);
    both(ctx, [[9, 0], [14, 1], [14, 13], [9, 13]], hullDark);
    stripe(ctx, [[-6, 4, 6, 4]], accent, 1.8);
    canopy(ctx, 0, -4, 2, 3.4);
    engine(ctx, 11.5, 13.5); engine(ctx, -11.5, 13.5);
  },
  // Courier: rounded light freighter, offset cockpit and broad wing-plates.
  courier(ctx, accent) {
    both(ctx, [[6, 0], [17, 6], [17, 11], [6, 11]], hullDark);
    ctx.beginPath(); ctx.ellipse(0, 2, 8, 13, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    poly(ctx, [[-3, -15], [3, -15], [4, -9], [-4, -9]], hull);
    stripe(ctx, [[-6, 6, 6, 6]], accent, 1.8);
    canopy(ctx, 0, -12, 2.2, 2);
    engine(ctx, 4, 15); engine(ctx, -4, 15);
  },
  // Halberd: tall cross-shaped gunship — a long vertical blade with a cockpit gyro at the base.
  halberd(ctx, accent) {
    poly(ctx, [[-2, -18], [2, -18], [2, 16], [-2, 16]], hullDark);
    both(ctx, [[2, 4], [16, 2], [16, 6], [2, 9]], hull);
    poly(ctx, [[-1.2, -18], [1.2, -18], [1.2, -22], [-1.2, -22]], line);
    stripe(ctx, [[-1.5, -10, 1.5, -10], [-1.5, -6, 1.5, -6]], accent, 1.6);
    ctx.beginPath(); ctx.arc(0, 6, 5, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    canopy(ctx, 0, 6, 2.2, 2.2);
    engine(ctx, 0, 16.5, 1.8);
  },
  // Sparrow: stubby old-model fighter with short straight wings and a blunt nose.
  sparrow(ctx, accent) {
    both(ctx, [[3, 2], [14, 3], [14, 8], [3, 9]], hullDark);
    poly(ctx, [[0, -14], [4, -8], [4, 12], [-4, 12], [-4, -8]], hull);
    stripe(ctx, [[10, 3, 10, 8], [-10, 3, -10, 8]], accent, 1.6);
    canopy(ctx, 0, -4, 1.8, 3);
    engine(ctx, 0, 12.5, 2);
  },
  // Rapier: sleek needle fighter with narrow swept-back fins and a gun barrel nose.
  rapier(ctx, accent) {
    both(ctx, [[2, 2], [14, 12], [12, 14], [2, 9]], hullDark);
    poly(ctx, [[0, -16], [3, -6], [3, 14], [-3, 14], [-3, -6]], hull);
    poly(ctx, [[-0.8, -16], [0.8, -16], [0.8, -21], [-0.8, -21]], line);
    both(ctx, [[1, 6], [1, 15], [-1, 15]], hull);
    stripe(ctx, [[5, 7, 10, 11], [-5, 7, -10, 11]], accent, 1.5);
    canopy(ctx, 0, -5, 1.6, 3);
    engine(ctx, 0, 14.5);
  },

  // ---------------- Dominion ----------------
  // Hornet: wasp-like body with bent, angular wing blades and a raised stinger.
  hornet(ctx, accent) {
    both(ctx, [[3, -2], [16, -10], [17, 6], [3, 4]], hullDark);
    ctx.beginPath(); ctx.ellipse(0, 6, 3.2, 8, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx, 0.6);
    ctx.beginPath(); ctx.ellipse(0, -5, 4, 5, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx, 0.6);
    stripe(ctx, [[-2.8, 6, 2.8, 6], [-2.6, 9.5, 2.6, 9.5], [10, -7, 10, 3], [-10, -7, -10, 3]], accent, 1.3);
    ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(-1.4, -7.5, 0.9, 0, Math.PI * 2); ctx.arc(1.4, -7.5, 0.9, 0, Math.PI * 2); ctx.fill();
    stripe(ctx, [[0, -10, 0, -16]], line, 1);
  },
  // Talon: raptor-claw interceptor — forward-hooked wing tips around a small core.
  talon(ctx, accent) {
    both(ctx, [[3, 0], [15, -4], [16, -14], [18, -12], [17, 8], [3, 6]], hullDark);
    ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    poly(ctx, [[-2, -3], [2, -3], [1.2, -12], [-1.2, -12]], hull);
    stripe(ctx, [[15, -3, 16, 5], [-15, -3, -16, 5]], accent, 1.4);
    ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(0, 0.5, 1.3, 0, Math.PI * 2); ctx.fill();
  },
  // Beetle: bulky two-pod bomber — a cockpit pod beside a long ordnance pod, under one shell.
  beetle(ctx, accent) {
    both(ctx, [[2, -12], [14, -14], [16, 4], [14, 14], [2, 10]], hullDark);
    ctx.beginPath(); ctx.ellipse(-5, -1, 4.5, 6, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    ctx.beginPath(); ctx.ellipse(5, 2, 3.5, 11, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    stripe(ctx, [[3, -2, 7, -2], [3, 2, 7, 2], [3, 6, 7, 6]], accent, 1.2);
    ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(-5, -4, 1.2, 0, Math.PI * 2); ctx.fill();
  },
  // Mantis: three-bladed heavy fighter (two wings plus a ventral blade) with a long head.
  mantis(ctx, accent) {
    both(ctx, [[3, -1], [16, 6], [14, 9], [3, 6]], hullDark);
    poly(ctx, [[-1.5, 6], [1.5, 6], [2, 18], [-2, 18]], hullDark);
    poly(ctx, [[0, -18], [3.5, -10], [3.5, 8], [-3.5, 8], [-3.5, -10]], hull);
    stripe(ctx, [[8, 3, 13, 6], [-8, 3, -13, 6], [0, 10, 0, 16]], accent, 1.4);
    ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(-1.3, -13, 0.9, 0, Math.PI * 2); ctx.arc(1.3, -13, 0.9, 0, Math.PI * 2); ctx.fill();
  },

  ...dominionArt, ...leagueArt, ...syndicateArt,

  generic(ctx, accent) {
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(12, 12); ctx.lineTo(0, 6); ctx.lineTo(-12, 12); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 4); ctx.lineWidth = 1.5; ctx.strokeStyle = accent; ctx.stroke();
  },
};
