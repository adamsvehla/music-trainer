// SVG staff drawn with the Bravura SMuFL font.
//
// Units: one staff space (SP) is 10 user units and the font size is 4·SP, because SMuFL
// defines 1 em as four staff spaces. Every glyph's origin sits on the baseline, which is
// the line or space it belongs to, so a notehead is a <text> at exactly y(step).
//
// The geometry is kept in pure functions (staffGeometry, ledgerSteps, displayRange) so
// it can be tested without a DOM; render() and stepAtPoint() are the only DOM code.

import { step } from './notes.js';
import { topLineStep } from './clefs.js';
import { accidentalsToDraw } from './keysig.js';

export const SP = 10;
const FONT_SIZE = 4 * SP;
const NS = 'http://www.w3.org/2000/svg';

// Glyph advance widths in staff spaces, from Bravura's metadata (bBoxNE).
const NOTEHEAD_W = 1.688;
const LEDGER_OVERHANG = 0.4;
const ACC = {
  1: { glyph: '', w: 0.996 }, // accidentalSharp
  [-1]: { glyph: '', w: 0.904 }, // accidentalFlat
  0: { glyph: '', w: 0.672 }, // accidentalNatural
};
const NOTEHEAD = ''; // noteheadWhole
const CLEF_X = 0.8; // staff spaces from the left edge
const NOTES_X = 5.2; // where the note area starts, clear of the clef
const SIGNATURE_X = 4; // where a key signature starts, just after the clef
const SIGNATURE_ADVANCE = { 1: 1.05, [-1]: 0.95 }; // per sharp / flat

// Staff spaces a key signature takes up; the note area moves right by this much.
export function signatureWidth(sig) {
  return sig?.count ? sig.count * SIGNATURE_ADVANCE[sig.acc] + 0.6 : 0;
}

// The vertical range [lowStep, highStep] the staff must show: the given notes and the
// staff itself, widened by `pad` steps and kept inside the instrument's range (except
// that the five lines are always shown).
export function displayRange(steps, clef, instrumentSteps, pad = 0) {
  const bottom = clef.bottomLineStep;
  const top = topLineStep(clef);
  let low = Math.min(bottom - 2, ...steps) - pad;
  let high = Math.max(top + 2, ...steps) + pad;
  if (instrumentSteps) {
    low = Math.max(low, Math.min(instrumentSteps[0], bottom));
    high = Math.min(high, Math.max(instrumentSteps[1], top));
  }
  return [low, high];
}

// Ledger lines a note at `s` needs: every line step between it and the staff.
export function ledgerSteps(s, clef) {
  const bottom = clef.bottomLineStep;
  const top = topLineStep(clef);
  const out = [];
  for (let l = bottom - 2; l >= s; l -= 2) out.push(l);
  for (let l = top + 2; l <= s; l += 2) out.push(l);
  return out;
}

// Coordinate system for a staff showing `range` steps, `widthSp` staff spaces wide plus
// whatever a key signature (`sigSp` staff spaces) adds in front of the notes.
export function staffGeometry(clef, range, widthSp, sigSp = 0) {
  const [low, high] = range;
  const marginTop = 2.2 * SP; // headroom for a notehead and the top of the clef
  const marginBottom = 2 * SP;
  // The clef reaches about 4.4 SP above its anchor and 2.6 SP below it.
  const clefTop = clef.anchorStep + 2 * 4.4;
  const clefBottom = clef.anchorStep - 2 * 2.6;
  const highest = Math.max(high, clefTop - 2);
  const lowest = Math.min(low, clefBottom + 2);
  const yHighest = marginTop;
  const height = marginTop + ((highest - lowest) * SP) / 2 + marginBottom;
  const y = (s) => yHighest + ((highest - s) * SP) / 2;
  return {
    width: (widthSp + sigSp) * SP,
    height,
    range,
    y,
    stepAtY: (py) => Math.round(highest - ((py - yHighest) * 2) / SP),
    lineYs: [0, 2, 4, 6, 8].map((k) => y(clef.bottomLineStep + k)),
    notesX: (NOTES_X + sigSp) * SP,
  };
}

// x positions (left edge of the notehead) for `count` notes, centred in the note area
// and at most 5 SP apart, with room left of each for an accidental. `left` narrows the
// area from the left, for a staff that keeps its first column for something else.
export function noteSlots(count, geometry, left = geometry.notesX + 1.4 * SP) {
  const right = geometry.width - 1.2 * SP - NOTEHEAD_W * SP;
  const centre = (left + right) / 2;
  if (count <= 1) return [centre];
  const spacing = Math.min((right - left) / (count - 1), 5 * SP);
  const start = centre - (spacing * (count - 1)) / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacing);
}

// The width in staff spaces a staff needs to hold `count` notes `spacingSp` apart.
export function widthFor(count, spacingSp = 3) {
  return NOTES_X + 1.4 + Math.max(0, count - 1) * spacingSp + NOTEHEAD_W + 1.2 + 1;
}

function el(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Draws the staff into `svg`, replacing whatever was there.
//   notes: [{ note, state?: 'normal' | 'correct' | 'wrong' | 'ghost' | 'muted' | 'reference',
//             x?: number, caption?: string }]
//   signature: { acc, count } or null (keysig.js)
// The notes are read as one bar: each gets the accidental the signature and the notes
// before it leave it needing (accidentalsToDraw). A caption is set small at the foot of
// the note's column. Returns the geometry, which stepAtPoint needs for hit-testing.
export function render(svg, { clef, range, notes = [], widthSp = 15, slots, signature = null }) {
  const g = staffGeometry(clef, range, widthSp, signatureWidth(signature));
  svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
  // A transparent backdrop, so pointer events land on the staff even between the lines.
  svg.replaceChildren(el('rect', { class: 'hit', x: 0, y: 0, width: g.width, height: g.height }));

  const staff = el('g', { class: 'staff-lines' });
  for (const ly of g.lineYs) {
    staff.append(el('line', { x1: 0.3 * SP, x2: g.width - 0.3 * SP, y1: ly, y2: ly }));
  }
  svg.append(staff);
  svg.append(el('text', { class: 'glyph clef', x: CLEF_X * SP, y: g.y(clef.anchorStep), 'font-size': FONT_SIZE }, clef.glyph));

  if (signature?.count) {
    const steps = signature.acc > 0 ? clef.sharpSteps : clef.flatSteps;
    const sig = el('g', { class: 'signature' });
    for (let i = 0; i < signature.count; i++) {
      const x = (SIGNATURE_X + i * SIGNATURE_ADVANCE[signature.acc]) * SP;
      sig.append(el('text', { class: 'glyph', x, y: g.y(steps[i]), 'font-size': FONT_SIZE }, ACC[signature.acc].glyph));
    }
    svg.append(sig);
  }

  const xs = slots ?? noteSlots(notes.length, g);
  const accidentals = accidentalsToDraw(notes.map((item) => item.note), signature);
  notes.forEach((item, i) => {
    const x = item.x ?? xs[i];
    svg.append(drawNote(item, accidentals[i], x, g, clef));
  });
  svg.__staff = { geometry: g, clef };
  return g;
}

// `accidental` is what to print before the notehead: null for nothing, 0 for a natural.
function drawNote({ note, state = 'normal', caption }, accidental, x, g, clef) {
  const s = step(note);
  const y = g.y(s);
  const group = el('g', { class: `note ${state}`, 'data-step': s });
  for (const ls of ledgerSteps(s, clef)) {
    const ly = g.y(ls);
    group.append(el('line', {
      class: 'ledger',
      x1: x - LEDGER_OVERHANG * SP,
      x2: x + (NOTEHEAD_W + LEDGER_OVERHANG) * SP,
      y1: ly,
      y2: ly,
    }));
  }
  if (accidental !== null) {
    const acc = ACC[accidental];
    group.append(el('text', { class: 'glyph', x: x - (acc.w + 0.3) * SP, y, 'font-size': FONT_SIZE }, acc.glyph));
  }
  group.append(el('text', { class: 'glyph', x, y, 'font-size': FONT_SIZE }, NOTEHEAD));
  if (caption) {
    group.append(el('text', {
      class: 'caption',
      x: x + (NOTEHEAD_W * SP) / 2,
      y: g.height - 0.5 * SP,
      'text-anchor': 'middle',
      'font-size': 1.3 * SP,
    }, caption));
  }
  return group;
}

// The staff step under a pointer position, clamped to the drawn range; null when the
// SVG has not been rendered yet.
export function stepAtPoint(svg, clientX, clientY) {
  const state = svg.__staff;
  const ctm = svg.getScreenCTM();
  if (!state || !ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const [low, high] = state.geometry.range;
  return Math.max(low, Math.min(high, state.geometry.stepAtY(p.y)));
}
