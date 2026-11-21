// Experiment: does a smaller screenshot save money without hurting what the ghost sees?
// Takes recorded frames where the game (SDK) says where the character really is, asks Ember for a
// move at 640x360 and at a smaller size, and compares the character position it reports (scaled
// back to 640x360) with the truth. Also records the tokens each size costs. ~80 calls, about 1 cent.
// MODEL_API_KEY=... node bench/probe-image.mjs <bench label> [perGame=8] [480x270]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import { buildMessages, moveSchema, systemPrompt, CACHE_KEY } from '../src/brains/meta.mjs';
import { PERSONAS } from '../src/personas.mjs';

const label = process.argv[2] ?? 'before-cache';
const perGame = Number(process.argv[3] ?? 8);
const [sw, sh] = (process.argv[4] ?? '480x270').split('x').map(Number);
const SIZES = [
  [640, 360],
  [sw, sh],
];
const api = new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2 });

// 1) Frames with a visible character and its true screen position.
const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
const byGame = {};
for (const r of results.filter((x) => x.dir)) {
  for (const p of ['newbie', 'speedrunner', 'reader', 'impatient']) {
    const f = join(r.dir, p, 'trace.json');
    if (!existsSync(f)) continue;
    const t = JSON.parse(await readFile(f, 'utf8'));
    const deaths = t.events.filter((e) => e.type === 'death').map((e) => e.t);
    for (const s of t.steps) {
      const seen = t.frames[Math.max(0, (s.frames?.[0] ?? 1) - 1)];
      const st = seen?.state;
      if (!st || !Number.isFinite(st.screenX) || st.screenX < 0 || st.screenX > 640 || st.screenY < 0 || st.screenY > 356) continue;
      if (deaths.some((d) => seen.pageT >= d && seen.pageT <= d + 250)) continue;
      (byGame[r.game] ??= []).push({ game: r.game, file: join(r.dir, p, seen.file), truth: { x: st.screenX, y: st.screenY } });
    }
  }
}
const sample = Object.values(byGame).flatMap((list) => {
  const step = Math.max(1, Math.floor(list.length / perGame));
  return list.filter((_, i) => i % step === 0).slice(0, perGame);
});

// 2) Resize in a headless browser (no image library needed).
const browser = await chromium.launch();
const page = await browser.newPage();
async function resized(buf, w, h) {
  if (w === 640) return buf;
  const b64 = await page.evaluate(
    async ({ src, w, h }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.7).split(',')[1];
    },
    { src: `data:image/jpeg;base64,${buf.toString('base64')}`, w, h },
  );
  return Buffer.from(b64, 'base64');
}

// 3) Ask for a move at each size.
const rows = [];
async function probe(item, [w, h]) {
  const shot = await resized(await readFile(item.file), w, h);
  const res = await api.chat.completions.create({
    model: 'muse-ember-1.0',
    reasoning_effort: 'minimal',
    max_tokens: 1200,
    prompt_cache_key: CACHE_KEY,
    messages: buildMessages({ system: systemPrompt(PERSONAS.newbie, null, w, h), history: [], screenshot: shot }),
    response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema: moveSchema(w, h) } },
  });
  const move = JSON.parse(res.choices[0].message.content);
  const k = 640 / w;
  const err = move.player ? Math.hypot(move.player.x * k - item.truth.x, move.player.y * k - item.truth.y) : Infinity;
  rows.push({ game: item.game, size: `${w}x${h}`, err, input: res.usage.prompt_tokens, cached: res.usage.prompt_tokens_details?.cached_tokens ?? 0, output: res.usage.completion_tokens });
}
const queue = sample.flatMap((item) => SIZES.map((s) => () => probe(item, s)));
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) await queue.shift()().catch((e) => console.error(e.message));
  }),
);
await browser.close();

// 4) Summary per size.
const lines = [`# Screenshot size probe (${label}, ${sample.length} frames with a visible character)`, '', '| Size | Within 40 px | Median error | Input tokens | Output tokens |', '|---|---|---|---|---|'];
for (const [w, h] of SIZES) {
  const r = rows.filter((x) => x.size === `${w}x${h}`);
  const errs = r.map((x) => x.err).sort((a, b) => a - b);
  const mean = (k) => Math.round(r.reduce((a, x) => a + x[k], 0) / Math.max(1, r.length));
  lines.push(`| ${w}x${h} | ${Math.round((r.filter((x) => x.err <= 40).length / Math.max(1, r.length)) * 100)}% | ${Math.round(errs[Math.floor(errs.length / 2)])} px | ${mean('input')} | ${mean('output')} |`);
}
lines.push('', 'Errors are measured at 640x360 (smaller answers scaled up). Same prompt, no move history.');
await writeFile(join('bench', 'results', `probe-image-${sw}x${sh}.md`), lines.join('\n') + '\n');
await writeFile(join('bench', 'results', `probe-image-${sw}x${sh}.json`), JSON.stringify(rows, null, 2));
console.log(lines.join('\n'));
