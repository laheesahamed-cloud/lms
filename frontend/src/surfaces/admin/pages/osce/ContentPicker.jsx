import { useEffect, useMemo, useRef, useState } from 'react';
import { adminOsceLinkable } from '../../../../shared/api/osce.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';

/**
 * Attach existing ECG cards and auscultation clips to a case.
 *
 * Linking beats generating: the content is already correct and already
 * reviewed, it costs nothing, and an image model cannot draw a real ECG at all.
 * Sound steps in particular are inert until one of these is attached — the
 * player renders but plays nothing.
 *
 * Every row previews before you commit, because picking a diagnostic by title
 * is guesswork — two cards both called "Atrial fibrillation" show different
 * things, and choosing the wrong one is the failure this whole feature exists
 * to avoid.
 */
export function ContentPicker({ kind, value, onChange, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null); // id being previewed

  useEffect(() => {
    adminOsceLinkable()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  // Escape closes, because this sits over the editor.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = useMemo(() => {
    if (!data) return [];
    const list = kind === 'ecg' ? data.ecgCards : data.auscultationCards;
    const q = query.trim().toLowerCase();
    if (!q) return list || [];
    return (list || []).filter(
      (i) => i.title.toLowerCase().includes(q) || (i.group || '').toLowerCase().includes(q)
    );
  }, [data, kind, query]);

  return (
    <div className="osce-picker-backdrop" onClick={onClose}>
      <div className="osce-picker" onClick={(e) => e.stopPropagation()}>
        <div className="osce-picker-head">
          <b>{kind === 'ecg' ? 'Attach an ECG card' : 'Attach a heart or lung sound'}</b>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <input
          className="osce-input osce-input--full"
          autoFocus
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <p className="osce-hint">
          {kind === 'ecg'
            ? 'Open one to see the trace before you attach it.'
            : 'Play one to hear it before you attach it.'}
        </p>

        {error ? <p className="osce-error">{error}</p> : null}
        {!data && !error ? <p className="osce-hint">Loading…</p> : null}

        <div className="osce-picker-list">
          {data && !items.length ? (
            <p className="osce-hint">
              {kind === 'ecg'
                ? 'No ECG cards found. Add them in Admin → ECG Library first.'
                : 'No sounds found. Add them in Admin → Auscultation first.'}
            </p>
          ) : null}

          {items.map((item) => (
            <PickerRow
              key={item.id}
              item={item}
              kind={kind}
              selected={value === item.id}
              open={open === item.id}
              onPreview={() => setOpen(open === item.id ? null : item.id)}
              onPick={() => { onChange(item); onClose(); }}
            />
          ))}
        </div>

        {value ? (
          <button
            type="button"
            className="osce-btn-danger osce-picker-clear"
            onClick={() => { onChange(null); onClose(); }}
          >
            Remove the current link
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PickerRow({ item, kind, selected, open, onPreview, onPick }) {
  const missing = kind === 'sound' && item.hasAudio === false;

  return (
    <div className={`osce-picker-row ${selected ? 'is-sel' : ''} ${open ? 'is-open' : ''}`}>
      <div className="osce-picker-rowmain">
        <div className="osce-picker-rowtext">
          <span className="osce-picker-title">{item.title}</span>
          <span className="osce-picker-meta">
            {item.group}
            {item.category ? ` · ${item.category}` : ''}
            {missing ? ' · no audio' : ''}
            {' · '}<code>#{item.id}</code>
          </span>
        </div>
        <div className="osce-picker-rowactions">
          <button type="button" onClick={onPreview}
                  disabled={kind === 'ecg' ? !item.image : !item.audio}>
            {open ? 'Hide' : kind === 'ecg' ? 'View' : 'Listen'}
          </button>
          <button type="button" className="osce-picker-use" onClick={onPick}>
            {selected ? 'Linked' : 'Use this'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="osce-picker-preview">
          {kind === 'ecg'
            ? <img src={item.image} alt={`ECG — ${item.title}`} loading="lazy" />
            : <SoundPreview src={item.audio} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deliberately a plain <audio controls> — the admin needs to scrub and confirm
 * it's the right clip, not a styled player.
 */
function SoundPreview({ src }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Autoplay on open: you clicked Listen, so play is the intent. A browser
    // that refuses still leaves the visible controls.
    ref.current?.play?.().catch(() => {});
  }, [src]);

  if (failed) return <p className="osce-error">That clip could not be loaded.</p>;
  return (
    <audio ref={ref} src={src} controls preload="metadata"
           onError={() => setFailed(true)} style={{ width: '100%' }} />
  );
}

export default ContentPicker;
