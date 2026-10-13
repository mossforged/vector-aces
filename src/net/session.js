// Session = an ordered, append-only message log + the engine.
//
// Every client (host, guest, or a hotseat screen) rebuilds the game by replaying
// the same log through the same deterministic engine, so no game state is ever sent.
//
// Log message kinds:
//   { kind: 'host',   faction, name, squad, obstacles, seed }    (entry 0)
//   { kind: 'join',   name, squad }                              (entry 1)
//   { kind: 'action', action }                                   engine action
//   { kind: 'commit', player, round, hash }                      secret dials committed
//   { kind: 'chat',   player, text }
//
// Secret dials: in online play a player first appends a `commit` (hash of dials+salt).
// Only once BOTH players have committed for the round does each client append its
// SUBMIT_DIALS (with the salt) — so the opponent never sees your dials early, and you
// can't change yours after seeing theirs.
import { newGame, applyAction } from '../engine/index.js';

// Synchronous 106-bit hash (two cyrb53 lanes). Plenty to stop a friend peeking/changing dials.
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function hashDials(dials, salt) {
  const text = JSON.stringify(Object.keys(dials).sort().map(k => [k, dials[k]])) + '|' + salt;
  return cyrb53(text, 1) + cyrb53(text, 2);
}

export class Session {
  /**
   * @param transport  { append(msg): Promise, subscribe(cb(msg, index)): unsubscribe }
   * @param me         seat this client controls ('p1' host | 'p2' guest), 'both' for hotseat, or 'spectator'
   * @param opts.local  true when every seat is on this device (hotseat, vs-computer, watch-AI):
   *                    dials are submitted directly instead of commit/reveal. Default: me === 'both'.
   */
  constructor(transport, me, opts = {}) {
    this.transport = transport; this.me = me;
    this.local = opts.local ?? me === 'both';
    this.log = []; this.state = null; this.meta = null;
    this.commits = {};            // round -> { player: hash }
    this.pending = {};            // my own uncommitted-reveal: player -> { dials, salt, round }
    this.listeners = new Set();
    this.lastEvents = [];
    this.chat = [];
    this.error = null;
    this._loadPending();
    this.unsub = transport.subscribe((msg, i) => this._receive(msg, i));
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this); }
  controls(player) { return this.me === 'both' || this.me === player; }
  get online() { return !this.local; }

  _receive(msg, index) {
    if (index !== this.log.length) return; // transports guarantee order; ignore dupes
    this.log.push(msg);
    this.lastEvents = [];
    switch (msg.kind) {
      case 'host': this.meta = { ...msg }; break;
      case 'join': {
        if (this.state || !this.meta) break; // a second guest lost the race
        this.meta.guest = msg;
        const host = this.meta;
        const guestFaction = msg.faction || (host.faction === 'league' ? 'dominion' : 'league'); // old logs lack it
        this.state = newGame({
          seed: host.seed, obstacles: host.obstacles,
          seats: [
            { faction: host.faction, name: host.name, squad: host.squad },
            { faction: guestFaction, name: msg.name, squad: msg.squad },
          ],
        });
        break;
      }
      case 'commit': {
        (this.commits[msg.round] ||= {})[msg.player] = msg.hash;
        this._maybeReveal();
        break;
      }
      case 'action': {
        if (!this.state) break;
        if (this.online && msg.action.type === 'SUBMIT_DIALS' && !revealMatches(this, msg.action)) {
          console.warn('dial reveal does not match commit — ignored', msg.action.player); break;
        }
        const r = applyAction(this.state, msg.action);
        if (r.error) { console.warn('rejected action', msg.action, r.error); if (this.controls(msg.action.player)) this.error = r.error; }
        else { this.state = r.state; this.lastEvents = r.state.events; this.error = null; }
        break;
      }
      case 'chat': this.chat.push(msg); break;
      default: break;
    }
    this._emit();
  }

  /** Send an engine action. Planning dials go through commit/reveal when online. */
  async act(action) {
    if (action.type === 'SUBMIT_DIALS' && this.online) {
      const salt = crypto.getRandomValues(new Uint32Array(2)).join('-');
      const round = this.state.round;
      this.pending[action.player] = { dials: action.dials, salt, round };
      this._savePending();
      const hash = hashDials(action.dials, salt);
      await this.transport.append({ kind: 'commit', player: action.player, round, hash });
      return;
    }
    // validate locally first so obvious mistakes never hit the shared log
    const r = applyAction(this.state, action);
    if (r.error) { this.error = r.error; this._emit(); return; }
    await this.transport.append({ kind: 'action', action });
  }

  // Committed-but-unrevealed dials survive a page reload (localStorage, best effort).
  get _key() { return `va-pending-${this.transport.id || 'local'}-${this.me}`; }
  _savePending() { try { localStorage.setItem(this._key, JSON.stringify(this.pending)); } catch {} }
  _loadPending() { try { this.pending = JSON.parse(localStorage.getItem(this._key) || '{}'); } catch { this.pending = {}; } }

  hasCommitted(player) {
    return !!this.commits[this.state?.round]?.[player];
  }

  async _maybeReveal() {
    const st = this.state; if (!st || st.phase !== 'planning') return;
    const c = this.commits[st.round] || {};
    const needed = st.prompt?.players?.filter(p => st.ships && Object.values(st.ships).some(s => s.owner === p && !s.destroyed)) || [];
    if (!needed.every(p => c[p])) return;
    for (const [player, mine] of Object.entries(this.pending)) {
      if (mine.round !== st.round || st.planning.submitted[player]) continue; // engine also drops duplicates
      await this.transport.append({ kind: 'action', action: { type: 'SUBMIT_DIALS', player, dials: mine.dials, salt: mine.salt } });
    }
  }

  say(text) { return this.transport.append({ kind: 'chat', player: this.me, text }); }
  close() { this.unsub?.(); this.transport.close?.(); }
}

/** A revealed SUBMIT_DIALS must match the hash its player committed this round. */
function revealMatches(session, action) {
  const h = session.commits[session.state.round]?.[action.player];
  return !!h && h === hashDials(action.dials, action.salt);
}
