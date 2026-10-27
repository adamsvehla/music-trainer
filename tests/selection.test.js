import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, getKey, majorScale, inKey, selectNotes, keyDescription } from '../js/selection.js';
import { notesInRange, noteId, czName, parseId } from '../js/notes.js';
import { INSTRUMENTS } from '../js/instruments.js';
import { CLEFS } from '../js/clefs.js';
import { defaultPool } from '../js/settings.js';

const names = (keyId) => majorScale(getKey(keyId).tonic).map(czName).join(' ');
const piano = notesInRange(INSTRUMENTS.piano.low, INSTRUMENTS.piano.high);
const treble = CLEFS.treble;
const ids = (notes) => notes.map(noteId);

test('major scales are spelled one letter per degree', () => {
  assert.equal(names('C'), 'C D E F G A H');
  assert.equal(names('G'), 'G A H C D E Fis');
  assert.equal(names('H'), 'H Cis Dis E Fis Gis Ais');
  assert.equal(names('F'), 'F G A B C D E');
  assert.equal(names('Es'), 'Es F G As B C D');
  assert.equal(names('Des'), 'Des Es F Ges As B C');
});

test('every offered key is fully spellable in the picker, so no note silently drops out', () => {
  const offered = new Set(notesInRange(parseId('C4'), parseId('B4')).map((n) => `${n.letter}:${n.acc}`));
  for (const key of KEYS.filter((k) => k.tonic)) {
    for (const d of majorScale(key.tonic)) assert.ok(offered.has(`${d.letter}:${d.acc}`), `${key.id}: ${czName(d)}`);
  }
});

test('key and region combine', () => {
  assert.deepEqual(ids(selectNotes(piano, 'G', 'staff', treble)),
    ['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5']);
  assert.deepEqual(ids(selectNotes(piano, 'F', 'lines', treble)), ['E4', 'G4', 'Bb4', 'D5', 'F5']);
  assert.deepEqual(ids(selectNotes(piano, 'C', 'staff', treble)), defaultPool(INSTRUMENTS.piano));
  // Chromatic: every position on the bottom line, i.e. both spellings that sit on it.
  assert.deepEqual(ids(selectNotes(piano, 'chromatic', 'lines', treble)).slice(0, 4), ['Eb4', 'E4', 'Gb4', 'G4']);
});

test('in-key checks the spelling, not just the pitch', () => {
  assert.ok(inKey(getKey('D'), parseId('F#4')));
  assert.ok(!inKey(getKey('D'), parseId('Gb4')));
});

test('descriptions name the relative minor and the signature', () => {
  assert.equal(keyDescription(getKey('G')), 'G dur / e moll · 1 ♯ · g a h c d e fis');
  assert.equal(keyDescription(getKey('B')), 'B dur / g moll · 2 ♭ · b c d es f g a');
  assert.equal(keyDescription(getKey('C')), 'C dur / a moll · bez předznamenání · c d e f g a h');
});
