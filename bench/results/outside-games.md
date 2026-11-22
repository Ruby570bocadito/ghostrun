# Real jam games made by other people (22 Nov 2026)

Nine js13kGames entries, played at their public address (`https://play.js13kgames.com/<game>`), unmodified and without the Ghostrun SDK, so the ghosts only have the pixels. There is no planted flaw here, so no score: instead, we compare what the ghosts reported with what **real players wrote** on each game's js13kGames page (paraphrased; follow the links for their words). A scout agent found and checked the games and collected the comments; a person has not reviewed this table yet.

**Run 1** (the "rounds 4–5" ghosts), 4 ghosts × 40 moves each, about $0.02 per game ($0.21 for the nine). The verdicts in this table are our first reading, made with the AI assistant that builds Ghostrun (a person has not checked them yet); an independent judge's, for this run and two more, are [below](#three-runs-judged-blind).

| Game (author, year, licence) | What players said | What the ghosts reported | Verdict (first reading) |
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

**Our first reading** of this run: the ghosts' report agreed with real players in 5 of 9 games (1 match, 4 partial). An independent judge, reading blind, was stricter: 4 of 9 ([below](#three-runs-judged-blind)). Read findings on such games as leads to check in the replay, not as verdicts.

## Three runs, judged blind

We played the nine games twice more on 22 Nov (afternoon), one run per game each time:

- **Run 2**: the same ghosts after the fixes below (patience on menus, longer clicks, a window that fits the game).
- **Run 3**: the same, plus an **exit interview**: after its last move, each ghost says what it thinks the goal is, whether it understood the goal and the controls, what stopped it most, and whether it would keep playing (`src/ghost.mjs`). It is one more call per ghost, with the same model and conversation: **+3.5% cost** over the nine runs, 36 of 36 interviews answered.

Run 2 did worse than the first: in Escape from Death Hole and SPACETAXI the ghosts got further than before (past the title, into the levels) but then circled without ever finding the goal, and nothing in what the game shows marks that, so the report came back empty. That is why we added the interview: the ghosts know they never understood the goal; we only had to ask.

**The judge.** An independent Claude agent (Sonnet) got, for each game, the players' comments (the paraphrases above) and the three reports in random order, without being told which run each came from, and rated each report: *match* (raises the players' main complaint), *partial* (a related part of it, or one of several complaints), *no match* (other problems), *miss* (nothing comparable). It was told that exit-interview lines are part of a report and not a sign of quality by themselves, and to pick the lower verdict when in doubt. It judged from the paraphrases; it did not open the games' pages.

| Game | Run 1 | Run 2 | Run 3, with the exit interview |
|---|---|---|---|
| Escape from Death Hole | no match | miss | **partial**: "No text explained how to unlock doors or use keys" |
| SPACETAXI | match | miss | **match**: "I kept crashing into planets", "No instructions explained what markers or customers meant" |
| Find All Pages | no match | no match | no match |
| Delete! | partial | no match | no match |
| Dead Again | partial | partial | partial |
| Moon Buggy Racing | no match | no match | no match |
| Big Champ | partial | partial | partial |
| Coiner | no match | no match | no match |
| Backout | miss | miss | **partial**: unclear paddle controls, a ball that behaves oddly |
| **Agree (match or partial)** | **4 of 9** | **2 of 9** | **5 of 9**, and no empty report |

The judge also flagged claims that the players' comments contradict: in Moon Buggy Racing all three runs call the rock field unfair or impassable, while players found the difficulty fine; in Find All Pages, runs 2 and 3 say nobody could operate the puzzle, while players played through its levels. Those are the ghosts' limits, not the game's flaws.

**Does the interview tell games apart?** On two clean test games played afterwards (Gap Run and Key Hunt), 8 of 8 ghosts said they understood the goal and the controls, and 6 of 8 would keep playing (the Impatient would not, in character). On the nine jam games, 0 of 36 would keep playing, and in 7 of 9 games half or more never worked out the goal.

**Limits of this check.** One run per game per version, nine games and one judge: the uncertainty is wide, and run 2 shows how much one run can vary. The interview is the ghosts' opinion, not a measurement, and the report says so. What it adds is that a run in which the ghosts understood nothing no longer looks clean.

Run ids, run 2: escape-from-death-hole 2026-11-22T13-13-06-175Z-c752fe060f · find-all-pages 2026-11-22T13-13-06-199Z-c1ccbb4376 · spacetaxi 2026-11-22T13-13-06-235Z-deec369b2f · coiner 2026-11-22T13-13-06-239Z-7644d99b93 · backout 2026-11-22T13-13-06-250Z-784930ccef · big-champ 2026-11-22T13-13-06-253Z-211d055e41 · dead-again 2026-11-22T13-21-10-297Z-0490e547d8 · delete 2026-11-22T13-21-10-318Z-1857adc5a1 · moon-buggy-racing 2026-11-22T13-21-10-321Z-473c8a0590. Run 3: escape-from-death-hole 2026-11-22T13-30-43-121Z-8a724e8533 · find-all-pages 2026-11-22T13-32-23-495Z-0459bad9f8 · spacetaxi 2026-11-22T13-33-46-469Z-500801017d · coiner 2026-11-22T13-34-50-690Z-b9be4bd514 · backout 2026-11-22T13-35-50-891Z-4ae343c033 · big-champ 2026-11-22T13-37-07-150Z-26917f15c6 · dead-again 2026-11-22T13-38-11-335Z-ee07a64482 · delete 2026-11-22T13-39-15-544Z-017b3e453b · moon-buggy-racing 2026-11-22T13-40-23-769Z-1e78cc6ff2.

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
