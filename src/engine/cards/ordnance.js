// Bomb and mine upgrade cards. Token behaviour lives in engine/ordnance.js; these cards only
// decide WHEN a token is dropped. Data fields (data/upgrades.js): ordnance (token id), mine, keep.
//   timed bombs: "when you reveal your maneuver, you may drop" (before the ship moves)
//   mines:       an action that drops the token
import { UPGRADES } from '../../data/upgrades.js';
import { pick, cardStep } from '../flow.js';
import { shipName } from '../queries.js';
import { dropOrdnance } from '../ordnance.js';

const discard = (ship, id) => { const u = ship.upgrades.find(x => x.id === id && !x.discarded); if (u) u.discarded = true; };

function timedBomb(id) {
  return {
    onReveal: (state, ship) => [cardStep(id, 'offer', { ship: ship.id })],
    steps: {
      offer(state, s) {
        const ship = state.ships[s.ship]; const u = UPGRADES[id];
        pick(state, { player: ship.owner, ship: ship.id, text: `${shipName(ship)}: drop ${u.name.toLowerCase()} behind you before moving?`,
          options: [{ id: 'drop', label: u.keep ? 'Drop one' : 'Drop (discard card)' }], then: cardStep(id, 'go', { ship: s.ship }), skip: 'Not now' });
      },
      go(state, s) {
        const ship = state.ships[s.ship]; const u = UPGRADES[id];
        dropOrdnance(state, ship, u.ordnance);
        if (!u.keep) discard(ship, id);
      },
    },
  };
}

function mine(id) {
  return {
    actions: {
      [id]: {
        label: `${UPGRADES[id]?.name || id}: drop`,
        can: () => true,
        perform(state, ship) { dropOrdnance(state, ship, UPGRADES[id].ordnance); discard(ship, id); },
      },
    },
  };
}

const defs = {};
for (const u of Object.values(UPGRADES)) if (u.ordnance) defs[u.id] = u.mine ? mine(u.id) : timedBomb(u.id);
export default defs;
