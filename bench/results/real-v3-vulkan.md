# Real jam games — v3-vulkan

3 runs, 12 ghosts, 876 moves on 3 games, measured from the recorded runs with no AI (`node bench/real-games.mjs v3-vulkan c8c43ec3e7 3fe839022e 3e8cd742f2 --compare v3-speed`, 2026-11-24 17:56 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Broken Repair | 1 | 4 | 274 | 3 | 145 / 151 | 37 s (4/4) | 4 · 18 · 0 · 78 | 75 | 82 / 85 | 3/4 · 23 % | 1 / 15 | 95 · 6 | 1R 3L | $0.065 |
| Decogear | 1 | 4 | 276 | 3.7 | 110 / 121 | 58 s (4/4) | 1 · 9 · 2 · 88 | 76 | 212 / 235 | 0/4 | 1 / 1 | 1 · 98 | 4L | $0.038 |
| Prerolled | 1 | 4 | 256 | 3.1 | 151 / 151 | 67 s (4/4) | 5 · 35 · 0 · 60 | 60 | 82 / 97 | 4/4 · 21 % | 1 / 7 | 97 · 3 | 4R | $0.056 |
| **Total** | 3 | 12 | 256–276 | 3.3 | 145 / 151 | 55 s (12/12) | 4 · 21 · 0 · 75 | 70 | 86 / 235 | 7/12 · 16 % | 3 / 23 | 70 · 31 | 5R 7L | $0.159 |

Endings: T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost's own budget of 4.5 minutes, however much it had played) · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 0 of 12 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: median 15 s, max 31 s (3 runs) · js13k: no runs | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 145.1 s, max 151.3 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): median 274 s, max 276 s (3 runs) · js13k: no runs | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 3 of 3 | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 3 of 23 such thoughts; 0.3 per 100 moves (v3-speed: 0.2, +69 %) | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | not measured | ≥ 60 % |

## Where the real time goes

| Game | Ghosts | Run length (s) | Report after the last ghost (s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Model answers per ghost (median) | Game s per answer | % of real time: start · model · playing · end | Autopilot real s (median) | Ghosts drawing fewer frames · in real time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Broken Repair | 4 | 274 | 5 | 272 | 145 | 1.87 | 84 | 1.63 | 8 · 43 · 48 · 0 | 21.4 | 0 · 0 |
| Decogear | 4 | 276 | 1 | 274 | 110 | 2.43 | 63 | 1.56 | 15 · 28 · 57 · 1 | 18.3 | 0 · 0 |
| Prerolled | 4 | 256 | 7 | 253 | 151 | 1.65 | 74 | 1.85 | 3 · 43 · 53 · 0 | 3.9 | 0 · 0 |
| **Total** | 12 | 256–276 | 5 (max 7) | 272 | 145 | 1.94 | 74 | 1.69 | 9 · 38 · 53 · 0 | 18.5 | 0 · 0 |

A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).

## Compared with `v3-speed`

Before → now, for the games measured now. v3-speed: 12 runs, 48 ghosts on 12 games; now: 3 runs, 12 ghosts on 3 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| Broken Repair | 100 % → 100 % | 37 → 37 | 153 → 145 | 84 → 78 | 74 → 82 | 23 % → 23 % | 0.7 → 0.3 | 98 → 95 | 243 → 274 |
| Decogear | 0 % → 100 % | – → 58 | 151 → 110 | 0 → 88 | 30 → 212 | 84 % → 0 % | 0 → 0.4 | 46 → 1 | 240 → 276 |
| Prerolled | 100 % → 100 % | 53 → 67 | 116 → 151 | 70 → 60 | 69 → 82 | 25 % → 21 % | 0 → 0.3 | 93 → 97 | 279 → 256 |
| **Total** | 92 % → 100 % | 19 → 55 | 151 → 145 | 77 → 75 | 70 → 86 | 26 % → 16 % | 0.2 → 0.3 | 44 → 70 | 224 → 274 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| Broken Repair | 243 → 274 | 235 → 272 | 153 → 145 | 1.55 → 1.87 | 1.86 → 1.63 | 44 % → 43 % | 5 → 5 |
| Decogear | 240 → 276 | 217 → 274 | 151 → 110 | 1.51 → 2.43 | 2.02 → 1.56 | 31 % → 28 % | 5 → 1 |
| Prerolled | 279 → 256 | 274 → 253 | 116 → 151 | 2.36 → 1.65 | 1.84 → 1.85 | 33 % → 43 % | 5 → 7 |
| **Total** | 224 → 274 | 188 → 272 | 151 → 145 | 1.45 → 1.94 | 1.88 → 1.69 | 39 % → 38 % | 5 → 5 |

## Broken Repair

itch.io · https://eduardscarpato.itch.io/broken-repair

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c8c43ec3e7 (24-11 17:25) | 274 | 8 | 3 | 142 · 148 · 140 · 151 | 36 · 32 · 37 · 52 | 4 · 18 · 0 · 78 | 85 · 56 · 84 · 80 | ▃▄▇▇▇█▇▆▅▄▅▄▅▃▃▁▂▂▃▂▂▂▃▄▃▃▂▂▁▂· | 9 · 135 s | 1 / 15 | 95 · 6 | LLLR | $0.065 |

## Decogear

itch.io · https://boghog.itch.io/decogear

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3fe839022e (24-11 17:30) | 276 | 31 | 3.7 | 109 · 121 · 111 · 109 | 58 · 66 · 58 · 57 | 1 · 9 · 2 · 88 | 210 · 235 · 214 · 204 | ▇█▆▅██████████████████▆█▃ | 0 | 1 / 1 | 1 · 98 | LLLL | $0.038 |

## Prerolled

itch.io · https://red-sauce.itch.io/prerolled

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3e8cd742f2 (24-11 17:48) | 256 | 15 | 3.1 | 151 · 151 · 151 · 151 | 98 · 86 · 47 · 34 | 5 · 35 · 0 · 60 | 86 · 97 · 51 · 78 | ▅▆█▅▃▃▃▃▂▂▂▃▃▄▃▁▃▃▁▃▂·▂▃▂▁▂▂▂▁▁ | 10 · 130 s | 1 / 7 | 97 · 3 | RRRR | $0.056 |

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
