// Runs several ghosts in parallel on the same game, each in its own browser context.
import { launchBrowser, launchedWith } from './browser.mjs';
import { findGame } from './embed.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { protectContext, runGhost } from './ghost.mjs';
import { fitSize, measureCanvas } from './fit.mjs';
import { PERSONAS } from './personas.mjs';
import { createMetaBrain } from './brains/meta.mjs';
import { createScriptedBrain } from './brains/scripted.mjs';
import { withFallback, withSimulatedOutage } from './brains/fallback.mjs';
import { measureObjectives } from './contrast.mjs';

export async function runSwarm({
  url,
  personas = ['newbie', 'speedrunner', 'reader', 'impatient'],
  steps = 40, // cap on model calls per ghost
  playSeconds = 150, // game time each ghost plays (src/ghost.mjs PLAY_SECONDS)
  brain = 'meta',
  model = process.env.GHOST_MODEL || 'muse-ember-1.0',
  fallbackModel = 'muse-spark-1.3',
  reasoning = process.env.GHOST_REASONING || 'minimal',
  controlsHint,
  outDir,
  onEvent = () => {},
  bulletTime = true,
  stopWhenSaturated = true,
  viewport = { width: 640, height: 360 },
  // Test option: make one ghost's model fail from its Nth move, to show the fallback. Labelled everywhere.
  simulateOutage = null, // e.g. { ghost: 'newbie', fromCall: 6 }
  compareTo = null,
  guard = null, // public demo: which requests the game pages may make (src/guard.mjs)
  signal,
}) {
  // Check the personas before starting a browser, so a wrong name cannot leave Chromium running.
  const seen = {};
  const roster = personas.map((p) => {
    seen[p] = (seen[p] ?? 0) + 1;
    if (!Object.hasOwn(PERSONAS, p)) throw new Error(`Unknown persona "${p}"`);
    const base = PERSONAS[p];
    return seen[p] === 1 ? base : { ...base, id: `${p}-${seen[p]}`, name: `${base.name} #${seen[p]}` };
  });
  await mkdir(outDir, { recursive: true });
  const browser = await launchBrowser(chromium);
  const started = Date.now();
  // A game whose canvas does not fit the window gets a bigger window, so the ghosts see all of it (src/fit.mjs).
  const requestedViewport = viewport;
  // The page may only frame the game (itch.io): the ghosts play the game's own address (src/embed.mjs).
  let playUrl = url;
  if (brain !== 'scripted') {
    const opts = {
      protect: guard ? (context) => protectContext(context, guard) : undefined,
      contextOptions: guard ? { serviceWorkers: 'block' } : {},
    };
    const found = await findGame(browser, url, opts);
    playUrl = found.url;
    // A framed game (itch.io) is shown by its page in an iframe: give the window that shape, at the usual width (a
    // 1280×720 frame at full size would make every screenshot 2.5× bigger for the model), with no second load.
    const framed = found.size && playUrl !== url ? found.size : null;
    const rect = framed
      ? (() => {
          const aspect = framed.height / framed.width;
          const height = Math.min(768, Math.round(viewport.width * aspect));
          return { x: 0, y: 0, width: Math.round(height / aspect), height };
        })()
      : await measureCanvas(browser, playUrl, viewport, opts);
    viewport = fitSize(viewport, rect);
  }
  const resized = viewport.width !== requestedViewport.width || viewport.height !== requestedViewport.height;
  const config = { url, ...(playUrl !== url ? { playUrl } : {}), personas, steps, playSeconds, brain, model, fallbackModel, reasoning, bulletTime, stopWhenSaturated, viewport, ...(resized ? { requestedViewport } : {}), simulateOutage, compareTo, webgl: launchedWith() };
  await writeFile(join(outDir, 'config.json'), JSON.stringify(config, null, 2));
  onEvent({ type: 'run_started', config });

  try {
    const traces = await Promise.all(
      roster.map(async (persona) => {
        const id = persona.id;
        const notices = []; // things that went wrong and how they were handled, kept in the trace
        const make = (m) => createMetaBrain({ model: m, reasoning, persona, controlsHint, viewport });
        let primary = brain === 'scripted' ? createScriptedBrain() : make(model);
        if (simulateOutage && (simulateOutage.ghost === id || simulateOutage.ghost === 'all')) {
          primary = withSimulatedOutage(primary, { fromCall: simulateOutage.fromCall ?? 6 });
        }
        const ghostBrain =
          brain === 'scripted'
            ? primary
            : withFallback(primary, () => make(fallbackModel), {
                onSwitch: (info) => {
                  notices.push({ type: 'model_fallback', ...info });
                  onEvent({ type: 'model_fallback', ghost: id, ...info });
                },
              });
        onEvent({ type: 'ghost_started', ghost: id });
        const trace = await runGhost({
          browser,
          url: playUrl,
          brain: ghostBrain,
          persona,
          maxSteps: steps,
          playSeconds,
          outDir: join(outDir, id),
          bulletTime,
          stopWhenSaturated,
          viewport,
          notices,
          guard,
          signal,
          onFrame: (f) => onEvent({ type: 'frame', ghost: id, t: f.t, file: `${id}/${f.file}`, state: f.state }),
          onStep: (s) => onEvent({ type: 'step', ghost: id, step: s }),
          onAutopilot: (a) => onEvent({ type: 'autopilot', ghost: id, autopilot: a }),
          onDebrief: (d) => onEvent({ type: 'debrief', ghost: id, debrief: { goal: d.goal, understood_goal: d.understood_goal, understood_controls: d.understood_controls, stopped_me: d.stopped_me, keep_playing: d.keep_playing } }),
        });
        onEvent({ type: 'ghost_done', ghost: id, outcome: trace.outcome, error: trace.error ?? null });
        return trace;
      }),
    );
    // Can people see the objectives? Measured on the recorded screens (no AI); optional, never fails the run.
    let objectives = [];
    try {
      objectives = await measureObjectives({ browser, traces, readFrame: (persona, file) => readFile(join(outDir, persona, file)) });
    } catch (err) {
      onEvent({ type: 'notice', message: `Contrast check skipped: ${err.message}` });
    }
    return { traces, objectives, ms: Date.now() - started };
  } finally {
    await browser.close();
  }
}
