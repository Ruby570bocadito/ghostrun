import { useEffect, useState } from 'react';
import { TYPE_LABEL } from './Heatmap.jsx';
import { api } from './demo.js';

const CRITICAL = ['blocker', 'missed', 'stuck'];
const intersects = (a, b) => a && b && a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/** Matches findings of two runs of the same game: what was resolved, what is still there, what is new. */
export function diffFindings(before, after) {
  const b = (before.findings ?? before.hotspots ?? []).filter((f) => f.severity !== 'low');
  const a = (after.findings ?? after.hotspots ?? []).filter((f) => f.severity !== 'low');
  const used = new Set();
  const isCritical = (f) => CRITICAL.includes(f.type) && f.severity === 'high';
  const rows = b.map((fb) => {
    // Same place first (preferring the same type): a blocker that became friction is the same spot, improved.
    const candidates = a.filter((fa) => !used.has(fa.id) && intersects(fa.region, fb.region));
    const match = candidates.find((fa) => fa.type === fb.type) ?? candidates[0] ?? null;
    if (match) used.add(match.id);
    let status = 'resolved';
    if (match) status = isCritical(fb) && !isCritical(match) ? 'improved' : !isCritical(fb) && isCritical(match) ? 'worse' : 'still';
    return { before: fb, after: match, status };
  });
  for (const fa of a) if (!used.has(fa.id)) rows.push({ before: null, after: fa, status: 'new' });
  return rows;
}

const count = (r) => ({
  critical: (r.findings ?? r.hotspots ?? []).filter((f) => CRITICAL.includes(f.type) && f.severity === 'high').length,
  finished: r.ghosts.filter((g) => g.outcome === 'won').length,
  deaths: r.ghosts.reduce((s, g) => s + g.deaths, 0),
  quits: r.quits.length,
  total: r.ghostsTotal,
});

const STATUS = { resolved: 'Resolved', improved: 'Improved', still: 'Still there', worse: 'Worse', new: 'New' };

function who(f, total) {
  if (!f) return '—';
  // For deaths, what changes is how many got past and how often they died. "4/4 ghosts → 4/4 ghosts" read as no
  // change to a judge agent, although nobody got past before and 3 of 4 did after.
  if ((f.type === 'blocker' || f.type === 'friction') && f.reached?.length)
    return `${f.passed.length}/${f.reached.length} got past, ${f.count} ${f.count === 1 ? 'death' : 'deaths'}`;
  return `${f.ghosts.length}/${total} ghosts`;
}

export function useBefore(compareTo) {
  const [before, setBefore] = useState(null);
  useEffect(() => {
    if (!compareTo) return undefined;
    let cancelled = false;
    fetch(api(`/api/runs/${compareTo}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setBefore(j?.report ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [compareTo]);
  return before;
}

const cardMap = (rep) => Object.fromEntries((rep.cards ?? []).map((c) => [c.finding ?? c.hotspot, c]));

export function Compare({ before, after, beforeId }) {
  const cb = count(before);
  const ca = count(after);
  const rows = diffFindings(before, after);
  const cardsBefore = cardMap(before);
  const cardsAfter = cardMap(after);
  // Prefer the earlier card's wording for resolved findings, the new one otherwise.
  const title = (r) => {
    const f = r.after ?? r.before;
    const card = (r.after ? cardsAfter : cardsBefore)[f.id] ?? (r.before ? cardsBefore[r.before.id] : null);
    return card?.title ?? `${TYPE_LABEL[f.type]} around (${f.center.x}, ${f.center.y})`;
  };
  const delta = (label, x, y, better) => {
    const good = better === 'down' ? y < x : y > x;
    const same = x === y;
    return (
      <div className={`cmp-stat ${same ? '' : good ? 'good' : 'bad'}`}>
        <span>{label}</span>
        <b className="mono">
          {x} → {y}
        </b>
      </div>
    );
  };
  return (
    <section className="compare" aria-labelledby="cmp-title">
      <div className="compare-head">
        <h3 id="cmp-title">Before → after</h3>
        <a className="muted small" href={`#/run/${beforeId}`}>
          see the previous run
        </a>
      </div>
      <div className="cmp-stats">
        {delta('Critical issues', cb.critical, ca.critical, 'down')}
        {delta(`Ghosts that finished (of ${ca.total})`, cb.finished, ca.finished, 'up')}
        {delta('Deaths', cb.deaths, ca.deaths, 'down')}
        {delta('Ghosts that quit', cb.quits, ca.quits, 'down')}
      </div>
      <ul className="cmp-list">
        {rows.map((r, i) => (
          <li key={i} className={`cmp-${r.status}`}>
            <span className={`cmp-badge cmp-${r.status}`}>{STATUS[r.status]}</span>
            <span className="cmp-title">{title(r)}</span>
            <span className="mono small muted">
              {TYPE_LABEL[(r.before ?? r.after).type]}: {who(r.before, before.ghostsTotal)} → {r.after ? `${TYPE_LABEL[r.after.type]}: ${who(r.after, after.ghostsTotal)}` : 'gone'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
