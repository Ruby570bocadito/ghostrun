import { useEffect, useMemo, useState } from 'react';
import { GhostIcon, OUTCOME_LABEL, moodFor } from './Ghost.jsx';
import { Heatmap, TYPE_LABEL } from './Heatmap.jsx';
import { Clip } from './Clip.jsx';

const CRITICAL = ['blocker', 'missed', 'stuck'];

function useTraces(runId, personaIds) {
  const [traces, setTraces] = useState([]);
  const key = personaIds.join(',');
  useEffect(() => {
    let cancelled = false;
    Promise.all(personaIds.map((p) => fetch(`/runs/${runId}/${p}/trace.json`).then((r) => (r.ok ? r.json() : null))))
      .then((list) => !cancelled && setTraces(list.filter(Boolean)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return traces;
}

function clipFrames(runId, trace, [from, to]) {
  if (!trace) return [];
  return trace.frames.slice(from, to + 1).map((f) => `/runs/${runId}/${trace.persona}/${f.file}`);
}

function statLine(f, report) {
  const n = `${f.ghosts.length}/${report.ghostsTotal} ghosts`;
  switch (f.type) {
    case 'blocker':
    case 'friction':
      return `${n} died here · ${f.count} deaths · ${f.passed.length}/${f.reached.length} got past`;
    case 'missed':
      return `Objective “${f.milestone}” reached by ${f.reachedBy.length}/${report.ghostsTotal} ghosts`;
    case 'stuck':
      return `${n} spent their last moves circling here`;
    case 'confusion':
      return `${n} said they were confused here (${f.count} times)`;
    default:
      return n;
  }
}

function provenance(f) {
  switch (f.type) {
    case 'blocker':
    case 'friction':
      return `Found from ${f.count} death events the game reported, no AI involved.`;
    case 'missed':
      return `Found from the game's objective events: ${f.ghosts.length} ghost(s) never triggered “${f.milestone}”. No AI involved.`;
    case 'stuck':
      return 'Found from where the ghosts spent their last moves, no AI involved.';
    case 'confusion':
      return "Found from the ghosts' own “confused” flags, grouped by position.";
    default:
      return '';
  }
}

function Finding({ f, card, report, runId, byPersona, personas, selected }) {
  const [who, setWho] = useState(f.evidence[0]?.persona);
  const ev = f.evidence.find((e) => e.persona === who) ?? f.evidence[0];
  const frames = useMemo(() => clipFrames(runId, byPersona[ev?.persona], ev?.clip ?? [0, 0]), [runId, byPersona, ev]);
  const extra = [
    f.stuckGhosts?.length ? `${f.stuckGhosts.length} ended their run stuck here` : null,
    f.confusedGhosts?.length ? `${f.confusedGhosts.length} said they were confused here` : null,
  ].filter(Boolean);
  return (
    <article id={`f-${f.id}`} className={`finding ${f.type} ${selected ? 'selected' : ''}`}>
      <div className="finding-main">
        <span className={`badge ${f.type}`}>{TYPE_LABEL[f.type] ?? f.type}</span>
        <h3>{card?.title ?? `${TYPE_LABEL[f.type]} around (${f.center.x}, ${f.center.y})`}</h3>
        <p className="stat-line mono">
          {statLine(f, report)}
          {extra.length ? ` · ${extra.join(' · ')}` : ''}
        </p>
        {card && (
          <dl className="card-fields">
            <dt>What happens</dt>
            <dd>{card.what_happens}</dd>
            <dt>Likely cause</dt>
            <dd>{card.likely_cause}</dd>
            <dt>Try this</dt>
            <dd>{card.suggested_fix}</dd>
          </dl>
        )}
        <ul className="quotes">
          {f.evidence
            .filter((e) => e.thought)
            .slice(0, 3)
            .map((e) => (
              <li key={e.persona}>
                <GhostIcon color={personas[e.persona]?.color} size={16} />
                <span>“{e.thought}”</span>
              </li>
            ))}
        </ul>
      </div>
      <div className="finding-clip">
        <div className="clip-tabs" role="tablist" aria-label="Whose replay">
          {f.evidence.map((e) => (
            <button
              key={e.persona}
              role="tab"
              aria-selected={e.persona === ev?.persona}
              className={e.persona === ev?.persona ? 'on' : ''}
              style={{ '--c': personas[e.persona]?.color }}
              onClick={() => setWho(e.persona)}
            >
              <GhostIcon color={personas[e.persona]?.color} size={14} /> {personas[e.persona]?.name.replace('The ', '')}
            </button>
          ))}
        </div>
        <Clip frames={frames} label={`Replay of ${personas[ev?.persona]?.name} for ${f.id}`} />
      </div>
      <p className="provenance">
        {provenance(f)} {card ? `Explanation written by ${card.model} from the ghosts' words and the screen.` : ''}
      </p>
    </article>
  );
}

export function Report({ run, runId, personas, onHome, onRerun }) {
  const report = run.report;
  const findings = report.findings ?? report.hotspots;
  const personaIds = report.ghosts.map((g) => g.persona);
  const traces = useTraces(runId, personaIds);
  const byPersona = useMemo(() => Object.fromEntries(traces.map((t) => [t.persona, t])), [traces]);
  const [selected, setSelected] = useState(findings[0]?.id ?? null);
  const [rerunError, setRerunError] = useState(null);
  const url = report.config?.url ?? '';
  const target = url ? new URL(url) : null;
  const host = target ? target.host + target.pathname + target.search : '';

  const critical = findings.filter((f) => CRITICAL.includes(f.type) && f.severity === 'high').length;
  const minor = findings.length - critical;
  const finished = report.ghosts.filter((g) => g.outcome === 'won').length;

  const select = (id) => {
    setSelected(id);
    document.getElementById(`f-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const rerun = async () => {
    setRerunError(null);
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, personas: report.config.personas, steps: report.config.steps }),
    });
    const body = await res.json();
    if (res.ok) onRerun(body.id);
    else setRerunError(body.message);
  };

  if (report.failure) {
    return (
      <section className="panel center">
        <h2>The ghosts could not play this game</h2>
        <p className="muted">{report.failure.message}</p>
        <p className="muted small">Check that the link opens a playable web game (HTML5 canvas).</p>
        <button className="btn-primary" onClick={onHome}>
          Try another link
        </button>
      </section>
    );
  }

  return (
    <section className="report">
      <div className="run-bar">
        <div>
          <p className="eyebrow">Playtest report</p>
          <h2 className="mono run-url">{host}</h2>
        </div>
        <div className="run-bar-right">
          <button className="btn-ghost" onClick={onHome}>
            New game
          </button>
          <button className="btn-primary" onClick={rerun}>
            Re-run ghosts
          </button>
        </div>
      </div>
      {rerunError && <p className="form-error">{rerunError}</p>}

      <div className="summary">
        <div className={`stat ${critical ? 'bad' : 'good'}`}>
          <b>{critical}</b>
          <span>critical issue{critical === 1 ? '' : 's'}</span>
        </div>
        <div className="stat">
          <b>{minor}</b>
          <span>other finding{minor === 1 ? '' : 's'}</span>
        </div>
        <div className="stat">
          <b>
            {finished}/{report.ghostsTotal}
          </b>
          <span>ghosts finished</span>
        </div>
        <div className="stat">
          <b>{report.quits.length}</b>
          <span>quit</span>
        </div>
        <div className="stat subtle">
          <b className="mono">{Math.round(report.realMs / 1000)}s</b>
          <span>to playtest</span>
        </div>
        <div className="stat subtle">
          <b className="mono">${report.cost.total.toFixed(3)}</b>
          <span>AI cost</span>
        </div>
      </div>

      {report.milestones?.length > 0 && (
        <ol className="milestones">
          {report.milestones.map((m) => (
            <li key={m.name} className={m.reachedBy.length ? '' : 'none'}>
              <span className="mono">{m.name}</span>
              <b>
                {m.reachedBy.length}/{report.ghostsTotal}
              </b>
            </li>
          ))}
          <li className={finished ? '' : 'none'}>
            <span className="mono">finish</span>
            <b>
              {finished}/{report.ghostsTotal}
            </b>
          </li>
        </ol>
      )}

      {report.hasPositions ? (
        <div className="heat-wrap">
          <Heatmap runId={runId} report={report} traces={traces} personas={personas} selected={selected} onSelect={select} />
          <p className="legend small muted">
            Level rebuilt from the ghosts' frames · red glow = where ghosts spent time · ✕ = deaths (ghost color) · click a box to see its replay
          </p>
        </div>
      ) : (
        <p className="muted">This game does not report positions, so findings are shown without a level map.</p>
      )}

      <div className="findings">
        {findings.length === 0 && <p className="panel">No findings: no place where ghosts died repeatedly, got stuck or got confused.</p>}
        {findings.map((f) => (
          <Finding
            key={f.id}
            f={f}
            card={report.cards?.find((c) => c.hotspot === f.id)}
            report={report}
            runId={runId}
            byPersona={byPersona}
            personas={personas}
            selected={selected === f.id}
          />
        ))}
        {report.quits.map((q) => (
          <article key={q.persona} className="finding quit">
            <div className="finding-main">
              <span className="badge quit">Quit</span>
              <h3>
                {personas[q.persona]?.name} gave up at move {q.step}
              </h3>
              <ul className="quotes">
                <li>
                  <GhostIcon color={personas[q.persona]?.color} size={16} mood="angry" />
                  <span>“{q.thought}”</span>
                </li>
              </ul>
            </div>
            <div className="finding-clip">
              <Clip frames={clipFrames(runId, byPersona[q.persona], [Math.max(0, q.clip[0] - 10), q.clip[1]])} label={`${personas[q.persona]?.name} quitting`} />
            </div>
          </article>
        ))}
      </div>

      <h3 className="section-title">The ghosts</h3>
      <div className="roster">
        {report.ghosts.map((g) => {
          const p = personas[g.persona] ?? { name: g.persona, color: '#9bf6ec' };
          const last = byPersona[g.persona]?.steps.at(-1)?.thought;
          return (
            <div key={g.persona} className="roster-row" style={{ '--c': p.color }}>
              <GhostIcon color={p.color} size={26} mood={moodFor(g.outcome)} />
              <div className="roster-name">
                <b>{p.name}</b>
                <span className={`pill pill-${g.outcome}`}>{OUTCOME_LABEL[g.outcome] ?? g.outcome}</span>
              </div>
              <span className="progress wide" aria-label={`Progress ${Math.round((g.progress ?? 0) * 100)}%`}>
                <span style={{ width: `${(g.progress ?? 0) * 100}%` }} />
              </span>
              <span className="mono small">
                ✕ {g.deaths} · {g.steps} moves
              </span>
              <em className="roster-quote">{g.error ? g.error.message : last ? `“${last}”` : ''}</em>
            </div>
          );
        })}
      </div>

      <p className="method small muted">
        How this was made: each ghost played in its own browser with the game clock frozen while it thought ({report.ghosts[0]?.model}). Deaths, objectives and positions
        come from the game; findings are grouped by position without AI. A blocker is a spot no ghost that reached it got past. The AI only writes the explanation of each
        finding.
      </p>
    </section>
  );
}
