// Ship art for the "dominion" batch: { [artKey]: (ctx, accent) => void }, drawn in local coords
// (nose up = −y, centred, about ±18 mm). Original insect-and-blade silhouettes, distinct at a glance.
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
  // Specter: a dagger body with long hooked wings that curl down at the tips.
  specter(ctx, accent) {
    both(ctx, [[2, -2], [16, 4], [17, 12], [14, 7], [3, 6]], hullDark);
    poly(ctx, [[0, -17], [3.5, -4], [3, 12], [0, 15], [-3, 12], [-3.5, -4]], hull);
    stripe(ctx, [[-14, 5.5, -5, 3], [14, 5.5, 5, 3]], accent, 1.3);
    canopy(ctx, 0, -7, 1.8, 3);
    engine(ctx, 0, 14, 1.4);
  },

  // Maul: two heavy parallel pods joined by a wing bar, cockpit in the middle.
  maul(ctx, accent) {
    for (const x of [-10, 10]) poly(ctx, [[x - 4, -12], [x + 4, -12], [x + 4.5, 12], [x - 4.5, 12]], hullDark);
    poly(ctx, [[-6, -3], [6, -3], [6, 4], [-6, 4]], hull);
    circle(ctx, 0, 0, 4.5, hull);
    canopy(ctx, 0, 0, 2.6, 2.6);
    stripe(ctx, [[-10, -10, -10, 8], [10, -10, 10, 8]], accent, 1.4);
    for (const x of [-10, 10]) engine(ctx, x, 12.5, 1.8);
  },

  // Vespid: round cockpit between two flat hexagonal wing panels with accent bars.
  vespid(ctx, accent) {
    for (const s of [-1, 1]) poly(ctx, [[s * 9, -15], [s * 14, -8], [s * 14, 8], [s * 9, 15], [s * 7.5, 8], [s * 7.5, -8]], hullDark);
    stripe(ctx, [[-11, -9, -11, 9], [11, -9, 11, 9]], accent, 1.6);
    poly(ctx, [[-7.5, -1.2], [7.5, -1.2], [7.5, 1.2], [-7.5, 1.2]], hull, 0.6);
    circle(ctx, 0, 0, 5, hull);
    canopy(ctx, 0, -1, 2.8, 2.8);
  },

  // Stiletto: a needle body with two forked blade wings reaching forward past the nose.
  stiletto(ctx, accent) {
    both(ctx, [[2, 6], [10, -4], [11, -16], [13, -15], [13, -3], [4, 10]], hullDark);
    stripe(ctx, [[-11.5, -13, -11, -5], [11.5, -13, 11, -5]], accent, 1.4);
    poly(ctx, [[0, -14], [3, -6], [3, 13], [-3, 13], [-3, -6]], hull);
    canopy(ctx, 0, -4, 1.7, 3);
    for (const x of [-1.6, 1.6]) engine(ctx, x, 13.5, 1.1);
  },

  // Gadfly: wide two-seat cockpit, angled wing panels and a rear gun bubble.
  gadfly(ctx, accent) {
    for (const s of [-1, 1]) poly(ctx, [[s * 8, -14], [s * 15, -4], [s * 15, 6], [s * 8, 14], [s * 7, 5], [s * 7, -5]], hullDark);
    stripe(ctx, [[-12, -6, -12, 6], [12, -6, 12, 6]], accent, 1.5);
    poly(ctx, [[-7, -1], [7, -1], [7, 1], [-7, 1]], hull, 0.6);
    ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 7, 0, 0, Math.PI * 2); ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    canopy(ctx, 0, -3, 2.6, 2);
    canopy(ctx, 0, 4.5, 2, 1.6);
  },

  // Harrier: narrow cockpit, short angled wings and two big side engine nacelles.
  harrier(ctx, accent) {
    both(ctx, [[3, -4], [13, -10], [15, -8], [8, 2]], hullDark);
    for (const x of [-7, 7]) { poly(ctx, [[x - 2.5, -4], [x + 2.5, -4], [x + 2.5, 12], [x - 2.5, 12]], hull); engine(ctx, x, 12.5, 1.8); }
    poly(ctx, [[0, -16], [3, -8], [3, 6], [-3, 6], [-3, -8]], hull);
    stripe(ctx, [[-13, -8.5, -6, -4.5], [13, -8.5, 6, -4.5]], accent, 1.5);
    canopy(ctx, 0, -9, 1.8, 2.8);
  },

  // Scorpion: pincer wings forward and a curled stinger turret over the tail.
  scorpion(ctx, accent) {
    both(ctx, [[4, -4], [12, -14], [15, -12], [9, 0]], hullDark);
    poly(ctx, [[-5, -8], [5, -8], [6, 6], [0, 9], [-6, 6]], hull);
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(7, 14, 0, 16); ctx.lineWidth = 2.4; ctx.strokeStyle = hullDark; ctx.stroke();
    circle(ctx, 0, 15.5, 2.2, hullDark);
    stripe(ctx, [[-12, -11, -8, -5], [12, -11, 8, -5]], accent, 1.4);
    canopy(ctx, 0, -3, 2.4, 2.2);
  },

  // Starling: a trapezoid wedge with two hinged wing slats folded out.
  starling(ctx, accent) {
    both(ctx, [[6, -2], [16, 2], [16, 7], [6, 7]], hullDark);
    both(ctx, [[6, 8], [14, 10], [14, 13], [6, 12]], hullDark, 0.6);
    poly(ctx, [[-3, -16], [3, -16], [7, 13], [-7, 13]], hull);
    stripe(ctx, [[-14, 4.5, -7, 4.5], [14, 4.5, 7, 4.5]], accent, 1.6);
    canopy(ctx, 0, -9, 2, 3);
    for (const x of [-3.5, 3.5]) engine(ctx, x, 13.5, 1.4);
  },

  // Nightjar: long arrowhead with chevron wings swept far back and a sharp nose.
  nightjar(ctx, accent) {
    both(ctx, [[2, -6], [17, 10], [15, 13], [3, 6]], hullDark);
    poly(ctx, [[0, -18], [4, -5], [4, 12], [-4, 12], [-4, -5]], hull);
    stripe(ctx, [[-15, 10, -5, 1], [15, 10, 5, 1]], accent, 1.5);
    canopy(ctx, 0, -6, 1.8, 3.2);
    for (const x of [-2, 2]) engine(ctx, x, 12.5, 1.3);
  },

  // Reaver: wide flat troop body under broad gull wings.
  reaver(ctx, accent) {
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-9, -12, 0, -8); ctx.quadraticCurveTo(9, -12, 17, 0); ctx.lineTo(15, 4); ctx.quadraticCurveTo(9, -5, 0, -2); ctx.quadraticCurveTo(-9, -5, -15, 4); ctx.closePath();
    ctx.fillStyle = hullDark; ctx.fill(); stroke(ctx);
    poly(ctx, [[-6, -10], [6, -10], [8, 12], [-8, 12]], hull);
    stripe(ctx, [[-12, -3, -6, -6], [12, -3, 6, -6], [-6, 6, 6, 6]], accent, 1.4);
    canopy(ctx, 0, -6, 3, 2);
    for (const x of [-4, 4]) engine(ctx, x, 12.5, 1.5);
  },
};
