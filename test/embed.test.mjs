import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itchIframeSrc } from '../src/embed.mjs';

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
