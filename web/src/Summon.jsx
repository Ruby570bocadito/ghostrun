import { useEffect, useState } from 'react';
import { GhostIcon } from './Ghost.jsx';
import { HeroScene } from './HeroScene.jsx';

const REPO = 'https://github.com/Ruby570bocadito/ghostrun';

const ERRORS = {
  invalid_url: 'That does not look like a game link. Paste a full address that starts with http:// or https://',
  busy: 'The ghosts are busy with another game right now. Try again when that run finishes.',
  budget: 'The spending cap for this demo has been reached.',
  no_key: 'The server has no Meta Model API key, so the ghosts cannot play.',
};

export function Summon({ config, onStarted }) {
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState([]);
  const [steps, setSteps] = useState(40);
  const [viewport, setViewport] = useState('640x360');
  const [simulateOutage, setSimulateOutage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (config?.defaultPersonas && !selected.length) setSelected(config.defaultPersonas);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), personas: selected, steps, viewport, simulateOutage }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(ERRORS[body.error] ?? body.message ?? 'Something went wrong starting the run.');
        if (body.error === 'busy' && body.runId) setTimeout(() => onStarted(body.runId), 1200);
        return;
      }
      onStarted(body.id);
    } catch {
      setError('Could not reach the server. Is it running?');
    } finally {
      setSending(false);
    }
  };

  const [gameId, setGameId] = useState('gap-run');
  const game = config?.games?.find((g) => g.id === gameId) ?? config?.games?.[0];

  return (
    <section className="summon">
      <div className="summon-hero">
        <h1>Who gets stuck in your game?</h1>
        <p className="lede">
          Paste your web game's link. AI ghosts with different personalities play it, think out loud, and show you exactly where players will get stuck, before the
          deadline.
        </p>
        <HeroScene />
      </div>

      <form className="summon-card" onSubmit={submit}>
        <label className="field-label" htmlFor="game-url">
          Game link
        </label>
        <div className="url-row">
          <input
            id="game-url"
            className="url-input mono"
            type="url"
            placeholder="https://your-game.itch.io/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            autoComplete="off"
          />
          <button className="btn-primary" type="submit" disabled={sending || !selected.length || !config || config.error}>
            {sending ? 'Summoning…' : 'Summon the ghosts'}
          </button>
        </div>
        {game && (
          <div className="quick-picks">
            <label className="muted" htmlFor="test-game">
              No game handy? Try ours:
            </label>
            <select id="test-game" className="game-select" value={game.id} onChange={(e) => setGameId(e.target.value)}>
              {config.games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.kind}
                </option>
              ))}
            </select>
            <button type="button" className="chip-btn" onClick={() => setUrl(game.url)}>
              As designed
            </button>
            {game.faults.map((f) => (
              <button key={f.id} type="button" className="chip-btn chip-warn" onClick={() => setUrl(`${game.url}?fault=${f.id}`)}>
                With a planted flaw: {f.label.charAt(0).toLowerCase() + f.label.slice(1)}
              </button>
            ))}
          </div>
        )}

        <fieldset className="personas">
          <legend className="field-label">Ghosts to summon</legend>
          <div className="persona-grid">
            {(config?.personas ?? []).map((p) => {
              const on = selected.includes(p.id);
              return (
                <button type="button" key={p.id} className={`persona ${on ? 'on' : ''}`} style={{ '--c': p.color }} onClick={() => toggle(p.id)} aria-pressed={on}>
                  <GhostIcon color={on ? p.color : '#3a3f63'} size={30} />
                  <span className="persona-name">{p.name}</span>
                  <span className="persona-style">{p.style.split('. ')[0]}.</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="summon-foot">
          <label className="steps">
            <span className="muted">Moves per ghost</span>
            <select value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
              {[20, 40, 60].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">The game is paused while each ghost thinks, so they can play real-time games too.</p>
        </div>
        <details className="advanced">
          <summary>Advanced options</summary>
          <label className="adv-row">
            <span>Game window size</span>
            <select value={viewport} onChange={(e) => setViewport(e.target.value)}>
              <option value="640x360">640×360 (fast, small games)</option>
              <option value="960x540">960×540 (games made for bigger screens)</option>
            </select>
          </label>
          <label className="adv-row">
            <input type="checkbox" checked={simulateOutage} onChange={(e) => setSimulateOutage(e.target.checked)} />
            <span>Test: simulate an AI outage for the first ghost from its 6th move (to see the backup model take over)</span>
          </label>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {config?.error && <p className="form-error">Could not load the app settings. Is the server running?</p>}
      </form>

      <div className="how" aria-label="How it works">
        <div className="how-step">
          <span className="how-num">01</span>
          <b>Paste a link</b>
          <span>Any web game in a browser. No install; a one-line SDK is optional for exact positions.</span>
        </div>
        <div className="how-step">
          <span className="how-num">02</span>
          <b>Ghosts play it</b>
          <span>Four AI players with different personalities play at once. The game clock freezes while each one thinks.</span>
        </div>
        <div className="how-step">
          <span className="how-num">03</span>
          <b>See where players get stuck</b>
          <span>A map of the level, blockers and confusing spots, each with the replay and the ghosts' own words.</span>
        </div>
      </div>

      <p className="proof">
        <span>
          <b>20/20</b> planted design flaws found in our benchmark
        </span>
        <span>
          <b>0</b> false alarms in <b>20</b> runs on clean games
        </span>
        <span>
          about <b>$0.02</b> and <b>1 min</b> per playtest
        </span>
        <a href={`${REPO}/blob/main/bench/README.md`} target="_blank" rel="noreferrer">
          See the evidence
        </a>
      </p>
    </section>
  );
}
