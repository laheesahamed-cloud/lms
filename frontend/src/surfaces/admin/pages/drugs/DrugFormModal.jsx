import { useEffect, useState } from 'react';
import { adminCreateDrug, adminUpdateDrug, adminGetDrug, adminAiLookupDrug } from '../../../../shared/api/drugs.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import './DrugFormModal.css';

const FIELDS = [
  { key: 'name',              label: 'Drug Name',           required: true, rows: 1 },
  { key: 'drug_class',        label: 'Drug Class',          required: false, rows: 1 },
  { key: 'sl_brand_names',    label: 'SL Brand Names',      required: false, rows: 1 },
  { key: 'uses',              label: 'Uses',                required: false, rows: 2 },
  { key: 'dosage_adult',      label: 'Adult Dosage',        required: false, rows: 2 },
  { key: 'dosage_pediatric',  label: 'Pediatric Dosage',    required: false, rows: 2 },
  { key: 'side_effects',      label: 'Side Effects',        required: false, rows: 2 },
  { key: 'warnings',          label: 'Warnings',            required: false, rows: 2 },
  { key: 'drug_interactions', label: 'Drug Interactions',   required: false, rows: 2 },
  { key: 'pregnancy_info',    label: 'Pregnancy Info',      required: false, rows: 2 },
];

const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']));

export function DrugFormModal({ mode, drug, onClose, onSaved }) {
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError]     = useState(null);
  const [aiNote, setAiNote]   = useState(null);

  useEffect(() => {
    if (mode === 'edit' && drug?.id) {
      adminGetDrug(drug.id).then(d => {
        setForm(Object.fromEntries(FIELDS.map(f => [f.key, d[f.key] || ''])));
      }).catch(() => {});
    } else {
      setForm(EMPTY);
      setAiNote(null);
    }
  }, [mode, drug]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleAiLookup() {
    const name = (form.name || '').trim();
    if (!name) { setError('Enter a drug name first.'); return; }
    setLooking(true);
    setError(null);
    setAiNote(null);
    try {
      const res = await adminAiLookupDrug(name);
      setForm(f => ({
        ...f,
        ...Object.fromEntries(
          Object.entries(res.drug).map(([k, v]) => [k, v ?? f[k] ?? ''])
        ),
      }));
      setAiNote(`Filled by ${res.provider} · ${res.model} — review before saving`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') await adminCreateDrug(form);
      else await adminUpdateDrug(drug.id, form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dfm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dfm-panel" role="dialog" aria-modal="true"
           aria-label={mode === 'create' ? 'Add Drug' : 'Edit Drug'}>
        <div className="dfm-head">
          <h2 className="dfm-title">{mode === 'create' ? 'Add Drug' : 'Edit Drug'}</h2>
          <button className="dfm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="dfm-form" onSubmit={handleSubmit}>

          {/* Drug name + AI lookup row */}
          <div className="dfm-field">
            <label className="dfm-label">Drug Name<span className="dfm-req">*</span></label>
            <div className="dfm-name-row">
              <input
                className="dfm-input dfm-input--name"
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
                placeholder="e.g. Atorvastatin"
              />
              <button
                type="button"
                className="dfm-ai-btn"
                onClick={handleAiLookup}
                disabled={looking || saving}
                title="Auto-fill all fields using AI"
              >
                {looking ? (
                  <span className="dfm-ai-spinner" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M10 2a1 1 0 0 1 1 1v1.07A6.002 6.002 0 0 1 16 10a6 6 0 0 1-12 0 6.002 6.002 0 0 1 5-5.93V3a1 1 0 0 1 1-1z" fill="currentColor" opacity=".25"/>
                    <circle cx="10" cy="10" r="2.5" fill="currentColor"/>
                    <path d="M10 6V4M10 16v-2M4 10H2M18 10h-2M5.636 5.636 4.222 4.222M15.778 15.778l-1.414-1.414M5.636 14.364l-1.414 1.414M15.778 4.222l-1.414 1.414" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                )}
                {looking ? 'Looking up…' : 'AI Fill'}
              </button>
            </div>
          </div>

          {aiNote && (
            <p className="dfm-ai-note">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5M8 10.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              {aiNote}
            </p>
          )}

          {/* Remaining fields (skip name — already rendered) */}
          {FIELDS.filter(f => f.key !== 'name').map(({ key, label, required, rows }) => (
            <div key={key} className="dfm-field">
              <label className="dfm-label">
                {label}{required && <span className="dfm-req">*</span>}
              </label>
              {rows === 1 ? (
                <input
                  className="dfm-input"
                  type="text"
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  required={required}
                />
              ) : (
                <textarea
                  className="dfm-textarea"
                  rows={rows}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && <p className="dfm-error">{error}</p>}
          <div className="dfm-footer">
            <button type="button" className="dfm-btn dfm-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="dfm-btn dfm-btn--save" disabled={saving || looking}>
              {saving ? 'Saving…' : mode === 'create' ? 'Add Drug' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
