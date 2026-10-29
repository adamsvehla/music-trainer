// What the modes that play a note to the player share: the optional reference c¹ before
// it, drawn in its own column on the staff and lit while it sounds, and knowing when the
// whole prompt has finished sounding (the playing mode keeps its microphone deaf until then).

import { parseId } from '../notes.js';
import { staffGeometry, noteSlots, signatureWidth, SP } from '../staff.js';
import { soundingMidi } from '../instruments.js';
import * as sampler from '../audio/sampler.js';

// Written c¹, whatever the instrument.
export const REFERENCE = parseId('C4');
const GAP = 1.1; // seconds from the reference to the target
const DURATION = 1.6; // seconds each note sounds

// Staff layout: with the reference on, c¹ keeps the first column of the note area for
// the whole exercise and the other notes move into a wider area to its right.
export function referenceLayout({ clef, range, signature, withRef }) {
  const width = withRef ? 18 : 15;
  const geometry = staffGeometry(clef, range, width, signatureWidth(signature));
  const refX = geometry.notesX + 1.4 * SP;
  const answerLeft = withRef ? refX + 4 * SP : undefined;
  return {
    width,
    geometry,
    // The notes for render(), placed in the answer area, with the reference in front.
    place(notes, refSounding) {
      const xs = noteSlots(notes.length, geometry, answerLeft);
      const items = notes.map((n, i) => ({ ...n, x: xs[i] }));
      if (withRef) {
        items.unshift({ note: REFERENCE, state: refSounding ? 'reference sounding' : 'reference', x: refX, caption: 'ref.' });
      }
      return items;
    },
  };
}

// Plays written notes on the instrument, after the reference if it is on. onReference(on)
// fires as the reference starts and stops sounding. `endsAt` is the performance.now()
// time the prompt falls silent: Infinity while its samples are still loading, 0 when
// nothing has been played.
export function createPrompter({ instrument, withRef, onReference }) {
  let timer = 0;
  let endsAt = 0;
  let sounding = false;
  let stopped = false;

  const setSounding = (on) => {
    if (stopped || sounding === on) return;
    sounding = on;
    onReference?.(on);
  };

  return {
    get referenceSounding() {
      return sounding;
    },
    get endsAt() {
      return endsAt;
    },
    play(notes) {
      const list = withRef ? [REFERENCE, ...notes] : notes;
      sampler.stopAll();
      clearTimeout(timer);
      setSounding(false);
      endsAt = Infinity;
      return sampler.play(instrument.samples, list.map((n) => soundingMidi(instrument, n)), { gap: GAP, duration: DURATION })
        .then(() => {
          // play() resolves once everything is scheduled, i.e. as the first note starts.
          endsAt = performance.now() + ((list.length - 1) * GAP + DURATION) * 1000;
          if (!withRef || stopped) return;
          setSounding(true);
          timer = setTimeout(() => setSounding(false), GAP * 1000);
        })
        .catch((err) => {
          endsAt = 0;
          throw err;
        });
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
