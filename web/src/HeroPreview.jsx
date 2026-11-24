import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Ghost, GhostShape } from './Ghost.jsx';
import { EASE, STILL } from './fx.jsx';

// The home page's opening: a real recorded playtest (scripts/make-hero.mjs builds web/public/hero/ from a run).
// One ghost plays and thinks out loud; every ghost's deaths pile up at the same gap; then the rules draw the box
// and the analyst's card rises. Everything shown is what the app recorded, nothing is staged. It can be paused and
// scrubbed, the deaths are counted per ghost, and the four ghosts that played peek around the window.
const COLOR = { newbie: '#ffd166', speedrunner: '#4cc9f0', reader: '#80ed99', impatient: '#ff6b6b', completionist: '#c77dff' };
const NAME = { newbie: 'Newbie', speedrunner: 'Speedrunner', reader: 'Reader', impatient: 'Impatient', completionist: 'Completionist' };
const HOLD_MS = 5200;
// Where each ghost peeks from behind the window, and how much it follows the pointer (depth).
const PEEKS = [
  { persona: 'newbie', className: 'tl', depth: 10, rotate: -12 },
  { persona: 'speedrunner', className: 'tr', depth: 16, rotate: 10 },
  { persona: 'reader', className: 'bl', depth: 7, rotate: -6 },
  { persona: 'impatient', className: 'br', depth: 13, rotate: 8 },
];
const clock = (frames, fps) => `0:${String(Math.floor(frames / fps)).padStart(2, '0')}`;

/** A ghost peeking from behind the window: it drifts with the pointer and jolts when it dies. */
function Peek({ persona, className, depth, rotate, px, py, hit }) {
  const x = useTransform(px, (v) => v * depth);
  const y = useTransform(py, (v) => v * depth * 0.6);
  return (
    <m.span className={`hp-peek ${className}`} style={{ x, y, rotate }} aria-hidden="true">
      <m.span key={hit} initial={hit ? { scale: 1.18, rotate: -8 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 12 }} style={{ display: 'block' }}>
        <Ghost persona={persona} color={COLOR[persona]} size={58} mood={hit ? 'angry' : 'calm'} />
      </m.span>
    </m.span>
  );
}

export function HeroPreview() {
  const [hero, setHero] = useState(null);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(true);
  const reduce = useReducedMotion();
  const still = STILL || reduce;
  const stage = useRef(null);
  const track = useRef(null);
  const visible = useInView(stage, { margin: '0px 0px -15% 0px' });
  // The pointer over the hero, from -1 to 1, smoothed: the peeking ghosts follow it a little.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 120, damping: 18 });
  const py = useSpring(rawY, { stiffness: 120, damping: 18 });

  useEffect(() => {
    let off = false;
    fetch('/hero/hero.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => {
        if (off || !h) return;
        h.frames.forEach((f) => (new Image().src = f.src));
        setHero(h);
        if (still) {
          setI(h.frames.length - 1);
          setDone(true);
          setPlaying(false);
        }
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Plays while it is on screen and not paused; after the card, holds and starts again.
  useEffect(() => {
    if (!hero || !playing || !visible) return undefined;
    const t = done
      ? setTimeout(() => {
          setDone(false);
          setI(0);
        }, HOLD_MS)
      : setTimeout(() => (i + 1 < hero.frames.length ? setI(i + 1) : setDone(true)), 1000 / hero.fps);
    return () => clearTimeout(t);
  }, [hero, i, done, playing, visible]);

  const last = hero ? hero.frames.length - 1 : 0;
  const shown = hero ? (done ? hero.marks.length : Math.round((hero.marks.length * i) / hero.frames.length)) : 0;
  // Deaths so far, per ghost, and which ghost died last (it jolts).
  const counts = useMemo(() => {
    const c = {};
    for (const mk of hero?.marks.slice(0, shown) ?? []) c[mk.persona] = (c[mk.persona] ?? 0) + 1;
    return c;
  }, [hero, shown]);
  const lastHit = hero && shown ? hero.marks[shown - 1].persona : null;

  const seekTo = (clientX) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !hero) return;
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const next = Math.round(k * last);
    setPlaying(false);
    setI(next);
    setDone(next >= last);
  };
  const onKey = (e) => {
    if (!hero) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    let next = null;
    if (step) next = Math.min(last, Math.max(0, i + step));
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next == null) return;
    e.preventDefault();
    setPlaying(false);
    setI(next);
    setDone(next >= last);
  };
  const onPointerMove = (e) => {
    if (still) return;
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    rawX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    rawY.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  if (!hero) return <div className="hero-preview loading" aria-hidden="true" />;
  const f = hero.frames[done ? (hero.doneFrame ?? i) : i];
  const box = hero.box;
  const personas = [...new Set(hero.marks.map((mk) => mk.persona))];

  return (
    <figure
      className="hero-preview"
      ref={stage}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      aria-label="A real recorded playtest: the ghosts keep falling into the same gap, and Ghostrun marks it as a blocker"
    >
      <div className="hp-stage">
        {PEEKS.filter((p) => personas.includes(p.persona)).map((p) => (
          <Peek key={p.persona} {...p} px={px} py={py} hit={lastHit === p.persona && !done ? shown : 0} />
        ))}
        <div className="hp-frame">
          <div className="hp-bar">
            <span className="hp-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="hp-title">{hero.game}</span>
            <span className={`hp-pill ${done ? 'found' : ''}`}>{done ? 'Found' : playing ? '● Live playtest' : 'Paused'}</span>
          </div>
          <div className="hp-screen">
            <img src={f.src} alt="" width="640" height="360" />
            <svg className="hp-over" viewBox="0 0 640 360" aria-hidden="true">
              {hero.marks.slice(0, shown).map((mk, k) => (
                <path key={k} d={`M${mk.x - f.cam - 5} ${mk.y - 5}l10 10M${mk.x - f.cam + 5} ${mk.y - 5}l-10 10`} stroke={COLOR[mk.persona]} strokeWidth="2.6" strokeLinecap="round" className="hp-x" />
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
            <AnimatePresence>
              {!done && f.thought && (
                <m.p
                  className="hp-thought"
                  key={f.thought}
                  initial={still ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <b style={{ color: COLOR[hero.persona] }}>{NAME[hero.persona]}</b> {f.thought}
                </m.p>
              )}
            </AnimatePresence>
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
          <div className="hp-controls">
            <button
              type="button"
              className="hp-play"
              onClick={() => {
                if (done && !playing) {
                  setDone(false);
                  setI(0);
                }
                setPlaying((p) => !p);
              }}
              aria-label={playing ? 'Pause the playtest' : 'Play the playtest'}
            >
              {playing ? (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="2" y="1.5" width="3" height="9" rx="1" />
                  <rect x="7" y="1.5" width="3" height="9" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z" />
                </svg>
              )}
            </button>
            <div
              className="hp-track"
              ref={track}
              role="slider"
              tabIndex={0}
              aria-label="Playtest timeline"
              aria-valuemin={0}
              aria-valuemax={last}
              aria-valuenow={i}
              aria-valuetext={`${clock(i, hero.fps)} of ${clock(last, hero.fps)}, ${shown} deaths so far`}
              onKeyDown={onKey}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekTo(e.clientX);
              }}
              onPointerMove={(e) => e.buttons === 1 && seekTo(e.clientX)}
            >
              <span className="hp-rail" />
              {hero.marks.map((mk, k) => (
                <span key={k} className={`hp-tick ${k < shown ? 'on' : ''}`} style={{ left: `${((k + 1) / hero.marks.length) * 100}%`, '--c': COLOR[mk.persona] }} />
              ))}
              <span className="hp-fill" style={{ width: `${(i / last) * 100}%` }} />
              <span className="hp-knob" style={{ left: `${(i / last) * 100}%` }} />
            </div>
            <span className="hp-time mono" aria-hidden="true">
              {clock(i, hero.fps)}
            </span>
          </div>
        </div>
      </div>
      <div className="hp-deaths" aria-label="Deaths so far, per ghost">
        {personas.map((p) => (
          <span key={p} className="hp-death" style={{ '--c': COLOR[p] }}>
            <Ghost persona={p} color={COLOR[p]} size={18} still />
            <span className="sr-only">{NAME[p]}:</span>
            <m.b key={counts[p] ?? 0} initial={still || !counts[p] ? false : { scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
              ✕ {counts[p] ?? 0}
            </m.b>
          </span>
        ))}
        <span className="hp-deaths-note small muted">deaths at the same gap</span>
      </div>
      <figcaption className="small muted">A real recorded playtest, not a mock-up: drag the timeline or pause it. Played by Ghostrun's AI ghosts on one of its test games.</figcaption>
    </figure>
  );
}
