import { useEffect, useMemo, useState } from 'react';
import { fetchSetupStatus } from '../../../api/setup.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const setupUi = {
  statusGrid: 'grid grid-cols-[1.15fr_0.85fr] gap-4 max-[980px]:grid-cols-1',
  hero: 'grid gap-4 rounded-xl border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_7%,var(--surface-card)),var(--surface-card))] p-5 shadow-sm',
  heroTop: 'flex flex-wrap items-start justify-between gap-3',
  statusPill: 'inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-extrabold',
  statusPillOk: 'border-brand-success/24 bg-[var(--color-success-light)] text-brand-success',
  statusPillWarning: 'border-brand-warning/28 bg-[var(--color-warning-light)] text-brand-warning',
  statusPillError: 'border-brand-error/28 bg-[var(--color-error-light)] text-brand-error',
  heroTitle: 'm-0 text-[24px] font-black leading-tight text-ink-strong max-[520px]:text-[20px]',
  heroText: 'm-0 max-w-[760px] text-sm leading-relaxed text-ink-soft',
  summaryGrid: 'grid grid-cols-2 gap-3 max-[720px]:grid-cols-1',
  summaryCell: 'rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs',
  summaryLabel: 'block text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-soft',
  summaryValue: 'mt-1 block break-words text-[15px] font-extrabold text-ink-strong',
  sectionGrid: 'grid grid-cols-2 gap-4 max-[980px]:grid-cols-1',
  card: 'rounded-xl border border-line-soft bg-surface-1 p-4 shadow-xs',
  cardHead: 'mb-3 flex flex-wrap items-start justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[16px] [&_h2]:font-extrabold [&_h2]:text-ink-strong [&_p]:m-0 [&_p]:mt-1 [&_p]:text-[12.5px] [&_p]:leading-relaxed [&_p]:text-ink-soft',
  detailList: 'grid gap-2',
  detailRow: 'grid grid-cols-[150px_minmax(0,1fr)] gap-3 rounded-lg border border-line-soft bg-surface-card px-3 py-2.5 text-[13px] max-[560px]:grid-cols-1 max-[560px]:gap-1',
  detailLabel: 'font-bold text-ink-soft',
  detailValue: 'break-words font-semibold text-ink-strong',
  tableGrid: 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2.5',
  tableItem: 'rounded-lg border border-line-soft bg-surface-card p-3',
  tableMissing: 'border-brand-warning/28 bg-[var(--color-warning-light)]',
  tableName: 'block text-[13px] font-extrabold text-ink-strong',
  tableMeta: 'mt-1 block text-[12px] font-semibold text-ink-soft',
  configItem: 'grid gap-1 rounded-lg border border-line-soft bg-surface-card p-3',
  configTop: 'flex items-center justify-between gap-3',
  configLabel: 'text-[13px] font-extrabold text-ink-strong',
  configValue: 'text-[12px] font-bold text-ink-soft',
  configDetail: 'm-0 text-[12.5px] leading-relaxed text-ink-soft',
};

function statusLabel(status) {
  if (status === 'ok') return 'Ready';
  if (status === 'error') return 'Needs attention';
  return 'Review';
}

function statusClass(status) {
  if (status === 'ok') return setupUi.statusPillOk;
  if (status === 'error') return setupUi.statusPillError;
  return setupUi.statusPillWarning;
}

function StatusPill({ status }) {
  return (
    <span className={cx(setupUi.statusPill, statusClass(status))}>
      {statusLabel(status)}
    </span>
  );
}

function DetailRows({ rows }) {
  return (
    <div className={setupUi.detailList}>
      {rows.map((row) => (
        <div key={row.label} className={setupUi.detailRow}>
          <span className={setupUi.detailLabel}>{row.label}</span>
          <span className={setupUi.detailValue}>{row.value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

function SetupCard({ title, description, status, children }) {
  return (
    <section className={setupUi.card}>
      <div className={setupUi.cardHead}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusPill status={status} />
      </div>
      {children}
    </section>
  );
}

export function AdminSetupPage() {
  const [setup, setSetup] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });

  useEffect(() => {
    loadSetupStatus();
  }, []);

  async function loadSetupStatus() {
    setStatus({ loading: true, error: '' });
    try {
      const data = await fetchSetupStatus();
      setSetup(data);
      setStatus({ loading: false, error: '' });
    } catch (error) {
      setStatus({ loading: false, error: getErrorMessage(error, 'Unable to load setup status') });
    }
  }

  const summary = useMemo(() => {
    const tables = setup?.database?.tables || [];
    const missingTables = tables.filter((table) => !table.present).length;
    return [
      { label: 'Database', value: setup?.database?.connected ? 'Connected' : 'Offline' },
      { label: 'Required tables', value: tables.length ? `${tables.length - missingTables}/${tables.length} present` : '-' },
    ];
  }, [setup]);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Admin Setup"
          subtitle="Check LMS readiness without exposing database credentials, server paths, or private configuration values."
        />

        {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}

        {status.loading ? (
          <div className={ui.emptyBox}>Checking LMS setup...</div>
        ) : setup ? (
          <>
            <section className={setupUi.hero}>
              <div className={setupUi.heroTop}>
                <div>
                  <span className={ui.eyebrow}>System readiness</span>
                  <h1 className={setupUi.heroTitle}>LMS setup is {statusLabel(setup.overall).toLowerCase()}</h1>
                </div>
                <StatusPill status={setup.overall} />
              </div>
              <p className={setupUi.heroText}>
                Last checked {setup.generatedAt ? new Date(setup.generatedAt).toLocaleString() : 'just now'}. Use this page before handover or major configuration changes.
              </p>
              <div className={setupUi.summaryGrid}>
                {summary.map((item) => (
                  <div key={item.label} className={setupUi.summaryCell}>
                    <span className={setupUi.summaryLabel}>{item.label}</span>
                    <span className={setupUi.summaryValue}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <button type="button" className={ui.secondaryAction} onClick={loadSetupStatus}>
                  Refresh status
                </button>
              </div>
            </section>

            <SetupCard
              title="Database"
              description={setup.database?.message || 'Database status unavailable.'}
              status={setup.database?.status || 'warning'}
            >
              <DetailRows
                rows={[
                  { label: 'Connection', value: setup.database?.connected ? 'Connected' : 'Offline' },
                  { label: 'Table checks', value: summary.find((item) => item.label === 'Required tables')?.value },
                ]}
              />
            </SetupCard>

            <SetupCard
              title="Required tables"
              description="Core LMS tables expected by the admin, student, subscription, and AI flows."
              status={setup.database?.tables?.some((table) => !table.present) ? 'warning' : 'ok'}
            >
              <div className={setupUi.tableGrid}>
                {(setup.database?.tables || []).map((table) => (
                  <div key={table.name} className={cx(setupUi.tableItem, !table.present && setupUi.tableMissing)}>
                    <span className={setupUi.tableName}>{table.label}</span>
                    <span className={setupUi.tableMeta}>
                      {table.present ? `${table.count ?? '-'} row${table.count === 1 ? '' : 's'}` : 'Missing table'}
                    </span>
                  </div>
                ))}
              </div>
            </SetupCard>

            <section className={setupUi.sectionGrid}>
              <SetupCard
                title="Configuration"
                description="Safe checks for payment, email, and AI readiness. Secrets are never shown here."
                status={setup.database?.configuration?.some((item) => item.status === 'warning') ? 'warning' : 'ok'}
              >
                <div className="grid gap-2.5">
                  {(setup.database?.configuration || []).map((item) => (
                    <div key={item.key} className={setupUi.configItem}>
                      <div className={setupUi.configTop}>
                        <span className={setupUi.configLabel}>{item.label}</span>
                        <StatusPill status={item.status} />
                      </div>
                      <span className={setupUi.configValue}>{item.value}</span>
                      <p className={setupUi.configDetail}>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </SetupCard>

              <div className="grid gap-4">
              <SetupCard
                title="Uploads"
                description={setup.storage?.message || 'Upload folder status unavailable.'}
                status={setup.storage?.status || 'warning'}
              >
                  <DetailRows rows={[{ label: 'Storage', value: setup.storage?.status === 'ok' ? 'Writable' : 'Needs attention' }]} />
                </SetupCard>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
