// When a ghost started to play, and the curve of new screens it saw (src/analyze.mjs). No browser, no network.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noveltyCurve, reachedPlayMs } from '../src/analyze.mjs';

const step = (saw, t0, extra = {}) => ({ saw, t0, t1: t0 + 1000, ...extra });

test('play begins at the first of two moves in a row that saw the game being played', () => {
  // A menu, one "playing" that was really a transition, the name screen, then real play.
  const steps = [step('menu', 0), step('playing', 1000), step('other', 2000), step('playing', 3000), step('playing', 4000)];
  assert.equal(reachedPlayMs(steps), 3000);
  assert.equal(reachedPlayMs([step('menu', 0), step('other', 1000)]), null);
  assert.equal(reachedPlayMs([step('playing', 500)]), 500);
  assert.equal(reachedPlayMs([]), null);
});

test('the novelty curve is [seconds, screens] from each move, at most 40 points, first and last kept', () => {
  const steps = Array.from({ length: 100 }, (_, i) => ({ saw: 'playing', t0: i * 1500, t1: (i + 1) * 1500, screens: Math.min(30, i + 1) }));
  const curve = noveltyCurve(steps);
  assert.equal(curve.length, 40);
  assert.deepEqual(curve[0], [1.5, 1]);
  assert.deepEqual(curve.at(-1), [150, 30]);
  // Moves recorded before the count existed (older runs) give no curve.
  assert.deepEqual(noveltyCurve([step('playing', 0)]), []);
});
