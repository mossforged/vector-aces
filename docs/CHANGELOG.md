# Changelog

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
