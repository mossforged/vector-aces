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
    SL: 'M15 21 V14 Q15 9 9 5 M6 9 L9 5 L5 3',
    SR: 'M9 21 V14 Q9 9 15 5 M18 9 L15 5 L19 3',
    TRL: 'M17 21 V11 Q17 6 11 6 H5 M5 6 V12 M2 9 L5 12 L8 9',
    TRR: 'M7 21 V11 Q7 6 13 6 H19 M19 6 V12 M16 9 L19 12 L22 9',
    RS: 'M12 3 V19 M6 13 L12 20 L18 13',
    RBL: 'M15 3 V10 Q15 14 8 18 M8 11 V18 H15',
    RBR: 'M9 3 V10 Q9 14 16 18 M16 11 V18 H9',
    ST: 'M7 7 H17 V17 H7 Z',
  };
  return `<svg class="mglyph" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[bearing]}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function maneuverLabel(key) {
  const speed = parseInt(key, 10), b = key.replace(/^\d+/, '');
  const names = { S: 'straight', BL: 'bank left', BR: 'bank right', TL: 'turn left', TR: 'turn right', K: 'reverse turn',
    SL: 'loop left', SR: 'loop right', TRL: 'Tallon roll left', TRR: 'Tallon roll right',
    RBL: 'reverse bank left', RS: 'reverse straight', RBR: 'reverse bank right', ST: 'stationary' };
  return `${speed} ${names[b]}`;
}

export const DIE_GLYPH = { hit: '✱', crit: '✸', focus: '◉', evade: '➚', blank: '' };
export const DIE_NAME = { hit: 'hit', crit: 'critical', focus: 'focus', evade: 'evade', blank: 'blank' };

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
