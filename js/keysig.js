// Key signatures, and which accidentals a row of notes needs printed against one.
//
// A signature is { acc: 1 | -1, count } (G dur is { acc: 1, count: 1 }), or null for
// none. Letters are the internal 0–6 = C D E F G A B.

import { step } from './notes.js';

export const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E H
export const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B(H♭) E A D G C F

// The accidental the signature puts on every note of this letter.
export function signatureAcc(sig, letter) {
  if (!sig) return 0;
  const order = sig.acc > 0 ? SHARP_ORDER : FLAT_ORDER;
  return order.indexOf(letter) < sig.count ? sig.acc : 0;
}

// What to print before each note, reading the row left to right as one bar: null when
// the signature, or an earlier accidental on the same line or space, already gives the
// pitch; otherwise the note's own accidental, where 0 means a natural sign. So in G dur
// fis prints bare and f gets ♮; and a fis after that f needs its ♯ back.
export function accidentalsToDraw(notes, sig) {
  const inBar = new Map(); // staff step → the accidental in force there
  return notes.map((n) => {
    const s = step(n);
    const current = inBar.has(s) ? inBar.get(s) : signatureAcc(sig, n.letter);
    if (n.acc === current) return null;
    inBar.set(s, n.acc);
    return n.acc;
  });
}
