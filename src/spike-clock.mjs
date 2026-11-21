// Spike: can we freeze a Phaser game's clock with Playwright and step it by hand?
// Run: npm run spike
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

const server = await startServer(5174);
const url = 'http://localhost:5174/gap-run/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await mkdir('runs', { recursive: true });

const state = () => page.evaluate(() => ({ ...window.__ghost?.state }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.clock.install();
await page.goto(url);
await sleep(1500); // let Phaser boot with the fake clock flowing
const s0 = await state();
console.log('after boot     frame=%s x=%s', s0.frame, s0.x?.toFixed(1));

const fakeNow = await page.evaluate(() => Date.now());
await page.clock.pauseAt(fakeNow + 50);
const s1 = await state();
await sleep(1000); // real time passes, game time should not
const s2 = await state();
console.log('paused 1s real frame %s -> %s (should not change)', s1.frame, s2.frame);

await page.keyboard.down('ArrowRight');
const t0 = performance.now();
await page.clock.runFor(1000); // 1 s of game time
const realMs = performance.now() - t0;
await page.keyboard.up('ArrowRight');
const s3 = await state();
console.log('runFor(1000) holding Right: frame %s -> %s, x %s -> %s (expect ~+180 px), took %d ms real', s2.frame, s3.frame, s2.x?.toFixed(1), s3.x?.toFixed(1), realMs);

await page.keyboard.down('Space');
await page.clock.runFor(100);
await page.keyboard.up('Space');
const s4 = await state();
await page.clock.runFor(300);
const s5 = await state();
console.log('jump: y %s -> %s (100ms) -> %s (400ms), onFloor=%s', s3.y?.toFixed(1), s4.y?.toFixed(1), s5.y?.toFixed(1), s5.onFloor);

await page.screenshot({ path: 'runs/spike.png' });
const events = await page.evaluate(() => window.__ghost.events);
console.log('events', JSON.stringify(events));

await browser.close();
server.close();
