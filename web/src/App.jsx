import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { GhostIcon } from './Ghost.jsx';
import { Summon } from './Summon.jsx';
import { gameName } from './game.js';
import { useRun } from './useRun.js';
import { DEMO, api } from './demo.js';
import { DemoGallery } from './DemoGallery.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { DUR, EASE, STILL } from './fx.jsx';
import { EVIDENCE, REPO, RUN_LOCALLY, scrollToSection } from './links.js';

export const APP_NAME = 'Ghostrun';

// The pages after the home page load when they are needed, so a first visit downloads less.
const Report = lazy(() => import('./Report.jsx').then((mod) => ({ default: mod.Report })));
const Haunting = lazy(() => import('./Haunting.jsx').then((mod) => ({ default: mod.Haunting })));
const Cast = lazy(() => import('./Cast.jsx').then((mod) => ({ default: mod.Cast })));

const runIdFromHash = () => (location.hash.match(/^#\/run\/([\w-]+)/) ?? [])[1] ?? null;

/** What fills the page while its code or its data arrives. */
function PageLoading({ label }) {
  return (
    <div className="page-loading" role="status">
      <span className="sr-only">{label}</span>
      <span className="skel skel-title" />
      <span className="skel skel-line" />
      <div className="skel-grid">
        <span className="skel skel-card" />
        <span className="skel skel-card" />
      </div>
    </div>
  );
}

/** One page: it fades in, and (after the first one) takes the focus to its heading, so screen readers say where you are. */
function Page({ first, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h = ref.current?.querySelector('h1, h2');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <m.div
      ref={ref}
      className="page"
      initial={STILL ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={STILL ? undefined : { opacity: 0, y: -6, transition: { duration: DUR.fast } }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [runId, setRunId] = useState(runIdFromHash);
  const [hash, setHash] = useState(() => location.hash);
  const [scrolled, setScrolled] = useState(false);
  // A section of the home page to show once the home page is back (the menu works from every page).
  const [pendingSection, setPendingSection] = useState(null);
  const first = useRef(true);
  const run = useRun(runId);

  useEffect(() => {
    const onHash = () => {
      setRunId(runIdFromHash());
      setHash(location.hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Once the first page is up, the other pages' code downloads in idle time: opening a report is then instant.
  useEffect(() => {
    const warm = () => {
      import('./Report.jsx');
      import('./Haunting.jsx');
    };
    const idle = 'requestIdleCallback' in window;
    const id = idle ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2000);
    return () => (idle ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  // In the static demo a recorded run arrives as its report: until then there is nothing to show but a placeholder.
  const waitingForReport = DEMO && runId && !showReport && run.status !== 'failed';
  const page = hash === '#/cast' ? 'cast' : !runId ? 'home' : showReport ? `report-${runId}` : waitingForReport ? `wait-${runId}` : `live-${runId}`;

  const goSection = (id) => {
    if (page === 'home' && scrollToSection(id)) return;
    setPendingSection(id);
    goHome();
  };
  useEffect(() => {
    if (page !== 'home' || !pendingSection) return undefined;
    // After the page change and its scroll to the top.
    const t = setTimeout(() => {
      scrollToSection(pendingSection);
      if (pendingSection === 'game-url') document.getElementById('game-url')?.focus({ preventScroll: true });
      setPendingSection(null);
    }, 450);
    return () => clearTimeout(t);
  }, [page, pendingSection]);
  const newPlaytest = () => {
    const input = document.getElementById('game-url');
    if (page === 'home' && input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
    } else goSection('game-url');
  };

  return (
    <>
      <button className="skip" type="button" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <header className={`site-top ${scrolled ? 'scrolled' : ''}`}>
        <div className="topbar">
          <button className="brand" onClick={goHome} aria-label={`${APP_NAME} home`}>
            <GhostIcon size={30} />
            <span className="wordmark">{APP_NAME}</span>
          </button>
          {DEMO && (
            <span className="tag amber top-tag" title="No server: these playtests were recorded from the real app">
              Recorded demo
            </span>
          )}
          <nav className="nav" aria-label="Main">
            <button type="button" onClick={() => goSection('how')}>
              How it works
            </button>
            {DEMO && (
              <button type="button" onClick={() => goSection('runs')}>
                Playtests
              </button>
            )}
            <a className="nav-extra" href={EVIDENCE} target="_blank" rel="noreferrer">
              Evidence
            </a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          {DEMO ? (
            <a className="btn-cta" href={RUN_LOCALLY} target="_blank" rel="noreferrer">
              <span className="cta-long">Run it on your game</span>
              <span className="cta-short">Get it</span>
            </a>
          ) : (
            <button type="button" className="btn-cta" onClick={newPlaytest}>
              <span className="cta-long">New playtest</span>
              <span className="cta-short">New</span>
            </button>
          )}
        </div>
      </header>

      <div className="app">
      <main id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={page}>
          <Suspense fallback={<PageLoading label="Loading the page" />}>
            <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0, behavior: 'instant' })}>
              <Page key={page} first={first}>
                {page === 'cast' && <Cast personas={personas} />}
                {page === 'home' && (DEMO ? <DemoGallery config={config} /> : <Summon config={config} onStarted={openRun} />)}
                {page.startsWith('wait-') && <PageLoading label="Loading the playtest" />}
                {page.startsWith('live-') && <Haunting run={run} runId={runId} personas={personas} onHome={goHome} />}
                {page.startsWith('report-') && <Report run={run} runId={runId} personas={personas} onHome={goHome} onRerun={openRun} />}
              </Page>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>
      </div>
      <footer className="site-foot">
        <div className="foot-in">
          <span>{APP_NAME}</span>
          <span className="dot" aria-hidden="true" />
          <span>AI ghost players test your web game</span>
          <span className="dot" aria-hidden="true" />
          <a href={REPO} target="_blank" rel="noreferrer">
            Open source · MIT
          </a>
          <span className="dot" aria-hidden="true" />
          <a href={EVIDENCE} target="_blank" rel="noreferrer">
            How we measured it
          </a>
        </div>
      </footer>
    </>
  );
}
