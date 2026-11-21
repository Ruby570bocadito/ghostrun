// Ghost brain on Meta Model API (OpenAI-compatible Chat Completions with vision).
// Docs: https://dev.meta.ai/docs — base URL https://api.meta.ai/v1, key in MODEL_API_KEY.
//
// Prompt layout, built for Meta's prefix cache (bench/results/cache-probe.json):
//   [shared rules, same for every ghost and game] [persona + controls] [JSON schema]
//   [log of earlier moves, append-only] [screenshot] [notes for this turn]
// Everything before the screenshot repeats from one move to the next, so Meta serves it from cache
// at 1/25 of the input price. A shared prompt_cache_key keeps the requests on the backend that
// holds that prefix (without it, 3 of 5 identical-prefix calls missed the cache in our probe).
import OpenAI from 'openai';

export { PRICES, costOf } from './prices.mjs';

export const SAW = ['playing', 'menu', 'died', 'level_complete', 'other'];
export const CACHE_KEY = 'ghostrun-ghost-v2';

// Per-model timeouts: Spark took over 30 s on 11% of its moves in the A1 comparison.
const TIMEOUT_MS = { 'muse-ember-1.0': 20_000, 'muse-spark-1.3': 60_000, 'muse-wonder-1.0': 90_000 };

/**
 * The structured answer a ghost gives every move. Sizes are the screenshot's, in pixels.
 * The position field stays even when the game reports positions itself: without it the answer was
 * 13% cheaper, but ghosts died twice as often next to Spike Maze's spikes and 2 of 6 clean maze runs
 * got a false alarm (0 of 8 with it). Asking where it is makes the model reason about where it is
 * (bench/README.md, "Tried and rejected").
 */
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

// Identical for every ghost and every game, so it is the start of the cached prefix.
const SHARED_RULES = [
  'You are a playtester for web games, playing a game you have never seen before. Each turn you get one screenshot.',
  'The game is PAUSED while you think. It only moves forward for the duration_ms you choose, while your keys are held.',
  'You can also click buttons with the mouse, for example to start the game from a menu or to retry after dying.',
  'After each action you are told what happened (how far you moved, if you died or reached something). Use it to judge distances and timing.',
  'Keep actions short (200-800 ms) near danger. When the way ahead is clear, longer actions (up to 1500 ms) are fine.',
  'Your thought must describe something new you notice this turn. Do not repeat earlier thoughts.',
  'Answer only with the JSON object.',
].join('\n');

export function systemPrompt(persona, controlsHint, w, h) {
  return [
    SHARED_RULES,
    '',
    `Screenshots are ${w}x${h} pixels.`,
    `Your personality: you are ${persona.name}. ${persona.style}`,
    'Make progress the way your personality would.',
    controlsHint ? `Controls you know about: ${controlsHint}` : 'Work out the controls from what is on screen.',
  ].join('\n');
}

// History window: append-only (so it stays in the cached prefix), cut in chunks so long runs do
// not grow the prompt forever. The cut moves only every CHUNK moves, so the cache rebuilds rarely.
export const HISTORY_MAX = 24;
export const HISTORY_CHUNK = 12;
export function historyWindow(lines, max = HISTORY_MAX, chunk = HISTORY_CHUNK) {
  const n = lines.length;
  const from = n <= max ? 0 : Math.ceil((n - max) / chunk) * chunk;
  return lines.slice(from);
}

export function buildMessages({ system, history, screenshot, notes = [] }) {
  const lines = historyWindow(history);
  const log = lines.length ? `Your moves so far:\n${lines.join('\n')}` : 'This is your first look at the game.';
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: log },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.toString('base64')}` } },
        { type: 'text', text: [...notes, 'This is the screen now. Choose your next action.'].join('\n') },
      ],
    },
  ];
}

const usageOf = (res) => ({
  input: res?.usage?.prompt_tokens ?? 0, // includes cached tokens
  cached: res?.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  output: res?.usage?.completion_tokens ?? 0, // includes reasoning tokens
  reasoning: res?.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
});

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
      maxRetries: 2, // with backoff; then the fallback wrapper switches model
      timeout: TIMEOUT_MS[model] ?? 30_000,
    });
  const { width: w, height: h } = viewport;
  const system = systemPrompt(persona, controlsHint, w, h);
  const schema = moveSchema(w, h);

  return {
    id: 'meta',
    model,
    coords: 'pixels', // units of move.player and move.click
    /** history: finished lines describing earlier moves and what happened; notes: hints for this turn only. */
    async decide({ screenshot, history = [], notes = [] }) {
      const t0 = performance.now();
      const res = await api.chat.completions.create({
        model,
        reasoning_effort: reasoning,
        max_tokens: 1200, // p99 of real moves is ~460; a cut answer is retried by the ghost
        prompt_cache_key: CACHE_KEY,
        messages: buildMessages({ system, history, screenshot, notes }),
        response_format: { type: 'json_schema', json_schema: { name: 'ghost_move', schema } },
      });
      const latencyMs = performance.now() - t0;
      const usage = usageOf(res);
      const choice = res.choices?.[0];
      const text = choice?.message?.content ?? '';
      let move;
      try {
        move = JSON.parse(text);
        if (!move || typeof move !== 'object') throw new Error('not an object');
      } catch {
        const cut = choice?.finish_reason === 'length' ? ' (answer cut at max_tokens)' : '';
        throw Object.assign(new Error(`Model returned invalid JSON${cut}: ${text.slice(0, 160)}`), { kind: 'bad_output', usage, latencyMs });
      }
      return { move, usage, latencyMs };
    },
  };
}
