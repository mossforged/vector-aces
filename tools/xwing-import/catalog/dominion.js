// Batch "dominion": remaining Dominion-side small ships (incl. sequel-era fighters)
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: Dominion pilots & faction upgrades, titles/mods for its ships, and faction-neutral Elite, System and Tech upgrades.
// Cards for this batch go in src/engine/cards/dominion.js, art in src/render/art/dominion.js,
// presets in src/data/presets/dominion.js. See docs/WORKSTREAMS.md → section A.
// Extra upgrade fields: grants / removes: [slot,...], discount: { slot, amount }, minSkill, noSlot, maxHull, maxAgility.

// ---------------------------------------------------------------- ships
export const SHIPS = {
  16: { id: 'specter',   name: 'Specter',   art: 'specter' },    // cloaking striker
  29: { id: 'maul',      name: 'Maul',      art: 'maul' },       // heavy ordnance carrier
  31: { id: 'vespid',    name: 'Vespid',    art: 'vespid' },     // modern line fighter
  36: { id: 'stiletto',  name: 'Stiletto',  art: 'stiletto' },   // prototype interceptor
  39: { id: 'gadfly',    name: 'Gadfly',    art: 'gadfly' },     // two-seat fighter with a tail gun
  44: { id: 'harrier',   name: 'Harrier',   art: 'harrier' },    // atmospheric strike fighter
  48: { id: 'scorpion',  name: 'Scorpion',  art: 'scorpion' },   // turret-backed escort
  50: { id: 'starling',  name: 'Starling',  art: 'starling' },   // folding-wing gunboat
  53: { id: 'nightjar',  name: 'Nightjar',  art: 'nightjar' },   // elite command fighter
  55: { id: 'reaver',    name: 'Reaver',    art: 'reaver' },     // troop-carrying attacker
};

// ---------------------------------------------------------------- pilots
export const PILOTS = {
  // Talon (base ship)
  57:  { id: 'lt_corvo', name: 'Lieutenant Corvo', text: 'When you barrel roll, you may take 1 stress token to shift at an angle (forward or back) instead of straight sideways.' },
  58:  { id: 'throne_guard', name: 'Throne Guard Pilot' },
  59:  { id: 'teodor_halm', name: 'Teodor Halm', text: 'When you reveal a reverse turn (K), you may fly it at speed 1, 3 or 5 instead.' },
  60:  { id: 'kiran_vos', name: 'Kiran Vos', text: 'When attacking at Range 2–3, you may spend 1 evade token to add 1 hit result.' },
  61:  { id: 'corvin_drax', name: 'Corvin Drax', text: 'Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens.' },
  // Specter
  75:  { id: 'veil_squadron', name: 'Veil Squadron Pilot' },
  76:  { id: 'umbra_squadron', name: 'Umbra Squadron Pilot' },
  77:  { id: 'reverb', name: '“Reverb”', text: 'When you decloak, you use a 2-bank template (forward and to the side) instead of the 2-straight.' },
  78:  { id: 'murmur', name: '“Murmur”', text: 'After you perform an attack that hits, gain 1 focus token.' },
  // Hornet (base ship)
  120: { id: 'cmdr_alvos', name: 'Commander Alvos', text: 'At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1.' },
  128: { id: 'lt_coltane', name: 'Lieutenant Coltane', text: 'At the start of the End phase, you may spend your target lock on an enemy ship to flip 1 random facedown Damage card on it faceup.' },
  129: { id: 'zerek_thorn', name: 'Zerek Thorn', text: 'Enemy ships at Range 1 of you do not get the Range 1 attack bonus.' },
  130: { id: 'juna_halcyon', name: 'Juna Halcyon', text: 'When you reveal your maneuver, you may change its speed by 1 (same bearing, minimum 1).' },
  // Maul
  142: { id: 'twinlock', name: '“Twinlock”', text: 'You may hold 2 target locks on the same ship: when you acquire a lock, you also keep a spare one on that ship.' },
  143: { id: 'hailstorm', name: '“Hailstorm”', text: 'After you drop a bomb, you may perform a free barrel roll action.' },
  144: { id: 'cleaver_squadron', name: 'Cleaver Squadron Pilot' },
  145: { id: 'iron_eight', name: 'Iron Eight Squadron Pilot' },
  // Vespid
  148: { id: 'delta_lead', name: '“Delta Lead”', text: 'At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1.' },
  149: { id: 'delta_squadron', name: 'Delta Squadron Pilot' },
  150: { id: 'sigma_ace', name: '“Sigma Ace”', text: 'When attacking, you may spend a focus token and your target lock on the defender to turn all of your results into criticals.' },
  151: { id: 'sigma_lead', name: '“Sigma Lead”', text: 'Enemy ships you have target-locked cannot modify their dice when attacking you or defending against you.' },
  152: { id: 'kappa_ace', name: '“Kappa Ace”', text: 'You may barrel roll with the 2-straight template instead of the 1-straight.' },
  153: { id: 'kappa_squadron', name: 'Kappa Squadron Pilot' },
  154: { id: 'sigma_squadron', name: 'Sigma Squadron Pilot' },
  170: { id: 'delta_ace', name: '“Delta Ace”', text: 'While you have no Damage cards, your pilot skill is 12.' },
  171: { id: 'kappa_lead', name: '“Kappa Lead”', text: 'When attacking, if you are not stressed, you may take 1 stress token to roll 1 extra attack die.' },
  // Stiletto
  163: { id: 'interrogator', name: 'The Interrogator', text: 'When you attack with your primary weapon at Range 2–3, the attack counts as Range 1.' },
  180: { id: 'varik_rudd', name: 'Varik Rudd', text: 'After defending, you may perform a free action.' },
  181: { id: 'foundry_test', name: 'Foundry Test Pilot' },
  187: { id: 'dominion_baron', name: 'Baron of the Dominion' },
  // Wasp (base ship)
  165: { id: 'lash', name: '“Lash”', text: 'When attacking a defender that has at least 1 Damage card, roll 1 extra attack die.' },
  166: { id: 'mauler', name: '“Mauler”', text: 'When attacking, you may cancel all of your dice results. If you cancel a critical this way, deal the defender 1 facedown Damage card.' },
  167: { id: 'fledge', name: '“Fledge”', text: 'Friendly Wasps at Range 1–3 may perform the action on your equipped Elite card as if it were theirs.' },
  168: { id: 'tailer', name: '“Tailer”', text: 'When another friendly ship at Range 1 spends a focus token, gain 1 focus token.' },
  // Beetle (base ship)
  177: { id: 'tovar_brisk', name: 'Tovar Brisk', text: 'Once per round, after you discard an Elite card, you may restore it.' },
  178: { id: 'quarry_veteran', name: 'Quarry Squadron Veteran' },
  190: { id: 'cinderfall', name: '“Cinderfall”', text: 'When you reveal your maneuver or after you perform an action, you may use a mine card’s action as a free action.' },
  // Mantis (base ship)
  191: { id: 'partisan_squadron', name: 'Partisan Squadron Pilot' },
  192: { id: 'varek_stoll', name: 'Colonel Varek Stoll', text: 'When your attack would deal a faceup Damage card, draw 3 instead, deal the worst one and discard the others.' },
  193: { id: 'countess_ilvane', name: 'Countess Ilvane', text: 'When you reveal a straight maneuver, you may fly it as a reverse turn (K) of the same speed.' },
  // Gadfly
  199: { id: 'snapfire', name: '“Snapfire”', text: 'Once per round, when you lose a shield, you may perform a primary weapon attack.' },
  204: { id: 'kappa_specialist', name: 'Kappa Specialist' },
  205: { id: 'tailwind', name: '“Tailwind”', text: 'When attacking a ship inside your rear firing arc, you may add 1 critical result.' },
  212: { id: 'sigma_specialist', name: 'Sigma Specialist' },
  // Harrier
  218: { id: 'marquise', name: '“Marquise”', text: 'You may choose to ignore your Flex Ailerons.' },
  235: { id: 'fuse', name: '“Fuse”', text: 'When defending, if you are not stressed, you may suffer 1 damage to cancel all of the attacker’s results. If you do, take 1 stress token.' },
  236: { id: 'high_card', name: '“High Card”', text: 'When attacking, if you have 1 or fewer Damage cards, roll 1 extra attack die.' },
  237: { id: 'dominion_trainee', name: 'Dominion Trainee' },
  239: { id: 'shrike_scout', name: 'Shrike Squadron Scout' },
  240: { id: 'coastal_defender', name: 'Coastal Defender' },
  // Scorpion
  248: { id: 'foundry_specialist', name: 'Foundry Specialist' },
  250: { id: 'basalt_escort', name: 'Basalt Squadron Escort' },
  251: { id: 'lt_kesta_morne', name: 'Lieutenant Kesta Morne', text: 'When attacking, you may spend 1 focus token to cancel all of the defender’s blank and focus results.' },
  252: { id: 'two_edge', name: '“Two-Edge”', text: 'Once per round, after a secondary weapon attack that misses, you may attack with a different weapon.' },
  // Starling
  265: { id: 'major_vandrel', name: 'Major Vandrel', text: 'When defending while your weapons are disabled, roll 1 extra defense die.' },
  270: { id: 'mu_squadron', name: 'Mu Squadron Pilot' },
  271: { id: 'tau_veteran', name: 'Tau Squadron Veteran' },
  272: { id: 'lt_varsi', name: 'Lieutenant Varsi', text: 'When your weapons become disabled, if you are not stressed, you may take 1 stress token to re-enable them.' },
  // Nightjar
  268: { id: 'vorrak', name: 'Knight-Commander Vorrak', text: 'The first time you are hit by an attack each round, the attacker gets the “Dark Mark” condition.' },
  281: { id: 'dimmer', name: 'Test Pilot “Dimmer”', text: 'When your attack is obstructed, the defender rolls 2 fewer defense dice instead of 1 more.' },
  283: { id: 'foundry_analyst', name: 'Foundry Analyst' },
  284: { id: 'vanguard_test', name: 'Vanguard Test Pilot' },
  // Reaver
  286: { id: 'major_vesmar', name: 'Major Vesmar', text: 'When attacking, if the defender has no focus or evade token, you may change 1 of your blank or focus results to a hit.' },
  290: { id: 'captain_ferrin', name: 'Captain Ferrin', text: 'When defending against a jammed attacker, add 1 evade result.' },
  291: { id: 'coastal_base', name: 'Coastal Base Pilot' },
  292: { id: 'steward', name: '“Steward”', text: 'After a friendly ship at Range 1 executes a speed 1 maneuver without bumping, you may pass it 1 of your focus or evade tokens.' },
};

// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  // Elite talents
  49:  { id: 'pounce', name: 'Pounce', text: 'When attacking a defender with no focus or evade token, if you are not stressed, you may take 1 stress token to roll 1 extra attack die.' },
  96:  { id: 'locked_in', name: 'Locked In', text: 'When you reveal a maneuver, you may switch to another of the same speed; it becomes red.' },
  99:  { id: 'solo_flier', name: 'Solo Flier', text: 'When attacking or defending with no other friendly ship at Range 1–2, you may reroll 1 blank result.' },
  102: { id: 'merciless', name: 'Merciless', text: 'After your attack hits, pick 1 other ship at Range 1 of the defender (not you): it suffers 1 damage.' },
  103: { id: 'menace', name: 'Menace', text: 'Enemy ships touching you roll 1 fewer defense die.' },
  125: { id: 'calculated_shot', name: 'Calculated Shot', text: 'When attacking, you may spend a focus token to change 1 of your focus results to a critical.' },
  133: { id: 'snap_reverse', name: 'Snap Reverse', text: 'After you execute a white or green maneuver, you may discard this card to spin 180°. Then take 1 stress token.' },
  141: { id: 'marksman', name: 'Marksman', text: 'When attacking a ship inside your firing arc, you may discard this card to cancel 1 of its evade results.' },
  146: { id: 'cool_head', name: 'Cool Head', text: 'When you receive a stress token, you may discard this card to gain 1 focus or evade token.' },
  147: { id: 'feint', name: 'Feint', text: 'When attacking while you have an evade token, you may change 1 of the defender’s evade results to a focus.' },
  232: { id: 'flex_minus', name: 'Flex Rating (−1)', text: 'Decrease your pilot skill by 1.' },
  233: { id: 'flex_plus', name: 'Flex Rating (+1)', text: 'Increase your pilot skill by 1.' },
  235: { id: 'fury', name: 'Fury', text: 'Action: Gain 1 focus token and 2 stress tokens. This round, when attacking you may reroll up to 3 attack dice.' },
  267: { id: 'old_grudge', name: 'Old Grudge', text: 'At the start of the game, mark 1 enemy ship with “Blood Debt”. When attacking it, you may change 1 focus result to a critical.' },
  279: { id: 'quick_shot', name: 'Quick Shot', weapon: {}, text: 'After an enemy ship executes a maneuver, you may make this attack against it. You cannot modify your attack dice, and it doesn’t use up your Combat-phase attack.' },
  282: { id: 'bank_shot', name: 'Bank Shot', text: 'When your attack is obstructed, roll 1 extra attack die.' },
  295: { id: 'hive_leader', name: 'Hive Leader', text: 'When making a primary attack, up to 2 other friendly ships with the defender in their firing arc at Range 1–3 may each discard 1 evade token to give you 1 extra attack die.' },
  297: { id: 'mastery', name: 'Mastery', text: 'When attacking, if you are not stressed, you may change all of your focus results to hits.' },
  317: { id: 'momentum', name: 'Momentum', text: 'After you boost or barrel roll, you may gain 1 focus or evade token; then this card is spent. After combat, you may spend a focus or evade token to ready it again.' },
  341: { id: 'saturation_fire', name: 'Saturation Fire', text: 'After a torpedo or missile attack that misses, each ship at Range 1 of the defender whose agility is lower than that card’s cost rolls 1 attack die and suffers the damage.' },
  350: { id: 'rock_dancer', name: 'Rock Dancer', text: 'Action: Gain 1 evade token for each asteroid at Range 1 (up to 2).' },
  // Systems
  71:  { id: 'deep_scopes', name: 'Deep Scopes', text: 'During the Activation phase, your pilot skill counts as 0.' },
  106: { id: 'fire_solver', name: 'Fire Solver', text: 'When attacking, you may cancel all of your dice results and add 2 hit results instead. Those dice can’t be changed again.' },
  121: { id: 'hornet_suite', name: 'Hornet Targeting Suite', text: 'Hornet only. When attacking with your primary weapon while you have a lock on the defender, you may add 1 critical result; if you do, you can’t spend locks this attack.' },
  234: { id: 'dampener', name: 'Dampener', text: 'When you receive a stress token, you may suffer 1 damage to discard it.' },
  253: { id: 'rock_skimmer', name: 'Rock Skimmer', text: 'Your boosts, barrel rolls and decloaks may overlap asteroids. Ignore criticals when rolling for asteroid damage.' },
  326: { id: 'mine_planner', name: 'Mine Planner', text: 'At the start of the first round, you may discard your mine cards to place their tokens 2 ranges ahead of you, if that spot is beyond Range 3 of every enemy.' },
  336: { id: 'launch_computer', name: 'Launch Computer', text: 'Your timed bombs are launched forward along a 5-straight template instead of dropped behind you.' },
  354: { id: 'target_jammer', name: 'Target Jammer', text: 'At the start of the Activation phase, you may disable your own weapons this round to give a ship at Range 1–3 the “Scrambled Sensors” condition.' },
  366: { id: 'thrust_damper', name: 'Thrust Damper', maxHull: 4, text: 'When defending with 3 or fewer stress tokens, you may take 1 stress token to cancel all of your dice and add 1 evade result instead. Hull 4 or lower only.' },
  // Tech
  149: { id: 'signal_relay', name: 'Signal Relay', text: 'You can’t hold more than 1 evade token, but you keep it through the End phase.' },
  150: { id: 'guidance_uplink', name: 'Guidance Uplink', text: 'When attacking, you may spend a focus token to change 1 of your blank results to a hit.' },
  254: { id: 'evasion_sensors', name: 'Evasion Sensors', text: 'When defending, you may spend a focus token to change 1 of your blank results to an evade.' },
  277: { id: 'hot_thrusters', name: 'Hot Thrusters', text: 'You may boost and barrel roll while stressed, unless you have 3 or more stress tokens.' },
  278: { id: 'pattern_reader', name: 'Pattern Reader', text: 'A red maneuver gives you its stress token after your action step instead of before it.' },
  288: { id: 'fire_link', name: 'Fire Link', text: 'Friendly ships at Range 1–2 attacking a ship you have locked may fire “Attack (lock)” weapons without a lock of their own.' },
  289: { id: 'wideband_scanner', name: 'Wideband Scanner', text: 'At the start of the first round, each other friendly ship at Range 1–2 of you gains 1 focus token.' },
  347: { id: 'focus_optics', name: 'Focus Optics', text: 'You can’t hold more than 1 focus token, but you keep it through the End phase.' },
  351: { id: 'hunter_sense', name: 'Hunter Sense', text: 'When an enemy inside your firing arc at Range 1–2 becomes active in the Combat phase, you may spend your lock on it to boost or barrel roll for free (if it’s on your action bar).' },
  // Dominion crew
  45:  { id: 'lord_varr', name: 'Lord Varr', text: 'After you attack an enemy ship, you may suffer 2 damage to make it suffer 1 critical damage.' },
  46:  { id: 'captive_agitator', name: 'Captive Agitator', text: 'Once per round, the first ship to attack you gets 1 stress token.' },
  94:  { id: 'mara_venn', name: 'Mara Venn', text: 'At the end of the Combat phase, each enemy ship at Range 1 without stress gets 1 stress token.' },
  95:  { id: 'wing_officer', name: 'Wing Officer', text: 'Action: Up to 2 friendly ships at Range 1–2 each gain 1 focus token. Then take 1 stress token.' },
  100: { id: 'director_isra', name: 'Director Isra', text: 'At the start of the Combat phase, if you have no shields and at least 1 Damage card, you may perform a free evade action.' },
  101: { id: 'governor_jerrod', name: 'Governor Jerrod', text: 'When you are dealt a faceup Damage card, you may discard this card to turn it facedown (without resolving it).' },
  129: { id: 'sovereign', name: 'The Sovereign', text: 'Once per round, before a friendly ship rolls dice, name a result. After rolling, it must change 1 of its dice to that result; that die can’t be rerolled.' },
  200: { id: 'agent_kaldor', name: 'Agent Kaldor', text: 'At the start of the game, mark 1 enemy ship. When attacking or defending against it, you may change 1 of your focus results to a hit or an evade.' },
  224: { id: 'admiral_chiran', name: 'Rear Admiral Chiran', text: 'Action: Execute a white 1-straight maneuver.' },
  245: { id: 'sensor_officer', name: 'Sensor Officer', text: 'After you execute a green maneuver, another friendly ship at Range 1 may acquire a target lock.' },
  264: { id: 'vorrak_crew', name: 'Knight-Commander Vorrak', text: 'Action: Give an enemy ship at Range 1–3 the “Dark Mark” condition.' },
  286: { id: 'general_hakar', name: 'General Hakar', text: 'Action: Up to 3 friendly ships at Range 1–2 gain 1 focus token each, and 1 of them gets “Zealot’s Fervor”. Then take 1 stress token.' },
  356: { id: 'director_kresh', name: 'Director Kresh', text: 'At the start of the game, give a friendly ship with 3 or fewer shields the “Prototype Tuning” condition.' },
  357: { id: 'shadow_troopers', name: 'Shadow Troopers', text: 'When another friendly ship at Range 1 is attacked, if you are inside the attacker’s firing arc at Range 1–3, the attacker gets 1 stress token.' },
  363: { id: 'tactics_officer', name: 'Tactics Officer', text: 'Your action bar gains coordinate.' },
  364: { id: 'intel_slicer', name: 'Intel Slicer', text: 'After you jam an enemy ship, you may give 1 jam token to an unjammed ship at Range 1 of it.' },
  // Titles & modifications for Dominion ships
  155: { id: 'throne_guard_talon', name: 'Throne Guard Talon', grants: ['mod'], minSkill: 5, text: 'Talon only (pilot skill 5+). You may fit a second (different) Modification.' },
  170: { id: 'hornet_mkx', name: 'Hornet Mk. X', grants: ['system'], discount: { slot: 'system', amount: 4 }, text: 'Hornet only. Your upgrade bar gains a System slot; your System upgrade costs 4 points less.' },
  182: { id: 'phase_shroud', name: 'Phase Shroud', text: 'Specter only. After you perform an attack, you may cloak as a free action.' },
  190: { id: 'twin_drive', name: 'Twin Drive Mk. II', text: 'Dominion fighters only. All your bank maneuvers are green.' },
  208: { id: 'stiletto_v1', name: 'Stiletto V1', text: 'Stiletto only. After you acquire a target lock, you may perform a free evade action.' },
  219: { id: 'mantis_x7', name: 'Mantis X7', removes: ['cannon', 'missile'], text: 'Mantis only. Lose your Cannon and Missile slots. After a speed 3–5 maneuver without overlapping a ship or asteroid, you may perform a free evade action.' },
  220: { id: 'mantis_d', name: 'Mantis D', text: 'Mantis only. Once per round, after attacking with a cannon costing 3 or less, you may make a primary weapon attack.' },
  221: { id: 'beetle_shuttle', name: 'Beetle Shuttle', grants: ['crew', 'crew'], removes: ['torpedo', 'missile', 'bomb'], text: 'Beetle only. Lose your Torpedo, Missile and Bomb slots; gain 2 Crew slots.' },
  247: { id: 'black_ops_drill', name: 'Black Ops Drill', text: 'Gadfly only. Primary attacks from your front arc may roll 1 extra die; if you don’t take it, you may afterwards attack from your rear arc too.' },
  270: { id: 'flex_ailerons', name: 'Flex Ailerons', text: 'Harrier only. Right before you reveal, if you are not stressed, you must fly a white 1-bank or 1-straight.' },
  296: { id: 'light_frame', name: 'Light Frame', maxAgility: 2, text: 'Dominion fighters with agility 2 or less. When defending, if you rolled fewer defense dice than the attacker rolled attack dice, roll 1 more.' },
  331: { id: 'gunboat_config', name: 'Gunboat Config', grants: ['cannon', 'cannon'], text: 'Starling only. Your upgrade bar gains 2 Cannon slots.' },
  337: { id: 'vanguard_mark', name: 'Vanguard Mark', text: 'Nightjar only. When attacking the only ship in your firing arc at Range 1–3, you may reroll 1 attack die. When defending, you may discard this card to reroll all of your defense dice.' },
  338: { id: 'arsenal_config', name: 'Arsenal Config', grants: ['torpedo', 'missile'], text: 'Starling only. Your upgrade bar gains a Torpedo and a Missile slot.' },
  362: { id: 'reaver_ailerons', name: 'Reaver Ailerons', text: 'Reaver only. Your 3-banks are white. Right before you reveal, if you are not stressed, you must fly a white 1-bank or 1-straight.' },
};

// Condition cards: { [datasetConditionId]: { id, name, text } }
export const CONDITIONS = {
  0: { id: 'dark_mark', name: 'Dark Mark', text: 'Holds a faceup Pilot Damage card. The next time you suffer critical damage in an attack, you are dealt that card instead; then remove this.' },
  1: { id: 'zealots_fervor', name: 'Zealot’s Fervor', text: 'When defending, you can’t spend focus tokens. When attacking, if you spend focus to turn focus into hits, 1 of those hits can’t be canceled (criticals are canceled first). Removed in the End phase.' },
  3: { id: 'blood_debt', name: 'Blood Debt', text: 'The ship with Old Grudge may change 1 focus result to a critical when attacking you.' },
  8: { id: 'scrambled_sensors', name: 'Scrambled Sensors', text: 'When attacking the Target Jammer’s ship at Range 1, you can’t modify your attack dice. Removed at the end of the Combat phase.' },
  9: { id: 'prototype_tuning', name: 'Prototype Tuning', text: '+1 shield. Once per round when making a primary attack, you may spend 1 die result to strip 1 shield from the defender. After your primary attack, a friendly ship at Range 1–2 with Director Kresh may lock the defender.' },
};
