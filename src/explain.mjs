// The analyst: explains the hotspots found by analyze.mjs in plain words, using the evidence
// (quotes, counts and the screen right before the problem). It cannot invent new problems:
// it only receives hotspot ids and must answer one card per id.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import OpenAI from 'openai';

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short finding title for a game developer, max 9 words.' },
    what_happens: { type: 'string', description: 'What the ghosts experienced here, one sentence, grounded in the evidence.' },
    likely_cause: { type: 'string', description: 'Most likely design cause, one sentence. Say "unclear" if the evidence does not show it.' },
    suggested_fix: { type: 'string', description: 'One concrete change the developer could try, one sentence.' },
  },
  required: ['title', 'what_happens', 'likely_cause', 'suggested_fix'],
  additionalProperties: false,
};

export async function explainHotspots(report, { runDir, traces, model = 'muse-spark-1.3', reasoning = 'low', client, max = 4 } = {}) {
  const api = client ?? new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2, timeout: 60_000 });
  const byPersona = Object.fromEntries(traces.map((t) => [t.persona, t]));
  const usage = { input: 0, output: 0 };

  const cards = await Promise.all(
    report.hotspots.slice(0, max).map(async (h) => {
      const ev = h.evidence[0];
      const trace = byPersona[ev.persona];
      // The screen a moment before the problem (start of the clip).
      const frame = trace.frames[ev.clip[0] + Math.max(0, Math.floor((ev.clip[1] - ev.clip[0]) * 0.6))];
      const img = await readFile(join(runDir, ev.persona, frame.file));
      const facts = [
        `Hotspot ${h.id}: ${h.count} deaths around x=${h.x} (level width ${report.worldW}).`,
        `${h.ghosts.length} of ${report.ghostsTotal} ghosts died here: ${h.ghosts.join(', ')}.`,
        h.type === 'blocker'
          ? `BLOCKER: none of the ${h.reached.length} ghosts that reached this spot ever got past it.`
          : `FRICTION: ${h.passed.length} of ${h.reached.length} ghosts that reached this spot got past it eventually.`,
        `What the ghosts said near this spot: ${h.quotes.map((q) => `"${q}"`).join(' ')}`,
      ].join('\n');
      const res = await api.chat.completions.create({
        model,
        reasoning_effort: reasoning,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content:
              'You are a game-design analyst reviewing an automated playtest. Explain only the hotspot you are given, using only the evidence. Do not invent numbers.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `${facts}\n\nThe image shows the game a moment before one of these deaths. Write the finding card.` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'finding_card', schema: CARD_SCHEMA } },
      });
      usage.input += res.usage?.prompt_tokens ?? 0;
      usage.output += res.usage?.completion_tokens ?? 0;
      let card;
      try {
        card = JSON.parse(res.choices?.[0]?.message?.content ?? '');
      } catch {
        card = null;
      }
      return { hotspot: h.id, ...(card ?? { title: `${h.count} deaths around x=${h.x}`, what_happens: '', likely_cause: 'unclear', suggested_fix: '' }), model };
    }),
  );
  return { cards, usage };
}
