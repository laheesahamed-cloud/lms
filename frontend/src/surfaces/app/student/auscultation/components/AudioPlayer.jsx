import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchAuscAudioUrl } from '../../../../../shared/api/auscultation.api.js';
import { HeartIcon, LungIcon } from './icons.jsx';
import './AudioPlayer.css';

function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Authenticated audio player with a built-in playback visualizer.
 * category: 'heart' (beat pulse) | 'lung' (breathing wave).
 */
export function AudioPlayer({ kind, id, category = 'heart', title }) {
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  // Revoke the object URL on unmount
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const ensureLoaded = useCallback(async () => {
    if (ready || loading) return audioRef.current;
    setLoading(true);
    setError(null);
    try {
      const url = await fetchAuscAudioUrl(kind, id);
      urlRef.current = url;
      const el = audioRef.current;
      el.src = url;
      setReady(true);
      return el;
    } catch {
      setError('Could not load audio');
      return null;
    } finally {
      setLoading(false);
    }
  }, [kind, id, ready, loading]);

  async function toggle() {
    const el = await ensureLoaded();
    if (!el) return;
    if (el.paused) { el.play().catch(() => setError('Playback failed')); }
    else { el.pause(); }
  }

  const bars = category === 'lung' ? 5 : 7;

  return (
    <div className={`auscp auscp--${category} ${playing ? 'is-playing' : ''}`}>
      <button className="auscp-btn" onClick={toggle} disabled={loading}
        aria-label={playing ? 'Pause' : 'Play'}>
        {loading ? (
          <span className="auscp-spin" />
        ) : playing ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>
        )}
      </button>

      <div className="auscp-main">
        <div className="auscp-top">
          {title && <span className="auscp-title">{title}</span>}
          <span className="auscp-cat">
            {category === 'lung' ? <LungIcon size={14} /> : <HeartIcon size={14} />}
            {category === 'lung' ? 'Lung' : 'Heart'}
          </span>
        </div>

        {/* Visualizer */}
        <div className="auscp-viz" aria-hidden="true">
          {Array.from({ length: bars }).map((_, i) => (
            <span key={i} className="auscp-bar" style={{ '--i': i }} />
          ))}
        </div>

        {/* Progress */}
        <div className="auscp-progress">
          <input
            type="range" min={0} max={dur || 0} step="0.01" value={cur}
            onChange={(e) => { const el = audioRef.current; if (el) { el.currentTime = Number(e.target.value); setCur(el.currentTime); } }}
            className="auscp-seek" aria-label="Seek"
          />
          <div className="auscp-time"><span>{fmt(cur)}</span><span>{dur ? fmt(dur) : '--:--'}</span></div>
        </div>

        {error && <span className="auscp-error">{error}</span>}
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCur(0); }}
        onTimeUpdate={(e) => setCur(e.target.currentTime)}
        onLoadedMetadata={(e) => setDur(e.target.duration || 0)}
      />
    </div>
  );
}
