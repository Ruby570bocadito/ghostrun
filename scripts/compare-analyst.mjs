// Writes a side-by-side of the analyst's cards at two reasoning efforts (from scripts/reexplain.mjs
// outputs report-<tagA>.json and report-<tagB>.json) to bench/results/analyst-effort.md.
// node scripts/compare-analyst.mjs <tagA> <tagB> <runDir>...
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [tagA, tagB, ...dirs] = process.argv.slice(2);
const lines = [
  `# Analyst reasoning effort: ${tagA} vs ${tagB}`,
  '',
  'Same runs, same findings, same evidence; only the analyst\'s `reasoning_effort` changes (Muse Spark 1.3).',
  '',
  '| Run | Effort | Cards | Output tokens (reasoning) | Cost | Time |',
  '|---|---|---|---|---|---|',
];
const body = [];
const totals = {};
for (const dir of dirs) {
  const name = dir.split(/[\\/]/).filter(Boolean).at(-1);
  const reports = {};
  for (const tag of [tagA, tagB]) {
    const r = JSON.parse(await readFile(join(dir, `report-${tag}.json`), 'utf8'));
    reports[tag] = r;
    const u = r.analystUsage;
    totals[tag] = (totals[tag] ?? { cost: 0, s: 0 });
    totals[tag].cost += r.analyst.costUsd;
    totals[tag].s += r.analyst.seconds;
    lines.push(`| ${name} | ${r.analyst.reasoning} | ${r.cards.length} | ${u.output} (${u.reasoning}) | $${r.analyst.costUsd.toFixed(4)} | ${r.analyst.seconds.toFixed(1)} s |`);
  }
  body.push('', `## ${name}`);
  const ids = reports[tagA].cards.map((c) => c.finding);
  for (const id of ids) {
    body.push('', `**${id}**`, '');
    for (const tag of [tagA, tagB]) {
      const c = reports[tag].cards.find((x) => x.finding === id);
      if (!c) continue;
      body.push(`- *${reports[tag].analyst.reasoning}*: **${c.title}** (confidence ${c.confidence}${c.could_be_ghost_skill ? ', could be ghost skill' : ''}). ${c.what_happens} Cause: ${c.likely_cause} Fix: ${c.suggested_fix}`);
    }
  }
}
lines.push(
  `| **Total** | ${tagA} | | | **$${totals[tagA].cost.toFixed(4)}** | ${totals[tagA].s.toFixed(1)} s |`,
  `| **Total** | ${tagB} | | | **$${totals[tagB].cost.toFixed(4)}** | ${totals[tagB].s.toFixed(1)} s |`,
  ...body,
);
await writeFile(join('bench', 'results', 'analyst-effort.md'), lines.join('\n') + '\n');
console.log(lines.slice(0, 6 + dirs.length * 2 + 2).join('\n'));
