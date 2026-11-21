// Experiment: prints the raw text Ember returns for one move, to see what the output tokens are made of.
import { readFileSync } from 'node:fs';
import OpenAI from 'openai';
import { buildMessages, moveSchema, systemPrompt, CACHE_KEY } from '../src/brains/meta.mjs';
import { PERSONAS } from '../src/personas.mjs';

const api = new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2 });
const shot = readFileSync(process.argv[2]);
const variants = {
  current: systemPrompt(PERSONAS.newbie, null, 640, 360),
  terse: systemPrompt(PERSONAS.newbie, null, 640, 360) + '\nDecide quickly: the thought field is your only reasoning, keep it short.',
};
for (const [name, system] of Object.entries(variants)) {
  for (let i = 0; i < 6; i++) {
    const res = await api.chat.completions.create({
      model: 'muse-ember-1.0',
      reasoning_effort: 'minimal',
      max_tokens: 1200,
      prompt_cache_key: CACHE_KEY,
      messages: buildMessages({ system, history: ['1. held ArrowRight for 500 ms → you moved 90 px right. Thought: "The path is clear."'], screenshot: shot }),
      response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema: moveSchema(640, 360) } },
    });
    const u = res.usage;
    const text = res.choices[0].message.content;
    if (i === 0) console.log(`--- ${name}: raw text (${text.length} chars) ---\n${text}`);
    console.log(`${name} #${i + 1}: output ${u.completion_tokens} (reasoning ${u.completion_tokens_details?.reasoning_tokens}), visible ≈ ${u.completion_tokens - (u.completion_tokens_details?.reasoning_tokens ?? 0)}`);
  }
}
