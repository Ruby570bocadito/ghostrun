// The exit interview: after its last move each ghost says what it understood (src/ghost.mjs). Real jam games
// (22 Nov) showed why: ghosts that circled for 40 moves without dying left no finding, though they never got the goal.
// No network and no model: a tiny local game and fake brains.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { cleanDebrief, runGhost } from '../src/ghost.mjs';
import { analyze } from '../src/analyze.mjs';
import { traceCost } from '../src/brains/prices.mjs';

const GAME = `<!doctype html><body style="margin:0;background:#123"><canvas id="c" width="640" height="360"></canvas><script>
const g = document.getElementById('c').getContext('2d');
for (let i = 0; i < 40; i++) { g.fillStyle = 'hsl(' + i * 9 + ',70%,50%)'; g.fillRect((i * 53) % 600, (i * 37) % 320, 40, 30); }
</script></body>`;

const wander = async () => ({ move: { thought: 'Trying right', saw: 'playing', player: { x: 100, y: 100 }, click: [], hold: ['ArrowRight'], tap: [], duration_ms: 200, confused: false, quit: false }, usage: { input: 1000, cached: 800, output: 50 }, latencyMs: 0 });

async function play(brain, notices = []) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(GAME);
  });
  await new Promise((ok) => server.listen(0, ok));
  const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-debrief-'));
  const browser = await chromium.launch();
  const heard = [];
  try {
    const trace = await runGhost({ browser, url: `http://localhost:${server.address().port}/`, brain, persona: { id: 'newbie', name: 'The Newbie', style: '' }, maxSteps: 3, outDir, notices, onDebrief: (d) => heard.push(d) });
    return { trace, heard };
  } finally {
    await browser.close();
    server.close();
    await rm(outDir, { recursive: true, force: true });
  }
}

test('after its last move a ghost answers the exit interview, with the run summary and its own moves', async () => {
  let asked = null;
  const brain = {
    id: 'fake',
    model: 'muse-ember-1.0',
    decide: wander,
    debrief: async (input) => {
      asked = input;
      return { answer: { goal: 'Reach   the flag', understood_goal: true, understood_controls: 'yes', stopped_me: '', keep_playing: false }, usage: { input: 1200, cached: 1000, output: 60 }, latencyMs: 5 };
    },
  };
  const { trace, heard } = await play(brain);
  assert.equal(trace.outcome, 'out_of_steps');
  assert.match(asked.summary, /You made 3 moves and died 0 times\./);
  // Its 3 moves, after the line about the start-up autopilot (this test page has no SDK).
  assert.equal(asked.history.length, 4);
  assert.match(asked.history[0], /^0\. Before your first move \(automatic/);
  assert.ok(asked.screenshot.length > 1000, 'the last screen goes with the questions');
  // Stored clean: real booleans only, short strings, a default when the model left one empty.
  assert.deepEqual(
    { goal: trace.debrief.goal, understood_goal: trace.debrief.understood_goal, understood_controls: trace.debrief.understood_controls, stopped_me: trace.debrief.stopped_me, keep_playing: trace.debrief.keep_playing },
    { goal: 'Reach the flag', understood_goal: true, understood_controls: false, stopped_me: 'nothing', keep_playing: false },
  );
  assert.equal(heard.length, 1);
  // Its cost is part of the ghost's cost.
  assert.ok(traceCost(trace) > traceCost({ ...trace, debrief: null }));
});

test('a failed exit interview never costs the run: the ghost keeps its moves and a notice says what happened', async () => {
  const notices = [];
  const brain = { id: 'fake', model: 'muse-ember-1.0', decide: wander, debrief: async () => Promise.reject(new Error('HTTP 503')) };
  const { trace } = await play(brain, notices);
  assert.equal(trace.outcome, 'out_of_steps');
  assert.equal(trace.steps.length, 3);
  assert.equal(trace.debrief, undefined);
  assert.equal(notices.find((n) => n.type === 'debrief_failed')?.reason, 'HTTP 503');
});

test('the report counts who never worked out the goal or the controls, and who would stop', () => {
  const frame = (i, x) => ({ i, t: i * 100, pageT: i * 100, file: `frames/${i}.jpg`, state: { x, y: 280, worldW: 1360, worldH: 360 } });
  const ghost = (persona, debrief) => ({
    persona,
    outcome: 'out_of_steps',
    model: 'muse-ember-1.0',
    frames: [frame(0, 60), frame(1, 200)],
    events: [],
    steps: [{ step: 1, thought: 'hm', frames: [0, 1], usage: { input: 0, output: 0 }, latencyMs: 0 }],
    debrief: debrief && cleanDebrief(debrief),
  });
  const r = analyze([
    ghost('newbie', { goal: 'no idea', understood_goal: false, understood_controls: true, stopped_me: 'I never knew what to do', keep_playing: false }),
    ghost('reader', { goal: 'Deliver people', understood_goal: true, understood_controls: true, stopped_me: 'nothing', keep_playing: true }),
    ghost('impatient', { goal: 'no idea', understood_goal: false, understood_controls: false, stopped_me: 'Keys did nothing', keep_playing: false }),
    ghost('speedrunner', null),
  ]);
  assert.deepEqual(r.debrief, { asked: 3, goalUnclear: ['newbie', 'impatient'], controlsUnclear: ['impatient'], wouldStop: ['newbie', 'impatient'] });
  assert.equal(r.ghosts.find((g) => g.persona === 'reader').debrief.goal, 'Deliver people');
  assert.equal(r.ghosts.find((g) => g.persona === 'speedrunner').debrief, null);
  assert.equal(analyze([ghost('newbie', null)]).debrief, null);
});
