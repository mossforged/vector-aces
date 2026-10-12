// Pilots = one buyable ship card. Imported content lives in gen/content.js.
// Fields: ship, name, skill, cost, unique, slots (upgrade bar incl. 'elite'),
//         ability (id implemented in src/engine/cards/pilots.js), text.
import { GEN_PILOTS } from './gen/content.js';

const CUSTOM_PILOTS = {};

export const PILOTS = { ...GEN_PILOTS, ...CUSTOM_PILOTS };

export function pilotsForFaction(factionId, SHIPS) {
  return Object.values(PILOTS).filter(p => SHIPS[p.ship].faction === factionId);
}
