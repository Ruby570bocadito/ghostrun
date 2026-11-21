# Perception check — baseline

Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.
Error = distance in pixels between the two (40 px ≈ two character widths). Moves where the character could not be seen
(off screen while falling into a pit, or during the red flash after a death) are counted apart.

| Game | Moves (character visible) | Median error | Within 40 px | Within 100 px | Moves with the character not visible |
|---|---|---|---|---|---|
| gap-run | 423 | 72 px | 45% | 57% | 59 |
| key-hunt | 583 | 6 px | 77% | 84% | 0 |
| lever-room | 474 | 6 px | 81% | 82% | 0 |
| read-me | 358 | 10 px | 62% | 66% | 56 |
| spike-maze | 521 | 9 px | 71% | 76% | 53 |
| **All** | 2359 | 8 px | 68% | 74% | 168 |

## Did the model answer in the units it was asked for?

"Best reading" = the error if each answer is read in whichever unit (0–1000 grid or pixels) fits it better.

| Game | Asked for | Answers in the other unit | Median error, best reading | Within 40 px, best reading |
|---|---|---|---|---|
| gap-run | grid | 41% | 5 px | 79% |
| key-hunt | grid | 13% | 5 px | 88% |
| lever-room | grid | 12% | 5 px | 91% |
| read-me | grid | 31% | 6 px | 84% |
| spike-maze | grid | 19% | 7 px | 83% |
