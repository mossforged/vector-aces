// Small SVG/text glyphs shared by UI panels.

const COLORS = { g: '#4fd67a', w: '#e8ecf2', r: '#ff5a4f' };

/** Maneuver arrow icon. bearing: S BL BR TL TR K ; color: g w r */
export function maneuverIcon(bearing, color = 'w', size = 22) {
  const c = COLORS[color] || COLORS.w;
  const paths = {
    S: 'M12 21 V5 M6 11 L12 4 L18 11',
    BL: 'M15 21 V14 Q15 10 8 6 M8 13 V6 H15',
    BR: 'M9 21 V14 Q9 10 16 6 M16 13 V6 H9',
    TL: 'M17 21 V11 Q17 7 12 7 H5 M10 2 L5 7 L10 12',
    TR: 'M7 21 V11 Q7 7 12 7 H19 M14 2 L19 7 L14 12',
    K: 'M7 21 V8 Q7 3 12 3 Q17 3 17 8 V14 M12 10 L17 15 L22 10',
  };
  return `<svg class="mglyph" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[bearing]}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function maneuverLabel(key) {
  const speed = parseInt(key, 10), b = key.replace(/^\d+/, '');
  const names = { S: 'straight', BL: 'bank left', BR: 'bank right', TL: 'turn left', TR: 'turn right', K: 'reverse turn' };
  return `${speed} ${names[b]}`;
}

export const DIE_GLYPH = { hit: '✱', crit: '✸', focus: '◉', evade: '➚', blank: '' };
export const DIE_NAME = { hit: 'hit', crit: 'critical', focus: 'focus', evade: 'evade', blank: 'blank' };

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
