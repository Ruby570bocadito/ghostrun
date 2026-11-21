import { useEffect, useState } from 'react';

/** Plays a sequence of frames like a short video. */
export function Clip({ frames, fps = 10, label, autoPlay = true }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);

  useEffect(() => {
    setI(0);
    frames.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [frames]);

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % frames.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, frames.length, fps]);

  if (!frames.length) return null;
  return (
    <figure className="clip">
      <img src={frames[i]} alt={label} decoding="async" />
      <figcaption>
        <button type="button" className="clip-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause clip' : 'Play clip'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="clip-bar">
          <span style={{ width: `${(i / Math.max(1, frames.length - 1)) * 100}%` }} />
        </span>
        <span className="mono small">{((frames.length / fps) | 0) || 1}s</span>
      </figcaption>
    </figure>
  );
}
