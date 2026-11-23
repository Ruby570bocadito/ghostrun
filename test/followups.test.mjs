import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMove } from '../src/ghost.mjs';
import { describeMove } from '../src/feedback.mjs';
import { moveSchema } from '../src/brains/meta.mjs';

test('follow-up actions are offered only to games without the SDK', () => {
  assert.ok(moveSchema(640, 360).required.includes('then'));
  assert.equal(moveSchema(640, 360, { sdk: true }).properties.then, undefined);
});

test('follow-up actions are cleaned: at most 2, keys and clicks only, 100-1500 ms', () => {
  const m = sanitizeMove({ hold: ['ArrowRight'], then: [{ hold: ['ArrowRight'], tap: ['Space'], click: [], duration_ms: 9000 }, { click: [{ x: 9999, y: -5 }], hold: [], tap: [], duration_ms: 20 }, { tap: ['KeyZ'] }] }, { width: 640, height: 360 });
  assert.equal(m.then.length, 2);
  assert.equal(m.then[0].duration_ms, 1500);
  assert.deepEqual(m.then[1].click, [{ x: 639, y: 0 }]);
  assert.equal(m.then[1].duration_ms, 100);
});

test('a move with no input may wait up to 5 s; with input, 1.5 s at most', () => {
  assert.equal(sanitizeMove({ duration_ms: 9000 }).duration_ms, 5000);
  assert.equal(sanitizeMove({ tap: ['Space'], duration_ms: 9000 }).duration_ms, 1500);
});

test('the history tells only the follow-ups that were done', () => {
  const move = { hold: ['ArrowRight'], tap: [], click: [], duration_ms: 600, then: [{ hold: [], tap: ['Space'], click: [], duration_ms: 400 }, { hold: ['ArrowLeft'], tap: [], click: [], duration_ms: 300 }], thenDone: 1 };
  assert.equal(describeMove(move), 'held ArrowRight for 600 ms, then tapped Space for 400 ms');
});

test('drags are kept and told', () => {
  const m = sanitizeMove({ drag: [{ x1: 10, y1: 20, x2: 300, y2: 40 }], duration_ms: 500 }, { width: 640, height: 360 });
  assert.deepEqual(m.drag, [{ x1: 10, y1: 20, x2: 300, y2: 40 }]);
  assert.equal(describeMove(m), 'dragged from (10,20) to (300,40) for 500 ms');
});
