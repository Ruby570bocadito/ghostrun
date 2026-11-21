// Benchmark: every test game, clean and with each injected fault, played by the ghosts and
// scored automatically against the known answer in games/<id>/faults.json.
//
// node bench/run.mjs [--label baseline] [--games gap-run,key-hunt] [--reps 1] [--steps 40]
//   [--personas newbie,speedrunner,reader,impatient] [--model muse-ember-1.0] [--no-bullet-time]
//   [--concurrency 2] [--clean-only | --faults-only]
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureGamesServer } from '../scripts/serve.mjs';
import { runSwarm } from '../src/swarm.mjs';
import { analyze } from '../src/analyze.mjs';
import { score } from './score.mjs';
import { costOf } from '../src/brains/meta.mjs';
import { DEFAULT_PERSONAS } from '../src/personas.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const label = args.label ?? 'baseline';
const reps = Number(args.reps ?? 1);
const steps = Number(args.steps ?? 40);
const personas = (args.personas ?? DEFAULT_PERSONAS.join(',')).split(',');
const model = args.model ?? process.env.GHOST_MODEL ?? 'muse-ember-1.0';
const bulletTime = args['no-bullet-time'] !== 'true';
const concurrency = Number(args.concurrency ?? 2);
if (!process.env.MODEL_API_KEY) {
  console.error('MODEL_API_KEY is missing.');
  process.exit(1);
}

const gameIds = args.games
  ? args.games.split(',')
  : (await readdir('games', { withFileTypes: true })).filter((d) => d.isDirectory() && existsSync(join('games', d.name, 'faults.json'))).map((d) => d.name);

const jobs = [];
for (const game of gameIds) {
  const faults = JSON.parse(await readFile(join('games', game, 'faults.json'), 'utf8'));
  const variants = [];
  if (args['faults-only'] !== 'true') variants.push({ id: 'clean', fault: null });
  if (args['clean-only'] !== 'true') for (const [id, fault] of Object.entries(faults)) variants.push({ id, fault });
  for (const v of variants) for (let rep = 1; rep <= reps; rep++) jobs.push({ game, variant: v.id, fault: v.fault, rep });
}

const server = await ensureGamesServer(5174);
const outRoot = join('bench', 'results');
await mkdir(outRoot, { recursive: true });
const runRoot = join('runs', `bench-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
console.log(`Benchmark "${label}": ${jobs.length} runs × ${personas.length} ghosts, model ${model}, bullet time ${bulletTime ? 'on' : 'off'}`);

const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const url = `http://localhost:5174/${job.game}/${job.fault ? `?fault=${job.variant}` : ''}`;
    const dir = join(runRoot, `${job.game}-${job.variant}-${job.rep}`);
    const t0 = Date.now();
    try {
      const { traces } = await runSwarm({ url, personas, steps, model, bulletTime, outDir: dir });
      const report = analyze(traces);
      const s = score(report, job.fault);
      const cost = report.ghosts.reduce((a, g) => a + costOf(g.model, { input: g.tokensIn, output: g.tokensOut }), 0);
      const row = {
        ...job,
        fault: job.fault ? { type: job.fault.type, label: job.fault.label } : null,
        ...s,
        findings: report.findings.map((f) => ({ id: f.id, type: f.type, severity: f.severity, center: f.center, ghosts: f.ghosts.length })),
        deaths: report.ghosts.reduce((a, g) => a + g.deaths, 0),
        errors: report.ghosts.filter((g) => g.outcome === 'error').map((g) => g.error?.message),
        costUsd: cost,
        seconds: Math.round((Date.now() - t0) / 1000),
        dir,
      };
      results.push(row);
      await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2));
      const verdict = row.kind === 'clean' ? `clean: ${row.falseAlarms} false alarm(s)` : `fault ${row.detectedStrict ? 'FOUND' : row.detected ? 'found (other type)' : 'MISSED'} ${row.matched.join(',')}`;
      console.log(`[${results.length}/${jobs.length}] ${job.game} ${job.variant} #${job.rep}: ${verdict} · finished ${row.finished}/${personas.length} · $${cost.toFixed(3)} · ${row.seconds}s`);
    } catch (err) {
      results.push({ ...job, fault: job.fault ? { type: job.fault.type, label: job.fault.label } : null, kind: 'error', error: err.message });
      console.log(`[${results.length}/${jobs.length}] ${job.game} ${job.variant} #${job.rep}: ERROR ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
server.close();

// Summary
const faultRows = results.filter((r) => r.kind === 'fault');
const cleanRows = results.filter((r) => r.kind === 'clean');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');
const summary = {
  label,
  model,
  bulletTime,
  personas,
  steps,
  runs: results.length,
  recall: faultRows.filter((r) => r.detectedStrict).length / Math.max(1, faultRows.length),
  recallAny: faultRows.filter((r) => r.detected).length / Math.max(1, faultRows.length),
  cleanRunsWithFalseAlarm: cleanRows.filter((r) => r.falseAlarms > 0).length / Math.max(1, cleanRows.length),
  cleanFinishRate: cleanRows.reduce((a, r) => a + r.finished, 0) / Math.max(1, cleanRows.length * personas.length),
  avgCostUsd: results.reduce((a, r) => a + (r.costUsd ?? 0), 0) / Math.max(1, results.length),
  totalCostUsd: results.reduce((a, r) => a + (r.costUsd ?? 0), 0),
  avgSeconds: results.reduce((a, r) => a + (r.seconds ?? 0), 0) / Math.max(1, results.length),
  finishedAt: new Date().toISOString(),
};
await writeFile(join(outRoot, `${label}.json`), JSON.stringify({ summary, results }, null, 2));

const lines = [
  `# Benchmark — ${label}`,
  '',
  `Model \`${model}\` · bullet time ${bulletTime ? 'on' : 'off'} · ghosts: ${personas.join(', ')} · up to ${steps} moves each · ${results.length} runs · ${summary.finishedAt}`,
  '',
  `- **Faults found (right type, in the right place): ${faultRows.filter((r) => r.detectedStrict).length}/${faultRows.length} (${pct(faultRows.filter((r) => r.detectedStrict).length, faultRows.length)})**; any finding in the right place: ${pct(faultRows.filter((r) => r.detected).length, faultRows.length)}`,
  `- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): ${cleanRows.filter((r) => r.falseAlarms > 0).length}/${cleanRows.length}`,
  `- Ghosts that finished the clean games: ${pct(cleanRows.reduce((a, r) => a + r.finished, 0), cleanRows.length * personas.length)}`,
  `- Average cost per run (${personas.length} ghosts): $${summary.avgCostUsd.toFixed(3)} · average time: ${Math.round(summary.avgSeconds)} s · total: $${summary.totalCostUsd.toFixed(2)}`,
  '',
  '| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |',
  '|---|---|---|---|---|---|---|---|',
  ...results.map((r) =>
    r.kind === 'error'
      ? `| ${r.game} | ${r.variant} #${r.rep} | ${r.fault?.type ?? 'nothing'} | error: ${r.error} | | | | |`
      : `| ${r.game} | ${r.variant} #${r.rep} | ${r.fault ? `${r.fault.type}: ${r.fault.label}` : 'nothing wrong'} | ${
          r.kind === 'clean' ? (r.falseAlarms ? `⚠ false alarm (${r.alarmTypes.join(', ')})` : '✓ no false alarm') : r.detectedStrict ? `✓ found (#${r.rank})` : r.detected ? `~ found as ${r.matched.join(', ')}` : '✗ missed'
        } | ${r.findings.map((f) => `${f.type}${f.severity === 'high' ? '!' : ''}`).join(', ') || '—'} | ${r.finished}/${personas.length} | ${r.deaths} | $${r.costUsd.toFixed(3)} |`,
  ),
  '',
  '`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).',
];
await writeFile(join(outRoot, `${label}.md`), lines.join('\n') + '\n');
console.log('\n' + lines.slice(0, 8).join('\n'));
console.log(`\nSaved bench/results/${label}.md`);
