// The two Hraní modes: the player plays a note and the microphone decides. The note is
// given either on the staff (Hraní podle not, prompt 'staff') or by ear (Hraní podle
// sluchu, prompt 'ear'): the app plays it, after the reference c¹ if that is on, and the
// staff shows it only once it has been played back or skipped.
//
// Everything here is in *written* pitch: the detector reports sounding pitch and the
// instrument's transposition is undone before the judge or the tuner sees it, so an alto
// sax player sees the note names they read. The timing rules live in judge.js.
//
// By ear the microphone also hears the app's own playback (echo cancellation is off,
// because it treats a sustained tone as noise), so nothing is heard or judged until the
// prompt has fallen silent.

import { h, append } from '../dom.js';
import { render, displayRange } from '../staff.js';
import { step, midi, czLabel } from '../notes.js';
import { spellMidi } from '../selection.js';
import { soundingMidi } from '../instruments.js';
import { pickNext } from '../quiz.js';
import { createJudge, JUDGE_DEFAULTS } from '../judge.js';
import { startListener, MicrophoneError } from '../audio/listener.js';
import { audioRunning, unlockAudio, whenAudioRuns } from '../audio/context.js';
import * as sampler from '../audio/sampler.js';
import { REFERENCE, referenceLayout, createPrompter } from './reference.js';

const IN_TUNE_CENTS = 15;
const TUNER_HOLD_MS = 250; // keep showing the last note through a brief dropout
const QUIET_TAIL_MS = 300; // after the prompt's last note fades, for the room to fall silent

// Remembered across restarts of the mode (a settings change, a switch between the two
// Hraní tabs), so a player who turned the microphone on doesn't have to do it again each time.
let micWanted = false;

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function start(ctx, prompt) {
  const { svg, controls, pool, clef, instrument, settings, sim, signature } = ctx;
  const byEar = prompt === 'ear';
  const withRef = byEar && settings.earReference;
  const range = displayRange([...pool.map(step), ...(withRef ? [step(REFERENCE)] : [])], clef, ctx.instrumentSteps);
  const layout = referenceLayout({ clef, range, signature, withRef });
  const prompter = createPrompter({ instrument, withRef, onReference: () => draw() });
  // The detector only has to reach a fourth beyond the instrument's sounding range.
  const minFreq = Math.max(50, hz(soundingMidi(instrument, instrument.low) - 5));
  const maxFreq = hz(soundingMidi(instrument, instrument.high) + 5);

  let target = null;
  let targetState = 'normal';
  let revealed = false; // by ear: whether the staff shows the target yet
  let played = false;
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
  let cancelPending = () => {};

  if (byEar) sampler.preload(instrument.samples, [...pool, REFERENCE].map((n) => soundingMidi(instrument, n)));

  const micButton = h('button', { type: 'button', class: 'btn primary', onClick: () => toggleMic() });
  const replay = byEar && h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      playPrompt();
    },
  }, '▶ Přehrát');
  const skip = h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      skipNote();
    },
  }, 'Přeskočit');

  const tunerNote = h('div', { class: 'tuner-note' }, '–');
  const needle = h('div', { class: 'needle' });
  const levelBar = h('div');
  const tuner = h('div', { class: 'tuner idle', 'aria-hidden': 'true' },
    tunerNote, h('div', { class: 'meter' }, needle), h('div', { class: 'level' }, levelBar));

  // ?sim: play the target (or a note beside it) through the sampler, whose output is
  // what the detector listens to instead of the microphone.
  const simPlay = (offset) => () => sampler.play(instrument, soundingMidi(instrument, target) + offset, { duration: 1.4 });
  const simRow = sim && h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn', onClick: simPlay(0) }, '▶ Simulovat správný tón'),
    h('button', { type: 'button', class: 'btn', onClick: simPlay(2) }, '▶ Simulovat vedlejší tón'));

  append(controls,
    tuner,
    h('div', { class: 'row' }, micButton, replay, skip),
    simRow,
    byEar && h('p', { class: 'hint' }, 'Během přehrávání mikrofon neposlouchá, takže začni hrát, až tón dozní.'),
  );
  setMicLabel();

  function setMicLabel() {
    const on = stopListening !== null;
    micButton.textContent = on
      ? (sim ? 'Vypnout simulovaný vstup' : 'Vypnout mikrofon')
      : (sim ? 'Zapnout simulovaný vstup' : '🎤 Zapnout mikrofon');
    micButton.classList.toggle('primary', !on);
  }

  function draw(state = targetState) {
    targetState = state.replace(' pop', '');
    const notes = [];
    if (!byEar || revealed) notes.push({ note: target, state });
    // A wrong note is drawn beside the target only if it fits the current staff;
    // resizing the card mid-exercise would be more distracting than useful.
    if (heard && step(heard) >= range[0] && step(heard) <= range[1]) notes.push({ note: heard, state: 'wrong' });
    render(svg, { clef, range, notes: layout.place(notes, prompter.referenceSounding), widthSp: layout.width, signature });
  }

  function idlePrompt() {
    if (byEar) {
      ctx.setFeedback(stopListening ? 'Poslouchej a zahraj stejný tón.' : 'Zapni mikrofon, poslouchej a zahraj stejný tón.');
    } else {
      ctx.setFeedback(stopListening ? 'Zahraj zobrazenou notu.' : 'Zapni mikrofon a zahraj zobrazenou notu.');
    }
  }

  function playPrompt() {
    if (!target) return;
    unlockAudio();
    played = true;
    prompter.play([target]).catch(() => ctx.setFeedback('Zvuk se nepodařilo načíst.', 'bad'));
  }

  function advance() {
    clearTimeout(timer);
    waiting = false;
    target = pickNext(pool, target);
    revealed = false;
    played = false;
    missed = false;
    recorded = false;
    heard = null;
    judge = createJudge({ target: midi(target), ignoreOctave: settings.ignoreOctave, blockedMidi: lastHeard });
    draw('normal pop');
    idlePrompt();
    if (!byEar) return;
    // Before any gesture on this page load the browser will not start sound by itself;
    // the prompt then plays on the first tap anywhere (or on ▶ Přehrát).
    if (!audioRunning()) ctx.setFeedback('Klepni na ▶ Přehrát, poslouchej a zahraj stejný tón.');
    cancelPending();
    cancelPending = whenAudioRuns(() => {
      if (!played && !stopped) {
        if (!waiting) idlePrompt();
        playPrompt();
      }
    });
  }

  function skipNote() {
    if (!recorded) ctx.record(false);
    recorded = true;
    if (!byEar || waiting) {
      advance();
      return;
    }
    // By ear the player never saw the note, so show (and play) it before moving on.
    waiting = true;
    revealed = true;
    heard = null;
    draw('normal');
    ctx.setFeedback(`Zaznělo ${czLabel(target)}.`);
    sampler.stopAll();
    sampler.play(instrument, soundingMidi(instrument, target)).catch(() => {});
    timer = setTimeout(advance, 1800);
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
    tunerNote.textContent = czLabel(spellMidi(rounded, ctx.key));
    needle.style.left = `${50 + cents}%`;
    tuner.classList.remove('idle');
    tuner.classList.toggle('in-tune', Math.abs(cents) < IN_TUNE_CENTS);
  }

  function onFrame(frame, level, now) {
    if (stopped) return;
    // While the prompt is sounding, what comes in is the app itself.
    if (byEar && now < prompter.endsAt + QUIET_TAIL_MS) {
      lastHeard = null;
      updateTuner(null, 0, now);
      return;
    }
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
      revealed = true;
      draw('correct');
      ctx.setFeedback(`Správně – ${czLabel(target)}`, 'ok');
      timer = setTimeout(advance, byEar ? 1100 : 700);
    } else if (verdict.type === 'wrong') {
      missed = true;
      heard = spellMidi(verdict.midi, ctx.key);
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
    cancelPending();
    prompter.stop();
    clearTimeout(timer);
    stopListening?.();
    if (byEar || sim) sampler.stopAll();
  };
}
