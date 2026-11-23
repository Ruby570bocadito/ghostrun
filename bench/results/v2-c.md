# Benchmark — v2-c

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-22T19:15:43.846Z

- **Faults found (right type, in the right place): 8/10 (80%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 83%
- Average cost per run (4 ghosts): 0.0142 billed (0.0248 at list price, no cache discount) · average time: 47 s · total: 0.28
- Per run: 75 moves, 13.5 deaths · per move: 1907 input tokens (76% from cache), 259 output (168 reasoning) · latency p50 1075 ms, p90 1724 ms
- Ghosts stopped early because they had shown enough: 22 · unusable answers handled: 0 (retried: 3) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction, friction | 4/4 | 5 | $0.003 |
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 5 | $0.004 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction | 0/4 | 33 | $0.013 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 31 | $0.012 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.015 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.016 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.014 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.017 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.006 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion | 0/4 | 0 | $0.030 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed! | 0/4 | 0 | $0.033 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 16 | $0.006 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction! | 3/4 | 19 | $0.007 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 40 | $0.012 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.009 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction, friction | 0/4 | 18 | $0.024 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction, friction | 2/4 | 6 | $0.027 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction, friction | 0/4 | 32 | $0.018 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction, friction | 0/4 | 35 | $0.013 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
