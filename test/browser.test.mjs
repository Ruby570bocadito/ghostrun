import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VULKAN_ARGS, isHardwareRenderer, launchBrowser, launchedWith, resetLaunchCheck } from '../src/browser.mjs';

// A Chromium stand-in: each launch returns a browser whose WebGL reports `renderer(args)`.
function fakeChromium(renderer) {
  const launches = [];
  return {
    launches,
    async launch(options) {
      const browser = {
        args: options.args,
        closed: false,
        async newPage() {
          return { evaluate: async () => renderer(options.args), close: async () => {} };
        },
        async close() {
          browser.closed = true;
        },
      };
      launches.push(browser);
      return browser;
    },
  };
}
const usesVulkan = (args) => VULKAN_ARGS.every((a) => args.includes(a));

test('software renderers are not a GPU', () => {
  assert.equal(isHardwareRenderer('ANGLE (Intel, Vulkan 1.4.325 (Intel(R) Arc(TM) Graphics (0x00007D55)), Intel Corporation)'), true);
  assert.equal(isHardwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), false);
  assert.equal(isHardwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'), false);
  assert.equal(isHardwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)'), false);
  assert.equal(isHardwareRenderer(''), false);
  assert.equal(isHardwareRenderer(null), false);
});

test('WebGL through Vulkan when it runs on a real GPU, checked once', async () => {
  resetLaunchCheck();
  const chromium = fakeChromium((args) => (usesVulkan(args) ? 'ANGLE (Intel, Vulkan 1.4.325 (Intel(R) Arc(TM) Graphics), Intel Corporation)' : 'ANGLE (Intel, Direct3D11)'));
  const first = await launchBrowser(chromium);
  assert.ok(usesVulkan(first.args));
  assert.ok(first.args.includes('--enable-gpu'));
  assert.equal(first.closed, false);
  assert.equal(launchedWith(), 'vulkan');
  const second = await launchBrowser(chromium);
  assert.ok(usesVulkan(second.args));
  assert.equal(chromium.launches.length, 2); // no second check, no extra browser
});

test('Vulkan on a software renderer: closed, and the default from then on', async () => {
  resetLaunchCheck();
  const chromium = fakeChromium((args) => (usesVulkan(args) ? 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' : 'ANGLE (Intel, Direct3D11)'));
  const browser = await launchBrowser(chromium);
  assert.equal(chromium.launches.length, 2);
  assert.equal(chromium.launches[0].closed, true);
  assert.equal(usesVulkan(browser.args), false);
  assert.equal(launchedWith(), 'default');
  await launchBrowser(chromium);
  assert.equal(chromium.launches.length, 3); // straight to the default
});

test('no WebGL at all with Vulkan: the default', async () => {
  resetLaunchCheck();
  const chromium = fakeChromium((args) => (usesVulkan(args) ? null : 'ANGLE (Intel, Direct3D11)'));
  const browser = await launchBrowser(chromium);
  assert.equal(usesVulkan(browser.args), false);
  assert.equal(launchedWith(), 'default');
});

test('GHOST_ANGLE=default keeps Chromium\'s default without trying Vulkan', async () => {
  resetLaunchCheck();
  const before = process.env.GHOST_ANGLE;
  process.env.GHOST_ANGLE = 'default';
  try {
    const chromium = fakeChromium(() => 'ANGLE (Intel, Vulkan 1.4.325 (Intel(R) Arc(TM) Graphics), Intel Corporation)');
    const browser = await launchBrowser(chromium);
    assert.equal(chromium.launches.length, 1);
    assert.equal(usesVulkan(browser.args), false);
    assert.equal(launchedWith(), 'default');
  } finally {
    if (before === undefined) delete process.env.GHOST_ANGLE;
    else process.env.GHOST_ANGLE = before;
  }
});
