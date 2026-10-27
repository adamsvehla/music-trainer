// User settings, kept in localStorage.
//
// Storage can be missing or throw (private windows, blocked site data), so every access
// is wrapped and the app simply runs on defaults when it fails.

import { INSTRUMENTS, DEFAULT_INSTRUMENT, getInstrument } from './instruments.js';
import { CLEFS, DEFAULT_CLEF, getClef } from './clefs.js';
import { notesInRange, noteId, parseId, step } from './notes.js';

const KEY = 'music-trainer:v1';
export const MODES = ['read', 'play', 'ear'];

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
    instrument: INSTRUMENTS[stored.instrument] ? stored.instrument : DEFAULT_INSTRUMENT,
    clef: CLEFS[stored.clef] ? stored.clef : DEFAULT_CLEF,
    earReference: stored.earReference === true,
    ignoreOctave: stored.ignoreOctave === true,
    showAccidentals: stored.showAccidentals === true,
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

export function currentPool(settings) {
  return (settings.pools[settings.instrument] ?? []).map(parseId).filter(Boolean);
}
