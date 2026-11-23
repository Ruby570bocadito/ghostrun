// Turns the ghosts' traces into findings. This part uses NO AI. Findings come from:
//  - deaths the game reported            → blocker (nobody got past) or friction (they did, eventually)
//  - milestones nobody (or few) reached  → missed  (e.g. nobody found the key)
//  - where non-finishers ended up        → stuck   (circling the same area until they ran out of moves)
//  - the ghosts' own "confused" flags    → confusion
//  - objectives drawn with too little contrast (measured on the screen, contrast.mjs) → hard_to_see
// The AI only explains findings afterwards (explain.mjs) and can only talk about the ones found here.
import { traceCost } from './brains/prices.mjs';
import { CONTRAST_INVISIBLE, CONTRAST_MIN } from './contrast.mjs';
import { keyEffects, keyRowsNear, keysTappedNear } from './keys.mjs';

const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
const TYPE_RANK = { blocker: 0, missed: 1, hard_to_see: 1.5, stuck: 2, confusion: 3, friction: 4 };

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

const clipAround = (frames, pageT, beforeMs = 1600, afterMs = 300) => [
  frameAt(frames, pageT - beforeMs),
  Math.min(frames.length - 1, frameAt(frames, pageT + afterMs)),
];

/** Single-linkage clustering in 2D. */
export function cluster2d(points, radius) {
  const parent = points.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) if (dist(points[i], points[j]) <= radius) parent[find(i)] = find(j);
  const groups = new Map();
  points.forEach((p, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(p);
  });
  return [...groups.values()];
}

function bbox(points, pad, W, H) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x0: Math.max(0, Math.round(Math.min(...xs) - pad)),
    y0: Math.max(0, Math.round(Math.min(...ys) - pad)),
    x1: Math.min(W, Math.round(Math.max(...xs) + pad)),
    y1: Math.min(H, Math.round(Math.max(...ys) + pad)),
  };
}

export const intersects = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The finding whose area overlaps `region` the most (stuck or confused ghosts belong to the closest spot, not the first one listed). */
export function bestOverlap(findings, region) {
  return findings.filter((f) => intersects(f.region, region)).sort((a, b) => overlapArea(b.region, region) - overlapArea(a.region, region))[0];
}

const areaOf = (r) => Math.max(1, (r.x1 - r.x0) * (r.y1 - r.y0));

/**
 * Death clusters whose areas (the deaths plus the moves that led to them) overlap substantially are one place
 * in the level. A wide gap collects deaths at both of its edges, and single linkage alone split it in two
 * findings that contradicted each other (found by test agents: "2/4 got past" next to "0/4 got past" for the
 * same gap). "Substantially" = at least `minShare` of the smaller area: the two halves of one wide gap
 * overlapped 54% and 89% in our runs, while two neighbouring gaps only touch at the platform between them
 * (1-10% in all our runs; merging on any contact made one finding span two gaps).
 */
export function mergeOverlapping(groups, regionOf, minShare = 0.25) {
  let merged = groups.map((deaths) => ({ deaths, region: regionOf(deaths) }));
  const sameSpot = (a, b) => overlapArea(a, b) >= minShare * Math.min(areaOf(a), areaOf(b));
  for (let changed = true; changed; ) {
    changed = false;
    search: for (let i = 0; i < merged.length; i++)
      for (let j = i + 1; j < merged.length; j++)
        if (sameSpot(merged[i].region, merged[j].region)) {
          const deaths = [...merged[i].deaths, ...merged[j].deaths];
          merged = merged.filter((_, k) => k !== i && k !== j);
          merged.push({ deaths, region: regionOf(deaths) });
          changed = true;
          break search;
        }
  }
  return merged.map((m) => m.deaths);
}

function frictionSeverity(share, count) {
  if (count <= 1) return 'low'; // one death is a weak signal, not a finding
  if (share >= 0.5 || count >= 6) return 'high';
  if (share >= 0.25 || count >= 3) return 'medium';
  return 'low';
}

function stepAt(trace, frameIndex) {
  return trace.steps.find((s) => s.frames && frameIndex >= s.frames[0] && frameIndex <= s.frames[1]) ?? null;
}

/**
 * Games without the SDK report no positions. Use where each ghost said its character was (98% within
 * 40 px in our perception check) for every frame of that move. Screen coordinates, so for scrolling
 * games the map is approximate. Returns new trace objects; the originals are not changed.
 */
export function withEstimatedPositions(traces) {
  return traces.map((t) => {
    if (t.frames.some((f) => f.state)) return t;
    const vp = t.viewport ?? { width: 640, height: 360 };
    const pixels = t.coords === 'pixels';
    const frames = t.frames.map((f) => ({ ...f }));
    for (const s of t.steps) {
      if (!s.player || !s.frames || s.saw === 'menu' || s.saw === 'died') continue;
      const x = pixels ? s.player.x : (s.player.x / 1000) * vp.width;
      const y = pixels ? s.player.y : (s.player.y / 1000) * vp.height;
      for (let i = s.frames[0]; i <= s.frames[1] && i < frames.length; i++) {
        frames[i].state = { x, y, screenX: x, screenY: y, worldW: vp.width, worldH: vp.height, estimated: true };
      }
    }
    return { ...t, frames };
  });
}

/** objectives: contrast measurements from contrast.mjs (optional). */
export function analyze(rawTraces, { deathRadius = 70, stuckRadius = 90, objectives = [] } = {}) {
  const positionSource = rawTraces.some((t) => t.frames.some((f) => f.state)) ? 'game' : 'ghosts';
  const traces = withEstimatedPositions(rawTraces);
  const ghostsTotal = traces.length;
  const states = traces.flatMap((t) => t.frames.map((f) => f.state).filter(Boolean));
  const worldW = Math.max(1, ...states.map((s) => s.worldW ?? 0));
  const worldH = Math.max(1, ...states.map((s) => s.worldH ?? 0));
  const hasPositions = states.some((s) => Number.isFinite(s.x));
  const declaredMilestones = states.find((s) => Array.isArray(s.milestones))?.milestones ?? [];
  const posOf = (f) => ({ x: f.state.x, y: Math.min(worldH, f.state.y) });

  const ghosts = traces.map((t) => {
    const xs = t.frames.map((f) => f.state?.x).filter(Number.isFinite);
    const milestones = [...new Set(t.events.filter((e) => e.type === 'milestone').map((e) => e.name))];
    return {
      persona: t.persona,
      outcome: t.outcome,
      error: t.error ?? null,
      model: t.steps.at(-1)?.model ?? t.model,
      steps: t.steps.length,
      deaths: t.events.filter((e) => e.type === 'death').length,
      milestones,
      maxX: xs.length ? Math.max(...xs) : null,
      progress:
        t.outcome === 'won'
          ? 1
          : declaredMilestones.length
            ? milestones.length / (declaredMilestones.length + 1)
            : xs.length
              ? Math.min(1, Math.max(...xs) / worldW)
              : null,
      gameMs: t.gameMs,
      tokensIn: t.steps.reduce((a, s) => a + (s.usage?.input ?? 0), 0),
      tokensCached: t.steps.reduce((a, s) => a + (s.usage?.cached ?? 0), 0),
      tokensOut: t.steps.reduce((a, s) => a + (s.usage?.output ?? 0), 0),
      tokensReasoning: t.steps.reduce((a, s) => a + (s.usage?.reasoning ?? 0), 0),
      // Priced per move (a ghost can switch to the backup model mid-run), plus the exit interview.
      costUsd: traceCost(t),
      listCostUsd: traceCost(t, { listPrice: true }),
      stopReason: t.stopReason ?? null,
      avgLatencyMs: Math.round(mean(t.steps.map((s) => s.latencyMs))),
      confusedSteps: t.steps.filter((s) => s.confused).length,
      // What the ghost said in its exit interview after its last move (src/ghost.mjs), if it gave one.
      debrief: t.debrief
        ? { goal: t.debrief.goal, understood_goal: t.debrief.understood_goal, understood_controls: t.debrief.understood_controls, stopped_me: t.debrief.stopped_me, keep_playing: t.debrief.keep_playing }
        : null,
    };
  });
  const active = ghosts.filter((g) => g.outcome !== 'error');
  const findings = [];

  // 1) Deaths → blocker / friction
  const deaths = [];
  for (const t of traces) {
    for (const e of t.events.filter((ev) => ev.type === 'death' && Number.isFinite(ev.x))) {
      const step = t.steps.find((s) => s.step === e.step);
      const approach = t.frames.filter((f) => f.state && f.pageT >= e.t - 600 && f.pageT <= e.t).map(posOf);
      deaths.push({
        persona: t.persona,
        t: e.t,
        x: e.x,
        y: Math.min(worldH, e.y),
        approach,
        step: e.step,
        clip: clipAround(t.frames, e.t),
        thought: step?.thought ?? '',
      });
    }
  }
  const sideScroller = worldW > 700;
  const deathRegion = (g) => bbox([...g, ...g.flatMap((d) => d.approach)], 24, worldW, worldH);
  // Only in side-scrolling levels, where "getting past" is measured along x: there, overlapping clusters are one obstacle.
  // In a single-screen maze two clusters 100 px apart can be different corridors (merging them made a false blocker).
  const clusters = cluster2d(deaths, deathRadius);
  for (const g of sideScroller ? mergeOverlapping(clusters, deathRegion) : clusters) {
    const personas = [...new Set(g.map((d) => d.persona))];
    const region = deathRegion(g);
    const inside = (p) => p.x >= region.x0 - 20 && p.x <= region.x1 + 20 && p.y >= region.y0 - 20 && p.y <= region.y1 + 20;
    const reachedTraces = traces.filter((t) => t.outcome !== 'error' && t.frames.some((f) => f.state && Number.isFinite(f.state.x) && inside(posOf(f))));
    const reached = reachedTraces.map((t) => t.persona);
    // "Got past" = after its last death here (or after first reaching the spot), the ghost made progress:
    // reached an objective or finished, or (side-scrollers) was seen beyond the far edge of the spot.
    const passed = reachedTraces
      .filter((t) => {
        const lastDeath = Math.max(-Infinity, ...g.filter((d) => d.persona === t.persona).map((d) => d.t));
        const from = Number.isFinite(lastDeath) ? lastDeath : (t.frames.find((f) => f.state && Number.isFinite(f.state.x) && inside(posOf(f)))?.pageT ?? 0);
        const progressed = t.events.some((e) => (e.type === 'milestone' || e.type === 'win') && e.t > from);
        const beyond = sideScroller && t.frames.some((f) => f.pageT > from && f.state && f.state.x > region.x1 + 40);
        return t.outcome === 'won' || progressed || beyond;
      })
      .map((t) => t.persona);
    // Blocker = repeated failure with no success: at least two ghosts died here three or more times,
    // and none of the ghosts that reached the spot ever got past it. Anything less is friction.
    const repeated = personas.filter((p) => g.filter((d) => d.persona === p).length >= 3).length;
    const type = reached.length >= 2 && passed.length === 0 && repeated >= 2 ? 'blocker' : 'friction';
    findings.push({
      type,
      severity: type === 'blocker' ? 'high' : frictionSeverity(personas.length / ghostsTotal, g.length),
      center: { x: Math.round(mean(g.map((d) => d.x))), y: Math.round(mean(g.map((d) => d.y))) },
      region,
      count: g.length,
      ghosts: personas,
      share: personas.length / ghostsTotal,
      reached,
      passed,
      evidence: personas.map((p) => {
        const d = g.find((x) => x.persona === p);
        return { persona: p, step: d.step, clip: d.clip, thought: d.thought };
      }),
      quotes: [...new Set(g.map((d) => d.thought).filter(Boolean))].slice(0, 6),
    });
  }

  // 2) Milestones few or no ghosts reached → missed (only the first one: later ones are consequences)
  for (const m of declaredMilestones) {
    const reachedBy = ghosts.filter((g) => g.milestones.includes(m.name)).map((g) => g.persona);
    if (!active.length || reachedBy.length >= Math.ceil(active.length / 2)) continue;
    const missedBy = active.filter((g) => !reachedBy.includes(g.persona));
    const evidence = missedBy.map((g) => {
      const t = traces.find((tr) => tr.persona === g.persona);
      // Their closest approach to the objective.
      let best = null;
      t.frames.forEach((f, i) => {
        if (!f.state || !Number.isFinite(f.state.x)) return;
        const d = dist(posOf(f), m);
        if (!best || d < best.d) best = { d, i, pageT: f.pageT };
      });
      const s = best ? stepAt(t, best.i) : null;
      return {
        persona: g.persona,
        step: s?.step ?? null,
        clip: best ? clipAround(t.frames, best.pageT, 1500, 1500) : [0, 0],
        thought: s?.thought ?? '',
        closest: best ? Math.round(best.d) : null,
      };
    });
    findings.push({
      type: 'missed',
      severity: reachedBy.length === 0 ? 'high' : 'medium',
      milestone: m.name,
      center: { x: m.x, y: m.y },
      region: { x0: Math.max(0, m.x - 70), y0: Math.max(0, m.y - 70), x1: Math.min(worldW, m.x + 70), y1: Math.min(worldH, m.y + 70) },
      count: missedBy.length,
      ghosts: missedBy.map((g) => g.persona),
      share: missedBy.length / ghostsTotal,
      reachedBy,
      evidence,
      quotes: [...new Set(evidence.map((e) => e.thought).filter(Boolean))].slice(0, 6),
    });
    break;
  }

  // 2b) Objectives too faint for people to see → hard_to_see. AI ghosts can spot shapes people miss,
  // so this does not depend on whether the ghosts reached the objective.
  for (const o of objectives.filter((x) => x.ratio < CONTRAST_MIN)) {
    const missed = findings.find((f) => f.type === 'missed' && f.milestone === o.name);
    if (missed) {
      missed.contrast = o.ratio; // the same objective: one finding, with the measured cause attached
      if (o.ratio < CONTRAST_INVISIBLE) missed.severity = 'high'; // practically invisible: critical even if one ghost found it
      continue;
    }
    const reachedBy = ghosts.filter((g) => g.milestones.includes(o.name)).map((g) => g.persona);
    const notReached = active.filter((g) => !reachedBy.includes(g.persona)).map((g) => g.persona);
    const t = traces.find((tr) => tr.persona === o.persona) ?? traces[0];
    const s = t ? stepAt(t, o.frame) : null;
    const near = traces.flatMap((tr) =>
      tr.steps.filter((st) => st.before && Number.isFinite(st.before.x) && dist(st.before, o) < 120 && st.thought).map((st) => st.thought),
    );
    findings.push({
      type: 'hard_to_see',
      severity: o.ratio < CONTRAST_INVISIBLE ? 'high' : 'medium',
      milestone: o.name,
      contrast: o.ratio,
      center: { x: Math.round(o.x), y: Math.round(o.y) },
      region: { x0: Math.max(0, Math.round(o.x - 40)), y0: Math.max(0, Math.round(o.y - 40)), x1: Math.min(worldW, Math.round(o.x + 40)), y1: Math.min(worldH, Math.round(o.y + 40)) },
      count: notReached.length,
      ghosts: notReached,
      share: notReached.length / ghostsTotal,
      reachedBy,
      evidence: t ? [{ persona: t.persona, step: s?.step ?? null, clip: [o.frame, Math.min(t.frames.length - 1, o.frame + 20)], thought: s?.thought ?? '' }] : [],
      quotes: [...new Set(near)].slice(0, 6),
    });
  }

  // 3) Where ghosts that did not finish ended up circling → stuck
  const zones = [];
  for (const t of traces) {
    if (!['out_of_steps', 'time_up', 'quit', 'stopped', 'saturated'].includes(t.outcome)) continue;
    const withPos = t.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.state && Number.isFinite(f.state.x));
    const tail = withPos.slice(-Math.max(20, Math.floor(withPos.length * 0.4)));
    if (tail.length < 10) continue;
    const pts = tail.map(({ f, i }) => ({ ...posOf(f), i }));
    const main = cluster2d(pts, stuckRadius).sort((a, b) => b.length - a.length)[0];
    if (main.length < tail.length * 0.5) continue; // still moving around a lot: not stuck
    const last = main.at(-1).i;
    const s = stepAt(t, last);
    zones.push({
      persona: t.persona,
      x: mean(main.map((p) => p.x)),
      y: mean(main.map((p) => p.y)),
      points: main,
      clip: [Math.max(0, last - 30), last],
      thought: s?.thought ?? t.steps.at(-1)?.thought ?? '',
      step: s?.step ?? null,
    });
  }
  for (const g of cluster2d(zones, 140)) {
    const region = bbox(g.flatMap((z) => z.points), 20, worldW, worldH);
    const overlapping = bestOverlap(findings, region);
    if (overlapping) {
      overlapping.stuckGhosts = [...new Set([...(overlapping.stuckGhosts ?? []), ...g.map((z) => z.persona)])];
      continue;
    }
    const personas = [...new Set(g.map((z) => z.persona))];
    if (personas.length < 2) continue; // one ghost struggling alone is noise, not a finding
    findings.push({
      type: 'stuck',
      severity: personas.length / ghostsTotal >= 0.5 ? 'high' : 'medium',
      center: { x: Math.round(mean(g.map((z) => z.x))), y: Math.round(mean(g.map((z) => z.y))) },
      region,
      count: personas.length,
      ghosts: personas,
      share: personas.length / ghostsTotal,
      evidence: g.map((z) => ({ persona: z.persona, step: z.step, clip: z.clip, thought: z.thought })),
      quotes: [...new Set(g.map((z) => z.thought).filter(Boolean))].slice(0, 6),
    });
  }

  // 4) Several ghosts confused in the same area → confusion
  const confusedPoints = traces.flatMap((t) =>
    t.steps
      .filter((s) => s.confused && Number.isFinite(s.after?.x ?? s.before?.x))
      .map((s) => ({ persona: t.persona, x: s.after?.x ?? s.before.x, y: Math.min(worldH, s.after?.y ?? s.before?.y ?? 0), step: s.step, thought: s.thought, clip: s.frames })),
  );
  for (const g of cluster2d(confusedPoints, stuckRadius * 1.5)) {
    const personas = [...new Set(g.map((p) => p.persona))];
    if (personas.length < 2 && g.length < 3) continue;
    const region = bbox(g, 40, worldW, worldH);
    const overlapping = bestOverlap(findings, region);
    if (overlapping) {
      overlapping.confusedGhosts = [...new Set([...(overlapping.confusedGhosts ?? []), ...personas])];
      overlapping.quotes = [...new Set([...overlapping.quotes, ...g.map((p) => p.thought)])].slice(0, 8);
      continue;
    }
    findings.push({
      type: 'confusion',
      severity: personas.length / ghostsTotal >= 0.5 ? 'high' : 'medium',
      center: { x: Math.round(mean(g.map((p) => p.x))), y: Math.round(mean(g.map((p) => p.y))) },
      region,
      count: g.length,
      ghosts: personas,
      share: personas.length / ghostsTotal,
      evidence: personas.map((p) => {
        const c = g.find((x) => x.persona === p);
        return { persona: p, step: c.step, clip: c.clip, thought: c.thought };
      }),
      quotes: [...new Set(g.map((p) => p.thought))].slice(0, 6),
    });
  }

  findings.sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type] || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.share - a.share || b.count - a.count);
  findings.forEach((f, i) => (f.id = `F${i + 1}`));
  // Keys tapped near each spot that never did anything, measured from the game (SDK games only).
  const effects = keyEffects(rawTraces);
  for (const f of findings) {
    const rows = f.center ? keyRowsNear(effects, keysTappedNear(rawTraces, f.ghosts, f.center)) : null;
    if (rows) f.keys = rows;
  }

  // The exit interviews in numbers: who never worked out the goal or the controls, and who would stop playing.
  const asked = ghosts.filter((g) => g.debrief);
  const debrief = asked.length
    ? {
        asked: asked.length,
        goalUnclear: asked.filter((g) => !g.debrief.understood_goal).map((g) => g.persona),
        controlsUnclear: asked.filter((g) => !g.debrief.understood_controls).map((g) => g.persona),
        wouldStop: asked.filter((g) => !g.debrief.keep_playing).map((g) => g.persona),
      }
    : null;

  const quits = traces
    .filter((t) => t.outcome === 'quit')
    .map((t) => {
      const s = t.steps.at(-1);
      return { persona: t.persona, step: s.step, x: s.after?.x ?? null, thought: s.thought, clip: s.frames };
    });

  const milestones = declaredMilestones.map((m) => ({ ...m, reachedBy: ghosts.filter((g) => g.milestones.includes(m.name)).map((g) => g.persona) }));

  return {
    worldW,
    worldH,
    hasPositions,
    positionSource, // 'game' (SDK) or 'ghosts' (estimated from what each ghost said it saw)
    ghostsTotal,
    ghosts,
    findings,
    hotspots: findings, // backwards-compatible name used by older reports
    milestones,
    debrief,
    objectives: objectives.map((o) => ({ ...o, ok: o.ratio >= CONTRAST_MIN })), // contrast of each objective players must see
    deaths: deaths.map(({ persona, x, y, step }) => ({ persona, x, y, step })),
    // Failures handled during the run (e.g. a model outage and the switch to the backup model).
    notices: rawTraces.flatMap((t) => (t.notices ?? []).map((n) => ({ persona: t.persona, ...n }))),
    quits,
    heat: traces.flatMap((t) => t.frames.filter((f) => f.state && Number.isFinite(f.state.x)).map((f) => ({ ...posOf(f), persona: t.persona }))),
  };
}
