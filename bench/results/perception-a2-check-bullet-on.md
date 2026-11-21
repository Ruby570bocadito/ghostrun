# Perception check — a2-check-bullet-on

Each move, the ghost says where it thinks its own character is on the 640×360 screen. The game reports where it really is.
Error = distance in pixels between the two. 40 px ≈ two character widths.

| Game | Moves | Median error | Within 40 px | Within 100 px |
|---|---|---|---|---|
| gap-run | 107 | 70 px | 48% | 58% |
| **All** | 107 | 70 px | 48% | 58% |
