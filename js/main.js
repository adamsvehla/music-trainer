// Boot and wiring: settings, the tabs, the score line and the settings dialog.
// Each mode is a module with start(ctx) → stop(); switching modes or changing settings
// stops the current one and starts afresh with a new score. The header tabs pick a
// group (GROUPS in settings.js); a group with several modes shows them as tabs on the
// staff card, and coming back to a group returns to the mode last used in it.

import { h } from './dom.js';
import {
  GROUPS, groupOf, loadSettings, saveSettings,
  currentInstrument, currentClef, currentPool, currentKey, currentSignature,
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
import * as direction from './modes/direction.js';
import * as intervals from './modes/intervals.js';

// Both kinds of Hraní are one module; only the way the note is given differs.
const MODES = {
  read,
  play: { start: (ctx) => play.start(ctx, 'staff') },
  playEar: { start: (ctx) => play.start(ctx, 'ear') },
  ear,
  direction,
  intervals,
};

const svg = document.getElementById('staff');
const controls = document.getElementById('controls');
const feedback = document.getElementById('feedback');
const score = document.getElementById('score');
const setupLabel = document.getElementById('setup-label');
const dialog = document.getElementById('settings');
const tabs = [...document.querySelectorAll('.tabs [data-group]')];
const subtabs = document.getElementById('subtabs');

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
  renderTabs();
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
    openSettings: showSettings,
    record: (ok) => {
      record(stats, ok);
      renderScore();
    },
  });
}

function renderTabs() {
  const group = groupOf(settings.mode);
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.group === group.id));
  subtabs.replaceChildren(...(group.modes.length < 2 ? [] : [h('div', { class: 'group' },
    group.modes.map(([mode, label]) => h('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(mode === settings.mode),
      onClick: () => selectMode(mode),
    }, label)))]));
}

function selectMode(mode) {
  if (mode === settings.mode) return;
  settings.mode = mode;
  settings.lastModes[groupOf(mode).id] = mode;
  saveSettings(settings);
  startMode();
}

function showSettings() {
  openSettings(dialog, settings, {
    onChange: () => saveSettings(settings),
    onClose: (changed) => {
      if (changed) startMode();
    },
  });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    const group = GROUPS.find((g) => g.id === tab.dataset.group);
    if (group === groupOf(settings.mode)) return;
    selectMode(settings.lastModes[group.id] ?? group.modes[0][0]);
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
