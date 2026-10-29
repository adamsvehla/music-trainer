// Pairs of notes for the listening exercises, and what can be said about a pair: its
// direction (Nahoru / dolů) or its interval (Intervaly).

import { midi, step, noteFromStep, noteFromMidi } from './notes.js';

// Melodic intervals up to an octave. `steps` is the distance in letters (a third is two
// letters up), which is what spells the second note correctly: c¹ up a malá tercie is
// es¹, not dis¹. The tritone is spelled as the augmented fourth.
export const INTERVALS = [
  { semitones: 1, short: 'm2', name: 'malá sekunda', steps: 1 },
  { semitones: 2, short: 'v2', name: 'velká sekunda', steps: 1 },
  { semitones: 3, short: 'm3', name: 'malá tercie', steps: 2 },
  { semitones: 4, short: 'v3', name: 'velká tercie', steps: 2 },
  { semitones: 5, short: 'č4', name: 'čistá kvarta', steps: 3 },
  { semitones: 6, short: 'zv4', name: 'tritón', steps: 3 },
  { semitones: 7, short: 'č5', name: 'čistá kvinta', steps: 4 },
  { semitones: 8, short: 'm6', name: 'malá sexta', steps: 5 },
  { semitones: 9, short: 'v6', name: 'velká sexta', steps: 5 },
  { semitones: 10, short: 'm7', name: 'malá septima', steps: 6 },
  { semitones: 11, short: 'v7', name: 'velká septima', steps: 6 },
  { semitones: 12, short: 'č8', name: 'čistá oktáva', steps: 7 },
];

export const ALL_INTERVALS = INTERVALS.map((i) => i.semitones);

export function getInterval(semitones) {
  return INTERVALS.find((i) => i.semitones === semitones) ?? null;
}

// One note per pitch, in whatever spelling the pool has first: by ear Fis and Ges are
// the same note.
function distinctPitches(pool) {
  const byPitch = new Map();
  for (const n of pool) if (!byPitch.has(midi(n))) byPitch.set(midi(n), n);
  return [...byPitch.values()];
}

// Two notes of different pitch from the pool, in random order, or null when the pool has
// fewer than two pitches. Repeats are allowed on purpose: ruling out the previous pair
// would make a two-note pool simply alternate up and down.
export function pickPair(pool, random = Math.random) {
  const notes = distinctPitches(pool);
  if (notes.length < 2) return null;
  const i = Math.floor(random() * notes.length);
  let j = Math.floor(random() * (notes.length - 1));
  if (j >= i) j += 1;
  return [notes[i], notes[j]];
}

export function semitones(first, second) {
  return midi(second) - midi(first);
}

export function direction(first, second) {
  return semitones(first, second) > 0 ? 'up' : 'down';
}

// The note `interval` above (dir 1) or below (dir -1) `first`, spelled on the right
// letter. Where that would need a double sharp or flat, which the staff does not draw,
// the everyday spelling of the pitch is used instead.
export function spellInterval(first, interval, dir) {
  const target = midi(first) + dir * interval.semitones;
  const s = step(first) + dir * interval.steps;
  const acc = target - midi(noteFromStep(s, 0));
  return Math.abs(acc) <= 1 ? noteFromStep(s, acc) : noteFromMidi(target);
}

// A question for Intervaly: a first note from the pool and a second one an enabled
// interval away, up or down, both inside [low, high] (written MIDI). The interval is
// drawn first and evenly, so small intervals, which fit next to more notes, don't come
// up more often than large ones. Null when nothing fits.
export function pickIntervalQuestion(pool, enabled, [low, high], random = Math.random) {
  const options = new Map(); // semitones → [{ first, dir }]
  for (const first of distinctPitches(pool)) {
    for (const interval of INTERVALS) {
      if (!enabled.includes(interval.semitones)) continue;
      for (const dir of [1, -1]) {
        const target = midi(first) + dir * interval.semitones;
        if (target < low || target > high) continue;
        if (!options.has(interval.semitones)) options.set(interval.semitones, []);
        options.get(interval.semitones).push({ first, dir });
      }
    }
  }
  if (options.size === 0) return null;
  const sizes = [...options.keys()];
  const interval = getInterval(sizes[Math.floor(random() * sizes.length)]);
  const choices = options.get(interval.semitones);
  const { first, dir } = choices[Math.floor(random() * choices.length)];
  return { first, second: spellInterval(first, interval, dir), interval, dir };
}
