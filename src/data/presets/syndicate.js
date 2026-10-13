// Preset squads added by the "syndicate" batch: { [key]: { name, faction, ships: [{ pilot, upgrades }] } }.
export default {
  intro: { name: 'Starter: hired guns', faction: 'syndicate', ships: [
    { pilot: 'gurra', upgrades: [] },
    { pilot: 'freeport_spacer', upgrades: [] },
    { pilot: 'freeport_spacer', upgrades: [] },
  ] },
  cartel: { name: 'Cartel muscle', faction: 'syndicate', ships: [
    { pilot: 'prince_zirox', upgrades: ['deadeye', 'venom', 'fire_control'] },
    { pilot: 'talos_cobra', upgrades: ['deadeye'] },
    { pilot: 'kavell', upgrades: ['ion_turret'] },
  ] },
  scyk_swarm: { name: 'Gnat swarm', faction: 'syndicate', ships: [
    { pilot: 'seressa', upgrades: ['shield_wing'] },
    { pilot: 'red_genesis', upgrades: ['heavy_gnat', 'wrecker_cannon'] },
    { pilot: 'laetha_ashe', upgrades: [] },
    { pilot: 'tannery_veteran', upgrades: ['light_gnat'] },
    { pilot: 'freeport_spacer', upgrades: [] },
  ] },
  hunters: { name: 'Bounty hunters', faction: 'syndicate', ships: [
    { pilot: 'zukas', upgrades: ['rook_varga', 'fog_stalker', 'tractor_projector'] },
    { pilot: 'fennick_rowe_syn', upgrades: ['dawnguard_shield'] },
    { pilot: 'torin_kulda', upgrades: ['spiteful_drone'] },
  ] },
};
