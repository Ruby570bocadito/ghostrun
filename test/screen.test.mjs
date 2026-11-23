import { test } from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import { InputTable, compareGrids, describeChange, grayGrid, isEffect, screenHash } from '../src/screen.mjs';

const W = 640;
const H = 360;
// A screenshot as JPEG from a function (x, y) → grey level.
const shot = (f) => {
  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = f(x, y);
    const i = (y * W + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return jpeg.encode({ data, width: W, height: H }, 85).data;
};
// A level-like picture: blocks of varied grey, so a shift can be recognised.
const level = (ox = 0) => (x, y) => ((Math.floor((x + ox) / 40) * 37 + Math.floor(y / 30) * 91) % 200) + 20;

test('the same screen twice: nothing changed', () => {
  const a = grayGrid(shot(level()));
  const c = compareGrids(a, grayGrid(shot(level())));
  assert.ok(c.fraction < 0.004);
  assert.equal(describeChange(c), 'nothing changed on screen');
  assert.equal(isEffect(c), false);
});

test('a small thing moving in the middle is located', () => {
  const base = (x, y) => 30;
  const moved = (x, y) => (x > 300 && x < 330 && y > 160 && y < 190 ? 230 : 30);
  const c = compareGrids(grayGrid(shot(base)), grayGrid(shot(moved)));
  assert.ok(c.fraction > 0 && c.fraction < 0.03);
  assert.equal(describeChange(c), 'something small changed around the centre');
  assert.equal(isEffect(c), true);
});

test('the whole picture shifting is a scroll, told as the way the character went', () => {
  // The level drawn 60 px further left means the camera moved right.
  const c = compareGrids(grayGrid(shot(level(0))), grayGrid(shot(level(60))));
  assert.ok(c.scroll, 'scroll detected');
  assert.ok(c.scroll.dx < 0);
  assert.match(describeChange(c), /the view scrolled right \(you moved\)/);
});

test('a different screen altogether', () => {
  const c = compareGrids(grayGrid(shot(() => 20)), grayGrid(shot((x, y) => (x + y) % 255)));
  assert.equal(describeChange(c), 'the whole screen changed');
});

test('changes the screen makes on its own are not credited to the input', () => {
  const c = { fraction: 0.02, box: { x0: 1, y0: 1, x1: 5, y1: 5 }, scroll: null };
  assert.equal(isEffect(c, 0.03), false);
  assert.equal(describeChange(c, 0.03), 'nothing changed on screen');
});

test('the input table counts which inputs make the screen answer', () => {
  const t = new InputTable();
  t.add(['ArrowRight'], true);
  t.add(['ArrowRight', 'Space'], true);
  t.add(['click'], false);
  t.add(['ArrowRight'], false);
  assert.equal(t.note(), 'What your inputs did so far (times the screen answered / times used): ArrowRight 2/3 · Space 1/1 · click 0/1.');
  assert.deepEqual(t.toJSON().click, { used: 1, changed: 0 });
});

test('nearly equal screens have the same fingerprint, different ones do not', () => {
  const a = screenHash(grayGrid(shot(level())));
  assert.equal(a.length, 88);
  assert.equal(screenHash(grayGrid(shot(level()))), a);
  assert.notEqual(screenHash(grayGrid(shot(() => 240))), a);
});
