# Benchmark — before-cache

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 10 runs · 2026-11-21T19:48:46.690Z

- **Faults found (right type, in the right place): 5/5 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/5
- Ghosts that finished the clean games: 60%
- Average cost per run (4 ghosts): $0.024 · average time: 44 s · total: $0.24

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 2/4 | 17 | $0.017 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 37 | $0.026 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.020 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | stuck! | 2/4 | 0 | $0.029 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.015 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 9 | $0.009 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, confusion! | 0/4 | 0 | $0.032 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 37 | $0.026 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 6 | $0.042 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 75 | $0.029 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
