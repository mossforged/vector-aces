// Squad builder for one faction. Mutates and reports `squad` = [{ pilot, upgrades: [] }].
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES } from '../data/upgrades.js';
import { FACTIONS } from '../data/factions.js';
import { PRESET_SQUADS } from '../data/presets.js';
import { squadPoints, validateSquad } from '../engine/index.js';
import { esc } from './glyphs.js';

export function mountSquadBuilder(el, { faction, squad, limit = 100, onChange }) {
  const pilots = Object.values(PILOTS).filter(p => SHIPS[p.ship].faction === faction).sort((a, b) => a.cost - b.cost);
  const presets = PRESET_SQUADS[faction] || {};

  const render = () => {
    const pts = squadPoints(squad);
    const errs = validateSquad(faction, squad, limit);
    el.innerHTML = `
      <div class="sb" style="--fc:${FACTIONS[faction].color}">
        <div class="sb-head"><b>${FACTIONS[faction].name}</b>
          <select data-preset><option value="">Load preset…</option>${Object.entries(presets).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select>
        </div>
        <ul class="sb-list">
          ${squad.map((e, i) => shipRow(e, i)).join('') || '<li class="muted">No ships yet — add pilots below.</li>'}
        </ul>
        <div class="sb-add">${pilots.map(p => `<button class="chip" data-add="${p.id}" title="${esc(p.text)}"><b>${p.skill}</b> ${esc(p.name)} <small>${SHIPS[p.ship].name} · ${p.cost}</small></button>`).join('')}</div>
        <div class="sb-foot ${pts > limit ? 'over' : ''}">${pts} / ${limit} pts ${errs.length ? `<span class="sb-err">${esc(errs[0])}</span>` : '<span class="ok">✓ legal</span>'}</div>
      </div>`;
    el.querySelector('[data-preset]').onchange = e => {
      const v = presets[e.target.value]; if (!v) return;
      squad.splice(0, squad.length, ...JSON.parse(JSON.stringify(v.ships)).map(s => ({ upgrades: [], ...s })));
      changed();
    };
    el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { squad.push({ pilot: b.dataset.add, upgrades: [] }); changed(); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { squad.splice(+b.dataset.del, 1); changed(); });
    el.querySelectorAll('[data-slot]').forEach(s => s.onchange = () => {
      const e = squad[+s.dataset.i];
      const slots = slotsFor(e);
      const ups = slots.map((_, k) => el.querySelector(`[data-i="${s.dataset.i}"][data-slot="${k}"]`)?.value).filter(Boolean);
      e.upgrades = ups; changed();
    });
  };

  const changed = () => { render(); onChange?.(squad); };

  function slotsFor(e) {
    const p = PILOTS[e.pilot];
    return [...SHIPS[p.ship].slots, ...(p.elite ? ['elite'] : [])];
  }

  function shipRow(e, i) {
    const p = PILOTS[e.pilot];
    const slots = slotsFor(e);
    const used = [...(e.upgrades || [])];
    const selects = slots.map((slot, k) => {
      const opts = Object.values(UPGRADES).filter(u => u.slot === slot);
      const cur = used.find(u => UPGRADES[u].slot === slot);
      if (cur) used.splice(used.indexOf(cur), 1);
      return `<select data-i="${i}" data-slot="${k}" title="${slot} slot"><option value="">${slot}: none</option>${opts.map(u => `<option value="${u.id}" ${cur === u.id ? 'selected' : ''}>${esc(u.name)} (${u.cost})</option>`).join('')}</select>`;
    }).join('');
    const cost = p.cost + (e.upgrades || []).reduce((n, u) => n + UPGRADES[u].cost, 0);
    return `<li><span class="ps">${p.skill}</span><span class="sb-name">${esc(p.name)} <small>${SHIPS[p.ship].name}</small></span>${selects}<span class="sb-cost">${cost}</span><button class="x" data-del="${i}" title="Remove">✕</button></li>`;
  }

  render();
  return { render };
}
