import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminListDrugs, adminDeleteDrug, adminToggleDrug,
  adminGetDrugSettings, adminUpdateDrugSettings, adminImportDrugs,
  adminGetDrug, adminUpdateDrug, adminAiLookupDrug,
} from '../../../../shared/api/drugs.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { DrugFormModal } from './DrugFormModal.jsx';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { retryOnRateLimit } from '../../../../shared/utils/retryOnRateLimit.js';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';

const FILL_FIELDS = ['name', 'drug_class', 'uses', 'dosage_adult', 'dosage_pediatric', 'side_effects', 'warnings', 'drug_interactions', 'pregnancy_info', 'sl_brand_names'];

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
  const [selected, setSelected]     = useState(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [overwrite, setOverwrite]   = useState(false);
  const [run, setRun]               = useState(null); // { names: [], index, done, failed, current, waiting, finished, stopped }
  const stopRef = useRef(false);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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


  const pageIds = drugs.map((d) => d.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function selectEverything() {
    setSelectingAll(true);
    try {
      const res = await adminListDrugs(1, 10000, search);
      setSelected(new Set(res.drugs.map((d) => d.id)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSelectingAll(false);
    }
  }

  async function handleAiFillSelected() {
    const ids = Array.from(selected);
    if (!ids.length || run) return;
    const mode = overwrite ? 'replace' : 'only fill the empty fields of';
    if (!confirm(`Run AI on ${ids.length} drug(s) one by one and ${mode} each drug? This uses AI credits and saves straight to the database.`)) return;

    stopRef.current = false;
    let done = 0;
    let failed = 0;
    setRun({ total: ids.length, index: 0, done, failed, current: '', waiting: 0, finished: false, stopped: false });

    for (let i = 0; i < ids.length; i += 1) {
      if (stopRef.current) break;
      let name = `#${ids[i]}`;
      try {
        const current = await adminGetDrug(ids[i]);
        name = current.name || name;
        setRun((r) => ({ ...r, index: i, current: name, waiting: 0 }));
        const res = await retryOnRateLimit(() => adminAiLookupDrug(name), {
          onWait: (seconds) => setRun((r) => ({ ...r, waiting: seconds })),
        });
        const merged = { ...current };
        Object.entries(res.drug).forEach(([key, value]) => {
          if (key === 'name' || value == null || value === '') return;
          if (overwrite || !String(current[key] ?? '').trim()) merged[key] = value;
        });
        FILL_FIELDS.forEach((key) => { merged[key] = merged[key] ?? ''; });
        await retryOnRateLimit(() => adminUpdateDrug(ids[i], merged));
        done += 1;
      } catch {
        failed += 1;
      }
      setRun((r) => ({ ...r, index: i + 1, done, failed, waiting: 0 }));
    }

    setRun((r) => ({ ...r, current: '', finished: true, stopped: stopRef.current }));
    setSelected(new Set());
    void load();
  }

  const totalPages = Math.ceil(total / LIMIT);
  const eyeIcon = (hidden) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {hidden ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
  const iconBtn = cx(ui.iconButton, '!size-8 !min-h-0 !min-w-0');

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title="Drug Randomizer" subtitle={`${total.toLocaleString()} drugs in database`} />

        <section className={cx(ui.panelCard, '!p-4')}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold text-ink-strong">Feature enabled</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                aria-label="Feature enabled"
                onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
                className={cx(
                  'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150',
                  settings.enabled ? 'border-brand-primary/40 !bg-brand-primary' : 'border-line-soft !bg-surface-3',
                )}
              >
                <span className={cx('inline-block size-5 rounded-full bg-white shadow transition-transform duration-150', settings.enabled ? 'translate-x-[23px]' : 'translate-x-[3px]')} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold text-ink-strong">Free spin limit</span>
              <div className="inline-flex items-center gap-1 rounded-xl border border-line-soft bg-surface-2 p-1">
                <button type="button" className={cx(ui.iconButton, '!size-8 !min-h-0 !min-w-0 text-lg')} aria-label="Decrease" onClick={() => setSettings((s) => ({ ...s, freeLimit: Math.max(1, s.freeLimit - 1) }))}>−</button>
                <span className="min-w-8 text-center text-[15px] font-extrabold tabular-nums text-ink-strong">{settings.freeLimit}</span>
                <button type="button" className={cx(ui.iconButton, '!size-8 !min-h-0 !min-w-0 text-lg')} aria-label="Increase" onClick={() => setSettings((s) => ({ ...s, freeLimit: Math.min(50, s.freeLimit + 1) }))}>+</button>
              </div>
            </div>

            <button type="button" className={cx(ui.primaryAction, '!min-h-9 !px-4')} onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </section>

        <section className={cx(ui.panelCard, '!p-4')}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className={cx(ui.input, 'min-w-[220px] flex-1')}
              type="search"
              placeholder="Search drugs…"
              value={search}
              onChange={handleSearch}
            />
            <label className={cx(ui.secondaryAction, 'cursor-pointer whitespace-nowrap', importing && 'pointer-events-none opacity-60')}>
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} disabled={importing} />
              {importing ? 'Importing…' : 'Import XLSX/CSV'}
            </label>
            <button type="button" className={cx(ui.primaryAction, 'whitespace-nowrap')} onClick={() => setModal({ mode: 'create' })}>
              + Add drug
            </button>
          </div>
          {importNote ? <p className="m-0 mt-3 text-[13px] text-ink-soft">{importNote}</p> : null}
        </section>

        {selected.size > 0 && !run ? (
          <section className={cx(ui.panelCard, '!p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2')}>
            <strong className="text-[13px] text-ink-strong">{selected.size.toLocaleString()} selected</strong>
            {selected.size < total ? (
              <button type="button" className="text-[13px] font-bold text-brand-primary !bg-transparent" onClick={selectEverything} disabled={selectingAll}>
                {selectingAll ? 'Selecting…' : `Select all ${total.toLocaleString()}${search ? ' matching' : ''}`}
              </button>
            ) : null}
            <label className="ml-auto flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite existing text
            </label>
            <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} onClick={() => setSelected(new Set())}>Clear</button>
            <button type="button" className={cx(ui.primaryAction, '!min-h-9 !px-4')} onClick={handleAiFillSelected}>AI fill selected</button>
          </section>
        ) : null}

        {run ? (
          <section className={cx(ui.panelCard, '!p-4 grid gap-3')} aria-live="polite">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-[14px] text-ink-strong">
                {run.finished ? (run.stopped ? 'Stopped' : 'Finished') : run.current ? `Filling: ${run.current}` : 'Starting…'}
              </strong>
              <span className="text-[12.5px] font-bold tabular-nums text-ink-soft">
                {run.index} / {run.total} · {run.done} filled{run.failed ? ` · ${run.failed} failed` : ''}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand-primary transition-[width] duration-300" style={{ width: `${(run.index / run.total) * 100}%` }} />
            </div>
            {run.waiting ? <span className="text-[12.5px] text-ink-soft">Rate limited — retrying in {run.waiting}s…</span> : null}
            <div>
              {run.finished ? (
                <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} onClick={() => setRun(null)}>Done</button>
              ) : (
                <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} onClick={() => { stopRef.current = true; }}>Stop after this drug</button>
              )}
            </div>
          </section>
        ) : null}

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={ui.tableShell}>
          <table className={ui.modernTable} style={{ width: '100%', minWidth: 760 }}>
            <thead>
              <tr>
                <th className={cx(ui.tableHeadCell, 'w-10')}>
                  <input type="checkbox" aria-label="Select all on this page" checked={allPageSelected} ref={(el) => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }} onChange={togglePage} />
                </th>
                <th className={ui.tableHeadCell}>Name</th>
                <th className={ui.tableHeadCell}>Class</th>
                <th className={ui.tableHeadCell}>SL brands</th>
                <th className={ui.tableHeadCell}>Status</th>
                <th className={cx(ui.tableHeadCell, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={ui.tableCell}><div className={ui.tableEmpty}>Loading…</div></td></tr>
              ) : null}
              {!loading && drugs.length === 0 ? (
                <tr><td colSpan={6} className={ui.tableCell}><div className={ui.tableEmpty}>No drugs found</div></td></tr>
              ) : null}
              {drugs.map((d) => (
                <tr key={d.id} className={d.is_active ? '' : 'opacity-55'}>
                  <td className={cx(ui.tableCell, 'w-10')}>
                    <input type="checkbox" aria-label={`Select ${d.name}`} checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} />
                  </td>
                  <td className={cx(ui.tableCell, 'font-bold')}>{d.name}</td>
                  <td className={cx(ui.tableCell, 'truncate text-ink-soft')}>{d.drug_class || '—'}</td>
                  <td className={cx(ui.tableCell, 'truncate text-xs text-ink-soft')}>{d.sl_brand_names || '—'}</td>
                  <td className={ui.tableCell}>
                    <span className={statusPill(d.is_active ? 'active' : 'inactive')}>{d.is_active ? 'Active' : 'Hidden'}</span>
                  </td>
                  <td className={ui.tableCell}>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className={iconBtn} title="Edit" aria-label={`Edit ${d.name}`} onClick={() => setModal({ mode: 'edit', drug: d })}>
                        <EditActionIcon />
                      </button>
                      <button type="button" className={iconBtn} title={d.is_active ? 'Hide' : 'Show'} aria-label={`${d.is_active ? 'Hide' : 'Show'} ${d.name}`} onClick={() => handleToggle(d.id)}>
                        {eyeIcon(!d.is_active)}
                      </button>
                      <button type="button" className={cx(ui.dangerIconButton, '!size-8 !min-h-0 !min-w-0')} title="Delete" aria-label={`Delete ${d.name}`} onClick={() => handleDelete(d)}>
                        <DeleteActionIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
            <span className="text-[12.5px] font-bold text-ink-soft">Page {page} of {totalPages}</span>
            <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        ) : null}

        {modal ? (
          <DrugFormModal
            mode={modal.mode}
            drug={modal.drug}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); void load(); }}
          />
        ) : null}
      </section>
    </main>
  );
}
