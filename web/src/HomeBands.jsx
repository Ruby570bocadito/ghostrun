import { Ghost } from './Ghost.jsx';
import { CountUp, Item, Reveal, Stagger } from './fx.jsx';
import { COLOR } from './personas.js';
import { EVIDENCE, FEATURED_RUN, FIXED_RUN } from './links.js';

// The home page below the hero, in the chosen Swiss style: how it works, what a report gives you (real pieces of a real
// report at full size: a tester could not read the old screenshot at 40 %), the before/after of a fix, and the
// evidence. Every figure and every line of the analyst's card comes from the recorded playtests, nothing is invented.

const STEPS = [
  {
    n: '01',
    persona: 'newbie',
    strip: '',
    title: 'Paste a link',
    text: 'Any web game that runs in a browser tab: itch.io, a jam page, your own site. No setup needed; games that add our small SDK get exact positions.',
  },
  {
    n: '02',
    persona: 'impatient',
    strip: 'coral',
    title: 'Ghosts play',
    text: 'AI players with different personalities play at the same time, each in its own browser, thinking out loud. The game waits while they think, so action games work too.',
  },
  {
    n: '03',
    persona: 'reader',
    strip: 'amber',
    title: 'Get the report',
    text: 'Every place players get stuck, worst first. A blocker is a spot nobody gets past; a missed objective, one most never find. Each comes with its replay and a fix to try.',
  },
];

// From the report of the featured playtest (runs/<FEATURED_RUN>/report.json): finding F1 and the analyst's card.
const CARD = {
  title: 'Spike Gap Blocks All Progress',
  stat: '4/4 ghosts died here · 38 deaths · nobody got past',
  what: 'All 4 ghosts died 38 times trying to jump the spike pit between platforms and none ever got past it.',
  cause: 'The horizontal gap over the spike pit is wider than the jump can clear even with a full run-up.',
  fix: 'Narrow the spike pit or add an intermediate safe platform to make the crossing possible.',
};
const SAID = { persona: 'reader', text: 'I’m falling over the spikes, so I’ll steer left back toward the platform I left.' };

function Strip({ persona, tone = '', children }) {
  return (
    <div className={`card-strip ${tone}`}>
      <Ghost persona={persona} color={COLOR[persona]} size={30} still />
      <span>{children}</span>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="home-band" id="how" aria-labelledby="how-title">
      <Reveal className="band-head">
        <p className="eyebrow">How it works —</p>
        <h2 id="how-title">Playtesters on demand, before the deadline</h2>
      </Reveal>
      <Stagger as="ol" className="cards3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STEPS.map((s) => (
          <Item as="li" key={s.n} className="card">
            <Strip persona={s.persona} tone={s.strip}>
              {s.n}
            </Strip>
            <div className="card-body">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </Item>
        ))}
      </Stagger>
    </section>
  );
}

function WhatYouGet() {
  return (
    <section className="home-band" id="get" aria-labelledby="get-title">
      <Reveal className="band-head">
        <p className="eyebrow">What you get —</p>
        <h2 id="get-title">Where, why, and the proof</h2>
        <p>Three pieces of one real report: Gap Run, one of our test games, with a flaw we planted on purpose (its third gap is too wide to jump).</p>
      </Reveal>
      <Stagger as="div" className="get-grid">
        <Item as="article" className="card">
          <Strip persona="speedrunner">Where</Strip>
          <div className="card-body">
            <h3>On a map of your level</h3>
            <picture>
              {/* On a phone the whole level is too small to read: the part around the blocker instead. */}
              <source media="(max-width: 700px)" srcSet="/home/map-crop.webp" width="900" height="445" />
              <img src="/home/map.webp" width="1800" height="382" loading="lazy" alt="Gap Run's level rebuilt from the ghosts' screenshots, with a box around the third spike gap and crosses where ghosts died, almost all of them inside the box." />
            </picture>
            <p className="shot-note">The whole level, rebuilt from what the ghosts saw. ✕ = a death, in the ghost’s colour. F1 is the blocker; F2, a spot where one ghost died but the others got past.</p>
          </div>
        </Item>
        <Item as="article" className="card">
          <Strip persona="impatient" tone="coral">
            Why
          </Strip>
          <div className="card-body">
            <h3>A card that says what to fix</h3>
            <div className="mini-card">
              <span>
                <span className="badge blocker">F1 · Blocker</span>
              </span>
              <span className="hp-card-title">{CARD.title}</span>
              <span className="hp-card-stat">{CARD.stat}</span>
              <dl>
                <dt>What happens</dt>
                <dd>{CARD.what}</dd>
                <dt>Likely cause</dt>
                <dd>{CARD.cause}</dd>
                <dt>Try this</dt>
                <dd>{CARD.fix}</dd>
              </dl>
            </div>
          </div>
        </Item>
        <Item as="article" className="card">
          <Strip persona="reader" tone="amber">
            Proof
          </Strip>
          <div className="card-body">
            <h3>The moment, replayed</h3>
            <img src="/home/proof.webp" width="640" height="360" loading="lazy" alt="A frame of the replay: the Reader ghost's character falling into the spike pit at the third gap." />
            <p className="said">
              <Ghost persona={SAID.persona} color={COLOR[SAID.persona]} size={26} still />
              <span>
                “{SAID.text}” <span className="muted">— Reader, a second before dying</span>
              </span>
            </p>
          </div>
        </Item>
      </Stagger>
      <p className="band-foot">
        <a className="btn-ghost" href={`#/run/${FEATURED_RUN}`}>
          Open this report
        </a>
        <span className="muted">The finding comes from 38 deaths the game reported, with no AI involved; the AI analyst (Muse Spark) wrote the card from the ghosts’ words and the screen.</span>
      </p>
    </section>
  );
}

function FixThenCheck() {
  return (
    <section className="home-band" id="fix-check" aria-labelledby="fix-title">
      <Reveal className="band-head">
        <p className="eyebrow">Fix it, then check —</p>
        <h2 id="fix-title">See your fix work</h2>
        <p>Fixed something? One click plays the same ghosts again and compares the two reports for you. A real re-run of Gap Run, after narrowing the gap:</p>
      </Reveal>
      <Stagger className="ba">
        <Item className="ba-cell">
          <span className="ba-num">
            <span className="was">1</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
            <span className="sr-only">to</span>
            <span className="now">
              <CountUp to={0} from={1} />
            </span>
          </span>
          <span className="ba-label">problems to fix</span>
        </Item>
        <Item className="ba-cell">
          <span className="ba-num">
            <span className="was">0</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
            <span className="sr-only">to</span>
            <span className="now">
              <CountUp to={4} />
              /4
            </span>
          </span>
          <span className="ba-label">ghosts reached the flag</span>
        </Item>
        <Item className="ba-cell">
          <span className="ba-num">
            <span className="was">40</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
            <span className="sr-only">to</span>
            <span className="now">
              <CountUp to={1} from={40} />
            </span>
          </span>
          <span className="ba-label">deaths in the whole playtest</span>
        </Item>
      </Stagger>
      <p className="band-foot">
        <a className="btn-ghost" href={`#/run/${FIXED_RUN}`}>
          See the comparison
        </a>
        <span className="muted">Same four ghosts, same time each; the new report marks the blocker as resolved.</span>
      </p>
    </section>
  );
}

function Evidence() {
  return (
    <section className="home-band" id="evidence" aria-labelledby="proof-title">
      <Reveal className="band-head">
        <p className="eyebrow">Measured, not claimed —</p>
        <h2 id="proof-title">How well it works</h2>
      </Reveal>
      <Stagger className="proof-grid">
        <Item>
          <span className="big">
            <CountUp to={26} />
            /30
          </span>
          <span className="small">planted design flaws found, in three rounds on our test games</span>
        </Item>
        <Item>
          <span className="big">
            <CountUp to={2} />
            /30
          </span>
          <span className="small">clean games with a false alarm, both in a maze almost no ghost finishes</span>
        </Item>
        <Item>
          <span className="big">
            <CountUp to={151} /> s
          </span>
          <span className="small">of play per ghost (median) on 13 real jam games made by other people</span>
        </Item>
        <Item>
          <span className="big">$0.02–0.11</span>
          <span className="small">of AI per playtest: about a minute on our games, 2–5 on real ones</span>
        </Item>
      </Stagger>
      <p className="band-foot">
        <a className="proof-link" href={EVIDENCE} target="_blank" rel="noreferrer">
          See the evidence, and where it falls short
        </a>
      </p>
    </section>
  );
}

/** The home page below the hero. `gallery` (the demo's recorded playtests) goes after "What you get". */
export function HomeBands({ gallery = null }) {
  return (
    <>
      <HowItWorks />
      <WhatYouGet />
      {gallery}
      <FixThenCheck />
      <Evidence />
    </>
  );
}

// Kept for other pages that imported it from here.
export { CountUp };
