# The analyst on recorded blockers: what it says the cause is

The benchmark scores where a finding is, not what the analyst writes about it. This checks the written explanation on the 13 blockers of the recorded runs whose cause we know: the 6 Gap Run runs with the too-wide gap and the 6 Read Me runs whose instructions name the wrong dash key (the three rounds), plus one gallery run where a card got Gap Run wrong. One card per run, `muse-spark-1.3`, reasoning minimal, re-run on the recorded games (no new play). 22 Nov 2026.

**Change tested** (`src/explain.mjs`): the analyst is now told (1) when the deaths are at the bottom edge of a side-scrolling level, that the ghosts died by falling (the ghosts had described a pit they could climb out of, and one card blamed "pit walls taller than the jump"), (2) which keys each ghost pressed when it died, and (3) to compare those keys with the controls the game shows. These were written after reading the "before" cards below, so this is not a held-out test.

| | Before | After, 1st run | After, 2nd run |
|---|---|---|---|
| Gap Run: the cause is "the gap is wider than a jump" | 6/7 | 7/7 | 7/7 |
| Read Me: the card names the key, the instructions or the dash not triggering | 1/6 | 5/6 | 1/6 |

**Result.** Telling the analyst that the deaths are falls fixed the one wrong Gap Run card, in both runs. For Read Me the change helped in one run (5/6) and not in the other (1/6): naming a wrong key from screenshots and key presses is a coin toss for this model. So the place and the numbers of a finding are what to trust; its written cause is a guess to check against the replay. The changes were kept: they never made a Gap Run card worse.

Cost: $0.04 per run of 13 cards.

## Third change: tell the analyst which keys did anything (22 Nov, afternoon)

Reading the cards above, the analyst never knew that **Z did nothing**: the ghosts pressed it hundreds of times. So Ghostrun now measures it, without AI (`src/keys.mjs`). For every key a ghost tapped on its own (a move that taps Space and Z together and jumps says nothing about Z), did the game's state change in its first frames: a jump, a burst of speed, any game field other than position, an objective? A key that never did anything in 3 or more presses, and never moved the character when held, is reported if it was tapped near a finding: in that finding's facts for the analyst and on its card ("Z did nothing in 23 presses"). This was designed after reading the cards above, so it is not a held-out test either.

Offline, on all 120 recorded benchmark runs, it flags **Z in 12 of 12 Read Me runs with the wrong key**, and **no key that works in any clean game**. It also flags Space in Spike Maze (16 of 24 runs), which is true: that game has no jump. A first version also flagged Spike Maze's up arrow in 2 clean runs (a tap barely moves you; holding it does), so a key that moves the character when held is never called dead.

| | After, 2nd run (above) | With the measured keys |
|---|---|---|
| Gap Run: the cause is "the gap is wider than a jump" | 7/7 | 7/7 |
| Read Me: the card names the key, the instructions or the dash not triggering | 1/6 | **6/6** |
| Spike Maze with hidden spikes, where Space is flagged: the card blames the missing jump | | 0/4 |

A fresh Read Me playtest afterwards (wrong key, not recorded before) gave two critical cards, and both named Z: "The Z key shown on-screen for dash never triggers any action". In that run the ghosts themselves blamed their own timing in their exit interviews; the measurement is what showed that the key was dead.

Cost: $0.05 for the 17 cards.

| Run | Finding | Likely cause, with the measured keys |
|---|---|---|
| gallery run 2026-11-21T22-43-32 | blocker | The gap between platforms is wider than the ArrowRight plus Space jump can cross. |
| optimized-v3/gap-run-gap-1 | blocker | The gap between the teal blocks is wider than the maximum jump distance even with a run-up. |
| optimized-v3/gap-run-gap-2 | blocker | The gap between platforms is wider than the maximum running jump distance allows. |
| optimized-v3/read-me-wrong-key-1 | blocker | The Z key shown on screen for dash appears to do nothing, since 23 solo Z presses produced no change. |
| optimized-v3/read-me-wrong-key-2 | blocker | The Z dash shown on screen is not wired up, since 31 solo Z presses produced no state change. |
| optimized-v3/spike-maze-hidden-spikes-2 | missed | unclear, but ghosts kept dying on the gap / spikes just before the flag and may have lacked skill for the precise jump. |
| optimized-v3-holdout/gap-run-gap-1 | blocker | The gap between the left and right teal platforms is too wide to clear with the shown move and jump. |
| optimized-v3-holdout/gap-run-gap-2 | blocker | The gap between the platforms is wider than the maximum jump distance possible with the shown move and jump controls. |
| optimized-v3-holdout/read-me-wrong-key-1 | blocker | The Z key shown on screen as dash never produces any effect, so the required dash is impossible. |
| optimized-v3-holdout/read-me-wrong-key-2 | blocker | The Z key shown on screen for dash never produces any effect, so the spike gap cannot be crossed. |
| optimized-v3-holdout/spike-maze-hidden-spikes-1 | missed | The bottom lane from spawn kills players with no visible spikes or warning shown in the image. |
| optimized-v3-holdout/spike-maze-hidden-spikes-2 | blocker | An invisible hazard kills players moving right along the bottom corridor toward the flag with no visual warning. |
| optimized-v4/spike-maze-hidden-spikes-1 | blocker | An invisible or misplaced death trigger in the bottom-left start corridor kills the player where no spikes are shown. |
| optimized-v5/gap-run-gap-1 | blocker | The gap is wider than the maximum jump distance can clear. |
| optimized-v5/gap-run-gap-2 | blocker | the gap before the flag platform is wider than the maximum jump distance allows. |
| optimized-v5/read-me-wrong-key-1 | blocker | The Z key shown on screen for dash never produces any effect, so the dash is missing or the binding is wrong. |
| optimized-v5/read-me-wrong-key-2 | blocker | The Z dash action shown on screen and the sign appears unimplemented since 34 solo Z presses produced no effect. |
