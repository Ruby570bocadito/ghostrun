# AI review log

Ghost Players was built with heavy AI assistance (Claude Code wrote most of the code; Claude subagents built the four extra test games). This log records where **a person** (Rafael Gálvez) checked specific AI-made work, what the check found, and what was decided. Checks done only by the AI itself are listed separately at the end.

| # | Date | AI contribution checked | How it was checked | What the check found | Decision |
|---|---|---|---|---|---|
| R1 | 2026-11-21 | Gap Run test game and its planted flaw (`games/gap-run`, written by Claude Code) | Rafael played `?fault=gap` and tried to cross the third gap | "It is impossible" to cross with the flaw on | **Kept.** The benchmark's known answer for Gap Run is correct |
| R2 | 2026-11-21 | Key Hunt, Lever Room, Spike Maze and Read Me (`games/*`, written by Claude subagents) | Rafael played each version with its flaw and checked it against its `faults.json` | Key Hunt: the key "can't be seen, or barely". Lever Room: nothing says the lever exists or that E uses it. Spike Maze: "I die without seeing them". Read Me: Z does nothing, X dashes | **Kept.** All four flaws behave as specified |
| R3 | 2026-11-21 | The ghosts' think-aloud sentences (Muse Ember output shown in reports) | Rafael watched two replays in the Gap Run report (Speedrunner, Reader) and compared each sentence with the replay | Both only **partly** matched: the sentence is the ghost's *plan* right before the move ("jumping early this time"), while the replay shows the *outcome* | **Changed.** Reports now label the sentences "what they were planning right before", and the analyst receives them as plans, not as descriptions (`web/src/Report.jsx`, `src/explain.mjs`) |
| R4 | 2026-11-21 | Two finding cards written by the analyst (Muse Spark) | Rafael read the cause and fix of a blocker card and a friction card against their replays | Blocker card: he could not tell whether the diagnosis was right (**inconclusive**). Friction card on a hard-but-passable gap: "narrow the gap" **goes too far**, it removes the challenge | Blocker: no decision. Friction: **kept** the analyst prompt change made earlier for this reason (friction → suggest hints or checkpoints, not removing the challenge); to be re-checked on new cards |

| R5 | 2026-11-21 | The ghosts' findings on a **real game we did not make** (NILO, js13kGames 2020, no SDK) | Rafael played NILO level 1 himself and compared it with the report | The report's main card said all 4 ghosts were stuck because "the first red platform looks too high". Rafael reached it **easily** → that cause was **wrong** (the ghosts' clumsiness, not the design). But the ghosts had also said SPACE "did nothing", and Rafael confirmed what SPACE ("refresh the page") does **took him a while to understand** → that signal was **right** | **Changed** the analyst (`src/explain.mjs`): every card now states a confidence and whether the ghosts' own skill could explain it, and for stuck/missed/confusion findings it also reads what the ghosts said about controls that did nothing. Re-run on the same game: the card moved from "platform too high" to "the game shows no instructions for which key jumps… ghosts trying Space, Up… reported nothing happened" (closer to Rafael's experience, still not exact; the analyst's confidence varied between two re-runs) |

## Checks done by the AI on its own work (not counted as human review)

These are listed for transparency. Each was found by running the code, not by reading it.

| Date | What | Found | Decision |
|---|---|---|---|
| 2026-11-21 | Respawn in Gap Run | Ghosts sometimes died twice: `setPosition` left the physics body in the pit | Changed to `body.reset` |
| 2026-11-21 | Freezing the clock with several browsers | "Cannot fast-forward to the past" when pausing 10 ms ahead | Pause further ahead and retry |
| 2026-11-21 | Real-time (no bullet time) mode | Screenshots made keys stay down ~50% longer than chosen, which made ghosts look *better* without bullet time | Measure the real clock |
| 2026-11-21 | Blocker rule | 2/10 false alarms on clean Spike Maze (only finishing counted as getting past) | New rule, then validated on fresh runs |
| 2026-11-21 | Ghost prompt | 12–41% of position answers in pixels when a 0–1000 grid was requested | Ask for pixels only |
