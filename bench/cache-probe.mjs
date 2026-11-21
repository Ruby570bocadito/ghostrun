// Where does Meta put the JSON schema in the prompt, and how well does the prefix cache hit?
// Controlled calls with a fresh nonce so earlier traffic cannot pollute the result. ~20 calls, < 1 cent.
// MODEL_API_KEY=... node bench/cache-probe.mjs <frames dir>
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { moveSchema } from '../src/brains/meta.mjs';

const dir = process.argv[2];
const api = new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2 });
const model = 'muse-ember-1.0';
const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
const frames = await Promise.all([30, 40, 50, 60, 70].map((i) => readFile(join(dir, files[i]))));
const nonce = () => randomUUID().slice(0, 8);
const rules = 'You are a playtester. You are playing a web game you have never seen before. Each turn you get one screenshot. The game is PAUSED while you think. It only moves forward for the duration_ms you choose, while your keys are held. Keep actions short near danger. Answer only with the JSON object.';
const schemaA = moveSchema(640, 360);
const schemaB = { ...schemaA, properties: { ...schemaA.properties, thought: { ...schemaA.properties.thought, description: `Changed ${nonce()}: ${schemaA.properties.thought.description}` } } };

async function call(label, { system, schema = schemaA, text = 'Here is the screen now. Choose your next action.', image = frames[0], key = 'ghostrun-probe' }) {
  const content = [{ type: 'text', text }];
  if (image) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } });
  const res = await api.chat.completions.create({
    model,
    reasoning_effort: 'minimal',
    max_tokens: 1000,
    ...(key ? { prompt_cache_key: key } : {}),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema } },
  });
  const u = res.usage ?? {};
  const row = { label, input: u.prompt_tokens, cached: u.prompt_tokens_details?.cached_tokens ?? 0, output: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0 };
  console.log(`${label.padEnd(58)} in ${String(row.input).padStart(5)}  cached ${String(row.cached).padStart(5)}  out ${String(row.output).padStart(4)} (reasoning ${row.reasoning})`);
  return row;
}

const rows = [];
const n1 = nonce();
const S1 = `[${n1}] ${rules}`;
// Warm the cache with S1 + schema A, twice.
rows.push(await call('A0 warm: S1 + schema A', { system: S1 }));
rows.push(await call('A1 same again (expect ~all cached)', { system: S1 }));
// Test A: new system prompt (nonce at the start), same schema. Schema before system => ~600 cached.
rows.push(await call('A2 new system start, same schema', { system: `[${nonce()}] ${rules}` }));
// Test B: same system, schema changed near its start. Schema after system => system part cached.
rows.push(await call('B1 same system S1, schema B', { system: S1, schema: schemaB }));
// Test C: same system and schema, different user text and image.
rows.push(await call('C1 same S1 + schema A, other text + image', { system: S1, text: 'Step 2. Choose.', image: frames[1] }));
// Test D: growing history, new image each move (what an append-only log would give).
const S2 = `[${nonce()}] ${rules}`;
const lines = [];
for (let i = 0; i < 5; i++) {
  lines.push(`step ${i + 1}: you held ArrowRight for 500 ms -> moved 90 px right. You thought: "Still moving right, the gap is getting closer now."`);
  rows.push(await call(`D${i + 1} history ${lines.length} lines, new image`, { system: S2, text: `What happened so far:\n${lines.join('\n')}\n\nHere is the screen now.`, image: frames[i] }));
}
// Test E: same as D without prompt_cache_key (routing may spread requests over backends).
const S3 = `[${nonce()}] ${rules}`;
const linesE = [];
for (let i = 0; i < 5; i++) {
  linesE.push(`step ${i + 1}: you held ArrowRight for 500 ms -> moved 90 px right. You thought: "Still moving right, the gap is getting closer now."`);
  rows.push(await call(`E${i + 1} same as D, no cache key`, { system: S3, key: null, text: `What happened so far:\n${linesE.join('\n')}\n\nHere is the screen now.`, image: frames[i] }));
}
await writeFile('bench/results/cache-probe.json', JSON.stringify(rows, null, 2));
