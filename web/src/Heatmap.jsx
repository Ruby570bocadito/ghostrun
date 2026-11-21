import { useEffect, useRef, useState } from 'react';

export const TYPE_LABEL = { blocker: 'Blocker', friction: 'Friction', missed: 'Missed objective', stuck: 'Stuck', confusion: 'Confusing' };

const SCREEN_W = 640;
const SCREEN_H = 360;
const HUD_BAND = 34; // top strip with the game's fixed HUD; left out of the stitched level

function loadImage(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/**
 * The whole level rebuilt from the ghosts' own frames (no game integration needed beyond positions),
 * with where they spent time (heat), where they died (✕) and the hotspots on top.
 */
export function Heatmap({ runId, report, traces, personas, selected, onSelect }) {
  const baseRef = useRef(null);
  const heatRef = useRef(null);
  const [stitched, setStitched] = useState(false);
  const W = report.positionSource === 'ghosts' ? report.worldW : Math.max(SCREEN_W, report.worldW);
  const H = report.positionSource === 'ghosts' ? report.worldH : Math.max(SCREEN_H, report.worldH);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctx = baseRef.current?.getContext('2d');
      if (!ctx || !traces.length) return;
      ctx.fillStyle = '#141726';
      ctx.fillRect(0, 0, W, H);
      if (report.positionSource === 'ghosts') {
        // No SDK: there is no camera information to stitch a level from. Use a screen from the middle of
        // normal play as the backdrop (positions are on-screen coordinates the ghosts reported).
        const t = traces.find((tr) => tr.steps.some((s) => s.saw === 'playing')) ?? traces[0];
        const playing = t.steps.filter((s) => s.saw === 'playing');
        const s = playing[Math.floor(playing.length / 2)] ?? t.steps.at(-1);
        const f = t.frames[s?.frames?.[0] ?? 0];
        const img = f && (await loadImage(`/runs/${runId}/${t.persona}/${f.file}`));
        if (cancelled) return;
        if (img) ctx.drawImage(img, 0, 0, W, H);
        setStitched(true);
        return;
      }
      // Least-progressed ghost first, so the ghost that saw most of the level paints last.
      const ordered = [...traces].sort((a, b) => maxX(a) - maxX(b));
      for (const t of ordered) {
        const deathsT = t.events.filter((e) => e.type === 'death').map((e) => e.t);
        const frames = t.frames.filter(
          (f, i) =>
            i % 2 === 0 &&
            f.state &&
            Number.isFinite(f.state.screenX) &&
            !f.state.won &&
            !deathsT.some((d) => f.pageT >= d - 50 && f.pageT <= d + 350),
        );
        const imgs = await Promise.all(frames.map((f) => loadImage(`/runs/${runId}/${t.persona}/${f.file}`)));
        if (cancelled) return;
        frames.forEach((f, k) => {
          const img = imgs[k];
          if (!img) return;
          const sx = f.state.x - f.state.screenX;
          const sy = f.state.y - f.state.screenY;
          const px = sx + f.state.screenX;
          const py = sy + f.state.screenY;
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx, sy + HUD_BAND, SCREEN_W, SCREEN_H - HUD_BAND);
          ctx.rect(px - 26, py - 32, 52, 64); // leave the ghost's own character out of the level picture
          ctx.clip('evenodd');
          ctx.drawImage(img, sx, sy);
          ctx.restore();
        });
      }
      if (!cancelled) setStitched(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, traces, W, H]);

  useEffect(() => {
    const ctx = heatRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of report.heat) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
      g.addColorStop(0, 'rgba(255, 107, 107, 0.05)');
      g.addColorStop(1, 'rgba(255, 107, 107, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const d of report.deaths) {
      const c = personas[d.persona]?.color ?? '#fff';
      const y = Math.min(H - 12, d.y);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0b0d17';
      cross(ctx, d.x, y);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c;
      cross(ctx, d.x, y);
    }
  }, [report, personas, W, H]);

  return (
    <div className="heatmap" style={{ aspectRatio: `${W} / ${H}` }}>
      <canvas ref={baseRef} width={W} height={H} className={stitched ? 'ready' : ''} />
      <canvas ref={heatRef} width={W} height={H} />
      {(report.findings ?? report.hotspots).map((h) => {
        const r = h.region ?? { x0: h.x0 - 30, x1: h.x1 + 30, y0: 0, y1: H };
        return (
          <button
            key={h.id}
            type="button"
            className={`hot-band ${h.type} ${selected === h.id ? 'selected' : ''}`}
            style={{ left: `${(r.x0 / W) * 100}%`, width: `${((r.x1 - r.x0) / W) * 100}%`, top: `${(r.y0 / H) * 100}%`, height: `${((r.y1 - r.y0) / H) * 100}%` }}
            onClick={() => onSelect(h.id)}
            aria-label={`${TYPE_LABEL[h.type] ?? h.type}: ${h.ghosts.length} of ${report.ghostsTotal} ghosts`}
          >
            <span className="hot-tag">
              {TYPE_LABEL[h.type] ?? h.type} · {h.ghosts.length}/{report.ghostsTotal}
            </span>
          </button>
        );
      })}
      {!stitched && <div className="heatmap-loading">Rebuilding the level from the ghosts' frames…</div>}
    </div>
  );
}

function cross(ctx, x, y, r = 6) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

function maxX(t) {
  return Math.max(0, ...t.frames.map((f) => f.state?.x ?? 0));
}
