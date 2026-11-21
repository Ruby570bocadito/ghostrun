# The analyst on recorded blockers: what it says the cause is

The benchmark scores where a finding is, not what the analyst writes about it. This checks the written explanation on the 13 blockers of the recorded runs whose cause we know: the 6 Gap Run runs with the too-wide gap and the 6 Read Me runs whose instructions name the wrong dash key (the three rounds), plus one gallery run where a card got Gap Run wrong. One card per run, `muse-spark-1.3`, reasoning minimal, re-run on the recorded games (no new play). 22 Nov 2026.

**Change tested** (`src/explain.mjs`): the analyst is now told (1) when the deaths are at the bottom edge of a side-scrolling level, that the ghosts died by falling (the ghosts had described a pit they could climb out of, and one card blamed "pit walls taller than the jump"), (2) which keys each ghost pressed when it died, and (3) to compare those keys with the controls the game shows. These were written after reading the "before" cards below, so this is not a held-out test.

| | Before | After, 1st run | After, 2nd run |
|---|---|---|---|
| Gap Run: the cause is "the gap is wider than a jump" | 6/7 | 7/7 | 7/7 |
| Read Me: the card names the key, the instructions or the dash not triggering | 1/6 | 5/6 | 1/6 |

**Result.** Telling the analyst that the deaths are falls fixed the one wrong Gap Run card, in both runs. For Read Me the change helped in one run (5/6) and not in the other (1/6): naming a wrong key from screenshots and key presses is a coin toss for this model. So the place and the numbers of a finding are what to trust; its written cause is a guess to check against the replay. The changes were kept: they never made a Gap Run card worse.

Cost: $0.04 per run of 13 cards.

## Every card

| Run | Sample | | Likely cause | Try this |
|---|---|---|---|---|
| gallery run, Gap Run with the flaw | before | ✗ | The pit walls around (1067, 360) are taller than the player's jump height so escape is impossible. | Add an intermediate ledge or raise the pit floor so a normal jump can climb out. |
| gallery run, Gap Run with the flaw | after, 1st | ✓ | The gap between the platforms is wider than the jump can clear with no intermediate landing to climb out. | Add a middle stepping platform or narrow the gap so the rightward jump to the flag platform is achievable. |
| gallery run, Gap Run with the flaw | after, 2nd | ✓ | The gap between platforms is too wide to cross with the shown move and jump controls. | Add an intermediate step or narrow the gap so the jump to the flag platform is possible. |
| bench-optimized-v3/gap-run-gap-1 | before | ✓ | The gap between teal blocks is wider than the player's maximum jump distance. | Narrow the gap at (1056, 360) so a full run-up jump can clear it. |
| bench-optimized-v3/gap-run-gap-1 | after, 1st | ✓ | The gap between the teal blocks is wider than the maximum running jump distance. | Move the right teal block left to narrow the gap so a running jump can clear it. |
| bench-optimized-v3/gap-run-gap-1 | after, 2nd | ✓ | The gap between the teal blocks is wider than the player's maximum running jump distance. | Narrow the gap between the teal blocks so a full run-up jump can clear it. |
| bench-optimized-v3/gap-run-gap-2 | before | ✓ | The gap before the flag platform is wider than the maximum running jump distance allows. | Move the two platforms closer together so a full running jump can clear the gap. |
| bench-optimized-v3/gap-run-gap-2 | after, 1st | ✓ | The gap between platforms is wider than the maximum running jump distance. | Move the platforms closer together so a full running jump can reach the far platform. |
| bench-optimized-v3/gap-run-gap-2 | after, 2nd | ✓ | The gap between platforms is wider than the maximum running jump distance. | Move the platforms closer together so a full running jump can reach the far side. |
| bench-optimized-v3/read-me-wrong-key-1 | before | ✗ | The spike gap is wider than the Z dash can carry the player across. | Shorten the spike gap or increase dash distance so the signposted dash reaches the flag platform. |
| bench-optimized-v3/read-me-wrong-key-1 | after, 1st | ✓ | The Z dash as instructed does not seem to carry the player across the spike gap, so the key mapping or dash itself may be broken. | Fix the Z dash to actually trigger and travel far enough to clear the spike pit to the flag. |
| bench-optimized-v3/read-me-wrong-key-1 | after, 2nd | ✗ | The spike gap to the flag is too wide for the instructed Z-dash to clear, so correct inputs still land in spikes. | Shorten the spike gap or increase Z-dash distance so a rightward dash from the edge reaches the flag platform. |
| bench-optimized-v3/read-me-wrong-key-2 | before | ✗ | The spike gap to the flag is too wide to cross with the allowed dash distance. | Shorten the spike gap or add a small safe foothold so a dash from the edge reaches the flag platform. |
| bench-optimized-v3/read-me-wrong-key-2 | after, 1st | ✗ | The spike gap to the flag platform is wider than a single Z-dash can cross. | Shorten the spike gap or extend dash distance so one dash reaches the flag platform. |
| bench-optimized-v3/read-me-wrong-key-2 | after, 2nd | ✗ | The spike gap to the flag appears wider than a single Z dash can cross. | Shorten the spike pit or extend dash distance so holding right + Z dash reaches the flag platform. |
| bench-optimized-v3-holdout/gap-run-gap-1 | before | ✓ | The gap between platforms is wider than the maximum jump distance allows. | Move the platforms closer together so the gap is clearable with a full run and jump. |
| bench-optimized-v3-holdout/gap-run-gap-1 | after, 1st | ✓ | The gap between platforms is wider than the maximum jump distance while holding right. | Narrow the gap or add a middle platform so the jump is possible. |
| bench-optimized-v3-holdout/gap-run-gap-1 | after, 2nd | ✓ | The gap between the left platform and the right flag platform exceeds the game's maximum jump distance. | Move the platforms closer together or add an intermediate platform so a full run-and-jump holding right can clear it. |
| bench-optimized-v3-holdout/gap-run-gap-2 | before | ✓ | The gap between platforms exceeds the maximum jump distance possible. | Move the platforms closer together so the gap is crossable with a full held jump. |
| bench-optimized-v3-holdout/gap-run-gap-2 | after, 1st | ✓ | The gap between the platforms is wider than the maximum jump distance. | Narrow the gap or add an intermediate platform so it can be crossed with a normal running jump. |
| bench-optimized-v3-holdout/gap-run-gap-2 | after, 2nd | ✓ | The gap between platforms is wider than the maximum jump distance even with a full hold. | Narrow the gap at (1066, 360) or add a middle platform so a full run-and-jump can cross it. |
| bench-optimized-v3-holdout/read-me-wrong-key-1 | before | ✗ | The spike pit gap is wider than the combined jump plus dash distance can clear. | Shorten the spike pit or increase dash distance so a jump plus airborne dash can reach the flag platform. |
| bench-optimized-v3-holdout/read-me-wrong-key-1 | after, 1st | ✓ | The Z dash as instructed does not carry the player across the spike gap or does not activate as pressed. | Verify that Z dash triggers in air and tunes its distance to clear the spike gap shown. |
| bench-optimized-v3-holdout/read-me-wrong-key-1 | after, 2nd | ✗ | The Z dash as instructed does not carry the player across the spike gap to the flag. | Shorten the spike gap or increase dash distance so a jump plus Z dash can reach the right platform. |
| bench-optimized-v3-holdout/read-me-wrong-key-2 | before | ✗ | The spike gap is wider than the combined jump plus dash distance can clear. | Narrow the spike pit or add a small safe platform in the middle to make it clearable. |
| bench-optimized-v3-holdout/read-me-wrong-key-2 | after, 1st | ✓ | The Z dash as instructed does not carry the player across the spike gap, so the key or dash tuning may be wrong. | Fix the Z dash to travel far enough to reach the flag platform from the edge. |
| bench-optimized-v3-holdout/read-me-wrong-key-2 | after, 2nd | ✗ | The spike gap to the flag is too wide for the Z dash as instructed to clear it. | Shorten the spike pit or increase dash distance so a Right + Z dash from the edge reaches the flag platform. |
| bench-optimized-v5/gap-run-gap-1 | before | ✓ | The gap is wider than the maximum jump distance even with a run-up and holding right. | Move the platforms closer so the gap is within a full run-up jump distance. |
| bench-optimized-v5/gap-run-gap-1 | after, 1st | ✓ | The gap before the flag is wider than the maximum jump distance with a running start. | Move the platforms closer so the gap is crossable with a running jump. |
| bench-optimized-v5/gap-run-gap-1 | after, 2nd | ✓ | The gap is wider than the maximum running-jump distance the game allows. | Narrow the gap or add a middle platform so a full running jump can reach the other side. |
| bench-optimized-v5/gap-run-gap-2 | before | ✓ | The final gap before the flag platform is wider than the maximum jump distance. | Move the flag platform left to narrow the gap so it is clearable with a full running jump. |
| bench-optimized-v5/gap-run-gap-2 | after, 1st | ✓ | The final gap before the flag platform is wider than the jump can clear. | Narrow the final gap or add a small middle platform before the flag. |
| bench-optimized-v5/gap-run-gap-2 | after, 2nd | ✓ | The final gap before the flag platform is wider than the maximum running jump distance. | Move the flag platform left to narrow the gap so a running Space jump can clear it. |
| bench-optimized-v5/read-me-wrong-key-1 | before | ✓ | The air-dash either does not trigger or does not travel far enough to clear the spike gap. | Fix the Z dash to reliably activate midair and tune it to clear the spike width. |
| bench-optimized-v5/read-me-wrong-key-1 | after, 1st | ✓ | The Z dash as instructed does not appear to activate or carry players over the spikes. | Fix the Z dash to trigger reliably midair across that spike gap. |
| bench-optimized-v5/read-me-wrong-key-1 | after, 2nd | ✓ | The Z dash as instructed does not activate or does not carry far enough to clear the spikes. | Fix the Z dash to trigger in midair and tune it to clear the spike gap. |
| bench-optimized-v5/read-me-wrong-key-2 | before | ✗ | The spike gap is too wide to clear because dash adds no usable distance beyond walking. | Shorten the spike gap so a dash-jump from the edge reliably reaches the flag platform. |
| bench-optimized-v5/read-me-wrong-key-2 | after, 1st | ✓ | The Z dash does not appear to give extra distance despite ghosts pressing the instructed key, so the key or dash tuning may be wrong. | Verify Z actually triggers dash and tune dash-plus-jump to clear the spike gap to the flag. |
| bench-optimized-v5/read-me-wrong-key-2 | after, 2nd | ✗ | The spike gap is wider than jump plus Z-dash as signed can clear, with dash adding no useful distance. | Shorten the spike pit so a running dash-jump from the edge reliably reaches the flag platform. |
