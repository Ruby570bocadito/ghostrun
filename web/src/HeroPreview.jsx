import { useEffect, useRef, useState } from 'react';
import { GhostShape } from './Ghost.jsx';

// The home page's opening: a real recorded playtest (scripts/make-hero.mjs builds web/public/hero/ from a run).
// One ghost plays and thinks out loud; every ghost's deaths pile up at the same gap; then the rules draw the box
// and the analyst's card rises. Everything shown is what the app recorded, nothing is staged.
const COLOR = { newbie: '#ffd166', speedrunner: '#4cc9f0', reader: '#80ed99', impatient: '#ff6b6b', completionist: '#c77dff' };
const HOLD_MS = 5200;

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function HeroPreview() {
  const [hero, setHero] = useState(null);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let off = false;
    fetch('/hero/hero.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => {
        if (off || !h) return;
        h.frames.forEach((f) => (new Image().src = f.src));
        setHero(h);
        if (reduceMotion()) {
          setI(h.frames.length - 1);
          setDone(true);
        }
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    if (!hero || reduceMotion()) return undefined;
    if (done) {
      timer.current = setTimeout(() => {
        setDone(false);
        setI(0);
      }, HOLD_MS);
    } else {
      timer.current = setTimeout(() => (i + 1 < hero.frames.length ? setI(i + 1) : setDone(true)), 1000 / hero.fps);
    }
    return () => clearTimeout(timer.current);
  }, [hero, i, done]);

  if (!hero) return <div className="hero-preview loading" aria-hidden="true" />;
  const f = hero.frames[done ? (hero.doneFrame ?? i) : i];
  const shown = done ? hero.marks.length : Math.round((hero.marks.length * i) / hero.frames.length);
  const box = hero.box;

  return (
    <figure className="hero-preview" aria-label="A real recorded playtest: the ghosts keep falling into the same gap, and Ghostrun marks it as a blocker">
      <div className="hp-bar">
        <span className="hp-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="hp-title">{hero.game}</span>
        <span className={`hp-pill ${done ? 'found' : ''}`}>{done ? 'Found' : '● Live playtest'}</span>
      </div>
      <div className="hp-screen">
        <img src={f.src} alt="" width="640" height="360" />
        <svg className="hp-over" viewBox="0 0 640 360" aria-hidden="true">
          {hero.marks.slice(0, shown).map((m, k) => (
            <path key={k} d={`M${m.x - f.cam - 5} ${m.y - 5}l10 10M${m.x - f.cam + 5} ${m.y - 5}l-10 10`} stroke={COLOR[m.persona]} strokeWidth="2.6" strokeLinecap="round" className="hp-x" />
          ))}
          {!done && (
            <g transform={`translate(${f.x - 22} ${f.y - 86}) scale(0.7)`}>
              <GhostShape persona={hero.persona} color={COLOR[hero.persona]} mood="think" />
            </g>
          )}
          {done && (
            <g className="hp-box">
              <rect x={box.x0 - f.cam} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx="8" pathLength="100" />
              <text x={box.x0 - f.cam + 10} y={box.y0 + 22}>
                Blocker · 4/4
              </text>
            </g>
          )}
        </svg>
        {!done && f.thought && (
          <p className="hp-thought" key={f.thought}>
            <b style={{ color: COLOR[hero.persona] }}>Newbie</b> {f.thought}
          </p>
        )}
        {done && (
          <div className="hp-card">
            <span className="badge blocker">F1 · Blocker</span>
            <b>{hero.card.title}</b>
            <span className="mono small">{hero.stat}</span>
            {hero.card.fix && (
              <span className="small">
                <em>Try this:</em> {hero.card.fix}
              </span>
            )}
          </div>
        )}
      </div>
      <figcaption className="small muted">A real recorded playtest, not a mock-up. Played by Ghostrun's AI ghosts on one of its test games.</figcaption>
    </figure>
  );
}
