# Deploying the public demo

The app, the test games and the ghosts' headless Chromium run in one container (`Dockerfile`, based on the official Playwright image for the same Playwright version). The container starts in **public demo mode** (`GHOSTRUN_PUBLIC=1`, see [failure handling](failure-handling.md#4-someone-uses-the-public-demo-to-reach-places-it-should-not-a-problem-with-trust)).

## Settings

| Variable | Default in the container | What it does |
|---|---|---|
| `MODEL_API_KEY` | — (secret, set on the platform) | Meta Model API key. Use a key made for the demo, with a spending limit at Meta if available |
| `GHOST_BUDGET_USD` | 5 | Spending cap of this server. The spending file lives in the container, so it starts again from 0 after a restart: the key's own limit is the real cap |
| `GHOSTRUN_PUBLIC` | 1 | Protections for strangers: no private addresses, per-visitor limits, fixed model, private runs |
| `TRUST_PROXY` | 1 | Read the visitor's address from the platform's proxy (`X-Forwarded-For`) |
| `RUNS_PER_HOUR` | 6 | Playtests per visitor per hour |
| `QUEUE_MAX` | 5 | Playtests that can wait for their turn (the ghosts play one game at a time) |
| `RUNS_KEEP` | 300 | Saved runs kept on disk; the oldest are deleted first |
| `RUN_TIMEOUT_MS` | 480000 | A run that takes longer is stopped |
| `PORT` | 7860 | Port the app listens on |

Memory: four ghosts are four browser tabs; plan for at least 2 GB of RAM.

## Option A: Hugging Face Spaces (free, recommended)

A Docker Space on the free CPU tier has 2 vCPU and 16 GB of RAM, enough for the ghosts.

1. Create a Space: **SDK: Docker**, template **Blank**, visibility **Public**.
2. In the Space's **Settings → Variables and secrets**, add the secret `MODEL_API_KEY`.
3. The Space reads its settings from the front matter of its `README.md`. Push this repository with that header added on a separate branch, so the GitHub README stays as it is:

   ```bash
   git checkout -b hf
   printf -- '---\ntitle: Ghostrun\nemoji: 👻\ncolorFrom: indigo\ncolorTo: green\nsdk: docker\napp_port: 7860\n---\n\n' | cat - README.md > README.tmp && mv README.tmp README.md
   git commit -am "Hugging Face Space settings"
   git remote add hf https://huggingface.co/spaces/<user>/<space>
   git push hf hf:main
   git checkout main
   ```

   To update later: `git checkout hf && git merge main && git push hf hf:main && git checkout main`.
4. The Space builds the image and starts it. Check `https://<user>-<space>.hf.space/api/health`.

Free Spaces sleep after two days without visits and wake up on the next one. Their disk is not persistent, so saved runs and the spending file are lost on restart.

## Option B: a tunnel to a local server (quick, temporary)

For a short test with people, run the server on your own machine in public mode and open a temporary public address with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/):

```bash
GHOSTRUN_PUBLIC=1 TRUST_PROXY=1 GHOST_BUDGET_USD=5 MODEL_API_KEY=… npm start
cloudflared tunnel --url http://localhost:5180
```

The address works while both commands run and the machine stays on.

## Checking a deployment

- `/api/health` answers `{"ok": true, …}`.
- The home page loads, and "No game handy? Try ours" fills in a link at the deployment's own address (`…/play/gap-run/`).
- A playtest on a test game finishes with a report.
- A link to `http://localhost:5180/` or `http://169.254.169.254/` is refused with "private or local network address".
- `/play/` lists the test games for people to play; their sessions are saved (not listed publicly).
