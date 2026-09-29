import { useCallback, useEffect, useRef, useState } from 'react';
import { adminClearOsceSlot, adminOsceInbox, adminOsceInboxFile, adminOsceArchiveInboxFile,
  adminGenerateOsceSlot, adminOsceSettings, adminSaveOsceSettings,
  adminOsceImageModels } from '../../../../shared/api/osce.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { optimizeAndUploadSlot, optimizeAndUploadDataUrl, ratioWarning, isVideoFile } from './osceMedia.js';

function SlotTile({ caseId, slot, mediaUrl, onDone, onError }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  // The server tells us what the slot holds; fall back to the stored filename
  // for records saved before `kind` existed.
  const isVideoSlot = slot.media?.kind === 'video'
    || /\.(mp4|webm|mov|ogv)$/i.test(String(slot.media?.storageKey || ''));
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const upload = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setProgress(isVideoFile(file) ? 0 : null);
    try {
      await optimizeAndUploadSlot(caseId, slot.slot, file, {
        onProgress: (pct) => setProgress(pct),
      });
      onDone();
    } catch (error) {
      onError(getErrorMessage(error) || String(error?.message || 'Upload failed'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [caseId, slot.slot, onDone, onError]);

  // Generation returns the raw image rather than saving it, so it goes through
  // the same optimiser an upload does — otherwise it lands as a ~1.3 MB PNG.
  const generate = useCallback(async () => {
    setBusy(true);
    try {
      const { dataUrl } = await adminGenerateOsceSlot(caseId, slot.slot);
      if (!dataUrl) throw new Error('The image model returned no picture.');
      await optimizeAndUploadDataUrl(caseId, slot.slot, dataUrl, 'generated', { source: 'ai' });
      onDone();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [caseId, slot.slot, onDone, onError]);

  const clear = useCallback(async () => {
    setBusy(true);
    try {
      await adminClearOsceSlot(caseId, slot.slot);
      onDone();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [caseId, slot.slot, onDone, onError]);

  const warning = slot.media
    ? ratioWarning(slot, slot.media.width, slot.media.height)
    : null;

  return (
    <div
      className={`osce-slot ${slot.filled ? 'is-filled' : 'is-empty'} ${busy ? 'is-busy' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
    >
      <div className="osce-slot-frame" onClick={pick} role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter') pick(); }}>
        {slot.filled && mediaUrl
          ? (isVideoSlot
              // A clip has no still to show, so preview the clip itself. muted +
              // playsInline so it can be scrubbed in place without taking over.
              ? <video src={mediaUrl} muted playsInline controls preload="metadata" />
              : <img src={mediaUrl} alt="" />)
          : (
            <div className="osce-slot-drop">
              <strong>{slot.ratio}</strong>
              <span>{slot.width}&times;{slot.height}</span>
              <em>Drop or click — image or clip</em>
            </div>
          )}
        {busy ? (
          <div className="osce-slot-busy">
            {progress == null ? 'Working…' : `Uploading… ${progress}%`}
          </div>
        ) : null}
        {slot.media?.source === 'ai'
          ? <span className="osce-slot-ai">AI placeholder</span>
          : null}
      </div>

      <div className="osce-slot-meta">
        <b>{slot.label}</b>
        {slot.brief ? <p className="osce-slot-brief">{slot.brief}</p> : null}
        <code className="osce-slot-file">{slot.fileName}</code>
        {warning ? <p className="osce-slot-warn">{warning}</p> : null}
      </div>

      <div className="osce-slot-actions">
        <button type="button" onClick={pick} disabled={busy}>
          {slot.filled ? 'Replace' : 'Upload'}
        </button>
        {slot.slot.startsWith('ix:') ? null : (
          <button type="button" onClick={generate} disabled={busy}
                  title="Generate a placeholder with AI">
            {slot.filled ? 'Regenerate' : 'Generate'}
          </button>
        )}
        {slot.filled ? (
          <button type="button" className="osce-btn-danger" onClick={clear} disabled={busy}>Clear</button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}

/**
 * The shot list as a UI: every image the case declares, whether it's supplied,
 * and the shape it should be. Also drains the bulk-drop inbox — files pasted
 * into uploads/osce/_inbox are matched to slots by filename, then optimised
 * through exactly the same path as a panel upload.
 */
export function SlotGrid({ caseId, shotList, mediaBase, onChanged }) {
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [imageModel, setImageModel] = useState('');
  const [models, setModels] = useState([]);
  const [modelSaved, setModelSaved] = useState(false);

  const filled = shotList.filter((s) => s.filled).length;

  useEffect(() => {
    adminOsceImageModels()
      .then((d) => {
        setModels(d.models || []);
        setImageModel(d.selected || d.models?.[0]?.name || '');
      })
      .catch(() => {
        adminOsceSettings().then((s) => setImageModel(s.imageModel || '')).catch(() => {});
      });
  }, []);

  const saveModel = useCallback(async () => {
    try {
      await adminSaveOsceSettings({ imageModel });
      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [imageModel]);

  const scanInbox = useCallback(async () => {
    setScanning(true);
    setScanLog([]);
    setError(null);
    const log = [];
    try {
      const { files } = await adminOsceInbox();
      if (!files.length) log.push('Inbox is empty — drop files into uploads/osce/_inbox first.');

      for (const entry of files) {
        const known = entry.slot && shotList.some((s) => s.slot === entry.slot);
        if (!known) {
          log.push(`Skipped ${entry.fileName} — no slot named "${entry.slot || '?'}" in this case.`);
          continue;
        }
        try {
          const { dataUrl } = await adminOsceInboxFile(entry.fileName);
          await optimizeAndUploadDataUrl(caseId, entry.slot, dataUrl, entry.fileName);
          await adminOsceArchiveInboxFile(entry.fileName);
          log.push(`Filled ${entry.slot} from ${entry.fileName}.`);
        } catch (err) {
          log.push(`Failed ${entry.fileName} — ${getErrorMessage(err)}`);
        }
      }
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setScanLog(log);
      setScanning(false);
    }
  }, [caseId, shotList, onChanged]);

  const generateMissing = useCallback(async () => {
    const empty = shotList.filter((s) => !s.filled && !s.slot.startsWith('ix:'));
    if (!empty.length) return;
    setScanning(true);
    setScanLog([]);
    const log = [];
    for (const slot of empty) {
      try {
        const { dataUrl } = await adminGenerateOsceSlot(caseId, slot.slot);
        if (!dataUrl) throw new Error('no picture returned');
        const saved = await optimizeAndUploadDataUrl(
          caseId, slot.slot, dataUrl, 'generated', { source: 'ai' });
        log.push(`Generated ${slot.slot} — ${Math.round((saved.bytes || 0) / 1024)} KB.`);
      } catch (err) {
        log.push(`Failed ${slot.slot} — ${getErrorMessage(err)}`);
      }
      setScanLog([...log]);
    }
    onChanged();
    setScanning(false);
  }, [caseId, shotList, onChanged]);

  const copyShotList = () => {
    const text = shotList
      .filter((s) => !s.filled)
      .map((s) => `${s.fileName}  —  ${s.ratio} (${s.width}x${s.height})  —  ${s.label}${s.brief ? `\n    ${s.brief}` : ''}`)
      .join('\n');
    navigator.clipboard?.writeText(text || 'All slots filled.');
  };

  return (
    <div className="osce-slots">
      <div className="osce-slots-bar">
        <span className="osce-slots-count">
          <b>{filled}</b> of {shotList.length} images supplied
        </span>
        <div className="osce-slots-tools">
          <button type="button" onClick={copyShotList}>Copy shot list</button>
          <button type="button" onClick={scanInbox} disabled={scanning}>
            {scanning ? 'Working…' : 'Scan inbox folder'}
          </button>
          <button type="button" onClick={generateMissing} disabled={scanning || filled === shotList.length}>
            Generate missing with AI
          </button>
        </div>
      </div>

      <div className="osce-modelbar">
        <label htmlFor="osce-model">Image model</label>
        <select
          id="osce-model"
          className="osce-input"
          value={imageModel}
          onChange={(e) => setImageModel(e.target.value)}
        >
          {models.length
            ? models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label && m.label !== m.name ? `${m.label} — ${m.name}` : m.name}
                </option>
              ))
            : <option value="">Loading models…</option>}
        </select>
        <button type="button" onClick={saveModel}>{modelSaved ? 'Saved' : 'Save'}</button>
        <span className="osce-modelbar-note">
          Newer models follow the requested aspect ratio; older ones return square images.
          ECG, X-ray and echo can&rsquo;t be generated at all — link a real card instead.
        </span>
      </div>

      {error ? <p className="osce-error">{error}</p> : null}

      {scanLog.length ? (
        <ul className="osce-scanlog">
          {scanLog.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ) : null}

      <div className="osce-slot-grid">
        {shotList.map((slot) => (
          <SlotTile
            key={slot.slot}
            caseId={caseId}
            slot={slot}
            mediaUrl={slot.media ? `${mediaBase}/${slot.media.thumbKey || slot.media.storageKey}` : null}
            onDone={onChanged}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}

export default SlotGrid;
