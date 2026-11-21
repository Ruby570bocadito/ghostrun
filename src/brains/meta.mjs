// Ghost brain on Meta Model API (OpenAI-compatible Chat Completions with vision).
// Docs: https://dev.meta.ai/docs — base URL https://api.meta.ai/v1, key in MODEL_API_KEY.
import OpenAI from 'openai';

export const PRICES = {
  // USD per 1M tokens, Standard mode (https://dev.meta.ai/docs/pricing-rate-limits, read 2026-11-21)
  'muse-ember-1.0': { input: 0.1, output: 0.5 },
  'muse-spark-1.3': { input: 1.25, output: 4.25 },
  'muse-wonder-1.0': { input: 4.0, output: 20.0 },
};

export const SAW = ['playing', 'menu', 'died', 'level_complete', 'other'];

/** The structured answer a ghost gives every move. Sizes are the screenshot's, in pixels. */
export function moveSchema(w, h) {
  const point = {
    type: 'object',
    properties: { x: { type: 'integer' }, y: { type: 'integer' } },
    required: ['x', 'y'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      thought: { type: 'string', description: 'What you notice or feel right now, first person, in character, at most 15 words.' },
      saw: {
        type: 'string',
        enum: SAW,
        description: 'What this screenshot shows right now: normal play, a menu or title screen, a death or game-over screen, a level-complete or win screen, or something else.',
      },
      player: {
        ...point,
        // v1 asked for a 0-1000 grid while the prompt also said "640x360"; 12-41% of answers came back in
        // pixels (bench/results/perception-baseline.md). v2 asks for pixels only, matching the image size.
        description: `Where YOUR character is on this ${w}x${h} screenshot, in pixels: x from 0 (left edge) to ${w} (right edge), y from 0 (top) to ${h} (bottom). If you cannot see it, give your best guess.`,
      },
      click: {
        type: 'array',
        description: `Mouse clicks at the start of this action, in pixels of the ${w}x${h} screenshot. Use them for buttons and menus (Play, Retry, a level number). Leave empty while you play with the keyboard.`,
        items: point,
      },
      hold: {
        type: 'array',
        description: 'Keys to hold down for the whole action.',
        items: { type: 'string', enum: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] },
      },
      tap: {
        type: 'array',
        description: 'Keys to tap once at the start of the action (for example Space to jump, or a letter key the game tells you to use).',
        items: { type: 'string', enum: ['Space', 'ArrowUp', 'Enter', 'KeyE', 'KeyX', 'KeyZ', 'KeyR'] },
      },
      duration_ms: { type: 'integer', description: 'How long the action lasts in game time, 100 to 1500 ms.' },
      confused: { type: 'boolean', description: 'True if you do not understand what to do or why something happened.' },
      quit: { type: 'boolean', description: 'True only if, in character, you would stop playing this game right now and never come back.' },
    },
    required: ['thought', 'saw', 'player', 'click', 'hold', 'tap', 'duration_ms', 'confused', 'quit'],
    additionalProperties: false,
  };
}

function systemPrompt(persona, controlsHint, w, h) {
  return [
    `You are ${persona.name}, a playtester. ${persona.style}`,
    `You are playing a web game you have never seen before. Each turn you get one screenshot (${w}x${h} pixels).`,
    'The game is PAUSED while you think. It only moves forward for the duration_ms you choose, while your keys are held.',
    'You can also click buttons with the mouse, for example to start the game from a menu or to retry after dying.',
    'Your goal is to make progress in the game the way your personality would. Keep actions short (200-800 ms) near danger.',
    'Your thought must describe something new you notice this turn. Do not repeat earlier thoughts.',
    controlsHint ? `Controls you know about: ${controlsHint}` : 'Work out the controls from what is on screen.',
    'Answer only with the JSON object.',
  ].join('\n');
}

export function createMetaBrain({
  model = process.env.GHOST_MODEL || 'muse-ember-1.0',
  reasoning = process.env.GHOST_REASONING || 'minimal',
  persona,
  controlsHint,
  viewport = { width: 640, height: 360 },
  client,
} = {}) {
  const api =
    client ??
    new OpenAI({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: process.env.MODEL_API_KEY,
      maxRetries: 3,
      timeout: 30_000,
    });
  const { width: w, height: h } = viewport;
  const system = systemPrompt(persona, controlsHint, w, h);
  const schema = moveSchema(w, h);

  return {
    id: 'meta',
    model,
    coords: 'pixels', // units of move.player and move.click
    async decide({ screenshot, history }) {
      const recent = history.slice(-6).map((hh) => `step ${hh.step}: ${hh.summary}`).join('\n') || 'This is your first look at the game.';
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
        response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema } },
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
