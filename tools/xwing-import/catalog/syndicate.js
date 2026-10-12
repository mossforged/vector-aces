// Batch "syndicate": the Freeport Syndicate (outlaw faction): its new ships plus its pilots for existing ships
// Same shape as base.js. Keys are dataset ids; ids/names/text are ours.
// This batch OWNS: Syndicate pilots & faction upgrades, titles/mods for its ships, and faction-neutral Crew, Illicit, Salvaged Drone and Modification upgrades.
// Cards for this batch go in src/engine/cards/syndicate.js, art in src/render/art/syndicate.js,
// presets in src/data/presets/syndicate.js. See docs/WORKSTREAMS.md → section A.

export const SHIPS = {};
export const PILOTS = {};
export const UPGRADES = {};
// Condition cards: { [datasetConditionId]: { id, name, text } } (data/conditions.js in the dataset)
export const CONDITIONS = {};
