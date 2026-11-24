# Benchmark — v3-c

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-24T11:06:54.439Z

- **Faults found (right type, in the right place): 8/10 (80%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 1/10
- Ghosts that finished the clean games: 78%
- Average cost per run (4 ghosts): 0.0140 billed (0.0263 at list price, no cache discount) · average time: 51 s · total: 0.28
- Per run: 72 moves, 13.7 deaths · per move: 2205 input tokens (79% from cache), 266 output (169 reasoning) · latency p50 1146 ms, p90 1913 ms
- Ghosts stopped early because they had shown enough: 24 · unusable answers handled: 0 (retried: 5) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 5 | $0.005 |
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 8 | $0.005 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 30 | $0.012 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker! | 0/4 | 29 | $0.011 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.011 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.018 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.013 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.018 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.007 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 0/4 | 0 | $0.029 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 1/4 | 0 | $0.029 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 10 | $0.005 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 15 | $0.005 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 34 | $0.010 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 41 | $0.013 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | missed, friction!, friction | 0/4 | 28 | $0.017 |
| spike-maze | clean #2 | nothing wrong | ⚠ false alarm (blocker) | blocker!, friction | 0/4 | 11 | $0.036 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ~ found as friction | friction!, friction!, friction | 1/4 | 27 | $0.017 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction | 0/4 | 35 | $0.014 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
