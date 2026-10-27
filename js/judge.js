// Decides, frame by frame, whether what the microphone hears answers the target note.
// Pure: it takes detected frames and timestamps, so the timing rules can be tested
// without audio.

export const JUDGE_DEFAULTS = {
  holdCorrect: 120, // ms the right note has to stay steady before it counts
  holdWrong: 300, // ms a wrong note has to stay steady before it is reported
  minClarity: 0.8, // frames below this are breath, noise or a note changing
  sameNote: 0.65, // semitones within which a frame still belongs to the current candidate
};

// `target` and every frame's `midi` are in the same pitch space (the caller converts
// sounding pitch to written). `blockedMidi` is whatever was ringing when this target
// appeared: nothing is judged until the input falls silent or moves off it, so the tail
// of the previous note cannot count against the next one.
export function createJudge({ target, ignoreOctave = false, blockedMidi = null, ...options }) {
  const o = { ...JUDGE_DEFAULTS, ...options };
  let armed = blockedMidi === null;
  let candidate = null;
  let since = 0;
  let reported = false;

  const matches = (m) => (ignoreOctave ? (((m - target) % 12) + 12) % 12 === 0 : m === target);

  return {
    // frame: { midi (float), clarity } or null for silence. Returns
    // { type: 'idle' | 'listening' | 'correct' | 'wrong', midi? }.
    feed(frame, now) {
      if (!frame || frame.clarity < o.minClarity) {
        candidate = null;
        armed = true;
        return { type: 'idle' };
      }
      const rounded = Math.round(frame.midi);
      if (!armed) {
        if (Math.abs(frame.midi - blockedMidi) < o.sameNote) return { type: 'idle' };
        armed = true;
      }
      if (candidate === null || Math.abs(frame.midi - candidate) >= o.sameNote) {
        candidate = rounded;
        since = now;
        reported = false;
      }
      const held = now - since;
      if (matches(candidate)) {
        if (held >= o.holdCorrect) return { type: 'correct', midi: candidate };
      } else if (held >= o.holdWrong && !reported) {
        reported = true;
        return { type: 'wrong', midi: candidate };
      }
      return { type: 'listening', midi: candidate };
    },
  };
}
