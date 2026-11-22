import { Ghost, MOODS } from './Ghost.jsx';

const MOOD_LABEL = { calm: 'Idle', think: 'Thinking', confused: 'Confused', happy: 'Finished', angry: 'Quits', dead: 'Error', sleep: 'Asleep' };

/** #/cast: every ghost in every mood and at every size, to review the character design in one screen. */
export function Cast({ personas }) {
  const list = Object.values(personas);
  return (
    <section className="cast">
      <h1>The cast</h1>
      <p className="muted">Each ghost has its own colour, accessory and way of moving; each mood its own face and motion.</p>
      <div className="cast-grid" style={{ gridTemplateColumns: `140px repeat(${MOODS.length}, minmax(0, 1fr))` }}>
        <span />
        {MOODS.map((m) => (
          <span key={m} className="cast-head">
            {MOOD_LABEL[m]}
          </span>
        ))}
        {list.map((p) => [
          <span key={p.id} className="cast-name" style={{ color: p.color }}>
            {p.name}
          </span>,
          ...MOODS.map((m) => (
            <span key={p.id + m} className="cast-cell">
              <Ghost persona={p.id} color={p.color} size={72} mood={m} />
            </span>
          )),
        ])}
      </div>
      <h2>Sizes</h2>
      <div className="cast-sizes">
        {[16, 24, 32, 48, 96, 160, 240].map((s) => (
          <span key={s} className="cast-size">
            <Ghost persona="newbie" color={personas.newbie?.color} size={s} />
            <small className="mono muted">{s}px</small>
          </span>
        ))}
      </div>
    </section>
  );
}
