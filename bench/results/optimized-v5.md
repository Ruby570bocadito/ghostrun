# Benchmark — optimized-v5

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-21T22:33:11.842Z

- **Faults found (right type, in the right place): 9/10 (90%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 78%
- Average cost per run (4 ghosts): 0.0154 billed (0.0251 at list price, no cache discount) · average time: 39 s · total: 0.31
- Per run: 92 moves, 13.9 deaths · per move: 1549 input tokens (70% from cache), 234 output (148 reasoning) · latency p50 975 ms, p90 1489 ms
- Ghosts stopped early because they had shown enough: 29 · unusable answers handled: 1 (retried: 2) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 4/4 | 17 | $0.012 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 4/4 | 15 | $0.011 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker! | 0/4 | 32 | $0.018 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 44 | $0.023 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.014 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.012 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 2/4 | 0 | $0.021 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.018 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.007 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.019 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.020 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 4 | $0.004 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 9 | $0.005 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 35 | $0.014 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 34 | $0.014 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 9 | $0.032 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 14 | $0.030 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed!, friction | 0/4 | 33 | $0.011 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction | 0/4 | 32 | $0.020 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
