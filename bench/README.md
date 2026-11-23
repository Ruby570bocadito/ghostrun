# Benchmark: do the ghosts find real design flaws?

Judges should not have to take our word for it, so we measure it.

## Setup

Five small web games (in `games/`), each with a **clean version** and a version with **one planted flaw** (`?fault=<id>`):

| Game | Kind | Planted flaw | Flaw type |
|---|---|---|---|
| Gap Run | Platformer | The third gap is 200 px wide; a running jump covers ~150 px | blocker |
| Key Hunt | Top-down | The key is drawn almost in the floor colour | missed objective |
| Lever Room | Platformer puzzle | Nothing says the lever exists or that **E** uses it | missed objective |
| Spike Maze | Top-down maze | The spikes on the obvious route are invisible | unfair deaths |
| Read Me | Platformer | The instructions say **Z** dashes; only **X** does | confusion |

The known answer for each flaw (its type and the area of the level where it is) lives in `games/<id>/faults.json`.

For each run, 4 ghosts (Newbie, Speedrunner, Reader, Impatient) play up to 40 moves each with `muse-ember-1.0`, then the analysis (no AI) produces findings.

- **Found** = a **critical** finding (high-severity blocker, missed objective, stuck or hard to see) of a compatible type overlaps the area of the planted flaw.
- **False alarm** = the same kind of critical finding on a clean game.

What this rule does and does not measure (several of these were pointed out by a skeptical-reviewer agent, 21 Nov):

- **"Friction"** (ghosts died at a spot but got past) counts neither way. It also shows up on clean games, at hard but fair spots: in 18 of the 30 clean runs of the last three rounds. The report labels it as probably fair.
- A missed-objective finding also counts when it names the planted objective (for example "lever"). It changes nothing here: all 17 critical objective findings on flawed games also overlap the flaw's area.
- Read Me's flaw (the instructions name the wrong key) is found through its effect: a blocker or a missed objective at the pit that needs the dash. The "confusion" finding type itself is not scored, so this benchmark does not test it.
- With 30 flawed and 30 clean runs the uncertainty is wide: 27/30 found means 74–97%, and 0/30 false alarms means at most 11% (95% Wilson intervals). The held-out third round alone: 9/10 means 60–98%, 0/10 at most 28%.
- Costs are the token counts Meta returns, priced with Meta's published prices (read on 21 Nov, `src/brains/prices.mjs`), not an invoice.
- All five games and their flaws were made by us (with AI help, checked by a person: [review log](../docs/ai-review-log.md)). NILO, [below](#hard-case-a-real-jam-game-we-did-not-make), is the one game made by someone else.

One rule for both, since 21 November (night): before, a "friction" finding also counted as found, which was too lenient ([below](#the-scoring-rule-we-changed-after-a-review)). Older rows in the table keep the rule they were scored with; the "strict" rows re-score the same runs.

Run it yourself: `npm run bench -- --label mine --reps 2` (needs `MODEL_API_KEY`), then `node bench/compare.mjs before-cache mine`. Add `--ask-position` to also measure how well the ghosts see their character (`node bench/perception.mjs mine`).

## Results

| Run | What changed | Flaws found | Clean games with a false alarm | Cost per run (4 ghosts) |
|---|---|---|---|---|
| [baseline](results/baseline.md) | first version of the rules | **10/10** (all ranked #1) | 2/10 | $0.026 |
| baseline, re-scored | new blocker rule, same runs (in-sample) | 10/10 | 0/10 | — |
| [holdout](results/holdout.md) | new blocker rule, **fresh runs** | **10/10** | **1/10** | $0.025 |
| [baseline-v2](results/baseline-v2.md) | pixel prompt (below) + new blocker rule, fresh runs | **10/10** | **0/10** | $0.025 |
| [before-cache](results/before-cache.md) | same ghosts, now recording what Meta bills (cached input included), 1 repetition | 5/5 | 0/5 | $0.018 billed |
| [optimized-v3](results/optimized-v3.md) | cheaper, better-informed ghosts ([below](#cheaper-and-better-ghosts)) | 8/10 | 0/10 | $0.015 billed |
| optimized-v3, re-scored | + contrast check of objectives ([below](#what-ai-eyes-see-that-people-do-not)), same runs | **10/10** | **0/10** | — |
| [optimized-v3-holdout](results/optimized-v3-holdout.md) | same code, **fresh runs** (8/10 by the ghosts alone), re-scored with the contrast check | **10/10** | **0/10** | $0.016 billed |
| optimized-v3 + holdout, **strict rule** | same 40 runs, critical findings only, plus the analysis fixes found by test agents | **18/20** | **0/20** | — |
| [optimized-v5](results/optimized-v5.md) | the same version, **fresh runs** played after those fixes, strict rule | **9/10** | **0/10** | $0.015 billed |
| [optimized-v6](results/optimized-v6.md) | ghosts taught how their actions work ([below](#teaching-the-ghosts-how-their-actions-work)), fresh runs | **8/10** | **0/10** | $0.016 billed |
| [optimized-v7](results/optimized-v7.md) | the same, plus "give a menu a second to change", fresh runs: **the current version** | **9/10** | **0/10** | $0.016 billed |

"Billed" counts cached input at Meta's cached rate; earlier rows are list price (cached tokens were not recorded yet), so compare them with care. Measured with the cache, the old ghosts cost $0.018 per run, not $0.025.

**Why the rule changed.** In the baseline, both false alarms were in the clean Spike Maze: in single-screen games we only counted a ghost as "getting past" a deadly spot if it finished the level, and ghosts that ran out of moves near the end looked blocked. The new rule: a ghost gets past a spot if it later reaches an objective; a **blocker** needs at least two ghosts dying there three or more times with nobody getting past. Because the rule was changed after seeing those runs, we judged it on a fresh run (holdout).

**The one false alarm in the holdout** (clean Lever Room): two ghosts spent their moves trying to climb the closed door, which they read as a ladder (*"holding up never actually climbed me higher"*). We count it as a false alarm, but it may be a real readability issue in our own test game.

### The scoring rule we changed after a review

On 21 November (night) we had the project reviewed by ten AI agents playing roles (a jam developer, a teenager in a hurry, a phone user, a teacher, an attacker, four judges, a skeptical engineer; Claude Haiku, each one using the real app or code). The skeptical engineer found that our "found" rule was too lenient: a **friction** finding (ghosts died but got past) counted as finding a flaw, and friction also appears at the same places in the **clean** versions of two games (Spike Maze's spikes, Read Me's pit). So for those two games, "found" did not tell the flawed version from the clean one. We checked it on the data and he was right:

| Same 40 runs (optimized-v3 + holdout) | Flawed versions: flaw "found" | Clean versions: the same rule fires |
|---|---|---|
| Old rule: any compatible finding, friction included | 20/20 | 8/20 (Spike Maze and Read Me) |
| **New rule: critical findings only** | **18/20** | **0/20** |

Now one rule decides both "found" and "false alarm". The two misses are Spike Maze's invisible spikes, which the ghosts only reported as friction in one run of each round. The test agents also found three analysis bugs, fixed and covered by tests: a wide gap whose deaths split into two contradicting findings ("2/4 got past" next to "0/4 got past" for the same gap), ghosts that ended stuck attached to the wrong finding, and single deaths shown as findings. Re-scoring the 90 recorded runs with the fixes changed no result for the worse. A fresh round played after the fixes and not used to tune anything ([optimized-v5](results/optimized-v5.md)) found 9/10 flaws with 0/10 false alarms, like each earlier round, with the same miss. Across the three rounds: **27/30** found, **0/30** false alarms (`node bench/compare.mjs before-cache-v5 optimized-v3-gapfix+optimized-v3-holdout-gapfix+optimized-v5-gapfix`).

Checking the new screenshots afterwards, we found that the merge for wide gaps also joined two neighbouring gaps into one finding: the run-up to the second gap starts where the first gap's area ends, so their areas touched. Now two areas are one place only if they overlap by at least a quarter of the smaller one (the two halves of one wide gap overlapped 54% and 89% in our runs; neighbouring gaps 1–10%). Re-scoring the three rounds with it ("-gapfix"): the same 27/30 and 0/30; in four Gap Run runs a finding that spanned two gaps became two findings.

### Teaching the ghosts how their actions work

On 22 November an analysis agent went through 5,761 recorded moves and 817 deaths (scripts in the review log). The ghosts knew where they were (median error 7 px), but misjudged how their actions work:

- 69% of the deaths at the fair gaps of Gap Run were jumps started too early. A tapped key fires at the start of the move, but the ghosts expected it to wait until they reached the edge. Jumps prepared by a separate "walk to the edge" move crossed 72% of the time; jumps started while still running, 27%.
- In Spike Maze, a maze with no jump, 28 of 58 fatal moves were planned jumps over spikes.
- In games without the SDK (NILO), a respawn was never reported as a death.

So the ghosts are now told that a tap happens at the start of the move (walk to the edge first, jump in the next move), to use only the controls the game shows, to try one key at a time in a game they do not know, to give a menu a second to change screens, and that being sent back to the start is a death. Two fresh rounds with these rules (`node bench/compare.mjs optimized-v5 optimized-v6+optimized-v7`):

| | Before (round 3, 20 runs) | After (rounds 4–5, 40 runs) |
|---|---|---|
| Flaws found | 9/10 | 17/20 |
| Clean runs with a false alarm | 0/10 | 0/20 |
| Deaths per clean Gap Run run | 16 | 5 |
| Deaths per run, all games | 13.9 | 11.1 |
| Ghosts that finished the clean games | 78% | 74% |
| Billed cost per run | $0.0154 | $0.0160 |

Fewer deaths at fair spots, the same detection, slightly more cost (the instructions are longer). The finish rate did not improve: Spike Maze stays at 0%, and one ghost fewer finished in three games, within the noise of 40 ghosts.

### Ghosts that play with their heads (criteria written before measuring, 22 Nov)

Watching the traces, the ghosts still looked clumsy, and a judge would blame the AI, not the game. [play-quality.mjs](play-quality.mjs) measures it on recorded traces, without the API, against the level's real geometry (which the ghosts are never told): `node bench/play-quality.mjs optimized-v6 optimized-v7`.

What changed (rediseno/PLAN.md, section F):

1. **Facts about each death** (`src/feedback.mjs`, `JumpLog` and `jumpFacts`), measured from the game's own state: where the ghost took off compared with the furthest point it had stood on, how far the jump carried it, whether it walked off the edge, and where it reappears ("at a checkpoint, not the start"). After repeated deaths at one spot: its last takeoffs, its longest jump and the keys that did nothing there (`keys.mjs › deadKeysNear`). The old hint ("try … another key") is gone: 78 of the 206 keys tapped in mid-air came right after it.
2. **"Run N px, then tap"** (`tap_after_px`, games with the SDK only): the ghost judges by eye how far the edge is; the harness keeps its keys held, checks the distance every 20 ms of game time and taps there, about 40 ms early or late like a person. The distance is the model's estimate, so it can still misjudge it. A scripted test on the real Gap Run takes off within ±10 px of the planned point (`test/runup.test.mjs`).
3. **No decisions while falling**: if a move ends with the character falling below every floor it has stood on, its keys stay held until it lands or dies (at most 1.5 s).
4. Thoughts are asked "in the words of a player: no milliseconds, no pixels". New prompt cache key (`ghostrun-ghost-v3`).

The ghosts are still not told where gaps are or how wide: an impossible gap must stay impossible, and a fair one can still be misjudged.

| Measured by play-quality.mjs | Before (v6 + v7, 40 runs) | Target |
|---|---|---|
| Deaths per ghost, clean Gap Run | 1.31 | **≤ 0.5** |
| Jumps at Gap Run's first gap taking off more than 40 px before the edge | 78% (median 81 px)¹ | **≤ 25%** |
| Keys tapped in mid-air that do nothing there, per Gap Run run with the flaw | 18.3 | **≤ 5** |
| Decisions taken while falling below the floor (platformers) | 96 of 2,099 | **0** (except a fall longer than 1.5 s) |
| Ghosts with ≥ 2 clean attempts at the impossible gap (≤ 15 px from the edge, holding →) | 38% | **≥ 75%** |
| "Back at the start" thoughts after reappearing at a checkpoint | 17 | close to 0 |
| Exit interviews that blame the wrong thing (Gap Run) | 2 of 4 (live run 16-31-09; v6/v7 had no interviews) | **none** |

¹ The diagnosis said 82%, which is what the same jumps give with a 30 px line instead of 40 px (distance from the character's centre to the edge).

**Must not get worse** (`node bench/compare.mjs optimized-v6+optimized-v7 <after>`, per game): the planted flaw found in every Gap Run, Read Me and Lever Room run where v6/v7 found it (the impossible gap stays a blocker); 0 false alarms on the clean versions; ghosts that finish the clean games ≥ 74%, and clean Read Me ≥ 6 of 8 (jump, then dash in mid-air); ≤ $0.018 billed per run. If better play makes a "hard but possible" flaw disappear, we say so per game.

**F5, the measurement** (needs `MODEL_API_KEY`; 20 runs × 4 ghosts, about $0.32):

```
node bench/run.mjs --label f5-gap-run --games gap-run --reps 4
node bench/run.mjs --label f5-readme-lever --games read-me,lever-room --reps 3
node bench/play-quality.mjs f5-gap-run f5-readme-lever
node bench/compare.mjs optimized-v6+optimized-v7 f5-gap-run+f5-readme-lever
```

Run it on the games as they were for v6 and v7 (games v1): the new art moves Gap Run's edges and makes its pits shallower, so a round on it is not a before/after of the ghosts alone. The plan measured Gap Run after the facts and the other two after the run-up; the code has all of it at once, so this round measures the whole change, not each part. Results go here, next to this table, whatever they say.

**F5 results** (22 Nov, games v1; [f5-gap-run](results/f5-gap-run.md): Gap Run ×4, [f5-readme-lever](results/f5-readme-lever.md): Read Me and Lever Room ×3; 20 runs, $0.24). Mixed: half the targets met, the jumping itself did not improve.

| | Before (v6 + v7) | F5 | Target | |
|---|---|---|---|---|
| Decisions taken while falling below the floor | 96 of 2,099 | 5 of 1,394 | 0 | ✓ (almost) |
| "Back at the start" thoughts after a checkpoint | 17 | 0 | ~0 | ✓ |
| Exit interviews that blame the wrong thing | 2 of 4 (live run) | 0 of 32 | none | ✓ |
| Flaws found / false alarms (these three games) | — | 10/10 · 0/10 | no worse | ✓ |
| Billed cost per run | ≤ $0.018 limit | $0.0136 Gap Run, $0.0110 Read Me + Lever Room | ≤ $0.018 | ✓ |
| Ghosts that finished the clean version | Gap Run 100%, Lever Room 94%, Read Me 81% | 94%, 92%, 92% | ≥ 74%; Read Me ≥ 6/8 | ✓ (about the same) |
| Takeoffs more than 40 px before Gap Run's first gap | 78% (median 81 px) | 67% (median 89 px) | ≤ 25% | ✗ |
| Deaths per ghost, clean Gap Run | 1.31 | 1.44 | ≤ 0.5 | ✗ |
| Keys tapped in mid-air per Gap Run run with the flaw | 18.3 | 31.3 pressed in the air (39.3 counted when the move was decided, as before) | ≤ 5 | ✗ (worse) |
| Ghosts with ≥ 2 clean attempts at the impossible gap | 38% | 25% | ≥ 75% | ✗ |

The finish rate over all games went from 74% to 93%, but that compares five games with three: Spike Maze, where no ghost finishes, was not in this round. Per game it is about the same.

**Why the jumps did not improve** (from the F5 traces, no API): the ghosts used the run-up in 611 of 1,394 moves, and their estimate of the distance to the edge was not the problem (median 0.94 of the real distance; half of them within 0.83–1.03). The harness was: the run-up came out of `duration_ms`, so a 240 px run in an 800 ms action stopped after ~140 px and jumped 100 px early. 70 of the 157 run-ups at Gap Run's gaps were cut short that way. It also left little time after the tap (median 240 ms, while a jump lasts ~830 ms), so the ghost was asked again in the middle of its jump and tapped Space in the air: 128 of the 221 moves with a mid-air tap came right after such a move. The metric also needed a correction: it judged a tap by the state when the move was decided, but after a run-up the tap comes later, sometimes after landing (71 of those 221 taps were pressed on the floor).

**The fix** (one change, `src/ghost.mjs`): the run-up has its own time budget (up to 3.5 s, enough for 600 px) and `duration_ms` counts from the tap, so the run reaches the distance the ghost chose and the jump has the whole action to land. The rule and the schema say so; prompt cache key `ghostrun-ghost-v4`. `test/runup.test.mjs`: a ~190 px run-up in a 900 ms action takes off within ±10 px, runs on for 900 ms after the tap and has landed before the next decision. **After the fix** ([f5b-gap-run](results/f5b-gap-run.md): Gap Run ×4, games v1, 8 runs, $0.08; `node bench/play-quality.mjs f5b-gap-run`). Read Me and Lever Room were not re-measured: their numbers above are from F5, before this fix.

| Gap Run | Before (v6 + v7) | F5 | After the fix | Target | |
|---|---|---|---|---|---|
| Takeoffs more than 40 px before the first gap | 78% (median 81 px) | 67% (89 px) | **19%** (21 px) | ≤ 25% | ✓ |
| Ghosts with ≥ 2 clean attempts at the impossible gap | 38% | 25% | **75%** | ≥ 75% | ✓ |
| Keys tapped in mid-air per run with the flaw (pressed in the air) | 18.3 | 31.3 | 21.0 | ≤ 5 | ✗ |
| Deaths per ghost, clean Gap Run | 1.31 | 1.44 | 1.69 | ≤ 0.5 | ✗ (16/16 finished) |
| Decisions taken while falling below the floor | 96 of 2,099 | 5 of 1,394 | 6 of 407 | 0 | almost |
| "Back at the start" thoughts / wrong-blame interviews | 17 / — | 0 / 0 of 32 | 1 / 0 of 32 | ~0 / none | ✓ |
| Flaw found · false alarms · clean finished · billed per run | — | 4/4 · 0/4 · 94% · $0.0136 | 4/4 · 0/4 · 16/16 · $0.0095 | no worse | ✓ |

Met: the ghosts now jump at the edge, and at the impossible gap three in four make at least two clean attempts, which is the proof that the gap, not the ghost, is the problem. Not met: they still tap keys in mid-air about as often as before the whole change, and they die a little more in the clean Gap Run (all of them finish it anyway). With 4 runs per variant these are small samples.

**On the first games, across all five rounds** (100 runs): **44/50** flaws found (76–94%), **0/50** false alarms (at most 7%); 34 found by what the ghosts did, 10 by the contrast measurement (`node bench/compare.mjs before-cache-v5 optimized-v3-gapfix+optimized-v3-holdout-gapfix+optimized-v5-gapfix+optimized-v6+optimized-v7`).

### New art for the five games, three new rounds (23 Nov)

The five games were redrawn with one art kit (`games/shared/kit.js`) so that each planted flaw reads as a design flaw: Gap Run's impossible gap is visibly 7 tiles wide against 3; Lever Room's door, which ghosts read as a ladder, is now a portcullis with a red/green light; the flawed lever and key match what surrounds them (1.26:1 and 1.09:1). The first games are tagged `games-v1`. New art changes what the ghosts see, so every number was measured again, with the scoring and analysis rules unchanged and the ghosts of the section above. Criteria written before measuring (`rediseno/PLAN.md`): at least 9/10 flaws found in each round, no false alarm, at least 75% of ghosts finishing the clean games; if not met, published as is.

| Round (20 runs each) | Flaws found | Clean runs with a false alarm |
|---|---|---|
| v2-a | 10/10 | 1/10 (Spike Maze) |
| v2-b | 9/10 | 0/10 |
| v2-c | 8/10 | 0/10 |
| **All three** | **27/30** (74–97%) | **1/30** (at most 17%) |

| Game | Found | False alarms | Ghosts that finished the clean version | Billed per run |
|---|---|---|---|---|
| Gap Run | 6/6 | 0/6 | 100% | $0.0084 |
| Key Hunt | 6/6 | 0/6 | 100% | $0.0158 |
| Lever Room | 6/6 | 0/6 | 100% | $0.0164 |
| Read Me | 6/6 | 0/6 | 83% | $0.0077 |
| Spike Maze | 3/6 | 1/6 | 8% | $0.0206 |

Met: 78% of ghosts finished the clean games. Not met: round v2-c found 8/10, and there was one false alarm. All of it is Spike Maze. Its clean maze is finished by almost no ghost (2 of 24), so in one run the ghosts that ended stuck in it made a false alarm; and its invisible spikes were reported three times as a missed objective plus friction instead of a blocker ("found, other type", which does not count). Making the maze fairer is planned, not done. The other four games: 24/24 found, 0/24 false alarms. Billed cost $0.0138 per run on average; the three rounds cost $0.87 (`node bench/compare.mjs optimized-v6+optimized-v7 v2-a+v2-b+v2-c`).

How the ghosts played in the same runs (`node bench/play-quality.mjs v2-a v2-b v2-c`): 23% of takeoffs at Gap Run's first gap started more than 40 px before the edge; three in four ghosts made at least two clean attempts at the impossible gap; still 20.5 mid-air taps per Gap Run run with the flaw and 1.38 deaths per ghost in the clean Gap Run; 2 of 48 exit interviews said they jumped too far when every pit death was a jump that fell short.

## Real jam games made by other people

The five benchmark games are ours. To see how the ghosts do on games nobody tuned anything for, we played nine js13kGames entries by other people at their public address, without the SDK, and compared the reports with what real players wrote on each game's page ([table and links](results/outside-games.md)). We played them three times (one run per game each time) and an independent Claude agent judged the reports blind, without knowing which run each came from. The run with the **exit interview** (each ghost says afterwards whether it understood the goal and the controls, and what stopped it) raised the players' complaint in **5 of 9** games (1 match, 4 partial) and never came back empty; the two runs without it, 4 of 9 and 2 of 9. In the weaker run, the ghosts got further into two games but circled without finding the goal, which nothing in what the game shows marks: only asking them did. It is one run per version on nine games, so the difference is small and noisy. These games also exposed five bugs in Ghostrun, each of which made a report blame the game: clicks too short for games that read the mouse each frame, canvases created late, canvases bigger than the window, a near-empty start screen judged blank, and ghosts not waiting for menus. All are fixed and tested.

## Perception: does the model see its own character?

Each move, the ghost reports where its character is on screen; the game reports where it really is.

| Prompt | Answers in the wrong units | Position within 40 px | Median error |
|---|---|---|---|
| v1: "0–1000 grid" (but the prompt also said 640×360) — [results](results/perception-baseline.md) | 12–41% depending on the game | 68% | 8 px |
| **v2: "pixels of the 640×360 screenshot"** — [results](results/perception-baseline-v2.md) | **0–1%** | **98%** | **5 px** |

Read in whichever units fit best, v1 answers were already precise (median 5–7 px): the model saw well, our prompt was ambiguous. Moves where the character could not be seen (off screen in a pit, or during the red flash after a death) are counted apart.

## Which model should the ghosts use? (Meta Model API)

Same benchmark, same prompt, bullet time on, `reasoning_effort: minimal`. Spark ran each variant once; Wonder, the most expensive, only on Gap Run and Key Hunt.

| Model | Flaws found | Clean games with a false alarm | Ghosts that finished clean games | Decision time, median / 90th pct. | Cost per run (4 ghosts) |
|---|---|---|---|---|---|
| **`muse-ember-1.0`** ([baseline-v2](results/baseline-v2.md)) | 10/10 | 0/10 | **60%** | **0.9 s / 1.2 s** | **$0.025** |
| `muse-spark-1.3` ([model-spark](results/model-spark.md)) | 5/5 | 1/5 | 50% | 2.5 s / 62 s* | $0.273 (11×) |
| `muse-wonder-1.0` ([model-wonder](results/model-wonder.md), 2 games) | 2/2 | 0/2 | 38% | 2.6 s / 4.9 s | $0.427 (17×) |

\* 11% of Spark's decisions took over 30 s, hit our timeout and were retried (worst: 74 s).

The larger models found the same flaws and did not play better on these games, while costing 11–17× more and deciding about 3× slower. With bullet time the game waits, so speed does not change the result, but it is the difference between a playtest in about a minute and one in several minutes. That is why the ghosts use **Muse Ember**: Meta describes it as its model for "high-volume, repeated work", and here a playtest is hundreds of small repeated decisions. The analyst that writes the finding cards, a handful of calls per report, uses Muse Spark. Samples for Spark and Wonder are small, so we only claim that they were not better here, not that they are worse.

## Experiments on our AI design decisions

All on the same 10 variants × 2 repetitions, 4 ghosts, `muse-ember-1.0`.

### Bullet time (the game clock freezes while the AI thinks)

| | With bullet time ([baseline-v2](results/baseline-v2.md)) | Without ([realtime-v2](results/realtime-v2.md)) |
|---|---|---|
| Deaths that happened **while the AI was still deciding** | 0 (by design) | **291 of 467 (62%)** |
| Ghosts that finished clean **Read Me** (jump, then dash in mid-air) | **6/8** | **0/8** |
| Ghosts that finished all clean games | 60% | 48% |
| Clean games with a false alarm | 0/10 | 2/10 (both Read Me: a solvable game looked broken) |
| Flaws found | 10/10 | 10/10 |

Bullet time matters where timing matters. In slow games (Gap Run, Key Hunt) we saw no difference, and we do not claim one.

### Different personalities vs four copies of one

| | 4 personalities ([baseline-v2](results/baseline-v2.md)) | 4 Newbies ([clones-v2](results/clones-v2.md)) |
|---|---|---|
| Flaws found / false alarms | 10/10 · 0/10 | 10/10 · 0/10 |
| Ghosts that quit (churn signal in reports) | **9** | **0** |
| Moves flagged "confused" | 59 | 201 |
| Ghosts that finished clean games | 60% | 65% |

On single-flaw test games, personalities did **not** find more flaws. What they changed is the kind of evidence: only the mix produced quits (the Impatient), and a mix of players cried "confused" 3.4× less often than four beginners, so a confusion finding from the mix carries more weight. We keep the personalities for that, not for recall.

## Cheaper and better ghosts

A pass on the ghost loop (21 Nov), each change measured. 40 fresh runs of the new version ([optimized-v3](results/optimized-v3.md) + [optimized-v3-holdout](results/optimized-v3-holdout.md)) against the previous ghosts measured with what Meta actually bills ([before-cache](results/before-cache.md)). Table made with `node bench/compare.mjs before-cache optimized-v3+optimized-v3-holdout`.

| | Before (10 runs) | After (40 runs) |
|---|---|---|
| Flaws found (strict rule: critical findings only) | 5/5 | **18/20**: 14 by what the ghosts did, 4 by the contrast check ([below](#what-ai-eyes-see-that-people-do-not)) |
| Clean runs with a false alarm | 0/5 | **0/20** |
| Ghosts that finished the clean games | 60% | **74%** |
| Moves per run | 113 | **90** (−20%) |
| Deaths per run | 18.1 | **12.7** (−30%) |
| Ghost cost per run, billed | $0.0182 | **$0.0151** (−17%) |
| Analyst cost per report (same 3 runs, [side by side](results/analyst-effort.md)) | $0.0080 | **$0.0043** (−47%) |
| Input tokens per move (share from cache) | 1,192 (48%) | 1,537 (70%) |
| Output tokens per move (of which reasoning) | 193 (109) | 234 (149) |
| Decision time, median | 0.88 s | 0.97 s |

What changed and what each measurement said:

1. **Meta's prompt cache.** A probe ([cache-probe.mjs](cache-probe.mjs)) showed the cache works on 128-token blocks of an identical prompt start, and that without a `prompt_cache_key` identical starts missed it in 3 of 5 calls (0 of 5 with one). The prompt now puts the rules shared by every ghost first, the personality next, and an **append-only** log of moves before the screenshot, cut in chunks of 12 so the cache rebuilds only twice in 40 moves. Input from cache: 48% → 70%.
2. **The ghost is told what each move did.** A person sees their character move and die; a ghost gets one screenshot per turn. Each log line now ends with the result ("→ you moved 126 px right and 60 px up", "→ you died", "→ you reached \"key\"", "→ you did not move"), with short hints when it keeps dying at one spot or walking into a wall, and its measured walking speed. 74% of ghosts finish the clean games (60% before) with 30% fewer deaths: fewer failures caused by the ghosts' clumsiness instead of the game's design, the problem a person found in review R5.
3. **Stop ghosts that have shown enough.** Replaying 50 recorded runs offline ([simulate-stop.mjs](simulate-stop.mjs)): stopping a ghost after 8 deaths in one spot, or 20 moves without reaching anywhere new, kept every flaw (25/25) and the same false alarms (1/25) with 15% fewer moves. Games with the SDK only (without it, positions are too rough). 49 ghosts were stopped early in the 40 runs; reports show them as "Seen enough".
4. **Unusable answers.** A cut or empty answer is retried once; if it fails again the ghost waits 300 ms instead of being lost ([failure handling](../docs/failure-handling.md)). 8 retries in 40 runs, no ghost lost.
5. **The analyst at `minimal` reasoning** instead of `low`: on the same 3 runs the cards were as good (one `low` card blamed the arrow keys for hidden spikes), 47% cheaper and 45% faster ([side by side](results/analyst-effort.md)).

Tried and rejected:

- **Smaller screenshots** (480×270 instead of 640×360): 8% cheaper per move, but positions within 40 px fell from 100% to 95% and the median error went from 4 to 11 px ([probe](results/probe-image-480x270.md)).
- **A shorter memory to cut reasoning**: re-sending 50 recorded moves with a 6-move log instead of 24 cut reasoning by about 30 tokens per move ([probe](results/probe-reasoning.md)), but the long log is what lets the ghosts navigate, and per move the cost is about even (more input, but cached). Removing the walking-speed hint or the "judge distances" instruction made no measurable difference. Keeping the ghosts' thoughts only in the last 6 lines of the log removed 210 input tokens (almost all cached anyway) and did not change the output ([probe](results/probe-trim.md)).
- **Stricter stops**, re-simulated on the 40 new runs: 6 deaths or 15 idle moves saved 6–14% more moves, but 3–6 fewer ghosts finished the clean games and 2 clean runs got a false alarm. Kept 8 and 20.
- **Fewer moves per ghost**: 30 instead of 40 saved 9% of the moves, but 3 fewer ghosts finished. Kept 40 (the app lets you choose 20, 40 or 60).
- **Not asking for the ghost's position where the game already knows it.** Games with the SDK report positions themselves, so we dropped the ghost's own position estimate and "what I see" from its answer. On 120 recorded moves re-sent both ways, output fell from 263 to 229 tokens ([probe](results/probe-fields.md)), and a full round ([optimized-v4](results/optimized-v4.md)) cost **13% less** with the same flaws found. But 2 of its 10 clean runs got a false alarm, both at the visible spikes by Spike Maze's exit. A targeted test (Spike Maze clean, 4 runs each way: [maze-compact](results/maze-compact.md), [maze-full](results/maze-full.md)) pointed the same way: without the field, 4 of 16 ghosts died there 3 or more times, with it none. Pooling every round, ghosts died by those spikes 1.9 times each without the field and 1.1 with it, and clean maze runs got a false alarm in 2 of 6 without it, 0 of 8 with it. Asking the model where it is makes it reason about where it is, and that matters next to hazards. **Rejected**: the field stays.

**Against our own target.** We aimed at −40% cost per run and got −17% for the ghosts and −47% for the analyst, about −25% for a full playtest ($0.026 → $0.019). The ghosts now reason more per move (149 vs 109 tokens) because they have more to reason about: that is the price of better decisions, and a run is still cheaper because it needs fewer moves.

Found on the way: Meta's structured output returns the fields in **alphabetical order** ([probe-output.mjs](probe-output.mjs)), so a ghost writes its "thought" after its keys. That matches review R3: the sentences are the ghost's plan for the move, not a description of what happened.

## What AI eyes see that people do not

Once the ghosts were told what each move did, they started to reach Key Hunt's planted flaw: a key drawn almost in the floor colour, which the person in review R2 said "can't be seen, or barely". The ghosts called it "a faint blue mark" and walked to it: 7 of 8 ghosts picked it up, against 1 of 16 before. Before, they also noticed the shape (their thoughts say so) but failed to reach it. So the flaw used to be found partly because the ghosts were clumsy. **AI vision picks up contrast that people miss**, so the ghosts' behaviour alone cannot say "players will not see this".

So Ghostrun now also **measures** it, without AI: for each objective the game marks as something to see (SDK milestone with `kind: 'object'`), it takes the first screen where the object is visible and computes the WCAG contrast ratio between the object's most distinct pixels and the background around it ([contrast.mjs](../src/contrast.mjs)). WCAG 2.1 (success criterion 1.4.11) asks at least 3:1 for graphical objects people need to perceive. Below 3:1 it is a "Hard to see" finding; below 1.5:1, a critical one.

| Game | Objective | Clean version | With the planted flaw |
|---|---|---|---|
| Key Hunt | key | 12.3–12.5:1 | **1.09:1** |
| Key Hunt | door | 12.4:1 | 12.4:1 |
| Lever Room | lever | 12.5:1 | **1.38:1** |
| Lever Room | door | 12.9:1 | 12.9:1 |
| Spike Maze | checkpoint | 3.6:1 | 3.6:1 |

Measured on the recorded screens of 70 benchmark runs ([contrast.md](results/contrast.md)), it flags exactly the two planted invisible objects and nothing on any clean game. Re-scoring 90 recorded runs with it (45 of them clean) added no false alarm, and the faint key went from missed to found in all 4 runs of the two rounds (with the strict rule, each round finds 9/10 flaws with 0/10 false alarms); a third round, played later, found the faint key in both of its runs and nothing on the clean games. It was designed after the first round; the second round was being played at the same time and was not used to tune it. All rounds use the same five games, so this is a check on fresh plays, not on new games.

Limit: it only checks objects the game declares. An undeclared hazard (Spike Maze's invisible spikes) is still found only through what the ghosts do (deaths), which worked there because dying is visible to any player.

## People vs ghosts

Rafael played all ten variants himself with the SDK's recorder on (`?human=1`, see `games/index.html`) — [results](results/people-vs-ghosts.md).

**Every spot where he died or ended up stuck was also flagged by the ghosts: 4/4.** Two of the four only as friction, which the strict benchmark rule does not count. It measures one direction only (what he hit, did the ghosts flag it?), with one person who already knew the flaws: a first check, not a blind test.

- Gap Run with the flaw: he died 3 times at the third gap and left → the ghosts' **blocker**.
- Spike Maze with the flaw: he died once at the visible spikes near the exit → a ghost **friction** finding.
- Read Me, clean: he died once in the pit → a ghost **friction** finding.

The other way round, the ghosts are harsher than an experienced player:

| Clean game | Ghosts that finished (40 moves) | Ghost deaths per run, average | Ghost game time when they finished (median) | Rafael |
|---|---|---|---|---|
| Gap Run | 4/8 | 7.0 | 16.8 s | finished, 15 s, 0 deaths |
| Key Hunt | 7/8 | 0 | 12.5 s | finished, 11 s, 0 deaths |
| Lever Room | 7/8 | 0 | 13.4 s | finished, 7 s, 0 deaths |
| Spike Maze | 0/8 | 1.1 | — | finished, 8 s, 0 deaths |
| Read Me | 6/8 | 3.9 | 8.5 s | finished, 7 s, 1 death |

So friction findings on clean games (Gap Run's gaps, Spike Maze's spikes) mark places where a clumsier player than Rafael would struggle, which is why they are friction and not critical. Mazes are the ghosts' weak spot.

**Caveats:** one person, who is the developer and had already seen the planted flaws in review R2, so his sessions on the flawed versions were not blind (he went straight to the hidden key, the lever's E and the X dash). His clean-game sessions are the fair comparison. We plan to repeat this with people who have never seen the games.

## Hard case: a real jam game we did not make

[NILO](../games/third-party/nilo/README.md) by Rojen Maharjan (js13kGames 2020, MIT), unmodified, **without our SDK**: the ghosts only had the pixels, at 960×540.

- **Menus:** all 4 ghosts got through the mouse-only menu by themselves (Play → chapter 1 → level 1, three clicks).
- **Finding:** all 4 ended up stuck at the start of level 1 (a "stuck" finding, 4/4), in 55 s for $0.043.
- **Checked by a person** ([review R5](../docs/ai-review-log.md)): the first card blamed the first platform being too high. Rafael reached it easily, so **that cause was wrong**: the ghosts' own clumsiness. But the ghosts had also said SPACE "did nothing", and Rafael confirmed that what SPACE ("refresh the page") does **took him a while to understand**, so that signal was right.
- **What we changed:** every card now states a confidence and whether the ghosts' skill could explain it, and stuck/missed/confusion cards also read what ghosts said about controls that did nothing. On the same run the card became "the game shows no instructions for which key jumps… ghosts trying Space, Up, X and Z reported nothing happened". That is closer to Rafael's experience, but not exact.

We count this as a partial success: the ghosts found the right area and the right symptom, and their first explanation was wrong.

## Limitations

- The test games and their flaws are ours. They were written with AI assistance and are being checked by a person (see the AI review log).
- Small samples: 2 repetitions per variant. Ghosts are random, so numbers move between runs.
- 40 moves per ghost: in long levels ghosts can run out of moves before finishing; findings near the end of a level are less reliable.
- Ghosts cannot tell intended difficulty from bad design: they report where players struggle; the developer decides.
- Ghosts are worse than people at precise jumps and timing. On a real game they got stuck at a jump a person found easy (NILO above). Read "stuck" findings with the card's confidence.
- Ghosts **see better than people in low contrast**: they reached a key at 1.09:1 that a person could barely see. Declared objectives are measured instead (contrast check above); low-contrast things the game does not declare are not.
- Ghosts are stopped early only in games with the SDK. Mazes remain their weak spot: 13% finish the clean Spike Maze, and it is the most expensive game to test.
- Without the SDK, deaths and positions are what the ghosts say they saw. Positions are on-screen coordinates, so in scrolling games the map is approximate.
