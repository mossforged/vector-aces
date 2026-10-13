// Squad builder for one faction. Mutates and reports `squad` = [{ pilot, upgrades: [] }].
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES, SLOT_LABELS } from '../data/upgrades.js';
import { FACTIONS } from '../data/factions.js';
import { PRESET_SQUADS } from '../data/presets.js';
import { squadPoints, entryPoints, validateSquad, upgradeAllowed, slotsFor } from '../engine/index.js';
import { randomSquad } from '../ai/simpleBot.js';
import { esc } from './glyphs.js';
import { cardLink } from './names.js';

const ACTION_SHORT = { focus: 'Focus', lock: 'Lock', roll: 'Roll', evade: 'Evade', boost: 'Boost' };
const NOT_YET = new Set([]); // slots with no implemented upgrades yet

export function mountSquadBuilder(el, { faction, squad, limit = 100, onChange }) {
  const chassis = Object.values(SHIPS).filter(s => Object.values(PILOTS).some(p => p.ship === s.id && p.faction === faction && !p.hidden));
  const presets = PRESET_SQUADS[faction] || {};
  let openShip = null;

  const render = () => {
    const pts = squadPoints(squad);
    const errs = validateSquad(faction, squad, limit);
    el.innerHTML = `
      <div class="sb" style="--fc:${FACTIONS[faction].color}">
        <div class="sb-head"><b>${FACTIONS[faction].name}</b>
          <span class="sb-tools">
            <select data-preset aria-label="Load preset"><option value="">Load preset…</option>${Object.entries(presets).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select>
            <button class="btn small" data-random title="Random legal squad">Random</button>
          </span>
        </div>
        <ul class="sb-list">
          ${squad.map((e, i) => shipRow(e, i)).join('') || '<li class="muted">No ships yet. Pick a ship type below, then a pilot.</li>'}
        </ul>
        <div class="sb-ships">
          ${chassis.map(c => `<button class="sb-ship ${openShip === c.id ? 'on' : ''}" data-ship="${c.id}">
            <b>${esc(c.name)}</b><span class="sb-stats"><i class="atk">${c.attack}</i><i class="agi">${c.agility}</i><i class="hul">${c.hull}</i><i class="shd">${c.shields}</i></span>
            <small>${c.actions.map(a => ACTION_SHORT[a]).join(' · ')}</small></button>`).join('')}
        </div>
        ${openShip ? `<div class="sb-add">${Object.values(PILOTS).filter(p => p.ship === openShip && p.faction === faction && !p.hidden).sort((a, b) => b.skill - a.skill).map(p => `
          <button class="chip" data-add="${p.id}" title="${esc(p.text || 'No special ability.')}"><b>${p.skill}</b> ${p.unique ? '• ' : ''}${esc(p.name)} <small>${p.cost}${p.text ? ' · ability' : ''}</small></button>`).join('')}</div>` : ''}
        <div class="sb-foot ${pts > limit ? 'over' : ''}">${pts} / ${limit} pts ${errs.length ? `<span class="sb-err">${esc(errs[0])}</span>` : '<span class="ok">✓ legal</span>'}</div>
      </div>`;
    el.querySelector('[data-preset]').onchange = e => {
      const v = presets[e.target.value]; if (!v) return;
      squad.splice(0, squad.length, ...JSON.parse(JSON.stringify(v.ships)).map(s => ({ upgrades: [], ...s })));
      changed();
    };
    el.querySelector('[data-random]').onclick = async () => { squad.splice(0, squad.length, ...(await randomSquad(faction, Math.random, limit))); changed(); };
    el.querySelectorAll('[data-ship]').forEach(b => b.onclick = () => { openShip = openShip === b.dataset.ship ? null : b.dataset.ship; render(); });
    el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { squad.push({ pilot: b.dataset.add, upgrades: [] }); changed(); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { squad.splice(+b.dataset.del, 1); changed(); });
    el.querySelectorAll('[data-slot]').forEach(s => s.onchange = () => {
      const i = +s.dataset.i, e = squad[i];
      e.upgrades = [...el.querySelectorAll(`[data-i="${i}"][data-slot]`)].map(x => x.value).filter(Boolean);
      changed();
    });
  };

  const changed = () => { render(); onChange?.(squad); };

  function shipRow(e, i) {
    const p = PILOTS[e.pilot];
    const used = [...(e.upgrades || [])];
    const selects = slotsFor(p.id, e.upgrades || []).map((slot, k) => {
      if (NOT_YET.has(slot)) return `<select disabled title="${SLOT_LABELS[slot]} upgrades are not in the game yet"><option>${SLOT_LABELS[slot]}: coming soon</option></select>`;
      const opts = Object.values(UPGRADES).filter(u => u.slot === slot && upgradeAllowed(p.id, u.id, e.upgrades || []));
      if (!opts.length) return '';
      const cur = used.find(u => UPGRADES[u].slot === slot);
      if (cur) used.splice(used.indexOf(cur), 1);
      return `<select data-i="${i}" data-slot="${k}" title="${esc(cur ? UPGRADES[cur].text : SLOT_LABELS[slot] + ' slot')}">
        <option value="">${SLOT_LABELS[slot]}: none</option>${opts.map(u => `<option value="${u.id}" ${cur === u.id ? 'selected' : ''} title="${esc(u.text)}">${esc(u.name)} (${u.cost})</option>`).join('')}</select>`;
    }).join('');
    const cost = entryPoints(e);
    return `<li><span class="ps">${p.skill}</span><span class="sb-name" title="${esc(p.text || '')}">${esc(p.name)} <small>${SHIPS[p.ship].name}</small> ${cardLink(p.id)}${(e.upgrades || []).map(cardLink).join(' ')}</span>${selects}<span class="sb-cost">${cost}</span><button class="x" data-del="${i}" title="Remove">✕</button></li>`;
  }

  render();
  return { render };
}
