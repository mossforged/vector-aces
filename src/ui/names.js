// "Original names" display toggle.
//
// The game always runs on its own (re-themed) names. When a viewer flips this toggle,
// every name on their screen — ships, pilots, upgrades, damage cards, factions, slot
// labels, inside panels, prompts, the log and tooltips — is swapped for the original
// name. It's per-viewer (stored in localStorage) and never affects the other player.
//
// How: a MutationObserver rewrites text nodes and title attributes as panels render,
// remembering the themed text so switching back restores it exactly. Canvas text uses label().
import { ORIGINAL_NAMES as O } from '../data/gen/index.js';
import { SHIPS } from '../data/ships.js';
import { PILOTS } from '../data/pilots.js';
import { UPGRADES, SLOT_LABELS } from '../data/upgrades.js';
import { DAMAGE_CARDS } from '../data/damageDeck.js';
import { FACTIONS } from '../data/factions.js';
import { ORDNANCE } from '../data/ordnance.js';
import { CONDITIONS } from '../data/conditions.js';

const KEY = 'va-names';
let original = (() => { try { return localStorage.getItem(KEY) === 'original'; } catch { return false; } })();
const listeners = new Set();

// themed name → original name (only where they differ)
const MAP = new Map();
const add = (ours, theirs) => { if (ours && theirs && ours !== theirs && !MAP.has(ours)) MAP.set(ours, theirs); };
for (const [id, n] of Object.entries(O.pilots)) add(PILOTS[id]?.name, n);
for (const [id, n] of Object.entries(O.upgrades)) add(UPGRADES[id]?.name, n);
for (const [id, n] of Object.entries(O.ships)) add(SHIPS[id]?.name, n);
for (const [id, n] of Object.entries(O.damage)) add(DAMAGE_CARDS[id]?.name, n);
for (const [id, n] of Object.entries(O.slots)) add(SLOT_LABELS[id], n);
for (const t of Object.values(ORDNANCE)) add(t.name, t.original);
for (const [id, nm] of Object.entries(O.conditions || {})) add(CONDITIONS[id]?.name, nm);
for (const f of Object.values(FACTIONS)) {
  add(f.name, f.original);
  add(f.short, { league: 'Rebels', dominion: 'Empire', syndicate: 'Scum' }[f.id]);
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keys = [...MAP.keys()].sort((a, b) => b.length - a.length);
const RE = new RegExp(`(?<![\\p{L}\\p{N}-])(${keys.map(esc).join('|')})(?![\\p{L}\\p{N}-])`, 'gu');

/** Replace themed names with original ones in a string (no-op when the toggle is off). */
export function label(text) {
  return original && text ? String(text).replace(RE, m => MAP.get(m)) : text;
}
const swap = text => String(text).replace(RE, m => MAP.get(m));

export const showingOriginal = () => original;

const IMG_BASE = 'https://github.com/guidokessels/xwing-data/blob/master/images/';
/**
 * A small "view original card" link for a pilot / upgrade / condition id ('' if none).
 * Always rendered; CSS only shows it while the original-names toggle is on. It opens the card
 * image in the community dataset repo in a new tab — the game itself never contains that art.
 */
export function cardLink(id) {
  const path = O.images?.[id];
  if (!path) return '';
  const href = IMG_BASE + path.split('/').map(encodeURIComponent).join('/');
  return `<a class="orig-link" href="${href}" target="_blank" rel="noopener" title="Open the original card in a new tab" data-noswap="1">card ↗</a>`;
}
const syncRootClass = () => document.documentElement.classList.toggle('show-original', original);
syncRootClass();

export function setOriginal(on) {
  original = !!on;
  try { localStorage.setItem(KEY, original ? 'original' : 'theme'); } catch {}
  syncRootClass();
  if (original) applyTree(document.body); else restoreAll();
  for (const fn of listeners) fn(original);
}
export const onNamesChange = fn => listeners.add(fn);

// ---------------- DOM rewriting ----------------
const themedText = new WeakMap();   // text node → themed text
const themedTitle = new WeakMap();  // element → themed title
const touched = new Set();          // weak-ish registry for restoreAll (pruned when nodes leave the DOM)
let busy = false;

function applyText(node) {
  const cur = node.data;
  const known = themedText.get(node);
  if (known !== undefined && cur === swap(known)) return; // already ours
  const next = swap(cur);
  if (next === cur) return;
  themedText.set(node, cur);
  touched.add(node);
  node.data = next;
}
function applyTitle(el) {
  const cur = el.getAttribute('title'); if (!cur) return;
  const known = themedTitle.get(el);
  if (known !== undefined && cur === swap(known)) return;
  const next = swap(cur);
  if (next === cur) return;
  themedTitle.set(el, cur);
  touched.add(el);
  el.setAttribute('title', next);
}
function applyTree(root) {
  if (!root) return;
  busy = true;
  if (root.nodeType === 3) applyText(root);
  else if (root.nodeType === 1) {
    if (root.hasAttribute('title')) applyTitle(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) { if (!n.parentElement?.closest('script,style,input,textarea')) applyText(n); }
      else if (n.hasAttribute('title')) applyTitle(n);
    }
  }
  busy = false;
}
function restoreAll() {
  busy = true;
  for (const n of touched) {
    if (!n.isConnected) { touched.delete(n); continue; }
    if (n.nodeType === 3 && themedText.has(n)) n.data = themedText.get(n);
    if (n.nodeType === 1 && themedTitle.has(n)) n.setAttribute('title', themedTitle.get(n));
  }
  touched.clear();
  busy = false;
}

new MutationObserver(muts => {
  if (!original || busy) return;
  for (const m of muts) {
    if (m.type === 'childList') m.addedNodes.forEach(applyTree);
    else if (m.type === 'characterData') applyTree(m.target);
    else if (m.type === 'attributes') applyTree(m.target);
  }
  if (touched.size > 5000) for (const n of touched) if (!n.isConnected) touched.delete(n);
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });

if (original) queueMicrotask(() => applyTree(document.body));

/** A small switch button. Put it anywhere; all instances stay in sync. */
export function namesToggleButton() {
  const b = document.createElement('button');
  b.className = 'btn ghost small names-toggle';
  b.type = 'button';
  const sync = () => {
    b.textContent = original ? 'Names: original' : 'Names: Vector Aces';
    b.setAttribute('aria-pressed', String(original));
    b.dataset.noswap = '1';
  };
  b.title = 'Swap between the re-themed names and the original game’s names (only on your screen). Shortcut: N';
  b.onclick = () => setOriginal(!original);
  onNamesChange(sync); sync();
  return b;
}

window.addEventListener('keydown', e => {
  if ((e.key === 'n' || e.key === 'N') && !e.target.matches?.('input, textarea, select') && !e.metaKey && !e.ctrlKey) setOriginal(!original);
});
