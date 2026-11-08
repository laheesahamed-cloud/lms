import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminSubscriptionRequests,
  fetchAdminSubscriptions,
  fetchSubscriptionAdminMeta,
  fetchSubscriptionAudit,
  fetchSubscriptionCoupons,
} from '../../../../shared/api/subscriptions.api.js';
import { fetchAdminReports } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { formatPaymentStatus } from '../../../../shared/utils/paymentStatus.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../../../../shared/utils/userIdentity.js';

const emptyFilters = {
  search: '',
  startDate: '',
  endDate: '',
  paymentStatus: '',
  subscriptionStatus: '',
};

const PAYMENT_CURRENCY = 'LKR';

const financeUi = {
  layout: ui.managementLayout,
  panel: ui.panelCard,
  metric:
    'grid min-w-0 content-start gap-1 rounded-xl border border-line-soft bg-surface-1 px-4 py-3 shadow-none',
  summaryList: 'grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1',
  filterGrid:
    'grid items-end gap-3 min-[900px]:grid-cols-[minmax(170px,1.3fr)_repeat(4,minmax(120px,1fr))_auto] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1',
  searchShell: 'relative min-w-0',
  searchInput: cx(ui.input, 'pr-12'),
  clearSearch:
    'absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-ink-muted transition-[background,border-color,color,transform] duration-150 ease-out hover:border-line-soft hover:bg-surface-2 hover:text-ink-strong active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18',
  sectionStack: 'grid grid-cols-1 gap-4',
  list: 'grid gap-2.5',
  row:
    'flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-1 px-4 py-3 shadow-xs max-[640px]:grid',
  rowMain:
    'min-w-0 [&_strong]:block [&_strong]:text-[13.5px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:block [&_span]:text-xs [&_span]:text-ink-soft',
  rowStat:
    'shrink-0 text-right max-[640px]:text-left [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:block [&_span]:text-[11.5px] [&_span]:text-ink-soft',
  splitGrid:
    'grid grid-cols-1 gap-3',
  miniCard:
    'rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs',
};

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1.75h5.5L13 5.25v9H4a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M9.5 1.75v3.5H13" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M5.25 8.25h5.5M5.25 10.5h4M5.25 12.75h5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function hasNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

function normalizeCurrency() {
  return PAYMENT_CURRENCY;
}

function formatCurrency(currency, amount) {
  const code = normalizeCurrency(currency);
  const value = toNumber(amount);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function addCurrencyTotal(totals, currency, amount) {
  const code = normalizeCurrency(currency);
  totals[code] = toNumber(totals[code]) + toNumber(amount);
}

function formatCurrencyTotals(totals, maxItems = 2) {
  const entries = Object.entries(totals || {})
    .filter(([, value]) => Math.abs(toNumber(value)) > 0.004)
    .sort((a, b) => toNumber(b[1]) - toNumber(a[1]));

  if (!entries.length) {
    return formatCurrency(PAYMENT_CURRENCY, 0);
  }

  const visible = entries.slice(0, maxItems).map(([currency, amount]) => formatCurrency(currency, amount));
  if (entries.length > maxItems) {
    visible.push(`+${entries.length - maxItems} more`);
  }
  return visible.join(' / ');
}

function formatOptionalCurrency(currency, amount) {
  return hasNumber(amount) ? formatCurrency(currency || PAYMENT_CURRENCY, amount) : '-';
}

function formatGatewayAmount(row) {
  return formatCurrency(row?.currency || PAYMENT_CURRENCY, row?.amount || 0);
}

function isFreePlanSubscription(subscription) {
  const paymentStatus = String(subscription?.paymentStatus || '').trim().toLowerCase();
  const planName = String(subscription?.planName || '').trim().toLowerCase();
  return Boolean(subscription?.isFreePlan)
    || paymentStatus === 'free_plan'
    || paymentStatus === 'free'
    || paymentStatus === 'waived'
    || (planName === 'free' && toNumber(subscription?.planEffectivePrice) <= 0);
}

function isManualPayment(subscription) {
  return String(subscription?.paymentStatus || '').trim().toLowerCase() === 'manual';
}

function isPaidPayment(subscription) {
  return String(subscription?.paymentStatus || '').trim().toLowerCase() === 'paid';
}

function financePaymentAmount(subscription) {
  if (hasNumber(subscription?.amountPaid) && toNumber(subscription.amountPaid) > 0) {
    return toNumber(subscription.amountPaid);
  }
  if (isManualPayment(subscription) || isPaidPayment(subscription)) {
    return toNumber(subscription?.planEffectivePrice);
  }
  return 0;
}

function formatCouponDiscount(coupon) {
  const discount = coupon.discountType === 'percent'
    ? `${coupon.discountValue}%`
    : formatCurrency(PAYMENT_CURRENCY, coupon.discountValue || 0);
  return coupon.couponMode === 'package' ? `${discount} (package)` : discount;
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text.includes(' ') ? text.replace(' ', 'T') : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value) {
  const date = parseDate(value);
  if (!date) return '-';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function paymentRecordDate(record) {
  return record.paymentDate || record.resolvedAt || record.createdAt || record.requestedAt || record.startDate;
}

function isWithinRange(value, startDate, endDate) {
  const date = parseDate(value);
  if (!date) return !startDate && !endDate;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (date < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (date > end) return false;
  }
  return true;
}

function getSubscriptionDate(subscription) {
  return subscription.paymentDate || subscription.createdAt || subscription.updatedAt || subscription.startDate;
}

function matchesSearch(item, search, keys) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return keys.some((key) => String(item?.[key] || '').toLowerCase().includes(query));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFinanceReportHtml({ filters, summary, subscriptions, requests, planRows, paymentRows, couponRows, auditRows }) {
  const filterText = [
    filters.startDate ? `From ${filters.startDate}` : 'From beginning',
    filters.endDate ? `To ${filters.endDate}` : 'To today',
    filters.search ? `Search: ${filters.search}` : '',
    filters.paymentStatus ? `Payment: ${formatPaymentStatus(filters.paymentStatus)}` : '',
    filters.subscriptionStatus ? `Subscription: ${filters.subscriptionStatus}` : '',
  ].filter(Boolean).join(' | ');

  const renderRows = (rows, columns) => rows.map((row) => `
    <tr>
      ${columns.map((column) => `<td>${escapeHtml(column.render(row))}</td>`).join('')}
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>xyndrome Finance Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; font-family: var(--type-font-body, "Plus Jakarta Sans", Inter, Arial, sans-serif); color: #111827; background: #F8FAFC; }
    header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 26px 0 10px; font-size: 17px; }
    p { margin: 0; color: #4b5563; font-size: 12px; line-height: 1.5; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
    .metric { border: 1px solid #dbeafe; border-radius: 8px; padding: 12px; background: #f8fbff; }
    .metric span { display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 5px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; font-size: 11px; }
    th { background: #eff6ff; color: #1e3a8a; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
    .muted { color: #64748b; }
    @media print {
      body { padding: 18px; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      header { break-after: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>xyndrome Finance Report</h1>
    <p>${escapeHtml(filterText)}</p>
    <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
  </header>
  <section class="metrics">
    <div class="metric"><span>Collected</span><strong>${escapeHtml(formatCurrencyTotals(summary.collectedTotals))}</strong></div>
    <div class="metric"><span>Manual Payments</span><strong>${escapeHtml(formatCurrencyTotals(summary.manualPaymentTotals))}</strong></div>
    <div class="metric"><span>Total Amount</span><strong>${escapeHtml(formatCurrencyTotals(summary.activeValueTotals))}</strong></div>
    <div class="metric"><span>Pending invoices</span><strong>${summary.pendingRequests}</strong></div>
  </section>
  <h2>Plan Revenue</h2>
  <table>
    <thead><tr><th>Plan</th><th>Subscriptions</th><th>Paid</th><th>Collected</th><th>Expected</th></tr></thead>
    <tbody>${renderRows(planRows, [
      { render: (row) => row.name },
      { render: (row) => row.total },
      { render: (row) => row.paid },
      { render: (row) => formatCurrencyTotals(row.collectedTotals) },
      { render: (row) => formatCurrencyTotals(row.expectedTotals) },
    ])}</tbody>
  </table>
  <h2>Recent Payments</h2>
  <table>
    <thead><tr><th>Student</th><th>Plan</th><th>Payment</th><th>Amount</th><th>Date</th></tr></thead>
    <tbody>${renderRows(subscriptions.slice(0, 24), [
      { render: (row) => getAdminUserIdentifier(row, 'Student') },
      { render: (row) => row.planName || '-' },
      { render: (row) => formatPaymentStatus(row.paymentStatus) },
      { render: (row) => formatOptionalCurrency(row.planCurrency, row.amountPaid) },
      { render: (row) => row.paymentDate || row.createdAt || row.startDate || '-' },
    ])}</tbody>
  </table>
  <h2>Pending Invoices</h2>
  <table>
    <thead><tr><th>Invoice</th><th>Student</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${renderRows(requests.slice(0, 24), [
      { render: (row) => row.invoiceId ? `#${row.invoiceId}` : '-' },
      { render: (row) => getAdminUserIdentifier(row, 'Student') },
      { render: (row) => row.planName || '-' },
      { render: (row) => formatCurrency(row.paymentCurrency || row.planCurrency || PAYMENT_CURRENCY, row.paymentAmount ?? row.planEffectivePrice ?? 0) },
      { render: (row) => row.status || '-' },
    ])}</tbody>
  </table>
  <h2>Gateway Payment Status</h2>
  <table>
    <thead><tr><th>Status</th><th>Count</th><th>Amount</th></tr></thead>
    <tbody>${renderRows(paymentRows, [
      { render: (row) => row.status },
      { render: (row) => row.count },
      { render: (row) => formatGatewayAmount(row) },
    ])}</tbody>
  </table>
  <h2>Coupons</h2>
  <table>
    <thead><tr><th>Code</th><th>Status</th><th>Discount</th><th>Redemptions</th></tr></thead>
    <tbody>${renderRows(couponRows.slice(0, 20), [
      { render: (row) => row.code },
      { render: (row) => row.status },
      { render: (row) => formatCouponDiscount(row) },
      { render: (row) => `${row.redemptionCount}${row.maxRedemptions ? ` / ${row.maxRedemptions}` : ''}` },
    ])}</tbody>
  </table>
  <h2>Recent Finance Activity</h2>
  <table>
    <thead><tr><th>When</th><th>Student</th><th>Activity</th><th>Actor</th></tr></thead>
    <tbody>${renderRows(auditRows.slice(0, 24), [
      { render: (row) => row.createdAt || '-' },
      { render: (row) => getAdminUserIdentifier({ fullName: row.studentName, email: row.studentEmail }, 'System') },
      { render: (row) => row.summary || row.eventType || '-' },
      { render: (row) => getAdminUserIdentifier({ fullName: row.actorName, email: row.actorEmail }, 'System') },
    ])}</tbody>
  </table>
</body>
</html>`;
}

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0891b2', '#64748b'];

function ChartCard({ title, text, children }) {
  return (
    <article className={financeUi.panel}>
      <PanelHeader title={title} text={text} />
      {children}
    </article>
  );
}

function formatCompact(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function RevenueBars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className={ui.emptyBox}>No revenue in the last 6 months.</div>;
  return (
    <div className="flex h-[200px] items-end gap-3 pt-6" role="img" aria-label="Revenue by month">
      {data.map((d) => (
        <div key={d.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5 text-center">
          <span className="text-[11px] font-bold text-ink-soft tabular-nums">{d.value ? formatCompact(d.value) : ''}</span>
          <div className="rounded-t-md bg-brand-primary" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%`, minHeight: d.value ? 4 : 0 }} title={formatCurrency(PAYMENT_CURRENCY, d.value)} />
          <span className="text-[12px] font-bold text-ink-soft">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ rows, emptyText }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <div className={ui.emptyBox}>{emptyText}</div>;
  return (
    <div className="grid gap-3">
      {rows.map((row, i) => (
        <div key={row.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <strong className="min-w-0 truncate text-ink-strong">{row.label}</strong>
            <span className="whitespace-nowrap font-bold tabular-nums text-ink-soft">{row.display || formatCurrency(PAYMENT_CURRENCY, row.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ rows }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (!total) return <div className={ui.emptyBox}>No payment records match these filters.</div>;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0 -rotate-90" role="img" aria-label="Payment status split">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--line-soft, #e5e7eb)" strokeWidth="18" />
        {rows.map((row, i) => {
          const length = (row.value / total) * circumference;
          const circle = (
            <circle key={row.label} cx="70" cy="70" r={radius} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="18" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <ul className="m-0 grid min-w-0 flex-1 list-none gap-2 p-0">
        {rows.map((row, i) => (
          <li key={row.label} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-strong">{row.label}</span>
            <strong className="tabular-nums text-ink-soft">{row.value} <span className="font-semibold">({Math.round((row.value / total) * 100)}%)</span></strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <article className={financeUi.metric} title={hint}>
      <strong className="block whitespace-nowrap text-left text-[22px] max-[560px]:text-[18px] font-extrabold leading-tight text-ink-strong tabular-nums max-[560px]:whitespace-normal">{value}</strong>
      <span className={ui.eyebrow}>{label}</span>
      {hint ? <p className="m-0 truncate text-[12px] leading-snug text-ink-soft">{hint}</p> : null}
    </article>
  );
}

function PanelHeader({ title, text, actions = null }) {
  return (
    <div className={ui.panelTop}>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {actions}
    </div>
  );
}

export function AdminFinancePage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [reports, setReports] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    loadFinanceData();
  }, []);

  async function loadFinanceData() {
    setLoading(true);
    setError('');
    try {
      const [subscriptionRows, requestRows, couponRows, auditRows, metaData, reportData] = await Promise.all([
        fetchAdminSubscriptions(),
        fetchAdminSubscriptionRequests(),
        fetchSubscriptionCoupons(),
        fetchSubscriptionAudit(),
        fetchSubscriptionAdminMeta(),
        fetchAdminReports({}),
      ]);
      setSubscriptions(safeArray(subscriptionRows));
      setRequests(safeArray(requestRows));
      setCoupons(safeArray(couponRows));
      setAuditEvents(safeArray(auditRows));
      setPlans(safeArray(metaData?.plans));
      setReports(reportData || null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load finance data'));
    } finally {
      setLoading(false);
    }
  }

  const filteredSubscriptions = useMemo(() => {
    return safeArray(subscriptions).filter((subscription) => {
      if (filters.paymentStatus && subscription.paymentStatus !== filters.paymentStatus) return false;
      if (filters.subscriptionStatus && String(subscription.computedStatus || subscription.status) !== filters.subscriptionStatus) return false;
      if (!isWithinRange(getSubscriptionDate(subscription), filters.startDate, filters.endDate)) return false;
      return matchesSearch(subscription, filters.search, [
        'studentName',
        'studentEmail',
        'planName',
        'paymentMethod',
        'paymentReference',
      ]);
    });
  }, [filters, subscriptions]);

  const filteredRequests = useMemo(() => {
    return safeArray(requests).filter((request) => {
      if (!isWithinRange(request.requestedAt, filters.startDate, filters.endDate)) return false;
      return matchesSearch(request, filters.search, [
        'studentName',
        'studentEmail',
        'planName',
        'invoiceId',
        'paymentReference',
      ]);
    });
  }, [filters, requests]);

  const filteredAuditEvents = useMemo(() => {
    return safeArray(auditEvents).filter((event) => {
      if (!isWithinRange(event.createdAt, filters.startDate, filters.endDate)) return false;
      return matchesSearch(event, filters.search, [
        'studentName',
        'studentEmail',
        'actorName',
        'actorEmail',
        'summary',
        'eventType',
      ]);
    });
  }, [auditEvents, filters]);

  const summary = useMemo(() => {
    const collectedTotals = {};
    const manualPaymentTotals = {};
    const activeValueTotals = {};
    let paidSubscriptions = 0;
    let manualSubscriptions = 0;
    let activePaidSubscriptions = 0;
    let expiringSoon = 0;

    filteredSubscriptions.forEach((subscription) => {
      const currency = subscription.planCurrency || PAYMENT_CURRENCY;
      const expected = toNumber(subscription.planEffectivePrice);
      const amountPaid = financePaymentAmount(subscription);
      const status = subscription.computedStatus || subscription.status;

      if (amountPaid > 0 && !isManualPayment(subscription)) {
        paidSubscriptions += 1;
        addCurrencyTotal(collectedTotals, currency, amountPaid);
      }

      if (isManualPayment(subscription)) {
        manualSubscriptions += 1;
        addCurrencyTotal(manualPaymentTotals, currency, amountPaid || expected);
      }

      if (status === 'active') {
        addCurrencyTotal(activeValueTotals, currency, expected);
        if (!isFreePlanSubscription(subscription)) {
          activePaidSubscriptions += 1;
        }
      }

      if (subscription.isExpiringSoon) {
        expiringSoon += 1;
      }
    });

    const pendingRequests = filteredRequests.filter((request) => request.status === 'pending');
    const pendingRequestTotals = {};
    pendingRequests.forEach((request) => {
      addCurrencyTotal(
        pendingRequestTotals,
        request.paymentCurrency || request.planCurrency || PAYMENT_CURRENCY,
        request.paymentAmount ?? request.planEffectivePrice ?? 0
      );
    });

    return {
      collectedTotals,
      manualPaymentTotals,
      activeValueTotals,
      pendingRequestTotals,
      paidSubscriptions,
      manualSubscriptions,
      activePaidSubscriptions,
      pendingRequests: pendingRequests.length,
      expiringSoon,
    };
  }, [filteredRequests, filteredSubscriptions]);

  const paymentBreakdown = useMemo(() => {
    const statuses = new Map();
    filteredSubscriptions.forEach((subscription) => {
      const key = subscription.paymentStatus || 'unknown';
      const current = statuses.get(key) || { status: key, count: 0, totals: {} };
      current.count += 1;
      addCurrencyTotal(current.totals, subscription.planCurrency || PAYMENT_CURRENCY, financePaymentAmount(subscription));
      statuses.set(key, current);
    });
    return Array.from(statuses.values()).sort((a, b) => b.count - a.count);
  }, [filteredSubscriptions]);

  const planRows = useMemo(() => {
    const rows = safeArray(plans).map((plan) => {
      const planSubscriptions = filteredSubscriptions.filter((subscription) => String(subscription.planId) === String(plan.id));
      const collectedTotals = {};
      const expectedTotals = {};
      let paid = 0;
      let active = 0;
      planSubscriptions.forEach((subscription) => {
        const expected = toNumber(subscription.planEffectivePrice || plan.effectivePrice);
        const amountPaid = financePaymentAmount(subscription);
        if (amountPaid > 0) {
          paid += 1;
          addCurrencyTotal(collectedTotals, subscription.planCurrency || plan.currency || PAYMENT_CURRENCY, amountPaid);
        }
        if ((subscription.computedStatus || subscription.status) === 'active') active += 1;
        addCurrencyTotal(expectedTotals, subscription.planCurrency || plan.currency || PAYMENT_CURRENCY, expected);
      });

      return {
        id: plan.id,
        name: plan.name,
        total: planSubscriptions.length,
        active,
        paid,
        collectedTotals,
        expectedTotals,
      };
    });

    return rows
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
  }, [filteredSubscriptions, plans]);

  const recentPaymentRecords = useMemo(() => {
    const approvedBankTransferRequests = filteredRequests
      .filter((request) => request.status === 'approved')
      .filter((request) => request.paymentProofDataUrl || request.paymentMethod || toNumber(request.paymentAmount) > 0)
      .map((request) => ({
        ...request,
        id: request.subscriptionId || request.id,
        recordKey: `request-${request.id}`,
        paymentStatus: 'bank_transfer',
        amountPaid: request.paymentAmount ?? request.planEffectivePrice ?? 0,
        planCurrency: request.paymentCurrency || request.planCurrency || PAYMENT_CURRENCY,
        paymentMethod: 'Bank Transfer',
        paymentReference: request.paymentReference || (request.invoiceId ? `Invoice #${request.invoiceId}` : ''),
        paymentDate: request.resolvedAt || request.requestedAt,
      }));
    const bankTransferSubscriptionIds = new Set(
      approvedBankTransferRequests
        .map((request) => Number(request.subscriptionId))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const subscriptionRecords = [...filteredSubscriptions]
      .filter((subscription) => isPaidPayment(subscription) || isManualPayment(subscription) || toNumber(subscription.amountPaid) > 0)
      .filter((subscription) => !bankTransferSubscriptionIds.has(Number(subscription.id)))
      .map((subscription) => ({
        ...subscription,
        recordKey: `subscription-${subscription.id}`,
        amountPaid: financePaymentAmount(subscription),
        paymentMethod: subscription.paymentMethod || (isManualPayment(subscription) ? 'Manual assignment' : subscription.paymentMethod),
      }));

    return [...subscriptionRecords, ...approvedBankTransferRequests]
      .sort((a, b) => (parseDate(paymentRecordDate(b))?.getTime() || 0) - (parseDate(paymentRecordDate(a))?.getTime() || 0))
      .slice(0, 12);
  }, [filteredRequests, filteredSubscriptions]);

  const pendingInvoices = useMemo(() => {
    return [...filteredRequests]
      .filter((request) => request.status === 'pending')
      .sort((a, b) => (parseDate(b.requestedAt)?.getTime() || 0) - (parseDate(a.requestedAt)?.getTime() || 0))
      .slice(0, 10);
  }, [filteredRequests]);

  const reportPayments = useMemo(
    () => safeArray(reports?.subscriptions?.payments),
    [reports]
  );
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: 'short' }), value: 0 });
    }
    const index = new Map(months.map((m) => [m.key, m]));
    filteredSubscriptions.forEach((subscription) => {
      const amount = financePaymentAmount(subscription);
      if (amount <= 0) return;
      const date = parseDate(paymentRecordDate(subscription));
      if (!date) return;
      const bucket = index.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (bucket) bucket.value += amount;
    });
    filteredRequests.forEach((request) => {
      if (request.status !== 'approved' || request.subscriptionId) return;
      const amount = toNumber(request.paymentAmount ?? request.planEffectivePrice);
      const date = parseDate(request.resolvedAt || request.requestedAt);
      const bucket = date ? index.get(`${date.getFullYear()}-${date.getMonth()}`) : null;
      if (bucket) bucket.value += amount;
    });
    return months;
  }, [filteredRequests, filteredSubscriptions]);

  const planChartRows = useMemo(
    () => planRows
      .map((row) => ({ label: row.name, value: Object.values(row.collectedTotals).reduce((sum, v) => sum + v, 0), sub: `${row.paid} paid / ${row.total}` }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    [planRows]
  );

  const statusChartRows = useMemo(
    () => paymentBreakdown.map((item) => ({ label: formatPaymentStatus(item.status), value: item.count })),
    [paymentBreakdown]
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleResetFilters() {
    setFilters(emptyFilters);
  }

  function handleCreatePdf() {
    const reportWindow = window.open('', '_blank', 'width=980,height=720');
    if (!reportWindow) {
      setNotice('Allow pop-ups to create the finance PDF report.');
      return;
    }

    const html = buildFinanceReportHtml({
      filters,
      summary,
      subscriptions: recentPaymentRecords,
      requests: pendingInvoices,
      planRows,
      paymentRows: reportPayments,
      couponRows: safeArray(coupons),
      auditRows: filteredAuditEvents,
    });
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 350);
  }

  return (
    <main className={ui.screenShell}>
      <section className={financeUi.layout}>
        <AppHeader
          title="Finance"
          subtitle="Payments, invoices, coupons and LKR finance reports"
        />

        <section className={cx(financeUi.panel, '!p-4')}>
          <div className={financeUi.filterGrid}>
            <div className={ui.formLabel}>
              <label htmlFor="finance-filter-search">Search</label>
              <div className={financeUi.searchShell}>
                <input
                  id="finance-filter-search"
                  className={financeUi.searchInput}
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Student, email, invoice..."
                />
                {hasActiveFilters ? (
                  <button type="button" className={financeUi.clearSearch} onClick={handleResetFilters} aria-label="Reset finance filters">
                    <XIcon />
                  </button>
                ) : null}
              </div>
            </div>
            <label className={ui.formLabel}>
              Start date
              <input className={ui.input} type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
            </label>
            <label className={ui.formLabel}>
              End date
              <input className={ui.input} type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
            </label>
            <label className={ui.formLabel}>
              Payment
              <select className={ui.input} name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}>
                <option value="">All payments</option>
                <option value="paid">Paid</option>
                <option value="manual">Manual</option>
                <option value="unpaid">Unpaid</option>
                <option value="free_plan">Free Plan</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Subscription
              <select className={ui.input} name="subscriptionStatus" value={filters.subscriptionStatus} onChange={handleFilterChange}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <button type="button" className={cx(ui.primaryAction, '!min-h-[var(--control-h)] whitespace-nowrap !px-4 max-[900px]:col-span-2 max-[560px]:col-span-1')} onClick={handleCreatePdf} disabled={loading}>
              <PdfIcon /> Create PDF
            </button>
          </div>
        </section>

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {notice ? <div className={ui.emptyBox}>{notice}</div> : null}

        <section className={financeUi.summaryList}>
          <Metric label="Collected" value={formatCurrencyTotals(summary.collectedTotals)} hint={`${summary.paidSubscriptions} payment record(s)`} />
          <Metric label="Manual Payments" value={formatCurrencyTotals(summary.manualPaymentTotals)} hint={`${summary.manualSubscriptions} assigned manual record(s)`} />
          <Metric label="Total Amount" value={formatCurrencyTotals(summary.activeValueTotals)} hint={`${summary.activePaidSubscriptions} active subscription(s)`} />
          <Metric label="Pending Invoices" value={summary.pendingRequests} hint={formatCurrencyTotals(summary.pendingRequestTotals)} />
        </section>

        {loading ? <div className={ui.emptyBox}>Loading finance records...</div> : null}

        <section className="grid gap-4">
          <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ChartCard title="Revenue" text="Collected per month, last 6 months.">
              <RevenueBars data={monthlyRevenue} />
            </ChartCard>
            <ChartCard title="Payment status" text="Share of subscription payment records.">
              <Donut rows={statusChartRows} />
            </ChartCard>
          </div>

          <div className="grid gap-4 min-[1100px]:grid-cols-2">
            <ChartCard title="Revenue by plan" text="Collected value per plan.">
              <HorizontalBars rows={planChartRows} emptyText="No plan revenue for the current filters." />
            </ChartCard>
            <ChartCard title="Gateway totals" text="Payment transaction totals from reports.">
              <HorizontalBars
                emptyText="No gateway transaction data yet."
                rows={reportPayments.map((item) => ({ label: `${item.status} (${item.count})`, value: toNumber(item.amount ?? item.count), display: formatGatewayAmount(item) }))}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 min-[1100px]:grid-cols-2">
            <article className={financeUi.panel}>
            <PanelHeader title="Needs Review" text="Pending invoices and proof uploads." />
            <div className={financeUi.list}>
              {pendingInvoices.length === 0 ? <div className={ui.emptyBox}>No pending invoices or proof uploads.</div> : null}
              {pendingInvoices.slice(0, 6).map((request) => (
                <div className={financeUi.row} key={request.id}>
                  <div className={financeUi.rowMain}>
                    <strong>{request.invoiceId ? `Invoice #${request.invoiceId}` : `Request #${request.id}`}</strong>
                    <span>{getAdminUserIdentifier(request, 'Student')} - {request.planName || 'Subscription'}</span>
                    <span>{request.couponCode ? `Coupon ${request.couponCode} applied` : request.paymentProofDataUrl ? 'Payment proof uploaded' : request.paymentReference || 'Awaiting finance details'}</span>
                  </div>
                  <div className={financeUi.rowStat}>
                    <strong>{formatCurrency(request.paymentCurrency || request.planCurrency || PAYMENT_CURRENCY, request.paymentAmount ?? request.planEffectivePrice ?? 0)}</strong>
                    <span className={statusPill(request.status)}>{request.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
            <article className={financeUi.panel}>
            <PanelHeader title="Recent Payments" text="Approved card, bank transfer, and manual records." />
            <div className={financeUi.list}>
              {recentPaymentRecords.length === 0 ? <div className={ui.emptyBox}>No approved payments match these filters.</div> : null}
              {recentPaymentRecords.slice(0, 6).map((subscription) => (
                <div className={financeUi.row} key={subscription.recordKey || subscription.id}>
                  <div className={financeUi.rowMain}>
                    <strong>{getAdminUserIdentifier(subscription, 'Student')}</strong>
                    <span>{subscription.planName || 'Subscription'} - {subscription.paymentMethod || formatPaymentStatus(subscription.paymentStatus, 'Payment')}</span>
                    <span>{subscription.paymentReference || getAdminUserSecondaryIdentifier(subscription) || 'No reference'}</span>
                  </div>
                  <div className={financeUi.rowStat}>
                    <strong>{formatOptionalCurrency(subscription.planCurrency, subscription.amountPaid)}</strong>
                    <span className={statusPill(subscription.paymentStatus)}>{formatPaymentStatus(subscription.paymentStatus, 'Payment')}</span>
                    <span>{dateOnly(paymentRecordDate(subscription))}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
          </div>
        </section>
      </section>
    </main>
  );
}
