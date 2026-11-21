// Before/after table for two (or more) benchmark labels, per game and in total, priced from the
// recorded per-move usage (what Meta bills, with cached input at the cached rate, and list price).
// node bench/compare.mjs <label>... [--md]   (several labels for one side: "a+b")
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { costOf } from '../src/brains/prices.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const md = process.argv.includes('--md');

async function load(side) {
  const rows = [];
  for (const label of side.split('+')) {
    const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
    for (const r of results) {
      if (r.kind === 'error' || !r.dir) continue;
      const cfg = JSON.parse(await readFile(join(r.dir, 'config.json'), 'utf8'));
      let moves = 0;
      let billed = 0;
      let list = 0;
      const tok = { input: 0, cached: 0, output: 0, reasoning: 0 };
      const lat = [];
      for (const p of cfg.personas) {
        const f = join(r.dir, p, 'trace.json');
        if (!existsSync(f)) continue;
        const t = JSON.parse(await readFile(f, 'utf8'));
        for (const s of t.steps) {
          moves++;
          billed += costOf(s.model ?? t.model, s.usage);
          list += costOf(s.model ?? t.model, s.usage, { listPrice: true });
          for (const k of Object.keys(tok)) tok[k] += s.usage?.[k] ?? 0;
          lat.push(s.latencyMs);
        }
      }
      rows.push({ game: r.game, kind: r.kind, found: r.detectedStrict, alarm: r.falseAlarms > 0, finished: r.finished ?? 0, ghosts: cfg.personas.length, deaths: r.deaths, moves, billed, list, tok, lat, seconds: r.seconds });
    }
  }
  return rows;
}

function summarize(rows) {
  const n = rows.length;
  const faults = rows.filter((r) => r.kind === 'fault');
  const cleans = rows.filter((r) => r.kind === 'clean');
  const moves = rows.reduce((a, r) => a + r.moves, 0);
  const t = (k) => rows.reduce((a, r) => a + r.tok[k], 0);
  const lat = rows.flatMap((r) => r.lat).sort((a, b) => a - b);
  return {
    runs: n,
    found: `${faults.filter((r) => r.found).length}/${faults.length}`,
    alarms: `${cleans.filter((r) => r.alarm).length}/${cleans.length}`,
    finished: cleans.length ? `${Math.round((cleans.reduce((a, r) => a + r.finished, 0) / cleans.reduce((a, r) => a + r.ghosts, 0)) * 100)}%` : '—',
    movesPerRun: (moves / n).toFixed(0),
    deathsPerRun: (rows.reduce((a, r) => a + r.deaths, 0) / n).toFixed(1),
    billedPerRun: rows.reduce((a, r) => a + r.billed, 0) / n,
    listPerRun: rows.reduce((a, r) => a + r.list, 0) / n,
    inPerMove: (t('input') / moves).toFixed(0),
    cachedShare: `${Math.round((t('cached') / Math.max(1, t('input'))) * 100)}%`,
    outPerMove: (t('output') / moves).toFixed(0),
    reasoningPerMove: (t('reasoning') / moves).toFixed(0),
    p50: lat[Math.floor(lat.length / 2)],
    secondsPerRun: (rows.reduce((a, r) => a + (r.seconds ?? 0), 0) / n).toFixed(0),
  };
}

const sides = await Promise.all(args.map(load));
const games = [...new Set(sides.flat().map((r) => r.game))];
const header = ['Scope', ...args.flatMap((a) => [a])];
const fields = [
  ['Flaws found', 'found'],
  ['Clean runs with a false alarm', 'alarms'],
  ['Ghosts that finished clean games', 'finished'],
  ['Moves per run', 'movesPerRun'],
  ['Deaths per run', 'deathsPerRun'],
  ['Billed cost per run', 'billedPerRun', (v) => `$${v.toFixed(4)}`],
  ['List-price cost per run', 'listPerRun', (v) => `$${v.toFixed(4)}`],
  ['Input tokens per move', 'inPerMove'],
  ['  of which from cache', 'cachedShare'],
  ['Output tokens per move', 'outPerMove'],
  ['  of which reasoning', 'reasoningPerMove'],
  ['Decision time p50 (ms)', 'p50'],
  ['Real time per run (s)', 'secondsPerRun'],
];
const all = sides.map(summarize);
if (md) {
  console.log(`| | ${args.join(' | ')} |`);
  console.log(`|---|${args.map(() => '---').join('|')}|`);
  for (const [name, key, fmt] of fields) console.log(`| ${name} | ${all.map((s) => (fmt ? fmt(s[key]) : s[key])).join(' | ')} |`);
} else {
  for (const [name, key, fmt] of fields) console.log(`${name.padEnd(34)} ${all.map((s) => String(fmt ? fmt(s[key]) : s[key]).padStart(14)).join(' ')}`);
}
console.log('');
for (const g of games) {
  const per = sides.map((rows) => summarize(rows.filter((r) => r.game === g)));
  console.log(`${g.padEnd(12)} ${per.map((s) => `found ${s.found} · alarms ${s.alarms} · finished ${s.finished} · ${s.movesPerRun} moves · $${s.billedPerRun.toFixed(4)} billed · ${s.inPerMove} in (${s.cachedShare} cached) / ${s.outPerMove} out`).join('   ||   ')}`);
}
