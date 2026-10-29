import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickPair, direction, semitones, spellInterval, getInterval, pickIntervalQuestion, ALL_INTERVALS,
} from '../js/intervals.js';
import { parseId, midi, noteId } from '../js/notes.js';

const pool = (...ids) => ids.map(parseId);

test('a pair is two different pitches from the pool', () => {
  const p = pool('E4', 'G4', 'B4', 'D5');
  for (let i = 0; i < 300; i++) {
    const [a, b] = pickPair(p);
    assert.notEqual(midi(a), midi(b));
    assert.ok(p.includes(a) && p.includes(b));
  }
});

test('enharmonic spellings count as one pitch', () => {
  assert.equal(pickPair(pool('F#4', 'Gb4')), null);
  assert.equal(pickPair(pool('C4')), null);
  assert.equal(pickPair([]), null);
  const [a, b] = pickPair(pool('F#4', 'Gb4', 'A4'));
  assert.deepEqual([noteId(a), noteId(b)].sort(), ['A4', 'F#4']);
});

test('both orders come up, so the direction cannot be predicted', () => {
  const p = pool('C4', 'G4');
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(direction(...pickPair(p)));
  assert.deepEqual([...seen].sort(), ['down', 'up']);
});

test('direction and distance', () => {
  assert.equal(direction(parseId('E4'), parseId('A4')), 'up');
  assert.equal(direction(parseId('A4'), parseId('E4')), 'down');
  assert.equal(semitones(parseId('C4'), parseId('G4')), 7);
  assert.equal(semitones(parseId('A4'), parseId('F#4')), -3);
});

const spell = (from, semis, dir) => noteId(spellInterval(parseId(from), getInterval(semis), dir));

test('the second note is spelled on the interval\'s letter', () => {
  assert.equal(spell('C4', 3, 1), 'Eb4'); // malá tercie up: es, not dis
  assert.equal(spell('E4', 4, 1), 'G#4');
  assert.equal(spell('F4', 6, 1), 'B4'); // tritone as the augmented fourth: h
  assert.equal(spell('A4', 7, -1), 'D4');
  assert.equal(spell('Bb3', 12, 1), 'Bb4');
  assert.equal(spell('F#4', 1, 1), 'G4');
  assert.equal(spell('Gb4', 2, -1), 'Fb4'); // fes is a single flat, so it stays
  assert.equal(spell('Db4', 4, -1), 'A3'); // would be a double flat (heses): plain a instead
});

test('every interval question fits the range and is what it says', () => {
  const pool = ['E4', 'G4', 'B4', 'D5', 'F5'].map(parseId);
  const range = [midi(parseId('C4')), midi(parseId('A5'))];
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const q = pickIntervalQuestion(pool, ALL_INTERVALS, range);
    const m = midi(q.second);
    assert.ok(m >= range[0] && m <= range[1]);
    assert.equal(semitones(q.first, q.second), q.dir * q.interval.semitones);
    assert.ok(pool.includes(q.first));
    seen.add(q.interval.semitones);
  }
  assert.equal(seen.size, 12); // every interval comes up
});

test('only enabled intervals are asked; nothing that fits gives null', () => {
  const pool = [parseId('C4')];
  const range = [midi(parseId('C4')), midi(parseId('C5'))];
  for (let i = 0; i < 100; i++) assert.ok([3, 7].includes(pickIntervalQuestion(pool, [3, 7], range).interval.semitones));
  assert.equal(pickIntervalQuestion(pool, [], range), null);
  assert.equal(pickIntervalQuestion(pool, [12], [60, 66]), null);
});
