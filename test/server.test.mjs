// Starts the real app server in public-demo mode, without an API key (nothing can be spent), and checks
// what it refuses. Uses its own ports so it can run next to a running app.
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 5197;
const base = `http://localhost:${PORT}`;
let server;

before(async () => {
  const env = { ...process.env, PORT: String(PORT), GAMES_PORT: '5196', GHOSTRUN_PUBLIC: '1' };
  delete env.MODEL_API_KEY;
  server = spawn(process.execPath, ['src/server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('server did not start')), 15_000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('Ghostrun on')) {
        clearTimeout(timer);
        ok();
      }
    });
    server.on('exit', (code) => fail(new Error(`server exited with ${code}`)));
  });
});

after(() => server?.kill());

const postRun = (body) =>
  fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('the public demo refuses links to the server\'s own network', async () => {
  for (const url of ['http://127.0.0.1:8080/', 'http://localhost:3000/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:5180/', 'http://10.0.0.1/']) {
    const res = await postRun({ url });
    assert.equal(res.status, 400, url);
    assert.equal((await res.json()).error, 'private_url', url);
  }
});

test('bad input gets a clear 400, not a server error', async () => {
  const notJson = await postRun('{"url": ');
  assert.equal(notJson.status, 400);
  assert.equal((await notJson.json()).error, 'bad_json');
  const notLink = await postRun({ url: 'my game' });
  assert.equal((await notLink.json()).error, 'invalid_url');
  const badPath = await fetch(`${base}/runs/%E0%A4%A`);
  assert.equal(badPath.status, 400);
});

test('files outside the runs folder cannot be read', async () => {
  for (const path of ['/runs/..%2Fpackage.json', '/runs/..%2F..%2Fpackage.json']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 403, path);
  }
  // "%2E%2E" is a ".." the URL parser resolves before our checks: the path becomes /src/server.mjs, which
  // is not under web/dist, so the app answers with its own page, never with the file.
  for (const path of ['/runs/%2E%2E/src/server.mjs', '/%2E%2E/%2E%2E/package.json', '/../../src/guard.mjs']) {
    const res = await fetch(`${base}${path}`);
    const body = await res.text();
    assert.ok(!body.includes('createServer') && !body.includes('"dependencies"') && !body.includes('isPrivateAddress'), path);
  }
});

test('our test games are playable at the app\'s own address, and the ghosts may open them', async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const list = await fetch(`${base}/play/`);
  assert.equal(list.status, 200);
  assert.match(await list.text(), /Play the test games yourself/);
  const game = await (await fetch(`${base}/play/gap-run/`)).text();
  assert.match(game, /\/vendor\/phaser\.js/);
  assert.equal((await fetch(`${base}/vendor/phaser.js`)).status, 200);
  assert.equal((await fetch(`${base}/sdk/ghost-sdk.js`)).status, 200);
  const escape = await fetch(`${base}/play/..%2F..%2Fpackage.json`); // stays inside games/: not found, nothing leaked
  assert.ok([403, 404].includes(escape.status));
  assert.ok(!(await escape.text()).includes('"dependencies"'));
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.ok(config.games.every((g) => g.url.startsWith('/play/')));
  // A link to our own /play/ is opened from the local games server: allowed (here it stops at "no key").
  const own = await postRun({ url: `${base}/play/gap-run/?fault=gap` });
  assert.equal((await own.json()).error, 'no_key');
  // The app itself, or anything else on this machine, is not.
  const app = await postRun({ url: `${base}/api/config` });
  assert.equal((await app.json()).error, 'private_url');
});

test('other people\'s runs and recorded sessions are not listed in the public demo', async () => {
  assert.equal((await fetch(`${base}/api/runs`)).status, 404);
  assert.equal((await fetch(`${base}/api/humans`)).status, 404);
  assert.equal((await fetch(`${base}/runs/_spend.json`)).status, 404);
  assert.equal((await fetch(`${base}/runs/humans/x.json`)).status, 404);
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.public, true);
  assert.equal(config.hasKey, false);
});
