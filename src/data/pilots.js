// Pilots = one buyable ship card. `ability` is an id implemented in
// src/engine/effects.js (search for the id). `text` is what the UI shows.
// unique: only one copy per player.  elite: has an elite-talent upgrade slot.

export const PILOTS = {
  // ---- League / Lancer ----
  fledgling: {
    id: 'fledgling', ship: 'lancer', name: 'Fledgling Pilot', skill: 2, cost: 21,
    text: 'Fresh from flight school, flying on nerve and simulator hours.',
  },
  crimson_wing: {
    id: 'crimson_wing', ship: 'lancer', name: 'Crimson Wing Pilot', skill: 4, cost: 23, elite: true,
    text: 'Veterans of a dozen raids on Dominion convoys.',
  },
  kestrel_vane: {
    id: 'kestrel_vane', ship: 'lancer', name: 'Kestrel Vane', skill: 8, cost: 28, unique: true, elite: true,
    ability: 'kestrel_vane',
    text: 'When defending, you may change 1 of your focus results to an evade result.',
  },
  ivo_strand: {
    id: 'ivo_strand', ship: 'lancer', name: 'Ivo Strand', skill: 9, cost: 29, unique: true, elite: true,
    ability: 'ivo_strand',
    text: 'When attacking, reduce the defender’s agility by 1 (to a minimum of 0).',
  },

  // ---- Dominion / Wasp ----
  cadet: {
    id: 'cadet', ship: 'wasp', name: 'Cadet', skill: 1, cost: 12,
    text: 'The Dominion breeds pilots by the thousand.',
  },
  shade_squadron: {
    id: 'shade_squadron', ship: 'wasp', name: 'Shade Squadron Pilot', skill: 3, cost: 13,
    text: 'Picket pilots who patrol the rim stations.',
  },
  night_squadron: {
    id: 'night_squadron', ship: 'wasp', name: 'Night Squadron Pilot', skill: 4, cost: 14, elite: true,
    text: 'Hand-picked interceptor crews.',
  },
  hollow: {
    id: 'hollow', ship: 'wasp', name: '“Hollow”', skill: 2, cost: 15, unique: true,
    ability: 'hollow',
    text: 'After you execute a green maneuver, you may perform a free focus action.',
  },
  brute: {
    id: 'brute', ship: 'wasp', name: '“Brute”', skill: 5, cost: 17, unique: true, elite: true,
    ability: 'brute',
    text: 'When attacking at Range 1, roll 1 additional attack die.',
  },
  vex: {
    id: 'vex', ship: 'wasp', name: '“Vex”', skill: 6, cost: 16, unique: true,
    ability: 'vex',
    text: 'When attacking from outside the defender’s firing arc, roll 1 additional attack die.',
  },
};

export function pilotsForFaction(factionId, SHIPS) {
  return Object.values(PILOTS).filter(p => SHIPS[p.ship].faction === factionId);
}
