// Batch "league": remaining League-side small ships (incl. sequel-era Resistance ships)
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: League pilots & faction upgrades, titles/mods for its ships, and faction-neutral Drone (astromech), Torpedo, Missile, Cannon and Turret upgrades.
// Cards for this batch go in src/engine/cards/league.js, art in src/render/art/league.js,
// presets in src/data/presets/league.js. See docs/WORKSTREAMS.md → section A.
// Extra upgrade fields: grants: [slot,...] (adds slots), minSkill (pilot skill needed), noSlot (can't fit if the bar has it).

// ---------------------------------------------------------------- ships
export const SHIPS = {
  28: { id: 'pavise',     name: 'Pavise',     art: 'pavise' },      // heavy turret bomber
  30: { id: 'saber',      name: 'Saber',      art: 'saber' },       // Lancer successor
  33: { id: 'skiff',      name: 'Skiff',      art: 'skiff' },       // light assault shuttle
  38: { id: 'longbow',    name: 'Longbow',    art: 'longbow' },     // long-range strike craft with tail gun
  47: { id: 'ironwood',   name: 'Ironwood',   art: 'ironwood' },    // armoured gunship, wide fire arc
  49: { id: 'hammerhead', name: 'Hammerhead', art: 'hammerhead' },  // bomber chassis shared with the Syndicate
  52: { id: 'tern',       name: 'Tern',       art: 'tern' },        // small courier shuttle with tail gun
};

// ---------------------------------------------------------------- pilots
export const PILOTS = {
  // Lancer (base ship) — new pilots
  81:  { id: 'dax_merrow', name: 'Dax Merrow', text: 'After you perform an attack, you may strip 1 focus, evade or target lock token from the defender.' },
  82:  { id: 'hollis_brack', name: 'Hollis Brack', text: 'When you receive a stress token, you may discard it and roll 1 attack die. On a hit, you are dealt 1 facedown Damage card.' },
  83:  { id: 'pip_calloway', name: 'Pip Calloway', text: 'When you acquire or spend a target lock, you may remove 1 stress token.' },
  84:  { id: 'rell_tamsin', name: 'Rell Tamsin', text: 'When an enemy ship attacks you, you may acquire a target lock on it.' },
  285: { id: 'kulbo_sperr', name: 'Kulbo Sperr', text: 'After you perform a boost or barrel roll action, you may flip your Servo Wings card.' },
  289: { id: 'levan_tenz', name: 'Levan Tenz', text: 'After you perform a boost action, you may take 1 stress token to gain 1 evade token.' },
  293: { id: 'hollow_peak', name: 'Hollow Peak Zealot' },
  294: { id: 'edro_tubb', name: 'Edro Tubb', text: 'When you become the active ship during the Activation phase, if you have at least 1 focus token, you may perform a free action.' },
  // Dart (base ship)
  85:  { id: 'jory_falk', name: 'Jory Falk', text: 'After you perform a focus action, you may perform a free boost or barrel roll action.' },
  86:  { id: 'sola_gemm', name: 'Sola Gemm', text: 'While an enemy ship is at Range 1 of you, your agility is increased by 1.' },
  // Halberd (base ship)
  87:  { id: 'kael_farran', name: 'Kael Farran', text: 'When attacking, you may remove 1 stress token to change all of your focus results to hits.' },
  88:  { id: 'nessa_dane', name: 'Nessa Dane', text: 'Your torpedo attacks may target enemy ships outside your firing arc.' },
  // Pavise
  139: { id: 'bastion_squadron', name: 'Bastion Squadron Pilot' },
  140: { id: 'tukko_esseg', name: 'Tukko Esseg', text: 'When another friendly ship at Range 1–2 attacks, it may spend your focus tokens as if they were its own.' },
  141: { id: 'mira_donn', name: 'Mira Donn', text: 'Once per round when attacking, you may spend 1 shield to roll 1 extra attack die, or roll 1 fewer attack die to recover 1 shield.' },
  147: { id: 'rampart_squadron', name: 'Rampart Squadron Pilot' },
  // Saber
  155: { id: 'azure_novice', name: 'Azure Squadron Novice' },
  156: { id: 'cal_ardent', name: 'Cal Ardent', text: 'When attacking or defending, if you have a focus token, you may change 1 of your focus results to a hit (attacking) or an evade (defending) without spending it.' },
  194: { id: 'cal_ardent_ace', name: 'Cal Ardent', text: 'When attacking or defending, if you have a focus token, you may change 1 of your focus results to a hit (attacking) or an evade (defending) without spending it.' },
  157: { id: 'redcap', name: '“Redcap”', text: 'The first time you lose a shield each round, gain 1 evade token.' },
  158: { id: 'scarlet_veteran', name: 'Scarlet Squadron Veteran' },
  159: { id: 'bluejay', name: '“Bluejay”', text: 'When you boost, you may use a 1-turn template instead of a bank or straight.' },
  179: { id: 'elko_ast', name: 'Elko Ast', text: 'While you are not stressed, your Tallon rolls are white maneuvers.' },
  221: { id: 'jessa_pell', name: 'Jessa Pell', text: 'When attacking or defending, you may reroll 1 of your dice for each other friendly ship at Range 1.' },
  222: { id: 'nimo_nunn', name: 'Nimo Nunn', text: 'When you receive a stress token while an enemy ship is inside your firing arc at Range 1, you may discard that stress token.' },
  223: { id: 'snapline', name: '“Snapline” Wex', text: 'After you execute a speed 2, 3 or 4 maneuver without touching another ship, you may perform a free boost action.' },
  // Skiff
  169: { id: 'ezo_brightwater', name: 'Ezo Brightwater', text: 'When defending while stressed, you may change up to 2 of your focus results to evades.' },
  174: { id: 'hesta_vael', name: 'Hesta Vael', text: 'When you reveal a green or red maneuver, you may switch to another maneuver of the same colour.' },
  175: { id: 'sabra_wenn', name: 'Sabra Wenn', text: 'Right before you reveal your maneuver, you may perform a free boost or barrel roll action.' },
  176: { id: 'bruiser_orrel', name: '“Bruiser” Orrel', text: 'When defending, your evades cancel critical results before hit results.' },
  // Wasp (League pilots in captured fighters)
  214: { id: 'sabra_wenn_wasp', name: 'Sabra Wenn', text: 'Right before you reveal your maneuver, you may perform a free boost or barrel roll action.' },
  225: { id: 'asha_tano', name: 'Asha Tano', text: 'At the start of the Combat phase, you may spend 1 focus token to let a friendly ship at Range 1 perform a free action.' },
  226: { id: 'captain_rask', name: 'Captain Rask', text: 'After you perform an attack, the defender gets the “Pinned Down” condition.' },
  241: { id: 'bruiser_orrel_wasp', name: '“Bruiser” Orrel', text: 'When defending, your evades cancel critical results before hit results.' },
  // Longbow
  196: { id: 'shaya_brey', name: 'Shaya Brey', text: 'When another friendly ship at Range 1–2 attacks, it may spend your target lock on the defender as if it were its own.' },
  201: { id: 'bran_stroll', name: 'Bran Stroll', text: 'After you execute a maneuver, you may roll 1 attack die. On a hit or critical, remove 1 stress token.' },
  202: { id: 'thayne_kirrel', name: 'Thayne Kirrel', text: 'After an enemy ship inside your firing arc at Range 1–3 attacks another friendly ship, you may perform a free action.' },
  203: { id: 'nora_wex', name: 'Nora Wex', text: 'When attacking or defending, you may spend a target lock you have on the enemy ship to add 1 focus result to your roll.' },
  // Ironwood
  249: { id: 'grove_defender', name: 'Grove Defender' },
  254: { id: 'lowroot', name: 'Lowroot', text: 'When another friendly ship at Range 1 defends, you may spend your reinforce to add 1 evade result to its roll.' },
  255: { id: 'ironbark', name: 'Ironbark', text: 'When attacking, if you have no shields left and at least 1 Damage card, roll 1 extra attack die.' },
  259: { id: 'grove_liberator', name: 'Grove Liberator' },
  // Hammerhead
  257: { id: 'captain_rhone', name: 'Captain Rhone', text: 'Once per round, you may stop a friendly bomb from detonating (it stays on the table until the next round).' },
  // Tern
  267: { id: 'fennick_rowe', name: 'Fennick Rowe', text: 'When an enemy ship inside your firing arc at Range 1–3 attacks during the Combat phase, if you are not stressed, you may take 1 stress token. If you do, it cannot spend tokens to modify its attack dice this round.' },
  275: { id: 'ezo_brightwater_tern', name: 'Ezo Brightwater', text: 'When defending while stressed, you may change up to 2 of your focus results to evades.' },
  276: { id: 'bruiser_orrel_tern', name: '“Bruiser” Orrel', text: 'When defending, your evades cancel critical results before hit results.' },
  277: { id: 'ax9', name: 'AX-9', text: 'When you coordinate, you may take 2 stress tokens to remove 1 stress token from the ship you chose, before it acts.' },
};

// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  // Drones (astromech slot)
  69:  { id: 'needle_drone', name: 'Needle Drone', text: 'When you declare an attack against a ship inside your firing arc, you may take 1 stress token to give the defender 1 stress token.' },
  70:  { id: 'mentor_drone', name: 'Mentor Drone', grants: ['elite'], minSkill: 3, noSlot: 'elite', text: 'Your upgrade bar gains an Elite slot. Pilots with an Elite slot already, or pilot skill 2 or lower, cannot fit this.' },
  77:  { id: 'buffer_drone', name: 'Buffer Drone', text: 'When you are hit by 3 or more uncanceled hits, you may cancel hits until 2 remain, taking 1 stress token for each one canceled.' },
  78:  { id: 'siphon_drone', name: 'Siphon Drone', text: 'After the Combat phase, you may spend 1 focus token to recover 1 shield.' },
  214: { id: 'targeting_drone', name: 'Targeting Drone', text: 'After you execute a red maneuver, you may acquire a target lock.' },
  250: { id: 'spotter_drone', name: 'Spotter Drone', text: 'Once per round, when attacking with your primary weapon, you may cancel 1 of your focus results to gain 1 evade token.' },
  280: { id: 'heckler_drone', name: 'Heckler Drone', text: 'When a ship you have target-locked attacks, you may pick 1 of its attack dice: it must reroll that die.' },
  345: { id: 'scrap_drone', name: 'Scrap Drone', text: 'Action: Discard 1 of your other upgrades to recover 1 shield.' },
  346: { id: 'glide_drone', name: 'Glide Drone', text: 'You cannot attack ships outside your firing arc. After you execute a maneuver without overlapping a ship or asteroid, if no enemy is inside your firing arc at Range 1–3, you may perform a free boost or barrel roll action.' },
  // Torpedoes
  104: { id: 'arc_torpedoes', name: 'Arc Torpedoes', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. If it hits, the defender and every ship at Range 1 of it receive 1 ion token.' },
  111: { id: 'bomb_rack', name: 'Bomb Rack', grants: ['bomb'], text: 'Bulwark only. Your upgrade bar gains a Bomb slot.' },
  136: { id: 'searing_torpedoes', name: 'Searing Torpedoes', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. If it hits, after damage is dealt, the defender also loses 1 shield.' },
  137: { id: 'spare_munitions', name: 'Spare Munitions', text: 'Each of your torpedo, missile and bomb cards starts with 1 spare round. The first time one of them would be discarded, spend its spare round instead.' },
  259: { id: 'quake_torpedo', name: 'Quake Torpedo', text: 'Action: Discard this card and pick an asteroid at Range 1–2 inside your firing arc. Each ship at Range 1 of it rolls 1 attack die and suffers the damage rolled. Then remove the asteroid.' },
  359: { id: 'field_refit', name: 'Field Refit', grants: ['mod'], text: 'Lancer only. You may fit a second (different) Modification.' },
  // Missiles
  72:  { id: 'stripped_rails', name: 'Stripped Rails', text: 'Dart only. Strip out the missile rails to save weight: this card has a negative cost.' },
  73:  { id: 'flare_rockets', name: 'Flare Rockets', weapon: { cost: 'focus', discard: true }, text: 'Attack (focus): discard this card. Roll extra attack dice equal to your agility (up to 3 extra).' },
  142: { id: 'lancehead_missiles', name: 'Lancehead Missiles', weapon: { cost: 'lock', discard: true }, text: 'Attack (lock): discard this card (keep your lock). If it hits, deal the defender 1 faceup Damage card instead of normal damage.' },
  199: { id: 'trace_darts', name: 'Trace Darts', weapon: { cost: 'focus', discard: true }, text: 'Attack (focus): discard this card. If it hits, each friendly ship at Range 1–2 of you may lock onto the defender (no damage is dealt).' },
  312: { id: 'dumbfire_rockets', name: 'Dumbfire Rockets', weapon: { cost: 'focus' }, text: 'Attack (focus). Your attack dice can only be modified by spending a focus token in the usual way.' },
  328: { id: 'longhaul_missiles', name: 'Long-Haul Missiles', weapon: { cost: 'lock', discard: true }, text: 'Attack (lock): discard this card. Roll extra attack dice equal to the speed of the maneuver you flew this round (up to 4 extra).' },
  330: { id: 'grapple_missiles', name: 'Grapple Missiles', weapon: { cost: 'lock', discard: true }, text: 'Attack (lock): discard this card. If it hits, the defender gets the “Hooked” condition after the attack.' },
  352: { id: 'static_missiles', name: 'Static Missiles', weapon: { cost: 'lock', discard: true }, text: 'Attack (lock): discard this card. If it hits, the defender and every other ship at Range 1 of it get 1 jam token (no damage is dealt).' },
  // Cannons
  123: { id: 'needle_cannon', name: 'Needle Cannon', weapon: {}, text: 'Attack 1 ship. If it hits, the defender suffers 1 damage and, if it has no stress, gets 1 stress token (instead of normal damage).' },
  124: { id: 'wrecker_cannon', name: 'Wrecker Cannon', weapon: {}, text: 'Attack 1 ship. You may change 1 of your hit results to a critical.' },
  195: { id: 'tractor_projector', name: 'Tractor Projector', weapon: {}, text: 'Attack 1 ship. If it hits, the defender gets 1 tractor beam token (instead of normal damage).' },
  339: { id: 'interference_beam', name: 'Interference Beam', weapon: {}, text: 'Attack 1 ship. If it hits, the defender gets 1 jam token (instead of normal damage).' },
  340: { id: 'linked_battery', name: 'Linked Battery', text: 'When attacking with your primary weapon or a cannon, you may reroll 1 attack die.' },
  // Turrets
  116: { id: 'scatter_turret', name: 'Scatter Turret', weapon: { turret: true }, text: 'Attack 1 ship, even outside your firing arc. Your hit results cannot be canceled; the defender may cancel criticals before hits.' },
  138: { id: 'twin_turret', name: 'Twin Turret', weapon: { attack: 3, turret: true, twice: true }, text: 'Attack twice, even outside your firing arc. Each attack that hits deals exactly 1 damage.' },
  212: { id: 'dorsal_turret', name: 'Dorsal Turret', weapon: { turret: true }, text: 'Attack 1 ship, even outside your firing arc. At Range 1, roll 1 extra attack die.' },
  314: { id: 'synced_turret', name: 'Synced Turret', weapon: { cost: 'lock', turret: true }, text: 'Attack (lock): attack 1 ship, even outside your firing arc (keep your lock). If the defender is inside your firing arc, you may reroll up to as many attack dice as your primary weapon value.' },
  // League crew
  62:  { id: 'tinker_bot', name: 'Tinker Bot', text: 'During the End phase, if you have no shields, you may recover 1 shield and roll 1 attack die. On a hit, flip 1 random facedown Damage card faceup.' },
  63:  { id: 'protocol_bot', name: 'Protocol Bot', text: 'Once per round, before rolling defense dice, predict how many evades you will roll. If you are right, add 1 evade result.' },
  74:  { id: 'kip_kestrel', name: 'Kip Kestrel', text: 'After a green maneuver clears a stress token from your ship, you may gain 1 focus token.' },
  75:  { id: 'jana_orr', name: 'Jana Orr', text: 'Once per round, when a friendly ship at Range 1–3 performs a focus action, you may swap 1 of its focus tokens for an evade token.' },
  86:  { id: 'dash_corran', name: 'Dash Corran', text: 'When attacking, if you have a target lock on the defender, you may spend it to change all of your focus results to hits.' },
  87:  { id: 'aria_vell', name: 'Lady Aria Vell', text: 'At the start of the Activation phase, you may discard this card. Friendly ships treat red maneuvers as white until the end of the phase.' },
  93:  { id: 'lanno_castor', name: 'Lanno Castor', text: 'Action: Roll 2 defense dice. Gain 1 focus token per focus and 1 evade token per evade.' },
  97:  { id: 'dace_rendell', name: 'Dace Rendell', text: 'You may attack while on an asteroid. Your attacks are never obstructed.' },
  98:  { id: 'lebo', name: '“Lebo”', text: 'Action: Perform a free boost, then gain 1 ion token.' },
  210: { id: 'kaen_jarro', name: 'Kaen Jarro', text: 'Once per round, after a friendly ship at Range 1–2 executes a white maneuver, you may remove 1 stress token from it.' },
  211: { id: 'bruiser_crew', name: '“Bruiser” Orrel', text: 'You may attack enemy ships inside your firing arc even while your bases are touching.' },
  215: { id: 'ezo_crew', name: 'Ezo Brightwater', text: 'When attacking while stressed, you may change 1 of your focus results to a critical.' },
  216: { id: 'sprocket', name: '“Sprocket”', text: 'You may perform actions while stressed. After you perform an action while stressed, suffer 1 damage.' },
  217: { id: 'hesta_crew', name: 'Hesta Vael', text: 'You may reveal and execute red maneuvers while stressed.' },
  218: { id: 'sabra_crew', name: 'Sabra Wenn', grants: ['bomb'], text: 'Your upgrade bar gains a Bomb slot. Once per round, when a friendly bomb goes off, 1 enemy ship at Range 1 of it suffers 1 extra damage.' },
  268: { id: 'jyna_esk', name: 'Jyna Esk', text: 'Action: Pick a friendly ship at Range 1–2. It gains 1 focus token for each enemy ship inside your firing arc at Range 1–3 (up to 3).' },
  269: { id: 'casso_andrel', name: 'Casso Andrel', text: 'At the start of the Activation phase, you may guess the maneuver of an enemy ship at Range 1–2. If you are right, you may change your own maneuver.' },
  275: { id: 'wren_solace', name: 'Wren Solace', text: 'At the start of the End phase, you may set aside 1 of your focus tokens on this card. At the start of the Combat phase, you may take it back.' },
  276: { id: 'fen_marlow', name: 'Fen Marlow', text: 'When attacking with your primary weapon or defending, if the enemy ship is inside your firing arc, you may add 1 blank result to your roll.' },
  285: { id: 'rask_crew', name: 'Captain Rask', text: 'After you perform an attack that misses, gain 1 focus token.' },
  290: { id: 'bodo_rake', name: 'Bodo Rake', text: 'When you acquire a target lock, you may lock onto an enemy at Range 1–3 of any friendly ship.' },
  291: { id: 'baz_malloch', name: 'Baz Malloch', text: 'After an attack that misses, you may immediately attack a different ship with your primary weapon. You cannot attack again this round.' },
  298: { id: 'bastien_kell', name: 'Bastien Kell', text: 'When attacking at Range 1–2, you may change 1 of your hit results to a critical.' },
  315: { id: 'grove_commandos', name: 'Grove Commandos', text: 'When attacking, you may reroll any of your focus results.' },
  355: { id: 'sorrel_garr', name: 'Sorrel Garr', text: 'When attacking, you may suffer 1 damage to change all of your focus results to criticals.' },
  358: { id: 'magda_yarrow', name: 'Magda Yarrow', text: 'After defending, you may acquire a target lock on the attacker.' },
  // League elite talent
  322: { id: 'shield_bearer', name: 'Shield Bearer', text: 'When a friendly ship at Range 1 is hit, you may discard this card to suffer all of its uncanceled hit results yourself.' },
  // Titles & modifications for League ships
  157: { id: 'test_rig', name: 'Test Rig', grants: ['elite'], minSkill: 2, text: 'Dart only. Your upgrade bar gains an Elite slot.' },
  169: { id: 'gunship_refit', name: 'Gunship Refit', text: 'Bulwark only. You cannot attack ships outside your firing arc. After a primary weapon attack, you may immediately attack with a turret.' },
  184: { id: 'crew_pod', name: 'Crew Pod', grants: ['crew'], text: 'Halberd only. Your upgrade bar gains a Crew slot.' },
  193: { id: 'integrated_drone', name: 'Integrated Drone', text: 'Lancer and Saber only. When you are dealt a Damage card, you may discard 1 of your drones to discard that card.' },
  244: { id: 'night_ace', name: 'Night Ace', minSkill: 7, text: 'Saber only (pilot skill 7+). After you boost or barrel roll, you may remove 1 enemy target lock from a friendly ship at Range 1.' },
  246: { id: 'field_overhaul', name: 'Field Overhaul', text: 'Longbow only. Primary attacks from your front arc roll 1 extra die. From your rear arc, you may change 1 focus result to a critical.' },
  263: { id: 'painted_wasp', name: 'Painted Wasp', grants: ['crew', 'illicit'], text: 'League Wasp only. Your upgrade bar gains a Crew and an Illicit slot.' },
  284: { id: 'stolen_wasp', name: 'Stolen Wasp', text: 'League Wasp only. Enemies with lower pilot skill than you cannot attack you. Discard this after you attack, or when you are the last friendly ship.' },
  360: { id: 'servo_wings', name: 'Servo Wings', text: 'Lancer only. Two-sided. OPEN: gain barrel roll; when not stressed, a revealed 3-turn may be flown as a red 3 Tallon roll. CLOSED: −1 primary attack, gain boost, 2-banks are green. Before you reveal, you may flip it.' },
};

// Condition cards: { [datasetConditionId]: { id, name, text } } (data/conditions.js in the dataset)
export const CONDITIONS = {
  2: { id: 'pinned_down', name: 'Pinned Down', text: 'When you attack a ship other than Captain Rask, roll 1 fewer attack die. Removed when you attack Captain Rask, when Captain Rask is destroyed, or at the end of a round in which Captain Rask did not attack.' },
  6: { id: 'hooked', name: 'Hooked', text: 'When you are hit with at least 1 uncanceled critical, every other ship at Range 1 suffers 1 damage; then discard this and take 1 facedown Damage card. Action: discard this, then roll 1 attack die — on a hit or critical, suffer 1 damage.' },
};
