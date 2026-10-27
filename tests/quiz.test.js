import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNext, createStats, record } from '../js/quiz.js';
import { createJudge } from '../js/judge.js';
import { parseId, noteId } from '../js/notes.js';

test('never the same note twice in a row', () => {
  const pool = ['E4', 'G4', 'B4'].map(parseId);
  let prev = null;
  for (let i = 0; i < 500; i++) {
    const next = pickNext(pool, prev);
    if (prev) assert.notEqual(noteId(next), noteId(prev));
    prev = next;
  }
});

test('a pool of one repeats, an empty pool gives nothing', () => {
  const pool = [parseId('C4')];
  assert.equal(noteId(pickNext(pool, pool[0])), 'C4');
  assert.equal(pickNext([], null), null);
});

test('stats count first-attempt answers and streaks', () => {
  const st = createStats();
  [true, true, false, true].forEach((ok) => record(st, ok));
  assert.deepEqual(st, { asked: 4, correct: 3, streak: 1, best: 2 });
});

// Feeds a steady frame every 20 ms and returns the first non-listening verdict.
function hold(judge, midiValue, from, ms, clarity = 0.95) {
  for (let t = from; t <= from + ms; t += 20) {
    const r = judge.feed(midiValue === null ? null : { midi: midiValue, clarity }, t);
    if (r.type === 'correct' || r.type === 'wrong') return { ...r, at: t };
  }
  return null;
}

test('the right note counts once it has been held long enough', () => {
  const judge = createJudge({ target: 60 });
  const r = hold(judge, 60.1, 0, 400);
  assert.equal(r.type, 'correct');
  assert.ok(r.at >= 120 && r.at < 160);
});

test('a wrong note is reported once, then the right note still counts', () => {
  const judge = createJudge({ target: 60 });
  const wrong = hold(judge, 62, 0, 600);
  assert.equal(wrong.type, 'wrong');
  assert.equal(wrong.midi, 62);
  assert.equal(hold(judge, 62, 620, 600), null); // not reported again
  assert.equal(hold(judge, 60, 1300, 400).type, 'correct');
});

test('octave is strict unless told otherwise', () => {
  assert.equal(hold(createJudge({ target: 60 }), 72, 0, 400).type, 'wrong');
  assert.equal(hold(createJudge({ target: 60, ignoreOctave: true }), 72, 0, 400).type, 'correct');
});

test('the previous note ringing on is ignored until it stops or changes', () => {
  // A pool of one: the note just answered is still sounding when the same note comes up
  // again, so only a fresh attack after a silence may count.
  const judge = createJudge({ target: 64, blockedMidi: 64 });
  assert.equal(hold(judge, 64, 0, 800), null);
  hold(judge, null, 820, 40); // silence re-arms
  assert.equal(hold(judge, 64, 900, 400).type, 'correct');
});

test('unclear frames reset the hold', () => {
  const judge = createJudge({ target: 60 });
  assert.equal(judge.feed({ midi: 60, clarity: 0.95 }, 0).type, 'listening');
  assert.equal(judge.feed({ midi: 60, clarity: 0.5 }, 100).type, 'idle');
  assert.equal(judge.feed({ midi: 60, clarity: 0.95 }, 140).type, 'listening');
  assert.equal(judge.feed({ midi: 60, clarity: 0.95 }, 270).type, 'correct');
});
