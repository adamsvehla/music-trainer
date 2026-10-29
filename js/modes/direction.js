// Poslech · Nahoru / dolů: two notes play one after the other and the player says whether
// the melody went up or down. Afterwards the staff shows the pair in the order it was
// played. Naming the interval itself is Poslech · Intervaly (modes/intervals.js).

import { h, append, ignoreKey } from '../dom.js';
import { render, displayRange } from '../staff.js';
import { step, czLabel } from '../notes.js';
import { soundingMidi } from '../instruments.js';
import { pickPair, direction } from '../intervals.js';
import * as sampler from '../audio/sampler.js';
import { audioRunning, whenAudioRuns } from '../audio/context.js';
import { createPrompter } from './reference.js';

// [answer, button label, key, how the feedback says it]
const CHOICES = [
  ['up', '↑ Nahoru', 'ArrowUp', 'nahoru'],
  ['down', '↓ Dolů', 'ArrowDown', 'dolů'],
];
const QUESTION = 'Jde melodie nahoru, nebo dolů?';

export function start(ctx) {
  const { svg, controls, pool, clef, instrument, signature } = ctx;
  const range = displayRange(pool.map(step), clef, ctx.instrumentSteps);
  const prompter = createPrompter({ instrument, withRef: false });

  let pair = null;
  let answered = false;
  let played = false;
  let timer = 0;
  let cancelPending = () => {};

  if (!pickPair(pool)) {
    render(svg, { clef, range, signature });
    ctx.setFeedback('Pro Nahoru / dolů vyber v nastavení aspoň dva různé tóny.');
    append(controls, h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onClick: ctx.openSettings }, 'Otevřít nastavení')));
    return () => {};
  }

  sampler.preload(instrument.samples, pool.map((n) => soundingMidi(instrument, n)));

  const choiceButtons = new Map(CHOICES.map(([value, label]) => [value, h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      answer(value);
    },
  }, label)]));

  const replay = h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      playPair();
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
    h('div', { class: 'row choices' }, [...choiceButtons.values()]),
    h('div', { class: 'row' }, replay, next),
    h('p', { class: 'hint keys' },
      'Šipky ', h('kbd', {}, '↑'), ' a ', h('kbd', {}, '↓'), ' odpovídají, ', h('kbd', {}, 'Mezerník'), ' přehraje znovu.'));

  function draw(state = 'normal') {
    // The pair stays hidden until answered: seeing it would give the direction away.
    const notes = answered ? pair.map((note) => ({ note, state })) : [];
    render(svg, { clef, range, notes, signature });
  }

  function playPair() {
    if (!pair) return;
    played = true;
    prompter.play(pair).catch(() => ctx.setFeedback('Zvuk se nepodařilo načíst.', 'bad'));
  }

  function advance() {
    clearTimeout(timer);
    pair = pickPair(pool);
    answered = false;
    played = false;
    for (const b of choiceButtons.values()) b.classList.remove('correct', 'wrong');
    next.hidden = true;
    draw();
    // Before any gesture on this page load the browser will not start sound by itself;
    // the pair then plays on the first tap anywhere (or on ▶ Přehrát).
    ctx.setFeedback(audioRunning() ? QUESTION : 'Klepni na ▶ Přehrát a řekni, jestli jde melodie nahoru, nebo dolů.');
    cancelPending();
    cancelPending = whenAudioRuns(() => {
      if (played || answered) return;
      ctx.setFeedback(QUESTION);
      playPair();
    });
  }

  function answer(value) {
    if (answered || !pair) return;
    answered = true;
    const right = direction(pair[0], pair[1]);
    const ok = value === right;
    ctx.record(ok);
    choiceButtons.get(value).classList.add(ok ? 'correct' : 'wrong');
    choiceButtons.get(right).classList.add('correct');
    draw(ok ? 'correct' : 'wrong');
    const said = CHOICES.find(([v]) => v === right)[3];
    const notes = `${czLabel(pair[0])} → ${czLabel(pair[1])}`;
    if (ok) {
      ctx.setFeedback(`Správně – ${said} (${notes})`, 'ok');
      timer = setTimeout(advance, 1400);
    } else {
      ctx.setFeedback(`Ne – šlo to ${said} (${notes})`, 'bad');
      playPair();
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
    const choice = CHOICES.find(([, , key]) => key === e.key);
    if (choice) {
      e.preventDefault();
      answer(choice[0]);
    } else if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      playPair();
    }
  }

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
