# Real jam games — v3-speed-extra

4 runs, 16 ghosts, 1050 moves on 4 games, measured from the recorded runs with no AI (`node bench/real-games.mjs v3-speed-extra 2026-11-24T09-50-02-782Z-e73a725461 2026-11-24T10-27-41-367Z-f574f92f5b 2026-11-24T10-32-22-118Z-4761f20697 2026-11-24T10-37-15-060Z-da278eb18b --compare before,v3-speed`, 2026-11-24 10:46 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 1 | 4 | 274 | 3.1 | 113 / 119 | 11 s (4/4) | 0 · 1 · 4 · 95 | 90 | 135 / 145 | 0/4 | 1 / 3 | 1 · 99 | 4L | $0.062 |
| NILO | 1 | 4 | 280 | 4.1 | 143 / 149 | 13 s (4/4) | 0 · 5 · 0 · 95 | 76 | 25 / 40 | 4/4 · 64 % | 1 / 2 | 6 · 94 | 4L | $0.055 |
| Decogear | 1 | 4 | 168 | 3 | 151 / 151 | 58 s (4/4) | 6 · 19 · 9 · 66 | 63 | 109 / 128 | 0/4 | 5 / 12 | 20 · 76 | 4R | $0.038 |
| Prerolled | 1 | 4 | 258 | 3 | 150 / 151 | 55 s (3/4) | 4 · 36 · 0 · 60 | 52 | 71 / 87 | 4/4 · 29 % | 1 / 8 | 91 · 7 | 3R 1A | $0.046 |
| **Total** | 4 | 16 | 168–280 | 3.3 | 147 / 151 | 15 s (15/16) | 2 · 14 · 3 · 81 | 69 | 86 / 145 | 8/16 · 24 % | 8 / 25 | 28 · 72 | 7R 1A 8L | $0.201 |

Endings: T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost's own budget of 4.5 minutes, however much it had played) · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 0 of 16 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: median 21 s, max 22 s (2 runs) · js13k: median 1 s, max 2 s (2 runs) | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 146.5 s, max 151 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): median 213 s, max 258 s (2 runs) · js13k: median 277 s, max 280 s (2 runs) | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 4 of 4 | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 8 of 25 such thoughts; 0.8 per 100 moves (before: 1.6, −52 %) | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | not measured | ≥ 60 % |

## Where the real time goes

| Game | Ghosts | Run length (s) | Report after the last ghost (s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Model answers per ghost (median) | Game s per answer | % of real time: start · model · playing · end | Autopilot real s (median) | Ghosts drawing fewer frames · in real time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 4 | 274 | 6 | 272 | 113 | 2.40 | 86 | 1.26 | 1 · 36 · 63 · 0 | 2.2 | 3 · 0 |
| NILO | 4 | 280 | 36 | 275 | 143 | 1.94 | 65 | 1.72 | 2 · 31 · 67 · 0 | 3.9 | 4 · 0 |
| Decogear | 4 | 168 | 8 | 165 | 151 | 1.09 | 47 | 3.03 | 13 · 31 · 56 · 1 | 20.5 | 0 · 4 |
| Prerolled | 4 | 258 | 4 | 209 | 150 | 1.44 | 65 | 1.98 | 2 · 38 · 59 · 1 | 3.3 | 2 · 0 |
| **Total** | 16 | 168–280 | 7 (max 36) | 263 | 147 | 1.67 | 65 | 1.86 | 3 · 34 · 62 · 0 | 3.7 | 9 · 4 |

A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).

## Compared with `before`

Before → now, for the games measured now. before: 60 runs, 238 ghosts on 13 games; now: 4 runs, 16 ghosts on 4 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 100 % → 100 % | 14 → 11 | 21 → 113 | 87 → 95 | 30 → 135 | 0 % → 0 % | 0.8 → 0.3 | 8 → 1 | 102 → 274 |
| NILO | 100 % → 100 % | 7 → 13 | 25 → 143 | 93 → 95 | 11 → 25 | 34 % → 64 % | 3.1 → 0.4 | 9 → 6 | 55 → 280 |
| Decogear | 0 % → 100 % | – → 58 | 19 → 151 | 5 → 66 | 26 → 109 | 0 % → 0 % | 2.7 → 2.7 | 25 → 20 | 97 → 168 |
| Prerolled | – → 75 % | – → 55 | – → 150 | – → 60 | – → 71 | – → 29 % | – → 0.4 | – → 91 | – → 258 |
| **Total** | 88 % → 94 % | 5 → 15 | 24 → 147 | 80 → 81 | 31 → 86 | 5 % → 24 % | 1.6 → 0.8 | 21 → 28 | 64 → 266 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 102 → 274 | 94 → 272 | 21 → 113 | 4.81 → 2.40 | 0.51 → 1.26 | 42 % → 36 % | 2 → 6 |
| NILO | 55 → 280 | 53 → 275 | 25 → 143 | 2.15 → 1.94 | 0.61 → 1.72 | 75 % → 31 % | 5 → 36 |
| Decogear | 97 → 168 | 112 → 165 | 19 → 151 | 5.84 → 1.09 | 1.13 → 3.03 | 19 % → 31 % | 5 → 8 |
| Prerolled | – → 258 | – → 209 | – → 150 | – → 1.44 | – → 1.98 | – → 38 % | 0 → 4 |
| **Total** | 64 → 266 | 59 → 263 | 24 → 147 | 3.26 → 1.67 | 0.68 → 1.86 | 48 % → 34 % | 5 → 7 |

## Compared with `v3-speed`

Before → now, for the games measured now. v3-speed: 12 runs, 48 ghosts on 12 games; now: 4 runs, 16 ghosts on 4 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 100 % → 100 % | 20 → 11 | 116 → 113 | 99 → 95 | 75 → 135 | 9 % → 0 % | 0 → 0.3 | 1 → 1 | 277 → 274 |
| NILO | – → 100 % | – → 13 | – → 143 | – → 95 | – → 25 | – → 64 % | – → 0.4 | – → 6 | – → 280 |
| Decogear | 0 % → 100 % | – → 58 | 151 → 151 | 0 → 66 | 30 → 109 | 84 % → 0 % | 0 → 2.7 | 46 → 20 | 240 → 168 |
| Prerolled | 100 % → 75 % | 53 → 55 | 116 → 150 | 70 → 60 | 69 → 71 | 25 % → 29 % | 0 → 0.4 | 93 → 91 | 279 → 258 |
| **Total** | 92 % → 94 % | 19 → 15 | 151 → 147 | 77 → 81 | 70 → 86 | 26 % → 24 % | 0.2 → 0.8 | 44 → 28 | 224 → 266 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 277 → 274 | 273 → 272 | 116 → 113 | 2.34 → 2.40 | 1.41 → 1.26 | 31 % → 36 % | 1 → 6 |
| NILO | – → 280 | – → 275 | – → 143 | – → 1.94 | – → 1.72 | – → 31 % | – → 36 |
| Decogear | 240 → 168 | 217 → 165 | 151 → 151 | 1.51 → 1.09 | 2.02 → 3.03 | 31 % → 31 % | 5 → 8 |
| Prerolled | 279 → 258 | 274 → 209 | 116 → 150 | 2.36 → 1.44 | 1.84 → 1.98 | 33 % → 38 % | 5 → 4 |
| **Total** | 224 → 266 | 188 → 263 | 151 → 147 | 1.45 → 1.67 | 1.88 → 1.86 | 39 % → 34 % | 5 → 7 |

## Escape from Death Hole

js13k · https://play.js13kgames.com/escape-from-death-hole

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| f574f92f5b (24-11 10:27) | 274 | 2 | 3.1 | 112 · 113 · 110 · 119 | 11 · 9 · 11 · 11 | 0 · 1 · 4 · 95 | 121 · 145 · 141 · 129 | ▄▇█▇▆▅▅▆▄▆▄▅▄▆▆▆▆▆▆▄▄▄▂▁ | 0 | 1 / 3 | 1 · 99 | LLLL | $0.062 |

## NILO

js13k · http://localhost:5174/third-party/nilo/

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| e73a725461 (24-11 09:50) | 280 | 1 | 4.1 | 134 · 144 · 142 · 149 | 13 · 12 · 15 · 14 | 0 · 5 · 0 · 95 | 24 · 40 · 22 · 26 | ▆▇▇█▇▂▁·▃▃▂▄▂▁▁▄▃▁▂····▁▂▄▁▁▂· | 18 · 363 s | 1 / 2 | 6 · 94 | LLLL | $0.055 |

## Decogear

itch.io · https://boghog.itch.io/decogear

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| da278eb18b (24-11 10:37) | 168 | 19 | 3 | 151 · 151 · 151 · 151 | 61 · 56 · 55 · 71 | 6 · 19 · 9 · 66 | 85 · 128 · 106 · 111 | █▅▁▂▁▃▃▄▄▄▅▄▄▅▅▆▅▆▅▄▅▅▅▄▄▅▄▇▅▆▁ | 0 | 5 / 12 | 20 · 76 | RRRR | $0.038 |

## Prerolled

itch.io · https://red-sauce.itch.io/prerolled

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4761f20697 (24-11 10:32) | 258 | 22 | 3 | 150 · 151 · 151 · 99 | 50 · 132 · 55 · ✗ | 4 · 36 · 0 · 60 | 68 · 87 · 74 · 37 | ▆██▄▂▂▃▃▅▁▂▂▄▂▂▄▁▂▂▃▂▄▂▂▃▂▂▄▂▂· | 12 · 162 s | 1 / 8 | 91 · 7 | RRRA | $0.046 |

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
