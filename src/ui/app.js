// App shell: wires Session (net) → engine state → BoardView (render) + panels (ui).
import { FACTIONS } from '../data/factions.js';
import { Session } from '../net/session.js';
import { BoardView } from '../render/board.js';
import { waitingOn } from '../engine/index.js';
import { showLobby } from './lobby.js';
import { renderPrompt, phaseName } from './promptPanel.js';
import { renderShipCards } from './shipCards.js';
import { renderDiceTray } from './diceTray.js';
import { renderLog } from './logPanel.js';
import { esc } from './glyphs.js';
import { DiceRoller } from './diceRoller.js';
import { renderShipTooltip, placeTooltip } from './shipTooltip.js';
import { namesToggleButton, onNamesChange } from './names.js';
import { botAction } from '../ai/simpleBot.js';

const $ = sel => document.querySelector(sel);

class App {
  constructor() {
    this.session = null; this.state = null;
    this.ui = { selected: null, drafts: {}, handoffFor: null };
    this.board = new BoardView($('#board'), {
      onShipClick: id => this.select(id),
      onHover: (id, x, y) => this._hover(id, x, y),
      onPlace: pos => this._place(pos),
    });
    this.roller = new DiceRoller($('#dicemat'), this.board.timeline);
    this.bots = new Set(); this.auto = { paused: false, fails: 0 };
    $('#names-toggle-game').append(namesToggleButton());
    $('#names-toggle-lobby').append(namesToggleButton());
    document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => {
      const c = this.board.camera, k = b.dataset.cam;
      if (k === 'left') c.spin(Math.PI / 4); else if (k === 'right') c.spin(-Math.PI / 4); else this.board.setView(k);
    });
    $('#btn-lobby').onclick = () => this.confirm('Leave this battle? Same-screen games can be resumed from the lobby.', 'Leave', () => this.backToLobby());
    $('#btn-concede').onclick = () => this._concede();
    $('#btn-help').onclick = () => { $('#help').hidden = !$('#help').hidden; };
    $('#help').onclick = e => { if (e.target.id === 'help') $('#help').hidden = true; };
    showLobby($('#lobby'), this);
  }

  /**
   * @param me          'p1' | 'p2' | 'both' (hotseat) | 'spectator'
   * @param opts.bots   seats the computer flies on this device, e.g. ['p2'] (vs computer) or ['p1','p2'] (watch)
   * @param opts.local  every seat is on this device (no commit/reveal); implied by bots
   */
  start(transport, me, opts = {}) {
    this.session?.close();
    clearTimeout(this._autoTimer);
    this.ui = { selected: null, drafts: {}, handoffFor: null };
    this.bots = new Set(opts.bots || []);
    this.auto = { paused: false, fails: 0 };
    this.board.timeline.speed = 1;
    this.session = new Session(transport, me, { local: opts.local ?? (me === 'both' || this.bots.size > 0) });
    this.session.onChange(s => {
      const fresh = s.state !== this.state;
      this.state = s.state;
      if (this.state && fresh) this._play(s.lastEvents);
      this.render();
      this._autoplay();
    });
    this._renderAutoBar();
    $('#btn-concede').hidden = me === 'spectator';
    this.board.setViewer(me === 'both' || me === 'spectator' ? null : me);
    this.board.setView('iso');
    this.state = this.session.state;
    if (this.state) this.board.setState(this.state, []);
    this.render();
    this._autoplay();
  }

  /** Feed events to the board and the dice mat one at a time so they share one timeline. */
  _play(events) {
    if (!events?.length) { this.board.setState(this.state, []); return; }
    for (const ev of events) { this.board.setState(this.state, [ev]); this.roller.update(this.state, [ev]); }
  }

  // ---------- computer-controlled seats ----------
  _autoplay() {
    clearTimeout(this._autoTimer);
    const st = this.state;
    if (!this.bots.size || !st || st.winner || this.auto.paused) return;
    const tl = this.board.timeline;
    const think = st.prompt?.kind === 'planning' ? 600 : st.phase === 'setup' ? 250 : 450;
    this._autoTimer = setTimeout(() => this._autoStep(), tl.busy() + tl.scale(think));
  }

  _autoStep() {
    const st = this.state;
    if (!st || st.winner || this.auto.paused || !this.session) return;
    if (this.board.timeline.busy() > 30) return this._autoplay();
    for (const seat of this.bots) {
      const a = botAction(st, seat);
      if (!a) continue;
      const before = this.session.log.length;
      this.session.act(a).then(() => {
        // a rejected choice changes nothing; try again (botAction is random) a few times
        if (this.session && this.session.log.length === before && ++this.auto.fails < 20) this._autoplay();
        else this.auto.fails = 0;
      });
      return;
    }
  }

  _renderAutoBar() {
    const bar = $('#autobar');
    if (!this.bots.size) { bar.innerHTML = ''; return; }
    const tl = this.board.timeline;
    bar.innerHTML = `<span class="auto-lbl">${this.bots.size > 1 ? 'AI battle' : 'vs AI'}</span>
      ${this.bots.size > 1 ? `<button class="btn ghost small" data-pause title="Pause / resume the computer">${this.auto.paused ? '▶' : '⏸'}</button>` : ''}
      ${[1, 2, 4].map(n => `<button class="btn ghost small ${tl.speed === n ? 'on' : ''}" data-speed="${n}" title="Playback speed">${n}×</button>`).join('')}`;
    bar.querySelector('[data-pause]')?.addEventListener('click', () => {
      this.auto.paused = !this.auto.paused; this._renderAutoBar(); this._autoplay();
    });
    bar.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { tl.speed = +b.dataset.speed; this._renderAutoBar(); });
  }

  backToLobby() {
    clearTimeout(this._autoTimer); this.bots = new Set(); this._renderAutoBar();
    this.session?.close(); this.session = null; this.state = null;
    history.replaceState(null, '', location.pathname);
    $('#game').hidden = true;
    showLobby($('#lobby'), this);
  }

  act(action) { return this.session.act(action); }

  _hover(id, x, y) {
    const tip = $('#tooltip');
    if (!id || !this.state) { tip.hidden = true; this.ui.hover = null; return; }
    if (this.ui.hover !== id || tip.hidden) { renderShipTooltip(tip, this.state, id); this.ui.hover = id; }
    placeTooltip(tip, $('.table'), x, y);
  }

  select(id, toggle = true) {
    this.ui.selected = toggle && this.ui.selected === id ? null : id;
    this.board.setSelected(this.ui.selected);
    if (this.state) renderShipCards($('#cards'), { state: this.state, me: this._viewer(), selected: this.ui.selected, onSelect: x => this.select(x) });
  }

  /** In-page confirmation (browser confirm() is blocked in some embeds). */
  confirm(text, okLabel, onOk) {
    const m = $('#confirm');
    m.querySelector('p').textContent = text;
    const ok = m.querySelector('[data-ok]'); ok.textContent = okLabel;
    ok.onclick = () => { m.hidden = true; onOk(); };
    m.querySelector('[data-cancel]').onclick = () => { m.hidden = true; };
    m.hidden = false;
  }

  _viewer() { const m = this.session?.me; return m === 'both' || m === 'spectator' ? null : m; }

  _place(pos) {
    const p = this.state?.prompt;
    if (!p || !this.session.controls(p.player)) return;
    this.act({ type: 'CHOOSE', player: p.player, choice: 'place', payload: pos });
  }

  _concede() {
    const st = this.state; if (!st || st.winner) return;
    const me = this.session.me === 'both' ? st.prompt?.player || st.playerOrder[0] : this.session.me;
    if (!st.players[me]) return;
    this.confirm(`${st.players[me].name}: concede the battle?`, 'Concede', () => this.act({ type: 'CONCEDE', player: me }));
  }

  render() {
    const s = this.session;
    if (!s) return;
    if (!this.state) { // online host waiting for a guest
      $('#game').hidden = true; $('#lobby').hidden = false;
      const link = location.href;
      $('#lobby').innerHTML = `<div class="lobby"><div class="brand"><h1>VECTOR<span>ACES</span></h1></div>
        <div class="panel"><h2>Waiting for your wingmate…</h2><p>Send this link to your friend:</p>
        <div class="invite"><input readonly value="${esc(link)}"><button class="btn" data-copy>Copy</button></div>
        <p class="muted">Game code <b>${esc(s.transport.id)}</b>. The battle starts as soon as they join.</p></div></div>`;
      $('#lobby [data-copy]').onclick = () => {
        const inp = $('#lobby .invite input');
        navigator.clipboard?.writeText(link).catch(() => { inp.select(); });
        if (!navigator.clipboard) inp.select();
      };
      return;
    }
    $('#lobby').hidden = true; $('#game').hidden = false;
    const st = this.state;
    const waiting = waitingOn(st);
    $('#status').innerHTML = st.winner ? `<b>${esc(st.players[st.winner].name)} wins</b>`
      : `<span>Round ${st.round || '–'}</span><span>${phaseName(st)}</span>${waiting.map(p => `<span class="pill" style="--fc:${st.players[p].color}">${esc(st.players[p].name)}${s.controls(p) ? ' (you)' : ''}</span>`).join('')}`;
    // Hold the next decision (and the victory banner) until the table has caught up with it.
    const busy = this.board.timeline.busy();
    clearTimeout(this._promptTimer);
    if ((st.prompt || st.winner) && busy > 60) {
      this.board.setPlacement(null); this.board.setHighlight({});
      $('#prompt').innerHTML = `<div class="phase-title">${phaseName(st)}</div><p class="muted">${st.phase === 'combat' ? 'Shots incoming…' : 'Ships manoeuvring…'}</p>`;
      this._promptTimer = setTimeout(() => this.render(), busy);
    } else renderPrompt($('#prompt'), this);
    if (this.ui.hover && !$('#tooltip').hidden) renderShipTooltip($('#tooltip'), st, this.ui.hover);
    renderDiceTray($('#dice'), { state: st });
    renderShipCards($('#cards'), { state: st, me: this._viewer(), selected: this.ui.selected, onSelect: x => this.select(x) });
    renderLog($('#log'), { state: st, chat: s.chat });
  }
}

window.vectorAces = new App();
