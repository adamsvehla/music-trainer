// The instruments the trainer knows.
//
// The staff always shows the *written* pitch, the one the player reads; audio is always
// at *sounding* pitch, written MIDI + transpose. That one rule covers both audio modes:
// a written c² on the alto sax is played back as a sounding es¹, and an es¹ heard by the
// microphone counts as the written c².

import { midi, parseId } from './notes.js';

export const INSTRUMENTS = {
  piano: {
    id: 'piano',
    name: 'Klavír',
    transpose: 0,
    low: parseId('F3'),
    high: parseId('C7'),
    samples: 'piano',
    clefs: ['treble'],
  },
  altoSax: {
    id: 'altoSax',
    name: 'Altsaxofon (E♭)',
    transpose: -9,
    // Standard written range including the high F♯ key; altissimo is left out.
    low: parseId('Bb3'),
    high: parseId('F#6'),
    samples: 'alto-sax',
    // The FatBoy set is recorded about 8 dB below the Fluid R3 one it replaced (RMS
    // ~0.015 against ~0.037 in the low and middle register); this restores the old level
    // with the peaks still near 0.18.
    gain: 2.5,
    clefs: ['treble'],
  },
};

export const DEFAULT_INSTRUMENT = 'piano';

export function getInstrument(id) {
  return INSTRUMENTS[id] ?? INSTRUMENTS[DEFAULT_INSTRUMENT];
}

export function soundingMidi(instrument, note) {
  return midi(note) + instrument.transpose;
}

export function writtenMidi(instrument, sounding) {
  return sounding - instrument.transpose;
}

// The sounding MIDI range the sample set has to cover.
export function sampleRange(instrument) {
  return [soundingMidi(instrument, instrument.low), soundingMidi(instrument, instrument.high)];
}
