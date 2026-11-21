// How well does the model see its own character? Each move, a ghost reports where it thinks its
// character is on screen (0-1000 grid). The game reports where it really is. No extra API cost:
// this reads the traces of an existing benchmark run.
// node bench/perception.mjs <label>
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] ?? 'baseline';
const { results } = JSON.parse(await readFile(join('bench', 'results', `${label}.json`), 'utf8'));
const SCREEN_W = 640;
const SCREEN_H = 360;

const perGame = {};
for (const row of results.filter((r) => r.dir)) {
  const cfg = JSON.parse(await readFile(join(row.dir, 'config.json'), 'utf8'));
  for (const p of cfg.personas) {
    const file = join(row.dir, p, 'trace.json');
    if (!existsSync(file)) continue;
    const t = JSON.parse(await readFile(file, 'utf8'));
    for (const s of t.steps) {
      if (!s.player || !s.frames) continue;
      // The frame captured right before this move shows the same screen the model saw (the clock was frozen).
      const truth = t.frames[Math.max(0, s.frames[0] - 1)]?.state;
      if (!truth || !Number.isFinite(truth.screenX) || !Number.isFinite(truth.screenY)) continue;
      const gx = (s.player.x / 1000) * SCREEN_W;
      const gy = (s.player.y / 1000) * SCREEN_H;
      const err = Math.hypot(gx - truth.screenX, gy - truth.screenY);
      (perGame[row.game] ??= []).push(err);
    }
  }
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const rows = Object.entries(perGame).map(([game, errs]) => ({
  game,
  n: errs.length,
  median: Math.round(median(errs)),
  within40: Math.round((errs.filter((e) => e <= 40).length / errs.length) * 100),
  within100: Math.round((errs.filter((e) => e <= 100).length / errs.length) * 100),
}));
const all = Object.values(perGame).flat();
const lines = [
  `# Perception check — ${label}`,
  '',
  'Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.',
  `Error = distance in pixels between the two. 40 px ≈ two character widths.`,
  '',
  '| Game | Moves | Median error | Within 40 px | Within 100 px |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.game} | ${r.n} | ${r.median} px | ${r.within40}% | ${r.within100}% |`),
  `| **All** | ${all.length} | ${Math.round(median(all))} px | ${Math.round((all.filter((e) => e <= 40).length / all.length) * 100)}% | ${Math.round((all.filter((e) => e <= 100).length / all.length) * 100)}% |`,
];
await writeFile(join('bench', 'results', `perception-${label}.md`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
