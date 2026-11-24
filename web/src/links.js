// Links the pages share: the repository, the evidence, and the two recorded playtests the home page shows (they are in
// the app's runs/ folder and in the static demo).
export const REPO = 'https://github.com/Ruby570bocadito/ghostrun';
export const EVIDENCE = `${REPO}/blob/main/bench/README.md`;
export const RUN_LOCALLY = `${REPO}#run-it-locally`;
/** Gap Run with its planted flaw: four ghosts, 38 deaths at the same gap, one blocker (the hero's playtest). */
export const FEATURED_RUN = '2026-11-22T18-09-41-841Z-edb5c7aaef';
/** The same game after narrowing the gap, compared with the run above. */
export const FIXED_RUN = '2026-11-22T18-19-14-085Z-29147d3393';

/** Scrolls to a section of the page (the app routes with the hash, so in-page links cannot use #id). */
export function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
