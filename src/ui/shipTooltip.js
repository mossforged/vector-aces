// Hover card for a ship on the board: stats, condition, tokens, locks, damage, upgrades.
// Never shows planned dials (they are secret).
import { FACTIONS } from '../data/factions.js';
import { UPGRADES } from '../data/upgrades.js';
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { Q, G } from '../engine/index.js';
import { maneuverIcon, maneuverLabel, esc } from './glyphs.js';

export function renderShipTooltip(el, state, shipId) {
  const s = state.ships[shipId];
  if (!s) { el.hidden = true; return; }
  const ch = Q.chassis(s), pl = Q.pilot(s);
  const fac = FACTIONS[s.owner];
  const hullMax = ch.hull, hullLeft = Math.max(0, hullMax - Q.hullDamage(s));
  const faceup = s.damage.filter(c => c.faceup), facedown = s.damage.length - faceup.length;
  const lock = s.lockOn && state.ships[s.lockOn];
  const lockedBy = Q.liveShips(state).filter(o => o.lockOn === s.id);
  const touching = state.touches.filter(t => t.includes(s.id)).map(t => state.ships[t[0] === s.id ? t[1] : t[0]]).filter(Boolean);
  const onRock = Q.obstaclePolys(state).some(o => G.polygonsIntersect(Q.shipPoly(s), o));
  const total = s.shields + hullLeft, max = ch.shields + hullMax;
  const condition = s.destroyed ? 'Destroyed' : total === max ? 'Undamaged' : hullLeft <= 1 ? 'Critical' : hullLeft < hullMax ? 'Hull damaged' : 'Shields down';
  const condCls = s.destroyed || hullLeft <= 1 ? 'bad' : hullLeft < hullMax || s.shields < ch.shields ? 'warn' : 'good';

  const status = [];
  if (s.stress) status.push(`<li class="bad">Stressed ×${s.stress}: no actions, no red maneuvers</li>`);
  if (onRock) status.push('<li class="bad">On an asteroid: cannot attack</li>');
  for (const t of touching) status.push(`<li class="warn">Touching ${esc(Q.shipName(t))}: can't shoot each other</li>`);
  if (s.round.skipAction && state.phase === 'activation') status.push('<li class="warn">Skipped its action this round</li>');
  if (!Q.abilityActive(s)) status.push('<li class="bad">Pilot ability disabled (Head Wound)</li>');
  if (Q.effectiveSkill(state, s) !== pl.skill) status.push(`<li class="bad">Pilot skill reduced to ${Q.effectiveSkill(state, s)}</li>`);

  const stat = (cls, label, val, maxv) => `<div class="tt-stat ${cls}"><b>${val}${maxv !== undefined ? `<small>/${maxv}</small>` : ''}</b><span>${label}</span></div>`;
  const bar = `<div class="tt-bar">${Array.from({ length: ch.shields }, (_, i) => `<i class="${i < s.shields ? 'shd' : 'lost'}"></i>`).join('')}${Array.from({ length: hullMax }, (_, i) => `<i class="${i < hullLeft ? 'hul' : 'lost'}"></i>`).join('')}</div>`;

  el.innerHTML = `
    <div class="tt" style="--fc:${fac.color}">
      <div class="tt-head">
        <span class="ps">${Q.effectiveSkill(state, s)}</span>
        <div><b>${pl.unique ? '• ' : ''}${esc(Q.shipName(s))}</b><small>${esc(ch.name)} · ${fac.short} · ${esc(state.players[s.owner].name)}</small></div>
      </div>
      <div class="tt-stats">
        ${stat('atk', 'Attack', Q.stat(state, s, 'attack'))}
        ${stat('agi', 'Agility', Q.stat(state, s, 'agility'))}
        ${stat('hul', 'Hull', hullLeft, hullMax)}
        ${stat('shd', 'Shields', s.shields, ch.shields)}
      </div>
      ${bar}
      <div class="tt-cond ${condCls}">${condition}${facedown ? ` · ${facedown} damage card${facedown > 1 ? 's' : ''} face down` : ''}</div>
      ${faceup.length ? `<ul class="tt-crits">${faceup.map(c => `<li><b>✸ ${esc(DAMAGE_CARDS[c.card].name)}</b> ${esc(DAMAGE_CARDS[c.card].text)}</li>`).join('')}</ul>` : ''}
      ${s.tokens.focus || s.tokens.evade || lock || lockedBy.length ? `<div class="tt-tokens">
        ${s.tokens.focus ? `<span class="tok focus">Focus ×${s.tokens.focus}</span>` : ''}
        ${s.tokens.evade ? `<span class="tok evade">Evade ×${s.tokens.evade}</span>` : ''}
        ${lock ? `<span class="tok lock">Locked onto ${esc(Q.shipName(lock))}</span>` : ''}
        ${lockedBy.map(o => `<span class="tok lock">Targeted by ${esc(Q.shipName(o))}</span>`).join('')}
      </div>` : ''}
      ${status.length ? `<ul class="tt-status">${status.join('')}</ul>` : ''}
      ${s.round.revealed ? `<div class="tt-man">This round: ${maneuverIcon(s.round.revealed.replace(/^\d+/, ''), 'w', 16)} ${maneuverLabel(s.round.revealed)}</div>` : ''}
      ${pl.ability ? `<p class="tt-ability">${esc(pl.text)}</p>` : ''}
      <div class="tt-actions">Actions: ${ch.actions.map(a => ({ focus: 'Focus', evade: 'Evade', lock: 'Target lock', roll: 'Barrel roll' }[a])).join(' · ')}</div>
      ${s.upgrades.length ? `<ul class="tt-ups">${s.upgrades.map(u => `<li class="${u.discarded ? 'gone' : ''}"><b>${esc(UPGRADES[u.id].name)}</b> ${esc(UPGRADES[u.id].text)}</li>`).join('')}</ul>` : ''}
    </div>`;
  el.hidden = false;
}

/** Keep the card inside its container, offset from the cursor. */
export function placeTooltip(el, container, clientX, clientY) {
  const r = container.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = clientX - r.left + 18, y = clientY - r.top + 18;
  if (x + w > r.width - 8) x = clientX - r.left - w - 18;
  if (y + h > r.height - 8) y = Math.max(8, r.height - h - 8);
  el.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
}
