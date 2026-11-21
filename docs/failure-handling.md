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
- Covered by tests with a fake model (`test/brain.test.mjs`). In the 60 runs of the last three benchmark rounds, 10 answers needed the retry and 1 needed the wait; no ghost was lost.
- **The analyst's card contradicts its own numbers.** On a spot that most ghosts who reached it got past, a card that suggests making it easier (a narrower gap, fewer hazards) is asked again once with the reason; if it still does, that suggestion is replaced by "No change needed…" and the rest of the card is kept (`test/explain.test.mjs`). Found on a gallery run: "probably a fair challenge" was printed right above "narrow the gap slightly".

## 4. Someone uses the public demo to reach places it should not (a problem with trust)

The ghosts' browser runs on our server, so a visitor's link could point it at the server's own network: a local admin page, the cloud metadata service at `169.254.169.254`, a router. The report would then show screenshots of it. With `GHOSTRUN_PUBLIC=1` (`src/guard.mjs`):

- Links to private, local or special addresses are refused before anything starts ("This link points to a private or local network address…"), including disguised forms such as `http://2130706433/` (127.0.0.1 written as a number) or a name that resolves to a private address. Our own test games are the one local address allowed.
- Inside the game page, **every request** (redirects, scripts, images, fetch) goes through the same check, so a public page cannot redirect the ghosts inward. Pop-up windows are closed.
- Each visitor (by IP; behind a proxy set `TRUST_PROXY=1`) can start 6 playtests per hour (`RUNS_PER_HOUR`); the model is always Ember and runs are capped at 5 ghosts × 60 moves, so nobody can make a run cost 17× more by asking for Wonder; the simulated-outage test is off.
- Other visitors' game links and runs are not listed, and recorded human playtests are not served; only the visitor who started a run can stop it.
- Checked by `test/guard.test.mjs` and `test/server.test.mjs`, which starts the real server in this mode without an API key, and by a real run on a test game (no request blocked, the ghosts played normally).
- **Attacked on purpose** by an AI agent playing an attacker (about 130 requests against a local copy in this mode). It confirmed the blocks for 35 disguised private addresses, but found what had slipped through, now fixed and covered by tests:
  - `/runs//humans/…` (an extra slash) could read recorded human sessions and the spending file.
  - Some IPv6 forms that carry a private IPv4 address (`::7f00:1`, 6to4 `2002:…`, site-local `fec0::`) were treated as public.
  - An empty or `null` body on `/api/human` wrote a junk file or gave a server error.
  - Unknown `/api/…` addresses answered with the web page instead of a 404.
  A skeptical-engineer agent found two more: a visitor could choose their own address in `X-Forwarded-For` (the left part of that header is whatever the visitor sends; we now read it from the right, as many entries as there are trusted proxies) and persona names such as `constructor` were accepted.
- **Attacked again after those fixes** (second round, a new agent, 22 Nov). Blocked: about 40 disguised private addresses, every other scheme (`file:`, `javascript:`, `data:`…), path tricks on every route, malformed and oversized bodies (400, 413, 431, never a 500), and script injection (the interface never renders HTML from data). It found five more, now fixed and covered by tests:
  - On a disk that ignores upper and lower case (Windows), `/runs/HUMANS/…` read recorded sessions past the check for `humans`. Now `/runs/` serves only run folders, by their exact name (an allowlist instead of a list of exceptions).
  - `/api/config`, and the "queue full" answer, told anyone the id of the run being played, which opens its live view and report. Now they only say whether one is playing.
  - NAT64 for local use (`64:ff9b:1::/48`) passed as public. Now refused.
  - Any site knowing a recorded session's id could overwrite it. Now only the visitor who started it can update it.
  - WebSockets and service workers do not pass through the per-request check. Now WebSockets are checked like any request, and service workers are blocked.
- **Known limit:** the address is checked when the link is submitted and before every request, but the browser looks the name up again when it connects. A site that switches its DNS answer to a private address in between (DNS rebinding) is not fully stopped. Closing it would need the browser to connect through our own proxy. Deploy the public demo where no sensitive internal service is reachable.

Also in any mode: a run that takes longer than 8 minutes is stopped (`RUN_TIMEOUT_MS`); paths outside the runs folder are refused; malformed requests get a 400, not a server error; live streams send a heartbeat every 20 s so proxies do not cut them, and if one drops anyway the live view opens it again and catches up from the start of the run (a test agent's live view froze after a dropped stream; checked by cutting the network for 5 s mid-run); finished runs drop their frame-by-frame events from memory (the 30 most recent stay, older ones are read from disk); the spending file is written atomically; on restart the active run is stopped cleanly.

## Other safeguards

- **One ghost fails completely:** the others keep playing and the report is built from the ghosts that played. If every ghost fails, the run ends with the first error message.
- **The analyst (the AI that writes the finding cards) fails:** the report still shows every finding with its numbers, replays and quotes, without the written explanation. The findings never depend on the analyst.
- **Spending cap:** runs are refused once API spending reaches the cap (`GHOST_BUDGET_USD`, default $35). Benchmark runs count towards it too.
- **Busy:** a second run while one is playing gets a clear "the ghosts are busy" message and is sent to the running one.
- **Freezing the clock** can race with the game when several browsers are busy, so it retries further ahead.
