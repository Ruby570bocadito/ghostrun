# Benchmark — model-spark

Model `muse-spark-1.3` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 10 runs · 2026-11-21T18:33:12.656Z

- **Faults found (right type, in the right place): 5/5 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 1/5
- Ghosts that finished the clean games: 50%
- Average cost per run (4 ghosts): $0.273 · average time: 347 s · total: $2.73

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.227 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 25 | $0.219 |
| gap-run | clean #1 | nothing wrong | ⚠ false alarm (blocker) | blocker!, friction!, friction! | 0/4 | 38 | $0.291 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed, confusion! | 1/4 | 0 | $0.311 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | confusion! | 3/4 | 0 | $0.241 |
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 3/4 | 4 | $0.053 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | missed! | 0/4 | 0 | $0.393 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 53 | $0.302 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction! | 0/4 | 29 | $0.399 |
| spike-maze | hidden-spikes #1 | deaths: Invisible spikes | ✓ found (#1) | blocker!, missed! | 0/4 | 69 | $0.288 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
