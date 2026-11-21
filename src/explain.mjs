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
    could_be_ghost_skill: {
      type: 'boolean',
      description: 'True if the evidence could also be explained by the ghosts being clumsy at a precise action (a timed jump, an exact landing), rather than by the game design.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'How sure a developer can be that this is a real design problem. High only when game-reported events (deaths, objectives) clearly support it and ghost skill is unlikely to explain it.',
    },
  },
  required: ['title', 'what_happens', 'likely_cause', 'suggested_fix', 'could_be_ghost_skill', 'confidence'],
  additionalProperties: false,
};

const SYSTEM = [
  'You are a game-design analyst reviewing an automated playtest done by AI "ghost" players with different personalities.',
  'Explain only the finding you are given, using only its evidence. Do not invent numbers or events.',
  // Added after a human review on a real game (docs/ai-review-log.md, R5): all ghosts got stuck at a jump a
  // person found easy, and the card blamed the platform height.
  'The ghosts are AI players: they read the screen well but can be clumsy at precise jumps and timing. When their failure could be their own lack of skill, say so in likely_cause and lower the confidence. When the ghosts said a control or mechanic did nothing or made no sense, consider whether the game explains it.',
  'BLOCKER: nobody who reached the spot got past it, so treat it as a likely bug or design error.',
  'FRICTION: ghosts died but some got past; it may be intended challenge, so suggest a gentle change (a hint, a checkpoint, clearer visuals) rather than removing the challenge.',
  'MISSED: most ghosts never reached an objective (for example they never found an item); focus on why it was not noticed or understood.',
  'STUCK: several ghosts spent their last moves circling the same area; focus on what they could not figure out.',
  'CONFUSION: several ghosts said they did not understand something here; focus on what is unclear.',
  'HARD TO SEE: an objective players must notice is drawn with too little contrast against its background (measured, WCAG asks at least 3:1). AI ghosts can spot faint shapes that people miss, so ghosts reaching it does not mean people will see it; focus on how to make it stand out.',
].join('\n');

// A control or mechanic that "did nothing" is the strongest sign of something the game does not explain.
const NOTHING_HAPPENED = /(did ?n.t|does ?n.t|doesn.t|not working|has ?n.t worked|no effect|nothing happen|did nothing|does nothing|won.t|can.t|unexplained|no instructions)/i;
const MENTIONS_CONTROL = /\b(space|spacebar|arrow|up|key|press|tap|click|button|[a-z] key|control|refresh)\b/i;

/** What the finding's ghosts said about controls that did nothing, or moments they flagged as confusing, during the whole run. */
function controlTalk(f, tracesByPersona, max = 6) {
  const candidates = [];
  for (const p of f.ghosts) {
    for (const s of tracesByPersona[p]?.steps ?? []) {
      const nothing = NOTHING_HAPPENED.test(s.thought);
      const control = MENTIONS_CONTROL.test(s.thought);
      const score = (nothing && control ? 3 : 0) + (s.confused ? 2 : 0) + (nothing ? 1 : 0);
      if (score >= 2) candidates.push({ p, thought: s.thought, score });
    }
  }
  const seen = new Set();
  const perGhost = {};
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.thought) || (perGhost[c.p] ?? 0) >= 2) return false;
      seen.add(c.thought);
      perGhost[c.p] = (perGhost[c.p] ?? 0) + 1;
      return true;
    })
    .slice(0, max)
    .map((c) => `${c.p}: "${c.thought}"`);
}

function factsFor(f, report, tracesByPersona = {}) {
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
    if (f.contrast) lines.push(`Measured contrast of "${f.milestone}" against its background: ${f.contrast}:1 (WCAG 2.1 asks at least 3:1 for objects people need to notice).`);
  } else if (f.type === 'stuck') {
    lines.push(`STUCK: ${who} spent most of their last moves around (${f.center.x}, ${f.center.y}) and did not finish.`);
  } else if (f.type === 'hard_to_see') {
    lines.push(
      `HARD TO SEE: the objective "${f.milestone}" has a contrast ratio of ${f.contrast}:1 against the background around it (measured on the screenshot; WCAG 2.1 asks at least 3:1 for graphical objects people need to notice). ${f.reachedBy.length} of ${report.ghostsTotal} ghosts reached it.`,
    );
  } else if (f.type === 'confusion') {
    lines.push(`CONFUSION: ${who} flagged confusion ${f.count} times around (${f.center.x}, ${f.center.y}).`);
  }
  if (f.stuckGhosts?.length) lines.push(`Ghosts that ended their run stuck here: ${f.stuckGhosts.join(', ')}.`);
  if (f.confusedGhosts?.length) lines.push(`Ghosts that said they were confused here: ${f.confusedGhosts.join(', ')}.`);
  // A human review (docs/ai-review-log.md, R3) found these are the ghosts' plans right before acting, not
  // descriptions of what happened, so label them that way for the analyst too.
  lines.push(`What the ghosts were planning right before (plans, not a description of the outcome): ${f.quotes.map((q) => `"${q}"`).join(' ')}`);
  if (f.type !== 'blocker' && f.type !== 'friction') {
    const talk = controlTalk(f, tracesByPersona);
    if (talk.length) lines.push(`What these ghosts said about controls or confusion during the whole run: ${talk.join(' ')}`);
  }
  if (report.positionSource === 'ghosts')
    lines.push('This game has no Ghostrun SDK: positions and deaths are what the ghosts reported seeing on screen, not events from the game.');
  return lines.join('\n');
}

// reasoning 'minimal' instead of 'low': on the same 3 runs the cards were as good (one 'low' card even
// blamed the arrow keys for hidden spikes), for 47% less cost and 45% less time (bench/results/analyst-effort.md).
export async function explainHotspots(report, { runDir, traces, model = 'muse-spark-1.3', reasoning = 'minimal', client, max = 5 } = {}) {
  const api = client ?? new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 2, timeout: 60_000 });
  const byPersona = Object.fromEntries(traces.map((t) => [t.persona, t]));
  const usage = { input: 0, cached: 0, output: 0, reasoning: 0 };
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
        prompt_cache_key: 'ghostrun-analyst-v1', // the instructions and the card schema repeat on every card
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: `${factsFor(f, report, byPersona)}\n\nThe image shows the game at the key moment for this finding. Write the finding card.` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'finding_card', schema: CARD_SCHEMA } },
      });
      usage.input += res.usage?.prompt_tokens ?? 0;
      usage.cached += res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      usage.output += res.usage?.completion_tokens ?? 0;
      usage.reasoning += res.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
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
