// The window is made big enough to show the whole game. Found on Coiner (a real js13k game, 22 Nov): its 500x500
// canvas was cut at 640x360, the character was off screen, and the report blamed the game's controls.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { fitSize, measureCanvas } from '../src/fit.mjs';

const VP = { width: 640, height: 360 };

test('a canvas that fits keeps the window; a bigger one gets a bigger window, within limits', () => {
  assert.deepEqual(fitSize(VP, { x: 0, y: 0, width: 640, height: 360 }), VP);
  assert.deepEqual(fitSize(VP, null), VP);
  assert.deepEqual(fitSize(VP, { x: 70, y: 8, width: 500, height: 500 }), { width: 640, height: 508 });
  assert.deepEqual(fitSize(VP, { x: 0, y: 0, width: 804, height: 804 }), { width: 804, height: 768 });
  assert.deepEqual(fitSize(VP, { x: 0, y: 0, width: 2000, height: 300 }), { width: 1024, height: 360 });
});

test('the canvas of a real page is measured where the ghosts would see it', async () => {
  const page = '<!doctype html><body style="margin:8px"><canvas width="500" height="500" style="display:block;margin:0 auto"></canvas></body>';
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page);
  });
  await new Promise((ok) => server.listen(0, ok));
  const browser = await chromium.launch();
  try {
    const rect = await measureCanvas(browser, `http://localhost:${server.address().port}/`, VP);
    assert.equal(rect.width, 500);
    assert.equal(rect.height, 500);
    assert.deepEqual(fitSize(VP, rect), { width: 640, height: 508 });
  } finally {
    await browser.close();
    server.close();
  }
});
