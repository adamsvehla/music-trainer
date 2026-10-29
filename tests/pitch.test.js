import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../js/audio/pitch.js';

const RATE = 48000;
const SIZE = 2048;

function tone(freq, harmonics = [1], amplitude = 0.5, phase = 0.3) {
  const buf = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let v = 0;
    harmonics.forEach((a, k) => {
      v += a * Math.sin(2 * Math.PI * freq * (k + 1) * (i / RATE) + phase * (k + 1));
    });
    buf[i] = amplitude * v;
  }
  return buf;
}

const cents = (a, b) => 1200 * Math.log2(a / b);
const FREQS = [130.81, 138.59, 174.61, 220, 261.63, 440, 880, 1046.5, 1760, 2093];

test('pure sine tones within ±20 cents', () => {
  for (const f of FREQS) {
    const r = detectPitch(tone(f), RATE);
    assert.ok(r, `no pitch for ${f} Hz`);
    assert.ok(Math.abs(cents(r.freq, f)) < 20, `${f} Hz read as ${r.freq.toFixed(2)} Hz`);
    assert.ok(r.clarity > 0.9);
  }
});

test('sawtooth-like tones stay on the fundamental', () => {
  const saw = Array.from({ length: 10 }, (_, k) => 1 / (k + 1));
  for (const f of FREQS) {
    const r = detectPitch(tone(f, saw, 0.3), RATE);
    assert.ok(r && Math.abs(cents(r.freq, f)) < 20, `${f} Hz read as ${r?.freq}`);
  }
});

test('a weak fundamental under a strong second harmonic (sax-like) is not read an octave up', () => {
  for (const f of [138.59, 196, 311.13, 440]) {
    const r = detectPitch(tone(f, [0.3, 1, 0.6, 0.4, 0.2], 0.3), RATE);
    assert.ok(r && Math.abs(cents(r.freq, f)) < 20, `${f} Hz read as ${r?.freq}`);
  }
});

test('a quiet tone, like the tail of a piano note, is still heard', () => {
  const r = detectPitch(tone(587.33, [1, 0.4, 0.2], 0.0025), RATE);
  assert.ok(r && Math.abs(cents(r.freq, 587.33)) < 20, `read as ${r?.freq}`);
});

test('silence and noise give no pitch', () => {
  assert.equal(detectPitch(new Float32Array(SIZE), RATE), null);
  let seed = 1;
  const noise = new Float32Array(SIZE).map(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.4;
  });
  assert.equal(detectPitch(noise, RATE), null);
});
