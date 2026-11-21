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

## 4. Someone uses the public demo to reach places it should not (a problem with trust)

The ghosts' browser runs on our server, so a visitor's link could point it at the server's own network: a local admin page, the cloud metadata service at `169.254.169.254`, a router. The report would then show screenshots of it. With `GHOSTRUN_PUBLIC=1` (`src/guard.mjs`):

- Links to private, local or special addresses are refused before anything starts ("This link points to a private or local network address…"), including disguised forms such as `http://2130706433/` (127.0.0.1 written as a number) or a name that resolves to a private address. Our own test games are the one local address allowed.
- Inside the game page, **every request** (redirects, scripts, images, fetch) goes through the same check, so a public page cannot redirect the ghosts inward. Pop-up windows are closed.
- Each visitor (by IP; behind a proxy set `TRUST_PROXY=1`) can start 6 playtests per hour (`RUNS_PER_HOUR`); the model is always Ember and runs are capped at 5 ghosts × 60 moves, so nobody can make a run cost 17× more by asking for Wonder; the simulated-outage test is off.
- Other visitors' game links and runs are not listed, and recorded human playtests are not served; only the visitor who started a run can stop it.
- Checked by `test/guard.test.mjs` and `test/server.test.mjs`, which starts the real server in this mode without an API key, and by a real run on a test game (no request blocked, the ghosts played normally).

Also in any mode: a run that takes longer than 8 minutes is stopped (`RUN_TIMEOUT_MS`); paths outside the runs folder are refused; malformed requests get a 400, not a server error; live streams send a heartbeat every 20 s so proxies do not cut them; finished runs drop their frame-by-frame events from memory (the 30 most recent stay, older ones are read from disk); the spending file is written atomically; on restart the active run is stopped cleanly.

## Other safeguards

- **One ghost fails completely:** the others keep playing and the report is built from the ghosts that played. If every ghost fails, the run ends with the first error message.
- **The analyst (the AI that writes the finding cards) fails:** the report still shows every finding with its numbers, replays and quotes, without the written explanation. The findings never depend on the analyst.
- **Spending cap:** runs are refused once API spending reaches the cap (`GHOST_BUDGET_USD`, default $35). Benchmark runs count towards it too.
- **Busy:** a second run while one is playing gets a clear "the ghosts are busy" message and is sent to the running one.
- **Freezing the clock** can race with the game when several browsers are busy, so it retries further ahead.
