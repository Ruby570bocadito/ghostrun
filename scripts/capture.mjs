// Screenshot a page of the running app (for the README, the Devpost gallery and the video).
// node scripts/capture.mjs <url> <out.png> [waitMs] [width]
import { chromium } from 'playwright';

const [url, out, waitMs = '6000', width = '1280'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node scripts/capture.mjs <url> <out.png> [waitMs] [width]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 800 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`saved ${out}`);
