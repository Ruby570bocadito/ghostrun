// App server: starts swarms, streams them live (Server-Sent Events) and serves the web UI.
// npm run build && npm start  →  http://localhost:5180
//
// GHOSTRUN_PUBLIC=1 turns on the protections for a public demo (src/guard.mjs): links to private or
// local network addresses are refused (and blocked inside the game page), each visitor gets a few
// playtests per hour, the model and run size are fixed, and other people's runs are not listed.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer as startGames } from '../scripts/serve.mjs';
import { runSwarm } from './swarm.mjs';
import { analyze } from './analyze.mjs';
import { explainHotspots } from './explain.mjs';
import { PERSONAS, DEFAULT_PERSONAS } from './personas.mjs';
import { costOf } from './brains/meta.mjs';
import { RateLimiter, checkTarget, clientIp, createRequestGuard } from './guard.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const PORT = Number(process.env.PORT) || 5180;
const GAMES_PORT = Number(process.env.GAMES_PORT) || 5174;
const BUDGET_USD = Number(process.env.GHOST_BUDGET_USD) || 35; // hard stop below Rafa's $40 cap
const PUBLIC = process.env.GHOSTRUN_PUBLIC === '1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // behind a reverse proxy: read X-Forwarded-For
const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS) || 8 * 60_000; // a stuck run must not keep the ghosts busy forever
const RUNS_IN_MEMORY = 30; // older finished runs are served from disk
const HEARTBEAT_MS = 20_000; // keeps live streams open through proxies that close idle connections
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

// Our own test games are served on this machine, so they are the one local address ghosts may open.
const ALLOW_HOSTS = [`localhost:${GAMES_PORT}`, `127.0.0.1:${GAMES_PORT}`];
const PUBLIC_VIEWPORTS = ['640x360', '960x540'];
const runLimiter = new RateLimiter({ limit: Number(process.env.RUNS_PER_HOUR) || 6, windowMs: 60 * 60_000 });
// The SDK's recorder posts a session every 3 s (20 a minute), so this allows a few people per address.
const humanLimiter = new RateLimiter({ limit: 120, windowMs: 60_000 });
const MAX_HUMAN_SESSIONS = 1000;

const runs = new Map();
let activeRun = null;

async function readSpend() {
  try {
    return JSON.parse(await readFile(spendFile, 'utf8'));
  } catch {
    return { totalUsd: 0, runs: 0 };
  }
}

// One update at a time, written to a temporary file and renamed, so a crash never leaves broken JSON.
let spendQueue = Promise.resolve();
function addSpend(usd) {
  spendQueue = spendQueue.then(async () => {
    const spend = await readSpend();
    spend.totalUsd += usd;
    spend.runs = (spend.runs ?? 0) + 1;
    spend.appUsd = (spend.appUsd ?? 0) + usd;
    const tmp = `${spendFile}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(spend, null, 2));
    await rename(tmp, spendFile);
  });
  return spendQueue.catch(() => {});
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const httpError = (status, error, message) => Object.assign(new Error(message), { status, error });

async function readBody(req, limit = 100_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw httpError(413, 'too_large', 'Body too large');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw httpError(400, 'bad_json', 'The request body is not valid JSON.');
  }
}

/** Is `file` inside `dir`? (A plain prefix test would also accept a sibling such as "runs-old".) */
const inside = (dir, file) => file === dir || file.startsWith(dir + sep);

function decodePath(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    throw httpError(400, 'bad_path', 'Malformed address.');
  }
}

const SAFE_ID = /^[a-z0-9-]{1,64}$/i;

function emit(run, event) {
  const e = { ...event, at: Date.now() };
  run.events.push(e);
  const line = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of run.clients) res.write(line);
}

/** After a run, keep only what a late visitor needs (the report, not every frame) and forget old runs. */
function settle(run) {
  run.events = run.events.filter((e) => e.type !== 'frame' && e.type !== 'step');
  const finished = [...runs.values()].filter((r) => r.status === 'done' || r.status === 'failed');
  for (const old of finished.slice(0, Math.max(0, finished.length - RUNS_IN_MEMORY))) runs.delete(old.id);
}

async function startRun({ url, personas, steps, model, viewport, simulateOutage, compareTo, owner, guard }) {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const outDir = join(runsDir, id);
  const run = { id, owner, status: 'running', config: { url, personas, steps, model, viewport, simulateOutage, compareTo }, events: [], clients: new Set(), report: null, controller: new AbortController() };
  runs.set(id, run);
  activeRun = run;
  const timer = setTimeout(() => {
    emit(run, { type: 'notice', message: `Time limit of ${Math.round(RUN_TIMEOUT_MS / 60_000)} minutes reached: the ghosts were stopped.` });
    run.controller.abort();
  }, RUN_TIMEOUT_MS);

  (async () => {
    try {
      const { traces, objectives, ms } = await runSwarm({ url, personas, steps, model, viewport, simulateOutage, compareTo, outDir, guard, signal: run.controller.signal, onEvent: (e) => emit(run, e) });
      run.status = 'analyzing';
      emit(run, { type: 'analyzing' });

      const report = analyze(traces, { objectives });
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
      // Per move, because a ghost can switch to the backup model mid-run.
      const ghostCost = traces.reduce((a, t) => a + t.steps.reduce((b, st) => b + costOf(st.model ?? t.model, st.usage ?? { input: 0, output: 0 }), 0), 0);
      const analystCost = report.analystUsage ? costOf('muse-spark-1.3', report.analystUsage) : 0;
      report.cost = { ghosts: ghostCost, analyst: analystCost, total: ghostCost + analystCost };
      report.realMs = ms;
      report.id = id;
      report.config = run.config;
      await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
      await addSpend(report.cost.total);

      run.report = report;
      run.status = report.failure ? 'failed' : 'done';
      emit(run, { type: 'report', report });
    } catch (err) {
      run.status = 'failed';
      emit(run, { type: 'failed', message: err.message });
    } finally {
      clearTimeout(timer);
      if (activeRun === run) activeRun = null;
      for (const res of run.clients) res.end();
      run.clients.clear();
      settle(run);
    }
  })();
  return run;
}

async function serveFile(res, file, fallback) {
  try {
    const info = await stat(file);
    if (info.isDirectory()) return serveFile(res, join(file, 'index.html'), fallback);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000' : 'no-store' });
    res.end(body);
  } catch {
    if (fallback) return serveFile(res, fallback);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

/** Reads and checks the options of a new run. Returns { error } or the run options. */
async function runOptions(body, ip) {
  let target;
  try {
    target = new URL(String(body.url ?? ''));
    if (!/^https?:$/.test(target.protocol)) throw new Error();
  } catch {
    return { status: 400, error: 'invalid_url', message: 'Paste a full game link that starts with http:// or https://' };
  }
  let guard = null;
  if (PUBLIC) {
    const check = await checkTarget(target.href, { allowHosts: ALLOW_HOSTS });
    if (!check.ok && check.reason === 'unresolvable') return { status: 400, error: 'unresolvable', message: 'We could not find that website. Check the link.' };
    if (!check.ok) return { status: 400, error: 'private_url', message: 'This link points to a private or local network address. The public demo only opens games on the internet, or our test games.' };
    guard = createRequestGuard({ allowHosts: ALLOW_HOSTS });
  }
  const maxPersonas = PUBLIC ? 5 : 8;
  const personas = (Array.isArray(body.personas) && body.personas.length ? body.personas : DEFAULT_PERSONAS).filter((p) => PERSONAS[p]).slice(0, maxPersonas);
  const steps = Math.max(5, Math.min(PUBLIC ? 60 : 80, Number(body.steps) || 40));
  const vp = String(body.viewport ?? '640x360');
  const [vw, vh] = vp.split('x').map(Number);
  const okViewport = PUBLIC ? PUBLIC_VIEWPORTS.includes(vp) : vw >= 320 && vw <= 1600 && vh >= 180 && vh <= 1000;
  const viewport = okViewport ? { width: vw, height: vh } : { width: 640, height: 360 };
  // Test option (labelled in the UI and the report): the first ghost's model fails from its 6th move.
  // Not in the public demo: the backup model costs about 10 times more per move.
  const simulateOutage = body.simulateOutage && !PUBLIC ? { ghost: personas[0], fromCall: 6 } : null;
  const compareTo = SAFE_ID.test(String(body.compareTo ?? '')) && existsSync(join(runsDir, body.compareTo, 'report.json')) ? body.compareTo : null;
  const model = PUBLIC ? undefined : body.model; // the public demo always uses the default model
  return { url: target.href, personas, steps, model, viewport, simulateOutage, compareTo, guard, owner: ip };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const ip = clientIp(req, TRUST_PROXY);

    // Human playtests recorded by the SDK (games opened with ?human=1). Sent as a CORS "simple request"
    // from the games origin, so the response is opaque to the page; it only needs to be stored.
    if (path === '/api/human') {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        return res.end();
      }
      if (req.method === 'POST') {
        if (PUBLIC && !humanLimiter.take(ip).ok) return send(res, 429, { error: 'rate_limited' }, cors);
        const data = await readBody(req, 400_000);
        if (!SAFE_ID.test(String(data.id)) || !SAFE_ID.test(String(data.game)) || !SAFE_ID.test(String(data.variant))) {
          return send(res, 400, { error: 'invalid_session' }, cors);
        }
        const dir = join(runsDir, 'humans');
        await mkdir(dir, { recursive: true });
        const file = join(dir, `${data.id}.json`);
        if (PUBLIC && !existsSync(file) && (await readdir(dir)).length >= MAX_HUMAN_SESSIONS) return send(res, 507, { error: 'full' }, cors);
        await writeFile(file, JSON.stringify({ ...data, receivedAt: new Date().toISOString() }, null, 2));
        res.writeHead(204, cors);
        return res.end();
      }
    }
    if (path === '/api/humans' && req.method === 'GET') {
      if (PUBLIC) return send(res, 404, { error: 'not_found' }); // people's sessions are not public
      const dir = join(runsDir, 'humans');
      const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
      const list = [];
      for (const f of files) {
        const h = JSON.parse(await readFile(join(dir, f), 'utf8'));
        list.push({ id: h.id, game: h.game, variant: h.variant, player: h.player, outcome: h.outcome, durationMs: h.durationMs, deaths: h.events.filter((e) => e.type === 'death').length, startedAt: h.startedAt });
      }
      return send(res, 200, list.sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
    }

    if (path === '/api/config' && req.method === 'GET') {
      const spend = await readSpend();
      return send(res, 200, {
        personas: Object.values(PERSONAS),
        defaultPersonas: DEFAULT_PERSONAS,
        games: TEST_GAMES.map((g) => ({ ...g, url: `http://localhost:${GAMES_PORT}/${g.id}/` })),
        model: process.env.GHOST_MODEL || 'muse-ember-1.0',
        hasKey: Boolean(process.env.MODEL_API_KEY),
        public: PUBLIC,
        budget: { capUsd: BUDGET_USD, spentUsd: spend.totalUsd },
        busy: activeRun ? activeRun.id : null,
      });
    }

    if (path === '/api/runs' && req.method === 'POST') {
      const body = await readBody(req);
      const opts = await runOptions(body, ip);
      if (opts.error) return send(res, opts.status, { error: opts.error, message: opts.message });
      if (!process.env.MODEL_API_KEY) return send(res, 503, { error: 'no_key', message: 'The server has no MODEL_API_KEY.' });
      if (activeRun) return send(res, 409, { error: 'busy', message: 'Ghosts are already playing another game. Wait for that run to finish.', runId: activeRun.id });
      const spend = await readSpend();
      if (spend.totalUsd >= BUDGET_USD) return send(res, 402, { error: 'budget', message: `Spending cap of $${BUDGET_USD} reached.` });
      if (PUBLIC) {
        const limit = runLimiter.take(ip);
        if (!limit.ok) {
          const minutes = Math.ceil(limit.retryAfterMs / 60_000);
          return send(res, 429, { error: 'rate_limited', message: `You have started several playtests in a short time. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
        }
      }
      const run = await startRun(opts);
      return send(res, 202, { id: run.id });
    }

    const m = path.match(/^\/api\/runs\/([\w-]+)(\/stream|\/stop)?$/);
    if (m) {
      const [, id, sub] = m;
      const run = runs.get(id);
      if (sub === '/stream') {
        if (!run) {
          // Finished run from a previous server session (or forgotten from memory): replay only the report.
          const report = SAFE_ID.test(id) ? JSON.parse(await readFile(join(runsDir, id, 'report.json'), 'utf8').catch(() => 'null')) : null;
          if (!report) return send(res, 404, { error: 'not_found' });
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          res.end(`data: ${JSON.stringify({ type: 'report', report })}\n\n`);
          return;
        }
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        for (const e of run.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
        if (run.status === 'done' || run.status === 'failed') return res.end();
        run.clients.add(res);
        req.on('close', () => run.clients.delete(res));
        return;
      }
      if (sub === '/stop' && req.method === 'POST') {
        if (PUBLIC && run && run.owner !== ip) return send(res, 403, { error: 'forbidden', message: 'Only whoever started this run can stop it.' });
        run?.controller.abort();
        return send(res, 200, { ok: true });
      }
      if (run) return send(res, 200, { id, status: run.status, config: run.config, report: run.report });
      const report = SAFE_ID.test(id) ? JSON.parse(await readFile(join(runsDir, id, 'report.json'), 'utf8').catch(() => 'null')) : null;
      return report ? send(res, 200, { id, status: 'done', config: report.config, report }) : send(res, 404, { error: 'not_found' });
    }

    if (path === '/api/runs' && req.method === 'GET') {
      if (PUBLIC) return send(res, 404, { error: 'not_found' }); // other visitors' game links are private
      const dirs = (await readdir(runsDir).catch(() => [])).filter((d) => !d.startsWith('_')).sort().reverse();
      const list = [];
      for (const d of dirs.slice(0, 30)) {
        const r = JSON.parse(await readFile(join(runsDir, d, 'report.json'), 'utf8').catch(() => 'null'));
        if (r?.config) list.push({ id: d, url: r.config.url, ghosts: r.ghostsTotal, hotspots: r.hotspots.length, blockers: r.hotspots.filter((h) => h.type === 'blocker').length });
      }
      return send(res, 200, list);
    }

    if (path.startsWith('/runs/')) {
      const rel = decodePath(path.slice('/runs/'.length));
      const file = normalize(join(runsDir, rel));
      if (!inside(runsDir, file)) return send(res, 403, { error: 'forbidden' });
      // Bookkeeping files and people's recorded sessions are not served in the public demo.
      const first = normalize(rel).split(/[\\/]/)[0];
      if (PUBLIC && (first.startsWith('_') || first === 'humans')) return send(res, 404, { error: 'not_found' });
      return serveFile(res, file);
    }

    const file = normalize(join(distDir, decodePath(path)));
    if (!inside(distDir, file)) return send(res, 403, { error: 'forbidden' });
    return serveFile(res, file, join(distDir, 'index.html'));
  } catch (err) {
    if (!res.headersSent) send(res, err.status ?? 500, { error: err.error ?? 'server_error', message: err.message });
    else res.end();
  }
});

// Live streams: a comment line every 20 s so proxies do not close a quiet connection.
setInterval(() => {
  for (const run of runs.values()) for (const res of run.clients) res.write(': ping\n\n');
}, HEARTBEAT_MS).unref();

// Stop cleanly on restarts: the ghosts stop, the browsers close, the report of a finished run is kept.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    activeRun?.controller.abort();
    server.close();
    setTimeout(() => process.exit(0), activeRun ? 5000 : 0).unref();
  });
}

await mkdir(runsDir, { recursive: true });
try {
  await startGames(GAMES_PORT);
} catch (err) {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log(`Port ${GAMES_PORT} is busy: assuming the test games are already being served there.`);
}
server.listen(PORT, () => {
  console.log(`Ghostrun on http://localhost:${PORT}  (test games on http://localhost:${GAMES_PORT}/)${PUBLIC ? '  [public demo mode]' : ''}`);
  if (!process.env.MODEL_API_KEY) console.log('Warning: MODEL_API_KEY is not set; ghosts cannot play.');
});
