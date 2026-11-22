// Picks a window size that shows the whole game, before the ghosts play (no AI involved).
// Some games draw on a fixed canvas bigger than the default window: Coiner, a js13k game, is 500x500, and in a
// 640x360 window its character sat below the screen, so the ghosts never saw what they controlled and the report
// blamed the game's controls (22 Nov).

export const MAX_VIEWPORT = { width: 1024, height: 768 };

/** The window that fits a canvas found at `rect` (page coordinates), never smaller than `viewport`, at most `max`. */
export function fitSize(viewport, rect, max = MAX_VIEWPORT) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return viewport;
  const needW = Math.ceil(rect.x + rect.width);
  const needH = Math.ceil(rect.y + rect.height);
  if (needW <= viewport.width && needH <= viewport.height) return viewport;
  const even = (n) => n + (n % 2);
  return {
    width: even(Math.min(max.width, Math.max(viewport.width, needW))),
    height: even(Math.min(max.height, Math.max(viewport.height, needH))),
  };
}

/**
 * Opens the game once at `viewport` and returns where its canvas is ({x, y, width, height} in page pixels), or null.
 * `protect(context)` applies the same request checks as the ghosts' own browsers (public demo).
 */
export async function measureCanvas(browser, url, viewport, { protect = async () => {}, contextOptions = {}, waitMs = 6000 } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...contextOptions });
  try {
    await protect(context);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    const t0 = Date.now();
    for (;;) {
      const rect = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
      });
      if (rect && rect.width > 0) return rect;
      if (Date.now() - t0 > waitMs) return null;
      await page.waitForTimeout(250);
    }
  } catch {
    return null; // the ghosts' own start will report what is wrong with the page
  } finally {
    await context.close().catch(() => {});
  }
}
