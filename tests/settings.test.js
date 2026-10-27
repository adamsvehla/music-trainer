import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, defaultPool, currentPool } from '../js/settings.js';
import { INSTRUMENTS } from '../js/instruments.js';

const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

test('defaults: piano, reading mode, the naturals on the staff', () => {
  const s = loadSettings(memory());
  assert.equal(s.mode, 'read');
  assert.equal(s.instrument, 'piano');
  assert.deepEqual(s.pools.piano, ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']);
  assert.deepEqual(s.pools.altoSax, defaultPool(INSTRUMENTS.altoSax));
});

test('stored values survive a round trip; unknown ones fall back', () => {
  const store = memory();
  const s = loadSettings(store);
  s.instrument = 'altoSax';
  s.pools.altoSax = ['Bb3', 'F#6', 'C9', 'nonsense'];
  s.earReference = true;
  saveSettings(s, store);
  const again = loadSettings(store);
  assert.equal(again.instrument, 'altoSax');
  assert.equal(again.earReference, true);
  assert.deepEqual(again.pools.altoSax, ['Bb3', 'F#6']); // out-of-range and malformed ids dropped
  assert.equal(currentPool(again).length, 2);
});

test('corrupt or unavailable storage still gives working defaults', () => {
  assert.equal(loadSettings(memory({ 'music-trainer:v1': '{oops' })).mode, 'read');
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = loadSettings(throwing);
  assert.equal(s.instrument, 'piano');
  assert.doesNotThrow(() => saveSettings(s, throwing));
  assert.equal(loadSettings(memory({ 'music-trainer:v1': JSON.stringify({ mode: 'bogus', instrument: 'tuba' }) })).instrument, 'piano');
});

test('an empty pool is kept as the user chose it', () => {
  const store = memory();
  const s = loadSettings(store);
  s.pools.piano = [];
  saveSettings(s, store);
  assert.deepEqual(loadSettings(store).pools.piano, []);
});
