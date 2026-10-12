// Upgrade cards. Imported content lives in gen/content.js.
// Fields: slot, name, cost, unique, faction / ships / sizes (restrictions), text,
//         weapon: { attack, minRange, maxRange, cost: 'lock'|'focus'|null, spend, discard, turret, twice }
// Behaviour is implemented in src/engine/cards/* keyed by id.
import { GEN_UPGRADES } from './gen/content.js';

const CUSTOM_UPGRADES = {};

export const UPGRADES = { ...GEN_UPGRADES, ...CUSTOM_UPGRADES };

export const SLOT_LABELS = {
  elite: 'Elite', torpedo: 'Torpedo', missile: 'Missile', drone: 'Drone', cannon: 'Cannon', turret: 'Turret',
  crew: 'Crew', system: 'System', mod: 'Modification', title: 'Title', bomb: 'Bomb',
};
