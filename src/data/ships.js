// Ship chassis. Imported content lives in gen/*.js (see tools/xwing-import);
// add hand-made ships to CUSTOM_SHIPS below with the same shape.
//
// A dial entry is "<speed><bearing>:<color>".
//   bearings: S straight, BL/BR bank, TL/TR turn, K reverse (180°) turn, SL/SR Segnor's loop,
//             TRL/TRR Tallon roll, RBL/RS/RBR reverse bank/straight, ST stationary (speed 0)
//   colors:   g green (removes stress), w white, r red (adds stress)
// actions: focus, lock, roll, evade, boost.   size: small (large later).
import { GEN_SHIPS } from './gen/index.js';

const CUSTOM_SHIPS = {};

export const SHIPS = { ...GEN_SHIPS, ...CUSTOM_SHIPS };

export const BEARINGS = ['TL', 'BL', 'S', 'BR', 'TR', 'K', 'SL', 'SR', 'TRL', 'TRR', 'RBL', 'RS', 'RBR', 'ST'];

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
