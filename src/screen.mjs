// What changed on screen between two screenshots, measured without AI. On real games without the SDK the ghosts only
// saw one screenshot per turn and were told "nothing changed" only when two images were byte-identical: 580 of their
// thoughts said an input did nothing while the cursor moved or the camera followed them (rediseno/v3/juegos-reales.md).
// Now each move is told where the screen changed, whether the view scrolled, and which inputs change anything.
import jpeg from 'jpeg-js';

export const GRID_W = 64;
export const GRID_H = 36;
const PIXEL_DELTA = 24; // grey levels (0-255) for a small cell to count as changed
const MIN_EFFECT = 0.0015; // share of cells: about 3 cells of 10x10 px, enough for a small sprite moving

/** A JPEG screenshot as a small grey image (GRID_W × GRID_H, box-averaged). */
export function grayGrid(buf, w = GRID_W, h = GRID_H) {
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 64 });
  const out = new Float32Array(w * h);
  const cnt = new Uint32Array(w * h);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < img.height; y += 2) {
    const gy = Math.min(h - 1, Math.floor(y / sy));
    for (let x = 0; x < img.width; x += 2) {
      const gx = Math.min(w - 1, Math.floor(x / sx));
      const i = (y * img.width + x) * 4;
      out[gy * w + gx] += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      cnt[gy * w + gx] += 1;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i] ? out[i] / cnt[i] : 0;
  return { w, h, px: out };
}

const meanAbs = (a, b, dx, dy) => {
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, dy); y < Math.min(a.h, a.h + dy); y++) {
    for (let x = Math.max(0, dx); x < Math.min(a.w, a.w + dx); x++) {
      sum += Math.abs(a.px[(y - dy) * a.w + (x - dx)] - b.px[y * b.w + x]);
      n += 1;
    }
  }
  return n ? sum / n : Infinity;
};

/**
 * How two small grey images differ: the share of cells that changed, the box around them (in grid cells), and a
 * scroll when the whole picture moved (best shift of up to 6 cells, clearly better than no shift).
 */
export function compareGrids(a, b) {
  let changed = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (Math.abs(a.px[y * a.w + x] - b.px[y * b.w + x]) > PIXEL_DELTA) {
        changed += 1;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  const fraction = changed / (a.w * a.h);
  let scroll = null;
  if (fraction > 0.05) {
    const still = meanAbs(a, b, 0, 0);
    let best = { dx: 0, dy: 0, err: still };
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        if (!dx && !dy) continue;
        const err = meanAbs(a, b, dx, dy);
        if (err < best.err) best = { dx, dy, err };
      }
    }
    if ((best.dx || best.dy) && best.err < still * 0.55) scroll = { dx: best.dx, dy: best.dy };
  }
  return { fraction, box: changed ? { x0, y0, x1, y1 } : null, scroll };
}

const AREA = (cx, cy) => {
  const col = cx < 0.34 ? 'left' : cx > 0.66 ? 'right' : 'middle';
  const row = cy < 0.34 ? 'top' : cy > 0.66 ? 'bottom' : 'middle';
  return row === 'middle' && col === 'middle' ? 'the centre' : row === 'middle' ? `the ${col}` : col === 'middle' ? `the ${row}` : `the ${row} ${col}`;
};

/**
 * One phrase about a change, for the ghost: a new screen, the view scrolling, something moving in one area, or
 * nothing. `idle` is how much the screen changes on its own (animated backgrounds), so that is not counted.
 */
export function describeChange(c, idle = 0) {
  if (!c) return null;
  if (c.fraction > 0.6 && !c.scroll) return 'the whole screen changed';
  const parts = [];
  if (c.scroll) {
    const h = c.scroll.dx > 0 ? 'right' : c.scroll.dx < 0 ? 'left' : '';
    const v = c.scroll.dy > 0 ? 'down' : c.scroll.dy < 0 ? 'up' : '';
    // The picture moving right means the camera moved left, i.e. the character went left.
    const cam = [h === 'right' ? 'left' : h === 'left' ? 'right' : '', v === 'down' ? 'up' : v === 'up' ? 'down' : ''].filter(Boolean).join(' and ');
    parts.push(`the view scrolled ${cam} (you moved)`);
  }
  if (c.fraction <= Math.max(MIN_EFFECT, idle * 1.5)) return parts.length ? parts[0] : 'nothing changed on screen';
  if (c.box && !c.scroll) {
    const cx = (c.box.x0 + c.box.x1 + 1) / 2 / GRID_W;
    const cy = (c.box.y0 + c.box.y1 + 1) / 2 / GRID_H;
    const size = c.fraction < 0.03 ? 'something small' : c.fraction < 0.2 ? 'part of the screen' : 'a large part of the screen';
    parts.push(`${size} changed around ${AREA(cx, cy)}`);
  }
  return parts.join(', ');
}

/** Whether a change is more than the screen does on its own. */
export const isEffect = (c, idle = 0) => Boolean(c) && (Boolean(c.scroll) || c.fraction > Math.max(MIN_EFFECT, idle * 1.5));

/** A coarse fingerprint of a screen (11 × 8 cells, 8 grey levels, as Go-Explore): equal for nearly equal screens. */
export function screenHash(g) {
  const W = 11;
  const H = 8;
  let s = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let gy = Math.floor((y * g.h) / H); gy < Math.floor(((y + 1) * g.h) / H); gy++) {
        for (let gx = Math.floor((x * g.w) / W); gx < Math.floor(((x + 1) * g.w) / W); gx++) {
          sum += g.px[gy * g.w + gx];
          n += 1;
        }
      }
      s += Math.min(7, Math.floor((n ? sum / n : 0) / 32));
    }
  }
  return s;
}

/** Per input (a key, "click", "drag"): how many times it was used and how many times the screen answered. */
export class InputTable {
  constructor() {
    this.rows = new Map();
  }
  add(inputs, effect) {
    for (const k of new Set(inputs)) {
      const r = this.rows.get(k) ?? { used: 0, changed: 0 };
      r.used += 1;
      if (effect) r.changed += 1;
      this.rows.set(k, r);
    }
  }
  /** "What your inputs did so far: ArrowRight 5/6 · Space 3/3 · click 0/4", or null before any input. */
  note(label = (k) => k) {
    if (!this.rows.size) return null;
    const parts = [...this.rows].sort((a, b) => b[1].used - a[1].used).map(([k, r]) => `${label(k)} ${r.changed}/${r.used}`);
    return `What your inputs did so far (times the screen answered / times used): ${parts.join(' · ')}.`;
  }
  toJSON() {
    return Object.fromEntries(this.rows);
  }
}
