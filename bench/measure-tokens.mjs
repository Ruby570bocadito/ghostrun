// Where do the input tokens of one ghost move go? Calls the model with variations of the same request
// (no image, image at several sizes, with and without the JSON schema, repeated for the cache) and
// prints what Meta Model API bills. About a dozen calls, well under one cent.
// node bench/measure-tokens.mjs <frame.jpg>
import { readFile, writeFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import { moveSchema } from '../src/brains/meta.mjs';
import { PERSONAS } from '../src/personas.mjs';

const framePath = process.argv[2];
if (!framePath || !process.env.MODEL_API_KEY) {
  console.error('Usage: MODEL_API_KEY=... node bench/measure-tokens.mjs <frame.jpg>');
  process.exit(1);
}
const api = new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2 });
const model = 'muse-ember-1.0';

// Resize the frame in a headless browser (no image library needed).
const browser = await chromium.launch();
const page = await browser.newPage();
const original = await readFile(framePath);
const resized = {};
for (const [w, h] of [
  [640, 360],
  [480, 270],
  [320, 180],
]) {
  const b64 = await page.evaluate(
    async ({ src, w, h }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.7).split(',')[1];
    },
    { src: `data:image/jpeg;base64,${original.toString('base64')}`, w, h },
  );
  resized[`${w}x${h}`] = b64;
}
await browser.close();

const persona = PERSONAS.newbie;
const system = `You are ${persona.name}, a playtester. ${persona.style}\nYou are playing a web game you have never seen before. Each turn you get one screenshot (640x360 pixels).\nThe game is PAUSED while you think. Answer only with the JSON object.`;
const history = Array.from({ length: 6 }, (_, i) => `step ${i + 1}: you held ArrowRight for 400 ms. You thought: "I keep moving right toward the gap, it looks wide."`).join('\n');

async function call(label, { image = '640x360', schema = true, hist = true } = {}) {
  const content = [{ type: 'text', text: `${hist ? `What happened so far:\n${history}\n\n` : ''}Here is the screen now. Choose your next action.` }];
  if (image) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${resized[image]}` } });
  const res = await api.chat.completions.create({
    model,
    reasoning_effort: 'minimal',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema: moveSchema(640, 360) } } } : {}),
  });
  const u = res.usage ?? {};
  const row = {
    label,
    input: u.prompt_tokens,
    cached: u.prompt_tokens_details?.cached_tokens ?? 0,
    output: u.completion_tokens,
    reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0,
  };
  console.log(`${label.padEnd(42)} input ${String(row.input).padStart(5)}  cached ${String(row.cached).padStart(5)}  output ${String(row.output).padStart(4)} (reasoning ${row.reasoning})`);
  return row;
}

const rows = [];
rows.push(await call('full request (640x360 image)'));
rows.push(await call('same again (cache?)'));
rows.push(await call('same, third time (cache?)'));
rows.push(await call('no image', { image: null }));
rows.push(await call('no image, no schema', { image: null, schema: false }));
rows.push(await call('no image, no schema, no history', { image: null, schema: false, hist: false }));
rows.push(await call('image 480x270', { image: '480x270' }));
rows.push(await call('image 320x180', { image: '320x180' }));
await writeFile('bench/results/token-breakdown.json', JSON.stringify(rows, null, 2));
