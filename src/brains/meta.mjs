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
// v3 (F3, 22 Nov): "run N px, then tap" (tap_after_px) for games with the SDK, and thoughts in a player's words.
// v4 (after F5): with tap_after_px, duration_ms counts from the tap.
export const CACHE_KEY = 'ghostrun-ghost-v6';
// Longest run-up before a delayed tap, in px.
export const MAX_TAP_AFTER_PX = 600;
// Longest action, in game time. v3 speed (24 Nov): on 7 real jam games 27 of 28 ghosts used up their 120 model calls
// before 150 s of play, because each call moved the game on only 0.4-0.8 s (the rule asked for 200-800 ms actions).
// Games without the SDK may now use actions up to 3 s and are asked to chain; games with the SDK keep 1.5 s.
export const MAX_ACTION_MS = 3000;
export const MAX_ACTION_MS_SDK = 1500;

// Per-model timeouts: Spark took over 30 s on 11% of its moves in the A1 comparison.
const TIMEOUT_MS = { 'muse-ember-1.0': 20_000, 'muse-spark-1.3': 60_000, 'muse-wonder-1.0': 90_000 };

/**
 * The structured answer a ghost gives every move. Sizes are the screenshot's, in pixels.
 * The position field stays even when the game reports positions itself: without it the answer was
 * 13% cheaper, but ghosts died twice as often next to Spike Maze's spikes and 2 of 6 clean maze runs
 * got a false alarm (0 of 8 with it). Asking where it is makes the model reason about where it is
 * (bench/README.md, "Tried and rejected").
 */
// v3 (23 Nov): on real games each decision moved the game on only 0.4-0.6 s and cost 2.6-3.3 s of wall time, so 120
// decisions were about 1-2 minutes of game. A ghost sure of what comes next can chain up to 2 more actions without
// looking again (they stop early if the screen changes completely). Games with the SDK keep one action per decision.
function followUps(w, h, sdk, point) {
  if (sdk) return {};
  return {
    then: {
      type: 'array',
      description: `Up to 2 more actions to do right after this one without looking again. Add them whenever you can tell what comes next (walk on, then jump; click a card, then another; keep exploring the same way): every look costs time. Done in order; they stop early if the screen changes completely. Leave empty only when you must see the result first (a jump near danger, a screen you do not know yet).`,
      items: {
        type: 'object',
        properties: {
          click: { type: 'array', description: `Clicks, in pixels of the ${w}x${h} screenshot.`, items: point },
          hold: { type: 'array', items: { type: 'string', enum: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] } },
          tap: { type: 'array', items: { type: 'string', enum: ['Space', 'ArrowUp', 'Enter', 'KeyE', 'KeyX', 'KeyZ', 'KeyR'] } },
          duration_ms: { type: 'integer', description: `100 to ${MAX_ACTION_MS} ms.` },
        },
        required: ['click', 'hold', 'tap', 'duration_ms'],
        additionalProperties: false,
      },
    },
  };
}

export function moveSchema(w, h, { sdk = false } = {}) {
  const point = {
    type: 'object',
    properties: { x: { type: 'integer' }, y: { type: 'integer' } },
    required: ['x', 'y'],
    additionalProperties: false,
  };
  // With the SDK the game can tell where the character is while it runs, so the tap can wait for a distance the
  // ghost chose by eye (ghost.mjs). Without it there is no way to know when that distance is reached.
  const tapAfter = sdk
    ? {
        tap_after_px: {
          type: 'integer',
          description: `How far to keep moving, holding your keys, before the tap happens, in pixels of the screenshot as you judge them by eye (0 = tap at once, up to ${MAX_TAP_AFTER_PX}). Use it to jump right at an edge: the distance from you to the edge. The run takes the time it needs; duration_ms then counts from the tap.`,
        },
      }
    : {};
  return {
    type: 'object',
    properties: {
      // Thoughts are shown to people in the report: they read like a player, not like our interface ("600ms jump").
      thought: { type: 'string', description: 'What you notice or feel right now, first person, in character, at most 15 words, in the words of a player: no milliseconds, no pixels.' },
      saw: {
        type: 'string',
        enum: SAW,
        description: 'What this screenshot shows right now: normal play, a menu or title screen, a death or game-over screen (also when you were suddenly sent back to the start or a checkpoint: that is a death), a level-complete or win screen, or something else.',
      },
      player: {
        ...point,
        // v1 asked for a 0-1000 grid while the prompt also said "640x360"; 12-41% of answers came back in
        // pixels (bench/results/perception-baseline.md). v2 asks for pixels only, matching the image size.
        description: `Where YOUR character is on this ${w}x${h} screenshot, in pixels: x from 0 (left edge) to ${w} (right edge), y from 0 (top) to ${h} (bottom). If you cannot see it, give your best guess.`,
      },
      click: {
        type: 'array',
        // "Leave empty while you play with the keyboard" made ghosts press keys in games played only with the mouse:
        // 62-70% of their moves in Big Champ and Coiner were keys (rediseno/v3/juegos-reales.md, 23 Nov).
        description: `Mouse clicks at the start of this action, in pixels of the ${w}x${h} screenshot. Use them for buttons and menus (Play, Retry, a level number) and to play games controlled with the mouse (aiming, clicking things, choosing).`,
        items: point,
      },
      drag: {
        type: 'array',
        // Broken Repair (itch.io) asks to drag parts; the ghosts tried it with two clicks 11 times (23 Nov).
        description: `A mouse drag at the start of this action: press at (x1,y1), move to (x2,y2) and release, in pixels of the ${w}x${h} screenshot. For things the game asks you to drag. Leave empty otherwise.`,
        items: {
          type: 'object',
          properties: { x1: { type: 'integer' }, y1: { type: 'integer' }, x2: { type: 'integer' }, y2: { type: 'integer' } },
          required: ['x1', 'y1', 'x2', 'y2'],
          additionalProperties: false,
        },
      },
      hold: {
        type: 'array',
        description: 'Keys to hold down for the whole action.',
        items: { type: 'string', enum: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] },
      },
      tap: {
        type: 'array',
        description: 'Keys to tap once at the very start of the action, from where you stand now (for example Space to jump, or a letter key the game tells you to use).',
        items: { type: 'string', enum: ['Space', 'ArrowUp', 'Enter', 'KeyE', 'KeyX', 'KeyZ', 'KeyR'] },
      },
      ...tapAfter,
      ...followUps(w, h, sdk, point),
      duration_ms: { type: 'integer', description: `How long the action lasts in game time, 100 to ${sdk ? MAX_ACTION_MS_SDK : MAX_ACTION_MS} ms; up to 5000 ms when you only wait (no keys, no clicks), for example while a loading screen, an intro or an animation plays.` },
      confused: { type: 'boolean', description: 'True if you do not understand what to do or why something happened.' },
      quit: { type: 'boolean', description: 'True only if, in character, you would stop playing this game right now and never come back.' },
    },
    required: ['thought', 'saw', 'player', 'click', 'drag', 'hold', 'tap', ...Object.keys(tapAfter), ...Object.keys(followUps(w, h, sdk, point)), 'duration_ms', 'confused', 'quit'],
    additionalProperties: false,
  };
}

/**
 * The exit interview a ghost answers after its last move, like a person after a playtest. On real jam games
 * (22 Nov) ghosts that circled for 40 moves without dying or getting stuck left no finding at all, although
 * they never worked out what the game wanted: only asking them shows it.
 */
export const DEBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'What you think the goal of the game is, at most 10 words, or "no idea".' },
    understood_goal: { type: 'boolean', description: 'True if you worked out what the game wants you to do.' },
    understood_controls: { type: 'boolean', description: 'True if you worked out how to control the game.' },
    stopped_me: { type: 'string', description: 'The one thing that most stopped or annoyed you in this game, in character, at most 15 words; "nothing" if nothing did.' },
    keep_playing: { type: 'boolean', description: 'True if, in character, you would keep playing this game.' },
  },
  required: ['goal', 'understood_goal', 'understood_controls', 'stopped_me', 'keep_playing'],
  additionalProperties: false,
};

// Identical for every ghost and every game of one kind (with or without the SDK), so it is the start of the cached prefix.
const rules = (sdk) => [
  'You are a playtester for web games, playing a game you have never seen before. Each turn you get one screenshot.',
  'The game is PAUSED while you think. It only moves forward for the duration_ms you choose, while your keys are held.',
  'You can also click and drag with the mouse: buttons and menus, and games that are played with the mouse. Some games are played only with the mouse: if the screen shows no keys, or your keys do nothing, click or drag on things.',
  // Decogear (itch.io, 23 Nov): with the clock frozen, a 30-second intro only moved on during the ghosts' moves, and
  // they spent 94% of their moves pressing keys on loading, credits and story screens.
  'On a loading screen, an intro, story text or an animation that is still changing, wait (no keys, no clicks) up to 5000 ms at once instead of pressing keys.',
  // From an analysis of 5,761 recorded moves (22 Nov): 69% of deaths at fair gaps were jumps started too early, because
  // ghosts expected a tap to wait for the edge; jumps prepared by a separate walk to the edge crossed 72% of the time,
  // against 27% for jumps started while running. And 28 of 58 fatal moves in a maze with no jump were planned jumps.
  sdk
    ? // F3 (22 Nov): even after that rule, 82% of the jumps at Gap Run's first gap took off more than 40 px before the
      // edge. A person runs and presses at the edge; now the ghost can too, judging the distance by eye.
      'Taps happen once. With tap_after_px 0 the tap happens at the very START of the action, from where you stand now. To jump at an edge, hold the direction and set tap_after_px to the distance from you to the edge as you see it: you keep running that far and the tap happens there, and duration_ms counts from that tap. Holding a key longer does not make a jump longer.'
    : 'Taps happen once, at the very START of the action, from where you stand now: nothing waits until you reach an edge. To jump a gap, first walk to the edge in short steps, then jump in the next action while holding the direction. Holding a key longer does not make a jump longer.',
  // F4: the ghost used to decide while already falling into a pit ("jump straight up"): the game now waits for it.
  ...(sdk ? ['If an action ends while you are falling, the game keeps your keys held until you land or die, so you never have to decide in mid-fall.'] : []),
  'Use the controls this game shows. Not every game has a jump: if it only shows keys to move, go around hazards instead of jumping over them.',
  // Real jam games by other people (22 Nov): ghosts misread what they controlled and spent moves waiting.
  'In a game you do not know yet, first find out what you control: try one key at a time in short actions and watch what moves. If keys do nothing, click on the game. While playing, waiting rarely teaches you anything.',
  // Escape from Death Hole (js13k): Enter started the game after a 1-3 s transition; ghosts pressed it again every 0.5 s.
  // Also game-over screens: on three real jam games the ghosts reported "restart does nothing" (22 Nov).
  'On a title, menu or game-over screen, after pressing a key or clicking, give the game a second (1000-1500 ms) to change screens before trying something else.',
  'After each action you are told what happened: how far you moved, if you died or reached something, where the screen changed, and whether the view scrolled (which means you moved, even if your character stays in the middle). You also get a table of which inputs have made the screen answer. Trust it over your impression.',
  sdk
    ? 'Keep actions short (200-800 ms) near danger. When the way ahead is clear, longer actions (up to 1500 ms) are fine.'
    : `Every look at the screen takes time, so make each one count. Keep actions short (200-800 ms) only near danger. Otherwise use long actions (1500-${MAX_ACTION_MS} ms): walking, exploring, holding a direction, waiting for something to happen. When you can tell what comes next, add 1-2 follow-up actions instead of looking again.`,
  'Your thought must describe something new you notice this turn. Do not repeat earlier thoughts.',
  'Answer only with the JSON object.',
].join('\n');
const SHARED_RULES = { false: rules(false), true: rules(true) };

export function systemPrompt(persona, controlsHint, w, h, { sdk = false } = {}) {
  return [
    SHARED_RULES[Boolean(sdk)],
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

/** The same conversation as a move (so the cached prefix is reused), ending with the exit interview. */
export function buildDebriefMessages({ system, history, screenshot, summary = '' }) {
  const lines = historyWindow(history);
  const log = lines.length ? `Your moves so far:\n${lines.join('\n')}` : 'You did not get to make a move.';
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: log },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.toString('base64')}` } },
        {
          type: 'text',
          text: [summary, 'The playtest is over and this is the last screen. Answer a short exit interview about the whole game, in character, from what you saw and did. Be honest: if you never worked something out, say so.']
            .filter(Boolean)
            .join('\n'),
        },
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
  // Games with the SDK get the "run N px, then tap" field and its rule (the ghost tells us with each move).
  const prompts = {};
  const promptFor = (sdk) => (prompts[Boolean(sdk)] ??= { system: systemPrompt(persona, controlsHint, w, h, { sdk }), schema: moveSchema(w, h, { sdk }) });
  let lastSdk = false;

  return {
    id: 'meta',
    model,
    coords: 'pixels', // units of move.player and move.click
    /** history: finished lines describing earlier moves and what happened; notes: hints for this turn only; sdk: the game reports its state. */
    async decide({ screenshot, history = [], notes = [], sdk = false }) {
      lastSdk = Boolean(sdk);
      const { system, schema } = promptFor(sdk);
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
    /** The exit interview after the last move: what the ghost understood and what stopped it, about the whole game. */
    async debrief({ screenshot, history = [], summary = '', sdk = lastSdk }) {
      const { system } = promptFor(sdk);
      const t0 = performance.now();
      const res = await api.chat.completions.create({
        model,
        reasoning_effort: reasoning,
        max_tokens: 600,
        prompt_cache_key: CACHE_KEY,
        messages: buildDebriefMessages({ system, history, screenshot, summary }),
        response_format: { type: 'json_schema', json_schema: { name: 'ghost_debrief', schema: DEBRIEF_SCHEMA } },
      });
      const latencyMs = performance.now() - t0;
      const usage = usageOf(res);
      const text = res.choices?.[0]?.message?.content ?? '';
      let answer;
      try {
        answer = JSON.parse(text);
        if (!answer || typeof answer !== 'object') throw new Error('not an object');
      } catch {
        throw Object.assign(new Error(`Model returned invalid JSON for the exit interview: ${text.slice(0, 160)}`), { kind: 'bad_output', usage, latencyMs });
      }
      return { answer, usage, latencyMs };
    },
  };
}
