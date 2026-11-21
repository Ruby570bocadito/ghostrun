// Drives the real app in a headless browser, step by step, and prints what a person would see.
// Used by test agents (and by us) to use Ghostrun for real instead of imagining it.
//
// node scripts/drive.mjs [--base http://localhost:5180] [--size 1280x800] [--out dir] step [step …]
//
// Steps (each word in quotes if it has spaces):
//   goto <path|url>           open a page ("/" is the home page, "/play/" the test games for people)
//   click <text>              click the button, link or element whose text contains <text>
//   fill <label> <value>      type into the field found by its label or placeholder
//   select <label> <option>   choose an option of a drop-down found by its label
//   press <key>               press a key (Enter, Tab, ArrowRight, Space…)
//   wait <ms>                 wait
//   waitfor <text> [ms]       wait until <text> is on the page (default 240000 ms, case-insensitive)
//   text                      print the visible text of the page
//   shot <name>               save a screenshot (<out>/<name>.png) and print its path
//   url                       print the address
//   scroll <down|up|top|bottom>
// At the end it prints errors from the page console and requests that failed, and any element wider
// than the screen (things that do not fit, for small screens).
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = { base: 'http://localhost:5180', size: '1280x800', out: resolve('runs', '_drive') };
while (argv[0]?.startsWith('--')) {
  const k = argv.shift().slice(2);
  opt[k] = argv.shift();
}
const [w, h] = opt.size.split('x').map(Number);
const mobile = w < 600;
await mkdir(opt.out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const page = await context.newPage();
const consoleErrors = [];
const failed = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => consoleErrors.push(`page error: ${e.message.slice(0, 200)}`));
page.on('requestfailed', (r) => {
  if (!/\/stream$/.test(r.url())) failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 120)}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
});

const visibleText = async () => (await page.evaluate(() => document.body.innerText)).replace(/\n{3,}/g, '\n\n').trim();
// What is typed or chosen in the visible fields (not part of the page text).
const fieldValues = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const label = el.labels?.[0]?.innerText?.split('\n')[0] || el.placeholder || el.id || el.name || el.tagName.toLowerCase();
        const value = el.type === 'checkbox' ? (el.checked ? 'checked' : 'not checked') : el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.text : el.value;
        return `  [${label.trim()}] = ${value || '(empty)'}`;
      })
      .join('\n'),
  );

async function clickText(text) {
  const tries = [
    page.getByRole('button', { name: text }),
    page.getByRole('link', { name: text }),
    page.getByRole('option', { name: text }),
    page.getByText(text, { exact: false }),
  ];
  for (const loc of tries) {
    const n = await loc.count();
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      if (await el.isVisible()) {
        await el.click({ timeout: 5000 });
        return;
      }
    }
  }
  throw new Error(`nothing visible to click with text "${text}"`);
}

async function field(label) {
  for (const loc of [page.getByLabel(label, { exact: false }), page.getByPlaceholder(label, { exact: false })]) {
    if ((await loc.count()) && (await loc.first().isVisible())) return loc.first();
  }
  throw new Error(`no field with label or placeholder "${label}"`);
}

const steps = [];
while (argv.length) {
  const cmd = argv.shift();
  const arity = { goto: 1, click: 1, fill: 2, select: 2, press: 1, wait: 1, shot: 1, scroll: 1, waitfor: 1 }[cmd] ?? 0;
  const args = argv.splice(0, arity);
  if (cmd === 'waitfor' && argv[0] && /^\d+$/.test(argv[0])) args.push(argv.shift());
  steps.push([cmd, ...args]);
}

let ok = true;
for (const [cmd, a, b] of steps) {
  const label = [cmd, a, b].filter((x) => x !== undefined).join(' ');
  try {
    let info = '';
    if (cmd === 'goto') {
      // Git Bash turns "/play/" into "C:/Program Files/Git/play/": undo that. "home" means "/".
      let path = a.replace(/^[A-Za-z]:[\\/].*?Git(?=[\\/]|$)/, '').replace(/\\/g, '/');
      if (path === 'home' || path === '') path = '/';
      if (!/^https?:/.test(path) && !path.startsWith('/')) path = `/${path}`;
      await page.goto(/^https?:/.test(path) ? path : opt.base + path, { waitUntil: 'networkidle', timeout: 30000 });
    } else if (cmd === 'click') {
      await clickText(a);
      await page.waitForTimeout(600);
    } else if (cmd === 'fill') {
      await (await field(a)).fill(b);
    } else if (cmd === 'select') {
      const el = await field(a);
      await el.selectOption({ label: b }).catch(() => el.selectOption(b));
    } else if (cmd === 'press') {
      await page.keyboard.press(a);
      await page.waitForTimeout(300);
    } else if (cmd === 'wait') {
      await page.waitForTimeout(Number(a));
    } else if (cmd === 'waitfor') {
      const limit = Number(b ?? 240000);
      const t0 = Date.now();
      for (;;) {
        if ((await visibleText()).toLowerCase().includes(a.toLowerCase())) break;
        if (Date.now() - t0 > limit) throw new Error(`"${a}" did not appear within ${limit} ms`);
        await page.waitForTimeout(1000);
      }
      info = `appeared after ${Math.round((Date.now() - t0) / 1000)} s`;
    } else if (cmd === 'text') {
      const fields = await fieldValues();
      info = `\n----- page text -----\n${(await visibleText()).slice(0, 3500)}${fields ? `\n----- fields -----\n${fields}` : ''}\n---------------------`;
    } else if (cmd === 'shot') {
      const file = join(opt.out, `${a}.png`);
      await page.screenshot({ path: file, fullPage: true });
      info = file;
    } else if (cmd === 'url') {
      info = page.url();
    } else if (cmd === 'scroll') {
      await page.evaluate((d) => (d === 'top' ? scrollTo(0, 0) : d === 'bottom' ? scrollTo(0, document.body.scrollHeight) : scrollBy(0, (d === 'up' ? -1 : 1) * innerHeight * 0.8)), a);
    } else {
      throw new Error(`unknown step "${cmd}"`);
    }
    console.log(`✓ ${label}${info ? ` → ${info}` : ''}`);
  } catch (err) {
    ok = false;
    console.log(`✗ ${label} → ${err.message.split('\n')[0]}`);
    console.log(`----- page text at the failure -----\n${(await visibleText().catch(() => '')).slice(0, 2000)}\n------------------------------------`);
    break;
  }
}

// Things that do not fit the screen (only meaningful on small screens).
const overflow = await page
  .evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 2 && getComputedStyle(el).position !== 'fixed') {
        wide.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (right edge ${Math.round(r.right)} px > ${vw})`);
      }
    }
    return { pageWidth: document.documentElement.scrollWidth, vw, wide: [...new Set(wide)].slice(0, 8) };
  })
  .catch(() => null);
console.log(`\nscreen ${w}x${h} · page width ${overflow?.pageWidth ?? '?'} px${overflow && overflow.pageWidth > overflow.vw + 2 ? ' (WIDER THAN THE SCREEN: horizontal scroll)' : ''}`);
if (overflow?.wide.length) console.log(`elements past the right edge: ${overflow.wide.join(', ')}`);
console.log(`console errors: ${consoleErrors.length ? '\n  ' + consoleErrors.join('\n  ') : 'none'}`);
console.log(`failed requests: ${failed.length ? '\n  ' + [...new Set(failed)].slice(0, 10).join('\n  ') : 'none'}`);
await browser.close();
process.exit(ok ? 0 : 1);
