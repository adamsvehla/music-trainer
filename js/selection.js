// Quick selection of the notes to practise: a key decides *which* notes (and how they
// are spelled), a region decides *where* on the staff. The pool is every note in the
// instrument's range that passes both.
//
// Only keys up to five sharps or flats are offered. Fis dur needs Eis and Ges dur needs
// Ces, spellings the picker leaves out on purpose (see notesInRange in notes.js).

import { SEMITONES, czName, step, makeNote, noteFromMidi } from './notes.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// Circle-of-fifths order: no accidentals, then the sharp keys, then the flat keys.
export const KEYS = [
  { id: 'C', tonic: { letter: 0, acc: 0 } },
  { id: 'G', tonic: { letter: 4, acc: 0 } },
  { id: 'D', tonic: { letter: 1, acc: 0 } },
  { id: 'A', tonic: { letter: 5, acc: 0 } },
  { id: 'E', tonic: { letter: 2, acc: 0 } },
  { id: 'H', tonic: { letter: 6, acc: 0 } },
  { id: 'F', tonic: { letter: 3, acc: 0 } },
  { id: 'B', tonic: { letter: 6, acc: -1 } },
  { id: 'Es', tonic: { letter: 2, acc: -1 } },
  { id: 'As', tonic: { letter: 5, acc: -1 } },
  { id: 'Des', tonic: { letter: 1, acc: -1 } },
  { id: 'chromatic', tonic: null }, // every note, black keys in both spellings
];

export const DEFAULT_KEY = 'C';

// `b` is the clef's bottom-line step; the top line is b + 8.
export const REGIONS = [
  { id: 'staff', name: 'V osnově', has: (s, b) => s >= b && s <= b + 8 },
  { id: 'lines', name: 'Linky', has: (s, b) => s >= b && s <= b + 8 && (s - b) % 2 === 0 },
  { id: 'spaces', name: 'Mezery', has: (s, b) => s > b && s < b + 8 && (s - b) % 2 === 1 },
  { id: 'below', name: 'Pod osnovou', has: (s, b) => s < b },
  { id: 'above', name: 'Nad osnovou', has: (s, b) => s > b + 8 },
  { id: 'all', name: 'Celý rozsah', has: () => true },
];

export const DEFAULT_REGION = 'staff';

export function getKey(id) {
  return KEYS.find((k) => k.id === id) ?? KEYS[0];
}

export function getRegion(id) {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

// The seven degrees of a major scale, each spelled on its own letter: { letter, acc }.
export function majorScale(tonic) {
  const base = SEMITONES[tonic.letter] + tonic.acc;
  return MAJOR.map((interval, degree) => {
    const letter = (tonic.letter + degree) % 7;
    const acc = ((((base + interval - SEMITONES[letter]) % 12) + 18) % 12) - 6;
    return { letter, acc };
  });
}

// The key's signature for the staff ({ acc, count }), or null for C dur and chromatic.
export function keySignature(key) {
  if (!key.tonic) return null;
  const altered = majorScale(key.tonic).filter((d) => d.acc !== 0);
  return altered.length ? { acc: altered[0].acc, count: altered.length } : null;
}

// Names a heard pitch the way the key would write it (in As dur, as rather than gis);
// pitches outside the key get the everyday default spelling.
export function spellMidi(m, key) {
  if (key?.tonic) {
    for (const d of majorScale(key.tonic)) {
      const pc = SEMITONES[d.letter] + d.acc;
      if ((((m - pc) % 12) + 12) % 12 === 0) return makeNote(d.letter, d.acc, (m - pc) / 12 - 1);
    }
  }
  return noteFromMidi(m);
}

export function inKey(key, note) {
  if (!key.tonic) return true;
  return majorScale(key.tonic).some((d) => d.letter === note.letter && d.acc === note.acc);
}

// The notes of `all` (the instrument's picker range) that belong to the key and the region.
export function selectNotes(all, keyId, regionId, clef) {
  const key = getKey(keyId);
  const region = getRegion(regionId);
  return all.filter((n) => inKey(key, n) && region.has(step(n), clef.bottomLineStep));
}

export function keyName(key) {
  return key.tonic ? `${czName(key.tonic)} dur` : 'Chromaticky';
}

// "G dur / e moll · 1 ♯ · g a h c d e fis": the relative minor shares the notes.
export function keyDescription(key) {
  if (!key.tonic) return 'Všech dvanáct tónů, černé klávesy v obou zápisech (cis i des …).';
  const scale = majorScale(key.tonic);
  const minor = czName(scale[5]).toLowerCase();
  const altered = scale.filter((d) => d.acc !== 0);
  const signature = altered.length === 0
    ? 'bez předznamenání'
    : `${altered.length} ${altered[0].acc > 0 ? '♯' : '♭'}`;
  return `${keyName(key)} / ${minor} moll · ${signature} · ${scale.map((d) => czName(d).toLowerCase()).join(' ')}`;
}
