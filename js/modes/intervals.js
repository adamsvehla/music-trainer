// Poslech · Intervaly: two notes play, a melodic interval up or down, and the player
// names it. The intervals asked are the ones enabled in the settings; the first note is
// one of the selected notes and the second is worked out from the interval, so it can be
// outside the selection but never outside the instrument's range (intervals.js).

import { h, append, ignoreKey } from '../dom.js';
import { render, displayRange } from '../staff.js';
import { step, midi, czLabel } from '../notes.js';
import { soundingMidi } from '../instruments.js';
import { INTERVALS, pickIntervalQuestion } from '../intervals.js';
import * as sampler from '../audio/sampler.js';
import { audioRunning, whenAudioRuns } from '../audio/context.js';
import { createPrompter } from './reference.js';

const QUESTION = 'Jaký interval zazněl?';

export function start(ctx) {
  const { svg, controls, pool, clef, instrument, settings, signature } = ctx;
  const enabled = INTERVALS.filter((i) => settings.intervals.includes(i.semitones));
  const midiRange = [midi(instrument.low), midi(instrument.high)];
  const prompter = createPrompter({ instrument, withRef: false });

  let question = null;
  let answered = false;
  let played = false;
  let timer = 0;
  let cancelPending = () => {};

  if (!pickIntervalQuestion(pool, settings.intervals, midiRange)) {
    render(svg, { clef, range: displayRange(pool.map(step), clef, ctx.instrumentSteps), signature });
    ctx.setFeedback(enabled.length === 0
      ? 'V nastavení zapni aspoň jeden interval.'
      : 'Žádný ze zapnutých intervalů se od vybraných not do rozsahu nástroje nevejde.');
    append(controls, h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onClick: ctx.openSettings }, 'Otevřít nastavení')));
    return () => {};
  }

  const choiceButtons = new Map(enabled.map((interval) => [interval.semitones, h('button', {
    type: 'button',
    class: 'btn',
    title: interval.name,
    onClick: (e) => {
      e.currentTarget.blur();
      answer(interval);
    },
  }, h('b', {}, interval.short), h('small', {}, interval.name))]));

  const replay = h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      playQuestion();
    },
  }, '▶ Přehrát');

  const next = h('button', {
    type: 'button',
    class: 'btn primary',
    hidden: true,
    onClick: (e) => {
      e.currentTarget.blur();
      advance();
    },
  }, 'Další →');

  append(controls,
    h('div', { class: 'interval-grid' }, [...choiceButtons.values()]),
    h('div', { class: 'row' }, replay, next),
    h('p', { class: 'hint keys' }, h('kbd', {}, 'Mezerník'), ' přehraje znovu.'));

  const poolSteps = pool.map(step);

  function draw(state = 'normal') {
    // The pair stays hidden until answered: seeing it would give the interval away. The
    // staff covers the selected notes and grows at the reveal only if the second note
    // lies outside them, rather than reserving an octave either side all the time.
    const pair = answered ? [question.first, question.second] : [];
    const range = displayRange([...poolSteps, ...pair.map(step)], clef, ctx.instrumentSteps);
    render(svg, { clef, range, notes: pair.map((note) => ({ note, state })), signature });
  }

  function playQuestion() {
    if (!question) return;
    played = true;
    prompter.play([question.first, question.second]).catch(() => ctx.setFeedback('Zvuk se nepodařilo načíst.', 'bad'));
  }

  function advance() {
    clearTimeout(timer);
    question = pickIntervalQuestion(pool, settings.intervals, midiRange);
    answered = false;
    played = false;
    for (const b of choiceButtons.values()) b.classList.remove('correct', 'wrong');
    next.hidden = true;
    draw();
    // Before any gesture on this page load the browser will not start sound by itself;
    // the pair then plays on the first tap anywhere (or on ▶ Přehrát).
    ctx.setFeedback(audioRunning() ? QUESTION : 'Klepni na ▶ Přehrát a urči interval.');
    cancelPending();
    cancelPending = whenAudioRuns(() => {
      if (played || answered) return;
      ctx.setFeedback(QUESTION);
      playQuestion();
    });
  }

  function answer(chosen) {
    if (answered || !question) return;
    answered = true;
    const right = question.interval;
    const ok = chosen.semitones === right.semitones;
    ctx.record(ok);
    choiceButtons.get(chosen.semitones).classList.add(ok ? 'correct' : 'wrong');
    choiceButtons.get(right.semitones).classList.add('correct');
    draw(ok ? 'correct' : 'wrong');
    const way = question.dir > 0 ? 'nahoru' : 'dolů';
    const notes = `${czLabel(question.first)} → ${czLabel(question.second)}`;
    if (ok) {
      ctx.setFeedback(`Správně – ${right.name} ${way} (${notes})`, 'ok');
      timer = setTimeout(advance, 1600);
    } else {
      ctx.setFeedback(`Ne – ${right.name} ${way} (${notes}), tvoje odpověď: ${chosen.name}`, 'bad');
      playQuestion();
      next.hidden = false;
    }
  }

  function onKey(e) {
    if (ignoreKey(e)) return;
    if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (answered) {
      if ((e.key === 'Enter' || e.key === ' ') && !next.hidden) {
        e.preventDefault();
        advance();
      }
      return;
    }
    if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      playQuestion();
    }
  }

  sampler.preload(instrument.samples, pool.map((n) => soundingMidi(instrument, n)));
  document.addEventListener('keydown', onKey);
  advance();

  return () => {
    cancelPending();
    prompter.stop();
    clearTimeout(timer);
    sampler.stopAll();
    document.removeEventListener('keydown', onKey);
  };
}
