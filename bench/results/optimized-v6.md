# Benchmark — optimized-v6

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-22T12:27:33.779Z

- **Faults found (right type, in the right place): 8/10 (80%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 70%
- Average cost per run (4 ghosts): 0.0164 billed (0.0283 at list price, no cache discount) · average time: 51 s · total: 0.33
- Per run: 99 moves, 11.3 deaths · per move: 1724 input tokens (73% from cache), 228 output (144 reasoning) · latency p50 1064 ms, p90 1611 ms
- Ghosts stopped early because they had shown enough: 28 · unusable answers handled: 0 (retried: 3) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 4/4 | 6 | $0.009 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction, friction | 4/4 | 5 | $0.009 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction, friction | 0/4 | 29 | $0.018 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 28 | $0.022 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.015 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.013 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 2/4 | 0 | $0.021 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 2/4 | 0 | $0.021 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.007 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed! | 0/4 | 0 | $0.020 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.021 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction! | 3/4 | 7 | $0.005 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 13 | $0.008 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.016 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 33 | $0.019 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction! | 0/4 | 4 | $0.030 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 8 | $0.034 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction, friction | 0/4 | 35 | $0.016 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ~ found as missed, friction | missed, friction!, friction | 0/4 | 29 | $0.018 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
