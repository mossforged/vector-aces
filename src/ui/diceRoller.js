// On-board dice mat: tumbles dice in when they are rolled, re-tumbles rerolls, flashes
// dice changed by focus/abilities, drops in added evades, then shows the result.
// Driven purely by engine events (attackDice / defenseDice / attackResult / roll).
import { Q } from '../engine/index.js';
import { UPGRADES } from '../data/upgrades.js';
import { FACTIONS } from '../data/factions.js';
import { ATTACK_FACES, DEFENSE_FACES } from '../engine/dice.js';
import { DIE_GLYPH, DIE_NAME, esc } from './glyphs.js';

const TUMBLE = 760, STAGGER = 110;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export class DiceRoller {
  constructor(el) {
    this.el = el; this.cursor = 0; this.hideTimer = null;
    this.rows = { attack: [], defense: [] };   // last shown dice per row
  }

  /** Feed every batch of engine events here (in order). */
  update(state, events) {
    for (const ev of events) {
      if (ev.type === 'attackDice' && ev.roll) this._startAttack(state, ev);
      else if (ev.type === 'attackDice') this._modify('attack', ev.dice);
      else if (ev.type === 'defenseDice' && ev.roll) this._rollRow('defense', ev.dice, state);
      else if (ev.type === 'defenseDice') this._modify('defense', ev.dice);
      else if (ev.type === 'attackResult') this._result(ev);
      else if (ev.type === 'roll') this._single(state, ev);
    }
  }

  _at(delay, fn) {
    const now = performance.now();
    const start = Math.max(now, this.cursor);
    this.cursor = start + delay;
    setTimeout(fn, start - now);
  }

  _show() { clearTimeout(this.hideTimer); this.el.hidden = false; this.el.classList.remove('fade'); }
  _hideLater(ms) {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => { this.el.classList.add('fade'); this.hideTimer = setTimeout(() => { this.el.hidden = true; }, 400); }, ms);
  }

  _startAttack(state, ev) {
    const atk = state.ships[ev.attacker], def = state.ships[ev.defender];
    const weapon = ev.weapon === 'primary' ? 'primary weapon' : UPGRADES[ev.weapon].name;
    this._at(0, () => {
      this._show();
      this.el.innerHTML = `
        <div class="dm-head">
          <b style="color:${FACTIONS[atk.owner].color}">${esc(Q.shipName(atk))}</b>
          <span class="dm-arrow">fires at</span>
          <b style="color:${FACTIONS[def.owner].color}">${esc(Q.shipName(def))}</b>
          <small>Range ${ev.band} · ${esc(weapon)}${ev.obstructed ? ' · obstructed' : ''}</small>
        </div>
        <div class="dm-row" data-row="attack"><span class="dm-lbl">Attack</span><div class="dm-dice"></div></div>
        <div class="dm-row" data-row="defense"><span class="dm-lbl">Defense</span><div class="dm-dice"><em class="dm-wait">waiting…</em></div></div>
        <div class="dm-result"></div>`;
      this.rows = { attack: [], defense: [] };
    });
    this._rollRow('attack', ev.dice, state);
  }

  _rowEl(kind) { return this.el.querySelector(`[data-row="${kind}"] .dm-dice`); }

  _rollRow(kind, dice, state) {
    const n = dice.length;
    this._at(n ? TUMBLE + (n - 1) * STAGGER : 200, () => {
      const row = this._rowEl(kind); if (!row) return;
      row.innerHTML = n ? '' : '<em class="dm-wait">no dice</em>';
      dice.forEach((d, i) => row.appendChild(this._die(kind, d.face, i * STAGGER)));
      this.rows[kind] = dice.map(d => ({ ...d }));
    });
  }

  _modify(kind, dice) {
    this._at(TUMBLE * 0.8, () => {
      const row = this._rowEl(kind); if (!row) return;
      const prev = this.rows[kind];
      dice.forEach((d, i) => {
        const p = prev[i];
        const el = row.children[i];
        if (!p || !el || el.tagName === 'EM') { row.appendChild(this._die(kind, d.face, 0, 'drop')); return; }
        if (d.rerolled && !p.rerolled) row.replaceChild(this._die(kind, d.face, i * 60, 'reroll'), el);
        else if (d.face !== p.face) { setFace(el, kind, d.face); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      });
      this.rows[kind] = dice.map(d => ({ ...d }));
    });
  }

  _result(ev) {
    this._at(1400, () => {
      const box = this.el.querySelector('.dm-result'); if (!box) return;
      // mark cancelled pairs
      const hits = ev.hits + ev.crits;
      box.className = `dm-result show ${hits ? 'hit' : 'miss'}`;
      box.textContent = hits ? `Hit! ${ev.hits ? `${ev.hits} damage` : ''}${ev.hits && ev.crits ? ' + ' : ''}${ev.crits ? `${ev.crits} critical` : ''}` : 'Miss — all shots evaded';
      this._hideLater(2600);
    });
  }

  _single(state, ev) {
    const ship = state.ships[ev.ship];
    this._at(0, () => {
      this._show();
      this.el.innerHTML = `<div class="dm-head"><b style="color:${FACTIONS[ship.owner].color}">${esc(Q.shipName(ship))}</b><small>${esc(ev.reason || 'Roll')}</small></div>
        <div class="dm-row" data-row="attack"><span class="dm-lbl">Roll</span><div class="dm-dice"></div></div><div class="dm-result"></div>`;
      this.rows = { attack: [], defense: [] };
    });
    this._rollRow('attack', ev.faces.map(face => ({ face })), state);
    this._at(300, () => {
      const box = this.el.querySelector('.dm-result'); if (!box) return;
      const f = ev.faces[0];
      const good = ev.success ?? (f === 'blank' || f === 'focus');
      box.className = `dm-result show ${good ? 'miss' : 'hit'}`;
      box.textContent = ev.success !== undefined ? (ev.success ? 'Repaired' : 'Repair failed') : (good ? 'No damage' : f === 'crit' ? 'Critical damage' : 'Damage');
      this._hideLater(1800);
    });
  }

  _die(kind, face, delay, mode = 'roll') {
    const el = document.createElement('span');
    el.className = `die3d ${kind === 'attack' ? 'atk' : 'def'}`;
    setFace(el, kind, face);
    if (reduced()) return el;
    if (mode === 'drop') { el.classList.add('drop'); return el; }
    el.classList.add('tumble'); el.style.animationDelay = `${delay}ms`;
    const faces = kind === 'attack' ? ATTACK_FACES : DEFENSE_FACES;
    const start = performance.now() + delay;
    const spin = () => {
      const t = performance.now();
      if (t >= start + TUMBLE - 120) { setFace(el, kind, face); el.classList.add('landed'); return; }
      if (t >= start) setFace(el, kind, faces[(Math.random() * 8) | 0], true);
      setTimeout(spin, 70);
    };
    setFace(el, kind, faces[(Math.random() * 8) | 0], true);
    spin();
    return el;
  }
}

function setFace(el, kind, face, spinning = false) {
  el.dataset.face = face;
  el.textContent = DIE_GLYPH[face];
  el.title = spinning ? '' : DIE_NAME[face];
  el.classList.toggle('blank', face === 'blank');
  el.classList.toggle('crit', face === 'crit');
}
