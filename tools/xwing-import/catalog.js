// What we import from the community xwing-data set, and what we call it.
//
// Keys are the dataset's numeric ids (data/ships.js, pilots.js, upgrades.js in
// https://github.com/guidokessels/xwing-data). Stats, dials, costs, slots and weapon
// values come from the dataset; names, wording and art are ours (original theme).
// Behaviour for each ability lives in src/engine/cards/* under the same `id`.
//
// To add content: add an entry here, run the build (see README.md in this folder),
// then implement the card in src/engine/cards/*.

export const FACTION_MAP = { 'Rebel Alliance': 'league', 'Galactic Empire': 'dominion' };

export const SLOT_MAP = {
  Elite: 'elite', Torpedo: 'torpedo', Missile: 'missile', Astromech: 'drone', Cannon: 'cannon',
  Turret: 'turret', Crew: 'crew', System: 'system', Modification: 'mod', Title: 'title', Bomb: 'bomb',
};

export const ACTION_MAP = { Focus: 'focus', 'Target Lock': 'lock', 'Barrel Roll': 'roll', Evade: 'evade', Boost: 'boost' };

// ---------------------------------------------------------------- ships
export const SHIPS = {
  0:  { id: 'lancer',  name: 'Lancer',  art: 'lancer' },
  1:  { id: 'bulwark', name: 'Bulwark', art: 'bulwark' },
  2:  { id: 'dart',    name: 'Dart',    art: 'dart' },
  8:  { id: 'courier', name: 'Courier', art: 'courier' },
  10: { id: 'halberd', name: 'Halberd', art: 'halberd' },
  13: { id: 'sparrow', name: 'Sparrow', art: 'sparrow' },
  15: { id: 'rapier',  name: 'Rapier',  art: 'rapier' },
  4:  { id: 'wasp',    name: 'Wasp',    art: 'wasp', faction: 'dominion' },
  5:  { id: 'hornet',  name: 'Hornet',  art: 'hornet' },
  6:  { id: 'talon',   name: 'Talon',   art: 'talon' },
  11: { id: 'beetle',  name: 'Beetle',  art: 'beetle' },
  14: { id: 'mantis',  name: 'Mantis',  art: 'mantis' },
};

// ---------------------------------------------------------------- pilots
// text: our wording. Pilots without `text` are generic (no ability).
export const PILOTS = {
  // Lancer
  0: { id: 'ivo_strand', name: 'Ivo Strand', text: 'When attacking, reduce the defender’s agility by 1 (to a minimum of 0).' },
  1: { id: 'oren_vask', name: 'Oren Vask', text: 'After you spend a focus token, you may give it to another friendly ship at Range 1–2 instead of discarding it.' },
  2: { id: 'crimson_wing', name: 'Crimson Wing Pilot' },
  3: { id: 'fledgling', name: 'Fledgling Pilot' },
  4: { id: 'tobin_hale', name: 'Tobin Hale', text: 'Once per game, at the start of the Combat phase, you may draw fire: until the end of the round, enemies that could attack you cannot attack other friendly ships at Range 1 of you.' },
  5: { id: 'kestrel_vane', name: 'Kestrel Vane', text: 'When defending, you may change 1 of your focus results to an evade result.' },
  // Bulwark
  6: { id: 'anvil_squadron', name: 'Anvil Squadron Pilot' },
  7: { id: 'sela_marrow', name: 'Sela Marrow', text: 'After you acquire a target lock, another friendly ship at Range 1–2 may also acquire a target lock.' },
  8: { id: 'brannoc_teague', name: 'Brannoc Teague', text: 'When attacking at Range 2–3, you may reroll all of your blank results.' },
  9: { id: 'freeholder', name: 'Freeholder Recruit' },
  // Wasp
  10: { id: 'cadet', name: 'Cadet' },
  11: { id: 'shade_squadron', name: 'Shade Squadron Pilot' },
  12: { id: 'night_squadron', name: 'Night Squadron Pilot' },
  13: { id: 'gash', name: '“Gash”', text: 'When attacking at Range 1, you may change 1 of your hit results to a critical result.' },
  14: { id: 'hollow', name: '“Hollow”', text: 'After you execute a green maneuver, you may perform a free focus action.' },
  15: { id: 'vex', name: '“Vex”', text: 'When attacking from outside the defender’s firing arc, roll 1 additional attack die.' },
  16: { id: 'wraith', name: '“Wraith”', text: 'When you are defending, the attacker cannot spend focus tokens or reroll attack dice.' },
  17: { id: 'brute', name: '“Brute”', text: 'When attacking at Range 1, roll 1 additional attack die.' },
  18: { id: 'packleader', name: '“Packleader”', text: 'When another friendly ship at Range 1 attacks with its primary weapon, it may reroll 1 attack die.' },
  // Hornet
  19: { id: 'ostrava', name: 'Commander Ostrava', text: 'When your attack would deal a faceup Damage card, draw 3 instead, deal the worst one and discard the others.' },
  20: { id: 'ember_squadron', name: 'Ember Squadron Pilot' },
  21: { id: 'cinder_squadron', name: 'Cinder Squadron Pilot' },
  22: { id: 'lord_vahl', name: 'Lord Commander Vahl', text: 'During your Perform Action step, you may perform 2 actions.' },
  // Talon
  23: { id: 'razor_squadron', name: 'Razor Squadron Pilot' },
  24: { id: 'spike_squadron', name: 'Spike Squadron Pilot' },
  25: { id: 'scythe_squadron', name: 'Scythe Squadron Pilot' },
  26: { id: 'grimm_varo', name: 'Grimm Varo', text: 'If your Damage cards reach your hull value, you are not destroyed until the end of the Combat phase.' },
  27: { id: 'ilsa_morrow', name: 'Ilsa Morrow', text: 'After you perform an attack, you may perform a free boost or barrel roll action.' },
  28: { id: 'baron_kessick', name: 'Baron Kessick', text: 'When you receive a stress token, you may also gain 1 focus token.' },
  // Dart
  29: { id: 'juno_arkady', name: 'Juno Arkady', text: 'You may perform actions even while you have stress tokens.' },
  30: { id: 'pell_rusk', name: 'Pell Rusk', text: 'You may attack an enemy ship inside your firing arc even while your bases are touching.' },
  31: { id: 'swiftwind', name: 'Swiftwind Pilot' },
  32: { id: 'testbed', name: 'Testbed Pilot' },
  // Halberd
  41: { id: 'odo_ravel', name: 'Odo Ravel', text: 'When attacking, 1 of your critical results cannot be canceled by defense dice.' },
  42: { id: 'nadia_fenn', name: 'Nadia Fenn', text: 'When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice.' },
  43: { id: 'pike_squadron', name: 'Pike Squadron Pilot' },
  44: { id: 'ironside_squadron', name: 'Ironside Squadron Pilot' },
  // Courier
  45: { id: 'courier_runner', name: 'Courier Runner' },
  46: { id: 'yara_lisk', name: 'Yara Lisk', text: 'At the start of the Combat phase, choose another friendly ship at Range 1–3. Until the end of the phase, its pilot skill is 12.' },
  47: { id: 'bram_talley', name: 'Bram Talley', text: 'At the start of the Combat phase, you may give 1 of your focus tokens to another friendly ship at Range 1–3.' },
  48: { id: 'cass_varrin', name: 'Cass Varrin', text: 'When another friendly ship at Range 1–3 attacks, if you are not stressed, you may take 1 stress token to let it roll 1 additional attack die.' },
  // Beetle
  49: { id: 'crescent_squadron', name: 'Crescent Squadron Pilot' },
  50: { id: 'hammer_squadron', name: 'Hammer Squadron Pilot' },
  51: { id: 'captain_vorne', name: 'Captain Vorne', text: 'When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice.' },
  52: { id: 'major_taal', name: 'Major Taal', text: 'When attacking with a secondary weapon, you may extend or shorten its range by 1 (within Range 1–3).' },
  // Sparrow
  63: { id: 'scrapper', name: 'Scrapper Pilot' },
  64: { id: 'patrol', name: 'Patrol Pilot' },
  65: { id: 'rook_halloran', name: 'Rook Halloran', text: 'Your attacks always count as hitting the defender, even if it suffers no damage.' },
  66: { id: 'mae_coll', name: 'Lieutenant Mae Coll', text: 'After you perform an attack, you may choose another friendly ship at Range 1. It may perform 1 free action.' },
  // Mantis
  67: { id: 'shroud_squadron', name: 'Shroud Squadron Pilot' },
  68: { id: 'sable_squadron', name: 'Sable Squadron Pilot' },
  69: { id: 'colonel_drath', name: 'Colonel Drath', text: 'When attacking, right after rolling, you may acquire a target lock on the defender if another friendly ship already has it locked.' },
  70: { id: 'ardan_voss', name: 'Colonel Ardan Voss', text: 'After your attack deals at least 1 Damage card, you may spend a focus token to flip those cards faceup.' },
  // Rapier
  71: { id: 'duelist_squadron', name: 'Duelist Squadron Pilot' },
  72: { id: 'fencer_squadron', name: 'Fencer Squadron Pilot' },
  73: { id: 'oriel_sabe', name: 'Commander Oriel Sabe', text: 'When an enemy ship inside your firing arc at Range 1–3 is defending, its attacker may change 1 hit result to a critical result.' },
  74: { id: 'tam_keller', name: 'Tam Keller', text: 'At the start of the End phase, you may perform 1 attack. If you do, you cannot attack during the next round.' },
};

// ---------------------------------------------------------------- upgrades
// weapon: { cost: 'lock'|'focus'|null, spend: bool, discard: bool, turret: bool } merged with dataset attack/range.
export const UPGRADES = {
  // Drones (astromech slot)
  2:   { id: 'nav_drone', name: 'Nav Drone', text: 'Treat all speed 1 and 2 maneuvers as green.' },
  3:   { id: 'repair_drone', name: 'Repair Drone', text: 'After you execute a green maneuver, you may recover 1 shield (up to your shield value).' },
  4:   { id: 'deflector_drone', name: 'Deflector Drone', text: 'Action: Increase your agility by 1 until the end of this round.' },
  5:   { id: 'patch_drone', name: 'Patch Drone', text: 'Action: Roll 1 defense die. On an evade or focus, discard 1 of your facedown Damage cards.' },
  6:   { id: 'tracker_drone', name: 'Tracker Drone', text: 'After you spend a target lock, roll 1 defense die. On an evade, immediately re-acquire a lock on that ship (it can’t be spent during this attack).' },
  7:   { id: 'maintenance_drone', name: 'Maintenance Drone', text: 'During the End phase, you may flip 1 of your faceup Ship-trait Damage cards facedown.' },
  59:  { id: 'jammer_drone', name: 'Jammer Drone', text: 'Once per round when defending, if you have a lock on the attacker, you may spend it to make the attacker reroll all of its hit and critical results.' },
  60:  { id: 'hunter_drone', name: 'Hunter Drone', text: 'Action: Choose an enemy at Range 1–2. If you are inside its firing arc, acquire a target lock on it. Then you may perform a free boost action.' },
  144: { id: 'gyro_drone', name: 'Gyro Drone', text: 'When you reveal a green maneuver, you may perform a free barrel roll action.' },
  145: { id: 'pathfinder_drone', name: 'Pathfinder Drone', text: 'Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round.' },
  // Cannons
  22:  { id: 'ion_projector', name: 'Ion Projector', weapon: {}, text: 'Attack 1 ship. If this attack hits, the defender suffers 1 damage and receives 1 ion token instead of normal damage.' },
  23:  { id: 'heavy_lance', name: 'Heavy Lance Cannon', weapon: {}, text: 'Attack 1 ship. Right after rolling, change all of your critical results to hit results.' },
  35:  { id: 'rotary_blaster', name: 'Rotary Blaster', weapon: {}, text: 'Attack 1 ship. Your hit results cannot be canceled. The defender may cancel critical results before hit results.' },
  // Crew
  21:  { id: 'tail_gunner', name: 'Tail Gunner', text: 'After an attack that misses, you may immediately perform a primary weapon attack. You cannot attack again this round.' },
  25:  { id: 'hired_copilot', name: 'Hired Copilot', text: 'When attacking at Range 3, you may change 1 of your hit results to a critical result.' },
  31:  { id: 'ace_gunner', name: 'Ace Gunner', text: 'After an attack that misses, you may immediately perform a primary weapon attack and change 1 focus result to a hit. You cannot attack again this round.' },
  32:  { id: 'veteran_copilot', name: 'Veteran Co-pilot', text: 'Treat all straight maneuvers as green.' },
  33:  { id: 'loyal_mechanic', name: 'Loyal Mechanic', text: 'The first time you are dealt a Damage card, discard it and recover 1 shield. Then discard this card.' },
  38:  { id: 'scout_officer', name: 'Scout Officer', text: 'When you perform a focus action, gain 1 additional focus token.' },
  39:  { id: 'demolitions_expert', name: 'Demolitions Expert', text: 'Action: Choose an enemy at Range 1 and roll 1 attack die. On a hit or critical, flip 1 random facedown Damage card on it faceup and resolve it.' },
  47:  { id: 'drill_instructor', name: 'Drill Instructor', text: 'When defending, you may reroll 1 focus result. If the attacker’s pilot skill is 2 or lower, you may reroll 1 blank result instead.' },
  48:  { id: 'astrogator', name: 'Astrogator', text: 'When you reveal a maneuver, you may switch to another maneuver with the same bearing (not red while stressed).' },
  61:  { id: 'fire_coordinator', name: 'Fire Coordinator', text: 'After you attack a ship inside your firing arc at Range 2, it receives 1 stress token.' },
  // Elite talents
  8:   { id: 'iron_will', name: 'Iron Will', text: 'When you are dealt a faceup Damage card with the Pilot trait, discard it without resolving it.' },
  9:   { id: 'pack_tactics', name: 'Pack Tactics', text: 'At the start of the Combat phase, choose a friendly ship at Range 1. Until the end of the phase, its pilot skill equals yours.' },
  10:  { id: 'wing_commander', name: 'Wing Commander', text: 'Action: Choose a ship at Range 1–2 with lower pilot skill than yours. It may perform 1 free action.' },
  11:  { id: 'snap_roll', name: 'Snap Roll', text: 'Action: Perform a free barrel roll (take 1 stress if you lack the barrel roll action). Then you may remove 1 enemy lock from your ship.' },
  12:  { id: 'deadeye', name: 'Deadeye', text: 'Action: When attacking this round, you may change 1 focus result to a critical and all other focus results to hits.' },
  15:  { id: 'hotdog', name: 'Hotdog', text: 'Action: Execute a white 1 turn (left or right) and take 1 stress. If you lack the boost action, roll 2 attack dice and suffer any hits.' },
  16:  { id: 'slippery', name: 'Slippery', text: 'When defending, if you have no stress, you may take 1 stress to make the attacker reroll 1 attack die.' },
  18:  { id: 'redline', name: 'Redline', text: 'Once per round, after you perform an action, you may perform 1 free action from your action bar. Then take 1 stress.' },
  19:  { id: 'improviser', name: 'Improviser', text: 'Weapons that need a target lock can use a focus token instead (spend the focus where they would spend the lock).' },
  20:  { id: 'all_in', name: 'All In', text: 'Action: Until the end of the round, increase your primary weapon by 1 and decrease your agility by 1.' },
  27:  { id: 'battle_reflexes', name: 'Battle Reflexes', text: 'Increase your pilot skill by 2.' },
  30:  { id: 'take_the_hit', name: 'Take the Hit', text: 'When a friendly ship at Range 1 is hit, you may suffer 1 of its uncanceled critical results instead.' },
  42:  { id: 'adrenaline_surge', name: 'Adrenaline Surge', text: 'When you reveal a red maneuver, you may discard this card to treat it as white this round.' },
  54:  { id: 'steady_wingmate', name: 'Steady Wingmate', text: 'At the start of the Combat phase, remove 1 stress token from another friendly ship at Range 1.' },
  55:  { id: 'swap_signal', name: 'Swap Signal', text: 'At the start of the Combat phase, you may swap pilot skills with a friendly ship at Range 1–2 until the end of the phase.' },
  56:  { id: 'flank_angle', name: 'Flank Angle', text: 'When attacking a ship inside your firing arc, if you are outside its firing arc, reduce its agility by 1 (minimum 0).' },
  57:  { id: 'hunters_eye', name: 'Hunter’s Eye', text: 'When attacking, you may reroll 1 attack die. If the defender’s pilot skill is 2 or lower, you may reroll up to 2.' },
  148: { id: 'live_wire', name: 'Live Wire', text: 'When attacking or defending while stressed, you may reroll any of your focus results.' },
  // Missiles
  13:  { id: 'shock_missiles', name: 'Shock Missiles', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. You may change 1 blank result to a hit.' },
  14:  { id: 'swarm_rockets', name: 'Swarm Rockets', weapon: { cost: 'lock', spend: true, discard: true, twice: true }, text: 'Attack (lock): spend your lock and discard this card to attack twice.' },
  17:  { id: 'tracker_missiles', name: 'Tracker Missiles', weapon: { cost: 'lock', spend: false, discard: true }, text: 'Attack (lock): discard this card (keep your lock). The defender cannot spend evade tokens during this attack.' },
  26:  { id: 'burst_missiles', name: 'Burst Missiles', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. If it hits, each other ship at Range 1 of the defender suffers 1 damage.' },
  53:  { id: 'ion_rockets', name: 'Ion Rockets', weapon: { cost: 'lock', spend: false, discard: true }, text: 'Attack (lock): discard this card. If it hits, the defender suffers 1 damage and receives 2 ion tokens instead of normal damage.' },
  // Modifications
  174: { id: 'baffle_plating', name: 'Baffle Plating', text: 'Increase your agility by 1. Discard this card when you are hit.' },
  175: { id: 'reinforced_shields', name: 'Reinforced Shields', text: 'Increase your shield value by 1.' },
  176: { id: 'afterburners', name: 'Afterburners', text: 'Your action bar gains the boost action.' },
  180: { id: 'safety_interlock', name: 'Safety Interlock', text: 'Secondary weapons that discard themselves are only discarded if the attack hits.' },
  // Systems
  36:  { id: 'fire_control', name: 'Fire Control Computer', text: 'After you perform an attack, you may acquire a target lock on the defender.' },
  43:  { id: 'longrange_scanner', name: 'Long-Range Scanner', text: 'Right before you reveal your maneuver, you may perform 1 free action. If you do, skip your Perform Action step this round.' },
  44:  { id: 'scrambler', name: 'Scrambler', text: 'When defending, you may change 1 of the attacker’s hit results to a focus result. The attacker cannot reroll that die.' },
  // Title
  153: { id: 'wanderer', name: 'Wanderer', text: 'Courier only. During the End phase, keep your unused focus tokens.' },
  // Torpedoes
  1:   { id: 'seeker_torpedo', name: 'Seeker Torpedoes', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. You may change 1 focus result to a critical.' },
  34:  { id: 'breacher_torpedoes', name: 'Breacher Torpedoes', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. You may change up to 3 blank results to focus results.' },
  58:  { id: 'shrapnel_torpedoes', name: 'Shrapnel Torpedoes', weapon: { cost: 'lock', spend: true, discard: true }, text: 'Attack (lock): spend your lock and discard this card. Afterwards, the defender receives 1 stress if its hull value is 4 or lower.' },
  // Turrets
  0:   { id: 'ion_turret', name: 'Ion Turret', weapon: { turret: true }, text: 'Attack 1 ship, even outside your firing arc. If it hits, the defender suffers 1 damage and receives 1 ion token instead of normal damage.' },
  37:  { id: 'swivel_blaster', name: 'Swivel Blaster', weapon: { cost: 'focus', spend: true, turret: true }, text: 'Attack (focus): spend 1 focus token to attack 1 ship, even outside your firing arc.' },
};
