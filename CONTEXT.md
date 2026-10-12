# Vector Aces — start here (for every new chat)

A two-player tactical starfighter dogfight game for the browser, implementing the core rules of a
2012 miniatures dogfighting game (secret maneuver dials, templates, range bands, firing arcs,
custom dice, stress, damage cards, obstacles, initiative) with an **original theme**: the Free
Colonies **League** vs the Ascendant **Dominion**. No build step — plain ES modules, served as
static files (GitHub Pages). Online play goes through Firebase Realtime Database.

**To save tokens, do not read the whole repo.** Read this file, then the section of
`docs/WORKSTREAMS.md` for the task at hand, and open only the files it lists.

## Layout (one line each)

```
index.html, css/main.css        page shell + all styles
src/data/      PURE DATA. factions, ships (stats + dials), pilots, upgrades, damage deck, presets, config (mm geometry)
src/engine/    PURE RULES. deterministic reducer; no DOM, no network. Public API = engine/index.js
  flow.js        step queue + prompts ("VM")          setup.js      create game, obstacles, deploy
  activation.js  planning/activation/end phases        actions.js    action menu + effects
  combat.js      attack sequence                       damage.js     damage cards, destroy, victory
  abilities.js   pilot/upgrade hooks                   queries.js    read-only helpers (UI uses these too)
  geometry.js    polygons, arcs, range                 maneuvers.js  template paths, barrel rolls
  dice.js, rng.js
src/render/    camera.js (isometric projection: rotate/tilt/zoom/pan), board.js (draws the table, minis on pegs, animation), shipArt.js (vector art / image overrides)
src/ui/        app.js (shell), lobby.js, squadBuilder.js, promptPanel.js, dialPicker.js, shipCards.js, shipTooltip.js (hover card),
               diceRoller.js (animated on-board dice), diceTray.js (sidebar record), logPanel.js, glyphs.js
src/net/       session.js (ordered log → engine, secret dials), transports.js (local + Firebase), firebaseConfig.js
src/ai/        simpleBot.js (test driver / future computer opponent)
tests/         run.mjs (engine + 500 simulated games), net.mjs (two clients stay in sync)
docs/          ARCHITECTURE.md, WORKSTREAMS.md, RULES_COVERAGE.md, ONLINE.md, CHANGELOG.md
```

## Ground rules
- Engine is **deterministic and pure**: all randomness via `state.rng`; never `Math.random()` or `Date` in src/engine. Both players replay the same action log, so any nondeterminism = desync.
- Engine state is plain JSON. Actions are plain JSON: `SUBMIT_DIALS`, `CHOOSE`, `CONCEDE`.
- UI/render only *read* state (via `Q.*` queries) and send actions. Never mutate state outside the engine.
- New content goes in `src/data/` first; behaviour for it goes in `src/engine/abilities.js` (pilots/upgrades) or `damage.js`/`queries.js` (damage cards).
- Rules text in the repo is our own wording; keep names/art original (no franchise names or ship designs).
- Units are millimetres on a 914 mm table; heading `h` in radians, 0 = facing the top edge, +h turns right.

## Commands
- Run tests: `node tests/run.mjs` (must stay green; add a test for every rules change)
- Play locally: `python3 -m http.server 8080` in the repo root → http://localhost:8080 (ES modules need a server, not file://)

## When you finish a task
Add 1–3 lines to `docs/CHANGELOG.md`, tick/adjust `docs/RULES_COVERAGE.md` if rules changed, and
update the file list above only if you add or rename files.
