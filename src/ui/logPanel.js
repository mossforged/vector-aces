// Game log (+ chat lines when online).
import { esc } from './glyphs.js';

export function renderLog(el, { state, chat = [] }) {
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  const lines = state.log.slice(-120).map(l => `<li class="${l.text.startsWith('—') ? 'rnd' : ''}">${esc(l.text)}</li>`);
  const chats = chat.slice(-20).map(c => `<li class="chat"><b>${esc(state.players[c.player]?.name || c.player)}:</b> ${esc(c.text)}</li>`);
  el.innerHTML = `<ul>${lines.join('')}${chats.join('')}</ul>`;
  if (atBottom) el.scrollTop = el.scrollHeight;
}
