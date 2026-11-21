// One ghost playing one game in its own browser context, with the game clock frozen
// while the brain thinks ("bullet time").
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DeathSpots, historyLine, outcomeOf, turnNotes, walkSpeed } from './feedback.mjs';
import { sumUsage } from './brains/prices.mjs';

export const DEFAULT_VIEWPORT = { width: 640, height: 360 };
const SAW = ['playing', 'menu', 'died', 'level_complete', 'other'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// When a ghost has proved its point, more moves only cost money (bench/simulate-stop.mjs replays the
// recorded benchmark: stopping at 8 deaths in one spot or 20 moves without exploring anything new
// found the same 20/20 faults with no new false alarm). Only for games with the SDK: without it,
// positions are what the ghost reports on screen, too rough to tell one spot from another.
export const STOP_AFTER_DEATHS_AT_SPOT = 8;
export const STOP_AFTER_IDLE_MOVES = 20;
const IDLE_CELL_PX = 80;

// What a ghost does when the model's answer is unusable twice in a row: wait a moment, keep playing.
export const SAFE_MOVE = { thought: '', saw: 'other', player: null, click: [], hold: [], tap: [], duration_ms: 300, confused: false, quit: false };
const MAX_SAFE_MOVES_IN_A_ROW = 3;

const readEvents = (page, from) => page.evaluate((n) => (window.__ghost ? window.__ghost.events.slice(n) : []), from);
const readState = (page) =>
  page.evaluate(() => ({ now: performance.now(), state: window.__ghost ? { ...window.__ghost.state } : null }));

const point = (p, w = 2000, h = 2000) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: clamp(Math.round(p.x), 0, w), y: clamp(Math.round(p.y), 0, h) } : null;

/** Validates and normalises a move coming from any brain. */
export function sanitizeMove(m, viewport = { width: 2000, height: 2000 }) {
  const hold = [...new Set((m?.hold ?? []).filter((k) => typeof k === 'string'))].slice(0, 2);
  const tap = [...new Set((m?.tap ?? []).filter((k) => typeof k === 'string' && !hold.includes(k)))].slice(0, 2);
  return {
    thought: String(m?.thought ?? '').slice(0, 160),
    saw: SAW.includes(m?.saw) ? m.saw : 'playing',
    player: point(m?.player),
    click: (Array.isArray(m?.click) ? m.click : [])
      .map((c) => point(c, viewport.width - 1, viewport.height - 1))
      .filter(Boolean)
      .slice(0, 2),
    hold,
    tap,
    duration_ms: clamp(Math.round(Number(m?.duration_ms) || 400), 100, 1500),
    confused: Boolean(m?.confused),
    quit: Boolean(m?.quit),
  };
}

/**
 * Asks the brain for a move. An unusable answer (broken or cut JSON) is retried once; if the retry
 * fails too, the ghost waits a moment (SAFE_MOVE) instead of being lost. Failed attempts still cost
 * tokens, so their usage is added to the move's.
 */
export async function decideRobustly(brain, input, { onBadOutput = () => {} } = {}) {
  const failed = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const d = await brain.decide(input);
      return { ...d, usage: sumUsage([...failed.map((f) => f.usage), d.usage]), attempts: attempt, latencyMs: d.latencyMs + failed.reduce((a, f) => a + (f.latencyMs ?? 0), 0) };
    } catch (err) {
      if (err.kind !== 'bad_output') throw err;
      failed.push(err);
    }
  }
  await onBadOutput(failed.at(-1));
  return { move: SAFE_MOVE, usage: sumUsage(failed.map((f) => f.usage)), attempts: failed.length, latencyMs: failed.reduce((a, f) => a + (f.latencyMs ?? 0), 0), safe: true };
}

/**
 * Plays the game. Returns a full trace: steps (decisions), frames (screens + positions every
 * frameEveryMs of game time) and events (reported by the game through the SDK or, for games
 * without it, from what the ghost saw on screen).
 */
export async function runGhost({
  browser,
  url,
  brain,
  persona,
  maxSteps = 40,
  outDir,
  viewport = DEFAULT_VIEWPORT,
  frameEveryMs = 100,
  onStep = () => {},
  onFrame = () => {},
  stopOnWin = true,
  stopWhenSaturated = true, // stop a ghost once more moves cannot change what it has shown
  bulletTime = true, // false = the game keeps running while the brain thinks (baseline for the A2 experiment)
  notices = [], // failures handled during the run (e.g. model fallback), shared with the caller
  signal,
}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await mkdir(join(outDir, 'frames'), { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const trace = {
    persona: persona.id,
    url,
    brain: brain.id,
    model: brain.model,
    coords: brain.coords ?? 'grid1000', // units of steps[].player (older runs used a 0-1000 grid)
    viewport,
    steps: [],
    frames: [],
    events: [],
    notices,
    startedAt: new Date().toISOString(),
  };
  let gameMs = 0;
  let frameNo = 0;
  let eventCount = 0;
  let lastBuf = null;

  const capture = async () => {
    const file = `frames/${String(frameNo++).padStart(5, '0')}.jpg`;
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    await writeFile(join(outDir, file), buf);
    const { now, state } = await readState(page);
    const frame = { i: trace.frames.length, t: gameMs, pageT: now, file, state };
    trace.frames.push(frame);
    lastBuf = buf;
    await onFrame(frame);
    return buf;
  };

  const advance = async (ms) => {
    if (!bulletTime) {
      // Real time: the game runs on its own. Measure the real clock so the keys are held for exactly
      // `ms` (taking screenshots also takes time, which must count).
      const start = performance.now();
      for (;;) {
        const left = ms - (performance.now() - start);
        if (left <= 0) break;
        await sleep(Math.min(frameEveryMs, left));
        await capture();
      }
      gameMs += Math.round(performance.now() - start);
      return;
    }
    // Bullet time: step the frozen clock in small slices so we can record frames for clips and heatmaps.
    let left = ms;
    while (left > 0) {
      const slice = Math.min(frameEveryMs, left);
      await page.clock.runFor(slice);
      gameMs += slice;
      left -= slice;
      await capture();
    }
  };

  try {
    await page.clock.install();
    let res;
    try {
      res = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    } catch (err) {
      throw Object.assign(new Error(`Could not open the game: ${err.message.split('\n')[0]}`), { kind: 'game_unreachable' });
    }
    if (res && !res.ok()) throw Object.assign(new Error(`The game URL answered HTTP ${res.status()}`), { kind: 'game_unreachable' });
    // Freeze the game clock. The fake clock keeps flowing until paused, so pause a little ahead of
    // "now" (with several browsers busy, reading the time and pausing can be >10 ms apart).
    for (let attempt = 1; ; attempt++) {
      try {
        const now = await page.evaluate(() => Date.now());
        await page.clock.pauseAt(now + 500 * attempt);
        break;
      } catch (err) {
        if (attempt >= 4 || !/past/i.test(err.message)) throw err;
      }
    }
    await page.clock.runFor(1500); // let the game boot inside game time
    if (!bulletTime) await page.clock.resume(); // from now on game time flows in real time
    trace.bulletTime = bulletTime;

    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    const first = await capture();
    if (!canvas || first.length < 4000) {
      throw Object.assign(
        new Error(canvas ? 'The game screen looks blank after loading, so there is nothing to play.' : 'No game canvas found on this page.'),
        { kind: 'game_not_playable' },
      );
    }
    // Games with the SDK report positions and events; for the others the ghosts' own eyes are all we have.
    trace.sdk = trace.frames[0].state !== null;

    const history = []; // one finished line per move: what the ghost did and what happened (append-only)
    const spots = new DeathSpots();
    const recent = []; // per move: did it achieve nothing?
    const speedSamples = [];
    const seenCells = new Set();
    let lastFreshStep = 0;
    let safeInARow = 0;
    let recentDeathSteps = [];
    let lastSaw = null;
    let lastPlayer = null;
    const cellOf = (s) => `${Math.floor(s.x / IDLE_CELL_PX)},${Math.floor(s.y / IDLE_CELL_PX)}`;

    for (let step = 1; step <= maxSteps; step++) {
      if (signal?.aborted) {
        trace.outcome = 'stopped';
        break;
      }
      const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
      const { now: shotT, state: before } = await readState(page);
      const notes = trace.sdk
        ? turnNotes({ spots, step, recent, speed: walkSpeed(speedSamples) })
        : turnNotes({ step, recent }).concat(
            recentDeathSteps.filter((s) => step - s <= 8).length >= 3 ? ['You have died 3 or more times in your last 8 moves. Try something different.'] : [],
          );
      const thinkStart = performance.now();
      const pageThinkStart = bulletTime ? null : await page.evaluate(() => performance.now());
      const decision = await decideRobustly(
        brain,
        { screenshot: shot, history, notes, step },
        {
          onBadOutput: (err) => {
            notices.push({ type: 'bad_output', step, reason: err.message, handled: 'waited 300 ms and kept playing' });
          },
        },
      );
      const pageThinkEnd = bulletTime ? null : await page.evaluate(() => performance.now());
      if (!bulletTime) gameMs += Math.round(performance.now() - thinkStart); // the game kept running meanwhile
      if (decision.safe) {
        if (++safeInARow >= MAX_SAFE_MOVES_IN_A_ROW) {
          throw Object.assign(new Error(`The model gave ${MAX_SAFE_MOVES_IN_A_ROW} unusable answers in a row.`), { kind: 'bad_output' });
        }
      } else safeInARow = 0;
      const move = sanitizeMove(decision.move, viewport);
      const t0 = gameMs;
      const frameFrom = trace.frames.length;

      if (!trace.sdk && !decision.safe) {
        // No SDK: turn what the ghost saw into events. The screenshot it judged was taken at shotT.
        const at = lastPlayer ?? move.player ?? { x: viewport.width / 2, y: viewport.height / 2 };
        if (move.saw === 'died' && lastSaw !== 'died') {
          trace.events.push({ type: 'death', source: 'ghost', x: at.x, y: at.y, t: shotT, step, persona: persona.id });
          recentDeathSteps.push(step);
        }
        if (move.saw === 'level_complete' && lastSaw !== 'level_complete')
          trace.events.push({ type: 'milestone', name: 'level_complete', source: 'ghost', x: at.x, y: at.y, t: shotT, step, persona: persona.id });
        if (move.saw === 'playing' && move.player) lastPlayer = move.player;
      }
      if (!decision.safe) lastSaw = move.saw;

      for (const c of move.click) await page.mouse.click(c.x, c.y);
      for (const k of move.hold) await page.keyboard.down(k);
      for (const k of move.tap) await page.keyboard.down(k);
      const tapMs = move.tap.length ? Math.min(120, move.duration_ms) : 0;
      if (tapMs) {
        await advance(tapMs);
        for (const k of move.tap) await page.keyboard.up(k);
      }
      await advance(move.duration_ms - tapMs);
      for (const k of move.hold) await page.keyboard.up(k);

      const after = (await readState(page)).state;
      const events = await readEvents(page, eventCount);
      eventCount += events.length;
      for (const e of events) {
        // In real-time mode, a death between pageThinkStart and pageThinkEnd happened while the AI was still deciding.
        const duringThink = pageThinkStart != null && e.t >= pageThinkStart && e.t <= pageThinkEnd;
        trace.events.push({ ...e, source: 'game', step, persona: persona.id, ...(duringThink ? { duringThink: true } : {}) });
      }

      // What happened, told to the ghost on its next turn (and kept in the trace).
      const screenChanged = trace.sdk ? null : !(lastBuf && lastBuf.equals(shot));
      const outcome = decision.safe ? 'no answer from the model, you waited' : outcomeOf({ before, after, events, sdk: trace.sdk, screenChanged });
      const acted = move.hold.length + move.tap.length + move.click.length > 0;
      const moved = before && after && Number.isFinite(before.x) && Number.isFinite(after.x) && Math.hypot(after.x - before.x, after.y - before.y) >= 4;
      recent.push({ stuck: acted && !events.length && (trace.sdk ? !moved : screenChanged === false) });
      if (trace.sdk && before && after && Number.isFinite(before.x) && Number.isFinite(after.x)) {
        const horizontal = move.hold.filter((k) => k === 'ArrowLeft' || k === 'ArrowRight');
        if (horizontal.length === 1 && !move.tap.length && !events.some((e) => e.type === 'death')) {
          speedSamples.push({ dx: after.x - before.x, dy: after.y - before.y, ms: move.duration_ms });
        }
      }
      let deathsHere = 0;
      for (const e of events) if (e.type === 'death') deathsHere = Math.max(deathsHere, spots.add({ x: e.x, y: e.y, step }));
      if (trace.sdk) {
        let fresh = events.some((e) => e.type === 'milestone');
        for (let i = frameFrom; i < trace.frames.length; i++) {
          const st = trace.frames[i].state;
          if (!st || !Number.isFinite(st.x)) continue;
          const c = cellOf(st);
          if (!seenCells.has(c)) {
            seenCells.add(c);
            fresh = true;
          }
        }
        if (fresh) lastFreshStep = step;
      }

      const record = {
        step,
        t0,
        t1: gameMs,
        model: brain.model,
        thought: move.thought,
        saw: move.saw,
        confused: move.confused,
        quit: move.quit,
        player: move.player,
        move: { click: move.click, hold: move.hold, tap: move.tap, duration_ms: move.duration_ms },
        before: before && { x: before.x, y: before.y },
        after: after && { x: after.x, y: after.y, deaths: after.deaths, won: after.won },
        events: [...events.map((e) => e.type), ...trace.events.filter((e) => e.source === 'ghost' && e.step === step).map((e) => e.type)],
        outcome,
        ...(notes.length ? { notes } : {}),
        ...(decision.attempts > 1 ? { attempts: decision.attempts } : {}),
        ...(decision.safe ? { safeMove: true } : {}),
        usage: decision.usage,
        latencyMs: Math.round(decision.latencyMs),
        frames: [frameFrom, trace.frames.length - 1],
      };
      trace.steps.push(record);
      history.push(historyLine(step, move, outcome));
      await onStep(record);
      if (move.quit) {
        trace.outcome = 'quit';
        break;
      }
      if (stopOnWin && after?.won) {
        trace.outcome = 'won';
        break;
      }
      if (stopWhenSaturated && trace.sdk && step < maxSteps) {
        if (deathsHere >= STOP_AFTER_DEATHS_AT_SPOT) {
          trace.outcome = 'saturated';
          trace.stopReason = { kind: 'deaths', count: deathsHere, x: Math.round(spots.last.x), y: Math.round(spots.last.y) };
          break;
        }
        if (step - lastFreshStep >= STOP_AFTER_IDLE_MOVES) {
          trace.outcome = 'saturated';
          trace.stopReason = { kind: 'idle', moves: step - lastFreshStep };
          break;
        }
      }
    }
    trace.outcome ??= 'out_of_steps';
  } catch (err) {
    trace.outcome = 'error';
    trace.error = { kind: err.kind ?? (err.status ? `api_${err.status}` : 'error'), message: err.message };
  } finally {
    trace.endedAt = new Date().toISOString();
    trace.gameMs = gameMs;
    await writeFile(join(outDir, 'trace.json'), JSON.stringify(trace, null, 2));
    await context.close().catch(() => {});
  }
  return trace;
}
