// What a ghost is told after each move, built from what the game (SDK) or the screen showed.
// A human player sees their character move and die; the ghost only sees one screenshot per turn,
// so we tell it what happened in between. Pure functions, no AI, covered by tests.

export function describeMove(move) {
  const parts = [];
  if (move.click?.length) parts.push(`clicked at ${move.click.map((c) => `(${c.x},${c.y})`).join(' and ')}`);
  if (move.hold?.length) parts.push(`held ${move.hold.join('+')}`);
  if (move.tap?.length) parts.push(`tapped ${move.tap.join('+')}`);
  if (!parts.length) parts.push('waited');
  return `${parts.join(', ')} for ${move.duration_ms} ms`;
}

const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * One short sentence about the result of a move, or null when there is nothing to say.
 * before/after: SDK positions (world pixels); events: what the game or the ghost reported during
 * the move; screenChanged: for games without the SDK, whether the screen changed at all.
 */
export function outcomeOf({ before, after, events = [], sdk, screenChanged }) {
  const parts = [];
  const deaths = events.filter((e) => e.type === 'death').length;
  if (sdk && !deaths && finite(before) && finite(after)) {
    const dx = Math.round(after.x - before.x);
    const dy = Math.round(after.y - before.y);
    const moved = [];
    if (Math.abs(dx) >= 4) moved.push(`${Math.abs(dx)} px ${dx > 0 ? 'right' : 'left'}`);
    if (Math.abs(dy) >= 4) moved.push(`${Math.abs(dy)} px ${dy > 0 ? 'down' : 'up'}`);
    parts.push(moved.length ? `you moved ${moved.join(' and ')}` : 'you did not move');
  }
  if (deaths) parts.push(deaths > 1 ? `you died ${deaths} times` : 'you died');
  for (const e of events) if (e.type === 'milestone' && e.name && e.name !== 'win') parts.push(`you reached "${e.name}"`);
  if (events.some((e) => e.type === 'win') || (after?.won && !before?.won)) parts.push('you finished the level');
  if (!sdk && screenChanged === false) parts.push('nothing changed on screen');
  return parts.length ? parts.join(', ') : null;
}

export function historyLine(step, move, outcome) {
  return `${step}. ${describeMove(move)}${outcome ? ` → ${outcome}` : ''}. Thought: "${move.thought}"`;
}

/**
 * Groups a ghost's deaths into spots the way the analysis does (single linkage: a death within
 * `radius` px of any death of a spot joins it, and can merge two spots), so "the same spot" means
 * the same thing for the ghost's hints, for stopping it, and for the findings.
 */
export class DeathSpots {
  constructor(radius = 70) {
    this.radius = radius;
    this.spots = [];
    this.last = null;
  }
  /** Adds a death and returns how many deaths its spot now has. */
  add({ x, y, step }) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const near = this.spots.filter((s) => s.deaths.some((d) => Math.hypot(d.x - x, d.y - y) <= this.radius));
    const spot = { deaths: [...near.flatMap((s) => s.deaths), { x, y, step }] };
    this.spots = [...this.spots.filter((s) => !near.includes(s)), spot];
    spot.count = spot.deaths.length;
    spot.steps = spot.deaths.map((d) => d.step).sort((a, b) => a - b);
    spot.x = spot.deaths.reduce((a, d) => a + d.x, 0) / spot.count;
    spot.y = spot.deaths.reduce((a, d) => a + d.y, 0) / spot.count;
    this.last = spot;
    return spot.count;
  }
  get max() {
    return Math.max(0, ...this.spots.map((s) => s.count));
  }
}

/** Median walking speed (px per second) from moves that only held one horizontal key. */
export function walkSpeed(samples) {
  const v = samples
    .filter((s) => Math.abs(s.dx) >= 10 && Math.abs(s.dy) < 10 && s.ms >= 200)
    .map((s) => (Math.abs(s.dx) / s.ms) * 1000)
    .sort((a, b) => a - b);
  return v.length >= 2 ? Math.round(v[Math.floor(v.length / 2)]) : null;
}

/**
 * Hints for this turn only (they go after the screenshot, outside the cached prefix).
 * recent: the last records {stuck} (stuck = a move with keys held that moved nothing).
 */
export function turnNotes({ spots, step, recent = [], speed }) {
  const notes = [];
  const spot = spots?.last;
  if (spot && spot.count >= 3 && step - spot.steps.at(-1) <= 8) {
    notes.push(`You have died ${spot.count} times at the same spot. Try something different there: other timing, a longer or shorter action, another key or another route.`);
  }
  const last3 = recent.slice(-3);
  if (last3.length === 3 && last3.every((r) => r.stuck)) {
    notes.push('Your last 3 actions did not move you: something is in the way. Try another direction, a jump, or something on screen you can use.');
  }
  if (speed) notes.push(`Measured from your moves: walking moves you about ${speed} px per second (500 ms is about ${Math.round(speed / 2)} px).`);
  return notes;
}
