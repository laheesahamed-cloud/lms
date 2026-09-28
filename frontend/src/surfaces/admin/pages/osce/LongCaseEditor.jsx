import { useState } from 'react';

/**
 * A long case is a conversation, so it gets its own editor rather than the
 * short case's scenes-and-findings tabs. You edit who the patient is, then the
 * history section by section, exchange by exchange — the same order the student
 * walks it in.
 */

const SECTION_PRESETS = [
  ['introduction', 'Introduction'],
  ['presenting-complaint', 'Presenting complaint'],
  ['systemic-review', 'Systemic review'],
  ['past-medical', 'Past medical history'],
  ['past-surgical', 'Past surgical history'],
  ['drugs-allergies', 'Drugs and allergies'],
  ['family-social', 'Family and social history'],
];

export function LongCaseEditor({ doc, patchDoc }) {
  const [open, setOpen] = useState(0);

  const sections = doc.sections || [];
  const patient = doc.patient || {};

  const setSections = (next) => patchDoc({ sections: next });
  const patchSection = (i, changes) =>
    setSections(sections.map((s, j) => (j === i ? { ...s, ...changes } : s)));

  const moveSection = (i, delta) => {
    const target = i + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[i], next[target]] = [next[target], next[i]];
    setSections(next);
    setOpen(target);
  };

  const patchExchange = (si, ei, changes) => {
    const exchanges = (sections[si].exchanges || [])
      .map((e, j) => (j === ei ? { ...e, ...changes } : e));
    patchSection(si, { exchanges });
  };

  const moveExchange = (si, ei, delta) => {
    const exchanges = [...(sections[si].exchanges || [])];
    const target = ei + delta;
    if (target < 0 || target >= exchanges.length) return;
    [exchanges[ei], exchanges[target]] = [exchanges[target], exchanges[ei]];
    patchSection(si, { exchanges });
  };

  return (
    <div className="osce-long">
      {/* ── who the patient is ── */}
      <div className="osce-card">
        <div className="osce-card-head">
          <b className="osce-long-h">The patient</b>
        </div>
        <div className="osce-long-grid">
          <label>
            <span>Name</span>
            <input className="osce-input" value={patient.name || ''}
                   onChange={(e) => patchDoc({ patient: { ...patient, name: e.target.value } })} />
          </label>
          <label>
            <span>Age</span>
            <input className="osce-input" type="number" value={patient.age ?? ''}
                   onChange={(e) => patchDoc({ patient: { ...patient, age: Number(e.target.value) || null } })} />
          </label>
          <label>
            <span>Sex</span>
            <input className="osce-input" value={patient.sex || ''}
                   onChange={(e) => patchDoc({ patient: { ...patient, sex: e.target.value } })} />
          </label>
          <label>
            <span>Occupation</span>
            <input className="osce-input" value={patient.occupation || ''}
                   onChange={(e) => patchDoc({ patient: { ...patient, occupation: e.target.value } })} />
          </label>
        </div>
        <label className="osce-long-full">
          <span>Opening line — what they say first, in their own words</span>
          <textarea className="osce-input osce-input--full" rows={2} value={patient.opening || ''}
                    onChange={(e) => patchDoc({ patient: { ...patient, opening: e.target.value } })} />
        </label>
      </div>

      {/* ── the history ── */}
      <div className="osce-long-sections">
        <div className="osce-long-bar">
          <b className="osce-long-h">History</b>
          <span className="osce-hint">
            {sections.length} section{sections.length === 1 ? '' : 's'} ·{' '}
            {sections.reduce((n, s) => n + (s.exchanges?.length || 0), 0)} exchanges
          </span>
        </div>

        {sections.map((section, si) => (
          <div key={si} className={`osce-card osce-long-section ${open === si ? 'is-open' : ''}`}>
            <div className="osce-card-head">
              <div className="osce-catrow-move">
                <button type="button" disabled={si === 0} onClick={() => moveSection(si, -1)}>↑</button>
                <button type="button" disabled={si === sections.length - 1}
                        onClick={() => moveSection(si, 1)}>↓</button>
              </div>
              <button type="button" className="osce-long-toggle"
                      onClick={() => setOpen(open === si ? -1 : si)}>
                {open === si ? '▾' : '▸'} {section.title || `Section ${si + 1}`}
                <em>{section.exchanges?.length || 0}</em>
              </button>
              <button type="button" className="osce-btn-danger"
                      onClick={() => setSections(sections.filter((_, j) => j !== si))}>Remove</button>
            </div>

            {open === si ? (
              <>
                <div className="osce-long-grid">
                  <label>
                    <span>Title</span>
                    <input className="osce-input" value={section.title || ''}
                           onChange={(e) => patchSection(si, { title: e.target.value })} />
                  </label>
                  <label className="osce-long-wide">
                    <span>Purpose — one line on what to achieve here</span>
                    <input className="osce-input" value={section.purpose || ''}
                           onChange={(e) => patchSection(si, { purpose: e.target.value })} />
                  </label>
                </div>

                {(section.exchanges || []).map((ex, ei) => (
                  <div key={ei} className="osce-exchange">
                    <div className="osce-catrow-move">
                      <button type="button" disabled={ei === 0}
                              onClick={() => moveExchange(si, ei, -1)}>↑</button>
                      <button type="button" disabled={ei === (section.exchanges.length - 1)}
                              onClick={() => moveExchange(si, ei, 1)}>↓</button>
                    </div>
                    <div className="osce-exchange-body">
                      <label>
                        <span>Student asks</span>
                        <textarea className="osce-input osce-input--full" rows={2} value={ex.ask || ''}
                                  onChange={(e) => patchExchange(si, ei, { ask: e.target.value })} />
                      </label>
                      <label>
                        <span>Patient answers — lay language, not textbook terms</span>
                        <textarea className="osce-input osce-input--full" rows={2} value={ex.reply || ''}
                                  onChange={(e) => patchExchange(si, ei, { reply: e.target.value })} />
                      </label>
                      <label>
                        <span>Teaching note (optional)</span>
                        <input className="osce-input osce-input--full" value={ex.note || ''}
                               placeholder="What a good student notices here"
                               onChange={(e) => patchExchange(si, ei, { note: e.target.value })} />
                      </label>
                    </div>
                    <button type="button" className="osce-btn-danger"
                            onClick={() => patchSection(si, {
                              exchanges: section.exchanges.filter((_, j) => j !== ei),
                            })}>×</button>
                  </div>
                ))}

                <button type="button" className="osce-add osce-add--sm"
                        onClick={() => patchSection(si, {
                          exchanges: [...(section.exchanges || []), { ask: '', reply: '', note: '' }],
                        })}>+ Exchange</button>
              </>
            ) : null}
          </div>
        ))}

        <div className="osce-long-addsection">
          <button type="button" className="osce-add" onClick={() => {
            const next = [...sections, { id: `section-${Date.now().toString(36)}`, title: 'New section', purpose: '', exchanges: [] }];
            setSections(next);
            setOpen(next.length - 1);
          }}>+ Section</button>
          <select className="osce-input" defaultValue="" onChange={(e) => {
            const preset = SECTION_PRESETS.find(([id]) => id === e.target.value);
            if (!preset) return;
            const next = [...sections, { id: preset[0], title: preset[1], purpose: '', exchanges: [] }];
            setSections(next);
            setOpen(next.length - 1);
            e.target.value = '';
          }}>
            <option value="">Add a standard section…</option>
            {SECTION_PRESETS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── what it points to ── */}
      <div className="osce-card">
        <div className="osce-card-head"><b className="osce-long-h">Differentials</b></div>
        {(doc.differentials || []).map((d, i) => (
          <div key={i} className="osce-diff">
            <span className="osce-step">{i + 1}</span>
            <div className="osce-exchange-body">
              <input className="osce-input osce-input--full" placeholder="Diagnosis"
                     value={d.diagnosis || ''}
                     onChange={(e) => patchDoc({ differentials: doc.differentials.map((x, j) => (j === i ? { ...x, diagnosis: e.target.value } : x)) })} />
              <input className="osce-input osce-input--full" placeholder="What in the history supports it"
                     value={d.supporting || ''}
                     onChange={(e) => patchDoc({ differentials: doc.differentials.map((x, j) => (j === i ? { ...x, supporting: e.target.value } : x)) })} />
              <input className="osce-input osce-input--full" placeholder="What argues against it"
                     value={d.against || ''}
                     onChange={(e) => patchDoc({ differentials: doc.differentials.map((x, j) => (j === i ? { ...x, against: e.target.value } : x)) })} />
            </div>
            <button type="button" className="osce-btn-danger"
                    onClick={() => patchDoc({ differentials: doc.differentials.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button type="button" className="osce-add osce-add--sm" onClick={() => patchDoc({
          differentials: [...(doc.differentials || []), { diagnosis: '', supporting: '', against: '' }],
        })}>+ Differential</button>
      </div>

      <div className="osce-card">
        <div className="osce-card-head"><b className="osce-long-h">Initial management</b></div>
        {(doc.initialManagement || []).map((step, i) => (
          <div key={i} className="osce-textrow">
            <input className="osce-input" value={step} placeholder="First step"
                   onChange={(e) => patchDoc({ initialManagement: doc.initialManagement.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button type="button" className="osce-btn-danger"
                    onClick={() => patchDoc({ initialManagement: doc.initialManagement.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button type="button" className="osce-add osce-add--sm" onClick={() => patchDoc({
          initialManagement: [...(doc.initialManagement || []), ''],
        })}>+ Step</button>
      </div>
    </div>
  );
}

export default LongCaseEditor;
