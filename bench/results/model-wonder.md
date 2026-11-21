# Benchmark — model-wonder

Model `muse-wonder-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 4 runs · 2026-11-21T18:40:21.299Z

- **Faults found (right type, in the right place): 2/2 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/2
- Ghosts that finished the clean games: 38%
- Average cost per run (4 ghosts): $0.427 · average time: 188 s · total: $1.71

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| gap-run | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 1/4 | 9 | $0.411 |
| gap-run | gap #1 | blocker: Gap 3 is too wide to jump | ✓ found (#1) | blocker!, friction!, friction! | 0/4 | 20 | $0.579 |
| key-hunt | clean #1 | nothing wrong | ✓ no false alarm | — | 2/4 | 0 | $0.318 |
| key-hunt | hidden-key #1 | missed: The key is nearly invisible | ✓ found (#1) | missed! | 0/4 | 0 | $0.399 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
