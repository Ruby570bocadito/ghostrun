// Builds the free static demo: the web app in demo mode (VITE_DEMO=1) plus recorded real runs, each with
// its report, the ghosts' traces and frames, ready for any static host (a static Hugging Face Space).
// A run compared with an earlier one brings that one too. No API calls, nothing is played again.
// node scripts/export-demo.mjs <outDir> <runId>...
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PERSONAS } from '../src/personas.mjs';

const [outArg, ...picked] = process.argv.slice(2);
if (!outArg || !picked.length) {
  console.error('Usage: node scripts/export-demo.mjs <outDir> <runId>...');
  process.exit(1);
}
const out = resolve(outArg);
const GAMES = { 'gap-run': 'Gap Run', 'key-hunt': 'Key Hunt', 'lever-room': 'Lever Room', 'read-me': 'Read Me', 'spike-maze': 'Spike Maze' };
const TYPE = { blocker: 'blocker', missed: 'missed objective', stuck: 'stuck', hard_to_see: 'hard to see', confusion: 'confusing', friction: 'friction' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// 1) The web app, built in demo mode straight into the output folder.
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'], { stdio: 'inherit', env: { ...process.env, VITE_DEMO: '1' } });

const readReport = async (id) => JSON.parse(await readFile(join('runs', id, 'report.json'), 'utf8'));
const describe = (id, r) => {
  const url = r.config?.url ?? '';
  const game = Object.keys(GAMES).find((g) => url.includes(`/${g}/`));
  const fault = url.match(/[?&]fault=([\w-]+)/)?.[1];
  const title = r.failure
    ? 'A link that is not a game'
    : url.includes('nilo')
      ? 'NILO, a real jam game we did not make (no SDK)'
      : `${GAMES[game] ?? url}${fault ? ', with its planted flaw' : ''}${r.config?.compareTo ? ', fixed: compared with the run before' : ''}${r.config?.simulateOutage ? ', during a simulated AI outage' : ''}`;
  const shown = (r.findings ?? []).filter((f) => f.severity !== 'low');
  const critical = shown.filter((f) => ['blocker', 'missed', 'stuck', 'hard_to_see'].includes(f.type) && f.severity === 'high').length;
  const finished = (r.ghosts ?? []).filter((g) => g.outcome === 'won').length;
  const shows = r.failure
    ? `Caught before any AI call: "${r.failure.message}"`
    : shown.length
      ? `Found: ${[...new Set(shown.map((f) => TYPE[f.type] ?? f.type))].join(', ')}`
      : 'Nothing worth reporting';
  const stats = r.failure
    ? '$0'
    : `${plural(critical, 'critical issue')} · ${finished}/${r.ghostsTotal} finished · ${Math.round((r.realMs ?? 0) / 1000)} s · $${(r.cost?.total ?? 0).toFixed(3)}`;
  return { id, title, shows, stats };
};

// 2) The runs: report (as the server would answer it), traces and frames.
const all = [...picked];
for (const id of picked) {
  const before = (await readReport(id)).config?.compareTo;
  if (before && !all.includes(before)) all.push(before);
}
const demoRuns = [];
for (const id of all) {
  const report = await readReport(id);
  await mkdir(join(out, 'demo', 'runs'), { recursive: true });
  await writeFile(join(out, 'demo', 'runs', `${id}.json`), JSON.stringify({ id, status: report.failure ? 'failed' : 'done', config: report.config, report }));
  let thumb = null;
  for (const g of report.ghosts ?? []) {
    const dir = join('runs', id, g.persona);
    if (!existsSync(dir)) continue;
    await cp(dir, join(out, 'runs', id, g.persona), { recursive: true });
    if (!thumb) {
      const trace = JSON.parse(await readFile(join(dir, 'trace.json'), 'utf8'));
      const f = trace.frames[Math.floor(trace.frames.length * 0.4)];
      if (f) thumb = `/runs/${id}/${g.persona}/${f.file}`;
    }
  }
  if (picked.includes(id)) demoRuns.push({ ...describe(id, report), thumb });
  console.log(`exported ${id}`);
}

// 3) What the app asks the server for at start.
await writeFile(
  join(out, 'demo', 'config.json'),
  JSON.stringify({
    personas: Object.values(PERSONAS),
    games: [],
    model: 'muse-ember-1.0',
    hasKey: false,
    public: true,
    budget: { capUsd: 0, spentUsd: 0 },
    demoRuns,
    recordedOn: new Date(Math.min(...all.map((id) => Date.parse(id.slice(0, 10))))).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  }),
);
console.log(`demo ready in ${out}: ${demoRuns.length} playtests (+${all.length - demoRuns.length} earlier runs they are compared with)`);
