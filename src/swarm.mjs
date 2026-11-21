// Runs several ghosts in parallel on the same game, each in its own browser context.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { runGhost } from './ghost.mjs';
import { PERSONAS } from './personas.mjs';
import { createMetaBrain } from './brains/meta.mjs';
import { createScriptedBrain } from './brains/scripted.mjs';
import { withFallback, withSimulatedOutage } from './brains/fallback.mjs';

export async function runSwarm({
  url,
  personas = ['newbie', 'speedrunner', 'reader', 'impatient'],
  steps = 40,
  brain = 'meta',
  model = process.env.GHOST_MODEL || 'muse-ember-1.0',
  fallbackModel = 'muse-spark-1.3',
  reasoning = process.env.GHOST_REASONING || 'minimal',
  controlsHint,
  outDir,
  onEvent = () => {},
  bulletTime = true,
  viewport = { width: 640, height: 360 },
  // Test option: make one ghost's model fail from its Nth move, to show the fallback. Labelled everywhere.
  simulateOutage = null, // e.g. { ghost: 'newbie', fromCall: 6 }
  compareTo = null,
  signal,
}) {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const started = Date.now();
  const config = { url, personas, steps, brain, model, fallbackModel, reasoning, bulletTime, viewport, simulateOutage, compareTo };
  await writeFile(join(outDir, 'config.json'), JSON.stringify(config, null, 2));
  onEvent({ type: 'run_started', config });

  // The same persona can be summoned more than once (clones, for the diversity experiment).
  const seen = {};
  const roster = personas.map((p) => {
    seen[p] = (seen[p] ?? 0) + 1;
    const base = PERSONAS[p];
    if (!base) throw new Error(`Unknown persona "${p}"`);
    return seen[p] === 1 ? base : { ...base, id: `${p}-${seen[p]}`, name: `${base.name} #${seen[p]}` };
  });

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
          url,
          brain: ghostBrain,
          persona,
          maxSteps: steps,
          outDir: join(outDir, id),
          bulletTime,
          viewport,
          notices,
          signal,
          onFrame: (f) => onEvent({ type: 'frame', ghost: id, t: f.t, file: `${id}/${f.file}`, state: f.state }),
          onStep: (s) => onEvent({ type: 'step', ghost: id, step: s }),
        });
        onEvent({ type: 'ghost_done', ghost: id, outcome: trace.outcome, error: trace.error ?? null });
        return trace;
      }),
    );
    return { traces, ms: Date.now() - started };
  } finally {
    await browser.close();
  }
}
