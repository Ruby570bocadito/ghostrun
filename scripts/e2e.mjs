// Walks the real app in a headless browser at three screen sizes and fails if a key control is missing,
// something is wider than the screen, or the page logs an error. No AI is used (no playtest is started).
// node scripts/e2e.mjs [--base http://localhost:5180] [--report <run id>] [--compare <run id>]
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = { base: 'http://localhost:5180', report: '2026-11-21T20-17-41-337Z-64171c', compare: '2026-11-21T19-20-47-236Z-ceeb1c' };
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
const out = resolve('runs', '_e2e');
await mkdir(out, { recursive: true });

const SIZES = [
  ['desktop', 1280, 800],
  ['tablet', 768, 1024],
  ['phone', 375, 667],
];

// Each page: where, what must be visible, and optional actions before checking.
const PAGES = [
  { name: 'home', path: '/', must: [['button', 'Summon the ghosts'], ['textbox', "Your game's link"], ['link', 'See the evidence']] },
  {
    name: 'home-advanced',
    path: '/',
    // The ghosts and the options live behind "Change ghosts and options", so the page has one action.
    act: async (page) => {
      await page.getByText('Change ghosts and options').click();
      await page.getByText('Advanced options').click();
    },
    must: [['button', 'The Newbie'], ['combobox', 'Game window size'], ['checkbox', 'simulate an AI outage']],
  },
  {
    name: 'bad-link',
    path: '/',
    act: async (page) => {
      await page.getByLabel("Your game's link").fill('my game');
      await page.getByRole('button', { name: 'Summon the ghosts' }).click();
      await page.waitForTimeout(800);
    },
    // The app's own message, visible on the page (the browser's bubble is easy to miss and not in the visitor's language).
    check: async (page) => (await page.getByRole('alert').count()) > 0 && /not a link/i.test(await page.getByRole('alert').first().innerText()),
    must: [['button', 'Summon the ghosts']],
  },
  {
    // Found by two test agents (22 Nov): choosing one of our games did not fill in the link.
    name: 'pick-game',
    path: '/',
    act: async (page) => {
      await page.getByLabel('No game handy? Try ours:').selectOption('key-hunt');
      await page.waitForTimeout(300);
    },
    check: async (page) => /\/play\/key-hunt\/$/.test(await page.getByLabel("Your game's link").inputValue()),
    must: [['button', 'Summon the ghosts']],
  },
  { name: 'report', path: `/#/run/${opt.report}`, wait: 3500, must: [['button', 'Re-run after a fix'], ['button', 'New game']], css: ['.finding', '.heatmap canvas'] },
  { name: 'compare', path: `/#/run/${opt.compare}`, wait: 4500, must: [['button', 'Re-run after a fix']], css: ['.finding'], text: ['Before', 'after'] },
  { name: 'play-list', path: '/play/', must: [['link', 'As designed']], text: ['Play the test games yourself'] },
];

const failures = [];
const rows = [];
const browser = await chromium.launch();
for (const [size, w, h] of SIZES) {
  for (const p of PAGES) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`));
    const problems = [];
    try {
      await page.goto(opt.base + p.path, { waitUntil: 'networkidle', timeout: 30000 });
      if (p.wait) await page.waitForTimeout(p.wait);
      if (p.act) await p.act(page);
      for (const [role, name] of p.must ?? []) {
        const loc = page.getByRole(role, { name, exact: false });
        if (!(await loc.count()) || !(await loc.first().isVisible())) problems.push(`missing ${role} "${name}"`);
      }
      for (const sel of p.css ?? []) if (!(await page.locator(sel).count())) problems.push(`missing ${sel}`);
      const text = await page.evaluate(() => document.body.innerText.toLowerCase());
      for (const t of p.text ?? []) if (!text.includes(t.toLowerCase())) problems.push(`missing text "${t}"`);
      if (p.check && !(await p.check(page))) problems.push('the visitor was not told the link is wrong');
      const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }));
      if (widths.page > widths.screen + 2) problems.push(`page is ${widths.page} px wide on a ${widths.screen} px screen (sideways scroll)`);
      await page.screenshot({ path: join(out, `${size}-${p.name}.png`), fullPage: true });
    } catch (err) {
      problems.push(`error: ${err.message.split('\n')[0]}`);
    }
    if (errors.length) problems.push(...errors.map((e) => `console: ${e}`));
    rows.push(`${problems.length ? '✗' : '✓'} ${size.padEnd(7)} ${p.name.padEnd(14)} ${problems.join(' · ')}`);
    if (problems.length) failures.push(`${size}/${p.name}`);
    await context.close();
  }
}
await browser.close();
console.log(rows.join('\n'));
console.log(`\n${failures.length ? `${failures.length} screen(s) with problems` : 'all screens fine'} · screenshots in ${out}`);
process.exit(failures.length ? 1 : 0);
