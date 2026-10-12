// Factions. Players pick one each (mirror matches allowed); colours, names and art keys only.
// `alt` colours are used by the second player when both pick the same faction.
// `original` is the name shown when the "Original names" toggle is on.
export const FACTIONS = {
  league: {
    id: 'league', name: 'Free Colonies League', short: 'League', original: 'Rebel Alliance',
    blurb: 'Frontier colonies and their volunteer pilots, flying patched-up fighters against an empire that wants them back.',
    color: '#e0533d', arcColor: 'rgba(224,83,61,0.16)',
    alt: { color: '#f2a03d', arcColor: 'rgba(242,160,61,0.16)' },
  },
  dominion: {
    id: 'dominion', name: 'Ascendant Dominion', short: 'Dominion', original: 'Galactic Empire',
    blurb: 'A centralised empire of disciplined fleets and mass-produced interceptors.',
    color: '#4fbf6b', arcColor: 'rgba(79,191,107,0.16)',
    alt: { color: '#3fc7c2', arcColor: 'rgba(63,199,194,0.16)' },
  },
  syndicate: {
    id: 'syndicate', name: 'Freeport Syndicate', short: 'Syndicate', original: 'Scum and Villainy',
    blurb: 'Smugglers, bounty hunters and pirate barons from the lawless free ports, flying whatever they can steal or buy.',
    color: '#b36be6', arcColor: 'rgba(179,107,230,0.16)',
    alt: { color: '#e66bb3', arcColor: 'rgba(230,107,179,0.16)' },
  },
};

// Rulebook tie-break: the Dominion (Imperial) player has initiative when squad points tie.
// If neither or both players are Dominion, the tie is broken at random.
export const TIE_INITIATIVE_FACTION = 'dominion';
