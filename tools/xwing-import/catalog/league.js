// Batch "league": remaining League-side small ships (incl. sequel-era Resistance ships)
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: League pilots & faction upgrades, titles/mods for its ships, and faction-neutral Drone (astromech), Torpedo, Missile, Cannon and Turret upgrades.
// Cards for this batch go in src/engine/cards/league.js, art in src/render/art/league.js,
// presets in src/data/presets/league.js. See docs/WORKSTREAMS.md → section A.

export const SHIPS = {};
export const PILOTS = {};
export const UPGRADES = {};
// Condition cards: { [datasetConditionId]: { id, name, text } } (data/conditions.js in the dataset)
export const CONDITIONS = {};
