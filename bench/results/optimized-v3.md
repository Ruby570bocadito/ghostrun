# Benchmark — optimized-v3

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-21T20:05:41.280Z

- **Faults found (right type, in the right place): 8/10 (80%)**; any finding in the right place: 80%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 75%
- Average cost per run (4 ghosts): 0.0147 billed (0.0238 at list price, no cache discount) · average time: 41 s · total: 0.29
- Per run: 88 moves, 12.3 deaths · per move: 1530 input tokens (70% from cache), 235 output (150 reasoning) · latency p50 984 ms, p90 1587 ms
- Ghosts stopped early because they had shown enough: 26 · unusable answers handled: 0 (retried: 6) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 3/4 | 8 | $0.008 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 3/4 | 18 | $0.012 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 35 | $0.018 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 34 | $0.017 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.012 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.010 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✗ missed | — | 2/4 | 0 | $0.019 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✗ missed | — | 3/4 | 0 | $0.016 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.008 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.009 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.015 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 17 | $0.008 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed! | 0/4 | 0 | $0.020 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 2 | $0.003 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed | 0/4 | 27 | $0.012 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 29 | $0.012 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction, friction | 1/4 | 5 | $0.031 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 12 | $0.037 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 27 | $0.012 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#2) | missed, friction!, friction, friction | 0/4 | 32 | $0.016 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
