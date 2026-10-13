// Preset squads added by the "large" batch: { [key]: { name, faction, ships: [{ pilot, upgrades }] } }.
export default {
  freighter: { name: 'Freighter and escort', faction: 'league', ships: [
    { pilot: 'jax_solent', upgrades: ['old_reliable', 'lanno_castor', 'kip_kestrel'] },
    { pilot: 'crimson_wing', upgrades: [] },
  ] },
  hearth_crew: { name: 'Mothership', faction: 'league', ships: [
    { pilot: 'hesta_vael_hearth', upgrades: ['mothership', 'dorsal_turret'] },
    { pilot: 'sabra_wenn', upgrades: ['lifeboat'] },
  ] },
  decimator: { name: 'Bastille and wing', faction: 'dominion', ships: [
    { pilot: 'admiral_chiran_pilot', upgrades: ['unyielding'] },
    { pilot: 'shade_squadron', upgrades: [] },
    { pilot: 'cadet', upgrades: [] },
  ] },
  hunters_pair: { name: 'Hunter pair', faction: 'syndicate', ships: [
    { pilot: 'unit_h9a', upgrades: ['hunter_network'] },
    { pilot: 'unit_h9c', upgrades: ['hunter_network'] },
  ] },
  slaver: { name: 'Slaver and pup', faction: 'syndicate', ships: [
    { pilot: 'brosk_pilot', upgrades: ['hounds_lair', 'deadeye'] },
    { pilot: 'comet_soldier', upgrades: [] },
  ] },
};
