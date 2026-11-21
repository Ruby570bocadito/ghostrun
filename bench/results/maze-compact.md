# Benchmark — maze-compact

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 4 runs · 2026-11-21T20:39:58.917Z

- **Faults found (right type, in the right place): 0/0 (n/a)**; any finding in the right place: n/a
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/4
- Ghosts that finished the clean games: 19%
- Average cost per run (4 ghosts): 0.0290 billed (0.0430 at list price, no cache discount) · average time: 70 s · total: 0.12
- Per run: 144 moves, 14.8 deaths · per move: 1502 input tokens (68% from cache), 298 output (233 reasoning) · latency p50 1134 ms, p90 2033 ms
- Ghosts stopped early because they had shown enough: 3 · unusable answers handled: 0 (retried: 2) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 1/4 | 13 | $0.026 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 1/4 | 16 | $0.030 |
| spike-maze | clean #3 | nothing wrong | ✓ no false alarm | friction!, friction!, friction!, friction | 0/4 | 17 | $0.032 |
| spike-maze | clean #4 | nothing wrong | ✓ no false alarm | friction!, friction! | 1/4 | 13 | $0.028 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
