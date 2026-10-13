# Changelog

## 2026-10-13 — v0.7 large ships + card previews
- New "large" batch: 13 large ships (80 mm bases) for all three factions — Hauler, Lantern, Heron, Drifter, Bastille, Mandible, Hulk, Hearth, Leaper, Prowler, Raven, Pelican, Thunderhead — with 65 pilots, 31 upgrades (large-only mods, systems, illicit, titles) and the “Shaken” condition; original art and 5 presets.
- Mechanics: large bases everywhere (moves, rolls, bomb drops, rendering, bot), the Prowler's rotating mobile arc (Rotate Arc action), docking (Mothership + Lifeboat: launch from the carrier's rear, rear arc while docked, emergency launch), reserve ships (Hound's Lair's Pup Pilot, hidden from the squad builder), shared pilot abilities (Hunter Network), ship obstruction (Screen Jammer), Segnor's loop on a turn template, a persistent cargo cloud token. New hooks: `arcs`, `anyLockTargets`, `anyStress`, `rerollCap`, `preventDestroy`, flags `noPrimary`, `obstructs`, `friendReach`.
- Hovering a “card ↗” link (original-names toggle on) pops up the card: our name, cost and text beside the original card image.

## 2026-10-13 — v0.6 every first-edition small ship
- All three content batches are in: 24 new ships (36 in total), 168 new pilots, 209 new upgrades and 9 condition cards across the League, Dominion and Syndicate (details below).
- Shared engine work for them: slot-granting / slot-removing / discounting upgrades, an attacker-modifies-defense-dice step, many new card hooks (see `engine/hooks.js`), on-destroyed effects, hull bonuses.

## 2026-10-13 — syndicate content batch
- 7 ships (Adder, Gnat, Raptor, Bloodhound, Warden, Hopper, Gharial), 55 pilots (incl. Hammerhead pilots), 71 upgrades (crew, illicit, salvaged drones, modifications, Syndicate titles), 2 conditions; original art and 4 presets.
- Engine: hull bonuses (`stat` 'hull'), `onDestroyed` / `anyDestroyed` / `anyDamaged` / `anyActivate` / `onLocked` / `afterDecloak` hooks, `takeFaceup` / `dealFaceup`, `ignoreBomb`, `bombRoll`, `longDrop`, front bomb drops, `deploySkill`. Upgrade data: `grantsOneOf`, `discount: { slot: '*' }`, `shieldValue`, `needsAction`, `needsSlots`, `requiresUpgrade`.

## 2026-10-13 — dominion content batch
- 10 ships (Specter, Maul, Vespid, Stiletto, Gadfly, Harrier, Scorpion, Starling, Nightjar, Reaver), 66 pilots, 70 upgrades (elite, system, tech, Dominion crew, titles/mods), 5 conditions; original art and 3 presets.
- Engine: attacker-modifies-defense-dice stage (`atkOnDefense`); `afterRollForced` now called on every ship's cards; fold hooks `denyTokens`, `blockMods`, `lockCostWaived`; watch hooks `combatActive`, `anySpendFocus`; flags `stressedAction`, `delayStress`, `phaseRocks`, `launchBombs`; `decloakPositions` and `afterDrop`; weapon `noAttackMods`. Upgrade data: `removes`, `discount`, `maxHull`, `maxAgility` (`entryPoints()` prices a ship with discounts).
- Card simulation gives every card the random games missed a game of its own, so the "every card drafted" check stays reliable as content grows.

## 2026-10-13 — league content batch
- 7 ships (Pavise, Saber, Skiff, Longbow, Ironwood, Hammerhead, Tern), 47 pilots, 68 upgrades (drones, torpedoes, missiles, cannons, turrets, League crew, titles/mods), 2 conditions; original art and 3 presets.
- Engine additions shared by all batches: upgrades can grant slots (`grants`, `minSkill`, `noSlot`; `slotsFor()` used by validation, builder and random squads); off-dial maneuvers; new hooks `startActivation`, `anyManeuver`, `anyAction`, `boostTemplates`, `lockTargets`, `turretWeapon`, `redWhileStressed`, `attackOnObstacle`, `bombDetonates`, `onDetonate`; weapon `replaceDamage` / `onlyFocusMods`; `round.noTokenMods`. "Attack (focus)" now only spends the focus when the card says so.
- Rebuilt every gen file so new titles add Title slots to base ships (Bulwark, Dart, Wasp).

## 2026-10-13 — v0.5 AI games & production value
- *Vs computer* and *Watch AI battle* lobby modes; pause and 1×/2×/4× playback from the top bar. Smarter bot dials (lines up shots, avoids rocks and red moves while stressed).
- Ships always fly their whole path: one shared playback timeline for the table and dice; long backlogs speed up instead of skipping. The next decision waits until the table catches up.
- Effects: faction-coloured laser volleys, ion bolts with crackle, cannon slugs, missiles and torpedoes with smoke trails, hit sparks, shield flashes, critical fires, debris explosions, bomb drops and shockwaves, cloak shimmer, engine trails.
- "card ↗" links to the original card images on GitHub (shown while the original-names toggle is on).

## 2026-10-12 — v0.4 foundation for every small ship
- Seats and factions split: each player picks any faction (mirror matches allowed); faction now belongs to pilots. New third faction: Freeport Syndicate (ships arrive in its batch).
- "Original names" toggle (top bar / lobby / key N): swaps every name on your screen for the original game's, per viewer.
- New maneuvers (loop, Tallon roll, reverse, stationary), arcs (rear, 180°, turret, bullseye), actions (SLAM, cloak/decloak, reload, jam, coordinate, reinforce), tractor beams, condition-card framework.
- Bombs and mines on the board with drop/detonation; all 8 bomb/mine upgrades (bomb slots now usable).
- Content split into per-batch files (catalog, generated data, cards, art, presets) so the three remaining batches can be done in parallel chats.

## 2026-10-12 — v0.3 stage-1 ship import
- Importer (`tools/xwing-import`) builds ship/pilot/upgrade data from the community first-edition dataset with our own names and wording.
- 12 small ships, 57 pilots, 59 upgrades; new art for 10 ships; squad builder grouped by ship with filtered upgrade menus and a Random button.
- Card hook system (`engine/hooks.js`, `engine/cards/*`) replaces abilities.js; new mechanics: boost, ion, turrets, secondary-weapon costs, bonus/second attacks, start-of-combat and end-phase effects, skill overrides.
- Tests: focused mechanics tests and a 250-game random-squad simulation that drafts every card.

## 2026-10-12 — v0.2 isometric table
- Board is now a rotatable, tiltable isometric 3D view (drag, wheel zoom, right-drag pan, 3D/Top buttons); ships float on pegs, asteroids are extruded rocks, laser bolts and explosions.
- Animated dice mat on the board for every roll, reroll and modifier, with the result; modify-dice prompts wait until dice land.
- Hover card on ships: stats, hull/shield bars, condition, crits with text, tokens, locks, status warnings, upgrades.
- Engine: dice events now carry full dice details; all single-die rolls emit a `roll` event with a reason.

## 2026-10-12 — v0.1 first playable
- Full core rules engine (deterministic, prompt-driven), 33-card damage deck, obstacles, simultaneous fire.
- Original theme: League (Lancer) vs Dominion (Wasp); 10 pilots, 5 upgrades, presets.
- Canvas table with animated moves, arcs, range lines; dial picker; ship cards; dice tray; log.
- Same-screen play with hand-off screens; online play via Firebase with commit/reveal secret dials.
- Tests: geometry, rules, 500 simulated games, 20 two-client sync games.
