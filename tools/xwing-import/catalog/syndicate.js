// Batch "syndicate": the Freeport Syndicate's small ships
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: Syndicate pilots & faction upgrades, titles/mods for its ships, and faction-neutral Crew, Illicit, Salvaged Drone and Modification upgrades.
// Cards for this batch go in src/engine/cards/syndicate.js, art in src/render/art/syndicate.js,
// presets in src/data/presets/syndicate.js. See docs/WORKSTREAMS.md → section A.
// The Hammerhead chassis comes from the league batch; this batch only adds pilots for it.
// Extra upgrade fields: grants / grantsOneOf / removes, discount ({ slot: '*' } = every other upgrade), minSkill,
// shieldValue, needsAction, needsSlots, requiresUpgrade.

// ---------------------------------------------------------------- ships
export const SHIPS = {
  21: { id: 'adder',      name: 'Adder',      art: 'adder' },       // sleek, twisting assassin fighter
  22: { id: 'gnat',       name: 'Gnat',       art: 'gnat' },        // cheap swarm interceptor
  27: { id: 'raptor',     name: 'Raptor',     art: 'raptor' },      // heavy-nosed brawler
  35: { id: 'bloodhound', name: 'Bloodhound', art: 'bloodhound' },  // bounty hunter's gunship
  40: { id: 'warden',     name: 'Warden',     art: 'warden' },      // veteran protector's fighter
  43: { id: 'hopper',     name: 'Hopper',     art: 'hopper' },      // four-engine salvage tug
  51: { id: 'gharial',    name: 'Gharial',    art: 'gharial' },     // long-snouted gunship with a narrow kill zone
};

// ---------------------------------------------------------------- pilots
export const PILOTS = {
  // Adder
  98:  { id: 'prince_zirox', name: 'Prince Zirox', text: 'When defending, a friendly ship at Range 1 may take 1 of your uncanceled hit or critical results instead of you.' },
  117: { id: 'gurra', name: 'Gurra', text: 'At the start of the Combat phase, if an enemy ship is at Range 1, you may gain 1 focus token.' },
  118: { id: 'comet_underboss', name: 'Black Comet Underboss' },
  119: { id: 'comet_enforcer', name: 'Black Comet Enforcer' },
  261: { id: 'comet_assassin', name: 'Black Comet Assassin' },
  262: { id: 'dalen_oberon', name: 'Dalen Oberon', text: 'When you reveal a turn, bank or loop while not stressed, you may fly it as a red Tallon roll in the same direction and speed.' },
  263: { id: 'tweek', name: 'Tweek', text: 'At the start of the game, pick an enemy ship: “Shadowed” copies its pilot skill, or “Mimicked” copies its pilot ability for you.' },
  // Sparrow (base ship)
  101: { id: 'ndari_sulek', name: 'Ndari Sulek', text: 'When attacking with no other friendly ship at Range 1–2, roll 1 extra attack die.' },
  107: { id: 'saltreef_pirate', name: 'Saltreef Pirate' },
  108: { id: 'comet_soldier', name: 'Black Comet Soldier' },
  110: { id: 'kato_leech', name: 'Kato Leech', text: 'At the start of the Combat phase, you may take 1 focus or evade token from another friendly ship at Range 1–2.' },
  // Gnat
  102: { id: 'seressa', name: 'Seressa', text: 'When another friendly ship at Range 1 defends, it may reroll 1 defense die.' },
  121: { id: 'laetha_ashe', name: 'Laetha Ashe', text: 'After you defend against an attack that misses, gain 1 evade token.' },
  122: { id: 'freeport_spacer', name: 'Freeport Spacer' },
  125: { id: 'tannery_veteran', name: 'Tannery Point Veteran' },
  243: { id: 'red_genesis', name: '“Red Genesis”', text: 'After you acquire a target lock, gain focus and evade tokens until you have as many of each as the locked ship.' },
  244: { id: 'inalda', name: 'Inalda', text: 'When attacking or defending, you may spend 1 shield to reroll any number of your dice.' },
  245: { id: 'quin_jast', name: 'Quin Jast', text: 'At the start of the Combat phase, you may disable your weapons this round to restore a discarded torpedo or missile card.' },
  246: { id: 'sunny_bounds', name: 'Sunny Bounds', text: 'Once per round, after you roll dice, if every die shows the same result, you may add 1 more of that result.' },
  // Bulwark (base ship)
  109: { id: 'dreya_rent', name: 'Dreya Rent', text: 'After you spend a target lock, you may take 1 stress token to acquire a target lock.' },
  111: { id: 'kavell', name: 'Kavell', text: 'When attacking a ship outside your firing arc, roll 1 extra attack die.' },
  112: { id: 'dockside_thug', name: 'Dockside Thug' },
  126: { id: 'sellsword', name: 'Sellsword' },
  // Courier (base ship)
  114: { id: 'dace_bonner', name: 'Dace Bonner', text: 'When an enemy ship at Range 1–3 is ionized by an attack, if you are not stressed, you may take 1 stress token to make it suffer 1 damage.' },
  115: { id: 'palo_godal', name: 'Palo Godal', text: 'At the start of the Combat phase, you may take 1 focus or evade token from an enemy ship at Range 1–2.' },
  116: { id: 'torvil_mux', name: 'Torvil Mux', text: 'At the start of the Combat phase, pick an enemy ship at Range 1–2: its pilot skill is 0 until the end of the phase.' },
  127: { id: 'smuggler_runner', name: 'Smuggler Runner' },
  // Raptor
  135: { id: 'freeport_marauder', name: 'Freeport Marauder' },
  136: { id: 'comet_ace', name: 'Black Comet Ace' },
  137: { id: 'grall_hunter', name: 'Grall the Hunter', text: 'When defending against an attacker inside your firing arc, roll 1 extra defense die.' },
  138: { id: 'talos_cobra', name: 'Talos Cobra', text: 'When attacking or defending, your range bonus dice are doubled.' },
  253: { id: 'viktor_haal', name: 'Viktor Haal', text: 'After defending, if you did not roll exactly 2 defense dice, the attacker gets 1 stress token.' },
  264: { id: 'captain_jostar', name: 'Captain Jostar', text: 'Once per round, after an enemy ship suffers damage outside an attack against it, you may attack that ship.' },
  // Bloodhound
  162: { id: 'zukas', name: 'Zukas', text: 'When attacking, you may roll 1 extra attack die; if you do, the defender also rolls 1 extra defense die.' },
  182: { id: 'unit_q7', name: 'Unit Q-7', text: 'At the start of the End phase, you may pass 1 of your stress tokens to another ship at Range 1.' },
  188: { id: 'mistfen_tracker', name: 'Mistfen Tracker' },
  189: { id: 'coldeyed_freelancer', name: 'Cold-Eyed Freelancer' },
  // Warden
  197: { id: 'fennick_rowe_syn', name: 'Fennick Rowe', text: 'When attacking or defending against an enemy at Range 1, roll 1 extra die.' },
  206: { id: 'kade_solus', name: 'Kade Solus', text: 'After you execute a red maneuver, gain 2 focus tokens.' },
  207: { id: 'dawnguard_ace', name: 'Dawnguard Ace' },
  208: { id: 'dawnguard_veteran', name: 'Dawnguard Veteran' },
  209: { id: 'old_tereck', name: 'Old Tereck', text: 'At the start of the Combat phase, pick an enemy at Range 1: if you are inside its firing arc, it loses all its focus and evade tokens.' },
  210: { id: 'eager_recruit', name: 'Eager Recruit' },
  // Hopper
  216: { id: 'ungar_plott', name: 'Ungar Plott', text: 'At the start of the Combat phase, every ship you are touching gets a tractor beam token.' },
  233: { id: 'constable_zuvo', name: 'Constable Zuvo', text: 'When you reveal a reverse maneuver, you may drop one of your bombs or mines ahead of you.' },
  234: { id: 'junkyard_gunrunner', name: 'Junkyard Gunrunner' },
  242: { id: 'sarko_plank', name: 'Sarko Plank', text: 'When defending, you may roll as many defense dice as the speed of the maneuver you flew this round, instead of your agility.' },
  // Hammerhead (chassis from the league batch)
  247: { id: 'karst_pirate', name: 'Karst Pirate' },
  256: { id: 'captain_rhone_syn', name: 'Captain Rhone', text: 'Friendly bombs don’t affect you. When a friendly ship defends, if the attack line crosses a friendly bomb, it adds 1 evade result.' },
  258: { id: 'sol_sixa', name: 'Sol Sixa', text: 'After you drop a bomb, you may slide it to the rear-left or rear-right (as if dropped with a 1-turn template).' },
  260: { id: 'lokar_revenant', name: 'Lokar Revenant' },
  // Gharial
  266: { id: 'torin_kulda', name: 'Torin Kulda', text: 'After you attack, each enemy in your bullseye arc at Range 1–3 must either suffer 1 damage or lose all its focus and evade tokens.' },
  273: { id: 'freeport_brute', name: 'Freeport Brute' },
  274: { id: 'dalen_oberon_gharial', name: 'Dalen Oberon', text: 'At the start of the Combat phase, you may lock onto an enemy ship in your bullseye arc at Range 1–3.' },
  282: { id: 'freeport_executioner', name: 'Freeport Executioner' },
};

// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  // Crew (any faction)
  29:  { id: 'fire_engineer', name: 'Fire Engineer', text: 'You may hold a second target lock on a different ship; when attacking that ship, it counts as your lock for rerolls.' },
  40:  { id: 'informant', name: 'Informant', text: 'At the start of the Activation phase, you may look at the chosen maneuver of an enemy ship at Range 1–2.' },
  140: { id: 'bomb_chief', name: 'Bomb Chief', text: 'You drop bombs and mines with a 2-straight template instead of a 1-straight.' },
  252: { id: 'rear_gunner', name: 'Rear Gunner', text: 'When attacking from your rear firing arc, the defender rolls 1 fewer defense die.' },
  281: { id: 'ace_copilot', name: 'Ace Copilot', text: 'When you make a primary attack, the defender must spend 1 focus token if it can. When you defend, the attacker must spend 1 focus token if it can.' },
  287: { id: 'ops_specialist', name: 'Ops Specialist', text: 'After a friendly ship at Range 1–2 attacks and misses, you may give 1 focus token to a friendly ship at Range 1–3 of that attacker.' },
  292: { id: 'rousing_recruit', name: 'Rousing Recruit', text: 'Once per round, when a friendly ship at Range 1–2 clears stress with a green maneuver, it may remove 1 more stress token.' },
  304: { id: 'bosh', name: 'Bosh', text: 'When a ship you are touching becomes active, you may nudge its dial to a neighbouring maneuver; it may fly that maneuver even if red while stressed.' },
  323: { id: 'breach_tech', name: 'Breach Tech', text: 'When you are dealt a faceup Damage card, you may spend your reinforce to turn it facedown; until the end of the round, further faceup cards are turned facedown too.' },
  344: { id: 'pace_droid', name: 'Pace Droid', text: 'During deployment, your pilot skill counts as 8.' },
  // Syndicate crew
  105: { id: 'greel', name: 'Greel', text: 'The first Damage card you deal in your first attack each round, and the first one you are dealt when defending each round, is dealt faceup.' },
  119: { id: 'backalley_mechanic', name: 'Back-alley Mechanic', text: 'After you execute a red maneuver, you may gain 1 focus token.' },
  120: { id: 'sentry_droid', name: 'Sentry Droid', text: 'After you execute a green maneuver, you may acquire a target lock.' },
  131: { id: 'brosk', name: 'Brosk', text: 'After an attack that misses, if you are not stressed, you must take 1 stress token. Then gain 1 focus token and lock onto the defender.' },
  230: { id: 'zukas_crew', name: 'Zukas', text: 'When attacking while not stressed, you may take any number of stress tokens to make the defender reroll that many of its defense dice.' },
  231: { id: 'unit_q7_crew', name: 'Unit Q-7', text: 'When attacking, you may take 1 ion token to pin 1 of the defender’s focus or evade tokens: it can’t be spent during this attack.' },
  238: { id: 'rook_varga', name: 'Rook Varga', text: 'After you attack, if the defender was dealt a faceup Damage card, you may discard this card to discard 1 of the defender’s upgrades.' },
  239: { id: 'plodder', name: '“Plodder”', text: 'Action: Store 1 shield token on this card. Action: Use a stored shield token to recover 1 shield.' },
  240: { id: 'dennick', name: 'Dennick', text: 'When attacking, you may reroll 1 attack die, or up to 2 if the defender is a unique pilot.' },
  257: { id: 'latta_rizz', name: 'Latta Rizz', text: 'When defending, you may remove 1 stress token from the attacker to add 1 evade result.' },
  258: { id: 'kessa_onyx', name: 'Kessa Onyx', text: 'At the start of the End phase, pick an enemy in your firing arc at Range 1–2: it keeps its tractor beam tokens into the next round.' },
  265: { id: 'ungar_crew', name: 'Ungar Plott', text: 'After a maneuver that bumps you into an enemy ship, you may suffer 1 damage to perform a free action.' },
  300: { id: 'fixer_vizz', name: 'Fixer Vizz', text: 'At the start of the End phase, you may discard this card to swap one of your Illicit cards for another Illicit card of equal or lower cost.' },
  316: { id: 'matriarch', name: 'The Matriarch', text: 'Each Illicit card in your squad starts with 1 spare token. The first time one would be discarded, spend its token instead.' },
  325: { id: 'silas_bane', name: 'Silas Bane', grants: ['bomb'], text: 'Your upgrade bar gains a Bomb slot. Once per round, when an enemy rolls attack dice for a friendly bomb or mine, it must reroll its focus and blank results.' },
  343: { id: 'darrok', name: 'Darrok the Horned', text: 'When attacking while not stressed, you may take stress tokens to reroll that many attack dice. After an attack that hits, you may remove 1 stress token.' },
  // Illicit
  107: { id: 'brake_thrusters', name: 'Brake Thrusters', text: 'When you reveal your maneuver, you may discard this card to stop dead instead (white 0). Then take 1 stress token.' },
  113: { id: 'spite_charge', name: 'Spite Charge', text: 'When you are destroyed, every ship at Range 1 suffers 1 damage.' },
  114: { id: 'feedback_coil', name: 'Feedback Coil', text: 'In the Combat phase, instead of attacking, you may take 1 ion token and suffer 1 damage to make an enemy at Range 1 suffer 1 damage.' },
  115: { id: 'snap_blaster', name: 'Snap Blaster', weapon: { discard: true, turret: true }, text: 'Attack: discard this card to attack 1 ship, even outside your firing arc.' },
  130: { id: 'sparkdust', name: 'Sparkdust', text: 'At the start of the Combat phase, you may discard this card and take 1 stress token. This round, when attacking or defending, you may turn all your focus results into hits or evades.' },
  196: { id: 'stolen_cloak', name: 'Stolen Cloak', text: 'Action: Cloak. At the end of each round, roll 1 attack die: on a focus, discard this card and drop your cloak.' },
  262: { id: 'slicer_kit', name: 'Slicer Kit', text: 'Action: Pick a stressed enemy at Range 1–2 and roll 1 attack die. On a hit or critical, it loses 1 stress token and is dealt 1 facedown Damage card.' },
  283: { id: 'ion_pulse_rig', name: 'Ion Pulse Rig', text: 'In the Combat phase, instead of attacking, you may discard this card to give every ship at Range 1 two ion tokens.' },
  293: { id: 'salvage_claw', name: 'Salvage Claw', text: 'After a ship at Range 1–2 is destroyed, you may restore 1 of your discarded torpedo, missile, bomb, cannon, turret or modification cards. Then roll 1 attack die: on a blank, discard this card.' },
  329: { id: 'ion_vents', name: 'Ion Vents', text: 'At the start of the End phase, if you are ionized and an enemy is at Range 1, vent 1 ion token at it (it may decline; your ion token is removed either way).' },
  342: { id: 'blackmarket_implants', name: 'Black-market Implants', text: 'When you become active in the Activation phase, you may discard this card and take 1 stress token. This round you may act and fly red maneuvers while stressed.' },
  // Salvaged drones
  109: { id: 'rattled_droid', name: 'Rattled Droid', text: 'All your speed 3 maneuvers are green.' },
  110: { id: 'wizard_droid', name: '“Wizard”', text: 'After you execute a maneuver without bumping a ship, you may discard 1 of your timed bomb cards to drop that bomb.' },
  112: { id: 'junk_drone', name: 'Junk Drone', text: 'When you are dealt a faceup Ship Damage card, you may discard it (unresolved). Then discard this card.' },
  117: { id: 'farm_drone', name: 'Farm Drone', text: 'When attacking, after you spend a focus token, you may lock onto the defender.' },
  118: { id: 'wrangler_drone', name: 'Wrangler Drone', text: 'When attacking with a lock on the defender, you may spend it to make the defender reroll any of its defense dice.' },
  237: { id: 'spiteful_drone', name: 'Spiteful Drone', text: 'Once per round, after defending, roll 1 attack die: on a hit the attacker suffers 1 damage; on a critical, you and the attacker each suffer 1 damage.' },
  241: { id: 'overclocked_drone', name: 'Overclocked Drone', text: 'In the Combat phase, when you spend a focus token, you may take 1 stress token to gain 1 focus token.' },
  327: { id: 'loader_drone', name: 'Loader Drone', text: 'You may use your torpedo and bomb card actions while stressed. After doing so, you may discard this card to remove 1 stress token.' },
  353: { id: 'rogue_drone', name: 'Rogue Drone', text: 'You may lock onto friendly ships.' },
  // Modifications (any ship)
  178: { id: 'targeting_pod', name: 'Targeting Pod', text: 'Your action bar gains target lock.' },
  179: { id: 'armor_plating', name: 'Armor Plating', text: 'Increase your hull value by 1.' },
  181: { id: 'shroud_accelerator', name: 'Shroud Accelerator', text: 'After you cloak or decloak, you may perform a free evade action.' },
  185: { id: 'jury_interface', name: 'Jury-rigged Interface', text: 'Once per round, after you perform an action, you may use an action from one of your upgrade cards as a free action. Then take 1 stress token.' },
  188: { id: 'jink_thrusters', name: 'Jink Thrusters', needsAction: 'boost', text: 'When defending outside the attacker’s firing arc, or inside it at Range 3, you may change 1 blank result to an evade. Ships with boost only.' },
  189: { id: 'slam_booster', name: 'SLAM Booster', text: 'After a SLAM that doesn’t overlap a ship or asteroid, you may perform a free action from your action bar.' },
  222: { id: 'far_scanners', name: 'Far Scanners', needsSlots: ['torpedo', 'missile'], text: 'You can lock onto ships at Range 3 and beyond, but not at Range 1–2. Ships with Torpedo and Missile slots only.' },
  229: { id: 'seeker_chips', name: 'Seeker Chips', text: 'Once per round, when attacking with a torpedo or missile, you may change 1 die to a hit (or a critical if your primary weapon value is 3 or more).' },
  251: { id: 'vector_thrusters', name: 'Vector Thrusters', text: 'Your action bar gains barrel roll.' },
  309: { id: 'pulse_shield', name: 'Pulse Shield', shieldValue: 1, text: 'During the End phase, you may take 1 ion token to recover 1 shield. Shield value 1 only.' },
  365: { id: 'chameleon_skin', name: 'Chameleon Skin', text: 'When an enemy locks onto you, if it is the only lock on you, roll 1 defense die: on an evade, its lock is broken.' },
  // Syndicate elite / cannon
  108: { id: 'shield_wing', name: 'Shield Wing', text: 'At the start of the Combat phase, you may spend a focus token to give a friendly ship at Range 1 with higher pilot skill +1 agility this round.' },
  236: { id: 'mind_link', name: 'Mind Link', text: 'When you get a stress token, or gain focus from a focus action, each other friendly ship with Mind Link that has none gets one too.' },
  255: { id: 'undaunted', name: 'Undaunted', text: 'When attacking a ship in your firing arc at Range 1 while you are in its firing arc, you may add 1 hit result.' },
  310: { id: 'arc_lancer', name: 'Arc Lancer', weapon: {}, text: 'Attack 1 ship. If it hits, pick another ship at Range 1 of the defender to suffer 1 damage. Then the card needs recharging: at the start of a Combat phase, disable your weapons for the round to recharge it.' },
  // Titles & modifications for Syndicate ships
  165: { id: 'heavy_gnat', name: 'Heavy Gnat', grantsOneOf: ['cannon', 'torpedo', 'missile'], text: 'Gnat only. Gain a Cannon, Torpedo or Missile slot (one of them). +1 hull.' },
  167: { id: 'venom', name: 'Venom', grants: ['system', 'illicit'], minSkill: 4, text: 'Adder only (pilot skill 4+). Your upgrade bar gains a System and an Illicit slot.' },
  209: { id: 'fog_stalker', name: 'Fog Stalker', grants: ['cannon'], requiresUpgrade: 'tractor_projector', text: 'Bloodhound only. Gain barrel roll and a Cannon slot, which must hold a Tractor Projector.' },
  248: { id: 'dawnguard_shield', name: 'Dawnguard Shield', text: 'Warden only. When defending at Range 1, if you and the attacker are in each other’s firing arcs, add 1 evade result.' },
  294: { id: 'tug_beam', name: 'Tug Beam Array', text: 'Hopper only. Action: Give a ship in your firing arc at Range 1 a tractor beam token (you move it, even if it’s friendly).' },
  303: { id: 'light_gnat', name: 'Light Gnat', removes: ['mod'], text: 'Gnat only. Every Damage card you are dealt is faceup. Your banks are green. You can’t fit Modifications.' },
  313: { id: 'mayhem', name: 'Mayhem', grants: ['system', 'salvaged'], removes: ['crew'], text: 'Hammerhead only. Gain a System and a Salvaged Drone slot; lose your Crew slot.' },
  319: { id: 'gilded_raptor', name: 'Gilded Raptor', grants: ['mod', 'mod'], discount: { slot: '*', amount: 1 }, text: 'Raptor only. Each of your other upgrades costs 1 less; you may fit up to 3 different Modifications.' },
  320: { id: 'adder_mk2', name: 'Adder Mk. II', grants: ['title'], text: 'Adder only. You may fit a second Title. Your barrel rolls are angled (forward or back) instead of straight.' },
  332: { id: 'collector', name: 'Collector', text: 'Gharial only. After defending, if the attacker is in your bullseye arc, it gets 1 stress token.' },
};

// Condition cards: { [datasetConditionId]: { id, name, text } }
export const CONDITIONS = {
  4: { id: 'mimicked', name: 'Mimicked', text: 'Tweek has your pilot ability.' },
  5: { id: 'shadowed', name: 'Shadowed', text: 'Tweek’s pilot skill equals your starting pilot skill.' },
};
