# Check: `real-before` against the first analysis of real games (23 Nov)

`real-before.md` was made by `bench/real-games.mjs` (no AI) from the recorded runs of the 13 real jam games played before the v3 ghosts (runs created before 23 Nov 17:45 UTC). The first analysis of those runs (`rediseno/v3/juegos-reales.md`, outside this repository, made with ad-hoc scripts in `rediseno/v3/real-games/`) read **59 runs, 234 ghosts and 7,525 moves**. `real-before` reads the same 59 plus one more: `6c26ff602d`, a Decogear run of 23 Nov 17:34 UTC (after the GPU fix, still with the 40-move ghosts), played after that analysis was written.

## The same 59 runs, measure by measure

On those 59 runs `bench/real-games.mjs` counts the same 234 ghosts and 7,525 moves. The first analysis on the left, `real-before` on the right:

| Game | Run length (s) | Real s per move | Game s per ghost (median / max) | % start-up · game over · play | Endings |
|---|---|---|---|---|---|
| Escape from Death Hole | 96–131 = 96–131 | 2.4 = 2.4 | 21/26 = 21/26 | 12·1·87 = 12·1·87 | 23T 1A = 23T 1A |
| Find All Pages | 61–82 = 61–82 | 1.6 = 1.6 | 22/39 = 22/39 | 25·0·74 = 25·0·74 | 15T 9A = 15T 9A |
| SpaceTaxi | 56–63 = 56–63 | 1.4 = 1.4 | 28/38 = 28/38 | 8·1·90 = 8·1·90 | 24T = 24T |
| Coiner | 56–61 = 56–61 | 1.3 = 1.3 | 25/35 = 25/35 | 5·0·95 = 5·0·95 | 21T 3A = 21T 3A |
| Backout | 72–85 = 72–85 | 1.7 → 1.8 | 21/31 = 21/31 | 4·2·94 = 4·2·94 | 20T = 20T |
| Big Champ | 31–85 = 31–85 | 1.4 → 1.6 | 28/34 = 28/34 | 16·18·65 = 16·18·65 | 18T 6A 4E = 18T 6A 4E |
| Dead Again | 58–69 = 58–69 | 1.5 = 1.5 | 26/35 = 26/35 | 4·16·80 = 4·16·80 | 13T 3A 4E = 13T 3A 4E |
| Delete! | 61–69 = 61–69 | 1.5 = 1.5 | 25/44 = 25/44 | 23·1·76 = 23·1·76 | 10T 6A = 10T 6A |
| Moon Buggy | 50–58 = 50–58 | 1.2 = 1.2 | 27/40 → 28/40 | 12·11·77 = 12·11·77 | 14T 2A = 14T 2A |
| NILO | 55 = 55 | 1.3 = 1.3 | 25/26 = 25/26 | 8·0·92 → 8·0·93 | 4T = 4T |
| Broken Repair | 239–488 = 239–488 | 11 → 12.1 | 25/41 = 25/41 | 30·0·70 = 30·0·70 | 10E 4L 4T 2A = same |
| Decogear (3 runs) | 49–164 = 49–164 | 7 → 6.8 | 18/21 → 19/21 | 94·0·6 = 94·0·6 | 10C = 10C |
| Prerolled | 17 → – | – | – | – | 4E = 4E |

"Start-up" is the loading and menu columns of `real-before` together (loading, intros, menus, name screens and other screens that are not the game), as the first analysis grouped them; `real-before` rounds each column on its own, so its two columns can add up to one more (SpaceTaxi: 1 + 8 for 8 %).

**Why the few numbers differ**

- **Real s per move**: the first analysis gave the median, over the ghosts, of each ghost's average; `real-before` gives the real time of all the moves divided by their number. They agree within 0.1 s except where a few slow ghosts weigh more in the pooled average: Big Champ (median of ghosts 1.44 s, pooled 1.56 s), Broken Repair (11.0 / 12.1 s) and Decogear (7.0 / 6.8 s).
- **Moon Buggy 27 → 28 s and NILO 92 → 93 %**: rounding (a median of 27.5 s; 92.5 %).
- **Prerolled**: its only run never started (4 errors in 17 s). `real-before` leaves runs where no ghost moved out of the run lengths and counts them as errors only; the first analysis also left them out of the ranges of Big Champ, Dead Again and Broken Repair.

## "Nothing happened" thoughts

- `juegos-reales.md` and `PLAN-V3.md` speak of **580 "nothing happened" thoughts "although something did happen"**. 580 is every thought that says an input did nothing (the regular expression of `modes.py`): on the same 59 runs `real-before` finds exactly **580**.
- Only part of them contradict the screen. The first analysis checked that with the frames (the move before changed the grey picture by at least 3 levels on average) and found **111**; `real-before` finds **118** on the same 59 runs (121 with the 60th run). The 7 more come from how the small grey picture is made (an average of every pixel here, a bilinear resize in Python before): moves near the threshold of 3 levels.
- So the plan's target (−70 %) should be read on the false ones: **121, 1.6 per 100 moves**, rather than on the 580 (most of those are true: the input really did nothing, or the screen only changed a little).

## Other statements of `PLAN-V3.md`, checked

| Statement | `real-before` |
|---|---|
| Median of 24 s of game per ghost | 23.8 s |
| On Decogear 94 % of the moves went on loading, presentations, the intro and the name screen | 94 % on the same 3 runs; 96 % with the 4th |
| They reach play in 11 of 13 games: never on Decogear, Prerolled did not start | 11 of 13 (not Decogear: 0 of 14 ghosts; not Prerolled: no ghost moved) |
| In the mouse games (Big Champ, Coiner) 62–70 % of the moves were keys | 70 % and 63 % of the moves were keys without a click |
| Clicks in mouse-only games: 30–38 % of the moves | **29 % and 22 % of the moves had a click** (25 % together): 30–38 % was 100 − the key-only moves, which also counts waits (15 % of Coiner's moves). The baseline for "≥ 60 % clicks" is 25 %. |
| First game frame after 27–40 s on itch.io | Median 24 s, max 43 s over the 7 itch.io runs that started: Decogear 24–43 s, Broken Repair 10–19 s |

## New in `real-before` (not in the first analysis)

Time until a ghost really plays, distinct screens and their novelty curve, stalls, the share of game time playing, clicks against keys, and the time until the first frame that shows the game. Their definitions are at the end of `real-before.md`. Two choices were made after looking at these runs:

- **Really playing** needs the ghost to stay in the game after the move (2 of its next 3 moves). Without that, 7 Decogear ghosts "reached play" during the intro: they pressed → while the credits moved by themselves ("a pink character appeared… let me try walking right").
- **False "nothing happened"** uses the first analysis's threshold (a mean change of 3 grey levels), not a share of changed cells: Coiner and Backout change 1–5 % of the screen every move with nothing pressed, so with a share 121 of Coiner's 123 such thoughts would have counted as false.
- **Run start**: on 22 Nov runs were asked for six at a time and waited in the server's queue (up to 3 minutes). Times are counted from when each run left the queue (the last ghost's end minus `realMs`), which is 0.1–0.2 s after the time in the run's id when nothing waited.
- **First game frame**: the first frame saved used to be a 2–4 KB loading screen on itch.io games (after 2 s), so it is the first frame whose JPEG weighs at least half the ghost's median.

Checked on 23 Nov 2026 with `node bench/real-games.mjs before --url js13kgames.com --url itch.io --url third-party/ --until 2026-11-23T17:45Z`.
