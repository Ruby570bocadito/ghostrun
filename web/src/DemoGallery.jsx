import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Ghost } from './Ghost.jsx';
import { HeroPreview } from './HeroPreview.jsx';
import { HomeBands } from './HomeBands.jsx';
import { api } from './demo.js';
import { Item, Reveal, RiseWords, Stagger } from './fx.jsx';
import { COLOR } from './personas.js';
import { FEATURED_RUN, RUN_LOCALLY, scrollToSection } from './links.js';
import { describeRun as describe } from './words.js';

const FILTERS = [
  ['all', 'All playtests'],
  ['test', 'Our test games'],
  ['real', 'Real jam games'],
];
const KIND_LABEL = { test: 'Test game', real: 'Real jam game', error: 'Not a game' };

/** One recorded playtest: pointing at it plays a few frames of it, and fetches its report ahead of the click. */
function RunCard({ r }) {
  const [frame, setFrame] = useState(null);
  const timer = useRef(null);
  const warmed = useRef(false);
  const reduce = useReducedMotion();
  const { kind, name, credit } = describe(r);
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
  const tone = kind === 'error' ? 'none' : /^nothing/i.test(r.shows ?? '') ? 'good' : 'bad';
  return (
    <a className="demo-run" href={`#/run/${r.id}`} onPointerEnter={start} onPointerLeave={stop} onFocus={start} onBlur={stop}>
      <span className={`demo-strip ${kind}`}>
        <span>{KIND_LABEL[kind]}</span>
        {r.preview?.length > 0 && !reduce && (
          <span className="demo-play" aria-hidden="true">
            ▶ Preview
          </span>
        )}
      </span>
      <span className="demo-thumb">
        {kind === 'error' || !r.thumb ? (
          <span className="demo-thumb-empty">
            <Ghost mood="confused" size={56} still />
            <span>No game on this page</span>
          </span>
        ) : (
          <img src={frame ?? r.thumb} alt="" loading="lazy" decoding="async" />
        )}
      </span>
      <span className="demo-run-body">
        <span className="demo-name">{name}</span>
        {credit && <span className="demo-credit">{credit}</span>}
        <span className={`demo-result ${tone}`}>{r.shows}</span>
        <span className="demo-stats">
          {(r.stats ?? '').split(' · ').map((s) => (
            <span key={s}>{s}</span>
          ))}
        </span>
      </span>
    </a>
  );
}

function Gallery({ config, runs }) {
  const [filter, setFilter] = useState('all');
  const kinds = useMemo(() => runs.map((r) => describe(r).kind), [runs]);
  const counts = useMemo(() => ({ all: runs.length, test: kinds.filter((k) => k === 'test').length, real: kinds.filter((k) => k === 'real').length }), [runs, kinds]);
  const shown = filter === 'all' ? runs : runs.filter((_, k) => kinds[k] === filter);
  return (
    <section className="home-band" id="runs" aria-labelledby="runs-title">
      <Reveal className="band-head">
        <p className="eyebrow">Recorded playtests —</p>
        <h2 id="runs-title">Open any playtest to read its report</h2>
      </Reveal>
      <p className="demo-note" role="note">
        Each one was played by Ghostrun’s AI ghosts on {config?.recordedOn ?? 'the date shown'}, and its report is exactly what the app showed. <b>Test games</b> are small
        games we made, most with a flaw planted on purpose to check Ghostrun finds it; <b>real jam games</b> were made by other people for js13kGames. New playtests need
        the app running with an AI key:{' '}
        <a href={RUN_LOCALLY} target="_blank" rel="noreferrer">
          run it on your own game
        </a>
        .
      </p>
      {runs.length > 0 && (
        <div className="filters" role="group" aria-label="Show playtests">
          {FILTERS.filter(([id]) => id === 'all' || counts[id] > 0).map(([id, label]) => (
            <button key={id} type="button" className="filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} <span className="filter-n">{counts[id]}</span>
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
    </section>
  );
}

/** Home page of the static demo: a real playtest up front, the recorded playtests, and how to run your own. */
export function DemoGallery({ config }) {
  const runs = config?.demoRuns ?? [];
  const real = runs.filter((r) => describe(r).kind === 'real').length;
  const ghosts = ['newbie', 'speedrunner', 'reader', 'impatient', 'completionist'];

  return (
    <section className="summon">
      <div className="hero">
        <div className="hero-copy">
          <RiseWords as="h1" text="Who gets stuck in your game?" />
          <Reveal as="p" className="kicker" delay={0.3} y={8}>
            AI ghost players test your web game — and show where real players fail
          </Reveal>
          <Reveal as="p" className="lede" delay={0.38} y={10}>
            Ghosts with different personalities play a web game, think out loud, and come back with every place players get stuck, its replay and a fix to try.
          </Reveal>
          <Reveal delay={0.46} y={10}>
            <div className="hero-actions">
              <a className="btn-primary" href={`#/run/${FEATURED_RUN}`}>
                Watch a real playtest
              </a>
              {runs.length > 0 && (
                <button type="button" className="btn-ghost" onClick={() => scrollToSection('runs')}>
                  All {runs.length} playtests
                </button>
              )}
            </div>
            <div className="ghost-row" aria-hidden="true">
              {ghosts.map((p) => (
                <Ghost key={p} persona={p} color={COLOR[p]} size={44} />
              ))}
            </div>
            <ul className="hero-meta" aria-label="About this demo">
              <li>5 ghost personalities</li>
              {runs.length > 0 && <li>{runs.length} recorded playtests</li>}
              {real > 0 && <li>{real} real jam games</li>}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.25} y={16}>
          <HeroPreview />
        </Reveal>
      </div>

      <HomeBands gallery={<Gallery config={config} runs={runs} />} />
    </section>
  );
}
