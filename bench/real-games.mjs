// Real jam games: how the ghosts really played them, measured on recorded runs with no AI calls (rediseno/PLAN-V3.md,
// sections 2 and 5). For every run and every ghost: real time of the run and per move, seconds of game, time until it
// really plays, share of moves on loading / menu / game over / play, distinct screens (a perceptual fingerprint of the
// frames, as Go-Explore) and their novelty curve, stalls (10 s of game without a new screen), "nothing happened"
// thoughts while the screen did change, clicks against keys, endings and cost; and where the real time went (getting
// to the game, the model's answers, playing it, the end) against the game time it bought.
//
// node bench/real-games.mjs <label> <runId | run dir | --url pattern>... [--since 2026-11-24T00:00Z] [--until …]
//   [--compare <label>[,<label>…]] [--workers N] [--runs <runs dir>] [--cache <file.json>]
//   runId: a folder of runs/ or the end of its name (7a5a1afd2e). A folder of run folders (a bench round) adds them all.
//   --url: every run whose config.json url (or the address the ghosts played) contains the pattern; repeatable or
//     comma-separated. --since/--until: only runs started in that window (from the run id's time).
//   --compare: adds before → after tables against bench/results/real-<label>.json; repeatable or comma-separated (the
//     first one is the baseline of the targets).
// Writes bench/results/real-<label>.md (a table per game and totals) and real-<label>.json (every ghost in detail).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import jpeg from 'jpeg-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANALYSIS_VERSION = 3; // bump when what is measured on the frames changes (invalidates --cache files)

// The measuring stick. Fixed here on purpose, apart from src/screen.mjs (what the ghosts are told), so that "before"
// and "after" are measured the same way while the ghost loop changes.
export const FP_W = 11; // Go-Explore's cell (Ecoffet et al. 2019): the frame in grey, 11 × 8, 8 levels
export const FP_H = 8;
export const FP_LEVELS = 8;
export const GRID_W = 64; // small grey image to measure how much a screen changed
export const GRID_H = 36;
export const CELL_DELTA = 24; // grey levels (0-255) for a grid cell to count as changed
export const CHANGED_MEAN = 3; // mean grey difference above which "the screen changed" (rediseno/v3/real-games/modes.py)
export const ANSWER_FRACTION = 0.003; // share of grid cells (7 of 2,304) that must change for a move to have an effect
export const SAMPLE_MS = 500; // fingerprints are taken every 0.5 s of game time, whatever the frame rate of the run
export const STALL_MS = 10_000; // a stall: at least 10 s of game time without a fingerprint never seen before
export const GAME_FRAME_SIZE = 0.5; // a frame shows the game when its JPEG weighs at least half the median (firstGameFrame)
const LIMIT_WALL_S = 470; // a run stopped after this long hit the server's 8-minute limit; earlier, someone cancelled it
// Games played only with the mouse (Big Champ) or where the mouse is the way on (Coiner): rediseno/v3/juegos-reales.md.
export const MOUSE_GAMES = new Set(['big-champ', 'coiner']);

// The 13 real games of rediseno/PLAN-V3.md section 5, in that order.
const GAME_NAMES = {
  'escape-from-death-hole': 'Escape from Death Hole',
  'find-all-pages': 'Find All Pages',
  spacetaxi: 'SpaceTaxi',
  coiner: 'Coiner',
  backout: 'Backout',
  'big-champ': 'Big Champ',
  'dead-again': 'Dead Again',
  delete: 'Delete!',
  'moon-buggy-racing': 'Moon Buggy',
  nilo: 'NILO',
  'broken-repair': 'Broken Repair',
  decogear: 'Decogear',
  prerolled: 'Prerolled',
};
const GAME_ORDER = Object.keys(GAME_NAMES);

// --- What a ghost saw: perceptual fingerprints and screen changes --------------------------------------------------

/** The pixels of a JPEG in grey (BT.601 luma, as OpenCV and PIL). */
export function decodeGray(buf) {
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: false, maxMemoryUsageInMB: 512 });
  const n = img.width * img.height;
  const ch = Math.round(img.data.length / n);
  const gray = new Float32Array(n);
  if (ch >= 3) for (let p = 0, i = 0; p < n; p++, i += ch) gray[p] = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  else for (let p = 0; p < n; p++) gray[p] = img.data[p * ch];
  return { width: img.width, height: img.height, gray };
}

/** Box average of a grey image on a w × h grid: every pixel counts in the cell its position falls in. */
export function boxAverage({ width, height, gray }, w, h) {
  const sum = new Float64Array(w * h);
  const count = new Uint32Array(w * h);
  const col = new Uint16Array(width);
  for (let x = 0; x < width; x++) col[x] = Math.min(w - 1, Math.floor((x * w) / width));
  for (let y = 0; y < height; y++) {
    const row = Math.min(h - 1, Math.floor((y * h) / height)) * w;
    for (let x = 0, p = y * width; x < width; x++, p++) {
      sum[row + col[x]] += gray[p];
      count[row + col[x]] += 1;
    }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = count[i] ? sum[i] / count[i] : 0;
  return out;
}

/**
 * A screen's fingerprint, as Go-Explore's cells: the frame in grey shrunk to 11 × 8 and cut to 8 levels, as 88 digits.
 * Nearly equal screens (a blinking cursor, JPEG noise) share it; a new room, menu or camera position does not.
 */
export function fingerprint(img) {
  let s = '';
  for (const v of boxAverage(img, FP_W, FP_H)) s += Math.min(FP_LEVELS - 1, Math.floor((v * FP_LEVELS) / 256));
  return s;
}

/** How much a screen changed between two grids: mean grey difference (0-255) and share of cells that changed. */
export function screenChange(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > CELL_DELTA) changed += 1;
  }
  return { mean: sum / a.length, fraction: changed / a.length };
}

/** Indexes of the frames taken every `everyMs` of game time: the first frame at or after each tick. */
export function sampleFrames(frames, everyMs = SAMPLE_MS) {
  const out = [];
  let next = 0;
  for (let i = 0; i < frames.length; i++) {
    const t = frames[i]?.t ?? 0;
    if (t >= next) {
      out.push(i);
      next = (Math.floor(t / everyMs) + 1) * everyMs;
    }
  }
  return out;
}

/** Distinct fingerprints and the novelty curve: [game seconds, distinct screens so far] at each new one. */
export function novelty(samples) {
  const seen = new Set();
  const curve = [];
  for (const s of samples) {
    if (!s.fp || seen.has(s.fp)) continue;
    seen.add(s.fp);
    curve.push([round(s.t / 1000, 1), seen.size]);
  }
  return { distinct: seen.size, curve };
}

/**
 * Stalls: periods of at least `minMs` of game time between a fingerprint never seen before and the next one (the
 * last period runs to `endMs`, the end of the ghost's game). Samples are { t: game ms, fp }, in order.
 */
export function stalls(samples, { minMs = STALL_MS, endMs } = {}) {
  const seen = new Set();
  const out = [];
  let last = null;
  for (const s of samples) {
    if (!s.fp || seen.has(s.fp)) continue;
    seen.add(s.fp);
    if (last !== null && s.t - last >= minMs) out.push({ fromMs: last, toMs: s.t });
    last = s.t;
  }
  const end = endMs ?? samples.at(-1)?.t;
  if (last !== null && Number.isFinite(end) && end - last >= minMs) out.push({ fromMs: last, toMs: end, open: true });
  return out;
}

// --- What a ghost said and did -------------------------------------------------------------------------------------

// The categories of rediseno/v3/real-games/analyze_runs.py: what the ghost said it saw, refined by its own thought.
const RX = {
  loading:
    /\bload|spinner|running\.\.\.|\bblank\b|black screen|white screen|empty screen|grey screen|gray screen|dark screen|nothing (is )?(on screen|here|showing|appear|yet|visible)|still (black|white|dark|empty|blank)|\bboot|just black|all black|all white|screen is (black|white|empty|dark)/i,
  name: /\bname\b|initials|\bAAA\b/i,
  gameover: /game ?over|you died|i died|died again|respawn|retry|restart|try again|you lose|lost (a|my|the) life|crashed|exploded|knocked out|\bK\.?O\b/i,
  story: /story|cutscene|comic|panel|intro|credit|splash|logo|scroll|dialog|text box|tutorial|instruction|how to play|controls screen|message/i,
  menu: /title|menu|start screen|press (any|enter|space|start)|click to (start|play)|level select|select a|play button|start button|main screen|tap to|click start|start the game|press start/i,
  actor: /move|moved|walk|jump|character|player|ship|car|buggy|ball|paddle/i,
};

/** loading · story · menu · name · other · gameover · playing · level_complete, from `saw` and the thought. */
export function category(step) {
  const saw = step?.saw;
  const th = step?.thought ?? '';
  if (saw === 'died' || saw === 'game_over' || saw === 'gameover') return 'gameover';
  if (saw === 'level_complete') return 'level_complete';
  if (saw === 'loading') return 'loading';
  if (saw === 'playing') {
    if (RX.loading.test(th) && !RX.actor.test(th)) return 'loading';
    if (RX.name.test(th)) return 'name';
    return 'playing';
  }
  if (RX.loading.test(th)) return 'loading';
  if (RX.name.test(th)) return 'name';
  if (RX.gameover.test(th)) return 'gameover';
  if (RX.story.test(th)) return 'story';
  if (saw === 'menu' || RX.menu.test(th)) return 'menu';
  return 'other';
}

/** The four groups of the tables: loading (and intros that play by themselves), menus, game over, play. */
export const BUCKET = { loading: 'loading', story: 'loading', menu: 'menu', name: 'menu', other: 'menu', gameover: 'gameover', playing: 'play', level_complete: 'play' };
const LETTER = { loading: 'L', story: 'S', menu: 'M', name: 'N', other: 'O', gameover: 'G', playing: 'P', level_complete: 'C' };

// A thought saying the last input did nothing (rediseno/v3/real-games/modes.py; also with a curly apostrophe).
export const NOTHING_HAPPENED =
  /did ?n[o'’]t (do|move|work|change|respond|start|confirm|revive|retry|skip|help|launch|jump)|does ?n[o'’]t (do|move|work|respond)|did nothing|does nothing|do nothing|nothing (happen|moved|works|changed|responds)|never mov|won['’]?t (move|budge|start|launch)|not moving|isn['’]?t (working|moving)|aren['’]?t (working|moving)|no effect|still (hasn['’]?t|haven['’]?t) moved|haven['’]?t moved|hasn['’]?t moved|nothing has moved/i;

/**
 * Which inputs a move used: the mouse (click, drag), keys, or none (a wait). Also reads v3 compound actions: the
 * actions a move chained after its first (`then`, of which the first `thenDone` were done) and `actions`.
 */
export function inputKinds(move = {}) {
  const has = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  let mouse = has(move?.click) || has(move?.drag);
  let keys = has(move?.hold) || has(move?.tap) || has(move?.keys);
  const then = Array.isArray(move?.then) ? move.then.slice(0, Number.isInteger(move?.thenDone) ? move.thenDone : move.then.length) : [];
  for (const a of [...then, ...(Array.isArray(move?.actions) ? move.actions : [])]) {
    const kind = String(a?.type ?? a?.kind ?? a?.action ?? '');
    if (has(a?.click) || has(a?.drag) || /click|drag|mouse|point/i.test(kind)) mouse = true;
    if (has(a?.hold) || has(a?.tap) || has(a?.keys) || has(a?.key) || /key|hold|tap|press|run|jump|walk/i.test(kind)) keys = true;
  }
  return { mouse, keys, wait: !mouse && !keys };
}

// too_slow: v3 stops a ghost that passes its own real-time budget (src/ghost.mjs MAX_GHOST_WALL_MS): a real-time limit.
// So is a time_up whose stopReason is wall_time: since 24 Nov a ghost cut by that budget after 60 s of game ends in
// time_up, without having played all its game time.
const OUTCOME_LETTER = { out_of_steps: 'T', time_up: 'R', quit: 'A', error: 'E', won: 'W', saturated: 'S', too_slow: 'L' };
const ENDINGS_ORDER = ['R', 'T', 'W', 'S', 'A', 'E', 'L', 'C'];
export const ENDINGS_LEGEND =
  'T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost\'s own budget of 4.5 minutes, however much it had played) · C = cancelled';

/** How a ghost ended, as one letter (T, R, W, S, A, E, L, C) or its outcome word when unknown. */
export function endingOf(outcome, runWallS, stopReason = null) {
  if (outcome === 'stopped') return runWallS != null && runWallS >= LIMIT_WALL_S ? 'L' : 'C';
  if (outcome === 'time_up' && stopReason?.kind === 'wall_time') return 'L';
  return OUTCOME_LETTER[outcome] ?? String(outcome ?? '?');
}

/** Which of the real games a link is, and where it is hosted. */
export function gameOf(url = '') {
  let m = String(url).match(/js13kgames\.com\/(?:games\/|entries\/)?([^/?#]+)/i);
  if (m) return { slug: m[1].toLowerCase(), platform: 'js13k' };
  m = String(url).match(/([a-z0-9-]+)\.itch\.io\/([^/?#]+)/i);
  if (m) return { slug: m[2].toLowerCase(), platform: 'itch.io' };
  m = String(url).match(/\/third-party\/([^/?#]+)/i);
  if (m) return { slug: m[1].toLowerCase(), platform: 'js13k' }; // NILO: a js13kGames 2020 entry we serve ourselves
  try {
    const u = new URL(url);
    return { slug: `${u.hostname}${u.pathname}`.replace(/\/+$/, ''), platform: u.hostname };
  } catch {
    return { slug: String(url || '?'), platform: '?' };
  }
}
export const gameName = (slug) => GAME_NAMES[slug] ?? slug;

// --- Per ghost -----------------------------------------------------------------------------------------------------

const toMs = (v) => (v == null ? null : typeof v === 'number' ? v : Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);

/**
 * Everything measured on one ghost. `fd` is what was read from its frames (measureGhost): fingerprints, the time each
 * frame was written, and how much each move changed the screen; null when the frames could not be read.
 */
export function ghostMetrics(trace, fd, { runStartMs = null, runWallS = null } = {}) {
  const steps = trace.steps ?? [];
  const frames = trace.frames ?? [];
  const startedMs = toMs(trace.startedAt);
  const endedMs = toMs(trace.endedAt);
  const wallOf = (i) => (Number.isInteger(i) && fd?.wall?.[i] != null ? fd.wall[i] : (toMs(frames[i]?.at) ?? null));
  const frame0Ms = wallOf(0);
  const gameFrameMs = fd?.firstGame != null ? wallOf(fd.firstGame) : frame0Ms;

  // Real time of each move: from the end of the one before (or the screen it decided on) to its own end. The end is the
  // step's `wallMs` (real ms since the ghost started, recorded since 24 Nov) or `at`, else the time its last frame was
  // written (0.03-0.35 s before wallMs on 24 Nov: the move's own checks come after its last frame).
  const endOf = (s) => (Number.isFinite(s.wallMs) && startedMs != null ? startedMs + s.wallMs : (toMs(s.at) ?? wallOf(s.frames?.[1])));
  const firstSeenMs = steps.length ? (wallOf(Math.max(0, (steps[0].frames?.[0] ?? 1) - 1)) ?? frame0Ms) : null;
  const stepWall = [];
  let prevEnd = null;
  for (const s of steps) {
    const end = endOf(s);
    const start = prevEnd ?? wallOf(Math.max(0, (s.frames?.[0] ?? 1) - 1)) ?? frame0Ms;
    stepWall.push(end != null && start != null ? Math.max(0, end - start) / 1000 : null);
    if (end != null) prevEnd = end;
  }

  const cats = steps.map(category);
  const kinds = steps.map((s) => inputKinds(s.move));
  const change = steps.map((_, k) => fd?.steps?.[k] ?? null);
  const moveMs = steps.map((s) => Math.max(0, (s.t1 ?? 0) - (s.t0 ?? 0)));
  const gameMs = trace.gameMs ?? moveMs.reduce((a, b) => a + b, 0);

  // Really playing: the ghost says it is in the game (and its thought does not say loading or a name screen), it used
  // an input, and the screen answered during the move. It starts playing at the first such move after which it stays
  // in the game: at least 2 of its next 3 moves are play or game over. Without that, intros that move by themselves
  // passed for play on Decogear: "a pink character appeared… let me try walking right" while the credits rolled.
  const realPlay = steps.map((s, k) => cats[k] === 'playing' && !kinds[k].wait && (change[k]?.maxFrac ?? 0) >= ANSWER_FRACTION);
  const stays = (k) => {
    const next = cats.slice(k + 1, k + 4);
    return next.filter((c) => BUCKET[c] === 'play' || BUCKET[c] === 'gameover').length >= Math.min(2, next.length);
  };
  const firstK = realPlay.findIndex((r, k) => r && stays(k));
  // When: the move number, the game time before it, and real seconds to its end from the start of the run (what a
  // person waiting sees) and from the ghost's own start.
  let play = null;
  if (firstK >= 0) {
    const s = steps[firstK];
    const end = endOf(s);
    const since = (from) => (end != null && from != null ? round((end - from) / 1000, 1) : null);
    play = { step: s.step, gameS: round((s.t0 ?? 0) / 1000, 1), wallS: since(runStartMs ?? startedMs), ghostS: since(startedMs) };
  }

  const counts = Object.fromEntries(Object.keys(LETTER).map((c) => [c, 0]));
  const buckets = { loading: 0, menu: 0, gameover: 0, play: 0 };
  let playMs = 0;
  cats.forEach((c, k) => {
    counts[c] += 1;
    buckets[BUCKET[c]] += 1;
    if (BUCKET[c] === 'play') playMs += moveMs[k];
  });

  // "Nothing happened" while the previous move did change the screen it saw before and after it, clearly (a mean grey
  // change of CHANGED_MEAN levels, as the first analysis): a share of changed cells would count the animated
  // backgrounds of Coiner or Backout, which change 1-5 % of the screen while nothing is pressed.
  const said = [];
  steps.forEach((s, k) => {
    if (k === 0 || !NOTHING_HAPPENED.test(s.thought ?? '')) return;
    const prev = change[k - 1];
    const changed = prev ? prev.endMean >= CHANGED_MEAN : null;
    const counted = cats[k] !== 'loading' && cats[k] !== 'level_complete';
    said.push({ step: s.step, changed: Boolean(changed && counted), mean: prev?.endMean ?? null, fraction: prev?.endFrac ?? null, thought: String(s.thought ?? '').slice(0, 120) });
  });

  // Screens: fingerprints every SAMPLE_MS of game time, novelty and stalls.
  const samples = fd?.fps ? sampleFrames(frames).map((i) => ({ t: frames[i]?.t ?? 0, fp: fd.fps[i] })) : [];
  const nov = fd?.fps ? novelty(samples) : null;
  const stallList = fd?.fps
    ? stalls(samples, { endMs: gameMs }).map((p) => {
        const inside = steps.filter((s) => (s.t1 ?? 0) > p.fromMs && (s.t0 ?? 0) < p.toMs).map((s) => s.step);
        return { fromS: round(p.fromMs / 1000, 1), toS: round(p.toMs / 1000, 1), s: round((p.toMs - p.fromMs) / 1000, 1), ...(p.open ? { open: true } : {}), steps: inside.length ? [inside[0], inside.at(-1)] : [] };
      })
    : null;

  const walls = stepWall.filter((v) => v != null);
  const lat = steps.map((s) => s.latencyMs).filter(Number.isFinite);
  const wallS = startedMs != null && endedMs != null ? round((endedMs - startedMs) / 1000, 1) : null;

  // Where the ghost's real time went: getting to the first screen it decided on (browser, page, the game loading, the
  // autopilot), the model's answers, the rest of its moves (playing the game: drawing it with its clock frozen,
  // screenshots, our own checks) and the end (exit interview, closing).
  let modelMs = 0;
  let movesS = 0;
  steps.forEach((s, k) => {
    if (stepWall[k] == null) return;
    movesS += stepWall[k];
    modelMs += Number.isFinite(s.latencyMs) ? s.latencyMs : 0;
  });
  const time = {
    startS: firstSeenMs != null && startedMs != null ? round((firstSeenMs - startedMs) / 1000, 1) : null,
    modelS: round(modelMs / 1000, 1),
    playS: round(Math.max(0, movesS - modelMs / 1000), 1),
    endS: prevEnd != null && endedMs != null ? round(Math.max(0, endedMs - prevEnd) / 1000, 1) : null,
  };
  return {
    persona: trace.persona,
    outcome: trace.outcome ?? null,
    ending: endingOf(trace.outcome, runWallS, trace.stopReason),
    ...(trace.error ? { error: { kind: trace.error.kind ?? null, message: String(trace.error.message ?? '').slice(0, 160) } } : {}),
    ...(trace.stopReason ? { stopReason: trace.stopReason } : {}),
    steps: steps.length,
    modelCalls: steps.filter((s) => s.usage || Number(s.latencyMs) > 0).length,
    gameS: round(gameMs / 1000, 1),
    wallS,
    bootS: frame0Ms != null && startedMs != null ? round((frame0Ms - startedMs) / 1000, 1) : null,
    firstFrameS: gameFrameMs != null && runStartMs != null ? round((gameFrameMs - runStartMs) / 1000, 1) : null, // the first frame that shows the game
    secPerMove: walls.length ? round(walls.reduce((a, b) => a + b, 0) / walls.length, 2) : null,
    secPerMoveMedian: walls.length ? round(median(walls), 2) : null,
    moveWallS: round(walls.reduce((a, b) => a + b, 0), 1),
    latencyS: lat.length ? round(lat.reduce((a, b) => a + b, 0) / lat.length / 1000, 2) : null,
    play,
    realPlayMoves: realPlay.filter(Boolean).length,
    categories: counts,
    buckets,
    playTimeShare: gameMs ? round(playMs / gameMs, 3) : null,
    timeline: cats.map((c) => LETTER[c]).join(''),
    screens: nov?.distinct ?? null,
    newScreensAt: nov ? nov.curve.map(([t]) => t) : null, // the novelty curve: the n-th new screen came at newScreensAt[n - 1] s
    stalls: stallList,
    stalledS: stallList ? round(stallList.reduce((a, p) => a + p.s, 0), 1) : null,
    saidNothing: said.length,
    falseNothing: said.filter((x) => x.changed).length,
    falseNothingThoughts: said.filter((x) => x.changed).map(({ changed, ...x }) => x),
    inputs: {
      mouse: kinds.filter((k) => k.mouse).length,
      keys: kinds.filter((k) => k.keys).length,
      both: kinds.filter((k) => k.mouse && k.keys).length,
      wait: kinds.filter((k) => k.wait).length,
    },
    quitStep: trace.outcome === 'quit' ? (steps.at(-1)?.step ?? null) : null,
    costUsd: traceCost ? round(traceCost(trace), 5) : null,
    movesGameS: round(moveMs.reduce((a, b) => a + b, 0) / 1000, 1), // game time of the moves (without the autopilot's)
    time,
    // The autopilot: game seconds it waited and, since 24 Nov, the real seconds it took.
    ...(trace.autopilot ? { autopilotS: round((trace.autopilot.waitedMs ?? 0) / 1000, 1) } : {}),
    ...(Number.isFinite(trace.autopilot?.wallMs) ? { autopilotWallS: round(trace.autopilot.wallMs / 1000, 1) } : {}),
    // The watchdog: from which game second the game was drawn with fewer frames, or ran on in real time.
    ...(trace.frameStepMs ? { fewerFrames: { stepMs: trace.frameStepMs, fromS: round((trace.frameStepFrom ?? 0) / 1000, 1) } } : {}),
    ...(Number.isFinite(trace.realTimeFrom) ? { realTimeFromS: round(trace.realTimeFrom / 1000, 1) } : {}),
    ...(trace.blockedNavigations ? { blockedNavigations: trace.blockedNavigations } : {}),
    ...(Number.isFinite(trace.screens) ? { screensByGhost: trace.screens } : {}),
    frames: frames.length,
    sampledFrames: samples.filter((x) => x.fp).length,
  };
}

// --- Reading frames (in worker threads: decoding JPEGs is the slow part) -------------------------------------------

/** The frames a move is judged on: the one the ghost decided on, and the first, middle and last of the move. */
export function moveFrames(step) {
  const [a, b] = step?.frames ?? [];
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a) return null;
  return { seen: Math.max(0, a - 1), during: [...new Set([a, a + Math.floor((b - a) / 2), b])], end: b };
}

/**
 * The first frame that shows the game: at least GAME_FRAME_SIZE of the median JPEG size of the ghost's frames. Black
 * and loading screens compress to far less: the first frame saved on itch.io games was often a 2-4 KB loading screen
 * (Broken Repair, Decogear on 22-23 Nov) where the game's own frames weigh 15-20 KB. Dark title screens of js13k games
 * count from the next frame, a second or two later.
 */
export function firstGameFrame(sizes) {
  const known = sizes.filter((s) => s > 0).sort((a, b) => a - b);
  if (!known.length) return null;
  const med = known[Math.floor(known.length / 2)];
  const i = sizes.findIndex((s) => s > 0 && s >= GAME_FRAME_SIZE * med);
  return i >= 0 ? i : null;
}

/**
 * Reads one ghost's frames: when each was written and its size, the fingerprints of the frames taken every SAMPLE_MS
 * of game time, and how much each move changed the screen (only those frames are decoded: decoding JPEGs is the slow
 * part).
 */
export async function measureGhost(gdir) {
  const trace = JSON.parse(await readFile(join(gdir, 'trace.json'), 'utf8'));
  const frames = trace.frames ?? [];
  const steps = trace.steps ?? [];
  const sampled = new Set(sampleFrames(frames));
  const moves = steps.map(moveFrames);
  const needGrid = new Set(moves.flatMap((m) => (m ? [m.seen, ...m.during] : [])));
  const fps = new Array(frames.length).fill(null);
  const wall = new Array(frames.length).fill(null);
  const sizes = new Array(frames.length).fill(0);
  const grids = new Map();
  const fileOf = (i) => (frames[i]?.file ? join(gdir, frames[i].file) : null);
  for (let k = 0; k < frames.length; k += 32) {
    await Promise.all(
      frames.slice(k, k + 32).map((_, j) =>
        fileOf(k + j)
          ? stat(fileOf(k + j)).then(
              (st) => {
                wall[k + j] = Math.round(st.mtimeMs);
                sizes[k + j] = st.size;
              },
              () => {},
            )
          : null,
      ),
    );
  }
  const todo = [...new Set([...sampled, ...needGrid])].filter((i) => fileOf(i)).sort((x, y) => x - y);
  // Read ahead in small batches (cold files can be slow to open, e.g. with an antivirus), decode one by one.
  for (let k = 0; k < todo.length; k += 12) {
    const batch = todo.slice(k, k + 12);
    const bufs = await Promise.all(batch.map((i) => readFile(fileOf(i)).catch(() => null)));
    batch.forEach((i, j) => {
      if (!bufs[j]) return;
      try {
        const img = decodeGray(bufs[j]);
        if (sampled.has(i)) fps[i] = fingerprint(img);
        if (needGrid.has(i)) grids.set(i, boxAverage(img, GRID_W, GRID_H));
      } catch {
        // a broken frame: measured as unknown
      }
    });
  }
  const changes = moves.map((m) => {
    if (!m) return null;
    const seen = grids.get(m.seen);
    const end = screenChange(seen, grids.get(m.end));
    if (!end) return null;
    let maxFrac = end.fraction;
    let maxMean = end.mean;
    for (const i of m.during) {
      const c = screenChange(seen, grids.get(i));
      if (c) {
        maxFrac = Math.max(maxFrac, c.fraction);
        maxMean = Math.max(maxMean, c.mean);
      }
    }
    return { endMean: round(end.mean, 2), endFrac: round(end.fraction, 4), maxMean: round(maxMean, 2), maxFrac: round(maxFrac, 4) };
  });
  return { n: frames.length, fps, wall, steps: changes, firstGame: firstGameFrame(sizes) };
}

if (!isMainThread && workerData?.realGamesWorker) {
  parentPort.on('message', async (job) => {
    try {
      parentPort.postMessage({ key: job.key, fd: await measureGhost(job.gdir) });
    } catch (err) {
      parentPort.postMessage({ key: job.key, error: err.message });
    }
  });
}

async function measureAll(jobs, { workers, cache, onProgress = () => {} }) {
  const out = new Map();
  const todo = [];
  for (const j of jobs) {
    const hit = cache?.get(j.cacheKey);
    if (hit) out.set(j.key, hit);
    else todo.push(j);
  }
  let done = 0;
  const finish = (j, fd) => {
    out.set(j.key, fd);
    if (fd) cache?.set(j.cacheKey, fd);
    onProgress(++done, todo.length);
  };
  if (workers <= 1) {
    for (const j of todo) finish(j, await measureGhost(j.gdir).catch(() => null));
    return out;
  }
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, todo.length) }, () => {
      const w = new Worker(new URL(import.meta.url), { workerData: { realGamesWorker: true } });
      let current = null;
      return new Promise((resolveP, reject) => {
        const feed = () => {
          if (next >= todo.length) return void w.terminate().then(resolveP, resolveP);
          current = todo[next++];
          w.postMessage({ key: current.key, gdir: current.gdir });
        };
        w.on('message', (m) => {
          finish(current, m.error ? null : m.fd);
          feed();
        });
        w.on('error', reject);
        feed();
      });
    }),
  );
  return out;
}

// --- Runs ----------------------------------------------------------------------------------------------------------

/** The time in a run id (2026-11-22T12-01-21-334Z-7a5a1afd2e), or null. */
export function idTime(id) {
  const m = String(id).match(/(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]) : null;
}

const isRunDir = (d) => existsSync(join(d, 'config.json'));
const subdirs = (d) => {
  try {
    return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(d, e.name));
  } catch {
    return [];
  }
};

/** Every run folder: runs/<id>/ and the runs of bench rounds (runs/bench-<label>-<time>/<variant>/). */
function allRunDirs(runsRoot) {
  const out = [];
  for (const d of subdirs(runsRoot)) {
    if (isRunDir(d)) out.push(d);
    else if (basename(d).startsWith('bench-')) out.push(...subdirs(d).filter(isRunDir));
  }
  return out;
}

function resolveSelector(sel, runsRoot, every) {
  for (const p of [sel, join(process.cwd(), sel), join(ROOT, sel), join(runsRoot, sel)]) {
    if (!isAbsolute(p) && p === sel) continue;
    if (existsSync(p) && statSync(p).isDirectory()) return isRunDir(p) ? [resolve(p)] : subdirs(p).filter(isRunDir).map((d) => resolve(d));
  }
  return every.filter((d) => basename(d) === sel || basename(d).endsWith(sel));
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function loadRun(dir) {
  const config = (await readJson(join(dir, 'config.json'))) ?? {};
  const report = await readJson(join(dir, 'report.json'));
  // A persona asked twice plays as "newbie" and "newbie-2" (src/swarm.mjs).
  const seen = {};
  const personas = config.personas?.length
    ? config.personas.map((p) => ((seen[p] = (seen[p] ?? 0) + 1) === 1 ? p : `${p}-${seen[p]}`))
    : subdirs(dir).map((d) => basename(d));
  const ghosts = [];
  for (const p of personas) {
    const gdir = join(dir, p);
    const tp = join(gdir, 'trace.json');
    if (!existsSync(tp)) continue;
    const trace = await readJson(tp);
    if (!trace) continue;
    const st = statSync(tp);
    ghosts.push({ persona: p, gdir, trace, cacheKey: `${resolve(tp)}|${Math.round(st.mtimeMs)}|${st.size}|v${ANALYSIS_VERSION}` });
  }
  // When the run really started: runs created together wait in the server's queue (six at once on 22 Nov, up to three
  // minutes), so the time in the id is when it was asked for. report.realMs runs from the start of the swarm to the end
  // of its ghosts, so the start is the last ghost's end minus realMs (0.1-0.2 s after the id's time when nothing waited).
  const id = basename(dir);
  const createdMs = idTime(id);
  const ends = ghosts.map((g) => toMs(g.trace.endedAt)).filter(Number.isFinite);
  const fromReport = Number.isFinite(report?.realMs) && ends.length ? Math.max(...ends) - report.realMs : null;
  const firstStart = Math.min(...ghosts.map((g) => toMs(g.trace.startedAt)).filter(Number.isFinite), Infinity);
  const startMs = fromReport != null ? Math.max(createdMs ?? -Infinity, fromReport) : (createdMs ?? (Number.isFinite(firstStart) ? firstStart : null));
  // When the report was ready: report.json is written after the last ghost, when the analyst has answered. Its creation
  // time, as a report can be written again later (NILO, 21 Nov: four minutes after its run).
  let reportMs = null;
  try {
    const st = statSync(join(dir, 'report.json'));
    reportMs = Math.min(st.birthtimeMs > 0 ? st.birthtimeMs : Infinity, st.mtimeMs);
  } catch {
    // no report: the run was stopped or is still being played
  }
  return { dir, id, config, report, reportMs, ghosts, createdMs, startMs, missing: personas.length - ghosts.length };
}

function runMetrics(run, fds) {
  const { slug, platform } = gameOf(run.config.url ?? run.ghosts[0]?.trace.url);
  const ends = run.ghosts.map((g) => toMs(g.trace.endedAt)).filter(Number.isFinite);
  const wallS = run.report?.realMs != null ? round(run.report.realMs / 1000, 2) : ends.length && run.startMs != null ? round((Math.max(...ends) - run.startMs) / 1000, 2) : null;
  const ghosts = run.ghosts.map((g) => ghostMetrics(g.trace, fds.get(g.cacheKey) ?? null, { runStartMs: run.startMs, runWallS: wallS }));
  const ghostCost = ghosts.reduce((a, g) => a + (g.costUsd ?? 0), 0);
  // The first frame of a ghost that got to play (one refused at a blank screen saved only that screen).
  const players = ghosts.some((g) => g.steps > 0) ? ghosts.filter((g) => g.steps > 0) : ghosts;
  const firstFrames = players.map((g) => g.firstFrameS).filter((v) => v != null);
  // The wait for the report after the last ghost (the analyst's answer, not in realMs). A report written much later
  // than its run (made again) says nothing about it.
  const reportAfter = run.reportMs != null && ends.length ? (run.reportMs - Math.max(...ends)) / 1000 : null;
  return {
    id: run.id,
    path: relative(ROOT, run.dir).replaceAll('\\', '/'),
    game: slug,
    name: gameName(slug),
    platform,
    url: run.config.url ?? null,
    ...(run.config.playUrl ? { playUrl: run.config.playUrl } : {}),
    startedAt: run.startMs != null ? new Date(run.startMs).toISOString() : null,
    ...(run.createdMs != null && run.startMs - run.createdMs >= 1000 ? { queuedS: round((run.startMs - run.createdMs) / 1000, 1) } : {}),
    viewport: run.config.viewport ?? null,
    maxSteps: run.config.steps ?? null,
    ...(run.config.playSeconds ? { playSeconds: run.config.playSeconds } : {}),
    wallS,
    ...(reportAfter != null && reportAfter >= 0 && reportAfter <= 600 ? { reportAfterS: round(reportAfter, 1) } : {}),
    firstFrameS: firstFrames.length ? Math.min(...firstFrames) : null,
    costUsd: round(run.report?.cost?.total ?? ghostCost, 4),
    costFrom: run.report?.cost?.total != null ? 'report' : 'traces',
    ...(run.report?.failure ? { failure: run.report.failure } : {}),
    ...(run.missing ? { missingTraces: run.missing } : {}),
    ghosts,
  };
}

// --- Summaries -----------------------------------------------------------------------------------------------------

/** One line of the tables: every run given pooled (moves, ghosts, game time). */
export function summarize(runs) {
  const ghosts = runs.flatMap((r) => r.ghosts);
  const moved = ghosts.filter((g) => g.steps > 0);
  const moves = moved.reduce((a, g) => a + g.steps, 0);
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
  const bucket = (k) => moved.reduce((a, g) => a + g.buckets[k], 0);
  const reached = moved.filter((g) => g.play);
  const withScreens = moved.filter((g) => g.screens != null);
  const gameMsAll = moved.reduce((a, g) => a + g.gameS * 1000, 0);
  const playMs = moved.reduce((a, g) => a + (g.playTimeShare ?? 0) * g.gameS * 1000, 0);
  const wallMoves = moved.reduce((a, g) => a + (g.moveWallS ?? 0), 0);
  const endings = {};
  for (const g of ghosts) endings[g.ending] = (endings[g.ending] ?? 0) + 1;
  const stalled = withScreens.filter((g) => g.stalls?.length);
  // Runs where no ghost got to move (the game did not start) end in seconds: they are counted as errors, not lengths.
  const runWalls = runs.filter((r) => r.ghosts.some((g) => g.steps > 0)).map((r) => r.wallS).filter((v) => v != null);
  const firstFrames = runs.map((r) => r.firstFrameS).filter((v) => v != null);
  // Where the real time went, pooled over the ghosts that moved (a long ghost weighs more, as it holds its run longer).
  const timed = moved.filter((g) => g.wallS != null && g.gameS > 0);
  const sumOf = (xs, f) => xs.reduce((a, x) => a + (f(x) ?? 0), 0);
  const wallAll = sumOf(timed, (g) => g.wallS);
  const share = (k) => (wallAll ? Math.round((100 * sumOf(timed, (g) => g.time?.[k])) / wallAll) : null);
  const calls = sumOf(moved, (g) => g.modelCalls);
  const autopilots = moved.map((g) => g.autopilotWallS).filter((v) => v != null);
  const reportWaits = runs.map((r) => r.reportAfterS).filter((v) => v != null);
  return {
    runs: runs.length,
    ghosts: ghosts.length,
    moved: moved.length,
    moves,
    runWallS: runWalls.length ? { min: Math.min(...runWalls), median: median(runWalls), max: Math.max(...runWalls) } : null,
    firstFrameS: firstFrames.length ? { median: median(firstFrames), max: Math.max(...firstFrames) } : null,
    secPerMove: moves ? round(wallMoves / moves, 2) : null,
    gameS: moved.length ? { median: round(median(moved.map((g) => g.gameS)), 1), max: Math.max(...moved.map((g) => g.gameS)) } : null,
    reached: reached.length,
    reachedWallS: reached.length && reached.some((g) => g.play.wallS != null) ? round(median(reached.map((g) => g.play.wallS).filter((v) => v != null)), 1) : null,
    reachedGameS: reached.length ? round(median(reached.map((g) => g.play.gameS)), 1) : null,
    reachedStep: reached.length ? median(reached.map((g) => g.play.step)) : null,
    pct: { loading: pct(bucket('loading'), moves), menu: pct(bucket('menu'), moves), gameover: pct(bucket('gameover'), moves), play: pct(bucket('play'), moves) },
    playTimePct: gameMsAll ? Math.round((100 * playMs) / gameMsAll) : null,
    screens: withScreens.length ? { median: median(withScreens.map((g) => g.screens)), max: Math.max(...withScreens.map((g) => g.screens)) } : null,
    stalled: {
      ghosts: stalled.length,
      of: withScreens.length,
      medianS: stalled.length ? round(median(stalled.map((g) => g.stalledS)), 1) : null,
      totalS: round(withScreens.reduce((a, g) => a + (g.stalledS ?? 0), 0), 1),
      // share of the game time spent in stalls: comparable between 25 s and 150 s games
      pct: withScreens.length ? Math.round((100 * withScreens.reduce((a, g) => a + (g.stalledS ?? 0), 0)) / Math.max(1e-9, withScreens.reduce((a, g) => a + g.gameS, 0))) : null,
    },
    saidNothing: moved.reduce((a, g) => a + g.saidNothing, 0),
    falseNothing: moved.reduce((a, g) => a + g.falseNothing, 0),
    mousePct: pct(moved.reduce((a, g) => a + g.inputs.mouse, 0), moves),
    keysPct: pct(moved.reduce((a, g) => a + g.inputs.keys, 0), moves),
    waitPct: pct(moved.reduce((a, g) => a + g.inputs.wait, 0), moves),
    endings,
    quit: ghosts.filter((g) => g.ending === 'A').length,
    errors: ghosts.filter((g) => g.ending === 'E').length,
    costUsd: round(runs.reduce((a, r) => a + (r.costUsd ?? 0), 0), 4),
    speed: {
      ghostWallS: timed.length ? round(median(timed.map((g) => g.wallS)), 0) : null,
      realPerGameS: wallAll ? round(wallAll / sumOf(timed, (g) => g.gameS), 2) : null,
      calls: moved.length ? median(moved.map((g) => g.modelCalls)) : null,
      gamePerCall: calls ? round(sumOf(moved, (g) => g.movesGameS) / calls, 2) : null,
      split: { start: share('startS'), model: share('modelS'), play: share('playS'), end: share('endS') },
      autopilotWallS: autopilots.length ? round(median(autopilots), 1) : null,
      fewerFrames: moved.filter((g) => g.fewerFrames).length,
      realTime: moved.filter((g) => g.realTimeFromS != null).length,
      reportAfterS: reportWaits.length ? { median: round(median(reportWaits), 1), max: Math.max(...reportWaits) } : null,
    },
  };
}

function byGame(runs) {
  const map = new Map();
  for (const r of runs) map.set(r.game, [...(map.get(r.game) ?? []), r]);
  const rank = (g) => (GAME_ORDER.includes(g) ? GAME_ORDER.indexOf(g) : GAME_ORDER.length);
  return [...map].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])).map(([game, rs]) => ({ game, name: gameName(game), platform: rs[0].platform, runs: rs }));
}

/** False "nothing happened" thoughts per 100 moves (each move is one decision of the model). */
const falsePer100 = (s) => (s?.moves ? (100 * s.falseNothing) / s.moves : null);

/** The measurable targets of rediseno/PLAN-V3.md section 2 that these runs can answer (`prev`: --compare). */
export function criteria(games, total, prev = null) {
  // Runs where no ghost got to move are left out (their first frame was a blank screen; they count as errors).
  const runsOf = (p) => games.filter((g) => g.platform === p).flatMap((g) => g.runs).filter((r) => r.ghosts.some((g) => g.steps > 0));
  const firstFrame = (p) => runsOf(p).map((r) => r.firstFrameS).filter((v) => v != null);
  // Runs of 4 ghosts that got to play at all (a run that fails to start ends in a second or two).
  const runWall = (p) => runsOf(p).filter((r) => r.ghosts.length === 4 && r.ghosts.some((g) => g.steps > 0)).map((r) => r.wallS).filter((v) => v != null);
  const fmtRange = (xs) => (xs.length ? `median ${fmt(median(xs), 0)} s, max ${fmt(Math.max(...xs), 0)} s (${xs.length} runs)` : 'no runs');
  const played = games.filter((g) => g.summary.moved && g.summary.reached / g.summary.moved >= 0.5);
  const mouse = games.filter((g) => MOUSE_GAMES.has(g.game));
  const mouseMoves = mouse.reduce((a, g) => a + g.summary.moves, 0);
  const mouseClicks = mouse.reduce((a, g) => a + g.runs.flatMap((r) => r.ghosts).reduce((b, x) => b + x.inputs.mouse, 0), 0);
  const now = falsePer100(total);
  const was = falsePer100(prev);
  const change = now != null && was ? ` (${prev.label ?? 'before'}: ${fmt(was)}, ${now <= was ? '−' : '+'}${Math.round((100 * Math.abs(now - was)) / was)} %)` : '';
  return [
    { criterion: 'Ghosts that end in an error', measured: `${total.errors} of ${total.ghosts}`, target: '0' },
    { criterion: 'Time until the first game frame (from the start of the run)', measured: `itch.io: ${fmtRange(firstFrame('itch.io'))} · js13k: ${fmtRange(firstFrame('js13k'))}`, target: '≤ 15 s itch.io, ≤ 8 s js13k' },
    { criterion: 'Game time per ghost', measured: total.gameS ? `median ${fmt(total.gameS.median)} s, max ${fmt(total.gameS.max)} s` : '–', target: '≥ 120 s' },
    { criterion: 'Length of a run of 4 ghosts', measured: `itch.io (WebGL): ${fmtRange(runWall('itch.io'))} · js13k: ${fmtRange(runWall('js13k'))}`, target: '≤ 300 s WebGL, ≤ 210 s js13k' },
    { criterion: 'Real games where they reach play (at least half of the ghosts that moved)', measured: `${played.length} of ${games.length}${played.length < games.length ? ` (not: ${games.filter((g) => !played.includes(g)).map((g) => g.name).join(', ')})` : ''}`, target: '≥ 11 of 13' },
    { criterion: '"Nothing happened" thoughts while the screen did change', measured: `${total.falseNothing} of ${total.saidNothing} such thoughts; ${fmt(now)} per 100 moves${change}`, target: '−70 %' },
    { criterion: 'Clicks in the mouse games (Big Champ, Coiner)', measured: mouseMoves ? `${Math.round((100 * mouseClicks) / mouseMoves)} % of ${mouseMoves} moves` : 'not measured', target: '≥ 60 %' },
  ];
}

// --- Markdown ------------------------------------------------------------------------------------------------------

function fmt(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return '–';
  return Number(v).toFixed(digits).replace(/\.0+$/, '');
}
const endingsText = (e) =>
  Object.entries(e)
    .sort((a, b) => (ENDINGS_ORDER.indexOf(a[0]) + 99) % 99 - (ENDINGS_ORDER.indexOf(b[0]) + 99) % 99 || b[1] - a[1])
    .map(([k, n]) => `${n}${k}`)
    .join(' ');
const pctText = (p) => [p.loading, p.menu, p.gameover, p.play].map((v) => (v == null ? '–' : v)).join(' · ');

/** New screens per 5 s of game time, averaged over the ghosts, as a sparkline. */
export function sparkline(ghosts, bucketS = 5) {
  const curves = ghosts.filter((g) => g.newScreensAt?.length);
  if (!curves.length) return '';
  const len = Math.max(...ghosts.map((g) => g.gameS ?? 0));
  const n = Math.max(1, Math.ceil(len / bucketS));
  const sums = new Array(n).fill(0);
  const alive = new Array(n).fill(0);
  for (const g of curves) {
    for (let b = 0; b < n; b++) if ((g.gameS ?? 0) > b * bucketS) alive[b] += 1;
    for (const t of g.newScreensAt) sums[Math.min(n - 1, Math.floor(t / bucketS))] += 1;
  }
  const means = sums.map((s, b) => (alive[b] ? s / alive[b] : 0));
  const top = Math.max(...means, 1);
  const bars = '▁▂▃▄▅▆▇█';
  return means.map((m) => (m <= 0 ? '·' : bars[Math.min(7, Math.floor((m / top) * 7.999))])).join('');
}

function summaryRow(name, s, extra = '') {
  return [
    name + extra,
    s.runs,
    s.moved === s.ghosts ? s.ghosts : `${s.moved}/${s.ghosts}`,
    s.runWallS ? (s.runWallS.min === s.runWallS.max ? fmt(s.runWallS.min, 0) : `${fmt(s.runWallS.min, 0)}–${fmt(s.runWallS.max, 0)}`) : '–',
    fmt(s.secPerMove),
    s.gameS ? `${fmt(s.gameS.median, 0)} / ${fmt(s.gameS.max, 0)}` : '–',
    s.moved ? `${s.reached ? `${fmt(s.reachedWallS, 0)} s` : 'never'} (${s.reached}/${s.moved})` : '–',
    pctText(s.pct),
    s.playTimePct == null ? '–' : s.playTimePct,
    s.screens ? `${fmt(s.screens.median, 0)} / ${s.screens.max}` : '–',
    s.stalled.of ? `${s.stalled.ghosts}/${s.stalled.of}${s.stalled.ghosts ? ` · ${s.stalled.pct} %` : ''}` : '–',
    `${s.falseNothing} / ${s.saidNothing}`,
    s.moves ? `${s.mousePct} · ${s.keysPct}` : '–',
    endingsText(s.endings) || '–',
    `$${s.costUsd.toFixed(3)}`,
  ];
}

const SUMMARY_HEAD = [
  'Game',
  'Runs',
  'Ghosts',
  'Run length (s)',
  'Real s per move',
  'Game s per ghost (median / max)',
  'Reached real play: median s (ghosts)',
  'Moves % loading · menu · game over · play',
  '% of game time playing',
  'Distinct screens per ghost (median / max)',
  'Stalls ≥ 10 s: ghosts · % of game time',
  'False / all "nothing happened"',
  '% moves click · keys',
  'Endings',
  'Cost',
];

const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const SPEED_HEAD = [
  'Game',
  'Ghosts',
  'Run length (s)',
  'Report after the last ghost (s)',
  'Real s per ghost (median)',
  'Game s per ghost (median)',
  'Real s per game s',
  'Model answers per ghost (median)',
  'Game s per answer',
  '% of real time: start · model · playing · end',
  'Autopilot real s (median)',
  'Ghosts drawing fewer frames · in real time',
];

function speedRow(name, s) {
  const p = s.speed ?? {};
  const range = (r, f = (v) => fmt(v, 0)) => (!r ? '–' : r.min != null ? (r.min === r.max ? f(r.min) : `${f(r.min)}–${f(r.max)}`) : r.median === r.max ? f(r.median) : `${f(r.median)} (max ${f(r.max)})`);
  return [
    name,
    s.moved === s.ghosts ? s.ghosts : `${s.moved}/${s.ghosts}`,
    range(s.runWallS),
    range(p.reportAfterS),
    fmt(p.ghostWallS, 0),
    s.gameS ? fmt(s.gameS.median, 0) : '–',
    fmt(p.realPerGameS, 2),
    fmt(p.calls, 0),
    fmt(p.gamePerCall, 2),
    p.split ? [p.split.start, p.split.model, p.split.play, p.split.end].map((v) => (v == null ? '–' : v)).join(' · ') : '–',
    fmt(p.autopilotWallS),
    `${p.fewerFrames ?? '–'} · ${p.realTime ?? '–'}`,
  ];
}

function runRow(r) {
  const moved = r.ghosts.filter((g) => g.steps > 0);
  const s = summarize([r]);
  const when = r.startedAt ? `${r.startedAt.slice(8, 10)}-${r.startedAt.slice(5, 7)} ${r.startedAt.slice(11, 16)}` : '';
  const short = r.id.length > 12 ? r.id.slice(-10) : r.id;
  const stalls = moved.flatMap((g) => g.stalls ?? []);
  const perGhost = (f) => (moved.length ? r.ghosts.map((g) => (g.steps > 0 ? f(g) : '–')).join(' · ') : '–');
  return [
    `${short} (${when})`,
    fmt(r.wallS, 0),
    fmt(r.firstFrameS, 0),
    fmt(s.secPerMove),
    perGhost((g) => fmt(g.gameS, 0)),
    perGhost((g) => (g.play ? fmt(g.play.wallS, 0) : '✗')),
    pctText(s.pct),
    perGhost((g) => g.screens ?? '?'),
    sparkline(moved) || '–',
    stalls.length ? `${stalls.length} · ${fmt(stalls.reduce((a, p) => a + p.s, 0), 0)} s` : '0',
    `${s.falseNothing} / ${s.saidNothing}`,
    s.moves ? `${s.mousePct} · ${s.keysPct}` : '–',
    (r.ghosts.map((g) => g.ending).join('') || '–') + (r.failure ? ` (${r.failure.kind})` : r.missingTraces ? ` (${r.missingTraces} without trace)` : ''),
    `$${(r.costUsd ?? 0).toFixed(3)}`,
  ];
}

const RUN_HEAD = [
  'Run (day-month time, UTC)',
  'Length s',
  'First frame s',
  'Real s per move',
  'Game s per ghost',
  'Reached real play (real s per ghost)',
  'Moves % loading · menu · game over · play',
  'Distinct screens per ghost',
  'New screens every 5 s',
  'Stalls · total',
  'False / all "nothing happened"',
  '% click · keys',
  'Endings',
  'Cost',
];

function compareSection(prev, games, total) {
  const pg = new Map((prev.games ?? []).map((g) => [g.game, g.summary]));
  const arrow = (a, b, f = (v) => fmt(v, 0)) => `${a == null ? '–' : f(a)} → ${b == null ? '–' : f(b)}`;
  const share = (s) => (s?.moved ? Math.round((100 * s.reached) / s.moved) : null);
  const rows = [...games.map((g) => [g.name, g.summary, pg.get(g.game)]), ['**Total**', total, prev.total]].map(([name, now, was]) => [
    name,
    arrow(share(was), share(now), (v) => `${v} %`),
    arrow(was?.reachedWallS, now?.reachedWallS),
    arrow(was?.gameS?.median, now?.gameS?.median),
    arrow(was?.pct?.play, now?.pct?.play),
    arrow(was?.screens?.median, now?.screens?.median),
    arrow(was?.stalled?.pct, now?.stalled?.pct, (v) => `${v} %`),
    arrow(falsePer100(was), falsePer100(now), (v) => fmt(v, 1)),
    arrow(was?.mousePct, now?.mousePct),
    arrow(was?.runWallS?.median, now?.runWallS?.median),
  ]);
  const speedRows = [...games.map((g) => [g.name, g.summary, pg.get(g.game)]), ['**Total**', total, prev.total]].map(([name, now, was]) => [
    name,
    arrow(was?.runWallS?.median, now?.runWallS?.median),
    arrow(was?.speed?.ghostWallS, now?.speed?.ghostWallS),
    arrow(was?.gameS?.median, now?.gameS?.median),
    arrow(was?.speed?.realPerGameS, now?.speed?.realPerGameS, (v) => fmt(v, 2)),
    arrow(was?.speed?.gamePerCall, now?.speed?.gamePerCall, (v) => fmt(v, 2)),
    arrow(was?.speed?.split?.model, now?.speed?.split?.model, (v) => `${v} %`),
    arrow(was?.speed?.reportAfterS?.median, now?.speed?.reportAfterS?.median),
  ]);
  return [
    `## Compared with \`${prev.label}\``,
    '',
    `Before → now, for the games measured now. ${prev.label}: ${prev.total?.runs ?? '?'} runs, ${prev.total?.ghosts ?? '?'} ghosts on ${prev.games?.length ?? '?'} games; now: ${total.runs} runs, ${total.ghosts} ghosts on ${games.length} games.${(prev.games?.length ?? 0) !== games.length ? ' The totals cover different games: compare game by game.' : ''}`,
    '',
    table(['Game', 'Ghosts that reached play', 'Reached play (median real s)', 'Game s per ghost (median)', '% moves playing', 'Distinct screens (median)', '% of game time in stalls', 'False "nothing happened" per 100 moves', '% moves with a click', 'Run length (median s)'], rows),
    '',
    'Real time, before → now:',
    '',
    table(['Game', 'Run length (median s)', 'Real s per ghost (median)', 'Game s per ghost (median)', 'Real s per game s', 'Game s per model answer', '% of real time waiting for the model', 'Report after the last ghost (median s)'], speedRows),
    '',
  ];
}

export function renderMarkdown(result) {
  const { label, games, total } = result;
  const out = [
    `# Real jam games — ${label}`,
    '',
    `${total.runs} runs, ${total.ghosts} ghosts, ${total.moves} moves on ${games.length} games, measured from the recorded runs with no AI (\`${result.command}\`, ${result.generatedAt.slice(0, 16).replace('T', ' ')} UTC). How each number is measured: [below](#how-it-is-measured).`,
    '',
    '## By game',
    '',
    table(SUMMARY_HEAD, [...games.map((g) => summaryRow(g.name, g.summary)), summaryRow('**Total**', total)]),
    '',
    `Endings: ${ENDINGS_LEGEND}. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).`,
    '',
    '## Targets of rediseno/PLAN-V3.md, section 2',
    '',
    table(['Criterion', 'Measured', 'Target'], result.criteria.map((c) => [c.criterion, c.measured, c.target])),
    '',
    '## Where the real time goes',
    '',
    table(SPEED_HEAD, [...games.map((g) => speedRow(g.name, g.summary)), speedRow('**Total**', total)]),
    '',
    'A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).',
    '',
  ];
  for (const prev of result.compares ?? (result.compare ? [result.compare] : [])) out.push(...compareSection(prev, games, total));
  for (const g of games) {
    out.push(`## ${g.name}`, '', `${g.platform} · ${g.runs[0].url ?? ''}`, '', table(RUN_HEAD, g.runs.map(runRow)), '');
  }
  out.push(
    '## How it is measured',
    '',
    '- **Run length**: the real time of the run (`report.json` realMs): from opening the browser to the last ghost\'s end, without the wait in the queue or the report. **First frame**: from the run really starting to the first frame, of any ghost, that shows the game (its JPEG weighs at least half the median of that ghost\'s frames: black and loading screens weigh far less, so a 2 KB loading screen saved after 2 s does not count). A run starts when it leaves the server\'s queue (runs asked for together wait for each other): the last ghost\'s end minus realMs.',
    `- **Real s per move**: per move, from the end of the move before (or the screen it decided on) to its last frame being written: thinking plus playing plus our own overhead. Taken from each step's \`at\` when the trace has it, else from the time each frame file was written.`,
    '- **Game s**: `trace.gameMs`, the game time each ghost played (the game clock stands still while the model thinks).',
    `- **Reached real play**: the first move where the ghost says it is playing (\`saw: playing\`, and its thought does not speak of loading or a name screen), used an input, the screen answered (at least ${fmt(ANSWER_FRACTION * 100, 1)} % of a ${GRID_W}×${GRID_H} grey grid changed by more than ${CELL_DELTA} levels during the move), and it stayed in the game (at least 2 of its next 3 moves are play or game over: intros that move by themselves do not count). Shown as real seconds from the start of the run to the end of that move (per run: one value per ghost, ✗ = never, – = did not move).`,
    '- **Moves %**: what the ghost said it saw, refined by its thought (the categories of `rediseno/v3/real-games/analyze_runs.py`): loading = loading, black screens and intros that play by themselves; menu = menus, title and name screens and anything else that is not the game; game over = it saw itself die or a game-over screen; play = playing or level complete. **% of game time playing**: the same, weighted by each move\'s game time.',
    `- **Distinct screens**: a fingerprint of the frame every ${SAMPLE_MS / 1000} s of game time, as Go-Explore's cells (the frame in grey shrunk to ${FP_W}×${FP_H}, ${FP_LEVELS} levels); the number of different fingerprints a ghost saw. The character moving to a new place makes a new fingerprint, as in Go-Explore; so do animations, which inflate the count on busy screens. **New screens every 5 s**: the novelty curve, averaged over the ghosts of the run. **Stall**: at least ${STALL_MS / 1000} s of game time without a fingerprint never seen before (also at the end of the game); the tables give the ghosts with at least one, and the share of all the game time spent in stalls (longer games have more room for them, so compare shares).`,
    `- **False "nothing happened"**: thoughts saying the last input did nothing (the regular expression of \`rediseno/v3/real-games/modes.py\`) while that move clearly changed the screen the ghost saw before and after it (mean grey change ≥ ${CHANGED_MEAN} levels on the grid, as the first analysis: a new screen, the view scrolling, something big moving), not counting loading screens. Smaller changes (a cursor, an animated background) are not counted, so this is a floor. "All" is every such thought, true or not (the first move of each ghost is left out, as before).`,
    '- **% click · keys**: moves with a click or drag, and moves with keys (a move can have both, also among the actions it chained after its first; the rest were waits).',
    '- **Where the real time goes**: per ghost, from its start (`startedAt`) to its end (`endedAt`), split in start (to the first screen it decided on), model (each move\'s `latencyMs`), playing (the rest of each move\'s real time) and end (after its last move); shares of the real time of all the ghosts. **Real s per game s**: their real time over their game time (`trace.gameMs`, with the autopilot\'s). **Game s per answer**: the game time of their moves over the model\'s answers. **Report after the last ghost**: from the last ghost\'s end to `report.json` being written (the analyst; not in the run length). **Autopilot real s**: `trace.autopilot.wallMs` (recorded since 24 Nov). **Fewer frames · real time**: ghosts the watchdog moved to drawing fewer frames (`frameStepMs`), or to playing on in real time (`realTimeFrom`).',
    '- **Endings**: `trace.outcome` as one letter; a ghost stopped by its own real-time budget is L even when the trace says time_up (`stopReason.kind` wall_time: it had played at least 60 s, not all its game time).',
    '- **Cost**: the run\'s `report.json` cost (ghosts and analyst); priced from the traces when there is no report.',
    '',
  );
  return out.join('\n');
}

// --- Helpers and CLI -----------------------------------------------------------------------------------------------

function round(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
export function median(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

let traceCost = null;
try {
  ({ traceCost } = await import('../src/brains/prices.mjs'));
} catch {
  // without prices, costs come from report.json only
}

export function parseArgs(argv) {
  const out = { label: null, selectors: [], urls: [], since: null, until: null, compare: [], workers: null, runs: null, cache: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--url') out.urls.push(...value().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--since') out.since = value();
    else if (a === '--until') out.until = value();
    else if (a === '--compare') out.compare.push(...value().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--workers') out.workers = Number(value());
    else if (a === '--runs') out.runs = value();
    else if (a === '--cache') out.cache = value();
    else if (a === '--out') out.out = value();
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
    else if (!out.label) out.label = a;
    else out.selectors.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.label || (!args.selectors.length && !args.urls.length)) {
    console.error('Usage: node bench/real-games.mjs <label> <runId | run dir | --url pattern>... [--since ISO] [--until ISO] [--compare <label>] [--workers N]');
    process.exit(1);
  }
  if (!/^[\w.-]+$/.test(args.label)) throw new Error('The label may only have letters, digits, "-", "_" and "."');
  const runsRoot = resolve(args.runs ?? join(ROOT, 'runs'));
  const every = allRunDirs(runsRoot);
  const chosen = new Set();
  for (const sel of args.selectors) {
    const found = resolveSelector(sel, runsRoot, every);
    if (!found.length) throw new Error(`No run matches "${sel}" in ${runsRoot}`);
    found.forEach((d) => chosen.add(resolve(d)));
  }
  if (args.urls.length) {
    for (const d of every) {
      const cfg = await readJson(join(d, 'config.json'));
      const where = `${cfg?.url ?? ''} ${cfg?.playUrl ?? ''}`.toLowerCase();
      if (args.urls.some((u) => where.includes(u.toLowerCase()))) chosen.add(resolve(d));
    }
  }
  const since = args.since ? toMs(args.since) : null;
  const until = args.until ? toMs(args.until) : null;
  if ((args.since && since == null) || (args.until && until == null)) throw new Error('--since/--until take a date such as 2026-11-24T00:00Z');
  let runs = await Promise.all([...chosen].map(loadRun));
  const asked = (r) => r.createdMs ?? r.startMs ?? 0; // the time in the folder name, when there is one
  runs = runs.filter((r) => (since == null || asked(r) >= since) && (until == null || asked(r) < until));
  runs.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0) || a.id.localeCompare(b.id));
  // A run still being played has no traces yet (they are written when each ghost ends).
  const empty = runs.filter((r) => !r.ghosts.length);
  if (empty.length) console.log(`Skipped ${empty.length} run${empty.length === 1 ? '' : 's'} without traces (still running?): ${empty.map((r) => r.id).join(', ')}`);
  runs = runs.filter((r) => r.ghosts.length);
  if (!runs.length) throw new Error('No runs left to measure.');

  const cachePath = args.cache ? resolve(args.cache) : null;
  const cacheObj = cachePath ? ((await readJson(cachePath)) ?? {}) : null;
  const cache = cacheObj ? { get: (k) => cacheObj[k], set: (k, v) => (cacheObj[k] = v) } : null;
  const jobs = runs.flatMap((r) => r.ghosts.map((g) => ({ key: g.cacheKey, cacheKey: g.cacheKey, gdir: g.gdir })));
  const workers = Math.max(1, Math.min(args.workers ?? Math.max(1, Math.min(8, availableParallelism() - 2)), jobs.length));
  console.log(`Measuring ${runs.length} runs, ${jobs.length} ghosts (${workers} worker${workers === 1 ? '' : 's'})…`);
  const t0 = Date.now();
  let shown = 0;
  const fds = await measureAll(jobs, {
    workers,
    cache,
    onProgress: (done, all) => {
      const pctDone = Math.floor((100 * done) / all);
      if (pctDone >= shown + 10 || done === all) {
        shown = pctDone;
        process.stdout.write(`  ${done}/${all} ghosts read (${Math.round((Date.now() - t0) / 1000)} s)\n`);
      }
    },
  });
  if (cachePath) await writeFile(cachePath, JSON.stringify(cacheObj));

  const measured = runs.map((r) => runMetrics(r, fds));
  const games = byGame(measured).map((g) => ({ ...g, summary: summarize(g.runs) }));
  const total = summarize(measured);
  // The command that gives these numbers (where the files go, the workers and the cache do not change them).
  const quiet = ['--cache', '--workers', '--out'];
  const cmdArgs = process.argv.slice(2).filter((a, i, all) => !quiet.includes(a) && !quiet.includes(all[i - 1]));
  const command = `node bench/real-games.mjs ${cmdArgs.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`;
  const result = {
    label: args.label,
    generatedAt: new Date().toISOString(),
    command,
    settings: { FP_W, FP_H, FP_LEVELS, GRID_W, GRID_H, CELL_DELTA, CHANGED_MEAN, ANSWER_FRACTION, SAMPLE_MS, STALL_MS, LIMIT_WALL_S, analysisVersion: ANALYSIS_VERSION },
    total,
    criteria: null,
    games: games.map((g) => ({ game: g.game, name: g.name, platform: g.platform, summary: g.summary })),
    runs: measured,
  };
  if (args.compare.length) {
    result.compares = [];
    for (const label of args.compare) {
      const prev = await readJson(join(ROOT, 'bench', 'results', `real-${label}.json`));
      if (!prev) throw new Error(`bench/results/real-${label}.json not found`);
      result.compares.push({ label: prev.label, total: prev.total, games: prev.games });
    }
  }
  const baseline = result.compares?.[0]; // the targets are measured against the first one
  result.criteria = criteria(games, total, baseline ? { ...baseline.total, label: baseline.label } : null);
  const outDir = args.out ? resolve(args.out) : join(ROOT, 'bench', 'results');
  await mkdir(outDir, { recursive: true });
  const md = renderMarkdown({ ...result, games });
  await writeFile(join(outDir, `real-${args.label}.md`), md);
  // One line per ghost and per array of numbers, so the file stays small and still readable.
  const lines = [];
  const json = JSON.stringify(result, (k, v) => (v && typeof v === 'object' && typeof v.timeline === 'string' && v.persona !== undefined ? `@ghost${lines.push(JSON.stringify(v)) - 1}@` : v), 1)
    .replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (m, inner) => `[${inner.replace(/\s+/g, '')}]`)
    .replace(/"@ghost(\d+)@"/g, (m, i) => lines[Number(i)]);
  await writeFile(join(outDir, `real-${args.label}.json`), json);
  console.log(`\n${table(SUMMARY_HEAD, [...games.map((g) => summaryRow(g.name, g.summary)), summaryRow('Total', total)])}\n`);
  const shownPath = relative(process.cwd(), join(outDir, `real-${args.label}.md`)).split('\\').join('/');
  console.log(`Wrote ${shownPath} and .json in ${Math.round((Date.now() - t0) / 1000)} s.`);
}

if (isMainThread && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
