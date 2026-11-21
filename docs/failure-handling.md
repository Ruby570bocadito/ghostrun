# What happens when something goes wrong

Each case below was triggered on purpose and checked on 2026-11-21 (screenshots in the submission).

## 1. The link is not a playable game (a problem with the input)

| What we tried | How it is detected | What the user sees | Cost |
|---|---|---|---|
| Text that is not a link (`my game`) | URL check before anything starts | "Paste a full game link that starts with http:// or https://" | $0 |
| A link that does not exist (HTTP 404) | The page response, before any AI call | "The ghosts could not play this game — The game URL answered HTTP 404" | $0 |
| A web page that is not a game (our own games list page) | No canvas after loading, checked before any AI call | "No game canvas found on this page" | $0 |
| A blank game screen | First screenshot is almost empty | "The game screen looks blank after loading, so there is nothing to play" | $0 |

The run ends cleanly with a message and a "Try another link" button. No AI calls are made, so nothing is charged.

## 2. The AI provider fails in the middle of a run (a problem with a service)

- The Meta Model API client retries each call twice with growing waits, with a timeout per model (Ember 20 s, Spark 60 s, Wonder 90 s; Spark took over 30 s on 11% of its moves in our model comparison) (`src/brains/meta.mjs`).
- If the ghost's model still fails, that ghost **switches to a backup model** (`muse-ember-1.0` → `muse-spark-1.3`) and keeps playing from the same moment, so no moves are lost (`src/brains/fallback.mjs`).
- The live view logs the switch, and the report shows it under "What went wrong during the run, and how it was handled".

**Demonstrated** with a simulated outage: Advanced options → "simulate an AI outage", which makes the first ghost's model fail from its 6th move. The run and its report are labelled as a test run. The Newbie's Ember "failed" at move 6, it switched to Spark, the run finished and still found the planted blocker (3/4 ghosts).

## 3. The AI answers, but the answer is unusable (a problem with the output)

Structured output makes broken JSON rare, but an answer can still be cut off by the token limit or come back empty.

- The ghost **asks again once** with the same screen. The tokens of the failed answer are still counted in the cost.
- If the second answer is unusable too, the ghost **waits 300 ms and keeps playing** instead of being lost, and the report lists it under "What went wrong during the run, and how it was handled".
- Three unusable answers in a row end that ghost with a clear error (something is wrong with the model, and waiting would only cost money).
- Covered by tests with a fake model (`test/brain.test.mjs`). In the 20-run benchmark after this change, 6 answers needed the retry and none needed the wait.

## Other safeguards

- **One ghost fails completely:** the others keep playing and the report is built from the ghosts that played. If every ghost fails, the run ends with the first error message.
- **The analyst (the AI that writes the finding cards) fails:** the report still shows every finding with its numbers, replays and quotes, without the written explanation. The findings never depend on the analyst.
- **Spending cap:** runs are refused once API spending reaches the cap (`GHOST_BUDGET_USD`, default $35). Benchmark runs count towards it too.
- **Busy:** a second run while one is playing gets a clear "the ghosts are busy" message and is sent to the running one.
- **Freezing the clock** can race with the game when several browsers are busy, so it retries further ahead.
