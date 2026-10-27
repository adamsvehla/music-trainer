// Mode (c), Poslech: the app plays a note and the player places it on the staff.
//
// Any spelling of the right pitch counts (it was heard, not read), but the octave must
// match. With a mouse a ghost note follows the pointer and a click answers; on a touch
// screen the first tap places the ghost and a second tap on the same spot (or
// "Odpovědět") confirms, because staff spaces are narrow under a finger.

import { h, ignoreKey } from '../dom.js';
import { render, displayRange, stepAtPoint, staffGeometry, noteSlots, SP } from '../staff.js';
import { step, midi, czLabel, noteFromStep, parseId } from '../notes.js';
import { soundingMidi } from '../instruments.js';
import { pickNext } from '../quiz.js';
import * as sampler from '../audio/sampler.js';
import { audioRunning, unlockAudio } from '../audio/context.js';

// The optional reference before each target: written c¹, whatever the instrument.
const REFERENCE = parseId('C4');
const GAP = 1.1; // seconds from the reference to the target

export function start(ctx) {
  const { svg, controls, pool, clef, instrument, settings } = ctx;
  const hasAcc = pool.some((n) => n.acc !== 0);
  const withRef = settings.earReference;
  // A few steps beyond the pool, so where the clickable area ends gives nothing away.
  const range = displayRange([...pool.map(step), ...(withRef ? [step(REFERENCE)] : [])], clef, ctx.instrumentSteps, 3);
  const folder = instrument.samples;
  const sounding = (n) => soundingMidi(instrument, n);

  // With the reference on, c¹ keeps the first column of the note area for the whole
  // exercise and the answers move into a wider area to its right.
  const width = withRef ? 18 : 15;
  const geometry = staffGeometry(clef, range, width);
  const refX = geometry.notesX + 1.4 * SP;
  const answerLeft = withRef ? refX + 4 * SP : undefined;

  let target = null;
  let answered = false;
  let played = false;
  let ghostStep = null;
  let acc = 0;
  let timer = 0;
  let shown = []; // the notes in the answer area, so a redraw can keep them
  let refSounding = false;
  let refTimer = 0;
  let stopped = false;

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
        'aria-pressed': String(value === 0),
        onClick: (e) => {
          e.currentTarget.blur();
          setAcc(value);
        },
      }, symbol);
      accButtons.set(value, b);
      return b;
    }));

  controls.append(
    h('div', { class: 'row' }, replay, accGroup, confirm, next),
    h('p', { class: 'hint keys' },
      'Klikni na linku nebo mezeru. ', h('kbd', {}, 'Mezerník'), ' přehraje tón znovu',
      hasAcc ? [', ', h('kbd', {}, '+'), ' / ', h('kbd', {}, '-'), ' / ', h('kbd', {}, '0'), ' volí posuvku'] : '',
      '.'),
    h('p', { class: 'hint touch' }, 'Klepni na linku nebo mezeru a potvrď druhým klepnutím.'),
  );

  function draw(notes = shown) {
    shown = notes;
    const xs = noteSlots(notes.length, geometry, answerLeft);
    const items = notes.map((n, i) => ({ ...n, x: xs[i] }));
    if (withRef) {
      items.unshift({ note: REFERENCE, state: refSounding ? 'reference sounding' : 'reference', x: refX, caption: 'ref.' });
    }
    render(svg, { clef, range, notes: items, widthSp: width });
  }

  function drawGhost() {
    draw(ghostStep === null ? [] : [{ note: noteFromStep(ghostStep, acc), state: 'ghost' }]);
  }

  function setAcc(value) {
    if (answered) return;
    acc = value;
    for (const [v, b] of accButtons) b.setAttribute('aria-pressed', String(v === value));
    drawGhost();
  }

  function playTarget() {
    if (!target) return;
    unlockAudio();
    played = true;
    const notes = withRef ? [REFERENCE, target] : [target];
    sampler.stopAll();
    clearTimeout(refTimer);
    setRefSounding(false);
    sampler.play(folder, notes.map(sounding), { gap: GAP })
      .then(() => {
        // play() resolves once the notes are scheduled, i.e. as the reference starts.
        if (!withRef || stopped) return;
        setRefSounding(true);
        refTimer = setTimeout(() => setRefSounding(false), GAP * 1000);
      })
      .catch(() => ctx.setFeedback('Zvuk se nepodařilo načíst.', 'bad'));
  }

  function setRefSounding(on) {
    if (stopped || refSounding === on) return;
    refSounding = on;
    draw();
  }

  function advance() {
    clearTimeout(timer);
    target = pickNext(pool, target);
    answered = false;
    played = false;
    ghostStep = null;
    acc = 0;
    for (const [v, b] of accButtons) b.setAttribute('aria-pressed', String(v === 0));
    next.hidden = true;
    confirm.hidden = true;
    svg.classList.add('answerable');
    draw([]);
    if (audioRunning()) {
      ctx.setFeedback('Poslouchej a najdi notu v osnově.');
      playTarget();
    } else {
      // No gesture yet on this page load: the browser will not start sound by itself.
      ctx.setFeedback('Klepni na ▶ Přehrát a najdi notu v osnově.');
      const current = target;
      unlockAudio().then(() => {
        if (audioRunning() && target === current && !played && !answered) playTarget();
      });
    }
  }

  function answer(s) {
    if (answered) return;
    answered = true;
    svg.classList.remove('answerable');
    confirm.hidden = true;
    const given = noteFromStep(s, acc);
    const ok = midi(given) === midi(target);
    ctx.record(ok);
    if (ok) {
      draw([{ note: given, state: 'correct' }]);
      ctx.setFeedback(`Správně – ${czLabel(given)}`, 'ok');
      timer = setTimeout(advance, 900);
    } else {
      draw([{ note: given, state: 'wrong' }, { note: target, state: 'correct' }]);
      ctx.setFeedback(`Ne – zaznělo ${czLabel(target)} (tvoje odpověď: ${czLabel(given)})`, 'bad');
      sampler.stopAll();
      sampler.play(folder, [sounding(given), sounding(target)]).catch(() => {});
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
      setAcc(1);
    } else if (hasAcc && e.key === '-') {
      setAcc(-1);
    } else if (hasAcc && e.key === '0') {
      setAcc(0);
    }
  }

  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerleave', onPointerLeave);
  svg.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKey);
  advance();

  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(refTimer);
    sampler.stopAll();
    svg.classList.remove('answerable');
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerleave', onPointerLeave);
    svg.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKey);
  };
}
