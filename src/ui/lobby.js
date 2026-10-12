// Lobby: hotseat setup, online host/join, resume. Calls app.start(transport, me) when ready.
import { FACTIONS } from '../data/factions.js';
import { PILOTS } from '../data/pilots.js';
import { PRESET_SQUADS } from '../data/presets.js';
import { validateSquad } from '../engine/index.js';
import { LocalTransport, FirebaseTransport, connectFirebase } from '../net/transports.js';
import { FIREBASE_CONFIG } from '../net/firebaseConfig.js';
import { mountSquadBuilder } from './squadBuilder.js';
import { esc } from './glyphs.js';

const clone = x => JSON.parse(JSON.stringify(x));
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const playable = f => Object.values(PILOTS).some(p => p.faction === f);
const starter = f => clone(PRESET_SQUADS[f]?.intro?.ships || []);

/**
 * One player's setup: name, faction tabs and squad builder. Keeps a separate draft squad
 * per faction so switching back and forth doesn't lose work. Returns { get() }.
 */
function seatPicker(el, { label, name, faction }) {
  const drafts = {};
  const render = () => {
    drafts[faction] ||= starter(faction);
    el.innerHTML = `
      <label>${esc(label)} <input data-name value="${esc(name)}"></label>
      <div class="tabs small">${Object.values(FACTIONS).map(f => `<button class="tab ${faction === f.id ? 'on' : ''}" data-f="${f.id}" style="--fc:${f.color}" ${playable(f.id) ? '' : 'disabled title="Ships coming soon"'}>${f.short}${playable(f.id) ? '' : ' (soon)'}</button>`).join('')}</div>
      <p class="muted small faction-blurb">${esc(FACTIONS[faction].blurb)}</p>
      <div data-sb></div>`;
    el.querySelector('[data-name]').oninput = e => { name = e.target.value; };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { faction = b.dataset.f; render(); });
    mountSquadBuilder(el.querySelector('[data-sb]'), { faction, squad: drafts[faction] });
  };
  render();
  return { get: () => ({ faction, name: name.trim(), squad: drafts[faction] }) };
}

export function showLobby(el, app) {
  const params = new URLSearchParams(location.search);
  const code = params.get('game');
  el.hidden = false;
  if (code) return joinScreen(el, app, code.toUpperCase());
  homeScreen(el, app);
}

function homeScreen(el, app) {
  const hasHotseat = (() => { try { return JSON.parse(localStorage.getItem('va-log-hotseat') || '[]').length >= 2; } catch { return false; } })();
  let mode = 'hotseat';

  const render = () => {
    el.innerHTML = `
    <div class="lobby">
      <div class="brand"><h1>VECTOR<span>ACES</span></h1><p>Tactical starfighter dogfights · two players · plan, move, shoot.</p></div>
      ${hasHotseat ? '<button class="btn wide" data-resume>Resume last same-screen game</button>' : ''}
      <div class="tabs">
        <button class="tab ${mode === 'hotseat' ? 'on' : ''}" data-mode="hotseat">Same screen</button>
        <button class="tab ${mode === 'host' ? 'on' : ''}" data-mode="host">Host online game</button>
      </div>
      <div class="panel" data-body></div>
    </div>`;
    el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; render(); });
    el.querySelector('[data-resume]')?.addEventListener('click', () => app.start(new LocalTransport('hotseat'), 'both'));
    const body = el.querySelector('[data-body]');
    if (mode === 'hotseat') hotseatForm(body, app);
    else hostForm(body, app);
  };
  render();
}

function optionsBlock() {
  return `<label class="check"><input type="checkbox" data-obst checked> Asteroid field (6 obstacles, placed alternately)</label>`;
}

function hotseatForm(body, app) {
  body.innerHTML = `
    <div class="two"><div data-seat="1"></div><div data-seat="2"></div></div>
    ${optionsBlock()}
    <button class="btn primary wide" data-start>Start battle</button>
    <p class="err" data-err></p>`;
  const s1 = seatPicker(body.querySelector('[data-seat="1"]'), { label: 'Player 1 (near edge)', name: 'Player 1', faction: 'league' });
  const s2 = seatPicker(body.querySelector('[data-seat="2"]'), { label: 'Player 2 (far edge)', name: 'Player 2', faction: 'dominion' });
  body.querySelector('[data-start]').onclick = async () => {
    const a = s1.get(), b = s2.get();
    const errs = [...validateSquad(a.faction, a.squad, 100).map(e => `Player 1: ${e}`), ...validateSquad(b.faction, b.squad, 100).map(e => `Player 2: ${e}`)];
    if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
    const t = new LocalTransport('hotseat'); t.clear();
    await t.append({ kind: 'host', faction: a.faction, name: a.name || 'Player 1', squad: a.squad, obstacles: body.querySelector('[data-obst]').checked, seed: randomSeed() });
    await t.append({ kind: 'join', faction: b.faction, name: b.name || 'Player 2', squad: b.squad });
    app.start(t, 'both');
  };
}

function needFirebase(body) {
  body.innerHTML = `<div class="setup-note"><h3>Online play needs a (free) Firebase database</h3>
    <ol><li>Reuse the Firebase project from your Istanbul game, or create one at console.firebase.google.com.</li>
    <li>Enable <b>Realtime Database</b> and paste your web config into <code>src/net/firebaseConfig.js</code>.</li>
    <li>Publish the folder with GitHub Pages and share the link.</li></ol>
    <p class="muted">See <code>docs/ONLINE.md</code>. Same-screen play works without any of this.</p></div>`;
}

function hostForm(body, app) {
  if (!FIREBASE_CONFIG) return needFirebase(body);
  body.innerHTML = `
    <div data-seat></div>
    ${optionsBlock()}
    <button class="btn primary wide" data-host>Create game & get invite link</button>
    <p class="err" data-err></p>`;
  const seat = seatPicker(body.querySelector('[data-seat]'), { label: 'Your name', name: store.get('va-name') || 'Host', faction: 'league' });
  body.querySelector('[data-host]').onclick = async () => {
    const me = seat.get();
    const errs = validateSquad(me.faction, me.squad, 100);
    if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
    store.set('va-name', me.name || 'Host');
    try {
      const db = await connectFirebase(FIREBASE_CONFIG);
      const code = newCode();
      const t = new FirebaseTransport(db, code);
      await t.append({ kind: 'host', faction: me.faction, name: me.name || 'Host', squad: me.squad, obstacles: body.querySelector('[data-obst]').checked, seed: randomSeed() });
      store.set(`va-role-${code}`, 'p1');
      history.replaceState(null, '', `?game=${code}`);
      app.start(t, 'p1');
    } catch (e) { body.querySelector('[data-err]').textContent = 'Could not reach Firebase: ' + e.message; }
  };
}

async function joinScreen(el, app, code) {
  el.innerHTML = `<div class="lobby"><div class="brand"><h1>VECTOR<span>ACES</span></h1></div><div class="panel" data-body><p class="muted">Connecting to game ${esc(code)}…</p></div></div>`;
  const body = el.querySelector('[data-body]');
  if (!FIREBASE_CONFIG) return needFirebase(body);
  let db;
  try { db = await connectFirebase(FIREBASE_CONFIG); } catch (e) { body.innerHTML = `<p class="err">Could not reach Firebase: ${esc(e.message)}</p>`; return; }
  const head = await FirebaseTransport.peek(db, code);
  const role = store.get(`va-role-${code}`);
  if (!head.length) { body.innerHTML = `<p class="err">No game called ${esc(code)}.</p><a class="btn" href="${location.pathname}">Back</a>`; return; }
  if (role) return app.start(new FirebaseTransport(db, code), role);
  if (head.length >= 2) {
    body.innerHTML = `<p>This game already has two pilots.</p><button class="btn" data-watch>Watch as spectator</button> <a class="btn ghost" href="${location.pathname}">Back</a>`;
    body.querySelector('[data-watch]').onclick = () => app.start(new FirebaseTransport(db, code), 'spectator');
    return;
  }
  const host = head[0];
  body.innerHTML = `
    <p><b>${esc(host.name)}</b> invites you to a battle${host.obstacles ? ' in an asteroid field' : ''}. They fly for the
      <b style="color:${FACTIONS[host.faction].color}">${FACTIONS[host.faction].name}</b>. Pick your side and squad:</p>
    <div data-seat></div>
    <button class="btn primary wide" data-join>Join battle</button><p class="err" data-err></p>`;
  const seat = seatPicker(body.querySelector('[data-seat]'), { label: 'Your name', name: store.get('va-name') || 'Guest',
    faction: host.faction === 'dominion' ? 'league' : 'dominion' });
  body.querySelector('[data-join]').onclick = async () => {
    const me = seat.get();
    const errs = validateSquad(me.faction, me.squad, 100);
    if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
    store.set('va-name', me.name || 'Guest');
    const t = new FirebaseTransport(db, code);
    await t.append({ kind: 'join', faction: me.faction, name: me.name || 'Guest', squad: me.squad });
    store.set(`va-role-${code}`, 'p2');
    app.start(t, 'p2');
  };
}
