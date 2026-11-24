// Which inputs a game can hear at all, read from its own event handlers (DevTools protocol, no AI).
// A game that moves on its own makes any input look as if it did something: on Big Champ and Coiner (js13k games
// played only with the mouse) the ghosts' input table said ArrowRight changed the screen 77 times out of 81, and three
// ghosts in four played Big Champ mostly with the keys (24 Nov). Neither game has a single keyboard handler, while
// SpaceTaxi and Backout have no mouse handler at all. A person sees at once that nothing of theirs moves; the ghosts
// only see the screen change, so they are told.

const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);
// The ghosts' mouse: moving it, pressing, releasing, clicking (a game aimed by moving the mouse hears it too).
const MOUSE_EVENTS = new Set(['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel', 'pointerdown', 'pointerup', 'pointermove']);

/** From the event types a page listens to: can it hear the keyboard, the mouse? */
export function hearingOf(types) {
  const all = [...new Set(types)];
  return { keys: all.some((t) => KEY_EVENTS.has(t)), mouse: all.some((t) => MOUSE_EVENTS.has(t)) };
}

/** An input as the ghosts name it: 'click' and 'drag' are the mouse, anything else is a key. */
export const isMouseInput = (input) => input === 'click' || input === 'drag';

/**
 * Whether a game cannot hear `input`, given what it hears: only when it hears exactly one of the keyboard and the mouse
 * (a game with neither may use touch or a gamepad, or keep its handlers where we cannot see them: no claim).
 */
export function cannotHear(hears, input) {
  if (!hears || hears.keys === hears.mouse) return false;
  return isMouseInput(input) ? !hears.mouse : !hears.keys;
}

/** What the ghost is told when a game hears only one of the keyboard and the mouse, or null. */
export function hearingNote(hears) {
  if (!hears || hears.keys === hears.mouse) return null;
  return hears.mouse
    ? 'This game has no keyboard handlers at all, so no key can do anything here: play it with the mouse (clicks and drags on the game).'
    : 'This game has no mouse handlers at all, so clicks and drags cannot do anything here: play it with the keys.';
}

/**
 * The event types a page listens to: on its window, and on its document and every element below it, through same-site
 * frames and shadow roots (one DevTools call each). Frames from another site run in their own process: each gets its
 * own session, and if one cannot be read the answer is null, so we never claim a game cannot hear what we could not check.
 */
export async function listenedTypes(page) {
  const context = page.context();
  const types = new Set();
  const read = async (target) => {
    const cdp = await context.newCDPSession(target);
    // The page's own script context in each frame of this process: a frame's window is only read from its own context.
    const contexts = [];
    cdp.on('Runtime.executionContextCreated', ({ context: c }) => {
      if (c.auxData?.isDefault) contexts.push(c.id);
    });
    try {
      await cdp.send('Runtime.enable'); // reports the contexts that already exist before it answers
      for (const contextId of contexts.length ? contexts : [undefined]) {
        for (const [expression, subtree] of [['window', false], ['document', true]]) {
          const { result } = await cdp.send('Runtime.evaluate', { expression, ...(contextId ? { contextId } : {}) });
          if (!result?.objectId) continue;
          const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, ...(subtree ? { depth: -1, pierce: true } : {}) });
          for (const l of listeners) types.add(l.type);
        }
      }
    } finally {
      await cdp.detach().catch(() => {});
    }
  };
  try {
    await read(page);
    const origin = (u) => {
      try {
        return new URL(u).origin;
      } catch {
        return null;
      }
    };
    const home = origin(page.url());
    for (const frame of page.frames()) {
      if (frame === page.mainFrame() || !/^https?:/.test(frame.url())) continue;
      try {
        await read(frame); // a frame from another site: its own process and session
      } catch {
        if (origin(frame.url()) !== home) return null; // not readable, and not covered by the page's own call
      }
    }
  } catch {
    return null;
  }
  return [...types];
}

/** { keys, mouse }: whether the game can hear the keyboard and the mouse, or null when it could not be read. */
export async function canHear(page) {
  const types = await listenedTypes(page);
  return types ? hearingOf(types) : null;
}
