# Perception check — smoke-v3

Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.
Error = distance in pixels between the two (40 px ≈ two character widths). Moves where the character could not be seen
(off screen while falling into a pit, or during the red flash after a death) are counted apart.

| Game | Moves (character visible) | Median error | Within 40 px | Within 100 px | Moves with the character not visible |
|---|---|---|---|---|---|
| gap-run | 168 | 8 px | 99% | 100% | 24 |
| **All** | 168 | 8 px | 99% | 100% | 24 |

## Did the model answer in the units it was asked for?

"Best reading" = the error if each answer is read in whichever unit (0–1000 grid or pixels) fits it better.

| Game | Asked for | Answers in the other unit | Median error, best reading | Within 40 px, best reading |
|---|---|---|---|---|
| gap-run | pixels | 0% | 8 px | 99% |
