import { useEffect, useState } from 'react';
import { GhostIcon, OUTCOME_LABEL, moodFor } from './Ghost.jsx';

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

function GhostTile({ runId, g, p }) {
  const progress = g.x != null && g.worldW ? Math.min(1, g.x / g.worldW) : 0;
  return (
    <article className={`tile status-${g.status}`} style={{ '--c': p.color }}>
      <header className="tile-head">
        <GhostIcon color={p.color} size={24} mood={moodFor(g.status)} />
        <b>{p.name}</b>
        <span className={`pill pill-${g.status}`}>{OUTCOME_LABEL[g.status] ?? g.status}</span>
      </header>
      <div className="screen">
        {g.frame ? <img src={`/runs/${runId}/${g.frame}`} alt={`What ${p.name} sees`} decoding="async" /> : <div className="screen-empty">Loading the game…</div>}
        {g.confused && g.status === 'playing' && <span className="screen-badge">confused</span>}
      </div>
      <p className="thought">{g.thought ? `“${g.thought}”` : g.status === 'error' ? g.error?.message : '…'}</p>
      <footer className="tile-foot mono">
        <span>move {g.steps}</span>
        <span className={g.deaths ? 'deaths' : ''}>✕ {g.deaths}</span>
        <span className="progress" aria-label={`Level progress ${Math.round(progress * 100)}%`}>
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      </footer>
    </article>
  );
}

const LOG_ICON = { death: '✕', win: '⚑', quit: '⏏', confused: '?', fallback: '↻' };

export function Haunting({ run, runId, personas, onHome }) {
  const stop = () => fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
  const target = run.config ? new URL(run.config.url) : null;
  const host = target ? target.host + target.pathname + target.search : '';
  const playing = run.order.filter((id) => run.ghosts[id]?.status === 'playing').length;

  if (run.status === 'queued') {
    return (
      <section className="panel center">
        <p className="eyebrow">Waiting for your turn</p>
        <h2 className="mono run-url">{host}</h2>
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
      <section className="panel center">
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
          <p className="eyebrow">Haunting</p>
          <h2 className="mono run-url">{host || 'Connecting…'}</h2>
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
            <GhostTile key={id} runId={runId} g={run.ghosts[id] ?? { status: 'waiting' }} p={personas[id] ?? { id, name: id, color: '#9bf6ec' }} />
          ))}
        </div>
        <aside className="log" aria-live="polite">
          <h3>What's happening</h3>
          {run.log.length === 0 && <p className="muted small">Deaths, quits and confusion will show up here.</p>}
          <ol>
            {[...run.log].reverse().map((l, i) => {
              const p = personas[l.ghost];
              return (
                <li key={`${l.at}-${i}`} className={`log-${l.kind}`}>
                  <span className="log-icon" style={{ color: p?.color }}>
                    {LOG_ICON[l.kind]}
                  </span>
                  <span>
                    <b>{p?.name ?? l.ghost}</b> {l.kind === 'death' ? 'died' : l.kind === 'win' ? 'finished!' : l.kind === 'quit' ? 'quit the game' : l.kind === 'confused' ? 'is confused' : ''}
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
