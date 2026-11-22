import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyEffects, keyFact, keyName, keyRowsNear, keysTappedNear, soloTap } from '../src/keys.mjs';

// A tiny SDK trace: each move gets 3 frames; `effect` decides what the game state does in them.
function trace(persona, moves) {
  const frames = [{ state: { x: 100, y: 200, vx: 0, vy: 0, onFloor: true, lever: false } }];
  const steps = moves.map((m, i) => {
    const start = frames.length;
    for (let f = 0; f < 3; f++) {
      const prev = frames.at(-1).state;
      const state = { ...prev, vx: m.hold?.length ? 180 : 0, vy: 0, onFloor: true };
      if (m.effect === 'jump') Object.assign(state, { vy: -400, onFloor: false });
      if (m.effect === 'lever') state.lever = true;
      frames.push({ state });
    }
    return { step: i + 1, move: { click: [], hold: m.hold ?? [], tap: m.tap ?? [], duration_ms: 300 }, before: { x: m.x ?? 100, y: 200 }, frames: [start, frames.length - 1], events: m.events ?? [] };
  });
  return { persona, steps, frames };
}

test('a key counts only when it was the only key tapped, with at most walking held', () => {
  assert.equal(soloTap({ tap: ['KeyZ'], hold: ['ArrowRight'] }), 'KeyZ');
  assert.equal(soloTap({ tap: ['Space', 'KeyZ'], hold: [] }), null);
  assert.equal(soloTap({ tap: ['KeyZ'], hold: ['Space'] }), null);
  assert.equal(soloTap({ tap: ['KeyZ'], hold: [], click: [{ x: 1, y: 1 }] }), null);
  assert.equal(keyName('KeyZ'), 'Z');
  assert.equal(keyName('Digit3'), '3');
  assert.equal(keyName('Space'), 'Space');
});

test('a key that never changes anything is measured as doing nothing, even when a jump happened with it', () => {
  const t = trace('newbie', [
    { hold: ['ArrowRight'] },
    { tap: ['KeyZ'], hold: ['ArrowRight'] },
    { tap: ['KeyZ'] },
    { tap: ['Space', 'KeyZ'], effect: 'jump' }, // says nothing about Z
    { tap: ['KeyZ'], events: ['death'] }, // a death is not an effect of the key
    { tap: ['Space'], effect: 'jump' },
  ]);
  const rows = keyEffects([t]);
  const z = rows.find((r) => r.key === 'KeyZ');
  const space = rows.find((r) => r.key === 'Space');
  assert.deepEqual([z.presses, z.effects, z.ghosts], [3, 0, ['newbie']]);
  assert.deepEqual([space.presses, space.effects], [1, 1]);
});

test('a change in the game state is an effect (a lever), and games without the SDK are not measured', () => {
  const t = trace('reader', [{ tap: ['KeyE'] }, { tap: ['KeyE'], effect: 'lever' }, { tap: ['KeyE'] }]);
  assert.deepEqual(
    keyEffects([t]).map((r) => [r.key, r.presses, r.effects]),
    [['KeyE', 3, 1]],
  );
  const pixelsOnly = { persona: 'reader', steps: t.steps, frames: t.frames.map(() => ({ file: 'f.jpg' })) };
  assert.deepEqual(keyEffects([pixelsOnly]), []);
});

test('a key that moves the character while held is never called dead, whatever a tap of it does', () => {
  // Spike Maze: tapping the up arrow barely moves you, holding it does. Without this, 2 clean runs flagged it.
  const t = trace('reader', [{ tap: ['ArrowUp'] }, { tap: ['ArrowUp'] }, { tap: ['ArrowUp'] }, { tap: ['Space'] }, { tap: ['Space'] }, { tap: ['Space'] }]);
  t.steps.push({ step: 7, move: { click: [], hold: ['ArrowUp'], tap: [], duration_ms: 400 }, before: { x: 100, y: 200 }, after: { x: 100, y: 150 }, frames: [1, 3], events: [] });
  const rows = keyEffects([t]);
  const up = rows.find((r) => r.key === 'ArrowUp');
  assert.equal(up.effects, 0);
  assert.equal(up.movesWhenHeld, true);
  const fact = keyFact(keyRowsNear(rows, new Set(['ArrowUp', 'Space'])));
  assert.match(fact, /Space never did anything/);
  assert.doesNotMatch(fact, /ArrowUp never/);
  assert.equal(keyRowsNear(rows, new Set(['ArrowUp'])), null);
});

test('the analyst hears about a dead key only near the spot, after 3 presses', () => {
  const ghosts = [
    trace('newbie', [{ tap: ['KeyZ'], x: 400 }, { tap: ['KeyZ'], x: 410 }, { tap: ['Space'], effect: 'jump', x: 420 }]),
    trace('impatient', [{ tap: ['KeyZ'], x: 405 }, { tap: ['Space'], effect: 'jump', x: 60 }]),
  ];
  const effects = keyEffects(ghosts);
  const near = keysTappedNear(ghosts, ['newbie', 'impatient'], { x: 400, y: 200 });
  assert.deepEqual([...near].sort(), ['KeyZ', 'Space']);
  const fact = keyFact(keyRowsNear(effects, near));
  assert.match(fact, /Z never did anything in 3 presses by 2 ghosts/);
  assert.match(fact, /Space did something in 2 of 2 presses/);
  // Far from where Z was pressed, or with only 2 presses, there is nothing to say.
  assert.equal(keyRowsNear(effects, keysTappedNear(ghosts, ['impatient'], { x: 60, y: 200 })), null);
  assert.equal(keyRowsNear(keyEffects([ghosts[0]]), near), null);
  assert.equal(keyFact(null), null);
});
