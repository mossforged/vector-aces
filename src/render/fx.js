// Visual effects layer for the table: weapon fire, impacts, shields, explosions, engine trails.
// Render-only (free to use Math.random). Everything lives in table coordinates (mm, z = height)
// and is projected through the camera each frame, so effects stay put when the view rotates.
//
//   fx.at(t, () => fx.fire({...}))   schedule a spawn at performance.now()-time t
//   fx.fire({ kind, from, to, color, hits, n, rate })   a volley; kinds: laser ion cannon missile torpedo
//   fx.impact(p, kind)               'hit' | 'crit' | 'shield' | 'ion'
//   fx.explode(p)  fx.blast(p, big)  fx.trail(p, h, color)  fx.drop(p)  fx.shimmer(p)
//   fx.step(now); fx.draw(ctx, cam)  called by BoardView every frame
//
// Adding a new look: add a case to fire() (projectile) or impact(), nothing else needs to know.

const MAX_PARTS = 2200;
const rnd = (a, b) => a + Math.random() * (b - a);
const hexRgb = hex => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const WHITE = [255, 255, 255], FIRE = [255, 150, 50], SPARK = [255, 214, 120], SMOKE = [90, 94, 104], ION = [110, 200, 255], SHIELD = [90, 170, 255];

export class FX {
  constructor() { this.pending = []; this.shots = []; this.parts = []; this.flashes = []; this.last = performance.now(); }

  at(t, fn) { if (t <= performance.now()) fn(); else this.pending.push({ t, fn }); }
  clear() { this.pending = []; this.shots = []; this.parts = []; this.flashes = []; }

  // ---------------- spawners ----------------
  /** One particle. v in mm/ms. */
  part(p, o) {
    if (this.parts.length > MAX_PARTS) this.parts.shift();
    this.parts.push({ x: p.x, y: p.y, z: p.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 500,
      size: o.size || 1.5, grow: o.grow || 0, color: o.color || WHITE, add: o.add !== false, drag: o.drag ?? 0.997, grav: o.grav || 0, alpha: o.alpha ?? 1 });
  }
  burst(p, { n = 12, speed = 0.15, life = 450, size = 1.4, color = SPARK, add = true, grav = 0, up = 0, grow = 0, drag = 0.994, jitter = 0.4, alpha = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = rnd(-0.6, 0.9), s = speed * rnd(1 - jitter, 1 + jitter);
      this.part(p, { vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(a) * Math.cos(e) * s, vz: Math.sin(e) * s + up,
        life: life * rnd(0.6, 1.2), size: size * rnd(0.6, 1.3), color, add, grav, grow, drag, alpha });
    }
  }
  flash(p, { r = 14, life = 260, color = WHITE, ring = false, ground = false } = {}) {
    this.flashes.push({ x: p.x, y: p.y, z: p.z || 0, r, life, age: 0, color, ring, ground });
  }

  /**
   * A volley from `from` to `to` (each {x, y, z}). `hits` of the `n` projectiles strike the
   * target, the rest streak past. `rate` = playback speed. Returns ms until the first arrival.
   */
  fire({ kind = 'laser', from, to, color = '#ff6040', hits = 0, n = 2, rate = 1 }) {
    const col = kind === 'ion' ? ION : hexRgb(color);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const spec = {
      laser: { speed: 1.1, stagger: 90, len: 58, width: 2.6 },
      ion: { speed: 0.9, stagger: 120, len: 60, width: 3.2 },
      cannon: { speed: 0.8, stagger: 150, len: 75, width: 4.6 },
      missile: { speed: 0.45, stagger: 120, len: 0, width: 3.4 },
      torpedo: { speed: 0.38, stagger: 160, len: 0, width: 4.8 },
    }[kind] || { speed: 1.1, stagger: 90, len: 58, width: 2.6 };
    const travel = Math.max(180, dist / spec.speed);
    const h = Math.atan2(to.y - from.y, to.x - from.x);
    const side = { x: -Math.sin(h), y: Math.cos(h) };
    for (let i = 0; i < n; i++) {
      const hit = i < hits;
      const spread = (i - (n - 1) / 2) * 6;
      const a = { x: from.x + side.x * spread, y: from.y + side.y * spread, z: from.z };
      let b = { x: to.x + rnd(-5, 5), y: to.y + rnd(-5, 5), z: to.z + rnd(-3, 3) };
      if (!hit) { // veer off and keep going past the target
        const off = (Math.random() < 0.5 ? -1 : 1) * rnd(26, 40);
        b = { x: to.x + side.x * off + Math.cos(h) * 70, y: to.y + side.y * off + Math.sin(h) * 70, z: to.z + rnd(-6, 10) };
      }
      const guided = kind === 'missile' || kind === 'torpedo';
      const bend = guided ? (Math.random() < 0.5 ? -1 : 1) * rnd(25, 60) : 0;
      const ctrl = { x: (a.x + b.x) / 2 + side.x * bend, y: (a.y + b.y) / 2 + side.y * bend, z: Math.max(a.z, b.z) + (guided ? rnd(10, 30) : 0) };
      const dur = (hit ? travel : travel * 1.3) / rate;
      const start = performance.now() + (i * spec.stagger) / rate;
      this.shots.push({ kind, a, b, ctrl, start, dur, col, spec, hit, last: null, guided });
    }
    if (!guided(kind)) this.flash(from, { r: 8, life: 140, color: mix(col, WHITE, 0.5) }); // muzzle flash
    return travel / rate;
  }

  impact(p, kind = 'hit') {
    if (kind === 'shield') {
      this.flash(p, { r: 30, life: 480, color: SHIELD, ring: true });
      this.burst(p, { n: 10, speed: 0.08, life: 380, size: 1.2, color: [150, 210, 255] });
    } else if (kind === 'ion') {
      this.flash(p, { r: 22, life: 420, color: ION, ring: true });
      this.burst(p, { n: 22, speed: 0.12, life: 520, size: 1.1, color: ION, jitter: 0.8 });
    } else if (kind === 'crit') {
      this.flash(p, { r: 26, life: 360, color: [255, 240, 200] });
      this.burst(p, { n: 34, speed: 0.2, life: 600, size: 1.5, color: SPARK });
      this.burst(p, { n: 14, speed: 0.04, life: 900, size: 2.8, color: FIRE, up: 0.02, grow: 0.004 });
      this.burst(p, { n: 10, speed: 0.025, life: 1600, size: 3.5, color: SMOKE, add: false, up: 0.012, grow: 0.01, alpha: 0.55 });
    } else {
      this.flash(p, { r: 16, life: 240, color: [255, 210, 150] });
      this.burst(p, { n: 20, speed: 0.16, life: 420, size: 1.3, color: SPARK });
      this.burst(p, { n: 6, speed: 0.06, life: 900, size: 1.4, color: [70, 72, 80], add: false, grav: 0.0002 });
      this.burst(p, { n: 5, speed: 0.02, life: 1100, size: 3, color: SMOKE, add: false, up: 0.01, grow: 0.008, alpha: 0.45 });
    }
  }

  explode(p) {
    this.flash(p, { r: 60, life: 520, color: [255, 235, 190] });
    this.flash({ ...p, z: 0 }, { r: 90, life: 900, color: [255, 150, 70], ring: true, ground: true });
    this.burst(p, { n: 70, speed: 0.22, life: 700, size: 1.6, color: SPARK });
    this.burst(p, { n: 34, speed: 0.07, life: 1100, size: 4.5, color: FIRE, grow: 0.006 });
    this.burst(p, { n: 26, speed: 0.12, life: 1500, size: 1.8, color: [80, 82, 92], add: false, grav: 0.00015, drag: 0.998 });
    this.burst(p, { n: 18, speed: 0.03, life: 2400, size: 5, color: SMOKE, add: false, up: 0.008, grow: 0.012, alpha: 0.5 });
  }

  blast(p, big) {
    this.flash({ ...p, z: 2 }, { r: big ? 115 : 45, life: 800, color: [255, 170, 80], ring: true, ground: true });
    this.flash({ ...p, z: 8 }, { r: big ? 40 : 22, life: 420, color: [255, 240, 200] });
    this.burst({ ...p, z: 6 }, { n: big ? 60 : 30, speed: big ? 0.2 : 0.12, life: 650, size: 1.6, color: SPARK });
    this.burst({ ...p, z: 4 }, { n: big ? 22 : 10, speed: 0.03, life: 1800, size: 5, color: SMOKE, add: false, up: 0.01, grow: 0.01, alpha: 0.5 });
  }

  /** Engine exhaust behind a ship at pose p (heading h, table convention: forward = (sin h, −cos h)). */
  trail(p, h, color) {
    const col = mix(hexRgb(color), WHITE, 0.45);
    const bx = -Math.sin(h), by = Math.cos(h);
    for (const s of [-6, 6]) {
      const x = p.x + bx * 17 + Math.cos(h) * s, y = p.y + by * 17 + Math.sin(h) * s;
      this.part({ x, y, z: p.z }, { vx: bx * 0.03 + rnd(-0.01, 0.01), vy: by * 0.03 + rnd(-0.01, 0.01), life: rnd(380, 560), size: 2.8, grow: -0.004, color: col });
      this.part({ x: x + bx * 4, y: y + by * 4, z: p.z }, { vx: bx * 0.02, vy: by * 0.02, life: rnd(700, 1000), size: 1.6, grow: 0.002, color: col, alpha: 0.35 });
    }
  }

  drop(p) {
    this.shots.push({ kind: 'fall', a: p, b: { ...p, z: 1 }, start: performance.now(), dur: 380, col: [255, 120, 80], spec: {}, hit: true, last: null });
  }

  shimmer(p) {
    this.flash(p, { r: 28, life: 600, color: [170, 130, 255], ring: true });
    this.burst(p, { n: 26, speed: 0.06, life: 700, size: 1.4, color: [170, 140, 255], jitter: 0.8 });
  }

  // ---------------- per-frame ----------------
  step(now) {
    const dt = Math.min(50, Math.max(0, now - this.last)); this.last = now;
    if (this.pending.length) {
      const due = this.pending.filter(p => p.t <= now);
      this.pending = this.pending.filter(p => p.t > now);
      due.forEach(p => p.fn());
    }
    for (const s of this.shots) {
      if (now < s.start) continue;
      const k = Math.min(1, (now - s.start) / s.dur);
      const pos = bez(s, k);
      if (s.guided) { // exhaust + smoke along the flight
        this.part(pos, { life: 220, size: 2.2, color: FIRE, grow: -0.004 });
        if (Math.random() < 0.8) this.part(pos, { vz: 0.004, life: rnd(700, 1100), size: 1.8, grow: 0.007, color: [150, 152, 160], add: false, alpha: 0.5 });
      } else if (s.kind === 'ion' && Math.random() < 0.5) {
        this.part(pos, { vx: rnd(-0.05, 0.05), vy: rnd(-0.05, 0.05), vz: rnd(-0.03, 0.03), life: 160, size: 0.9, color: ION });
      }
      s.pos = pos; s.k = k;
      if (k >= 1 && !s.done) {
        s.done = true;
        if (s.kind === 'fall') { this.flash(s.b, { r: 12, life: 300, color: [255, 160, 90], ring: true, ground: true }); }
        else if (s.hit) this.flash(s.b, { r: s.guided ? 20 : 10, life: 200, color: mix(s.col, WHITE, 0.6) });
      }
    }
    this.shots = this.shots.filter(s => !s.done || now - s.start < s.dur + 60);
    for (const p of this.parts) {
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const d = Math.pow(p.drag, dt); p.vx *= d; p.vy *= d; p.vz = p.vz * d - p.grav * dt;
      if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; }
      p.size = Math.max(0.2, p.size + p.grow * dt);
    }
    this.parts = this.parts.filter(p => p.age < p.life);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter(f => f.age < f.life);
  }

  get idle() { return !this.pending.length && !this.shots.length; }

  draw(ctx, cam) {
    const sc = cam.scale;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // smoke & debris (normal blending)
    for (const p of this.parts) {
      if (p.add) continue;
      const q = cam.project(p.x, p.y, p.z), a = p.alpha * (1 - p.age / p.life);
      ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, p.size * sc), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    // ground rings / shockwaves
    for (const f of this.flashes) {
      const k = f.age / f.life, a = 1 - k;
      if (f.ground) {
        ctx.setTransform(...cam.matrix(f.z));
        ctx.strokeStyle = `rgba(${f.color[0]},${f.color[1]},${f.color[2]},${(0.8 * a).toFixed(3)})`;
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, f.r * (0.2 + 0.8 * Math.sqrt(k))), 0, Math.PI * 2); ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        continue;
      }
      const q = cam.project(f.x, f.y, f.z), r = Math.max(1, f.r * sc * (f.ring ? 0.85 + 0.25 * k : 0.6 + 0.6 * k));
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      const c = f.color.join(',');
      if (f.ring) { g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.7, `rgba(${c},${(0.18 * a).toFixed(3)})`); g.addColorStop(0.92, `rgba(${c},${(0.75 * a).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`); }
      else { g.addColorStop(0, `rgba(255,255,255,${(0.95 * a).toFixed(3)})`); g.addColorStop(0.35, `rgba(${c},${(0.7 * a).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // glowing particles
    for (const p of this.parts) {
      if (!p.add) continue;
      const q = cam.project(p.x, p.y, p.z), a = p.alpha * (1 - p.age / p.life), r = Math.max(0.6, p.size * sc);
      const c = p.color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.25 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${mix(c, WHITE, 0.5).join(',')},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    // projectiles
    ctx.lineCap = 'round';
    for (const s of this.shots) {
      if (s.k === undefined || s.done && s.hit) continue;
      const head = cam.project(s.pos.x, s.pos.y, s.pos.z);
      const fade = s.done ? 0 : s.hit ? 1 : Math.min(1, (1 - s.k) * 3);
      const c = s.col.join(',');
      if (s.kind === 'fall') {
        ctx.fillStyle = 'rgba(255,140,90,0.9)'; ctx.beginPath(); ctx.arc(head.x, head.y, 3 * sc, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (s.guided) {
        const r = s.spec.width * sc;
        const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 4);
        g.addColorStop(0, `rgba(255,255,255,${fade})`); g.addColorStop(0.3, `rgba(${c},${(0.8 * fade).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head.x, head.y, r * 4, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const dist = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) || 1;
      const tailP = bez(s, Math.max(0, s.k - s.spec.len / dist));
      const tail = cam.project(tailP.x, tailP.y, tailP.z);
      const w = s.spec.width * sc;
      ctx.strokeStyle = `rgba(${c},${(0.35 * fade).toFixed(3)})`; ctx.lineWidth = w * 3.2;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.strokeStyle = `rgba(${c},${(0.9 * fade).toFixed(3)})`; ctx.lineWidth = w * 1.3;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${fade.toFixed(3)})`; ctx.lineWidth = Math.max(1, w * 0.45);
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      if (s.kind === 'ion') { // crackle around the bolt
        ctx.strokeStyle = `rgba(170,230,255,${(0.8 * fade).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y);
        for (let i = 1; i <= 5; i++) {
          const t = i / 5;
          ctx.lineTo(tail.x + (head.x - tail.x) * t + rnd(-1, 1) * w * 2.5, tail.y + (head.y - tail.y) * t + rnd(-1, 1) * w * 2.5);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

const guided = kind => kind === 'missile' || kind === 'torpedo';

function bez(s, k) {
  if (!s.ctrl) return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, z: s.a.z + (s.b.z - s.a.z) * k };
  const u = 1 - k;
  return {
    x: u * u * s.a.x + 2 * u * k * s.ctrl.x + k * k * s.b.x,
    y: u * u * s.a.y + 2 * u * k * s.ctrl.y + k * k * s.b.y,
    z: u * u * s.a.z + 2 * u * k * s.ctrl.z + k * k * s.b.z,
  };
}

/** Which projectile look a weapon gets: from its upgrade slot, ion weapons by id. */
export function shotKind(weaponId, upgrade) {
  if (!weaponId || weaponId === 'primary') return 'laser';
  if (/^ion_/.test(weaponId)) return 'ion';
  if (upgrade?.slot === 'torpedo') return 'torpedo';
  if (upgrade?.slot === 'missile') return 'missile';
  if (upgrade?.slot === 'cannon') return 'cannon';
  return 'laser';
}
