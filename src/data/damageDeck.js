// 33-card damage deck (8 Pilot, 25 Ship incl. 7 Direct Hit) — same mix as the rulebook,
// original card names/wording. `effect` ids are implemented in src/engine/effects.js.
//   repair: card grants "Action: roll 1 attack die; on hit (or crit) flip facedown".

export const DAMAGE_CARDS = {
  direct_hit:      { name: 'Direct Hit!', trait: 'ship', count: 7,
                     text: 'This card counts as 2 damage against your hull.' },
  ruptured_plating:{ name: 'Ruptured Plating', trait: 'ship', count: 2, repair: true,
                     text: 'Reduce your agility by 1. Action: Roll 1 attack die. On a hit, flip this card facedown.' },
  engine_fault:    { name: 'Engine Fault', trait: 'ship', count: 2,
                     text: 'Treat all turn maneuvers (←→) as red maneuvers.' },
  thruster_fire:   { name: 'Thruster Fire', trait: 'ship', count: 2,
                     text: 'Immediately receive 1 stress token. Then flip this card facedown.' },
  console_blaze:   { name: 'Console Blaze', trait: 'ship', count: 2, repair: true, repairAlways: true,
                     text: 'At the start of each Combat phase, roll 1 attack die. On a hit, suffer 1 damage. Action: Flip this card facedown.' },
  weapons_fault:   { name: 'Weapons Fault', trait: 'ship', count: 2, repair: true,
                     text: 'Reduce your primary weapon value by 1. Action: Roll 1 attack die. On a hit or crit, flip this card facedown.' },
  hull_breach:     { name: 'Hull Breach', trait: 'ship', count: 2,
                     text: 'After executing a red maneuver, roll 1 attack die. On a hit, suffer 1 damage.' },
  munitions_jam:   { name: 'Munitions Jam', trait: 'ship', count: 2,
                     text: 'Immediately discard 1 of your secondary weapon upgrades (if any). Then flip this card facedown.' },
  sensor_burnout:  { name: 'Sensor Burnout', trait: 'ship', count: 2, repair: true,
                     text: 'You cannot perform any actions except actions listed on Damage cards. Action: Roll 1 attack die. On a hit, flip this card facedown.' },
  minor_explosion: { name: 'Minor Explosion', trait: 'ship', count: 2,
                     text: 'Immediately roll 1 attack die. On a hit, suffer 1 damage. Then flip this card facedown.' },

  blinded:         { name: 'Flash-Blinded', trait: 'pilot', count: 2,
                     text: 'The next time you attack, do not roll any attack dice. Then flip this card facedown.' },
  smoke_cockpit:   { name: 'Smoke in the Cockpit', trait: 'pilot', count: 2,
                     text: 'Starting the round after you receive this card, treat your pilot skill as 0.' },
  dazed:           { name: 'Dazed', trait: 'pilot', count: 2,
                     text: 'After executing a maneuver that overlaps a ship or obstacle, suffer 1 damage.' },
  head_wound:      { name: 'Head Wound', trait: 'pilot', count: 2,
                     text: 'Ignore your pilot ability and all of your elite upgrades.' },
};

export function buildDamageDeck() {
  const deck = [];
  for (const [id, c] of Object.entries(DAMAGE_CARDS)) for (let i = 0; i < c.count; i++) deck.push(id);
  return deck; // unshuffled; engine shuffles with the game RNG
}
