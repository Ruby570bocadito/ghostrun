// Re-runs the analysis and the analyst on a saved run (no new gameplay), and writes report-<tag>.json
// next to the original so both versions can be compared.
// node scripts/reexplain.mjs <runDir> [tag]
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyze } from '../src/analyze.mjs';
import { explainHotspots } from '../src/explain.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const [runDir, tag = 'v2'] = process.argv.slice(2);
const cfg = JSON.parse(await readFile(join(runDir, 'config.json'), 'utf8'));
const seen = {};
const ids = cfg.personas.map((p) => {
  seen[p] = (seen[p] ?? 0) + 1;
  return seen[p] === 1 ? p : `${p}-${seen[p]}`;
});
const traces = await Promise.all(ids.map(async (id) => JSON.parse(await readFile(join(runDir, id, 'trace.json'), 'utf8'))));
const report = analyze(traces);
const { cards, usage } = await explainHotspots(report, { runDir, traces });
report.cards = cards;
report.config = cfg;
await writeFile(join(runDir, `report-${tag}.json`), JSON.stringify(report, null, 2));
for (const c of cards) {
  console.log(`[${c.finding}] ${c.title}  (confidence: ${c.confidence}, could be ghost skill: ${c.could_be_ghost_skill})`);
  console.log(`  what:  ${c.what_happens}\n  cause: ${c.likely_cause}\n  fix:   ${c.suggested_fix}`);
}
console.log(`tokens ${usage.input}/${usage.output}`);
