# AI review log

Ghost Players was built with heavy AI assistance (Claude Code wrote most of the code; Claude subagents built the four extra test games). This log records where **a person** (Rafael Gálvez) checked specific AI-made work, what the check found, and what was decided. Checks done only by the AI itself are listed separately at the end.

| # | Date | AI contribution checked | How it was checked | What the check found | Decision |
|---|---|---|---|---|---|
| R1 | 2026-11-21 | Gap Run test game and its planted flaw (`games/gap-run`, written by Claude Code) | Rafael played `?fault=gap` and tried to cross the third gap | "It is impossible" to cross with the flaw on | **Kept.** The benchmark's known answer for Gap Run is correct |
| R2 | 2026-11-21 | Key Hunt, Lever Room, Spike Maze and Read Me (`games/*`, written by Claude subagents) | Rafael played each version with its flaw and checked it against its `faults.json` | Key Hunt: the key "can't be seen, or barely". Lever Room: nothing says the lever exists or that E uses it. Spike Maze: "I die without seeing them". Read Me: Z does nothing, X dashes | **Kept.** All four flaws behave as specified |

## Checks done by the AI on its own work (not counted as human review)

These are listed for transparency. Each was found by running the code, not by reading it.

| Date | What | Found | Decision |
|---|---|---|---|
| 2026-11-21 | Respawn in Gap Run | Ghosts sometimes died twice: `setPosition` left the physics body in the pit | Changed to `body.reset` |
| 2026-11-21 | Freezing the clock with several browsers | "Cannot fast-forward to the past" when pausing 10 ms ahead | Pause further ahead and retry |
| 2026-11-21 | Real-time (no bullet time) mode | Screenshots made keys stay down ~50% longer than chosen, which made ghosts look *better* without bullet time | Measure the real clock |
| 2026-11-21 | Blocker rule | 2/10 false alarms on clean Spike Maze (only finishing counted as getting past) | New rule, then validated on fresh runs |
| 2026-11-21 | Ghost prompt | 12–41% of position answers in pixels when a 0–1000 grid was requested | Ask for pixels only |
