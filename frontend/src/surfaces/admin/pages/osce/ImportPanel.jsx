import { useMemo, useRef, useState } from 'react';
import {
  adminPreviewOsceImport, adminCommitOsceImport, adminExportOsceCases,
} from '../../../../shared/api/osce.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';

const ACTION_LABEL = { create: 'New draft', update: 'Update draft', skip: 'Skipped', error: 'Blocked' };

/**
 * Bulk JSON import. Everything lands as a draft; images are added afterwards in
 * each case's Images tab. A case that is already published is skipped.
 */
export function ImportPanel({ categories, onDone }) {
  const fileRef = useRef(null);
  const [pkg, setPkg] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const reset = () => {
    setPkg(null); setFileName(''); setPreview(null); setMapping({}); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const choose = async (file) => {
    if (!file) return;
    reset();
    setBusy('preview');
    try {
      const parsed = JSON.parse(await file.text());
      const data = await adminPreviewOsceImport(parsed);
      // Pre-pick a category when the file's topic name matches one exactly.
      const guess = {};
      for (const ref of data.refs || []) {
        const want = String(ref.topicRef || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
        const hit = categories.find((c) => c.name.trim().toLowerCase() === want);
        if (hit) guess[ref.key] = hit.id;
      }
      setPkg(parsed); setFileName(file.name); setPreview(data); setMapping(guess);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'That file is not valid JSON.' : getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const importable = useMemo(
    () => (preview?.rows || []).filter((r) => r.action === 'create' || r.action === 'update'),
    [preview],
  );
  const needsMapping = (preview?.refs || []).filter((r) => !mapping[r.key]);
  const canImport = importable.length > 0 && !needsMapping.length && !busy;

  const commit = async () => {
    setBusy('commit'); setError(null);
    try {
      setResult(await adminCommitOsceImport(pkg, mapping));
      onDone?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('export'); setError(null);
    try {
      const data = await adminExportOsceCases();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `osce-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="osce-newcase osce-import">
      <b>Import / export JSON</b>
      <p className="osce-hint">
        Upload a file of stations to create many at once. They arrive as drafts; add the pictures
        from each station's Images tab, then publish. Published stations are never overwritten.
      </p>

      <div className="osce-newcase-row">
        <input ref={fileRef} type="file" accept=".json,application/json"
               onChange={(e) => choose(e.target.files?.[0])} disabled={!!busy} />
        <button type="button" onClick={download} disabled={!!busy}>
          {busy === 'export' ? 'Preparing…' : 'Export all as JSON'}
        </button>
        {preview || result ? <button type="button" onClick={reset} disabled={!!busy}>Clear</button> : null}
      </div>

      {busy === 'preview' ? <p className="osce-hint">Checking the file…</p> : null}
      {error ? <p className="osce-error">{error}</p> : null}

      {preview && !result ? (
        <>
          <p className="osce-hint">
            <b>{fileName}</b> — {preview.totals.cases} stations:
            {' '}{preview.totals.create} new, {preview.totals.update} drafts to update,
            {' '}{preview.totals.skip} skipped, {preview.totals.error} blocked.
          </p>

          {(preview.refs || []).length ? (
            <div className="osce-import-map">
              <b>File the new stations under</b>
              {preview.refs.map((ref) => (
                <div key={ref.key} className="osce-newcase-row">
                  <span className="osce-hint">
                    {ref.courseRef || '—'} / {ref.topicRef || '—'} ({ref.cases})
                  </span>
                  <select className="osce-input" value={mapping[ref.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [ref.key]: Number(e.target.value) || undefined })}>
                    <option value="">Choose a category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.courseTitle} · {c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}

          <div className="osce-import-rows">
            {preview.rows.map((r) => (
              <div key={r.index} className="osce-import-row">
                <div className="osce-newcase-row">
                  <b>{r.title || r.slug || `Case ${r.index + 1}`}</b>
                  <span className={`osce-badge ${r.action === 'create' || r.action === 'update' ? 'is-live' : ''}`}>
                    {ACTION_LABEL[r.action]}
                  </span>
                  <span className="osce-hint">{r.stationType} · {r.slots} image slots · {r.slug}</span>
                </div>
                {r.errors.map((m, i) => <p key={`e${i}`} className="osce-error">{m}</p>)}
                {r.warnings.map((m, i) => <p key={`w${i}`} className="osce-hint">{m}</p>)}
              </div>
            ))}
          </div>

          <div className="osce-newcase-row">
            <button type="button" className="osce-btn-primary" onClick={commit} disabled={!canImport}>
              {busy === 'commit' ? 'Importing…' : `Import ${importable.length} as drafts`}
            </button>
            {needsMapping.length ? <span className="osce-hint">Choose a category for each group above first.</span> : null}
          </div>
        </>
      ) : null}

      {result ? (
        <div className="osce-import-rows">
          <p className="osce-hint">
            Done — {result.totals.created} created, {result.totals.updated} updated,
            {' '}{result.totals.skipped} skipped, {result.totals.failed} failed.
          </p>
          {result.results.map((r, i) => (
            <div key={i} className="osce-import-row">
              <b>{r.title || r.slug}</b> <span className="osce-badge">{r.status}</span>
              {r.message ? <p className={r.status === 'failed' ? 'osce-error' : 'osce-hint'}>{r.message}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
