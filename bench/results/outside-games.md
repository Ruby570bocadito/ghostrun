# Real jam games made by other people (22 Nov 2026)

Nine js13kGames entries, played at their public address (`https://play.js13kgames.com/<game>`), unmodified and without the Ghostrun SDK, so the ghosts only have the pixels. There is no planted flaw here, so no score: instead, we compare what the ghosts reported with what **real players wrote** on each game's js13kGames page (paraphrased; follow the links for their words). A scout agent found and checked the games and collected the comments; a person has not reviewed this table yet.

Current version (the "rounds 4–5" ghosts), 4 ghosts × 40 moves each, about $0.02 per game ($0.21 for the nine).

| Game (author, year, licence) | What players said | What the ghosts reported | Verdict |
|---|---|---|---|
| [Escape from Death Hole](https://js13kgames.com/entries/escape-from-death-hole) (Santi Herranz, 2022, MIT) | Missed the sword on level 1; a zombie took the key; wanted more hints at the start; movement felt slow | All four stuck in the dark starting area, not knowing how to get past the monster and leave | **Partial**: both point at an unclear start, but the ghosts never got as far as the sword or the key |
| [SPACETAXI](https://js13kgames.com/entries/spacetaxi) (Christoph Schansky, 2021, GPL-3.0) | Felt broken until they understood you must land gently (touching a planet kills); wanted a tutorial | All four circled without knowing how to serve customers: "the game never explains it". In an earlier run: "the ship explodes on the planet with no way to continue" | **Match**: no tutorial, and crashing into planets |
| [Find All Pages](https://js13kgames.com/entries/find-all-pages) (Stacks Hub, 2020, MIT) | Too many keys to remember; wanted a timer; only four levels | All four stuck: the grid never explains how to move | **Partial**: the controls are hard to grasp |
| [Delete!](https://js13kgames.com/entries/delete) (Clocks-in-a-Cooler, 2020) | Deleting sometimes failed; instructions shown "the other way round"; unclear which feature is selected | Three stuck: could not work out the wall jump and the select-then-delete step | **Partial**: confusing instructions and delete step |
| [Dead Again](https://js13kgames.com/entries/dead-again) (Jonas Olmstead, 2022, MIT) | Dying sends you back to level 1; unclear ammo and reload; the darkness | Three died and never got past the same spot (cause unclear) | **Weak partial**: dying is the pain point in both, for different reasons |
| [Moon Buggy Racing](https://js13kgames.com/entries/moon-buggy-racing) (Johan Wigert, 2021) | One player got a black screen; others found the difficulty fine | A blocker: the starting rock field kills after every restart; "Space does not restart" | **No match** (and the restart claim is not checked) |
| [Big Champ](https://js13kgames.com/entries/big-champ) (Bryan Perfetto, 2020) | Long recovery after a mistake makes the waves unfair; too hard with two characters | Knocked out with no way to restart | **No match** |
| [Coiner](https://js13kgames.com/entries/coiner) (Hoai Phong, 2019) | The jump is too short to reach the coin quickly | All four never worked out the controls (none are shown on screen) | **Ghost limitation**: people learned the controls |
| [Backout](https://js13kgames.com/entries/backout) (Emre Guneyler, 2019, MIT) | The arrow keys feel upside down; unclear why the ball slows | Nothing | **Miss** |

**In short:** on games without the SDK, the ghosts' report agreed with real players in 5 of 9 games (1 match, 4 partial), disagreed in 2, failed where people did not in 1, and missed the players' complaint in 1. Read findings on such games as leads to check in the replay, not as verdicts. "Restart does not work" appeared in three games and may be the ghosts' own limit; the ghosts are now told to give game-over screens a second (not yet re-measured).

## What these games broke in Ghostrun, now fixed

Each one made the report blame the game for something that was our fault. All are covered by tests (`test/clicks.test.mjs`, `test/fit.test.mjs`).

| Game | What happened | Fix |
|---|---|---|
| Big Champ | Every ghost clicked "Tap" and nothing happened; the report said the start screen never responds. Our clicks pressed and released the button before the game's next frame | A click keeps the button down for 90 ms of game time |
| Dead Again | Refused as "no game canvas": it creates its canvas 1–3 s after loading | Wait up to 6 s of real time for a canvas |
| Coiner, Delete!, Moon Buggy Racing, Escape from Death Hole | Their canvases are bigger than the 640×360 window: in Coiner the character was below the screen | Before playing, the game is opened once (no AI) and the window is enlarged to fit its canvas |
| Big Champ | Its dark start screen with one word was judged "blank" | "Blank" now means barely bigger than an empty page of the same size |
| Escape from Death Hole | The ghosts pressed Enter every half second while the game needed 1–3 s to start | Ghosts give a title, menu or game-over screen a second to change |
| Several | Cards stated what the ghosts experienced as facts ("the start keys do nothing") | On games without the SDK, cards say what the ghosts could not do, with low confidence |

Run ids: escape-from-death-hole 2026-11-22T12-47-42-834Z-8579dc64f3 · find-all-pages 2026-11-22T12-47-43-600Z-309a9df2cf · spacetaxi 2026-11-22T12-47-43-982Z-11489772c7 (earlier run 2026-11-22T12-19-05-820Z-545e282be7) · coiner 2026-11-22T12-47-44-000Z-44f669d650 · backout 2026-11-22T12-47-44-021Z-032a859c26 · dead-again 2026-11-22T12-54-58-206Z-c168c0332c · delete 2026-11-22T12-54-58-210Z-49bb01adc6 · moon-buggy-racing 2026-11-22T12-54-58-213Z-b6ae80d505 · big-champ 2026-11-22T13-00-00-127Z-55ad22e031 (after the blank-screen fix).
