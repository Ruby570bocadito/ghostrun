import { useEffect, useMemo, useState } from 'react';
import { Ghost, GhostIcon, GhostSprite, OUTCOME_LABEL, moodFor } from './Ghost.jsx';
import { Heatmap, TYPE_LABEL } from './Heatmap.jsx';
import { Clip } from './Clip.jsx';
import { DEMO } from './demo.js';
import { gameName, gameSource } from './game.js';
import { buildIssues } from './issues.js';
import { Compare, useBefore, diffFindings } from './Compare.jsx';


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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : /s$/.test(word) ? 'es' : 's'}`;
// "KeyZ" → "Z", as the game's own instructions name it.
const keyLabel = (k) => k.replace(/^Key(?=[A-Z]$)/, '').replace(/^Digit(?=\d$)/, '');
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function statLine(f, report) {
  const n = `${f.ghosts.length}/${report.ghostsTotal} ghosts`;
  switch (f.type) {
    case 'blocker':
    case 'friction':
      return `${n} died here · ${plural(f.count, 'death')} · ${f.passed.length}/${f.reached.length} that reached it got past this spot`;
    case 'missed':
      return `Objective “${f.milestone}” reached by ${f.reachedBy.length}/${report.ghostsTotal} ghosts`;
    case 'stuck':
      return `${n} spent their last moves circling here`;
    case 'confusion':
      return `${n} said they were confused here (${f.count} times)`;
    case 'hard_to_see':
      return `“${f.milestone}” has a contrast of ${f.contrast}:1 against its background (people need at least 3:1 to notice it, per WCAG) · ${f.reachedBy.length}/${report.ghostsTotal} AI ghosts found it anyway`;
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
    case 'hard_to_see':
      return 'Measured on the screen: the contrast of the objective against what surrounds it, with the WCAG formula. No AI involved.';
    default:
      return '';
  }
}

function Finding({ f, card, report, runId, byPersona, personas, selected, onHover = () => {}, also = [], consequences = [] }) {
  const [who, setWho] = useState(f.evidence[0]?.persona);
  const ev = f.evidence.find((e) => e.persona === who) ?? f.evidence[0];
  const frames = useMemo(() => clipFrames(runId, byPersona[ev?.persona], ev?.clip ?? [0, 0]), [runId, byPersona, ev]);
  const extra = [
    f.stuckGhosts?.length ? `${f.stuckGhosts.length} ended their run stuck here` : null,
    f.confusedGhosts?.length ? `${f.confusedGhosts.length} said they were confused here` : null,
    f.type !== 'hard_to_see' && f.contrast ? `measured contrast ${f.contrast}:1 (people need at least 3:1)` : null,
    // Measured from the game (src/keys.mjs): a key tapped here that never did anything.
    ...(f.keys ?? []).filter((k) => k.effects === 0 && k.presses >= 3 && !k.movesWhenHeld).map((k) => `${keyLabel(k.key)} did nothing in ${plural(k.presses, 'press')}`),
  ].filter(Boolean);
  // Friction read from the data, not from the AI: most ghosts that reached the spot got past it.
  const fair = f.type === 'friction' && f.reached?.length && f.passed.length * 2 >= f.reached.length;
  const quotes = f.evidence.some((e) => e.thought) && f.type !== 'hard_to_see' ? f.evidence.filter((e) => e.thought).slice(0, 3).map((e) => ({ persona: e.persona, text: e.thought })) : (f.quotes ?? []).slice(0, 3).map((text) => ({ text }));
  return (
    <article
      id={`f-${f.id}`}
      className={`finding ${f.type} ${selected ? 'selected' : ''}`}
      onMouseEnter={() => onHover(f.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(f.id)}
      onBlur={() => onHover(null)}
    >
      <div className="finding-main">
        <span className={`badge ${f.type}`}>
          {f.id} · {TYPE_LABEL[f.type] ?? f.type}
        </span>
        <h3>{card?.title ?? `${TYPE_LABEL[f.type]} around (${f.center.x}, ${f.center.y})`}</h3>
        {card?.confidence && (
          <p className={`confidence conf-${card.confidence}`}>
            Confidence: {card.confidence}
            {card.could_be_ghost_skill && f.type !== 'friction' ? ' · could be the ghosts’ own lack of skill, not the design' : ''}
          </p>
        )}
        <p className="stat-line mono">
          {statLine(f, report)}
          {extra.length ? ` · ${extra.join(' · ')}` : ''}
        </p>
        {fair && <p className="fair-line">Most ghosts that reached it got past: probably a fair challenge, not a flaw.</p>}
        {card && (
          <dl className="card-fields">
            <dt>What happens</dt>
            <dd>{capital(card.what_happens)}</dd>
            <dt>Likely cause</dt>
            <dd>{capital(card.likely_cause)}</dd>
            <dt>Try this</dt>
            <dd>{capital(card.suggested_fix)}</dd>
          </dl>
        )}
        {quotes.length > 0 && (
          <p className="quotes-label">{f.type === 'hard_to_see' ? 'What ghosts said near it' : 'What they were planning right before (the replay shows what actually happened)'}</p>
        )}
        {(also.length > 0 || consequences.length > 0) && (
          <ul className="related small">
            {also.map((r) => (
              <li key={r.id}>
                <b>Same cause</b>, also seen as {TYPE_LABEL[r.type]?.toLowerCase() ?? r.type}
                {r.milestone ? ` (“${r.milestone}” reached by ${r.reachedBy?.length ?? 0}/${report.ghostsTotal})` : ''}
              </li>
            ))}
            {consequences.map((r) => (
              <li key={r.id}>
                <b>Because of this</b>, {r.ghosts.length}/{report.ghostsTotal} ghosts ended their run stuck further on
              </li>
            ))}
          </ul>
        )}
        <ul className="quotes">
          {quotes.map((q, i) => (
            <li key={i}>
              <GhostIcon color={q.persona ? personas[q.persona]?.color : '#9bf6ec'} size={16} />
              <span>“{q.text}”</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="finding-clip">
        <div className="clip-tabs" role="group" aria-label="Whose replay">
          {f.evidence.map((e) => (
            <button
              key={e.persona}
              aria-pressed={e.persona === ev?.persona}
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

const LEGEND = [
  ['blocker', 'Blocker', 'nobody got past'],
  ['missed', 'Missed objective', 'most ghosts never reached it'],
  ['stuck', 'Stuck', 'ghosts ended up circling here'],
  ['hard_to_see', 'Hard to see', 'too faint for people to notice'],
  ['confusion', 'Confusing', 'ghosts said they did not understand'],
  ['friction', 'Friction', 'ghosts died but got past: often a fair challenge'],
];

/** The goal nobody worked out: from the exit interviews, the ghosts' own words after playing. */
function GoalIssue({ issue, report, personas }) {
  const said = report.ghosts.filter((g) => g.debrief && issue.unclear.includes(g.persona));
  return (
    <article className="finding goal">
      <div className="finding-main">
        <span className="badge goal">Goal unclear</span>
        <h3>
          {issue.unclear.length} of {issue.asked} ghosts never worked out what the game wants them to do
        </h3>
        <p className="stat-line mono">
          From the exit interview · {issue.wouldStop.length}/{issue.asked} would stop playing · the ghosts’ own words after playing, not a measurement
        </p>
        <dl className="card-fields">
          <dt>Try this</dt>
          <dd>Say the goal on the first screen in a few words, and show the first objective so a new player can see where to go.</dd>
        </dl>
        <p className="quotes-label">What they thought the goal was, and what stopped them</p>
        <ul className="quotes">
          {said.map((g) => (
            <li key={g.persona}>
              <GhostIcon color={personas[g.persona]?.color} size={16} mood="confused" />
              <span>
                “{g.debrief.goal}” · {g.debrief.stopped_me}
              </span>
            </li>
          ))}
        </ul>
      </div>
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
  // The finding under the pointer: its box on the map lights up, and the reverse (finding ↔ where it happened).
  const [hovered, setHovered] = useState(null);
  const [rerunError, setRerunError] = useState(null);
  const url = report.config?.url ?? '';
  const [rerunUrl, setRerunUrl] = useState(url);
  const [showRerun, setShowRerun] = useState(false);
  const before = useBefore(report.config?.compareTo);
  const resolved = useMemo(
    () => (before && before.worldW === report.worldW ? diffFindings(before, report).filter((r) => r.status === 'resolved').map((r) => r.before) : []),
    [before, report],
  );

  // One-death spots and other weak signals (severity low) are not shown as findings.
  const shown = findings.filter((f) => f.severity !== 'low');
  const { issues, fair, other } = useMemo(() => buildIssues(report), [report]);
  const critical = issues.length;
  const finished = report.ghosts.filter((g) => g.outcome === 'won').length;
  const first = issues[0];
  const topCritical = !first
    ? ''
    : first.kind === 'goal'
      ? `${first.unclear.length} of ${first.asked} ghosts never worked out the goal`
      : (report.cards?.find((c) => c.hotspot === first.primary.id)?.title ?? `${TYPE_LABEL[first.primary.type] ?? first.primary.type}, ${first.primary.ghosts.length} of ${report.ghostsTotal} ghosts`);

  // The exit interviews (the ghosts' own answers after playing): worth a warning when half or more never got it.
  const exit = report.debrief;
  const half = (list) => (exit && list.length * 2 >= exit.asked ? list.length : 0);
  const exitWarning = !exit
    ? ''
    : issues.some((i) => i.kind === 'goal')
      ? ''
      : half(exit.controlsUnclear)
        ? `${exit.controlsUnclear.length} of ${exit.asked} ghosts said afterwards they never worked out the controls.`
        : '';
  const allClear = !critical && !exitWarning;

  const select = (id) => {
    setSelected(id);
    document.getElementById(`f-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const rerun = async (e) => {
    e?.preventDefault();
    setRerunError(null);
    const vp = report.config?.viewport;
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: rerunUrl.trim() || url,
        personas: report.config.personas,
        steps: report.config.steps,
        viewport: vp ? `${vp.width}x${vp.height}` : undefined,
        compareTo: runId, // the new report shows what changed since this one
      }),
    });
    const body = await res.json();
    if (res.ok) onRerun(body.id);
    else setRerunError(body.message);
  };

  if (report.failure) {
    return (
      <section className="panel center state-panel">
        <span className="state-art"><Ghost mood="dead" size={120} /></span>
        <h2>The ghosts could not play this game</h2>
        <p className="muted">{report.failure.message}</p>
        <p className="muted small">Check that the link opens a playable web game (HTML5 canvas).</p>
        {!(report.cost?.total > 0) && <p className="state-cost small mono">Caught before any AI call: this cost $0.</p>}
        <button className="btn-primary" onClick={onHome}>
          {DEMO ? 'All playtests' : 'Try another link'}
        </button>
      </section>
    );
  }

  return (
    <section className="report">
      <div className="run-bar">
        <div>
          <p className="eyebrow">Playtest report</p>
          <h2 className="report-title">{gameName(url)}</h2>
          <p className="run-url small">{gameSource(url)}</p>
        </div>
        <div className="run-bar-right">
          <button className="btn-ghost" onClick={onHome}>
            {DEMO ? 'All playtests' : 'New game'}
          </button>
          {!DEMO && (
            <button className="btn-primary" onClick={() => setShowRerun((v) => !v)} aria-expanded={showRerun}>
              Re-run after a fix
            </button>
          )}
        </div>
      </div>
      {showRerun && (
        <form className="rerun-form" onSubmit={rerun}>
          <label htmlFor="rerun-url">Fixed your game? Re-run the same ghosts and see what changed. Change the link if the fixed build lives somewhere else.</label>
          <div className="url-row">
            <input id="rerun-url" className="url-input mono" value={rerunUrl} onChange={(e) => setRerunUrl(e.target.value)} />
            <button className="btn-primary" type="submit">
              Re-run and compare
            </button>
          </div>
        </form>
      )}
      {rerunError && <p className="form-error">{rerunError}</p>}
      {report.config?.simulateOutage && (
        <p className="sim-banner">Test run: an AI outage was simulated for {personas[report.config.simulateOutage.ghost]?.name ?? report.config.simulateOutage.ghost} from its move {report.config.simulateOutage.fromCall}.</p>
      )}
      {before && <Compare before={before} after={report} beforeId={report.config.compareTo} />}
      {report.notices?.length > 0 && (
        <div className="notices" role="status">
          <h3>What went wrong during the run, and how it was handled</h3>
          <ul>
            {report.notices.map((n, i) =>
              n.type === 'bad_output' ? (
                <li key={i}>
                  <b>{personas[n.persona]?.name ?? n.persona}</b>: at move {n.step} the model's answer was unusable twice, so the ghost waited a moment and kept playing.
                </li>
              ) : (
                <li key={i}>
                  <b>{personas[n.persona]?.name ?? n.persona}</b>: {n.from} failed at move {n.step} ({n.simulated ? `simulated outage, ${n.reason.split(':')[0]}` : n.reason.replace(/\.\s*$/, '')}). It switched to <b>{n.to}</b> and kept playing; no moves were lost.
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <div className={`verdict-row ${allClear ? 'with-art' : ''}`}>
      {allClear && <span className="verdict-art"><Ghost mood="happy" size={64} /></span>}
      <p className={`verdict ${critical ? 'bad' : exitWarning ? 'warn' : 'good'}`}>
        {critical
          ? `${critical} problem${critical === 1 ? '' : 's'} to fix: ${topCritical}`
          : fair.length
            ? `Nothing to fix. ${fair.length} hard spot${fair.length === 1 ? '' : 's'} where ghosts died but most got past: probably a fair challenge.`
            : exitWarning
              ? 'No critical issues in what the game showed: no ghost died again and again or got stuck in one place.'
              : 'No problems found: no ghost died again and again, got stuck or got confused.'}
      </p>
      {exitWarning && (
        <p className="verdict-note">
          {exitWarning}{' '}
          <button type="button" className="text-link" onClick={() => document.getElementById('exit-interview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Read what they said
          </button>
        </p>
      )}
      </div>
      <div className="summary">
        <div className={`stat ${critical ? 'bad' : 'good'}`}>
          <b>{critical}</b>
          <span>problem{critical === 1 ? '' : 's'} to fix</span>
        </div>
        <div className="stat">
          <b>{fair.length}</b>
          <span>fair challenge{fair.length === 1 ? '' : 's'}</span>
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
      </div>
      <p className="run-foot small muted mono">
        Played in {Math.round(report.realMs / 1000)} s · AI cost ${report.cost.total.toFixed(3)} · {report.config?.model ?? report.ghosts[0]?.model}
        {report.config?.requestedViewport && report.config?.viewport
          ? ` · window enlarged to ${report.config.viewport.width}×${report.config.viewport.height} to show the whole game`
          : ''}
      </p>

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

      <h3 className="section-title">Where they got stuck</h3>
      {report.hasPositions ? (
        <div className="heat-wrap">
          <Heatmap runId={runId} report={report} traces={traces} personas={personas} selected={selected} hovered={hovered} onHover={setHovered} onSelect={select} resolved={resolved} />
          <p className="legend small muted">
            {report.positionSource === 'ghosts'
              ? "This game has no Ghostrun SDK: positions and deaths are what each ghost reported seeing on screen · red glow = where they were · ✕ = deaths · click a box to see its replay"
              : "Level rebuilt from the ghosts' screenshots · red glow = where ghosts spent time · ✕ = deaths (ghost color) · click a box to see its replay"}
          </p>
        </div>
      ) : (
        <p className="muted">This game does not report positions, so findings are shown without a level map.</p>
      )}

      {shown.length > 0 && (
        <ul className="legend-chips" aria-label="What the boxes mean">
          {LEGEND.filter(([type]) => shown.some((f) => f.type === type)).map(([type, label, meaning]) => (
            <li key={type} className={`legend-chip ${type}`}>
              <b>{label}</b> {meaning}
            </li>
          ))}
          <li className="legend-note muted">Blocker, missed objective, stuck and hard to see are problems to fix; friction is usually a fair challenge.</li>
        </ul>
      )}
      <h3 className="section-title">What to fix first</h3>
      <div className="findings">
        {issues.length === 0 && <p className="panel">Nothing to fix: no place where ghosts died again and again, got stuck or never found an objective.</p>}
        {issues.map((i) =>
          i.kind === 'goal' ? (
            <GoalIssue key="goal" issue={i} report={report} personas={personas} />
          ) : (
            <Finding
              key={i.primary.id}
              f={i.primary}
              also={i.related}
              consequences={i.consequences}
              card={report.cards?.find((c) => c.hotspot === i.primary.id)}
              report={report}
              runId={runId}
              byPersona={byPersona}
              personas={personas}
              selected={[i.primary, ...i.related, ...i.consequences].some((f) => selected === f.id || hovered === f.id)}
              onHover={setHovered}
            />
          ),
        )}
        {other.map((f) => (
          <Finding key={f.id} f={f} card={report.cards?.find((c) => c.hotspot === f.id)} report={report} runId={runId} byPersona={byPersona} personas={personas} selected={selected === f.id || hovered === f.id} onHover={setHovered} />
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
      {fair.length > 0 && (
        <details className="fair">
          <summary>
            {fair.length} fair challenge{fair.length === 1 ? '' : 's'}: ghosts died here, but most got past
          </summary>
          <div className="findings">
            {fair.map((f) => (
              <Finding key={f.id} f={f} card={report.cards?.find((c) => c.hotspot === f.id)} report={report} runId={runId} byPersona={byPersona} personas={personas} selected={selected === f.id || hovered === f.id} onHover={setHovered} />
            ))}
          </div>
        </details>
      )}

      {report.ghosts.some((g) => g.debrief) && (
        <section id="exit-interview" className="exit" aria-labelledby="exit-title">
          <h3 id="exit-title" className="section-title">Exit interview</h3>
          <p className="small muted exit-intro">
            After its last move, each ghost answered a few questions about the whole game, in character. These are the ghosts’ own opinions, not measurements: read them as what a
            first-time player might say.
          </p>
          <div className="exit-grid">
            {report.ghosts
              .filter((g) => g.debrief)
              .map((g) => {
                const p = personas[g.persona] ?? { name: g.persona, color: '#9bf6ec' };
                const d = g.debrief;
                const noIdea = /^no idea\b/i.test(d.goal);
                return (
                  <article key={g.persona} className="exit-card" style={{ '--c': p.color }}>
                    <header>
                      <GhostSprite persona={g.persona} color={p.color} size={32} mood={moodFor(g.outcome)} />
                      <b>{p.name}</b>
                    </header>
                    <p className="exit-quote">“{capital(d.stopped_me)}”</p>
                    <p className="exit-goal small">
                      <span className="muted">Thought the goal was: </span>
                      {noIdea ? 'no idea' : capital(d.goal)}
                    </p>
                    <ul className="exit-chips" aria-label="Answers">
                      <li className={d.understood_goal ? 'yes' : 'no'}>{d.understood_goal ? 'Understood the goal' : 'Never understood the goal'}</li>
                      <li className={d.understood_controls ? 'yes' : 'no'}>{d.understood_controls ? 'Worked out the controls' : 'Never worked out the controls'}</li>
                      <li className={d.keep_playing ? 'yes' : 'no'}>{d.keep_playing ? 'Would keep playing' : 'Would stop playing'}</li>
                    </ul>
                  </article>
                );
              })}
          </div>
        </section>
      )}

      <h3 className="section-title">Who played</h3>
      <div className="roster">
        {report.ghosts.map((g) => {
          const p = personas[g.persona] ?? { name: g.persona, color: '#9bf6ec' };
          const last = byPersona[g.persona]?.steps.at(-1)?.thought;
          return (
            <div key={g.persona} className="roster-row" style={{ '--c': p.color }}>
              <GhostSprite persona={g.persona} color={p.color} size={40} mood={moodFor(g.outcome)} />
              <div className="roster-name">
                <b>{p.name}</b>
                <span
                  className={`pill pill-${g.outcome}`}
                  title={
                    g.stopReason?.kind === 'deaths'
                      ? `Stopped after dying ${g.stopReason.count} times at the same spot: more moves would not change the finding.`
                      : g.stopReason?.kind === 'idle'
                        ? `Stopped after ${g.stopReason.moves} moves without reaching anywhere new.`
                        : undefined
                  }
                >
                  {OUTCOME_LABEL[g.outcome] ?? g.outcome}
                </span>
              </div>
              <span className="progress wide" role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((g.progress ?? 0) * 100)}>
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

      <h3 className="section-title">How this was made</h3>
      <p className="method small muted">
        How this was made: each ghost played in its own browser with the game clock frozen while it thought ({report.ghosts[0]?.model}). Deaths, objectives and positions
        come from the game; findings are grouped by position without AI. A blocker is a spot no ghost that reached it got past. Objectives the game marks as things to see
        are also measured for contrast on the screen (WCAG asks 3:1), because AI eyes spot faint shapes that people miss. The AI only writes the explanation of each
        finding.
      </p>
    </section>
  );
}
