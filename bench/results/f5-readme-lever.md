# Benchmark — f5-readme-lever

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 12 runs · 2026-11-22T17:57:11.311Z

- **Faults found (right type, in the right place): 6/6 (100%)**; any finding in the right place: 100%
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/6
- Ghosts that finished the clean games: 92%
- Average cost per run (4 ghosts): 0.0110 billed (0.0199 at list price, no cache discount) · average time: 34 s · total: 0.13
- Per run: 65 moves, 8.7 deaths · per move: 1826 input tokens (75% from cache), 216 output (128 reasoning) · latency p50 1072 ms, p90 1649 ms
- Ghosts stopped early because they had shown enough: 22 · unusable answers handled: 0 (retried: 0) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| read-me | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 4 | $0.004 |
| read-me | clean #2 | nothing wrong | ✓ no false alarm | friction! | 3/4 | 7 | $0.005 |
| read-me | clean #3 | nothing wrong | ✓ no false alarm | friction!, friction | 4/4 | 4 | $0.003 |
| read-me | wrong-key #1 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 32 | $0.017 |
| read-me | wrong-key #2 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 27 | $0.013 |
| lever-room | clean #1 | nothing wrong | ✓ no false alarm | confusion | 4/4 | 0 | $0.010 |
| read-me | wrong-key #3 | confusion: Instructions name the wrong dash key | ✓ found (#1) | blocker!, missed! | 0/4 | 30 | $0.015 |
| lever-room | clean #2 | nothing wrong | ✓ no false alarm | — | 4/4 | 0 | $0.008 |
| lever-room | clean #3 | nothing wrong | ✓ no false alarm | — | 3/4 | 0 | $0.011 |
| lever-room | no-hint #1 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.015 |
| lever-room | no-hint #2 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.017 |
| lever-room | no-hint #3 | missed: Hidden lever, no use-key hint | ✓ found (#1) | missed!, stuck! | 0/4 | 0 | $0.016 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
