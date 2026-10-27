// Feeds an audio source through the pitch detector, a few dozen times a second.
//
// The source is the microphone by default, or any AudioNode (the ?sim mode passes the
// sampler's output, so the playing mode can be tested without an instrument).

import { audioContext } from './context.js';
import { detectPitch } from './pitch.js';
import { freqToMidi } from '../notes.js';

export class MicrophoneError extends Error {}

const FRAME_MS = 25; // ~40 analyses a second; each looks at the last 2048 samples (~43 ms)

// Calls onFrame({ midi (float, sounding), freq, clarity, rms } | null, level, now) every
// frame and resolves to a stop() function. `level` is the RMS even when there is no pitch,
// for the input meter.
export async function startListener(onFrame, { source = null, minFreq = 60, maxFreq = 2500 } = {}) {
  const ctx = audioContext();
  await ctx.resume();

  let stream = null;
  if (!source) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicrophoneError('Mikrofon je dostupný jen přes HTTPS nebo na localhostu.');
    }
    try {
      // Echo cancellation, noise suppression and auto gain are built for speech and
      // treat a sustained musical tone as noise to remove, so all three are off.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      throw new MicrophoneError(denied
        ? 'Přístup k mikrofonu je zakázaný. Povol ho v nastavení prohlížeče.'
        : 'Mikrofon se nepodařilo spustit.');
    }
    source = ctx.createMediaStreamSource(stream);
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  // A plain timer rather than requestAnimationFrame: analysis is not drawing, and rAF is
  // throttled to a few frames a second whenever the browser decides the page is not in
  // front (an occluded window, a side panel), which would starve the judge's hold times.
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const level = Math.sqrt(sum / buf.length);
    const r = detectPitch(buf, ctx.sampleRate, { minFreq, maxFreq });
    onFrame(r ? { ...r, midi: freqToMidi(r.freq) } : null, level, performance.now());
  };
  const timer = setInterval(tick, FRAME_MS);

  return () => {
    clearInterval(timer);
    try {
      source.disconnect(analyser);
    } catch {
      // Already disconnected.
    }
    stream?.getTracks().forEach((t) => t.stop());
  };
}
