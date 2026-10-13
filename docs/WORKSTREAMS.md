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

## A. Content batches (all first-edition small ships)
Done: **base** (12 ships of waves 1–4, 57 pilots, 67 upgrades incl. all bombs/mines) and the
**foundation** mechanics every remaining small ship needs (new maneuvers, auxiliary / turret /
bullseye arcs, SLAM, cloak & decloak, reload, jam, coordinate, reinforce, tractor beams, bombs &
mines, condition cards, the Syndicate faction, per-pilot factions).

**All three batches are done (v0.6); a fourth batch, `large`, adds every large ship for all factions (v0.7).** The table below is kept as a map of which files hold what; new
small-ship content (e.g. later printings) goes into the batch that owns its faction.

| Batch | New ships (dataset ship ids) | Pilots | Also owns (faction-neutral upgrades, by slot) |
|---|---|---|---|
| `dominion` | TIE Phantom (16), TIE Punisher (29), TIE/fo (31), TIE Adv. Prototype (36), TIE/sf (39), TIE Striker (44), TIE Aggressor (48), Alpha-class Star Wing (50), TIE Silencer (53), TIE Reaper (55) — plus new pilots for Wasp, Hornet, Talon, Beetle, Mantis | 66 (42 abilities) | Elite, System, Tech |
| `league` | K-wing (28), T-70 (30), Attack Shuttle (33), ARC-170 (38), Auzituck Gunship (47), Scurrg H-6 (49, chassis shared with Syndicate), Sheathipede Shuttle (52) — plus new pilots for Lancer, Dart, Halberd and a League pilot for the Wasp | 47 (40 abilities) | Drone (Astromech), Torpedo, Missile, Cannon, Turret |
| `syndicate` | StarViper (21), M3-A (22), Kihraxz (27), G-1A (35), Protectorate Starfighter (40), Quadjumper (43), Kimogila (51) — plus Syndicate pilots for Bulwark, Courier, Sparrow and the Scurrg H-6 | 56 (34 abilities) | Crew, Illicit, Salvaged Drone, Modification |

Each batch also owns: its faction's restricted upgrades, titles/modifications restricted to its
ships, and any condition cards its cards hand out. Upgrades for large/huge ships only are skipped.
Scurrg H-6: the `league` batch adds the chassis (SHIPS entry + art); `syndicate` only adds pilots
for it (ship ids are global across batches, so its pilots resolve as soon as both are merged — if
running in parallel, `syndicate` can add the Scurrg chassis temporarily and drop it at merge).

**Files a batch owns** (nobody else edits them):
`tools/xwing-import/catalog/<batch>.js` · `src/data/gen/<batch>.js` (generated) ·
`src/engine/cards/<batch>.js` · `src/render/art/<batch>.js` · `src/data/presets/<batch>.js` ·
`tests/batch-<batch>.mjs` (create it; import it at the end of `tests/run.mjs` — the one shared line).

**Read only these:** `CONTEXT.md`, this section, `tools/xwing-import/README.md`,
`tools/xwing-import/catalog/base.js` (for the entry shapes), the header of `src/engine/hooks.js`,
`src/engine/effects.js`, and `src/engine/cards/pilots.js` + `gear.js` as examples. Open other
engine files only if a card needs a hook that doesn't exist yet.

**Steps**
1. `git clone --depth 1 https://github.com/guidokessels/xwing-data /tmp/xwing-data`, then list the
   batch's ships, pilots (by dataset pilot id; the full lists are below) and upgrades by reading
   the dataset JSON.
2. Add catalog entries with original names and our own wording (no franchise names or card text).
3. `node tools/xwing-import/build.mjs /tmp/xwing-data <batch>`.
4. Implement every ability in `src/engine/cards/<batch>.js`. If a card needs a mechanic the engine
   lacks, add the smallest general hook to `hooks.js` and note it in `docs/CHANGELOG.md`; if it's
   too fiddly, implement the closest faithful version and list it in `docs/RULES_COVERAGE.md`.
5. Art for each new ship in `src/render/art/<batch>.js` (original silhouettes, distinct at a glance).
6. Two or three presets. Tests in `tests/batch-<batch>.mjs` for the trickiest cards; the existing
   random-squad simulation will draft every new card automatically.
7. `node tests/run.mjs` green → CHANGELOG + RULES_COVERAGE → commit.

**Dataset pilot ids per batch**
- dominion: 57,58,59,60,61,75,76,77,78,120,128,129,130,142,143,144,145,148,149,150,151,152,153,154,163,165,166,167,168,170,171,177,178,180,181,187,190,191,192,193,199,204,205,212,218,235,236,237,239,240,248,250,251,252,265,268,270,271,272,281,283,284,286,290,291,292
- league: 81,82,83,84,85,86,87,88,139,140,141,147,155,156,157,158,159,169,174,175,176,179,194,196,201,202,203,214,221,222,223,225,226,241,249,254,255,257,259,267,275,276,277,285,289,293,294
- syndicate: 98,101,102,107,108,109,110,111,112,114,115,116,117,118,119,121,122,125,126,127,134,135,136,137,138,162,182,188,189,197,206,207,208,209,210,216,233,234,242,243,244,245,246,247,253,256,258,260,261,262,263,264,266,273,274,282

**Starter prompt** (attach the repo, replace `<batch>`):
> Vector Aces repo. Read `CONTEXT.md`, then only "A. Content batches" in `docs/WORKSTREAMS.md`
> and the files it lists. Do the `<batch>` batch: import its ships, pilots and upgrades with
> original names and wording, implement every card, add ship art, presets and tests. Only edit the
> files that batch owns (plus one import line in tests/run.mjs). Keep `node tests/run.mjs` green.

**Retheme any time:** names/text in the catalog files, colours/blurbs in `src/data/factions.js`,
art in `src/render/shipArt.js` + `src/render/art/*`.

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
- **Read:** `src/render/camera.js` (projection math), `src/render/board.js`, `src/render/shipArt.js`, `src/data/factions.js`
- **Interface:** `BoardView` public methods (`setState`, `setViewer`, `setHighlight`, `setPlacement`,
  `setSelected`) and engine events (`move`, `destroyed`, `damage`, `shield`, `attackResult`, `lock`,
  `reveal`, `roll`, `attackDice`, `defenseDice`).
- **Standees:** drop top-down PNGs in `assets/` and set `IMAGE_OVERRIDES` in `shipArt.js`.
- **Effects:** `src/render/fx.js` (projectiles, impacts, particles) + `render/timeline.js` (playback order).
- **Ideas:** show the executed template briefly after each move, range-ruler drag tool,
  sound effects synced to fx, background image, upright standee images, a Three.js renderer
  that implements the same BoardView API (the camera/board split makes that a drop-in swap).

## E. Panels & UX
Lobby, dial picker, ship cards, dice tray, log, help, mobile layout.
- **Read:** `src/ui/app.js` + the one panel you're changing, `css/main.css`
- **Interface:** panels are `render(el, {state, ...})` functions; they read state through `Q.*`.
- **Also owns:** `diceRoller.js` (on-board dice), `shipTooltip.js` (hover card).
- **Ideas:** sound effects, "your turn" browser notification/tab title,
  keyboard shortcuts, card art, a proper rules screen, chat box (session already supports `chat`).

## F. Online & hosting
- **Read:** `src/net/session.js`, `src/net/transports.js`, `docs/ONLINE.md`
- **Interface:** transport = `{ id, append(msg), subscribe(cb), close() }`; log message kinds.
- **Ideas:** presence ("opponent connected"), rematch button reusing squads, game list per player,
  desync detector (hash state every round and compare), a PeerJS transport (no Firebase needed).

## G. Computer opponent
- **Read:** `src/ai/simpleBot.js`, `src/engine/index.js` (API), `src/engine/queries.js`
- **Interface:** `botAction(state, player) → action`; `app.js` autopilot drives bot seats (lobby modes
  *Vs computer* and *Watch AI battle*).
- **Ideas:** predict enemy moves, smarter action/target choice (lock the target you'll shoot,
  evade when in many arcs), difficulty levels, choose upgrade-specific options.

## H. Squad building
- **Read:** `src/ui/squadBuilder.js`, `src/data/presets.js`, `engine/setup.js` (`validateSquad`, `squadPoints`)
- **Ideas:** save/load squads in localStorage, share squad codes, point-limit selector.

## I. Team play (3–4 players)
- **Read:** `src/engine/setup.js`, `src/net/session.js`, `src/ui/lobby.js`
- **Needs:** ships owned by individual players while factions stay two sides (add `controller` to
  ships, keep `owner` = side), planning per controller, lobby seats.
