// Builds the free static demo: the web app in demo mode (VITE_DEMO=1) plus recorded real runs, each with
// its report, the ghosts' traces and frames, ready for any static host (a static Hugging Face Space).
// A run compared with an earlier one brings that one too. No API calls, nothing is played again.
// node scripts/export-demo.mjs <outDir> <runId>...
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PERSONAS } from '../src/personas.mjs';
import { buildIssues } from '../web/src/issues.js';

const [outArg, ...picked] = process.argv.slice(2);
if (!outArg || !picked.length) {
  console.error('Usage: node scripts/export-demo.mjs <outDir> <runId>...');
  process.exit(1);
}
const out = resolve(outArg);
const GAMES = { 'gap-run': 'Gap Run', 'key-hunt': 'Key Hunt', 'lever-room': 'Lever Room', 'read-me': 'Read Me', 'spike-maze': 'Spike Maze' };
const TYPE = { blocker: 'blocker', missed: 'missed objective', stuck: 'stuck', hard_to_see: 'hard to see', confusion: 'confusing', friction: 'friction' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Real jam games by other people that the demo may show (open licences), credited by name.
const CREDITS = {
  spacetaxi: 'SPACETAXI by Christoph Schansky (js13kGames 2021, GPL-3.0)',
  'escape-from-death-hole': 'Escape from Death Hole by Santi Herranz (js13kGames 2022, MIT)',
  'find-all-pages': 'Find All Pages by Stacks Hub (js13kGames 2020, MIT)',
  'dead-again': 'DEAD AGAIN by Jonas Olmstead (js13kGames 2022, MIT)',
};

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
      : CREDITS[url.split('/').filter(Boolean).pop()]
        ? `${CREDITS[url.split('/').filter(Boolean).pop()]}: a real jam game, no SDK`
      : `${GAMES[game] ?? url}${fault ? ', with its planted flaw' : ''}${r.config?.compareTo ? ', fixed: compared with the run before' : ''}${r.config?.simulateOutage ? ', during a simulated AI outage' : ''}`;
  // The same problems the report lists (web/src/issues.js), so the card and the report say the same thing.
  const { issues, fair } = buildIssues(r);
  const finished = (r.ghosts ?? []).filter((g) => g.outcome === 'won').length;
  const label = (i) => (i.kind === 'goal' ? `${i.unclear.length} of ${i.asked} ghosts never worked out the goal` : TYPE[i.primary.type] ?? i.primary.type);
  const shows = r.failure
    ? `Caught before any AI call: "${r.failure.message}"`
    : issues.length
      ? `Found: ${[...new Set(issues.map(label))].join(', ')}`
      : fair.length
        ? `Nothing to fix: ${plural(fair.length, 'fair challenge')}`
        : `Nothing to fix: ${finished}/${r.ghostsTotal} ghosts finished`;
  const stats = r.failure
    ? '$0'
    : `${plural(issues.length, 'problem')} to fix · ${finished}/${r.ghostsTotal} finished · ${Math.round((r.realMs ?? 0) / 1000)} s · $${(r.cost?.total ?? 0).toFixed(3)}`;
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
      // The frame with the most on it (the biggest JPEG) makes a better thumbnail than a mostly dark one.
      const trace = JSON.parse(await readFile(join(dir, 'trace.json'), 'utf8'));
      let best = null;
      for (const f of trace.frames.filter((_, i) => i % 5 === 0)) {
        const size = (await stat(join(dir, f.file)).catch(() => ({ size: 0 }))).size;
        if (!best || size > best.size) best = { f, size };
      }
      if (best) thumb = `/runs/${id}/${g.persona}/${best.f.file}`;
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
    recordedOn: (() => {
      const days = all.map((id) => Date.parse(id.slice(0, 10)));
      const fmt = (t, o) => new Date(t).toLocaleDateString('en-GB', o);
      const [a, b] = [Math.min(...days), Math.max(...days)];
      return a === b ? fmt(a, { day: 'numeric', month: 'long', year: 'numeric' }) : `${fmt(a, { day: 'numeric' })}–${fmt(b, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    })(),
  }),
);
console.log(`demo ready in ${out}: ${demoRuns.length} playtests (+${all.length - demoRuns.length} earlier runs they are compared with)`);
