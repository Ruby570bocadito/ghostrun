// How well do the ghosts play? Measured on recorded traces, no API calls.
// The ghosts must still get stuck where a real player would (an impossible gap stays impossible); what this measures
// is the clumsiness that is the ghost's fault, not the game's: jumps started far from the edge, deaths at gaps that
// can be jumped, jump keys tapped in mid-air, decisions taken while already falling into a pit, and exit interviews
// that blame the wrong thing. It uses the level's real geometry, which the ghosts are never told.
//
// node bench/play-quality.mjs [<bench label | run dir>...] [--json out.json]
//   default: optimized-v6 + optimized-v7 (the baseline of rediseno/PLAN.md, section F)
//   a label reads bench/results/<label>.json (the runs it lists); a directory is searched for trace.json files.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tapFrame } from '../src/keys.mjs';

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
// Keys that are meant to be pressed in mid-air in a game (Read Me's dash: X, and Z which its faulty text names).
const AIR_KEYS = { 'read-me': new Set(['KeyX', 'KeyZ']) };
export const FAR_PX = 40; // a takeoff further than this from the edge is "far"
export const CLEAN_PX = 15; // a takeoff at most this far from the edge, holding forward, is a clean attempt
const REACH_PX = 150; // Gap Run's running jump covers ~150 px (games/gap-run/game.js); wider gaps cannot be jumped

/** The pits of a level from its SDK state, or null for games without pits. Evaluator knowledge only. */
export function levelGaps(state) {
  if (state?.game === 'gap-run' && Array.isArray(state.gaps)) {
    // games v1 (gaps 80/100/120): platforms [0,300], [380,620], [720,940], [940+gap3, …].
    // games v2 (32 px tiles, gaps 64/96/96, 22 Nov): platforms [0,320], [384,640], [736,960], [960+gap3, …].
    const edges = state.gaps[0] === 64 ? [320, 640, 960] : state.gaps[0] === 80 ? [300, 620, 940] : null;
    if (!edges) return null;
    return state.gaps.map((w, i) => ({ i, edge: edges[i], far: edges[i] + w, width: w, jumpable: w - 20 <= REACH_PX - 20 }));
  }
  if (state?.game === 'read-me') return [{ i: 0, edge: 240, far: 460, width: 220, jumpable: false, needsDash: true }];
  return null;
}

const stateBefore = (trace, step) => (step.frames ? trace.frames[Math.max(0, step.frames[0] - 1)]?.state : null);

/** Every takeoff in a trace: the step, where it left the floor, and which way it was going. */
export function takeoffs(trace) {
  const out = [];
  for (const s of trace.steps ?? []) {
    if (!s.frames) continue;
    let prev = stateBefore(trace, s);
    for (let i = s.frames[0]; i <= s.frames[1]; i++) {
      const st = trace.frames[i]?.state;
      if (!st) continue;
      if (prev?.onFloor && !st.onFloor && (st.vy ?? 0) < -100) {
        // A tap fires where it was pressed: at the start of the move, or after the run-up ("tap after N px").
        const tapX = s.tapAt?.x ?? (i === s.frames[0] ? s.before?.x : null);
        const x = Number.isFinite(tapX) && Math.abs(prev.x - tapX) <= 25 && Math.abs(st.x - tapX) <= 40 ? tapX : prev.x;
        const tapped = (s.move?.tap ?? []).some((k) => JUMP_KEYS.has(k)) || (s.move?.hold ?? []).includes('ArrowUp');
        out.push({ step: s.step, x, y: prev.y, dir: Math.sign(st.vx ?? 0), holdRight: (s.move?.hold ?? []).includes('ArrowRight'), tapped, frame: i });
      }
      prev = st;
    }
  }
  return out;
}

/** The gap a rightward takeoff is aimed at (the first edge ahead of it, allowing for standing a little past it). */
export function gapAhead(gaps, x) {
  return gaps?.find((g) => x <= g.edge + 12 && x > (gaps[g.i - 1]?.far ?? -Infinity) - 12) ?? null;
}

const levelOf = (trace) => trace.frames.find((f) => f.state)?.state ?? null;

/** Play-quality numbers for one trace. */
export function traceQuality(trace) {
  const level = levelOf(trace);
  const game = level?.game ?? null;
  const gaps = levelGaps(level);
  const q = { persona: trace.persona, game, fault: level?.fault ?? null, decisions: 0, inAir: 0, falling: 0, midAirTaps: 0, midAirTapsAtDecision: 0, midAirTapsWithKeyHint: 0, deaths: 0, deathsAtJumpable: 0, jumps: [], backAtStart: 0, interview: null };
  if (!level) return q;
  q.platformer = typeof level.onFloor === 'boolean'; // top-down games have no floor and no "air"
  let floorY = -Infinity; // lowest point the character has stood on so far (y grows downwards)
  let prevDeathRespawn = null;
  for (const s of trace.steps) {
    const st = stateBefore(trace, s);
    q.decisions += 1;
    if (q.platformer && st && Number.isFinite(st.y)) {
      if (!st.onFloor) {
        q.inAir += 1;
        if ((st.vy ?? 0) > 0 && Number.isFinite(floorY) && st.y > floorY + 12) q.falling += 1;
      }
      // A tap is "in mid-air" by where it was pressed: after a run-up (tap_after_px) that is later in the move, and a
      // move decided in the air can land first and tap on the floor. Without a run-up it is the state before the move.
      const pressed = s.tapAt?.ms ? trace.frames[Math.max(0, tapFrame(trace, s) - 1)]?.state : st;
      if (pressed && pressed.onFloor === false) {
        const air = AIR_KEYS[game] ?? new Set();
        const bad = (s.move?.tap ?? []).filter((k) => !air.has(k));
        if (bad.length) {
          q.midAirTaps += 1;
          if ((s.notes ?? []).some((n) => /another key/i.test(n))) q.midAirTapsWithKeyHint += 1;
        }
      }
      if (!st.onFloor && s.move?.tap?.some((k) => !(AIR_KEYS[game] ?? new Set()).has(k))) q.midAirTapsAtDecision += 1;
    }
    if (prevDeathRespawn && /back (at|to) (the )?start|from the start|start(ing)? over/i.test(s.thought ?? '')) q.backAtStart += 1;
    prevDeathRespawn = null;
    for (let i = s.frames?.[0] ?? 0; s.frames && i <= s.frames[1]; i++) {
      const f = trace.frames[i]?.state;
      if (f?.onFloor && Number.isFinite(f.y)) floorY = Math.max(floorY, f.y);
    }
    if ((s.events ?? []).includes('death')) {
      const after = s.after;
      // Gap Run respawns at the start of the last platform stood on; only the first is "the start".
      if (game === 'gap-run' && after && after.x > 100) prevDeathRespawn = 'checkpoint';
    }
  }
  for (const e of trace.events ?? []) {
    if (e.type !== 'death') continue;
    q.deaths += 1;
    if (game === 'gap-run' && gaps) {
      const g = gaps[e.segment ?? -1] ?? gaps.find((gg) => e.x >= gg.edge - 20 && e.x <= gg.far + 20);
      if (g?.jumpable) q.deathsAtJumpable += 1;
    }
  }
  if (gaps) {
    for (const t of takeoffs(trace)) {
      if (t.dir <= 0) continue;
      const g = gapAhead(gaps, t.x);
      if (!g) continue;
      const dist = Math.round(g.edge - t.x);
      if (dist > 200) continue; // testing the jump key at the start, not an attempt at the gap
      q.jumps.push({ gap: g.i, jumpable: g.jumpable, dist, clean: dist <= CLEAN_PX && t.holdRight, step: t.step });
    }
  }
  if (trace.debrief && game === 'gap-run') q.interview = interviewCheck(trace, gaps);
  return q;
}

const ORDINAL = [/\bfirst\b/i, /\bsecond\b|\bmiddle\b/i, /\bthird\b|\blast\b/i];

/** Does the exit interview blame the right thing? Gap Run: no "overshoot" (pit deaths are always short jumps) and the right gap. */
export function interviewCheck(trace, gaps) {
  const text = `${trace.debrief.stopped_me ?? ''}`;
  const deaths = (trace.events ?? []).filter((e) => e.type === 'death');
  if (!deaths.length) return { text, wrong: false, reason: null };
  if (/overshoot|overshot|too far|too long|too much/i.test(text)) return { text, wrong: true, reason: 'says it jumped too far; every pit death is a jump that fell short' };
  const byGap = [0, 0, 0];
  for (const e of deaths) if (Number.isInteger(e.segment) && e.segment < 3) byGap[e.segment] += 1;
  const worst = byGap.indexOf(Math.max(...byGap));
  const named = ORDINAL.findIndex((re) => re.test(text));
  if (named >= 0 && named !== worst) return { text, wrong: true, reason: `names gap ${named + 1}, but most deaths were at gap ${worst + 1}` };
  return { text, wrong: false, reason: null };
}

/** Sums the per-trace numbers into the table of the plan. */
export function summarize(qs, { runs } = {}) {
  const sum = (k, rows = qs) => rows.reduce((a, q) => a + q[k], 0);
  const gapRun = qs.filter((q) => q.game === 'gap-run');
  const cleanGap = gapRun.filter((q) => q.fault === 'none');
  const faulted = qs.filter((q) => q.fault && q.fault !== 'none');
  const jumps = qs.flatMap((q) => q.jumps.map((j) => ({ ...j, game: q.game })));
  const gap1 = jumps.filter((j) => j.game === 'gap-run' && j.gap === 0);
  const fair = jumps.filter((j) => j.jumpable);
  const impossibleGhosts = gapRun.filter((q) => q.fault === 'gap');
  const interviews = qs.filter((q) => q.interview);
  const faultedRuns = runs ? runs.filter((r) => r.faulted).length : null;
  const faultedGapRuns = runs ? runs.filter((r) => r.faulted && r.game === 'gap-run').length : null;
  const platformer = qs.filter((q) => q.platformer);
  return {
    ghosts: qs.length,
    decisions: sum('decisions'),
    platformerDecisions: sum('decisions', platformer),
    decisionsInAir: sum('inAir'),
    decisionsFalling: sum('falling'),
    midAirTaps: sum('midAirTaps'),
    midAirTapsWithKeyHint: sum('midAirTapsWithKeyHint'),
    midAirTapsPerFaultedRun: faultedRuns ? sum('midAirTaps', faulted) / faultedRuns : null,
    faultedRuns,
    midAirTapsPerFaultedGapRun: faultedGapRuns ? sum('midAirTaps', faulted.filter((q) => q.game === 'gap-run')) / faultedGapRuns : null,
    midAirTapsAtDecisionPerFaultedGapRun: faultedGapRuns ? sum('midAirTapsAtDecision', faulted.filter((q) => q.game === 'gap-run')) / faultedGapRuns : null,
    faultedGapRuns,
    gap1Jumps: gap1.length,
    gap1FarShare: gap1.length ? gap1.filter((j) => j.dist > FAR_PX).length / gap1.length : null,
    fairJumps: fair.length,
    fairFarShare: fair.length ? fair.filter((j) => j.dist > FAR_PX).length / fair.length : null,
    medianGap1Dist: median(gap1.map((j) => j.dist)),
    cleanGapRunGhosts: cleanGap.length,
    deathsPerGhostCleanGapRun: cleanGap.length ? sum('deaths', cleanGap) / cleanGap.length : null,
    deathsAtJumpableGaps: sum('deathsAtJumpable', gapRun),
    cleanAttemptsImpossible: impossibleGhosts.map((q) => q.jumps.filter((j) => !j.jumpable && j.clean).length),
    ghostsWith2CleanAttempts: impossibleGhosts.length ? impossibleGhosts.filter((q) => q.jumps.filter((j) => !j.jumpable && j.clean).length >= 2).length / impossibleGhosts.length : null,
    impossibleGhosts: impossibleGhosts.length,
    backAtStartThoughts: sum('backAtStart'),
    interviews: interviews.length,
    wrongInterviews: interviews.filter((q) => q.interview.wrong).map((q) => ({ persona: q.persona, ...q.interview })),
  };
}

function median(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function findTraces(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'frames') continue;
    if (name === 'trace.json') out.push(p);
    else if (statSync(p).isDirectory()) out.push(...findTraces(p));
  }
  return out;
}

async function tracesOf(arg) {
  if (existsSync(arg) && statSync(arg).isDirectory()) return findTraces(arg);
  const file = join('bench', 'results', `${arg}.json`);
  if (!existsSync(file)) throw new Error(`Not a run directory nor a bench label: ${arg}`);
  const { results } = JSON.parse(await readFile(file, 'utf8'));
  return results.filter((r) => r.dir && existsSync(r.dir)).flatMap((r) => findTraces(r.dir));
}

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const num = (x, d = 2) => (x == null ? '—' : Number(x).toFixed(d));

export function table(s) {
  return [
    `| Metric | Value |`,
    `|---|---|`,
    `| Ghosts (traces) | ${s.ghosts} |`,
    `| Gap Run gap 1: takeoffs more than ${FAR_PX} px before the edge | **${pct(s.gap1FarShare)}** of ${s.gap1Jumps} (median ${s.medianGap1Dist ?? '—'} px) |`,
    `| All jumpable gaps: takeoffs more than ${FAR_PX} px before the edge | ${pct(s.fairFarShare)} of ${s.fairJumps} |`,
    `| Deaths per ghost, clean Gap Run | **${num(s.deathsPerGhostCleanGapRun)}** (${s.cleanGapRunGhosts} ghosts) |`,
    `| Deaths at jumpable gaps, all Gap Run runs | ${s.deathsAtJumpableGaps} |`,
    `| Mid-air taps (keys that do nothing in the air), all platformers | ${s.midAirTaps} (${s.midAirTapsWithKeyHint} right after the "another key" hint); ${num(s.midAirTapsPerFaultedRun, 1)} per run with a fault (${s.faultedRuns} runs) |`,
    `| Mid-air taps per Gap Run run with the fault (pressed in the air) | **${num(s.midAirTapsPerFaultedGapRun, 1)}** (${s.faultedGapRuns ?? 0} runs); counted by the state when the move was decided, as before F5: ${num(s.midAirTapsAtDecisionPerFaultedGapRun, 1)} |`,
    `| Decisions taken while falling below the floor (platformers) | **${s.decisionsFalling}** of ${s.platformerDecisions} (${pct(s.decisionsFalling / Math.max(1, s.platformerDecisions))}); in the air: ${pct(s.decisionsInAir / Math.max(1, s.platformerDecisions))} |`,
    `| Ghosts with ≥2 clean attempts at the impossible gap (≤${CLEAN_PX} px, holding →) | ${pct(s.ghostsWith2CleanAttempts)} of ${s.impossibleGhosts} (attempts per ghost: ${s.cleanAttemptsImpossible.join(', ') || '—'}) |`,
    `| "Back at the start" thoughts after respawning at a checkpoint | ${s.backAtStartThoughts} |`,
    `| Exit interviews that blame the wrong thing (Gap Run) | ${s.wrongInterviews.length} of ${s.interviews}${s.wrongInterviews.length ? ': ' + s.wrongInterviews.map((w) => `${w.persona} "${w.text}" (${w.reason})`).join('; ') : ''} |`,
  ].join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const jIdx = argv.indexOf('--json');
  const jsonOut = jIdx >= 0 ? argv[jIdx + 1] : null;
  const inputs = argv.filter((a, i) => !a.startsWith('--') && (jIdx < 0 || i !== jIdx + 1));
  const sources = inputs.length ? inputs : ['optimized-v6', 'optimized-v7'];
  const qs = [];
  const runs = new Map();
  for (const src of sources) {
    for (const f of await tracesOf(src)) {
      const trace = JSON.parse(await readFile(f, 'utf8'));
      const q = traceQuality(trace);
      qs.push(q);
      const run = dirname(dirname(f));
      if (!runs.has(run)) runs.set(run, { run, game: q.game, faulted: Boolean(q.fault && q.fault !== 'none') });
    }
  }
  const s = summarize(qs, { runs: [...runs.values()] });
  console.log(`Play quality — ${sources.join(' + ')}\n`);
  console.log(table(s));
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ sources, summary: s, ghosts: qs }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
