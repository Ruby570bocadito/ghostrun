import { useEffect, useState } from 'react';
import { GhostIcon } from './Ghost.jsx';
import { Summon } from './Summon.jsx';
import { Haunting } from './Haunting.jsx';
import { Report } from './Report.jsx';
import { Cast } from './Cast.jsx';
import { gameName } from './game.js';
import { useRun } from './useRun.js';
import { DEMO, api } from './demo.js';
import { DemoGallery } from './DemoGallery.jsx';

export const APP_NAME = 'Ghostrun';

const runIdFromHash = () => (location.hash.match(/^#\/run\/([\w-]+)/) ?? [])[1] ?? null;

export default function App() {
  const [config, setConfig] = useState(null);
  const [runId, setRunId] = useState(runIdFromHash);
  const [hash, setHash] = useState(() => location.hash);
  const run = useRun(runId);

  useEffect(() => {
    const onHash = () => {
      setRunId(runIdFromHash());
      setHash(location.hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch(api('/api/config'))
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
      return gameName(run.config?.url);
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
        {DEMO && (
          <span className="chip mono" title="No server: these playtests were recorded from the real app">
            Free demo · recorded playtests
          </span>
        )}
      </header>

      <main>
        {hash === '#/cast' && <Cast personas={personas} />}
        {!runId && hash !== '#/cast' && (DEMO ? <DemoGallery config={config} /> : <Summon config={config} onStarted={openRun} />)}
        {runId && !showReport && <Haunting run={run} runId={runId} personas={personas} onHome={goHome} />}
        {runId && showReport && <Report run={run} runId={runId} personas={personas} onHome={goHome} onRerun={openRun} />}
      </main>
    </div>
  );
}
