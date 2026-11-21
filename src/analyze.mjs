// Turns the ghosts' traces into findings. This part uses NO AI: hotspots come from events
// the game reported (deaths, quits) and from the ghosts' own "confused" flags. The AI only
// explains hotspots afterwards (explain.mjs), and can only talk about the ones found here.

const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

function frameAt(frames, pageT) {
  // Last frame recorded at or before pageT (frames are in time order).
  let lo = 0;
  let hi = frames.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].pageT <= pageT) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

function clipAround(frames, pageT, beforeMs = 1600, afterMs = 300) {
  const from = frameAt(frames, pageT - beforeMs);
  const to = Math.min(frames.length - 1, frameAt(frames, pageT + afterMs));
  return [from, to];
}

function cluster(points, gap) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const groups = [];
  for (const p of sorted) {
    const g = groups.at(-1);
    if (g && p.x - g.at(-1).x <= gap) g.push(p);
    else groups.push([p]);
  }
  return groups;
}

function severity(share, count) {
  if (share >= 0.5 || count >= 6) return 'high';
  if (share >= 0.25 || count >= 3) return 'medium';
  return 'low';
}

export function analyze(traces, { gapPx = 70 } = {}) {
  const ghostsTotal = traces.length;
  const states = traces.flatMap((t) => t.frames.map((f) => f.state).filter(Boolean));
  const worldW = Math.max(1, ...states.map((s) => s.worldW ?? 0));
  const worldH = Math.max(1, ...states.map((s) => s.worldH ?? 0));
  const hasPositions = states.some((s) => Number.isFinite(s.x));

  const ghosts = traces.map((t) => {
    const xs = t.frames.map((f) => f.state?.x).filter(Number.isFinite);
    const tokensIn = t.steps.reduce((a, s) => a + (s.usage?.input ?? 0), 0);
    const tokensOut = t.steps.reduce((a, s) => a + (s.usage?.output ?? 0), 0);
    return {
      persona: t.persona,
      outcome: t.outcome,
      error: t.error ?? null,
      model: t.steps.at(-1)?.model ?? t.model,
      steps: t.steps.length,
      deaths: t.events.filter((e) => e.type === 'death').length,
      maxX: xs.length ? Math.max(...xs) : null,
      progress: xs.length ? Math.min(1, Math.max(...xs) / worldW) : null,
      gameMs: t.gameMs,
      tokensIn,
      tokensOut,
      avgLatencyMs: Math.round(mean(t.steps.map((s) => s.latencyMs))),
      confusedSteps: t.steps.filter((s) => s.confused).length,
    };
  });

  // Deaths → hotspots
  const deaths = [];
  for (const t of traces) {
    for (const e of t.events.filter((ev) => ev.type === 'death')) {
      const step = t.steps.find((s) => s.step === e.step);
      deaths.push({
        persona: t.persona,
        x: e.x,
        y: e.y,
        step: e.step,
        frame: frameAt(t.frames, e.t),
        clip: clipAround(t.frames, e.t),
        thought: step?.thought ?? '',
      });
    }
  }
  const hotspots = cluster(deaths.filter((d) => Number.isFinite(d.x)), gapPx).map((g, i) => {
    const personas = [...new Set(g.map((d) => d.persona))];
    // One clip per ghost, the first time it died here.
    const evidence = personas.map((p) => g.find((d) => d.persona === p));
    const quotes = [...new Set(g.map((d) => d.thought).filter(Boolean))].slice(0, 6);
    const x0 = Math.round(g[0].x);
    const x1 = Math.round(g.at(-1).x);
    // Blocker = every ghost that reached this spot stayed stuck before it; friction = they died but got through.
    const reached = ghosts.filter((gh) => gh.maxX != null && gh.maxX >= x0 - 40).map((gh) => gh.persona);
    const passed = ghosts.filter((gh) => gh.maxX != null && gh.maxX > x1 + 60).map((gh) => gh.persona);
    const type = reached.length > 0 && passed.length === 0 ? 'blocker' : 'friction';
    return {
      id: `H${i + 1}`,
      kind: 'deaths',
      type,
      x: Math.round(mean(g.map((d) => d.x))),
      x0,
      x1,
      count: g.length,
      ghosts: personas,
      share: personas.length / ghostsTotal,
      reached,
      passed,
      severity: type === 'blocker' ? 'high' : severity(personas.length / ghostsTotal, g.length),
      evidence,
      quotes,
    };
  });

  // Ghosts that gave up
  const quits = traces
    .filter((t) => t.outcome === 'quit')
    .map((t) => {
      const s = t.steps.at(-1);
      return { persona: t.persona, step: s.step, x: s.after?.x ?? null, thought: s.thought, clip: s.frames };
    });

  // Moments where ghosts said they were confused
  const confusedPoints = traces.flatMap((t) =>
    t.steps.filter((s) => s.confused).map((s) => ({ persona: t.persona, x: s.after?.x ?? s.before?.x, step: s.step, thought: s.thought, clip: s.frames })),
  );
  const confusion = cluster(confusedPoints.filter((p) => Number.isFinite(p.x)), gapPx * 2).map((g, i) => ({
    id: `C${i + 1}`,
    kind: 'confusion',
    x: Math.round(mean(g.map((p) => p.x))),
    count: g.length,
    ghosts: [...new Set(g.map((p) => p.persona))],
    quotes: [...new Set(g.map((p) => p.thought))].slice(0, 4),
    evidence: g.slice(0, 3),
  }));

  // Heat: where ghosts spent their time (one sample per recorded frame)
  const heat = traces.flatMap((t) =>
    t.frames.filter((f) => Number.isFinite(f.state?.x)).map((f) => ({ x: Math.round(f.state.x), y: Math.round(f.state.y), persona: t.persona })),
  );

  return {
    worldW,
    worldH,
    hasPositions,
    ghostsTotal,
    ghosts,
    hotspots: hotspots
      .sort((a, b) => (b.type === 'blocker') - (a.type === 'blocker') || b.share - a.share || b.count - a.count)
      .map((h, i) => ({ ...h, rank: i + 1 })),
    deaths: deaths.map(({ persona, x, y, step }) => ({ persona, x, y, step })),
    quits,
    confusion,
    heat,
  };
}
