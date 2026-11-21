// Can a player actually see the objectives? A plain measurement, no AI.
//
// Why: once the ghosts were told what each move did, they navigated well enough to reach a key drawn
// almost in the floor colour (contrast 1.09:1) that the person in our test could barely see. AI eyes
// pick up faint shapes that people miss, so the ghosts' behaviour alone cannot flag "hard to see".
// For every objective the game declares as something to notice (SDK milestone with kind: 'object'),
// this measures the WCAG contrast ratio between the object's most distinct pixels and the background
// around it, on the first screen where the object is visible. WCAG 2.1 SC 1.4.11 asks at least 3:1
// for graphical objects people need to perceive.

export const CONTRAST_MIN = 3; // WCAG 2.1 SC 1.4.11 (non-text contrast)
export const CONTRAST_INVISIBLE = 1.5; // below this an object is practically invisible

// Recorded runs from before milestones carried a kind: which of our test games' objectives are objects.
export const KNOWN_OBJECTS = new Set(['key', 'door', 'lever', 'checkpoint']);

const declared = (traces) => traces.flatMap((t) => t.frames).find((f) => Array.isArray(f.state?.milestones))?.state.milestones ?? [];

/** The objectives a player has to see: declared with kind 'object' (or known from older runs). */
export function objectsToCheck(traces, { legacyNames = KNOWN_OBJECTS } = {}) {
  return declared(traces).filter((m) => m.kind === 'object' || (m.kind === undefined && legacyNames?.has(m.name)));
}

/** WCAG contrast of a disc around (cx, cy) against the ring around it, computed in the browser. */
async function measureAt(page, jpeg, cx, cy) {
  return page.evaluate(
    async ({ src, cx, cy }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const inner = [];
      const ring = [];
      const R_IN = 10;
      const R0 = 16;
      const R1 = 28;
      for (let y = Math.max(0, cy - R1); y <= Math.min(c.height - 1, cy + R1); y++)
        for (let x = Math.max(0, cx - R1); x <= Math.min(c.width - 1, cx + R1); x++) {
          const d = Math.hypot(x - cx, y - cy);
          const i = (y * c.width + x) * 4;
          const L = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
          if (d <= R_IN) inner.push(L);
          else if (d >= R0 && d <= R1) ring.push(L);
        }
      if (!inner.length || !ring.length) return null;
      ring.sort((a, b) => a - b);
      const bg = ring[Math.floor(ring.length / 2)];
      // The object's most distinct pixels: 90th percentile of the luminance distance to the background.
      const byDistance = inner.map((L) => ({ L, d: Math.abs(L - bg) })).sort((a, b) => a.d - b.d);
      const obj = byDistance[Math.floor(byDistance.length * 0.9)].L;
      return (Math.max(obj, bg) + 0.05) / (Math.min(obj, bg) + 0.05);
    },
    { src: `data:image/jpeg;base64,${jpeg.toString('base64')}`, cx: Math.round(cx), cy: Math.round(cy) },
  );
}

/**
 * Measures each objective on every ghost's first screen where it is visible (before that ghost picked
 * it up) and keeps the median. readFrame(persona, file) returns the JPEG bytes of a recorded frame.
 * Returns [{ name, x, y, ratio, persona, frame }], one per objective that was on screen.
 */
export async function measureObjectives({ browser, traces, readFrame, legacyNames }) {
  const objects = objectsToCheck(traces, { legacyNames });
  if (!objects.length) return [];
  const page = await browser.newPage();
  try {
    const out = [];
    for (const m of objects) {
      const samples = [];
      for (const t of traces) {
        const vp = t.viewport ?? { width: 640, height: 360 };
        const got = t.events.find((e) => e.type === 'milestone' && e.name === m.name);
        const frame = t.frames.find((f) => {
          if (!f.state || !Number.isFinite(f.state.screenX) || (got && f.pageT >= got.t)) return false;
          const sx = m.x - (f.state.x - f.state.screenX);
          const sy = m.y - (f.state.y - f.state.screenY);
          return sx >= 12 && sy >= 12 && sx <= vp.width - 12 && sy <= vp.height - 12;
        });
        if (!frame) continue;
        const sx = m.x - (frame.state.x - frame.state.screenX);
        const sy = m.y - (frame.state.y - frame.state.screenY);
        // The ghost's own character can sit on top of the object; skip those screens.
        if (Math.hypot(frame.state.screenX - sx, frame.state.screenY - sy) < 40) continue;
        const ratio = await measureAt(page, await readFrame(t.persona, frame.file), sx, sy);
        if (ratio) samples.push({ ratio, persona: t.persona, frame: frame.i });
      }
      if (!samples.length) continue;
      samples.sort((a, b) => a.ratio - b.ratio);
      const mid = samples[Math.floor(samples.length / 2)];
      out.push({ name: m.name, x: m.x, y: m.y, ratio: Math.round(mid.ratio * 100) / 100, persona: mid.persona, frame: mid.frame });
    }
    return out;
  } finally {
    await page.close().catch(() => {});
  }
}
