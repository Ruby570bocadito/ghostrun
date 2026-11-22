// The ghost mark, tinted per persona.
export function GhostIcon({ color = '#9bf6ec', size = 28, mood = 'calm', title }) {
  const eyeY = mood === 'dead' ? 15 : 15;
  return (
    <svg width={size} height={(size * 36) / 32} viewBox="0 0 32 36" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M16 2C8.8 2 3 7.8 3 15v17l4.3-3 4.3 3 4.4-3 4.3 3 4.4-3L29 32V15C29 7.8 23.2 2 16 2z" fill={color} />
      {mood === 'dead' ? (
        <g stroke="#0b0d17" strokeWidth="2" strokeLinecap="round">
          <path d="M9.5 13l4 4M13.5 13l-4 4M18.5 13l4 4M22.5 13l-4 4" />
        </g>
      ) : (
        <>
          <circle cx="11.5" cy={eyeY} r="2.6" fill="#0b0d17" />
          <circle cx="20.5" cy={eyeY} r="2.6" fill="#0b0d17" />
        </>
      )}
      {mood === 'happy' && <path d="M12 21q4 3.5 8 0" stroke="#0b0d17" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {mood === 'angry' && <path d="M8.5 10.5l5 2M23.5 10.5l-5 2" stroke="#0b0d17" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

// Character art for each persona: pixel sprites made with Muse Image (web/public/ghosts/, one family, chosen by Rafa).
const SPRITES = new Set(['newbie', 'speedrunner', 'reader', 'impatient', 'completionist']);

/** The persona's character; the plain ghost mark for a persona without art. Decorative: the name is always next to it. */
export function GhostSprite({ persona, color, size = 64, dim = false, mood = 'calm' }) {
  if (!SPRITES.has(persona)) return <GhostIcon color={color} size={Math.round(size * 0.6)} mood={mood} />;
  return (
    <img
      className={`ghost-sprite${dim ? ' dim' : ''}${mood === 'dead' ? ' dead' : ''}`}
      src={`/ghosts/${persona}.webp`}
      width={size}
      height={size}
      alt=""
      decoding="async"
    />
  );
}

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

export const moodFor = (outcome) => (outcome === 'won' ? 'happy' : outcome === 'quit' || outcome === 'saturated' ? 'angry' : outcome === 'error' ? 'dead' : 'calm');
