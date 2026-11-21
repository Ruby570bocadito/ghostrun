// Ghost Players — optional one-line SDK.
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
    /** Merge any extra state you want in the report (deaths, level, score…). */
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
})();
