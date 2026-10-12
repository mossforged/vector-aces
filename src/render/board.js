// Canvas renderer for the play area. Knows nothing about rules beyond read-only queries.
//
//   const view = new BoardView(canvas, { onShipClick, onPlace, onHover })
//   view.setState(state, events)   // events animate (moves, destroyed, hits)
//   view.setViewer(player)         // flips the table so `player`'s edge is at the bottom
//   view.setHighlight({ ships, poses, line, template })
//   view.setPlacement({ kind: 'deploy'|'obstacle', shape, zone, size }) | null
import { CONFIG, ASTEROIDS } from '../data/config.js';
import { FACTIONS } from '../data/factions.js';
import { Q, G, deployZone } from '../engine/index.js';
import { drawShipArt } from './shipArt.js';

const W = CONFIG.playArea;
const MOVE_MS = 650;

export class BoardView {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.h = handlers;
    this.state = null; this.viewer = null; this.flip = false;
    this.highlight = {}; this.placement = null; this.selected = null;
    this.anims = []; this.fx = []; this.ghosts = [];
    this.mouse = null; this.placeRot = 0;
    this.stars = makeStars();
    this._bind();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // ---------- public API ----------
  setViewer(player) { this.viewer = player; this.flip = player && this.state?.players[player]?.edge === 'top'; }
  setSelected(id) { this.selected = id; }
  setHighlight(h) { this.highlight = h || {}; }
  setPlacement(p) {
    this.placement = p;
    if (p && p.kind === 'deploy') this.placeRot = p.defaultHeading ?? 0;
  }
  isAnimating() { return this.anims.length > 0; }

  setState(state, events = []) {
    const prev = this.state;
    this.state = state;
    if (this.viewer) this.setViewer(this.viewer);
    // Never let the picture lag far behind the rules: if a backlog builds up, snap old moves.
    const now = performance.now();
    if (Math.max(0, ...this.anims.map(a => a.start + a.dur)) - now > 400) this.anims = [];
    let t = Math.max(now, ...this.anims.map(a => a.start + a.dur));
    for (const ev of events) {
      if (ev.type === 'move' && ev.path?.length > 1) {
        this.anims.push({ ship: ev.ship, path: ev.path, start: t, dur: ev.path.length > 2 ? MOVE_MS : 300 });
        t += ev.path.length > 2 ? MOVE_MS : 300;
      } else if (ev.type === 'destroyed') {
        const s = prev?.ships[ev.ship] || state.ships[ev.ship];
        const pose = this._lastAnimPose(ev.ship) || s.pose;
        if (pose) this.ghosts.push({ ship: { ...state.ships[ev.ship], pose }, start: t, dur: 900 });
      } else if (ev.type === 'damage' || ev.type === 'shield') {
        this.fx.push({ kind: ev.type === 'shield' ? 'shield' : (ev.faceup ? 'crit' : 'hit'), ship: ev.ship, start: t, dur: 700 });
      } else if (ev.type === 'attackResult') {
        this.fx.push({ kind: 'laser', from: ev.attacker, to: ev.defender, start: t - 200, dur: 500, hit: ev.hits + ev.crits > 0 });
      }
    }
  }

  // ---------- coordinates ----------
  get scale() { return this.canvas.width / W; }
  toScreen(p) { const x = this.flip ? W - p.x : p.x, y = this.flip ? W - p.y : p.y; return { x: x * this.scale, y: y * this.scale }; }
  toTable(px, py) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((px - r.left) / r.width) * W, y = ((py - r.top) / r.height) * W;
    return this.flip ? { x: W - x, y: W - y } : { x, y };
  }
  _applyTable(ctx) { // set transform so we can draw in table mm
    const s = this.scale;
    if (this.flip) ctx.setTransform(-s, 0, 0, -s, W * s, W * s); else ctx.setTransform(s, 0, 0, s, 0, 0);
  }

  _bind() {
    const c = this.canvas;
    const fit = () => {
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.width * dpr);
    };
    new ResizeObserver(fit).observe(c); fit();
    c.addEventListener('mousemove', e => {
      this.mouse = this.toTable(e.clientX, e.clientY);
      const s = this._shipAt(this.mouse);
      this.h.onHover?.(s?.id || null);
      c.style.cursor = this.placement ? 'crosshair' : (s ? 'pointer' : 'default');
    });
    c.addEventListener('mouseleave', () => { this.mouse = null; this.h.onHover?.(null); });
    c.addEventListener('wheel', e => { if (!this.placement) return; e.preventDefault(); this.placeRot += (e.deltaY > 0 ? 1 : -1) * (Math.PI / 12); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!this.placement) return;
      if (e.key === 'q' || e.key === 'Q') this.placeRot -= Math.PI / 12;
      if (e.key === 'e' || e.key === 'E') this.placeRot += Math.PI / 12;
    });
    c.addEventListener('click', e => {
      const p = this.toTable(e.clientX, e.clientY);
      if (this.placement) { this.h.onPlace?.({ x: Math.round(p.x), y: Math.round(p.y), h: this.placeRot, rot: this.placeRot }); return; }
      const s = this._shipAt(p);
      this.h.onShipClick?.(s?.id || null);
    });
    // touch: tap to place / select
    c.addEventListener('touchend', e => {
      const t = e.changedTouches[0]; if (!t) return;
      const p = this.toTable(t.clientX, t.clientY);
      if (this.placement) { e.preventDefault(); this.h.onPlace?.({ x: Math.round(p.x), y: Math.round(p.y), h: this.placeRot, rot: this.placeRot }); }
    });
  }

  _shipAt(p) {
    if (!this.state) return null;
    return Q.liveShips(this.state).find(s => G.pointInPolygon(p, G.basePolygon(this._pose(s), 'small')));
  }

  _lastAnimPose(id) { const a = this.anims.filter(x => x.ship === id).at(-1); return a ? a.path.at(-1) : null; }

  _pose(s, now = performance.now()) {
    const queued = this.anims.filter(a => a.ship === s.id);
    if (!queued.length) return s.pose;
    const a = queued[0];
    if (now < a.start) return a.path[0];
    const t = Math.min(1, (now - a.start) / a.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const f = e * (a.path.length - 1), i = Math.min(a.path.length - 2, Math.floor(f)), k = f - i;
    const p0 = a.path[i], p1 = a.path[i + 1];
    let dh = G.normAngle(p1.h - p0.h);
    if (a.path.length === 2) dh = p1.h - p0.h;
    return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, h: p0.h + dh * k };
  }

  // ---------- drawing ----------
  draw() {
    const { ctx, canvas } = this;
    const now = performance.now();
    this.anims = this.anims.filter(a => now < a.start + a.dur);
    this.fx = this.fx.filter(f => now < f.start + f.dur);
    this.ghosts = this.ghosts.filter(g => now < g.start + g.dur);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.state) return;
    const st = this.state;
    this._applyTable(ctx);

    // stars
    for (const s of this.stars) { ctx.fillStyle = `rgba(220,230,255,${s.a})`; ctx.fillRect(s.x, s.y, s.r, s.r); }

    // setup zones (only before/at deploy, faint afterwards)
    const early = ['setup', 'obstacles', 'deploy'].includes(st.phase);
    for (const p of st.playerOrder) {
      const z = deployZone(st, p);
      ctx.fillStyle = hexA(FACTIONS[p].color, early ? 0.14 : 0.05);
      ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    }
    if (st.phase === 'obstacles') {
      const m = CONFIG.obstacleEdgeClearance * CONFIG.rangeBand;
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(m, m, W - 2 * m, W - 2 * m); ctx.setLineDash([]);
    }

    // obstacles
    for (const poly of Q.obstaclePolys(st)) drawAsteroid(ctx, poly);

    // highlight: template / range line / candidate poses
    const hl = this.highlight;
    if (hl.template) { ctx.beginPath(); hl.template.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); }
    if (hl.line) drawRangeLine(ctx, hl.line.a, hl.line.b);
    for (const pose of hl.poses || []) drawBaseOutline(ctx, pose, 'rgba(255,255,255,0.7)', true);

    // firing arcs for selected / hovered
    for (const s of Q.liveShips(st)) {
      if (s.id === this.selected || (hl.ships || []).includes(s.id)) drawArc(ctx, this._pose(s, now), FACTIONS[s.owner].arcColor);
    }

    // ghosts of destroyed ships
    for (const g of this.ghosts) {
      ctx.globalAlpha = 1 - (now - g.start) / g.dur;
      if (now >= g.start) drawShip(ctx, g.ship, g.ship.pose, { flip: this.flip });
      ctx.globalAlpha = 1;
    }

    // ships
    for (const s of Q.liveShips(st)) {
      const pose = this._pose(s, now);
      const hot = (hl.ships || []).includes(s.id);
      drawShip(ctx, s, pose, { selected: s.id === this.selected, hot, flip: this.flip, state: st });
    }

    // effects
    for (const f of this.fx) {
      if (now < f.start) continue;
      const k = (now - f.start) / f.dur;
      if (f.kind === 'laser') {
        const a = st.ships[f.from], b = st.ships[f.to]; if (!a?.pose || !b?.pose) continue;
        ctx.strokeStyle = `rgba(255,${f.hit ? 90 : 220},80,${1 - k})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a.pose.x, a.pose.y); ctx.lineTo(b.pose.x, b.pose.y); ctx.stroke();
      } else {
        const s = st.ships[f.ship]; const pose = s?.pose || this._lastAnimPose(f.ship); if (!pose) continue;
        const col = f.kind === 'shield' ? '90,170,255' : f.kind === 'crit' ? '255,200,60' : '255,90,60';
        ctx.strokeStyle = `rgba(${col},${1 - k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(pose.x, pose.y, 24 + k * 22, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // placement ghost
    if (this.placement && this.mouse) {
      const pl = this.placement;
      if (pl.kind === 'deploy') {
        const z = pl.zone; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 6]); ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.setLineDash([]);
        const pose = { x: this.mouse.x, y: this.mouse.y, h: this.placeRot };
        ctx.globalAlpha = 0.6; drawShip(ctx, pl.ship, pose, { flip: this.flip }); ctx.globalAlpha = 1;
      } else if (pl.kind === 'obstacle') {
        ctx.globalAlpha = 0.6; drawAsteroid(ctx, G.placeShape(ASTEROIDS[pl.shape], this.mouse.x, this.mouse.y, this.placeRot)); ctx.globalAlpha = 1;
      }
    }

    // range ruler legend
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// ---------- drawing helpers (table-mm space) ----------

function makeStars() {
  let seed = 1337; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * W, r: r() < 0.9 ? 1.2 : 2.2, a: 0.25 + r() * 0.6 }));
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawAsteroid(ctx, poly) {
  ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  const g = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 50);
  g.addColorStop(0, '#8a7a68'); g.addColorStop(1, '#3b332c');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1e1a16'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(cx + 8, cy + 4, 6, 0, Math.PI * 2); ctx.arc(cx - 9, cy + 9, 4, 0, Math.PI * 2); ctx.fill();
}

function drawArc(ctx, pose, color) {
  const poly = G.arcPolygon(pose);
  const R = CONFIG.rangeBand * CONFIG.maxRange + 20;
  const a0 = pose.h - CONFIG.arcHalfAngle * G.DEG - Math.PI / 2, a1 = pose.h + CONFIG.arcHalfAngle * G.DEG - Math.PI / 2;
  for (let band = 3; band >= 1; band--) {
    ctx.beginPath(); ctx.moveTo(pose.x, pose.y);
    ctx.arc(pose.x, pose.y, band * CONFIG.rangeBand + 20, a0, a1); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y); ctx.lineTo(pose.x + Math.cos(a0) * R, pose.y + Math.sin(a0) * R);
  ctx.moveTo(pose.x, pose.y); ctx.lineTo(pose.x + Math.cos(a1) * R, pose.y + Math.sin(a1) * R); ctx.stroke();
}

function drawRangeLine(ctx, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.lineWidth = 3;
  for (let band = 0; band < 3; band++) {
    const t0 = (band * CONFIG.rangeBand) / Math.max(d, 1), t1 = Math.min(1, ((band + 1) * CONFIG.rangeBand) / Math.max(d, 1));
    if (t0 >= 1) break;
    ctx.strokeStyle = ['#7cf29a', '#f2d27c', '#f28a7c'][band];
    ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0); ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1); ctx.stroke();
  }
}

function drawBaseOutline(ctx, pose, color, dashed) {
  const poly = G.basePolygon(pose, 'small');
  ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  if (dashed) ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
}

function drawShip(ctx, s, pose, { selected, hot, flip, state } = {}) {
  const fac = FACTIONS[s.owner];
  const half = CONFIG.baseSize.small / 2;
  ctx.save();
  ctx.translate(pose.x, pose.y); ctx.rotate(pose.h);
  // base
  ctx.fillStyle = 'rgba(20,24,34,0.88)';
  ctx.fillRect(-half, -half, half * 2, half * 2);
  // printed arc lines on the token
  ctx.strokeStyle = hexA(fac.color, 0.9); ctx.lineWidth = 1.2;
  const t = Math.tan(CONFIG.arcHalfAngle * G.DEG) * half;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-t, -half); ctx.moveTo(0, 0); ctx.lineTo(t, -half); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-t, -half); ctx.lineTo(t, -half); ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = selected ? '#ffffff' : hot ? '#ffe27a' : hexA(fac.color, 0.95);
  ctx.lineWidth = selected || hot ? 2.4 : 1.4;
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  drawShipArt(ctx, Q.chassis(s).art, fac.color);
  ctx.restore();

  if (!state) return;
  // upright labels & tokens (counter-rotate if the board is flipped)
  ctx.save();
  ctx.translate(pose.x, pose.y);
  if (flip) ctx.rotate(Math.PI);
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  const skill = Q.effectiveSkill(state, s);
  // pilot skill badge
  ctx.fillStyle = '#f29a3a'; ctx.beginPath(); ctx.arc(-half - 6, -half + 6, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillText(String(skill), -half - 6, -half + 10);
  if (s.tag) { ctx.fillStyle = '#ddd'; ctx.fillText('#' + s.tag, half + 8, -half + 10); }
  // hull/shield pips
  const hullLeft = Q.chassis(s).hull - Q.hullDamage(s);
  let x = -half;
  for (let i = 0; i < s.shields; i++, x += 7) { ctx.fillStyle = '#5aa8ff'; ctx.fillRect(x, half + 4, 5, 5); }
  for (let i = 0; i < hullLeft; i++, x += 7) { ctx.fillStyle = '#f2d24a'; ctx.fillRect(x, half + 4, 5, 5); }
  // tokens
  const tokens = [];
  for (let i = 0; i < s.tokens.focus; i++) tokens.push(['F', '#3fbf6b']);
  for (let i = 0; i < s.tokens.evade; i++) tokens.push(['E', '#3fa0bf']);
  for (let i = 0; i < s.stress; i++) tokens.push(['!', '#e04040']);
  if (s.damage.some(c => c.faceup)) tokens.push(['✸', '#e0a030']);
  tokens.forEach(([txt, col], i) => {
    const ty = -half + 4 + i * 15;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(half + 9, ty + 12, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, half + 9, ty + 16);
  });
  // locks: show a red marker on ships that are locked, labelled with the locker's skill
  const lockers = Q.liveShips(state).filter(o => o.lockOn === s.id);
  lockers.forEach((o, i) => {
    ctx.fillStyle = '#c03030'; ctx.fillRect(-half - 14, -half + 16 + i * 14, 11, 11);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.fillText('⌖', -half - 8.5, -half + 25 + i * 14);
  });
  ctx.restore();
}
