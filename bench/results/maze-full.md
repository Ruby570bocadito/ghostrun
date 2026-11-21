# Benchmark — maze-full

Model `muse-ember-1.0` · bullet time on · ghosts: newbie, speedrunner, reader, impatient · up to 40 moves each · 4 runs · 2026-11-21T20:39:52.157Z

- **Faults found (right type, in the right place): 0/0 (n/a)**; any finding in the right place: n/a
- **Clean games with a false alarm** (a high-severity blocker, missed or stuck finding where there is no fault): 0/4
- Ghosts that finished the clean games: 6%
- Average cost per run (4 ghosts): 0.0318 billed (0.0479 at list price, no cache discount) · average time: 68 s · total: 0.13
- Per run: 145 moves, 11.5 deaths · per move: 1666 input tokens (69% from cache), 326 output (239 reasoning) · latency p50 1180 ms, p90 2008 ms
- Ghosts stopped early because they had shown enough: 3 · unusable answers handled: 0 (retried: 3) · reasoning effort: minimal

| Game | Variant | Expected | Result | Findings | Finished | Deaths | Cost |
|---|---|---|---|---|---|---|---|
| spike-maze | clean #2 | nothing wrong | ✓ no false alarm | friction!, friction!, friction! | 0/4 | 11 | $0.035 |
| spike-maze | clean #1 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 0/4 | 10 | $0.034 |
| spike-maze | clean #3 | nothing wrong | ✓ no false alarm | friction!, friction!, friction | 1/4 | 11 | $0.028 |
| spike-maze | clean #4 | nothing wrong | ✓ no false alarm | friction!, friction!, friction!, friction | 0/4 | 14 | $0.031 |

`!` = high severity. A fault counts as found when a finding of a compatible type overlaps the region where the fault is (games/<id>/faults.json).
