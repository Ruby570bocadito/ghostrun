// One ghost playing one game in its own browser context, with the game clock frozen
// while the brain thinks ("bullet time").
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_VIEWPORT = { width: 640, height: 360 };
const SAW = ['playing', 'menu', 'died', 'level_complete', 'other'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

function describe(move) {
  const parts = [];
  if (move.click.length) parts.push(`clicked at ${move.click.map((c) => `(${c.x},${c.y})`).join(' and ')}`);
  if (move.hold.length) parts.push(`held ${move.hold.join('+')}`);
  if (move.tap.length) parts.push(`tapped ${move.tap.join('+')}`);
  if (!parts.length) parts.push('waited');
  return `${parts.join(' and ')} for ${move.duration_ms} ms`;
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

  const capture = async () => {
    const file = `frames/${String(frameNo++).padStart(5, '0')}.jpg`;
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    await writeFile(join(outDir, file), buf);
    const { now, state } = await readState(page);
    const frame = { i: trace.frames.length, t: gameMs, pageT: now, file, state };
    trace.frames.push(frame);
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

    const history = [];
    let lastSaw = null;
    let lastPlayer = null;
    for (let step = 1; step <= maxSteps; step++) {
      if (signal?.aborted) {
        trace.outcome = 'stopped';
        break;
      }
      const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
      const { now: shotT, state: before } = await readState(page);
      const thinkStart = performance.now();
      const pageThinkStart = bulletTime ? null : await page.evaluate(() => performance.now());
      const decision = await brain.decide({ screenshot: shot, history, step });
      const pageThinkEnd = bulletTime ? null : await page.evaluate(() => performance.now());
      if (!bulletTime) gameMs += Math.round(performance.now() - thinkStart); // the game kept running meanwhile
      const move = sanitizeMove(decision.move, viewport);
      const t0 = gameMs;
      const frameFrom = trace.frames.length;

      if (!trace.sdk) {
        // No SDK: turn what the ghost saw into events. The screenshot it judged was taken at shotT.
        const at = lastPlayer ?? move.player ?? { x: viewport.width / 2, y: viewport.height / 2 };
        if (move.saw === 'died' && lastSaw !== 'died') trace.events.push({ type: 'death', source: 'ghost', x: at.x, y: at.y, t: shotT, step, persona: persona.id });
        if (move.saw === 'level_complete' && lastSaw !== 'level_complete')
          trace.events.push({ type: 'milestone', name: 'level_complete', source: 'ghost', x: at.x, y: at.y, t: shotT, step, persona: persona.id });
        if (move.saw === 'playing' && move.player) lastPlayer = move.player;
      }
      lastSaw = move.saw;

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
        usage: decision.usage,
        latencyMs: Math.round(decision.latencyMs),
        frames: [frameFrom, trace.frames.length - 1],
      };
      trace.steps.push(record);
      history.push({ step, summary: `you ${describe(move)}. You thought: "${move.thought}"` });
      await onStep(record);
      if (move.quit) {
        trace.outcome = 'quit';
        break;
      }
      if (stopOnWin && after?.won) {
        trace.outcome = 'won';
        break;
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
