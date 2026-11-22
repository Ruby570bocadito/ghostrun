// F3 and F4 (rediseno/PLAN.md) on the real Gap Run in a real browser, with a scripted brain (no model, no network):
// "run N px, then tap" takes off within ±10 px of where the brain asked, and a ghost is never asked to decide while
// it falls below every floor it has stood on.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { MAX_FALL_HOLD_MS, runGhost } from '../src/ghost.mjs';
import { JumpLog } from '../src/feedback.mjs';
import { levelGaps, takeoffs } from '../bench/play-quality.mjs';

// The edges come from the game's own state (games v1 and v2 put them in different places); the ghost is never told.
const edge = (st, i) => levelGaps(st)[i].edge;
const aim = (st) => edge(st, 0) - 5; // just before the first gap

/** A brain that plays a fixed script; each entry builds its move from the game's state now. */
function scriptedBrain(script, where) {
  let i = 0;
  return {
    id: 'scripted-test',
    model: 'none',
    async decide() {
      const make = script[Math.min(i++, script.length - 1)];
      const move = { thought: 'scripted', saw: 'playing', player: null, click: [], hold: [], tap: [], duration_ms: 300, confused: false, quit: false, ...make(where()) };
      return { move, usage: { input: 0, output: 0 }, latencyMs: 0 };
    },
  };
}

async function play(script, opts = {}) {
  const server = await startServer(0);
  const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-runup-'));
  const browser = await chromium.launch();
  let state = null;
  try {
    const brain = scriptedBrain(script, () => state);
    const trace = await runGhost({
      browser,
      url: `http://localhost:${server.address().port}/gap-run/`,
      brain,
      persona: { id: 'newbie', name: 'The Newbie', style: '' },
      maxSteps: script.length,
      outDir,
      debrief: false,
      stopWhenSaturated: false,
      onFrame: (f) => (state = f.state ?? state),
      ...opts,
    });
    assert.equal(trace.error, undefined, trace.error?.message);
    return trace;
  } finally {
    await browser.close();
    server.close();
    await rm(outDir, { recursive: true, force: true });
  }
}

test('run N px, then tap: the jump leaves within ±10 px of the planned point and clears the first gap', { timeout: 90_000 }, async () => {
  const trace = await play(
    [
      () => ({ hold: ['ArrowRight'], duration_ms: 400 }),
      // A run-up of ~190 px (about 1 s) in a 900 ms action: duration_ms counts from the tap, so the run is not cut
      // short (F5: 70 of 157 run-ups were, and took off early) and the jump has its 900 ms to land.
      (st) => ({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: Math.round(aim(st) - st.x), duration_ms: 900 }),
      () => ({ hold: ['ArrowRight'], duration_ms: 400 }),
    ],
    { humanErrorMs: 0 },
  );
  const st = trace.frames[0].state;
  const jump = trace.steps[1];
  assert.equal(jump.move.tap_after_px > 100, true, 'the run-up starts well before the edge');
  assert.ok(Math.abs(jump.tapAt.run - jump.move.tap_after_px) <= 10, `ran ${jump.tapAt.run} px for ${jump.move.tap_after_px}`);
  const off = takeoffs(trace).find((t) => t.step === 2);
  assert.ok(off, 'the character jumped during the move');
  // From the frames alone: the frame before the takeoff is at most one frame (~18 px) before it.
  assert.ok(Math.abs(jump.tapAt.x - aim(st)) <= 10, `tapped at x=${jump.tapAt.x}, aimed at ${aim(st)}`);
  assert.ok(off.x <= jump.tapAt.x + 1 && off.x >= jump.tapAt.x - 20);
  assert.ok(jump.tapAt.ms > jump.move.duration_ms, 'the run-up took longer than duration_ms and was not cut short');
  assert.ok(jump.t1 - jump.t0 >= jump.tapAt.ms + jump.move.duration_ms, 'the action went on for duration_ms after the tap');
  assert.ok(trace.frames[trace.steps[1].frames[1]].state.onFloor, 'it had landed when it was asked for its next move');
  assert.equal(trace.events.filter((e) => e.type === 'death').length, 0);
  assert.ok(trace.steps[2].after.x > levelGaps(st)[0].far && trace.frames.at(-1).state.onFloor, 'landed on the second platform');
});

test('with human error a delayed tap stays close, and a ghost is not asked to decide while falling into a pit', { timeout: 90_000 }, async () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const trace = await play(
    [
      () => ({ hold: ['ArrowRight'], duration_ms: 400 }),
      (st) => ({ hold: ['ArrowRight'], tap: ['Space'], tap_after_px: Math.round(aim(st) - st.x), duration_ms: 1200 }),
      () => ({ hold: ['ArrowRight'], duration_ms: 1000 }), // lands on the second platform and walks on
      // Walk off the second platform's edge so that the move ends shortly after the feet leave it. The window between
      // "below the floor" and death in the pit is ~0.1-0.2 s and depends on the game's art, so try a few endings (each
      // death respawns at the start of the platform). Without F4 the ghost would be asked for its next move mid-fall.
      ...[150, 200, 250, 300].map((extra) => (st) => ({ hold: ['ArrowRight'], duration_ms: Math.max(100, Math.round(((edge(st, 1) + 10 - st.x) / 180) * 1000) + extra) })),
    ],
    { rng },
  );
  const jump = trace.steps[1];
  // 40 ms of error (at most 2 sd) at 180 px/s is at most ~15 px, plus one 20 ms slice.
  assert.ok(Math.abs(jump.tapAt.run - jump.move.tap_after_px) <= 20, `ran ${jump.tapAt.run} px for ${jump.move.tap_after_px} (error ${jump.tapAt.errorMs} ms)`);
  const fall = trace.steps.find((s) => s.fallHoldMs);
  assert.ok(fall, 'at least one move ended mid-fall and was held');
  assert.ok(fall.fallHoldMs <= MAX_FALL_HOLD_MS, `held ${fall.fallHoldMs} ms while falling`);
  assert.ok(fall.events.includes('death'), 'the fall ended in the same move');
  assert.match(fall.outcome, /you walked off the edge without jumping/);
  assert.match(fall.outcome, /checkpoint \(not the start\)/);
  // No decision was taken while falling below the floor.
  const log = new JumpLog();
  for (const s of trace.steps) {
    const before = trace.frames[Math.max(0, s.frames[0] - 1)].state;
    assert.equal(log.fallingBelowFloors(before), false, `move ${s.step} was decided while falling`);
    log.observe([before, ...trace.frames.slice(s.frames[0], s.frames[1] + 1).map((f) => f.state)], { step: s.step, died: s.events.includes('death') });
  }
});
