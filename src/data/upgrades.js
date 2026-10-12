// Upgrade cards. `slot` must match a slot on the ship (or 'elite' for elite pilots).
// Behaviour lives in src/engine/effects.js keyed by `id`.
//
// Secondary weapons: `weapon` block makes it selectable as an attack.
//   requiresLock: must spend a target lock on the defender to fire
//   discard: card is discarded after the attack

export const UPGRADES = {
  seeker_torpedo: {
    id: 'seeker_torpedo', slot: 'torpedo', name: 'Seeker Torpedoes', cost: 4,
    weapon: { attack: 4, minRange: 2, maxRange: 3, requiresLock: true, discard: true },
    text: 'Attack (Lock): spend your lock and discard this card. You may change 1 of your focus results to a critical result.',
  },
  deflector_drone: {
    id: 'deflector_drone', slot: 'drone', name: 'Deflector Drone', cost: 3, unique: true,
    action: 'deflector_drone',
    text: 'Action: Increase your agility by 1 until the end of this round.',
  },
  repair_drone: {
    id: 'repair_drone', slot: 'drone', name: 'Repair Drone', cost: 4, unique: true,
    text: 'After you execute a green maneuver, you may recover 1 shield (up to your shield value).',
  },
  deadeye: {
    id: 'deadeye', slot: 'elite', name: 'Deadeye', cost: 3,
    action: 'deadeye',
    text: 'Action: When attacking this round, you may change 1 of your focus results to a critical and all other focus results to hits.',
  },
  iron_will: {
    id: 'iron_will', slot: 'elite', name: 'Iron Will', cost: 1,
    text: 'When you are dealt a faceup Damage card with the Pilot trait, discard it immediately without resolving it.',
  },
};
