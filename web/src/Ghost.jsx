// The ghosts: one line-art mark (design 21, chosen by Rafa), drawn in SVG so it stays sharp from favicon to poster size
// and can be animated by parts. Each persona has its own colour, accessory and way of moving; each mood its own face.

const LINE = '#7cf5e6';
export const MOODS = ['calm', 'think', 'confused', 'happy', 'angry', 'dead', 'sleep'];

// The body, in a 64 × 72 box: a dome, straight sides and a wavy hem.
const BODY = 'M14 60V30C14 17.8 21.8 10 32 10s18 7.8 18 20v30q-4.5-5-9 0t-9 0t-9 0t-9 0z';

function Eyes({ mood, color }) {
  const s = { stroke: color, strokeWidth: 2.6, strokeLinecap: 'round', fill: 'none' };
  switch (mood) {
    case 'happy':
      return <path {...s} d="M22 34q3-4.5 6 0M36 34q3-4.5 6 0" />;
    case 'dead':
      return <path {...s} strokeWidth={2.4} d="M22 29l5 5M27 29l-5 5M37 29l5 5M42 29l-5 5" />;
    case 'sleep':
      return <path {...s} d="M22 32q3 3 6 0M36 32q3 3 6 0" />;
    case 'think':
      return (
        <g fill={color}>
          <circle cx="27" cy="29.5" r="2.7" />
          <circle cx="41" cy="29.5" r="2.7" />
        </g>
      );
    case 'confused':
      return (
        <g fill={color}>
          <circle cx="25" cy="32" r="2" />
          <circle cx="39" cy="31" r="3.4" />
        </g>
      );
    default:
      return (
        <g className="g-blink" fill={color}>
          <circle cx="25" cy="32" r="2.7" />
          <circle cx="39" cy="32" r="2.7" />
        </g>
      );
  }
}

// What each mood adds around the face: brows, a question mark, a thought, sparkles, z's.
function MoodMarks({ mood, color }) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  switch (mood) {
    case 'angry':
      return <path {...s} d="M20.5 24.5l7 3M43.5 24.5l-7 3M47 9l3.5-4M50 12.5l5-1.5M44.5 8l.5-5" />;
    case 'confused':
      return <path {...s} d="M50 6.5a4 4 0 1 1 5.5 3.7c-1.3.6-1.8 1.4-1.8 2.8M53.7 16.6v.2" />;
    case 'think':
      return (
        <g fill={color}>
          <circle cx="51" cy="12" r="1.6" />
          <circle cx="55" cy="7.5" r="2.2" />
        </g>
      );
    case 'happy':
      return <path {...s} d="M6 14v6M3 17h6M57 20v5M54.5 22.5h5" />;
    case 'sleep':
      return <path {...s} strokeWidth={1.8} d="M48 6h5l-5 6h5M55.5 1h3.5l-3.5 4h3.5" />;
    default:
      return null;
  }
}

// One accessory per persona, in the same line. Hidden at small sizes, where only the colour tells them apart.
function Accessory({ persona, color }) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  switch (persona) {
    case 'newbie': // a sprout: new to games
      return <path {...s} d="M32 10V4.5M32 7q-4.5-4-8-.5q4 3.5 8 .5M32 6q4.5-4 8-.5q-4 3.5-8 .5" />;
    case 'speedrunner': // speed lines and a headband
      return <path {...s} d="M3 27h7M1 35h9M4 43h6M15.5 22.5Q32 17 48.5 22.5" />;
    case 'completionist': // a magnifying glass
      return (
        <g {...s}>
          <circle cx="50" cy="47" r="6" fill="#0b0d17" />
          <path d="M54.5 51.5l5 5" />
        </g>
      );
    case 'reader': // round glasses
      return <path {...s} d="M19.5 32a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0M33.5 32a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0M30.5 31.5h3" />;
    case 'impatient': // a frown, always
      return <path {...s} d="M21 25l6.5 2.5M43 25l-6.5 2.5" />;
    default:
      return null;
  }
}

/** The ghost as SVG parts in a 64 × 72 box, for use inside another SVG (the hero scene). */
export function GhostShape({ persona, color = LINE, mood = 'calm', detail = true }) {
  return (
    <g className={`g-art p-${persona ?? 'mark'} m-${mood}`}>
      <g className="g-float">
        <path d={BODY} fill={color} fillOpacity="0.08" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        <Eyes mood={mood} color={color} />
        {detail && !(mood === 'angry' && persona === 'impatient') && <Accessory persona={persona} color={color} />}
        {detail && <MoodMarks mood={mood} color={color} />}
      </g>
    </g>
  );
}

/** A ghost. Decorative unless given a title: the persona's name is always written next to it. */
export function Ghost({ persona, color = LINE, size = 64, mood = 'calm', dim = false, still = false, title }) {
  return (
    <svg
      className={`ghost${dim ? ' dim' : ''}${still ? ' still' : ''}`}
      width={size}
      height={(size * 72) / 64}
      viewBox="0 0 64 72"
      overflow="visible"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <GhostShape persona={persona} color={color} mood={mood} detail={size >= 28} />
    </svg>
  );
}

// The names the rest of the app already uses.
export const GhostIcon = ({ color, size = 28, mood = 'calm', title }) => <Ghost color={color} size={size} mood={mood} title={title} still={size < 24} />;
export const GhostSprite = ({ persona, color, size = 64, dim = false, mood = 'calm' }) => (
  <Ghost persona={persona} color={color} size={size} mood={dim ? 'sleep' : mood} dim={dim} />
);

export const OUTCOME_LABEL = {
  playing: 'Playing',
  won: 'Finished',
  quit: 'Quit',
  out_of_steps: 'Out of moves',
  stopped: 'Stopped',
  saturated: 'Seen enough',
  error: 'Error',
  waiting: 'Waiting',
};

export const moodFor = (outcome) =>
  outcome === 'won' ? 'happy' : outcome === 'quit' || outcome === 'saturated' ? 'angry' : outcome === 'error' ? 'dead' : outcome === 'out_of_steps' ? 'confused' : outcome === 'waiting' ? 'sleep' : 'calm';
