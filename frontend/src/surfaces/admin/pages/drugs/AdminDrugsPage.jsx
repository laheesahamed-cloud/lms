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
                  <button className="adp-act" onClick={() => setModal({ mode: 'edit', drug: d })}>Edit</button>
                  <button className="adp-act" onClick={() => handleToggle(d.id)}>
                    {d.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button className="adp-act adp-act--danger" onClick={() => handleDelete(d)}>Delete</button>
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
