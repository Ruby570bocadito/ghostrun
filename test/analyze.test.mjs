// Tests for the parts that use no AI: move sanitising, findings and benchmark scoring.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, bestOverlap, cluster2d, mergeOverlapping } from '../src/analyze.mjs';
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

test('an objective drawn with too little contrast is "hard to see", even if the ghosts reached it', () => {
  const traces = ['a', 'b', 'c', 'd'].map((p) => {
    const t = walker(p, { upTo: 600 });
    t.frames[0].state.milestones = [{ name: 'key', x: 500, y: 280, kind: 'object' }, { name: 'door', x: 580, y: 280, kind: 'object' }];
    t.events.push({ type: 'milestone', name: 'key', x: 500, y: 280, t: 1000, step: 1 }, { type: 'milestone', name: 'door', x: 580, y: 280, t: 1200, step: 1 });
    return t;
  });
  const objectives = [
    { name: 'key', x: 500, y: 280, ratio: 1.09, persona: 'a', frame: 0 },
    { name: 'door', x: 580, y: 280, ratio: 12.4, persona: 'a', frame: 0 },
  ];
  const r = analyze(traces, { objectives });
  const f = r.findings.find((x) => x.type === 'hard_to_see');
  assert.ok(f, 'expected a hard_to_see finding');
  assert.equal(f.milestone, 'key');
  assert.equal(f.severity, 'high'); // below 1.5:1, practically invisible
  assert.equal(f.reachedBy.length, 4); // AI ghosts found it anyway: that is the point
  assert.equal(r.findings.filter((x) => x.type === 'hard_to_see').length, 1); // the door is fine
  assert.deepEqual(r.objectives.map((o) => o.ok), [false, true]);
  const medium = analyze(traces, { objectives: [{ ...objectives[0], ratio: 2.4 }] }).findings.find((x) => x.type === 'hard_to_see');
  assert.equal(medium.severity, 'medium');
});

test('when nobody found a faint objective, its contrast is attached to the missed finding (no duplicate)', () => {
  const traces = ['a', 'b', 'c'].map((p) => {
    const t = walker(p, { upTo: 400 });
    t.frames[0].state.milestones = [{ name: 'key', x: 500, y: 100, kind: 'object' }];
    return t;
  });
  const r = analyze(traces, { objectives: [{ name: 'key', x: 500, y: 100, ratio: 1.1, persona: 'a', frame: 0 }] });
  assert.equal(r.findings.filter((x) => x.milestone === 'key').length, 1);
  const f = r.findings.find((x) => x.type === 'missed');
  assert.equal(f.contrast, 1.1);
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

test('without the SDK, positions come from the ghosts and ghost-reported deaths become findings', () => {
  const ghostOnly = (p) => {
    const frames = [];
    const steps = [];
    const events = [];
    for (let k = 0; k < 6; k++) {
      const from = frames.length;
      for (let j = 0; j < 4; j++) frames.push({ i: frames.length, t: frames.length * 100, pageT: frames.length * 100, file: `f${frames.length}.jpg`, state: null });
      steps.push({ step: k + 1, saw: 'playing', player: { x: 300, y: 200 }, thought: 'here again', frames: [from, frames.length - 1], usage: { input: 0, output: 0 }, latencyMs: 0 });
      events.push({ type: 'death', source: 'ghost', x: 305, y: 205, t: frames.at(-1).pageT, step: k + 1 });
    }
    return { persona: p, outcome: 'out_of_steps', coords: 'pixels', viewport: { width: 640, height: 360 }, frames, events, steps, gameMs: 2400, model: 'test' };
  };
  const r = analyze([ghostOnly('a'), ghostOnly('b')]);
  assert.equal(r.positionSource, 'ghosts');
  assert.equal(r.hasPositions, true);
  const f = r.findings.find((x) => x.type === 'blocker');
  assert.ok(f, 'repeated ghost-reported deaths in one spot should be a blocker');
  assert.equal(f.ghosts.length, 2);
});

// Big Champ (24 Nov): without the SDK every spot of repeated deaths was a blocker, "the Game Over screen traps players",
// though each ghost started again 10-11 times and kept seeing new screens. Now that counts as getting past.
test('without the SDK, ghosts that play on and see new screens after dying have got past the spot', () => {
  const ghostOnly = (p, newPerMove) => {
    const frames = [];
    const steps = [];
    const events = [];
    let screens = 3;
    for (let k = 0; k < 8; k++) {
      const from = frames.length;
      for (let j = 0; j < 4; j++) frames.push({ i: frames.length, t: frames.length * 100, pageT: frames.length * 100, file: `f${frames.length}.jpg`, state: null });
      screens += k === 0 ? 0 : newPerMove;
      const died = k % 2 === 0; // dies, starts again, dies...
      steps.push({ step: k + 1, saw: died ? 'died' : 'playing', player: { x: 300, y: 200 }, thought: 'again', frames: [from, frames.length - 1], screens, usage: { input: 0, output: 0 }, latencyMs: 0 });
      if (died) events.push({ type: 'death', source: 'ghost', x: 305, y: 205, t: frames.at(-1).pageT, step: k + 1 });
    }
    return { persona: p, outcome: 'time_up', coords: 'pixels', viewport: { width: 640, height: 360 }, frames, events, steps, gameMs: 3200, model: 'test' };
  };
  // Playing on: 5 new screens per move after the first death (20 while playing, in 4 moves).
  const on = analyze([ghostOnly('a', 5), ghostOnly('b', 5)]);
  const f = on.findings.find((x) => x.type === 'blocker' || x.type === 'friction');
  assert.equal(f.type, 'friction');
  assert.deepEqual(f.passed.sort(), ['a', 'b']);
  assert.deepEqual(f.newScreensAfterDeath, { a: 20, b: 20 });
  // The same deaths with almost nothing new afterwards (4 while playing): still a blocker.
  const stuck = analyze([ghostOnly('a', 1), ghostOnly('b', 1)]);
  assert.equal(stuck.findings.find((x) => x.type === 'blocker' || x.type === 'friction').type, 'blocker');
});

test('sanitizeMove keeps clicks inside the screen and defaults what the ghost saw', () => {
  const m = sanitizeMove({ click: [{ x: 700, y: -3 }, { x: 10, y: 10 }, { x: 20, y: 20 }], saw: 'nonsense' }, { width: 640, height: 360 });
  assert.deepEqual(m.click, [{ x: 639, y: 0 }, { x: 10, y: 10 }]);
  assert.equal(m.saw, 'playing');
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

// Found by test agents on 21 Nov (a wide gap split in two contradicting cards, stuck ghosts on the wrong card,
// one-death cards) and by a review agent (friction counted as "found" although clean games have it too).

test('a wide gap with deaths at both edges is one blocker, not two cards that contradict each other', () => {
  const traces = [
    walker('a', { upTo: 900, deathX: 1000, deaths: 3 }),
    walker('b', { upTo: 900, deathX: 1000, deaths: 3 }),
    walker('c', { upTo: 900, deathX: 1090, deaths: 3 }),
    walker('d', { upTo: 900, deathX: 1090, deaths: 3 }),
  ];
  const r = analyze(traces);
  const atGap = r.findings.filter((f) => f.center.x > 950 && f.center.x < 1150);
  assert.equal(atGap.length, 1);
  assert.equal(atGap[0].type, 'blocker');
  assert.equal(atGap[0].count, 12);
  assert.equal(atGap[0].passed.length, 0);
});

// Found while checking the gallery (21 Nov): the merge above joined two different gaps of Gap Run into one
// finding, because the run-up to the second gap starts where the first gap's area ends.
test('two neighbouring gaps whose areas only touch stay two findings; two halves of one gap become one', () => {
  const area = (x0, x1) => [{ x0, x1 }]; // here each group carries its own area
  const regionOf = (g) => ({ x0: Math.min(...g.map((a) => a.x0)), x1: Math.max(...g.map((a) => a.x1)), y0: 163, y1: 409 });
  // Areas as measured on a real run: first gap 213-400, run-up and second gap 396-733 (4 px of contact).
  assert.equal(mergeOverlapping([area(213, 400), area(396, 733)], regionOf).length, 2);
  // Deaths at both edges of one wide gap: the areas overlap by more than half of the smaller one.
  assert.equal(mergeOverlapping([area(979, 1153), area(888, 1045)], regionOf).length, 1);
});

test('in a single-screen level, two death spots 100 px apart stay separate', () => {
  const small = (t) => ({ ...t, frames: t.frames.map((f) => ({ ...f, state: { ...f.state, worldW: 640 } })) });
  const traces = [
    small(walker('a', { upTo: 100, deathX: 200, deaths: 3 })),
    small(walker('b', { upTo: 100, deathX: 200, deaths: 3 })),
    small(walker('c', { upTo: 100, deathX: 300, deaths: 3 })),
    small(walker('d', { upTo: 100, deathX: 300, deaths: 3 })),
  ];
  assert.equal(analyze(traces).findings.filter((f) => f.type === 'blocker' || f.type === 'friction').length, 2);
});

test('a single death is too weak to be a finding', () => {
  const r = analyze([walker('a', { upTo: 400, deathX: 500, deaths: 1 }), walker('b', { upTo: 700 }), walker('c', { upTo: 700 }), walker('d', { upTo: 700 })]);
  const f = r.findings.find((x) => x.type === 'friction');
  assert.equal(f.severity, 'low');
});

test('ghosts stuck near two spots are attached to the one they overlap most', () => {
  const findings = [
    { id: 'A', region: { x0: 200, x1: 400, y0: 0, y1: 360 } },
    { id: 'B', region: { x0: 380, x1: 700, y0: 0, y1: 360 } },
  ];
  assert.equal(bestOverlap(findings, { x0: 390, x1: 650, y0: 100, y1: 300 }).id, 'B');
  assert.equal(bestOverlap(findings, { x0: 900, x1: 950, y0: 0, y1: 10 }), undefined);
});

test('an objective nobody but one ghost found is critical when it is practically invisible', () => {
  const traces = ['a', 'b', 'c'].map((p) => {
    const t = walker(p, { upTo: 400 });
    t.frames[0].state.milestones = [{ name: 'key', x: 500, y: 100, kind: 'object' }];
    return t;
  });
  traces[0].events.push({ type: 'milestone', name: 'key', x: 500, y: 100, t: 500, step: 1 });
  const plain = analyze(traces).findings.find((x) => x.type === 'missed');
  assert.equal(plain.severity, 'medium');
  const measured = analyze(traces, { objectives: [{ name: 'key', x: 500, y: 100, ratio: 1.09, persona: 'a', frame: 0 }] }).findings.find((x) => x.type === 'missed');
  assert.equal(measured.severity, 'high');
  assert.equal(measured.contrast, 1.09);
});

test('only a critical finding counts as finding a planted flaw (friction also appears in clean games)', () => {
  const fault = { type: 'deaths', region: { x0: 100, y0: 100, x1: 300, y1: 300 } };
  const inPlace = { center: { x: 200, y: 200 }, region: { x0: 150, y0: 150, x1: 250, y1: 250 } };
  const report = (findings) => ({ findings, ghosts: [] });
  const friction = score(report([{ ...inPlace, type: 'friction', severity: 'high' }]), fault);
  assert.equal(friction.detectedLenient, true);
  assert.equal(friction.detectedStrict, false);
  assert.equal(score(report([{ ...inPlace, type: 'blocker', severity: 'high' }]), fault).detectedStrict, true);
  const missedFault = { type: 'missed', milestone: 'key', region: { x0: 100, y0: 100, x1: 300, y1: 300 } };
  assert.equal(score(report([{ ...inPlace, type: 'hard_to_see', severity: 'high', milestone: 'key' }]), missedFault).detectedStrict, true);
});
