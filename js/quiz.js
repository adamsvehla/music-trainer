// The part of the quiz loop all three modes share: choosing the next note and keeping score.

import { noteId } from './notes.js';

// Uniform over the pool, but never the same note twice in a row, which would read as the
// app not having registered the answer. A pool of one has no choice but to repeat.
export function pickNext(pool, previous = null, random = Math.random) {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 && previous
    ? pool.filter((n) => noteId(n) !== noteId(previous))
    : pool;
  return candidates[Math.floor(random() * candidates.length)];
}

export function createStats() {
  return { asked: 0, correct: 0, streak: 0, best: 0 };
}

// One call per target note: `correct` means right at the first attempt.
export function record(stats, correct) {
  stats.asked += 1;
  if (correct) {
    stats.correct += 1;
    stats.streak += 1;
    stats.best = Math.max(stats.best, stats.streak);
  } else {
    stats.streak = 0;
  }
  return stats;
}
