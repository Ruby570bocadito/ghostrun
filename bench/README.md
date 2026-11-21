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
- **False alarm** = a high-severity blocker, missed-objective, stuck or hard-to-see finding on a clean game.

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

"Billed" counts cached input at Meta's cached rate; earlier rows are list price (cached tokens were not recorded yet), so compare them with care. Measured with the cache, the old ghosts cost $0.018 per run, not $0.025.

**Why the rule changed.** In the baseline, both false alarms were in the clean Spike Maze: in single-screen games we only counted a ghost as "getting past" a deadly spot if it finished the level, and ghosts that ran out of moves near the end looked blocked. The new rule: a ghost gets past a spot if it later reaches an objective; a **blocker** needs at least two ghosts dying there three or more times with nobody getting past. Because the rule was changed after seeing those runs, we judged it on a fresh run (holdout).

**The one false alarm in the holdout** (clean Lever Room): two ghosts spent their moves trying to climb the closed door, which they read as a ladder (*"holding up never actually climbed me higher"*). We count it as a false alarm, but it may be a real readability issue in our own test game.

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
| Flaws found | 5/5 | 16/20 by the ghosts, **20/20** with the contrast check ([below](#what-ai-eyes-see-that-people-do-not)) |
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

**Against our own target.** We aimed at −40% cost per run and got −17% for the ghosts and −47% for the analyst, about −30% for a full playtest. The ghosts now reason more per move (149 vs 109 tokens) because they have more to reason about: that is the price of better decisions, and a run is still cheaper because it needs fewer moves.

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

Measured on the recorded screens of 70 benchmark runs ([contrast.md](results/contrast.md)), it flags exactly the two planted invisible objects and nothing on any clean game. Re-scoring 90 recorded runs with it (45 of them clean) added no false alarm, and both rounds of the new version find **10/10** flaws with **0/10** false alarms. It was designed after the first round; the second round was played before it existed and was not used to tune it.

Limit: it only checks objects the game declares. An undeclared hazard (Spike Maze's invisible spikes) is still found only through what the ghosts do (deaths), which worked there because dying is visible to any player.

## People vs ghosts

Rafael played all ten variants himself with the SDK's recorder on (`?human=1`, see `games/index.html`) — [results](results/people-vs-ghosts.md).

**Every spot where he died or ended up stuck was also flagged by the ghosts: 4/4.**

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
