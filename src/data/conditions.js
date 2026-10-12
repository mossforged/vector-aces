// Condition cards: assigned to a ship by some ability (ship.conditions = [{ id, from }]).
// While assigned they act like that ship's own cards (behaviour in src/engine/cards/*, same id).
// Defined per batch in tools/xwing-import/catalog/*.js → CONDITIONS: { id, name, text, unique? }.
import { GEN_CONDITIONS } from './gen/index.js';

export const CONDITIONS = { ...GEN_CONDITIONS };
