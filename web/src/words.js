// Words the pages show that are worth testing on their own (test/words.test.mjs): plain reasons a game could not be
// opened, and the name, credit and kind of a recorded playtest's card. No JSX and no imports, so Node can load it.

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Plain words for why a page could not be opened: the browser's own error ("page.goto: net::ERR_NAME_NOT_RESOLVED at
 * …") meant nothing to a test agent. Null when the message is already written for people. */
export function friendlyFailure(message = '') {
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo/i.test(message)) return 'That address does not exist. Check the link for typos.';
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message)) return 'Nothing answered at that address: the site may be down, or it only runs on your own computer.';
  if (/ERR_CONNECTION_TIMED_OUT|ERR_TIMED_OUT|Timeout \d+ms exceeded/i.test(message)) return 'The page took too long to load. Try again in a moment.';
  if (/ERR_CERT|SSL_PROTOCOL/i.test(message)) return 'The site’s security certificate is not valid, so the browser would not open it.';
  if (/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/i.test(message)) return 'The server lost its connection while opening the game. Try again in a moment.';
  if (/net::ERR_|page\.goto/i.test(message)) return 'The browser could not open that address.';
  return null;
}

/** A card's name, credit and kind. Exports from scripts/export-demo.mjs carry them; older ones only have a title such as
 * "SPACETAXI by Christoph Schansky (js13kGames 2021, GPL-3.0): a real jam game, no SDK" (test agents read those titles
 * as metadata, not names). */
export function describeRun(r) {
  if (r.name) return { kind: r.kind ?? 'test', name: r.name, credit: r.credit ?? '' };
  const t = r.title ?? '';
  if (/^caught/i.test(r.shows ?? '') || /not a game/i.test(t)) return { kind: 'error', name: t, credit: 'The link opened a page with no game on it.' };
  const by = t.match(/^(.+?) by (.+?) \((.+?)\)/);
  if (by) return { kind: 'real', name: by[1], credit: `By ${by[2]} · ${by[3]}` };
  if (/real jam game/i.test(t)) return { kind: 'real', name: t.split(',')[0], credit: 'A jam game we did not make' };
  const [name, ...rest] = t.split(', ');
  return { kind: r.kind ?? 'test', name, credit: capital(rest.join(', ').replace(/planted flaw/, 'flaw we planted')) };
}
