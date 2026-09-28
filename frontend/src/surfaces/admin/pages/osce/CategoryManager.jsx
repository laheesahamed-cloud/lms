import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminCreateOsceCategory, adminUpdateOsceCategory, adminDeleteOsceCategory,
  adminReorderOsceCategories, adminOsceGlobalMedia,
  adminGenerateOsceGlobal,
} from '../../../../shared/api/osce.api.js';
import { optimizeAndUploadGlobal } from './osceMedia.js';
import { getErrorMessage } from '../../../../shared/api/client.js';

/**
 * OSCE categories are the admin's own — named and ordered here, not inherited
 * from the course's lesson subjects. A station can sit under "Thyroid lumps"
 * with no matching lesson subject, and the OSCE order never has to follow the
 * teaching order.
 */
export function CategoryManager({ courses, categories, onChanged }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const active = courseId ?? courses[0]?.id ?? null;
  const mine = categories.filter((c) => c.courseId === active);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [onChanged]);

  const move = (index, delta) => {
    const next = [...mine];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => adminReorderOsceCategories(next.map((c) => c.id)));
  };

  return (
    <div className="osce-catman">
      <div className="osce-catman-head">
        <b>Categories</b>
        <select className="osce-input" value={active ?? ''}
                onChange={(e) => setCourseId(Number(e.target.value))}>
          {courses.map((co) => <option key={co.id} value={co.id}>{co.title}</option>)}
        </select>
      </div>

      <p className="osce-hint">
        Your own groupings — name them whatever suits ("Lumps", "Thyroid lumps").
        The order here is the order students see.
      </p>

      <div className="osce-catman-add">
        <input
          className="osce-input osce-input--grow"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              run(() => adminCreateOsceCategory({ courseId: active, name: name.trim() }))
                .then(() => setName(''));
            }
          }}
        />
        <button type="button" disabled={busy || !name.trim()} onClick={() => {
          run(() => adminCreateOsceCategory({ courseId: active, name: name.trim() }))
            .then(() => setName(''));
        }}>Add</button>
      </div>

      {error ? <p className="osce-error">{error}</p> : null}

      <div className="osce-catman-list">
        {!mine.length ? (
          <p className="osce-hint osce-hint--muted">
            No categories in this course yet — add one above before creating a station.
          </p>
        ) : null}
        {mine.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            first={i === 0}
            last={i === mine.length - 1}
            busy={busy}
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onRename={(next) => run(() => adminUpdateOsceCategory(cat.id, { name: next }))}
            onDelete={() => {
              if (!window.confirm(`Delete the category "${cat.name}"?`)) return;
              run(() => adminDeleteOsceCategory(cat.id));
            }}
          />
        ))}
      </div>

      <GlobalArt />
    </div>
  );
}

function CategoryRow({ category, first, last, busy, onUp, onDown, onRename, onDelete }) {
  const [value, setValue] = useState(category.name);
  useEffect(() => { setValue(category.name); }, [category.name]);

  return (
    <div className="osce-catrow">
      <div className="osce-catrow-move">
        <button type="button" disabled={first || busy} onClick={onUp} title="Move up">↑</button>
        <button type="button" disabled={last || busy} onClick={onDown} title="Move down">↓</button>
      </div>
      <input
        className="osce-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value.trim() && value !== category.name) onRename(value.trim()); }}
      />
      <span className="osce-catrow-count">
        {category.caseCount} station{category.caseCount === 1 ? '' : 's'}
      </span>
      <button type="button" className="osce-btn-danger" disabled={busy} onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

/**
 * Long cases don't carry their own pictures — every one uses the same doctor
 * and patient, because in a history station the conversation is the content
 * and the faces are just staging.
 */
function GlobalArt() {
  const [cast, setCast] = useState({ doctor: null, patient: null });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    adminOsceGlobalMedia()
      .then((d) => setCast(d.cast || { doctor: null, patient: null }))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="osce-globalart">
      <b>Shared long-case pictures</b>
      <p className="osce-hint">
        Used by every long case — upload once, or generate a stand-in.
      </p>
      {error ? <p className="osce-error">{error}</p> : null}
      <div className="osce-globalart-row">
        {['doctor', 'patient'].map((slot) => (
          <CastSlot
            key={slot}
            slot={slot}
            image={cast[slot]}
            busy={busy === slot}
            onBusy={setBusy}
            onError={setError}
            onDone={load}
          />
        ))}
      </div>
    </div>
  );
}

function CastSlot({ slot, image, busy, onBusy, onError, onDone }) {
  const inputRef = useRef(null);

  const wrap = async (fn) => {
    onBusy(slot);
    onError(null);
    try { await fn(); onDone(); }
    catch (err) { onError(getErrorMessage(err)); }
    finally { onBusy(''); }
  };

  return (
    <div className="osce-castslot">
      <div className="osce-castslot-frame" onClick={() => inputRef.current?.click()}>
        {image?.thumb
          ? <img src={image.thumb} alt="" />
          : <span>No {slot} picture</span>}
        {busy ? <div className="osce-slot-busy">Working…</div> : null}
      </div>
      <b>{slot[0].toUpperCase() + slot.slice(1)}</b>
      <div className="osce-castslot-actions">
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {image ? 'Replace' : 'Upload'}
        </button>
        <button type="button" disabled={busy}
                onClick={() => wrap(async () => {
                  const { dataUrl } = await adminGenerateOsceGlobal(slot);
                  if (!dataUrl) throw new Error('The image model returned no picture.');
                  await optimizeAndUploadGlobal(slot, dataUrl);
                })}>
          Generate
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) wrap(() => optimizeAndUploadGlobal(slot, file));
        }}
      />
    </div>
  );
}

export default CategoryManager;
