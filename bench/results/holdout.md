# Benchmark — holdout

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-21T17:53:55.639Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 1/10
- Ghosts that finished the clean games: 57%
- Average cost per run (4 ghosts): $0.025 · average time: 47 s · total: $0.50

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 2/4 | 22 | $0.017 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 2/4 | 36 | $0.027 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction, friction | 0/4 | 43 | $0.027 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction | 0/4 | 38 | $0.027 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.022 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.020 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | missed! | 0/4 | 0 | $0.034 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | missed! | 0/4 | 0 | $0.032 |
| lever-room | clean #1 | nothing wrong | ⚠ false alarm (stuck) | stuck! | 2/4 | 0 | $0.024 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | confusion! | 4/4 | 0 | $0.018 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.032 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.032 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 6 | $0.006 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 6 | $0.007 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 41 | $0.026 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 35 | $0.025 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction! | 0/4 | 4 | $0.035 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 0/4 | 4 | $0.037 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | friction!, friction | 0/4 | 32 | $0.029 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 65 | $0.025 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
