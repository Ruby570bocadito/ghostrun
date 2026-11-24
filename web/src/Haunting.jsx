import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { gameName, gameSource } from './game.js';
import { Ghost, GhostSprite, OUTCOME_LABEL, moodFor } from './Ghost.jsx';
import { EASE, STILL } from './fx.jsx';
import { FailurePanel } from './Failure.jsx';
import { DEMO } from './demo.js';

/** A ghost's new thought types itself out, quickly (at once for people who ask for less motion). */
function TypeText({ text }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(text.length);
  const prev = useRef(text);
  useEffect(() => {
    if (text === prev.current) return undefined;
    prev.current = text;
    if (reduce || STILL) {
      setN(text.length);
      return undefined;
    }
    setN(0);
    const ms = Math.min(700, text.length * 14);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(text.length * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduce]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {n < text.length && <span className="caret" />}
      </span>
    </>
  );
}

/** Game time played of the total, as a ring. */
function Ring({ value, label }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 20 20" role="img" aria-label={label}>
      <circle cx="10" cy="10" r={r} className="ring-bg" />
      <circle cx="10" cy="10" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} />
    </svg>
  );
}

function Elapsed({ from, to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (to) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [to]);
  if (!from) return null;
  const s = Math.max(0, Math.round(((to ?? now) - from) / 1000));
  return <span className="mono">{`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`}</span>;
}

const STAMP = { won: 'Cleared!', quit: 'Quit', saturated: 'Seen enough', out_of_steps: 'Out of moves', time_up: 'Time up', too_slow: 'Too slow', error: 'Error', stopped: 'Stopped' };

const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Games without the SDK report no deaths or position: there the tile shows what the ghost has learned about the controls,
// the inputs that made the screen answer (✓) and the ones that did nothing (✗), most used first.
const INPUT_LABEL = { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Enter: 'Enter', Escape: 'Esc', Backspace: '⌫', click: 'click', drag: 'drag' };
const inputLabel = (k) => INPUT_LABEL[k] ?? k.replace(/^Key(?=[A-Z]$)/, '').replace(/^Digit(?=\d$)/, '');
function LearnedInputs({ inputs }) {
  const rows = Object.entries(inputs)
    .filter(([, r]) => r.used > 0)
    .sort((a, b) => b[1].used - a[1].used)
    .slice(0, 5);
  if (!rows.length) return <span className="tile-inputs muted">trying the controls…</span>;
  return (
    <span className="tile-inputs" title="What this ghost has learned about the controls: inputs that made the screen answer (✓) and inputs that did nothing (✗)">
      <AnimatePresence initial={false}>
        {rows.map(([k, r]) => {
          const works = r.changed / r.used >= 0.5;
          return (
            <m.span
              key={k}
              className={works ? 'works' : 'dead'}
              aria-label={`${k}: the screen answered ${r.changed} of ${r.used} times`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            >
              {inputLabel(k)}
              {works ? '✓' : '✗'}
            </m.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function GhostTile({ runId, g, p, viewport, playSeconds }) {
  const progress = g.x != null && g.worldW ? Math.min(1, g.x / g.worldW) : 0;
  // Every tile shows the same game, so the ghost floats over the character it plays (where the game or the ghost says it is).
  const at = Number.isFinite(g.sx) && Number.isFinite(g.sy) ? { x: g.sx, y: g.sy } : Number.isFinite(g.px) && Number.isFinite(g.py) ? { x: g.px, y: g.py } : null;
  const vw = viewport?.width ?? 640;
  const vh = viewport?.height ?? 360;
  const stamp = STAMP[g.status];
  return (
    <article className={`tile status-${g.status}`} style={{ '--c': p.color }}>
      <header className="tile-head">
        <GhostSprite persona={p.id} color={p.color} size={34} mood={moodFor(g.status)} />
        <b>{p.name}</b>
        {playSeconds > 0 && <Ring value={(g.t ?? 0) / (playSeconds * 1000)} label={`${clock(g.t ?? 0)} played of ${clock(playSeconds * 1000)}`} />}
        <span className={`pill pill-${g.status}`}>{OUTCOME_LABEL[g.status] ?? g.status}</span>
      </header>
      <div className="screen">
        {g.frame ? <img src={`/runs/${runId}/${g.frame}`} alt={`What ${p.name} sees`} decoding="async" /> : <div className="screen-empty">Loading the game…</div>}
        {g.confused && g.status === 'playing' && <span className="screen-badge">confused</span>}
        {at && g.frame && g.status === 'playing' && (
          <span className="tile-ghost" style={{ left: `${(at.x / vw) * 100}%`, top: `${(at.y / vh) * 100}%` }} aria-hidden="true">
            <GhostSprite persona={p.id} color={p.color} size={30} />
          </span>
        )}
        <AnimatePresence>
          {g.deaths > 0 && g.status === 'playing' && (
            <m.span
              key={g.deaths}
              className="tile-death"
              style={at ? { left: `${(at.x / vw) * 100}%`, top: `${(at.y / vh) * 100}%` } : undefined}
              initial={{ opacity: 0, scale: 2.2 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [2.2, 1, 1, 1] }}
              transition={{ duration: 1.1, times: [0, 0.18, 0.7, 1], ease: EASE }}
              aria-hidden="true"
            >
              ✕
            </m.span>
          )}
        </AnimatePresence>
        {stamp && (
          <m.span
            className={`tile-stamp stamp-${g.status}`}
            initial={STILL ? false : { opacity: 0, scale: 1.6, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 18 }}
          >
            {stamp}
            {g.status === 'quit' && g.steps ? ` · move ${g.steps}` : ''}
          </m.span>
        )}
      </div>
      <p className={`thought ${g.debrief ? 'after' : ''}`}>
        {g.debrief ? (
          <>
            <span className="after-label">After playing:</span> “{g.debrief.stopped_me}”
          </>
        ) : g.thought ? (
          <>
            “<TypeText text={g.thought} />”
          </>
        ) : g.status === 'error' ? (
          g.error?.message
        ) : (
          '…'
        )}
      </p>
      <footer className="tile-foot mono">
        <span title="Game time this ghost has played, of its total">{playSeconds ? `${clock(g.t ?? 0)} / ${clock(playSeconds * 1000)}` : `move ${g.steps}`}</span>
        {g.inputs ? (
          <LearnedInputs inputs={g.inputs} />
        ) : (
          <>
            <span className={g.deaths ? 'deaths' : ''}>✕ {g.deaths}</span>
            <span className="progress" role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span style={{ width: `${progress * 100}%` }} />
            </span>
          </>
        )}
      </footer>
    </article>
  );
}

/** Newest first; a ghost dying again and again is one line ("died ×9") with its latest thought, also when other ghosts'
 * lines come in between (four ghosts dying at the same gap filled the feed with the same line). */
function groupLog(log) {
  const out = [];
  for (const l of [...log].reverse()) {
    const near = l.kind === 'death' ? out.slice(-4).find((o) => o.kind === 'death' && o.ghost === l.ghost) : null;
    if (near) near.n += 1;
    else out.push({ ...l, n: 1 });
  }
  return out;
}

const LOG_ICON = { death: '✕', win: '⚑', quit: '⏏', confused: '?', fallback: '↻', exit: '»', autopilot: '▸' };

export function Haunting({ run, runId, personas, onHome }) {
  const stop = () => fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
  const playing = run.order.filter((id) => run.ghosts[id]?.status === 'playing').length;

  if (run.status === 'queued') {
    return (
      <section className="panel center">
        <p className="eyebrow">Waiting for your turn</p>
        <h1 className="report-title">{gameName(run.config.url)}</h1>
        <p className="muted">
          {run.position === 1 ? 'One playtest is ahead of yours.' : `${run.position} playtests are ahead of yours.`} The ghosts play one game at a time; yours starts by itself.
        </p>
        <button className="btn-ghost" onClick={stop}>
          Cancel
        </button>
      </section>
    );
  }

  if (run.status === 'failed' && !run.report) {
    const message = run.failure?.message ?? '';
    return (
      <FailurePanel
        title={run.failure?.kind === 'not_found' ? 'No playtest here' : message.startsWith('Cancelled') ? 'Playtest cancelled' : 'The ghosts could not play this game'}
        message={message}
        action={run.failure?.kind === 'not_found' ? (DEMO ? 'See all playtests' : 'Start a playtest') : 'Try another link'}
        onAction={onHome}
      />
    );
  }

  return (
    <section className="haunting">
      <div className="run-bar">
        <div>
          <p className="eyebrow live-eyebrow">
            {run.status === 'running' && <span className="live-dot" aria-hidden="true" />}
            Live playtest
          </p>
          <h1 className="report-title">{run.config ? gameName(run.config.url) : 'Connecting…'}</h1>
          {run.config && <p className="run-url small">{gameSource(run.config.url)}</p>}
        </div>
        <div className="run-bar-right">
          <span className="muted">
            {run.status === 'analyzing' ? 'The analyst is reading the evidence…' : `${playing} ghost${playing === 1 ? '' : 's'} playing`} · <Elapsed from={run.startedAt} to={run.finishedAt} />
          </span>
          {run.status === 'running' && (
            <button className="btn-ghost" onClick={stop}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="haunt-layout">
        <div className={`tiles n${run.order.length}`}>
          {run.order.map((id) => (
            <GhostTile key={id} runId={runId} g={run.ghosts[id] ?? { status: 'waiting' }} p={personas[id] ?? { id, name: id, color: '#9bf6ec' }} viewport={run.config?.viewport} playSeconds={run.config?.playSeconds} />
          ))}
        </div>
        <aside className="log" aria-live="polite">
          <h3>What's happening</h3>
          {run.log.length === 0 && <p className="muted small">Deaths, quits and confusion will show up here.</p>}
          <ol>
            {groupLog(run.log).map((l, i) => {
              const p = personas[l.ghost];
              return (
                <m.li
                  key={`${l.at}-${l.ghost}-${l.kind}-${l.step ?? ''}`}
                  className={`log-${l.kind}`}
                  initial={STILL ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <span className="log-icon" style={{ '--c': p?.color }} aria-hidden="true">
                    {LOG_ICON[l.kind]}
                  </span>
                  <span>
                    <b>{p?.name ?? l.ghost}</b> {l.kind === 'death' ? (l.n > 1 ? `died ×${l.n}` : 'died') : l.kind === 'win' ? 'finished!' : l.kind === 'quit' ? 'quit the game' : l.kind === 'confused' ? 'is confused' : l.kind === 'autopilot' ? 'autopilot:' : ''}
                    {l.text && <em> “{l.text}”</em>}
                  </span>
                </m.li>
              );
            })}
          </ol>
        </aside>
      </div>
      {run.status === 'analyzing' && (
        <m.div className="analyzing-banner" initial={STILL ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} role="status">
          <span className="analyzing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Grouping deaths into hotspots and writing the findings…
        </m.div>
      )}
    </section>
  );
}
