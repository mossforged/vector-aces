// Ready-made squads. The "intro" pair mirrors the rulebook's starter matchup
// (1 heavy fighter vs 2 interceptors). Each entry: { pilot, upgrades: [] }.

export const PRESET_SQUADS = {
  league: {
    intro:   { name: 'Starter: lone ace', ships: [{ pilot: 'kestrel_vane', upgrades: [] }] },
    duo:     { name: 'Wingmates (99 pts)', ships: [
      { pilot: 'ivo_strand', upgrades: ['seeker_torpedo', 'deflector_drone', 'deadeye'] },
      { pilot: 'kestrel_vane', upgrades: ['seeker_torpedo', 'repair_drone', 'iron_will'] },
      { pilot: 'crimson_wing', upgrades: [] },
    ] },
  },
  dominion: {
    intro:   { name: 'Starter: pair of Wasps', ships: [
      { pilot: 'hollow', upgrades: [] },
      { pilot: 'shade_squadron', upgrades: [] },
    ] },
    swarm:   { name: 'Swarm (91 pts)', ships: [
      { pilot: 'brute', upgrades: ['deadeye'] },
      { pilot: 'vex', upgrades: [] },
      { pilot: 'hollow', upgrades: [] },
      { pilot: 'night_squadron', upgrades: ['iron_will'] },
      { pilot: 'shade_squadron', upgrades: [] },
      { pilot: 'cadet', upgrades: [] },
    ] },
  },
};
