import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListOsceSystems, adminListOsceCases, adminGetOsceCase, adminCreateOsceCase,
  adminGenerateOsceCase, adminUpdateOsceCase, adminDeleteOsceCase,
  adminPublishOsceCase, adminUnpublishOsceCase, adminReorderOsceCases,
} from '../../../../shared/api/osce.api.js';
import { API_BASE_URL, getErrorMessage } from '../../../../shared/api/client.js';
import { SlotGrid } from './SlotGrid.jsx';
import { SceneHotspotEditor } from './SceneHotspotEditor.jsx';
import { CasePreview } from './CasePreview.jsx';
import { ContentPicker } from './ContentPicker.jsx';
import { RelatedEditor } from './RelatedEditor.jsx';
import { SummaryEditor } from './SummaryEditor.jsx';
import { CategoryManager } from './CategoryManager.jsx';
import { LongCaseEditor } from './LongCaseEditor.jsx';
import './AdminOscePage.css';

const MEDIA_BASE = `${String(API_BASE_URL).replace(/\/+$/, '')}/osce/media`;

const SHORT_TABS = [
  ['preview', 'Preview'],
  ['images', 'Images'],
  ['scenes', 'Scenes'],
  ['signs', 'Findings'],
  ['chain', 'Pathophysiology'],
  ['ix', 'Investigations'],
  ['sounds', 'Sounds'],
  ['practice', 'Practice'],
  ['summary', 'Summary'],
  ['links', 'Links'],
];

// A long case is a conversation: no scenes, no findings, no per-case pictures
// beyond the cover. Showing the short-case tabs here only misleads.
const LONG_TABS = [
  ['preview', 'Preview'],
  ['history', 'History'],
  ['images', 'Cover'],
  ['practice', 'Practice'],
  ['links', 'Links'],
];

/* ───────────────────────── new case ───────────────────────── */

function NewCasePanel({ systems, courses, onCreated }) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [stationType, setStationType] = useState('short');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  // Categories are OSCE's own, grouped under a course.
  const activeCourse = courseId ?? courses[0]?.id ?? null;
  const subjects = useMemo(
    () => systems.filter((s) => s.courseId === activeCourse),
    [systems, activeCourse]
  );
  const activeTopic = subjects.some((s) => s.id === topicId) ? topicId : subjects[0]?.id ?? null;

  const run = async (mode) => {
    if (!title.trim()) { setError('Give the station a condition name first.'); return; }
    if (!activeTopic) { setError('Add a category to this course first, below.'); return; }
    setBusy(mode);
    setError(null);
    try {
      const result = mode === 'generate'
        ? await adminGenerateOsceCase({
            title: title.trim(), categoryId: activeTopic, stationType,
            notes: notes.trim() || undefined,
          })
        : await adminCreateOsceCase({
            title: title.trim(), categoryId: activeTopic, stationType,
          });
      setTitle('');
      setNotes('');
      onCreated(result.case || result, result.warnings || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="osce-newcase">
      <div className="osce-newcase-row">
        <input
          className="osce-input osce-input--grow"
          placeholder="Condition, e.g. Mitral Stenosis"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run('generate'); }}
        />
        <select className="osce-input" value={activeCourse ?? ''}
                onChange={(e) => { setCourseId(Number(e.target.value)); setTopicId(null); }}>
          {courses.map((co) => <option key={co.id} value={co.id}>{co.title}</option>)}
        </select>
        <select className="osce-input" value={activeTopic ?? ''}
                onChange={(e) => setTopicId(Number(e.target.value))}>
          {subjects.length
            ? subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
            : <option value="">No categories yet</option>}
        </select>
        <div className="osce-typetoggle">
          {[['short', 'Short case'], ['long', 'Long case']].map(([key, label]) => (
            <button key={key} type="button"
                    className={stationType === key ? 'is-on' : ''}
                    onClick={() => setStationType(key)}>{label}</button>
          ))}
        </div>
        <button type="button" className="osce-btn-primary" disabled={!!busy} onClick={() => run('generate')}>
          {busy === 'generate' ? 'Writing the case…' : 'Generate with AI'}
        </button>
        <button type="button" disabled={!!busy} onClick={() => run('blank')}>
          Start empty
        </button>
      </div>
      <input
        className="osce-input osce-input--full"
        placeholder="Optional: anything the AI should emphasise (exam board, depth, local guidelines)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <p className="osce-hint osce-hint--muted">
        {stationType === 'long'
          ? 'A long case is history-led: the student works the exam sequence and the patient answers. It uses the shared doctor and patient pictures, so no per-case images are needed.'
          : 'A short case is examination-led: findings placed on the patient, then investigations and the checklist.'}
      </p>
      {busy === 'generate' ? (
        <p className="osce-hint">
          {stationType === 'long'
            ? 'Writing the full history — seven sections of questions and answers. Around 30 seconds.'
            : 'Writing findings, pathophysiology, investigations, checklist and viva questions — about 15–30 seconds.'}
        </p>
      ) : null}
      {error ? <p className="osce-error">{error}</p> : null}
    </div>
  );
}

/* ─────────────────────── list editors ─────────────────────── */

function TextRow({ value, onChange, onRemove, placeholder }) {
  return (
    <div className="osce-textrow">
      <input className="osce-input" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="osce-btn-danger" onClick={onRemove}>×</button>
    </div>
  );
}

function SignEditor({ sign, onChange, onRemove }) {
  return (
    <div className="osce-card">
      <div className="osce-card-head">
        <input className="osce-input osce-input--title" value={sign.name}
               onChange={(e) => onChange({ ...sign, name: e.target.value })} />
        <select className="osce-input" value={sign.category}
                onChange={(e) => onChange({ ...sign, category: e.target.value })}>
          {['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="button" className="osce-btn-danger" onClick={onRemove}>Remove</button>
      </div>
      <input className="osce-input osce-input--full" placeholder="One-line finding"
             value={sign.short || ''} onChange={(e) => onChange({ ...sign, short: e.target.value })} />
      <textarea className="osce-input osce-input--full" rows={3} placeholder="Why it happens in this condition"
                value={sign.body || ''} onChange={(e) => onChange({ ...sign, body: e.target.value })} />
      <textarea className="osce-input osce-input--full osce-input--brief" rows={2}
                placeholder="Image brief — what the picture must show"
                value={sign.brief || ''} onChange={(e) => onChange({ ...sign, brief: e.target.value })} />
      <code className="osce-slot-file">slot: {sign.media}</code>
    </div>
  );
}

/* ──────────────────────── the editor ──────────────────────── */

function CaseEditor({ caseId, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [shotList, setShotList] = useState([]);
  const [tab, setTab] = useState('preview');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sceneId, setSceneId] = useState(null);
  const [picker, setPicker] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await adminGetOsceCase(caseId);
      setData(res.case);
      setShotList(res.shotList || []);
      if (!sceneId && res.case?.caseData?.scenes?.length) {
        setSceneId(res.case.caseData.scenes[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [caseId, sceneId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const allowed = (data.stationType === 'long' ? LONG_TABS : SHORT_TABS).map(([k]) => k);
    if (!allowed.includes(tab)) setTab(allowed[0]);
  }, [data, tab]);

  const doc = data?.caseData;

  const patchDoc = useCallback((changes) => {
    setData((prev) => ({ ...prev, caseData: { ...prev.caseData, ...changes } }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await adminUpdateOsceCase(caseId, {
        title: data.title,
        summary: data.summary,
        isFree: !!data.isFree,
        caseData: data.caseData,
      });
      setDirty(false);
      await load();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [caseId, data, load, onChanged]);

  const publish = async () => {
    setError(null);
    try {
      if (data.status === 'published') await adminUnpublishOsceCase(caseId);
      else await adminPublishOsceCase(caseId);
      await load();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const isLong = data?.stationType === 'long';
  const tabs = isLong ? LONG_TABS : SHORT_TABS;

  const activeScene = useMemo(
    () => doc?.scenes?.find((s) => s.id === sceneId) || doc?.scenes?.[0] || null,
    [doc, sceneId]
  );

  const sceneImageUrl = useMemo(() => {
    if (!activeScene?.media) return null;
    const hit = shotList.find((s) => s.slot === activeScene.media);
    return hit?.media ? `${MEDIA_BASE}/${hit.media.storageKey}` : null;
  }, [activeScene, shotList]);

  if (!data) {
    return <div className="osce-wrap"><p className="osce-hint">{error || 'Loading…'}</p></div>;
  }

  const missing = shotList.filter((s) => !s.filled).length;

  return (
    <div className="osce-wrap">
      <div className="osce-editor-head">
        <button type="button" onClick={onBack}>‹ All stations</button>
        <input
          className="osce-input osce-input--title"
          value={data.title}
          onChange={(e) => { setData({ ...data, title: e.target.value }); setDirty(true); }}
        />
        <span className={`osce-badge ${data.status === 'published' ? 'is-live' : ''}`}>
          {data.status}
        </span>
        <span className={`osce-badge ${isLong ? 'is-long' : ''}`}>
          {isLong ? 'long case' : 'short case'}
        </span>
        <button
          type="button"
          className={`osce-freetoggle ${data.isFree ? 'is-free' : ''}`}
          title={data.isFree
            ? 'Open to everyone, regardless of subscription'
            : 'Only students whose subscription covers this course'}
          onClick={() => { setData({ ...data, isFree: !data.isFree }); setDirty(true); }}
        >
          {data.isFree ? '🔓 Free' : '🔒 Subscribers'}
        </button>
        <div className="osce-editor-actions">
          <button type="button" className="osce-btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
          <button type="button" onClick={publish} disabled={missing > 0 && data.status !== 'published'}>
            {data.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {missing > 0 ? (
        <p className="osce-gate">
          {missing} image{missing === 1 ? '' : 's'} still missing — publishing stays locked until every
          slot is filled.
        </p>
      ) : null}
      {error ? <p className="osce-error">{error}</p> : null}

      <div className="osce-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button"
                  className={tab === key ? 'is-active' : ''}
                  onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'preview' ? (
        <CasePreview caseId={caseId} reloadKey={dirty ? 'dirty' : data.updatedAt} />
      ) : null}

      {tab === 'history' ? (
        <LongCaseEditor doc={doc} patchDoc={patchDoc} />
      ) : null}

      {tab === 'images' ? (
        <SlotGrid caseId={caseId} shotList={shotList} mediaBase={MEDIA_BASE} onChanged={load} />
      ) : null}

      {tab === 'scenes' ? (
        <div className="osce-scenes">
          <div className="osce-scene-picker">
            {(doc.scenes || []).map((s) => (
              <button key={s.id} type="button"
                      className={activeScene?.id === s.id ? 'is-active' : ''}
                      onClick={() => setSceneId(s.id)}>
                {s.title || s.id}
                <em>{(s.hotspots || []).length}</em>
              </button>
            ))}
            <button type="button" className="osce-add" onClick={() => {
              const id = `scene-${Date.now().toString(36)}`;
              patchDoc({ scenes: [...(doc.scenes || []), { id, title: 'New scene', parent: activeScene?.id || null, media: `scene:${id}`, hotspots: [] }] });
              setSceneId(id);
            }}>+ Scene</button>
          </div>

          {activeScene ? (
            <>
              <div className="osce-scene-meta">
                <label>
                  <span>Title</span>
                  <input className="osce-input" value={activeScene.title || ''}
                         onChange={(e) => patchDoc({
                           scenes: doc.scenes.map((s) => s.id === activeScene.id ? { ...s, title: e.target.value } : s),
                         })} />
                </label>
                <label>
                  <span>Zooms out to</span>
                  <select className="osce-input" value={activeScene.parent || ''}
                          onChange={(e) => patchDoc({
                            scenes: doc.scenes.map((s) => s.id === activeScene.id ? { ...s, parent: e.target.value || null } : s),
                          })}>
                    <option value="">Nothing — this is the first scene</option>
                    {doc.scenes.filter((s) => s.id !== activeScene.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.title || s.id}</option>
                    ))}
                  </select>
                </label>
              </div>

              <SceneHotspotEditor
                scene={activeScene}
                imageUrl={sceneImageUrl}
                signs={doc.signs || []}
                scenes={doc.scenes || []}
                onChange={(next) => patchDoc({
                  scenes: doc.scenes.map((s) => (s.id === next.id ? next : s)),
                })}
              />
            </>
          ) : <p className="osce-hint">No scenes yet — add one to start the journey.</p>}
        </div>
      ) : null}

      {tab === 'signs' ? (
        <div className="osce-list">
          {(doc.signs || []).map((sign, i) => (
            <SignEditor
              key={sign.id}
              sign={sign}
              onChange={(next) => patchDoc({ signs: doc.signs.map((s, j) => (j === i ? next : s)) })}
              onRemove={() => patchDoc({ signs: doc.signs.filter((_, j) => j !== i) })}
            />
          ))}
          <button type="button" className="osce-add" onClick={() => {
            const id = `sign-${Date.now().toString(36)}`;
            patchDoc({ signs: [...(doc.signs || []), { id, name: 'New finding', category: 'inspection', media: `sign:${id}`, short: '', body: '', brief: '' }] });
          }}>+ Finding</button>
        </div>
      ) : null}

      {tab === 'chain' ? (
        <div className="osce-list">
          {(doc.chain || []).map((step, i) => (
            <div key={i} className="osce-card">
              <div className="osce-card-head">
                <span className="osce-step">{step.step}</span>
                <input className="osce-input osce-input--title" value={step.title}
                       onChange={(e) => patchDoc({ chain: doc.chain.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)) })} />
                <button type="button" className="osce-btn-danger"
                        onClick={() => patchDoc({ chain: doc.chain.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <textarea className="osce-input osce-input--full" rows={2} value={step.body || ''}
                        onChange={(e) => patchDoc({ chain: doc.chain.map((c, j) => (j === i ? { ...c, body: e.target.value } : c)) })} />
            </div>
          ))}
          <button type="button" className="osce-add" onClick={() => {
            const step = (doc.chain?.length || 0) + 1;
            patchDoc({ chain: [...(doc.chain || []), { step, title: `Step ${step}`, body: '', media: `chain:${step}` }] });
          }}>+ Step</button>
        </div>
      ) : null}

      {tab === 'ix' ? (
        <div className="osce-list">
          {(doc.investigations || []).map((ix, i) => (
            <div key={i} className="osce-card">
              <div className="osce-card-head">
                <select className="osce-input" value={ix.modality}
                        onChange={(e) => patchDoc({ investigations: doc.investigations.map((x, j) => (j === i ? { ...x, modality: e.target.value, media: `ix:${e.target.value}` } : x)) })}>
                  {['ecg', 'cxr', 'echo', 'labs', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
                <button type="button" className="osce-linkbtn"
                        onClick={() => setPicker({ kind: 'ecg', index: i })}>
                  {ix.ref?.id
                    ? `Linked: ${ix.refTitle || `ECG card #${ix.ref.id}`}`
                    : 'Link an existing ECG card'}
                </button>
                <button type="button" className="osce-btn-danger"
                        onClick={() => patchDoc({ investigations: doc.investigations.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              {(ix.findings || []).map((f, k) => (
                <TextRow key={k} value={f} placeholder="Finding"
                         onChange={(v) => patchDoc({ investigations: doc.investigations.map((x, j) => (j === i ? { ...x, findings: x.findings.map((y, z) => (z === k ? v : y)) } : x)) })}
                         onRemove={() => patchDoc({ investigations: doc.investigations.map((x, j) => (j === i ? { ...x, findings: x.findings.filter((_, z) => z !== k) } : x)) })} />
              ))}
              <button type="button" className="osce-add osce-add--sm"
                      onClick={() => patchDoc({ investigations: doc.investigations.map((x, j) => (j === i ? { ...x, findings: [...(x.findings || []), ''] } : x)) })}>+ Finding</button>
            </div>
          ))}
          <button type="button" className="osce-add" onClick={() => patchDoc({
            investigations: [...(doc.investigations || []), { modality: 'ecg', ref: null, media: 'ix:ecg', findings: [] }],
          })}>+ Investigation</button>
        </div>
      ) : null}

      {tab === 'sounds' ? (
        <div className="osce-list">
          <p className="osce-hint">
            A sound step plays nothing until a clip is attached. Link one of your
            existing auscultation recordings, then mark what happens when.
          </p>
          {(doc.sounds || []).map((snd, i) => (
            <div key={i} className="osce-card">
              <div className="osce-card-head">
                <input className="osce-input osce-input--title" value={snd.title || ''}
                       placeholder="e.g. Mitral stenosis at the apex"
                       onChange={(e) => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <button type="button" className="osce-btn-danger"
                        onClick={() => patchDoc({ sounds: doc.sounds.filter((_, j) => j !== i) })}>Remove</button>
              </div>

              <div className="osce-linkrow">
                <button type="button"
                        className={`osce-linkbtn ${snd.ref?.id ? 'is-linked' : 'is-missing'}`}
                        onClick={() => setPicker({ kind: 'sound', index: i, field: 'ref' })}>
                  {snd.ref?.id
                    ? `Recording: ${snd.refTitle || `card #${snd.ref.id}`}`
                    : 'No recording attached — link one'}
                </button>
                <button type="button" className="osce-linkbtn"
                        onClick={() => setPicker({ kind: 'sound', index: i, field: 'compareWith' })}>
                  {snd.compareWith?.id
                    ? `Compare with: ${snd.compareTitle || `card #${snd.compareWith.id}`}`
                    : 'Add a normal comparison'}
                </button>
              </div>

              <p className="osce-hint osce-hint--muted">
                Timing markers, in milliseconds within ONE cardiac cycle. These
                highlight as the clip plays, so a student can see when to listen.
              </p>
              {(snd.markers || []).map((mk, k) => (
                <div key={k} className="osce-markerrow">
                  <input className="osce-input" placeholder="S1"
                         value={mk.label || ''}
                         onChange={(e) => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, markers: x.markers.map((y, z) => (z === k ? { ...y, label: e.target.value } : y)) } : x)) })} />
                  <input className="osce-input osce-input--sm" type="number" placeholder="from"
                         value={mk.from ?? ''}
                         onChange={(e) => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, markers: x.markers.map((y, z) => (z === k ? { ...y, from: Number(e.target.value) } : y)) } : x)) })} />
                  <input className="osce-input osce-input--sm" type="number" placeholder="to"
                         value={mk.to ?? ''}
                         onChange={(e) => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, markers: x.markers.map((y, z) => (z === k ? { ...y, to: Number(e.target.value) } : y)) } : x)) })} />
                  <span className="osce-unit">ms</span>
                  <button type="button" className="osce-btn-danger"
                          onClick={() => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, markers: x.markers.filter((_, z) => z !== k) } : x)) })}>×</button>
                </div>
              ))}
              <button type="button" className="osce-add osce-add--sm"
                      onClick={() => patchDoc({ sounds: doc.sounds.map((x, j) => (j === i ? { ...x, markers: [...(x.markers || []), { label: '', from: 0, to: 0 }] } : x)) })}>+ Marker</button>
            </div>
          ))}
          <button type="button" className="osce-add" onClick={() => patchDoc({
            sounds: [...(doc.sounds || []), { title: '', ref: null, compareWith: null, markers: [] }],
          })}>+ Sound</button>
        </div>
      ) : null}

      {picker ? (
        <ContentPicker
          kind={picker.kind}
          value={picker.kind === 'ecg'
            ? doc.investigations?.[picker.index]?.ref?.id
            : doc.sounds?.[picker.index]?.[picker.field]?.id}
          onClose={() => setPicker(null)}
          onChange={(item) => {
            if (picker.kind === 'ecg') {
              patchDoc({
                investigations: doc.investigations.map((x, j) => (j === picker.index
                  ? { ...x, ref: item ? { type: 'ecg_card', id: item.id } : null, refTitle: item?.title || '' }
                  : x)),
              });
            } else {
              const titleKey = picker.field === 'ref' ? 'refTitle' : 'compareTitle';
              patchDoc({
                sounds: doc.sounds.map((x, j) => (j === picker.index
                  ? {
                      ...x,
                      [picker.field]: item ? { type: 'auscultation_card', id: item.id } : null,
                      [titleKey]: item?.title || '',
                    }
                  : x)),
              });
            }
          }}
        />
      ) : null}

      {tab === 'practice' ? (
        <div className="osce-list">
          {(doc.practice?.checklist || []).map((section, i) => (
            <div key={i} className="osce-card">
              <div className="osce-card-head">
                <input className="osce-input osce-input--title" value={section.section}
                       onChange={(e) => {
                         const next = doc.practice.checklist.map((c, j) => (j === i ? { ...c, section: e.target.value } : c));
                         patchDoc({ practice: { ...doc.practice, checklist: next } });
                       }} />
                <button type="button" className="osce-btn-danger" onClick={() => patchDoc({
                  practice: { ...doc.practice, checklist: doc.practice.checklist.filter((_, j) => j !== i) },
                })}>Remove</button>
              </div>
              {(section.items || []).map((item, k) => (
                <TextRow key={k} value={item} placeholder="Checklist item"
                         onChange={(v) => {
                           const next = doc.practice.checklist.map((c, j) => (j === i ? { ...c, items: c.items.map((y, z) => (z === k ? v : y)) } : c));
                           patchDoc({ practice: { ...doc.practice, checklist: next } });
                         }}
                         onRemove={() => {
                           const next = doc.practice.checklist.map((c, j) => (j === i ? { ...c, items: c.items.filter((_, z) => z !== k) } : c));
                           patchDoc({ practice: { ...doc.practice, checklist: next } });
                         }} />
              ))}
              <button type="button" className="osce-add osce-add--sm" onClick={() => {
                const next = doc.practice.checklist.map((c, j) => (j === i ? { ...c, items: [...(c.items || []), ''] } : c));
                patchDoc({ practice: { ...doc.practice, checklist: next } });
              }}>+ Item</button>
            </div>
          ))}

          <h4 className="osce-subhead">Viva questions</h4>
          {(doc.practice?.questions || []).map((q, i) => (
            <div key={i} className="osce-card">
              <div className="osce-card-head">
                <input className="osce-input osce-input--title" value={q.q} placeholder="Question"
                       onChange={(e) => {
                         const next = doc.practice.questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x));
                         patchDoc({ practice: { ...doc.practice, questions: next } });
                       }} />
                <button type="button" className="osce-btn-danger" onClick={() => patchDoc({
                  practice: { ...doc.practice, questions: doc.practice.questions.filter((_, j) => j !== i) },
                })}>Remove</button>
              </div>
              <textarea className="osce-input osce-input--full" rows={2} value={q.a} placeholder="Model answer"
                        onChange={(e) => {
                          const next = doc.practice.questions.map((x, j) => (j === i ? { ...x, a: e.target.value } : x));
                          patchDoc({ practice: { ...doc.practice, questions: next } });
                        }} />
            </div>
          ))}
          <button type="button" className="osce-add" onClick={() => patchDoc({
            practice: { ...doc.practice, questions: [...(doc.practice?.questions || []), { q: '', a: '' }] },
          })}>+ Question</button>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── the page ───────────────────────── */

export function AdminOscePage() {
  const [systems, setSystems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [cases, setCases] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sys, list] = await Promise.all([adminListOsceSystems(), adminListOsceCases()]);
      setSystems(sys.systems || []);
      setCourses(sys.courses || []);
      setCases(list.cases || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stations grouped by the category they're filed under, each group in its
  // own saved order. Ungrouped ones get their own bucket rather than vanishing.
  const caseGroups = useMemo(() => {
    const groups = new Map();
    for (const c of cases) {
      const key = c.systemKey || 'none';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: [c.courseTitle, c.systemName].filter(Boolean).join(' · ') || 'No category',
          items: [],
        });
      }
      groups.get(key).items.push(c);
    }
    for (const g of groups.values()) {
      g.items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [cases]);

  const moveCase = useCallback(async (group, index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= group.items.length) return;
    const next = [...group.items];
    [next[index], next[target]] = [next[target], next[index]];
    const ids = next.map((c) => c.id);

    // Optimistic, so the arrow feels immediate; the reload below is the truth.
    setCases((prev) => {
      const rank = new Map(ids.map((id, i) => [id, (i + 1)]));
      return prev.map((c) => (rank.has(c.id) ? { ...c, sortOrder: rank.get(c.id) } : c));
    });

    setOrdering(true);
    try {
      await adminReorderOsceCases(ids);
    } catch (err) {
      setError(getErrorMessage(err));
      load();
    } finally {
      setOrdering(false);
    }
  }, [load]);

  const remove = async (id, title) => {
    if (!window.confirm(`Delete "${title}" and all of its images?`)) return;
    try {
      await adminDeleteOsceCase(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (openId) {
    return <CaseEditor caseId={openId} onBack={() => { setOpenId(null); load(); }} onChanged={load} />;
  }

  return (
    <div className="osce-wrap">
      <header className="osce-head">
        <div>
          <p className="osce-eyebrow">Study tools</p>
          <h1>OSCE Clinical</h1>
          <p className="osce-sub">
            Image-first examination stations, filed under your course subjects. The AI
        writes the case; you supply the pictures.
          </p>
        </div>
      </header>

      <NewCasePanel
        systems={systems}
        courses={courses}
        onCreated={(created, warns) => { setWarnings(warns); load(); if (created?.id) setOpenId(created.id); }}
      />

      <CategoryManager courses={courses} categories={systems} onChanged={load} />

      {warnings.length ? (
        <ul className="osce-warnings">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      ) : null}
      {error ? <p className="osce-error">{error}</p> : null}

      {loading ? <p className="osce-hint">Loading stations…</p> : null}

      {!loading && !cases.length ? (
        <p className="osce-hint">No stations yet — name a condition above to write your first one.</p>
      ) : null}

      {/* Grouped by category, because an order only means anything within one —
          students see stations inside a category, never as one flat list. */}
      {caseGroups.map((group) => (
        <div key={group.key} className="osce-casegroup">
          <div className="osce-casegroup-head">
            <b>{group.label}</b>
            <span className="osce-hint">
              {group.items.length} station{group.items.length === 1 ? '' : 's'}
              {group.items.length > 1
                ? ' · use the arrows to set the order students see'
                : ' · add another to be able to order them'}
            </span>
          </div>
          <div className="osce-caselist">
            {group.items.map((c, i) => (
              <div key={c.id} className="osce-caserow">
                {/* With one station both arrows would be disabled, which reads
                    as "no ordering here" rather than "nothing to reorder" — so
                    show the position instead and drop the controls. */}
                {group.items.length > 1 ? (
                  <div className="osce-catrow-move">
                    <button type="button" disabled={i === 0 || ordering}
                            title="Move up" onClick={() => moveCase(group, i, -1)}>↑</button>
                    <button type="button" disabled={i === group.items.length - 1 || ordering}
                            title="Move down" onClick={() => moveCase(group, i, 1)}>↓</button>
                  </div>
                ) : (
                  <span className="osce-caserow-pos">1</span>
                )}
                {group.items.length > 1
                  ? <span className="osce-caserow-pos">{i + 1}</span>
                  : null}
                <button type="button" className="osce-caserow-main" onClick={() => setOpenId(c.id)}>
                  <b>{c.title}</b>
                  <span>{[c.courseTitle, c.systemName].filter(Boolean).join(' · ')} · {c.summary || 'No summary yet'}</span>
                </button>
                <span className={`osce-badge ${c.status === 'published' ? 'is-live' : ''}`}>{c.status}</span>
                <button type="button" className="osce-btn-danger" onClick={() => remove(c.id, c.title)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminOscePage;
