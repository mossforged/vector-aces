// Canvas renderer for the play area: a tilted, rotatable "isometric" table.
// Read-only with respect to the rules; all projection math lives in camera.js.
//
//   const view = new BoardView(canvas, { onShipClick, onPlace, onHover })
//   view.setState(state, events)   // events animate in order on view.timeline (moves, shots, hits…)
//   view.timeline                  // shared playback clock (render/timeline.js); view.timeline.busy()
//   view.setViewer(player)         // rotates the table so `player`'s edge faces you
//   view.setHighlight({ ships, poses, line, template })
//   view.setPlacement({ kind: 'deploy'|'obstacle', ship, shape, zone }) | null
//   view.camera                    // rotate/tilt/zoom programmatically (see camera.js)
//   view.setView('iso'|'top')
//
// Mouse: drag = rotate (left/right) + tilt (up/down) · right-drag or shift-drag = pan ·
//        wheel = zoom · while placing: Q/E or shift+wheel rotates the piece.
import { CONFIG, ASTEROIDS } from '../data/config.js';
import { FACTIONS } from '../data/factions.js';
import { Q, G, deployZone } from '../engine/index.js';
import { drawShipArt } from './shipArt.js';
import { Camera } from './camera.js';
import { label } from '../ui/names.js';
import { ORDNANCE } from '../data/ordnance.js';
import { ordnancePolys } from '../engine/ordnance.js';
import { UPGRADES } from '../data/upgrades.js';
import { Timeline } from './timeline.js';
import { FX, shotKind } from './fx.js';

const W = CONFIG.playArea;
const MOVE_MS = 650;
const FLY = 34;            // ship flight height above the table (mm, visual only)
const SLAB = 16;           // table thickness (mm, visual only)

export class BoardView {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.h = handlers;
    this.camera = new Camera();
    this.state = null; this.viewer = null;
    this.highlight = {}; this.placement = null; this.selected = null; this.hover = null;
    this.anims = []; this.fx = []; this.ghosts = [];
    this.timeline = new Timeline(); this.particles = new FX();
    this._attack = null; this._impact = null;
    this.mouse = null; this.placeRot = 0; this.dpr = 1;
    this.bgStars = null;
    this._bind();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // ---------- public API ----------
  setViewer(player) {
    this.viewer = player;
    this.camera.baseYaw = player && this.state?.players[player]?.edge === 'top' ? Math.PI : 0;
  }
  setSelected(id) { this.selected = id; }
  setHighlight(h) { this.highlight = h || {}; }
  setPlacement(p) {
    const changed = (p && p.ship?.id) !== (this.placement && this.placement.ship?.id) || p?.kind !== this.placement?.kind;
    this.placement = p;
    if (p && changed) this.placeRot = p.kind === 'deploy' ? (p.defaultHeading ?? 0) : 0;
  }
  setView(kind) { this.camera.reset(kind === 'top'); }
  isAnimating() { return this.timeline.busy() > 0 || this.anims.length > 0; }

  /** New state + the events that produced it. Call event-by-event (`setState(s, [ev])`) to
   *  interleave with the dice mat, which shares `this.timeline`. Nothing is ever skipped: a long
   *  backlog just plays faster (see Timeline.rate). */
  setState(state, events = []) {
    const prev = this.state;
    this.state = state;
    if (this.viewer) this.setViewer(this.viewer);
    for (const ev of events) this._event(ev, prev || state, state);
  }

  _shipPoint(st, id, z = FLY) { const s = st.ships[id]; const p = this._lastAnimPose(id) || s?.pose; return p ? { x: p.x, y: p.y, z } : null; }

  _event(ev, prev, state) {
    const tl = this.timeline, fx = this.particles;
    switch (ev.type) {
      case 'move': {
        if (!(ev.path?.length > 1)) return;
        this._impact = null;
        const ms = ev.path.length > 2 ? MOVE_MS : 320;
        const start = tl.reserve(ms);
        this.anims.push({ ship: ev.ship, path: ev.path, start, dur: tl.scale(ms), color: state.players[state.ships[ev.ship].owner].color });
        return;
      }
      case 'attackDice':
        if (ev.roll) { this._attack = { weapon: ev.weapon, n: ev.dice.length, attacker: ev.attacker, defender: ev.defender }; this._impact = null; }
        return;
      case 'attackResult': {
        const at = this._attack?.attacker === ev.attacker ? this._attack : { weapon: 'primary', n: 2 };
        const from = this._shipPoint(state, ev.attacker), to = this._shipPoint(state, ev.defender);
        if (!from || !to) return;
        const kind = shotKind(at.weapon, UPGRADES[at.weapon]);
        const volley = /swarm|burst/.test(at.weapon) ? 3 : /rotary/.test(at.weapon) ? 3 : kind === 'laser' ? Math.max(1, Math.min(4, at.n)) : 1;
        const lands = ev.hits + ev.crits > 0 || ev.hit ? Math.max(1, Math.min(volley, ev.hits + ev.crits)) : 0;
        const color = state.players[state.ships[ev.attacker].owner].color;
        const rate = tl.rate;
        const travelEst = Math.max(180, Math.hypot(to.x - from.x, to.y - from.y) / (kind === 'torpedo' ? 0.38 : kind === 'missile' ? 0.45 : kind === 'cannon' ? 0.8 : kind === 'ion' ? 0.9 : 1.1));
        const start = tl.reserve(travelEst + 250);
        fx.at(start, () => fx.fire({ kind, from, to, color, hits: lands, n: volley, rate }));
        this._impact = { t: start + travelEst / rate, i: 0, ion: kind === 'ion' };
        return;
      }
      case 'damage': case 'shield': {
        const p = this._shipPoint(state, ev.ship); if (!p) return;
        const t = this._impact ? this._impact.t + tl.scale(110) * this._impact.i++ : tl.reserve(300);
        const kind = ev.type === 'shield' ? 'shield' : this._impact?.ion ? 'ion' : ev.faceup ? 'crit' : 'hit';
        fx.at(t, () => fx.impact(p, kind));
        if (this._impact) tl.holdUntil(t + tl.scale(200));
        return;
      }
      case 'destroyed': {
        const s = prev.ships[ev.ship] || state.ships[ev.ship];
        const pose = this._lastAnimPose(ev.ship) || s.pose;
        if (!pose) return;
        const t = this._impact ? Math.max(performance.now(), this._impact.t + tl.scale(110) * this._impact.i + tl.scale(150)) : tl.reserve(0);
        const dur = tl.scale(1100);
        this.ghosts.push({ ship: { ...state.ships[ev.ship], pose }, start: t, dur });
        fx.at(t, () => fx.explode({ x: pose.x, y: pose.y, z: FLY }));
        tl.holdUntil(t + tl.scale(900));
        return;
      }
      case 'detonate': {
        this._impact = null;
        const t = tl.reserve(700);
        this.fx.push({ kind: 'blast', x: ev.x, y: ev.y, start: t, dur: tl.scale(900), big: ev.kind === 'bomb' });
        fx.at(t, () => fx.blast({ x: ev.x, y: ev.y, z: 0 }, ev.kind === 'bomb'));
        this._impact = { t: t + tl.scale(150), i: 0 };
        return;
      }
      case 'drop': {
        const p = this._shipPoint(state, ev.ship); if (!p) return;
        const t = tl.reserve(450);
        fx.at(t, () => fx.drop(p));
        return;
      }
      case 'cloak': case 'decloak': {
        const p = this._shipPoint(state, ev.ship); if (!p) return;
        const t = tl.reserve(ev.type === 'cloak' ? 500 : 0);
        fx.at(t, () => fx.shimmer(p));
        return;
      }
      default:
    }
  }

  // ---------- input ----------
  _canvasPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.dpr, y: (e.clientY - r.top) * this.dpr };
  }

  _bind() {
    const c = this.canvas;
    const fit = () => {
      const r = c.getBoundingClientRect();
      this.dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * this.dpr)); c.height = Math.max(1, Math.round(r.height * this.dpr));
      const first = this.camera.w === 1;
      this.camera.setViewport(c.width, c.height);
      if (first) this.camera.reset();
      this.bgStars = makeScreenStars(c.width, c.height);
    };
    new ResizeObserver(fit).observe(c); fit();

    let drag = null;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      const pan = e.button === 2 || e.button === 1 || e.shiftKey;
      drag = { x: e.clientX, y: e.clientY, moved: 0, pan, button: e.button };
    });
    c.addEventListener('pointermove', e => {
      const p = this._canvasPoint(e);
      this.mouse = this.camera.unproject(p.x, p.y);
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
        if (drag.moved > 4) {
          if (drag.pan) this.camera.panBy(dx * this.dpr, dy * this.dpr);
          else { this.camera.rotateBy(-dx * 0.008); this.camera.tiltBy(dy * 0.006); }
          this.hover = null; this.h.onHover?.(null);
          return;
        }
      }
      const s = this._shipAtScreen(p);
      this.hover = s?.id || null;
      this.h.onHover?.(this.hover, e.clientX, e.clientY);
      c.style.cursor = this.placement ? 'crosshair' : (s ? 'pointer' : 'grab');
    });
    c.addEventListener('pointerup', e => {
      const d = drag; drag = null;
      if (!d || d.moved > 4 || d.button !== 0) return;
      const p = this._canvasPoint(e);
      const t = this.camera.unproject(p.x, p.y);
      if (this.placement) { this.h.onPlace?.({ x: Math.round(t.x), y: Math.round(t.y), h: this.placeRot, rot: this.placeRot }); return; }
      this.h.onShipClick?.(this._shipAtScreen(p)?.id || null);
    });
    c.addEventListener('pointerleave', () => { this.mouse = null; this.hover = null; this.h.onHover?.(null); });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.placement && e.shiftKey) { this.placeRot += (e.deltaY > 0 ? 1 : -1) * (Math.PI / 12); return; }
      const p = this._canvasPoint(e);
      this.camera.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target.matches?.('input, textarea, select')) return;
      if (this.placement && (e.key === 'q' || e.key === 'Q')) this.placeRot -= Math.PI / 12;
      if (this.placement && (e.key === 'e' || e.key === 'E')) this.placeRot += Math.PI / 12;
    });
  }

  _shipAtScreen(p) {
    if (!this.state) return null;
    const cam = this.camera, r = 24 * cam.scale;
    let best = null, bestDepth = -Infinity;
    const ground = cam.unproject(p.x, p.y);
    for (const s of Q.liveShips(this.state)) {
      const pose = this._pose(s);
      const top = cam.project(pose.x, pose.y, FLY);
      const onModel = Math.hypot(p.x - top.x, p.y - top.y) < r;
      const onBase = G.pointInPolygon(ground, G.basePolygon(pose, 'small'));
      if (!onModel && !onBase) continue;
      const depth = cam.project(pose.x, pose.y).y;
      if (depth > bestDepth) { best = s; bestDepth = depth; }
    }
    return best;
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
    const dh = a.path.length === 2 ? p1.h - p0.h : G.normAngle(p1.h - p0.h);
    return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, h: p0.h + dh * k };
  }

  // ---------- drawing ----------
  draw() {
    const { ctx, canvas, camera: cam } = this;
    const now = performance.now();
    cam.step();
    this.anims = this.anims.filter(a => now < a.start + a.dur);
    this.fx = this.fx.filter(f => now < f.start + f.dur);
    this.ghosts = this.ghosts.filter(g => now < g.start + g.dur);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.35, 10, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8);
    bg.addColorStop(0, '#111a2c'); bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of this.bgStars || []) { ctx.fillStyle = `rgba(200,215,255,${s.a})`; ctx.fillRect(s.x, s.y, s.r, s.r); }
    if (!this.state) return;
    const st = this.state;
    const ground = () => ctx.setTransform(...cam.matrix());

    // ---- table slab & mat ----
    drawSlab(ctx, cam);
    ground();
    drawMat(ctx, st);

    // ---- ground overlays ----
    const hl = this.highlight;
    const arcShips = new Set([this.selected, this.hover, ...(hl.ships || [])].filter(Boolean));
    for (const s of Q.liveShips(st)) if (arcShips.has(s.id)) drawArc(ctx, this._pose(s, now), st.players[s.owner].arcColor, s);
    if (hl.template) { pathPoly(ctx, hl.template); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(); }
    for (const pose of hl.poses || []) drawBaseOutline(ctx, pose, 'rgba(255,255,255,0.8)', true);
    if (hl.line) drawRangeLine(ctx, hl.line.a, hl.line.b);

    drawOrdnance(ctx, st, now);

    // rock shadows
    const rocks = Q.obstaclePolys(st).map((poly, i) => ({ poly, h: rockHeight(st.obstacles[i]) }));
    for (const r of rocks) { pathPoly(ctx, r.poly.map(p => ({ x: p.x + 6, y: p.y + 6 }))); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); }

    // ship bases (ground level)
    const ships = Q.liveShips(st).map(s => ({ s, pose: this._pose(s, now) }));
    for (const { s, pose } of ships) {
      drawBase(ctx, s, pose, { color: st.players[s.owner].color, selected: s.id === this.selected, hot: (hl.ships || []).includes(s.id) || s.id === this.hover });
    }

    // ---- tall things, back to front ----
    // rocks first (ships always fly above the tallest rock), each group back to front
    const items = [
      ...rocks.map(r => ({ kind: 'rock', r, depth: -1e6 + cam.project(centroid(r.poly).x, centroid(r.poly).y).y })),
      ...ships.map(o => ({ kind: 'ship', ...o, depth: cam.project(o.pose.x, o.pose.y).y })),
      ...this.ghosts.map(g => ({ kind: 'ghost', g, depth: cam.project(g.ship.pose.x, g.ship.pose.y).y })),
    ].sort((a, b) => a.depth - b.depth);
    for (const it of items) {
      if (it.kind === 'rock') drawRock(ctx, cam, it.r.poly, it.r.h);
      else if (it.kind === 'ship') {
        if (it.s.cloaked) ctx.globalAlpha = 0.4 + 0.1 * Math.sin(now / 300);
        drawModel(ctx, cam, it.s, it.pose, { color: st.players[it.s.owner].color, selected: it.s.id === this.selected, hot: it.s.id === this.hover || (hl.ships || []).includes(it.s.id) });
        ctx.globalAlpha = 1;
      }
      else {
        const k = Math.max(0, (now - it.g.start) / it.g.dur);
        ctx.globalAlpha = Math.max(0, 1 - k);
        drawModel(ctx, cam, it.g.ship, it.g.ship.pose, { sink: k * FLY, color: st.players[it.g.ship.owner].color });
        ctx.globalAlpha = 1;
        const p = cam.project(it.g.ship.pose.x, it.g.ship.pose.y, FLY * (1 - k));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (k > 0) explosion(ctx, p, k, cam.scale);
      }
    }

    // ---- effects ----
    for (const a of this.anims) {
      if (now < a.start || now > a.start + a.dur || a.path.length < 3) continue;
      const s = st.ships[a.ship]; if (!s) continue;
      const pose = this._pose(s, now);
      this.particles.trail({ x: pose.x, y: pose.y, z: FLY }, pose.h, a.color || '#ffffff');
    }
    this.particles.step(now);
    this.particles.draw(ctx, cam);
    for (const f of this.fx) {
      if (now < f.start) continue;
      const k = (now - f.start) / f.dur;
      if (f.kind === 'blast') {
        ctx.setTransform(...cam.matrix(4));
        const r = (f.big ? CONFIG.rangeBand + 15 : 40) * Math.min(1, k * 1.6);
        const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1, r));
        gr.addColorStop(0, `rgba(255,240,200,${0.9 * (1 - k)})`); gr.addColorStop(0.5, `rgba(255,140,60,${0.6 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
        continue;
      }
    }

    // ---- labels (screen space, always on top) ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const { s, pose } of ships) drawLabels(ctx, cam, st, s, pose, this.dpr, s.id === this.hover || s.id === this.selected);

    // ---- placement ghost ----
    if (this.placement && this.mouse) {
      const pl = this.placement;
      ground();
      if (pl.kind === 'deploy') {
        const z = pl.zone; ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.setLineDash([]);
        const pose = { x: this.mouse.x, y: this.mouse.y, h: this.placeRot };
        ctx.globalAlpha = 0.65;
        drawArc(ctx, pose, st.players[pl.ship.owner].arcColor, pl.ship);
        drawBase(ctx, pl.ship, pose, { color: st.players[pl.ship.owner].color });
        drawModel(ctx, cam, pl.ship, pose, { color: st.players[pl.ship.owner].color });
        ctx.globalAlpha = 1;
      } else if (pl.kind === 'obstacle') {
        ctx.globalAlpha = 0.7;
        drawRock(ctx, cam, G.placeShape(ASTEROIDS[pl.shape], this.mouse.x, this.mouse.y, this.placeRot), 22);
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// ---------- helpers ----------

function makeScreenStars(w, h) {
  let seed = 4242; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: r() * w, y: r() * h, r: r() < 0.92 ? 1 : 2, a: 0.15 + r() * 0.55 }));
}

const matStars = (() => {
  let seed = 1337; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 320 }, () => ({ x: r() * W, y: r() * W, r: r() < 0.9 ? 1.4 : 2.6, a: 0.2 + r() * 0.6 }));
})();

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function pathPoly(ctx, poly) { ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
const centroid = poly => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length });

function rockHeight(o) {
  let h = 0; for (const ch of o.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 16 + ((h + o.shape * 7) % 14);
}

function drawSlab(ctx, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const corners = [[0, 0], [W, 0], [W, W], [0, W]];
  const top = corners.map(([x, y]) => cam.project(x, y, 0));
  const bot = corners.map(([x, y]) => cam.project(x, y, -SLAB));
  // side faces, back ones first (they'll be covered by the mat anyway)
  const faces = [0, 1, 2, 3].map(i => ({ i, d: (top[i].y + top[(i + 1) % 4].y) / 2 })).sort((a, b) => a.d - b.d);
  for (const { i } of faces) {
    const j = (i + 1) % 4;
    ctx.beginPath(); ctx.moveTo(top[i].x, top[i].y); ctx.lineTo(top[j].x, top[j].y); ctx.lineTo(bot[j].x, bot[j].y); ctx.lineTo(bot[i].x, bot[i].y); ctx.closePath();
    ctx.fillStyle = i % 2 ? '#1a2333' : '#141c2a'; ctx.fill();
    ctx.strokeStyle = '#2a3850'; ctx.lineWidth = 1; ctx.stroke();
  }
  // soft drop shadow under the table
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.fillStyle = '#070a12'; ctx.fill(); ctx.restore();
}

function drawMat(ctx, st) {
  const g = ctx.createLinearGradient(0, 0, W, W);
  g.addColorStop(0, '#0a1020'); g.addColorStop(0.55, '#0c1326'); g.addColorStop(1, '#130e1e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
  // faint nebula
  const n = ctx.createRadialGradient(W * 0.68, W * 0.32, 10, W * 0.68, W * 0.32, W * 0.45);
  n.addColorStop(0, 'rgba(90,70,160,0.16)'); n.addColorStop(1, 'rgba(90,70,160,0)');
  ctx.fillStyle = n; ctx.fillRect(0, 0, W, W);
  for (const s of matStars) { ctx.fillStyle = `rgba(220,230,255,${s.a})`; ctx.fillRect(s.x, s.y, s.r, s.r); }
  // range grid every Range band — handy for judging distance
  ctx.strokeStyle = 'rgba(140,170,220,0.07)'; ctx.lineWidth = 1;
  for (let v = CONFIG.rangeBand; v < W; v += CONFIG.rangeBand) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, W); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
  }
  // setup zones
  const early = ['setup', 'obstacles', 'deploy'].includes(st.phase);
  for (const p of st.playerOrder) {
    const z = deployZone(st, p);
    ctx.fillStyle = hexA(st.players[p].color, early ? 0.16 : 0.06);
    ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    ctx.fillStyle = hexA(st.players[p].color, 0.7);
    const edgeY = st.players[p].edge === 'top' ? 0 : W - 4;
    ctx.fillRect(0, edgeY, W, 4);
  }
  if (st.phase === 'obstacles') {
    const m = CONFIG.obstacleEdgeClearance * CONFIG.rangeBand;
    ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(m, m, W - 2 * m, W - 2 * m); ctx.setLineDash([]);
  }
  ctx.strokeStyle = '#33476a'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, W, W);
}

function drawRock(ctx, cam, poly, h) {
  const c = centroid(poly);
  const slices = 9;
  for (let k = 0; k <= slices; k++) {
    ctx.setTransform(...cam.matrix((h * k) / slices));
    const shade = 34 + Math.round((k / slices) * 26);
    pathPoly(ctx, poly);
    ctx.fillStyle = `rgb(${shade + 14},${shade + 6},${shade})`;
    ctx.fill();
  }
  ctx.setTransform(...cam.matrix(h));
  pathPoly(ctx, poly);
  const g = ctx.createRadialGradient(c.x - 12, c.y - 12, 3, c.x, c.y, 52);
  g.addColorStop(0, '#a08c76'); g.addColorStop(1, '#4a3f35');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a231d'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.arc(c.x + 8, c.y + 4, 6, 0, Math.PI * 2); ctx.arc(c.x - 10, c.y + 9, 4, 0, Math.PI * 2); ctx.fill();
}

function drawArc(ctx, pose, color, ship) {
  const arcs = ship ? (Q.chassis(ship).arcs || ['front']) : ['front'];
  const wedge = (h, half) => {
    const a0 = h - half - Math.PI / 2, a1 = h + half - Math.PI / 2;
    for (let band = 3; band >= 1; band--) {
      ctx.beginPath(); ctx.moveTo(pose.x, pose.y);
      ctx.arc(pose.x, pose.y, band * CONFIG.rangeBand + 20, a0, a1); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;
    for (let band = 1; band <= 3; band++) { ctx.beginPath(); ctx.arc(pose.x, pose.y, band * CONFIG.rangeBand + 20, a0, a1); ctx.stroke(); }
  };
  const A = CONFIG.arcHalfAngle * G.DEG;
  if (arcs.includes('turret')) wedge(pose.h, Math.PI);
  else {
    if (arcs.includes('front180')) wedge(pose.h, Math.PI / 2); else wedge(pose.h, A);
    if (arcs.includes('rear')) wedge(pose.h + Math.PI, A);
  }
  if (arcs.includes('bullseye')) {
    const far = G.bullseyePolygon(pose);
    const len = CONFIG.rangeBand * 3 + 20, f = G.fwd(pose.h);
    const strip = [far[0], far[1], G.add(far[1], G.mul(f, len)), G.add(far[0], G.mul(f, len))];
    pathPoly(ctx, strip); ctx.fillStyle = 'rgba(255,240,180,0.10)'; ctx.fill();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,240,180,0.35)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawOrdnance(ctx, st, now) {
  for (const tok of st.ordnance || []) {
    const def = ORDNANCE[tok.type];
    const polys = [ordnancePolys(tok)];
    for (const poly of polys) {
      pathPoly(ctx, poly);
      ctx.fillStyle = hexA(def.color, 0.28); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = hexA(def.color, 0.95); ctx.stroke();
    }
    // pulsing core: bombs tick, mines blink
    const k = 0.5 + 0.5 * Math.sin(now / (def.kind === 'bomb' ? 180 : 420));
    ctx.beginPath(); ctx.arc(tok.x, tok.y, 4 + k * 2, 0, Math.PI * 2); ctx.fillStyle = hexA(def.color, 0.6 + 0.4 * k); ctx.fill();
    if (def.kind === 'bomb') { // blast radius hint (Range 1)
      ctx.setLineDash([4, 8]); ctx.strokeStyle = hexA(def.color, 0.25); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(tok.x, tok.y, CONFIG.rangeBand + (def.shape.r || 15), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

function drawRangeLine(ctx, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.lineWidth = 5;
  for (let band = 0; band < 3; band++) {
    const t0 = (band * CONFIG.rangeBand) / Math.max(d, 1), t1 = Math.min(1, ((band + 1) * CONFIG.rangeBand) / Math.max(d, 1));
    if (t0 >= 1) break;
    ctx.strokeStyle = ['#7cf29a', '#f2d27c', '#f28a7c'][band];
    ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0); ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1); ctx.stroke();
  }
}

function drawBaseOutline(ctx, pose, color, dashed) {
  pathPoly(ctx, G.basePolygon(pose, 'small'));
  if (dashed) ctx.setLineDash([5, 5]);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
}

function drawBase(ctx, s, pose, { selected, hot, color }) {
  const fac = { color: color || '#888888' }, half = CONFIG.baseSize.small / 2;
  ctx.save();
  ctx.translate(pose.x, pose.y); ctx.rotate(pose.h);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-half + 3, -half + 3, half * 2, half * 2);
  ctx.fillStyle = 'rgba(18,24,36,0.92)'; ctx.fillRect(-half, -half, half * 2, half * 2);
  const t = Math.tan(CONFIG.arcHalfAngle * G.DEG) * half;
  ctx.strokeStyle = hexA(fac.color, 0.9); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-t, -half); ctx.moveTo(0, 0); ctx.lineTo(t, -half); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-t, -half); ctx.lineTo(t, -half); ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = selected ? '#ffffff' : hot ? '#ffe27a' : hexA(fac.color, 0.95);
  ctx.lineWidth = selected || hot ? 2.6 : 1.5;
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  // ship shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(4, 4, 13, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawModel(ctx, cam, s, pose, { selected, hot, sink = 0, color } = {}) {
  const lift = FLY - sink;
  const g = cam.project(pose.x, pose.y, 0), t = cam.project(pose.x, pose.y, lift);
  // peg
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = Math.max(1.5, cam.scale * 1.6);
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  // model on a plane parallel to the table, with a little thickness
  const fac = { color: color || '#888888' };
  for (const [dl, alpha] of [[-1.6, 0.55], [0, 1]]) {
    ctx.setTransform(...cam.matrix(lift + dl));
    ctx.translate(pose.x, pose.y); ctx.rotate(pose.h); ctx.scale(1.5, 1.5);
    if (dl < 0) { ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'brightness(0.35)'; }
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * alpha;
    drawShipArt(ctx, Q.chassis(s).art, fac.color);
    ctx.globalAlpha = ga; ctx.filter = 'none';
  }
  if (selected || hot) {
    ctx.setTransform(...cam.matrix(lift));
    ctx.strokeStyle = selected ? 'rgba(255,255,255,0.8)' : 'rgba(255,226,122,0.75)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(pose.x, pose.y, 30, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function explosion(ctx, p, k, scale) {
  const r = (10 + k * 40) * scale;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, `rgba(255,240,200,${1 - k})`); g.addColorStop(0.4, `rgba(255,150,60,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
}

function drawLabels(ctx, cam, st, s, pose, dpr, emphasise) {
  const p = cam.project(pose.x, pose.y, FLY);
  const z = Math.max(0.8, Math.min(1.5, cam.scale / 0.7));
  const u = dpr * z;
  const y0 = p.y - 34 * cam.scale * Math.max(cam.sinT, 0.55) - 6 * u;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // shield / hull pips, flanked by the skill badge (left) and ID tag (right)
  const hullLeft = Q.chassis(s).hull - Q.hullDamage(s);
  const pips = [...Array(s.shields).fill('#5aa8ff'), ...Array(Math.max(0, hullLeft)).fill('#f2d24a')];
  const pw = 5 * u, gap = 2 * u, total = Math.max(0, pips.length * (pw + gap) - gap);
  pips.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(p.x - total / 2 + i * (pw + gap), y0 - 2.5 * u, pw, 5 * u); });
  const bx = p.x - total / 2 - 11 * u;
  ctx.fillStyle = '#f29a3a'; ctx.beginPath(); ctx.arc(bx, y0, 7 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1004'; ctx.font = `700 ${9.5 * u}px "Chakra Petch", system-ui, sans-serif`;
  ctx.fillText(String(Q.effectiveSkill(st, s)), bx, y0 + 0.5 * u);
  if (s.tag) { ctx.fillStyle = '#e8ecf2'; ctx.fillText('#' + s.tag, p.x + total / 2 + 12 * u, y0); }
  // tokens row
  const tokens = [];
  for (let i = 0; i < s.tokens.focus; i++) tokens.push(['F', '#2f9e5a']);
  for (let i = 0; i < s.tokens.evade; i++) tokens.push(['E', '#2f86a8']);
  for (let i = 0; i < s.stress; i++) tokens.push(['!', '#c83434']);
  for (let i = 0; i < (s.ion || 0); i++) tokens.push(['ϟ', '#3d5bd6']);
  if (s.cloaked) tokens.push(['◌', '#7a5cc7']);
  for (let i = 0; i < (s.jam || 0); i++) tokens.push(['J', '#b0802a']);
  for (let i = 0; i < (s.tractor || 0); i++) tokens.push(['T', '#2a8fb0']);
  if (s.disarmed) tokens.push(['⊘', '#7a7f8a']);
  if (s.round?.reinforce) tokens.push(['R', '#4a9a6a']);
  if (Q.liveShips(st).some(o => o.lockOn === s.id)) tokens.push(['⌖', '#b03030']);
  if (s.damage.some(c => c.faceup)) tokens.push(['✸', '#c88a20']);
  const tw = 13 * u, tt = tokens.length * tw;
  tokens.forEach(([txt, col], i) => {
    const x = p.x - tt / 2 + i * tw + tw / 2, y = y0 - 13 * u;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5.6 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${8 * u}px system-ui, sans-serif`; ctx.fillText(txt, x, y + 0.5 * u);
  });
  if (emphasise) {
    ctx.font = `600 ${10 * u}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(232,236,242,0.95)';
    ctx.fillText(label(Q.shipName(s)), p.x, y0 - (tokens.length ? 25 : 13) * u);
  }
}
