// One ghost playing one game in its own browser context, with the game clock frozen
// while the brain thinks ("bullet time").
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DeathSpots, JumpLog, historyLine, jumpFacts, outcomeOf, turnNotes, walkSpeed } from './feedback.mjs';
import { deadKeysNear } from './keys.mjs';
import { MAX_TAP_AFTER_PX } from './brains/meta.mjs';
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
// How long a click keeps the button down, in game time (games that check the button each frame need to see it).
const CLICK_PRESS_MS = 90;
// Longest real time to wait for a game to create its canvas after the page has loaded.
const CANVAS_WAIT_MS = 6000;
const LOAD_WAIT_MS = 15000; // how long a found canvas may stay blank while the game loads
// F3, "run N px, then tap": the run-up advances the frozen clock in slices this long, checking the distance after each.
const RUN_UP_SLICE_MS = 20;
// The run-up has its own time budget and duration_ms counts from the tap. F5 (22 Nov): when the run-up came out of
// duration_ms, 70 of 157 run-ups at Gap Run's gaps were cut short by it (a 240 px run in an 800 ms move: tap 100 px
// early), and half the jumps left under 240 ms after the tap, so the ghost was asked again mid-jump and tapped Space
// in the air (128 of 221 mid-air taps came right after such a move). 600 px at walking speed (180 px/s) is ~3.3 s.
export const MAX_RUN_UP_MS = 3500;
// A person presses a little early or late: a delayed tap moves by a random time with this standard deviation.
export const HUMAN_ERROR_MS = 40;
// F4: while the character falls below every floor it has stood on, the game runs on with the keys held, up to this long.
export const MAX_FALL_HOLD_MS = 1500;
const FALL_SLICE_MS = 50;

const readEvents = (page, from) => page.evaluate((n) => (window.__ghost ? window.__ghost.events.slice(n) : []), from);
const readState = (page) =>
  page.evaluate(() => ({ now: performance.now(), state: window.__ghost ? { ...window.__ghost.state } : null }));

const point = (p, w = 2000, h = 2000) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: clamp(Math.round(p.x), 0, w), y: clamp(Math.round(p.y), 0, h) } : null;

/** Validates and normalises a move coming from any brain. */
export function sanitizeMove(m, viewport = { width: 2000, height: 2000 }) {
  const hold = [...new Set((m?.hold ?? []).filter((k) => typeof k === 'string'))].slice(0, 2);
  const tap = [...new Set((m?.tap ?? []).filter((k) => typeof k === 'string' && !hold.includes(k)))].slice(0, 2);
  const tapAfter = tap.length ? clamp(Math.round(Number(m?.tap_after_px) || 0), 0, MAX_TAP_AFTER_PX) : 0;
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
    ...(tapAfter ? { tap_after_px: tapAfter } : {}),
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
/**
 * Size of a screenshot of an empty page at this size (JPEG quality 70, as the ghosts' own screenshots). In a page of
 * its own: the game's context closes any extra page.
 */
async function blankShotSize(browser, viewport) {
  const blank = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    await blank.setContent('<body style="margin:0;background:#000"></body>');
    return (await blank.screenshot({ type: 'jpeg', quality: 70 })).length;
  } finally {
    await blank.close().catch(() => {});
  }
}

/**
 * Public demo: every request a game page makes (the page itself, redirects, scripts, images, fetch, WebSockets)
 * goes through the guard first. Contexts that use it must also be created with serviceWorkers: 'block'.
 */
export async function protectContext(context, guard, onBlocked = () => {}) {
  await context.route('**/*', async (route) => {
    try {
      if (await guard(route.request().url())) return await route.continue();
      onBlocked();
      return await route.abort('blockedbyclient');
    } catch {
      // The page or the browser closed while the request was being checked: nothing left to do.
    }
  });
  // WebSockets do not pass through context.route: check them too (found by a test agent).
  await context.routeWebSocket(/.*/, async (ws) => {
    try {
      if (await guard(ws.url())) return ws.connectToServer();
      onBlocked();
      await ws.close({ code: 1008, reason: 'blocked' });
    } catch {
      // closed meanwhile
    }
  });
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** The exit interview as stored: short strings and real booleans, whatever the model sent. */
export function cleanDebrief(a = {}) {
  return {
    goal: clip(a.goal, 100) || 'no idea',
    understood_goal: a.understood_goal === true,
    understood_controls: a.understood_controls === true,
    stopped_me: clip(a.stopped_me, 160) || 'nothing',
    keep_playing: a.keep_playing === true,
  };
}

export async function runGhost({
  browser,
  url,
  brain,
  persona,
  maxSteps = 40,
  outDir,
  viewport = DEFAULT_VIEWPORT,
  frameEveryMs: frameEveryMsAsked = 100,
  onStep = () => {},
  onFrame = () => {},
  stopOnWin = true,
  stopWhenSaturated = true, // stop a ghost once more moves cannot change what it has shown
  bulletTime = true, // false = the game keeps running while the brain thinks (baseline for the A2 experiment)
  notices = [], // failures handled during the run (e.g. model fallback), shared with the caller
  guard = null, // async (url) => may the game page load it? Set by the public demo (src/guard.mjs)
  debrief = true, // after its last move, the ghost answers a short exit interview (if its brain can)
  onDebrief = () => {},
  humanErrorMs = HUMAN_ERROR_MS, // spread of a delayed tap (F3); 0 = exact, for tests
  rng = Math.random,
  signal,
}) {
  let frameEveryMs = frameEveryMsAsked; // raised to 250 ms below for games without the SDK
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await mkdir(join(outDir, 'frames'), { recursive: true });
  // In the public demo the game may not install a service worker: its requests would not pass the check below.
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(guard ? { serviceWorkers: 'block' } : {}) });
  const page = await context.newPage();
  let blockedRequests = 0;
  if (guard) await protectContext(context, guard, () => (blockedRequests += 1));
  // A game must not open more windows (ads, external links): close them.
  context.on('page', (p) => {
    if (p !== page) p.close().catch(() => {});
  });
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
      const slice = Math.min(frameEveryMs - sinceCapture, left);
      await tick(slice);
      left -= slice;
    }
  };
  // Moves the frozen clock on, recording a frame every frameEveryMs of game time (and at the end of a move: flush()).
  let sinceCapture = 0;
  const tick = async (ms) => {
    await page.clock.runFor(ms);
    gameMs += ms;
    sinceCapture += ms;
    if (sinceCapture >= frameEveryMs) {
      sinceCapture = 0;
      await capture();
    }
  };
  const flush = async () => {
    if (sinceCapture > 0) {
      sinceCapture = 0;
      await capture();
    }
  };
  const eventsSoFar = () => page.evaluate(() => (window.__ghost ? window.__ghost.events.length : 0));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

  /**
   * F3: keeps the held keys down until the character has moved `px` (the ghost's own estimate), stops moving, or
   * `maxMs` runs out. The tap point moves by a human error in time (normal, sd humanErrorMs, at most 2 sd) at the
   * current speed. Returns the time used, where the tap happens and how far the character ran.
   */
  const runUp = async (px, maxMs) => {
    const errMs = humanErrorMs ? clamp(gauss() * humanErrorMs, -2 * humanErrorMs, 2 * humanErrorMs) : 0;
    let st = (await readState(page)).state;
    const x0 = st.x;
    let ms = 0;
    let still = 0;
    let lastX = x0;
    for (;;) {
      const speed = Number.isFinite(st.vx) ? Math.abs(st.vx) : 0;
      if (Math.abs(st.x - x0) >= px + (speed * errMs) / 1000 || ms + RUN_UP_SLICE_MS > maxMs) break;
      if (ms > 0 && Math.abs(st.x - lastX) < 0.5) {
        if (++still >= 3) break; // blocked or not moving: a person would press now
      } else still = 0;
      lastX = st.x;
      await tick(RUN_UP_SLICE_MS);
      ms += RUN_UP_SLICE_MS;
      st = (await readState(page)).state;
    }
    return { ms, x: st.x, y: st.y, run: Math.round(Math.abs(st.x - x0)), errorMs: Math.round(errMs) };
  };

  try {
    await page.clock.install();
    let res;
    try {
      res = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    } catch (err) {
      if (/ERR_BLOCKED_BY_CLIENT/.test(err.message)) {
        throw Object.assign(new Error('This link leads to a private or local network address, which the public demo does not open.'), { kind: 'game_blocked' });
      }
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

    // Some games create their canvas only after loading their images or sounds, which the frozen clock does not
    // wait for: give them up to CANVAS_WAIT_MS of real time, moving game time on a little meanwhile (Dead Again, a
    // js13k game, made its canvas 1-3 s after "load" and was refused as "no canvas", 22 Nov).
    const findCanvas = () =>
      page.evaluate(() => {
        const c = document.querySelector('canvas');
        return c ? { w: c.width, h: c.height } : null;
      });
    let canvas = await findCanvas();
    for (let waited = 0; !canvas && waited < CANVAS_WAIT_MS; waited += 250) {
      await sleep(250);
      await page.clock.runFor(250);
      canvas = await findCanvas();
    }
    // "Blank" = barely bigger than a screenshot of an empty page of the same size. A fixed 4,000-byte line refused
    // Big Champ (a js13k game) whose dark start screen only says "Tap" (2.8 KB, against 2.1 KB for an empty page).
    const blank = (await blankShotSize(browser, viewport)) + 250;
    // Engine games (Godot, Unity…) show a black canvas while they load, longer when four ghosts load them at once:
    // two of four ghosts were refused as "blank" on an itch.io game that the other two played (22 Nov). Wait for it.
    let shot = await page.screenshot({ type: 'jpeg', quality: 70 });
    for (let waited = 0; canvas && shot.length < blank && waited < LOAD_WAIT_MS; waited += 500) {
      await sleep(500);
      await page.clock.runFor(500);
      shot = await page.screenshot({ type: 'jpeg', quality: 70 });
    }
    const first = await capture();
    if (!canvas || first.length < blank) {
      throw Object.assign(
        new Error(canvas ? 'The game screen looks blank after loading, so there is nothing to play.' : 'No game canvas found on this page.'),
        { kind: 'game_not_playable' },
      );
    }
    // Games with the SDK report positions and events; for the others the ghosts' own eyes are all we have.
    trace.sdk = trace.frames[0].state !== null;
    // Games without the SDK: a frame every 250 ms of game time is enough for replays, and each capture costs real time
    // on engine games. Games with the SDK keep 100 ms: deaths and teleports are read from positions that close.
    if (!trace.sdk) frameEveryMs = Math.max(frameEveryMs, 250);

    const history = []; // one finished line per move: what the ghost did and what happened (append-only)
    const spots = new DeathSpots();
    const jumps = new JumpLog(); // F2: takeoffs, jump lengths and respawns, from the game's own state
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
      // Keys that did nothing where it last died, measured around its last fatal takeoff (or the death itself).
      const lastTry = jumps.jumps.filter((j) => j.died).at(-1);
      const keysCenter = lastTry ? { x: lastTry.x, y: lastTry.y } : spots.last && { x: spots.last.x, y: spots.last.y };
      const notes = trace.sdk
        ? turnNotes({ spots, step, recent, speed: walkSpeed(speedSamples), jumps, deadKeys: keysCenter ? deadKeysNear(trace, keysCenter) : [] })
        : turnNotes({ step, recent }).concat(
            recentDeathSteps.filter((s) => step - s <= 8).length >= 3 ? ['You have died 3 or more times in your last 8 moves. Try something different.'] : [],
          );
      const thinkStart = performance.now();
      const pageThinkStart = bulletTime ? null : await page.evaluate(() => performance.now());
      const decision = await decideRobustly(
        brain,
        { screenshot: shot, history, notes, step, sdk: trace.sdk },
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

      // A click is a press, a short wait in game time, and a release, like a finger. An instant click (down and up
      // before the game's next frame) was invisible to games that check the button each frame: on Big Champ, a real
      // js13k game, every ghost clicked "Tap" and nothing happened, and the report blamed the game (22 Nov).
      let clickedMs = 0;
      for (const c of move.click) {
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await advance(CLICK_PRESS_MS);
        await page.mouse.up();
        clickedMs += CLICK_PRESS_MS;
      }
      for (const k of move.hold) await page.keyboard.down(k);
      // F3: "run N px, then tap", only where the game reports positions and the clock is frozen.
      const delayed = Boolean(move.tap_after_px && trace.sdk && bulletTime);
      let tapAt = before && Number.isFinite(before.x) ? { x: before.x, y: before.y } : null;
      if (delayed) {
        const r = await runUp(move.tap_after_px, MAX_RUN_UP_MS);
        tapAt = { x: Math.round(r.x), y: Math.round(r.y), run: r.run, errorMs: r.errorMs, ms: clickedMs + r.ms }; // ms: after the move began
      }
      for (const k of move.tap) await page.keyboard.down(k);
      const tapMs = move.tap.length ? Math.min(120, move.duration_ms) : 0;
      if (tapMs) {
        await advance(tapMs);
        for (const k of move.tap) await page.keyboard.up(k);
      }
      // After a run-up, duration_ms counts from the tap (MAX_RUN_UP_MS explains why).
      await advance(Math.max(0, move.duration_ms - tapMs - (delayed ? 0 : clickedMs)));
      // F4: do not hand the decision back while the character is falling below every floor it has stood on: keep
      // the keys held until it lands or dies (at most MAX_FALL_HOLD_MS), as a person watches the fall.
      let fallHoldMs = 0;
      if (trace.sdk && bulletTime) {
        let st = (await readState(page)).state;
        while (fallHoldMs < MAX_FALL_HOLD_MS && jumps.fallingBelowFloors(st) && (await eventsSoFar()) === eventCount) {
          await tick(FALL_SLICE_MS);
          fallHoldMs += FALL_SLICE_MS;
          st = (await readState(page)).state;
        }
      }
      if (bulletTime) await flush();
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
      const died = events.some((e) => e.type === 'death');
      const observed = trace.sdk
        ? jumps.observe([before, ...trace.frames.slice(frameFrom).map((f) => f.state)], { step, died, tapX: move.tap.length ? tapAt?.x : null })
        : null;
      const facts = died ? jumpFacts(observed, jumps) : null;
      const outcome = decision.safe ? 'no answer from the model, you waited' : outcomeOf({ before, after, events, sdk: trace.sdk, screenChanged, jump: facts });
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
        move: { click: move.click, hold: move.hold, tap: move.tap, ...(move.tap_after_px ? { tap_after_px: move.tap_after_px } : {}), duration_ms: move.duration_ms },
        ...(move.tap_after_px && trace.sdk && bulletTime ? { tapAt } : {}),
        ...(fallHoldMs ? { fallHoldMs } : {}),
        ...(facts ? { facts } : {}),
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
    if (debrief && typeof brain.debrief === 'function' && trace.steps.length >= 3 && trace.outcome !== 'stopped' && !signal?.aborted) {
      try {
        const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
        const deaths = trace.steps.reduce((a, s) => a + (s.events ?? []).filter((e) => e === 'death').length, 0);
        const ending = trace.outcome === 'won' ? ' and finished the level' : trace.outcome === 'quit' ? ' and chose to stop' : '';
        const summary = `You made ${trace.steps.length} moves and died ${deaths} time${deaths === 1 ? '' : 's'}${ending}.`;
        const d = await brain.debrief({ screenshot: shot, history, summary, sdk: trace.sdk });
        if (d?.answer) {
          trace.debrief = { ...cleanDebrief(d.answer), model: brain.model, usage: d.usage, latencyMs: Math.round(d.latencyMs ?? 0) };
          await onDebrief(trace.debrief);
        }
      } catch (err) {
        notices.push({ type: 'debrief_failed', reason: err.message, handled: 'this ghost has no exit interview; its moves and findings are complete' });
      }
    }
  } catch (err) {
    trace.outcome = 'error';
    trace.error = { kind: err.kind ?? (err.status ? `api_${err.status}` : 'error'), message: err.message };
  } finally {
    trace.endedAt = new Date().toISOString();
    trace.gameMs = gameMs;
    if (blockedRequests) trace.blockedRequests = blockedRequests;
    await writeFile(join(outDir, 'trace.json'), JSON.stringify(trace, null, 2));
    await context.close().catch(() => {});
  }
  return trace;
}
