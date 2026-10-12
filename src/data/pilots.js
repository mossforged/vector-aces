// Pilots = one buyable ship card. Imported content lives in gen/*.js (built by tools/xwing-import).
// Fields: ship, name, skill, cost, unique, slots (upgrade bar incl. 'elite'),
//         ability (id implemented in src/engine/cards/pilots.js), text.
import { GEN_PILOTS } from './gen/index.js';

const CUSTOM_PILOTS = {};

export const PILOTS = { ...GEN_PILOTS, ...CUSTOM_PILOTS };

export function pilotsForFaction(factionId) {
  return Object.values(PILOTS).filter(p => p.faction === factionId);
}
