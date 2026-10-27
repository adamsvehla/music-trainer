import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseId, noteId, midi, step, czName, czLabel, parseCz, isCzPrefix,
  noteFromMidi, noteFromStep, notesInRange,
} from '../js/notes.js';
import { INSTRUMENTS, soundingMidi, writtenMidi, sampleRange } from '../js/instruments.js';

test('MIDI and staff step of familiar notes', () => {
  assert.equal(midi(parseId('C4')), 60);
  assert.equal(midi(parseId('A4')), 69);
  assert.equal(midi(parseId('Bb3')), 58);
  assert.equal(midi(parseId('F#6')), 90);
  assert.equal(step(parseId('E4')), 30); // bottom line of the treble staff
  assert.equal(step(parseId('F5')), 38); // top line
  assert.equal(step(parseId('F#5')), 38); // accidentals do not move the notehead
});

test('ids round-trip', () => {
  for (const id of ['C4', 'F#4', 'Bb3', 'Eb5', 'B6']) assert.equal(noteId(parseId(id)), id);
  assert.equal(parseId('H4'), null);
});

test('Czech names: H is B natural, B is B flat', () => {
  assert.equal(czName(parseId('B4')), 'H');
  assert.equal(czName(parseId('Bb4')), 'B');
  assert.equal(czName(parseId('Eb4')), 'Es');
  assert.equal(czName(parseId('Ab4')), 'As');
  assert.equal(czName(parseId('Db4')), 'Des');
  assert.equal(czName(parseId('F#4')), 'Fis');
  assert.equal(czName(parseId('A#4')), 'Ais');
});

test('Czech octave labels', () => {
  assert.equal(czLabel(parseId('C4')), 'c¹');
  assert.equal(czLabel(parseId('F#5')), 'fis²');
  assert.equal(czLabel(parseId('Bb3')), 'b');
  assert.equal(czLabel(parseId('C7')), 'c⁴');
  assert.equal(czLabel(parseId('G2')), 'G');
});

test('parsing typed Czech names', () => {
  assert.deepEqual(parseCz('b'), { letter: 6, acc: -1 });
  assert.deepEqual(parseCz('H'), { letter: 6, acc: 0 });
  assert.deepEqual(parseCz(' Fis '), { letter: 3, acc: 1 });
  assert.deepEqual(parseCz('es'), { letter: 2, acc: -1 });
  assert.deepEqual(parseCz('as'), { letter: 5, acc: -1 });
  assert.equal(parseCz('x'), null);
  assert.ok(isCzPrefix('fi'));
  assert.ok(!isCzPrefix('fx'));
});

test('spelling a heard pitch and a clicked step', () => {
  assert.equal(noteId(noteFromMidi(63)), 'Eb4');
  assert.equal(noteId(noteFromMidi(70)), 'Bb4');
  assert.equal(noteId(noteFromMidi(66)), 'F#4');
  assert.equal(noteId(noteFromStep(28)), 'C4');
  assert.equal(noteId(noteFromStep(34, -1)), 'Bb4');
});

test('the picker range offers both everyday spellings of black keys', () => {
  const ids = notesInRange(parseId('C4'), parseId('E4')).map(noteId);
  assert.deepEqual(ids, ['C4', 'C#4', 'Db4', 'D4', 'D#4', 'Eb4', 'E4']);
  const sax = notesInRange(INSTRUMENTS.altoSax.low, INSTRUMENTS.altoSax.high).map(noteId);
  assert.equal(sax[0], 'A#3');
  assert.equal(sax.at(-1), 'Gb6');
});

test('alto sax transposes a major sixth down', () => {
  const sax = INSTRUMENTS.altoSax;
  assert.equal(soundingMidi(sax, parseId('C5')), 63); // written c² sounds es¹
  assert.equal(writtenMidi(sax, 63), 72);
  assert.deepEqual(sampleRange(sax), [49, 81]); // D♭3 – A5
  assert.deepEqual(sampleRange(INSTRUMENTS.piano), [53, 96]); // F3 – C7
});
