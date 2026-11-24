import { useEffect, useRef, useState } from 'react';
import { m, useInView, useReducedMotion } from 'motion/react';
import { CountUp, EASE, Reveal, STILL } from './fx.jsx';

const REPO = 'https://github.com/Ruby570bocadito/ghostrun';

// The parts of the report screenshot (web/public/home/report.webp, 1100x745) each callout points at, in % of the image.
const PARTS = [
  { id: 'where', label: 'Where.', text: 'A box on a map of your level, rebuilt from what the ghosts saw.', box: { left: 58, top: 80.5, width: 40.5, height: 19 } },
  { id: 'why', label: 'Why.', text: 'A card with what happens, the likely cause and one thing to try.', box: { left: 1.6, top: 39, width: 55, height: 37 } },
  { id: 'proof', label: 'Proof.', text: "The replay of that moment, and the ghosts' own words.", box: { left: 58, top: 31.8, width: 40.5, height: 48 } },
];
const TOUR_MS = 2600;

/** The report screenshot with the part each callout talks about lit up; it tours the parts until someone points at one. */
function WhatYouGet() {
  const [active, setActive] = useState('where');
  const [touched, setTouched] = useState(false);
  const ref = useRef(null);
  const visible = useInView(ref, { margin: '0px 0px -20% 0px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (touched || !visible || reduce || STILL) return undefined;
    const t = setInterval(() => setActive((a) => PARTS[(PARTS.findIndex((p) => p.id === a) + 1) % PARTS.length].id), TOUR_MS);
    return () => clearInterval(t);
  }, [touched, visible, reduce]);

  const pick = (id) => {
    setTouched(true);
    setActive(id);
  };
  const box = PARTS.find((p) => p.id === active)?.box;

  return (
    <section className="home-band" aria-labelledby="get-title" ref={ref}>
      <Reveal className="band-text">
        <p className="eyebrow">What you get</p>
        <h2 id="get-title">Every problem, with its proof</h2>
        <ol className="callouts">
          {PARTS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`callout ${active === p.id ? 'on' : ''}`}
                aria-pressed={active === p.id}
                onMouseEnter={() => pick(p.id)}
                onFocus={() => pick(p.id)}
                onClick={() => pick(p.id)}
              >
                <b>{p.label}</b> {p.text}
              </button>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal as="figure" className="band-shot" delay={0.1}>
        <div className="shot-frame">
          <img
            src="/home/report.webp"
            width="1100"
            height="745"
            loading="lazy"
            alt="A real Ghostrun report on Gap Run with its planted flaw: one problem to fix, a spike gap nobody could cross, with the analyst's card on the left and the replay and level map on the right."
          />
          {box && (
            <m.span
              className="shot-spot"
              aria-hidden="true"
              initial={false}
              animate={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
              transition={{ duration: 0.55, ease: EASE }}
            />
          )}
        </div>
        <figcaption>A real report on Gap Run, one of our test games, with its planted flaw: the third gap is too wide to jump.</figcaption>
      </Reveal>
    </section>
  );
}

/** The home page below the form: what a report gives you, the before/after, and the evidence. */
export function HomeBands() {
  return (
    <>
      <WhatYouGet />

      <section className="home-band reverse" aria-labelledby="fix-title">
        <Reveal className="band-text">
          <p className="eyebrow">Fix it, then check</p>
          <h2 id="fix-title">See your fix work</h2>
          <p className="muted">Fixed something? One click plays the same ghosts again and compares the two reports for you.</p>
          <div className="band-stats">
            <div>
              <span className="mono big">
                <CountUp to={1} from={1} /> → <CountUp to={0} from={1} />
              </span>
              <span className="muted small">critical issues</span>
            </div>
            <div>
              <span className="mono big">
                0 → <CountUp to={4} />
                /4
              </span>
              <span className="muted small">ghosts reached the flag</span>
            </div>
          </div>
        </Reveal>
        <Reveal as="figure" className="band-shot" delay={0.1}>
          <div className="shot-frame">
            <img
              src="/home/before-after.webp"
              width="1100"
              height="223"
              loading="lazy"
              alt="A real before and after on Gap Run: critical issues 1 to 0, ghosts that finished 0 to 4, deaths 40 to 1; the blocker is marked resolved."
            />
          </div>
          <figcaption>A real re-run of Gap Run after narrowing the gap nobody could cross: the same four ghosts, compared automatically.</figcaption>
        </Reveal>
      </section>

      <Reveal as="section" className="proof-band" aria-labelledby="proof-title">
        <h2 id="proof-title" className="eyebrow">
          Measured, not claimed
        </h2>
        <div className="proof-grid">
          <div>
            <span className="mono big">
              <CountUp to={26} />
              /30
            </span>
            <span className="muted small">planted design flaws found, in three rounds on our test games</span>
          </div>
          <div>
            <span className="mono big">
              <CountUp to={2} />
              /30
            </span>
            <span className="muted small">clean games with a false alarm, both in a maze almost no ghost finishes</span>
          </div>
          <div>
            <span className="mono big">
              <CountUp to={151} /> s
            </span>
            <span className="muted small">of play per ghost (median) on 13 real jam games made by other people</span>
          </div>
          <div>
            <span className="mono big">$0.02–0.11</span>
            <span className="muted small">per playtest: about a minute on our games, 2–5 on real ones</span>
          </div>
        </div>
        <a className="proof-link" href={`${REPO}/blob/main/bench/README.md`} target="_blank" rel="noreferrer">
          See the evidence, and where it falls short
        </a>
      </Reveal>
    </>
  );
}

// Kept for other pages that imported it from here.
export { CountUp };
