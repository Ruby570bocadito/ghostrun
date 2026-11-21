// People vs ghosts. For every test-game variant a person played (games opened with ?human=1), compare
// where the person died or got stuck with the findings the ghosts produced on the same variant.
// node bench/humans.mjs [ghostLabel=baseline-v2] [--include-test]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, cluster2d, intersects } from '../src/analyze.mjs';

const args = process.argv.slice(2);
const ghostLabel = args.find((a) => !a.startsWith('--')) ?? 'baseline-v2';
const includeTest = args.includes('--include-test');

const humanDir = join('runs', 'humans');
const sessions = [];
for (const f of (await readdir(humanDir).catch(() => [])).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(await readFile(join(humanDir, f), 'utf8'));
  if (!includeTest && s.player === 'test') continue;
  if (s.durationMs < 3000) continue; // opened and closed straight away
  sessions.push(s);
}
const { results } = JSON.parse(await readFile(join('bench', 'results', `${ghostLabel}.json`), 'utf8'));

async function ghostFindings(game, variant) {
  const runs = results.filter((r) => r.game === game && r.variant === variant && r.dir);
  const out = [];
  for (const r of runs) {
    const file = join(r.dir, 'report.json');
    if (!existsSync(file)) continue;
    const rep = JSON.parse(await readFile(file, 'utf8'));
    out.push(...(rep.findings ?? rep.hotspots).filter((f) => f.severity !== 'low').map((f) => ({ ...f, run: r.rep })));
  }
  return { runs: runs.length, findings: out };
}

/** Spots where the person had trouble: deaths (clustered) and, if they did not finish, where they spent their last 40%. */
function humanTroubleSpots(s) {
  const deaths = s.events.filter((e) => e.type === 'death' && Number.isFinite(e.x)).map((e) => ({ x: e.x, y: Math.min(s.world?.h ?? 360, e.y) }));
  const spots = cluster2d(deaths, 70).map((g) => ({
    kind: 'deaths',
    count: g.length,
    center: { x: Math.round(g.reduce((a, p) => a + p.x, 0) / g.length), y: Math.round(g.reduce((a, p) => a + p.y, 0) / g.length) },
    region: {
      x0: Math.min(...g.map((p) => p.x)) - 40,
      x1: Math.max(...g.map((p) => p.x)) + 40,
      y0: Math.min(...g.map((p) => p.y)) - 60,
      y1: Math.max(...g.map((p) => p.y)) + 20,
    },
  }));
  if (s.outcome !== 'won' && s.samples.length > 10) {
    const tail = s.samples.slice(-Math.floor(s.samples.length * 0.4)).map(([, x, y]) => ({ x, y }));
    const main = cluster2d(tail, 90).sort((a, b) => b.length - a.length)[0];
    if (main && main.length >= tail.length * 0.5) {
      spots.push({
        kind: 'ended here',
        count: main.length,
        center: { x: Math.round(main.reduce((a, p) => a + p.x, 0) / main.length), y: Math.round(main.reduce((a, p) => a + p.y, 0) / main.length) },
        region: { x0: Math.min(...main.map((p) => p.x)) - 20, x1: Math.max(...main.map((p) => p.x)) + 20, y0: Math.min(...main.map((p) => p.y)) - 20, y1: Math.max(...main.map((p) => p.y)) + 20 },
      });
    }
  }
  return spots;
}

const rows = [];
for (const s of sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
  const g = await ghostFindings(s.game, s.variant);
  const spots = humanTroubleSpots(s);
  const matched = spots.map((sp) => ({ ...sp, ghostMatch: g.findings.filter((f) => intersects(f.region, sp.region)).map((f) => f.type) }));
  const milestonesReached = [...new Set(s.events.filter((e) => e.type === 'milestone').map((e) => e.name))];
  rows.push({
    player: s.player,
    game: s.game,
    variant: s.variant,
    outcome: s.outcome,
    seconds: Math.round(s.durationMs / 1000),
    deaths: s.events.filter((e) => e.type === 'death').length,
    milestonesReached,
    troubleSpots: matched,
    ghostRuns: g.runs,
    ghostFindings: g.findings.map((f) => `${f.type}${f.severity === 'high' ? '!' : ''}@(${f.center.x},${f.center.y})`),
  });
}

const spotsTotal = rows.reduce((a, r) => a + r.troubleSpots.length, 0);
const spotsMatched = rows.reduce((a, r) => a + r.troubleSpots.filter((t) => t.ghostMatch.length).length, 0);
const lines = [
  `# People vs ghosts`,
  '',
  `Human sessions recorded with \`?human=1\` (players: ${[...new Set(rows.map((r) => r.player))].join(', ') || 'none yet'}). Ghost findings from the \`${ghostLabel}\` benchmark runs of the same variant.`,
  '',
  `**Spots where a person died or ended up stuck that the ghosts also flagged: ${spotsMatched}/${spotsTotal}.**`,
  '',
  '| Player | Game | Variant | Person: outcome | Time | Deaths | Where the person had trouble | Flagged by the ghosts? | Ghost findings on this variant |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.player} | ${r.game} | ${r.variant} | ${r.outcome} | ${r.seconds}s | ${r.deaths} | ${
        r.troubleSpots.map((t) => `${t.kind} ×${t.count} at (${t.center.x},${t.center.y})`).join('; ') || '— (no trouble spot)'
      } | ${r.troubleSpots.map((t) => (t.ghostMatch.length ? `yes (${[...new Set(t.ghostMatch)].join(', ')})` : 'no')).join('; ') || '—'} | ${r.ghostFindings.join(', ') || '—'} |`,
  ),
  '',
  'A person\'s trouble spot is a cluster of their deaths, or the area where they spent the last 40% of a session they did not finish. "Flagged" = a ghost finding (medium or high severity) overlaps it.',
];
await writeFile(join('bench', 'results', 'people-vs-ghosts.md'), lines.join('\n') + '\n');
await writeFile(join('bench', 'results', 'people-vs-ghosts.json'), JSON.stringify(rows, null, 2));
console.log(lines.join('\n'));
