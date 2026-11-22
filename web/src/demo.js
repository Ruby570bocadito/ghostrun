// The free static demo (built with VITE_DEMO=1, scripts/export-demo.mjs): there is no server, so no new
// playtests. The playtests it shows are real runs of the app, exported with their reports and frames.
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** The address of an API answer: the server's, or its exported copy in the static demo. */
export function api(path) {
  if (!DEMO) return path;
  if (path === '/api/config') return '/demo/config.json';
  const run = path.match(/^\/api\/runs\/([\w-]+)$/);
  return run ? `/demo/runs/${run[1]}.json` : path;
}
