import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signatureAcc, accidentalsToDraw } from '../js/keysig.js';
import { getKey, keySignature, spellMidi } from '../js/selection.js';
import { staffGeometry, signatureWidth, noteSlots } from '../js/staff.js';
import { CLEFS } from '../js/clefs.js';
import { parseId, noteId } from '../js/notes.js';

const G = keySignature(getKey('G'));
const ES = keySignature(getKey('Es'));
const notes = (...ids) => ids.map(parseId);

test('signatures of the offered keys', () => {
  assert.deepEqual(G, { acc: 1, count: 1 });
  assert.deepEqual(keySignature(getKey('H')), { acc: 1, count: 5 });
  assert.deepEqual(keySignature(getKey('Des')), { acc: -1, count: 5 });
  assert.equal(keySignature(getKey('C')), null);
  assert.equal(keySignature(getKey('chromatic')), null);
});

test('which letters a signature alters', () => {
  assert.equal(signatureAcc(G, 3), 1); // F
  assert.equal(signatureAcc(G, 0), 0); // C
  assert.deepEqual([6, 2, 5, 1].map((l) => signatureAcc(ES, l)), [-1, -1, -1, 0]); // B E A, not D
  assert.equal(signatureAcc(null, 3), 0);
});

test('in-key notes print bare, departures get their accidental', () => {
  assert.deepEqual(accidentalsToDraw(notes('F#4', 'G4'), G), [null, null]);
  assert.deepEqual(accidentalsToDraw(notes('F4'), G), [0]); // natural sign
  assert.deepEqual(accidentalsToDraw(notes('Bb4', 'Eb5', 'A4'), ES), [null, null, 0]);
  assert.deepEqual(accidentalsToDraw(notes('F#4'), null), [1]); // no signature: as before
});

test('a row reads as one bar: an accidental holds for its line or space only', () => {
  assert.deepEqual(accidentalsToDraw(notes('F4', 'F#4'), G), [0, 1]); // ♮ then ♯ back
  assert.deepEqual(accidentalsToDraw(notes('F4', 'F#4', 'Gb4', 'G4'), null), [null, 1, -1, 0]);
  assert.deepEqual(accidentalsToDraw(notes('F#4', 'F5'), null), [1, null]); // other octave unaffected
});

test('heard pitches are named the way the key writes them', () => {
  assert.equal(noteId(spellMidi(68, getKey('As'))), 'Ab4');
  assert.equal(noteId(spellMidi(68, getKey('E'))), 'G#4');
  assert.equal(noteId(spellMidi(70, getKey('G'))), 'Bb4'); // outside the key: everyday spelling
  assert.equal(noteId(spellMidi(60, getKey('Des'))), 'C4');
});

test('a signature widens the staff and moves the notes right by its width', () => {
  assert.equal(signatureWidth(null), 0);
  const plain = staffGeometry(CLEFS.treble, [28, 40], 15);
  const withSig = staffGeometry(CLEFS.treble, [28, 40], 15, signatureWidth(ES));
  const shift = signatureWidth(ES) * 10;
  assert.equal(withSig.width - plain.width, shift);
  assert.ok(Math.abs(noteSlots(1, withSig)[0] - noteSlots(1, plain)[0] - shift) < 1e-9);
});
