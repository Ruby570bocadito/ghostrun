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

- **Found** = a finding of a compatible type overlaps the area of the planted flaw.
- **False alarm** = a high-severity blocker, missed-objective or stuck finding on a clean game.

Run it yourself: `npm run bench -- --label mine --reps 2` (needs `MODEL_API_KEY`), then `node bench/perception.mjs mine`.

## Results

| Run | What changed | Flaws found | Clean games with a false alarm | Cost per run (4 ghosts) |
|---|---|---|---|---|
| [baseline](results/baseline.md) | first version of the rules | **10/10** (all ranked #1) | 2/10 | $0.026 |
| baseline, re-scored | new blocker rule, same runs (in-sample) | 10/10 | 0/10 | — |
| [holdout](results/holdout.md) | new blocker rule, **fresh runs** | **10/10** | **1/10** | $0.025 |

**Why the rule changed.** In the baseline, both false alarms were in the clean Spike Maze: in single-screen games we only counted a ghost as "getting past" a deadly spot if it finished the level, and ghosts that ran out of moves near the end looked blocked. The new rule: a ghost gets past a spot if it later reaches an objective; a **blocker** needs at least two ghosts dying there three or more times with nobody getting past. Because the rule was changed after seeing those runs, we judged it on a fresh run (holdout).

**The one false alarm in the holdout** (clean Lever Room): two ghosts spent their moves trying to climb the closed door, which they read as a ladder (*"holding up never actually climbed me higher"*). We count it as a false alarm, but it may be a real readability issue in our own test game.

| [baseline-v2](results/baseline-v2.md) | pixel prompt (below) + new blocker rule, fresh runs | **10/10** | **0/10** | $0.025 |

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

## Limitations

- The test games and their flaws are ours. They were written with AI assistance and are being checked by a person (see the AI review log).
- Small samples: 2 repetitions per variant. Ghosts are random, so numbers move between runs.
- 40 moves per ghost: in long levels ghosts can run out of moves before finishing; findings near the end of a level are less reliable.
- Ghosts cannot tell intended difficulty from bad design: they report where players struggle; the developer decides.
