// The report as problems to fix, not as raw findings. Presentation only: the analysis and its findings are unchanged.
// - Critical findings in the same place are one problem (Read Me's "Z does nothing" was a blocker and a missed
//   objective at the same pit, shown twice).
// - When an objective was reached by nobody, getting stuck later is its consequence, not a second problem
//   (Lever Room: nobody pulled the lever, so everybody waited at the closed door).
// - Friction (ghosts died at a spot but most got past) is a fair challenge, listed apart.
// - When half or more of the ghosts said afterwards they never worked out the goal, that is a problem of its own,
//   even if nothing on screen marked it (SPACETAXI said "no critical issues" while 4 of 4 never got the goal).

export const CRITICAL = ['blocker', 'missed', 'stuck', 'hard_to_see'];
const ORDER = { blocker: 0, missed: 1, hard_to_see: 2, stuck: 3 };
const intersects = (a, b) => a && b && a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const isCritical = (f) => CRITICAL.includes(f.type) && f.severity === 'high';

export function buildIssues(report) {
  const shown = (report.findings ?? report.hotspots ?? []).filter((f) => f.severity !== 'low');
  const critical = shown.filter(isCritical).sort((a, b) => ORDER[a.type] - ORDER[b.type]);

  // 1. Critical findings that overlap are one problem, led by the most telling type.
  const issues = [];
  for (const f of critical) {
    const home = issues.find((i) => [i.primary, ...i.related].some((g) => intersects(g.region, f.region)));
    if (home) home.related.push(f);
    else issues.push({ kind: 'finding', primary: f, related: [], consequences: [] });
  }

  // 2. Stuck after an objective nobody reached: a consequence of that objective.
  const unreached = new Set((report.milestones ?? []).filter((m) => !m.reachedBy?.length).map((m) => m.name));
  const cause = issues.find((i) => [i.primary, ...i.related].some((f) => f.type === 'missed' && unreached.has(f.milestone)));
  if (cause) {
    for (const i of [...issues]) {
      if (i !== cause && i.primary.type === 'stuck' && !i.related.length) {
        cause.consequences.push(i.primary);
        issues.splice(issues.indexOf(i), 1);
      }
    }
  }

  // 3. The exit interview: the goal nobody worked out.
  const exit = report.debrief;
  if (exit?.asked && exit.goalUnclear.length * 2 >= exit.asked) {
    issues.push({ kind: 'goal', unclear: exit.goalUnclear, asked: exit.asked, wouldStop: exit.wouldStop ?? [] });
  }

  return {
    issues,
    fair: shown.filter((f) => f.type === 'friction'),
    other: shown.filter((f) => !isCritical(f) && f.type !== 'friction'),
  };
}
