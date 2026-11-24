import { useEffect, useState } from 'react';
import { gameName, gameSource } from './game.js';
import { Ghost, GhostSprite, OUTCOME_LABEL, moodFor } from './Ghost.jsx';

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
      {rows.map(([k, r]) => {
        const works = r.changed / r.used >= 0.5;
        return (
          <span key={k} className={works ? 'works' : 'dead'} aria-label={`${k}: the screen answered ${r.changed} of ${r.used} times`}>
            {inputLabel(k)}
            {works ? '✓' : '✗'}
          </span>
        );
      })}
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
        {stamp && (
          <span className={`tile-stamp stamp-${g.status}`}>
            {stamp}
            {g.status === 'quit' && g.steps ? ` · move ${g.steps}` : ''}
          </span>
        )}
      </div>
      <p className={`thought ${g.debrief ? 'after' : ''}`}>
        {g.debrief ? (
          <>
            <span className="after-label">After playing:</span> “{g.debrief.stopped_me}”
          </>
        ) : g.thought ? (
          `“${g.thought}”`
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

/** Newest first; a ghost dying again and again in a row is one line ("died ×9") with its latest thought. */
function groupLog(log) {
  const out = [];
  for (const l of [...log].reverse()) {
    const last = out.at(-1);
    if (last && l.kind === 'death' && last.kind === 'death' && last.ghost === l.ghost) last.n += 1;
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
        <h2 className="report-title">{gameName(run.config.url)}</h2>
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
    return (
      <section className="panel center state-panel">
        <span className="state-art"><Ghost mood="dead" size={120} /></span>
        <h2>{run.failure?.message?.startsWith('Cancelled') ? 'Playtest cancelled' : 'The ghosts could not play this game'}</h2>
        <p className="muted">{run.failure?.message}</p>
        <button className="btn-primary" onClick={onHome}>
          Try another link
        </button>
      </section>
    );
  }

  return (
    <section className="haunting">
      <div className="run-bar">
        <div>
          <p className="eyebrow">Live playtest</p>
          <h2 className="report-title">{run.config ? gameName(run.config.url) : 'Connecting…'}</h2>
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
                <li key={`${l.at}-${i}`} className={`log-${l.kind}`}>
                  <span className="log-icon" style={{ color: p?.color }}>
                    {LOG_ICON[l.kind]}
                  </span>
                  <span>
                    <b>{p?.name ?? l.ghost}</b> {l.kind === 'death' ? (l.n > 1 ? `died ×${l.n}` : 'died') : l.kind === 'win' ? 'finished!' : l.kind === 'quit' ? 'quit the game' : l.kind === 'confused' ? 'is confused' : l.kind === 'autopilot' ? 'autopilot:' : ''}
                    {l.text && <em> “{l.text}”</em>}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
      {run.status === 'analyzing' && <div className="analyzing-banner">Grouping deaths into hotspots and writing the findings…</div>}
    </section>
  );
}
