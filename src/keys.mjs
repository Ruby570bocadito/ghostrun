// Which keys the ghosts tapped and whether they did anything, measured from the game's own state (SDK games).
// The analyst kept blaming the width of Read Me's pit, whose real flaw is instructions naming the wrong key: the
// ghosts pressed Z hundreds of times and it never did anything, but nothing told the analyst that (22 Nov).
// Pure functions, no AI, covered by tests.

// Fields that change by themselves while a character moves, or that describe the level, not the effect of a key.
const IGNORE = new Set(['x', 'y', 'vx', 'vy', 'frame', 'screenX', 'screenY', 'onFloor', 'deaths', 'won', 'checkpoint', 'worldW', 'worldH', 'game', 'fault', 'gaps', 'milestones']);
// Holding these only walks, so a jump or a change in the game during the move comes from the tapped key.
const WALK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']);

/** "KeyZ" → "Z", "Digit1" → "1"; other names (Space, ArrowUp, Enter) stay as they are. */
export const keyName = (k) => (/^Key[A-Z]$/.test(k) ? k.slice(3) : /^Digit\d$/.test(k) ? k.slice(5) : k);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The key this move tested on its own, or null. A move that taps Space and Z together and jumps says nothing
 * about Z: in Read Me, every "effect" of Z came from moves like that.
 */
export function soloTap(move) {
  const taps = move?.tap ?? [];
  if (taps.length !== 1 || move.click?.length) return null;
  return (move.hold ?? []).every((k) => WALK_KEYS.has(k)) ? taps[0] : null;
}

/** Fastest speed seen while a ghost only held keys (no tap): its normal walking speed. */
function walkingSpeed(trace) {
  let walk = 0;
  for (const s of trace.steps) {
    if (s.move?.tap?.length || !s.move?.hold?.length || !s.frames) continue;
    for (let i = s.frames[0]; i <= s.frames[1]; i++) {
      const st = trace.frames[i]?.state;
      if (st) walk = Math.max(walk, Math.abs(st.vx ?? 0), Math.abs(st.vy ?? 0));
    }
  }
  return walk;
}

/**
 * Did the key tapped in this move do anything? Yes when, in its first frames, the character started going up
 * from the floor, moved clearly faster than walking (not by falling), a game field other than position changed,
 * or the game reported reaching something. A death is not an effect of the key. null when it cannot be told.
 */
export function tapHadEffect(trace, step, walk, firstFrames = 3) {
  if (!step.frames) return null;
  const before = trace.frames[Math.max(0, step.frames[0] - 1)]?.state;
  if (!before) return null;
  if ((step.events ?? []).some((e) => e === 'milestone' || e === 'win' || e?.type === 'milestone' || e?.type === 'win')) return true;
  for (let i = step.frames[0]; i <= Math.min(step.frames[1], step.frames[0] + firstFrames - 1); i++) {
    const st = trace.frames[i]?.state;
    if (!st) continue;
    if (before.onFloor && (st.vy ?? 0) < -100) return true;
    const speed = Math.max(Math.abs(st.vx ?? 0), Math.abs(st.vy ?? 0));
    const falling = (st.vy ?? 0) > 0 && Math.abs(st.vx ?? 0) <= walk;
    if (walk && speed > walk * 1.3 && !falling) return true;
    for (const k of Object.keys(st)) if (!IGNORE.has(k) && !same(st[k], before[k])) return true;
  }
  return false;
}

/**
 * For every key tapped on its own: how many times, in how many of those presses it did something, and by which
 * ghosts. Only for games that report their state (the SDK); returns [] otherwise.
 */
export function keyEffects(traces) {
  const keys = {};
  const movesWhenHeld = new Set();
  for (const t of traces) {
    if (!t?.frames?.some((f) => f.state)) continue;
    const walk = walkingSpeed(t);
    for (const s of t.steps ?? []) {
      // A key that moves the character while held is a movement key (Spike Maze's up arrow), whatever a tap of it does.
      const held = s.move?.hold ?? [];
      if (held.length === 1 && !s.move?.tap?.length && s.before && s.after && Math.hypot(s.after.x - s.before.x, s.after.y - s.before.y) >= 4) movesWhenHeld.add(held[0]);
      const k = soloTap(s.move);
      if (!k) continue;
      const effect = tapHadEffect(t, s, walk);
      if (effect == null) continue;
      const row = (keys[k] ??= { key: k, presses: 0, effects: 0, ghosts: new Set() });
      row.presses += 1;
      if (effect) row.effects += 1;
      row.ghosts.add(t.persona);
    }
  }
  return Object.values(keys)
    .map((r) => ({ ...r, ghosts: [...r.ghosts], ...(movesWhenHeld.has(r.key) ? { movesWhenHeld: true } : {}) }))
    .sort((a, b) => b.presses - a.presses);
}

/** Keys these ghosts tapped in moves that started within `radius` px of a spot. */
export function keysTappedNear(traces, personas, center, radius = 120) {
  const keys = new Set();
  if (!center) return keys;
  for (const t of traces) {
    if (!personas.includes(t.persona)) continue;
    for (const s of t.steps ?? []) {
      const p = s.before ?? s.player;
      if (p && Math.hypot(p.x - center.x, p.y - center.y) <= radius) for (const k of s.move?.tap ?? []) keys.add(k);
    }
  }
  return keys;
}

/** A key that did nothing in 3 or more presses on its own, so a key that works only in one place is not blamed early. */
export const isDeadKey = (r) => r.effects === 0 && r.presses >= 3 && !r.movesWhenHeld;

/** The measured keys worth reporting at a spot: those tapped near it, if at least one of them never did anything. */
export function keyRowsNear(effects, nearKeys, max = 4) {
  const rows = effects.filter((r) => nearKeys.has(r.key) && r.presses >= 2).slice(0, max);
  return rows.some(isDeadKey) ? rows : null;
}

/** One line for the analyst about those keys, or null. */
export function keyFact(rows) {
  if (!rows?.some(isDeadKey)) return null;
  const parts = rows.map((r) =>
    isDeadKey(r)
      ? `${keyName(r.key)} never did anything in ${r.presses} presses by ${r.ghosts.length} ghost${r.ghosts.length > 1 ? 's' : ''} (no jump, no burst of speed, no change in the game's state)`
      : `${keyName(r.key)} did something in ${r.effects} of ${r.presses} presses`,
  );
  return `Keys the ghosts tapped near this spot, measured from the game over the whole run (presses where it was the only key tapped): ${parts.join('; ')}.`;
}
