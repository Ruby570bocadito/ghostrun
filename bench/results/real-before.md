# Real jam games — before

60 runs, 238 ghosts, 7608 moves on 13 games, measured from the recorded runs with no AI (`node bench/real-games.mjs before --url js13kgames.com --url itch.io --url third-party/ --until 2026-11-23T17:45Z`, 2026-11-23 18:31 UTC). How each number is measured: [below](#how-it-is-measured).

## By game

| Game | Runs | Ghosts | Run length (s) | Real s per move | Game s per ghost (median / max) | Reached real play: median s (ghosts) | Moves % loading · menu · game over · play | % of game time playing | Distinct screens per ghost (median / max) | Stalls ≥ 10 s: ghosts · % of game time | False / all "nothing happened" | % moves click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Escape from Death Hole | 6 | 24 | 96–131 | 2.4 | 21 / 26 | 14 s (24/24) | 1 · 11 · 1 · 87 | 83 | 30 / 38 | 0/24 | 7 / 69 | 8 · 94 | 23T 1A | $0.152 |
| Find All Pages | 6 | 24 | 61–82 | 1.6 | 22 / 39 | 4 s (19/24) | 7 · 18 · 0 · 74 | 72 | 9 / 28 | 7/24 · 19 % | 2 / 110 | 57 · 48 | 15T 9A | $0.192 |
| SpaceTaxi | 6 | 24 | 56–63 | 1.4 | 29 / 38 | 4 s (24/24) | 1 · 8 · 1 · 90 | 88 | 46 / 64 | 2/24 · 3 % | 6 / 20 | 1 · 99 | 24T | $0.139 |
| Coiner | 6 | 24 | 56–61 | 1.3 | 25 / 35 | 4 s (24/24) | 0 · 5 · 0 · 95 | 93 | 38 / 52 | 0/24 | 16 / 123 | 22 · 65 | 21T 3A | $0.155 |
| Backout | 5 | 20 | 72–85 | 1.8 | 21 / 31 | 12 s (20/20) | 0 · 4 · 2 · 94 | 90 | 42 / 58 | 0/20 | 3 / 9 | 1 · 95 | 20T | $0.113 |
| Big Champ | 7 | 24/28 | 31–85 | 1.6 | 28 / 34 | 6 s (20/24) | 2 · 14 · 18 · 65 | 62 | 45 / 55 | 1/24 · 2 % | 21 / 71 | 29 · 73 | 18T 6A 4E | $0.134 |
| Dead Again | 5 | 16/20 | 58–69 | 1.5 | 26 / 35 | 5 s (16/16) | 1 · 3 · 16 · 80 | 72 | 32 / 49 | 0/16 | 20 / 46 | 21 · 80 | 13T 3A 4E | $0.088 |
| Delete! | 4 | 16 | 61–69 | 1.5 | 25 / 44 | 2 s (16/16) | 9 · 14 · 1 · 76 | 68 | 25 / 34 | 2/16 · 5 % | 24 / 53 | 24 · 79 | 10T 6A | $0.116 |
| Moon Buggy | 4 | 16 | 50–58 | 1.2 | 28 / 40 | 5 s (16/16) | 5 · 7 · 11 · 77 | 68 | 15 / 22 | 2/16 · 6 % | 11 / 38 | 4 · 94 | 14T 2A | $0.119 |
| NILO | 1 | 4 | 55 | 1.3 | 25 / 26 | 7 s (4/4) | 2 · 6 · 0 · 93 | 94 | 11 / 18 | 2/4 · 34 % | 5 / 11 | 9 · 91 | 4T | $0.043 |
| Broken Repair | 5 | 10/20 | 239–488 | 12.1 | 25 / 41 | 89 s (8/10) | 10 · 19 · 0 · 70 | 63 | 22 / 38 | 2/10 · 9 % | 0 / 21 | 79 · 17 | 4T 2A 10E 4L | $0.051 |
| Decogear | 4 | 14 | 49–164 | 5.1 | 19 / 24 | never (0/14) | 39 · 57 · 0 · 5 | 3 | 26 / 33 | 0/14 | 6 / 20 | 25 · 70 | 14C | $0.041 |
| Prerolled | 1 | 0/4 | – | – | – | – | – · – · – · – | – | – | – | 0 / 0 | – | 4E | $0.000 |
| **Total** | 60 | 216/238 | 31–488 | 2.1 | 24 / 44 | 5 s (191/216) | 4 · 11 · 5 · 80 | 74 | 31 / 64 | 18/216 · 5 % | 121 / 591 | 21 · 78 | 166T 32A 22E 4L 14C | $1.344 |

Endings: T = used its 40 moves · R = played all its game time · W = won · S = stopped early (nothing new) · A = gave up · E = error · L = 8-minute limit · C = cancelled. "Ghosts" a/b: b ghosts, a of them made at least one move (the others failed to start).

## Targets of rediseno/PLAN-V3.md, section 2

| Criterion | Measured | Target |
|---|---|---|
| Ghosts that end in an error | 22 of 238 | 0 |
| Time until the first game frame (from the start of the run) | itch.io: median 24 s, max 43 s (7 runs) · js13k: median 1 s, max 8 s (48 runs) | ≤ 15 s itch.io, ≤ 8 s js13k |
| Game time per ghost | median 23.8 s, max 43.8 s | ≥ 120 s |
| Length of a run of 4 ghosts | itch.io (WebGL): median 202 s, max 488 s (6 runs) · js13k: median 61 s, max 131 s (48 runs) | ≤ 300 s WebGL, ≤ 210 s js13k |
| Real games where they reach play (at least half of the ghosts that moved) | 11 of 13 (not: Decogear, Prerolled) | ≥ 11 of 13 |
| "Nothing happened" thoughts while the screen did change | 121 of 591 such thoughts; 1.6 per 100 moves | −70 % |
| Clicks in the mouse games (Big Champ, Coiner) | 25 % of 1692 moves | ≥ 60 % |

## Escape from Death Hole

js13k · https://play.js13kgames.com/escape-from-death-hole

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7a5a1afd2e (22-11 12:01) | 96 | 0 | 2.3 | 22 · 24 · 19 · 21 | 15 · 14 · 13 · 18 | 2 · 13 · 1 · 84 | 29 · 30 · 25 · 37 | ███▇▃ | 0 | 0 / 8 | 5 · 98 | TTTT | $0.031 |
| 8a056e9a62 (22-11 12:19) | 104 | 1 | 2.4 | 15 · 20 · 16 · 18 | 17 · 18 · 18 · 14 | 2 · 15 · 1 · 83 | 22 · 32 · 26 · 23 | ███▆▂ | 0 | 1 / 11 | 9 · 97 | TTTT | $0.027 |
| 64437e8189 (22-11 12:43) | 107 | 2 | 2.4 | 18 · 22 · 17 · 17 | 14 · 19 · 15 · 14 | 1 · 14 · 1 · 84 | 27 · 28 · 29 · 27 | ▇██▅▁ | 0 | 1 / 13 | 18 · 86 | TTTT | $0.026 |
| 8579dc64f3 (22-11 12:47) | 131 | 3 | 3 | 20 · 22 · 22 · 21 | 18 · 19 · 19 · 17 | 1 · 7 · 0 · 92 | 31 · 37 · 33 · 34 | ▇██▆▃ | 0 | 1 / 12 | 3 · 99 | TTTT | $0.026 |
| c752fe060f (22-11 13:13) | 98 | 1 | 2.3 | 23 · 24 · 20 · 21 | 11 · 8 · 8 · 9 | 1 · 5 · 1 · 94 | 35 · 32 · 31 · 25 | ▆█▇▆▂ | 0 | 3 / 10 | 2 · 98 | TTTT | $0.023 |
| 8a724e8533 (22-11 13:30) | 100 | 1 | 2.3 | 19 · 22 · 26 · 9 | 11 · 10 · 10 · 10 | 1 · 9 · 1 · 89 | 30 · 33 · 38 · 12 | █▇██▄▁ | 0 | 1 / 15 | 11 · 88 | TTTA | $0.020 |

## Find All Pages

js13k · https://play.js13kgames.com/find-all-pages

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25ddd98c86 (22-11 12:03) | 61 | 0 | 1.4 | 20 · 24 · 24 · 14 | 5 · 3 · ✗ · 3 | 2 · 27 · 0 · 71 | 13 · 14 · 3 · 10 | █▄▄▃▃ | 1 · 20 s | 1 / 22 | 46 · 62 | TTAA | $0.031 |
| 0590c2df92 (22-11 12:20) | 71 | 1 | 1.6 | 20 · 20 · 22 · 5 | 3 · 8 · ✗ · 3 | 2 · 28 · 2 · 69 | 10 · 9 · 3 · 3 | █▄▅▃· | 1 · 16 s | 0 / 24 | 73 · 36 | TTAA | $0.031 |
| bc7faa1ff9 (22-11 12:41) | 82 | 1 | 1.9 | 21 · 22 · 21 · 8 | 4 · 6 · ✗ · 8 | 4 · 29 · 0 · 67 | 7 · 8 · 3 · 5 | █▄·▄· | 1 · 17 s | 1 / 23 | 73 · 42 | TTTA | $0.035 |
| 309a9df2cf (22-11 12:50) | 73 | 1 | 1.7 | 30 · 25 · 38 · 13 | 4 · 4 · ✗ · 5 | 22 · 10 · 1 · 67 | 10 · 15 · 28 · 5 | █▃▃▅▂▂█▂ | 0 | 0 / 13 | 48 · 51 | TTTA | $0.032 |
| c1ccbb4376 (22-11 13:14) | 67 | 1 | 1.5 | 27 · 32 · 26 · 10 | 3 · 4 · 6 · 6 | 0 · 4 · 0 · 96 | 19 · 8 · 23 · 5 | █▆▆█▅▁▃ | 1 · 12 s | 0 / 15 | 42 · 57 | TTTA | $0.033 |
| 0459bad9f8 (22-11 13:32) | 75 | 0 | 1.7 | 35 · 39 · 27 · 15 | 3 · 3 · ✗ · 12 | 12 · 13 · 1 · 75 | 9 · 17 · 16 · 3 | █▃▁▁▂▂▂· | 3 · 37 s | 0 / 13 | 61 · 35 | TTAA | $0.031 |

## SpaceTaxi

js13k · https://play.js13kgames.com/spacetaxi

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0629b05ee8 (22-11 12:04) | 57 | 1 | 1.4 | 27 · 38 · 28 · 23 | 8 · 7 · 3 · 2 | 1 · 6 · 1 · 93 | 30 · 47 · 49 · 40 | ▇██▇▆▃·· | 1 · 11 s | 0 / 2 | 1 · 99 | TTTT | $0.022 |
| 545e282be7 (22-11 12:22) | 60 | 1 | 1.4 | 23 · 29 · 17 · 27 | 2 · 4 · 4 · 2 | 0 · 7 · 5 · 88 | 39 · 54 · 31 · 48 | ██▇█▇▆ | 0 | 1 / 2 | 2 · 99 | TTTT | $0.024 |
| 11489772c7 (22-11 12:51) | 63 | 1 | 1.5 | 27 · 32 · 30 · 29 | 4 · 5 · 5 · 5 | 0 · 5 · 1 · 94 | 40 · 61 · 52 · 37 | ██▇█▅▅▃ | 0 | 1 / 4 | 1 · 99 | TTTT | $0.025 |
| deec369b2f (22-11 13:15) | 56 | 1 | 1.4 | 23 · 28 · 30 · 30 | 4 · 3 · 2 · 3 | 2 · 8 · 1 · 89 | 34 · 52 · 38 · 45 | █▇▇▇▅▆· | 0 | 1 / 5 | 3 · 99 | TTTT | $0.021 |
| 78425426e9 (22-11 13:28) | 57 | 1 | 1.4 | 31 · 32 · 36 · 28 | 3 · 5 · 5 · 4 | 1 · 8 · 0 · 91 | 52 · 64 · 32 · 44 | ███▇█▆▃· | 1 · 10 s | 0 / 3 | 1 · 99 | TTTT | $0.025 |
| 500801017d (22-11 13:33) | 60 | 1 | 1.4 | 18 · 29 · 26 · 33 | 8 · 3 · 3 · 4 | 0 · 13 · 1 · 86 | 26 · 48 · 50 · 62 | ▇▇█▇█▅▆ | 0 | 3 / 4 | 2 · 98 | TTTT | $0.021 |

## Coiner

js13k · https://play.js13kgames.com/coiner

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2f7136f31a (22-11 12:05) | 56 | 1 | 1.2 | 22 · 23 · 20 · 30 | 4 · 2 · 5 · 3 | 0 · 5 · 0 · 95 | 38 · 39 · 37 · 36 | █▇█▇▂▂· | 0 | 1 / 3 | 5 · 58 | TTTT | $0.024 |
| 144111a998 (22-11 12:23) | 57 | 1 | 1.3 | 20 · 25 · 24 · 6 | 3 · 4 · 4 · 4 | 0 · 5 · 0 · 95 | 33 · 27 · 40 · 13 | █▅▇▄▄ | 0 | 2 / 8 | 16 · 63 | TTTA | $0.022 |
| a7210b12db (22-11 12:37) | 61 | 1 | 1.4 | 29 · 26 · 29 · 19 | 4 · 4 · 4 · 4 | 0 · 5 · 0 · 95 | 42 · 38 · 38 · 34 | ██▇▆▄▂ | 0 | 5 / 31 | 32 · 71 | TTTT | $0.029 |
| 44f669d650 (22-11 12:52) | 60 | 1 | 1.3 | 26 · 19 · 32 · 11 | 3 · 4 · 4 · 4 | 0 · 5 · 0 · 95 | 41 · 30 · 40 · 17 | ██▇▅▅▆▁ | 0 | 3 / 19 | 16 · 68 | TTTA | $0.025 |
| 7644d99b93 (22-11 13:16) | 59 | 1 | 1.3 | 27 · 31 · 23 · 31 | 3 · 3 · 3 · 3 | 1 · 5 · 0 · 94 | 39 · 52 · 29 · 49 | ███▇▃▇▂ | 0 | 5 / 25 | 33 · 64 | TTTT | $0.029 |
| b9be4bd514 (22-11 13:34) | 56 | 1 | 1.3 | 30 · 27 · 35 · 11 | 4 · 4 · 4 · 3 | 0 · 5 · 1 · 94 | 38 · 37 · 46 · 20 | ███▅▅▅▃· | 0 | 0 / 37 | 28 · 67 | TTTA | $0.026 |

## Backout

js13k · https://play.js13kgames.com/backout

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ae36dae798 (22-11 12:06) | 83 | 5 | 1.8 | 31 · 20 · 20 · 21 | 9 · 9 · 9 · 9 | 0 · 6 · 2 · 93 | 58 · 40 · 41 · 42 | ████▄▇▂ | 0 | 0 / 0 | 0 · 99 | TTTT | $0.021 |
| 5e71c418e7 (22-11 12:24) | 85 | 8 | 1.9 | 22 · 20 · 19 · 19 | 12 · 12 · 12 · 11 | 0 · 4 · 2 · 94 | 44 · 40 · 36 · 37 | ███▇▂ | 0 | 0 / 0 | 2 · 91 | TTTT | $0.023 |
| 032a859c26 (22-11 12:53) | 84 | 8 | 1.8 | 21 · 23 · 17 · 25 | 12 · 13 · 13 · 12 | 0 · 4 · 4 · 92 | 42 · 46 · 34 · 50 | ███▇▆ | 0 | 1 / 2 | 1 · 99 | TTTT | $0.022 |
| 784930ccef (22-11 13:17) | 82 | 7 | 1.7 | 20 · 21 · 24 · 22 | 13 · 11 · 12 · 12 | 0 · 4 · 3 · 94 | 40 · 35 · 48 · 45 | ████▄ | 0 | 0 / 1 | 0 · 98 | TTTT | $0.022 |
| 4ae343c033 (22-11 13:35) | 72 | 5 | 1.6 | 24 · 21 · 20 · 24 | 11 · 11 · 11 · 11 | 0 · 4 · 1 · 95 | 47 · 42 · 38 · 46 | ████▅ | 0 | 2 / 6 | 1 · 86 | TTTT | $0.024 |

## Big Champ

js13k · https://play.js13kgames.com/big-champ

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 00c3db9bfb (22-11 12:07) | 31 | 1 | 1.4 | 12 · 6 · 6 · 5 | ✗ · ✗ · ✗ · ✗ | 3 · 97 · 0 · 0 | 1 · 1 · 1 · 1 | █·· | 1 · 12 s | 0 / 12 | 53 · 52 | AAAA | $0.013 |
| 1c734692c1 (22-11 12:11) | 69 | 2 | 1.7 | 30 · 31 · 33 · 7 | 5 · 5 · 6 · 6 | 1 · 8 · 27 · 65 | 52 · 54 · 53 · 14 | █▇▆███▄ | 0 | 8 / 12 | 31 · 68 | TTTA | $0.024 |
| 54983f82da (22-11 12:25) | 85 | 2 | 1.9 | 27 · 28 · 25 · 24 | 5 · 6 · 6 · 6 | 2 · 8 · 21 · 69 | 45 · 47 · 46 · 39 | ██▇▇▆▃ | 0 | 3 / 13 | 27 · 75 | TTTT | $0.029 |
| d2d76cd12a (22-11 12:54) | 2 | 2 | – | – | – | – · – · – · – | – | – | 0 | 0 / 0 | – | EEEE (game_not_playable) | $0.000 |
| 55ad22e031 (22-11 13:00) | 61 | 2 | 1.4 | 29 · 28 · 27 · 30 | 8 · 5 · 8 · 6 | 1 · 9 · 16 · 74 | 44 · 41 · 41 · 44 | ██▇▇▇▃▁ | 0 | 4 / 11 | 21 · 81 | TTTT | $0.024 |
| 211d055e41 (22-11 13:19) | 58 | 2 | 1.4 | 32 · 30 · 32 · 9 | 7 · 5 · 8 · 6 | 5 · 7 · 17 · 71 | 50 · 45 · 47 · 14 | ███▇▇▆▃ | 0 | 1 / 5 | 27 · 74 | TTTA | $0.020 |
| 26917f15c6 (22-11 13:37) | 60 | 2 | 1.4 | 31 · 34 · 29 · 33 | 6 · 6 · 7 · 6 | 3 · 6 · 19 · 73 | 45 · 48 · 51 · 55 | ██▇▇▇▆▄ | 0 | 5 / 18 | 29 · 74 | TTTT | $0.024 |

## Dead Again

js13k · https://play.js13kgames.com/dead-again

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ef61edd5b0 (22-11 12:12) | 1 | 1 | – | – | – | – · – · – · – | – | – | 0 | 0 / 0 | – | EEEE (game_not_playable) | $0.000 |
| 1d6ab1a219 (22-11 12:39) | 61 | 3 | 1.4 | 17 · 24 · 20 · 23 | 6 · 5 · 5 · 5 | 0 · 4 · 19 · 78 | 17 · 23 · 31 · 30 | ██▆▅▃ | 0 | 1 / 8 | 13 · 86 | TTTT | $0.022 |
| c168c0332c (22-11 12:55) | 69 | 4 | 1.6 | 25 · 27 · 32 · 20 | 6 · 6 · 6 · 7 | 1 · 3 · 13 · 83 | 30 · 30 · 32 · 18 | █▃▃▄▅▄▂ | 0 | 6 / 10 | 33 · 67 | TTTA | $0.021 |
| 0490e547d8 (22-11 13:21) | 58 | 3 | 1.4 | 30 · 28 · 21 · 13 | 6 · 7 · 5 · 5 | 2 · 3 · 13 · 82 | 39 · 44 · 34 · 16 | ██▅▆▅▆ | 0 | 4 / 6 | 16 · 84 | TTTA | $0.020 |
| ee07a64482 (22-11 13:38) | 59 | 2 | 1.4 | 33 · 27 · 27 · 35 | 4 · 4 · 5 · 5 | 0 · 4 · 18 · 79 | 49 · 39 · 33 · 35 | ██▅▅▆▆▅ | 0 | 9 / 22 | 21 · 82 | TTTA | $0.025 |

## Delete!

js13k · https://play.js13kgames.com/delete

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 614c86f280 (22-11 12:38) | 69 | 1 | 1.6 | 25 · 24 · 25 · 10 | 2 · 2 · 2 · 2 | 8 · 2 · 0 · 90 | 31 · 27 · 31 · 12 | █▇▅▇▄▂ | 0 | 8 / 12 | 15 · 86 | TTAA | $0.029 |
| 49bb01adc6 (22-11 12:56) | 64 | 1 | 1.6 | 25 · 31 · 41 · 19 | 2 · 2 · 2 · 2 | 11 · 11 · 0 · 79 | 22 · 19 · 33 · 25 | █▇▄▆▅▄·▅▃ | 1 · 10 s | 5 / 12 | 24 · 78 | TATA | $0.029 |
| 1857adc5a1 (22-11 13:22) | 64 | 1 | 1.5 | 34 · 41 · 30 · 16 | 2 · 2 · 2 · 2 | 9 · 20 · 4 · 67 | 22 · 25 · 34 · 25 | █▇▅▃▄▅▃▂· | 1 · 11 s | 9 / 20 | 33 · 74 | TTTA | $0.029 |
| 017b3e453b (22-11 13:39) | 61 | 1 | 1.4 | 22 · 44 · 29 · 9 | 1 · 2 · 2 · 2 | 9 · 23 · 0 · 67 | 26 · 23 · 31 · 11 | █▇▅▇▄▃▂▂▂ | 0 | 2 / 9 | 25 · 77 | TTTA | $0.028 |

## Moon Buggy

js13k · https://play.js13kgames.com/moon-buggy-racing

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| f5db807848 (22-11 12:42) | 58 | 1 | 1.3 | 23 · 32 · 18 · 14 | 6 · 4 · 6 · 5 | 6 · 6 · 10 · 77 | 14 · 11 · 15 · 18 | █▅▃▂▂▂· | 0 | 1 / 6 | 4 · 89 | TTTA | $0.023 |
| b6ae80d505 (22-11 12:57) | 56 | 1 | 1.2 | 40 · 29 · 25 · 27 | 7 · 3 · 3 · 6 | 3 · 6 · 13 · 78 | 15 · 21 · 13 · 19 | █▄▃▃▃▁▂▃· | 1 · 16 s | 6 / 16 | 5 · 94 | TTTT | $0.031 |
| 473c8a0590 (22-11 13:23) | 50 | 1 | 1.2 | 28 · 28 · 30 · 30 | 6 · 5 · 3 · 4 | 9 · 6 · 11 · 74 | 16 · 15 · 22 · 12 | █▃▄▅▁▁▂ | 1 · 10 s | 0 / 8 | 1 · 97 | TTTT | $0.037 |
| 1e78cc6ff2 (22-11 13:40) | 52 | 1 | 1.2 | 27 · 27 · 29 · 7 | 5 · 4 · 6 · 6 | 1 · 8 · 10 · 81 | 19 · 16 · 11 · 10 | █▆▁▃▂▁ | 0 | 4 / 8 | 7 · 96 | TTTA | $0.027 |

## NILO

js13k · http://localhost:5174/third-party/nilo/

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| swarm-nilo (21-11 18:55) | 55 | 1 | 1.3 | 26 · 26 · 22 · 25 | 7 · 6 · 8 · 7 | 2 · 6 · 0 · 93 | 18 · 11 · 11 · 6 | █▂▂▂▁▁ | 3 · 34 s | 5 / 11 | 9 · 91 | TTTT | $0.043 |

## Broken Repair

itch.io · https://eduardscarpato.itch.io/broken-repair

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5be5d862ae (22-11 18:19) | 33 | 31 | – | – | – | – · – · – · – | – | – | 0 | 0 / 0 | – | EEEE (game_not_playable) | $0.000 |
| 4167af1f8b (22-11 18:29) | 35 | 34 | – | – | – | – · – · – · – | – | – | 0 | 0 / 0 | – | EEEE (game_not_playable) | $0.000 |
| 4e1e7d4fbb (22-11 18:31) | 239 | 13 | 6.1 | – · 32 · – · 18 | – · 44 · – · ✗ | 11 · 30 · 0 · 59 | – · 36 · – · 4 | ▃▃▄▂▃█▁ | 1 · 10 s | 0 / 8 | 88 · 9 | ETEA | $0.009 |
| a98e3fc6b1 (22-11 18:36) | 402 | 10 | 9.9 | 39 · 33 · 41 · 20 | 190 · 56 · 85 · ✗ | 13 · 16 · 0 · 72 | 31 · 38 · 29 · 3 | ▄▄▃▄▇▇█▅▂ | 1 · 17 s | 0 / 5 | 77 · 17 | TTTA | $0.023 |
| 8c2ba86de5 (22-11 18:52) | 488 | 19 | 17.8 | 25 · 25 · 23 · 22 | 224 · 64 · 94 · 219 | 7 · 18 · 0 · 74 | 19 · 19 · 17 · 25 | ▅▇██▅▂ | 0 | 0 / 8 | 78 · 20 | LLLL | $0.019 |

## Decogear

itch.io · https://boghog.itch.io/decogear

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ca6e90b26c (23-11 09:49) | 117 | 24 | 6.7 | 19 · 20 · 19 · 21 | ✗ · ✗ · ✗ · ✗ | 49 · 45 · 0 · 6 | 29 · 31 · 29 · 29 | █▇█▂· | 0 | 1 / 5 | 19 · 63 | CCCC | $0.012 |
| 0537e58253 (23-11 15:08) | 49 | 26 | 3.5 | 8 · 6 | ✗ · ✗ | 42 · 42 · 0 · 17 | 15 · 11 | █▄ | 0 | 1 / 1 | 50 · 58 | CC | $0.005 |
| 9cde969491 (23-11 15:10) | 164 | 43 | 7.6 | 19 · 18 · 15 · 18 | ✗ · ✗ · ✗ · ✗ | 43 · 53 · 0 · 3 | 25 · 26 · 26 · 25 | ██▅▁ | 0 | 1 / 3 | 30 · 67 | CCCC | $0.010 |
| 6c26ff602d (23-11 17:34) | 76 | 28 | 2.3 | 24 · 23 · 23 · 19 | ✗ · ✗ · ✗ · ✗ | 27 · 71 · 0 · 2 | 33 · 25 · 25 · 27 | ██▅▁▂ | 0 | 3 / 11 | 22 · 80 | CCCC | $0.014 |

## Prerolled

itch.io · https://red-sauce.itch.io/prerolled

| Run (day-month time, UTC) | Length s | First frame s | Real s per move | Game s per ghost | Reached real play (real s per ghost) | Moves % loading · menu · game over · play | Distinct screens per ghost | New screens every 5 s | Stalls · total | False / all "nothing happened" | % click · keys | Endings | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20bee3f06b (22-11 18:20) | 17 | 17 | – | – | – | – · – · – · – | – | – | 0 | 0 / 0 | – | EEEE (game_not_playable) | $0.000 |

## How it is measured

- **Run length**: the real time of the run (`report.json` realMs): from opening the browser to the last ghost's end, without the wait in the queue or the report. **First frame**: from the run really starting to the first frame, of any ghost, that shows the game (its JPEG weighs at least half the median of that ghost's frames: black and loading screens weigh far less, so a 2 KB loading screen saved after 2 s does not count). A run starts when it leaves the server's queue (runs asked for together wait for each other): the last ghost's end minus realMs.
- **Real s per move**: per move, from the end of the move before (or the screen it decided on) to its last frame being written: thinking plus playing plus our own overhead. Taken from each step's `at` when the trace has it, else from the time each frame file was written.
- **Game s**: `trace.gameMs`, the game time each ghost played (the game clock stands still while the model thinks).
- **Reached real play**: the first move where the ghost says it is playing (`saw: playing`, and its thought does not speak of loading or a name screen), used an input, the screen answered (at least 0.3 % of a 64×36 grey grid changed by more than 24 levels during the move), and it stayed in the game (at least 2 of its next 3 moves are play or game over: intros that move by themselves do not count). Shown as real seconds from the start of the run to the end of that move (per run: one value per ghost, ✗ = never, – = did not move).
- **Moves %**: what the ghost said it saw, refined by its thought (the categories of `rediseno/v3/real-games/analyze_runs.py`): loading = loading, black screens and intros that play by themselves; menu = menus, title and name screens and anything else that is not the game; game over = it saw itself die or a game-over screen; play = playing or level complete. **% of game time playing**: the same, weighted by each move's game time.
- **Distinct screens**: a fingerprint of the frame every 0.5 s of game time, as Go-Explore's cells (the frame in grey shrunk to 11×8, 8 levels); the number of different fingerprints a ghost saw. The character moving to a new place makes a new fingerprint, as in Go-Explore; so do animations, which inflate the count on busy screens. **New screens every 5 s**: the novelty curve, averaged over the ghosts of the run. **Stall**: at least 10 s of game time without a fingerprint never seen before (also at the end of the game); the tables give the ghosts with at least one, and the share of all the game time spent in stalls (longer games have more room for them, so compare shares).
- **False "nothing happened"**: thoughts saying the last input did nothing (the regular expression of `rediseno/v3/real-games/modes.py`) while that move clearly changed the screen the ghost saw before and after it (mean grey change ≥ 3 levels on the grid, as the first analysis: a new screen, the view scrolling, something big moving), not counting loading screens. Smaller changes (a cursor, an animated background) are not counted, so this is a floor. "All" is every such thought, true or not (the first move of each ghost is left out, as before).
- **% click · keys**: moves with a click or drag, and moves with keys (a move can have both; the rest were waits).
- **Cost**: the run's `report.json` cost (ghosts and analyst); priced from the traces when there is no report.
