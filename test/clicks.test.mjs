// A ghost's click must last long enough for a game that checks the mouse button once per frame. Found on Big Champ
// (a real js13k game, 22 Nov): instant clicks never passed its "Tap" screen and the report blamed the game.
// No network and no model: a tiny local game and a fake brain that clicks once.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { runGhost } from '../src/ghost.mjs';

// The game notices the button only from its frame loop, like many small games do.
const GAME = `<!doctype html><body style="margin:0;background:#123"><canvas id="c" width="640" height="360"></canvas><script>
const c = document.getElementById('c'), g = c.getContext('2d');
for (let i = 0; i < 40; i++) { g.fillStyle = 'hsl(' + i * 9 + ',70%,50%)'; g.fillRect((i * 53) % 600, (i * 37) % 320, 40, 30); }
let down = false, told = false;
c.addEventListener('mousedown', () => { down = true; });
c.addEventListener('mouseup', () => { down = false; });
(function frame() {
  if (down && !told) { told = true; fetch('/seen'); }
  requestAnimationFrame(frame);
})();
</script></body>`;

test('a ghost click keeps the button down for at least one game frame', async () => {
  let seen = false;
  const server = createServer((req, res) => {
    if (req.url === '/seen') seen = true;
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(req.url === '/seen' ? '' : GAME);
  });
  await new Promise((ok) => server.listen(0, ok));
  const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-click-'));
  const browser = await chromium.launch();
  try {
    let calls = 0;
    const brain = {
      id: 'fake',
      model: 'fake',
      decide: async () => {
        calls += 1;
        const move = { thought: 'Click the middle', saw: 'menu', player: null, click: calls === 1 ? [{ x: 320, y: 180 }] : [], hold: [], tap: [], duration_ms: 300, confused: false, quit: calls > 1 };
        return { move, usage: { input: 0, output: 0 }, latencyMs: 0 };
      },
    };
    await runGhost({ browser, url: `http://localhost:${server.address().port}/`, brain, persona: { id: 'newbie', name: 'The Newbie', style: '' }, maxSteps: 2, outDir });
    assert.equal(seen, true, 'the game saw the button down during a frame');
  } finally {
    await browser.close();
    server.close();
    await rm(outDir, { recursive: true, force: true });
  }
});

// Found on Dead Again (a real js13k game, 22 Nov): it creates its canvas 1-3 s after the page has loaded, once its
// assets are in, which the frozen game clock does not speed up. It was refused as "no canvas".
test('a game that creates its canvas a second after loading is played, not refused', async () => {
  const LATE = `<!doctype html><body style="margin:0;background:#123"><script>
fetch('/asset').then(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; document.body.appendChild(c);
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { g.fillStyle = 'hsl(' + i * 9 + ',70%,50%)'; g.fillRect((i * 53) % 600, (i * 37) % 320, 40, 30); }
});
</script></body>`;
  const server = createServer((req, res) => {
    if (req.url === '/asset') return setTimeout(() => res.end('ok'), 1000); // a slow asset, in real time
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(LATE);
  });
  await new Promise((ok) => server.listen(0, ok));
  const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-late-'));
  const browser = await chromium.launch();
  try {
    const brain = { id: 'fake', model: 'fake', decide: async () => ({ move: { thought: 'Done', saw: 'menu', player: null, click: [], hold: [], tap: [], duration_ms: 200, confused: false, quit: true }, usage: { input: 0, output: 0 }, latencyMs: 0 }) };
    const trace = await runGhost({ browser, url: `http://localhost:${server.address().port}/`, brain, persona: { id: 'newbie', name: 'The Newbie', style: '' }, maxSteps: 1, outDir });
    assert.ok(trace.frames.length > 0, 'the ghost got to see the game');
    assert.equal(trace.error ?? null, null);
  } finally {
    await browser.close();
    server.close();
    await rm(outDir, { recursive: true, force: true });
  }
});

// Found on Big Champ (a real js13k game, 22 Nov): its dark start screen only says "Tap", a small JPEG, and a fixed
// size threshold refused it as a blank screen. A truly empty canvas is still refused.
test('a nearly empty start screen is played, a truly blank one is refused', async () => {
  const pages = {
    '/tap': '<!doctype html><body style="margin:0;background:#222"><canvas id="c" width="640" height="360"></canvas><script>const g=document.getElementById("c").getContext("2d");g.fillStyle="#222";g.fillRect(0,0,640,360);g.fillStyle="#fff";g.font="bold 20px sans-serif";g.fillText("Tap",300,185);</script></body>',
    '/blank': '<!doctype html><body style="margin:0;background:#000"><canvas width="640" height="360"></canvas></body>',
  };
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(pages[req.url] ?? '');
  });
  await new Promise((ok) => server.listen(0, ok));
  const browser = await chromium.launch();
  const brain = { id: 'fake', model: 'fake', decide: async () => ({ move: { thought: 'Done', saw: 'menu', player: null, click: [], hold: [], tap: [], duration_ms: 200, confused: false, quit: true }, usage: { input: 0, output: 0 }, latencyMs: 0 }) };
  const play = async (path) => {
    const outDir = await mkdtemp(join(tmpdir(), 'ghostrun-blank-'));
    try {
      return await runGhost({ browser, url: `http://localhost:${server.address().port}${path}`, brain, persona: { id: 'newbie', name: 'The Newbie', style: '' }, maxSteps: 1, outDir });
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  };
  try {
    const tap = await play('/tap');
    assert.ok(tap.frames.length > 0, 'the "Tap" screen is played');
    const blank = await play('/blank'); // the ghost reports its error in the trace, it does not throw
    assert.match(blank.error?.message ?? '', /blank/i);
  } finally {
    await browser.close();
    server.close();
  }
});
