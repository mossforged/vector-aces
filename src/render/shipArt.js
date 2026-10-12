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

  generic(ctx, accent) {
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(12, 12); ctx.lineTo(0, 6); ctx.lineTo(-12, 12); ctx.closePath();
    ctx.fillStyle = hull; ctx.fill(); stroke(ctx);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 4); ctx.lineWidth = 1.5; ctx.strokeStyle = accent; ctx.stroke();
  },
};
