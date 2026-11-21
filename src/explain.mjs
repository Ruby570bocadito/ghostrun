// The analyst: explains the findings from analyze.mjs in plain words, using their evidence
// (counts, quotes and the screen at the key moment). It cannot invent new problems:
// it receives one finding at a time and must answer one card for it.
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

const SYSTEM = [
  'You are a game-design analyst reviewing an automated playtest done by AI "ghost" players with different personalities.',
  'Explain only the finding you are given, using only its evidence. Do not invent numbers or events.',
  'BLOCKER: nobody who reached the spot got past it, so treat it as a likely bug or design error.',
  'FRICTION: ghosts died but some got past; it may be intended challenge, so suggest a gentle change (a hint, a checkpoint, clearer visuals) rather than removing the challenge.',
  'MISSED: most ghosts never reached an objective (for example they never found an item); focus on why it was not noticed or understood.',
  'STUCK: several ghosts spent their last moves circling the same area; focus on what they could not figure out.',
  'CONFUSION: several ghosts said they did not understand something here; focus on what is unclear.',
].join('\n');

function factsFor(f, report) {
  const who = `${f.ghosts.length} of ${report.ghostsTotal} ghosts (${f.ghosts.join(', ')})`;
  const lines = [];
  if (f.type === 'blocker' || f.type === 'friction') {
    lines.push(`${f.type.toUpperCase()}: ${f.count} deaths around (${f.center.x}, ${f.center.y}) in a level of ${report.worldW}x${report.worldH}. ${who} died here.`);
    lines.push(
      f.type === 'blocker'
        ? `None of the ${f.reached.length} ghosts that reached this spot ever got past it.`
        : `${f.passed.length} of ${f.reached.length} ghosts that reached this spot got past it eventually.`,
    );
  } else if (f.type === 'missed') {
    lines.push(`MISSED: the objective "${f.milestone}" was reached by ${f.reachedBy.length} of ${report.ghostsTotal} ghosts. ${who} never reached it.`);
    const closest = f.evidence.filter((e) => e.closest != null).map((e) => `${e.persona} came within ${e.closest}px`);
    if (closest.length) lines.push(`Closest approach: ${closest.join(', ')}.`);
  } else if (f.type === 'stuck') {
    lines.push(`STUCK: ${who} spent most of their last moves around (${f.center.x}, ${f.center.y}) and did not finish.`);
  } else if (f.type === 'confusion') {
    lines.push(`CONFUSION: ${who} flagged confusion ${f.count} times around (${f.center.x}, ${f.center.y}).`);
  }
  if (f.stuckGhosts?.length) lines.push(`Ghosts that ended their run stuck here: ${f.stuckGhosts.join(', ')}.`);
  if (f.confusedGhosts?.length) lines.push(`Ghosts that said they were confused here: ${f.confusedGhosts.join(', ')}.`);
  lines.push(`What the ghosts said: ${f.quotes.map((q) => `"${q}"`).join(' ')}`);
  return lines.join('\n');
}

export async function explainHotspots(report, { runDir, traces, model = 'muse-spark-1.3', reasoning = 'low', client, max = 5 } = {}) {
  const api = client ?? new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2, timeout: 60_000 });
  const byPersona = Object.fromEntries(traces.map((t) => [t.persona, t]));
  const usage = { input: 0, output: 0 };
  const findings = (report.findings ?? report.hotspots).filter((f) => f.severity !== 'low').slice(0, max);

  const cards = await Promise.all(
    findings.map(async (f) => {
      const ev = f.evidence[0];
      const trace = byPersona[ev.persona];
      // The screen at the key moment (60% into the clip: just before a death, or the closest approach).
      const frame = trace.frames[ev.clip[0] + Math.max(0, Math.floor((ev.clip[1] - ev.clip[0]) * 0.6))] ?? trace.frames.at(-1);
      const img = await readFile(join(runDir, ev.persona, frame.file));
      const res = await api.chat.completions.create({
        model,
        reasoning_effort: reasoning,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: `${factsFor(f, report)}\n\nThe image shows the game at the key moment for this finding. Write the finding card.` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'finding_card', schema: CARD_SCHEMA } },
      });
      usage.input += res.usage?.prompt_tokens ?? 0;
      usage.output += res.usage?.completion_tokens ?? 0;
      let card = null;
      try {
        card = JSON.parse(res.choices?.[0]?.message?.content ?? '');
      } catch {
        /* fall back to the plain finding below */
      }
      return { hotspot: f.id, finding: f.id, ...(card ?? { title: `${f.type} around (${f.center.x}, ${f.center.y})`, what_happens: '', likely_cause: 'unclear', suggested_fix: '' }), model };
    }),
  );
  return { cards, usage };
}
