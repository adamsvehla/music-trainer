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

test('the last quick selection is remembered, an unknown one falls back to C dur on the staff', () => {
  const kept = loadSettings(memory({ 'music-trainer:v1': JSON.stringify({ key: 'Es', region: 'lines' }) }));
  assert.equal(kept.key, 'Es');
  assert.equal(kept.region, 'lines');
  const reset = loadSettings(memory({ 'music-trainer:v1': JSON.stringify({ key: 'Fis', region: 'everywhere' }) }));
  assert.equal(reset.key, 'C');
  assert.equal(reset.region, 'staff');
});

test('every mode is remembered', () => {
  for (const mode of ['read', 'play', 'playEar', 'ear', 'direction', 'intervals']) {
    assert.equal(loadSettings(memory({ 'music-trainer:v1': JSON.stringify({ mode }) })).mode, mode);
  }
});

test('the last mode of each group is kept only if it belongs to that group', () => {
  const s = loadSettings(memory({
    'music-trainer:v1': JSON.stringify({ lastModes: { play: 'playEar', listen: 'read', read: 'nonsense' } }),
  }));
  assert.deepEqual(s.lastModes, { play: 'playEar' });
});

test('intervals: all by default, a stored choice is kept and cleaned', () => {
  assert.equal(loadSettings(memory()).intervals.length, 12);
  const s = loadSettings(memory({ 'music-trainer:v1': JSON.stringify({ intervals: [7, 3, 3, 40, 'x'] }) }));
  assert.deepEqual(s.intervals, [3, 7]);
});

test('an empty pool is kept as the user chose it', () => {
  const store = memory();
  const s = loadSettings(store);
  s.pools.piano = [];
  saveSettings(s, store);
  assert.deepEqual(loadSettings(store).pools.piano, []);
});
