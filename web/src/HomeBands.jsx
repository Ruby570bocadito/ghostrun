import { useEffect, useRef, useState } from 'react';

const REPO = 'https://github.com/Ruby570bocadito/ghostrun';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts up once when it comes into view; still (its final value) for people who prefer less motion. */
export function CountUp({ to, from = 0, duration = 900 }) {
  const [value, setValue] = useState(to);
  const ref = useRef(null);
  useEffect(() => {
    if (reducedMotion() || !ref.current || !('IntersectionObserver' in window)) return undefined;
    let raf = 0;
    let done = false;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || done) return;
      done = true;
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / duration);
        setValue(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      setValue(from);
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, from, duration]);
  return (
    <span ref={ref}>
      <span className="sr-only">{to}</span>
      <span aria-hidden="true">{value}</span>
    </span>
  );
}

/** The home page below the form: what a report gives you, the before/after, and the evidence. */
export function HomeBands() {
  return (
    <>
      <section className="home-band" aria-labelledby="get-title">
        <div className="band-text">
          <p className="eyebrow">What you get</p>
          <h2 id="get-title">Every problem, with its proof</h2>
          <ol className="callouts">
            <li>
              <b>Where.</b> A box on a map of your level, rebuilt from what the ghosts saw.
            </li>
            <li>
              <b>Why.</b> A card with what happens, the likely cause and one thing to try.
            </li>
            <li>
              <b>Proof.</b> The replay of that moment, and the ghosts' own words.
            </li>
          </ol>
        </div>
        <figure className="band-shot">
          <img
            src="/home/report.webp"
            width="1100"
            height="967"
            loading="lazy"
            alt="A real Ghostrun report on Key Hunt: a box on the level map marks a key that is hard to see, next to its finding card with the measured contrast and a replay."
          />
          <figcaption>A real report on Key Hunt, one of our test games: its key is drawn almost in the floor colour, and the verdict says so first.</figcaption>
        </figure>
      </section>

      <section className="home-band reverse" aria-labelledby="fix-title">
        <div className="band-text">
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
        </div>
        <figure className="band-shot">
          <img
            src="/home/before-after.webp"
            width="1100"
            height="612"
            loading="lazy"
            alt="A real before and after: the gap nobody could cross becomes a fair jump that all four ghosts got past."
          />
          <figcaption>A real re-run of Gap Run after fixing the gap nobody could cross.</figcaption>
        </figure>
      </section>

      <section className="proof-band" aria-labelledby="proof-title">
        <h2 id="proof-title" className="eyebrow">
          Measured, not claimed
        </h2>
        <div className="proof-grid">
          <div>
            <span className="mono big">
              <CountUp to={44} />
              /50
            </span>
            <span className="muted small">planted design flaws found, in five benchmark rounds</span>
          </div>
          <div>
            <span className="mono big">
              <CountUp to={0} from={0} />
              /50
            </span>
            <span className="muted small">clean games with a false alarm</span>
          </div>
          <div>
            <span className="mono big">~$0.02</span>
            <span className="muted small">and about a minute per playtest</span>
          </div>
        </div>
        <a className="proof-link" href={`${REPO}/blob/main/bench/README.md`} target="_blank" rel="noreferrer">
          See the evidence, and where it falls short
        </a>
      </section>
    </>
  );
}
