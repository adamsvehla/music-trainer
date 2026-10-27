// Clefs, described by where they sit rather than how they look: the SMuFL glyph, the
// staff step its origin is anchored to, and the step of the bottom staff line. Adding a
// bass clef is one more row (fClef U+E062 anchored on F3 = step 24, bottom line G2 = 18).

export const CLEFS = {
  treble: {
    id: 'treble',
    name: 'Houslový klíč',
    glyph: '', // gClef, origin on the G4 line
    anchorStep: 32, // G4
    bottomLineStep: 30, // E4
  },
};

export const DEFAULT_CLEF = 'treble';

export function getClef(id) {
  return CLEFS[id] ?? CLEFS[DEFAULT_CLEF];
}

export function topLineStep(clef) {
  return clef.bottomLineStep + 8;
}
