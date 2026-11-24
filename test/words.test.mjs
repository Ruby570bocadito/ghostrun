// The words the web pages show for failed games and for the demo's playtest cards (web/src/words.js). The card titles
// are the real ones of the published demo (scripts/export-demo.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeRun, friendlyFailure } from '../web/src/words.js';

test('a browser error becomes a reason people understand; our own messages stay as they are', () => {
  assert.equal(friendlyFailure('page.goto: net::ERR_NAME_NOT_RESOLVED at https://no-such-game.example/'), 'That address does not exist. Check the link for typos.');
  assert.match(friendlyFailure('page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:9999/'), /Nothing answered/);
  assert.match(friendlyFailure('page.goto: Timeout 30000ms exceeded.'), /too long to load/);
  assert.match(friendlyFailure('page.goto: net::ERR_CERT_AUTHORITY_INVALID'), /certificate/);
  assert.equal(friendlyFailure('page.goto: net::ERR_ABORTED'), 'The browser could not open that address.');
  assert.equal(friendlyFailure('No game canvas found on this page.'), null);
  assert.equal(friendlyFailure(), null);
});

test('a real jam game card shows the game name, and its author and licence apart', () => {
  const r = describeRun({ title: 'SPACETAXI by Christoph Schansky (js13kGames 2021, GPL-3.0): a real jam game, no SDK', shows: 'Found: 4 of 4 ghosts never worked out the goal' });
  assert.deepEqual(r, { kind: 'real', name: 'SPACETAXI', credit: 'By Christoph Schansky · js13kGames 2021, GPL-3.0' });
  assert.deepEqual(describeRun({ title: 'NILO, a real jam game we did not make (no SDK)', shows: 'Found: stuck' }), { kind: 'real', name: 'NILO', credit: 'A jam game we did not make' });
});

test('a test game card names the game and says which version it is', () => {
  assert.deepEqual(describeRun({ title: 'Gap Run, with its planted flaw', shows: 'Found: blocker', kind: 'test' }), { kind: 'test', name: 'Gap Run', credit: 'With its flaw we planted' });
  assert.deepEqual(describeRun({ title: 'Gap Run, fixed: compared with the run before', shows: 'Nothing to fix: 4/4 ghosts finished' }), {
    kind: 'test',
    name: 'Gap Run',
    credit: 'Fixed: compared with the run before',
  });
  assert.equal(describeRun({ title: 'Gap Run, with its planted flaw, during a simulated AI outage', shows: 'Found: blocker' }).credit, 'With its flaw we planted, during a simulated AI outage');
});

test('the link that is not a game is not dressed up as a game', () => {
  const r = describeRun({ title: 'A link that is not a game', shows: 'Caught before any AI call: "No game canvas found on this page."', kind: 'test' });
  assert.equal(r.kind, 'error');
});

test('cards exported with their own name and credit are shown as exported', () => {
  assert.deepEqual(describeRun({ name: 'Key Hunt', credit: 'With its flaw we planted', kind: 'test', title: 'ignored' }), { kind: 'test', name: 'Key Hunt', credit: 'With its flaw we planted' });
});
