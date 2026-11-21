// Re-runs the analysis and the analyst on a saved run (no new gameplay), and writes report-<tag>.json
// next to the original so both versions can be compared.
// node scripts/reexplain.mjs <runDir> [tag] [reasoning effort, default minimal] [model, default muse-spark-1.3]
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyze } from '../src/analyze.mjs';
import { explainHotspots } from '../src/explain.mjs';
import { costOf } from '../src/brains/prices.mjs';
import { chromium } from 'playwright';
import { measureObjectives } from '../src/contrast.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const [runDir, tag = 'v2', reasoning = 'minimal', model = 'muse-spark-1.3'] = process.argv.slice(2);
const cfg = JSON.parse(await readFile(join(runDir, 'config.json'), 'utf8'));
const seen = {};
const ids = cfg.personas.map((p) => {
  seen[p] = (seen[p] ?? 0) + 1;
  return seen[p] === 1 ? p : `${p}-${seen[p]}`;
});
const traces = await Promise.all(ids.map(async (id) => JSON.parse(await readFile(join(runDir, id, 'trace.json'), 'utf8'))));
const browser = await chromium.launch();
const objectives = await measureObjectives({ browser, traces, readFrame: (persona, file) => readFile(join(runDir, persona, file)) });
await browser.close();
const report = analyze(traces, { objectives });
const t0 = performance.now();
const { cards, usage } = await explainHotspots(report, { runDir, traces, reasoning, model });
const seconds = (performance.now() - t0) / 1000;
report.cards = cards;
report.config = cfg;
report.analystUsage = usage;
report.analyst = { model, reasoning, seconds, costUsd: costOf(model, usage) };
await writeFile(join(runDir, `report-${tag}.json`), JSON.stringify(report, null, 2));
for (const c of cards) {
  console.log(`[${c.finding}] ${c.title}  (confidence: ${c.confidence}, could be ghost skill: ${c.could_be_ghost_skill})`);
  console.log(`  what:  ${c.what_happens}\n  cause: ${c.likely_cause}\n  fix:   ${c.suggested_fix}`);
}
const cost = costOf(model, usage);
console.log(`${model} @ ${reasoning}: ${cards.length} cards · tokens in ${usage.input} (${usage.cached} cached) / out ${usage.output} (${usage.reasoning} reasoning) · ${cost.toFixed(4)} USD · ${seconds.toFixed(1)} s`);
