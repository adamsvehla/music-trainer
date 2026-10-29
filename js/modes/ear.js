// Mode (c), Poslech: the app plays a note and the player places it on the staff.
//
// Any spelling of the right pitch counts (it was heard, not read), but the octave must
// match. With a mouse a ghost note follows the pointer and a click answers; on a touch
// screen the first tap places the ghost and a second tap on the same spot (or
// "Odpovědět") confirms, because staff spaces are narrow under a finger.
//
// A click means the note as written there: under a key signature the F line in G dur is
// fis. The ♭ / ♮ / ♯ buttons override that for the next answer, and pressing the chosen
// one again goes back to "as written".

import { h, append, ignoreKey } from '../dom.js';
import { render, displayRange, stepAtPoint } from '../staff.js';
import { signatureAcc } from '../keysig.js';
import { step, midi, czLabel, noteFromStep } from '../notes.js';
import { soundingMidi } from '../instruments.js';
import { pickNext } from '../quiz.js';
import * as sampler from '../audio/sampler.js';
import { audioRunning, unlockAudio, whenAudioRuns } from '../audio/context.js';
import { REFERENCE, referenceLayout, createPrompter } from './reference.js';

export function start(ctx) {
  const { svg, controls, pool, clef, instrument, settings, signature } = ctx;
  // Without accidentals in the pool or a signature to depart from, there is nothing to choose.
  const hasAcc = pool.some((n) => n.acc !== 0) || signature !== null;
  const withRef = settings.earReference;
  // A few steps beyond the pool, so where the clickable area ends gives nothing away.
  const range = displayRange([...pool.map(step), ...(withRef ? [step(REFERENCE)] : [])], clef, ctx.instrumentSteps, 3);
  const folder = instrument.samples;
  const sounding = (n) => soundingMidi(instrument, n);

  const layout = referenceLayout({ clef, range, signature, withRef });
  const prompter = createPrompter({ instrument, withRef, onReference: () => draw() });

  let target = null;
  let answered = false;
  let played = false;
  let ghostStep = null;
  let acc = null; // an explicit ♭ / ♮ / ♯, or null for "as written"
  let timer = 0;
  let shown = []; // the notes in the answer area, so a redraw can keep them
  let cancelPending = () => {};

  sampler.preload(folder, [...pool, REFERENCE].map(sounding));

  const replay = h('button', {
    type: 'button',
    class: 'btn',
    onClick: (e) => {
      e.currentTarget.blur();
      playTarget();
    },
  }, '▶ Přehrát');

  const confirm = h('button', {
    type: 'button',
    class: 'btn primary',
    hidden: true,
    onClick: (e) => {
      e.currentTarget.blur();
      if (ghostStep !== null) answer(ghostStep);
    },
  }, 'Odpovědět');

  const next = h('button', {
    type: 'button',
    class: 'btn primary',
    hidden: true,
    onClick: (e) => {
      e.currentTarget.blur();
      advance();
    },
  }, 'Další →');

  const accButtons = new Map();
  const accGroup = hasAcc && h('div', { class: 'segmented', role: 'group', 'aria-label': 'Posuvka' },
    [[-1, '♭', 'béčko'], [0, '♮', 'odrážka'], [1, '♯', 'křížek']].map(([value, symbol, label]) => {
      const b = h('button', {
        type: 'button',
        'aria-label': label,
        'aria-pressed': 'false',
        onClick: (e) => {
          e.currentTarget.blur();
          toggleAcc(value);
        },
      }, symbol);
      accButtons.set(value, b);
      return b;
    }));

  append(controls,
    h('div', { class: 'row' }, replay, accGroup, confirm, next),
    h('p', { class: 'hint keys' },
      'Klikni na linku nebo mezeru. ', h('kbd', {}, 'Mezerník'), ' přehraje tón znovu',
      hasAcc ? [', ', h('kbd', {}, '+'), ' / ', h('kbd', {}, '-'), ' / ', h('kbd', {}, '0'), ' volí posuvku'] : '',
      signature ? ' (bez volby platí předznamenání)' : '',
      '.'),
    h('p', { class: 'hint touch' }, 'Klepni na linku nebo mezeru a potvrď druhým klepnutím.'),
  );

  function draw(notes = shown) {
    shown = notes;
    render(svg, { clef, range, notes: layout.place(notes, prompter.referenceSounding), widthSp: layout.width, signature });
  }

  // The note a click at step `s` means: the chosen accidental, else what the signature says.
  function noteAt(s) {
    return noteFromStep(s, acc ?? signatureAcc(signature, ((s % 7) + 7) % 7));
  }

  function drawGhost() {
    draw(ghostStep === null ? [] : [{ note: noteAt(ghostStep), state: 'ghost' }]);
  }

  function setAcc(value) {
    acc = value;
    for (const [v, b] of accButtons) b.setAttribute('aria-pressed', String(v === value));
  }

  function toggleAcc(value) {
    if (answered) return;
    setAcc(acc === value ? null : value);
    drawGhost();
  }

  function playTarget() {
    if (!target) return;
    unlockAudio();
    played = true;
    prompter.play([target]).catch(() => ctx.setFeedback('Zvuk se nepodařilo načíst.', 'bad'));
  }

  function advance() {
    clearTimeout(timer);
    target = pickNext(pool, target);
    answered = false;
    played = false;
    ghostStep = null;
    setAcc(null);
    next.hidden = true;
    confirm.hidden = true;
    svg.classList.add('answerable');
    draw([]);
    // Before any gesture on this page load the browser will not start sound by itself;
    // the target then plays on the first tap anywhere (or on ▶ Přehrát).
    if (!audioRunning()) ctx.setFeedback('Klepni na ▶ Přehrát a najdi notu v osnově.');
    cancelPending();
    cancelPending = whenAudioRuns(() => {
      if (played || answered) return;
      ctx.setFeedback('Poslouchej a najdi notu v osnově.');
      playTarget();
    });
  }

  function answer(s) {
    if (answered) return;
    answered = true;
    svg.classList.remove('answerable');
    confirm.hidden = true;
    const given = noteAt(s);
    const ok = midi(given) === midi(target);
    ctx.record(ok);
    if (ok) {
      draw([{ note: given, state: 'correct' }]);
      ctx.setFeedback(`Správně – ${czLabel(given)}`, 'ok');
      timer = setTimeout(advance, 900);
    } else {
      // Left to right in the order they are played back: the right note, then yours.
      draw([{ note: target, state: 'correct' }, { note: given, state: 'wrong' }]);
      ctx.setFeedback(`Ne – zaznělo ${czLabel(target)} (tvoje odpověď: ${czLabel(given)})`, 'bad');
      // The right note, then yours, after the reference (lit on the staff) if it is on,
      // so the two can be heard against the same starting point as the question.
      prompter.play([target, given]).catch(() => {});
      next.hidden = false;
    }
  }

  function onPointerMove(e) {
    if (answered || e.pointerType !== 'mouse') return;
    const s = stepAtPoint(svg, e.clientX, e.clientY);
    if (s !== ghostStep) {
      ghostStep = s;
      drawGhost();
    }
  }

  function onPointerLeave(e) {
    if (answered || e.pointerType !== 'mouse') return;
    ghostStep = null;
    drawGhost();
  }

  function onPointerDown(e) {
    if (answered || !target) return;
    const s = stepAtPoint(svg, e.clientX, e.clientY);
    if (s === null) return;
    if (e.pointerType === 'mouse' || s === ghostStep) {
      answer(s);
    } else {
      ghostStep = s;
      drawGhost();
      confirm.hidden = false;
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
      playTarget();
    } else if (hasAcc && (e.key === '+' || e.key === '#')) {
      toggleAcc(1);
    } else if (hasAcc && e.key === '-') {
      toggleAcc(-1);
    } else if (hasAcc && e.key === '0') {
      toggleAcc(0);
    }
  }

  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerleave', onPointerLeave);
  svg.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKey);
  advance();

  return () => {
    cancelPending();
    prompter.stop();
    clearTimeout(timer);
    sampler.stopAll();
    svg.classList.remove('answerable');
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerleave', onPointerLeave);
    svg.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKey);
  };
}
