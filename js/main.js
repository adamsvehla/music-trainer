// Boot and wiring: settings, the mode tabs, the score line and the settings dialog.
// Each mode is a module with start(ctx) → stop(); switching modes or changing settings
// stops the current one and starts afresh with a new score.

import { h } from './dom.js';
import {
  loadSettings, saveSettings, currentInstrument, currentClef, currentPool, currentKey, currentSignature,
} from './settings.js';
import { createStats, record } from './quiz.js';
import { render, displayRange } from './staff.js';
import { step } from './notes.js';
import { unlockAudio } from './audio/context.js';
import { openSettings } from './picker.js';
import { keyName } from './selection.js';
import * as read from './modes/read.js';
import * as play from './modes/play.js';
import * as ear from './modes/ear.js';

// Both kinds of Hraní are one module; only the way the note is given differs.
const MODES = {
  read,
  play: { start: (ctx) => play.start(ctx, 'staff') },
  playEar: { start: (ctx) => play.start(ctx, 'ear') },
  ear,
};

const svg = document.getElementById('staff');
const controls = document.getElementById('controls');
const feedback = document.getElementById('feedback');
const score = document.getElementById('score');
const setupLabel = document.getElementById('setup-label');
const dialog = document.getElementById('settings');
const tabs = [...document.querySelectorAll('.tabs [data-mode]')];

// ?sim replaces the microphone with the app's own playback (see modes/play.js).
const sim = new URLSearchParams(location.search).has('sim');

const settings = loadSettings();
let stats = createStats();
let stopMode = null;

function setFeedback(content, kind = '') {
  feedback.className = `feedback ${kind}`.trim();
  feedback.replaceChildren(...[content].flat());
}

function renderScore() {
  score.replaceChildren(...(stats.asked === 0
    ? []
    : [h('b', {}, String(stats.correct)), ` / ${stats.asked} · série ${stats.streak}`,
      stats.best > stats.streak ? ` (nej ${stats.best})` : '']));
}

function startMode() {
  stopMode?.();
  stopMode = null;
  stats = createStats();
  renderScore();
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.mode === settings.mode));
  controls.replaceChildren();
  setFeedback('');

  const instrument = currentInstrument(settings);
  const clef = currentClef(settings);
  const pool = currentPool(settings);
  const key = currentKey(settings);
  const signature = currentSignature(settings);
  const instrumentSteps = [step(instrument.low), step(instrument.high)];
  setupLabel.textContent = [instrument.name, clef.name, signature && keyName(key), `${pool.length} not`]
    .filter(Boolean).join(' · ');

  if (pool.length === 0) {
    render(svg, { clef, range: displayRange([], clef, instrumentSteps), signature });
    setFeedback('V nastavení vyber aspoň jednu notu k procvičení.');
    controls.append(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onClick: showSettings }, 'Otevřít nastavení')));
    return;
  }

  stopMode = MODES[settings.mode].start({
    svg,
    controls,

    settings,
    instrument,
    clef,
    pool,
    instrumentSteps,
    key,
    signature,
    sim,
    setFeedback,
    record: (ok) => {
      record(stats, ok);
      renderScore();
    },
  });
}

function showSettings() {
  openSettings(dialog, settings, (changed) => {
    if (!changed) return;
    saveSettings(settings);
    startMode();
  });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (tab.dataset.mode === settings.mode) return;
    settings.mode = tab.dataset.mode;
    saveSettings(settings);
    startMode();
  });
}
document.getElementById('open-settings').addEventListener('click', showSettings);
setupLabel.addEventListener('click', showSettings);
// A click on the backdrop (the dialog element itself, outside its content) closes it.
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

// Browsers keep audio suspended until a gesture; resume on the first one.
document.addEventListener('pointerdown', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });

// The staff is all glyphs from Bravura; drawing before it has loaded would show empty boxes.
await document.fonts.load('40px Bravura').catch(() => {});
startMode();
