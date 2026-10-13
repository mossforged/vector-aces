// Preset squads added by the "league" batch: { [key]: { name, faction, ships: [{ pilot, upgrades }] } }.
export default {
  saber_wing: { name: 'Saber wing', faction: 'league', ships: [
    { pilot: 'cal_ardent', upgrades: ['deadeye', 'searing_torpedoes', 'targeting_drone', 'night_ace'] },
    { pilot: 'jessa_pell', upgrades: ['integrated_drone'] },
    { pilot: 'azure_novice', upgrades: [] },
  ] },
  bombers: { name: 'Heavy bombers', faction: 'league', ships: [
    { pilot: 'mira_donn', upgrades: ['twin_turret', 'seismic_charges'] },
    { pilot: 'captain_rhone', upgrades: ['dorsal_turret', 'thermal_charges', 'sabra_crew'] },
    { pilot: 'bastion_squadron', upgrades: [] },
  ] },
  rebels: { name: 'Shuttle crew', faction: 'league', ships: [
    { pilot: 'hesta_vael', upgrades: ['dorsal_turret', 'lanno_castor'] },
    { pilot: 'sabra_wenn_wasp', upgrades: ['painted_wasp', 'ezo_crew'] },
    { pilot: 'shaya_brey', upgrades: ['field_overhaul', 'jyna_esk'] },
    { pilot: 'bruiser_orrel_wasp', upgrades: [] },
      ] },
};
