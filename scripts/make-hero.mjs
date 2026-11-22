// Builds the home page's opening animation from a real recorded run: one ghost's frames around the spot where
// every ghost got stuck, its own thoughts, where each ghost died there, the box the rules drew and the analyst's card.
// No AI calls. node scripts/make-hero.mjs <runId> [persona=newbie] [findingId=F1]
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [runId, persona = 'newbie', findingId = 'F1'] = process.argv.slice(2);
if (!runId) {
  console.error('Usage: node scripts/make-hero.mjs <runId> [persona] [findingId]');
  process.exit(1);
}
const dir = join('runs', runId);
const report = JSON.parse(await readFile(join(dir, 'report.json'), 'utf8'));
const finding = report.findings.find((f) => f.id === findingId);
const card = report.cards?.find((c) => c.hotspot === findingId);
const trace = JSON.parse(await readFile(join(dir, persona, 'trace.json'), 'utf8'));
const inBox = (e) => e.x >= finding.region.x0 && e.x <= finding.region.x1;

// The clip: from a little before this ghost's first death in the box, for three of its deaths there.
const mine = trace.events.filter((e) => e.type === 'death' && inBox(e));
const startT = Math.max(0, mine[0].t - 2600);
const endT = (mine[2] ?? mine.at(-1)).t + 1200;
const frames = trace.frames.filter((f, i) => f.t >= startT && f.t <= endT && i % 1 === 0 && f.state);
const out = join('web', 'public', 'hero');
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'f'), { recursive: true });

const stepAt = (t) => trace.steps.filter((s) => s.t0 <= t && s.thought).at(-1);
const list = [];
for (const [k, f] of frames.entries()) {
  const name = `${String(k).padStart(3, '0')}.jpg`;
  await cp(join(dir, persona, f.file), join(out, 'f', name));
  const s = stepAt(f.t);
  list.push({ src: `/hero/f/${name}`, x: f.state.screenX, y: f.state.screenY, cam: f.state.x - f.state.screenX, thought: s?.thought ?? '', deaths: f.state.deaths });
}

// Every ghost's deaths in the box, in world coordinates, to pile up as the clip plays.
const marks = [];
for (const g of report.ghosts) {
  const t = JSON.parse(await readFile(join(dir, g.persona, 'trace.json'), 'utf8'));
  for (const e of t.events.filter((e) => e.type === 'death' && inBox(e))) marks.push({ persona: g.persona, x: e.x, y: e.y });
}

// The still for the result: the moment of this ghost's last death in the clip, when the camera shows the gap.
const lastT = (mine[2] ?? mine.at(-1)).t;
const doneFrame = frames.reduce((best, f, k) => (Math.abs(f.t - (lastT - 300)) < Math.abs(frames[best].t - (lastT - 300)) ? k : best), 0);

const hero = {
  runId,
  doneFrame,
  persona,
  game: 'Gap Run, with its planted flaw (gap 3 is too wide to jump)',
  fps: 10,
  frames: list,
  marks,
  box: finding.region,
  stat: `${finding.ghosts.length}/${report.ghostsTotal} ghosts died here · ${finding.count} deaths · nobody got past`,
  card: { title: card?.title ?? 'Gap too wide to jump', fix: card?.suggested_fix ?? '' },
};
await writeFile(join(out, 'hero.json'), JSON.stringify(hero));
console.log(`hero: ${list.length} frames of ${persona}, ${marks.length} deaths in the box, card "${hero.card.title}"`);
