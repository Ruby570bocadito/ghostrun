// Contrast of every objective players must see, per game variant, measured on saved runs with the same
// code the app uses (src/contrast.mjs). No AI, no API calls.
// node bench/probe-contrast.mjs <bench label>...
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CONTRAST_MIN, measureObjectives } from '../src/contrast.mjs';

const labels = process.argv.slice(2);
const browser = await chromium.launch();
const seen = new Map();
for (const label of labels) {
  const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
  for (const r of results.filter((x) => x.dir)) {
    const cfg = JSON.parse(await readFile(join(r.dir, 'config.json'), 'utf8'));
    const traces = [];
    for (const p of cfg.personas) {
      const f = join(r.dir, p, 'trace.json');
      if (existsSync(f)) traces.push(JSON.parse(await readFile(f, 'utf8')));
    }
    for (const o of await measureObjectives({ browser, traces, readFrame: (persona, file) => readFile(join(r.dir, persona, file)) })) {
      const key = `${r.game} | ${r.variant} | ${o.name}`;
      (seen.get(key) ?? seen.set(key, []).get(key)).push(o.ratio);
    }
  }
}
await browser.close();
const lines = ['| Game | Variant | Objective | Contrast (runs) | WCAG 3:1 |', '|---|---|---|---|---|'];
for (const [k, v] of [...seen.entries()].sort()) {
  const [game, variant, name] = k.split(' | ');
  lines.push(`| ${game} | ${variant} | ${name} | ${[...new Set(v.map((x) => x.toFixed(2)))].join(', ')}:1 (${v.length}) | ${Math.min(...v) < CONTRAST_MIN ? '**fails**' : 'passes'} |`);
}
await writeFile(join('bench', 'results', 'contrast.md'), `# Objective contrast (${labels.join(', ')})\n\n${lines.join('\n')}\n`);
console.log(lines.join('\n'));
