// Ship cards: everything public about each ship (stats, tokens, upgrades, damage).
import { FACTIONS } from '../data/factions.js';
import { UPGRADES } from '../data/upgrades.js';
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { Q } from '../engine/index.js';
import { esc } from './glyphs.js';
import { cardLink, cardImageUrl, showingOriginal } from './names.js';

export function renderShipCards(el, { state, me, selected, onSelect }) {
  const order = [...state.playerOrder].sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
  el.innerHTML = order.map(p => `
    <div class="fleet">
      <h3 style="--fc:${state.players[p].color}">${esc(state.players[p].name)} <small>${FACTIONS[state.players[p].faction].short} · ${state.players[p].points} pts${state.initiative === p ? ' · initiative' : ''}</small></h3>
      ${Q.shipList(state).filter(s => s.owner === p).map(s => card(state, s, selected)).join('')}
    </div>`).join('');
  el.querySelectorAll('.scard').forEach(c => c.addEventListener('click', () => onSelect?.(c.dataset.ship)));
  // If the host blocks the card pictures, say so once per ship instead of showing broken images.
  el.querySelectorAll('.card-art img').forEach(img => img.addEventListener('error', () => {
    const box = img.closest('.card-art'); img.remove();
    if (box && !box.querySelector('img')) box.innerHTML = '<p class="card-art-blocked">Card pictures can’t load here. They show when you run the game from the zip or GitHub Pages.</p>';
  }, { once: true }));
}

/** The pilot card and upgrade cards as pictures (shown while the original names & cards toggle is on). */
function cardArt(s) {
  const pilot = cardImageUrl(s.pilot);
  const ups = s.upgrades.map(u => ({ u, src: cardImageUrl(u.id) })).filter(x => x.src);
  if (!pilot && !ups.length) return '';
  return `<div class="card-art" data-noswap="1">
    ${pilot ? `<img class="ca-pilot" loading="lazy" alt="Pilot card" data-card="${s.pilot}" src="${pilot}">` : ''}
    ${ups.length ? `<div class="ca-ups">${ups.map(({ u, src }) => `<img class="${u.discarded ? 'gone' : ''}" loading="lazy" alt="Upgrade card" data-card="${u.id}" src="${src}">`).join('')}</div>` : ''}
  </div>`;
}

function card(state, s, selected) {
  const ch = Q.chassis(s), pl = Q.pilot(s);
  const hullLeft = Math.max(0, ch.hull - Q.hullDamage(s));
  const faceup = s.damage.filter(c => c.faceup);
  const facedown = s.damage.length - faceup.length;
  const lock = s.lockOn && state.ships[s.lockOn];
  const pips = (n, cls) => Array.from({ length: n }, () => `<i class="pip ${cls}"></i>`).join('');
  return `
  <div class="scard ${s.destroyed ? 'dead' : ''} ${selected === s.id ? 'sel' : ''}" data-ship="${s.id}" style="--fc:${state.players[s.owner].color}">
    <div class="scard-top">
      <span class="ps" title="Pilot skill">${Q.effectiveSkill(state, s)}</span>
      <div class="nm"><b>${pl.unique ? '• ' : ''}${esc(Q.shipName(s))}</b><small>${esc(ch.name)} ${cardLink(s.pilot)}</small></div>
      <div class="stats">
        <span class="st atk" title="Primary weapon">${Q.stat(state, s, 'attack')}</span>
        <span class="st agi" title="Agility">${Q.stat(state, s, 'agility')}</span>
        <span class="st hul" title="Hull left">${hullLeft}</span>
        <span class="st shd" title="Shields">${s.shields}</span>
      </div>
    </div>
    ${s.destroyed ? `<div class="dead-tag">${s.fled ? 'Fled' : 'Destroyed'}</div>` : `
    <div class="bars">${pips(s.shields, 'shd')}${pips(Math.max(0, Q.stat(state, s, 'maxShields') - s.shields), 'lost')}${pips(hullLeft, 'hul')}${pips(ch.hull - hullLeft, 'lost')}</div>
    <div class="tokens">
      ${s.tokens.focus ? `<span class="tok focus">Focus ×${s.tokens.focus}</span>` : ''}
      ${s.tokens.evade ? `<span class="tok evade">Evade ×${s.tokens.evade}</span>` : ''}
      ${s.stress ? `<span class="tok stress">Stress ×${s.stress}</span>` : ''}
      ${s.ion ? `<span class="tok ion">Ion ×${s.ion}</span>` : ''}
      ${lock ? `<span class="tok lock">Lock → ${esc(Q.shipName(lock))}</span>` : ''}
      ${s.round.revealed ? `<span class="tok man">Flew ${s.round.revealed}</span>` : ''}
    </div>
    ${pl.ability ? `<p class="ability ${Q.abilityActive(s) ? '' : 'off'}">${esc(pl.text)}</p>` : ''}
    ${s.upgrades.length ? `<ul class="ups">${s.upgrades.map(u => `<li class="${u.discarded ? 'gone' : ''}" title="${esc(UPGRADES[u.id].text)}">${esc(UPGRADES[u.id].name)} ${cardLink(u.id)}</li>`).join('')}</ul>` : ''}
    ${showingOriginal() ? cardArt(s) : ''}
    ${faceup.length || facedown ? `<div class="dmg">${faceup.map(c => `<span class="crit" title="${esc(DAMAGE_CARDS[c.card].text)}">✸ ${esc(DAMAGE_CARDS[c.card].name)}</span>`).join('')}${facedown ? `<span class="fd">${facedown} facedown</span>` : ''}</div>` : ''}`}
  </div>`;
}
