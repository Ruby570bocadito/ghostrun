// The real-games meter (bench/real-games.mjs): screen fingerprints, stalls and the per-ghost measures, on synthetic
// screens and traces. No network, no model, no browser, no recorded runs (runs/ is not in the repository).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import {
  ANSWER_FRACTION,
  FP_H,
  FP_W,
  GRID_H,
  GRID_W,
  boxAverage,
  category,
  decodeGray,
  endingOf,
  fingerprint,
  firstGameFrame,
  gameOf,
  ghostMetrics,
  idTime,
  inputKinds,
  measureGhost,
  moveFrames,
  NOTHING_HAPPENED,
  novelty,
  parseArgs,
  renderMarkdown,
  sampleFrames,
  screenChange,
  stalls,
  summarize,
} from '../bench/real-games.mjs';

/** A grey image { width, height, gray } drawn by f(x, y) → 0..255. */
function grayImage(width, height, f) {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) gray[y * width + x] = f(x, y);
  return { width, height, gray };
}

/** The same picture as a JPEG, as the ghosts' frames are saved (quality 70). */
function jpegOf(width, height, f, quality = 70) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round(f(x, y));
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return jpeg.encode({ data, width, height }, quality).data;
}

const black = () => 10;
const sprite = (sx, sy, size = 8) => (x, y) => (x >= sx && x < sx + size && y >= sy && y < sy + size ? 245 : 10);
const room = (wall) => (x, y) => (wall === 'left' ? (x < 320 ? 200 : 20) : x >= 320 ? 200 : 20);

test('fingerprint: Go-Explore cells, 11 × 8 in 8 grey levels', () => {
  assert.equal(fingerprint(grayImage(640, 360, () => 0)), '0'.repeat(FP_W * FP_H));
  assert.equal(fingerprint(grayImage(640, 360, () => 255)), '7'.repeat(FP_W * FP_H));
  assert.equal(fingerprint(grayImage(640, 360, () => 80)), '2'.repeat(FP_W * FP_H)); // 80 is in [64, 96): level 2
  // A left-to-right ramp: every row climbs from level 0 to level 7.
  const ramp = fingerprint(grayImage(640, 360, (x) => (x * 255) / 639));
  for (let row = 0; row < FP_H; row++) {
    const digits = ramp.slice(row * FP_W, (row + 1) * FP_W).split('').map(Number);
    assert.equal(digits[0], 0);
    assert.equal(digits.at(-1), 7);
    assert.deepEqual([...digits].sort((a, b) => a - b), digits, 'levels never go down along a row');
  }
  // Any size of window: each pixel counts in the cell its position falls in.
  assert.equal(fingerprint(grayImage(752, 456, () => 255)).length, FP_W * FP_H);
});

test('fingerprint of saved frames: the same screen with a small sprite moving keeps it, a new room changes it', () => {
  const decode = (f) => decodeGray(jpegOf(640, 360, f));
  const a = decode(sprite(100, 100));
  assert.equal(a.width, 640);
  assert.equal(a.height, 360);
  assert.equal(fingerprint(a), fingerprint(decode(sprite(300, 200))), 'an 8 px sprite somewhere else is the same screen');
  assert.equal(fingerprint(a), fingerprint(decode(black)), 'JPEG noise and a tiny sprite do not make a new screen');
  assert.notEqual(fingerprint(decode(room('left'))), fingerprint(decode(room('right'))));
  assert.notEqual(fingerprint(decode(black)), fingerprint(decode(room('left'))));
});

test('screen change: mean grey difference and the share of grid cells that changed', () => {
  const g = (f) => boxAverage(grayImage(640, 360, f), GRID_W, GRID_H);
  assert.deepEqual(screenChange(g(black), g(black)), { mean: 0, fraction: 0 });
  // A 40 × 40 sprite covers 4 × 4 grid cells of 10 × 10 px.
  const c = screenChange(g(black), g(sprite(200, 100, 40)));
  assert.equal(c.fraction, 16 / (GRID_W * GRID_H));
  assert.ok(c.fraction >= ANSWER_FRACTION, 'a sprite that size moving counts as an answer to the input');
  assert.ok(c.mean > 1 && c.mean < 3, `small change on average (${c.mean})`);
  const whole = screenChange(g(room('left')), g(room('right')));
  assert.equal(whole.fraction, 1);
  assert.equal(screenChange(null, g(black)), null);
});

test('a move is judged on the frame it decided on and the first, middle and last of its own', () => {
  assert.deepEqual(moveFrames({ frames: [5, 13] }), { seen: 4, during: [5, 9, 13], end: 13 });
  assert.deepEqual(moveFrames({ frames: [1, 1] }), { seen: 0, during: [1], end: 1 });
  assert.equal(moveFrames({ frames: [3] }), null);
  assert.equal(moveFrames({}), null);
});

test('the first frame that shows the game: black and loading screens weigh far less than the game', () => {
  // Broken Repair, 22 Nov: 2.4 KB loading screens for 12 s, then the game at 15-20 KB.
  assert.equal(firstGameFrame([2400, 2500, 16000, 19000, 20000, 18000]), 2);
  // Big Champ: its dark "Tap" screen (2.8 KB), then the game.
  assert.equal(firstGameFrame([2800, 28000, 27000, 26000]), 1);
  assert.equal(firstGameFrame([11000, 15000, 14000]), 0);
  assert.equal(firstGameFrame([0, 0]), null); // frames that could not be read
  assert.equal(firstGameFrame([]), null);
});

test('sampling: one frame every 0.5 s of game time, whatever the frame rate', () => {
  const every100 = Array.from({ length: 21 }, (_, i) => ({ t: i * 100 }));
  assert.deepEqual(sampleFrames(every100), [0, 5, 10, 15, 20]);
  const every250 = Array.from({ length: 9 }, (_, i) => ({ t: i * 250 }));
  assert.deepEqual(sampleFrames(every250), [0, 2, 4, 6, 8]);
  // Uneven frames (end of a move, a long wait): the first frame at or after each tick, one per tick.
  assert.deepEqual(sampleFrames([{ t: 0 }, { t: 120 }, { t: 480 }, { t: 520 }, { t: 2600 }, { t: 2700 }, { t: 3000 }]), [0, 3, 4, 6]);
});

test('novelty: distinct screens and the curve of new ones; going back to a screen is not new', () => {
  const s = (t, fp) => ({ t, fp });
  const { distinct, curve } = novelty([s(0, 'a'), s(500, 'a'), s(1000, 'b'), s(1500, 'a'), s(2000, null), s(2500, 'c')]);
  assert.equal(distinct, 3);
  assert.deepEqual(curve, [[0, 1], [1, 2], [2.5, 3]]);
});

test('stalls: 10 s of game time without a screen never seen before', () => {
  const s = (t, fp) => ({ t, fp });
  // New screens at 0 and 1 s, then the same two screens back and forth until a new one at 15 s.
  const samples = [s(0, 'a'), s(1000, 'b')];
  for (let t = 1500; t < 15_000; t += 500) samples.push(s(t, t % 1000 ? 'a' : 'b'));
  samples.push(s(15_000, 'c'), s(16_000, 'd'));
  assert.deepEqual(stalls(samples, { endMs: 17_000 }), [{ fromMs: 1000, toMs: 15_000 }]);
  // Shorter than 10 s: no stall. At the end of the game it stays open.
  assert.deepEqual(stalls([s(0, 'a'), s(9_500, 'b')], { endMs: 12_000 }), []);
  assert.deepEqual(stalls([s(0, 'a'), s(5_000, 'b'), s(6_000, 'b')], { endMs: 20_000 }), [{ fromMs: 5_000, toMs: 20_000, open: true }]);
  // Exactly 10 s counts; unreadable frames are skipped; another threshold can be asked for.
  assert.equal(stalls([s(0, 'a'), s(10_000, 'b')], { endMs: 10_000 }).length, 1);
  assert.equal(stalls([s(0, null), s(0, 'a'), s(4_000, null), s(5_000, 'b')], { endMs: 5_000, minMs: 4_000 }).length, 1);
  assert.deepEqual(stalls([], { endMs: 30_000 }), []);
});

test('what the ghost said it saw: the categories of the first analysis', () => {
  assert.equal(category({ saw: 'playing', thought: 'Jump over the rock' }), 'playing');
  assert.equal(category({ saw: 'playing', thought: 'Still loading, black screen' }), 'loading');
  assert.equal(category({ saw: 'playing', thought: 'The screen is black but my ship moved' }), 'playing');
  assert.equal(category({ saw: 'playing', thought: 'Type a name to start' }), 'name');
  assert.equal(category({ saw: 'menu', thought: 'Title screen, press Enter' }), 'menu');
  assert.equal(category({ saw: 'other', thought: 'An intro story about gears' }), 'story');
  assert.equal(category({ saw: 'other', thought: 'GAME OVER, try again' }), 'gameover');
  assert.equal(category({ saw: 'died', thought: '' }), 'gameover');
  assert.equal(category({ saw: 'level_complete' }), 'level_complete');
  assert.equal(category({ saw: 'other', thought: 'Hmm' }), 'other');
  assert.equal(category({ saw: 'loading' }), 'loading');
});

test('"nothing happened" thoughts and the inputs of a move', () => {
  for (const t of ["Enter didn't start the game", 'Nothing happened, try Space', 'The ship is not moving', 'Z doesn’t do anything', 'no effect at all']) {
    assert.ok(NOTHING_HAPPENED.test(t), t);
  }
  for (const t of ['The ship moved right', 'Jump now', 'Nothing on screen yet']) assert.ok(!NOTHING_HAPPENED.test(t), t);
  assert.deepEqual(inputKinds({ click: [{ x: 1, y: 2 }], hold: [], tap: [] }), { mouse: true, keys: false, wait: false });
  assert.deepEqual(inputKinds({ click: [], hold: ['ArrowRight'], tap: ['Space'] }), { mouse: false, keys: true, wait: false });
  assert.deepEqual(inputKinds({ click: [], drag: [{ x1: 0, y1: 0, x2: 9, y2: 9 }], hold: [], tap: [] }), { mouse: true, keys: false, wait: false });
  assert.deepEqual(inputKinds({ click: [], hold: [], tap: [], duration_ms: 900 }), { mouse: false, keys: false, wait: true });
  assert.deepEqual(inputKinds({ actions: [{ type: 'click', x: 3, y: 4 }, { type: 'run_jump', keys: ['ArrowRight'] }] }), { mouse: true, keys: true, wait: false });
  assert.deepEqual(inputKinds(undefined), { mouse: false, keys: false, wait: true });
  // v3 chains (24 Nov): the actions done after the first count (`thenDone` of them); skipped ones do not.
  const chain = { click: [], hold: ['ArrowUp'], tap: [], duration_ms: 800, then: [{ click: [{ x: 180, y: 230 }], hold: [], tap: [], duration_ms: 500 }], thenDone: 1 };
  assert.deepEqual(inputKinds(chain), { mouse: true, keys: true, wait: false });
  assert.deepEqual(inputKinds({ ...chain, hold: [], thenDone: 0 }), { mouse: false, keys: false, wait: true });
});

test('games, endings and run times', () => {
  assert.deepEqual(gameOf('https://play.js13kgames.com/escape-from-death-hole'), { slug: 'escape-from-death-hole', platform: 'js13k' });
  assert.deepEqual(gameOf('https://boghog.itch.io/decogear'), { slug: 'decogear', platform: 'itch.io' });
  assert.deepEqual(gameOf('http://localhost:5174/third-party/nilo/'), { slug: 'nilo', platform: 'js13k' });
  assert.equal(gameOf('https://example.com/my-game/').slug, 'example.com/my-game');
  assert.equal(endingOf('out_of_steps'), 'T');
  assert.equal(endingOf('time_up'), 'R');
  assert.equal(endingOf('quit'), 'A');
  assert.equal(endingOf('stopped', 488), 'L');
  assert.equal(endingOf('stopped', 117), 'C');
  assert.equal(endingOf('something_new'), 'something_new');
  // Cut by its own real-time budget after 117 s of game (Prerolled, 24 Nov): the trace says time_up, it is a limit.
  assert.equal(endingOf('time_up', 279, { kind: 'wall_time', minutes: 4.5, gameSeconds: 117 }), 'L');
  assert.equal(endingOf('time_up', 221, null), 'R');
  assert.equal(endingOf('too_slow', 424, { kind: 'wall_time' }), 'L');
  assert.equal(idTime('2026-11-22T12-01-21-334Z-7a5a1afd2e'), Date.parse('2026-11-22T12:01:21.334Z'));
  assert.equal(idTime('gap-run-clean-1'), null);
  const args = parseArgs(['v3-speed', '--url', 'js13kgames.com,itch.io', '--since', '2026-11-24T09:02Z', '--compare', 'before,v3']);
  assert.deepEqual(args.urls, ['js13kgames.com', 'itch.io']);
  assert.deepEqual(args.compare, ['before', 'v3']);
  assert.deepEqual(parseArgs(['x', 'abc', '--compare', 'before', '--compare', 'v3']).compare, ['before', 'v3']);
  assert.deepEqual(parseArgs(['x', 'abc']).compare, []);
});

/** A ghost of 4 moves on a game without the SDK: a menu, a move with no effect, then two that play. */
function syntheticGhost() {
  const t0 = Date.parse('2026-11-23T10:00:00.000Z');
  const frames = Array.from({ length: 9 }, (_, i) => ({ i, t: i * 2500, file: `frames/${String(i).padStart(5, '0')}.jpg`, state: null }));
  const step = (n, saw, thought, move, a, b) => ({ step: n, t0: frames[a - 1].t, t1: frames[b].t, saw, thought, move: { click: [], hold: [], tap: [], duration_ms: 400, ...move }, frames: [a, b], latencyMs: 900, usage: { input: 1000, cached: 0, output: 100 } });
  const trace = {
    persona: 'newbie',
    url: 'https://play.js13kgames.com/some-game',
    model: 'muse-ember-1.0',
    startedAt: new Date(t0).toISOString(),
    endedAt: new Date(t0 + 30_000).toISOString(),
    gameMs: 20_000,
    outcome: 'out_of_steps',
    frames,
    steps: [
      step(1, 'menu', 'Title screen, press Enter', { tap: ['Enter'] }, 1, 2),
      step(2, 'playing', "Enter didn't start, try clicking", { click: [{ x: 5, y: 5 }] }, 3, 4),
      step(3, 'playing', 'Run right', { hold: ['ArrowRight'] }, 5, 6),
      step(4, 'playing', 'Nothing happened, wait', {}, 7, 8),
    ],
  };
  // Frame write times: frame i at t0 + 2 s + 3 s × i. Fingerprints: a title, then the game; the game shows new
  // screens until 12.5 s of game time and nothing new after that.
  const fd = {
    fps: ['T', 'T', 'T', 'G1', 'G2', 'G3', 'G4', 'G4', 'G3'],
    wall: frames.map((_, i) => t0 + 2000 + 3000 * i),
    steps: [
      { endMean: 9, endFrac: 0.2, maxMean: 9, maxFrac: 0.2 }, // Enter did change the screen (to the game)
      { endMean: 0.1, endFrac: 0, maxMean: 0.1, maxFrac: 0 }, // the click: nothing
      { endMean: 4, endFrac: 0.05, maxMean: 4, maxFrac: 0.05 }, // running: the screen answers
      { endMean: 0, endFrac: 0, maxMean: 0, maxFrac: 0 }, // a wait
    ],
  };
  return { trace, fd, t0 };
}

test('per ghost: real play, time to it, groups, false "nothing happened", stalls, inputs and real time per move', () => {
  const { trace, fd, t0 } = syntheticGhost();
  const g = ghostMetrics(trace, fd, { runStartMs: t0 - 10_000, runWallS: 60 });
  assert.equal(g.steps, 4);
  assert.equal(g.gameS, 20);
  assert.equal(g.ending, 'T');
  // Move 2 says it is playing and used an input, but the screen did not answer; move 3 really plays.
  assert.equal(g.play.step, 3);
  assert.equal(g.play.gameS, 10); // t0 of move 3: frame 4 at 10 s of game time
  assert.equal(g.play.ghostS, 20); // its last frame (6) was written at t0 + 20 s
  assert.equal(g.play.wallS, 30); // and the run had started 10 s before the ghost
  assert.equal(g.realPlayMoves, 1);
  assert.deepEqual(g.buckets, { loading: 0, menu: 1, gameover: 0, play: 3 });
  assert.equal(g.timeline, 'MPPP');
  assert.equal(g.playTimeShare, 0.75);
  // Move 2's thought says Enter did nothing, but move 1 changed the screen: a false "nothing happened". Move 4's
  // says the same about move 3, which also changed it. Neither move 2's click nor move 4 are judged by themselves.
  assert.equal(g.saidNothing, 2);
  assert.equal(g.falseNothing, 2);
  // Screens every 0.5 s of game time: frames at 0, 2.5, 5, … s. New: T (0 s), G1 (7.5), G2 (10), G3 (12.5), G4 (15).
  assert.equal(g.screens, 5);
  assert.deepEqual(g.newScreensAt, [0, 7.5, 10, 12.5, 15]); // the novelty curve: the n-th new screen and when
  assert.deepEqual(g.falseNothingThoughts.map((x) => x.step), [2, 4]);
  assert.deepEqual(g.stalls, []); // 5 s to the end of the game: no stall
  assert.deepEqual(g.inputs, { mouse: 1, keys: 2, both: 0, wait: 1 });
  // Real time per move: 6 s each (two frames of 3 s), the first from the frame it decided on.
  assert.equal(g.secPerMove, 6);
  assert.equal(g.bootS, 2);
  assert.equal(g.firstFrameS, 12);
  assert.ok(g.costUsd > 0);

  // A step's `at` (when it was recorded) is used instead of the frames' write times.
  const timed = structuredClone(trace);
  timed.steps.forEach((s, k) => (s.at = new Date(t0 + 2000 + 10_000 * (k + 1)).toISOString()));
  assert.equal(ghostMetrics(timed, fd).secPerMove, 10);
  // And a step's `wallMs` (real ms since the ghost started, 24 Nov) before both.
  const walled = structuredClone(trace);
  walled.steps.forEach((s, k) => (s.wallMs = 2000 + 10_000 * (k + 1)));
  const w = ghostMetrics(walled, fd);
  assert.equal(w.secPerMove, 10);
  assert.equal(w.play.ghostS, 32); // move 3 ended at 32 s of the ghost's real time
  // Where its 30 s of real time went: 2 s to the first screen it decided on (frame 0), 4 answers of 0.9 s, the rest
  // of the moves (4 × 6 s - 3.6 s), 4 s after the last move. The moves bought 20 s of game.
  assert.deepEqual(g.time, { startS: 2, modelS: 3.6, playS: 20.4, endS: 4 });
  assert.equal(g.movesGameS, 20);
  assert.equal(g.modelCalls, 4);
  // The watchdog and the autopilot, as recorded on 24 Nov; a ghost cut by its real-time budget ends in L.
  const watched = ghostMetrics({ ...trace, frameStepMs: 100, frameStepFrom: 8110, realTimeFrom: 30_500, autopilot: { waitedMs: 4640, wallMs: 5101 }, outcome: 'time_up', stopReason: { kind: 'wall_time', minutes: 4.5, gameSeconds: 20 } }, fd, { runWallS: 279 });
  assert.deepEqual(watched.fewerFrames, { stepMs: 100, fromS: 8.1 });
  assert.equal(watched.realTimeFromS, 30.5);
  assert.equal(watched.autopilotS, 4.6);
  assert.equal(watched.autopilotWallS, 5.1);
  assert.equal(watched.ending, 'L');
  assert.equal(g.fewerFrames, undefined);
  // A long stall: the same screens for the last 15 s of a longer game.
  const long = { ...trace, gameMs: 30_000 };
  const stalled = ghostMetrics(long, fd);
  assert.deepEqual(stalled.stalls, [{ fromS: 15, toS: 30, s: 15, open: true, steps: [4, 4] }]);
  assert.equal(stalled.stalledS, 15);
  // An intro that moves by itself is not play: the ghost says "playing" once, presses a key while the credits roll,
  // and is back on menus for its next moves (Decogear, 23 Nov).
  const intro = structuredClone(trace);
  intro.steps[1].saw = 'playing';
  intro.steps[1].move = { click: [], hold: ['ArrowRight'], tap: [] };
  intro.steps[2].saw = 'menu';
  intro.steps[2].thought = 'Back to a title screen';
  intro.steps[3].saw = 'menu';
  intro.steps[3].thought = 'Press start';
  const introFd = structuredClone(fd);
  introFd.steps[1] = { endMean: 15, endFrac: 0.4, maxMean: 15, maxFrac: 0.4 };
  const fooled = ghostMetrics(intro, introFd);
  assert.equal(fooled.timeline, 'MPMM');
  assert.equal(fooled.play, null);
  // Without frames: the moves are still measured, the screens are unknown.
  const blind = ghostMetrics(trace, null);
  assert.equal(blind.screens, null);
  assert.equal(blind.play, null);
  assert.equal(blind.buckets.play, 3);
});

test('measureGhost reads a ghost folder: fingerprints, write times and how much each move changed the screen', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ghostrun-real-'));
  try {
    await mkdir(join(dir, 'frames'));
    const pictures = [black, black, sprite(100, 100, 40), room('left'), room('left')];
    const frames = [];
    for (const [i, f] of pictures.entries()) {
      const file = `frames/${String(i).padStart(5, '0')}.jpg`;
      await writeFile(join(dir, file), jpegOf(320, 180, f));
      const when = new Date(Date.parse('2026-11-23T10:00:00Z') + 1000 * i);
      await utimes(join(dir, file), when, when);
      frames.push({ i, t: i * 500, file, state: null });
    }
    const trace = {
      frames,
      steps: [
        { step: 1, t0: 0, t1: 1000, frames: [1, 2], move: { tap: ['Enter'] } },
        { step: 2, t0: 1000, t1: 2000, frames: [3, 4], move: {} },
      ],
    };
    await writeFile(join(dir, 'trace.json'), JSON.stringify(trace));
    const fd = await measureGhost(dir);
    assert.equal(fd.n, 5);
    assert.equal(fd.fps.length, 5);
    assert.equal(fd.fps[0], fd.fps[1]);
    assert.notEqual(fd.fps[2], fd.fps[3]);
    assert.equal(fd.wall[3] - fd.wall[0], 3000);
    assert.equal(fd.firstGame, 0, 'frames of about the same size: the first one already shows the game');
    // Move 1 (frames 1-2) decided on frame 0: the sprite appeared. Move 2 (frames 3-4) decided on frame 2: a new room.
    assert.ok(fd.steps[0].maxFrac > 0 && fd.steps[0].maxFrac < 0.05);
    assert.ok(fd.steps[1].endFrac > 0.4);
    // A missing frame is unknown, not an error.
    await rm(join(dir, frames[4].file));
    const again = await measureGhost(dir);
    assert.equal(again.fps[4], null);
    assert.equal(again.steps[1], null, 'the move whose last frame is missing has no measure');
    assert.ok(again.steps[0], 'the other moves keep theirs');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the tables: a summary per game and a markdown report', () => {
  const { trace, fd, t0 } = syntheticGhost();
  const ghost = ghostMetrics(trace, fd, { runStartMs: t0 - 10_000, runWallS: 60 });
  const failed = ghostMetrics({ persona: 'reader', startedAt: trace.startedAt, endedAt: trace.startedAt, gameMs: 0, outcome: 'error', error: { kind: 'game_not_playable', message: 'blank' }, frames: [], steps: [] }, null, {});
  const run = { id: '2026-11-23T09-59-50-000Z-abcdef1234', game: 'some-game', name: 'some-game', platform: 'js13k', url: trace.url, startedAt: '2026-11-23T09:59:50.000Z', wallS: 60, firstFrameS: 12, costUsd: 0.01, ghosts: [ghost, failed] };
  const s = summarize([run]);
  assert.equal(s.ghosts, 2);
  assert.equal(s.moved, 1);
  assert.equal(s.reached, 1);
  assert.equal(s.errors, 1);
  assert.deepEqual(s.pct, { loading: 0, menu: 25, gameover: 0, play: 75 });
  assert.equal(s.falseNothing, 2);
  assert.deepEqual(s.endings, { T: 1, E: 1 });
  // Real time: 30 s for 20 s of game, 4 answers buying 5 s of game each; shares of the 30 s (the ghost that never
  // moved is left out).
  assert.equal(s.speed.ghostWallS, 30);
  assert.equal(s.speed.realPerGameS, 1.5);
  assert.equal(s.speed.calls, 4);
  assert.equal(s.speed.gamePerCall, 5);
  assert.deepEqual(s.speed.split, { start: 7, model: 12, play: 68, end: 13 });
  assert.equal(s.speed.reportAfterS, null);
  assert.equal(summarize([{ ...run, reportAfterS: 6.5 }]).speed.reportAfterS.median, 6.5);
  const md = renderMarkdown({ label: 'test', command: 'node bench/real-games.mjs test x', generatedAt: '2026-11-23T10:00:00.000Z', total: s, games: [{ game: 'some-game', name: 'some-game', platform: 'js13k', runs: [run], summary: s }], criteria: [{ criterion: 'c', measured: 'm', target: 't' }] });
  assert.match(md, /^# Real jam games — test/);
  assert.match(md, /\| \*\*Total\*\* \|/);
  assert.match(md, /## some-game/);
  assert.match(md, /abcdef1234 \(23-11 09:59\)/);
  assert.match(md, /## Where the real time goes/);
  assert.match(md, /\| some-game \| 1\/2 \| 60 \| – \| 30 \| 20 \| 1\.50 \| 4 \| 5 \| 7 · 12 · 68 · 13 \|/);
  // Against earlier measurements: before → now, per game and in total, one section each (--compare before,v3).
  const before = { ...s, reached: 0, gameS: { median: 24, max: 30 }, speed: { ...s.speed, realPerGameS: 3.2 } };
  const v3 = { ...s, gameS: { median: 95, max: 150 } };
  const compared = renderMarkdown({ label: 'test', command: 'x', generatedAt: '2026-11-23T10:00:00.000Z', total: s, games: [{ game: 'some-game', name: 'some-game', platform: 'js13k', runs: [run], summary: s }], criteria: [], compares: [{ label: 'before', total: before, games: [{ game: 'some-game', summary: before }] }, { label: 'v3', total: v3, games: [{ game: 'some-game', summary: v3 }] }] });
  assert.match(compared, /## Compared with `before`/);
  assert.match(compared, /\| some-game \| 0 % → 100 % \|/);
  assert.match(compared, /\| 24 → 20 \|/);
  assert.match(compared, /\| 3\.20 → 1\.50 \|/);
  assert.match(compared, /## Compared with `v3`[\s\S]*\| 95 → 20 \|/);
  // An older result object with a single `compare` still renders.
  assert.match(renderMarkdown({ label: 'test', command: 'x', generatedAt: '2026-11-23T10:00:00.000Z', total: s, games: [], criteria: [], compare: { label: 'before', total: before, games: [] } }), /## Compared with `before`/);
});
