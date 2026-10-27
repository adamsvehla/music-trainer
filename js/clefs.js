// Clefs, described by where they sit rather than how they look: the SMuFL glyph, the
// staff step its origin is anchored to, and the step of the bottom staff line. Adding a
// bass clef is one more row (fClef U+E062 anchored on F3 = step 24, bottom line G2 = 18,
// signature steps the treble ones minus 14).

export const CLEFS = {
  treble: {
    id: 'treble',
    name: 'Houslový klíč',
    glyph: '', // gClef, origin on the G4 line
    anchorStep: 32, // G4
    bottomLineStep: 30, // E4
    // Where each accidental of a key signature sits, in signature order.
    sharpSteps: [38, 35, 39, 36, 33, 37, 34], // f² c² g² d² a¹ e² h¹
    flatSteps: [34, 37, 33, 36, 32, 35, 31], // b¹ es² as¹ des² ges¹ ces² fes¹
  },
};

export const DEFAULT_CLEF = 'treble';

export function getClef(id) {
  return CLEFS[id] ?? CLEFS[DEFAULT_CLEF];
}

export function topLineStep(clef) {
  return clef.bottomLineStep + 8;
}
