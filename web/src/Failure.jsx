import { Ghost } from './Ghost.jsx';
import { friendlyFailure } from './words.js';

/** A playtest that could not happen: what went wrong in plain words, the browser's own message on request, and a way out. */
export function FailurePanel({ title, message = '', note = null, action, onAction }) {
  const friendly = friendlyFailure(message);
  return (
    <section className="panel center state-panel" role="alert">
      <span className="state-art">
        <Ghost mood="dead" size={120} />
      </span>
      <h1>{title}</h1>
      <p className="muted">{friendly ?? message}</p>
      {note}
      {friendly && (
        <details className="state-detail">
          <summary>What the browser said</summary>
          <code>{message}</code>
        </details>
      )}
      <button className="btn-primary" type="button" onClick={onAction}>
        {action}
      </button>
    </section>
  );
}
