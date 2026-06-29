import { useCallback, useEffect, useState } from 'react';
import {
  adminListDrugs, adminDeleteDrug, adminToggleDrug,
  adminGetDrugSettings, adminUpdateDrugSettings, adminImportDrugs,
} from '../../../../shared/api/drugs.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { DrugFormModal } from './DrugFormModal.jsx';
import './AdminDrugsPage.css';

export function AdminDrugsPage() {
  const [drugs, setDrugs]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [modal, setModal]         = useState(null); // null | { mode: 'create'|'edit', drug?: {} }
  const [settings, setSettings]   = useState({ enabled: true, freeLimit: 5 });
  const [savingSettings, setSaving] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [importNote, setImportNote] = useState(null);
  const LIMIT = 30;

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListDrugs(p, LIMIT, q);
      setDrugs(res.drugs);
      setTotal(res.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [page]);

  useEffect(() => {
    adminGetDrugSettings().then(setSettings).catch(() => {});
  }, []);

  function handleSearch(e) {
    const q = e.target.value;
    setSearch(q);
    setPage(1);
    void load(1, q);
  }

  async function handleToggle(id) {
    await adminToggleDrug(id);
    void load();
  }

  async function handleDelete(drug) {
    if (!confirm(`Delete "${drug.name}"? This cannot be undone.`)) return;
    await adminDeleteDrug(drug.id);
    void load();
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await adminUpdateDrugSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportNote(null);
    try {
      const res = await adminImportDrugs(file);
      setImportNote(`Imported ${res.inserted} drugs (${res.skipped} skipped)`);
      void load(1, search);
    } catch (err) {
      setImportNote('Import failed: ' + getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="adp-root">
      <div className="adp-header">
        <div>
          <h1 className="adp-title">Drug Randomizer</h1>
          <p className="adp-sub">{total.toLocaleString()} drugs in database</p>
        </div>
        <div className="adp-header-actions">
          <label className={`adp-btn adp-btn--secondary${importing ? ' adp-btn--loading' : ''}`}>
            <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
            {importing ? 'Importing…' : 'Import XLSX/CSV'}
          </label>
          <button className="adp-btn adp-btn--primary" onClick={() => setModal({ mode: 'create' })}>
            + Add Drug
          </button>
        </div>
      </div>
      {importNote && (
        <p className="adp-import-note">{importNote}</p>
      )}

      {/* Feature settings panel */}
      <div className="adp-settings">
        <div className="adp-settings-row">
          <label className="adp-settings-label">Feature enabled</label>
          <button
            className={`adp-toggle ${settings.enabled ? 'adp-toggle--on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
            aria-pressed={settings.enabled}
          >
            <span className="adp-toggle-knob" />
          </button>
        </div>
        <div className="adp-settings-row">
          <label className="adp-settings-label">Free spin limit</label>
          <div className="adp-limit-control">
            <button onClick={() => setSettings(s => ({ ...s, freeLimit: Math.max(1, s.freeLimit - 1) }))}>−</button>
            <span>{settings.freeLimit}</span>
            <button onClick={() => setSettings(s => ({ ...s, freeLimit: Math.min(50, s.freeLimit + 1) }))}>+</button>
          </div>
        </div>
        <button className="adp-btn adp-btn--save" onClick={handleSaveSettings} disabled={savingSettings}>
          {savingSettings ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="adp-search-row">
        <input
          className="adp-search"
          type="search"
          placeholder="Search drugs…"
          value={search}
          onChange={handleSearch}
        />
      </div>

      {error && <p className="adp-error">{error}</p>}

      <div className="adp-table-wrap">
        <table className="adp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>SL Brands</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="adp-loading">Loading…</td></tr>
            )}
            {!loading && drugs.length === 0 && (
              <tr><td colSpan={5} className="adp-empty">No drugs found</td></tr>
            )}
            {drugs.map(d => (
              <tr key={d.id} className={d.is_active ? '' : 'adp-row--inactive'}>
                <td className="adp-name">{d.name}</td>
                <td className="adp-class">{d.drug_class || '—'}</td>
                <td className="adp-brands">{d.sl_brand_names || '—'}</td>
                <td>
                  <span className={`adp-status adp-status--${d.is_active ? 'active' : 'hidden'}`}>
                    {d.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="adp-actions">
                  <button className="adp-act" title="Edit" onClick={() => setModal({ mode: 'edit', drug: d })}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="adp-act" title={d.is_active ? 'Hide' : 'Show'} onClick={() => handleToggle(d.id)}>
                    {d.is_active ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                  <button className="adp-act adp-act--danger" title="Delete" onClick={() => handleDelete(d)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="adp-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {modal && (
        <DrugFormModal
          mode={modal.mode}
          drug={modal.drug}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); void load(); }}
        />
      )}
    </div>
  );
}
