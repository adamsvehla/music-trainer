// Mode (b), Hraní: a note appears and the player plays it; the microphone decides.
//
// Everything here is in *written* pitch: the detector reports sounding pitch and the
// instrument's transposition is undone before the judge or the tuner sees it, so an alto
// sax player sees the note names they read. The timing rules live in judge.js.

import { h } from '../dom.js';
import { render, displayRange } from '../staff.js';
import { step, midi, czLabel, noteFromMidi } from '../notes.js';
import { soundingMidi } from '../instruments.js';
import { pickNext } from '../quiz.js';
import { createJudge, JUDGE_DEFAULTS } from '../judge.js';
import { startListener, MicrophoneError } from '../audio/listener.js';
import { audioRunning } from '../audio/context.js';
import * as sampler from '../audio/sampler.js';

const IN_TUNE_CENTS = 15;
const TUNER_HOLD_MS = 250; // keep showing the last note through a brief dropout

// Remembered across restarts of the mode (a settings change, a tab switch), so a player
// who turned the microphone on doesn't have to do it again each time.
let micWanted = false;

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function start(ctx) {
  const { svg, controls, pool, clef, instrument, settings, sim } = ctx;
  const steps = pool.map(step);
  const range = displayRange(steps, clef, ctx.instrumentSteps);
  // The detector only has to reach a fourth beyond the instrument's sounding range.
  const minFreq = Math.max(50, hz(soundingMidi(instrument, instrument.low) - 5));
  const maxFreq = hz(soundingMidi(instrument, instrument.high) + 5);

  let target = null;
  let judge = null;
  let missed = false;
  let recorded = false;
  let waiting = false;
  let heard = null; // a wrong note to show beside the target
  let lastHeard = null;
  let lastFrameAt = 0;
  let timer = 0;
  let stopListening = null;
  let stopped = false;

  const micButton = h('button', { type: 'button', class: 'btn primary', onClick: () => toggleMic() });
  const skip = h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      if (!recorded) ctx.record(false);
      advance();
    },
  }, 'Přeskočit');

  const tunerNote = h('div', { class: 'tuner-note' }, '–');
  const needle = h('div', { class: 'needle' });
  const levelBar = h('div');
  const tuner = h('div', { class: 'tuner idle', 'aria-hidden': 'true' },
    tunerNote, h('div', { class: 'meter' }, needle), h('div', { class: 'level' }, levelBar));

  // ?sim: play the target (or a note beside it) through the sampler, whose output is
  // what the detector listens to instead of the microphone.
  const simPlay = (offset) => () => sampler.play(instrument.samples, soundingMidi(instrument, target) + offset, { duration: 1.4 });
  const simRow = sim && h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn', onClick: simPlay(0) }, '▶ Simulovat správný tón'),
    h('button', { type: 'button', class: 'btn', onClick: simPlay(2) }, '▶ Simulovat vedlejší tón'));

  controls.append(tuner, h('div', { class: 'row' }, micButton, skip), simRow);
  setMicLabel();

  function setMicLabel() {
    const on = stopListening !== null;
    micButton.textContent = on
      ? (sim ? 'Vypnout simulovaný vstup' : 'Vypnout mikrofon')
      : (sim ? 'Zapnout simulovaný vstup' : '🎤 Zapnout mikrofon');
    micButton.classList.toggle('primary', !on);
  }

  function draw(state = 'normal') {
    const notes = [{ note: target, state }];
    // A wrong note is drawn beside the target only if it fits the current staff;
    // resizing the card mid-exercise would be more distracting than useful.
    if (heard && step(heard) >= range[0] && step(heard) <= range[1]) notes.push({ note: heard, state: 'wrong' });
    render(svg, { clef, range, notes });
  }

  function idlePrompt() {
    ctx.setFeedback(stopListening ? 'Zahraj zobrazenou notu.' : 'Zapni mikrofon a zahraj zobrazenou notu.');
  }

  function advance() {
    clearTimeout(timer);
    waiting = false;
    target = pickNext(pool, target);
    missed = false;
    recorded = false;
    heard = null;
    judge = createJudge({ target: midi(target), ignoreOctave: settings.ignoreOctave, blockedMidi: lastHeard });
    draw('normal pop');
    idlePrompt();
  }

  function updateTuner(frame, level, now) {
    levelBar.style.width = `${Math.min(100, Math.sqrt(level) * 220)}%`;
    if (!frame) {
      if (now - lastFrameAt > TUNER_HOLD_MS) {
        tuner.classList.add('idle');
        tuner.classList.remove('in-tune');
        tunerNote.textContent = '–';
      }
      return;
    }
    lastFrameAt = now;
    const rounded = Math.round(frame.midi);
    const cents = (frame.midi - rounded) * 100;
    tunerNote.textContent = czLabel(noteFromMidi(rounded));
    needle.style.left = `${50 + cents}%`;
    tuner.classList.remove('idle');
    tuner.classList.toggle('in-tune', Math.abs(cents) < IN_TUNE_CENTS);
  }

  function onFrame(frame, level, now) {
    if (stopped) return;
    // From here on, pitch means written pitch.
    const written = frame && frame.clarity >= JUDGE_DEFAULTS.minClarity
      ? { midi: frame.midi - instrument.transpose, clarity: frame.clarity }
      : null;
    lastHeard = written ? Math.round(written.midi) : null;
    updateTuner(written, level, now);
    if (waiting || !judge) return;

    const verdict = judge.feed(written, now);
    if (verdict.type === 'correct') {
      waiting = true;
      if (!recorded) ctx.record(!missed);
      recorded = true;
      heard = null;
      draw('correct');
      ctx.setFeedback(`Správně – ${czLabel(target)}`, 'ok');
      timer = setTimeout(advance, 700);
    } else if (verdict.type === 'wrong') {
      missed = true;
      heard = noteFromMidi(verdict.midi);
      draw();
      ctx.setFeedback(`Slyším ${czLabel(heard)} – zkus to znovu.`, 'bad');
    }
  }

  async function toggleMic() {
    micButton.blur();
    if (stopListening) {
      stopListening();
      stopListening = null;
      micWanted = false;
      updateTuner(null, 0, Infinity);
      setMicLabel();
      idlePrompt();
      return;
    }
    micButton.disabled = true;
    try {
      const stop = await startListener(onFrame, { source: sim ? sampler.output() : null, minFreq, maxFreq });
      if (stopped) {
        // The mode was left while the permission prompt was open.
        stop();
        return;
      }
      stopListening = stop;
      micWanted = true;
      setMicLabel();
      if (!waiting) idlePrompt();
    } catch (err) {
      ctx.setFeedback(err instanceof MicrophoneError ? err.message : 'Mikrofon se nepodařilo spustit.', 'bad');
    } finally {
      micButton.disabled = false;
    }
  }

  advance();
  // Restarting the mode after a settings change is still inside a user gesture, so the
  // audio context is running and the microphone can come back on by itself.
  if (micWanted && audioRunning()) toggleMic();

  return () => {
    stopped = true;
    clearTimeout(timer);
    stopListening?.();
    if (sim) sampler.stopAll();
  };
}
