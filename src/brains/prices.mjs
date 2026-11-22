// Meta Model API prices and cost of a move. Kept apart from the brain so the analysis (no AI) can
// price runs without loading the API client.

export const PRICES = {
  // USD per 1M tokens, Standard mode (https://dev.meta.ai/docs/pricing-rate-limits, read 2026-11-21).
  // Cached input (a prompt prefix Meta has seen recently) is billed at the "cached" rate.
  'muse-ember-1.0': { input: 0.1, cached: 0.004, output: 0.5 },
  'muse-spark-1.3': { input: 1.25, cached: 0.15, output: 4.25 },
  'muse-wonder-1.0': { input: 4.0, cached: 0.2, output: 20.0 },
};

/**
 * Cost in USD. `usage.input` includes the cached tokens (as Meta reports them), so only the
 * uncached part pays the full input price. With `{ listPrice: true }` every input token pays the
 * full price: the way runs were priced before cached tokens were recorded, for fair comparisons.
 */
export function costOf(model, usage = {}, { listPrice = false } = {}) {
  const p = PRICES[model];
  if (!p) return 0;
  const input = usage.input ?? 0;
  const cached = listPrice ? 0 : Math.min(usage.cached ?? 0, input);
  return ((input - cached) * p.input + cached * p.cached + (usage.output ?? 0) * p.output) / 1e6;
}

/** What one ghost cost: every move, priced with the model that answered it, plus its exit interview. */
export function traceCost(t, opts) {
  const moves = (t?.steps ?? []).reduce((a, s) => a + costOf(s.model ?? t.model, s.usage ?? {}, opts), 0);
  return moves + (t?.debrief?.usage ? costOf(t.debrief.model ?? t.model, t.debrief.usage, opts) : 0);
}

/** Adds up the usage of several calls. */
export function sumUsage(list) {
  const total = { input: 0, cached: 0, output: 0, reasoning: 0 };
  for (const u of list) {
    if (!u) continue;
    for (const k of Object.keys(total)) total[k] += u[k] ?? 0;
  }
  return total;
}
