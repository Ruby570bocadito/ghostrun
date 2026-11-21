// Ghostrun — optional one-line SDK.
// Add <script src=".../ghost-sdk.js"></script> to your game and call ghost.pos(x, y)
// every frame (world coordinates) to get exact heatmaps. Everything else is optional.
// Without it, the ghosts still play using pixels only.
(function () {
  const store = (window.__ghost = window.__ghost || { version: 1, state: {}, events: [] });
  window.ghost = {
    /** Player position in world coordinates (call every frame). */
    pos(x, y, extra) {
      store.state = Object.assign(store.state, { x, y }, extra || {});
    },
    /**
     * Merge any extra state you want in the report (deaths, level, score…). Objectives go in
     * `milestones: [{ name, x, y, kind }]` (world coordinates); `kind: 'object'` marks something the
     * player has to see (a key, a lever, a door), so Ghostrun also checks that it has enough contrast.
     */
    state(obj) {
      Object.assign(store.state, obj);
    },
    /** Record a moment: 'death', 'win', 'checkpoint', 'hint-shown'… */
    event(type, data) {
      store.events.push(Object.assign({ type, t: performance.now() }, store.state.x !== undefined ? { x: store.state.x, y: store.state.y } : {}, data || {}));
    },
    /** World size, so heatmaps can be drawn over the whole level. */
    world(width, height) {
      store.state.worldW = width;
      store.state.worldH = height;
    },
  };

  // Human playtest recorder. Open a game with ?human=1 to record your own session (positions, deaths,
  // objectives, outcome) and compare it with the ghosts'. Off unless asked for; it sends nothing otherwise.
  const params = new URLSearchParams(location.search);
  if (params.get('human') !== '1') return;
  // Played from the app (/play/…): send to the same address. Played from the local games server: the app on 5180.
  const endpoint = params.get('report') || (location.pathname.startsWith('/play/') ? '/api/human' : 'http://localhost:5180/api/human');
  const t0 = performance.now();
  const session = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    game: location.pathname.split('/').filter(Boolean).pop() || 'game',
    variant: params.get('fault') || 'clean',
    player: params.get('player') || 'human',
    startedAt: new Date().toISOString(),
    outcome: 'playing',
    samples: [], // [ms since start, x, y] every 200 ms
  };
  let lastSent = 0;
  const snapshot = () => ({
    ...session,
    durationMs: Math.round(performance.now() - t0),
    events: store.events.map((e) => Object.assign({}, e, { t: Math.round(e.t - t0) })),
    milestones: store.state.milestones || [],
    world: { w: store.state.worldW, h: store.state.worldH },
  });
  const send = (beacon) => {
    const body = JSON.stringify(snapshot());
    try {
      if (beacon && navigator.sendBeacon && body.length < 60000) navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
      else fetch(endpoint, { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body, keepalive: body.length < 60000 });
    } catch (err) {
      /* recording is best-effort; the game must never break because of it */
    }
  };
  let bar;
  const setStatus = (text) => bar && (bar.querySelector('span').textContent = text);
  setInterval(() => {
    const s = store.state;
    if (session.outcome === 'playing' && Number.isFinite(s.x)) session.samples.push([Math.round(performance.now() - t0), Math.round(s.x), Math.round(s.y)]);
    if (session.outcome === 'playing' && store.events.some((e) => e.type === 'win')) {
      session.outcome = 'won';
      setStatus('Level complete — your playtest was saved. Thanks!');
      send(false);
    }
    if (session.outcome === 'playing' && performance.now() - lastSent > 3000) {
      lastSent = performance.now();
      send(false);
    }
  }, 200);
  addEventListener('pagehide', () => send(true));

  const mountBar = () => {
    bar = document.createElement('div');
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;display:flex;gap:12px;align-items:center;justify-content:center;padding:10px;background:#0b0d17;color:#e7e9ff;font:14px monospace;z-index:9999';
    bar.innerHTML = '<span>● Recording your playtest (positions, deaths, time)</span>';
    const give = document.createElement('button');
    give.textContent = 'I give up';
    give.style.cssText = 'font:inherit;padding:6px 12px;border-radius:8px;border:1px solid #ff6b6b;background:transparent;color:#ff6b6b;cursor:pointer';
    give.onclick = () => {
      if (session.outcome !== 'playing') return;
      session.outcome = 'gave_up';
      setStatus('Saved as "gave up". Thanks, that is useful too!');
      give.remove();
      send(false);
    };
    bar.appendChild(give);
    document.body.appendChild(bar);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mountBar);
  else mountBar();
})();
