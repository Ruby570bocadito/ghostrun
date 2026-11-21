// Full pipeline from the terminal: ghosts play in parallel → hotspots → AI-written finding cards.
// node src/swarm-cli.mjs --game gap-run [--fault gap] [--personas newbie,speedrunner,reader,impatient] [--steps 40] [--brain meta|scripted]
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from '../scripts/serve.mjs';
import { runSwarm } from './swarm.mjs';
import { analyze } from './analyze.mjs';
import { explainHotspots } from './explain.mjs';
import { PERSONAS, DEFAULT_PERSONAS } from './personas.mjs';
import { costOf } from './brains/meta.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const game = args.game ?? 'gap-run';
const personas = (args.personas ?? DEFAULT_PERSONAS.join(',')).split(',');
const brain = args.brain ?? 'meta';
if (brain === 'meta' && !process.env.MODEL_API_KEY) {
  console.error('MODEL_API_KEY is missing.');
  process.exit(1);
}

const server = await startServer(Number(args.port ?? 5174));
const url = args.url ?? `http://localhost:${server.address().port}/${game}/${args.fault ? `?fault=${args.fault}` : ''}`;
const runDir = join('runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-swarm-${game}${args.fault ? '-' + args.fault : ''}`);

console.log(`Summoning ${personas.length} ghosts on ${url}`);
const { traces, ms } = await runSwarm({
  url,
  personas,
  steps: Number(args.steps ?? 40),
  brain,
  model: args.model,
  outDir: runDir,
  onEvent: (e) => {
    if (e.type === 'step') {
      const p = PERSONAS[e.ghost];
      console.log(`${p.emoji} ${e.ghost.padEnd(12)} ${String(e.step.step).padStart(2)} x=${Math.round(e.step.after?.x ?? 0)} d=${e.step.after?.deaths ?? '?'} "${e.step.thought}"${e.step.events.length ? ' [' + e.step.events.join(',') + ']' : ''}`);
    } else if (e.type === 'ghost_done') console.log(`== ${e.ghost} done: ${e.outcome}${e.error ? ' (' + e.error.message + ')' : ''}`);
    else if (e.type === 'model_fallback') console.log(`!! ${e.ghost} switched model ${e.from} → ${e.to} (${e.reason})`);
  },
});
server.close();

const report = analyze(traces);
let explain = { cards: [], usage: { input: 0, output: 0 } };
if (brain === 'meta' && report.hotspots.length) explain = await explainHotspots(report, { runDir, traces });
report.cards = explain.cards;

const ghostCost = report.ghosts.reduce((a, g) => a + costOf(g.model, { input: g.tokensIn, output: g.tokensOut }), 0);
const analystCost = costOf('muse-spark-1.3', explain.usage);
report.cost = { ghosts: ghostCost, analyst: analystCost, total: ghostCost + analystCost };
report.realMs = ms;
await writeFile(join(runDir, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n=== REPORT ===');
for (const g of report.ghosts) {
  console.log(`${PERSONAS[g.persona].emoji} ${g.persona.padEnd(12)} ${g.outcome.padEnd(12)} deaths=${g.deaths} progress=${g.progress == null ? '?' : Math.round(g.progress * 100) + '%'} steps=${g.steps}`);
}
for (const h of report.hotspots) {
  const card = report.cards.find((c) => c.hotspot === h.id);
  console.log(`\n[${h.severity.toUpperCase()}] ${h.id} ${h.ghosts.length}/${report.ghostsTotal} ghosts, ${h.count} deaths around x=${h.x}`);
  if (card) console.log(`  ${card.title}\n  what: ${card.what_happens}\n  cause: ${card.likely_cause}\n  fix: ${card.suggested_fix}`);
}
for (const q of report.quits) console.log(`\nQUIT: ${q.persona} at step ${q.step} (x=${Math.round(q.x ?? 0)}): "${q.thought}"`);
console.log(`\nreal time ${(ms / 1000).toFixed(1)} s · cost $${report.cost.total.toFixed(4)} · ${runDir}`);
