// Shared mappings from the community xwing-data set's vocabulary to ours.
// Content tables live in ./catalog/*.js (one file per batch so chats can work in parallel).

// First edition folds the sequel-era sub-factions into the two main sides.
export const FACTION_MAP = { 'Rebel Alliance': 'league', Resistance: 'league', 'Galactic Empire': 'dominion', 'First Order': 'dominion', 'Scum and Villainy': 'syndicate' };

export const SLOT_MAP = {
  Elite: 'elite', Torpedo: 'torpedo', Missile: 'missile', Astromech: 'drone', Cannon: 'cannon',
  Turret: 'turret', Crew: 'crew', System: 'system', Modification: 'mod', Title: 'title', Bomb: 'bomb',
  Illicit: 'illicit', Tech: 'tech', 'Salvaged Astromech': 'salvaged',
};

// Our damage card id → the dataset's card name (for the "original names" toggle only).
export const DAMAGE_ORIGINALS = {
  direct_hit: 'Direct Hit!', ruptured_plating: 'Structural Damage', engine_fault: 'Damaged Engine',
  thruster_fire: 'Thrust Control Fire', console_blaze: 'Console Fire', weapons_fault: 'Weapon Malfunction',
  hull_breach: 'Minor Hull Breach', munitions_jam: 'Munitions Failure', sensor_burnout: 'Damaged Sensor Array',
  minor_explosion: 'Minor Explosion', blinded: 'Blinded Pilot', smoke_cockpit: 'Damaged Cockpit',
  dazed: 'Stunned Pilot', head_wound: 'Injured Pilot',
};

export const ACTION_MAP = {
  Focus: 'focus', 'Target Lock': 'lock', 'Barrel Roll': 'roll', Evade: 'evade', Boost: 'boost',
  SLAM: 'slam', Cloak: 'cloak', Reload: 'reload', Jam: 'jam', Coordinate: 'coordinate', Reinforce: 'reinforce', 'Rotate Arc': 'rotate',
};

export const ARC_MAP = { Front: 'front', 'Auxiliary Rear': 'rear', 'Auxiliary 180': 'front180', Turret: 'turret', Bullseye: 'bullseye', Mobile: 'mobile' };

