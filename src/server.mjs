// App server: starts swarms, streams them live (Server-Sent Events) and serves the web UI.
// npm run build && npm start  →  http://localhost:5180
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer as startGames } from '../scripts/serve.mjs';
import { runSwarm } from './swarm.mjs';
import { analyze } from './analyze.mjs';
import { explainHotspots } from './explain.mjs';
import { PERSONAS, DEFAULT_PERSONAS } from './personas.mjs';
import { costOf } from './brains/meta.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const PORT = Number(process.env.PORT) || 5180;
const GAMES_PORT = Number(process.env.GAMES_PORT) || 5174;
const BUDGET_USD = Number(process.env.GHOST_BUDGET_USD) || 35; // hard stop below Rafa's $40 cap
const runsDir = resolve('runs');
const distDir = resolve('web', 'dist');
const spendFile = join(runsDir, '_spend.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// Test games shipped in games/. Their injected faults are read from games/<id>/faults.json.
const TEST_GAMES = [
  { id: 'gap-run', name: 'Gap Run', kind: 'Platformer', description: 'Run right and jump three gaps to reach the flag.' },
  { id: 'key-hunt', name: 'Key Hunt', kind: 'Top-down puzzle', description: 'Find the key, open the door, reach the exit.' },
  { id: 'lever-room', name: 'Lever Room', kind: 'Platformer puzzle', description: 'Pull a lever to open the door to the flag.' },
  { id: 'spike-maze', name: 'Spike Maze', kind: 'Top-down maze', description: 'Cross a maze without touching the spikes.' },
  { id: 'read-me', name: 'Read Me', kind: 'Platformer', description: 'Jump and dash over a wide pit.' },
];
for (const g of TEST_GAMES) {
  const faults = JSON.parse(await readFile(join('games', g.id, 'faults.json'), 'utf8').catch(() => '{}'));
  g.faults = Object.entries(faults).map(([id, f]) => ({ id, label: f.label, type: f.type }));
}

const runs = new Map();
let activeRun = null;

async function readSpend() {
  try {
    return JSON.parse(await readFile(spendFile, 'utf8'));
  } catch {
    return { totalUsd: 0, runs: 0 };
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw Object.assign(new Error('Body too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

function emit(run, event) {
  const e = { ...event, at: Date.now() };
  run.events.push(e);
  const line = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of run.clients) res.write(line);
}

async function startRun({ url, personas, steps, model }) {
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 6);
  const outDir = join(runsDir, id);
  const run = { id, status: 'running', config: { url, personas, steps, model }, events: [], clients: new Set(), report: null, controller: new AbortController() };
  runs.set(id, run);
  activeRun = run;

  (async () => {
    try {
      const { traces, ms } = await runSwarm({ url, personas, steps, model, outDir, signal: run.controller.signal, onEvent: (e) => emit(run, e) });
      run.status = 'analyzing';
      emit(run, { type: 'analyzing' });

      const report = analyze(traces);
      const failed = report.ghosts.filter((g) => g.outcome === 'error');
      if (failed.length === report.ghosts.length) {
        const err = failed[0].error;
        report.failure = { kind: err.kind, message: err.message };
      } else if (report.hotspots.length) {
        try {
          const { cards, usage } = await explainHotspots(report, { runDir: outDir, traces });
          report.cards = cards;
          report.analystUsage = usage;
        } catch (err) {
          // The analyst is optional: hotspots stand on their own evidence.
          report.cards = [];
          report.analystError = err.message;
        }
      }
      const ghostCost = report.ghosts.reduce((a, g) => a + costOf(g.model, { input: g.tokensIn, output: g.tokensOut }), 0);
      const analystCost = report.analystUsage ? costOf('muse-spark-1.3', report.analystUsage) : 0;
      report.cost = { ghosts: ghostCost, analyst: analystCost, total: ghostCost + analystCost };
      report.realMs = ms;
      report.id = id;
      report.config = run.config;
      await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

      const spend = await readSpend();
      spend.totalUsd += report.cost.total;
      spend.runs += 1;
      await writeFile(spendFile, JSON.stringify(spend, null, 2));

      run.report = report;
      run.status = report.failure ? 'failed' : 'done';
      emit(run, { type: 'report', report });
    } catch (err) {
      run.status = 'failed';
      emit(run, { type: 'failed', message: err.message });
    } finally {
      if (activeRun === run) activeRun = null;
      for (const res of run.clients) res.end();
      run.clients.clear();
    }
  })();
  return run;
}

async function serveFile(res, file, fallback) {
  try {
    const info = await stat(file);
    if (info.isDirectory()) return serveFile(res, join(file, 'index.html'), fallback);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes(`${normalize('/assets/')}`) ? 'public, max-age=31536000' : 'no-store' });
    res.end(body);
  } catch {
    if (fallback) return serveFile(res, fallback);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  try {
    if (path === '/api/config' && req.method === 'GET') {
      const spend = await readSpend();
      return send(res, 200, {
        personas: Object.values(PERSONAS),
        defaultPersonas: DEFAULT_PERSONAS,
        games: TEST_GAMES.map((g) => ({ ...g, url: `http://localhost:${GAMES_PORT}/${g.id}/` })),
        model: process.env.GHOST_MODEL || 'muse-ember-1.0',
        hasKey: Boolean(process.env.MODEL_API_KEY),
        budget: { capUsd: BUDGET_USD, spentUsd: spend.totalUsd },
        busy: activeRun ? activeRun.id : null,
      });
    }

    if (path === '/api/runs' && req.method === 'POST') {
      const body = await readBody(req);
      let target;
      try {
        target = new URL(String(body.url ?? ''));
        if (!/^https?:$/.test(target.protocol)) throw new Error();
      } catch {
        return send(res, 400, { error: 'invalid_url', message: 'Paste a full game link that starts with http:// or https://' });
      }
      if (!process.env.MODEL_API_KEY) return send(res, 503, { error: 'no_key', message: 'The server has no MODEL_API_KEY.' });
      if (activeRun) return send(res, 409, { error: 'busy', message: 'Ghosts are already playing another game. Wait for that run to finish.', runId: activeRun.id });
      const spend = await readSpend();
      if (spend.totalUsd >= BUDGET_USD) return send(res, 402, { error: 'budget', message: `Spending cap of $${BUDGET_USD} reached.` });
      const personas = (Array.isArray(body.personas) && body.personas.length ? body.personas : DEFAULT_PERSONAS).filter((p) => PERSONAS[p]).slice(0, 8);
      const steps = Math.max(5, Math.min(80, Number(body.steps) || 40));
      const run = await startRun({ url: target.href, personas, steps, model: body.model });
      return send(res, 202, { id: run.id });
    }

    const m = path.match(/^\/api\/runs\/([\w-]+)(\/stream|\/stop)?$/);
    if (m) {
      const [, id, sub] = m;
      const run = runs.get(id);
      if (sub === '/stream') {
        if (!run) {
          // Finished run from a previous server session: replay only the report.
          const report = JSON.parse(await readFile(join(runsDir, id, 'report.json'), 'utf8').catch(() => 'null'));
          if (!report) return send(res, 404, { error: 'not_found' });
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          res.end(`data: ${JSON.stringify({ type: 'report', report })}\n\n`);
          return;
        }
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        for (const e of run.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
        if (run.status === 'done' || run.status === 'failed') return res.end();
        run.clients.add(res);
        req.on('close', () => run.clients.delete(res));
        return;
      }
      if (sub === '/stop' && req.method === 'POST') {
        run?.controller.abort();
        return send(res, 200, { ok: true });
      }
      if (run) return send(res, 200, { id, status: run.status, config: run.config, report: run.report });
      const report = JSON.parse(await readFile(join(runsDir, id, 'report.json'), 'utf8').catch(() => 'null'));
      return report ? send(res, 200, { id, status: 'done', config: report.config, report }) : send(res, 404, { error: 'not_found' });
    }

    if (path === '/api/runs' && req.method === 'GET') {
      const dirs = (await readdir(runsDir).catch(() => [])).filter((d) => !d.startsWith('_')).sort().reverse();
      const list = [];
      for (const d of dirs.slice(0, 30)) {
        const r = JSON.parse(await readFile(join(runsDir, d, 'report.json'), 'utf8').catch(() => 'null'));
        if (r?.config) list.push({ id: d, url: r.config.url, ghosts: r.ghostsTotal, hotspots: r.hotspots.length, blockers: r.hotspots.filter((h) => h.type === 'blocker').length });
      }
      return send(res, 200, list);
    }

    if (path.startsWith('/runs/')) {
      const file = normalize(join(runsDir, decodeURIComponent(path.slice('/runs/'.length))));
      if (!file.startsWith(runsDir)) return send(res, 403, { error: 'forbidden' });
      return serveFile(res, file);
    }

    const file = normalize(join(distDir, decodeURIComponent(path)));
    if (!file.startsWith(distDir)) return send(res, 403, { error: 'forbidden' });
    return serveFile(res, file, join(distDir, 'index.html'));
  } catch (err) {
    send(res, err.status ?? 500, { error: 'server_error', message: err.message });
  }
});

await mkdir(runsDir, { recursive: true });
try {
  await startGames(GAMES_PORT);
} catch (err) {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log(`Port ${GAMES_PORT} is busy: assuming the test games are already being served there.`);
}
server.listen(PORT, () => {
  console.log(`Ghost Players on http://localhost:${PORT}  (test games on http://localhost:${GAMES_PORT}/)`);
  if (!process.env.MODEL_API_KEY) console.log('Warning: MODEL_API_KEY is not set; ghosts cannot play.');
});
