// Lobby: hotseat setup, online host/join, resume. Calls app.start(transport, me) when ready.
import { FACTIONS } from '../data/factions.js';
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

export function showLobby(el, app) {
  const params = new URLSearchParams(location.search);
  const code = params.get('game');
  el.hidden = false;
  if (code) return joinScreen(el, app, code.toUpperCase());
  homeScreen(el, app);
}

function homeScreen(el, app) {
  const hasHotseat = (() => { try { return JSON.parse(localStorage.getItem('va-log-hotseat') || '[]').length >= 2; } catch { return false; } })();
  const squads = { league: clone(PRESET_SQUADS.league.intro.ships), dominion: clone(PRESET_SQUADS.dominion.intro.ships) };
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
    if (mode === 'hotseat') hotseatForm(body, app, squads);
    else hostForm(body, app, squads);
  };
  render();
}

function optionsBlock() {
  return `<label class="check"><input type="checkbox" data-obst checked> Asteroid field (6 obstacles, placed alternately)</label>`;
}

function hotseatForm(body, app, squads) {
  body.innerHTML = `
    <div class="two">
      <div><label>League player <input data-name="league" value="Player 1"></label><div data-sb="league"></div></div>
      <div><label>Dominion player <input data-name="dominion" value="Player 2"></label><div data-sb="dominion"></div></div>
    </div>
    ${optionsBlock()}
    <button class="btn primary wide" data-start>Start battle</button>
    <p class="err" data-err></p>`;
  for (const f of ['league', 'dominion']) mountSquadBuilder(body.querySelector(`[data-sb="${f}"]`), { faction: f, squad: squads[f] });
  body.querySelector('[data-start]').onclick = async () => {
    const errs = [...validateSquad('league', squads.league, 100), ...validateSquad('dominion', squads.dominion, 100)];
    if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
    const t = new LocalTransport('hotseat'); t.clear();
    await t.append({ kind: 'host', faction: 'league', name: body.querySelector('[data-name="league"]').value || 'League', squad: squads.league, obstacles: body.querySelector('[data-obst]').checked, seed: randomSeed() });
    await t.append({ kind: 'join', name: body.querySelector('[data-name="dominion"]').value || 'Dominion', squad: squads.dominion });
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

function hostForm(body, app, squads) {
  if (!FIREBASE_CONFIG) return needFirebase(body);
  let faction = 'league';
  const render = () => {
    body.innerHTML = `
      <label>Your name <input data-name value="${esc(store.get('va-name') || 'Host')}"></label>
      <div class="tabs small">${Object.values(FACTIONS).map(f => `<button class="tab ${faction === f.id ? 'on' : ''}" data-f="${f.id}" style="--fc:${f.color}">${f.name}</button>`).join('')}</div>
      <div data-sb></div>
      ${optionsBlock()}
      <button class="btn primary wide" data-host>Create game & get invite link</button>
      <p class="err" data-err></p>`;
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { faction = b.dataset.f; render(); });
    mountSquadBuilder(body.querySelector('[data-sb]'), { faction, squad: squads[faction] });
    body.querySelector('[data-host]').onclick = async () => {
      const errs = validateSquad(faction, squads[faction], 100);
      if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
      const name = body.querySelector('[data-name]').value || 'Host';
      store.set('va-name', name);
      try {
        const db = await connectFirebase(FIREBASE_CONFIG);
        const code = newCode();
        const t = new FirebaseTransport(db, code);
        await t.append({ kind: 'host', faction, name, squad: squads[faction], obstacles: body.querySelector('[data-obst]').checked, seed: randomSeed() });
        store.set(`va-role-${code}`, faction);
        history.replaceState(null, '', `?game=${code}`);
        app.start(t, faction);
      } catch (e) { body.querySelector('[data-err]').textContent = 'Could not reach Firebase: ' + e.message; }
    };
  };
  render();
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
  const faction = host.faction === 'league' ? 'dominion' : 'league';
  const squad = clone(PRESET_SQUADS[faction].intro.ships);
  body.innerHTML = `
    <p><b>${esc(host.name)}</b> invites you to fly for the <b style="color:${FACTIONS[faction].color}">${FACTIONS[faction].name}</b>${host.obstacles ? ' in an asteroid field' : ''}.</p>
    <label>Your name <input data-name value="${esc(store.get('va-name') || 'Guest')}"></label>
    <div data-sb></div>
    <button class="btn primary wide" data-join>Join battle</button><p class="err" data-err></p>`;
  mountSquadBuilder(body.querySelector('[data-sb]'), { faction, squad });
  body.querySelector('[data-join]').onclick = async () => {
    const errs = validateSquad(faction, squad, 100);
    if (errs.length) { body.querySelector('[data-err]').textContent = errs[0]; return; }
    const name = body.querySelector('[data-name]').value || 'Guest';
    store.set('va-name', name);
    const t = new FirebaseTransport(db, code);
    await t.append({ kind: 'join', name, squad });
    store.set(`va-role-${code}`, faction);
    app.start(t, faction);
  };
}
