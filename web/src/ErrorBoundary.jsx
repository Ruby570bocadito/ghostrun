import { Component } from 'react';
import { Ghost } from './Ghost.jsx';

/**
 * Catches a page that fails to render (a bad report, a part of the app that could not be downloaded after an update)
 * and shows a way out instead of a blank screen. It clears itself when the page changes (resetKey).
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ghostrun: a page failed to render.', error, info?.componentStack ?? '');
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // After an update, the old page may ask for code that is no longer there: reloading fetches the new version.
    const stale = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(String(this.state.error?.message));
    return (
      <section className="panel center state-panel" role="alert">
        <span className="state-art">
          <Ghost mood="confused" size={110} />
        </span>
        <h2>{stale ? 'Ghostrun was updated' : 'This page tripped over something'}</h2>
        <p className="muted">{stale ? 'Reload to get the new version.' : 'Your playtests are safe. Go back to the start, or reload the page.'}</p>
        <div className="state-actions">
          <button className="btn-primary" type="button" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn-ghost" type="button" onClick={() => (location.hash = '')}>
            Back to the start
          </button>
        </div>
      </section>
    );
  }
}
