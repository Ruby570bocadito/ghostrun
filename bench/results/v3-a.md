# Benchmark — v3-a

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-24T10:49:10.991Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 73%
- Average cost per run (4 ghosts): 0.0147 billed (0.0276 at list price, no cache discount) · average time: 52 s · total: 0.29
- Per run: 75 moves, 13.9 deaths · per move: 2231 input tokens (79% from cache), 265 output (165 reasoning) · latency p50 1130 ms, p90 1800 ms
- Ghosts stopped early because they had shown enough: 27 · unusable answers handled: 0 (retried: 6) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.003 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction! | 4/4 | 15 | $0.006 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 35 | $0.012 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 39 | $0.016 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.017 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.018 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.021 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.020 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.004 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.006 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion | 0/4 | 0 | $0.029 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 1/4 | 0 | $0.031 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction! | 3/4 | 21 | $0.007 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 2/4 | 11 | $0.003 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 29 | $0.010 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 32 | $0.012 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 13 | $0.033 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 19 | $0.030 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 35 | $0.007 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.008 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
