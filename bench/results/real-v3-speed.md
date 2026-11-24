# Real jam games — v3-speed

12 runs, 48 ghosts, 2961 moves on 12 games, measured from the recorded runs with no AI (`node bench/real-games.mjs v3-speed --url js13kgames.com --url itch.io --since 2026-11-24T09:02Z --until 2026-11-24T09:50Z --compare before,v3`, 2026-11-24 10:32 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 1 | 4 | 277 | 3.3 | 116 / 131 | 20 s (4/4) | 0 · 1 · 0 · 99 | 93 | 75 / 92 | 2/4 · 9 % | 0 / 4 | 1 · 99 | 1A 3L | $0.045 |
| Find All Pages | 1 | 4 | 221 | 2.5 | 151 / 151 | 13 s (4/4) | 0 · 1 · 0 · 98 | 83 | 25 / 47 | 4/4 · 52 % | 0 / 11 | 87 · 26 | 4R | $0.107 |
| SpaceTaxi | 1 | 4 | 182 | 2.5 | 152 / 157 | 9 s (4/4) | 0 · 4 · 0 · 96 | 91 | 153 / 215 | 2/4 · 22 % | 0 / 3 | 1 · 99 | 4R | $0.040 |
| Coiner | 1 | 4 | 191 | 2.2 | 152 / 154 | 12 s (4/4) | 0 · 10 · 0 · 90 | 83 | 92 / 107 | 2/4 · 15 % | 0 / 11 | 41 · 43 | 4R | $0.063 |
| Backout | 1 | 4 | 278 | 3.3 | 133 / 152 | 33 s (4/4) | 0 · 7 · 4 · 89 | 77 | 221 / 265 | 0/4 | 0 / 0 | 0 · 97 | 1R 3L | $0.048 |
| Big Champ | 1 | 4 | 195 | 2.6 | 151 / 152 | 20 s (4/4) | 3 · 11 · 22 · 64 | 58 | 190 / 224 | 0/4 | 0 / 2 | 60 · 60 | 3R 1A | $0.046 |
| Dead Again | 1 | 4 | 227 | 2.3 | 151 / 151 | 12 s (4/4) | 0 · 0 · 32 · 67 | 60 | 130 / 163 | 0/4 | 0 / 0 | 26 · 82 | 3R 1A | $0.044 |
| Delete! | 1 | 4 | 138 | 2.2 | 113 / 152 | 21 s (4/4) | 21 · 35 · 1 · 42 | 36 | 48 / 67 | 3/4 · 19 % | 2 / 8 | 49 · 59 | 2R 2A | $0.035 |
| Moon Buggy | 1 | 4 | 187 | 3 | 151 / 153 | 15 s (4/4) | 2 · 14 · 18 · 67 | 49 | 23 / 48 | 4/4 · 60 % | 2 / 6 | 10 · 86 | 3R 1A | $0.046 |
| Broken Repair | 1 | 4 | 243 | 2.8 | 153 / 153 | 37 s (4/4) | 0 · 16 · 0 · 84 | 81 | 74 / 94 | 4/4 · 23 % | 2 / 11 | 98 · 3 | 4R | $0.059 |
| Decogear | 1 | 4 | 240 | 4 | 151 / 152 | never (0/4) | 6 · 94 · 0 · 0 | 0 | 30 / 30 | 4/4 · 84 % | 0 / 21 | 46 · 72 | 3R 1A | $0.040 |
| Prerolled | 1 | 4 | 279 | 4.1 | 116 / 120 | 53 s (4/4) | 5 · 26 · 0 · 70 | 71 | 69 / 79 | 4/4 · 25 % | 0 / 15 | 93 · 10 | 4L | $0.044 |
| **Total** | 12 | 48 | 138–279 | 2.9 | 151 / 157 | 19 s (44/48) | 2 · 15 · 6 · 77 | 66 | 70 / 265 | 29/48 · 26 % | 6 / 92 | 44 · 59 | 31R 7A 10L | $0.617 |

Endings: T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost's own budget of 4.5 minutes, however much it had played) · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 0 of 48 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: median 19 s, max 27 s (3 runs) · js13k: median 2 s, max 9 s (9 runs) | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 150.8 s, max 156.8 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): median 243 s, max 279 s (3 runs) · js13k: median 195 s, max 278 s (9 runs) | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 11 of 12 (not: Decogear) | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 6 of 92 such thoughts; 0.2 per 100 moves (before: 1.6, −87 %) | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | 49 % of 523 moves | ≥ 60 % |

## Where the real time goes

| Game | Ghosts | Run length (s) | Report after the last ghost (s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Model answers per ghost (median) | Game s per answer | % of real time: start · model · playing · end | Autopilot real s (median) | Ghosts drawing fewer frames · in real time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 4 | 277 | 1 | 273 | 116 | 2.34 | 77 | 1.41 | 5 · 31 · 64 · 1 | 10.6 | 4 · 0 |
| Find All Pages | 4 | 221 | 4 | 200 | 151 | 1.32 | 77 | 1.59 | 2 · 69 · 29 · 1 | 3.4 | 0 · 0 |
| SpaceTaxi | 4 | 182 | 6 | 138 | 152 | 0.94 | 49 | 2.59 | 3 · 41 · 55 · 1 | 4.3 | 0 · 0 |
| Coiner | 4 | 191 | 7 | 178 | 152 | 1.16 | 77 | 1.84 | 5 · 49 · 44 · 1 | 8.3 | 0 · 0 |
| Backout | 4 | 278 | 0 | 273 | 133 | 2 | 82 | 1.63 | 9 · 28 · 62 · 0 | 20.6 | 0 · 0 |
| Big Champ | 4 | 195 | 9 | 182 | 151 | 1.23 | 62 | 2.14 | 9 · 34 · 57 · 1 | 12.8 | 0 · 0 |
| Dead Again | 4 | 227 | 6 | 190 | 151 | 1.34 | 76 | 1.66 | 5 · 39 · 55 · 1 | 7.7 | 0 · 0 |
| Delete! | 4 | 138 | 6 | 107 | 113 | 0.94 | 42 | 2.22 | 17 · 43 · 39 · 1 | 16.8 | 0 · 0 |
| Moon Buggy | 4 | 187 | 6 | 156 | 151 | 1.09 | 45 | 2.27 | 5 · 35 · 59 · 1 | 7.6 | 0 · 0 |
| Broken Repair | 4 | 243 | 5 | 235 | 153 | 1.55 | 76 | 1.86 | 8 · 44 · 47 · 0 | 18.7 | 4 · 0 |
| Decogear | 4 | 240 | 5 | 217 | 151 | 1.51 | 48 | 2.02 | 11 · 31 · 58 · 1 | 20.2 | 4 · 0 |
| Prerolled | 4 | 279 | 5 | 274 | 116 | 2.36 | 61 | 1.84 | 9 · 33 · 58 · 1 | 23.4 | 0 · 0 |
| **Total** | 48 | 138–279 | 5 (max 9) | 188 | 151 | 1.45 | 65 | 1.88 | 7 · 39 · 53 · 1 | 12.8 | 12 · 0 |

A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).

## Compared with `before`

Before → now, for the games measured now. before: 60 runs, 238 ghosts on 13 games; now: 12 runs, 48 ghosts on 12 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 100 % → 100 % | 14 → 20 | 21 → 116 | 87 → 99 | 30 → 75 | 0 % → 9 % | 0.8 → 0 | 8 → 1 | 102 → 277 |
| Find All Pages | 79 % → 100 % | 4 → 13 | 22 → 151 | 74 → 98 | 9 → 25 | 19 % → 52 % | 0.2 → 0 | 57 → 87 | 72 → 221 |
| SpaceTaxi | 100 % → 100 % | 4 → 9 | 29 → 152 | 90 → 96 | 46 → 153 | 3 % → 22 % | 0.6 → 0 | 1 → 1 | 59 → 182 |
| Coiner | 100 % → 100 % | 4 → 12 | 25 → 152 | 95 → 90 | 38 → 92 | 0 % → 15 % | 1.8 → 0 | 22 → 41 | 58 → 191 |
| Backout | 100 % → 100 % | 12 → 33 | 21 → 133 | 94 → 89 | 42 → 221 | 0 % → 0 % | 0.4 → 0 | 1 → 0 | 83 → 278 |
| Big Champ | 83 % → 100 % | 6 → 20 | 28 → 151 | 65 → 64 | 45 → 190 | 2 % → 0 % | 2.6 → 0 | 29 → 60 | 60 → 195 |
| Dead Again | 100 % → 100 % | 5 → 12 | 26 → 151 | 80 → 67 | 32 → 130 | 0 % → 0 % | 3.3 → 0 | 21 → 26 | 60 → 227 |
| Delete! | 100 % → 100 % | 2 → 21 | 25 → 113 | 76 → 42 | 25 → 48 | 5 % → 19 % | 4.4 → 1.3 | 24 → 49 | 64 → 138 |
| Moon Buggy | 100 % → 100 % | 5 → 15 | 28 → 151 | 77 → 67 | 15 → 23 | 6 % → 60 % | 1.9 → 1 | 4 → 10 | 54 → 187 |
| Broken Repair | 80 % → 100 % | 89 → 37 | 25 → 153 | 70 → 84 | 22 → 74 | 9 % → 23 % | 0 → 0.7 | 79 → 98 | 402 → 243 |
| Decogear | 0 % → 0 % | – → – | 19 → 151 | 5 → 0 | 26 → 30 | 0 % → 84 % | 2.7 → 0 | 25 → 46 | 97 → 240 |
| Prerolled | – → 100 % | – → 53 | – → 116 | – → 70 | – → 69 | – → 25 % | – → 0 | – → 93 | – → 279 |
| **Total** | 88 % → 92 % | 5 → 19 | 24 → 151 | 80 → 77 | 31 → 70 | 5 % → 26 % | 1.6 → 0.2 | 21 → 44 | 64 → 224 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 102 → 277 | 94 → 273 | 21 → 116 | 4.81 → 2.34 | 0.51 → 1.41 | 42 % → 31 % | 2 → 1 |
| Find All Pages | 72 → 221 | 59 → 200 | 22 → 151 | 2.48 → 1.32 | 0.66 → 1.59 | 81 % → 69 % | 5 → 4 |
| SpaceTaxi | 59 → 182 | 56 → 138 | 29 → 152 | 2.01 → 0.94 | 0.70 → 2.59 | 68 % → 41 % | 5 → 6 |
| Coiner | 58 → 191 | 52 → 178 | 25 → 152 | 2.08 → 1.16 | 0.65 → 1.84 | 76 % → 49 % | 4 → 7 |
| Backout | 83 → 278 | 75 → 273 | 21 → 133 | 3.51 → 2 | 0.54 → 1.63 | 53 % → 28 % | 0 → 0 |
| Big Champ | 60 → 195 | 58 → 182 | 28 → 151 | 2.21 → 1.23 | 0.72 → 2.14 | 62 % → 34 % | 4 → 9 |
| Dead Again | 60 → 227 | 57 → 190 | 26 → 151 | 2.21 → 1.34 | 0.67 → 1.66 | 64 % → 39 % | 5 → 6 |
| Delete! | 64 → 138 | 60 → 107 | 25 → 113 | 1.97 → 0.94 | 0.78 → 2.22 | 73 % → 43 % | 5 → 6 |
| Moon Buggy | 54 → 187 | 47 → 156 | 28 → 151 | 1.76 → 1.09 | 0.70 → 2.27 | 74 % → 35 % | 6 → 6 |
| Broken Repair | 402 → 243 | 398 → 235 | 25 → 153 | 13.02 → 1.55 | 0.93 → 1.86 | 11 % → 44 % | 0 → 5 |
| Decogear | 97 → 240 | 112 → 217 | 19 → 151 | 5.84 → 1.51 | 1.13 → 2.02 | 19 % → 31 % | 5 → 5 |
| Prerolled | – → 279 | – → 274 | – → 116 | – → 2.36 | – → 1.84 | – → 33 % | 0 → 5 |
| **Total** | 64 → 224 | 59 → 188 | 24 → 151 | 3.26 → 1.45 | 0.68 → 1.88 | 48 % → 39 % | 5 → 5 |

## Compared with `v3`

Before → now, for the games measured now. v3: 12 runs, 48 ghosts on 9 games; now: 12 runs, 48 ghosts on 12 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 100 % → 100 % | 12 → 20 | 70 → 116 | 97 → 99 | 78 → 75 | 8 % → 9 % | 0 → 0 | 3 → 1 | 417 → 277 |
| Find All Pages | 100 % → 100 % | 12 → 13 | 110 → 151 | 99 → 98 | 31 → 25 | 36 % → 52 % | 0.1 → 0 | 68 → 87 | 285 → 221 |
| SpaceTaxi | 100 % → 100 % | 7 → 9 | 106 → 152 | 94 → 96 | 172 → 153 | 0 % → 22 % | 0 → 0 | 2 → 1 | 220 → 182 |
| Coiner | 100 % → 100 % | 8 → 12 | 90 → 152 | 96 → 90 | 87 → 92 | 3 % → 15 % | 0 → 0 | 36 → 41 | 179 → 191 |
| Backout | 100 % → 100 % | 48 → 33 | 94 → 133 | 95 → 89 | 154 → 221 | 0 % → 0 % | 0.2 → 0 | 0 → 0 | 267 → 278 |
| Big Champ | 100 % → 100 % | 23 → 20 | 116 → 151 | 72 → 64 | 150 → 190 | 0 % → 0 % | 0 → 0 | 36 → 60 | 224 → 195 |
| Dead Again | 100 % → 100 % | 12 → 12 | 96 → 151 | 79 → 67 | 90 → 130 | 3 % → 0 % | 0.5 → 0 | 12 → 26 | 188 → 227 |
| Delete! | – → 100 % | – → 21 | – → 113 | – → 42 | – → 48 | – → 19 % | – → 1.3 | – → 49 | – → 138 |
| Moon Buggy | – → 100 % | – → 15 | – → 151 | – → 67 | – → 23 | – → 60 % | – → 1 | – → 10 | – → 187 |
| Broken Repair | 100 % → 100 % | 34 → 37 | 132 → 153 | 93 → 84 | 152 → 74 | 0 % → 23 % | 0.6 → 0.7 | 99 → 98 | 307 → 243 |
| Decogear | 25 % → 0 % | 214 → – | 117 → 151 | 28 → 0 | 28 → 30 | 73 % → 84 % | 0.4 → 0 | 19 → 46 | 390 → 240 |
| Prerolled | – → 100 % | – → 53 | – → 116 | – → 70 | – → 69 | – → 25 % | – → 0 | – → 93 | – → 279 |
| **Total** | 94 % → 92 % | 13 → 19 | 99 → 151 | 88 → 77 | 89 → 70 | 15 % → 26 % | 0.2 → 0.2 | 32 → 44 | 274 → 224 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 417 → 277 | 365 → 273 | 70 → 116 | 4.71 → 2.34 | 0.55 → 1.41 | 42 % → 31 % | 5 → 1 |
| Find All Pages | 285 → 221 | 244 → 200 | 110 → 151 | 2.38 → 1.32 | 0.83 → 1.59 | 86 % → 69 % | 6 → 4 |
| SpaceTaxi | 220 → 182 | 192 → 138 | 106 → 152 | 1.83 → 0.94 | 0.85 → 2.59 | 68 % → 41 % | 8 → 6 |
| Coiner | 179 → 191 | 168 → 178 | 90 → 152 | 1.81 → 1.16 | 0.72 → 1.84 | 80 % → 49 % | 7 → 7 |
| Backout | 267 → 278 | 246 → 273 | 94 → 133 | 2.71 → 2 | 0.60 → 1.63 | 57 % → 28 % | 8 → 0 |
| Big Champ | 224 → 195 | 192 → 182 | 116 → 151 | 1.80 → 1.23 | 0.91 → 2.14 | 55 % → 34 % | 27 → 9 |
| Dead Again | 188 → 227 | 181 → 190 | 96 → 151 | 1.82 → 1.34 | 0.76 → 1.66 | 66 % → 39 % | 5 → 6 |
| Delete! | – → 138 | – → 107 | – → 113 | – → 0.94 | – → 2.22 | – → 43 % | – → 6 |
| Moon Buggy | – → 187 | – → 156 | – → 151 | – → 1.09 | – → 2.27 | – → 35 % | – → 6 |
| Broken Repair | 307 → 243 | 293 → 235 | 132 → 153 | 2.26 → 1.55 | 1.02 → 1.86 | 50 % → 44 % | 5 → 5 |
| Decogear | 390 → 240 | 273 → 217 | 117 → 151 | 2.45 → 1.51 | 0.91 → 2.02 | 33 % → 31 % | 55 → 5 |
| Prerolled | – → 279 | – → 274 | – → 116 | – → 2.36 | – → 1.84 | – → 33 % | – → 5 |
| **Total** | 274 → 224 | 243 → 188 | 99 → 151 | 2.46 → 1.45 | 0.78 → 1.88 | 58 % → 39 % | 6 → 5 |

## Escape from Death Hole

js13k · https://play.js13kgames.com/escape-from-death-hole

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5346c98394 (24-11 09:02) | 277 | 2 | 3.3 | 131 · 124 · 109 · 42 | 15 · 17 · 23 · 22 | 0 · 1 · 0 · 99 | 92 · 72 · 78 · 41 | ▅█▆▇▄▄▃▄▃▄▁▂▁▅▄▄▃▃▄▂▃▂▃▂▅·· | 2 · 35 s | 0 / 4 | 1 · 99 | LLLA | $0.045 |

## Find All Pages

js13k · https://play.js13kgames.com/find-all-pages

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7c458f635c (24-11 09:07) | 221 | 1 | 2.5 | 151 · 151 · 151 · 151 | 13 · 13 · 19 · 11 | 0 · 1 · 0 · 98 | 19 · 23 · 47 · 27 | █▁▇▃█▄▆▇▄▂▅▁▅▃▅▂▄▂▃▃▆▂▃▂▆▂▃▄▁▂▁ | 17 · 312 s | 0 / 11 | 87 · 26 | RRRR | $0.107 |

## SpaceTaxi

js13k · https://play.js13kgames.com/spacetaxi

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fdf35f898e (24-11 09:10) | 182 | 2 | 2.5 | 152 · 157 · 152 · 150 | 9 · 12 · 9 · 8 | 0 · 4 · 0 · 96 | 100 · 68 · 205 · 215 | ▁▇██▇▆▅▅▃▄▄▄▅▅▅▅▄▃▄▅▂▄▃▄▇▇▆▄▃▂▁· | 9 · 133 s | 0 / 3 | 1 · 99 | RRRR | $0.040 |

## Coiner

js13k · https://play.js13kgames.com/coiner

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6ab5112c12 (24-11 09:14) | 191 | 2 | 2.2 | 151 · 154 · 151 · 153 | 12 · 12 · 12 · 12 | 0 · 10 · 0 · 90 | 102 · 63 · 81 · 107 | █▅█▆▃▄▇▂▃▃▄▂▃▆▄▃▂▃▂▂▂▁▁▂▃▂▂▂▂▂▂ | 5 · 90 s | 0 / 11 | 41 · 43 | RRRR | $0.063 |

## Backout

js13k · https://play.js13kgames.com/backout

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2c7ec99bfa (24-11 09:17) | 278 | 9 | 3.3 | 132 · 152 · 133 · 125 | 33 · 33 · 34 · 33 | 0 · 7 · 4 · 89 | 216 · 265 · 225 · 200 | ▄▂▄█████████▇██▇██▇▇█▇▇▇▇▅▆▆▇█▄ | 0 | 0 / 0 | 0 · 97 | LRLL | $0.048 |

## Big Champ

js13k · https://play.js13kgames.com/big-champ

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| d73c85b35d (24-11 09:22) | 195 | 3 | 2.6 | 151 · 151 · 152 · 59 | 18 · 20 · 23 · 19 | 3 · 11 · 22 · 64 | 197 · 183 · 224 · 80 | ▆▆▇█▇▇▇▇▇▄▆▅▅▆▇▆▆▆▆▅▆▅▅▆▅▆▆▅▅▅▂ | 0 | 0 / 2 | 60 · 60 | RRRA | $0.046 |

## Dead Again

js13k · https://play.js13kgames.com/dead-again

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 851a2f005b (24-11 09:25) | 227 | 5 | 2.3 | 150 · 151 · 151 · 31 | 12 · 12 · 12 · 13 | 0 · 0 · 32 · 67 | 133 · 126 · 163 · 29 | ▆▂█▇█▆▆▇▆▆▅▄▅▅█▇▄▅▅▇▅▆▇▄▅▅▇▄▄▅▁ | 0 | 0 / 0 | 26 · 82 | RRRA | $0.044 |

## Delete!

js13k · https://play.js13kgames.com/delete

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| db8ef23ada (24-11 09:29) | 138 | 1 | 2.2 | 152 · 76 · 151 · 45 | 23 · 21 · 20 · 21 | 21 · 35 · 1 · 42 | 67 · 32 · 61 · 34 | ▇▆▄▇█▅▄▁▃▂▃▂▂▂▂▁▄▂▄▂▂▃···▂▂▄▃▂· | 5 · 81 s | 2 / 8 | 49 · 59 | RARA | $0.035 |

## Moon Buggy

js13k · https://play.js13kgames.com/moon-buggy-racing

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7797922cef (24-11 09:31) | 187 | 2 | 3 | 151 · 153 · 152 · 120 | 15 · 15 · 16 · 15 | 2 · 14 · 18 · 67 | 16 · 48 · 29 · 14 | ▆██▃▂▁▃▄▁▃▃▂▄▂▃▂▂▁▂▃·▃▂▂▅▁▅▂·█· | 14 · 347 s | 2 / 6 | 10 · 86 | RRRA | $0.046 |

## Broken Repair

itch.io · https://eduardscarpato.itch.io/broken-repair

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8ffa6199a7 (24-11 09:35) | 243 | 16 | 2.8 | 153 · 153 · 152 · 150 | 35 · 39 · 30 · 71 | 0 · 16 · 0 · 84 | 94 · 60 · 87 · 49 | ▃▄█▇█▆▄▄▇▄▆▆▇▅▃▆▅▂▄▄▆▆▅▆▃▃▁▃▁▂▂ | 10 · 139 s | 2 / 11 | 98 · 3 | RRRR | $0.059 |

## Decogear

itch.io · https://boghog.itch.io/decogear

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16c13919ca (24-11 09:44) | 240 | 19 | 4 | 151 · 152 · 151 · 49 | ✗ · ✗ · ✗ · ✗ | 6 · 94 · 0 · 0 | 30 · 30 · 30 · 28 | █▇█▂▁▁························· | 5 · 420 s | 0 / 21 | 46 · 72 | RRRA | $0.040 |

## Prerolled

itch.io · https://red-sauce.itch.io/prerolled

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24a0a42074 (24-11 09:39) | 279 | 27 | 4.1 | 117 · 116 · 120 · 113 | 90 · 53 · 51 · 53 | 5 · 26 · 0 · 70 | 73 · 79 · 60 · 65 | ██▄▄▂▁▂▅▄▂▂▂▄▃▂▂▂▅▅▂▃▃▁▂ | 9 · 119 s | 0 / 15 | 93 · 10 | LLLL | $0.044 |

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
