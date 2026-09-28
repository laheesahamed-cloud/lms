import { useEffect, useMemo, useState } from 'react';
import { adminListOsceCases } from '../../../../shared/api/osce.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';

/**
 * Links from this station to the others it connects to.
 *
 * The generator writes plausible slugs for cases that may never exist
 * ("rheumatic-fever"), so most authored links start out dead. The student app
 * silently drops those — which means without this screen you'd never find out.
 * Here the target is picked from the real case list, and anything that doesn't
 * resolve is called out so you can repoint it or delete it.
 */

const REL_TYPES = [
  ['cause', 'Cause — what led to this'],
  ['complication', 'Complication — what this leads to'],
  ['differential', 'Differential — what it could be instead'],
];

export function RelatedEditor({ doc, patchDoc, selfSlug }) {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminListOsceCases()
      .then((d) => setCases(d.cases || []))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const related = Array.isArray(doc.related) ? doc.related : [];

  // Anything not in the real case list is a dead link. Self-links too: the app
  // skips them, so leaving one here is just noise.
  const bySlug = useMemo(
    () => new Map((cases || []).map((c) => [c.slug, c])),
    [cases]
  );

  const setRelated = (next) => patchDoc({ related: next });
  const patch = (i, changes) =>
    setRelated(related.map((r, j) => (j === i ? { ...r, ...changes } : r)));

  const move = (i, delta) => {
    const target = i + delta;
    if (target < 0 || target >= related.length) return;
    const next = [...related];
    [next[i], next[target]] = [next[target], next[i]];
    setRelated(next);
  };

  const dead = related.filter(
    (r) => cases && (!bySlug.has(r.case) || r.case === selfSlug)
  ).length;

  return (
    <div className="osce-related">
      <div className="osce-card-head">
        <b className="osce-long-h">Related stations</b>
        <span className="osce-hint">
          {related.length} link{related.length === 1 ? '' : 's'}
          {dead ? ` · ${dead} won't open` : ''}
        </span>
      </div>

      <p className="osce-hint">
        From pulmonary oedema, a student should be able to tap the cause and land
        on mitral stenosis. Only links pointing at a <b>published</b> station reach
        students — the rest are hidden, not shown as errors.
      </p>

      {error ? <p className="osce-error">{error}</p> : null}
      {!cases && !error ? <p className="osce-hint">Loading stations…</p> : null}

      {dead ? (
        <p className="osce-warn">
          {dead} link{dead === 1 ? '' : 's'} point at a station that doesn&rsquo;t exist
          (the AI suggested a name rather than choosing a real case). Repoint or remove
          them — students currently see nothing for these.
        </p>
      ) : null}

      {related.map((rel, i) => {
        const target = bySlug.get(rel.case);
        const isSelf = rel.case === selfSlug;
        const broken = cases && (!target || isSelf);

        return (
          <div key={i} className={`osce-relrow ${broken ? 'is-broken' : ''}`}>
            <div className="osce-catrow-move">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" disabled={i === related.length - 1}
                      onClick={() => move(i, 1)}>↓</button>
            </div>

            <div className="osce-relrow-body">
              <label>
                <span>Relationship</span>
                <select className="osce-input" value={rel.rel || 'differential'}
                        onChange={(e) => patch(i, { rel: e.target.value })}>
                  {REL_TYPES.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Station</span>
                <select className="osce-input" value={target ? rel.case : ''}
                        onChange={(e) => patch(i, { case: e.target.value })}>
                  <option value="">
                    {rel.case
                      ? `— ${rel.case} (not a real station) —`
                      : '— pick a station —'}
                  </option>
                  {(cases || [])
                    .filter((c) => c.slug !== selfSlug)
                    .map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.title}{c.status === 'published' ? '' : ' (draft)'}
                      </option>
                    ))}
                </select>
              </label>

              <label className="osce-long-wide">
                <span>Note — why they connect (optional)</span>
                <input className="osce-input" value={rel.note || ''}
                       placeholder="Cardiac cause"
                       onChange={(e) => patch(i, { note: e.target.value })} />
              </label>

              {target && target.status !== 'published' ? (
                <p className="osce-hint osce-hint--muted">
                  “{target.title}” is still a draft, so this link stays hidden from
                  students until you publish it.
                </p>
              ) : null}
            </div>

            <button type="button" className="osce-btn-danger"
                    onClick={() => setRelated(related.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        );
      })}

      <button type="button" className="osce-add" onClick={() =>
        setRelated([...related, { rel: 'differential', case: '', note: '' }])}>
        + Link a station
      </button>

      {dead ? (
        <button type="button" className="osce-btn-danger osce-related-prune"
                onClick={() => setRelated(
                  related.filter((r) => bySlug.has(r.case) && r.case !== selfSlug))}>
          Remove all {dead} broken link{dead === 1 ? '' : 's'}
        </button>
      ) : null}
    </div>
  );
}

export default RelatedEditor;
