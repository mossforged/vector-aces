// Dice tray: the live attack (state.attack) or the most recent one (state.lastAttack).
import { Q } from '../engine/index.js';
import { UPGRADES } from '../data/upgrades.js';
import { DIE_GLYPH, DIE_NAME, esc } from './glyphs.js';

export function renderDiceTray(el, { state }) {
  const a = state.attack || state.lastAttack;
  if (!a) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const atk = state.ships[a.attacker], def = state.ships[a.defender];
  const die = (d, kind) => `<span class="die ${kind} f-${d.face}${d.rerolled ? ' rr' : ''}" title="${DIE_NAME[d.face]}${d.rerolled ? ' (rerolled)' : ''}">${DIE_GLYPH[d.face]}</span>`;
  const weapon = a.weapon === 'primary' ? 'primary weapon' : UPGRADES[a.weapon].name;
  el.innerHTML = `
    <div class="tray-head">${state.attack ? 'Attack in progress' : 'Last attack'} · Range ${a.band}${a.obstructed ? ' · obstructed' : ''}</div>
    <div class="tray-line"><b>${esc(Q.shipName(atk))}</b> <small>${esc(weapon)}</small></div>
    <div class="dice-row">${a.attackDice.map(d => die(d, 'atk')).join('') || '<em>no dice</em>'}</div>
    <div class="tray-line"><b>${esc(Q.shipName(def))}</b> <small>defends</small></div>
    <div class="dice-row">${a.defenseDice.map(d => die(d, 'def')).join('') || (state.attack ? '<em>…</em>' : '<em>no dice</em>')}</div>
    ${a.result ? `<div class="tray-result ${a.result.hits + a.result.crits ? 'hit' : 'miss'}">${a.result.hits + a.result.crits ? `${a.result.hits} damage, ${a.result.crits} critical` : 'Miss'}</div>` : ''}`;
}
