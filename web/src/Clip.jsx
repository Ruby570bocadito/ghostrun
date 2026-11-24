import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useInView, useReducedMotion } from 'motion/react';
import { EASE } from './fx.jsx';

const SPEEDS = [1, 2, 0.5];
const time = (k, fps) => `${(k / fps).toFixed(1)} s`;

/**
 * Plays a sequence of frames like a short video, with a timeline that can be dragged or moved with the keyboard, a
 * speed control, ✕ where a death happened (marks: frame indices) and, under it, what the ghost was thinking at each
 * frame (captions). It pauses while it is off screen.
 */
export function Clip({ frames, fps = 10, label, autoPlay = true, captions = null, marks = [], who = null, color = 'var(--mint)' }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(autoPlay && !reduce);
  const [speed, setSpeed] = useState(1);
  const box = useRef(null);
  const bar = useRef(null);
  const visible = useInView(box);
  const last = Math.max(0, frames.length - 1);

  useEffect(() => {
    setI(0);
    for (const src of frames) new Image().src = src;
  }, [frames]);

  useEffect(() => {
    if (!playing || !visible || frames.length < 2) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % frames.length), 1000 / (fps * speed));
    return () => clearInterval(t);
  }, [playing, visible, frames.length, fps, speed]);

  if (!frames.length) return null;
  const seek = (clientX) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r) return;
    setPlaying(false);
    setI(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * last));
  };
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    let next = step ? Math.min(last, Math.max(0, i + step)) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      setPlaying((p) => !p);
      return;
    }
    if (next == null) return;
    e.preventDefault();
    setPlaying(false);
    setI(next);
  };
  const caption = captions?.[i] ?? null;
  const deadNow = marks.some((k) => i >= k && i <= k + 4);

  return (
    <figure className="clip" ref={box}>
      <div className="clip-screen">
        <img src={frames[i]} alt={label} decoding="async" />
        {deadNow && <span className="clip-dead" aria-hidden="true">✕</span>}
      </div>
      <figcaption>
        <button type="button" className="clip-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the replay' : 'Play the replay'}>
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
          className="clip-track"
          ref={bar}
          role="slider"
          tabIndex={0}
          aria-label={`${label}: timeline`}
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={i}
          aria-valuetext={`${time(i, fps)} of ${time(last, fps)}`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seek(e.clientX);
          }}
          onPointerMove={(e) => e.buttons === 1 && seek(e.clientX)}
        >
          <span className="clip-rail" />
          <span className="clip-fill" style={{ width: `${(i / Math.max(1, last)) * 100}%`, background: color }} />
          {marks.map((k) => (
            <span key={k} className="clip-mark" style={{ left: `${(k / Math.max(1, last)) * 100}%` }} title="Death" aria-hidden="true">
              ✕
            </span>
          ))}
          <span className="clip-knob" style={{ left: `${(i / Math.max(1, last)) * 100}%` }} />
        </div>
        <button type="button" className="clip-speed mono" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} aria-label={`Speed ${speed}×, change`}>
          {speed}×
        </button>
      </figcaption>
      {captions && (
        <div className="clip-caption" aria-live="off">
          <AnimatePresence mode="wait" initial={false}>
            <m.p key={caption ?? ''} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: EASE }}>
              {caption ? (
                <>
                  {who && <b className="clip-who" style={{ "--c": color }}>{who} planned: </b>}“{caption}”
                </>
              ) : (
                <span className="muted">…</span>
              )}
            </m.p>
          </AnimatePresence>
        </div>
      )}
    </figure>
  );
}
