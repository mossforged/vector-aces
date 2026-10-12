# Architecture

```
  ┌──────────── src/ui ─────────────┐      ┌──── src/render ────┐
  │ lobby · prompt panel · dials ·  │      │ BoardView (canvas)  │
  │ ship cards · dice tray · log    │      │ shipArt standees    │
  └───────▲───────────────┬─────────┘      └─────────▲──────────┘
          │ state (read)  │ actions                  │ state + events
          │               ▼                          │
  ┌───────┴──────── src/net/session.js ──────────────┴───────┐
  │ ordered log  ──replay──▶  engine.applyAction  ──▶ state   │
  │ commit/reveal for secret dials                           │
  └───────▲───────────────────────────────────────┬──────────┘
          │ append / subscribe                    │
  ┌───────┴──── transports.js ────────────────────▼──────────┐
  │ LocalTransport (hotseat, localStorage)                    │
  │ FirebaseTransport (numbered entries, claimed by txn)      │
  └───────────────────────────────────────────────────────────┘
```

## 1. Engine (src/engine) — the rules

`newGame(opts)` builds the initial state; `applyAction(state, action)` returns `{ state, error }`
and never mutates its input (it `structuredClone`s first). An action that breaks a rule returns the
old state plus an error message, so a bad network message can't corrupt anyone's game.

### The step/prompt VM (flow.js)
The whole round structure is a queue of **steps** (`state.queue`). `advance()` pops steps and runs
their handlers until one of them needs a decision, which it expresses as a **prompt**:

```js
state.prompt = {
  player: 'league', kind: 'declareAttack', ship: 's1', text: '…',
  options: [{ id: 's4|primary', label: '…', target: 's4' }, { id: 'hold', label: 'Hold fire' }],
  onChoose: 'declareAttack', data: { ship: 's1' },
}
```

The player answers with `{ type: 'CHOOSE', player, choice: 's4|primary' }`; the engine runs
`CHOICES.declareAttack(state, data, choice)`, which usually `push`es more steps, then `advance()`s
again. Planning is the one prompt with `players: [...]` (both at once) answered by `SUBMIT_DIALS`.

Steps and choices are registered per module (`export const steps = {…}; export const choices = {…}`)
in `engine/index.js`. To add a new phase or sub-sequence, add steps in a new module and register it.

Round flow (step names):
`startRound` → planning prompt → `activationPhase` → `activate` ×N (→ before-reveal card steps →
`reveal` → on-reveal card steps → `stressCheck` → `move` → obstacle/after-maneuver steps →
`actionStep` → `afterAction`) → `combatPhase` (start-of-combat card steps) → `combatOrder` →
`attackStep` ×N → [attack sequence] → `finishCombat` → `endPhase` (end-phase card steps) →
`endCleanup` → `startRound` …

Attack sequence: `atkStage preRoll` → `rollAttack` → `atkStage afterRoll` → `atkStage defOnAttack`
→ `atkStage attack` → `rollDefense` → `atkStage defense` → `compareAttack` → `atkStage onHit` →
`dealDamage` → `afterAttack` (card steps such as bonus attacks, second volleys, splash damage).
Each `atkStage` gathers options from core rules, the weapon card and every card owned by the
deciding player's ships, and prompts until Done.

A generic `pick` prompt (`flow.pick`) lets cards ask "which ship?" / "use this?" and continue with
a card step (`cardStep(cardId, name, data)` → registered as `card:<id>:<name>`).

### Prompt kinds the UI must handle
| kind | who | notes |
|---|---|---|
| `placeObstacle` | alternate | option `auto`, or CHOOSE `place` with payload `{x,y,rot}` |
| `deploy` | ship owner | option `auto`, or `place` with `{x,y,h}` |
| `planning` | both | answered with SUBMIT_DIALS |
| `overrideManeuver` | opponent | stressed ship revealed red; options carry `maneuver` |
| `action` | owner | ids: focus, evade, lock, roll, boost, card action ids, repair:<card>, pass |
| `lockTarget` | owner | options carry `target` |
| `rollPosition` | owner | barrel roll / boost destinations; options carry `pose` |
| `declareAttack` | attacker | ids `<shipId>|<weapon>[|f]` + `hold`; options carry `target`, `weapon` |
| `attackPrep` / `modAttack` / `modAttackDef` / `modDefense` / `onHit` | see attack sequence | repeatable until `done`; dice live in `state.attack` |
| `pick` | varies | card choices; options may carry `target` or `pose`; usually has `skip` |

Unknown kinds render as generic buttons, so new prompt kinds work in the UI without UI changes.

### Where rules live
- Geometry (mm): `geometry.js` (polygon overlap, distance, arc clipping, range bands), `maneuvers.js`
  (template paths parameterised by arc length → used for final pose, bump back-off and animation).
- Modifiers from damage cards: `queries.stat()`, `queries.maneuverColor()`, `damage.resolveFaceup()`.
- Pilot/upgrade abilities: one object per card in `cards/*.js`, plugged in through the hooks listed
  at the top of `hooks.js` (stat changes, dice options, compare rules, event and phase steps,
  card actions). Weapon effects live under `weapon:` and are looked up by `a.weapon`, so they work
  after the card is discarded to fire.
- Token changes that other cards react to go through `effects.js` (`addStress`, `spendFocus`,
  `spendLock`, `acquireLock`).
- Ion: `ship.ion` > 0 → no dial, forced white 1-straight, tokens cleared after moving.
- Simultaneous fire: ships destroyed by an equal-skill attacker get `pendingDestroy` and are removed
  when combat moves to a lower skill (`resolvePendingDestroys`).

### Players, factions, content model
Seats `p1` (bottom edge, host) and `p2` (top edge, guest); `state.players[p] = { faction, name,
colour, arcColor, edge, points }` (mirror matches get the faction's alt colour for p2). Faction
belongs to the **pilot** (a chassis can fly for several factions); upgrades may restrict faction,
ships or base size. Initiative: lower points; ties → the Dominion player, else random.

### Movement, arcs, actions (first-edition set)
- Bearings: straight, bank, turn, K-turn, Segnor's loop (SL/SR), Tallon roll (TRL/TRR), reverse
  (RBL/RS/RBR), stationary (ST). `maneuvers.buildPath` = basic template + optional end rotation;
  a bumped loop/roll/K-turn drops the rotation.
- Arcs per chassis: front, rear (auxiliary), front180, turret (primary in any direction), bullseye.
  Primary attacks use whichever arc gives the shortest range; secondary weapons use the front arc
  unless they are turrets. `Q.inArc` = any arc, `Q.inFrontArc`, `Q.inBullseye`.
- Actions: focus, lock, roll, boost, evade, SLAM (second same-speed maneuver, then weapons
  disabled), cloak (+2 agility, no attacks; decloak at the start of Activation), reload (restore a
  torpedo/missile, weapons disabled), jam (≤2 tokens; each cancels the next focus/evade/lock),
  coordinate (free action for a friend at Range 1–2), reinforce (fore/aft: −1 hit from that side).
- Ship tokens: stress, ion, cloaked, jam, tractor (−1 agility; attacker may drag a small ship),
  disarmed (weapons disabled). Jam/tractor/disarmed clear in the End phase.
- Ordnance (`engine/ordnance.js`): tokens in `state.ordnance`, dropped behind the ship with the
  1-straight template. Bombs detonate at the end of Activation (every ship at Range 1); mines
  detonate when a ship's base or template overlaps them (after moves, boosts, rolls, decloaks,
  tractor drags). Token look and effects: `data/ordnance.js` + `EFFECTS` in engine/ordnance.js.
- Condition cards: `ship.conditions = [{ id, from }]`; `hooks.cardsOf` includes them, so a
  condition is just a card object with hooks.

## 2. Net (src/net) — one ordered log
Nothing but **messages** travel between players; each client rebuilds the state by replaying the log
through the engine. That makes refresh/reconnect free (replay the log) and keeps the protocol tiny.

Log entries: `host` (seed, squad, options) · `join` (guest squad) · `action` · `commit` · `chat`.

**Secret dials:** online, `session.act(SUBMIT_DIALS)` first appends a `commit` (hash of dials+salt,
salt kept locally and in localStorage). When the log contains commits from both players for the
round, each client appends its real `SUBMIT_DIALS` (+salt). Clients drop a reveal that doesn't match
its commit. Dials therefore never appear in the shared log until both are locked in.

**Ordering:** FirebaseTransport writes entry *n* under key `000n` with a transaction that only
succeeds if the slot is empty; losers retry at *n+1*. Every client therefore sees the same order.

Hotseat uses the same Session with `me = 'both'` (no commit step; the UI does a "pass the device"
screen instead).

## 3. Render (src/render)
`camera.js` is an orthographic "isometric" camera. Because the table is flat, tilt + rotation of
the ground plane is a single 2D affine matrix, so everything on the table (mat, zones, arcs,
templates, bases, range lines) is still drawn in table millimetres with
`ctx.setTransform(...camera.matrix())`. Things above the table use `camera.matrix(liftMm)` or
`camera.project(x, y, liftMm)`: asteroids are extruded slices, ships are flat minis floating on a
peg `FLY` mm above their base, labels are drawn upright in screen space. Tall objects are sorted
back-to-front by projected depth. Input: drag rotates/tilts, wheel zooms about the cursor,
right/shift-drag pans; `camera.unproject` turns clicks back into table coordinates.

`BoardView` animates `move` events along the sampled template path, and shows hit/shield/crit
rings, laser bolts and explosions from `damage`/`shield`/`attackResult`/`destroyed` events.
Ship art is a function per `art` key in `shipArt.js`; set `IMAGE_OVERRIDES[key] = 'assets/x.png'`
to use a picture instead (standee approach — one image, moved and rotated).

## 4. UI (src/ui)
`names.js` implements the "original names" toggle: a MutationObserver swaps themed names for the
original ones in every text node and title as panels render (and restores them when switched
off); canvas text goes through `label()`. Per viewer, stored in localStorage; shortcut N.

`diceRoller.js` turns `attackDice`/`defenseDice`/`attackResult`/`roll` events into the on-board
dice mat (tumble on roll and reroll, flash on change, drop-in for added dice). It keeps a timeline
`cursor`; app.js holds back modify-dice prompts until the dice have landed. `shipTooltip.js`
renders the hover card from the same `Q.*` queries as the ship cards.

`app.js` subscribes to the Session and re-renders panels on every change. Each panel is a function
`render(el, {...})` that rewrites its container — simple, stateless, and easy to restyle. Transient
UI state (selected ship, draft dials, hotseat hand-off) lives in `app.ui`.

## Adding things — recipes
- **Pilot / upgrade / ship from the dataset**: `tools/xwing-import/README.md` (catalog entry → build
  → card in `engine/cards/*` → art for new ships).
- **Original content**: add it to `CUSTOM_SHIPS` / `CUSTOM_PILOTS` / `CUSTOM_UPGRADES` in the
  `src/data/*.js` wrappers (same shape as the generated entries), then a card as above.
- **New card behaviour**: copy the closest existing card in `engine/cards/*` — most are 3–10 lines.
  Every option must mark itself used (`mark(a, key)`) so the prompt can't loop.
- **New damage card**: `data/damageDeck.js`; immediate effects in `damage.resolveFaceup`, ongoing
  ones in `queries.js` or the step that checks them.
- **Missions**: see WORKSTREAMS.md → Missions.
