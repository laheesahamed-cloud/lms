import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminOscePreview } from '../../../../shared/api/osce.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';

/**
 * The station as a student sees it, rendered live in the panel.
 *
 * Authoring previously meant rebuilding and reinstalling the app to check a
 * hotspot sat in the right place — a minute per look. This mirrors the app's
 * walkthrough closely enough to judge placement, ordering and wording, and it
 * reads the same hydrated payload the app does, so it can't drift on the data.
 */

const STEPS = [
  ['exam', 'Exam', 'Examine the patient'],
  ['chain', 'Mechanism', 'How it happens'],
  ['ix', 'Ix', 'Investigations'],
  // After the investigations and before the summary — you decide what to do
  // once you know what it is, and before you pull the case together.
  ['treatment', 'Treatment', 'What you do about it'],
  ['summary', 'Summary', 'Pull it together'],
  ['practice', 'OSCE', 'Practise the station'],
];

export function CasePreview({ caseId, reloadKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('exam');
  const [sceneId, setSceneId] = useState(null);
  const [stage, setStage] = useState('all');
  const [peek, setPeek] = useState(null);
  const [openSign, setOpenSign] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminOscePreview(caseId)
      .then((res) => {
        setData(res);
        setSceneId((prev) => prev || res?.caseData?.scenes?.find((s) => !s.parent)?.id || null);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [caseId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const doc = data?.caseData;

  const scene = useMemo(() => {
    if (!doc?.scenes?.length) return null;
    return doc.scenes.find((s) => s.id === sceneId) || doc.scenes.find((s) => !s.parent) || doc.scenes[0];
  }, [doc, sceneId]);

  const trail = useMemo(() => {
    if (!scene || !doc) return [];
    const out = [];
    let node = scene;
    let guard = 0;
    while (node && guard++ < 8) {
      out.unshift(node);
      node = node.parent ? doc.scenes.find((s) => s.id === node.parent) : null;
    }
    return out;
  }, [scene, doc]);

  const signById = useCallback(
    (id) => doc?.signs?.find((s) => s.id === id) || null,
    [doc]
  );

  const stages = useMemo(() => {
    if (!scene) return [];
    const set = new Set();
    for (const h of scene.hotspots || []) {
      if (h.action?.type !== 'sign') continue;
      const sign = signById(h.action.id);
      if (sign?.category) set.add(sign.category);
    }
    const order = ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'];
    return [...set].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [scene, signById]);

  const visible = useMemo(() => {
    if (!scene) return [];
    return (scene.hotspots || []).filter((h) => {
      if (stage === 'all') return true;
      if (h.action?.type !== 'sign') return true;
      return signById(h.action.id)?.category === stage;
    });
  }, [scene, stage, signById]);

  const signSpots = visible.filter((h) => h.action?.type === 'sign');

  if (error) {
    return (
      <div className="osce-preview-wrap">
        <p className="osce-error">{error}</p>
      </div>
    );
  }
  if (!data) return <p className="osce-hint">Loading preview…</p>;

  // A long case is a conversation, so it previews as one.
  const isLong = data.stationType === 'long' || (doc?.sections?.length > 0);
  if (isLong) {
    return (
      <div className="osce-preview-wrap">
        <div className="osce-preview-bar">
          <span className="osce-hint">
            The history as a student walks it — each tap reveals the next exchange.
          </span>
          <button type="button" onClick={load}>Reload preview</button>
        </div>
        <LongPreview data={data} doc={doc} />
      </div>
    );
  }

  const stepMeta = STEPS.find(([k]) => k === step) || STEPS[0];

  return (
    <div className="osce-preview-wrap">
      <div className="osce-preview-bar">
        <span className="osce-hint">
          What a student sees. Reads the same payload the app does — reload after saving.
        </span>
        <button type="button" onClick={load}>Reload preview</button>
      </div>

      <div className="osce-phone">
        <div className="osce-phone-screen">
          <div className="osce-pv-head">
            <span className="osce-pv-back">‹</span>
            <div>
              <b>{data.title}</b>
              <span>
                Step {STEPS.findIndex(([k]) => k === step) + 1} of {STEPS.length} · {stepMeta[2]}
              </span>
            </div>
          </div>

          <div className="osce-pv-body">
            {step === 'exam' && scene ? (
              <>
                {/* Pinned height: a block that grows or shrinks above the
                    picture moves the picture, which reads as it sliding. */}
                <div className="osce-pv-above">
                <p className="osce-pv-purpose">
                  Work head to toe. Tap each finding to examine it properly.
                </p>

                <div className="osce-pv-crumbs">
                  {trail.map((s, i) => (
                    <span key={s.id}>
                      <button
                        type="button"
                        className={i === trail.length - 1 ? 'is-here' : ''}
                        onClick={() => { setSceneId(s.id); setPeek(null); setStage('all'); }}
                      >
                        {s.title || s.id}
                      </button>
                      {i < trail.length - 1 ? <i>›</i> : null}
                    </span>
                  ))}
                </div>

                <div className="osce-pv-stages">
                  {['all', ...stages].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={stage === key ? 'is-on' : ''}
                      onClick={() => { setStage(key); setPeek(null); }}
                    >
                      {key === 'all' ? 'All' : key[0].toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
                </div>

                <div
                  className="osce-pv-scene"
                  style={{ aspectRatio: scene.parent ? '4 / 3' : '3 / 4' }}
                >
                  {/* The inner wrapper shrink-wraps the picture, so dots sit on
                      the IMAGE even when it letterboxes inside the 3:4 frame. */}
                  <div className="osce-pv-img">
                  {scene.image?.full
                    ? <img src={scene.image.full} alt="" />
                    : <div className="osce-pv-noimg">No image in this slot yet</div>}
                  {visible.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`osce-pv-dot ${h.action?.type === 'scene' ? 'is-zoom' : ''}`}
                      style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
                      title={h.label}
                      onClick={() => {
                        if (h.action?.type === 'scene') {
                          setSceneId(h.action.id); setPeek(null); setStage('all');
                        } else if (h.action?.type === 'sign') {
                          setPeek(h);
                        }
                      }}
                    />
                  ))}
                  </div>
                  {peek ? (
                    <div className="osce-pv-peek">
                      <b>{signById(peek.action?.id)?.name || peek.label}</b>
                      <p>{signById(peek.action?.id)?.short || '—'}</p>
                      <div>
                        <button type="button" onClick={() => setOpenSign(signById(peek.action?.id))}>
                          Examine ›
                        </button>
                        <button type="button" className="ghost" onClick={() => setPeek(null)}>Close</button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {signSpots.length ? (
                  <>
                    <p className="osce-pv-count">
                      {signSpots.length} finding{signSpots.length === 1 ? '' : 's'} here
                    </p>
                    {signSpots.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        className="osce-pv-finding"
                        onClick={() => setOpenSign(signById(h.action?.id))}
                      >
                        <i />
                        <span>{signById(h.action?.id)?.name || h.label}</span>
                        <em>{signById(h.action?.id)?.category || ''}</em>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="osce-pv-count">No findings placed on this view yet.</p>
                )}
              </>
            ) : null}

            {step === 'chain' ? (
              <>
                <p className="osce-pv-purpose">Follow the mechanism from cause to the signs.</p>
                {(doc.chain || []).map((c) => (
                  <div key={c.step} className="osce-pv-step">
                    <i>{c.step}</i>
                    <div><b>{c.title}</b><p>{c.body}</p></div>
                  </div>
                ))}
              </>
            ) : null}

            {step === 'ix' ? (
              <>
                <p className="osce-pv-purpose">Read each investigation and name the findings.</p>
                {(doc.investigations || []).map((ix, i) => (
                  <div key={i} className="osce-pv-ix">
                    <b>{ix.title || ix.modality?.toUpperCase()}</b>
                    {ix.image?.full ? <img src={ix.image.full} alt="" /> : null}
                    <ul>{(ix.findings || []).map((f, k) => <li key={k}>{f}</li>)}</ul>
                  </div>
                ))}
              </>
            ) : null}

            {step === 'summary' ? (
              <>
                <p className="osce-pv-purpose">The points an examiner is listening for.</p>
                <b className="osce-pv-h">Key points</b>
                <ul>{(doc.summary?.keyPoints || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
                <b className="osce-pv-h">OSCE tips</b>
                <ul>{(doc.summary?.osceTips || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </>
            ) : null}

            {step === 'treatment' ? (
              <>
                <p className="osce-pv-purpose">What you do about it, in the order you do it.</p>
                {(doc.treatment || []).length === 0 ? (
                  <p className="osce-hint osce-hint--muted">No treatment written for this case yet.</p>
                ) : null}
                {(doc.treatment || []).map((group, i) => (
                  <div key={i}>
                    <b className="osce-pv-h">{group.group || 'Management'}</b>
                    <ul>{(group.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
                  </div>
                ))}
              </>
            ) : null}

            {step === 'practice' ? (
              <>
                <p className="osce-pv-purpose">Tick off the examination, then answer the viva.</p>
                {(doc.practice?.checklist || []).map((sec, i) => (
                  <div key={i}>
                    <b className="osce-pv-h">{String(sec.section).replace(/_/g, ' ')}</b>
                    <ul>{(sec.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
                  </div>
                ))}
              </>
            ) : null}
          </div>

          <div className="osce-pv-rail">
            {STEPS.map(([key, label], i) => (
              <button
                key={key}
                type="button"
                className={step === key ? 'is-on' : (i < STEPS.findIndex(([k]) => k === step) ? 'is-done' : '')}
                onClick={() => { setStep(key); setPeek(null); }}
              >
                <i>{i < STEPS.findIndex(([k]) => k === step) ? '✓' : i + 1}</i>
                {label}
              </button>
            ))}
          </div>

          {openSign ? (
            <div className="osce-pv-detail">
              <button type="button" className="osce-pv-detail-back" onClick={() => setOpenSign(null)}>
                ‹ Back to the patient
              </button>
              {openSign.image?.full ? <img src={openSign.image.full} alt="" /> : null}
              <b>{openSign.name}</b>
              <span className="osce-pv-cat">{openSign.category}</span>
              <p>{openSign.short}</p>
              <p className="osce-pv-dim">{openSign.body}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The long case's conversation, rendered the way the app plays it. */
function LongPreview({ data, doc }) {
  const [section, setSection] = useState(0);
  const [revealed, setRevealed] = useState(1);

  const sections = doc.sections || [];
  if (!sections.length) {
    return (
      <div className="osce-phone">
        <div className="osce-phone-screen">
          <div className="osce-pv-body">
            <p className="osce-pv-purpose">
              No history yet — add sections and exchanges in the History tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const current = sections[Math.min(section, sections.length - 1)];
  const shown = (current.exchanges || []).slice(0, revealed);
  const more = revealed < (current.exchanges || []).length;
  const lastSection = section >= sections.length - 1;
  const patient = doc.patient || {};
  const cast = doc.cast || {};

  const next = () => {
    if (more) setRevealed((n) => n + 1);
    else if (!lastSection) { setSection((n) => n + 1); setRevealed(1); }
  };

  return (
    <div className="osce-phone">
      <div className="osce-phone-screen">
        <div className="osce-pv-head">
          <span className="osce-pv-back">‹</span>
          <div>
            <b>{data.title}</b>
            <span>Step {section + 1} of {sections.length} · {current.title}</span>
          </div>
        </div>

        <div className="osce-pv-patient">
          {cast.patient?.thumb
            ? <img src={cast.patient.thumb} alt="" />
            : <i>👤</i>}
          <div>
            <b>{patient.name || 'The patient'}</b>
            <span>
              {[patient.age, patient.sex, patient.occupation].filter(Boolean).join(' · ')}
            </span>
            {patient.opening ? <em>“{patient.opening}”</em> : null}
          </div>
        </div>

        <div className="osce-pv-body">
          {current.purpose ? <p className="osce-pv-purpose">{current.purpose}</p> : null}
          {shown.map((ex, i) => (
            <div key={i} className="osce-pv-exchange">
              {ex.ask ? (
                <div className="osce-pv-ask">
                  {cast.doctor?.thumb ? <img src={cast.doctor.thumb} alt="" /> : <i>🩺</i>}
                  <p>{ex.ask}</p>
                </div>
              ) : null}
              {ex.reply ? <div className="osce-pv-reply"><p>{ex.reply}</p></div> : null}
              {ex.note ? <div className="osce-pv-note">💡 {ex.note}</div> : null}
            </div>
          ))}
        </div>

        <div className="osce-pv-rail">
          <button type="button" className="is-on" style={{ flex: 1 }}
                  onClick={next} disabled={!more && lastSection}>
            {more ? 'Next question'
              : lastSection ? 'History complete'
              : `Next: ${sections[section + 1].title}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CasePreview;
