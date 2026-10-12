# Workstreams — split the project across separate chats

Each workstream owns a small set of files and talks to the rest through a stable interface, so a
chat only needs to read `CONTEXT.md` + its section below + the listed files. Two chats can work in
parallel as long as they don't own the same files.

**Starter prompt template** (paste into a new chat, with the repo attached):
> Vector Aces repo. Read `CONTEXT.md`, then only the "<Workstream name>" section of
> `docs/WORKSTREAMS.md` and the files it lists. Task: <what you want>. Keep `node tests/run.mjs`
> green and add to `docs/CHANGELOG.md` when done.

Shared contracts nobody should break without updating this file:
- Engine API in `src/engine/index.js` (`newGame`, `applyAction`, `waitingOn`, `Q.*` queries).
- Prompt shape and prompt kinds (table in ARCHITECTURE.md §1).
- Log message kinds in `src/net/session.js`.
- Data shapes in `src/data/*` (fields documented at the top of each file).

---

## A. Content & retheme
Add ships, pilots, upgrades, damage cards, presets; rename factions / restyle the setting.
- **Read:** `src/data/*` (all small), `src/engine/abilities.js`
- **Maybe touch:** `src/engine/actions.js` (new action types), `src/render/shipArt.js` (art for a new ship)
- **Interface:** data shapes; ability ids handled in `abilities.js` hooks.
- **Ideas:** a third chassis per faction (heavy bomber with a turret arc → needs `arc: 'turret'` support in
  `queries.attackGeometry`), more elite talents, retheme into another setting.

## B. Rules engine
Fix rules gaps and edge cases (see `docs/RULES_COVERAGE.md` ◐/⬜ items).
- **Read:** `docs/RULES_COVERAGE.md`, `src/engine/flow.js`, then only the module the rule lives in
  (activation / actions / combat / damage / geometry / maneuvers).
- **Interface:** must stay deterministic; prompt kinds/options documented in ARCHITECTURE.md.
- **Always** add a focused test in `tests/run.mjs`.
- **Ideas:** pick-your-own reroll dice (needs a multi-select prompt kind), same-skill activation order
  chosen by the player, continuous barrel-roll placement.

## C. Missions (the rulebook's three scenarios, then your own)
- **Read:** `src/engine/setup.js` (createGame + deploy), `src/engine/damage.js` (`checkVictory`),
  `src/engine/flow.js`.
- **Create:** `src/data/missions.js` (setup rules, special tokens, objectives as data),
  `src/engine/missions.js` (steps: reinforcements in End phase, custom victory, scan/protect actions).
- **Hook points to add:** `createGame(opts.mission)` → mission setup steps instead of normal deploy;
  `checkVictory` → ask the mission first; `endPhase` → mission end-of-round step.
- **UI:** a mission picker in `src/ui/lobby.js`; mission tokens drawn in `src/render/board.js`.
- Escort (shuttle that moves itself, protect action), Asteroid Run (round tracker, disabled ship),
  Dark Whispers (satellites, scan instead of attack, flee off edge).

## D. Board look & animation
Make the table prettier: art, effects, camera, readability.
- **Read:** `src/render/board.js`, `src/render/shipArt.js`, `src/data/factions.js`
- **Interface:** `BoardView` public methods (`setState`, `setViewer`, `setHighlight`, `setPlacement`,
  `setSelected`) and engine events (`move`, `destroyed`, `damage`, `shield`, `attackResult`, `lock`,
  `reveal`, `roll`, `attackDice`, `defenseDice`).
- **Standees:** drop top-down PNGs in `assets/` and set `IMAGE_OVERRIDES` in `shipArt.js`.
- **Ideas:** zoom/pan, show the executed template briefly after each move, range-ruler drag tool,
  engine trails, explosion sprite, nebula background image.

## E. Panels & UX
Lobby, dial picker, ship cards, dice tray, log, help, mobile layout.
- **Read:** `src/ui/app.js` + the one panel you're changing, `css/main.css`
- **Interface:** panels are `render(el, {state, ...})` functions; they read state through `Q.*`.
- **Ideas:** animated dice rolls, sound effects, "your turn" browser notification/tab title,
  keyboard shortcuts, card art, a proper rules screen, chat box (session already supports `chat`).

## F. Online & hosting
- **Read:** `src/net/session.js`, `src/net/transports.js`, `docs/ONLINE.md`
- **Interface:** transport = `{ id, append(msg), subscribe(cb), close() }`; log message kinds.
- **Ideas:** presence ("opponent connected"), rematch button reusing squads, game list per player,
  desync detector (hash state every round and compare), a PeerJS transport (no Firebase needed).

## G. Computer opponent
- **Read:** `src/ai/simpleBot.js`, `src/engine/index.js` (API), `src/engine/queries.js`
- **Interface:** `botAction(state, player) → action`. Plug in via a `BotTransport`-style wrapper or in
  `app.js` (when the prompt belongs to the bot's player, call `session.act(botAction(...))`).
- **Ideas:** score dials by simulating `buildPath` endpoints vs enemy arcs; avoid asteroids/edges.

## H. Squad building
- **Read:** `src/ui/squadBuilder.js`, `src/data/presets.js`, `engine/setup.js` (`validateSquad`, `squadPoints`)
- **Ideas:** save/load squads in localStorage, share squad codes, point-limit selector.

## I. Team play (3–4 players)
- **Read:** `src/engine/setup.js`, `src/net/session.js`, `src/ui/lobby.js`
- **Needs:** ships owned by individual players while factions stay two sides (add `controller` to
  ships, keep `owner` = side), planning per controller, lobby seats.
