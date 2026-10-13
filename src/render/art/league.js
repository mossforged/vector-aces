// Ship art for the "league" batch: { [artKey]: (ctx, accent) => void }, drawn in local coords
// (nose up = −y, centred, about ±18 mm). Original silhouettes, distinct at a glance.
const hull = '#d9dde4', hullDark = '#8c94a3', line = '#3b4250', glass = '#2a3f5a', flame = '#ffb35c';

function stroke(ctx, w = 0.8) { ctx.lineWidth = w; ctx.strokeStyle = line; ctx.stroke(); }
function poly(ctx, pts, fill, w = 0.8) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); stroke(ctx, w);
}
const mirror = pts => pts.map(([x, y]) => [-x, y]);
function both(ctx, pts, fill, w) { poly(ctx, pts, fill, w); poly(ctx, mirror(pts), fill, w); }
function canopy(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = glass; ctx.fill(); }
function engine(ctx, x, y, r = 1.6) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = flame; ctx.fill(); }
function stripe(ctx, segs, accent, w = 1.5) {
  ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.lineWidth = w; ctx.strokeStyle = accent; ctx.stroke();
}
function circle(ctx, x, y, r, fill, w = 0.7) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); stroke(ctx, w); }

export default {
  // Pavise: a broad kite-shield hull with a dorsal turret dome and two side engine pods.
  pavise(ctx, accent) {
    both(ctx, [[0, 12], [9, 9], [15, 4], [16, 9], [11, 14], [0, 15]], hullDark);
    poly(ctx, [[0, -15], [11, -6], [12, 6], [0, 13], [-12, 6], [-11, -6]], hull);
    stripe(ctx, [[-9, -4, 9, -4], [-10, 2, 10, 2]], accent, 1.3);
    circle(ctx, 0, -1, 4.2, hullDark);
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -8); ctx.lineWidth = 1.4; ctx.strokeStyle = line; ctx.stroke();
    canopy(ctx, 0, -10, 2, 1.6);
    for (const x of [-13, 13]) engine(ctx, x, 12, 1.5);
  },

  // Saber: needle fuselage with two staggered pairs of narrow wings and a split tail.
  saber(ctx, accent) {
    both(ctx, [[2, 2], [17, -3], [17, 0], [3, 7]], hullDark);
    both(ctx, [[2, 8], [12, 9], [12, 11], [2, 12]], hullDark, 0.6);
    stripe(ctx, [[-16, -1.5, -10, 1], [16, -1.5, 10, 1]], accent, 1.4);
    poly(ctx, [[0, -18], [2.6, -9], [3, 13], [1, 16], [-1, 16], [-3, 13], [-2.6, -9]], hull);
    canopy(ctx, 0, -5, 1.4, 3.2);
    for (const x of [-17, 17]) { ctx.beginPath(); ctx.rect(x - 0.6, -7, 1.2, 6); ctx.fillStyle = hullDark; ctx.fill(); }
    for (const x of [-2, 2]) engine(ctx, x, 15.5, 1.2);
  },

  // Skiff: compact rounded shuttle with stubby canted wings and a top turret.
  skiff(ctx, accent) {
    both(ctx, [[8, -2], [16, 3], [15, 8], [8, 8]], hullDark);
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.quadraticCurveTo(10, -14, 10, -2); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.lineTo(-10, -2); ctx.quadraticCurveTo(-10, -14, 0, -15); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    stripe(ctx, [[-8, 5, 8, 5]], accent, 1.6);
    canopy(ctx, 0, -9, 4.5, 2.2);
    circle(ctx, 0, 1, 2.6, hullDark);
    for (const x of [-5, 0, 5]) engine(ctx, x, 12.5, 1.3);
  },

  // Longbow: long fuselage, long straight wings with wingtip guns, and a rear gunner bubble.
  longbow(ctx, accent) {
    both(ctx, [[2, -3], [18, -1], [18, 3], [2, 5]], hullDark);
    for (const x of [-17, 17]) { ctx.beginPath(); ctx.rect(x - 0.8, -10, 1.6, 9); ctx.fillStyle = line; ctx.fill(); }
    stripe(ctx, [[-15, 1, -7, 1], [15, 1, 7, 1]], accent, 1.5);
    poly(ctx, [[0, -18], [3, -10], [3.5, 12], [0, 15], [-3.5, 12], [-3, -10]], hull);
    canopy(ctx, 0, -9, 1.6, 3);
    canopy(ctx, 0, 11, 1.8, 2);
    for (const x of [-7, 7]) engine(ctx, x, 5.5, 1.4);
  },

  // Ironwood: chunky hexagonal gunship with forward pincer mandibles and a wide prow.
  ironwood(ctx, accent) {
    both(ctx, [[4, -9], [9, -17], [11, -16], [9, -7]], hullDark);
    poly(ctx, [[-7, -10], [7, -10], [14, -2], [12, 12], [-12, 12], [-14, -2]], hull);
    poly(ctx, [[-9, 4], [9, 4], [8, 10], [-8, 10]], hullDark, 0.6);
    stripe(ctx, [[-12, -1, 12, -1]], accent, 1.8);
    canopy(ctx, 0, -6, 3.4, 1.8);
    for (const x of [-6, 6]) engine(ctx, x, 12.5, 1.8);
  },

  // Hammerhead: a wide hammer-shaped prow on a long spine, with twin tail fins over the bomb bay.
  hammerhead(ctx, accent) {
    poly(ctx, [[-16, -16], [16, -16], [16, -11], [4, -9], [-4, -9], [-16, -11]], hullDark);
    poly(ctx, [[-4, -10], [4, -10], [4.5, 10], [0, 13], [-4.5, 10]], hull);
    both(ctx, [[4, 4], [11, 10], [11, 14], [4, 10]], hullDark);
    stripe(ctx, [[-14, -13.5, 14, -13.5]], accent, 1.4);
    canopy(ctx, 0, -12.5, 2.6, 1.4);
    ctx.beginPath(); ctx.rect(-2, -1, 4, 6); ctx.fillStyle = line; ctx.fill();
    for (const x of [-9, 9]) engine(ctx, x, 13, 1.4);
  },

  // Tern: slim arrowhead shuttle with down-swept wings and a forked tail.
  tern(ctx, accent) {
    both(ctx, [[3, -2], [14, 9], [12, 11], [3, 6]], hullDark);
    both(ctx, [[2, 8], [6, 16], [4, 17], [1, 11]], hullDark, 0.6);
    poly(ctx, [[0, -17], [4, -6], [4, 9], [-4, 9], [-4, -6]], hull);
    stripe(ctx, [[-3, 0, 3, 0], [-11, 8, -6, 4], [11, 8, 6, 4]], accent, 1.3);
    canopy(ctx, 0, -9, 2, 2.8);
    engine(ctx, 0, 10, 1.5);
  },
};
