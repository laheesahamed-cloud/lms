import { useMemo, useState } from 'react';
import './EcgInteractiveStrip.css';

const TYPE_LABEL = { p: 'P wave', t: 'T wave', qrs: 'QRS complex' };
const TYPE_DEFAULT_TEXT = {
  p: 'Atrial depolarization.',
  t: 'Ventricular repolarization.',
  qrs: 'No P wave before this beat — ectopic.',
};

// Only surface a subset of the real detected markers as tap targets:
// every P/T (they're the teaching point), and QRS only when it's flagged
// ectopic (the diagnostic finding) — normal QRS spikes don't need a label.
function pickHotspots(markers) {
  return markers.filter((m) => m.type === 'p' || m.type === 't' || (m.type === 'qrs' && m.ectopic));
}

function computeAvgHr(markers, pxPerMm, mmPerS) {
  const qrsX = markers.filter((m) => m.type === 'qrs').map((m) => m.x_px).sort((a, b) => a - b);
  if (qrsX.length < 2) return null;
  const pxPerSecond = pxPerMm * mmPerS;
  const seconds = [];
  for (let i = 1; i < qrsX.length; i++) {
    seconds.push((qrsX[i] - qrsX[i - 1]) / pxPerSecond);
  }
  const avgSec = seconds.reduce((a, b) => a + b, 0) / seconds.length;
  if (avgSec <= 0) return null;
  return Math.round(60 / avgSec);
}

export function EcgInteractiveStrip({ card }) {
  const [activeId, setActiveId] = useState(null);
  const ann = card.annotations;

  const hotspots = useMemo(() => (ann?.markers ? pickHotspots(ann.markers) : []), [ann]);
  const avgHr = useMemo(
    () => (ann ? computeAvgHr(ann.markers, ann.px_per_mm, ann.paper_speed_mm_s) : null),
    [ann],
  );

  if (!ann || !ann.width_px || !ann.height_px) {
    // No structured annotation data on this card — render the plain image,
    // same as every other ECG card today.
    return (
      <>
        {card.image_url && (
          <div className="ecg-card-image">
            <img src={card.image_url} alt={card.title} loading="lazy" />
          </div>
        )}
        {card.explanation && <p className="ecg-card-explanation">{card.explanation}</p>}
      </>
    );
  }

  const active = activeId != null ? hotspots[activeId] : null;

  return (
    <>
      <div className="ecg-card-image">
        <div className="ecg-strip-stage">
          <img src={card.image_url} alt={card.title} loading="lazy" />
          {avgHr != null && (
            <span className="ecg-strip-hr">
              {ann.lead && <b>{ann.lead}</b>} {avgHr} bpm
            </span>
          )}
          {hotspots.map((m, i) => {
            const left = (m.x_px / ann.width_px) * 100;
            const top = (m.y_px / ann.height_px) * 100;
            const isEctopic = m.type === 'qrs' && m.ectopic;
            return (
              <button
                key={`${m.type}-${m.sample}`}
                type="button"
                className={`ecg-strip-hotspot${isEctopic ? ' is-ectopic' : ''}${activeId === i ? ' is-active' : ''}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                aria-label={`Reveal ${TYPE_LABEL[m.type] || m.type}`}
                onClick={() => setActiveId((cur) => (cur === i ? null : i))}
              >
                {isEctopic ? '!' : m.type === 'p' ? 'P' : m.type === 't' ? 'T' : ''}
                <span className="sr-only">{TYPE_LABEL[m.type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div className="ecg-strip-callout">
          <strong>{TYPE_LABEL[active.type]}</strong>
          <span>{active.note || TYPE_DEFAULT_TEXT[active.type]}</span>
        </div>
      )}

      {card.explanation && <p className="ecg-card-explanation">{card.explanation}</p>}
      {card.source_credit && <p className="ecg-strip-credit">{card.source_credit}</p>}
    </>
  );
}
