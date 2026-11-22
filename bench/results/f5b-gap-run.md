# Benchmark — f5b-gap-run

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 8 runs · 2026-11-22T18:04:25.928Z

- **Faults found (right type, in the right place): 4/4 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/4
- Ghosts that finished the clean games: 100%
- Average cost per run (4 ghosts): 0.0095 billed (0.0166 at list price, no cache discount) · average time: 37 s · total: 0.08
- Per run: 51 moves, 22.4 deaths · per move: 1899 input tokens (75% from cache), 238 output (147 reasoning) · latency p50 1054 ms, p90 1713 ms
- Ghosts stopped early because they had shown enough: 12 · unusable answers handled: 0 (retried: 2) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 5 | $0.005 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 6 | $0.005 |
| gap-run | clean #4 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 2 | $0.004 |
| gap-run | clean #3 | nothing wrong | ✓ no false alarm | friction!, friction! | 4/4 | 14 | $0.006 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 33 | $0.010 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 35 | $0.014 |
| gap-run | gap #3 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 38 | $0.013 |
| gap-run | gap #4 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 46 | $0.019 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
