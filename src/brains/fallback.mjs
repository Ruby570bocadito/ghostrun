// Wraps a brain so that, if its model provider fails (after the SDK's own retries),
// the ghost keeps playing with a backup model instead of losing the run.
export function withFallback(primary, makeBackup, { onSwitch = () => {} } = {}) {
  let active = primary;
  let switched = false;
  return {
    id: primary.id,
    get model() {
      return active.model;
    },
    get coords() {
      return active.coords;
    },
    async decide(input) {
      try {
        return await active.decide(input);
      } catch (err) {
        if (switched || err.kind === 'bad_output') throw err;
        switched = true;
        const backup = makeBackup();
        await onSwitch({
          from: active.model,
          to: backup.model,
          step: input.step,
          reason: err.status ? `HTTP ${err.status}: ${err.message}` : err.message,
          simulated: Boolean(err.simulated),
        });
        active = backup;
        return active.decide(input);
      }
    },
  };
}

/**
 * Test helper: makes a brain fail like an unavailable provider from its Nth call on.
 * Used to demonstrate the fallback; runs that use it are labelled as simulated everywhere.
 */
export function withSimulatedOutage(brain, { fromCall = 6 } = {}) {
  let calls = 0;
  return {
    ...brain,
    get model() {
      return brain.model;
    },
    get coords() {
      return brain.coords;
    },
    async decide(input) {
      calls += 1;
      if (calls >= fromCall) {
        throw Object.assign(new Error('Simulated outage: the model provider is unavailable (503).'), { status: 503, simulated: true });
      }
      return brain.decide(input);
    },
  };
}
