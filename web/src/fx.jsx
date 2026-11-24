// Motion for the whole app, in one place: the timing, and the shared pieces (reveal on scroll, staggered lists,
// counters). The app is wrapped in <MotionConfig reducedMotion="user"> (main.jsx), and styles.css stills every CSS
// animation for people who ask for less motion.
import { animate, m, useInView, useReducedMotion } from 'motion/react';
import { Fragment, createElement, useEffect, useRef, useState } from 'react';

export const EASE = [0.22, 1, 0.36, 1]; // quick start, gentle landing
export const DUR = { fast: 0.18, base: 0.35, slow: 0.6 };

// Automated browsers (screenshots for the README and the gallery are taken with Playwright) get everything already in
// place: a full-page capture does not scroll, so content waiting to be revealed would come out blank.
export const STILL = typeof navigator !== 'undefined' && navigator.webdriver === true;

const VIEW = { once: true, margin: '0px 0px -10% 0px' };

/** Fades and lifts its content in, the first time it scrolls into view. */
export function Reveal({ as = 'div', delay = 0, y = 18, children, ...rest }) {
  const reduce = useReducedMotion();
  if (STILL) return createElement(as, rest, children);
  const Tag = m[as] ?? m.div;
  return (
    <Tag initial={{ opacity: 0, y: reduce ? 0 : y }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEW} transition={{ duration: DUR.slow, ease: EASE, delay }} {...rest}>
      {children}
    </Tag>
  );
}

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const ITEM = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } } };

/** A list whose items come in one after another when it scrolls into view (items: <Item>). */
export function Stagger({ as = 'ul', children, ...rest }) {
  if (STILL) return createElement(as, rest, children);
  const Tag = m[as] ?? m.ul;
  return (
    <Tag variants={LIST} initial="hidden" whileInView="show" viewport={VIEW} {...rest}>
      {children}
    </Tag>
  );
}

export function Item({ as = 'li', children, ...rest }) {
  if (STILL) return createElement(as, rest, children);
  const Tag = m[as] ?? m.li;
  return (
    <Tag variants={ITEM} {...rest}>
      {children}
    </Tag>
  );
}

/** A number that counts up once when it comes into view; screen readers get the final value at once. */
export function CountUp({ to, from = 0, duration = 0.9, format = (v) => String(Math.round(v)) }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW);
  const reduce = useReducedMotion();
  const still = STILL || reduce;
  const [value, setValue] = useState(still ? to : from);
  useEffect(() => {
    if (still) {
      setValue(to);
      return undefined;
    }
    if (!inView) return undefined;
    const controls = animate(from, to, { duration, ease: EASE, onUpdate: setValue });
    return () => controls.stop();
  }, [inView, still, from, to, duration]);
  return (
    <span ref={ref}>
      <span className="sr-only">{format(to)}</span>
      <span aria-hidden="true">{format(value)}</span>
    </span>
  );
}

/** A heading whose words rise in one after another when the page opens. */
export function RiseWords({ text, as = 'h1', className, delay = 0 }) {
  const reduce = useReducedMotion();
  if (STILL) return createElement(as, { className }, text);
  const Tag = m[as] ?? m.h1;
  const words = text.split(' ');
  return (
    <Tag className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}>
      {words.map((w, k) => (
        <Fragment key={k}>
          <m.span className="word" variants={{ hidden: { opacity: 0, y: reduce ? 0 : '0.42em' }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}>
            {w}
          </m.span>
          {k < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}
