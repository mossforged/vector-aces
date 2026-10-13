// Ship art for the "large" batch: { [artKey]: (ctx, accent) => void }, drawn in the same local coords as
// the small ships (nose up = −y, about ±18 units); the board scales large ships up to their 80 mm base.
// Original freighter / gunship / shuttle silhouettes, distinct at a glance.
const hull = '#d9dde4', hullDark = '#8c94a3', rust = '#a58a6e', line = '#3b4250', glass = '#2a3f5a', flame = '#ffb35c';

function stroke(ctx, w = 0.5) { ctx.lineWidth = w; ctx.strokeStyle = line; ctx.stroke(); }
function poly(ctx, pts, fill, w = 0.5) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); stroke(ctx, w);
}
const mirror = pts => pts.map(([x, y]) => [-x, y]);
function both(ctx, pts, fill, w) { poly(ctx, pts, fill, w); poly(ctx, mirror(pts), fill, w); }
function canopy(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = glass; ctx.fill(); }
function engine(ctx, x, y, r = 1.2) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = flame; ctx.fill(); }
function stripe(ctx, segs, accent, w = 1) {
  ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.lineWidth = w; ctx.strokeStyle = accent; ctx.stroke();
}
function circle(ctx, x, y, r, fill, w = 0.5) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); stroke(ctx, w); }
function turret(ctx, x, y, r = 2.6) { circle(ctx, x, y, r, hullDark); ctx.beginPath(); ctx.moveTo(x - 0.7, y); ctx.lineTo(x - 0.7, y - r - 2.2); ctx.moveTo(x + 0.7, y); ctx.lineTo(x + 0.7, y - r - 2.2); ctx.lineWidth = 0.7; ctx.strokeStyle = line; ctx.stroke(); }

export default {
  // Hauler: a round saucer with twin forward mandibles, an offset side cockpit and a top turret.
  hauler(ctx, accent) {
    both(ctx, [[2, -10], [5, -17], [8, -16], [8, -9]], hull);
    circle(ctx, 0, 1, 14, hull);
    circle(ctx, 0, 1, 9, hullDark, 0.4);
    poly(ctx, [[12, -3], [17, -6], [18, -3], [14, 1]], hull);
    canopy(ctx, 16.5, -4.5, 1.6, 1.4);
    stripe(ctx, [[-13, 6, -6, 12], [13, 6, 6, 12]], accent, 1.2);
    turret(ctx, 0, 1);
    for (const x of [-7, -2.5, 2.5, 7]) engine(ctx, x, 14.3, 1);
  },

  // Lantern: an upright, rounded hull seen from above — a teardrop with two flared wing plates.
  lantern(ctx, accent) {
    both(ctx, [[8, 0], [15, -6], [17, 4], [11, 10]], hullDark);
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(11, -12, 10, 4); ctx.quadraticCurveTo(8, 15, 0, 16); ctx.quadraticCurveTo(-8, 15, -10, 4); ctx.quadraticCurveTo(-11, -12, 0, -17); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    stripe(ctx, [[-8, -6, 8, -6], [-9, 2, 9, 2]], accent, 1.1);
    canopy(ctx, 0, -11, 3.4, 2);
    for (const x of [-3, 3]) engine(ctx, x, 15, 1.3);
  },

  // Heron: a central pod with a tall dorsal fin and two long folding wings angled down.
  heron(ctx, accent) {
    both(ctx, [[4, -2], [17, 8], [16, 11], [4, 5]], hullDark);
    poly(ctx, [[-5, -15], [5, -15], [6, 10], [-6, 10]], hull);
    poly(ctx, [[-1, -6], [1, -6], [1.4, 14], [-1.4, 14]], hullDark, 0.4);
    stripe(ctx, [[-15, 8, -6, 2], [15, 8, 6, 2]], accent, 1.1);
    canopy(ctx, 0, -12, 3.4, 1.8);
    for (const x of [-3.5, 3.5]) engine(ctx, x, 10.5, 1.1);
  },

  // Drifter: a flat freighter disc with a long side boom carrying the cockpit and a turret on top.
  drifter(ctx, accent) {
    circle(ctx, -3, 1, 13, hull);
    poly(ctx, [[8, -10], [17, -14], [18, 12], [9, 10]], hullDark);
    poly(ctx, [[13, -17], [17, -17], [17, -12], [13, -12]], hull);
    canopy(ctx, 15, -15, 1.5, 1.6);
    stripe(ctx, [[-14, 0, -6, 0], [10, 2, 16, 2]], accent, 1.2);
    turret(ctx, -3, 1);
    for (const x of [-9, -3, 3]) engine(ctx, x, 13.6, 1);
  },

  // Bastille: a huge armoured wedge with three wing plates and a central turret.
  bastille(ctx, accent) {
    both(ctx, [[5, -2], [18, 6], [17, 12], [5, 9]], hullDark);
    poly(ctx, [[-3, -18], [3, -18], [9, 4], [8, 14], [-8, 14], [-9, 4]], hull);
    poly(ctx, [[-1.6, 2], [1.6, 2], [1.6, 17], [-1.6, 17]], hullDark, 0.4);
    stripe(ctx, [[-16, 8, -7, 5], [16, 8, 7, 5]], accent, 1.3);
    canopy(ctx, 0, -12, 2.2, 2.6);
    turret(ctx, 0, -2, 3);
    for (const x of [-5, 0, 5]) engine(ctx, x, 14.5, 1.2);
  },

  // Mandible: a long split prow with two curved pincer booms and a slim spine.
  mandible(ctx, accent) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 3, 10); ctx.quadraticCurveTo(s * 15, 2, s * 9, -17); ctx.lineTo(s * 6, -16); ctx.quadraticCurveTo(s * 10, 0, s * 2, 6); ctx.closePath();
      ctx.fillStyle = hullDark; ctx.fill(); stroke(ctx);
    }
    poly(ctx, [[-3, -6], [3, -6], [4, 14], [-4, 14]], hull);
    stripe(ctx, [[-10, -8, -7, 2], [10, -8, 7, 2]], accent, 1.2);
    canopy(ctx, 0, -2, 1.8, 2.4);
    for (const x of [-2, 2]) engine(ctx, x, 14.5, 1.1);
  },

  // Hulk: a blunt, wide hauler with a raised forward cab and stubby side wings.
  hulk(ctx, accent) {
    both(ctx, [[10, 2], [17, 0], [17, 10], [10, 11]], hullDark);
    poly(ctx, [[-11, -8], [11, -8], [12, 14], [-12, 14]], hull);
    poly(ctx, [[-5, -17], [5, -17], [7, -8], [-7, -8]], hullDark);
    stripe(ctx, [[-10, 0, 10, 0], [-10, 6, 10, 6]], accent, 1.1);
    canopy(ctx, 0, -14, 3, 1.6);
    for (const x of [-7, 0, 7]) engine(ctx, x, 14.5, 1.3);
  },

  // Hearth: a broad flattened hull with a docking cradle cut into the stern and a top turret.
  hearth(ctx, accent) {
    poly(ctx, [[-4, -18], [4, -18], [16, -2], [17, 12], [6, 15], [6, 8], [-6, 8], [-6, 15], [-17, 12], [-16, -2]], hull);
    poly(ctx, [[-5, 8], [5, 8], [5, 15], [-5, 15]], '#2b3442', 0.4);
    stripe(ctx, [[-14, 2, -6, -4], [14, 2, 6, -4]], accent, 1.3);
    canopy(ctx, 0, -14, 2.6, 2);
    turret(ctx, 0, -3);
    for (const x of [-12, -8, 8, 12]) engine(ctx, x, 13.5, 1.1);
  },

  // Leaper: an asymmetric scout — a long hull with one big wing, a counterweight pod and a turret.
  leaper(ctx, accent) {
    poly(ctx, [[2, -4], [18, -8], [18, 4], [3, 6]], hullDark);
    poly(ctx, [[-14, -2], [-8, -4], [-8, 8], [-14, 8]], rust);
    poly(ctx, [[-3, -17], [3, -17], [4, 14], [-4, 14]], hull);
    stripe(ctx, [[6, -1, 16, -3]], accent, 1.4);
    canopy(ctx, 0, -13, 2, 2.4);
    turret(ctx, 0, 2, 2.2);
    for (const x of [-1.8, 1.8]) engine(ctx, x, 14.5, 1.1);
  },

  // Prowler: a long, narrow hull with a big ring gun mount around the middle.
  prowler(ctx, accent) {
    both(ctx, [[3, 4], [12, 8], [12, 13], [3, 11]], hullDark);
    poly(ctx, [[-2.5, -18], [2.5, -18], [4, 14], [-4, 14]], hull);
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = hullDark; ctx.stroke();
    circle(ctx, 0, -9, 1.6, accent, 0.4);
    stripe(ctx, [[0, -16, 0, -11]], accent, 1);
    canopy(ctx, 0, -6, 1.6, 2.2);
    for (const x of [-2, 2]) engine(ctx, x, 14.5, 1.1);
  },

  // Raven: a small hull under two enormous swept wing blades.
  raven(ctx, accent) {
    both(ctx, [[3, -4], [18, -17], [18, -12], [5, 6]], hullDark);
    poly(ctx, [[-4, -12], [4, -12], [5, 12], [-5, 12]], hull);
    stripe(ctx, [[-16, -14, -6, -5], [16, -14, 6, -5]], accent, 1.2);
    canopy(ctx, 0, -9, 2.4, 2);
    for (const x of [-2.5, 2.5]) engine(ctx, x, 12.5, 1.1);
  },

  // Pelican: a boxy troop hull with two long pivoting wings set forward.
  pelican(ctx, accent) {
    both(ctx, [[5, -8], [18, -6], [18, -2], [5, -2]], hullDark);
    poly(ctx, [[-5, -17], [5, -17], [7, 13], [-7, 13]], hull);
    for (const x of [-16, 16]) poly(ctx, [[x - 1.6, -10], [x + 1.6, -10], [x + 1.6, 2], [x - 1.6, 2]], hull, 0.4);
    stripe(ctx, [[-14, -4, -7, -4], [14, -4, 7, -4]], accent, 1.3);
    canopy(ctx, 0, -14, 3, 1.6);
    for (const x of [-4, 0, 4]) engine(ctx, x, 13.5, 1.1);
  },

  // Thunderhead: a wide bomber with folded-down wing pylons and a long bomb bay along the spine.
  thunderhead(ctx, accent) {
    both(ctx, [[5, -4], [17, -1], [17, 4], [5, 3]], hullDark);
    for (const x of [-17, 17]) poly(ctx, [[x - 1.4, -12], [x + 1.4, -12], [x + 1.4, 10], [x - 1.4, 10]], hullDark, 0.4);
    poly(ctx, [[-4, -18], [4, -18], [6, 14], [-6, 14]], hull);
    poly(ctx, [[-2.4, -4], [2.4, -4], [2.4, 11], [-2.4, 11]], '#2b3442', 0.4);
    stripe(ctx, [[-15, 1, -7, 1], [15, 1, 7, 1]], accent, 1.3);
    canopy(ctx, 0, -14, 2.4, 2);
    turret(ctx, 0, -8, 2);
    for (const x of [-3.5, 3.5]) engine(ctx, x, 14.5, 1.2);
  },
};
