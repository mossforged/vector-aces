// Ready-made squads. Each entry: { pilot, upgrades: [] }.
export const PRESET_SQUADS = {
  league: {
    intro: { name: 'Starter: lone ace', ships: [{ pilot: 'kestrel_vane', upgrades: [] }] },
    duo: { name: 'Wingmates', ships: [
      { pilot: 'ivo_strand', upgrades: ['seeker_torpedo', 'deflector_drone', 'deadeye'] },
      { pilot: 'kestrel_vane', upgrades: ['seeker_torpedo', 'repair_drone', 'iron_will'] },
      { pilot: 'crimson_wing', upgrades: [] },
    ] },
    heavy: { name: 'Heavy hitters', ships: [
      { pilot: 'odo_ravel', upgrades: ['fire_control', 'ion_projector'] },
      { pilot: 'brannoc_teague', upgrades: ['ion_turret', 'seeker_torpedo'] },
      { pilot: 'cass_varrin', upgrades: ['scout_officer'] },
    ] },
    darts: { name: 'Dart pack', ships: [
      { pilot: 'juno_arkady', upgrades: ['redline', 'shock_missiles'] },
      { pilot: 'pell_rusk', upgrades: [] },
      { pilot: 'swiftwind', upgrades: ['deadeye'] },
      { pilot: 'testbed', upgrades: [] },
    ] },
  },
  dominion: {
    intro: { name: 'Starter: pair of Wasps', ships: [
      { pilot: 'hollow', upgrades: [] },
      { pilot: 'shade_squadron', upgrades: [] },
    ] },
    swarm: { name: 'Swarm', ships: [
      { pilot: 'packleader', upgrades: ['pack_tactics'] },
      { pilot: 'brute', upgrades: ['deadeye'] },
      { pilot: 'vex', upgrades: [] },
      { pilot: 'night_squadron', upgrades: ['iron_will'] },
      { pilot: 'shade_squadron', upgrades: [] },
      { pilot: 'cadet', upgrades: [] },
    ] },
    aces: { name: 'Aces', ships: [
      { pilot: 'baron_kessick', upgrades: ['redline'] },
      { pilot: 'lord_vahl', upgrades: ['battle_reflexes'] },
      { pilot: 'ilsa_morrow', upgrades: ['afterburners'] },
    ] },
    bombers: { name: 'Bomber wing', ships: [
      { pilot: 'major_taal', upgrades: ['shock_missiles', 'seeker_torpedo'] },
      { pilot: 'captain_vorne', upgrades: ['swarm_rockets'] },
      { pilot: 'colonel_drath', upgrades: ['shock_missiles'] },
    ] },
  },
};
