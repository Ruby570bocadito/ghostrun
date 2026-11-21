import { useEffect, useReducer } from 'react';

const initial = { status: 'connecting', config: null, order: [], ghosts: {}, log: [], report: null, failure: null, startedAt: null, finishedAt: null };

function ghost(state, id) {
  return state.ghosts[id] ?? { id, status: 'waiting', frame: null, thought: '', steps: 0, deaths: 0, x: null, worldW: null, error: null, model: null };
}

function reducer(state, e) {
  switch (e.type) {
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
        ghosts: { ...state.ghosts, [e.ghost]: { ...g, frame: e.file, x: e.state?.x ?? g.x, worldW: e.state?.worldW ?? g.worldW, deaths: e.state?.deaths ?? g.deaths } },
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
        ghosts: { ...state.ghosts, [e.ghost]: { ...g, thought: s.thought, steps: s.step, deaths: s.after?.deaths ?? g.deaths, model: s.model, confused: s.confused } },
      };
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
      return initial;
    default:
      return state;
  }
}

/** Subscribes to a run's live event stream. */
export function useRun(runId) {
  const [state, dispatch] = useReducer(reducer, initial);
  useEffect(() => {
    if (!runId) return undefined;
    dispatch({ type: 'reset' });
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (msg) => dispatch(JSON.parse(msg.data));
    es.onerror = () => es.close();
    return () => es.close();
  }, [runId]);
  return state;
}
