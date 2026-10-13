// Preset squads added by the "dominion" batch: { [key]: { name, faction, ships: [{ pilot, upgrades }] } }.
export default {
  vespid_swarm: { name: 'Vespid swarm', faction: 'dominion', ships: [
    { pilot: 'sigma_lead', upgrades: ['calculated_shot', 'guidance_uplink'] },
    { pilot: 'delta_lead', upgrades: [] },
    { pilot: 'sigma_ace', upgrades: ['pounce'] },
    { pilot: 'delta_squadron', upgrades: [] },
    { pilot: 'kappa_squadron', upgrades: [] },
  ] },
  shadows: { name: 'Shadow strike', faction: 'dominion', ships: [
    { pilot: 'murmur', upgrades: ['phase_shroud', 'mastery'] },
    { pilot: 'interrogator', upgrades: ['pounce', 'stiletto_v1'] },
    { pilot: 'varik_rudd', upgrades: ['stiletto_v1'] },
  ] },
  heavy_metal: { name: 'Heavy metal', faction: 'dominion', ships: [
    { pilot: 'major_vesmar', upgrades: ['shadow_troopers', 'reaver_ailerons'] },
    { pilot: 'lt_kesta_morne', upgrades: ['twin_turret'] },
    { pilot: 'hailstorm', upgrades: ['proton_bombs', 'cluster_mines'] },
  ] },
};
