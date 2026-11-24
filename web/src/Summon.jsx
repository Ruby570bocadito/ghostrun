import { useEffect, useState } from 'react';
import { Ghost, GhostSprite } from './Ghost.jsx';
import { HeroPreview } from './HeroPreview.jsx';
import { HomeBands } from './HomeBands.jsx';
import { Reveal, RiseWords } from './fx.jsx';

// The test games are served by the app under /play/; turn their paths into full links at this address.
const here = (path) => new URL(path, window.location.origin).href;

/** Turns what the visitor typed into a link, or says what is wrong (found by test agents: the browser's own
 * check showed nothing they could read, and "www.mygame.com" without https:// was refused). */
export function readLink(text) {
  const value = text.trim();
  if (!value) return { error: 'Paste your game\'s link first.' };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : /^[^\s/]+\.[^\s]+$/.test(value) ? `https://${value}` : value;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') && u.hostname !== 'localhost') throw new Error();
    return { url: u.href };
  } catch {
    return { error: 'That is not a link. Paste the full address of your game, like https://you.itch.io/your-game' };
  }
}

const ERRORS = {
  invalid_url: 'That does not look like a game link. Paste a full address that starts with http:// or https://',
  busy: 'The ghosts are busy with another game right now. Try again when that run finishes.',
  queue_full: 'Several playtests are already waiting for their turn. Try again in a few minutes.',
  budget: 'The spending cap for this demo has been reached.',
  no_key: 'The server has no Meta Model API key, so the ghosts cannot play.',
};

export function Summon({ config, onStarted }) {
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState([]);
  const [playSeconds, setPlaySeconds] = useState(150);
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
    const link = readLink(url);
    if (link.error) {
      setError(link.error);
      return;
    }
    setUrl(link.url);
    setSending(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: link.url, personas: selected, playSeconds, viewport, simulateOutage }),
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

  const chosen = (config?.personas ?? []).filter((p) => selected.includes(p.id));

  return (
    <section className="summon">
      <div className="hero">
        <div className="hero-copy">
          <RiseWords as="h1" text="Who gets stuck in your game?" />
          <Reveal as="p" className="lede" delay={0.35} y={10}>
            Paste your web game's link. AI ghosts with different personalities play it, think out loud, and show you where players will get stuck, before the deadline.
          </Reveal>
          <Reveal as="form" className="hero-form" onSubmit={submit} noValidate delay={0.5} y={10}>
            <label className="sr-only" htmlFor="game-url">
              Your game's link
            </label>
            <div className="url-row">
              <input
                id="game-url"
                className="url-input mono"
                type="url"
                placeholder="https://your-game.itch.io/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
                aria-describedby="link-error"
              />
              <button className="btn-primary" type="submit" disabled={sending || !selected.length || !config || config.error}>
                {sending ? 'Summoning…' : 'Summon the ghosts'}
              </button>
            </div>
            <p className="summon-hint muted small">
              {selected.length} {selected.length === 1 ? 'ghost' : 'ghosts'} · {playSeconds >= 120 ? `${playSeconds / 60} minutes` : `${playSeconds} s`} of play each · about $0.05–0.10 of AI · keyboard and mouse games
            </p>
            {error && (
              <p className="form-error" role="alert" id="link-error">
                {error}
              </p>
            )}
            {config?.error && <p className="form-error">Could not load the app settings. Is the server running?</p>}
            <details className="ghost-picker">
              <summary>
                <span className="chosen" aria-hidden="true">
                  {chosen.map((p) => (
                    <Ghost key={p.id} persona={p.id} color={p.color} size={30} />
                  ))}
                </span>
                <span className="picker-label">Change ghosts and options</span>
              </summary>
              <fieldset className="personas">
                <legend className="field-label">
                  Pick your ghosts <span className="muted small">· tap one to wake it up or let it sleep</span>
                </legend>
                <div className="persona-grid">
                  {(config?.personas ?? []).map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button type="button" key={p.id} className={`persona ${on ? 'on' : 'asleep'}`} style={{ '--c': p.color }} onClick={() => toggle(p.id)} aria-pressed={on}>
                        <span className="persona-art">
                          <GhostSprite persona={p.id} color={p.color} size={76} dim={!on} />
                        </span>
                        <span className="persona-name">{p.name}</span>
                        <span className="persona-style">{p.tagline ?? `${p.style.split('. ')[0]}.`}</span>
                        {p.quote && <q className="persona-quote">{p.quote}</q>}
                      </button>
                    );
                  })}
                </div>
                <p className="muted small persona-note">The game waits while each ghost thinks, so they can play action games too.</p>
              </fieldset>

              <details className="advanced">
                <summary>Advanced options</summary>
                <label className="adv-row">
                  <span>Game time per ghost</span>
                  <select value={playSeconds} onChange={(e) => setPlaySeconds(Number(e.target.value))}>
                    {[
                      [60, '1 minute'],
                      [150, '2 minutes 30'],
                      [240, '4 minutes'],
                    ].map(([n, label]) => (
                      <option key={n} value={n}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
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
            </details>
            {game && (
              <div className="quick-picks">
                <label className="muted" htmlFor="test-game">
                  No game handy? Try ours:
                </label>
                <select
                  id="test-game"
                  className="game-select"
                  value={game.id}
                  onChange={(e) => {
                    // Choosing a game fills in its link: two test agents chose one and got "Paste your game's link first".
                    setGameId(e.target.value);
                    const g = config.games.find((x) => x.id === e.target.value);
                    if (g) setUrl(here(g.url));
                  }}
                >
                  {config.games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.kind}
                    </option>
                  ))}
                </select>
                <button type="button" className="chip-btn" aria-pressed={url === here(game.url)} onClick={() => setUrl(here(game.url))}>
                  As designed
                </button>
                {game.faults.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="chip-btn chip-warn"
                    aria-pressed={url === here(`${game.url}?fault=${f.id}`)}
                    onClick={() => setUrl(here(`${game.url}?fault=${f.id}`))}
                  >
                    With a planted flaw: {f.label.charAt(0).toLowerCase() + f.label.slice(1)}
                  </button>
                ))}
              </div>
            )}

          </Reveal>
        </div>
        <Reveal delay={0.25} y={16}>
          <HeroPreview />
        </Reveal>
      </div>

      <HomeBands />
    </section>
  );
}
