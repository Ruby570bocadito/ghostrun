// What a ghost is told after each move, built from what the game (SDK) or the screen showed.
// A human player sees their character move and die; the ghost only sees one screenshot per turn,
// so we tell it what happened in between. Pure functions, no AI, covered by tests.
import { keyName as keyLabel } from './keys.mjs';

export function describeMove(move) {
  const parts = [];
  if (move.click?.length) parts.push(`clicked at ${move.click.map((c) => `(${c.x},${c.y})`).join(' and ')}`);
  if (move.drag?.length) parts.push(`dragged ${move.drag.map((d) => `from (${d.x1},${d.y1}) to (${d.x2},${d.y2})`).join(' and ')}`);
  if (move.hold?.length) parts.push(`held ${move.hold.join('+')}`);
  if (move.tap?.length) parts.push(`tapped ${move.tap.join('+')}${move.tap_after_px > 0 ? ` after ${move.tap_after_px} px` : ''}`);
  if (!parts.length) parts.push('waited');
  const then = (move.then ?? []).slice(0, move.thenDone ?? move.then?.length ?? 0).map((a) => `, then ${describeMove(a)}`).join('');
  return `${parts.join(', ')} for ${move.duration_ms} ms${then}`;
}

const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * One short sentence about the result of a move, or null when there is nothing to say.
 * before/after: SDK positions (world pixels); events: what the game or the ghost reported during
 * the move; screenChanged: for games without the SDK, whether the screen changed at all.
 */
export function outcomeOf({ before, after, events = [], sdk, screenChanged, screenNote = null, jump = null }) {
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
  if (deaths && jump) parts.push(...deathFacts(jump));
  for (const e of events) if (e.type === 'milestone' && e.name && e.name !== 'win') parts.push(`you reached "${e.name}"`);
  if (events.some((e) => e.type === 'win') || (after?.won && !before?.won)) parts.push('you finished the level');
  // Games without the SDK: where the screen changed and whether the view scrolled (src/screen.mjs), or nothing.
  if (!sdk && screenNote) parts.push(screenNote);
  else if (!sdk && screenChanged === false) parts.push('nothing changed on screen');
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

const listPx = (v) => (v.length > 1 ? `${v.slice(0, -1).join(', ')} and ${v.at(-1)} px` : `${v[0]} px`);

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
export function turnNotes({ spots, step, recent = [], speed, jumps = null, deadKeys = [] }) {
  const notes = [];
  const spot = spots?.last;
  if (spot && spot.count >= 3 && step - spot.steps.at(-1) <= 8) {
    // Facts only, no advice. The old hint ("try ... another key") came right before 63 of 86 jump taps made in
    // mid-air, and before vertical jumps into the pit (rediseno/roles/4-ia-de-los-fantasmas.md, 22 Nov).
    const parts = [`You have died ${spot.count} times at the same spot.`];
    const tries = (jumps?.jumps ?? []).filter((j) => j.died && !j.walkedOff && spot.steps.includes(j.endStep)).slice(-4);
    if (tries.length) {
      const lengths = tries.filter((j) => j.length != null).map((j) => j.length);
      parts.push(`Your last takeoffs there were ${listPx(tries.map((j) => j.behind))} before the furthest point you had stood on${lengths.length ? `, and those jumps carried you ${listPx(lengths)} forward` : ''}.`);
    }
    if (jumps?.best) parts.push(`Your longest jump so far: ${jumps.best} px.`);
    if (deadKeys.length) parts.push(`Near there, ${deadKeys.map((k) => `${keyLabel(k.key)} did nothing ${k.where} (${k.presses} tap${k.presses > 1 ? 's' : ''})`).join('; ')}.`);
    notes.push(parts.join(' '));
  }
  const last3 = recent.slice(-3);
  if (last3.length === 3 && last3.every((r) => r.stuck)) {
    notes.push('Your last 3 actions did not move you: something is in the way. Try another direction, a jump, or something on screen you can use.');
  }
  if (speed) notes.push(`Measured from your moves: walking moves you about ${speed} px per second (500 ms is about ${Math.round(speed / 2)} px).`);
  return notes;
}

// ---------------------------------------------------------------------------------------------------------------
// Facts about jumps and deaths, measured from the game's own state (SDK games only). Ghosts used to read only "you
// died": they thought they were "back at the start" when they reappeared at a checkpoint (22 thoughts), said they
// had "overshot" a pit they fell short of, and took off 80 px before an edge they believed they were standing at
// (rediseno/roles/4-ia-de-los-fantasmas.md). The facts use only what the character itself did (where it stood,
// jumped and landed), never the level's geometry: the ghost still has to judge the gap with its own eyes.

const FLOOR_ROW_PX = 8; // floors are grouped by height in rows of this size
const TELEPORT_PX = 60; // a jump between two frames larger than this is a respawn, not a movement

/**
 * Follows one ghost's character frame by frame: the floors it has stood on, every takeoff and how far each jump
 * went. observe() is fed the SDK states of each move, in order.
 */
export class JumpLog {
  constructor() {
    this.floors = new Map(); // height row → { min, max } x stood on at that height
    this.start = null; // where the character first appeared
    this.lowestFloorY = -Infinity; // the lowest floor stood on (y grows downwards)
    this.prev = null;
    this.air = null; // the jump in progress
    this.jumps = []; // finished: { x, y, dir, step, behind, walkedOff, length, landed, died, endStep }
  }

  /** The furthest x stood on at this height, in this direction. */
  reach(y, dir) {
    const f = this.floors.get(Math.round(y / FLOOR_ROW_PX));
    return f ? (dir < 0 ? f.min : f.max) : null;
  }

  /** Longest jump so far (landed or not), in px. */
  get best() {
    return Math.max(0, ...this.jumps.filter((j) => !j.walkedOff && j.length != null).map((j) => j.length));
  }

  stand(st) {
    const k = Math.round(st.y / FLOOR_ROW_PX);
    const f = this.floors.get(k) ?? { min: st.x, max: st.x };
    f.min = Math.min(f.min, st.x);
    f.max = Math.max(f.max, st.x);
    this.floors.set(k, f);
    this.lowestFloorY = Math.max(this.lowestFloorY, st.y);
  }

  finish(fields) {
    const j = { ...this.air, ...fields };
    if (j.length == null && j.crossX != null) j.length = Math.round(Math.abs(j.crossX - j.x));
    delete j.crossX;
    delete j.peakY;
    j.length ??= null;
    this.jumps.push(j);
    this.air = null;
    return j;
  }

  /**
   * Feeds the states of one move, the state before the move first. died: the move had a death event; tapX: where
   * a key was tapped in this move (a jump that left near there left exactly from there, not from the frame
   * before, which can be 100 ms earlier). Returns { jumps: [jumps finished in this move], respawn }.
   */
  observe(states, { step = null, died = false, tapX = null } = {}) {
    const out = { jumps: [], respawn: null };
    let deathSeen = false;
    const list = states.filter((st) => st && finite(st));
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
      if (!this.start) this.start = { x: st.x, y: st.y };
      const p = i === 0 ? null : list[i - 1];
      if (!p) {
        if (st.onFloor === true) this.stand(st);
        continue;
      }
      const moreDeaths = Number.isFinite(st.deaths) && Number.isFinite(p.deaths) && st.deaths > p.deaths;
      const teleported = died && !deathSeen && !Number.isFinite(st.deaths) && Math.hypot(st.x - p.x, st.y - p.y) > TELEPORT_PX;
      if (moreDeaths || teleported) {
        deathSeen = true;
        if (this.air) out.jumps.push(this.finish({ landed: false, died: true, endStep: step }));
        out.respawn = { x: st.x, y: st.y, atStart: Math.hypot(st.x - this.start.x, st.y - this.start.y) <= 30 };
        if (st.onFloor === true) this.stand(st);
        continue;
      }
      if (typeof st.onFloor !== 'boolean') continue; // top-down games: no floor, no jumps
      if (p.onFloor && !st.onFloor) {
        const walkedOff = (st.vy ?? 0) >= 0;
        const dir = Math.sign(st.vx || st.x - p.x) || 1;
        // Frames are ~100 ms apart (18 px of running): where the tap was pressed is the exact takeoff point.
        const from = tapX != null && !walkedOff && Math.abs(p.x - tapX) <= 25 && Math.abs(st.x - tapX) <= 40 ? tapX : p.x;
        const r = this.reach(p.y, dir);
        this.air = { x: from, y: p.y, dir, step, walkedOff, behind: r == null ? 0 : Math.max(0, Math.round(dir < 0 ? from - r : r - from)), crossX: null, peakY: p.y };
      }
      if (this.air) {
        if (!st.onFloor) this.air.peakY = Math.min(this.air.peakY, st.y);
        // Where it came back down to the height it jumped from. In the air: interpolated between the two frames. On
        // landing, the frame can be up to 100 ms after the touchdown (the character walked on meanwhile), so it is
        // extrapolated from the last frame in the air with its own speed.
        if (this.air.crossX == null && this.air.peakY < this.air.y - 4 && p.y < this.air.y && st.y >= this.air.y) {
          const k = (this.air.y - p.y) / Math.max(1e-6, st.y - p.y);
          const linear = p.x + k * (st.x - p.x);
          if (st.onFloor && (p.vy ?? 0) > 0 && Number.isFinite(p.vx)) {
            const ahead = p.x + p.vx * ((this.air.y - p.y) / p.vy);
            this.air.crossX = Math.min(Math.max(ahead, Math.min(p.x, st.x)), Math.max(p.x, st.x));
          } else this.air.crossX = linear;
        }
      }
      if (st.onFloor) {
        // Measured where it came back to its takeoff height, like a fatal jump; a jump up onto a ledge never does.
        if (this.air) out.jumps.push(this.finish({ landed: true, died: false, endStep: step, ...(this.air.crossX == null ? { length: Math.round(Math.abs(st.x - this.air.x)) } : {}) }));
        this.stand(st);
      }
    }
    if (list.length) this.prev = list.at(-1);
    if (died && !deathSeen && this.air) out.jumps.push(this.finish({ landed: false, died: true, endStep: step }));
    return out;
  }

  /** Is the character falling below every floor it has stood on, so that it cannot land anywhere it knows? */
  fallingBelowFloors(st, marginPx = 12) {
    return Boolean(st && st.onFloor === false && (st.vy ?? 0) > 0 && Number.isFinite(this.lowestFloorY) && st.y > this.lowestFloorY + marginPx);
  }
}

/** The facts about a death in this move, from what JumpLog.observe() returned, or null when there are none. */
export function jumpFacts(observed, log) {
  if (!observed) return null;
  const jump = observed.jumps.filter((j) => j.died).at(-1) ?? null;
  if (!jump && !observed.respawn) return null;
  return {
    ...(jump ? { takeoff: { x: Math.round(jump.x), behind: jump.behind, walkedOff: jump.walkedOff }, length: jump.walkedOff ? null : jump.length } : {}),
    best: log?.best || null,
    respawn: observed.respawn ? { atStart: observed.respawn.atStart, back: jump ? Math.round((jump.x - observed.respawn.x) * (jump.dir < 0 ? -1 : 1)) : null } : null,
  };
}

/** The facts as short phrases for the outcome line of the move. */
export function deathFacts(f) {
  const parts = [];
  if (f.takeoff?.walkedOff) parts.push('you walked off the edge without jumping');
  else if (f.takeoff) {
    parts.push(f.takeoff.behind > 4 ? `you took off ${f.takeoff.behind} px before the furthest point you had stood on there` : 'you took off from the furthest point you had stood on there');
    parts.push(f.length != null ? `the jump carried you ${f.length} px forward and you came down without landing` : 'you came down without landing');
  }
  if (f.respawn) {
    if (f.respawn.atStart) parts.push('you reappear at the start');
    else parts.push(f.respawn.back > 0 ? `you reappear ${f.respawn.back} px behind your takeoff, at a checkpoint (not the start)` : 'you reappear at a checkpoint (not the start)');
  }
  if (f.best && f.takeoff && !f.takeoff.walkedOff) parts.push(`your longest jump so far: ${f.best} px`);
  return parts;
}
