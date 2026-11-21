// How well does the model see its own character? Each move, a ghost reports where it thinks its
// character is on screen (0-1000 grid). The game reports where it really is. No extra API cost:
// this reads the traces of an existing benchmark run.
// node bench/perception.mjs <label> [pixels|grid]
// The optional second argument overrides the units recorded in the traces. Needed for runs made between
// the pixel-prompt change (1a9c8b2) and the fix that records it through the fallback wrapper: those
// traces say "grid1000" although the prompt asked for pixels.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] ?? 'baseline';
const unitsOverride = process.argv[3];
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
    const deathTimes = t.events.filter((e) => e.type === 'death').map((e) => e.t);
    for (const s of t.steps) {
      if (!s.player || !s.frames) continue;
      // The frame captured right before this move shows the same screen the model saw (the clock was frozen).
      const seen = t.frames[Math.max(0, s.frames[0] - 1)];
      const truth = seen?.state;
      if (!truth || !Number.isFinite(truth.screenX) || !Number.isFinite(truth.screenY)) continue;
      // The character cannot be seen when it is off screen (falling into a pit) or during the red flash after a death.
      const offScreen = truth.screenX < 0 || truth.screenX > SCREEN_W || truth.screenY < 0 || truth.screenY > SCREEN_H - 4;
      const flash = deathTimes.some((d) => seen.pageT >= d && seen.pageT <= d + 250);
      const g = (perGame[row.game] ??= { visible: [], hidden: 0 });
      if (offScreen || flash) {
        g.hidden += 1;
        continue;
      }
      const gx = (s.player.x / 1000) * SCREEN_W;
      const gy = (s.player.y / 1000) * SCREEN_H;
      const asGrid = Math.hypot(gx - truth.screenX, gy - truth.screenY);
      const asPixels = Math.hypot(s.player.x - truth.screenX, s.player.y - truth.screenY);
      // v1 asked for a 0-1000 grid (but also said "640x360"); v2 asks for pixels. Score each answer in the
      // units it was asked for, and also record which reading fits better (the convention mix-up rate).
      const askedPixels = (unitsOverride ?? t.coords) === 'pixels';
      g.visible.push(askedPixels ? asPixels : asGrid);
      g.best = g.best ?? [];
      g.best.push(Math.min(asGrid, asPixels));
      g.wrongUnits = (g.wrongUnits ?? 0) + ((askedPixels ? asGrid < asPixels : asPixels < asGrid) ? 1 : 0);
      g.asked = askedPixels ? 'pixels' : 'grid';
    }
  }
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const rows = Object.entries(perGame).map(([game, g]) => ({
  game,
  n: g.visible.length,
  hidden: g.hidden,
  median: Math.round(median(g.visible)),
  within40: pct(g.visible.filter((e) => e <= 40).length, g.visible.length),
  within100: pct(g.visible.filter((e) => e <= 100).length, g.visible.length),
}));
const all = Object.values(perGame).flatMap((g) => g.visible);
const hidden = Object.values(perGame).reduce((a, g) => a + g.hidden, 0);
const lines = [
  `# Perception check — ${label}`,
  '',
  'Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.',
  'Error = distance in pixels between the two (40 px ≈ two character widths). Moves where the character could not be seen',
  '(off screen while falling into a pit, or during the red flash after a death) are counted apart.',
  '',
  '| Game | Moves (character visible) | Median error | Within 40 px | Within 100 px | Moves with the character not visible |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.game} | ${r.n} | ${r.median} px | ${r.within40}% | ${r.within100}% | ${r.hidden} |`),
  `| **All** | ${all.length} | ${Math.round(median(all))} px | ${pct(all.filter((e) => e <= 40).length, all.length)}% | ${pct(all.filter((e) => e <= 100).length, all.length)}% | ${hidden} |`,
  '',
  '## Did the model answer in the units it was asked for?',
  '',
  '"Best reading" = the error if each answer is read in whichever unit (0–1000 grid or pixels) fits it better.',
  '',
  '| Game | Asked for | Answers in the other unit | Median error, best reading | Within 40 px, best reading |',
  '|---|---|---|---|---|',
  ...Object.entries(perGame).map(([game, g]) => {
    const best = g.best ?? [];
    return `| ${game} | ${g.asked ?? '?'} | ${pct(g.wrongUnits ?? 0, best.length)}% | ${Math.round(median(best))} px | ${pct(best.filter((e) => e <= 40).length, best.length)}% |`;
  }),
];
await writeFile(join('bench', 'results', `perception-${label}.md`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
