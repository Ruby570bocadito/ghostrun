// How the ghosts' Chromium is launched. Headless Chromium draws WebGL on the CPU (SwiftShader) unless told to use
// the GPU, and with the game clock frozen every frame of game time is drawn: on Godot and GameMaker games from
// itch.io one second of game cost 8–27 s of wall time with four ghosts (measured 23 Nov, rediseno/v3/speed/).
// With the GPU it is about 1 s. 2D canvases stay on the CPU, which is faster for small Phaser games like ours.
export const LAUNCH_OPTIONS = { args: ['--enable-gpu', '--disable-accelerated-2d-canvas'] };
