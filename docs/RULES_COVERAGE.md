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

## Foundation for the remaining small ships
- ✅ Segnor's loop, Tallon roll, reverse and stationary maneuvers (bumped loops/rolls lose their end rotation)
- ◐ Tallon roll: base centred on the template end (no sideways alignment choice)
- ✅ Auxiliary rear and 180° arcs, turret primary weapons, bullseye arc (for card effects)
- ✅ SLAM, cloak/decloak, reload, jam, coordinate, reinforce, weapons-disabled tokens
- ◐ Decloak happens at the start of the Activation phase in pilot-skill order (2-straight barrel roll or 2 straight ahead)
- ◐ Jam token: the jammed ship's next focus, evade or lock is cancelled instead (≤ 2 tokens, cleared in the End phase)
- ◐ Reinforce: if the attacker's centre is in the reinforced half, 1 hit (else crit) is cancelled when any would land
- ✅ Tractor beam tokens (−1 agility each; the assigning player may drag a small ship by roll or 1-straight, even onto rocks)
- ✅ Bombs (seismic, proton, ion, thermal, bomblet) and mines (proximity, snare net, cluster) with drop, detonation and board tokens
- ◐ Bombs are dropped with the 1-straight template only (no launch templates yet); Bomblet Launcher doesn't take two slots
- ✅ Condition cards (framework; the cards arrive with the faction batches)
- ✅ Third faction (Syndicate), mirror matches, per-pilot factions

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
- ⬜ Not yet: remaining small-ship batches (see below), large/huge ships, two-lock crew.

## Content batch: league (7 ships, 47 pilots, 68 upgrades, 2 conditions)
- Ships: Pavise, Saber, Skiff, Longbow, Ironwood, Hammerhead (chassis shared with the Syndicate), Tern; new League pilots for Lancer, Dart, Halberd and the Wasp.
- ✅ All 40 pilot abilities and all upgrades implemented, including slot-granting cards (Mentor Drone, Test Rig, Crew Pod, Bomb Rack, Painted Wasp, Sabra Wenn crew, Field Refit) and the two-sided Servo Wings.
- ◐ Captain Rhone automatically holds back a friendly bomb whose blast would hit only friendly ships (once per round).
- ◐ Sabra Wenn (crew) automatically picks the most damaged enemy in the blast.
- ◐ Integrated Drone triggers automatically on the first Damage card while a drone is fitted.
- ◐ “Redcap” and Pip Calloway: shield loss is tracked across attacks only; Pip triggers on lock actions and on spending a lock.
- ◐ Jory Falk triggers on his own focus action only (not tokens handed to him); Kip Kestrel triggers when a green maneuver clears stress.
- ◐ Rell Tamsin locks the attacker after its dice are rolled (same effect, later moment); Fennick Rowe's choice is made at the same moment.
- ◐ Servo Wings: flip offered right before your reveal (not at the very start of the phase); start side is open.
- ◐ Field Refit: the second Modification slot works; the Elite cost discount is not applied; Spare Munitions restores a discarded card at the next opportunity (after the attack / maneuver / action).
- ◐ Heckler Drone cannot lock friendly ships.
- ◐ Casso Andrel guesses at the start of the Activation phase (after both dials are locked) instead of the end of Planning.
- Skipped: the two docking titles for the Skiff and Tern (they need a large carrier ship that isn't in the game).

## Content batch: dominion (10 ships, 66 pilots, 70 upgrades, 5 conditions)
- Ships: Specter, Maul, Vespid, Stiletto, Gadfly, Harrier, Scorpion, Starling, Nightjar, Reaver; new Dominion pilots for Wasp, Hornet, Talon, Beetle and Mantis.
- ✅ All 42 pilot abilities and all Elite / System / Tech / Dominion crew / title / modification cards implemented; cost discounts (Hornet Mk. X) and slot removal (Mantis X7, Beetle Shuttle) work in the squad builder.
- New rules step: the attacker may modify the defender's dice right after the defense roll (Feint, Marksman, Kesta Morne).
- ◐ “Start of the game” choices (Old Grudge, Agent Kaldor, Director Kresh, Mine Planner, Wideband Scanner) happen at the start of the first Activation phase; Wideband Scanner gives each nearby wingmate 1 focus (no deployment skill change). Mine Planner lays mines 2 ranges ahead of the ship.
- ◐ Target Jammer is used at the start of the Activation phase (not Planning). Fire Link doesn't spend its own lock.
- ◐ Lieutenant Corvo's angled roll: a centre barrel roll shifted 20 mm forward or back. “Reverb” decloaks with 2-bank templates forward (side decloaks unchanged).
- ◐ “Twinlock” keeps a spare lock after a lock action only. “Snapfire” and the shield-loss pilots react to shield loss from attacks.
- ◐ Fire Solver and The Sovereign's named die: other effects that change specific faces can still apply afterwards. Marksman cancels an evade before the defender modifies (not at compare).
- ◐ Tovar Brisk restores a discarded Elite card at the next check (after an attack, maneuver, action or the End phase). Signal Relay / Focus Optics cap the token at the next action or start of combat.
- ◐ Gunboat Config / Arsenal Config: the extra slots work; firing while weapons are disabled is not implemented. Beetle Shuttle's 4-point crew limit isn't enforced. Light Frame's agility limit and Thrust Damper's hull limit are enforced.

## Content batch: syndicate (7 ships, 55 pilots, 71 upgrades, 2 conditions)
- Ships: Adder, Gnat, Raptor, Bloodhound, Warden, Hopper, Gharial; Syndicate pilots for Bulwark, Courier, Sparrow and the Hammerhead.
- ✅ All 34 pilot abilities and all Crew / Illicit / Salvaged Drone / Modification / Syndicate cards implemented, incl. Tweek copying an enemy's skill or whole pilot ability, one-of slot grants (Heavy Gnat), squad-wide cost cuts (Gilded Raptor), on-destroyed effects (Spite Charge, Hooked), Matriarch spare tokens.
- ◐ Fire Engineer: the second lock only counts for lock rerolls (not for “Attack (lock)” weapons). Rogue Drone locks friendly ships but can't attack them.
- ◐ Dace Bonner reacts to ion from attacks; Ion Vents is checked in the End phase (the enemy always declines the token). Rousing Recruit and Kip-style stress triggers react to green maneuvers.
- ◐ Captain Jostar reacts to damage suffered outside attacks (bombs, asteroids, splash). Bosh's “adjacent” maneuvers are the neighbours on the dial list.
- ◐ Sol Sixa slides a dropped token to the rear-left/right; Constable Zuvo drops ahead with a 1-straight; Bomb Chief uses a 2-straight drop.
- ◐ Pace Droid always deploys at skill 8. Tweek's “start of the game” choice happens at the start of round 1's Activation (Mimicked doesn't copy card actions).
- Skipped: Nashtah Pup Pilot and the IG-2000 crew card (they need a large ship), and the Energy crew card (huge ships only).

## Not yet
- ⬜ Missions (escort, asteroid run, satellites) — see WORKSTREAMS.md
- ⬜ Team play (3–4 players)
- ✅ Computer opponent (lobby: *Vs computer*, *Watch AI battle*) — ◐ a simple heuristic bot
- ⬜ Measuring tools in the UI (range ruler drag), undo, replay viewer
