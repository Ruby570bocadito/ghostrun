// Which inputs a game can hear at all (src/listeners.mjs). Found on Big Champ and Coiner (real js13k games played only
// with the mouse, 24 Nov): their screens move on their own, so every key looked as if it did something and most ghosts
// kept pressing arrows. No network and no model: tiny local pages and a fake brain.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { canHear, cannotHear, hearingNote, hearingOf } from '../src/listeners.mjs';
import { runGhost } from '../src/ghost.mjs';

test('what a game hears, from the event types it listens to', () => {
  // Measured on 24 Nov: Big Champ, Coiner, SpaceTaxi, Escape from Death Hole.
  assert.deepEqual(hearingOf(['mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel']), { keys: false, mouse: true });
  assert.deepEqual(hearingOf(['mousedown', 'mousemove', 'mouseup', 'touchstart']), { keys: false, mouse: true });
  assert.deepEqual(hearingOf(['keydown', 'keyup']), { keys: true, mouse: false });
  assert.deepEqual(hearingOf(['keydown', 'keyup', 'mousedown', 'mouseup']), { keys: true, mouse: true });
  assert.deepEqual(hearingOf(['pointermove']), { keys: false, mouse: true }); // aimed by moving the mouse
  assert.deepEqual(hearingOf(['touchstart', 'load', 'resize']), { keys: false, mouse: false });
});

test('an input counts as unheard only when the game hears exactly one of the keyboard and the mouse', () => {
  const mouseOnly = { keys: false, mouse: true };
  const keysOnly = { keys: true, mouse: false };
  assert.equal(cannotHear(mouseOnly, 'ArrowRight'), true);
  assert.equal(cannotHear(mouseOnly, 'Space'), true);
  assert.equal(cannotHear(mouseOnly, 'click'), false);
  assert.equal(cannotHear(mouseOnly, 'drag'), false);
  assert.equal(cannotHear(keysOnly, 'click'), true);
  assert.equal(cannotHear(keysOnly, 'drag'), true);
  assert.equal(cannotHear(keysOnly, 'KeyZ'), false);
  // Both, neither (touch, a gamepad, handlers we cannot see) or unknown: no claim.
  for (const hears of [{ keys: true, mouse: true }, { keys: false, mouse: false }, null]) {
    assert.equal(cannotHear(hears, 'ArrowRight'), false);
    assert.equal(cannotHear(hears, 'click'), false);
    assert.equal(hearingNote(hears), null);
  }
  assert.match(hearingNote(mouseOnly), /no keyboard handlers.*play it with the mouse/);
  assert.match(hearingNote(keysOnly), /no mouse handlers.*play it with the keys/);
});

test('the handlers of a page are read in the browser: added ones, on* properties, and same-site frames', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<canvas></canvas><script>document.querySelector('canvas').addEventListener('mousedown', () => {}); window.addEventListener('touchstart', () => {});</script>`);
    assert.deepEqual(await canHear(page), { keys: false, mouse: true });
    await page.setContent(`<canvas></canvas><script>document.onkeydown = () => {};</script>`);
    assert.deepEqual(await canHear(page), { keys: true, mouse: false });
    await page.setContent(`<canvas onclick="void 0"></canvas><iframe srcdoc="<script>window.addEventListener('keyup', () => {})</script>"></iframe>`);
    await page.waitForTimeout(200);
    assert.deepEqual(await canHear(page), { keys: true, mouse: true });
  } finally {
    await browser.close();
  }
});

// Like Big Champ and Coiner: a still title screen, and after a click a game whose screen moves on its own and that
// hears only the mouse (a square drifts every frame; each click turns the background another colour).
const MOUSE_GAME = `<!doctype html><body style="margin:0;background:#123"><canvas id="c" width="640" height="360"></canvas><script>
const c = document.getElementById('c'), g = c.getContext('2d');
let x = 0, y = 200, vy = 0, bg = '#123', playing = false;
c.addEventListener('mousedown', () => { if (!playing) { playing = true; return; } vy = -8; bg = bg === '#123' ? '#531' : '#123'; });
(function frame() {
  if (playing) { x = (x + 4) % 600; vy += 0.5; y = Math.min(200, y + vy); }
  g.fillStyle = bg; g.fillRect(0, 0, 640, 360);
  for (let i = 0; i < 40; i++) { g.fillStyle = 'hsl(' + i * 9 + ',70%,50%)'; g.fillRect((i * 53) % 600, (i * 37) % 120, 40, 30); }
  g.fillStyle = '#9bf6ec'; g.fillRect(x, y, 40, 40);
  requestAnimationFrame(frame);
})();
</script></body>`;

test('keys in a game that cannot hear them: never counted as working, and the ghost is told', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(MOUSE_GAME);
  });
  await new Promise((ok) => server.listen(0, ok));
  const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-hear-'));
  const browser = await chromium.launch();
  try {
    const seen = [];
    let calls = 0;
    const brain = {
      id: 'fake',
      model: 'fake',
      decide: async ({ notes, history }) => {
        calls += 1;
        seen.push({ notes, history: [...history] });
        const base = { thought: 'try', saw: 'playing', player: null, click: [], drag: [], hold: [], tap: [], duration_ms: 600, confused: false, quit: false };
        const move = calls === 1 ? { ...base, hold: ['ArrowRight'] } : calls === 2 ? { ...base, click: [{ x: 320, y: 180 }] } : { ...base, quit: true };
        return { move, usage: { input: 0, output: 0 }, latencyMs: 0 };
      },
    };
    const trace = await runGhost({ browser, url: `http://localhost:${server.address().port}/`, brain, persona: { id: 'newbie', name: 'The Newbie', style: '' }, maxSteps: 3, outDir, stopWhenSaturated: false, debrief: false });
    assert.deepEqual(trace.hears, { keys: false, mouse: true });
    // The autopilot did not try keys the game cannot hear.
    assert.deepEqual(trace.autopilot.tried.map((t) => t.input), ['click']);
    // Its first try is its own; told once it has pressed a key the game cannot hear.
    assert.equal(seen[0].notes.some((n) => /no keyboard handlers/.test(n)), false);
    assert.ok(seen[1].notes.some((n) => /no keyboard handlers/.test(n)), seen[1].notes.join(' | '));
    // ArrowRight did not count as making the screen answer, though the square kept moving; the click did.
    const after1 = trace.steps[0].inputs;
    assert.deepEqual(after1.ArrowRight, { used: 1, changed: 0 });
    assert.equal(trace.steps[1].inputs.click.changed >= 1, true);
    // And the move's result said the change was the game's own.
    assert.match(seen[1].history.at(-1), /on its own: this game cannot hear keys/);
  } finally {
    await browser.close();
    server.close();
    await rm(outDir, { recursive: true, force: true });
  }
});
