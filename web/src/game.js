// How a game is named on screen: people recognise a game by its name, not by "localhost:5180/play/gap-run/?fault=gap".
import gapRun from '../../games/gap-run/faults.json';
import keyHunt from '../../games/key-hunt/faults.json';
import leverRoom from '../../games/lever-room/faults.json';
import readMe from '../../games/read-me/faults.json';
import spikeMaze from '../../games/spike-maze/faults.json';

const OURS = {
  'gap-run': { name: 'Gap Run', faults: gapRun },
  'key-hunt': { name: 'Key Hunt', faults: keyHunt },
  'lever-room': { name: 'Lever Room', faults: leverRoom },
  'read-me': { name: 'Read Me', faults: readMe },
  'spike-maze': { name: 'Spike Maze', faults: spikeMaze },
};
const titleCase = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

function parse(url) {
  try {
    const u = new URL(url);
    const slug = u.pathname.match(/\/play\/([\w-]+)\/?$/)?.[1];
    return { u, ours: slug && OURS[slug] ? OURS[slug] : null, fault: u.searchParams.get('fault') };
  } catch {
    return null;
  }
}

/** The game's name: ours by name, others from the last part of the address. */
export function gameName(url) {
  const p = parse(url);
  if (!p) return 'Your game';
  if (p.ours) return p.ours.name;
  const last = p.u.pathname.split('/').filter(Boolean).pop();
  return last && !/\.(html?|php)$/i.test(last) ? titleCase(last) : p.u.hostname;
}

/** One line under the name: what this game is (our test game, and which planted flaw) or where it lives. */
export function gameSource(url) {
  const p = parse(url);
  if (!p) return '';
  if (p.ours) {
    const label = p.fault && p.ours.faults[p.fault]?.label;
    return p.fault ? `Ghostrun test game · planted flaw: ${label ?? p.fault}` : 'Ghostrun test game · as designed';
  }
  if (LOCAL.test(p.u.hostname)) return 'A copy of the game served from this computer';
  return p.u.hostname + p.u.pathname.replace(/\/$/, '');
}
