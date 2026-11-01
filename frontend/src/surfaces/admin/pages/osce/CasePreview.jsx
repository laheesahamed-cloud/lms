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

// Three tabs, same as the app. Everything that explains the condition lives
// under Learn; the old "OSCE" practice step is the Checklist.
const STEPS = [
  ['exam', 'Examine', 'Explore the patient'],
  ['learn', 'Learn', 'Understand the condition'],
  ['checklist', 'Checklist', 'Revise the station'],
];

const ROOT = '__patient';
const TECHNIQUE_ORDER = ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'];
const METHOD_LABEL = {
  inspection: 'Look', palpation: 'Feel', percussion: 'Percuss', auscultation: 'Listen', symptom: 'Ask',
};
const methodLabel = (c) => METHOD_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : '');

/** Simple line icons, picked from the region's name. */
function RegionIcon({ title }) {
  const t = String(title || '').toLowerCase();
  const path = /face|head|eye|mouth|neck/.test(t)
    ? <><circle cx="12" cy="9" r="5" /><path d="M9 9h.01M15 9h.01M9.5 11.5c.7.7 1.5 1 2.5 1s1.8-.3 2.5-1M7 21c0-3 2.2-5 5-5s5 2 5 5" /></>
    : /chest|pr[ae]+cord|heart|lung|thorax/.test(t)
    ? <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.9 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" />
    : /hand|pulse|arm|nail/.test(t)
    ? <path d="M8 13V5a1.5 1.5 0 0 1 3 0v6m0-7a1.5 1.5 0 0 1 3 0v7m0-5a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.5L8 14" />
    : /leg|foot|feet|limb|ankle/.test(t)
    ? <path d="M9 3v8l-2 10M15 3v8l2 10M9 11h6" />
    : /abdom|liver|groin|pelvi|whole|general/.test(t)
    ? <><path d="M7 4c-2 3-2 8 0 11l2 5h6l2-5c2-3 2-8 0-11" /><circle cx="12" cy="13" r="1" /></>
    : <circle cx="12" cy="12" r="8" />;
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
  );
}

export function CasePreview({ caseId, reloadKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('exam');
  // Examine is one level: the patient, then a region popup, then a finding popup.
  const [region, setRegion] = useState(null);     // scene id, or ROOT for findings on the patient itself
  const [technique, setTechnique] = useState(null);
  const [openSign, setOpenSign] = useState(null);
  const [learnPart, setLearnPart] = useState('home');
  const [ticked, setTicked] = useState({});

  const load = useCallback(() => {
    setError(null);
    adminOscePreview(caseId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [caseId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const doc = data?.caseData;

  const root = useMemo(
    () => doc?.scenes?.find((s) => !s.parent) || doc?.scenes?.[0] || null,
    [doc],
  );

  const signById = useCallback(
    (id) => doc?.signs?.find((s) => s.id === id) || null,
    [doc],
  );

  // The regions are whatever the patient photo points at. Findings placed
  // straight on the patient get a "Whole patient" region of their own.
  const regions = useMemo(() => {
    if (!root || !doc) return [];
    const collect = (sc, seen = new Set(), depth = 0) => {
      const out = [];
      if (!sc || seen.has(sc.id) || depth > 6) return out;
      seen.add(sc.id);
      for (const h of sc.hotspots || []) {
        if (h.action?.type === 'sign') {
          const sign = signById(h.action.id);
          if (sign) out.push(sign);
        } else if (h.action?.type === 'scene') {
          out.push(...collect(doc.scenes.find((x) => x.id === h.action.id), seen, depth + 1));
        }
      }
      return out;
    };
    const list = [];
    for (const h of root.hotspots || []) {
      if (h.action?.type !== 'scene') continue;
      const sc = doc.scenes.find((x) => x.id === h.action.id);
      if (!sc) continue;
      list.push({ id: sc.id, title: sc.title || h.label || sc.id, scene: sc, hotspot: h, signs: collect(sc) });
    }
    const direct = (root.hotspots || [])
      .filter((h) => h.action?.type === 'sign').map((h) => signById(h.action.id)).filter(Boolean);
    if (direct.length) list.push({ id: ROOT, title: 'Whole patient', scene: root, hotspot: null, signs: direct });
    return list;
  }, [root, doc, signById]);

  const activeRegion = regions.find((r) => r.id === region) || null;
  const techniques = useMemo(() => {
    if (!activeRegion) return [];
    const set = new Set(activeRegion.signs.map((x) => x.category || 'inspection'));
    return TECHNIQUE_ORDER.filter((t) => set.has(t));
  }, [activeRegion]);
  const activeTechnique = techniques.includes(technique) ? technique : techniques[0] || null;
  const regionSigns = activeRegion
    ? activeRegion.signs.filter((x) => (x.category || 'inspection') === activeTechnique) : [];

  // The recording heard at a finding: the same clip plays under Listen in
  // Examine and in Learn > Sounds.
  const soundOf = useCallback((sign) => {
    if (!sign?.sound || !doc) return null;
    return (doc.sounds || []).find((x, k) => (x.id || `sound-${k + 1}`) === sign.sound) || null;
  }, [doc]);

  // The mechanism step that explains the open finding, if the case links one.
  const linkedStep = useMemo(() => {
    if (!openSign || !doc) return null;
    const edge = (Array.isArray(doc.summary?.connect) ? doc.summary.connect : [])
      .find((e) => e.from === openSign.id);
    return edge ? (doc.chain || []).find((c) => Number(c.step) === Number(edge.to)) || null : null;
  }, [openSign, doc]);

  const openRegion = (id) => { setRegion(id); setTechnique(null); setOpenSign(null); };
  const closePopup = () => { setRegion(null); setOpenSign(null); };

  const learnCards = useMemo(() => {
    if (!doc) return [];
    const out = [];
    if (doc.chain?.length) out.push(['chain', 'Mechanism', 'Follow the disease from cause to signs.']);
    if (doc.investigations?.length) out.push(['ix', 'Investigations', 'Which tests confirm it, and what they show.']);
    if (doc.sounds?.length) out.push(['sounds', 'Sounds', 'What to listen for.']);
    if (doc.treatment?.length) out.push(['treatment', 'Management', 'What you do about it, in order.']);
    if (doc.summary?.keyPoints?.length || doc.summary?.osceTips?.length) out.push(['summary', 'Quick revision', 'Key points and OSCE tips.']);
    if (doc.related?.length) out.push(['related', 'Related cases', 'Causes, complications and differentials.']);
    if (doc.practice?.questions?.length) out.push(['viva', 'Viva questions', 'Questions an examiner may ask.']);
    return out;
  }, [doc]);

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
            The case as a student sees it: History, Learn and Viva.
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
                {stepMeta[2]}
              </span>
            </div>
          </div>

          <div className="osce-pv-body">
            {step === 'exam' && root ? (
              <>
                <p className="osce-pv-purpose">
                  Tap a marker on the patient, or pick a region below.
                </p>
                <div className="osce-pv-scene" style={{ aspectRatio: '3 / 4' }}>
                  <div className="osce-pv-img">
                    {root.image?.full
                      ? <img src={root.image.full} alt="" />
                      : <div className="osce-pv-noimg">No image in this slot yet</div>}
                    {regions.filter((r) => r.hotspot).map((r) => (
                      <button key={r.id} type="button" className="osce-pv-dot is-zoom"
                              style={{ left: `${r.hotspot.x * 100}%`, top: `${r.hotspot.y * 100}%` }}
                              title={r.title} onClick={() => openRegion(r.id)} />
                    ))}
                  </div>
                </div>
                <p className="osce-pv-count">Examine a region</p>
                {regions.length === 0 ? <p className="osce-pv-count">No regions placed on the patient yet.</p> : null}
                <div className="osce-pv-regiongrid">
                  {regions.map((r) => (
                    <button key={r.id} type="button" className="osce-pv-regiontile" onClick={() => openRegion(r.id)}>
                      <RegionIcon title={r.title} />
                      <span>{r.title}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 'learn' ? (
              learnPart === 'home' ? (
                <>
                  <p className="osce-pv-purpose">The science behind the findings, one topic at a time.</p>
                  {learnCards.length === 0 ? (
                    <p className="osce-hint osce-hint--muted">Nothing to learn from yet — add mechanism, investigations or treatment.</p>
                  ) : null}
                  {learnCards.map(([key, title, hint]) => (
                    <button key={key} type="button" className="osce-pv-finding" onClick={() => setLearnPart(key)}>
                      <i />
                      <span><b>{title}</b><br /><small>{hint}</small></span>
                      <em>›</em>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button type="button" className="osce-pv-learnback" onClick={() => setLearnPart('home')}>‹ Learn</button>
            {learnPart === 'chain' ? (
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

            {learnPart === 'ix' ? (
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

            {learnPart === 'summary' ? (
              <>
                <p className="osce-pv-purpose">The points an examiner is listening for.</p>
                <b className="osce-pv-h">Key points</b>
                <ul>{(doc.summary?.keyPoints || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
                <b className="osce-pv-h">OSCE tips</b>
                <ul>{(doc.summary?.osceTips || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </>
            ) : null}

            {learnPart === 'treatment' ? (
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


                  {learnPart === 'sounds' ? (
                    <>
                      <p className="osce-pv-purpose">Listen for these.</p>
                      {(doc.sounds || []).map((snd, i) => {
                        const key = snd.id || `sound-${i + 1}`;
                        const heardIn = (doc.signs || []).filter((x) => x.sound === key);
                        return (
                          <div key={i} className="osce-pv-ix">
                            <b>{snd.title}</b>
                            {snd.audio?.url
                              ? <audio controls preload="none" src={snd.audio.url} />
                              : <p className="osce-hint osce-hint--muted">No recording attached yet.</p>}
                            {heardIn.length ? <p>Heard in: {heardIn.map((x) => x.name).join(', ')}</p> : null}
                            <ul>{(snd.markers || []).map((m, k) => <li key={k}>{m.label}</li>)}</ul>
                          </div>
                        );
                      })}
                    </>
                  ) : null}

                  {learnPart === 'related' ? (
                    <>
                      <p className="osce-pv-purpose">Other stations to compare with this one.</p>
                      {(doc.related || []).map((r, i) => (
                        <div key={i} className="osce-pv-step">
                          <i>{String(r.rel || '')[0]?.toUpperCase()}</i>
                          <div><b>{r.case}</b><p>{[r.rel, r.note].filter(Boolean).join(' — ')}</p></div>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {learnPart === 'viva' ? (
                    <>
                      <p className="osce-pv-purpose">Tap a question to reveal the answer.</p>
                      {(doc.practice?.questions || []).map((q, i) => (
                        <details key={i} className="osce-pv-viva"><summary>{q.q}</summary><p>{q.a}</p></details>
                      ))}
                    </>
                  ) : null}
                </>
              )
            ) : null}

            {step === 'checklist' ? (
              <>
                <p className="osce-pv-purpose">Tick off the examination as you rehearse it.</p>
                {(doc.practice?.checklist || []).length === 0 ? (
                  <p className="osce-hint osce-hint--muted">No checklist written for this case yet.</p>
                ) : null}
                {(doc.practice?.checklist || []).map((sec, i) => (
                  <div key={i}>
                    <b className="osce-pv-h">{String(sec.section).replace(/_/g, ' ')}</b>
                    {(sec.items || []).map((it, k) => (
                      <label key={k} className="osce-pv-check">
                        <input type="checkbox" checked={!!ticked[`${i}:${k}`]}
                               onChange={(e) => setTicked({ ...ticked, [`${i}:${k}`]: e.target.checked })} />
                        <span>{typeof it === 'string' ? it : it?.text}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </>
            ) : null}
          </div>

          <div className="osce-pv-rail">
            {STEPS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={step === key ? 'is-on' : ''}
                onClick={() => { setStep(key); closePopup(); setLearnPart('home'); }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeRegion ? (
            <div className="osce-pv-modalwrap" onClick={closePopup}>
              <div className="osce-pv-modal" onClick={(e) => e.stopPropagation()}>
                {openSign ? (
                  <>
                    <div className="osce-pv-modalhead">
                      <button type="button" onClick={() => setOpenSign(null)} aria-label="Back to region">‹</button>
                      <div>
                        <span className="osce-pv-eyebrow">{methodLabel(openSign.category)}</span>
                        <b>{openSign.name}</b>
                      </div>
                      <button type="button" onClick={closePopup} aria-label="Close">✕</button>
                    </div>
                    {/* The region picture is fixed; the finding's own picture, if it
                        has one, sits under "What is it?". */}
                    {activeRegion.scene?.image?.full
                      ? <img src={activeRegion.scene.image.full} alt="" />
                      : <div className="osce-pv-noimg osce-pv-noimg--sm">No image in this slot yet</div>}
                    {openSign.short ? <><b className="osce-pv-h">What is it?</b><p>{openSign.short}</p></> : null}
                    {openSign.image?.full ? <img src={openSign.image.full} alt="" /> : null}
                    {soundOf(openSign) ? (
                      <div className="osce-pv-sound">
                        <b>Listen</b>
                        {soundOf(openSign).audio?.url
                          ? <audio controls preload="none" src={soundOf(openSign).audio.url} />
                          : <p className="osce-hint osce-hint--muted">No recording attached yet — link one in the Sounds tab.</p>}
                      </div>
                    ) : null}
                    {openSign.how ? <><b className="osce-pv-h">How do I examine it?</b><p>{openSign.how}</p></> : null}
                    {openSign.body ? <><b className="osce-pv-h">Why does it happen?</b><p>{openSign.body}</p></> : null}
                    {linkedStep ? (
                      <div className="osce-pv-why">
                        {linkedStep.image?.full ? <img src={linkedStep.image.full} alt="" /> : null}
                        <b>{linkedStep.step}. {linkedStep.title}</b>
                        {linkedStep.body ? <p>{linkedStep.body}</p> : null}
                      </div>
                    ) : null}
                    <div className="osce-pv-actions">
                      {linkedStep ? (
                        <button type="button" className="osce-pv-cta"
                                onClick={() => { setStep('learn'); setLearnPart('chain'); closePopup(); }}>
                          See mechanism ›
                        </button>
                      ) : null}
                      <button type="button" className="osce-pv-ghost" onClick={() => setOpenSign(null)}>Back</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="osce-pv-modalhead">
                      <div>
                        <span className="osce-pv-eyebrow">Examination region</span>
                        <b>{activeRegion.title}</b>
                      </div>
                      <button type="button" onClick={closePopup} aria-label="Close">✕</button>
                    </div>
                    {activeRegion.scene?.image?.full ? (
                      <div className="osce-pv-regionimg">
                        <img src={activeRegion.scene.image.full} alt="" />
                        {(activeRegion.scene.hotspots || [])
                          .filter((h) => h.action?.type === 'sign'
                            && (signById(h.action.id)?.category || 'inspection') === activeTechnique)
                          .map((h, i) => (
                            <button key={i} type="button" className="osce-pv-dot" title={h.label}
                                    style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
                                    onClick={() => setOpenSign(signById(h.action.id))} />
                          ))}
                      </div>
                    ) : <div className="osce-pv-noimg osce-pv-noimg--sm">No image in this slot yet</div>}
                    <p className="osce-pv-hint">Choose an examination technique.</p>
                    <div className="osce-pv-segs">
                      {techniques.map((t) => (
                        <button key={t} type="button" className={activeTechnique === t ? 'is-on' : ''}
                                onClick={() => setTechnique(t)}>{methodLabel(t)}</button>
                      ))}
                    </div>
                    {techniques.length === 0 ? <p className="osce-hint osce-hint--muted">No findings in this region yet.</p> : null}
                    {regionSigns.map((sg) => (
                      <button key={sg.id} type="button" className="osce-pv-finding" onClick={() => setOpenSign(sg)}>
                        <i /><span>{sg.name}</span><em>{methodLabel(sg.category)} ›</em>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A long case, as the app shows it: History, Learn, Viva. */
const LONG_STEPS = [['history', 'History'], ['learn', 'Learn'], ['viva', 'Viva']];

function LongPreview({ data, doc }) {
  const [tab, setTab] = useState('history');
  const [part, setPart] = useState('home');
  const [section, setSection] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [ticked, setTicked] = useState({});

  const sections = doc.sections || [];
  const current = sections[Math.min(section, Math.max(sections.length - 1, 0))] || null;
  const shown = current ? (current.exchanges || []).slice(0, revealed) : [];
  const more = current ? revealed < (current.exchanges || []).length : false;
  const lastSection = section >= sections.length - 1;
  const patient = doc.patient || {};
  const cast = doc.cast || {};

  const next = () => {
    if (more) setRevealed((n) => n + 1);
    else if (!lastSection) { setSection((n) => n + 1); setRevealed(1); }
  };

  const learnCards = [
    doc.differentials?.length ? ['differentials', 'Differentials', 'What it could be, and what argues against each.'] : null,
    doc.initialManagement?.length ? ['initial', 'Initial management', 'The first steps at the bedside.'] : null,
    doc.treatment?.length ? ['treatment', 'Management', 'What you do about it, in order.'] : null,
    (doc.summary?.keyPoints?.length || doc.summary?.osceTips?.length) ? ['summary', 'Quick revision', 'Key points and OSCE tips.'] : null,
    (doc.practice?.checklist || []).length ? ['checklist', 'Checklist', 'What a good history covers — tick it off as you rehearse.'] : null,
  ].filter(Boolean);

  const subtitle = tab === 'history' && current
    ? `Step ${section + 1} of ${sections.length} · ${current.title}`
    : tab === 'learn' ? 'Understand the case' : tab === 'viva' ? 'Questions an examiner may ask' : '';

  return (
    <div className="osce-phone">
      <div className="osce-phone-screen">
        <div className="osce-pv-head">
          <span className="osce-pv-back">‹</span>
          <div>
            <b>{data.title}</b>
            <span>{subtitle}</span>
          </div>
        </div>

        {tab === 'history' ? (
          <>
            <div className="osce-pv-patient">
              {cast.patient?.thumb ? <img src={cast.patient.thumb} alt="" /> : <i>👤</i>}
              <div>
                <b>{patient.name || 'The patient'}</b>
                <span>{[patient.age, patient.sex, patient.occupation].filter(Boolean).join(' · ')}</span>
                {patient.opening ? <em>“{patient.opening}”</em> : null}
              </div>
            </div>
            <div className="osce-pv-body">
              {!current ? (
                <p className="osce-pv-purpose">No history yet — add sections and exchanges in the History tab.</p>
              ) : (
                <>
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
                  <button type="button" className="osce-pv-cta" onClick={next} disabled={!more && lastSection}>
                    {more ? 'Next question'
                      : lastSection ? 'History complete'
                      : `Next: ${sections[section + 1].title}`}
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}

        {tab === 'learn' ? (
          <div className="osce-pv-body">
            {part === 'home' ? (
              <>
                <p className="osce-pv-purpose">The reasoning behind the history, one topic at a time.</p>
                {learnCards.length === 0 ? <p className="osce-hint osce-hint--muted">Nothing here yet.</p> : null}
                {learnCards.map(([key, title, hint]) => (
                  <button key={key} type="button" className="osce-pv-finding" onClick={() => setPart(key)}>
                    <i /><span><b>{title}</b><br /><small>{hint}</small></span><em>›</em>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button type="button" className="osce-pv-learnback" onClick={() => setPart('home')}>‹ Learn</button>
                {part === 'differentials' ? (doc.differentials || []).map((d, i) => (
                  <div key={i} className="osce-pv-step">
                    <i>{i + 1}</i>
                    <div>
                      <b>{d.diagnosis}</b>
                      {d.supporting ? <p>For: {d.supporting}</p> : null}
                      {d.against ? <p>Against: {d.against}</p> : null}
                    </div>
                  </div>
                )) : null}
                {part === 'initial' ? <ul>{(doc.initialManagement || []).map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
                {part === 'treatment' ? (doc.treatment || []).map((g, i) => (
                  <div key={i}>
                    <b className="osce-pv-h">{g.group || 'Management'}</b>
                    <ul>{(g.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
                  </div>
                )) : null}
                {part === 'summary' ? (
                  <>
                    <b className="osce-pv-h">Key points</b>
                    <ul>{(doc.summary?.keyPoints || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
                    <b className="osce-pv-h">OSCE tips</b>
                    <ul>{(doc.summary?.osceTips || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
                  </>
                ) : null}
                {part === 'checklist' ? (doc.practice?.checklist || []).map((sec, i) => (
                  <div key={i}>
                    <b className="osce-pv-h">{String(sec.section).replace(/[_-]/g, ' ')}</b>
                    {(sec.items || []).map((it, k) => (
                      <label key={k} className="osce-pv-check">
                        <input type="checkbox" checked={!!ticked[`${i}:${k}`]}
                               onChange={(e) => setTicked({ ...ticked, [`${i}:${k}`]: e.target.checked })} />
                        <span>{typeof it === 'string' ? it : it?.text}</span>
                      </label>
                    ))}
                  </div>
                )) : null}
              </>
            )}
          </div>
        ) : null}

        {tab === 'viva' ? (
          <div className="osce-pv-body">
            <p className="osce-pv-purpose">Tap a question to reveal the answer.</p>
            {(doc.practice?.questions || []).length === 0 ? <p className="osce-hint osce-hint--muted">No viva questions written yet.</p> : null}
            {(doc.practice?.questions || []).map((q, i) => (
              <details key={i} className="osce-pv-viva"><summary>{q.q}</summary><p>{q.a}</p></details>
            ))}
          </div>
        ) : null}

        <div className="osce-pv-rail">
          {LONG_STEPS.map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'is-on' : ''}
                    onClick={() => { setTab(key); setPart('home'); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CasePreview;
