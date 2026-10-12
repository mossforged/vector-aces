// Batch "dominion": remaining Dominion-side small ships (incl. sequel-era First Order ships)
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: Dominion pilots & faction upgrades, titles/mods for its ships, and faction-neutral Elite, System and Tech upgrades.
// Cards for this batch go in src/engine/cards/dominion.js, art in src/render/art/dominion.js,
// presets in src/data/presets/dominion.js. See docs/WORKSTREAMS.md → section A.

export const SHIPS = {};
export const PILOTS = {};
export const UPGRADES = {};
// Condition cards: { [datasetConditionId]: { id, name, text } } (data/conditions.js in the dataset)
export const CONDITIONS = {};
