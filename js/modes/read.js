// Mode (a), Čtení: a note appears on the staff and the player names it.
//
// The answer has to match the written spelling (Fis is not Ges) but not the octave. With
// no accidentals in the pool a single key press answers; with accidentals the player
// types the Czech name ("fis", "es", "b"), which submits by itself once it cannot grow
// into a longer name, or with Enter.

import { h, ignoreKey } from '../dom.js';
import { render, displayRange } from '../staff.js';
import { step, czName, czLabel, parseCz, isCzPrefix, czCanExtend } from '../notes.js';
import { pickNext } from '../quiz.js';

const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
const SHARPS = ['Cis', 'Dis', 'Fis', 'Gis', 'Ais'];
const FLATS = ['Des', 'Es', 'Ges', 'As', 'B'];

export function start(ctx) {
  const { svg, controls, pool, clef } = ctx;
  const hasSharps = pool.some((n) => n.acc > 0);
  const hasFlats = pool.some((n) => n.acc < 0);
  const typed = hasSharps || hasFlats;
  const range = displayRange(pool.map(step), clef, ctx.instrumentSteps);

  let target = null;
  let answered = false;
  let buffer = '';
  let timer = 0;
  const buttons = new Map(); // lower-case name → button

  const answerRow = (names, kind) => h('div', { class: `row ${kind}` }, names.map((name) => {
    const button = h('button', {
      type: 'button',
      class: 'btn',
      onClick: (e) => {
        // Drop focus so a later Enter means "next", not "press this button again".
        e.currentTarget.blur();
        submit(name);
      },
    }, name);
    buttons.set(name.toLowerCase(), button);
    return button;
  }));

  const next = h('button', {
    type: 'button',
    class: 'btn primary',
    hidden: true,
    onClick: (e) => {
      e.currentTarget.blur();
      advance();
    },
  }, 'Další →');

  const hint = typed
    ? ['Na klávesnici napiš název (např. ', h('kbd', {}, 'fis'), ', ', h('kbd', {}, 'es'), ', ', h('kbd', {}, 'b'), ') a případně potvrď ', h('kbd', {}, 'Enter'), '.']
    : ['Na klávesnici stačí stisknout písmeno ', NATURALS.map((n) => [h('kbd', {}, n), ' ']), '.'];

  controls.append(
    h('div', { class: 'answers' },
      hasSharps && answerRow(SHARPS, 'acc'),
      answerRow(NATURALS, 'nat'),
      hasFlats && answerRow(FLATS, 'acc')),
    h('div', { class: 'row' }, next),
    h('p', { class: 'hint keys' }, hint),
  );

  function draw(state = 'normal') {
    render(svg, { clef, range, notes: [{ note: target, state }] });
  }

  function prompt() {
    if (typed && buffer) ctx.setFeedback(h('span', { class: 'typed' }, buffer));
    else ctx.setFeedback('Jak se jmenuje tahle nota?');
  }

  function advance() {
    clearTimeout(timer);
    target = pickNext(pool, target);
    answered = false;
    buffer = '';
    for (const b of buttons.values()) b.classList.remove('correct', 'wrong');
    next.hidden = true;
    draw('normal pop');
    prompt();
  }

  function submit(text) {
    if (answered) return;
    const parsed = parseCz(text);
    if (!parsed) {
      buffer = '';
      ctx.setFeedback(`„${text}“ není název noty.`, 'bad');
      return;
    }
    answered = true;
    buffer = '';
    const ok = parsed.letter === target.letter && parsed.acc === target.acc;
    ctx.record(ok);
    const pressed = buttons.get(czName(parsed).toLowerCase());
    if (ok) {
      pressed?.classList.add('correct');
      draw('correct');
      ctx.setFeedback(`Správně – ${czLabel(target)}`, 'ok');
      timer = setTimeout(advance, 650);
    } else {
      pressed?.classList.add('wrong');
      buttons.get(czName(target).toLowerCase())?.classList.add('correct');
      draw('wrong');
      ctx.setFeedback(`Ne – je to ${czLabel(target)} (tvoje odpověď: ${czName(parsed)})`, 'bad');
      next.hidden = false;
    }
  }

  function onKey(e) {
    if (ignoreKey(e)) return;
    // A focused button handles its own Enter/Space as a click.
    if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const key = e.key;
    if (answered) {
      if ((key === 'Enter' || key === ' ') && !next.hidden) {
        e.preventDefault();
        advance();
      }
      return;
    }
    if (!typed) {
      if (/^[a-h]$/i.test(key)) {
        e.preventDefault();
        submit(key);
      }
      return;
    }
    if (/^[a-z]$/i.test(key)) {
      e.preventDefault();
      const grown = buffer + key.toLowerCase();
      if (!isCzPrefix(grown)) return; // a key that cannot continue any name is ignored
      buffer = grown;
      if (parseCz(buffer) && !czCanExtend(buffer)) submit(buffer);
      else prompt();
    } else if (key === 'Backspace') {
      e.preventDefault();
      buffer = buffer.slice(0, -1);
      prompt();
    } else if (key === 'Escape') {
      buffer = '';
      prompt();
    } else if (key === 'Enter') {
      e.preventDefault();
      if (buffer) submit(buffer);
    }
  }

  document.addEventListener('keydown', onKey);
  advance();

  return () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
  };
}
