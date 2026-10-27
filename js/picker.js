// The settings dialog: instrument, clef, the notes to practise, and per-mode options.
//
// It edits the settings object in place. Closing the dialog (Hotovo, Esc or the
// backdrop) reports whether anything changed, and main.js then saves and restarts the
// current mode.

import { h } from './dom.js';
import { INSTRUMENTS, getInstrument } from './instruments.js';
import { CLEFS, getClef } from './clefs.js';
import { notesInRange, noteId, step, czLabel } from './notes.js';
import { render, displayRange, widthFor } from './staff.js';

const OCTAVE_NAMES = {
  2: 'velká oktáva',
  3: 'malá oktáva',
  4: 'jednočárkovaná oktáva',
  5: 'dvoučárkovaná oktáva',
  6: 'tříčárkovaná oktáva',
  7: 'čtyřčárkovaná oktáva',
};

// Each preset replaces the selection. `b` is the clef's bottom-line step; the top line is b + 8.
const PRESETS = [
  ['V osnově', (n, b) => n.acc === 0 && step(n) >= b && step(n) <= b + 8],
  ['Linky', (n, b) => n.acc === 0 && step(n) >= b && step(n) <= b + 8 && (step(n) - b) % 2 === 0],
  ['Mezery', (n, b) => n.acc === 0 && step(n) > b && step(n) < b + 8 && (step(n) - b) % 2 === 1],
  ['Pod osnovou', (n, b) => n.acc === 0 && step(n) < b],
  ['Nad osnovou', (n, b) => n.acc === 0 && step(n) > b + 8],
  ['Vše', (n, b, withAcc) => withAcc || n.acc === 0],
  ['Nic', () => false],
];

const PREVIEW_HEIGHT = 110;

export function openSettings(dialog, settings, onClose) {
  const before = JSON.stringify(settings);
  const body = h('div', { class: 'settings-inner' });
  const footer = h('div', { class: 'settings-footer' },
    h('button', { type: 'button', class: 'btn primary', onClick: () => dialog.close() }, 'Hotovo'));
  dialog.replaceChildren(body, footer);
  build();
  dialog.addEventListener('close', () => onClose(JSON.stringify(settings) !== before), { once: true });
  dialog.showModal();
  dialog.scrollTop = 0;

  function segmented(label, options, current, onPick) {
    return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
      options.map(([value, text]) => h('button', {
        type: 'button',
        'aria-pressed': String(value === current),
        onClick: () => onPick(value),
      }, text)));
  }

  function checkbox(text, checked, onChange) {
    return h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) }),
      h('span', {}, text));
  }

  function build() {
    const instrument = getInstrument(settings.instrument);
    const clef = getClef(settings.clef);
    const instrumentSteps = [step(instrument.low), step(instrument.high)];
    const all = notesInRange(instrument.low, instrument.high);
    const selected = new Set(settings.pools[instrument.id]);
    const chips = new Map();

    const count = h('span', { class: 'count' });
    const previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    previewSvg.setAttribute('aria-label', 'Vybrané noty');

    function commit() {
      settings.pools[instrument.id] = all.map(noteId).filter((id) => selected.has(id));
      count.textContent = `Vybráno not: ${selected.size}`;
      for (const [id, chip] of chips) chip.setAttribute('aria-pressed', String(selected.has(id)));
      const notes = all.filter((n) => selected.has(noteId(n)));
      // Wide enough that neighbouring ledger lines stay apart, wider still with accidentals.
      const spacing = notes.some((n) => n.acc !== 0) ? 3.6 : 3;
      const g = render(previewSvg, {
        clef,
        range: displayRange(notes.map(step), clef, instrumentSteps),
        notes: notes.map((note) => ({ note })),
        widthSp: Math.max(12, widthFor(notes.length, spacing)),
      });
      previewSvg.setAttribute('height', PREVIEW_HEIGHT);
      previewSvg.setAttribute('width', Math.round((PREVIEW_HEIGHT * g.width) / g.height));
    }

    const octaves = new Map();
    for (const n of all) {
      if (n.acc !== 0 && !settings.showAccidentals) continue;
      if (!octaves.has(n.octave)) octaves.set(n.octave, []);
      octaves.get(n.octave).push(n);
    }

    body.replaceChildren(
      h('h2', { id: 'settings-title' }, 'Nastavení'),

      h('section', {},
        h('h3', {}, 'Nástroj'),
        segmented('Nástroj', Object.values(INSTRUMENTS).map((i) => [i.id, i.name]), instrument.id, (id) => {
          settings.instrument = id;
          build();
        }),
        instrument.transpose !== 0 && h('p', { class: 'hint', style: 'text-align:left;margin-top:8px' },
          'Noty se zobrazují v zápisu pro tento nástroj; zvuk a mikrofon počítají s jeho transpozicí.')),

      h('section', {},
        h('h3', {}, 'Klíč'),
        segmented('Klíč', instrument.clefs.map((id) => [id, CLEFS[id].name]), clef.id, (id) => {
          settings.clef = id;
          build();
        })),

      h('section', {},
        h('h3', {}, 'Noty k procvičení'),
        h('div', { class: 'presets' }, PRESETS.map(([label, pick]) => h('button', {
          type: 'button',
          class: 'chip',
          onClick: () => {
            selected.clear();
            for (const n of all) if (pick(n, clef.bottomLineStep, settings.showAccidentals)) selected.add(noteId(n));
            commit();
          },
        }, label))),
        checkbox('Včetně posuvek (♯ a ♭)', settings.showAccidentals, (on) => {
          settings.showAccidentals = on;
          if (!on) {
            for (const n of all) if (n.acc !== 0) selected.delete(noteId(n));
            settings.pools[instrument.id] = all.map(noteId).filter((id) => selected.has(id));
          }
          build();
        }),
        h('div', { class: 'preview' }, previewSvg),
        count,
        [...octaves].map(([octave, notes]) => h('div', { class: 'octave' },
          h('div', { class: 'octave-name' }, OCTAVE_NAMES[octave] ?? `oktáva ${octave}`),
          h('div', { class: 'chips' }, notes.map((n) => {
            const id = noteId(n);
            const chip = h('button', {
              type: 'button',
              class: n.acc !== 0 ? 'chip acc' : 'chip',
              onClick: () => {
                if (selected.has(id)) selected.delete(id);
                else selected.add(id);
                commit();
              },
            }, czLabel(n));
            chips.set(id, chip);
            return chip;
          }))))),

      h('section', {},
        h('h3', {}, 'Možnosti'),
        checkbox('Poslech: před každým tónem zahrát referenční c¹', settings.earReference, (on) => {
          settings.earReference = on;
        }),
        checkbox('Hraní: uznat notu v jakékoli oktávě', settings.ignoreOctave, (on) => {
          settings.ignoreOctave = on;
        })),
    );
    commit();
  }
}
