# Real jam games — v3-hearing

3 runs, 12 ghosts, 801 moves on 3 games, measured from the recorded runs with no AI (`node bench/real-games.mjs v3-hearing 4b50a834f6 cb684a199a e81f0d8c26 --compare v3-speed`, 2026-11-24 18:28 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SpaceTaxi | 1 | 4 | 141 | 2 | 151 / 152 | 10 s (4/4) | 1 · 4 · 1 · 94 | 92 | 189 / 195 | 1/4 · 4 % | 0 / 0 | 2 · 99 | 4R | $0.045 |
| Coiner | 1 | 4 | 193 | 2.3 | 152 / 152 | 9 s (4/4) | 0 · 10 · 0 · 89 | 89 | 128 / 149 | 2/4 · 4 % | 0 / 6 | 91 · 1 | 4R | $0.062 |
| Big Champ | 1 | 4 | 216 | 2.9 | 151 / 154 | 21 s (4/4) | 2 · 7 · 20 · 71 | 69 | 226 / 234 | 0/4 | 0 / 5 | 97 · 1 | 4R | $0.052 |
| **Total** | 3 | 12 | 141–216 | 2.4 | 151 / 154 | 10 s (12/12) | 1 · 7 · 7 · 85 | 83 | 189 / 234 | 3/12 · 2 % | 0 / 11 | 65 · 32 | 12R | $0.159 |

Endings: T = used its moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = real-time limit (8 minutes for the run, or the ghost's own budget of 4.5 minutes, however much it had played) · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 0 of 12 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: no runs · js13k: median 2 s, max 4 s (3 runs) | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 151.3 s, max 153.9 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): no runs · js13k: median 193 s, max 216 s (3 runs) | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 3 of 3 | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 0 of 11 such thoughts; 0 per 100 moves (v3-speed: 0.2, −100 %) | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | 94 % of 551 moves | ≥ 60 % |

## Where the real time goes

| Game | Ghosts | Run length (s) | Report after the last ghost (s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Model answers per ghost (median) | Game s per answer | % of real time: start · model · playing · end | Autopilot real s (median) | Ghosts drawing fewer frames · in real time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SpaceTaxi | 4 | 141 | 5 | 136 | 151 | 0.88 | 64 | 2.34 | 3 · 54 · 42 · 1 | 3 | 0 · 0 |
| Coiner | 4 | 193 | 5 | 167 | 152 | 1.12 | 69 | 2.06 | 3 · 55 · 42 · 1 | 4 | 0 · 0 |
| Big Champ | 4 | 216 | 6 | 213 | 151 | 1.38 | 69 | 2.18 | 6 · 39 · 54 · 0 | 12.5 | 0 · 0 |
| **Total** | 12 | 141–216 | 5 (max 6) | 167 | 151 | 1.13 | 67 | 2.19 | 4 · 48 · 47 · 1 | 4 | 0 · 0 |

A run lasts as long as its slowest ghost. Start: to the first screen a ghost decided on (browser, page, game loading, autopilot). Model: waiting for its answers. Playing: the rest of the moves (drawing the game with its clock frozen, screenshots, our own checks). End: after the last move (exit interview, closing).

## Compared with `v3-speed`

Before → now, for the games measured now. v3-speed: 12 runs, 48 ghosts on 12 games; now: 3 runs, 12 ghosts on 3 games. The totals cover different games: compare game by game.

| Game | Ghosts that reached play | Reached play (median real s) | Game s per ghost (median) | % moves playing | Distinct screens (median) | % of game time in stalls | False "nothing happened" per 100 moves | % moves with a click | Run length (median s) |
|---|---|---|---|---|---|---|---|---|---|
| SpaceTaxi | 100 % → 100 % | 9 → 10 | 152 → 151 | 96 → 94 | 153 → 189 | 22 % → 4 % | 0 → 0 | 1 → 2 | 182 → 141 |
| Coiner | 100 % → 100 % | 12 → 9 | 152 → 152 | 90 → 89 | 92 → 128 | 15 % → 4 % | 0 → 0 | 41 → 91 | 191 → 193 |
| Big Champ | 100 % → 100 % | 20 → 21 | 151 → 151 | 64 → 71 | 190 → 226 | 0 % → 0 % | 0 → 0 | 60 → 97 | 195 → 216 |
| **Total** | 92 % → 100 % | 19 → 10 | 151 → 151 | 77 → 85 | 70 → 189 | 26 % → 2 % | 0.2 → 0 | 44 → 65 | 224 → 193 |

Real time, before → now:

| Game | Run length (median s) | Real s per ghost (median) | Game s per ghost (median) | Real s per game s | Game s per model answer | % of real time waiting for the model | Report after the last ghost (median s) |
|---|---|---|---|---|---|---|---|
| SpaceTaxi | 182 → 141 | 138 → 136 | 152 → 151 | 0.94 → 0.88 | 2.59 → 2.34 | 41 % → 54 % | 6 → 5 |
| Coiner | 191 → 193 | 178 → 167 | 152 → 152 | 1.16 → 1.12 | 1.84 → 2.06 | 49 % → 55 % | 7 → 5 |
| Big Champ | 195 → 216 | 182 → 213 | 151 → 151 | 1.23 → 1.38 | 2.14 → 2.18 | 34 % → 39 % | 9 → 6 |
| **Total** | 224 → 193 | 188 → 167 | 151 → 151 | 1.45 → 1.13 | 1.88 → 2.19 | 39 % → 48 % | 5 → 5 |

## SpaceTaxi

js13k · https://play.js13kgames.com/spacetaxi

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| e81f0d8c26 (24-11 18:25) | 141 | 2 | 2 | 152 · 151 · 150 · 151 | 10 · 10 · 8 · 9 | 1 · 4 · 1 · 94 | 154 · 188 · 190 · 195 | ▂██▇█▆▇▄▅▄▅▇▇▇▇█▆▅▄▅▅▅▄▅▅▄▅▃▆▅▂ | 1 · 23 s | 0 / 0 | 2 · 99 | RRRR | $0.045 |

## Coiner

js13k · https://play.js13kgames.com/coiner

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4b50a834f6 (24-11 18:17) | 193 | 2 | 2.3 | 152 · 152 · 152 · 150 | 8 · 9 · 8 · 9 | 0 · 10 · 0 · 89 | 149 · 138 · 117 · 113 | █▇▇▇▆██▅▅▆▆▄▂▆▅▂▅▄▃▂▃▆▃▂▂▃▃▂▄▄▁ | 2 · 22 s | 0 / 6 | 91 · 1 | RRRR | $0.062 |

## Big Champ

js13k · https://play.js13kgames.com/big-champ

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cb684a199a (24-11 18:21) | 216 | 4 | 2.9 | 151 · 150 · 152 · 154 | 18 · 21 · 25 · 20 | 2 · 7 · 20 · 71 | 200 · 230 · 221 · 234 | ▅▇███▇▆▇▇▆▆▇▇▅▆▅▆▇▆▆▇▅▆▆▆▆▅▅▅▄▂ | 0 | 0 / 5 | 97 · 1 | RRRR | $0.052 |

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
