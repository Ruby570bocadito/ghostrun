// Many game pages do not draw the game themselves: on itch.io, where most jam games live, the game runs in an
// iframe from another address (html-classic.itch.zone), sometimes only after a "Run game" button. Looking for a
// canvas on the page itself found none, so every itch.io link failed with "No game canvas found" (Rafa, 22 Nov).
// Before the ghosts play, we find the address of the game itself and the ghosts open that, so they see and control
// the game and nothing of the page around it. The page's own address stays in the report.

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#34;': '"', '&#39;': "'", '&amp;': '&' };
const decode = (s) => s.replace(/&(lt|gt|quot|#34|#39|amp);/g, (m) => ENTITIES[m]);

/** The game's own address in an itch.io page's HTML: its iframe, or the iframe a "Run game" button would create. */
export function itchIframeSrc(html, base = 'https://itch.io/') {
  const tag = html.match(/<iframe\b[^>]*\bid="game_drop"[^>]*>/i)?.[0];
  const direct = tag?.match(/\bsrc="([^"]+)"/i)?.[1];
  const lazy = decode(html.match(/\bdata-iframe="([^"]+)"/i)?.[1] ?? '').match(/\bsrc="([^"]+)"/i)?.[1];
  const src = direct ?? lazy;
  if (!src) return null;
  try {
    return new URL(decode(src), base).href;
  } catch {
    return null;
  }
}

/** The size an itch.io page shows its game at (the options of init_HtmlEmbed, else the game frame's style), or null. */
export function itchFrameSize(html) {
  const options = html.match(/init_HtmlEmbed\([^,()]*,\s*(\{[^{}]*\})\s*\)/)?.[1];
  try {
    const o = options ? JSON.parse(options) : null;
    if (o && o.width > 0 && o.height > 0) return { width: Math.round(o.width), height: Math.round(o.height) };
  } catch {
    // not JSON: try the style below
  }
  const style = html.match(/class="game_frame\b[^"]*"[^>]*style="width:\s*(\d+)px;\s*height:\s*(\d+)px/i);
  return style ? { width: Number(style[1]), height: Number(style[2]) } : null;
}

/**
 * An itch.io page read as text, without a browser: { url, size } of its game, or null (not itch.io, no game iframe
 * in the page, a redirect, an error) to look with a browser instead. A browser also starts loading the game in the
 * page's iframe, which the ghosts then load again: 1.6-3.2 s before each run's ghosts could start (24 Nov).
 */
export async function findItchGame(url, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!/(^|\.)itch\.io$/i.test(host) || typeof fetchImpl !== 'function') return null;
  try {
    const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'Mozilla/5.0 (compatible; playtest)' } });
    if (!res.ok) return null;
    const html = await res.text();
    const src = itchIframeSrc(html, url);
    return src ? { url: src, size: itchFrameSize(html) } : null;
  } catch {
    return null;
  }
}

const hasCanvas = (frame) =>
  frame
    .evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .catch(() => false);

/**
 * Opens `url` once and returns { url, size } (see findPlayUrl) — kept for callers that only need the address.
 */
export async function findPlayUrlOnly(browser, url, opts) {
  return (await findGame(browser, url, opts)).url;
}

/**
 * Opens `url` once and returns the address the ghosts should play: `url` itself when the page draws the game, else
 * the address of the iframe that does (clicking itch.io's "Run game" button if the game waits behind it).
 * Returns `url` unchanged when it cannot tell, so the ghosts' own start reports what is wrong with the page.
 */
export const findPlayUrl = findPlayUrlOnly;

/**
 * The same, with the size the page shows a framed game at (its iframe's box): the ghosts' window is fitted to it, so a
 * framed game is not loaded a second time just to measure it (on itch.io the first frame took 27 s, 23 Nov).
 * size is null when the page draws the game itself.
 */
export async function findGame(browser, url, { protect = async () => {}, contextOptions = {}, waitMs = 8000, quick = findItchGame } = {}) {
  const found = quick ? await quick(url) : null;
  if (found) return found;
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, ...contextOptions });
  try {
    await protect(context);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    const t0 = Date.now();
    let clicked = false;
    for (;;) {
      if (await hasCanvas(page.mainFrame())) return { url, size: null };
      for (const frame of page.frames()) {
        if (frame !== page.mainFrame() && /^https?:/.test(frame.url()) && (await hasCanvas(frame))) {
          const box = await (await frame.frameElement().catch(() => null))?.boundingBox().catch(() => null);
          return { url: frame.url(), size: box && box.width > 0 ? { width: Math.round(box.width), height: Math.round(box.height) } : null };
        }
      }
      if (!clicked) {
        // itch.io: games that start on click show a "Run game" button that creates the iframe.
        const run = page.locator('.load_iframe_btn, button:has-text("Run game")').first();
        if (await run.isVisible().catch(() => false)) {
          clicked = true;
          await run.click().catch(() => {});
        }
      }
      if (Date.now() - t0 > waitMs) break;
      await page.waitForTimeout(300);
    }
    // No canvas yet (some games create it only after a click): fall back to the itch.io iframe, if there is one.
    return { url: itchIframeSrc(await page.content(), url) ?? url, size: null };
  } catch {
    return { url, size: null };
  } finally {
    await context.close().catch(() => {});
  }
}
