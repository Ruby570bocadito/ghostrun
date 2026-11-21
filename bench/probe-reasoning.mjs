// Experiment: what makes the ghost reason (and pay) more? Rebuilds the exact request of recorded
// moves (same screenshot, same move log, same notes) and re-sends it with one thing changed at a
// time, measuring reasoning and output tokens. Costs only; decisions are judged by the benchmark.
// MODEL_API_KEY=... node bench/probe-reasoning.mjs <bench label> [perGame=10]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { buildMessages, historyWindow, moveSchema, systemPrompt, CACHE_KEY } from '../src/brains/meta.mjs';
import { historyLine } from '../src/feedback.mjs';
import { PERSONAS } from '../src/personas.mjs';

const label = process.argv[2] ?? 'optimized-v3';
const perGame = Number(process.argv[3] ?? 10);
const api = new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2 });

const CALIBRATE = 'After each action you are told what happened (how far you moved, if you died or reached something). Use it to judge distances and timing.';
// The log as it was before this change: last 6 moves, no "→ what happened".
const OLD = (l) => l.replace(/ → [^.]*\./, '.');
const VARIANTS = process.env.SET === 'log' ? {
  recorded: (c) => c,
  'log of 6 with results': (c) => ({ ...c, lines: c.lines.slice(-6) }),
  'log of 6, no results (old style)': (c) => ({ ...c, lines: c.lines.slice(-6).map(OLD), notes: [] }),
} : {
  recorded: (c) => c,
  'no speed note': (c) => ({ ...c, notes: c.notes.filter((n) => !n.startsWith('Measured from your moves')) }),
  'log of 12': (c) => ({ ...c, lines: historyWindow(c.lines, 12, 6) }),
  'no "judge distances"': (c) => ({ ...c, system: c.system.replace(CALIBRATE, 'After each action you are told what happened.') }),
  'all three': (c) => ({
    ...c,
    notes: c.notes.filter((n) => !n.startsWith('Measured from your moves')),
    lines: historyWindow(c.lines, 12, 6),
    system: c.system.replace(CALIBRATE, 'After each action you are told what happened.'),
  }),
};

// 1) Rebuild recorded requests (moves 12+ so the log is long, spread over each game).
const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
const cases = [];
for (const game of [...new Set(results.map((r) => r.game))]) {
  const pool = [];
  for (const r of results.filter((x) => x.game === game && x.dir)) {
    for (const p of ['newbie', 'speedrunner', 'reader', 'impatient']) {
      const f = join(r.dir, p, 'trace.json');
      if (!existsSync(f)) continue;
      const t = JSON.parse(await readFile(f, 'utf8'));
      const lines = [];
      for (const s of t.steps) {
        if (s.step >= 12 && s.frames) {
          const frame = t.frames[Math.max(0, s.frames[0] - 1)];
          pool.push({ game, persona: p, step: s.step, file: join(r.dir, p, frame.file), lines: [...lines], notes: s.notes ?? [], viewport: t.viewport, recorded: s.usage });
        }
        lines.push(historyLine(s.step, { ...s.move, thought: s.thought }, s.outcome));
      }
    }
  }
  const stride = Math.max(1, Math.floor(pool.length / perGame));
  cases.push(...pool.filter((_, i) => i % stride === 0).slice(0, perGame));
}

// 2) Re-send each case under each variant.
const rows = [];
async function send(c, name) {
  const { width: w, height: h } = c.viewport;
  const base = { system: systemPrompt(PERSONAS[c.persona], null, w, h), lines: c.lines, notes: c.notes };
  const v = VARIANTS[name](base);
  const res = await api.chat.completions.create({
    model: 'muse-ember-1.0',
    reasoning_effort: 'minimal',
    max_tokens: 1200,
    prompt_cache_key: CACHE_KEY,
    messages: buildMessages({ system: v.system, history: v.lines, screenshot: await readFile(c.file), notes: v.notes }),
    response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema: moveSchema(w, h) } },
  });
  const u = res.usage;
  rows.push({ variant: name, game: c.game, input: u.prompt_tokens, cached: u.prompt_tokens_details?.cached_tokens ?? 0, output: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0 });
}
const queue = cases.flatMap((c) => Object.keys(VARIANTS).map((name) => () => send(c, name)));
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) await queue.shift()().catch((e) => console.error(e.message));
  }),
);

// 3) Summary.
const lines = [`# What makes the ghost reason more? (${cases.length} recorded moves from ${label}, re-sent per variant)`, '', '| Variant | Input tokens | Output tokens | Reasoning tokens | Cost per move |', '|---|---|---|---|---|'];
for (const name of Object.keys(VARIANTS)) {
  const r = rows.filter((x) => x.variant === name);
  const mean = (k) => r.reduce((a, x) => a + x[k], 0) / Math.max(1, r.length);
  const cost = ((mean('input') - mean('cached')) * 0.1 + mean('cached') * 0.004 + mean('output') * 0.5) / 1e6;
  lines.push(`| ${name} | ${mean('input').toFixed(0)} | ${mean('output').toFixed(0)} | ${mean('reasoning').toFixed(0)} | $${(cost * 1e6).toFixed(0)} per million moves → $${cost.toFixed(6)} |`);
}
await writeFile(join('bench', 'results', 'probe-reasoning.md'), lines.join('\n') + '\n');
await writeFile(join('bench', 'results', 'probe-reasoning.json'), JSON.stringify(rows, null, 2));
console.log(lines.join('\n'));
