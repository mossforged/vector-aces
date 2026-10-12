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
`startRound` → planning prompt → `activationPhase` → `activate` ×N → `move` → (`obstacleHit`,
`simpleDamage`, `rollForDamage`, `repairDrone`, `freeAction`) → `actionStep` → `combatPhase` →
`attackStep` ×N → (`rollAttack`, `modAttack`, `rollDefense`, `modDefense`, `resolveAttack`) →
`finishCombat` → `endPhase` → `startRound` …

### Prompt kinds the UI must handle
| kind | who | notes |
|---|---|---|
| `placeObstacle` | alternate | option `auto`, or CHOOSE `place` with payload `{x,y,rot}` |
| `deploy` | ship owner | option `auto`, or `place` with `{x,y,h}` |
| `planning` | both | answered with SUBMIT_DIALS |
| `overrideManeuver` | opponent | stressed ship revealed red; options carry `maneuver` |
| `action` | owner | ids: focus, evade, lock, roll, deflector_drone, deadeye, repair:<card>, pass |
| `lockTarget` | owner | options carry `target` |
| `rollPosition` | owner | options carry `pose` |
| `declareAttack` | attacker | ids `<shipId>|<weapon>` + `hold`; options carry `target`, `weapon` |
| `modAttack` / `modDefense` | attacker / defender | repeatable until `done`; dice live in `state.attack` |

Unknown kinds render as generic buttons, so new prompt kinds work in the UI without UI changes.

### Where rules live
- Geometry (mm): `geometry.js` (polygon overlap, distance, arc clipping, range bands), `maneuvers.js`
  (template paths parameterised by arc length → used for final pose, bump back-off and animation).
- Modifiers from damage cards: `queries.stat()`, `queries.maneuverColor()`, `damage.resolveFaceup()`.
- Pilot/upgrade abilities: `abilities.js` hooks (see header comment there).
- Simultaneous fire: ships destroyed by an equal-skill attacker get `pendingDestroy` and are removed
  when combat moves to a lower skill (`resolvePendingDestroys`).

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
`BoardView` draws in table millimetres (a transform maps to pixels and flips the table so the
viewer's edge is at the bottom). It animates `move` events along the sampled template path, and
shows hit/shield/crit flashes and laser lines from `damage`/`shield`/`attackResult` events.
Ship art is a function per `art` key in `shipArt.js`; set `IMAGE_OVERRIDES[key] = 'assets/x.png'`
to use a picture instead (standee approach — one image, moved and rotated).

## 4. UI (src/ui)
`app.js` subscribes to the Session and re-renders panels on every change. Each panel is a function
`render(el, {...})` that rewrites its container — simple, stateless, and easy to restyle. Transient
UI state (selected ship, draft dials, hotseat hand-off) lives in `app.ui`.

## Adding things — recipes
- **New pilot**: `data/pilots.js` entry (+ `ability` id) → handle the id in `engine/abilities.js` → test.
- **New upgrade**: `data/upgrades.js` (slot/cost/weapon/action) → if it's an action, add a label in
  `actions.ACTION_LABELS` and a case in `performAction`; if passive, a hook in `abilities.js`.
- **New ship**: `data/ships.js` (stats, actions, slots, dial) + art function in `render/shipArt.js`.
- **New damage card**: `data/damageDeck.js`; immediate effects in `damage.resolveFaceup`, ongoing
  ones in `queries.js` or the step that checks them.
- **Missions**: see WORKSTREAMS.md → Missions.
