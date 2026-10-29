// User settings, kept in localStorage.
//
// Storage can be missing or throw (private windows, blocked site data), so every access
// is wrapped and the app simply runs on defaults when it fails.

import { INSTRUMENTS, DEFAULT_INSTRUMENT, getInstrument } from './instruments.js';
import { CLEFS, DEFAULT_CLEF, getClef } from './clefs.js';
import { notesInRange, noteId, parseId, step } from './notes.js';
import { KEYS, REGIONS, DEFAULT_KEY, DEFAULT_REGION, getKey, keySignature } from './selection.js';
import { ALL_INTERVALS } from './intervals.js';

const KEY = 'music-trainer:v1';

// The header tabs and, for groups with more than one, the modes on the staff card's tabs.
export const GROUPS = [
  { id: 'read', name: 'Čtení', modes: [['read', 'Čtení']] },
  { id: 'play', name: 'Hraní', modes: [['play', 'Podle not'], ['playEar', 'Podle sluchu']] },
  { id: 'listen', name: 'Poslech', modes: [['ear', 'Nota'], ['direction', 'Nahoru / dolů'], ['intervals', 'Intervaly']] },
];
export const MODES = GROUPS.flatMap((g) => g.modes.map(([mode]) => mode));

export function groupOf(mode) {
  return GROUPS.find((g) => g.modes.some(([m]) => m === mode)) ?? GROUPS[0];
}

// The naturals on the five lines and four spaces of the treble staff, e¹–f².
export function defaultPool(instrument) {
  return notesInRange(instrument.low, instrument.high)
    .filter((n) => n.acc === 0 && step(n) >= 30 && step(n) <= 38)
    .map(noteId);
}

export function loadSettings(storage = globalThis.localStorage) {
  let stored = {};
  try {
    stored = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {};
  } catch {
    stored = {};
  }
  const settings = {
    mode: MODES.includes(stored.mode) ? stored.mode : 'read',
    // The mode last used in each group, so its header tab returns there.
    lastModes: Object.fromEntries(GROUPS.flatMap((g) => {
      const mode = stored.lastModes?.[g.id];
      return g.modes.some(([m]) => m === mode) ? [[g.id, mode]] : [];
    })),
    // Poslech · Intervaly: which intervals are asked, in semitones.
    intervals: Array.isArray(stored.intervals)
      ? ALL_INTERVALS.filter((s) => stored.intervals.includes(s))
      : [...ALL_INTERVALS],
    instrument: INSTRUMENTS[stored.instrument] ? stored.instrument : DEFAULT_INSTRUMENT,
    clef: CLEFS[stored.clef] ? stored.clef : DEFAULT_CLEF,
    // The reference c¹ before any note the app plays to the player (Poslech, Hraní by ear).
    earReference: stored.earReference === true,
    ignoreOctave: stored.ignoreOctave === true,
    showAccidentals: stored.showAccidentals === true,
    // The last quick selection in the picker, so the next one starts from it.
    key: KEYS.some((k) => k.id === stored.key) ? stored.key : DEFAULT_KEY,
    region: REGIONS.some((r) => r.id === stored.region) ? stored.region : DEFAULT_REGION,
    // Draw that key's signature, so in-key notes appear without their own accidentals.
    showKeySignature: stored.showKeySignature !== false,
    pools: {},
  };
  // Each instrument keeps its own pool, because the ranges differ. Ids outside the range
  // (from an older version, or edited by hand) are dropped rather than trusted.
  for (const instrument of Object.values(INSTRUMENTS)) {
    const valid = new Set(notesInRange(instrument.low, instrument.high).map(noteId));
    const saved = stored.pools?.[instrument.id];
    settings.pools[instrument.id] = Array.isArray(saved)
      ? saved.filter((id) => valid.has(id))
      : defaultPool(instrument);
  }
  return settings;
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisting is acceptable; the session keeps working from memory.
  }
}

export function currentInstrument(settings) {
  return getInstrument(settings.instrument);
}

export function currentClef(settings) {
  return getClef(settings.clef);
}

export function currentKey(settings) {
  return getKey(settings.key);
}

// The signature the staff should show, or null when it is switched off or the key has none.
export function currentSignature(settings) {
  return settings.showKeySignature ? keySignature(currentKey(settings)) : null;
}

export function currentPool(settings) {
  return (settings.pools[settings.instrument] ?? []).map(parseId).filter(Boolean);
}
