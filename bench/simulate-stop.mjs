// Offline "what if": replays recorded benchmark runs as if each ghost had been stopped once it died
// N times at the same spot, or after K moves without exploring anything new (the rules in ghost.mjs).
// It would have played identically up to that point, so cutting the trace there is exact. Re-runs
// the analysis and the scoring. No API calls. Only games with the SDK (the live rule needs positions).
// node bench/simulate-stop.mjs <bench result label>... [--n 6,8,10] [--idle 20]
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/analyze.mjs';
import { score } from './score.mjs';
import { DeathSpots } from '../src/feedback.mjs';

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
const ns = nIdx >= 0 ? args[nIdx + 1].split(',').map(Number) : [6, 8, 10, 12];
const iIdx = args.indexOf('--idle');
const idle = iIdx >= 0 ? Number(args[iIdx + 1]) : Infinity;
const mIdx = args.indexOf('--max');
const maxMoves = mIdx >= 0 ? Number(args[mIdx + 1]) : Infinity; // also cap every ghost at this many moves
const valueAt = new Set([nIdx, iIdx, mIdx].filter((i) => i >= 0).map((i) => i + 1));
const labels = args.filter((a, i) => !a.startsWith('--') && !valueAt.has(i));
const CELL = 80;

/** Cuts a trace after `max` moves, as if the ghost had been given fewer moves. */
function capMoves(trace, max) {
  if (trace.steps.length <= max) return trace;
  const steps = trace.steps.slice(0, max);
  const last = steps.at(-1);
  const lastFrame = last.frames?.[1] ?? trace.frames.length - 1;
  return { ...trace, steps, frames: trace.frames.slice(0, lastFrame + 1), events: trace.events.filter((ev) => ev.step <= last.step), outcome: 'out_of_steps' };
}

export function cutAtSaturation(rawTrace, n, k = Infinity) {
  const trace = capMoves(rawTrace, maxMoves);
  if (!trace.frames.some((f) => f.state)) return trace; // no SDK: the live rule does not apply
  const spots = new DeathSpots();
  const seen = new Set();
  let lastFresh = 0;
  for (let i = 0; i < trace.steps.length - 1; i++) {
    const st = trace.steps[i];
    let deathsHere = 0;
    for (const e of trace.events) if (e.type === 'death' && e.step === st.step && Number.isFinite(e.x)) deathsHere = Math.max(deathsHere, spots.add(e));
    let fresh = (st.events ?? []).includes('milestone');
    const [a, b] = st.frames ?? [0, -1];
    for (let j = a; j <= b && j < trace.frames.length; j++) {
      const p = trace.frames[j].state;
      if (!p || !Number.isFinite(p.x)) continue;
      const c = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
      if (!seen.has(c)) {
        seen.add(c);
        fresh = true;
      }
    }
    if (fresh) lastFresh = st.step;
    if (deathsHere >= n || st.step - lastFresh >= k) {
      const steps = trace.steps.slice(0, i + 1);
      const lastFrame = steps.at(-1).frames?.[1] ?? trace.frames.length - 1;
      return { ...trace, steps, frames: trace.frames.slice(0, lastFrame + 1), events: trace.events.filter((ev) => ev.step <= st.step), outcome: 'saturated' };
    }
  }
  return trace;
}

const runs = [];
for (const label of labels) {
  const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
  for (const r of results) {
    if (r.kind === 'error') continue;
    const fault = r.variant === 'clean' ? null : JSON.parse(await readFile(join('games', r.game, 'faults.json'), 'utf8'))[r.variant];
    const traces = [];
    for (const p of ['newbie', 'speedrunner', 'reader', 'impatient']) {
      const f = join(r.dir, p, 'trace.json');
      if (existsSync(f)) traces.push(JSON.parse(await readFile(f, 'utf8')));
    }
    runs.push({ label, game: r.game, variant: r.variant, fault, traces });
  }
}

const rows = [];
for (const n of [...new Set([Infinity, ...ns])]) {
  let found = 0;
  let faults = 0;
  let alarms = 0;
  let cleans = 0;
  let moves = 0;
  let cleanMoves = 0;
  let faultMoves = 0;
  let stopped = 0;
  let finished = 0;
  const changes = [];
  for (const run of runs) {
    const traces = n === Infinity && idle === Infinity && maxMoves === Infinity ? run.traces : run.traces.map((t) => cutAtSaturation(t, n, idle));
    stopped += traces.filter((t) => t.outcome === 'saturated').length;
    const s = score(analyze(traces), run.fault);
    const m = traces.reduce((a, t) => a + t.steps.length, 0);
    moves += m;
    if (s.kind === 'fault') {
      faults++;
      faultMoves += m;
      if (s.detectedStrict) found++;
      else changes.push(`${run.label} ${run.game} ${run.variant}: missed`);
    } else {
      cleans++;
      cleanMoves += m;
      finished += s.finished;
      if (s.falseAlarms) {
        alarms++;
        changes.push(`${run.label} ${run.game} clean: false alarm (${s.alarmTypes.join(',')})`);
      }
    }
  }
  rows.push({ n, found: `${found}/${faults}`, falseAlarms: `${alarms}/${cleans}`, finished: `${finished}/${cleans * 4}`, moves, cleanMoves, faultMoves, stopped, changes });
}
const base = rows[0];
for (const r of rows) {
  const pct = (a, b) => `${Math.round((1 - a / b) * 100)}%`;
  console.log(
    `stop at ${String(r.n).padStart(8)} deaths/spot${idle < Infinity ? ` or ${idle} idle moves` : ''}: found ${r.found} · false alarms ${r.falseAlarms} · finished (clean) ${r.finished} · moves ${r.moves} (−${pct(r.moves, base.moves)}; fault runs −${pct(r.faultMoves, base.faultMoves)}, clean −${pct(r.cleanMoves, base.cleanMoves)}) · ghosts stopped ${r.stopped}` +
      (r.changes.length ? '\n    ' + r.changes.join('\n    ') : ''),
  );
}
