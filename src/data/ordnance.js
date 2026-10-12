// Bomb and mine tokens placed on the table (sizes in mm, approximating the printed tokens).
//   kind 'bomb': detonates at the end of the Activation phase, hitting every ship at Range 1.
//   kind 'mine': detonates when a ship's base or maneuver template overlaps it, hitting that ship.
// Effects are implemented in src/engine/ordnance.js under the same id.
// `original` is only used by the "original names" toggle.
export const ORDNANCE = {
  seismic:      { name: 'Seismic charge',  original: 'Seismic charge',  kind: 'bomb', shape: { type: 'circle', r: 13 }, color: '#8fa3c7', text: 'Each ship at Range 1 suffers 1 damage.' },
  proton_bomb:  { name: 'Proton bomb',     original: 'Proton bomb',     kind: 'bomb', shape: { type: 'circle', r: 13 }, color: '#e0703d', text: 'Each ship at Range 1 is dealt 1 faceup Damage card (shields don\u2019t help).' },
  ion_bomb:     { name: 'Ion bomb',        original: 'Ion bomb',        kind: 'bomb', shape: { type: 'circle', r: 13 }, color: '#5a8cff', text: 'Each ship at Range 1 receives 2 ion tokens.' },
  thermal:      { name: 'Thermal charge',  original: 'Thermal detonator', kind: 'bomb', shape: { type: 'circle', r: 13 }, color: '#ffb84d', text: 'Each ship at Range 1 suffers 1 damage and receives 1 stress token.' },
  bomblet:      { name: 'Bomblet',         original: 'Bomblet',         kind: 'bomb', shape: { type: 'circle', r: 13 }, color: '#c7a3ff', text: 'Each ship at Range 1 rolls 2 attack dice and suffers any damage rolled.' },
  prox_mine:    { name: 'Proximity mine',  original: 'Proximity mine',  kind: 'mine', shape: { type: 'rect', w: 50, h: 30 }, color: '#e05252', text: 'The ship that touches it rolls 3 attack dice and suffers any damage rolled.' },
  snare_net:    { name: 'Snare net',       original: 'Conner net',      kind: 'mine', shape: { type: 'circle', r: 20 }, color: '#4dd2c8', text: 'The ship that touches it suffers 1 damage, receives 2 ion tokens and skips its action step.' },
  cluster_mine: { name: 'Cluster mine',    original: 'Cluster mine',    kind: 'mine', shape: { type: 'rect', w: 22, h: 22 }, color: '#e08a52', cluster: 3, text: 'Each token touched: roll 2 attack dice and suffer 1 damage per hit or critical.' },
};
