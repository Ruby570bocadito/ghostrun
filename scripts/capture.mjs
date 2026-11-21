// Screenshot a page of the running app (for the README, the Devpost gallery and the video).
// node scripts/capture.mjs <url> <out.png|out.jpg> [waitMs] [width] [scale] [full|view] [height]
// A .jpg output is saved at quality 82 (light enough for the README); "view" captures only the window.
import { chromium } from 'playwright';

const [url, out, waitMs = '6000', width = '1280', scale = '2', mode = 'full', height = '800'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node scripts/capture.mjs <url> <out.png|out.jpg> [waitMs] [width] [scale] [full|view] [height]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: Number(scale) });
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out, fullPage: mode !== 'view', ...(out.endsWith('.jpg') ? { type: 'jpeg', quality: 82 } : {}) });
await browser.close();
console.log(`saved ${out}`);
