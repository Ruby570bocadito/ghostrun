// Re-analyses the saved runs of a benchmark with the current analysis code (no new games played,
// no API cost) and writes the scores under a new label. Used to see the effect of changing the rules,
// always followed by a fresh run so the new rules are not only judged on the runs that motivated them.
// node bench/rescore.mjs <label> <newLabel>
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyze } from '../src/analyze.mjs';
import { score } from './score.mjs';

const [label = 'baseline', newLabel = `${label}-rescored`] = process.argv.slice(2);
const old = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
const results = [];
for (const r of old.results) {
  if (!r.dir) {
    results.push(r);
    continue;
  }
  const cfg = JSON.parse(await readFile(join(r.dir, 'config.json'), 'utf8'));
  const ids = [];
  const seen = {};
  for (const p of cfg.personas) {
    seen[p] = (seen[p] ?? 0) + 1;
    ids.push(seen[p] === 1 ? p : `${p}-${seen[p]}`);
  }
  const traces = await Promise.all(ids.map(async (id) => JSON.parse(await readFile(join(r.dir, id, 'trace.json'), 'utf8'))));
  const faults = JSON.parse(await readFile(join('games', r.game, 'faults.json'), 'utf8'));
  const report = analyze(traces);
  const s = score(report, r.variant === 'clean' ? null : faults[r.variant]);
  results.push({ ...r, ...s, findings: report.findings.map((f) => ({ id: f.id, type: f.type, severity: f.severity, center: f.center, ghosts: f.ghosts.length })) });
}
const faultRows = results.filter((r) => r.kind === 'fault');
const cleanRows = results.filter((r) => r.kind === 'clean');
const summary = {
  ...old.summary,
  label: newLabel,
  rescoredFrom: label,
  recall: faultRows.filter((r) => r.detectedStrict).length / Math.max(1, faultRows.length),
  cleanRunsWithFalseAlarm: cleanRows.filter((r) => r.falseAlarms > 0).length / Math.max(1, cleanRows.length),
};
await writeFile(join('bench', 'results', `${newLabel}.json`), JSON.stringify({ summary, results }, null, 2));
console.log(`${newLabel}: faults found ${faultRows.filter((r) => r.detectedStrict).length}/${faultRows.length}, clean runs with a false alarm ${cleanRows.filter((r) => r.falseAlarms > 0).length}/${cleanRows.length}`);
for (const r of results) {
  if (r.kind === 'clean' && r.falseAlarms) console.log(`  false alarm: ${r.game} #${r.rep}: ${r.alarmTypes.join(', ')}`);
  if (r.kind === 'fault' && !r.detectedStrict) console.log(`  missed: ${r.game} ${r.variant} #${r.rep}: ${r.matched.join(', ') || 'nothing in the region'}`);
}
