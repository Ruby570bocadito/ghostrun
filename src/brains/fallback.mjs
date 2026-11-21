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
    async decide(input) {
      try {
        return await active.decide(input);
      } catch (err) {
        if (switched || err.kind === 'bad_output') throw err;
        switched = true;
        const backup = makeBackup();
        await onSwitch({ from: active.model, to: backup.model, reason: err.status ? `HTTP ${err.status}` : err.message });
        active = backup;
        return active.decide(input);
      }
    },
  };
}
