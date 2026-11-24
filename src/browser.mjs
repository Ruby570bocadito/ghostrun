// How the ghosts' Chromium is launched. Headless Chromium draws WebGL on the CPU (SwiftShader) unless told to use
// the GPU, and with the game clock frozen every frame of game time is drawn: on Godot and GameMaker games from
// itch.io one second of game cost 8–27 s of wall time with four ghosts (measured 23 Nov, rediseno/v3/speed/).
// With the GPU it is about 1 s. 2D canvases stay on the CPU, which is faster for small Phaser games like ours.
export const LAUNCH_OPTIONS = { args: ['--enable-gpu', '--disable-accelerated-2d-canvas'] };

// WebGL through Vulkan (24 Nov). On Windows, Chromium draws WebGL through Direct3D 11 by default, and compiling an
// engine game's shaders there took most of its start-up: with four ghosts, the first game frame of Prerolled (Godot)
// came after 21-24 s and Broken Repair's after 20-28 s; through Vulkan after 12-13 s and 5.5-9 s, and the games drew
// 2-3 times more frames per second of wall time (no AI, same machine). Decogear (GameMaker) did not change: its 12 s
// start-up is work on the processor. Our own games draw on a 2D canvas, on the CPU, and play the same either way.
// GHOST_ANGLE=default keeps Chromium's default.
export const VULKAN_ARGS = ['--use-angle=vulkan'];

/** A renderer name that is a real GPU (not a software one such as SwiftShader). */
export function isHardwareRenderer(name) {
  return typeof name === 'string' && name.trim().length > 0 && !/swiftshader|llvmpipe|lavapipe|software|basic render/i.test(name);
}

/** The renderer a browser draws WebGL with (the GPU's name as WebGL reports it), or null without WebGL. */
export async function webglRenderer(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    });
  } finally {
    await page.close().catch(() => {});
  }
}

let vulkanWorks = null; // does Vulkan draw WebGL on a real GPU on this machine? Checked on the first launch.
let launched = null;

/**
 * Launches the ghosts' Chromium: WebGL through Vulkan when that runs on a real GPU here (checked once per process),
 * else Chromium's default. launchedWith() tells which.
 */
export async function launchBrowser(chromium, options = {}) {
  const args = [...LAUNCH_OPTIONS.args, ...(options.args ?? [])];
  if ((process.env.GHOST_ANGLE ?? 'vulkan') !== 'default' && vulkanWorks !== false) {
    const browser = await chromium.launch({ ...LAUNCH_OPTIONS, ...options, args: [...args, ...VULKAN_ARGS] });
    if (vulkanWorks === null) {
      const name = await webglRenderer(browser).catch(() => null);
      vulkanWorks = /vulkan/i.test(name ?? '') && isHardwareRenderer(name);
    }
    if (vulkanWorks) {
      launched = 'vulkan';
      return browser;
    }
    await browser.close().catch(() => {});
  }
  launched = 'default';
  return chromium.launch({ ...LAUNCH_OPTIONS, ...options, args });
}

/** How the last browser was launched: 'vulkan', 'default', or null before any launch. */
export const launchedWith = () => launched;

/** Tests: forget the Vulkan check, as in a new process. */
export function resetLaunchCheck() {
  vulkanWorks = null;
  launched = null;
}
