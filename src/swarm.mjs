// Runs several ghosts in parallel on the same game, each in its own browser context.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { runGhost } from './ghost.mjs';
import { PERSONAS } from './personas.mjs';
import { createMetaBrain } from './brains/meta.mjs';
import { createScriptedBrain } from './brains/scripted.mjs';
import { withFallback } from './brains/fallback.mjs';

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
  signal,
}) {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const started = Date.now();
  const config = { url, personas, steps, brain, model, fallbackModel, reasoning, bulletTime };
  await writeFile(join(outDir, 'config.json'), JSON.stringify(config, null, 2));
  onEvent({ type: 'run_started', config });

  try {
    const traces = await Promise.all(
      personas.map(async (id) => {
        const persona = PERSONAS[id];
        const make = (m) => createMetaBrain({ model: m, reasoning, persona, controlsHint });
        const ghostBrain =
          brain === 'scripted'
            ? createScriptedBrain()
            : withFallback(make(model), () => make(fallbackModel), {
                onSwitch: (info) => onEvent({ type: 'model_fallback', ghost: id, ...info }),
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
