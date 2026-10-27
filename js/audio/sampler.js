// Plays the vendored per-note samples.
//
// Each file is fetched and decoded once, on first use, and the decoded buffer is cached
// for the session. All notes go through one master gain node; the ?sim test mode taps
// that node to feed the pitch detector.

import { audioContext } from './context.js';

// The sample files use the source's own names: flats, scientific octave (assets/samples/ATTRIBUTION.md).
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const RELEASE = 0.25; // seconds of fade-out, so a cut-off note doesn't click

const buffers = new Map();
const playing = new Set();
let master = null;

export function output() {
  if (!master) {
    const ctx = audioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return master;
}

export function sampleUrl(folder, midi) {
  return `assets/samples/${folder}/${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
}

export function load(folder, midi) {
  const url = sampleUrl(folder, midi);
  if (!buffers.has(url)) {
    const pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      // The callback form of decodeAudioData also works in older Safari.
      .then((data) => new Promise((resolve, reject) => audioContext().decodeAudioData(data, resolve, reject)));
    pending.catch(() => buffers.delete(url)); // let a later call retry
    buffers.set(url, pending);
  }
  return buffers.get(url);
}

export function preload(folder, midis) {
  return Promise.allSettled([...new Set(midis)].map((m) => load(folder, m)));
}

// Stops everything still sounding, with a short fade.
export function stopAll() {
  const ctx = audioContext();
  for (const { source, env } of playing) {
    env.gain.cancelScheduledValues(ctx.currentTime);
    env.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    source.stop(ctx.currentTime + 0.15);
  }
  playing.clear();
}

// Plays one note or a sequence `gap` seconds apart. Resolves once everything is
// scheduled; all samples are loaded first so a slow fetch can't stretch the sequence.
export async function play(folder, midis, { gap = 1.1, duration = 1.6 } = {}) {
  const list = Array.isArray(midis) ? midis : [midis];
  const loaded = await Promise.all(list.map((m) => load(folder, m)));
  const ctx = audioContext();
  const start = ctx.currentTime + 0.03;
  loaded.forEach((buffer, i) => {
    const t0 = start + i * gap;
    const end = t0 + Math.min(duration, buffer.duration);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t0);
    env.gain.setValueAtTime(1, Math.max(t0, end - RELEASE));
    env.gain.linearRampToValueAtTime(0.0001, end);
    source.connect(env).connect(output());
    const entry = { source, env };
    playing.add(entry);
    source.onended = () => playing.delete(entry);
    source.start(t0);
    source.stop(end + 0.02);
  });
}
