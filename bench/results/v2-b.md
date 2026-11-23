# Benchmark — v2-b

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-22T19:07:49.853Z

- **Faults found (right type, in the right place): 9/10 (90%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 75%
- Average cost per run (4 ghosts): 0.0145 billed (0.0252 at list price, no cache discount) · average time: 59 s · total: 0.29
- Per run: 74 moves, 12.7 deaths · per move: 1920 input tokens (76% from cache), 271 output (180 reasoning) · latency p50 1170 ms, p90 1908 ms
- Ghosts stopped early because they had shown enough: 26 · unusable answers handled: 0 (retried: 2) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 2 | $0.003 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction, friction | 4/4 | 3 | $0.003 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction, friction | 0/4 | 32 | $0.013 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker! | 0/4 | 35 | $0.016 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.013 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.011 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 2/4 | 0 | $0.022 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.019 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.004 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.006 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 1/4 | 0 | $0.026 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 0/4 | 0 | $0.031 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 7 | $0.004 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction! | 3/4 | 11 | $0.005 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 34 | $0.012 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 36 | $0.012 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 12 | $0.033 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 21 | $0.035 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 28 | $0.010 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction | 0/4 | 32 | $0.013 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
