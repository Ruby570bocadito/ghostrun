// Tests for the analyst's guard on fair challenges. No network: the model is faked.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { explainHotspots, fairChallenge, FAIR_FIX, MAKES_EASIER } from '../src/explain.mjs';

const all = ['newbie', 'speedrunner', 'reader', 'impatient'];
const finding = (over = {}) => ({
  id: 'F1',
  type: 'friction',
  severity: 'high',
  count: 10,
  center: { x: 300, y: 200 },
  ghosts: all,
  reached: all,
  passed: all,
  quotes: ['Jump at the edge now.'],
  evidence: [{ persona: 'newbie', clip: [0, 1] }],
  ...over,
});
const card = (suggested_fix) => ({ title: 'Gap', what_happens: 'They fell.', likely_cause: 'unclear', suggested_fix, could_be_ghost_skill: true, confidence: 'medium' });

/** A fake model that answers each call with the next suggested fix in the list (the last one repeats). */
function fakeModel(fixes) {
  const calls = [];
  const create = async (req) => {
    calls.push(req);
    const fix = fixes[Math.min(calls.length - 1, fixes.length - 1)];
    return { choices: [{ message: { content: JSON.stringify(card(fix)) } }], usage: { prompt_tokens: 100, completion_tokens: 20 } };
  };
  return { calls, client: { chat: { completions: { create } } } };
}

async function explain(f, fixes) {
  const runDir = await mkdtemp(join(tmpdir(), 'ghostrun-explain-'));
  try {
    await mkdir(join(runDir, 'newbie'));
    await writeFile(join(runDir, 'newbie', 'f0.jpg'), Buffer.from('fake-jpeg'));
    const traces = [{ persona: 'newbie', frames: [{ file: 'f0.jpg' }], steps: [] }];
    const report = { findings: [f], ghostsTotal: 4, worldW: 1200, worldH: 400 };
    const model = fakeModel(fixes);
    const out = await explainHotspots(report, { runDir, traces, client: model.client });
    return { ...out, calls: model.calls };
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

const factsOf = (call) => call.messages[1].content[0].text;

test('a card the analyst does not answer in time is replaced by the plain finding', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'ghostrun-explain-'));
  try {
    await mkdir(join(runDir, 'newbie'));
    await writeFile(join(runDir, 'newbie', 'f0.jpg'), Buffer.from('fake-jpeg'));
    const traces = [{ persona: 'newbie', frames: [{ file: 'f0.jpg' }], steps: [] }];
    const report = { findings: [finding(), finding({ id: 'F2', type: 'blocker', passed: [] })], ghostsTotal: 4, worldW: 1200, worldH: 400 };
    let n = 0;
    // The first card answers at once, the second never does.
    const create = () => (n++ === 0 ? Promise.resolve({ choices: [{ message: { content: JSON.stringify(card('Add a checkpoint.')) } }], usage: {} }) : new Promise(() => {}));
    const t0 = Date.now();
    const out = await explainHotspots(report, { runDir, traces, client: { chat: { completions: { create } } }, deadlineMs: 200 });
    assert.ok(Date.now() - t0 < 2000);
    assert.equal(out.cards.length, 2);
    assert.equal(out.cards[0].suggested_fix, 'Add a checkpoint.');
    assert.equal(out.cards[1].late, true);
    assert.match(out.cards[1].title, /blocker around/);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test('a fair challenge is one that most ghosts that reached it got past', () => {
  assert.equal(fairChallenge(finding()), true);
  assert.equal(fairChallenge(finding({ passed: ['newbie', 'reader'] })), true);
  assert.equal(fairChallenge(finding({ passed: ['newbie'] })), false);
  assert.equal(fairChallenge(finding({ type: 'blocker', passed: [] })), false);
  assert.match('Narrow the gap slightly or add a visual cue.', MAKES_EASIER);
  assert.doesNotMatch('Add a visual cue at the takeoff point, or a checkpoint nearby.', MAKES_EASIER);
});

test('on a fair challenge, a card that makes the spot easier is asked again with the reason', async () => {
  const { cards, calls, usage } = await explain(finding(), ['Narrow the gap slightly.', 'Add a visual cue at the takeoff point.']);
  assert.equal(calls.length, 2);
  assert.match(factsOf(calls[0]), /do not suggest making it easier/);
  assert.equal(calls[1].messages.at(-1).role, 'user');
  assert.match(calls[1].messages.at(-1).content, /intended challenge/);
  assert.equal(cards[0].suggested_fix, 'Add a visual cue at the takeoff point.');
  assert.equal(usage.input, 200, 'both answers are paid for');
});

test('if the second card still makes it easier, its suggestion is replaced', async () => {
  const { cards, calls } = await explain(finding(), ['Narrow the gap.', 'Reduce the gap width a little.']);
  assert.equal(calls.length, 2);
  assert.equal(cards[0].suggested_fix, FAIR_FIX);
  assert.equal(cards[0].title, 'Gap', 'the rest of the card is kept');
});

test('blockers and spots few ghosts got past keep the suggestion to ease them', async () => {
  const blocker = await explain(finding({ type: 'blocker', passed: [] }), ['Narrow the gap.']);
  assert.equal(blocker.calls.length, 1);
  assert.equal(blocker.cards[0].suggested_fix, 'Narrow the gap.');
  const hard = await explain(finding({ passed: ['newbie'] }), ['Narrow the gap.']);
  assert.equal(hard.calls.length, 1);
  assert.doesNotMatch(factsOf(hard.calls[0]), /do not suggest/);
  assert.equal(hard.cards[0].suggested_fix, 'Narrow the gap.');
});

// Found while checking the analyst on recorded blockers (21 Nov): a card blamed "pit walls" for a gap that was too
// wide, and Read Me cards blamed the pit's width when the instructions named the wrong dash key.
test('the analyst is told when deaths are falls, and which keys each ghost pressed when it died', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'ghostrun-explain-'));
  try {
    await mkdir(join(runDir, 'newbie'));
    await writeFile(join(runDir, 'newbie', 'f0.jpg'), Buffer.from('fake-jpeg'));
    const traces = [{ persona: 'newbie', frames: [{ file: 'f0.jpg' }], steps: [{ step: 7, thought: 'Dash now', move: { hold: ['ArrowRight'], tap: ['z'], click: [], duration_ms: 400 } }] }];
    const ask = async (f) => {
      const model = fakeModel(['Add a visual cue.']);
      await explainHotspots({ findings: [f], ghostsTotal: 4, worldW: 1200, worldH: 360 }, { runDir, traces, client: model.client });
      return factsOf(model.calls[0]);
    };
    const fell = await ask(finding({ type: 'blocker', passed: [], center: { x: 900, y: 360 }, evidence: [{ persona: 'newbie', clip: [0, 0], step: 7 }] }));
    assert.match(fell, /died by falling/);
    assert.match(fell, /newbie: held ArrowRight, tapped z for 400 ms/);
    const spikes = await ask(finding({ type: 'blocker', passed: [], center: { x: 900, y: 322 }, evidence: [{ persona: 'newbie', clip: [0, 0], step: 7 }] }));
    assert.doesNotMatch(spikes, /died by falling/);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
