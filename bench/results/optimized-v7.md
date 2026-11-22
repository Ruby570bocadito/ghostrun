# Benchmark — optimized-v7

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-22T12:55:32.499Z

- **Faults found (right type, in the right place): 9/10 (90%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 78%
- Average cost per run (4 ghosts): 0.0157 billed (0.0272 at list price, no cache discount) · average time: 47 s · total: 0.31
- Per run: 93 moves, 10.8 deaths · per move: 1749 input tokens (73% from cache), 233 output (151 reasoning) · latency p50 1084 ms, p90 1742 ms
- Ghosts stopped early because they had shown enough: 23 · unusable answers handled: 0 (retried: 3) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction, friction | 4/4 | 3 | $0.008 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 4/4 | 7 | $0.010 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 34 | $0.022 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction, friction | 0/4 | 29 | $0.019 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.012 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.015 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.020 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 2/4 | 0 | $0.020 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.004 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.006 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.015 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 5 | $0.004 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.018 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 13 | $0.008 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 27 | $0.013 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 36 | $0.018 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 0/4 | 5 | $0.040 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction, friction | 0/4 | 5 | $0.037 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 27 | $0.007 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction! | 0/4 | 24 | $0.018 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
