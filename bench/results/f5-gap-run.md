# Benchmark — f5-gap-run

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 8 runs · 2026-11-22T17:53:41.019Z

- **Faults found (right type, in the right place): 4/4 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/4
- Ghosts that finished the clean games: 94%
- Average cost per run (4 ghosts): 0.0136 billed (0.0250 at list price, no cache discount) · average time: 53 s · total: 0.11
- Per run: 77 moves, 22.8 deaths · per move: 2003 input tokens (76% from cache), 226 output (135 reasoning) · latency p50 1132 ms, p90 1690 ms
- Ghosts stopped early because they had shown enough: 10 · unusable answers handled: 0 (retried: 1) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 3 | $0.006 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 6 | $0.008 |
| gap-run | clean #4 | nothing wrong | ✓ no false alarm | friction!, friction | 3/4 | 7 | $0.007 |
| gap-run | clean #3 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 4/4 | 7 | $0.008 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 40 | $0.022 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 41 | $0.019 |
| gap-run | gap #3 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 43 | $0.021 |
| gap-run | gap #4 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 35 | $0.018 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
