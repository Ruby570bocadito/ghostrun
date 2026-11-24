// The analyst: explains the findings from analyze.mjs in plain words, using their evidence
// (counts, quotes and the screen at the key moment). It cannot invent new problems:
// it receives one finding at a time and must answer one card for it.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import OpenAI from 'openai';
import { keyFact } from './keys.mjs';

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
  // Tightened after a review agent playing a teacher (21 Nov): cards told students to narrow gaps that 4 of 4 ghosts
  // had crossed, which teaches removing challenge without evidence.
  'FRICTION: ghosts died but some got past. When most of the ghosts that reached it got past, it is probably intended challenge: do NOT suggest making it easier (narrowing a gap, removing or moving hazards, slowing anything down); suggest at most clearer feedback (a visual cue, a checkpoint nearby), or say that no change is needed. Only when few of them got past may you suggest easing it, and then say why.',
  'Check the cause against the ghosts\' own words: if their words show a control or mechanic working (they jump, they move, they reach things), do not claim it is missing, broken or unexplained.',
  // Added after the Read Me cards blamed the width of a pit whose real flaw was instructions naming the wrong key.
  'Compare the keys the ghosts pressed with the controls the game shows on screen: if they pressed the key the game names for an action and that action did not seem to happen, say that the key or the instructions may be wrong rather than blaming the level. A key the facts measure as never doing anything, pressed because the screen names it, is strong evidence of exactly that.',
  'MISSED: most ghosts never reached an objective (for example they never found an item); focus on why it was not noticed or understood.',
  'STUCK: several ghosts spent their last moves circling the same area; focus on what they could not figure out.',
  'CONFUSION: several ghosts said they did not understand something here; focus on what is unclear.',
  'HARD TO SEE: an objective players must notice is drawn with too little contrast against its background (measured, WCAG asks at least 3:1). AI ghosts can spot faint shapes that people miss, so ghosts reaching it does not mean people will see it; focus on how to make it stand out.',
].join('\n');

/** A friction spot that most of the ghosts that reached it got past: probably intended challenge. */
export const fairChallenge = (f) => f.type === 'friction' && f.reached?.length > 0 && f.passed.length * 2 >= f.reached.length;

// Suggestions that take challenge away. The FRICTION rule above forbids them on a fair challenge, but the
// small model still wrote "narrow the gap slightly" on 1 of the 4 gallery runs (21 Nov), so the card is checked.
export const MAKES_EASIER = /\b(narrow|shorten|shrink|smaller|reduc|lower|remov|fewer|slow|widen|easier|ease\b|(middle|extra|additional) platform)/i;
const RETRY_FAIR =
  'Your suggested_fix makes this spot easier, but most of the ghosts that reached it got past, so it is probably intended challenge. Write the card again: suggest at most clearer feedback (a visual cue, a checkpoint nearby) or say that no change is needed.';
export const FAIR_FIX = 'No change needed: most ghosts got past, so this looks like intended challenge. If people struggle here too, add a clearer cue rather than making it easier.';

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

/** "held ArrowRight, tapped Space, 400 ms": the keys of one ghost move, in words. */
function describeMove(m) {
  const parts = [];
  if (m.hold?.length) parts.push(`held ${m.hold.join(' + ')}`);
  if (m.tap?.length) parts.push(`tapped ${m.tap.join(', ')}`);
  if (m.click?.length) parts.push('clicked');
  if (!parts.length) parts.push('waited');
  return `${parts.join(', ')} for ${m.duration_ms} ms`;
}

function factsFor(f, report, tracesByPersona = {}) {
  const who = `${f.ghosts.length} of ${report.ghostsTotal} ghosts (${f.ghosts.join(', ')})`;
  const lines = [];
  if (f.type === 'blocker' || f.type === 'friction') {
    lines.push(`${f.type.toUpperCase()}: ${f.count} deaths around (${f.center.x}, ${f.center.y}) in a level of ${report.worldW}x${report.worldH}. ${who} died here.`);
    lines.push(
      f.type === 'blocker'
        ? `None of the ${f.reached.length} ghosts that reached this spot ever got past it.`
        : `${f.passed.length} of ${f.reached.length} ghosts that reached this spot got past it eventually${fairChallenge(f) ? ': most did, so treat it as a fair challenge and do not suggest making it easier' : ''}.`,
    );
    // Deaths at the bottom edge of a side-scroller are falls. Ghosts sometimes thought they stood in a pit they
    // could climb out of, and a card blamed "pit walls taller than the jump" for a gap that was too wide (21 Nov).
    if (report.worldW > 700 && report.positionSource !== 'ghosts' && f.center.y >= report.worldH - 4)
      lines.push('The deaths are at the bottom edge of the level: the ghosts died by falling into it, so it is not a pit they could climb out of.');
    const moves = f.evidence
      .map((e) => [e.persona, tracesByPersona[e.persona]?.steps.find((s) => s.step === e.step)?.move])
      .filter(([, m]) => m)
      .map(([p, m]) => `${p}: ${describeMove(m)}`);
    if (moves.length) lines.push(`The move each ghost made when it first died here: ${moves.join('; ')}.`);
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
  // Measured from the game, not from the ghosts' words (22 Nov): Read Me cards blamed the pit while Z never did anything.
  const keys = keyFact(f.keys);
  if (keys) lines.push(keys);
  if (f.stuckGhosts?.length) lines.push(`Ghosts that ended their run stuck here: ${f.stuckGhosts.join(', ')}.`);
  if (f.confusedGhosts?.length) lines.push(`Ghosts that said they were confused here: ${f.confusedGhosts.join(', ')}.`);
  // A human review (docs/ai-review-log.md, R3) found these are the ghosts' plans right before acting, not
  // descriptions of what happened, so label them that way for the analyst too.
  lines.push(`What the ghosts were planning right before (plans, not a description of the outcome): ${f.quotes.map((q) => `"${q}"`).join(' ')}`);
  if (f.type !== 'blocker' && f.type !== 'friction') {
    const talk = controlTalk(f, tracesByPersona);
    if (talk.length) lines.push(`What these ghosts said about controls or confusion during the whole run: ${talk.join(' ')}`);
  }
  if (report.positionSource === 'ghosts') {
    lines.push('This game has no Ghostrun SDK: positions and deaths are what the ghosts reported seeing on screen, not events from the game.');
    // Real jam games (22 Nov): cards called inputs "broken" when the ghosts had pressed them too early, on a cut-off
    // screen, or during a transition. Without the game's own events, that is the ghosts' experience, not a fact.
    lines.push('So when the ghosts say an input or a screen did nothing, write it as their experience ("the ghosts could not get Enter to start the game"), not as a fact about the game, and use low confidence unless several ghosts agree and the screen shows it.');
  }
  return lines.join('\n');
}

// reasoning 'minimal' instead of 'low': on the same 3 runs the cards were as good (one 'low' card even
// blamed the arrow keys for hidden spikes), for 47% less cost and 45% less time (bench/results/analyst-effort.md).
// One card normally takes 6-12 s; twice the analyst took 48-55 s, and with 2 retries of 60 s it could hold a finished
// run for minutes. On 24 Nov a call hung, timed out at 25 s and the retry finished at ~45 s; the same card took 5.8 s
// when asked again. So: 15 s per call, one retry, 30 s in all.
const CARD_TIMEOUT_MS = 15_000;
const ANALYST_DEADLINE_MS = 30_000;
export async function explainHotspots(report, { runDir, traces, model = 'muse-spark-1.3', reasoning = 'minimal', client, max = 5, deadlineMs = ANALYST_DEADLINE_MS } = {}) {
  const api = client ?? new OpenAI({ baseURL: 'https://api.meta.ai/v1', apiKey: process.env.MODEL_API_KEY, maxRetries: 1, timeout: CARD_TIMEOUT_MS });
  const byPersona = Object.fromEntries(traces.map((t) => [t.persona, t]));
  const usage = { input: 0, cached: 0, output: 0, reasoning: 0 };
  const findings = (report.findings ?? report.hotspots).filter((f) => f.severity !== 'low').slice(0, max);

  async function ask(messages) {
    const res = await api.chat.completions.create({
      model,
      reasoning_effort: reasoning,
      max_tokens: 3000,
      prompt_cache_key: 'ghostrun-analyst-v1', // the instructions and the card schema repeat on every card
      messages,
      response_format: { type: 'json_schema', json_schema: { name: 'finding_card', schema: CARD_SCHEMA } },
    });
    usage.input += res.usage?.prompt_tokens ?? 0;
    usage.cached += res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    usage.output += res.usage?.completion_tokens ?? 0;
    usage.reasoning += res.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    const raw = res.choices?.[0]?.message?.content ?? '';
    try {
      return { raw, card: JSON.parse(raw) };
    } catch {
      return { raw, card: null }; // fall back to the plain finding below
    }
  }

  const plain = (f) => ({ hotspot: f.id, finding: f.id, title: `${f.type} around (${f.center.x}, ${f.center.y})`, what_happens: '', likely_cause: 'unclear', suggested_fix: '', model });
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve('late'), deadlineMs);
  });
  const work = findings.map(async (f) => {
      const ev = f.evidence[0];
      const trace = byPersona[ev.persona];
      // The screen at the key moment (60% into the clip: just before a death, or the closest approach).
      const frame = trace.frames[ev.clip[0] + Math.max(0, Math.floor((ev.clip[1] - ev.clip[0]) * 0.6))] ?? trace.frames.at(-1);
      const img = await readFile(join(runDir, ev.persona, frame.file));
      const messages = [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `${factsFor(f, report, byPersona)}\n\nThe image shows the game at the key moment for this finding. Write the finding card.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
          ],
        },
      ];
      let { raw, card } = await ask(messages);
      // A card must not contradict its own evidence: on a fair challenge, ask once more with the reason,
      // and if it still makes the spot easier, keep the card but replace that suggestion with a fixed one.
      if (card && fairChallenge(f) && MAKES_EASIER.test(card.suggested_fix)) {
        const again = await ask([...messages, { role: 'assistant', content: raw }, { role: 'user', content: RETRY_FAIR }]);
        if (again.card) card = again.card;
        if (MAKES_EASIER.test(card.suggested_fix)) card = { ...card, suggested_fix: FAIR_FIX };
      }
      return card ? { hotspot: f.id, finding: f.id, ...card, model } : plain(f);
  });
  // Cards not ready by the deadline are replaced by the plain finding; an error on one card does not lose the others.
  const cards = await Promise.all(work.map((w, i) => Promise.race([w.catch(() => plain(findings[i])), late.then(() => ({ ...plain(findings[i]), late: true }))])));
  clearTimeout(timer);
  return { cards, usage };
}
