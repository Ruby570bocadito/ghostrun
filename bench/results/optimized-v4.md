# Benchmark — optimized-v4

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-21T20:36:46.080Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 2/10
- Ghosts that finished the clean games: 75%
- Average cost per run (4 ghosts): 0.0131 billed (0.0210 at list price, no cache discount) · average time: 41 s · total: 0.26
- Per run: 88 moves, 13.2 deaths · per move: 1387 input tokens (67% from cache), 200 output (136 reasoning) · latency p50 935 ms, p90 1457 ms
- Ghosts stopped early because they had shown enough: 26 · unusable answers handled: 0 (retried: 4) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 4/4 | 10 | $0.008 |
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 3/4 | 14 | $0.009 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 41 | $0.018 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 36 | $0.018 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.009 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.011 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 3/4 | 0 | $0.017 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | hard_to_see! | 4/4 | 0 | $0.018 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.004 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.006 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.013 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 10 | $0.005 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.015 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 6 | $0.003 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 28 | $0.011 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.013 |
| spike-maze | clean #1 | nothing wrong | ⚠ false alarm (blocker) | blocker!, friction!, friction! | 0/4 | 14 | $0.026 |
| spike-maze | clean #2 | nothing wrong | ⚠ false alarm (blocker) | blocker!, friction!, friction!, friction | 0/4 | 21 | $0.030 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 27 | $0.009 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | friction!, friction!, friction! | 0/4 | 26 | $0.021 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
