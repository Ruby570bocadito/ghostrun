# Perception check — baseline-v2

Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.
Error = distance in pixels between the two (40 px ≈ two character widths). Moves where the character could not be seen
(off screen while falling into a pit, or during the red flash after a death) are counted apart.

| Game | Moves (character visible) | Median error | Within 40 px | Within 100 px | Moves with the character not visible |
|---|---|---|---|---|---|
| gap-run | 445 | 4 px | 99% | 100% | 58 |
| key-hunt | 511 | 4 px | 99% | 100% | 0 |
| lever-room | 519 | 5 px | 97% | 99% | 0 |
| read-me | 330 | 5 px | 98% | 99% | 51 |
| spike-maze | 516 | 6 px | 97% | 99% | 70 |
| **All** | 2321 | 5 px | 98% | 99% | 179 |

## Did the model answer in the units it was asked for?

"Best reading" = the error if each answer is read in whichever unit (0–1000 grid or pixels) fits it better.

| Game | Asked for | Answers in the other unit | Median error, best reading | Within 40 px, best reading |
|---|---|---|---|---|
| gap-run | pixels | 0% | 4 px | 99% |
| key-hunt | pixels | 0% | 4 px | 99% |
| lever-room | pixels | 1% | 5 px | 98% |
| read-me | pixels | 0% | 5 px | 98% |
| spike-maze | pixels | 0% | 6 px | 97% |
