// The settings dialog: instrument, clef, the notes to practise, the intervals for
// Poslech · Intervaly, and per-mode options.
//
// It edits the settings object in place and calls onChange() after every edit, so each
// one is saved at once: a page reloaded, or a phone tab killed in the background, with
// the dialog still open loses nothing. Closing the dialog (Hotovo, Esc or the backdrop)
// calls onClose(changed), and main.js restarts the current mode if anything changed.

import { h } from './dom.js';
import { INSTRUMENTS, getInstrument } from './instruments.js';
import { CLEFS, getClef } from './clefs.js';
import { notesInRange, noteId, step, czLabel } from './notes.js';
import { render, displayRange, widthFor } from './staff.js';
import { KEYS, REGIONS, getKey, keyName, keyDescription, keySignature, selectNotes } from './selection.js';
import { INTERVALS, ALL_INTERVALS } from './intervals.js';

const OCTAVE_NAMES = {
  2: 'velká oktáva',
  3: 'malá oktáva',
  4: 'jednočárkovaná oktáva',
  5: 'dvoučárkovaná oktáva',
  6: 'tříčárkovaná oktáva',
  7: 'čtyřčárkovaná oktáva',
};

const PREVIEW_HEIGHT = 110;

export function openSettings(dialog, settings, { onChange, onClose }) {
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
    // Rebuilding empties the dialog for a moment, which would scroll it back to the top.
    const scroll = dialog.scrollTop;
    const instrument = getInstrument(settings.instrument);
    const clef = getClef(settings.clef);
    const instrumentSteps = [step(instrument.low), step(instrument.high)];
    const all = notesInRange(instrument.low, instrument.high);
    const selected = new Set(settings.pools[instrument.id]);
    const chips = new Map();
    const signature = settings.showKeySignature ? keySignature(getKey(settings.key)) : null;

    // A quick selection replaces the pool with the key's notes inside the region.
    function quickSelect(keyId, regionId) {
      settings.key = keyId;
      settings.region = regionId;
      const picked = selectNotes(all, keyId, regionId, clef);
      // Sharps and flats in the selection need their chips shown, or it could not be edited.
      if (picked.some((n) => n.acc !== 0)) settings.showAccidentals = true;
      settings.pools[instrument.id] = picked.map(noteId);
      build();
    }

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
        signature,
      });
      previewSvg.setAttribute('height', PREVIEW_HEIGHT);
      previewSvg.setAttribute('width', Math.round((PREVIEW_HEIGHT * g.width) / g.height));
      // Every pool edit ends here, and so does every rebuild after any other change.
      onChange();
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
        h('div', { class: 'pick-label' }, 'Tónina'),
        h('div', { class: 'presets' }, KEYS.map((key) => h('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(key.id === settings.key),
          title: keyDescription(key),
          onClick: () => quickSelect(key.id, settings.region),
        }, keyName(key)))),
        h('p', { class: 'key-info' }, keyDescription(getKey(settings.key))),
        checkbox('Ukazovat v osnově předznamenání tóniny (noty pak bez posuvek)', settings.showKeySignature, (on) => {
          settings.showKeySignature = on;
          build();
        }),
        h('div', { class: 'pick-label' }, 'Oblast'),
        h('div', { class: 'presets' },
          REGIONS.map((region) => h('button', {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(region.id === settings.region),
            onClick: () => quickSelect(settings.key, region.id),
          }, region.name)),
          h('button', {
            type: 'button',
            class: 'chip',
            onClick: () => {
              selected.clear();
              commit();
            },
          }, 'Nic')),
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
        h('h3', {}, 'Intervaly (Poslech)'),
        h('div', { class: 'presets' },
          INTERVALS.map((interval) => h('button', {
            type: 'button',
            class: 'chip',
            title: interval.name,
            'aria-pressed': String(settings.intervals.includes(interval.semitones)),
            onClick: () => {
              const on = new Set(settings.intervals);
              if (on.has(interval.semitones)) on.delete(interval.semitones);
              else on.add(interval.semitones);
              settings.intervals = ALL_INTERVALS.filter((s) => on.has(s));
              build();
            },
          }, interval.short)),
          h('button', { type: 'button', class: 'chip', onClick: () => { settings.intervals = [...ALL_INTERVALS]; build(); } }, 'Vše'),
          h('button', { type: 'button', class: 'chip', onClick: () => { settings.intervals = []; build(); } }, 'Nic')),
        h('p', { class: 'key-info' }, 'm = malá, v = velká, č = čistá, zv4 = tritón; 2 sekunda, 3 tercie, 4 kvarta, 5 kvinta, 6 sexta, 7 septima, 8 oktáva.')),

      h('section', {},
        h('h3', {}, 'Možnosti'),
        checkbox('Před každým přehraným tónem zahrát referenční c¹ (Poslech, Hraní podle sluchu)', settings.earReference, (on) => {
          settings.earReference = on;
          onChange();
        }),
        checkbox('Hraní: uznat notu v jakékoli oktávě', settings.ignoreOctave, (on) => {
          settings.ignoreOctave = on;
          onChange();
        })),
    );
    commit();
    dialog.scrollTop = scroll;
  }
}
