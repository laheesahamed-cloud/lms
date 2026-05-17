import { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminDashboard } from '../../../../shared/api/dashboard.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { isLowSpecDevice } from '../../../../shared/utils/performanceProfile.js';

const adminDashboardLayoutClass = 'gap-6';
const aiHeroClass = 'lms-dashboard-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 rounded-lg border border-line-soft bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.045)),var(--surface-card)] p-6 shadow-md max-[900px]:grid-cols-1';
const aiHeroCopyClass = 'min-w-0';
const aiHeroTitleClass = 'm-0 mt-2 text-[clamp(22px,3vw,32px)] font-extrabold leading-tight text-ink-strong';
const aiHeroTextClass = 'my-3 max-w-[720px] text-sm leading-relaxed text-ink-soft';
const aiHeroChipsClass = 'mb-4 flex flex-wrap gap-2';
const aiHeroChipClass = 'rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink-medium';
const aiHeroStatsClass = 'grid min-w-[300px] gap-3 max-[900px]:min-w-0';
const aiScoreClass = 'rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5 text-center';
const aiScoreLabelClass = 'block text-xs font-extrabold uppercase tracking-[0.08em] text-brand-primary';
const aiScoreValueClass = 'block text-[42px] font-black leading-none text-ink-strong';
const aiScoreTextClass = 'mt-2 block text-xs leading-relaxed text-ink-soft';
const aiSnapshotClass = 'grid grid-cols-2 gap-2';
const aiSnapshotCellClass = 'rounded-md border border-line-soft bg-surface-1 p-3 text-center';
const aiSnapshotValueClass = 'block text-xl font-extrabold text-ink-strong';
const aiSnapshotLabelClass = 'block text-[11px] font-bold text-ink-soft';
const aiModulesClass = 'grid grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-5 max-[1100px]:grid-cols-1';
const aiModuleColumnClass = 'grid content-start gap-5';
const dashboardAiUi = {
  commandBar:
    'grid grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] gap-[18px] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-primary-light)_78%,transparent),transparent_40%),linear-gradient(145deg,color-mix(in_srgb,var(--surface-1)_92%,var(--surface-2)),var(--surface-1))] p-[22px] max-[1080px]:grid-cols-1 max-[640px]:p-4',
  commandMain: 'flex min-w-0 flex-col gap-3.5',
  commandInputWrap:
    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-line-soft bg-surface-glass-strong p-2.5 shadow-sm max-[640px]:grid-cols-1',
  commandBadge:
    'inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-[14px] bg-[var(--brand-gradient-primary)] px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-white',
  commandInput:
    'min-w-0 border-0 bg-transparent text-[15px] shadow-none focus:outline-none',
  commandPrompts: 'flex flex-wrap gap-2.5',
  commandReply:
    'flex min-w-0 flex-col gap-2 rounded-xl border border-line-soft bg-[color-mix(in_srgb,var(--surface-1)_92%,var(--color-primary-light))] p-[18px] shadow-sm max-[640px]:p-4 [&_p]:m-0 [&_p]:break-words [&_p]:text-ink-soft [&_p]:leading-relaxed [&_strong]:text-[13px] [&_strong]:text-ink-strong',
  insightGrid: 'grid grid-cols-5 gap-4 max-[1240px]:grid-cols-3 max-[820px]:grid-cols-2 max-[640px]:grid-cols-1',
  insightCard:
    'lms-dashboard-card flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-surface-1 p-5 shadow-sm max-[640px]:p-4 [&_p]:m-0 [&_p]:break-words [&_p]:text-ink-soft [&_p]:leading-relaxed',
  insightTop: 'flex flex-col gap-2.5',
  insightValue: 'm-0 mt-1 text-[clamp(1.8rem,3vw,2.5rem)] leading-none text-ink-strong',
  insightDelta:
    'inline-flex min-h-7 items-center self-start rounded-full bg-surface-2 px-2.5 text-[11px] font-extrabold tracking-[0.02em]',
  insightDeltaPositive: 'bg-[var(--color-success-light)] text-brand-success',
  insightDeltaWarning: 'bg-[var(--color-warning-light)] text-brand-warning',
  insightDeltaNeutral: 'bg-brand-primary-light text-brand-primary',
  quickGrid: 'grid grid-cols-2 gap-3 max-[820px]:grid-cols-2 max-[640px]:grid-cols-1',
  quickAction:
    'lms-dashboard-card flex min-w-0 flex-col gap-2 rounded-xl border border-line-soft bg-surface-1 p-[18px] text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md max-[640px]:p-4 [&_span]:m-0 [&_span]:break-words [&_span]:text-ink-soft [&_span]:leading-relaxed [&_strong]:text-ink-strong',
  quickToneBlue: 'border-blue-600/20',
  quickToneTeal: 'border-teal-600/20',
  quickToneViolet: 'border-violet-600/20',
  quickToneAmber: 'border-amber-600/20',
  analyticsHead: 'items-start',
  analyticsFilters: 'flex flex-wrap gap-2.5',
  analyticsCustom: 'mb-4 flex flex-wrap gap-3.5 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5',
  analyticsGrid: 'grid grid-cols-2 gap-4 max-[1080px]:grid-cols-1',
  chartCard:
    'lms-dashboard-card flex min-w-0 flex-col gap-3.5 rounded-xl border border-line-soft bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-card)_92%,var(--surface-2)),var(--surface-card))] p-[18px] max-[640px]:p-4',
  chartTop: 'flex flex-wrap items-center justify-between gap-3 [&_span]:text-xs [&_span]:text-ink-soft [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:text-ink-strong',
  chartMeta: 'flex flex-wrap items-center justify-between gap-3 [&_span]:text-xs [&_span]:text-ink-soft',
  chartSvg: 'block h-auto w-full',
  chartGrid: 'stroke-[color-mix(in_srgb,var(--line-soft)_92%,transparent)] stroke-[1]',
  chartLine: 'fill-none stroke-current stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]',
  chartDot: 'fill-current stroke-surface-card stroke-[2]',
  list: 'flex flex-col gap-3',
  recommendation:
    'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3.5 rounded-xl border border-line-soft bg-surface-1 p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md max-[820px]:grid-cols-1 max-[640px]:p-4 [&_p]:m-0 [&_p]:break-words [&_p]:text-ink-soft [&_p]:leading-relaxed [&_strong]:text-ink-strong',
  recommendationPositive: 'border-emerald-600/20',
  recommendationWarning: 'border-amber-600/20',
  activity:
    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 rounded-xl border border-line-soft bg-surface-1 p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md max-[820px]:grid-cols-1 max-[640px]:p-4 [&_p]:m-0 [&_p]:break-words [&_p]:text-ink-soft [&_p]:leading-relaxed [&_strong]:text-ink-strong',
  activityPill:
    'inline-flex min-h-[30px] items-center justify-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 text-[11px] font-extrabold text-ink-medium',
  activityCopy: 'min-w-0',
  activityMeta: 'flex min-w-0 flex-col items-end gap-1.5 text-[11px] text-ink-soft max-[820px]:items-start',
  activityPillBlue: 'bg-brand-primary-light text-brand-primary',
  activityPillViolet: 'bg-[var(--color-violet-light)] text-brand-violet',
  activityPillTeal: 'bg-[var(--color-teal-light)] text-brand-teal',
  activityPillAmber: 'bg-[var(--color-warning-light)] text-brand-warning',
};

function aiToneClass(tone, prefix) {
  if (prefix === 'chart') {
    if (tone === 'teal') return 'text-brand-teal';
    if (tone === 'violet') return 'text-brand-violet';
    if (tone === 'amber') return 'text-brand-warning';
    return 'text-brand-primary';
  }
  if (prefix === 'quick') {
    if (tone === 'teal') return dashboardAiUi.quickToneTeal;
    if (tone === 'violet') return dashboardAiUi.quickToneViolet;
    if (tone === 'amber') return dashboardAiUi.quickToneAmber;
    return dashboardAiUi.quickToneBlue;
  }
  if (prefix === 'activity') {
    if (tone === 'teal') return dashboardAiUi.activityPillTeal;
    if (tone === 'violet') return dashboardAiUi.activityPillViolet;
    if (tone === 'amber') return dashboardAiUi.activityPillAmber;
    return dashboardAiUi.activityPillBlue;
  }
  return '';
}

const defaultDashboard = {
  totalUsers: 0,
  totalCourses: 0,
  totalSubjects: 0,
  totalQuizzes: 0,
  totalQuestions: 0,
  totalLessons: 0,
  engagementScore: 0,
  generatedAt: '',
  aiInsights: [],
  recommendations: [],
  activityFeed: [],
  shortcuts: [],
  analytics: {
    users: [],
    courses: [],
    lessons: [],
    quizzes: [],
    questions: [],
    attempts: [],
  },
};

const quickActions = [
  { label: 'Create course', description: 'Launch a new learning space', path: '/courses', tone: 'blue' },
  { label: 'Add lesson', description: 'Expand course depth', path: '/structure', tone: 'teal' },
  { label: 'Upload content', description: 'Create and manage lessons', path: '/ai-notes', tone: 'violet' },
  { label: 'Generate quiz', description: 'Create an assessment fast', path: '/quizzes/new', tone: 'amber' },
];

const askAnythingPrompts = [
  'Where are students struggling?',
  'What should we create next?',
  'Show recent activity',
  'How is engagement trending?',
];

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatTimestamp(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getToneArrow(delta) {
  if (delta > 0) return '↗';
  if (delta < 0) return '↘';
  return '→';
}

function calculateAnalyticsSummary(series) {
  const values = Array.isArray(series) ? series : [];
  const total = values.reduce((sum, point) => sum + Number(point.value || 0), 0);
  const max = values.reduce((peak, point) => Math.max(peak, Number(point.value || 0)), 0);
  const latest = values.length ? values[values.length - 1]?.value || 0 : 0;
  return { total, max, latest };
}

function filterSeriesByWindow(series, windowMode, customRange) {
  const values = Array.isArray(series) ? series : [];
  if (windowMode === 'week') return values.slice(-7);
  if (windowMode === 'month') return values.slice(-30);
  if (windowMode === 'custom' && customRange.start && customRange.end) {
    return values.filter((point) => point.date >= customRange.start && point.date <= customRange.end);
  }
  return values.slice(-14);
}

function buildAiReply(query, dashboard) {
  const normalized = String(query || '').trim().toLowerCase();
  const weakestRecommendation = dashboard.recommendations?.[0];
  const topInsight = dashboard.aiInsights?.[0];

  if (!normalized) {
    return 'Ask about engagement, content growth, assessment supply, or the next best admin action.';
  }
  if (normalized.includes('struggling') || normalized.includes('engagement')) {
    return `Engagement score is ${dashboard.engagementScore}. ${dashboard.aiInsights?.find((insight) => insight.id === 'engagement')?.detail || 'Recent attempt activity is the main signal right now.'}`;
  }
  if (normalized.includes('create') || normalized.includes('next')) {
    return weakestRecommendation
      ? `${weakestRecommendation.title}. ${weakestRecommendation.detail}`
      : 'The strongest next move is to either add fresh content or launch a new quiz cycle.';
  }
  if (normalized.includes('activity')) {
    const latest = dashboard.activityFeed?.[0];
    return latest
      ? `Latest signal: ${latest.typeLabel} — ${latest.title} at ${formatTimestamp(latest.createdAt)}.`
      : 'There is no recent activity in the current feed yet.';
  }
  if (normalized.includes('growth') || normalized.includes('trend')) {
    return topInsight
      ? `${topInsight.label}: ${topInsight.deltaLabel}. ${topInsight.detail}`
      : 'Trend data is available once the analytics stream loads.';
  }
  return 'The dashboard can surface trend shifts, activity spikes, engagement risk, and the next recommended admin action.';
}

const MiniLineChart = memo(function MiniLineChart({ points = [], tone = 'blue' }) {
  const safePoints = points.length ? points : [{ date: '0', value: 0 }];
  const width = 520;
  const height = 180;
  const padding = 18;
  const maxValue = Math.max(...safePoints.map((point) => Number(point.value || 0)), 1);
  const stepX = safePoints.length > 1 ? (width - padding * 2) / (safePoints.length - 1) : 0;
  const path = safePoints
    .map((point, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((Number(point.value || 0) / maxValue) * (height - padding * 2));
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  const areaPath = `${path} L ${padding + stepX * (safePoints.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cx(dashboardAiUi.chartSvg, aiToneClass(tone, 'chart'))} aria-hidden="true">
      <defs>
        <linearGradient id={`chart-gradient-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((index) => {
        const y = padding + (((height - padding * 2) / 3) * index);
        return <line key={index} x1={padding} x2={width - padding} y1={y} y2={y} className={dashboardAiUi.chartGrid} />;
      })}
      <path d={areaPath} fill={`url(#chart-gradient-${tone})`} />
      <path d={path} className={dashboardAiUi.chartLine} />
      {safePoints.map((point, index) => {
        const x = padding + index * stepX;
        const y = height - padding - ((Number(point.value || 0) / maxValue) * (height - padding * 2));
        return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="3.5" className={dashboardAiUi.chartDot} />;
      })}
    </svg>
  );
});

function AiSearchBar({ query, onQueryChange, onSubmitPrompt, aiReply }) {
  return (
    <section className={cx(ui.panelCard, dashboardAiUi.commandBar)}>
      <div className={dashboardAiUi.commandMain}>
        <div className={dashboardAiUi.commandInputWrap}>
          <span className={dashboardAiUi.commandBadge}>AI</span>
          <input className={dashboardAiUi.commandInput}
           
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Ask anything about growth, content gaps, activity, or next steps…"
          />
          <button className={ui.primaryAction} type="button" onClick={() => onSubmitPrompt(query)}>Ask</button>
        </div>
        <div className={dashboardAiUi.commandPrompts}>
          {askAnythingPrompts.map((prompt) => (
            <button key={prompt} type="button" className={ui.secondaryAction} onClick={() => onSubmitPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
      <div className={dashboardAiUi.commandReply}>
        <strong>AI Assistant</strong>
        <p>{aiReply}</p>
      </div>
    </section>
  );
}

function InsightCard({ insight }) {
  return (
    <article className={dashboardAiUi.insightCard}>
      <div className={dashboardAiUi.insightTop}>
        <div>
          <span className={ui.eyebrow}>{insight.label}</span>
          <h3 className={dashboardAiUi.insightValue}>{formatCompactNumber(insight.value)}</h3>
        </div>
        <span
          className={cx(
            dashboardAiUi.insightDelta,
            insight.tone === 'positive' && dashboardAiUi.insightDeltaPositive,
            insight.tone === 'warning' && dashboardAiUi.insightDeltaWarning,
            insight.tone !== 'positive' && insight.tone !== 'warning' && dashboardAiUi.insightDeltaNeutral
          )}
        >
          {getToneArrow(insight.delta)} {insight.deltaLabel}
        </span>
      </div>
      <p>{insight.detail}</p>
    </article>
  );
}

function QuickActions({ onNavigate }) {
  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={ui.panelTop}>
        <div>
          <span className={ui.eyebrow}>Quick Actions</span>
          <h2>High-value actions in one click</h2>
        </div>
      </div>
      <div className={dashboardAiUi.quickGrid}>
        {quickActions.map((action) => (
          <button key={action.label} type="button" className={cx(dashboardAiUi.quickAction, aiToneClass(action.tone, 'quick'))} onClick={() => onNavigate(action.path)}>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LiveAnalytics({ analytics, windowMode, onWindowChange, customRange, onCustomRangeChange }) {
  const metricConfig = [
    { id: 'attempts', label: 'Weekly Activity', tone: 'blue' },
    { id: 'users', label: 'User Growth', tone: 'teal' },
    { id: 'lessons', label: 'Lesson Velocity', tone: 'violet' },
    { id: 'questions', label: 'Question Pipeline', tone: 'amber' },
  ];

  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={cx(ui.panelTop, dashboardAiUi.analyticsHead)}>
        <div>
          <span className={ui.eyebrow}>Live Analytics</span>
          <h2>Real-time operating view</h2>
          <p>Polling the admin dashboard feed regularly so trend signals stay fresh while you work.</p>
        </div>
        <div className={dashboardAiUi.analyticsFilters}>
          {['week', 'month', 'custom'].map((filter) => (
            <button className={windowMode === filter ? '' : ui.secondaryAction}
              key={filter}
              type="button"
             
              onClick={() => onWindowChange(filter)}
            >
              {filter === 'week' ? 'This week' : filter === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {windowMode === 'custom' ? (
        <div className={dashboardAiUi.analyticsCustom}>
          <label className={ui.formLabel}>
            Start
            <input className={ui.input} type="date" value={customRange.start} onChange={(event) => onCustomRangeChange('start', event.target.value)} />
          </label>
          <label className={ui.formLabel}>
            End
            <input className={ui.input} type="date" value={customRange.end} onChange={(event) => onCustomRangeChange('end', event.target.value)} />
          </label>
        </div>
      ) : null}

      <div className={dashboardAiUi.analyticsGrid}>
        {metricConfig.map((metric) => {
          const filteredPoints = filterSeriesByWindow(analytics[metric.id], windowMode, customRange);
          const summary = calculateAnalyticsSummary(filteredPoints);
          return (
            <article key={metric.id} className={cx(dashboardAiUi.chartCard, aiToneClass(metric.tone, 'chart'))}>
              <div className={dashboardAiUi.chartTop}>
                <div>
                  <span className={ui.eyebrow}>{metric.label}</span>
                  <strong>{formatCompactNumber(summary.total)}</strong>
                </div>
                <span>Peak {formatCompactNumber(summary.max)}</span>
              </div>
              <MiniLineChart points={filteredPoints} tone={metric.tone} />
              <div className={dashboardAiUi.chartMeta}>
                <span>Latest: {formatCompactNumber(summary.latest)}</span>
                <span>{filteredPoints.length} data points</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Recommendations({ recommendations, onNavigate }) {
  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={ui.panelTop}>
        <div>
          <span className={ui.eyebrow}>AI Recommendations</span>
          <h2>Next-best moves</h2>
        </div>
      </div>
      <div className={dashboardAiUi.list}>
        {recommendations.map((item) => (
          <article
            key={item.title}
            className={cx(
              dashboardAiUi.recommendation,
              item.tone === 'positive' && dashboardAiUi.recommendationPositive,
              item.tone === 'warning' && dashboardAiUi.recommendationWarning
            )}
          >
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <button className={ui.primaryAction} type="button" onClick={() => onNavigate(item.actionPath)}>
              {item.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityFeed({ feed }) {
  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={ui.panelTop}>
        <div>
          <span className={ui.eyebrow}>Activity Feed</span>
          <h2>Recent system activity</h2>
        </div>
      </div>
      <div className={dashboardAiUi.list}>
        {feed.map((item) => (
          <article key={item.id} className={dashboardAiUi.activity}>
            <span className={cx(dashboardAiUi.activityPill, aiToneClass(item.tone, 'activity'))}>{item.typeLabel}</span>
            <div className={dashboardAiUi.activityCopy}>
              <strong>{item.title}</strong>
              <p>{item.subtitle || 'No extra context available yet.'}</p>
            </div>
            <div className={dashboardAiUi.activityMeta}>
              <span>{item.status || 'active'}</span>
              <small>{formatTimestamp(item.createdAt)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PersonalizedHero({ dashboard, onNavigate }) {
  return (
    <section className={aiHeroClass}>
      <div className={aiHeroCopyClass}>
        <span className={ui.eyebrow}>AI Command Center</span>
        <h2 className={aiHeroTitleClass}>{getGreeting()} — your LMS now has a live operating brain.</h2>
        <p className={aiHeroTextClass}>
          Turn static admin oversight into an AI-native workflow with trend-aware insights, predictive recommendations,
          and one-click actions across content, assessments, and learner engagement.
        </p>
        <div className={aiHeroChipsClass}>
          <span className={aiHeroChipClass}>Engagement {dashboard.engagementScore}</span>
          <span className={aiHeroChipClass}>{dashboard.totalCourses} active course spaces</span>
          <span className={aiHeroChipClass}>{dashboard.totalQuestions} assessment items</span>
          <span className={aiHeroChipClass}>{dashboard.totalLessons} lesson units</span>
        </div>
        <div className={ui.buttonRow}>
          <button className={ui.primaryAction} type="button" onClick={() => onNavigate('/structure')}>Open structure manager</button>
          <button type="button" className={ui.secondaryAction} onClick={() => onNavigate('/quizzes/new')}>Generate next quiz flow</button>
        </div>
      </div>
      <div className={aiHeroStatsClass}>
        <div className={aiScoreClass}>
          <span className={aiScoreLabelClass}>Engagement Score</span>
          <strong className={aiScoreValueClass}>{dashboard.engagementScore}</strong>
          <small className={aiScoreTextClass}>Composite of recent learner motion, content density, and assessment activity.</small>
        </div>
        <div className={aiSnapshotClass}>
          <div className={aiSnapshotCellClass}><strong className={aiSnapshotValueClass}>{dashboard.totalUsers}</strong><span className={aiSnapshotLabelClass}>Learners</span></div>
          <div className={aiSnapshotCellClass}><strong className={aiSnapshotValueClass}>{dashboard.totalQuizzes}</strong><span className={aiSnapshotLabelClass}>Quizzes</span></div>
          <div className={aiSnapshotCellClass}><strong className={aiSnapshotValueClass}>{dashboard.totalSubjects}</strong><span className={aiSnapshotLabelClass}>Subjects</span></div>
          <div className={aiSnapshotCellClass}><strong className={aiSnapshotValueClass}>{dashboard.totalLessons}</strong><span className={aiSnapshotLabelClass}>Lessons</span></div>
        </div>
      </div>
    </section>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [aiReply, setAiReply] = useState('Ask about growth, struggling areas, recent activity, or the next best action.');
  const [windowMode, setWindowMode] = useState('week');
  const [customRange, setCustomRange] = useState({
    start: '',
    end: '',
  });

  useEffect(() => {
    let active = true;

    async function load(isInitial = false) {
      try {
        const data = await fetchAdminDashboard();
        if (!active) return;
        setDashboard(data);
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(getErrorMessage(loadError, 'Unable to load admin dashboard'));
      } finally {
        if (isInitial && active) {
          setLoading(false);
        }
      }
    }

    load(true);
    const refreshMs = isLowSpecDevice() ? 90000 : 45000;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      load(false);
    }, refreshMs);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!customRange.start || !customRange.end) {
      const series = dashboard.analytics?.attempts || [];
      if (series.length >= 30) {
        setCustomRange({
          start: series[series.length - 30]?.date || '',
          end: series[series.length - 1]?.date || '',
        });
      }
    }
  }, [dashboard.analytics, customRange.end, customRange.start]);

  function handleAsk(prompt) {
    const nextQuery = String(prompt || '').trim();
    setQuery(nextQuery);
    setAiReply(buildAiReply(nextQuery, dashboard));
  }

  if (loading) {
    return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
          <div className={ui.emptyBox}>Loading AI command center…</div>
        </section>
      </main>
    );
  }

  return (
    <main className={ui.screenShell}>
      <section className={cx(ui.managementLayout, adminDashboardLayoutClass)}>
        <AppHeader
          title="Admin Hub"
          subtitle="AI-first operational visibility across platform growth, learner behavior, content velocity, and assessment readiness."
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <AiSearchBar
          query={query}
          onQueryChange={setQuery}
          onSubmitPrompt={handleAsk}
          aiReply={aiReply}
        />

        <PersonalizedHero dashboard={dashboard} onNavigate={navigate} />

        <div className={dashboardAiUi.insightGrid}>
          {(dashboard.aiInsights || []).map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>

        <div className={aiModulesClass}>
          <div className={aiModuleColumnClass}>
            <LiveAnalytics
              analytics={dashboard.analytics || defaultDashboard.analytics}
              windowMode={windowMode}
              onWindowChange={setWindowMode}
              customRange={customRange}
              onCustomRangeChange={(field, value) => setCustomRange((current) => ({ ...current, [field]: value }))}
            />
            <ActivityFeed feed={dashboard.activityFeed || []} />
          </div>

          <div className={aiModuleColumnClass}>
            <QuickActions onNavigate={navigate} />
            <Recommendations recommendations={dashboard.recommendations || []} onNavigate={navigate} />
          </div>
        </div>
      </section>
    </main>
  );
}
