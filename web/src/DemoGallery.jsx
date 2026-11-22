import { HeroScene } from './HeroScene.jsx';
import { HomeBands } from './HomeBands.jsx';

const REPO = 'https://github.com/Ruby570bocadito/ghostrun';

/** Home page of the static demo: the recorded playtests, and how to run your own. */
export function DemoGallery({ config }) {
  const runs = config?.demoRuns ?? [];
  return (
    <section className="summon">
      <div className="summon-hero">
        <h1>Who gets stuck in your game?</h1>
        <p className="lede">
          AI ghosts with different personalities play a web game, think out loud, and show you exactly where players will get stuck, before the deadline.
        </p>
        <HeroScene />
      </div>

      <div className="demo-note" role="note">
        <b>This is the free demo: real playtests, recorded.</b> Each one below was played by Ghostrun's AI ghosts on {config?.recordedOn ?? 'the date shown'}, and
        its report is exactly what the app showed. New playtests need the app running with an AI key, so they are not possible here.{' '}
        <a href={`${REPO}#run-it-locally`} target="_blank" rel="noreferrer">
          Run it on your own game
        </a>
        .
      </div>

      <ul className="demo-runs">
        {runs.map((r) => (
          <li key={r.id}>
            <a className="demo-run" href={`#/run/${r.id}`}>
              {r.thumb && <img src={r.thumb} alt="" loading="lazy" />}
              <span className="demo-run-body">
                <b>{r.title}</b>
                <span className="muted">{r.shows}</span>
                <span className="mono small">{r.stats}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <HomeBands />
    </section>
  );
}
