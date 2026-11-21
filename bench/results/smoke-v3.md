# Benchmark — smoke-v3

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 2 runs · 2026-11-21T19:53:56.510Z

- **Faults found (right type, in the right place): 1/1 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/1
- Ghosts that finished the clean games: 75%
- Average cost per run (4 ghosts): 0.0142 billed (0.0240 at list price, no cache discount) · average time: 39 s · total: 0.03
- Per run: 96 moves, 25.5 deaths · per move: 1538 input tokens (70% from cache), 193 output (109 reasoning) · latency p50 992 ms, p90 1359 ms
- Ghosts stopped early because they had shown enough: 1 · unusable answers handled: 0 (retried: 0) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction! | 3/4 | 8 | $0.008 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 43 | $0.020 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
