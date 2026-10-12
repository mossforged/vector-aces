// Planning-phase dial picker: one grid per ship (rows = speed, columns = bearing),
// laid out like the quick-reference maneuver chart.
import { SHIPS, BEARINGS, parseManeuver } from '../data/ships.js';
import { Q } from '../engine/index.js';
import { maneuverIcon, maneuverLabel, esc } from './glyphs.js';

/**
 * @param el       container
 * @param state    game state
 * @param ships    the ships this player is planning for
 * @param draft    { shipId: key } (mutated by clicks)
 * @param onChange called after a pick
 * @param onLock   called when "Lock in" is pressed
 */
export function renderDialPicker(el, { state, ships: all, draft, onChange, onLock, onFocusShip }) {
  const ionized = all.filter(s => s.ion > 0);
  const ships = all.filter(s => !(s.ion > 0));
  const done = ships.every(s => draft[s.id]);
  el.innerHTML = `
    <div class="dial-list">
      ${ships.map(s => dialBlock(state, s, draft[s.id])).join('')}
      ${ionized.map(s => `<div class="dial ionized"><div class="dial-head"><span class="ps">${Q.effectiveSkill(state, s)}</span><b>${esc(Q.shipName(s))}</b><span class="tag ion">ionized</span></div><p class="hint">Systems scrambled: this ship will drift 1 straight (white) this round.</p></div>`).join('')}
    </div>
    <button class="btn primary wide" data-lock ${done ? '' : 'disabled'}>${done ? 'Lock in dials' : `Choose ${ships.filter(s => !draft[s.id]).length} more`}</button>
    <p class="hint">Plan in your head — templates can't be tested before you commit.</p>`;
  el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
    draft[b.dataset.ship] = b.dataset.m; onChange?.(); onFocusShip?.(b.dataset.ship);
  }));
  el.querySelectorAll('.dial').forEach(d => d.addEventListener('mouseenter', () => onFocusShip?.(d.dataset.ship)));
  el.querySelector('[data-lock]')?.addEventListener('click', () => done && onLock());
}

function dialBlock(state, ship, chosen) {
  const dial = SHIPS[ship.chassis].dial.map(parseManeuver);
  const speeds = [...new Set(dial.map(m => m.speed))].sort((a, b) => b - a);
  const stressed = ship.stress > 0;
  return `
  <div class="dial" data-ship="${ship.id}">
    <div class="dial-head">
      <span class="ps">${Q.effectiveSkill(state, ship)}</span>
      <b>${esc(Q.shipName(ship))}</b>
      ${stressed ? '<span class="tag stress">stressed</span>' : ''}
      <span class="chosen">${chosen ? maneuverLabel(chosen) : '—'}</span>
    </div>
    <div class="dial-grid">
      ${speeds.map(sp => `
        <div class="dial-row"><span class="sp">${sp}</span>
          ${BEARINGS.map(b => {
            const m = dial.find(x => x.speed === sp && x.bearing === b);
            if (!m) return '<span class="cell empty"></span>';
            const color = Q.maneuverColor(state, ship, m);
            const blocked = stressed && color === 'r';
            return `<button class="cell ${chosen === m.key ? 'on' : ''} ${blocked ? 'warn' : ''}" data-ship="${ship.id}" data-m="${m.key}" title="${maneuverLabel(m.key)}${blocked ? ' — stressed: your opponent will pick a replacement' : color === 'r' ? ' (red: +stress)' : color === 'g' ? ' (green: −stress)' : ''}">${maneuverIcon(m.bearing, color)}</button>`;
          }).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}
