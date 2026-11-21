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

## Perception: does the model see its own character?

Each move, the ghost reports where its character is on screen; the game reports where it really is ([results](results/perception-baseline.md)).

- The model locates its character precisely: **median error 5–7 px** on a 640×360 screen.
- But in the first version **12–41% of answers came in pixels when we had asked for a 0–1000 grid**, because the prompt also said "640×360". We changed the prompt to ask for pixels only (`src/brains/meta.mjs`); the effect is measured in `baseline-v2`.

## Limitations

- The test games and their flaws are ours. They were written with AI assistance and are being checked by a person (see the AI review log).
- Small samples: 2 repetitions per variant. Ghosts are random, so numbers move between runs.
- 40 moves per ghost: in long levels ghosts can run out of moves before finishing; findings near the end of a level are less reliable.
- Ghosts cannot tell intended difficulty from bad design: they report where players struggle; the developer decides.
