# Real jam games — v3

12 runs, 48 ghosts, 5295 moves on 9 games, measured from the recorded runs with no AI (`node bench/real-games.mjs v3 --url js13kgames.com --url itch.io --url third-party/ --since 2026-11-23T18:00Z --until 2026-11-23T19:14Z --compare before`, 2026-11-24 10:32 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 2 | 8 | 410–424 | 3.1 | 70 / 156 | 12 s (8/8) | 0 · 1 · 2 · 97 | 77 | 78 / 89 | 1/8 · 8 % | 0 / 10 | 3 · 97 | 1R 5T 2L | $0.151 |
| Find All Pages | 2 | 8 | 280–291 | 2.1 | 110 / 117 | 12 s (8/8) | 0 · 0 · 0 · 99 | 93 | 31 / 67 | 8/8 · 36 % | 1 / 59 | 68 · 32 | 7T 1A | $0.266 |
| SpaceTaxi | 1 | 4 | 220 | 1.6 | 106 / 150 | 7 s (4/4) | 0 · 4 · 1 · 94 | 87 | 172 / 220 | 0/4 | 0 / 9 | 2 · 98 | 1R 3T | $0.075 |
| Coiner | 1 | 4 | 179 | 1.4 | 90 / 107 | 8 s (4/4) | 0 · 4 · 0 · 96 | 83 | 87 / 107 | 1/4 · 3 % | 0 / 9 | 36 · 44 | 3T 1A | $0.086 |
| Backout | 1 | 4 | 267 | 1.8 | 94 / 110 | 48 s (4/4) | 0 · 2 · 3 · 95 | 72 | 154 / 191 | 0/4 | 1 / 2 | 0 · 68 | 4T | $0.073 |
| Big Champ | 2 | 8 | 199–249 | 1.7 | 116 / 143 | 23 s (8/8) | 1 · 8 · 19 · 72 | 57 | 150 / 172 | 0/8 | 0 / 13 | 36 · 62 | 6T 2A | $0.123 |
| Dead Again | 1 | 4 | 188 | 1.4 | 96 / 109 | 12 s (4/4) | 0 · 0 · 21 · 79 | 60 | 90 / 102 | 1/4 · 3 % | 2 / 4 | 12 · 90 | 3T 1A | $0.063 |
| Broken Repair | 1 | 4 | 307 | 2.3 | 132 / 135 | 34 s (4/4) | 1 · 6 · 0 · 93 | 87 | 152 / 179 | 0/4 | 3 / 9 | 99 · 1 | 4T | $0.081 |
| Decogear | 1 | 4 | 390 | 3.2 | 117 / 152 | 214 s (1/4) | 1 · 71 · 0 · 28 | 9 | 28 / 118 | 4/4 · 73 % | 1 / 17 | 19 · 84 | 2R 1T 1A | $0.054 |
| **Total** | 12 | 48 | 179–424 | 2.1 | 99 / 156 | 13 s (45/48) | 0 · 6 · 6 · 88 | 71 | 89 / 220 | 15/48 · 15 % | 8 / 132 | 32 · 63 | 4R 36T 6A 2L | $0.974 |

Endings: T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost's own budget of 4.5 minutes, however much it had played) · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 0 of 48 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: median 25 s, max 32 s (2 runs) · js13k: median 2 s, max 7 s (10 runs) | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 99 s, max 156.1 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): median 348 s, max 390 s (2 runs) · js13k: median 258 s, max 424 s (10 runs) | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 8 of 9 (not: Decogear) | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 8 of 132 such thoughts; 0.2 per 100 moves (before: 1.6, −91 %) | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | 36 % of 1292 moves | ≥ 60 % |

## Where the real time goes

| Game | Ghosts | Run length (s) | Report after the last ghost (s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Model answers per ghost (median) | Game s per answer | % of real time: start · model · playing · end | Autopilot real s (median) | Ghosts drawing fewer frames · in real time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 8 | 410–424 | 5 (max 5) | 365 | 70 | 4.71 | 120 | 0.55 | 1 · 42 · 56 · 1 | – | 0 · 1 |
| Find All Pages | 8 | 280–291 | 6 (max 6) | 244 | 110 | 2.38 | 120 | 0.83 | 1 · 86 · 12 · 0 | – | 0 · 0 |
| SpaceTaxi | 4 | 220 | 8 | 192 | 106 | 1.83 | 120 | 0.85 | 1 · 68 · 30 · 1 | – | 0 · 0 |
| Coiner | 4 | 179 | 7 | 168 | 90 | 1.81 | 120 | 0.72 | 3 · 80 · 16 · 1 | – | 0 · 0 |
| Backout | 4 | 267 | 8 | 246 | 94 | 2.71 | 120 | 0.60 | 12 · 57 · 31 · 1 | – | 0 · 0 |
| Big Champ | 8 | 199–249 | 27 (max 48) | 192 | 116 | 1.80 | 120 | 0.91 | 9 · 55 · 35 · 1 | – | 0 · 0 |
| Dead Again | 4 | 188 | 5 | 181 | 96 | 1.82 | 120 | 0.76 | 5 · 66 · 28 · 1 | – | 0 · 0 |
| Broken Repair | 4 | 307 | 5 | 293 | 132 | 2.26 | 120 | 1.02 | 8 · 50 · 42 · 0 | – | 0 · 0 |
| Decogear | 4 | 390 | 55 | 273 | 117 | 2.45 | 59 | 0.91 | 21 · 33 · 45 · 1 | – | 0 · 3 |
| **Total** | 48 | 179–424 | 6 (max 55) | 243 | 99 | 2.46 | 120 | 0.78 | 6 · 58 · 36 · 1 | – | 0 · 4 |

A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).

## Compared with `before`

Before → now, for the games measured now. before: 60 runs, 238 ghosts on 13 games; now: 12 runs, 48 ghosts on 9 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 100 % → 100 % | 14 → 12 | 21 → 70 | 87 → 97 | 30 → 78 | 0 % → 8 % | 0.8 → 0 | 8 → 3 | 102 → 417 |
| Find All Pages | 79 % → 100 % | 4 → 12 | 22 → 110 | 74 → 99 | 9 → 31 | 19 % → 36 % | 0.2 → 0.1 | 57 → 68 | 72 → 285 |
| SpaceTaxi | 100 % → 100 % | 4 → 7 | 29 → 106 | 90 → 94 | 46 → 172 | 3 % → 0 % | 0.6 → 0 | 1 → 2 | 59 → 220 |
| Coiner | 100 % → 100 % | 4 → 8 | 25 → 90 | 95 → 96 | 38 → 87 | 0 % → 3 % | 1.8 → 0 | 22 → 36 | 58 → 179 |
| Backout | 100 % → 100 % | 12 → 48 | 21 → 94 | 94 → 95 | 42 → 154 | 0 % → 0 % | 0.4 → 0.2 | 1 → 0 | 83 → 267 |
| Big Champ | 83 % → 100 % | 6 → 23 | 28 → 116 | 65 → 72 | 45 → 150 | 2 % → 0 % | 2.6 → 0 | 29 → 36 | 60 → 224 |
| Dead Again | 100 % → 100 % | 5 → 12 | 26 → 96 | 80 → 79 | 32 → 90 | 0 % → 3 % | 3.3 → 0.5 | 21 → 12 | 60 → 188 |
| Broken Repair | 80 % → 100 % | 89 → 34 | 25 → 132 | 70 → 93 | 22 → 152 | 9 % → 0 % | 0 → 0.6 | 79 → 99 | 402 → 307 |
| Decogear | 0 % → 25 % | – → 214 | 19 → 117 | 5 → 28 | 26 → 28 | 0 % → 73 % | 2.7 → 0.4 | 25 → 19 | 97 → 390 |
| **Total** | 88 % → 94 % | 5 → 13 | 24 → 99 | 80 → 88 | 31 → 89 | 5 % → 15 % | 1.6 → 0.2 | 21 → 32 | 64 → 274 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 102 → 417 | 94 → 365 | 21 → 70 | 4.81 → 4.71 | 0.51 → 0.55 | 42 % → 42 % | 2 → 5 |
| Find All Pages | 72 → 285 | 59 → 244 | 22 → 110 | 2.48 → 2.38 | 0.66 → 0.83 | 81 % → 86 % | 5 → 6 |
| SpaceTaxi | 59 → 220 | 56 → 192 | 29 → 106 | 2.01 → 1.83 | 0.70 → 0.85 | 68 % → 68 % | 5 → 8 |
| Coiner | 58 → 179 | 52 → 168 | 25 → 90 | 2.08 → 1.81 | 0.65 → 0.72 | 76 % → 80 % | 4 → 7 |
| Backout | 83 → 267 | 75 → 246 | 21 → 94 | 3.51 → 2.71 | 0.54 → 0.60 | 53 % → 57 % | 0 → 8 |
| Big Champ | 60 → 224 | 58 → 192 | 28 → 116 | 2.21 → 1.80 | 0.72 → 0.91 | 62 % → 55 % | 4 → 27 |
| Dead Again | 60 → 188 | 57 → 181 | 26 → 96 | 2.21 → 1.82 | 0.67 → 0.76 | 64 % → 66 % | 5 → 5 |
| Broken Repair | 402 → 307 | 398 → 293 | 25 → 132 | 13.02 → 2.26 | 0.93 → 1.02 | 11 % → 50 % | 0 → 5 |
| Decogear | 97 → 390 | 112 → 273 | 19 → 117 | 5.84 → 2.45 | 1.13 → 0.91 | 19 % → 33 % | 5 → 55 |
| **Total** | 64 → 274 | 59 → 243 | 24 → 99 | 3.26 → 2.46 | 0.68 → 0.78 | 48 % → 58 % | 5 → 6 |

## Escape from Death Hole

js13k · https://play.js13kgames.com/escape-from-death-hole

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12cecc1fce (23-11 18:29) | 424 | 2 | 3.3 | 53 · 72 · 69 · 156 | 13 · 12 · 12 · 13 | 0 · 1 · 2 · 97 | 67 · 87 · 89 · 72 | ▃▇███▅▅▃▅▅▄▅▃▄▂▂▂▃·▁▂▃▁·▂·▂▁▂··▁ | 4 · 50 s | 0 / 4 | 5 · 95 | TLLR | $0.073 |
| de9211eb9c (23-11 18:44) | 410 | 4 | 2.9 | 67 · 80 · 59 · 71 | 13 · 13 · 12 · 11 | 0 · 1 · 2 · 97 | 75 · 88 · 67 · 80 | ▄▇█▇▆▄▄▄▃▄▄▆▃▅▃▄▁ | 0 | 0 / 6 | 1 · 99 | TTTT | $0.078 |

## Find All Pages

js13k · https://play.js13kgames.com/find-all-pages

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9edfeeb523 (23-11 18:36) | 280 | 1 | 1.8 | 85 · 110 · 83 · 109 | 13 · 15 · 6 · 11 | 0 · 0 · 0 · 100 | 29 · 32 · 27 · 67 | ▄▃▆█▆▂▄▁▅▆▃▂▂▃▃▅▂▂▃▁·▁· | 7 · 126 s | 0 / 29 | 61 · 39 | TTTT | $0.120 |
| a1b876444b (23-11 18:51) | 291 | 1 | 2.3 | 117 · 111 · 113 · 90 | 11 · 20 · 11 · 16 | 0 · 1 · 0 · 99 | 33 · 24 · 41 · 17 | ▆▂▄▇▂▄▅█▄▄▇▅▄▃▂▅▂▃▂▃▄▂▁· | 12 · 172 s | 1 / 30 | 76 · 25 | TTTA | $0.146 |

## SpaceTaxi

js13k · https://play.js13kgames.com/spacetaxi

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24c260dc4f (23-11 18:56) | 220 | 1 | 1.6 | 119 · 93 · 66 · 150 | 7 · 6 · 7 · 8 | 0 · 4 · 1 · 94 | 186 · 157 · 79 · 220 | ▁▇██▇▇█▇▇▅▆▇▅▄▄▆▇█▆▇█▆████▇█▂▂▁ | 0 | 0 / 9 | 2 · 98 | TTTR | $0.075 |

## Coiner

js13k · https://play.js13kgames.com/coiner

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bd6e83af6b (23-11 18:59) | 179 | 1 | 1.4 | 107 · 82 · 88 · 92 | 8 · 8 · 8 · 8 | 0 · 4 · 0 · 96 | 100 · 52 · 73 · 107 | █▅▇▆▄▆▆▂▃▄▄▄▅▅▃▅▅▅▃·▅▁ | 1 · 11 s | 0 / 9 | 36 · 44 | TTTA | $0.086 |

## Backout

js13k · https://play.js13kgames.com/backout

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 875e73e33c (23-11 19:03) | 267 | 7 | 1.8 | 95 · 110 · 68 · 92 | 48 · 49 · 46 · 48 | 0 · 2 · 3 · 95 | 161 · 191 · 116 · 147 | ▅▃▅▇█████▇▇▇█▆█▇█▇▆▅▇█ | 0 | 1 / 2 | 0 · 68 | TTTT | $0.073 |

## Big Champ

js13k · https://play.js13kgames.com/big-champ

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 85f09a3b98 (23-11 18:04) | 249 | 5 | 1.9 | 117 · 120 · 104 · 45 | 29 · 26 · 26 · 28 | 2 · 6 · 18 · 74 | 172 · 146 · 137 · 60 | ▅▄▆█▆▆▆▇▅▆▇▅▇▆▅▇▅▅▆▅▆▅▅▅ | 0 | 0 / 8 | 43 · 55 | TTTA | $0.057 |
| 98ca876c00 (23-11 19:07) | 199 | 3 | 1.5 | 116 · 143 · 119 · 87 | 19 · 19 · 20 · 19 | 0 · 9 · 21 · 71 | 153 · 171 · 163 · 112 | ▆▄▆██▇▆▆▇▅▇▇▆▆▆▆▇▅▇▆▆▅▆▄▅▄▄▅▂ | 0 | 0 / 5 | 29 · 67 | TTTA | $0.066 |

## Dead Again

js13k · https://play.js13kgames.com/dead-again

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| f7aabf3f81 (23-11 19:11) | 188 | 3 | 1.4 | 90 · 109 · 103 · 68 | 10 · 12 · 13 · 11 | 0 · 0 · 21 · 79 | 82 · 98 · 102 · 68 | ▆▂██▆█▆▇▇▇▇▇▆█▆▅▅▇▆▇▆▃ | 1 · 11 s | 2 / 4 | 12 · 90 | TTTA | $0.063 |

## Broken Repair

itch.io · https://eduardscarpato.itch.io/broken-repair

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 78306abc16 (23-11 18:09) | 307 | 19 | 2.3 | 124 · 132 · 131 · 135 | 32 · 36 · 31 · 46 | 1 · 6 · 0 · 93 | 139 · 141 · 162 · 179 | ▂▃█▆▇▇▆▅▅█▇█▇▇▇█▇▇▇▅▆▇▆▆▇▇▄· | 0 | 3 / 9 | 99 · 1 | TTTT | $0.081 |

## Decogear

itch.io · https://boghog.itch.io/decogear

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cacda43c48 (23-11 18:22) | 390 | 32 | 3.2 | 84 · 152 · 150 · 59 | 214 · ✗ · ✗ · ✗ | 1 · 71 · 0 · 28 | 118 · 28 · 27 · 26 | ▇█▇▂···▁▃▃▃▃▃▃▃▃▂·············· | 4 · 327 s | 1 / 17 | 19 · 84 | TRRA | $0.054 |

## How it is measured

- **Run length**: the real time of the run (`report.json` realMs): from opening the browser to the last ghost's end, without the wait in the queue or the report. **First frame**: from the run really starting to the first frame, of any ghost, that shows the game (its JPEG weighs at least half the median of that ghost's frames: black and loading screens weigh far less, so a 2 KB loading screen saved after 2 s does not count). A run starts when it leaves the server's queue (runs asked for together wait for each other): the last ghost's end minus realMs.
- **Real s per move**: per move, from the end of the move before (or the screen it decided on) to its last frame being written: thinking plus playing plus our own overhead. Taken from each step's `at` when the trace has it, else from the time each frame file was written.
- **Game s**: `trace.gameMs`, the game time each ghost played (the game clock stands still while the model thinks).
- **Reached real play**: the first move where the ghost says it is playing (`saw: playing`, and its thought does not speak of loading or a name screen), used an input, the screen answered (at least 0.3 % of a 64×36 grey grid changed by more than 24 levels during the move), and it stayed in the game (at least 2 of its next 3 moves are play or game over: intros that move by themselves do not count). Shown as real seconds from the start of the run to the end of that move (per run: one value per ghost, ✗ = never, – = did not move).
- **Moves %**: what the ghost said it saw, refined by its thought (the categories of `rediseno/v3/real-games/analyze_runs.py`): loading = loading, black screens and intros that play by themselves; menu = menus, title and name screens and anything else that is not the game; game over = it saw itself die or a game-over screen; play = playing or level complete. **% of game time playing**: the same, weighted by each move's game time.
- **Distinct screens**: a fingerprint of the frame every 0.5 s of game time, as Go-Explore's cells (the frame in grey shrunk to 11×8, 8 levels); the number of different fingerprints a ghost saw. The character moving to a new place makes a new fingerprint, as in Go-Explore; so do animations, which inflate the count on busy screens. **New screens every 5 s**: the novelty curve, averaged over the ghosts of the run. **Stall**: at least 10 s of game time without a fingerprint never seen before (also at the end of the game); the tables give the ghosts with at least one, and the share of all the game time spent in stalls (longer games have more room for them, so compare shares).
- **False "nothing happened"**: thoughts saying the last input did nothing (the regular expression of `rediseno/v3/real-games/modes.py`) while that move clearly changed the screen the ghost saw before and after it (mean grey change ≥ 3 levels on the grid, as the first analysis: a new screen, the view scrolling, something big moving), not counting loading screens. Smaller changes (a cursor, an animated background) are not counted, so this is a floor. "All" is every such thought, true or not (the first move of each ghost is left out, as before).
- **% click · keys**: moves with a click or drag, and moves with keys (a move can have both, also among the actions it chained after its first; the rest were waits).
- **Where the real time goes**: per ghost, from its start (`startedAt`) to its end (`endedAt`), split in start (to the first screen it decided on), model (each move's `latencyMs`), playing (the rest of each move's real time) and end (after its last move); shares of the real time of all the ghosts. **Real s per game s**: their real time over their game time (`trace.gameMs`, with the autopilot's). **Game s per answer**: the game time of their moves over the model's answers. **Report after the last ghost**: from the last ghost's end to `report.json` being written (the analyst; not in the run length). **Autopilot real s**: `trace.autopilot.wallMs` (recorded since 24 Nov). **Fewer frames · real time**: ghosts the watchdog moved to drawing fewer frames (`frameStepMs`), or to playing on in real time (`realTimeFrom`).
- **Endings**: `trace.outcome` as one letter; a ghost stopped by its own real-time budget is L even when the trace says time_up (`stopReason.kind` wall_time: it had played at least 60 s, not all its game time).
- **Cost**: the run's `report.json` cost (ghosts and analyst); priced from the traces when there is no report.
