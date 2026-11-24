import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { HeroPreview } from './HeroPreview.jsx';
import { HomeBands } from './HomeBands.jsx';
import { api } from './demo.js';
import { Item, Reveal, RiseWords, Stagger } from './fx.jsx';

const REPO = 'https://github.com/Ruby570bocadito/ghostrun';
// Exported demos say which kind each playtest is (scripts/export-demo.mjs); older exports only have the title.
const kindOf = (r) => r.kind ?? (/real jam game/i.test(r.title) ? 'real' : 'test');
const FILTERS = [
  ['all', 'All playtests'],
  ['test', 'Our test games'],
  ['real', 'Real jam games'],
];

/** One recorded playtest: pointing at it plays a few frames of it, and fetches its report ahead of the click. */
function RunCard({ r }) {
  const [frame, setFrame] = useState(null);
  const timer = useRef(null);
  const warmed = useRef(false);
  const reduce = useReducedMotion();
  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
    setFrame(null);
  };
  const start = () => {
    if (!warmed.current) {
      warmed.current = true;
      fetch(api(`/api/runs/${r.id}`)).catch(() => {});
      for (const src of r.preview ?? []) new Image().src = src;
    }
    if (reduce || !r.preview?.length || timer.current) return;
    let k = 0;
    timer.current = setInterval(() => setFrame(r.preview[k++ % r.preview.length]), 240);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  // The light follows the pointer across the card.
  const spot = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - b.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - b.top}px`);
  };
  const kind = kindOf(r);
  return (
    <a className="demo-run" href={`#/run/${r.id}`} onPointerEnter={start} onPointerLeave={stop} onFocus={start} onBlur={stop} onPointerMove={spot}>
      <span className="demo-thumb">
        {r.thumb ? <img src={frame ?? r.thumb} alt="" loading="lazy" decoding="async" /> : <span className="demo-thumb-empty" />}
        <span className={`demo-kind ${kind}`}>{kind === 'real' ? 'Real jam game' : 'Test game'}</span>
        {r.preview?.length > 0 && !reduce && (
          <span className="demo-play" aria-hidden="true">
            ▶ Playing
          </span>
        )}
      </span>
      <span className="demo-run-body">
        <b>{r.title}</b>
        <span className="muted">{r.shows}</span>
        <span className="mono small">{r.stats}</span>
      </span>
    </a>
  );
}

/** Home page of the static demo: the recorded playtests, and how to run your own. */
export function DemoGallery({ config }) {
  const runs = config?.demoRuns ?? [];
  const [filter, setFilter] = useState('all');
  const counts = useMemo(() => ({ all: runs.length, test: runs.filter((r) => kindOf(r) === 'test').length, real: runs.filter((r) => kindOf(r) === 'real').length }), [runs]);
  const shown = filter === 'all' ? runs : runs.filter((r) => kindOf(r) === filter);

  return (
    <section className="summon">
      <div className="summon-hero">
        <RiseWords as="h1" text="Who gets stuck in your game?" />
        <Reveal as="p" className="lede" delay={0.35} y={10}>
          AI ghosts with different personalities play a web game, think out loud, and show you exactly where players will get stuck, before the deadline.
        </Reveal>
        <Reveal delay={0.45} y={16}>
          <HeroPreview />
        </Reveal>
      </div>

      <Reveal className="demo-note" role="note">
        <b>This is the free demo: real playtests, recorded.</b> Each one below was played by Ghostrun's AI ghosts on {config?.recordedOn ?? 'the date shown'}, and
        its report is exactly what the app showed. New playtests need the app running with an AI key, so they are not possible here.{' '}
        <a href={`${REPO}#run-it-locally`} target="_blank" rel="noreferrer">
          Run it on your own game
        </a>
        .
      </Reveal>

      {runs.length > 0 && (
        <div className="filters" role="group" aria-label="Show playtests">
          {FILTERS.filter(([id]) => id === 'all' || counts[id] > 0).map(([id, label]) => (
            <button key={id} type="button" className="filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} <span className="filter-n mono">{counts[id]}</span>
            </button>
          ))}
        </div>
      )}

      <Stagger key={filter} as="ul" className="demo-runs">
        {shown.map((r) => (
          <Item key={r.id}>
            <RunCard r={r} />
          </Item>
        ))}
      </Stagger>

      <HomeBands />
    </section>
  );
}
