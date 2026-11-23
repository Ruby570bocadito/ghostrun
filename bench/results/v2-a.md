# Benchmark — v2-a

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-22T18:57:34.110Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 1/10
- Ghosts that finished the clean games: 78%
- Average cost per run (4 ghosts): 0.0146 billed (0.0252 at list price, no cache discount) · average time: 66 s · total: 0.29
- Per run: 75 moves, 14.4 deaths · per move: 1932 input tokens (74% from cache), 263 output (174 reasoning) · latency p50 1102 ms, p90 1881 ms
- Ghosts stopped early because they had shown enough: 24 · unusable answers handled: 0 (retried: 3) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 6 | $0.003 |
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 12 | $0.005 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 45 | $0.017 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction! | 0/4 | 33 | $0.016 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.014 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.017 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.021 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.019 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.005 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 0/4 | 0 | $0.032 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed! | 1/4 | 0 | $0.021 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 12 | $0.004 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 19 | $0.007 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 33 | $0.012 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 32 | $0.012 |
| spike-maze | clean #1 | nothing wrong | ⚠ false alarm (blocker, blocker) | blocker!, blocker!, friction! | 0/4 | 25 | $0.038 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 14 | $0.029 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 28 | $0.006 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.010 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
