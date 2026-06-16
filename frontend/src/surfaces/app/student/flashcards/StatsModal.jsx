import { useEffect, useState } from 'react';
import { getFlashcardStats } from '../../../../shared/api/flashcards.api.js';
import { localStats } from '../../../../shared/flashcards/localStore.js';

/* Folded-in flashcard analytics: state mix, true retention, reviews/day and the
   due forecast — for synced lesson cards (server) and on-device cards (local). */

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="xfc-modal-backdrop" onClick={onClose}>
      <div className="xfc-modal xfc-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="xfc-modal-head">
          <h2>{title}</h2>
          <button type="button" className="xfc-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="xfc-modal-body">{children}</div>
      </div>
    </div>
  );
}

function BarChart({ series, color, max }) {
  const peak = max || Math.max(1, ...series.map((d) => d.count));
  if (!series.length) return <p className="xfc-help">No data yet.</p>;
  return (
    <div className="xfc-bars">
      {series.map((d) => (
        <div key={d.date} className="xfc-bar" title={`${d.date}: ${d.count}`}>
          <span className="xfc-bar-fill" style={{ height: `${Math.round((d.count / peak) * 100)}%`, background: color }} />
        </div>
      ))}
    </div>
  );
}

function StatBlock({ title, data }) {
  if (!data) return null;
  const counts = data.counts || {};
  return (
    <div className="xfc-stat-block">
      <h3>{title}</h3>
      <div className="xfc-stat-grid">
        <Stat label="New" value={counts.new || 0} tone="new" />
        <Stat label="Learning" value={(counts.learning || 0) + (counts.relearning || 0)} tone="learn" />
        <Stat label="Review" value={counts.review || 0} tone="due" />
        <Stat label="Retention" value={data.retention != null ? `${data.retention}%` : '—'} tone="acc" />
      </div>
      <div className="xfc-stat-row"><span>Total reviews</span><strong>{data.totalReviews || 0}</strong></div>
      {data.mature != null ? <div className="xfc-stat-row"><span>Mature / Young</span><strong>{data.mature} / {data.young}</strong></div> : null}
      <h4>Reviews / day</h4>
      <BarChart series={(data.reviewsPerDay || []).slice(-14)} color="var(--brand-primary-start)" />
      {data.dueForecast ? (<><h4>Due forecast</h4><BarChart series={data.dueForecast.slice(0, 14)} color="var(--color-success)" /></>) : null}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`xfc-statcell xfc-statcell--${tone}`}>
      <span className="xfc-statcell-value">{value}</span>
      <span className="xfc-statcell-label">{label}</span>
    </div>
  );
}

export function StatsModal({ onClose }) {
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [local] = useState(() => localStats());

  useEffect(() => {
    let alive = true;
    getFlashcardStats()
      .then((d) => { if (alive) setServer(d); })
      .catch(() => { if (alive) setServer(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const hasLocal = (local.totalReviews || 0) > 0 || Object.values(local.counts || {}).some((v) => v > 0);

  return (
    <Modal title="Flashcard stats" onClose={onClose}>
      {loading ? <div className="xfc-loading"><div className="xfc-spinner" /></div> : <StatBlock title="Lesson decks" data={server} />}
      {hasLocal ? <StatBlock title="My decks" data={local} /> : null}
    </Modal>
  );
}

export default StatsModal;
