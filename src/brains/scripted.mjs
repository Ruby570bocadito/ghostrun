// A brain with no AI: runs right and jumps every few steps.
// Used to test the harness without spending API credits, and as a baseline.
export function createScriptedBrain() {
  let step = 0;
  return {
    id: 'scripted',
    model: 'none',
    async decide() {
      step += 1;
      const jump = step % 3 === 0;
      return {
        move: {
          thought: jump ? 'Jumping now.' : 'Running right.',
          player: null,
          hold: ['ArrowRight'],
          tap: jump ? ['Space'] : [],
          duration_ms: jump ? 700 : 400,
          confused: false,
        },
        usage: { input: 0, output: 0 },
        latencyMs: 0,
      };
    },
  };
}
