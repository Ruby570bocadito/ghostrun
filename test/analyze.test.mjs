// Tests for the parts that use no AI: move sanitising, findings and benchmark scoring.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, cluster2d } from '../src/analyze.mjs';
import { sanitizeMove } from '../src/ghost.mjs';
import { score } from '../bench/score.mjs';

const W = 1360;
const H = 360;
const frame = (i, x, y, extra = {}) => ({ i, t: i * 100, pageT: i * 100, file: `frames/${i}.jpg`, state: { x, y, worldW: W, worldH: H, ...extra } });
const trace = (persona, { outcome = 'out_of_steps', frames = [], events = [], steps = [] } = {}) => ({ persona, outcome, frames, events, steps, gameMs: frames.length * 100, model: 'test' });

/** A ghost that walks right to `upTo`, dying `deaths` times at `deathX` along the way. */
function walker(persona, { upTo, deathX, deaths = 0, outcome = 'out_of_steps' }) {
  const frames = [];
  const events = [];
  let i = 0;
  for (let x = 60; x <= upTo; x += 20) frames.push(frame(i++, x, 280));
  for (let d = 0; d < deaths; d++) {
    for (let k = 0; k < 5; k++) frames.push(frame(i++, deathX - 80 + k * 20, 250));
    events.push({ type: 'death', x: deathX, y: 390, t: frames.at(-1).pageT, step: 1 });
  }
  return trace(persona, { outcome, frames, events, steps: [{ step: 1, thought: `${persona} thought`, frames: [0, frames.length - 1], usage: { input: 0, output: 0 }, latencyMs: 0 }] });
}

test('sanitizeMove clamps duration, removes duplicate keys and caps key counts', () => {
  const m = sanitizeMove({ thought: 'x', hold: ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp'], tap: ['ArrowRight', 'Space'], duration_ms: 99999 });
  assert.deepEqual(m.hold, ['ArrowRight', 'ArrowLeft']);
  assert.deepEqual(m.tap, ['Space']);
  assert.equal(m.duration_ms, 1500);
  assert.equal(sanitizeMove({}).duration_ms, 400);
  assert.deepEqual(sanitizeMove({ player: { x: 5000, y: -5.6 } }).player, { x: 2000, y: 0 });
});

test('cluster2d groups nearby points and separates distant ones', () => {
  const groups = cluster2d([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 500, y: 0 }], 60);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((g) => g.length === 3).length, 3);
});

test('a spot nobody gets past is a blocker', () => {
  const traces = ['a', 'b', 'c'].map((p) => walker(p, { upTo: 940, deathX: 1020, deaths: 3 }));
  const r = analyze(traces);
  const f = r.findings.find((x) => x.type === 'blocker');
  assert.ok(f, 'expected a blocker');
  assert.equal(f.ghosts.length, 3);
  assert.equal(f.passed.length, 0);
  assert.equal(f.severity, 'high');
});

test('a spot where ghosts die but later get past is friction, not a blocker', () => {
  const traces = ['a', 'b'].map((p) => {
    const t = walker(p, { upTo: 600, deathX: 690, deaths: 2 });
    for (let x = 700, i = t.frames.length; x <= 1000; x += 20) t.frames.push(frame(i++, x, 280));
    return t;
  });
  const r = analyze(traces);
  assert.equal(r.findings.filter((x) => x.type === 'blocker').length, 0);
  const f = r.findings.find((x) => x.type === 'friction');
  assert.ok(f);
  assert.equal(f.passed.length, 2);
});

test('dying once or twice and running out of moves is friction, not a blocker', () => {
  const traces = ['a', 'b', 'c'].map((p) => walker(p, { upTo: 940, deathX: 1020, deaths: 1 }));
  const r = analyze(traces);
  assert.equal(r.findings.filter((x) => x.type === 'blocker').length, 0);
  assert.ok(r.findings.find((x) => x.type === 'friction'));
});

test('in a single-screen game, reaching an objective after dying counts as getting past', () => {
  const traces = ['a', 'b'].map((p) => {
    const frames = [];
    const events = [];
    let i = 0;
    for (let k = 0; k < 4; k++) {
      for (let x = 60; x <= 150; x += 30) frames.push(frame(i++, x, 312, { worldW: 640 }));
      events.push({ type: 'death', x: 155, y: 312, t: frames.at(-1).pageT, step: 1 });
    }
    for (let y = 312; y >= 200; y -= 20) frames.push(frame(i++, 100, y, { worldW: 640 }));
    events.push({ type: 'milestone', name: 'checkpoint', t: frames.at(-1).pageT, step: 2 });
    frames[0].state.milestones = [{ name: 'checkpoint', x: 100, y: 200 }];
    return trace(p, { frames, events, steps: [{ step: 1, thought: 'ouch', frames: [0, frames.length - 1], usage: { input: 0, output: 0 }, latencyMs: 0 }] });
  });
  const r = analyze(traces);
  const f = r.findings.find((x) => x.type === 'friction');
  assert.ok(f, 'expected friction, not a blocker');
  assert.equal(f.passed.length, 2);
});

test('an objective no ghost reaches is reported as missed', () => {
  const traces = ['a', 'b', 'c'].map((p) => {
    const t = walker(p, { upTo: 400 });
    t.frames[0].state.milestones = [{ name: 'key', x: 500, y: 100 }];
    return t;
  });
  const r = analyze(traces);
  const f = r.findings.find((x) => x.type === 'missed');
  assert.ok(f);
  assert.equal(f.milestone, 'key');
  assert.equal(f.severity, 'high');
  assert.equal(r.milestones[0].reachedBy.length, 0);
});

test('stuck needs at least two ghosts circling the same area', () => {
  const circler = (p) => {
    const frames = [];
    for (let i = 0; i < 20; i++) frames.push(frame(i, 60 + i * 10, 200));
    for (let i = 20; i < 80; i++) frames.push(frame(i, 300 + (i % 4) * 10, 200 + (i % 3) * 10));
    return trace(p, { frames, steps: [{ step: 1, thought: 'where now?', frames: [0, 79], usage: { input: 0, output: 0 }, latencyMs: 0 }] });
  };
  assert.equal(analyze([circler('a')]).findings.filter((f) => f.type === 'stuck').length, 0);
  const r = analyze([circler('a'), circler('b')]);
  const f = r.findings.find((x) => x.type === 'stuck');
  assert.ok(f);
  assert.equal(f.ghosts.length, 2);
});

test('score finds a fault in the right region and flags false alarms on clean games', () => {
  const traces = ['a', 'b', 'c'].map((p) => walker(p, { upTo: 940, deathX: 1020, deaths: 3 }));
  const r = analyze(traces);
  const hit = score(r, { type: 'blocker', region: { x0: 900, y0: 150, x1: 1180, y1: 360 }, milestone: null });
  assert.equal(hit.detectedStrict, true);
  assert.equal(hit.rank, 1);
  const miss = score(r, { type: 'blocker', region: { x0: 0, y0: 0, x1: 100, y1: 100 }, milestone: null });
  assert.equal(miss.detected, false);
  const clean = score(r, null);
  assert.equal(clean.falseAlarms, 1);
});
