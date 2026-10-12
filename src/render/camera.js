// Orthographic "isometric" camera for the table.
//
// The table is a flat plane, so an orthographic tilt+rotate maps it with a single 2D affine
// matrix — everything on the ground (zones, arcs, templates, bases) can be drawn in table mm
// with ctx.setTransform(camera.matrix()). Things above the table (ships on their pegs, rock
// tops, labels) are placed with project(x, y, height).
//
//   yaw   : rotation around the table centre (radians), added to `baseYaw` (viewer's side)
//   tilt  : elevation of the eye above the table: 90° = straight down, ~35–55° = isometric
//   zoom  : 1 = whole table fits at any rotation; pan in canvas px
import { CONFIG } from '../data/config.js';

const W = CONFIG.playArea, C = W / 2;
const DEG = Math.PI / 180;

export const TILT_MIN = 28 * DEG, TILT_MAX = 90 * DEG;

export class Camera {
  constructor() {
    this.baseYaw = 0; this.yaw = 0;
    this.tilt = 40 * DEG;
    this.zoom = 1.25; this.panX = 0; this.panY = 0;
    this.w = 1; this.h = 1;
  }

  setViewport(w, h) { this.w = w; this.h = h; }
  /** Default views: a three-quarter isometric angle from your own edge, or straight down. */
  reset(top = false) {
    this.yawTarget = null; this.panX = 0;
    if (top) { this.yaw = 0; this.tilt = TILT_MAX; this.zoom = 1.38; this.panY = 0; }
    else { this.yaw = -24 * DEG; this.tilt = 40 * DEG; this.zoom = 1.0; this.panY = this.h * 0.04; }
  }

  get sinT() { return Math.sin(this.tilt); }
  get cosT() { return Math.cos(this.tilt); }
  get angle() { return this.baseYaw + this.yaw; }

  /** px per mm on the ground plane */
  get scale() {
    const diag = W * Math.SQRT2;
    const fit = Math.min(this.w / diag, this.h / (diag * this.sinT + 120 * this.cosT + 40));
    return fit * this.zoom;
  }

  /** Affine ground-plane matrix [a, b, c, d, e, f] for ctx.setTransform. */
  matrix(lift = 0) {
    const s = this.scale, cs = Math.cos(this.angle), sn = Math.sin(this.angle), st = this.sinT;
    const a = s * cs, c = -s * sn, b = s * sn * st, d = s * cs * st;
    const X0 = this.w / 2 + this.panX, Y0 = this.h / 2 + this.panY - lift * s * this.cosT;
    return [a, b, c, d, X0 - (a * C + c * C), Y0 - (b * C + d * C)];
  }

  project(x, y, height = 0) {
    const [a, b, c, d, e, f] = this.matrix(height);
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }

  /** Canvas px → table point on the ground. */
  unproject(sx, sy) {
    const [a, b, c, d, e, f] = this.matrix();
    const det = a * d - b * c;
    const x = sx - e, y = sy - f;
    return { x: (d * x - c * y) / det, y: (-b * x + a * y) / det };
  }

  /** Height in mm → vertical canvas px. */
  lift(mm) { return mm * this.scale * this.cosT; }

  /** Screen heading of a table heading h (for drawing upright things that should "point"). */
  screenAngle(h) {
    const p0 = this.project(C, C), p1 = this.project(C + Math.sin(h) * 100, C - Math.cos(h) * 100);
    return Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }

  rotateBy(d) { this.yaw += d; this.yawTarget = null; }
  /** Smoothly rotate by d (buttons). Call step() once per frame. */
  spin(d) { this.yawTarget = (this.yawTarget ?? this.yaw) + d; }
  step() {
    if (this.yawTarget == null) return;
    const diff = this.yawTarget - this.yaw;
    if (Math.abs(diff) < 0.002) { this.yaw = this.yawTarget; this.yawTarget = null; } else this.yaw += diff * 0.18;
  }
  tiltBy(d) { this.tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, this.tilt + d)); }
  zoomAt(factor, sx, sy) {
    const before = this.unproject(sx, sy);
    this.zoom = Math.max(0.6, Math.min(5, this.zoom * factor));
    const after = this.project(before.x, before.y);
    this.panX += sx - after.x; this.panY += sy - after.y;
  }
  panBy(dx, dy) { this.panX += dx; this.panY += dy; }
}
