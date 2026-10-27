// Note model, MIDI and staff maths, and Czech note names.
//
// A note is { letter, acc, octave }: letter 0–6 is C D E F G A B in the internal,
// English sense (B is the natural a semitone below C), acc is -1 / 0 / +1, and octave
// is scientific (C4 = middle C = MIDI 60). The internal id ("F#4", "Bb4") is never
// shown; everything the user reads goes through czName / czLabel, where B natural is
// H and B♭ is B.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

const CZ_NATURAL = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
const CZ_SHARP = ['Cis', 'Dis', 'Eis', 'Fis', 'Gis', 'Ais', 'His'];
const CZ_FLAT = ['Ces', 'Des', 'Es', 'Fes', 'Ges', 'As', 'B'];

// Every Czech name the parser accepts, lower-cased, mapped back to letter + accidental.
const CZ_LOOKUP = new Map();
for (let l = 0; l < 7; l++) {
  CZ_LOOKUP.set(CZ_NATURAL[l].toLowerCase(), { letter: l, acc: 0 });
  CZ_LOOKUP.set(CZ_SHARP[l].toLowerCase(), { letter: l, acc: 1 });
  CZ_LOOKUP.set(CZ_FLAT[l].toLowerCase(), { letter: l, acc: -1 });
}
// "Ees" and "Aes" are the regular forms of Es and As; accept them for anyone who types them.
CZ_LOOKUP.set('ees', { letter: 2, acc: -1 });
CZ_LOOKUP.set('aes', { letter: 5, acc: -1 });

// The spelling used when a pitch has to be named without context (what the microphone
// heard): the sharps and flats of the first few key signatures on each side.
const DEFAULT_SPELLING = [
  [0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0],
];

const SUPERSCRIPT = ['', '¹', '²', '³', '⁴', '⁵', '⁶'];

export function makeNote(letter, acc, octave) {
  return { letter, acc, octave };
}

export function noteId(n) {
  return LETTERS[n.letter] + (n.acc > 0 ? '#' : n.acc < 0 ? 'b' : '') + n.octave;
}

export function parseId(id) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(id);
  if (!m) return null;
  return makeNote(LETTERS.indexOf(m[1]), m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, Number(m[3]));
}

export function midi(n) {
  return 12 * (n.octave + 1) + SEMITONES[n.letter] + n.acc;
}

// Diatonic position: one step per line or space, so it is what decides the height on the staff.
export function step(n) {
  return n.octave * 7 + n.letter;
}

export function noteFromStep(s, acc = 0) {
  return makeNote(((s % 7) + 7) % 7, acc, Math.floor(s / 7));
}

export function noteFromMidi(m) {
  const [letter, acc] = DEFAULT_SPELLING[((m % 12) + 12) % 12];
  // B♯ / C♭ never occur in the default spelling, so the octave follows MIDI directly.
  return makeNote(letter, acc, Math.floor(m / 12) - 1);
}

export function sameSpelling(a, b) {
  return a.letter === b.letter && a.acc === b.acc && a.octave === b.octave;
}

export function czName(n) {
  return (n.acc > 0 ? CZ_SHARP : n.acc < 0 ? CZ_FLAT : CZ_NATURAL)[n.letter];
}

// Czech octave notation: c = C3 (malá oktáva), c¹ = C4, c² = C5 …; C = C2 (velká oktáva).
export function czLabel(n) {
  const name = czName(n);
  if (n.octave <= 2) return name + (n.octave < 2 ? subscript(2 - n.octave) : '');
  return name.toLowerCase() + (SUPERSCRIPT[n.octave - 3] ?? `^${n.octave - 3}`);
}

function subscript(k) {
  return String(k).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
}

// Parses a typed Czech note name ("fis", "Es", "b", "H"); octave-less, so { letter, acc } or null.
export function parseCz(text) {
  return CZ_LOOKUP.get(String(text).trim().toLowerCase()) ?? null;
}

// Could `prefix` still grow into a valid name? Lets the reading mode tell an unfinished
// entry ("fi") from a typo ("x").
export function isCzPrefix(prefix) {
  const p = prefix.toLowerCase();
  for (const name of CZ_LOOKUP.keys()) if (name.startsWith(p)) return true;
  return false;
}

// Could `prefix` grow into a *longer* name? When it is a complete name that cannot
// ("fis", "b", "es"), typing can submit without waiting for Enter.
export function czCanExtend(prefix) {
  const p = prefix.toLowerCase();
  for (const name of CZ_LOOKUP.keys()) if (name.length > p.length && name.startsWith(p)) return true;
  return false;
}

// All notes the picker offers between two written notes, in pitch order: every natural,
// and for each black key both everyday spellings (Cis/Des, Dis/Es, Fis/Ges, Gis/As, Ais/B).
// Eis, His, Ces and Fes are deliberately left out.
export function notesInRange(low, high) {
  const out = [];
  for (let m = midi(low); m <= midi(high); m++) {
    const pc = m % 12;
    const octave = Math.floor(m / 12) - 1;
    const natural = SEMITONES.indexOf(pc);
    if (natural >= 0) {
      out.push(makeNote(natural, 0, octave));
    } else {
      out.push(makeNote(SEMITONES.indexOf(pc - 1), 1, octave));
      out.push(makeNote(SEMITONES.indexOf(pc + 1), -1, octave));
    }
  }
  return out;
}

export function freqToMidi(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}
