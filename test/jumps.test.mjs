// F2 (rediseno/PLAN.md): the facts a ghost is told about each death, measured from the game's own state. Replayed on
// real SDK frames recorded in the benchmark (test/fixtures: positions only, no screenshots). F1's play-quality
// measurement and the new move fields are tested here too. No network, no model, no browser.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DeathSpots, JumpLog, deathFacts, describeMove, jumpFacts, outcomeOf, turnNotes } from '../src/feedback.mjs';
import { deadKeysNear, tapHadEffect } from '../src/keys.mjs';
import { CACHE_KEY, moveSchema, systemPrompt } from '../src/brains/meta.mjs';
import { sanitizeMove } from '../src/ghost.mjs';
import { levelGaps, summarize, takeoffs, traceQuality } from '../bench/play-quality.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

/** Replays a recorded trace move by move the way runGhost feeds the JumpLog. */
function replay(trace) {
  const log = new JumpLog();
  const spots = new DeathSpots();
  const byStep = new Map();
  let fallingDecisions = 0;
  for (const s of trace.steps) {
    const before = trace.frames[Math.max(0, s.frames[0] - 1)].state;
    if (log.fallingBelowFloors(before)) fallingDecisions += 1;
    const died = s.events.includes('death');
    const observed = log.observe([before, ...trace.frames.slice(s.frames[0], s.frames[1] + 1).map((f) => f.state)], { step: s.step, died, tapX: s.move.tap.length ? s.before.x : null });
    for (const e of trace.events.filter((e) => e.step === s.step && e.type === 'death')) spots.add({ x: e.x, y: e.y, step: s.step });
    byStep.set(s.step, { died, facts: died ? jumpFacts(observed, log) : null });
  }
  return { log, spots, byStep, fallingDecisions };
}

test('a fatal jump at the impossible gap: where it took off, how far it went, and that it reappears at a checkpoint', () => {
  // Gap Run ?fault=gap, the Reader: its 28th move jumped at the third gap (edge at x=940, 200 px wide).
  const { byStep } = replay(fixture('gap-run-gap-reader'));
  const f = byStep.get(28).facts;
  assert.equal(f.takeoff.x, 919);
  assert.equal(f.takeoff.walkedOff, false);
  assert.equal(f.takeoff.behind, 27); // it had stood at x=946 before (where it walked off on move 25)
  assert.ok(f.length >= 145 && f.length <= 160, `a running jump covers ~150 px; measured ${f.length}`);
  assert.equal(f.respawn.atStart, false); // the game respawns at the start of the last platform stood on
  assert.ok(f.respawn.back > 100);
  const text = deathFacts(f).join(', ');
  assert.match(text, /took off 27 px before the furthest point you had stood on/);
  assert.match(text, /carried you 1\d\d px forward and you came down without landing/);
  assert.match(text, /checkpoint \(not the start\)/);
  assert.doesNotMatch(text, /overshoot|too far|back at the start/i);
  // Its 18th move took off right at the edge and still fell short: a clean attempt, the proof the gap is too wide.
  const clean = byStep.get(20).facts;
  assert.equal(clean.takeoff.x, 940);
  assert.match(deathFacts(clean).join(', '), /took off from the furthest point you had stood on there/);
});

test('walking off an edge is told apart from a jump, and every jump of the same run measures the same', () => {
  const { log, byStep } = replay(fixture('gap-run-gap-reader'));
  assert.equal(byStep.get(26).facts.takeoff.walkedOff, true);
  assert.match(deathFacts(byStep.get(26).facts).join(', '), /walked off the edge without jumping/);
  const lengths = log.jumps.filter((j) => !j.walkedOff && j.length != null).map((j) => j.length);
  assert.ok(lengths.length >= 6);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 6, `landed and fatal jumps are measured alike: ${lengths}`);
  assert.equal(log.best, Math.max(...lengths));
});

test('the outcome line carries the facts only when the ghost died', () => {
  const facts = { takeoff: { x: 919, behind: 27, walkedOff: false }, length: 153, best: 153, respawn: { atStart: false, back: 150 } };
  const sdk = true;
  assert.equal(outcomeOf({ sdk, before: { x: 100, y: 300 }, after: { x: 190, y: 300 }, jump: facts }), 'you moved 90 px right');
  assert.equal(
    outcomeOf({ sdk, before: { x: 919, y: 287 }, after: { x: 769, y: 287 }, events: [{ type: 'death' }], jump: facts }),
    'you died, you took off 27 px before the furthest point you had stood on there, the jump carried you 153 px forward and you came down without landing, you reappear 150 px behind your takeoff, at a checkpoint (not the start), your longest jump so far: 153 px',
  );
  assert.match(deathFacts({ respawn: { atStart: true, back: null } }).join(), /you reappear at the start/);
});

test('repeated deaths get facts instead of advice: takeoffs, jump lengths, best jump and the keys that did nothing there', () => {
  const t = fixture('read-me-wrong-key-newbie');
  const { log, spots } = replay(t);
  const last = log.jumps.filter((j) => j.died).at(-1);
  const dead = deadKeysNear(t, { x: last.x, y: last.y });
  assert.deepEqual(dead.find((k) => k.key === 'KeyZ' && k.where === 'on the floor')?.presses >= 2, true);
  assert.ok(!dead.some((k) => k.key === 'Space' && k.where === 'on the floor'), 'Space jumps on the floor, so it is never called dead there');
  const [note] = turnNotes({ spots, step: t.steps.at(-1).step, jumps: log, deadKeys: dead });
  assert.match(note, /^You have died 8 times at the same spot\./);
  assert.match(note, /Your last takeoffs there were .* px before the furthest point you had stood on, and those jumps carried you .* px forward\./);
  assert.match(note, /Your longest jump so far: 1\d\d px\./);
  assert.match(note, /Near there, Z did nothing on the floor \(\d taps\)\./);
  // The old hint ended in "another key or another route": 63 of 86 mid-air jump taps came right after it.
  assert.doesNotMatch(note, /another key|try/i);
});

test('the recorded ghosts decided while falling into the pit; the JumpLog sees it from the frames', () => {
  assert.equal(replay(fixture('gap-run-gap-reader')).fallingDecisions, 4);
  const log = new JumpLog();
  log.observe([{ x: 100, y: 287, vx: 0, vy: 0, onFloor: true }]);
  assert.equal(log.fallingBelowFloors({ x: 300, y: 295, vx: 180, vy: 200, onFloor: false }), false); // not yet below the floor
  assert.equal(log.fallingBelowFloors({ x: 310, y: 320, vx: 180, vy: 300, onFloor: false }), true);
  assert.equal(log.fallingBelowFloors({ x: 310, y: 320, vx: 180, vy: -300, onFloor: false }), false); // going up
  assert.equal(log.fallingBelowFloors({ x: 310, y: 320 }), false); // top-down games have no floor
});

test('"run N px, then tap" is a move field only with taps, and only games with the SDK are offered it', () => {
  assert.equal(sanitizeMove({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: 47.6 }).tap_after_px, 48);
  assert.equal(sanitizeMove({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: 9999 }).tap_after_px, 600);
  assert.equal('tap_after_px' in sanitizeMove({ hold: ['ArrowRight'], tap: [], tap_after_px: 50 }), false);
  assert.equal('tap_after_px' in sanitizeMove({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: -3 }), false);
  assert.equal(describeMove({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: 48, duration_ms: 600 }), 'held ArrowRight, tapped Space after 48 px for 600 ms');
  assert.ok(moveSchema(640, 360, { sdk: true }).properties.tap_after_px);
  assert.ok(moveSchema(640, 360, { sdk: true }).required.includes('tap_after_px'));
  assert.equal(moveSchema(640, 360).properties.tap_after_px, undefined);
  assert.match(moveSchema(640, 360).properties.thought.description, /no milliseconds, no pixels/);
  const persona = { name: 'The Newbie', style: '' };
  assert.match(systemPrompt(persona, null, 640, 360, { sdk: true }), /tap_after_px/);
  assert.match(systemPrompt(persona, null, 640, 360, { sdk: true }), /keeps your keys held until you land or die/);
  assert.doesNotMatch(systemPrompt(persona, null, 640, 360), /tap_after_px/);
  assert.match(systemPrompt(persona, null, 640, 360), /nothing waits until you reach an edge/);
  assert.equal(CACHE_KEY, 'ghostrun-ghost-v6');
  assert.match(systemPrompt(persona, null, 640, 360, { sdk: true }), /duration_ms counts from that tap/);
});

test('play quality (F1) measures takeoffs against the real edges, which the ghost is never told', () => {
  const t = fixture('gap-run-gap-reader');
  assert.deepEqual(levelGaps(t.frames[0].state).map((g) => [g.edge, g.width, g.jumpable]), [[300, 80, true], [620, 100, true], [940, 200, false]]);
  const q = traceQuality(t);
  assert.equal(q.game, 'gap-run');
  assert.equal(q.fault, 'gap');
  assert.equal(q.deaths, 9);
  assert.equal(q.falling, 4);
  const atGap3 = q.jumps.filter((j) => j.gap === 2);
  assert.ok(atGap3.some((j) => j.dist === 0 && j.clean)); // move 18: at the edge, holding right
  assert.ok(atGap3.some((j) => j.dist === 66)); // move 23, from x=874
  const s = summarize([q], { runs: [{ game: 'gap-run', faulted: true }] });
  assert.equal(s.impossibleGhosts, 1);
  assert.equal(s.faultedGapRuns, 1);
});

test('a key tapped after a run-up is judged from the frames after the tap, not the first frames of the move', () => {
  // Runs for 300 ms (frames at 100, 200, 300), taps Space at 300 ms, and jumps in the frame after.
  const run = (x) => ({ x, y: 287, vx: 180, vy: 0, onFloor: true });
  const frames = [{ t: 0, state: run(100) }, { t: 100, state: run(118) }, { t: 200, state: run(136) }, { t: 300, state: run(154) }, { t: 400, state: { x: 172, y: 250, vx: 180, vy: -380, onFloor: false } }];
  const step = { step: 1, t0: 0, move: { hold: ['ArrowRight'], tap: ['Space'], tap_after_px: 54, duration_ms: 500 }, before: { x: 100, y: 287 }, frames: [1, 4], events: [], tapAt: { x: 154, y: 287, run: 54, ms: 300 } };
  const trace = { persona: 'newbie', frames, steps: [step] };
  assert.equal(tapHadEffect(trace, step, 180), true);
  assert.equal(tapHadEffect(trace, { ...step, tapAt: undefined }, 180), false); // what the old window would have said
  assert.equal(takeoffs(trace)[0].x, 154);
});
