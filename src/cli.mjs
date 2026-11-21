// Run one ghost from the terminal.
// node src/cli.mjs --game gap-run [--fault gap] [--persona newbie] [--steps 40] [--brain meta|scripted] [--model muse-ember-1.0]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ensureGamesServer } from '../scripts/serve.mjs';
import { runGhost } from './ghost.mjs';
import { PERSONAS } from './personas.mjs';
import { createMetaBrain, costOf } from './brains/meta.mjs';
import { sumUsage } from './brains/prices.mjs';
import { createScriptedBrain } from './brains/scripted.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const game = args.game ?? 'gap-run';
const persona = PERSONAS[args.persona ?? 'newbie'];
const steps = Number(args.steps ?? 40);
const brainKind = args.brain ?? 'meta';
if (!persona) throw new Error(`Unknown persona. Options: ${Object.keys(PERSONAS).join(', ')}`);
if (brainKind === 'meta' && !process.env.MODEL_API_KEY) {
  console.error('MODEL_API_KEY is missing. Copy .env.example to .env and add your Meta Model API key.');
  process.exit(1);
}

const server = await ensureGamesServer(Number(args.port ?? 5174));
const port = server.port;
const url = args.url ?? `http://localhost:${port}/${game}/${args.fault ? `?fault=${args.fault}` : ''}`;
const brain =
  brainKind === 'scripted'
    ? createScriptedBrain()
    : createMetaBrain({ model: args.model, reasoning: args.reasoning, persona, controlsHint: args.controls });
const outDir = join('runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${game}${args.fault ? '-' + args.fault : ''}-${persona.id}-${brain.model}`);

const browser = await chromium.launch();
const usages = [];
const t0 = performance.now();
const trace = await runGhost({
  browser,
  url,
  brain,
  persona,
  maxSteps: steps,
  outDir,
  onStep: (s) => {
    usages.push(s.usage);
    const pos = s.after ? `x=${Math.round(s.after.x)} deaths=${s.after.deaths}` : '';
    console.log(`${persona.emoji} ${String(s.step).padStart(2)} ${s.move.hold.join('+') || '-'}${s.move.tap.length ? ' tap ' + s.move.tap.join('+') : ''} ${s.move.duration_ms}ms  ${pos}  ${s.latencyMs}ms  "${s.thought}"${s.events.length ? '  [' + s.events.join(',') + ']' : ''}`);
  },
});
await browser.close();
server.close();

const last = trace.steps.at(-1);
const maxX = Math.max(0, ...trace.frames.map((f) => f.state?.x ?? 0));
const deaths = trace.events.filter((e) => e.type === 'death');
console.log('\n--- result ---');
console.log(`outcome: ${trace.outcome}${trace.error ? ` (${trace.error.kind}: ${trace.error.message})` : ''}`);
console.log(`steps: ${trace.steps.length}, game time: ${(trace.gameMs / 1000).toFixed(1)} s, real time: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log(`furthest x: ${Math.round(maxX)}, deaths: ${deaths.length} ${deaths.length ? '(at x≈' + deaths.map((d) => Math.round(d.x)).join(', ') + ')' : ''}, won: ${Boolean(last?.after?.won)}`);
if (brain.model !== 'none') {
  const avgLat = trace.steps.reduce((a, s) => a + s.latencyMs, 0) / Math.max(1, trace.steps.length);
  const u = sumUsage(usages);
  console.log(`tokens in/out: ${u.input}/${u.output} (${u.cached} input from cache, ${u.reasoning} reasoning), cost: ${costOf(brain.model, u).toFixed(4)}, avg latency: ${Math.round(avgLat)} ms`);
}
console.log(`trace: ${join(outDir, 'trace.json')}`);
