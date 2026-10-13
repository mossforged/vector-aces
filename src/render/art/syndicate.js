// Ship art for the "syndicate" batch: { [artKey]: (ctx, accent) => void }, drawn in local coords
// (nose up = −y, centred, about ±18 mm). Original scrappy, mismatched silhouettes. (Hammerhead art lives in art/league.js.)
const hull = '#d9dde4', hullDark = '#8c94a3', rust = '#a58a6e', line = '#3b4250', glass = '#2a3f5a', flame = '#ffb35c';

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
  // Adder: a long serpentine hull with four short, wavy wings (two pairs, offset).
  adder(ctx, accent) {
    both(ctx, [[2, -8], [11, -12], [13, -9], [3, -3]], hullDark);
    both(ctx, [[2, 4], [12, 8], [12, 11], [2, 9]], hullDark);
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(4, -8, 3, 2); ctx.quadraticCurveTo(2.5, 12, 0, 16); ctx.quadraticCurveTo(-2.5, 12, -3, 2); ctx.quadraticCurveTo(-4, -8, 0, -18); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    stripe(ctx, [[-11, -10, -5, -7], [11, -10, 5, -7], [-11, 9, -5, 7], [11, 9, 5, 7]], accent, 1.2);
    canopy(ctx, 0, -10, 1.6, 3);
    engine(ctx, 0, 15.5, 1.3);
  },

  // Gnat: tiny round pod with one long wing bar and drooping wingtip pods.
  gnat(ctx, accent) {
    poly(ctx, [[-16, -2], [16, -2], [16, 2], [-16, 2]], hullDark);
    for (const x of [-15, 15]) poly(ctx, [[x - 1.6, -6], [x + 1.6, -6], [x + 1.6, 8], [x - 1.6, 8]], rust, 0.6);
    stripe(ctx, [[-12, 0, -6, 0], [12, 0, 6, 0]], accent, 1.6);
    circle(ctx, 0, 0, 6, hull);
    canopy(ctx, 0, -1.5, 3, 2.6);
    engine(ctx, 0, 6.5, 1.4);
  },

  // Raptor: a heavy blunt nose, forward-swept stub wings and a wide engine block.
  raptor(ctx, accent) {
    both(ctx, [[5, 2], [15, -7], [16, -3], [7, 9]], hullDark);
    poly(ctx, [[-4, -17], [4, -17], [6, -6], [8, 14], [-8, 14], [-6, -6]], hull);
    poly(ctx, [[-8, 8], [8, 8], [8, 14], [-8, 14]], rust, 0.6);
    stripe(ctx, [[-14, -4, -8, 1], [14, -4, 8, 1]], accent, 1.5);
    canopy(ctx, 0, -9, 2.4, 3);
    for (const x of [-4.5, 0, 4.5]) engine(ctx, x, 14.5, 1.3);
  },

  // Bloodhound: a hunched hull with a tall dorsal fin and two angled wings with gun barrels.
  bloodhound(ctx, accent) {
    both(ctx, [[5, -4], [16, 2], [15, 7], [6, 6]], hullDark);
    for (const x of [-14, 14]) { ctx.beginPath(); ctx.rect(x - 0.7, -6, 1.4, 8); ctx.fillStyle = line; ctx.fill(); }
    poly(ctx, [[0, -16], [6, -8], [6, 13], [-6, 13], [-6, -8]], hull);
    poly(ctx, [[-1.2, -2], [1.2, -2], [1.2, 15], [-1.2, 15]], rust, 0.5);
    stripe(ctx, [[-13, 3, -7, 2], [13, 3, 7, 2]], accent, 1.5);
    canopy(ctx, 0, -9, 2.6, 2.4);
    for (const x of [-4, 4]) engine(ctx, x, 13.5, 1.4);
  },

  // Warden: a slim fuselage between two broad curved wing-shields that rotate around it.
  warden(ctx, accent) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 4, -12); ctx.quadraticCurveTo(s * 18, -6, s * 15, 12); ctx.lineTo(s * 11, 12); ctx.quadraticCurveTo(s * 12, -3, s * 4, -6); ctx.closePath();
      ctx.fillStyle = hullDark; ctx.fill(); stroke(ctx);
    }
    stripe(ctx, [[-13, -4, -12, 8], [13, -4, 12, 8]], accent, 1.5);
    poly(ctx, [[0, -17], [3, -8], [3, 12], [-3, 12], [-3, -8]], hull);
    canopy(ctx, 0, -7, 1.6, 3);
    engine(ctx, 0, 12.5, 1.4);
  },

  // Hopper: a small cab on a frame with four big round engines at the corners.
  hopper(ctx, accent) {
    poly(ctx, [[-9, -9], [9, -9], [9, 9], [-9, 9]], hullDark, 0.6);
    for (const [x, y] of [[-11, -10], [11, -10], [-11, 10], [11, 10]]) { circle(ctx, x, y, 4.2, rust); engine(ctx, x, y, 1.8); }
    poly(ctx, [[-3.5, -14], [3.5, -14], [4.5, 4], [-4.5, 4]], hull);
    stripe(ctx, [[-9, 0, 9, 0]], accent, 1.6);
    canopy(ctx, 0, -9, 2.4, 2.6);
  },

  // Gharial: a long narrow snout, a chunky body and short wings with a narrow forward kill zone.
  gharial(ctx, accent) {
    both(ctx, [[5, 0], [15, 4], [15, 9], [6, 9]], hullDark);
    poly(ctx, [[-1.6, -18], [1.6, -18], [2.4, -6], [-2.4, -6]], hullDark, 0.6);
    poly(ctx, [[-6, -7], [6, -7], [7, 12], [-7, 12]], hull);
    stripe(ctx, [[0, -17, 0, -7]], accent, 1.2);
    stripe(ctx, [[-13, 6, -7, 5], [13, 6, 7, 5]], accent, 1.5);
    canopy(ctx, 0, -3, 2.6, 2.4);
    for (const x of [-3.5, 3.5]) engine(ctx, x, 12.5, 1.5);
  },
};
