// One shared playback clock for everything the table animates (ship moves, shots, impacts,
// explosions) and the dice mat. Each visual effect reserves a slot after whatever is already
// queued, so a burst of engine events plays back in order instead of all at once.
//
//   const tl = new Timeline();
//   const t = tl.reserve(650);   // start time (performance.now() ms) of a 650 ms slot
//   tl.scale(650)                // the same duration adjusted for playback speed
//   tl.busy()                    // ms until everything queued has finished
//
// `speed` is the user's playback speed (AI games: 1×/2×/4×). When the backlog gets long (e.g.
// a reconnect replays many moves) playback speeds up automatically rather than skipping.
export class Timeline {
  constructor() { this.cursor = 0; this.speed = 1; }
  get rate() {
    const backlog = this.cursor - performance.now();
    return this.speed * (backlog > 8000 ? 4 : backlog > 4000 ? 2 : 1);
  }
  scale(ms) { return ms / this.rate; }
  /** Reserve `ms` (unscaled) after everything queued; returns the slot's start time. */
  reserve(ms) {
    const r = this.rate;
    const start = Math.max(performance.now(), this.cursor);
    this.cursor = start + ms / r;
    return start;
  }
  /** Make sure nothing new starts before time `t`. */
  holdUntil(t) { this.cursor = Math.max(this.cursor, t); }
  busy() { return Math.max(0, this.cursor - performance.now()); }
}
