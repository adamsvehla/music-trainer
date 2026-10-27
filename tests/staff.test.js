import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerSteps, staffGeometry, displayRange, noteSlots } from '../js/staff.js';
import { CLEFS } from '../js/clefs.js';
import { step, parseId } from '../js/notes.js';

const treble = CLEFS.treble;
const s = (id) => step(parseId(id));

test('ledger lines below and above the treble staff', () => {
  assert.deepEqual(ledgerSteps(s('D4'), treble), []); // hangs under the staff
  assert.deepEqual(ledgerSteps(s('C4'), treble), [28]);
  assert.deepEqual(ledgerSteps(s('B3'), treble), [28]);
  assert.deepEqual(ledgerSteps(s('F3'), treble), [28, 26, 24]);
  assert.deepEqual(ledgerSteps(s('G5'), treble), []);
  assert.deepEqual(ledgerSteps(s('A5'), treble), [40]);
  assert.deepEqual(ledgerSteps(s('G6'), treble), [40, 42, 44, 46]);
  assert.deepEqual(ledgerSteps(s('E4'), treble), []);
});

test('step ↔ y are inverses and lines are one staff space apart', () => {
  const g = staffGeometry(treble, [24, 49], 15);
  for (let st = 24; st <= 49; st++) assert.equal(g.stepAtY(g.y(st)), st);
  // A pointer a little off a line still lands on it.
  assert.equal(g.stepAtY(g.y(30) + 2), 30);
  const gaps = g.lineYs.slice(1).map((y, i) => g.lineYs[i] - y);
  assert.deepEqual(gaps, [10, 10, 10, 10]);
  assert.ok(g.y(24) < g.height && g.y(49) > 0);
});

test('display range covers the staff and the notes, clamped to the instrument', () => {
  assert.deepEqual(displayRange([s('G4')], treble, [24, 49]), [28, 40]);
  assert.deepEqual(displayRange([s('F3'), s('C6')], treble, [24, 49]), [24, 42]);
  assert.deepEqual(displayRange([s('C4')], treble, [26, 45], 3), [26, 43]);
});

test('note slots are centred and evenly spaced', () => {
  const g = staffGeometry(treble, [28, 40], 15);
  const [one] = noteSlots(1, g);
  const [a, b] = noteSlots(2, g);
  assert.ok(Math.abs((a + b) / 2 - one) < 1e-9);
  assert.ok(b - a <= 50);
});
