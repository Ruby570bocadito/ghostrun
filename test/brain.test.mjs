// Tests for the ghost's prompt, feedback and failure handling. No network: the model is faked.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, createMetaBrain, historyWindow, systemPrompt, CACHE_KEY } from '../src/brains/meta.mjs';
import { costOf } from '../src/brains/prices.mjs';
import { DeathSpots, historyLine, outcomeOf, turnNotes, walkSpeed } from '../src/feedback.mjs';
import { decideRobustly, SAFE_MOVE } from '../src/ghost.mjs';

const persona = { id: 'newbie', name: 'The Newbie', style: 'You are clumsy.' };
const shot = Buffer.from('fake-jpeg');
const GOOD = JSON.stringify({ thought: 'Go right', saw: 'playing', player: { x: 1, y: 2 }, click: [], hold: ['ArrowRight'], tap: [], duration_ms: 400, confused: false, quit: false });

/** A fake OpenAI client that answers with the given contents in order and records the requests. */
function fakeClient(answers) {
  const requests = [];
  return {
    requests,
    chat: {
      completions: {
        async create(req) {
          requests.push(req);
          const a = answers.shift();
          return {
            choices: [{ message: { content: a.content }, finish_reason: a.finish ?? 'stop' }],
            usage: { prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 600 }, completion_tokens: 150, completion_tokens_details: { reasoning_tokens: 90 } },
          };
        },
      },
    },
  };
}

test('cached input is billed at the cached rate; list price ignores the discount', () => {
  const u = { input: 1000, cached: 600, output: 150 };
  // Ember: 400 × 0.10 + 600 × 0.004 + 150 × 0.50 per million
  assert.ok(Math.abs(costOf('muse-ember-1.0', u) - (400 * 0.1 + 600 * 0.004 + 150 * 0.5) / 1e6) < 1e-12);
  assert.ok(Math.abs(costOf('muse-ember-1.0', u, { listPrice: true }) - (1000 * 0.1 + 150 * 0.5) / 1e6) < 1e-12);
  assert.equal(costOf('unknown-model', u), 0);
});

test('the brain sends a cache key and keeps the screenshot after the move log', async () => {
  const client = fakeClient([{ content: GOOD }]);
  const brain = createMetaBrain({ persona, client });
  const d = await brain.decide({ screenshot: shot, history: ['1. held ArrowRight for 400 ms → you moved 72 px right. Thought: "ok"'], notes: ['a note'] });
  const req = client.requests[0];
  assert.equal(req.prompt_cache_key, CACHE_KEY);
  assert.equal(req.messages[0].role, 'system');
  assert.match(req.messages[0].content, /^You are a playtester/); // shared rules first, persona after
  assert.match(req.messages[0].content, /The Newbie/);
  const parts = req.messages[1].content.map((c) => c.type);
  assert.deepEqual(parts, ['text', 'image_url', 'text']);
  assert.match(req.messages[1].content[2].text, /a note/);
  assert.deepEqual(d.usage, { input: 1000, cached: 600, output: 150, reasoning: 90 });
});

test('the move log only grows between moves, so it stays in the cached prefix', () => {
  const lines = Array.from({ length: 40 }, (_, i) => `${i + 1}. held ArrowRight for 400 ms`);
  const logAt = (n) => buildMessages({ system: 's', history: lines.slice(0, n), screenshot: shot })[1].content[0].text;
  let breaks = 0;
  for (let n = 1; n < 40; n++) if (!logAt(n + 1).startsWith(logAt(n))) breaks++;
  assert.equal(breaks, 2); // 40 moves: the window moves twice (at moves 25 and 37), never in between
  assert.equal(historyWindow(lines.slice(0, 24)).length, 24);
  assert.equal(historyWindow(lines.slice(0, 25))[0], lines[12]); // cut in chunks of 12
  assert.equal(historyWindow(lines.slice(0, 36))[0], lines[12]);
  assert.equal(historyWindow(lines.slice(0, 37))[0], lines[24]);
});

test('a broken answer is retried once and its tokens still count', async () => {
  const client = fakeClient([{ content: '{"thought": "cut' , finish: 'length' }, { content: GOOD }]);
  const brain = createMetaBrain({ persona, client });
  const d = await decideRobustly(brain, { screenshot: shot, history: [] });
  assert.equal(d.attempts, 2);
  assert.equal(d.move.thought, 'Go right');
  assert.equal(d.usage.input, 2000);
  assert.equal(d.usage.output, 300);
});

test('two broken answers in a row: the ghost waits instead of being lost, and it is reported', async () => {
  const client = fakeClient([{ content: 'not json' }, { content: '' }]);
  const brain = createMetaBrain({ persona, client });
  const reported = [];
  const d = await decideRobustly(brain, { screenshot: shot, history: [] }, { onBadOutput: (e) => reported.push(e.message) });
  assert.equal(d.safe, true);
  assert.deepEqual(d.move, SAFE_MOVE);
  assert.equal(d.usage.input, 2000);
  assert.equal(reported.length, 1);
  assert.match(reported[0], /invalid JSON/);
});

test('provider errors are not swallowed (the fallback wrapper handles them)', async () => {
  const brain = { decide: async () => Promise.reject(Object.assign(new Error('503'), { status: 503 })) };
  await assert.rejects(decideRobustly(brain, {}), /503/);
});

test('the ghost is told what its move did', () => {
  const sdk = true;
  assert.equal(outcomeOf({ sdk, before: { x: 100, y: 300 }, after: { x: 190, y: 300 } }), 'you moved 90 px right');
  assert.equal(outcomeOf({ sdk, before: { x: 100, y: 300 }, after: { x: 160, y: 250 } }), 'you moved 60 px right and 50 px up');
  assert.equal(outcomeOf({ sdk, before: { x: 100, y: 300 }, after: { x: 101, y: 300 } }), 'you did not move');
  assert.equal(outcomeOf({ sdk, before: { x: 400, y: 300 }, after: { x: 60, y: 300 }, events: [{ type: 'death' }] }), 'you died'); // no fake "moved 340 px left" after a respawn
  assert.equal(outcomeOf({ sdk, before: { x: 1, y: 1 }, after: { x: 50, y: 1 }, events: [{ type: 'milestone', name: 'key' }] }), 'you moved 49 px right, you reached "key"');
  assert.equal(outcomeOf({ sdk: false, screenChanged: false }), 'nothing changed on screen');
  assert.equal(outcomeOf({ sdk: false, screenChanged: true }), null);
  assert.equal(
    historyLine(3, { hold: ['ArrowRight'], tap: ['Space'], click: [], duration_ms: 500, thought: 'Jump!' }, 'you died'),
    '3. held ArrowRight, tapped Space for 500 ms → you died. Thought: "Jump!"',
  );
});

test('deaths are grouped by spot and repeated deaths trigger a hint', () => {
  const spots = new DeathSpots(70);
  assert.equal(spots.add({ x: 400, y: 300, step: 2 }), 1);
  assert.equal(spots.add({ x: 430, y: 310, step: 4 }), 2);
  assert.equal(spots.add({ x: 900, y: 300, step: 5 }), 1);
  assert.equal(spots.add({ x: 410, y: 290, step: 7 }), 3);
  assert.equal(spots.max, 3);
  const notes = turnNotes({ spots, step: 8, recent: [] });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /died 3 times at the same spot/);
  assert.equal(turnNotes({ spots, step: 20, recent: [] }).length, 0); // long ago: no nagging
  assert.match(turnNotes({ recent: [{ stuck: true }, { stuck: true }, { stuck: true }], step: 3 })[0], /did not move you/);
});

test('walking speed comes from plain walking moves only', () => {
  assert.equal(walkSpeed([{ dx: 90, dy: 0, ms: 500 }]), null); // one sample is not enough
  assert.equal(walkSpeed([{ dx: 90, dy: 0, ms: 500 }, { dx: 180, dy: 2, ms: 1000 }, { dx: 0, dy: 0, ms: 500 }, { dx: 50, dy: 80, ms: 500 }]), 180);
  assert.match(turnNotes({ step: 3, recent: [], speed: 180 })[0], /180 px per second/);
});

test('the exit interview reuses the cached prefix and its own schema, and a broken answer is reported', async () => {
  const answer = JSON.stringify({ goal: 'Reach the flag', understood_goal: true, understood_controls: true, stopped_me: 'nothing', keep_playing: true });
  const client = fakeClient([{ content: answer }, { content: 'not json' }]);
  const brain = createMetaBrain({ persona, client });
  const d = await brain.debrief({ screenshot: shot, history: ['1. held ArrowRight for 400 ms. Thought: "Go"'], summary: 'You made 1 moves and died 0 times.' });
  const req = client.requests[0];
  assert.equal(req.prompt_cache_key, CACHE_KEY);
  assert.equal(req.response_format.json_schema.name, 'ghost_debrief');
  assert.equal(req.messages[0].content, systemPrompt(persona, undefined, 640, 360)); // the same system prompt as every move
  const last = req.messages[1].content.at(-1).text;
  assert.match(last, /You made 1 moves/);
  assert.match(last, /exit interview/);
  assert.equal(d.answer.goal, 'Reach the flag');
  assert.equal(d.usage.cached, 600);
  await assert.rejects(brain.debrief({ screenshot: shot }), (err) => err.kind === 'bad_output');
});
