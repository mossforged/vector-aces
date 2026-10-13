// Batch "large": every first-edition LARGE ship (80 mm base) for all three factions, their pilots,
// large-only upgrades and titles, plus the docking / reserve cards that needed a large carrier.
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// Cards: src/engine/cards/large.js · art: src/render/art/large.js · presets: src/data/presets/large.js
// Extra pilot fields: skill / cost (override), hidden (not buyable; e.g. a reserve ship).
// Extra upgrade fields: docksTo (this ship starts docked on a friendly ship carrying that upgrade),
// spawns (brings a hidden reserve ship of that pilot), grants, discount, etc. as in the other batches.

// ---------------------------------------------------------------- ships
export const SHIPS = {
  3:  { id: 'hauler',      name: 'Hauler',      art: 'hauler' },       // saucer freighter with a dorsal turret
  7:  { id: 'lantern',     name: 'Lantern',     art: 'lantern' },      // upright patrol craft with a tail gun
  9:  { id: 'heron',       name: 'Heron',       art: 'heron' },        // folding-wing command shuttle
  19: { id: 'drifter',     name: 'Drifter',     art: 'drifter' },      // offset-cockpit freighter with a turret
  20: { id: 'bastille',    name: 'Bastille',    art: 'bastille' },     // armoured gunship with a turret
  23: { id: 'mandible',    name: 'Mandible',    art: 'mandible' },     // droid hunter's assault craft
  26: { id: 'hulk',        name: 'Hulk',        art: 'hulk' },         // slaver's heavy hauler, wide arc
  32: { id: 'hearth',      name: 'Hearth',      art: 'hearth' },       // rebel freighter that carries a shuttle
  34: { id: 'leaper',      name: 'Leaper',      art: 'leaper' },       // asymmetric scout with a turret
  41: { id: 'prowler',     name: 'Prowler',     art: 'prowler' },      // pursuit craft with a rotating gun
  42: { id: 'raven',       name: 'Raven',       art: 'raven' },        // tall-winged command shuttle
  45: { id: 'pelican',     name: 'Pelican',     art: 'pelican' },      // troop carrier with pivoting wings
  54: { id: 'thunderhead', name: 'Thunderhead', art: 'thunderhead' },  // heavy bomber with a turret
};

// ---------------------------------------------------------------- pilots
export const PILOTS = {
  // Hauler (League)
  33:  { id: 'rimward_smuggler', name: 'Rimward Smuggler' },
  34:  { id: 'chorrbak', name: 'Chorrbak', text: 'When you are dealt a faceup Damage card, turn it facedown at once (without resolving it).' },
  35:  { id: 'landry_calver', name: 'Landry Calver', text: 'After you execute a green maneuver, another friendly ship at Range 1 may perform 1 free action from its action bar.' },
  36:  { id: 'jax_solent', name: 'Jax Solent', text: 'When attacking, you may reroll all of your dice; if you do, you must reroll as many as you can.' },
  195: { id: 'wren_solace_pilot', name: 'Wren Solace', text: 'When attacking or defending against an enemy inside your firing arc, you may reroll up to 2 of your blank results.' },
  219: { id: 'jax_solent_old', name: 'Jax Solent', text: 'At the start of the game, you may relocate anywhere beyond Range 3 of every enemy ship.' },
  220: { id: 'chorrbak_old', name: 'Chorrbak', text: 'After another friendly ship at Range 1–3 is destroyed (not by fleeing), you may perform an attack.' },
  224: { id: 'colony_sympathizer', name: 'Colony Sympathizer' },
  // Lantern (Dominion)
  37:  { id: 'vada_scarlow', name: 'Vada Scarlow', text: 'When attacking, if the defender cancels at least 1 critical result, it gets 1 stress token.' },
  38:  { id: 'bram_kosk', name: 'Bram Kosk', text: 'When you reveal a bank, you may switch to the bank of the same speed in the other direction.' },
  39:  { id: 'krass_trellan', name: 'Krass Trellan', text: 'When attacking with a secondary weapon, you may reroll 1 attack die.' },
  40:  { id: 'bounty_tracker', name: 'Bounty Tracker' },
  // Lantern (Syndicate)
  97:  { id: 'bram_kosk_syn', name: 'Bram Kosk', text: 'When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1.' },
  99:  { id: 'vada_scarlow_syn', name: 'Vada Scarlow', text: 'When attacking a ship inside your rear firing arc, roll 1 extra attack die.' },
  100: { id: 'emin_azzar', name: 'Emin Azzar', text: 'After you drop a bomb, you may push it further out (3 straight behind you, or to either rear corner).' },
  113: { id: 'clan_mercenary', name: 'Clan Mercenary' },
  // Heron (Dominion)
  53:  { id: 'captain_kagen', name: 'Captain Kagen', text: 'When an enemy ship acquires a target lock, it must lock onto you if it can.' },
  54:  { id: 'colonel_jedran', name: 'Colonel Jedran', text: 'At the start of the Combat phase, you may hand your target lock to a friendly ship at Range 1 that has none.' },
  55:  { id: 'captain_yorrick', name: 'Captain Yorrick', text: 'When another friendly ship at Range 1–2 gets a stress token, if you have 2 or fewer, you may take it instead.' },
  56:  { id: 'corvid_group', name: 'Corvid Group Pilot' },
  // Drifter (League)
  89:  { id: 'dace_rendell_pilot', name: 'Dace Rendell', text: 'You may ignore asteroids during the Activation phase and when performing actions.' },
  92:  { id: 'lebo_pilot', name: '“Lebo”', text: 'When you are dealt a faceup Damage card, draw 1 more and keep the milder of the two.' },
  93:  { id: 'aden_vrill', name: 'Aden Vrill', text: 'When making a primary attack against a stressed ship, roll 1 extra attack die.' },
  96:  { id: 'deepspace_fringer', name: 'Deep Space Fringer' },
  // Bastille (Dominion)
  90:  { id: 'admiral_chiran_pilot', name: 'Rear Admiral Chiran', text: 'When attacking at Range 1–2, you may change 1 of your focus results to a critical.' },
  91:  { id: 'captain_oican', name: 'Captain Oican', text: 'After you execute a maneuver, every enemy ship you are touching suffers 1 damage.' },
  94:  { id: 'commander_kenrick', name: 'Commander Kenrick', text: 'While you have no shields and at least 1 Damage card, your agility is increased by 1.' },
  95:  { id: 'watch_commander', name: 'Watch Commander' },
  // Mandible (Syndicate)
  103: { id: 'unit_h9a', name: 'Unit H-9A', text: 'After your attack destroys the defender, you may recover 1 shield.' },
  104: { id: 'unit_h9b', name: 'Unit H-9B', text: 'Once per round, after an attack that misses, you may attack with one of your cannons.' },
  105: { id: 'unit_h9c', name: 'Unit H-9C', text: 'After you boost, you may perform a free evade action.' },
  106: { id: 'unit_h9d', name: 'Unit H-9D', text: 'You may fly your 3 Segnor’s loops with a 3-turn template instead of a 3-bank.' },
  // Hulk (Syndicate)
  131: { id: 'scaled_slaver', name: 'Scaled Slaver' },
  132: { id: 'latta_rizz_pilot', name: 'Latta Rizz', text: 'When a friendly ship declares an attack, you may spend your target lock on the defender to reduce its agility by 1 for that attack.' },
  133: { id: 'brosk_pilot', name: 'Brosk', text: 'When attacking, you may trade 1 of your critical results for 2 hit results.' },
  146: { id: 'moraly_evan', name: 'Moraly Evan', text: 'Your cannons may fire at ships inside your wide (180°) firing arc.' },
  // Hearth (League)
  160: { id: 'hesta_vael_hearth', name: 'Hesta Vael', text: 'When you reveal a green or red maneuver, you may switch to another maneuver of the same colour.' },
  172: { id: 'sprocket_pilot', name: '“Sprocket”', text: 'At the start of the Combat phase, each enemy ship you are touching gets 1 stress token.' },
  173: { id: 'kaen_jarro_pilot', name: 'Kaen Jarro', text: 'When an enemy ship at Range 1–2 attacks one of your ships, you may spend a focus token to make it roll 1 fewer attack die.' },
  186: { id: 'frontier_rebel', name: 'Frontier Rebel' },
  // Leaper (Syndicate)
  161: { id: 'dennick_pilot', name: 'Dennick', text: 'Once per round, after defending, if the attacker is inside your firing arc, you may attack it.' },
  183: { id: 'contract_scout', name: 'Contract Scout' },
  184: { id: 'manara', name: 'Manara', text: 'At the start of the Combat phase, you may hand all your focus, evade and target lock tokens to another friendly ship at Range 1.' },
  185: { id: 'tal_trevan', name: 'Tal Trevan', text: 'The first time you would be destroyed, cancel the remaining damage, discard all your Damage cards and take 4 facedown Damage cards instead.' },
  // Prowler (Syndicate)
  198: { id: 'sabra_wenn_prowler', name: 'Sabra Wenn', text: 'When defending against an enemy inside your mobile firing arc at Range 1–2, you may add 1 focus result.' },
  200: { id: 'kessa_onyx_pilot', name: 'Kessa Onyx', text: 'At the start of the Combat phase, you may give a ship at Range 1 inside both your front and mobile arcs a tractor beam token.' },
  211: { id: 'ysolde_venn', name: 'Ysolde Venn', text: 'At the start of the Combat phase, you may give a ship at Range 1–2 inside your mobile firing arc 1 stress token.' },
  213: { id: 'shadowdock_hunter', name: 'Shadowdock Hunter' },
  // Raven (Dominion)
  215: { id: 'vorrak_raven', name: 'Knight-Commander Vorrak', text: 'The first time you are hit by an attack each round, the attacker gets the “Dark Mark” condition.' },
  228: { id: 'major_strand', name: 'Major Strand', text: 'For your actions and upgrade cards, friendly ships at Range 2–3 count as being at Range 1.' },
  229: { id: 'lt_dorman', name: 'Lieutenant Dorman', text: 'At the start of the game, you may move 1 other friendly ship to Range 1 of you.' },
  230: { id: 'ironpeak_base', name: 'Ironpeak Base Pilot' },
  // Pelican (League)
  217: { id: 'casso_andrel_pilot', name: 'Casso Andrel', text: 'At the start of the Activation phase, you may remove 1 stress token from another friendly ship at Range 1–2.' },
  227: { id: 'azure_pathfinder', name: 'Azure Pathfinder' },
  231: { id: 'bodo_rake_pilot', name: 'Bodo Rake', text: 'When a friendly ship acquires a target lock, it may lock onto an enemy at Range 1–3 of any friendly ship.' },
  232: { id: 'hef_tobin', name: 'Hef Tobin', text: 'After an enemy ship bumps into you, you may perform a free action.' },
  287: { id: 'sorrel_garr_pilot', name: 'Sorrel Garr', text: 'When another friendly ship at Range 1–2 attacks while stressed or damaged, it may reroll 1 attack die.' },
  288: { id: 'benno_tubb', name: 'Benno Tubb', text: 'After you perform a focus action, you may pass 1 of your focus tokens to a friendly ship at Range 1–2.' },
  295: { id: 'free_partisan', name: 'Free Partisan' },
  296: { id: 'magda_yarrow_pilot', name: 'Magda Yarrow', text: 'When another ship at Range 1–2 defends, its attacker may reroll at most 1 attack die.' },
  // Thunderhead (League)
  269: { id: 'scarlet_lead', name: '“Scarlet Lead”', text: 'When attacking a ship inside your firing arc, you may spend 1 hit or critical result to give it the “Shaken” condition.' },
  278: { id: 'scarlet_squadron', name: 'Scarlet Squadron Pilot' },
  279: { id: 'scarlet_specialist', name: '“Scarlet Specialist”', text: 'After you drop a bomb when revealing your maneuver, you may move it to touch any side of your ship.' },
  280: { id: 'azure_lead', name: '“Azure Lead”', text: 'When attacking a defender at Range 1 of a bomb or mine, it rolls 1 fewer defense die.' },
  // Reserve ship that comes with Hound's Lair (Sparrow chassis, not buyable)
  134: { id: 'pup_pilot', name: 'Pup Pilot', skill: 0, cost: 0, hidden: true, text: 'Comes with Hound’s Lair. Uses the pilot skill and ability of the destroyed carrier.' },
};

// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  // Titles for large ships
  132: { id: 'hounds_lair', name: 'Hound’s Lair', spawns: 'pup_pilot', text: 'Hulk only. When you are destroyed, you may launch your Pup Pilot fighter in your place (it can’t attack that round).' },
  151: { id: 'jaws', name: 'Jaws', grants: ['torpedo'], text: 'Lantern only. Your upgrade bar gains a Torpedo slot.' },
  152: { id: 'old_reliable', name: 'Old Reliable', text: 'Hauler only. Your action bar gains evade.' },
  243: { id: 'old_reliable_mk2', name: 'Old Reliable Mk. II', text: 'Hauler only. After a 3-bank, if you are not touching a ship or stressed, you may take 1 stress token to spin 180°.' },
  154: { id: 'signet', name: 'Signet', text: 'Heron only. You may lock onto any enemy ship on the table.' },
  163: { id: 'wayward', name: 'Wayward', text: 'Drifter only. While you have a cannon, you can’t make primary attacks, but your cannons fire outside your firing arc.' },
  164: { id: 'unyielding', name: 'Unyielding', text: 'Bastille only. After a maneuver that bumps you into a ship, you may perform a free action. Then take 1 stress token.' },
  166: { id: 'hunter_network', name: 'Hunter Network', text: 'Mandible only. You also have the pilot abilities of every other friendly ship with Hunter Network.' },
  168: { id: 'iron_maiden', name: 'Iron Maiden', grants: ['bomb', 'bomb'], text: 'Lantern only. Your upgrade bar gains two Bomb slots.' },
  194: { id: 'hard_bargain', name: 'Hard Bargain', text: 'Leaper only. Increase your primary weapon value by 1.' },
  198: { id: 'mothership', name: 'Mothership', text: 'Hearth only. A friendly Skiff with Lifeboat starts docked on you; after you execute a maneuver, you may launch it from your rear. While it is docked you gain a rear firing arc, and after combat you may make an extra turret attack.' },
  333: { id: 'mothership_ii', name: 'Mothership II', text: 'Hearth only. A friendly Tern with Lifeboat II starts docked on you; after you execute a maneuver, you may launch it from your rear. While it is docked you gain a rear firing arc, and after the Activation phase you may coordinate for free.' },
  249: { id: 'shadow_hook', name: 'Shadow Hook', text: 'Prowler only. After an attack that hits a defender inside your mobile arc at Range 1–2, you may give it a tractor beam token.' },
  266: { id: 'black_raven', name: 'Black Raven', text: 'Raven only. After combat, pick an unstressed enemy at Range 1–2: its player gives 1 stress token to it or to another of their ships at Range 1–2 of you.' },
  271: { id: 'pivot_wings', name: 'Pivot Wings', text: 'Pelican only. Two-sided. OPEN: +1 agility. LANDING: when you reveal a full stop, you may spin 180°. After you execute a maneuver, you may flip it.' },
  348: { id: 'crossfire_drill', name: 'Crossfire Drill', text: 'Thunderhead only. When defending, if another friendly ship is at Range 1–2 of the attacker, you may add 1 focus result.' },
  // Docking titles for the small shuttles (dock on a Hearth)
  197: { id: 'lifeboat', name: 'Lifeboat', docksTo: 'mothership', text: 'Skiff only. You start the game docked on a friendly Hearth with Mothership.' },
  334: { id: 'lifeboat_ii', name: 'Lifeboat II', docksTo: 'mothership_ii', text: 'Tern only. You start the game docked on a friendly Hearth with Mothership II.' },
  // Modifications (large ships)
  177: { id: 'rear_lasers', name: 'Rear Lasers', text: 'Large ships only. After an enemy ship bumps into you, roll 1 attack die: on a hit or critical, it suffers 1 damage.' },
  186: { id: 'chaff_pods', name: 'Chaff Pods', text: 'Large ships only. At the start of the Combat phase, you may discard this card for +1 agility this round; then you may break 1 enemy lock on you.' },
  187: { id: 'screen_jammer', name: 'Screen Jammer', text: 'Large ships only. Your ship obstructs enemy attacks that pass through it.' },
  191: { id: 'steering_fins', name: 'Steering Fins', text: 'Hulk only. When you reveal a turn, you may fly the bank of the same speed and direction instead.' },
  192: { id: 'ion_wake', name: 'Ion Wake Emitter', text: 'Large ships only. After an enemy ship bumps into you, roll 1 attack die: on a hit or critical, it gets 1 ion token.' },
  261: { id: 'gyro_mount', name: 'Gyro Mount', text: 'Prowler only. After combat, if you flew a speed 3–5 maneuver this round, you may rotate your mobile arc.' },
  273: { id: 'hidden_hold', name: 'Hidden Hold', grants: ['illicit', 'mod'], text: 'Hauler and Drifter only. Gain an Illicit slot and a second Modification slot.' },
  349: { id: 'blast_plating', name: 'Blast Plating', text: 'Thunderhead only. Friendly bombs don’t affect you; each time you ignore one, roll 1 attack die — on a hit, discard this card.' },
  // System / Illicit / Bomb (large ships)
  213: { id: 'reactive_deflectors', name: 'Reactive Deflectors', text: 'Large ships only. After defending, if you suffered 3 or more damage in the attack, recover 1 shield.' },
  260: { id: 'cargo_dump', name: 'Cargo Dump', text: 'Large ships only. Action: discard this card to dump a cargo cloud behind you. A ship that moves into it takes 1 stress token and rolls 1 attack die (a critical deals 1 critical damage).' },
  274: { id: 'burnout_thrusters', name: 'Burnout Thrusters', text: 'Large ships only. Your action bar gains SLAM. Discard this card after you SLAM.' },
  335: { id: 'bomb_silos', name: 'Bomb Silos', text: 'Thunderhead only. Each of your other bomb cards starts with 3 spare rounds; spend one instead of discarding the card.' },
  // Crew that needed a large ship
  256: { id: 'hunter_link', name: 'Hunter Link', text: 'You also have the pilot ability of every friendly ship with Hunter Network.' },
};

// Condition cards
export const CONDITIONS = {
  7: { id: 'shaken', name: 'Shaken', text: 'The next time a bomb damages you, you suffer 1 extra critical damage; then remove this. Action: roll 1 attack die — on a focus or hit, remove this.' },
};
