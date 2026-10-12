// The "what happens now" panel: renders state.prompt as buttons (or the dial picker),
// and tells the board what to highlight while the player hovers an option.
import { FACTIONS } from '../data/factions.js';
import { dialFor } from '../data/ships.js';
import { Q, G, buildPath, waitingOn, deployZone } from '../engine/index.js';
import { renderDialPicker } from './dialPicker.js';
import { maneuverIcon, maneuverLabel, esc } from './glyphs.js';

export function renderPrompt(el, app) {
  const { state: st, session, ui, board } = app;
  const p = st.prompt;
  board.setPlacement(null);
  board.setHighlight({});

  const err = session.error ? `<div class="err">${esc(session.error)}</div>` : '';

  if (st.winner) {
    el.innerHTML = `<div class="banner win" style="--fc:${FACTIONS[st.winner].color}">
      <h2>${esc(st.players[st.winner].name)} wins!</h2><p>${FACTIONS[st.winner].name} control the sector.</p>
      <button class="btn primary" data-new>New game</button></div>`;
    el.querySelector('[data-new]').onclick = () => app.backToLobby();
    return;
  }
  if (!p) { el.innerHTML = '<p class="muted">…</p>'; return; }

  // ---------------- planning ----------------
  if (p.kind === 'planning') {
    const mine = st.playerOrder.filter(pl => session.controls(pl) && !st.planning.submitted[pl] && !session.hasCommitted(pl)
      && Q.liveShips(st).some(s => s.owner === pl));
    if (!mine.length) {
      const waiting = waitingOn(st).filter(pl => !session.hasCommitted(pl)).map(pl => st.players[pl].name);
      el.innerHTML = `${err}<div class="phase-title">Planning</div><p>Your dials are locked in.</p><p class="muted">Waiting for ${esc(waiting.join(' & ') || 'reveal')}…</p>`;
      return;
    }
    const planner = mine[0];
    if (!session.online && ui.handoffFor !== planner) {
      el.innerHTML = `<div class="handoff" style="--fc:${FACTIONS[planner].color}">
        <div class="phase-title">Planning · Round ${st.round}</div>
        <h2>Pass to ${esc(st.players[planner].name)}</h2>
        <p>Everyone else, look away while ${esc(st.players[planner].name)} sets their dials.</p>
        <button class="btn primary wide" data-ready>I'm ${esc(st.players[planner].name)} — show my dials</button></div>`;
      el.querySelector('[data-ready]').onclick = () => { ui.handoffFor = planner; app.render(); };
      return;
    }
    const draft = (ui.drafts[planner] ||= {});
    const ships = Q.liveShips(st).filter(s => s.owner === planner);
    el.innerHTML = `${err}<div class="phase-title" style="--fc:${FACTIONS[planner].color}">Planning · Round ${st.round} · ${esc(st.players[planner].name)}</div><div data-dials></div>`;
    renderDialPicker(el.querySelector('[data-dials]'), {
      state: st, ships, draft,
      onChange: () => app.render(),
      onFocusShip: id => { app.select(id, false); },
      onLock: () => {
        const dials = { ...draft };
        delete ui.drafts[planner]; ui.handoffFor = null;
        app.act({ type: 'SUBMIT_DIALS', player: planner, dials });
      },
    });
    return;
  }

  // ---------------- someone else's decision ----------------
  const who = st.players[p.player];
  if (!session.controls(p.player)) {
    el.innerHTML = `${err}<div class="phase-title">${phaseName(st)}</div><p class="muted">Waiting for <b style="color:${FACTIONS[p.player].color}">${esc(who.name)}</b>…</p><p class="muted small">${esc(p.text)}</p>`;
    board.setHighlight(p.ship ? { ships: [p.ship] } : {});
    return;
  }

  // ---------------- my decision ----------------
  const head = `${err}<div class="phase-title" style="--fc:${FACTIONS[p.player].color}">${phaseName(st)} · ${esc(who.name)}</div><p class="ptext">${esc(p.text)}</p>`;

  if (p.kind === 'deploy' || p.kind === 'placeObstacle') {
    const ship = p.ship ? st.ships[p.ship] : null;
    board.setPlacement(p.kind === 'deploy'
      ? { kind: 'deploy', ship, zone: deployZone(st, ship.owner), defaultHeading: st.players[ship.owner].edge === 'bottom' ? 0 : Math.PI }
      : { kind: 'obstacle', shape: p.data.shape });
    board.setHighlight({});
    el.innerHTML = `${head}<p class="hint">Click the table to place · Q / E (or shift+wheel) rotates.</p>
      <div class="opts">${p.options.map(o => `<button class="btn" data-o="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
    bindOptions(el, app, p);
    return;
  }

  el.innerHTML = `${head}<div class="opts ${p.kind}">${p.options.map(o => optionButton(st, p, o)).join('')}</div>`;
  bindOptions(el, app, p);
  board.setHighlight(p.ship ? { ships: [p.ship] } : {});
}

function optionButton(st, p, o) {
  if (p.kind === 'overrideManeuver') {
    const m = o.maneuver;
    return `<button class="btn mbtn" data-o="${o.id}" title="${maneuverLabel(m.key)}">${maneuverIcon(m.bearing, m.color)}<span>${m.speed}</span></button>`;
  }
  const cls = ['pass', 'done', 'hold'].includes(o.id) ? 'btn ghost' : 'btn';
  return `<button class="${cls}" data-o="${esc(o.id)}">${esc(o.label)}</button>`;
}

function bindOptions(el, app, p) {
  el.querySelectorAll('[data-o]').forEach(b => {
    const o = p.options.find(x => x.id === b.dataset.o);
    b.addEventListener('click', () => app.act({ type: 'CHOOSE', player: p.player, choice: o.id }));
    b.addEventListener('mouseenter', () => app.board.setHighlight(highlightFor(app.state, p, o)));
    b.addEventListener('mouseleave', () => app.board.setHighlight(p.ship ? { ships: [p.ship] } : {}));
  });
}

export function highlightFor(st, p, o) {
  const ship = p.ship && st.ships[p.ship];
  if (!ship) return {};
  if (o.target) {
    const t = st.ships[o.target];
    const g = p.kind === 'declareAttack' ? Q.attackGeometry(st, ship, t) : null;
    const line = g?.line || G.closestPoints(Q.shipPoly(ship), Q.shipPoly(t));
    return { ships: [ship.id, t.id], line };
  }
  if (o.pose) return { ships: [ship.id], poses: [o.pose] };
  if (p.kind === 'overrideManeuver' && o.maneuver) {
    const path = buildPath(ship.pose, dialFor(ship.chassis).find(m => m.key === o.id));
    return { ships: [ship.id], template: path.templatePoly, poses: [path.final] };
  }
  return { ships: [ship.id] };
}

export function phaseName(st) {
  return { obstacles: 'Setup · Obstacles', deploy: 'Setup · Deploy', planning: 'Planning', activation: 'Activation', combat: 'Combat', end: 'End' }[st.phase] || st.phase;
}
