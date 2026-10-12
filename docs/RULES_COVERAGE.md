# Rules coverage

Legend: ✅ implemented · ◐ simplified (note says how) · ⬜ not yet

## Setup
- ✅ Factions, friendly/enemy, fixed edges (League bottom, Dominion top)
- ✅ Squad building with point totals, unique names, upgrade slots (lobby enforces a 100-pt cap)
- ✅ Initiative: lower squad total; tie → Dominion
- ✅ Deploy in ascending pilot skill (initiative first on ties), entirely within Range 1 of own edge, any facing
- ✅ Shields set from ship stats; damage deck shuffled
- ✅ ID tags for duplicate generic pilots (#1, #2)
- ✅ Obstacles: 6 asteroids placed alternately (initiative player first), not within Range 1–2 of edges, no overlap
- ◐ Rebel-chooses-edge after obstacles: edges are fixed

## Round
- ✅ Planning: secret dials for every ship; hotseat hand-off screen; online commit/reveal
- ✅ Activation in ascending skill; initiative player's ships first on ties
- ◐ Same player, same skill: fixed squad order instead of player's choice
- ✅ Templates: straight 1–5, bank 1–3, turn 1–3, reverse (K) turn; exact template geometry in mm
- ✅ Stress: red +1, green −1; stressed ships take no actions; stressed + red reveal → opponent picks a non-red maneuver
- ✅ Bumping: back off along the template until clear, end touching, skip action; touching ships can't attack each other until one moves away
- ✅ K-turn bump treated as a straight of the same speed
- ✅ Moving through ships allowed
- ✅ Fleeing: any part of the base off the table → destroyed
- ✅ Obstacles: template or base overlap → skip action, roll 1 attack die (hit = damage, crit = critical); ship stays on the rock and can't attack
- ◐ Bumped move into obstacle: only the final base is checked (not the template) when a bump also occurred
- ✅ Actions: focus, evade, target lock (360°, Range 1–3, one lock per ship, replaces old lock), barrel roll (left/right × back/centre/forward), boost (1 straight / 1 bank left / 1 bank right), pass
- ✅ Card actions, free actions granted by cards (even if not on the action bar), multiple actions per turn
- ✅ Ion tokens: ionized ship skips its dial, flies a white 1-straight, then clears ion
- ✅ Secondary weapons: Attack (lock) / Attack (focus) costs, spend vs keep lock, discard, turret (360°), range bands per weapon, no range bonuses
- ✅ Bonus attacks (after a miss, end of phase), attack-twice weapons, splash damage
- ✅ Defender modifies attack dice before the attacker does
- ◐ "Reroll up to N dice": offered as presets (reroll blanks / focus / both, worst first) rather than picking individual dice
- ◐ Barrel roll positions: 3 per side (back/centre/forward) instead of continuous; off-table rolls are not offered
- ✅ Free actions; no action twice per round
- ✅ Combat in descending skill; initiative first on ties; one attack per ship
- ✅ Firing arc (80°, any part of base), range to closest point inside the arc, bands 100 mm
- ✅ Range 1: +1 attack die (primary). Range 3: +1 defense die (primary). Obstructed: +1 defense die
- ✅ Modify attack: lock reroll (blanks, or blanks+focus), focus → hits; abilities. Rerolled dice can't be rerolled again
- ◐ Lock reroll: two presets instead of picking individual dice
- ✅ Modify defense: focus → evades, evade token adds an evade; abilities
- ✅ Compare: evades cancel hits before crits
- ✅ Damage: one at a time, shields first, then Damage cards (crit faceup); Direct Hit counts double
- ✅ Simultaneous attack rule
- ✅ End phase clears focus/evade; locks and stress persist
- ✅ Victory: last ships standing; mutual destruction → initiative wins
- ✅ Concede
- ⬜ Rule-dispute dice roll-off (not needed digitally)

## Damage deck (33 cards, 8 pilot / 25 ship, 7 Direct Hit) — all 14 card types implemented
Direct Hit, Ruptured Plating (−1 agility, repair), Engine Fault (turns red), Thruster Fire (stress, flip),
Console Blaze (start-of-combat roll, repair), Weapons Fault (−1 attack, repair), Hull Breach (roll after red),
Munitions Jam (discard secondary weapon), Sensor Burnout (only damage-card actions), Minor Explosion,
Flash-Blinded (next attack rolls 0), Smoke in the Cockpit (skill 0 from next round), Dazed (damage on overlap),
Head Wound (no pilot ability / elite upgrades).
- ✅ Deck reshuffles discard when empty; ◐ if both empty, extra damage tracked as proxy facedown cards

## Content (stage 1: small ships, waves 1–4, from the first-edition dataset)
- League: Lancer, Bulwark, Dart, Courier, Halberd, Sparrow, Rapier. Dominion: Wasp, Hornet, Talon, Beetle, Mantis.
- 57 pilots (32 abilities, all implemented). 59 upgrades: elite talents, drones, torpedoes, missiles,
  cannons, turrets, crew, systems, modifications, one title — all implemented.
- ◐ Simplified card choices: Commander Ostrava auto-deals the worst of 3 cards; Baron Kessick and
  Loyal Mechanic trigger automatically (always beneficial); Snap Roll removes the first enemy lock.
- ⬜ Not yet: bombs (slot shown as "coming soon"), large/huge ships, cloaking, two-lock crew, dial-peeking crew.

## Not yet
- ⬜ Missions (escort, asteroid run, satellites) — see WORKSTREAMS.md
- ⬜ Team play (3–4 players)
- ⬜ Computer opponent UI (bot exists for tests; `randomSquad()` powers the squad builder's Random button)
- ⬜ Measuring tools in the UI (range ruler drag), undo, replay viewer
