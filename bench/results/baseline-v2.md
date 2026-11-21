# Benchmark — baseline-v2

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 20 runs · 2026-11-21T18:00:06.882Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 60%
- Average cost per run (4 ghosts): $0.025 · average time: 48 s · total: $0.49

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 2/4 | 28 | $0.021 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 38 | $0.024 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 2/4 | 28 | $0.020 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.022 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 37 | $0.026 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.020 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | missed | 1/4 | 0 | $0.029 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.032 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.015 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.022 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.031 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.032 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 15 | $0.011 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 16 | $0.011 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 37 | $0.025 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 40 | $0.025 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 0/4 | 4 | $0.038 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 0/4 | 5 | $0.036 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 75 | $0.025 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#2) | missed, friction!, friction, friction | 0/4 | 74 | $0.027 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
