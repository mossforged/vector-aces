// Factions. Purely presentational + used for "friendly/enemy" checks.
// Retheme freely: ids are referenced by ships/pilots, names/colors only by UI.
export const FACTIONS = {
  league: {
    id: 'league',
    name: 'Free Colonies League',
    short: 'League',
    color: '#e0533d',      // arc + UI accent
    arcColor: 'rgba(224,83,61,0.16)',
  },
  dominion: {
    id: 'dominion',
    name: 'Ascendant Dominion',
    short: 'Dominion',
    color: '#4fbf6b',
    arcColor: 'rgba(79,191,107,0.16)',
  },
};

// The faction that holds initiative when nothing else decides it
// (rulebook: one fixed faction wins ties unless squad points decide).
export const DEFAULT_INITIATIVE_FACTION = 'dominion';
