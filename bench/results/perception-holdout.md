# Perception check — holdout

Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.
Error = distance in pixels between the two (40 px ≈ two character widths). Moves where the character could not be seen
(off screen while falling into a pit, or during the red flash after a death) are counted apart.

| Game | Moves (character visible) | Median error | Within 40 px | Within 100 px | Moves with the character not visible |
|---|---|---|---|---|---|
| gap-run | 435 | 62 px | 49% | 62% | 71 |
| key-hunt | 522 | 6 px | 77% | 82% | 0 |
| lever-room | 537 | 6 px | 80% | 82% | 0 |
| read-me | 279 | 10 px | 60% | 66% | 50 |
| spike-maze | 521 | 11 px | 70% | 75% | 51 |
| **All** | 2294 | 8 px | 69% | 75% | 172 |

## Did the model answer in the units it was asked for?

"Best reading" = the error if each answer is read in whichever unit (0–1000 grid or pixels) fits it better.

| Game | Asked for | Answers in the other unit | Median error, best reading | Within 40 px, best reading |
|---|---|---|---|---|
| gap-run | grid | 37% | 5 px | 81% |
| key-hunt | grid | 14% | 5 px | 88% |
| lever-room | grid | 9% | 5 px | 89% |
| read-me | grid | 29% | 7 px | 76% |
| spike-maze | grid | 20% | 8 px | 83% |
