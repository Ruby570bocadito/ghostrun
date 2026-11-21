# Benchmark — clones-v2

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, newbie, newbie, newbie · up to 40 moves each · 20 runs · 2026-11-21T18:12:35.917Z

- **Faults found (right type, in the right place): 10/10 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/10
- Ghosts that finished the clean games: 65%
- Average cost per run (4 ghosts): $0.026 · average time: 42 s · total: $0.53

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 2/4 | 37 | $0.025 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 46 | $0.030 |
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 3/4 | 28 | $0.022 |
| key-hunt | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.017 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.019 |
| gap-run | gap #2 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 47 | $0.030 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.015 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | missed, confusion! | 0/4 | 0 | $0.032 |
| key-hunt | hidden-key #2 | missed: The key is nearly invisible | ✓ found (#1) | missed | 0/4 | 0 | $0.032 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | confusion! | 2/4 | 0 | $0.021 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.032 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.031 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 4/4 | 18 | $0.014 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 14 | $0.012 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 51 | $0.031 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 47 | $0.031 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 8 | $0.034 |
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction | 0/4 | 8 | $0.035 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#2) | missed, friction!, friction | 0/4 | 75 | $0.032 |
| spike-maze | hidden-spikes #2 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 107 | $0.031 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
