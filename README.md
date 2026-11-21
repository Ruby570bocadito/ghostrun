# Ghost Players (working name)

> AI ghost players with different personalities playtest your web game and show you where real players will get stuck, before the jam deadline.

Built for the [Global AI Builder's Challenge](https://global-ai-builders-challenge.devpost.com/) (Nov 21–28, 2026). Work in progress.

## Status

- [x] Test game `games/gap-run` (platformer; `?fault=gap` injects an impossible jump)
- [x] Frozen game clock ("bullet time"): the game waits while a ghost thinks
- [ ] Ghost brain (Meta Model API, vision)
- [ ] Parallel ghosts, heatmap and findings report
- [ ] Web app

## Run it

Requires Node 22+.

```bash
npm install
npx playwright install chromium
cp .env.example .env   # then add your MODEL_API_KEY
npm run serve          # test games on http://localhost:5174/
npm run spike          # checks the frozen-clock trick on the test game
```

## License

MIT
