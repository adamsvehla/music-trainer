// YIN pitch detection (de Cheveigné & Kawahara, 2002) over one buffer of samples.
//
// YIN suits a practice tool better than an FFT peak: it measures periodicity, so a
// saxophone whose second harmonic is louder than its fundamental still reads at the
// fundamental, and taking the *first* dip under the threshold rather than the deepest
// one is what keeps it from jumping an octave down.

export const DEFAULTS = {
  threshold: 0.15, // cumulative-mean-normalised difference a dip must fall under
  unvoiced: 0.35, // no dip under the threshold and the best one above this: no pitch at all
  minFreq: 60,
  maxFreq: 2500,
  minRms: 0.005, // noise gate; below this the buffer is treated as silence
};

export function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

// Returns { freq, clarity, rms } or null for silence and unpitched sound. clarity is
// 1 − d′(τ): close to 1 for a clean tone, lower for breath, noise and note transitions.
export function detectPitch(buf, sampleRate, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const level = rms(buf);
  if (level < o.minRms) return null;

  const maxTau = Math.min(Math.floor(sampleRate / o.minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / o.maxFreq));
  const window = buf.length - maxTau;

  // Difference function, then its cumulative mean normalisation in the same pass.
  const d = new Float32Array(maxTau + 1);
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }

  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < o.threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = minTau;
    for (let t = minTau + 1; t <= maxTau; t++) if (d[t] < d[best]) best = t;
    if (d[best] > o.unvoiced) return null;
    tau = best;
  }

  // Parabolic interpolation between neighbouring lags for sub-sample precision.
  let refined = tau;
  if (tau > 1 && tau < maxTau) {
    const a = d[tau - 1];
    const b = d[tau];
    const c = d[tau + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) refined = tau + (a - c) / (2 * denom);
  }

  return { freq: sampleRate / refined, clarity: Math.max(0, 1 - d[tau]), rms: level };
}
