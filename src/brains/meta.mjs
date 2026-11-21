// Ghost brain on Meta Model API (OpenAI-compatible Chat Completions with vision).
// Docs: https://dev.meta.ai/docs — base URL https://api.meta.ai/v1, key in MODEL_API_KEY.
import OpenAI from 'openai';

export const PRICES = {
  // USD per 1M tokens, Standard mode (https://dev.meta.ai/docs/pricing-rate-limits, read 2026-11-21)
  'muse-ember-1.0': { input: 0.1, output: 0.5 },
  'muse-spark-1.3': { input: 1.25, output: 4.25 },
  'muse-wonder-1.0': { input: 4.0, output: 20.0 },
};

const MOVE_SCHEMA = {
  type: 'object',
  properties: {
    thought: { type: 'string', description: 'What you notice or feel right now, first person, in character, at most 15 words.' },
    player: {
      type: 'object',
      description: 'Where YOUR character is on this screenshot, on a 0-1000 grid ((0,0) top-left).',
      properties: { x: { type: 'integer' }, y: { type: 'integer' } },
      required: ['x', 'y'],
      additionalProperties: false,
    },
    hold: {
      type: 'array',
      description: 'Keys to hold down for the whole action.',
      items: { type: 'string', enum: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] },
    },
    tap: {
      type: 'array',
      description: 'Keys to tap once at the start of the action (for example Space to jump).',
      items: { type: 'string', enum: ['Space', 'ArrowUp', 'Enter'] },
    },
    duration_ms: { type: 'integer', description: 'How long the action lasts in game time, 100 to 1500 ms.' },
    confused: { type: 'boolean', description: 'True if you do not understand what to do or why something happened.' },
    quit: { type: 'boolean', description: 'True only if, in character, you would stop playing this game right now and never come back.' },
  },
  required: ['thought', 'player', 'hold', 'tap', 'duration_ms', 'confused', 'quit'],
  additionalProperties: false,
};

function systemPrompt(persona, controlsHint) {
  return [
    `You are ${persona.name}, a playtester. ${persona.style}`,
    'You are playing a web game you have never seen before. Each turn you get one screenshot (640x360).',
    'The game is PAUSED while you think. It only moves forward for the duration_ms you choose, while your keys are held.',
    'Your goal is to make progress in the game the way your personality would. Keep actions short (200-800 ms) near danger.',
    'Your thought must describe something new you notice this turn. Do not repeat earlier thoughts.',
    controlsHint ? `Controls you know about: ${controlsHint}` : 'Work out the controls from what is on screen.',
    'Answer only with the JSON object.',
  ].join('\n');
}

export function createMetaBrain({ model = process.env.GHOST_MODEL || 'muse-ember-1.0', reasoning = process.env.GHOST_REASONING || 'minimal', persona, controlsHint, client } = {}) {
  const api =
    client ??
    new OpenAI({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: process.env.MODEL_API_KEY,
      maxRetries: 3,
      timeout: 30_000,
    });
  const system = systemPrompt(persona, controlsHint);

  return {
    id: 'meta',
    model,
    async decide({ screenshot, history }) {
      const recent = history.slice(-6).map((h) => `step ${h.step}: ${h.summary}`).join('\n') || 'This is your first look at the game.';
      const t0 = performance.now();
      const res = await api.chat.completions.create({
        model,
        reasoning_effort: reasoning,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: `What happened so far:\n${recent}\n\nHere is the screen now. Choose your next action.` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.toString('base64')}` } },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema: MOVE_SCHEMA } },
      });
      const latencyMs = performance.now() - t0;
      const text = res.choices?.[0]?.message?.content ?? '';
      let move;
      try {
        move = JSON.parse(text);
      } catch {
        throw Object.assign(new Error(`Model returned invalid JSON: ${text.slice(0, 200)}`), { kind: 'bad_output' });
      }
      const usage = {
        input: res.usage?.prompt_tokens ?? 0,
        output: res.usage?.completion_tokens ?? 0,
        reasoning: res.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      };
      return { move, usage, latencyMs };
    },
  };
}

export function costOf(model, usage) {
  const p = PRICES[model];
  if (!p) return 0;
  return (usage.input * p.input + usage.output * p.output) / 1e6;
}
