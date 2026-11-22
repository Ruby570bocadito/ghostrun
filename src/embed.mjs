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
 * Opens `url` once and returns the address the ghosts should play: `url` itself when the page draws the game, else
 * the address of the iframe that does (clicking itch.io's "Run game" button if the game waits behind it).
 * Returns `url` unchanged when it cannot tell, so the ghosts' own start reports what is wrong with the page.
 */
export async function findPlayUrl(browser, url, { protect = async () => {}, contextOptions = {}, waitMs = 8000 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, ...contextOptions });
  try {
    await protect(context);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    const t0 = Date.now();
    let clicked = false;
    for (;;) {
      if (await hasCanvas(page.mainFrame())) return url;
      for (const frame of page.frames()) {
        if (frame !== page.mainFrame() && /^https?:/.test(frame.url()) && (await hasCanvas(frame))) return frame.url();
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
    return itchIframeSrc(await page.content(), url) ?? url;
  } catch {
    return url;
  } finally {
    await context.close().catch(() => {});
  }
}
