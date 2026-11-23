import { useEffect, useReducer } from 'react';
import { DEMO, api } from './demo.js';

const initial = { status: 'connecting', config: null, order: [], ghosts: {}, log: [], report: null, failure: null, startedAt: null, finishedAt: null };

function ghost(state, id) {
  return state.ghosts[id] ?? { id, status: 'waiting', frame: null, thought: '', steps: 0, deaths: 0, x: null, worldW: null, error: null, model: null };
}

function reducer(state, e) {
  switch (e.type) {
    case 'queued':
      return { ...state, status: 'queued', position: e.position, config: e.config ?? state.config };
    case 'run_started': {
      const ghosts = {};
      for (const id of e.config.personas) ghosts[id] = ghost(state, id);
      return { ...state, status: 'running', config: e.config, order: e.config.personas, ghosts, startedAt: e.at };
    }
    case 'ghost_started':
      return { ...state, ghosts: { ...state.ghosts, [e.ghost]: { ...ghost(state, e.ghost), status: 'playing' } } };
    case 'frame': {
      const g = ghost(state, e.ghost);
      return {
        ...state,
        ghosts: {
          ...state.ghosts,
          // sx/sy: where the character is on this screen (games with the SDK), to float the ghost over it
          [e.ghost]: { ...g, frame: e.file, t: e.t ?? g.t, x: e.state?.x ?? g.x, worldW: e.state?.worldW ?? g.worldW, deaths: e.state?.deaths ?? g.deaths, sx: e.state?.screenX ?? g.sx, sy: e.state?.screenY ?? g.sy },
        },
      };
    }
    case 'step': {
      const g = ghost(state, e.ghost);
      const s = e.step;
      const log = [...state.log];
      if (s.events.includes('death')) log.push({ at: e.at, ghost: e.ghost, kind: 'death', text: s.thought, step: s.step });
      if (s.events.includes('win')) log.push({ at: e.at, ghost: e.ghost, kind: 'win', text: s.thought, step: s.step });
      if (s.quit) log.push({ at: e.at, ghost: e.ghost, kind: 'quit', text: s.thought, step: s.step });
      if (s.confused) log.push({ at: e.at, ghost: e.ghost, kind: 'confused', text: s.thought, step: s.step });
      return {
        ...state,
        log: log.slice(-40),
        ghosts: {
          ...state.ghosts,
          // px/py: where the ghost said its character is (the only position in games without the SDK)
          [e.ghost]: { ...g, thought: s.thought, steps: s.step, deaths: s.after?.deaths ?? g.deaths, model: s.model, confused: s.confused, px: s.player?.x ?? g.px, py: s.player?.y ?? g.py },
        },
      };
    }
    case 'autopilot': {
      // Before its first move a ghost without the SDK lets the game load and tries the usual ways to start it.
      const g = ghost(state, e.ghost);
      const worked = (e.autopilot?.tried ?? []).filter((x) => x.effect).map((x) => (x.input === 'click' ? 'a click' : x.input.replace(/^Key/, '')));
      const text = worked.length ? `got past the start screens with ${worked.join(', then ')}` : 'waited for the game to load; no start key answered';
      return { ...state, log: [...state.log, { at: e.at, ghost: e.ghost, kind: 'autopilot', text }].slice(-40), ghosts: { ...state.ghosts, [e.ghost]: { ...g, autopilot: e.autopilot } } };
    }
    case 'debrief': {
      // The ghost's exit interview, right after its last move: shown in its tile and in the log.
      const g = ghost(state, e.ghost);
      return { ...state, log: [...state.log, { at: e.at, ghost: e.ghost, kind: 'exit', text: e.debrief.stopped_me }].slice(-40), ghosts: { ...state.ghosts, [e.ghost]: { ...g, debrief: e.debrief } } };
    }
    case 'model_fallback':
      return { ...state, log: [...state.log, { at: e.at, ghost: e.ghost, kind: 'fallback', text: `Model ${e.from} failed (${e.reason}); switched to ${e.to}.` }] };
    case 'ghost_done':
      return { ...state, ghosts: { ...state.ghosts, [e.ghost]: { ...ghost(state, e.ghost), status: e.outcome, error: e.error } } };
    case 'analyzing':
      return { ...state, status: 'analyzing' };
    case 'report':
      return {
        ...state,
        status: e.report.failure ? 'failed' : 'done',
        report: e.report,
        failure: e.report.failure ?? null,
        config: state.config ?? e.report.config,
        order: state.order.length ? state.order : e.report.ghosts.map((g) => g.persona),
        finishedAt: e.at,
      };
    case 'failed':
      return { ...state, status: 'failed', failure: { kind: 'server', message: e.message } };
    case 'reset':
      return { ...initial, runId: e.runId };
    default:
      return state;
  }
}

/**
 * Subscribes to a run's live event stream. If the stream drops before the run ends (a proxy, a network blip,
 * a tab put to sleep), it is opened again and the server sends the run from the start. Closing it for good
 * left the live view frozen after the run had finished (found by a test agent).
 */
export function useRun(runId) {
  const [state, dispatch] = useReducer(reducer, initial);
  useEffect(() => {
    if (!runId) return undefined;
    if (DEMO) {
      // The static demo has no live stream: the run is a recorded one, shown as its report.
      let cancelled = false;
      dispatch({ type: 'reset', runId });
      fetch(api(`/api/runs/${runId}`))
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
        .then((j) => !cancelled && dispatch({ type: 'report', report: j.report }))
        .catch(() => !cancelled && dispatch({ type: 'failed', message: 'This playtest is not part of the demo.' }));
      return () => {
        cancelled = true;
      };
    }
    let es = null;
    let ended = false;
    let misses = 0;
    let retry = null;
    const open = () => {
      dispatch({ type: 'reset', runId });
      es = new EventSource(`/api/runs/${runId}/stream`);
      es.onmessage = (msg) => {
        misses = 0;
        const e = JSON.parse(msg.data);
        if (e.type === 'report' || e.type === 'failed') ended = true;
        dispatch(e);
      };
      es.onerror = () => {
        es.close();
        if (ended) return;
        if (++misses > 20) {
          ended = true;
          dispatch({ type: 'failed', message: 'Lost the connection to the server. Reload the page to see this run.' });
          return;
        }
        retry = setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      ended = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [runId]);
  // Right after the route changes, the state still holds the previous run until the effect resets it: showing
  // it for that one render made the report ask for the new run's frames with the old run's clip ranges (404s
  // and a flash of wrong replays when going from one report to another). Only the run it belongs to sees it.
  return state.runId === runId ? state : initial;
}
