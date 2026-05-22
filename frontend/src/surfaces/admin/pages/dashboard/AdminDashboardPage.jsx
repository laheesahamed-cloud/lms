import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminDashboard } from '../../../../shared/api/dashboard.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import {
  fetchAdminSubscriptionRequests,
  fetchAdminSubscriptions,
} from '../../../../shared/api/subscriptions.api.js';
import { fetchUsersSummary } from '../../../../shared/api/users.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { formatPaymentStatus } from '../../../../shared/utils/paymentStatus.js';
import { getAdminUserIdentifier } from '../../../../shared/utils/userIdentity.js';

const dashboardLayoutClass = 'gap-5';
const heroClass =
  'lms-dashboard-card grid gap-4 rounded-lg border border-line-soft bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary-light)_48%,transparent),transparent_50%),var(--surface-card)] p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end';
const heroRailClass = 'flex min-w-[300px] flex-wrap justify-end gap-2 max-[760px]:min-w-0 max-[760px]:justify-start';
const heroMiniStatClass =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-soft bg-surface-1 px-2.5 text-[11px] font-extrabold text-ink-medium';
const moneyGridClass = 'grid grid-cols-4 gap-4 max-[1120px]:grid-cols-2 max-[640px]:grid-cols-1';
const metricValueClass = 'mt-2 block break-words text-[clamp(22px,2.5vw,30px)] font-black leading-tight text-ink-strong';
const metricLabelClass = 'm-0 mt-2 text-[11.5px] font-bold leading-relaxed text-ink-soft';
const metricCardBase =
  'lms-dashboard-card min-w-0 rounded-xl border border-line-soft bg-surface-card p-4 shadow-xs';
const metricCardGreen =
  'border-emerald-600/18 bg-[linear-gradient(145deg,rgba(16,185,129,0.085),transparent_46%),var(--surface-card)]';
const metricCardBlue =
  'border-blue-600/18 bg-[linear-gradient(145deg,rgba(37,99,235,0.075),transparent_46%),var(--surface-card)]';
const metricCardAmber =
  'border-amber-600/22 bg-[linear-gradient(145deg,rgba(245,158,11,0.09),transparent_46%),var(--surface-card)]';
const metricCardViolet =
  'border-violet-600/16 bg-[linear-gradient(145deg,rgba(124,58,237,0.065),transparent_46%),var(--surface-card)]';
const panelGridClass = 'grid grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-5 max-[1080px]:grid-cols-1';
const queueListClass = 'grid gap-3';
const queueItemClass =
  'grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl border border-line-soft bg-surface-card p-4 shadow-xs max-[700px]:grid-cols-1';
const compactGridClass = 'grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1';
const compactTileClass = 'rounded-xl border border-line-soft bg-surface-card p-3.5 shadow-xs';
const sectionClass = 'grid gap-3';
const sectionHeadClass = 'flex flex-wrap items-end justify-between gap-3';
const dashboardButtonClass =
  'inline-flex h-10 min-w-0 items-center justify-center rounded-[16px] border-0 bg-[linear-gradient(135deg,#4aa3f4_0%,#5274f3_52%,#6d35df_100%)] px-4 text-[13px] font-extrabold text-white no-underline shadow-[0_14px_28px_-22px_rgba(82,116,243,0.7)] transition-[filter,transform,box-shadow] duration-150 hover:brightness-105 hover:saturate-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 disabled:opacity-50';
const dashboardButtonSoftClass =
  'inline-flex h-10 min-w-0 items-center justify-center rounded-[16px] border border-brand-primary/25 bg-[color-mix(in_srgb,var(--surface-2)_72%,transparent)] px-4 text-[13px] font-extrabold text-brand-primary no-underline shadow-none transition-[background,border-color,color,transform] duration-150 hover:border-brand-primary/40 hover:bg-brand-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25 disabled:opacity-50';

const emptyDashboard = {
  totalUsers: 0,
  totalCourses: 0,
  totalQuizzes: 0,
  totalQuestions: 0,
  totalLessons: 0,
};

const emptyUserSummary = {
  totalUsers: 0,
  pendingUsers: 0,
  activeUsers: 0,
  adminUsers: 0,
  studentUsers: 0,
};

function todayKey() {
  return localDateKey(new Date());
}

function dateKey(value) {
  if (!value) return '';
  const raw = String(value);
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return localDateKey(date);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function formatMoney(value, currency = 'LKR') {
  const normalizedCurrency = String(currency || 'LKR').toUpperCase();
  const amount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(numberValue(value));

  if (normalizedCurrency === 'LKR') {
    return `LKR ${amount}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatDate(value) {
  if (!value) return 'Today';
  const text = String(value).trim();
  const hasTime = /\d{1,2}:\d{2}/.test(text);
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(text)
    ? text.replace(/\s+/, 'T')
    : text;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(hasTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

function isCollectedSubscription(subscription) {
  const paymentStatus = String(subscription?.paymentStatus || '').toLowerCase();
  return ['paid', 'manual'].includes(paymentStatus) && numberValue(subscription?.amountPaid) > 0;
}

function subscriptionCollectionDate(subscription) {
  return subscription?.paymentDate || subscription?.updatedAt || subscription?.createdAt || subscription?.startDate;
}

function resolveCurrency(subscriptions, requests) {
  return (
    subscriptions.find((subscription) => subscription?.planCurrency)?.planCurrency ||
    requests.find((request) => request?.paymentCurrency || request?.planCurrency)?.paymentCurrency ||
    requests.find((request) => request?.planCurrency)?.planCurrency ||
    'LKR'
  );
}

function buildApprovalQueue({ pendingUsers, requests }) {
  const subscriptionItems = requests
    .filter((request) => request?.status === 'pending')
    .slice(0, 5)
    .map((request) => ({
      id: `request-${request.id}`,
      title: getAdminUserIdentifier(request, 'Student request'),
      subtitle: `${request.planName || 'Subscription'}${request.invoiceId ? ` · Invoice #${request.invoiceId}` : ''}`,
      amount: request.paymentAmount,
      currency: request.paymentCurrency || request.planCurrency || 'LKR',
      status: request.paymentProofDataUrl ? 'payment proof' : 'pending',
      createdAt: request.requestedAt,
      actionPath: '/subscriptions',
    }));

  if (pendingUsers > 0) {
    subscriptionItems.unshift({
      id: 'pending-users',
      title: `${pendingUsers} student account${pendingUsers === 1 ? '' : 's'} waiting approval`,
      subtitle: 'Review pending/inactive student accounts.',
      amount: null,
      currency: 'LKR',
      status: 'account approval',
      createdAt: null,
      actionPath: '/users',
    });
  }

  return subscriptionItems.slice(0, 6);
}

function MoneyCard({ label, value, hint, tone }) {
  const toneClass = {
    green: metricCardGreen,
    blue: metricCardBlue,
    amber: metricCardAmber,
    violet: metricCardViolet,
  }[tone] || metricCardBlue;

  return (
    <article className={cx(metricCardBase, toneClass)}>
      <span className={ui.eyebrow}>{label}</span>
      <strong className={metricValueClass}>{value}</strong>
      <p className={metricLabelClass}>{hint}</p>
    </article>
  );
}

function ApprovalQueue({ items, onNavigate }) {
  return (
    <section className={sectionClass}>
      <div className={sectionHeadClass}>
        <div>
          <span className={ui.eyebrow}>Waiting Approval</span>
          <h2 className={ui.sectionTitle}>Requests that need action</h2>
        </div>
        <button className={dashboardButtonSoftClass} type="button" onClick={() => onNavigate('/subscriptions')}>
          Open subscriptions
        </button>
      </div>

      {items.length === 0 ? (
        <div className={ui.emptyBox}>No approval requests waiting right now.</div>
      ) : (
        <div className={queueListClass}>
          {items.map((item) => (
            <article className={queueItemClass} key={item.id}>
              <div className="min-w-0">
                <strong className="block text-[15px] text-ink-strong">{item.title}</strong>
                <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft">{item.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={statusPill('pending')}>{item.status}</span>
                  {item.createdAt ? <span className={statusPill('')}>{formatDate(item.createdAt)}</span> : null}
                </div>
              </div>
              <div className="grid justify-items-end gap-2 text-right max-[700px]:justify-items-start max-[700px]:text-left">
                {item.amount ? (
                <strong className="text-[15px] text-ink-strong">{formatMoney(item.amount, item.currency)}</strong>
                ) : null}
                <button className={dashboardButtonClass} type="button" onClick={() => onNavigate(item.actionPath)}>
                  Review
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentMoney({ subscriptions, requests }) {
  const rows = [
    ...subscriptions
      .filter(isCollectedSubscription)
      .slice(0, 4)
      .map((subscription) => ({
        id: `sub-${subscription.id}`,
        title: getAdminUserIdentifier(subscription, 'Paid subscription'),
        subtitle: subscription.planName || 'Subscription',
        amount: subscription.amountPaid,
        currency: subscription.planCurrency || 'LKR',
        status: subscription.paymentStatus === 'manual' ? 'Manual payment' : formatPaymentStatus(subscription.paymentStatus),
        createdAt: subscriptionCollectionDate(subscription),
      })),
    ...requests
      .filter((request) => request?.status === 'pending' && numberValue(request?.paymentAmount) > 0)
      .slice(0, 3)
      .map((request) => ({
        id: `req-${request.id}`,
        title: getAdminUserIdentifier(request, 'Manual payment'),
        subtitle: request.planName || 'Payment proof uploaded',
        amount: request.paymentAmount,
        currency: request.paymentCurrency || request.planCurrency || 'LKR',
        status: 'awaiting approval',
        createdAt: request.requestedAt,
      })),
  ].slice(0, 6);

  return (
    <section className={sectionClass}>
      <div className={sectionHeadClass}>
        <div>
          <span className={ui.eyebrow}>Finance</span>
          <h2 className={ui.sectionTitle}>Recent payments</h2>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={ui.emptyBox}>No payment activity yet.</div>
      ) : (
        <div className={queueListClass}>
          {rows.map((row) => (
            <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-line-soft bg-surface-card p-4 shadow-xs max-[640px]:grid-cols-1" key={row.id}>
              <div className="min-w-0">
                <strong className="block text-[14px] text-ink-strong">{row.title}</strong>
                <p className="m-0 mt-1 text-[12px] text-ink-soft">{row.subtitle}</p>
              </div>
              <div className="grid justify-items-end gap-1 text-right max-[640px]:justify-items-start max-[640px]:text-left">
                <strong className="text-[14px] text-ink-strong">{formatMoney(row.amount, row.currency)}</strong>
                <small className="text-ink-soft">{row.status} · {formatDate(row.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PlatformSnapshot({ dashboard, userSummary, activeSubscriptions, expiringSoon }) {
  const stats = [
    { label: 'Students', value: userSummary.studentUsers || 0 },
    { label: 'Active users', value: userSummary.activeUsers || 0 },
    { label: 'Courses', value: dashboard.totalCourses || 0 },
    { label: 'Questions', value: dashboard.totalQuestions || 0 },
    { label: 'Active subs', value: activeSubscriptions },
    { label: 'Expiring soon', value: expiringSoon },
    { label: 'Quizzes', value: dashboard.totalQuizzes || 0 },
    { label: 'Lessons', value: dashboard.totalLessons || 0 },
  ];

  return (
    <section className={sectionClass}>
      <div className={sectionHeadClass}>
        <div>
          <span className={ui.eyebrow}>Platform</span>
          <h2 className={ui.sectionTitle}>Important system counts</h2>
        </div>
      </div>
      <div className={compactGridClass}>
        {stats.map((stat) => (
          <div className={compactTileClass} key={stat.label}>
            <strong className="block text-xl font-black text-ink-strong">{stat.value}</strong>
            <span className="text-xs font-bold text-ink-soft">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [subscriptions, setSubscriptions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [userSummary, setUserSummary] = useState(emptyUserSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [dashboardData, subscriptionRows, requestRows, summaryData] = await Promise.all([
          fetchAdminDashboard(),
          fetchAdminSubscriptions(),
          fetchAdminSubscriptionRequests(),
          fetchUsersSummary(),
        ]);
        if (!active) return;
        setDashboard(dashboardData || emptyDashboard);
        setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
        setRequests(Array.isArray(requestRows) ? requestRows : []);
        setUserSummary({ ...emptyUserSummary, ...(summaryData || {}) });
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(getErrorMessage(loadError, 'Unable to load admin dashboard'));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const finance = useMemo(() => {
    const currency = resolveCurrency(subscriptions, requests);
    const today = todayKey();
    const collectedSubscriptions = subscriptions.filter(isCollectedSubscription);
    const todayCollected = collectedSubscriptions.filter((subscription) => {
      return dateKey(subscriptionCollectionDate(subscription)) === today;
    });
    const pendingRequests = requests.filter((request) => request?.status === 'pending');
    const pendingManualAmount = pendingRequests.reduce((sum, request) => sum + numberValue(request.paymentAmount), 0);
    const todayConfirmedRevenue = todayCollected.reduce((sum, subscription) => sum + numberValue(subscription.amountPaid), 0);

    return {
      currency,
      totalRevenue: collectedSubscriptions.reduce((sum, subscription) => sum + numberValue(subscription.amountPaid), 0),
      todayRevenue: todayConfirmedRevenue,
      todayConfirmedRevenue,
      pendingRequests: pendingRequests.length,
      pendingManualAmount,
      activeSubscriptions: subscriptions.filter((subscription) => subscription?.computedStatus === 'active' || subscription?.status === 'active').length,
      expiringSoon: subscriptions.filter((subscription) => subscription?.isExpiringSoon).length,
    };
  }, [requests, subscriptions]);

  const approvalQueue = useMemo(
    () => buildApprovalQueue({ pendingUsers: Number(userSummary.pendingUsers || 0), requests }),
    [requests, userSummary.pendingUsers]
  );

  if (loading) {
    return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
          <div className={ui.emptyBox}>Loading admin operations…</div>
        </section>
      </main>
    );
  }

  return (
    <main className={ui.screenShell}>
      <section className={cx(ui.managementLayout, dashboardLayoutClass)}>
        <AppHeader title="Admin Hub" subtitle="Operations" />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section className={heroClass}>
          <div>
            <span className={ui.eyebrow}>Today</span>
            <h1 className="m-0 mt-2 text-[clamp(20px,2vw,26px)] font-black leading-tight text-ink-strong">
              Admin operations at a glance.
            </h1>
            <p className="m-0 mt-2 max-w-[620px] text-[13px] leading-relaxed text-ink-soft">
              Earnings, payment proofs, student approvals, and subscription health are prioritized here.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={dashboardButtonClass} type="button" onClick={() => navigate('/subscriptions')}>
                Review payments
              </button>
              <button className={dashboardButtonSoftClass} type="button" onClick={() => navigate('/users')}>
                Review students
              </button>
            </div>
          </div>
          <div className={heroRailClass} aria-label="Admin operation summary">
            <span className={heroMiniStatClass}>
              <strong className="text-ink-strong">{finance.pendingRequests}</strong>
              requests
            </span>
            <span className={heroMiniStatClass}>
              <strong className="text-ink-strong">{userSummary.pendingUsers || 0}</strong>
              user approvals
            </span>
            <span className={heroMiniStatClass}>
              <strong className="text-ink-strong">{finance.activeSubscriptions}</strong>
              active subs
            </span>
            <span className={heroMiniStatClass}>
              <strong className="text-ink-strong">{finance.expiringSoon}</strong>
              expiring
            </span>
          </div>
        </section>

        <section className={moneyGridClass}>
          <MoneyCard
            label="Today's Earnings"
            value={finance.todayRevenue > 0 ? formatMoney(finance.todayRevenue, finance.currency) : 'No payments today'}
            hint="Manual and online subscription payments confirmed today."
            tone="green"
          />
          <MoneyCard
            label="Total Collected"
            value={formatMoney(finance.totalRevenue, finance.currency)}
            hint="All paid subscription revenue."
            tone="blue"
          />
          <MoneyCard
            label="Awaiting Approval"
            value={finance.pendingRequests}
            hint={`${formatMoney(finance.pendingManualAmount, finance.currency)} in pending requests.`}
            tone="amber"
          />
          <MoneyCard
            label="Student Approvals"
            value={userSummary.pendingUsers || 0}
            hint="Pending/inactive student accounts."
            tone="violet"
          />
        </section>

        <div className={panelGridClass}>
          <ApprovalQueue items={approvalQueue} onNavigate={navigate} />
          <RecentMoney subscriptions={subscriptions} requests={requests} />
        </div>

        <PlatformSnapshot
          dashboard={dashboard}
          userSummary={userSummary}
          activeSubscriptions={finance.activeSubscriptions}
          expiringSoon={finance.expiringSoon}
        />
      </section>
    </main>
  );
}
