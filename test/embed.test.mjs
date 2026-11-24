import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGame, findItchGame, itchFrameSize, itchIframeSrc } from '../src/embed.mjs';

test('an itch.io page that runs the game right away: its iframe', () => {
  const html = '<div class="game_frame"><iframe allow="autoplay" id="game_drop" src="https://html-classic.itch.zone/html/19945651/index.html?v=1" frameborder="0"></iframe></div>';
  assert.equal(itchIframeSrc(html), 'https://html-classic.itch.zone/html/19945651/index.html?v=1');
});

test('an itch.io page with a "Run game" button: the iframe the button would create', () => {
  const html = '<div class="iframe_placeholder" data-iframe="&lt;iframe id=&quot;game_drop&quot; src=&quot;https://html-classic.itch.zone/html/123/index.html&quot;&gt;&lt;/iframe&gt;"><button class="load_iframe_btn">Run game</button></div>';
  assert.equal(itchIframeSrc(html), 'https://html-classic.itch.zone/html/123/index.html');
});

test('a page with no game iframe: nothing', () => {
  assert.equal(itchIframeSrc('<html><body><canvas></canvas></body></html>'), null);
  assert.equal(itchIframeSrc('<iframe id="comments" src="https://example.com/c"></iframe>'), null);
});

// Shapes taken from the itch.io pages of Prerolled, Broken Repair and Decogear (24 Nov).
const PAGE_LAZY = '<div class="game_frame game_pending" data-width="1152" style="width: 1152px; height: 648px"><div class="iframe_placeholder" data-iframe="&lt;iframe id=&quot;game_drop&quot; src=&quot;https://html-classic.itch.zone/html/20378631/prerolled_web/index.html?v=1794170499&quot;&gt;&lt;/iframe&gt;"><button class="load_iframe_btn">Run game</button></div></div><script type="text/javascript">init_HtmlEmbed(\'#html_embed_9518681\', {"start_maximized":false,"height":648,"width":1152});init_GameInfoPanel(\'#game_info_panel_8236413\', null);</script>';
const PAGE_DIRECT = '<div class="game_frame game_loaded" data-width="1280" data-height="720"><iframe id="game_drop" frameborder="0" src="https://html-classic.itch.zone/html/19945651/index.html?v=1792666792"></iframe></div><script>init_HtmlEmbed(\'#html_embed_8606819\', {"width":1280,"height":720,"start_maximized":false});</script>';

test('the size an itch.io page shows its game at', () => {
  assert.deepEqual(itchFrameSize(PAGE_LAZY), { width: 1152, height: 648 });
  assert.deepEqual(itchFrameSize(PAGE_DIRECT), { width: 1280, height: 720 });
  // Without init_HtmlEmbed: the game frame's style.
  assert.deepEqual(itchFrameSize('<div class="game_frame game_pending" style="width: 640px; height: 360px"></div>'), { width: 640, height: 360 });
  assert.equal(itchFrameSize('<html><body>no game here</body></html>'), null);
});

const page = (html, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, text: async () => html });

test('an itch.io page read as text: the game\'s address and size, with no browser', async () => {
  const asked = [];
  const fetchImpl = async (url, init) => {
    asked.push({ url, redirect: init.redirect });
    return page(PAGE_LAZY)();
  };
  assert.deepEqual(await findItchGame('https://red-sauce.itch.io/prerolled', { fetchImpl }), {
    url: 'https://html-classic.itch.zone/html/20378631/prerolled_web/index.html?v=1794170499',
    size: { width: 1152, height: 648 },
  });
  assert.deepEqual(asked, [{ url: 'https://red-sauce.itch.io/prerolled', redirect: 'error' }]);
});

test('only itch.io pages are read as text; anything unusual is left to the browser', async () => {
  let calls = 0;
  const counting = (html, status) => async () => {
    calls += 1;
    return page(html, status)();
  };
  assert.equal(await findItchGame('https://js13kgames.com/games/coiner/index.html', { fetchImpl: counting(PAGE_LAZY) }), null);
  assert.equal(await findItchGame('https://evil-itch.io/game', { fetchImpl: counting(PAGE_LAZY) }), null);
  assert.equal(await findItchGame('https://itch.io.example.com/game', { fetchImpl: counting(PAGE_LAZY) }), null);
  assert.equal(calls, 0);
  assert.equal(await findItchGame('https://someone.itch.io/locked', { fetchImpl: counting('<form class="password_form"></form>') }), null);
  assert.equal(await findItchGame('https://someone.itch.io/gone', { fetchImpl: counting(PAGE_LAZY, 404) }), null);
  assert.equal(await findItchGame('https://someone.itch.io/moved', { fetchImpl: async () => { throw new TypeError('fetch failed: redirect'); } }), null);
  assert.equal(calls, 2);
});

test('findGame uses the page read as text and opens no browser for it', async () => {
  const browser = { newContext: async () => assert.fail('no browser context should be opened') };
  const quick = async () => ({ url: 'https://html-classic.itch.zone/html/1/index.html', size: { width: 640, height: 360 } });
  assert.deepEqual(await findGame(browser, 'https://someone.itch.io/game', { quick }), { url: 'https://html-classic.itch.zone/html/1/index.html', size: { width: 640, height: 360 } });
});
