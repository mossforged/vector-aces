// Ship chassis: stats, actions, upgrade slots and maneuver dial.
// A dial entry is "<speed><bearing>:<color>".
//   bearings: S straight, BL/BR bank, TL/TR turn, K reverse (180°) turn
//   colors:   g green (removes stress), w white, r red (adds stress)
// The engine never hard-codes a ship; add a chassis here + pilots in pilots.js.

export const SHIPS = {
  lancer: {
    id: 'lancer',
    name: 'Lancer',
    faction: 'league',
    size: 'small',
    attack: 3, agility: 2, hull: 3, shields: 2,
    actions: ['focus', 'lock'],
    slots: ['torpedo', 'drone'],
    art: 'lancer',            // key into render/shipArt.js (or swap for an image later)
    dial: [
      '1BL:g', '1S:g', '1BR:g',
      '2TL:w', '2BL:w', '2S:g', '2BR:w', '2TR:w',
      '3TL:w', '3BL:w', '3S:w', '3BR:w', '3TR:w',
      '4S:w', '4K:r',
    ],
  },
  wasp: {
    id: 'wasp',
    name: 'Wasp',
    faction: 'dominion',
    size: 'small',
    attack: 2, agility: 3, hull: 3, shields: 0,
    actions: ['focus', 'roll', 'evade'],
    slots: [],
    art: 'wasp',
    dial: [
      '1TL:w', '1TR:w',
      '2TL:w', '2BL:g', '2S:g', '2BR:g', '2TR:w',
      '3TL:w', '3BL:w', '3S:g', '3BR:w', '3TR:w', '3K:r',
      '4S:w', '4K:r',
      '5S:w',
    ],
  },
};

export const BEARINGS = ['TL', 'BL', 'S', 'BR', 'TR', 'K'];

export function parseManeuver(code) {
  // "2BL:g" -> { key:'2BL', speed:2, bearing:'BL', color:'g' }
  const [key, color] = code.split(':');
  const speed = parseInt(key, 10);
  const bearing = key.slice(String(speed).length);
  return { key, speed, bearing, color };
}

export function dialFor(shipId) {
  return SHIPS[shipId].dial.map(parseManeuver);
}
