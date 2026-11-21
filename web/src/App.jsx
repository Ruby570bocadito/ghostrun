import { useEffect, useState } from 'react';
import { GhostIcon } from './Ghost.jsx';
import { Summon } from './Summon.jsx';
import { Haunting } from './Haunting.jsx';
import { Report } from './Report.jsx';
import { useRun } from './useRun.js';

export const APP_NAME = 'Ghostrun';

const runIdFromHash = () => (location.hash.match(/^#\/run\/([\w-]+)/) ?? [])[1] ?? null;

export default function App() {
  const [config, setConfig] = useState(null);
  const [runId, setRunId] = useState(runIdFromHash);
  const run = useRun(runId);

  useEffect(() => {
    const onHash = () => setRunId(runIdFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ error: true }));
  }, [run.status]);

  const goHome = () => {
    location.hash = '';
  };
  const openRun = (id) => {
    location.hash = `#/run/${id}`;
  };

  const personas = Object.fromEntries((config?.personas ?? []).map((p) => [p.id, p]));
  const showReport = run.status === 'done' || (run.status === 'failed' && run.report);

  // A title per screen, so browser tabs and screen readers say where you are (found by a test agent).
  const host = (() => {
    try {
      return new URL(run.config?.url).host;
    } catch {
      return '';
    }
  })();
  useEffect(() => {
    document.title = !runId ? `${APP_NAME} · Who gets stuck in your game?` : showReport ? `Report · ${host} · ${APP_NAME}` : `Playing ${host} · ${APP_NAME}`;
  }, [runId, showReport, host]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label={`${APP_NAME} home`}>
          <GhostIcon size={26} />
          <span className="wordmark">{APP_NAME}</span>
        </button>
        {config && !config.error && (
          <div className="topbar-meta">
            <span className="chip mono" title="Model the ghosts play with">
              {config.model}
            </span>
            <span className="chip mono" title="AI spending of this server so far, against its cap">
              AI spend ${config.budget.spentUsd.toFixed(2)} / ${config.budget.capUsd}
            </span>
          </div>
        )}
      </header>

      <main>
        {!runId && <Summon config={config} onStarted={openRun} />}
        {runId && !showReport && <Haunting run={run} runId={runId} personas={personas} onHome={goHome} />}
        {runId && showReport && <Report run={run} runId={runId} personas={personas} onHome={goHome} onRerun={openRun} />}
      </main>
    </div>
  );
}
