// Transports deliver one ordered, append-only log to every client.
// Interface:  id, append(msg) -> Promise,  subscribe(cb(msg, index)) -> unsubscribe,  close()
//
// LocalTransport    – same browser (hotseat). Optional localStorage persistence so a refresh resumes.
// FirebaseTransport – Firebase Realtime Database; entries stored under numbered keys, each
//                     claimed with a transaction so both players always agree on the order.

export class LocalTransport {
  constructor(id = 'hotseat', { persist = true } = {}) {
    this.id = id; this.persist = persist; this.subs = new Set();
    this.log = [];
    if (persist) { try { this.log = JSON.parse(localStorage.getItem(`va-log-${id}`) || '[]'); } catch { this.log = []; } }
  }
  subscribe(cb) {
    this.subs.add(cb);
    this.log.forEach((m, i) => cb(m, i));
    return () => this.subs.delete(cb);
  }
  async append(msg) {
    const clean = JSON.parse(JSON.stringify(msg));
    this.log.push(clean);
    if (this.persist) { try { localStorage.setItem(`va-log-${this.id}`, JSON.stringify(this.log)); } catch {} }
    const i = this.log.length - 1;
    await Promise.resolve();
    for (const cb of this.subs) cb(clean, i);
  }
  clear() { this.log = []; try { localStorage.removeItem(`va-log-${this.id}`); } catch {} }
  close() { this.subs.clear(); }
}

const pad = n => String(n).padStart(6, '0');

export class FirebaseTransport {
  /** @param db firebase.database() instance (compat SDK) */
  constructor(db, gameId) {
    this.id = gameId;
    this.ref = db.ref(`vectoraces/games/${gameId}/log`);
    this.buffer = new Map(); this.delivered = 0; this.subs = new Set(); this.history = [];
    this.handler = this.ref.orderByKey().on('child_added', snap => {
      this.buffer.set(Number(snap.key), snap.val());
      while (this.buffer.has(this.delivered)) {
        const m = this.buffer.get(this.delivered); this.buffer.delete(this.delivered);
        const i = this.delivered++;
        this.history.push(m);
        for (const cb of this.subs) cb(m, i);
      }
    });
  }
  subscribe(cb) { this.subs.add(cb); this.history.forEach((m, i) => cb(m, i)); return () => this.subs.delete(cb); }

  async append(msg) {
    const clean = JSON.parse(JSON.stringify(msg));
    for (let tries = 0; tries < 50; tries++) {
      const n = this.delivered + this.buffer.size;
      const res = await this.ref.child(pad(n)).transaction(cur => (cur === null ? clean : undefined));
      if (res.committed) return n;
      await new Promise(r => setTimeout(r, 60 + Math.random() * 120)); // someone else took slot n
    }
    throw new Error('Could not append to the game log (network?)');
  }

  /** Read-only peek at the first entries (used by the lobby to see if a game exists / is full). */
  static async peek(db, gameId) {
    const snap = await db.ref(`vectoraces/games/${gameId}/log`).orderByKey().limitToFirst(2).once('value');
    return Object.values(snap.val() || {});
  }
  close() { this.ref.off('child_added', this.handler); this.subs.clear(); }
}

/** Lazily load the Firebase compat SDK from Google's CDN and return a database handle. */
export async function connectFirebase(config) {
  const v = '10.12.2';
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  if (!window.firebase) {
    await load(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
    await load(`https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`);
  }
  const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
  return app.database();
}
