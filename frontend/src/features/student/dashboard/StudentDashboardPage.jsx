import { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../api/dashboard.api.js';
import { listAiNotes } from '../../../api/aiNotes.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { fetchStudentQuizzes } from '../../../api/quizAttempts.api.js';
import { fetchStudyBookmarks } from '../../../api/studyBookmarks.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { useAuthStore } from '../../../stores/authStore.js';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';
import { ImpactStyle, nativeImpact } from '../../../utils/nativeHaptics.js';

function runWhenIdle(task) {
  if (typeof window === 'undefined') {
    task();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(task, 350);
  return () => window.clearTimeout(timer);
}

const dashboardUi = {
  hero:
    'lms-dashboard-welcome-card lms-hero-card lms-dashboard-hero-card relative grid min-h-[176px] items-center gap-5 overflow-hidden rounded-[18px] border border-line-soft bg-surface-card px-7 py-6 text-ink-strong shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] min-[720px]:grid-cols-[minmax(0,1fr)_minmax(150px,26%)] max-[719px]:grid-cols-[minmax(0,1fr)_104px] max-[560px]:min-h-[154px] max-[560px]:gap-3 max-[560px]:rounded-[16px] max-[560px]:px-4 max-[560px]:py-4',
  heroTitle: 'my-2 mb-2 text-[clamp(24px,4.8vw,38px)] font-black leading-[1.04] text-ink-strong dark:text-white',
  heroText: 'm-0 mb-4 max-w-[520px] text-[14px] leading-relaxed text-ink-soft dark:text-white/68 max-[560px]:max-w-none max-[560px]:text-[13px] max-[560px]:leading-[1.45]',
  heroPills: 'lms-dashboard-welcome-pills mb-5 flex flex-wrap gap-2',
  heroPill:
    'lms-dashboard-welcome-pill rounded-full border border-white/16 bg-white/14 px-3 py-1.5 text-xs font-bold text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-lg',
  focusCard:
    'w-full min-w-[240px] max-w-[340px] rounded-lg border border-line-soft bg-surface-glass-strong p-5 shadow-lg backdrop-blur-2xl min-[700px]:col-span-2 min-[1180px]:col-span-1 max-[860px]:max-w-none',
  focusStandalone:
    'lms-dashboard-welcome-focus lms-dashboard-standalone-focus lms-dashboard-review-card relative grid w-full gap-4 overflow-hidden rounded-[18px] border border-line-soft bg-surface-card p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] max-[560px]:rounded-[16px] max-[560px]:p-4 min-[760px]:grid-cols-[minmax(0,1fr)_132px]',
  focusTitle: 'my-1 mb-1 text-[clamp(18px,2vw,24px)] font-black leading-tight text-ink-strong',
  focusText: 'm-0 text-[13.5px] leading-relaxed text-ink-soft',
  progressWrap: 'my-1 grid gap-2',
  progressTop: 'flex items-center justify-between gap-2.5 text-xs text-ink-soft',
  progressValue: 'text-sm font-bold text-ink-strong',
  progressTrack: 'my-2 h-[7px] overflow-hidden rounded-full bg-surface-3',
  progressFill:
    'relative block h-full overflow-hidden rounded-full bg-[var(--brand-gradient-primary)] shadow-[0_0_10px_rgba(37,99,235,0.35)] transition-[width] duration-700 ease-out after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] after:bg-[length:200%_100%] after:content-[""] after:animate-progressShimmer',
  focusStats: 'grid grid-cols-2 gap-2',
  focusStat: 'rounded-xl border border-line-soft bg-surface-1 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.035]',
  focusStatLabel: 'block text-[10.5px] font-bold uppercase text-ink-muted',
  focusStatValue: 'mt-1 block text-base font-black text-ink-strong',
  streakBanner:
    'flex items-center gap-4 rounded-xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.04))] px-5 py-4 shadow-sm dark:border-amber-500/25 dark:bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(239,68,68,0.06))]',
  streakFlame: 'shrink-0 size-7 text-amber-500',
  streakBody: 'flex-1',
  streakStrong: 'block text-[15px] font-bold text-ink-strong dark:text-white/90',
  streakText: 'text-[13px] text-ink-soft dark:text-white/55',
  streakDots: 'flex shrink-0 items-center gap-[5px]',
  streakDot: 'size-[9px] rounded-full border border-line-medium bg-surface-3',
  streakDotLit: 'border-amber-600 bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  metricTitleStack: 'flex flex-col gap-0.5',
  metricArt:
    'lms-dashboard-metric-art pointer-events-none absolute bottom-2 right-2 grid size-[86px] place-items-center opacity-[0.78] dark:opacity-[0.9]',
  metricGlow:
    'pointer-events-none absolute -right-[30px] -top-[30px] size-[130px] rounded-full opacity-70 blur-[32px] max-[640px]:opacity-35',
  metricGlowTone: {
    blue: 'bg-[radial-gradient(circle,rgba(37,99,235,0.3),transparent_70%)] opacity-80',
    teal: 'bg-[radial-gradient(circle,rgba(14,165,233,0.28),transparent_70%)] opacity-70',
    slate: 'bg-[radial-gradient(circle,rgba(79,70,229,0.25),transparent_70%)] opacity-70',
    violet: 'bg-[radial-gradient(circle,rgba(124,58,237,0.25),transparent_70%)] opacity-65',
  },
  insightRow:
    'flex w-full items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-left transition [&>div:first-child]:flex [&>div:first-child]:flex-col [&>div:first-child]:gap-0.5 [&_strong]:text-[13.5px] [&_strong]:font-bold [&_strong]:text-ink-strong [&_span]:text-xs [&_span]:text-ink-soft',
  insightRowButton: 'hover:-translate-y-0.5 hover:border-brand-primary/20 hover:bg-surface-1 hover:shadow-sm',
  insightScore:
    'flex shrink-0 flex-col items-end gap-0.5 [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:text-[11px] [&_span]:text-ink-soft',
  coachGrid: 'grid gap-3 min-[1180px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]',
  readinessCard:
    'relative overflow-hidden rounded-xl border border-line-soft bg-surface-0 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]',
  readinessValue: 'my-2 text-[clamp(34px,5vw,48px)] font-extrabold leading-none text-ink-strong',
  readinessMeta: 'm-0 text-[13px] leading-relaxed text-ink-soft',
  readinessTrack: 'mt-4 h-2 overflow-hidden rounded-full bg-surface-3',
  readinessFill: 'block h-full rounded-full bg-[var(--brand-gradient-primary)] transition-[width] duration-700 ease-out',
  vitalsGrid: 'grid gap-2 min-[560px]:grid-cols-3',
  vitalBox:
    'rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.03]',
  vitalLabel: 'block text-[11px] font-bold uppercase tracking-normal text-ink-muted',
  vitalValue: 'mt-1 block text-[15px] font-extrabold text-ink-strong',
  adaptivePlan: 'mt-3 grid gap-2',
  planStatus:
    'inline-flex min-w-[58px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-normal',
  todayGrid: 'grid gap-3 min-[1180px]:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]',
  todayCard:
    'lms-dashboard-today-card relative overflow-hidden rounded-xl border border-line-soft bg-surface-card p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035]',
  todayTitle: 'm-0 text-[clamp(20px,2.4vw,28px)] font-extrabold leading-tight text-ink-strong dark:text-white/90',
  todayText: 'm-0 mt-2 max-w-[680px] text-[13.5px] leading-relaxed text-ink-soft dark:text-white/58',
  todayActions: 'mt-4 grid grid-cols-2 gap-2.5 max-[420px]:gap-2',
  xpCard: 'rounded-xl border border-line-soft bg-surface-0 p-4 dark:border-white/10 dark:bg-white/[0.035]',
  xpTop: 'flex items-start justify-between gap-3',
  xpLevel: 'grid size-14 place-items-center rounded-xl border border-brand-violet/20 bg-brand-violet/10 text-xl font-extrabold text-brand-violet',
  badgeGrid: 'mt-3 grid grid-cols-2 gap-2',
  badge: 'rounded-lg border border-line-soft bg-surface-1 px-3 py-2 text-[12px] font-bold text-ink-medium dark:border-white/10 dark:bg-white/[0.03]',
  masteryMap: 'grid gap-3 min-[700px]:grid-cols-2 min-[1180px]:grid-cols-3',
  masteryNode:
    'lms-student-delight rounded-xl border p-4 shadow-sm transition dark:shadow-none',
  masteryNodeWeak: 'border-red-500/18 bg-red-500/8 dark:border-red-300/18 dark:bg-red-300/8',
  masteryNodeImproving: 'border-amber-500/20 bg-amber-500/10 dark:border-amber-300/20 dark:bg-amber-300/8',
  masteryNodeStrong: 'border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-300/20 dark:bg-emerald-300/8',
  masteryDot: 'mb-3 inline-flex size-3 rounded-full',
  masteryName: 'block text-[15px] font-extrabold leading-tight text-ink-strong dark:text-white/90',
  masteryMeta: 'mt-1 block text-[12px] leading-relaxed text-ink-soft dark:text-white/55',
};

const focusTone = {
  steady: 'border-brand-primary/25 bg-[linear-gradient(145deg,rgba(37,99,235,0.07),var(--surface-1))]',
  strong: 'border-brand-success/25 bg-[linear-gradient(145deg,rgba(5,150,105,0.07),var(--surface-1))]',
  focus: 'border-brand-violet/25 bg-[linear-gradient(145deg,rgba(124,58,237,0.07),var(--surface-1))]',
};

const dashboardCard = cx(ui.dashboardCard, ui.dashboardCardPremium, 'lms-dashboard-card animate-fadePop');
const dashboardStackCard = cx(dashboardCard, ui.dashboardCardStack);
const dashboardCardTitle = 'my-1 mb-0 text-[17px] font-extrabold leading-snug tracking-normal text-ink-strong';
const dashboardCardText = 'm-0 mb-4 text-[13px] leading-relaxed text-ink-soft';

function HeroMedicalIllustration() {
  return (
    <svg className="lms-dashboard-hero-illustration" viewBox="0 0 190 150" role="img" aria-label="Stethoscope over medical clipboard with ECG waveform">
      <defs>
        <linearGradient id="hCard" x1="14" y1="18" x2="118" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EFF6FF" />
          <stop offset="1" stopColor="#F5F3FF" />
        </linearGradient>
        <linearGradient id="hClipTop" x1="44" y1="10" x2="88" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="hEcg" x1="22" y1="100" x2="110" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="hSteth" x1="80" y1="30" x2="160" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      <circle cx="158" cy="28" r="38" fill="rgba(96,165,250,0.13)" />
      <circle cx="22" cy="130" r="25" fill="rgba(14,165,233,0.10)" />
      <rect x="14" y="20" width="108" height="116" rx="14" fill="url(#hCard)" stroke="rgba(37,99,235,0.22)" strokeWidth="1.8" />
      <rect x="44" y="12" width="44" height="18" rx="9" fill="url(#hClipTop)" />
      <rect x="52" y="17" width="28" height="5" rx="2.5" fill="rgba(255,255,255,0.52)" />
      <path d="M28 50h80M28 63h58M28 76h70" stroke="#94A3B8" strokeWidth="4.5" strokeLinecap="round" opacity=".4" />
      <path d="M22 100h14l8-20 11 30 10-22 7 12h36" stroke="url(#hEcg)" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M96 52 Q88 44 80 37 Q72 30 66 34" stroke="url(#hSteth)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M122 70 Q134 62 142 54 Q150 44 142 36" stroke="url(#hSteth)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M96 52 Q108 62 112 76" stroke="url(#hSteth)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M122 70 Q116 74 112 76" stroke="url(#hSteth)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M112 76 Q112 104 106 122" stroke="url(#hSteth)" strokeWidth="5.5" strokeLinecap="round" />
      <ellipse cx="65" cy="33" rx="5.5" ry="5" fill="#334155" />
      <ellipse cx="65" cy="33" rx="2.5" ry="2.2" fill="#64748B" />
      <ellipse cx="143" cy="34" rx="5.5" ry="5" fill="#334155" />
      <ellipse cx="143" cy="34" rx="2.5" ry="2.2" fill="#64748B" />
      <circle cx="100" cy="130" r="19" fill="#1E293B" opacity=".88" />
      <circle cx="100" cy="130" r="13.5" fill="#334155" />
      <circle cx="100" cy="130" r="7.5" fill="#475569" />
      <circle cx="95" cy="125" r="3.5" fill="rgba(255,255,255,0.28)" />
      <rect x="156" y="96" width="22" height="8" rx="4" fill="#EF4444" opacity=".68" />
      <rect x="162" y="90" width="8" height="20" rx="4" fill="#EF4444" opacity=".68" />
      <path d="M168 52 L170 58 L177 59.5 L170 61 L168 67 L166 61 L159 59.5 L166 58 Z" fill="#FACC15" opacity=".88" />
      <circle cx="16" cy="62" r="4" fill="#60A5FA" opacity=".55" />
      <circle cx="182" cy="108" r="4" fill="#34D399" opacity=".65" />
      <circle cx="178" cy="22" r="3" fill="#A78BFA" opacity=".6" />
    </svg>
  );
}

function ReviewQuizIllustration() {
  return (
    <svg className="lms-dashboard-review-illustration" viewBox="0 0 132 132" role="img" aria-label="Exam review clipboard with score chart">
      <defs>
        <linearGradient id="reviewBoard" x1="22" y1="18" x2="108" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#EEF2FF" />
        </linearGradient>
      </defs>
      <rect x="24" y="16" width="82" height="100" rx="16" fill="url(#reviewBoard)" stroke="rgba(37,99,235,0.2)" strokeWidth="2" />
      <rect x="46" y="8" width="38" height="18" rx="9" fill="#2563EB" />
      <path d="M40 46h42M40 62h30M40 78h46" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" opacity=".42" />
      <circle cx="92" cy="82" r="22" fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="3" />
      <path d="m82 82 8 8 17-20" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M26 108c22 12 58 12 78 0" stroke="#0EA5E9" strokeWidth="6" strokeLinecap="round" opacity=".18" />
      <path d="M18 38h16M26 30v16" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />
      <rect x="94" y="24" width="22" height="34" rx="11" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" transform="rotate(24 105 41)" />
    </svg>
  );
}

function ScoreTrendChart({ attempts }) {
  const raw = [...attempts].reverse().slice(0, 8);
  const scores = raw.map((a) => Math.round(Number(a.percentage || 0)));
  const n = scores.length;
  if (n < 2) return null;

  const W = 520, H = 148;
  const ml = 34, mr = 14, mt = 18, mb = 28;
  const pw = W - ml - mr;
  const ph = H - mt - mb;

  const pts = scores.map((s, i) => ({
    x: ml + (i / (n - 1)) * pw,
    y: mt + (1 - s / 100) * ph,
    score: s,
  }));

  function smoothPath(points) {
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
      const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
      const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
      const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const linePath = smoothPath(pts);
  const bottom = mt + ph;
  const areaPath = `${linePath} L ${pts[n - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z`;

  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / n);
  const col   = avg >= 70 ? '#22C55E' : avg >= 50 ? '#F59E0B' : '#EF4444';
  const gradTop = avg >= 70 ? 'rgba(34,197,94,0.24)' : avg >= 50 ? 'rgba(245,158,11,0.24)' : 'rgba(239,68,68,0.24)';
  const gradId = 'sct-area-grad';

  const y70 = (mt + (1 - 0.70) * ph).toFixed(1);
  const y50 = (mt + (1 - 0.50) * ph).toFixed(1);

  /* Week-bucket the attempts: show "Wk 1", "Wk 2" labels */
  const xLabels = pts.map((_, i) => `E${i + 1}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lms-score-trend-svg" role="img"
      aria-label={`Score trend: last ${n} exams, average ${avg}%`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradTop} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <clipPath id="sct-clip">
          <rect x={ml} y={mt} width={pw} height={ph + 1} />
        </clipPath>
      </defs>

      {/* Guide lines */}
      <line x1={ml} y1={y70} x2={ml + pw} y2={y70} stroke="rgba(34,197,94,0.28)" strokeWidth="1" strokeDasharray="5 4" />
      <text x={ml - 6} y={+y70 + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="rgba(34,197,94,0.80)">70</text>
      <line x1={ml} y1={y50} x2={ml + pw} y2={y50} stroke="rgba(245,158,11,0.28)" strokeWidth="1" strokeDasharray="5 4" />
      <text x={ml - 6} y={+y50 + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="rgba(245,158,11,0.80)">50</text>

      {/* Area */}
      <path d={areaPath} fill={`url(#${gradId})`} clipPath="url(#sct-clip)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={col} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + score labels */}
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)} r="5" fill={col} stroke="white" strokeWidth="2.2" />
          <text x={pt.x.toFixed(1)} y={(pt.y - 10).toFixed(1)} textAnchor="middle" fontSize="9.5" fontWeight="800" fill={col}>
            {pt.score}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {pts.map((pt, i) => (
        <text key={i} x={pt.x.toFixed(1)} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(100,116,139,0.65)">
          {xLabels[i]}
        </text>
      ))}
    </svg>
  );
}

function MetricCardArt({ type }) {
  if (type === 'blue') return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className="lms-mc-art">
      {/* Stack of quiz pages */}
      <rect x="28" y="24" width="52" height="66" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
      <rect x="22" y="18" width="52" height="66" rx="8" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5"/>
      <rect x="16" y="12" width="52" height="66" rx="8" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.40)" strokeWidth="1.5"/>
      {/* Lines on top page */}
      <rect x="24" y="26" width="30" height="3.5" rx="1.75" fill="rgba(255,255,255,0.70)"/>
      <rect x="24" y="33" width="38" height="3.5" rx="1.75" fill="rgba(255,255,255,0.50)"/>
      <rect x="24" y="40" width="26" height="3.5" rx="1.75" fill="rgba(255,255,255,0.40)"/>
      <rect x="24" y="47" width="34" height="3.5" rx="1.75" fill="rgba(255,255,255,0.35)"/>
      {/* Checkmark badge */}
      <circle cx="82" cy="72" r="18" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <path d="M74 72l5 5 10-10" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === 'teal') return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className="lms-mc-art">
      {/* Target rings */}
      <circle cx="70" cy="50" r="38" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"/>
      <circle cx="70" cy="50" r="28" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5"/>
      <circle cx="70" cy="50" r="18" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5"/>
      <circle cx="70" cy="50" r="9" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
      {/* Arrow */}
      <line x1="16" y1="50" x2="58" y2="50" stroke="rgba(255,255,255,0.75)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M52 44l8 6-8 6" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
  if (type === 'slate') return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className="lms-mc-art">
      {/* Trophy cup */}
      <path d="M40 20h40v28c0 16-8 24-20 28-12-4-20-12-20-28V20z" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.40)" strokeWidth="1.8"/>
      {/* Trophy handles */}
      <path d="M40 28 Q26 28 26 40 Q26 52 40 52" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M80 28 Q94 28 94 40 Q94 52 80 52" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Trophy base */}
      <rect x="48" y="76" width="24" height="6" rx="3" fill="rgba(255,255,255,0.40)"/>
      <rect x="43" y="80" width="34" height="5" rx="2.5" fill="rgba(255,255,255,0.30)"/>
      {/* Star inside */}
      <path d="M60 30l2.5 7.5H70l-6 4.5 2.5 7.5-6-4.5-6 4.5 2.5-7.5-6-4.5h7.5z" fill="rgba(255,255,255,0.65)"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className="lms-mc-art">
      {/* Flame body */}
      <path d="M60 88 Q38 80 38 58 Q38 42 50 32 Q48 46 56 52 Q54 38 62 22 Q74 38 76 52 Q84 44 82 30 Q94 44 82 62 Q82 80 60 88Z" fill="rgba(255,255,255,0.30)" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/>
      {/* Inner flame */}
      <path d="M60 80 Q46 72 46 58 Q46 48 54 42 Q52 52 58 56 Q57 46 62 32 Q70 46 70 56 Q76 50 74 40 Q82 52 74 64 Q72 76 60 80Z" fill="rgba(255,255,255,0.45)"/>
      {/* Dot row - streak days */}
      <circle cx="36" cy="82" r="4.5" fill="rgba(255,255,255,0.55)"/>
      <circle cx="50" cy="88" r="4.5" fill="rgba(255,255,255,0.55)"/>
      <circle cx="64" cy="90" r="4.5" fill="rgba(255,255,255,0.55)"/>
      <circle cx="78" cy="88" r="4.5" fill="rgba(255,255,255,0.55)"/>
      <circle cx="92" cy="82" r="4.5" fill="rgba(255,255,255,0.22)"/>
    </svg>
  );
}

function MetricStatIcon({ type }) {
  if (type === 'blue') return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="lms-metric-stat-icon">
      <rect x="3" y="10" width="3" height="7" rx="1.2" fill="currentColor"/>
      <rect x="8.5" y="6" width="3" height="11" rx="1.2" fill="currentColor"/>
      <rect x="14" y="2" width="3" height="15" rx="1.2" fill="currentColor"/>
    </svg>
  );
  if (type === 'teal') return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="lms-metric-stat-icon">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6.5 10.2l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === 'slate') return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="lms-metric-stat-icon">
      <path d="M10 3l1.8 5.4H17l-4.4 3.2 1.7 5.2L10 13.8l-4.3 3L7.4 11.6 3 8.4h5.2L10 3z" fill="currentColor"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="lms-metric-stat-icon">
      <path d="M10 2.5 Q10 5 12 7 Q15 9 14 12 Q13 15 10 16 Q7 15 6 12 Q5 9 8 7 Q10 5 10 2.5Z" fill="currentColor"/>
      <path d="M8.5 14.5 Q8 17 10 18 Q12 17 11.5 14.5" fill="currentColor" opacity=".6"/>
    </svg>
  );
}

function MetricIllustration({ type }) {
  /* Total Attempts → blue family purse */
  if (type === 'teal') {
    return (
      <svg viewBox="0 0 96 96" className="size-full" aria-hidden="true">
        {/* Purse body */}
        <ellipse cx="48" cy="60" rx="30" ry="27" fill="rgba(14,165,233,0.18)" stroke="#0EA5E9" strokeWidth="2.5" />
        {/* Purse top drawstring area */}
        <path d="M28 44 Q38 33 48 31 Q58 33 68 44" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="36" y="24" width="24" height="9" rx="4.5" fill="#2563EB" />
        {/* Medical cross on purse */}
        <rect x="42" y="54" width="12" height="4" rx="2" fill="#0EA5E9" />
        <rect x="46" y="50" width="4" height="12" rx="2" fill="#0EA5E9" />
        {/* Shine highlight */}
        <path d="M30 54 Q33 49 38 51" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Coins spilling out */}
        <ellipse cx="37" cy="84" rx="8" ry="5.5" fill="#FACC15" stroke="#D97706" strokeWidth="1.5" />
        <ellipse cx="59" cy="84" rx="8" ry="5.5" fill="#FACC15" stroke="#D97706" strokeWidth="1.5" />
        <ellipse cx="48" cy="87" rx="7" ry="4.5" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
        {/* Sparkle */}
        <path d="M68 30 L69.2 34 L73 35 L69.2 36 L68 40 L66.8 36 L63 35 L66.8 34 Z" fill="#FACC15" opacity=".85" />
      </svg>
    );
  }

  /* slate → Average Score → Speedometer gauge */
  if (type === 'slate') {
    return (
      <svg viewBox="0 0 96 96" className="size-full" aria-hidden="true">
        {/* Gauge arc — background track */}
        <path d="M18 74 A34 34 0 0 1 78 74" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="11" strokeLinecap="round" />
        {/* Colored zones */}
        <path d="M18 74 A34 34 0 0 1 34 42" fill="none" stroke="#EF4444" strokeWidth="11" strokeLinecap="round" opacity=".82" />
        <path d="M34 42 A34 34 0 0 1 62 36" fill="none" stroke="#FACC15" strokeWidth="11" strokeLinecap="round" opacity=".82" />
        <path d="M62 36 A34 34 0 0 1 78 74" fill="none" stroke="#22C55E" strokeWidth="11" strokeLinecap="round" opacity=".82" />
        {/* Gauge inner ring */}
        <path d="M22 74 A30 30 0 0 1 74 74" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="3" strokeLinecap="round" />
        {/* Tick marks */}
        <path d="M18 74 L22 74 M78 74 L74 74 M48 40 L48 44" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
        {/* Needle */}
        <path d="M48 74 L64 38" stroke="#8B5CF6" strokeWidth="4.5" strokeLinecap="round" />
        {/* Hub */}
        <circle cx="48" cy="74" r="7.5" fill="#8B5CF6" />
        <circle cx="48" cy="74" r="3.5" fill="rgba(255,255,255,0.5)" />
        {/* Bottom line */}
        <path d="M22 80 H74" stroke="rgba(148,163,184,0.28)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  /* violet → Quiz Day Streak → Calendar with flames */
  if (type === 'violet') {
    return (
      <svg viewBox="0 0 96 96" className="size-full" aria-hidden="true">
        {/* Calendar body */}
        <rect x="14" y="22" width="68" height="62" rx="9" fill="rgba(124,58,237,0.16)" stroke="#7C3AED" strokeWidth="2.5" />
        {/* Header bar */}
        <rect x="14" y="22" width="68" height="20" rx="9" fill="#7C3AED" />
        <rect x="14" y="34" width="68" height="8" fill="#7C3AED" />
        {/* Calendar rings */}
        <rect x="28" y="16" width="7" height="13" rx="3.5" fill="#6D28D9" stroke="#4C1D95" strokeWidth="1" />
        <rect x="61" y="16" width="7" height="13" rx="3.5" fill="#6D28D9" stroke="#4C1D95" strokeWidth="1" />
        {/* Calendar header text line */}
        <rect x="30" y="27" width="36" height="5" rx="2.5" fill="rgba(255,255,255,0.35)" />
        {/* Dot row — days */}
        <circle cx="24" cy="55" r="3.5" fill="#F97316" />
        <circle cx="36" cy="55" r="3.5" fill="#F97316" />
        <circle cx="48" cy="55" r="3.5" fill="#F97316" />
        <circle cx="60" cy="55" r="3.5" fill="rgba(148,163,184,0.28)" />
        <circle cx="72" cy="55" r="3.5" fill="rgba(148,163,184,0.28)" />
        {/* Flame 1 */}
        <path d="M28 80 Q26 70 31 63 Q33 70 35 63 Q40 70 38 80 Q36 85 33 87 Q30 85 28 80Z" fill="#F97316" />
        <path d="M28 80 Q27 74 31 68 Q32 74 33 80 Q31 83 28 80Z" fill="#FACC15" />
        {/* Flame 2 */}
        <path d="M42 82 Q40 72 45 65 Q47 72 49 65 Q54 72 52 82 Q50 87 47 89 Q44 87 42 82Z" fill="#EF4444" />
        <path d="M42 82 Q41 76 45 70 Q46 76 47 82 Q45 85 42 82Z" fill="#F97316" />
        {/* Flame 3 */}
        <path d="M56 80 Q54 70 59 63 Q61 70 63 63 Q68 70 66 80 Q64 85 61 87 Q58 85 56 80Z" fill="#F97316" />
        <path d="M56 80 Q55 74 59 68 Q60 74 61 80 Q59 83 56 80Z" fill="#FACC15" />
      </svg>
    );
  }

  /* blue → Active Quizzes → Rainbow battery */
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden="true">
      {/* Battery outline */}
      <rect x="10" y="30" width="64" height="36" rx="9" fill="rgba(37,99,235,0.14)" stroke="rgba(147,197,253,0.6)" strokeWidth="2.5" />
      {/* Battery nub */}
      <rect x="74" y="41" width="10" height="14" rx="4" fill="rgba(147,197,253,0.5)" />
      {/* Charge cells — rainbow */}
      <rect x="15" y="35" width="11" height="26" rx="4" fill="#22C55E" />
      <rect x="28" y="35" width="11" height="26" rx="4" fill="#84CC16" />
      <rect x="41" y="35" width="11" height="26" rx="4" fill="#EAB308" />
      <rect x="54" y="35" width="11" height="26" rx="4" fill="rgba(148,163,184,0.22)" />
      {/* Cell shine */}
      <path d="M16 38 Q21 36 25 38" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M29 38 Q34 36 38 38" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Lightning bolt overlay */}
      <path d="M52 14 L40 44 H49 L37 72 L60 38 H51 L63 14 Z" fill="#FACC15" opacity=".82" />
      <path d="M12 76 H76" stroke="rgba(148,163,184,0.28)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Visual helper components ─────────────────────────────────────────────── */

function scoreColor(pct) {
  if (pct >= 70) return { color: '#10B981', bg: 'rgba(16,185,129,.12)', border: 'rgba(16,185,129,.22)' };
  if (pct >= 50) return { color: '#F59E0B', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.22)' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.22)' };
}

function MiniRing({ pct = 0, size = 40, stroke = 3.5 }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const cx = size / 2;
  const sc = scoreColor(clamped);
  const fs = size <= 36 ? 8.5 : 10;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx={cx} cy={cx} r={r} stroke="rgba(148,163,184,.14)" strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} stroke={sc.color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx + fs * 0.4} textAnchor="middle" fill={sc.color}
        fontSize={fs} fontWeight="800" fontFamily="system-ui,sans-serif">{clamped}%</text>
    </svg>
  );
}

function MissCount({ count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 30, height: 30, borderRadius: 999,
      background: 'rgba(239,68,68,.11)', border: '1px solid rgba(239,68,68,.22)',
      fontSize: 12, fontWeight: 800, color: '#EF4444',
      flexShrink: 0, padding: '0 8px',
    }}>
      &times;{count}
    </span>
  );
}

function TypeBadge({ type }) {
  const isQuiz = type === 'quiz';
  return (
    <span style={{
      display: 'inline-flex', width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: isQuiz ? 'rgba(37,99,235,.11)' : 'rgba(14,165,233,.11)',
      border: `1px solid ${isQuiz ? 'rgba(37,99,235,.22)' : 'rgba(14,165,233,.22)'}`,
      alignItems: 'center', justifyContent: 'center',
    }} aria-hidden="true">
      {isQuiz ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="#3B82F6" strokeWidth="1.3" fill="rgba(59,130,246,.1)"/>
          <path d="M5.5 7.5c0-1.4.9-2.5 2.5-2.5s2.5 1.1 2.5 2.5c0 1-.6 1.7-1.5 2.1V11" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="13" r=".85" fill="#3B82F6"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 3A1 1 0 0 1 4 2h4v12H4a1 1 0 0 1-1-1V3Z" fill="#0EA5E9" fillOpacity=".55"/>
          <path d="M8 2h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8V2Z" fill="#0EA5E9" fillOpacity=".28"/>
          <path d="M8 2v12" stroke="#0EA5E9" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      )}
    </span>
  );
}

function LiveFireIcon() {
  return (
    <svg viewBox="0 0 28 36" className="lms-streak-fire-svg" aria-hidden="true" fill="none">
      {/* Outer flame */}
      <path className="lms-fire-outer"
        d="M14 1C12.5 7.5 8.5 10 8.5 16.5C8.5 22.5 11 27.5 14 29.5C17 27.5 19.5 22.5 19.5 16.5C19.5 10 15.5 7.5 14 1Z"
        fill="#F97316" />
      {/* Mid flame */}
      <path className="lms-fire-mid"
        d="M14 9C13 13.5 11 15.5 11 19C11 22.2 12.3 25 14 26.5C15.7 25 17 22.2 17 19C17 15.5 15 13.5 14 9Z"
        fill="#FBBF24" />
      {/* Core */}
      <path className="lms-fire-core"
        d="M14 17C13.5 19 13 20 13 21.2C13 22.8 13.4 24.2 14 25C14.6 24.2 15 22.8 15 21.2C15 20 14.5 19 14 17Z"
        fill="#FEF3C7" />
    </svg>
  );
}

function QuizStreakCard({ streak, dailyGoalsCompleted, totalGoals }) {
  const pct = totalGoals > 0 ? Math.round((dailyGoalsCompleted / totalGoals) * 100) : 0;
  const r = 27;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const streakMsg = streak >= 14 ? 'Incredible run!' : streak >= 7 ? "You're on fire!" : streak >= 3 ? 'Keep it going!' : streak > 0 ? 'Building momentum!' : 'Start today!';
  const dots = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7));

  return (
    <article className="lms-streak-card" aria-label={`Exam streak: ${streak} day${streak === 1 ? '' : 's'}`}>
      <span className="lms-streak-bg-glow" aria-hidden="true" />
      <span className="lms-streak-sp lms-streak-sp1" aria-hidden="true">✦</span>
      <span className="lms-streak-sp lms-streak-sp2" aria-hidden="true">✦</span>
      <span className="lms-streak-sp lms-streak-sp3" aria-hidden="true">+</span>

      <div className="lms-streak-fire-wrap" aria-hidden="true">
        <LiveFireIcon />
      </div>

      <div className="lms-streak-info">
        <span className="lms-streak-label">Daily Streak</span>
        <div className="lms-streak-count">
          <strong>{streak}</strong>
          <span>Day{streak === 1 ? '' : 's'}</span>
        </div>
        <div className="lms-streak-dots" aria-label={`${streak} of 7 day streak`}>
          {dots.map((active, i) => (
            <span key={i} className={`lms-streak-dot${active ? ' is-lit' : ''}`} />
          ))}
        </div>
        <p className="lms-streak-sub">{streakMsg}</p>
      </div>

      <div className="lms-streak-ring-wrap" aria-label={`Daily goal: ${pct}% complete`}>
        <svg viewBox="0 0 68 68" className="lms-streak-ring-svg" aria-hidden="true">
          <defs>
            <linearGradient id="skRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(148,163,184,0.11)" strokeWidth="4.5" />
          <circle cx="34" cy="34" r={r} fill="none"
            stroke="url(#skRingGrad)" strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
          />
        </svg>
        <div className="lms-streak-ring-label">
          <strong>{pct}%</strong>
          <small>Goal</small>
        </div>
      </div>
    </article>
  );
}

function GoalDot({ done }) {
  return (
    <span style={{
      display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      background: done ? 'rgba(37,99,235,.14)' : 'rgba(148,163,184,.09)',
      border: `1.5px solid ${done ? 'rgba(37,99,235,.38)' : 'rgba(148,163,184,.24)'}`,
      alignItems: 'center', justifyContent: 'center', transition: 'background 200ms ease, border-color 200ms ease',
    }} aria-hidden="true">
      {done ? (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 5.5L4.5 8l4.5-5" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : null}
    </span>
  );
}

function DashboardProgressRing({ value }) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const sc = scoreColor(percent);

  return (
    <div className="sd-progress-ring" aria-label={`Latest score ${percent}%`}>
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r={radius} className="sd-progress-ring__track" style={{ stroke: sc.border }} />
        <circle
          cx="52"
          cy="52"
          r={radius}
          className="sd-progress-ring__value"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: sc.color }}
        />
      </svg>
      <span>
        <strong style={{ color: sc.color }}>{percent}%</strong>
        <small>score</small>
      </span>
    </div>
  );
}

function MiniScoreRing({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const sc = scoreColor(pct);
  return (
    <div className="lms-mini-score-ring" aria-label={`Average score ${pct}%`}>
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke={sc.border} strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={sc.color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 28 28)" />
      </svg>
      <strong style={{ color: sc.color }}>{pct}%</strong>
    </div>
  );
}

function MiniSparkline({ values }) {
  if (!values || values.length < 2) return null;
  const W = 56, H = 20;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * W).toFixed(1);
    const y = (H - 2 - ((v - min) / range) * (H - 5)).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`lms-sparkline${isUp ? ' is-up' : ' is-down'}`} aria-hidden="true">
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WaveHandIcon() {
  return (
    <svg className="lms-hero-wave-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Index finger */}
      <rect x="9.2" y="2.5" width="2.1" height="7.5" rx="1.05"/>
      {/* Middle finger */}
      <rect x="11.9" y="1.5" width="2.1" height="8.5" rx="1.05"/>
      {/* Ring finger */}
      <rect x="14.6" y="2.5" width="2.1" height="7.5" rx="1.05"/>
      {/* Pinky */}
      <rect x="17.2" y="4.5" width="2" height="6" rx="1"/>
      {/* Palm + thumb */}
      <path d="M9.2 9.5H17.8V15a5 5 0 01-5 5h-1a5 5 0 01-5-5v-3.5a2 2 0 012-2zM6.5 9.5a1.5 1.5 0 00-1.5 1.5v2a1.5 1.5 0 003 0v-2a1.5 1.5 0 00-1.5-1.5z"/>
    </svg>
  );
}

function HeroCtaIcon({ type }) {
  if (type === 'secondary') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 4.5h10v11H5v-11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8 8h4M8 11h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.5 4.5 15 10l-8.5 5.5v-11Z" fill="currentColor" />
    </svg>
  );
}

function QuickActionIcon({ type }) {
  if (type === 'review') {
    /* Clipboard with a checkmark — review quiz answers */
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 3h6v2H9V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity=".18" />
        <path d="M6 4.5h12v15H6V4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 10h6M9 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9.5 16.5 11 18l3.5-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'practice') {
    /* MCQ card — practice a quiz */
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="7.5" cy="9" r="1.2" fill="currentColor" />
        <path d="M10 9h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7.5" cy="13" r="1.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7.5" cy="17" r="1.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'lesson') {
    /* Open book with ECG line — study lesson */
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14.5H6.5A2.5 2.5 0 0 0 4 21V6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M4 6.5A2.5 2.5 0 0 0 1.5 4H3a1 1 0 0 1 1 1v17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 11h2l1.5-3 2 6 1.5-3H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 18 10 8l4 7 2-4 3 7H5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function goalVisualMeta(goal) {
  if (goal?.key === 'quiz_today') {
    return { tone: 'blue', label: 'Exam', hint: goal.completed ? 'Exam done' : 'Tap to start exam' };
  }
  if (goal?.key === 'note_today') {
    return { tone: 'blue', label: 'Lesson', hint: goal.completed ? 'Lesson reviewed' : 'Tap to open a lesson' };
  }
  if (goal?.key === 'weak_topic_today') {
    return { tone: 'violet', label: 'Focus', hint: goal.completed ? 'Weak topic covered' : 'Tap to work weak area' };
  }
  return { tone: 'slate', label: 'Goal', hint: goal?.completed ? 'Done' : 'Tap to continue' };
}

function DailyGoalIcon({ goal }) {
  const meta = goalVisualMeta(goal);
  return (
    <span className={cx('sd-goal-icon', `sd-goal-icon--${meta.tone}`, goal?.completed ? 'is-complete' : '')} aria-hidden="true">
      {goal?.key === 'note_today' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H19v15.5H8.5A2.5 2.5 0 0 0 6 21V5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 5.5A2.5 2.5 0 0 0 3.5 3H5a1 1 0 0 1 1 1v17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M10 7h5M10 10h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ) : goal?.key === 'weak_topic_today' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M12 17a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M12 13.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" fill="currentColor"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M9 10h6M9 14h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M16.5 14.5 18 16l2.5-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  );
}

const defaultDashboardState = {
  totalQuizzes: 0, totalAttempts: 0, avgScore: 0, totalPassed: 0,
  passRate: 0, quizDayStreak: 0, recentAttempts: [], weakTopics: [], strongTopics: [],
  topicMastery: [], missedPatterns: [],
  dailyGoals: [], dailyGoalsCompleted: 0,
  focusTopic: '', focusCourse: '', progressTone: 'steady', progressNote: '',
  performanceSnapshot: {
    readinessScore: 0,
    readinessLabel: 'Baseline not set',
    weeklyAttempts: 0,
    weeklyAverage: 0,
    previousWeeklyAverage: 0,
    scoreDelta: 0,
    scoreTrend: 'empty',
    trendLabel: 'No exam activity yet',
    consistencyLabel: 'Start today',
  },
  adaptivePlan: [],
};

function normalizeDashboardState(data) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    ...defaultDashboardState,
    ...source,
    recentAttempts: Array.isArray(source.recentAttempts) ? source.recentAttempts : [],
    weakTopics: Array.isArray(source.weakTopics) ? source.weakTopics : [],
    strongTopics: Array.isArray(source.strongTopics) ? source.strongTopics : [],
    topicMastery: Array.isArray(source.topicMastery) ? source.topicMastery : [],
    missedPatterns: Array.isArray(source.missedPatterns) ? source.missedPatterns : [],
    dailyGoals: Array.isArray(source.dailyGoals) ? source.dailyGoals : [],
    adaptivePlan: Array.isArray(source.adaptivePlan) ? source.adaptivePlan : [],
    performanceSnapshot: {
      ...defaultDashboardState.performanceSnapshot,
      ...(source.performanceSnapshot && typeof source.performanceSnapshot === 'object' ? source.performanceSnapshot : {}),
    },
  };
}

export function StudentDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || 'there';
  const hasAdvancedInsights = Boolean(user?.featureAccess?.advancedInsights);
  const hasNotesAccess = Boolean(user?.featureAccess?.notesAccess);
  const hasExamMode = Boolean(user?.featureAccess?.examMode);
  const hasAiTools = Boolean(user?.featureAccess?.aiTools);
  const [dashboard, setDashboard] = useState(defaultDashboardState);
  const [studentQuizzes, setStudentQuizzes] = useState([]);
  const [aiNotes, setAiNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cancelSecondary = () => {};
    setLoading(true);
    setError('');

    async function loadAll() {
      try {
        const [data, quizzes] = await Promise.all([
          fetchStudentDashboard(),
          fetchStudentQuizzes().catch(() => []),
        ]);
        if (cancelled) return;
        setDashboard(normalizeDashboardState(data));
        setStudentQuizzes(quizzes);
        cancelSecondary = runWhenIdle(async () => {
          const [notes, savedItems] = await Promise.all([
            listAiNotes().catch(() => []),
            fetchStudyBookmarks().catch(() => []),
          ]);
          if (cancelled) return;
          setAiNotes(notes);
          setBookmarks(savedItems);
        });
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'Unable to load dashboard'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
      cancelSecondary();
    };
  }, [reloadKey, user?.id, user?.role, user?.status]);

  const summaryCards = useMemo(() => {
    const snap = dashboard.performanceSnapshot;
    return [
      {
        label: 'Available Exams', value: dashboard.totalQuizzes,
        hint: 'Ready to attempt', accent: 'blue', detail: 'exam sets',
      },
      {
        label: 'Total Attempts', value: dashboard.totalAttempts,
        hint: 'Completed attempts', accent: 'teal', detail: 'history',
        badge: snap.weeklyAttempts > 0 ? { text: `${snap.weeklyAttempts} this week`, tone: 'neutral' } : null,
      },
      {
        label: 'Average Score', value: `${dashboard.avgScore}%`,
        hint: 'Current performance', accent: 'slate', detail: 'mastery',
        ring: true, rawValue: dashboard.avgScore,
        sparkValues: [...dashboard.recentAttempts].slice(0, 7).reverse().map((a) => Math.round(Number(a.percentage || 0))),
        badge: snap.scoreDelta !== 0 ? { text: `${snap.scoreDelta > 0 ? '+' : ''}${snap.scoreDelta}%`, tone: snap.scoreDelta > 0 ? 'up' : 'down' } : null,
      },
      {
        label: 'Exam Day Streak', value: `${dashboard.quizDayStreak} day${dashboard.quizDayStreak === 1 ? '' : 's'}`,
        hint: 'Consecutive exam-active days', accent: 'violet', detail: 'consistency',
      },
    ];
  }, [dashboard.totalQuizzes, dashboard.totalAttempts, dashboard.avgScore, dashboard.quizDayStreak, dashboard.recentAttempts, dashboard.performanceSnapshot]);

  const inProgressQuiz = studentQuizzes.find((quiz) => quiz.practiceSessionId);
  const recommendedQuiz =
    dashboard.weakTopics.length > 0
      ? studentQuizzes.find((quiz) => {
          const weakest = dashboard.weakTopics[0];
          return (
            String(quiz.courseTitle || '').trim() === String(weakest.courseTitle || '').trim() &&
            String(quiz.topicName || '').trim() === String(weakest.topicName || '').trim()
          );
        }) || studentQuizzes.find((quiz) => !quiz.isCompleted)
      : studentQuizzes.find((quiz) => !quiz.isCompleted);
  const recommendedNote =
    dashboard.weakTopics.length > 0
      ? aiNotes.find((note) => {
          const weakest = dashboard.weakTopics[0];
          return (
            String(note.courseTitle || '').trim() === String(weakest.courseTitle || '').trim() &&
            String(note.topicName || '').trim() === String(weakest.topicName || '').trim()
          );
        }) || aiNotes[0]
      : aiNotes[0];
  const latestAttemptId = dashboard.recentAttempts[0]?.id || dashboard.recentAttempts[0]?.attemptId || null;

  const continueCard = inProgressQuiz
    ? {
        eyebrow: 'Continue where you left off',
        subheading: 'Next study move',
        moveType: 'Practice',
        title: inProgressQuiz.quizTitle,
        text: `Next question: ${Number(inProgressQuiz.lastQuestionIndex || 0) + 1}. ${inProgressQuiz.courseTitle || 'General'}${inProgressQuiz.topicName ? ` • ${inProgressQuiz.topicName}` : ''}.`,
        courseTitle: inProgressQuiz.courseTitle || 'General',
        topicName: inProgressQuiz.topicName || '',
        primaryLabel: 'Resume practice',
        primaryAction: () => navigate(`/quizzes/${inProgressQuiz.id}?mode=practice`),
        secondaryLabel: 'Open exams',
        secondaryAction: () => navigate('/exams'),
      }
    : dashboard.recentAttempts[0]
      ? {
          eyebrow: 'ERPM LMS',
          subheading: 'Next study move',
          moveType: recommendedQuiz?.id ? 'Exam' : 'Review',
          title:
            recommendedQuiz?.quizTitle
              ? recommendedQuiz.quizTitle
              : String(dashboard.recentAttempts[0].quizTitle || '').trim().length > 3
              ? dashboard.recentAttempts[0].quizTitle
              : 'Latest exam result',
          text: recommendedQuiz
            ? `Continue with ${recommendedQuiz.courseTitle || 'General'}${recommendedQuiz.topicName ? ` • ${recommendedQuiz.topicName}` : ''}.`
            : `Pick up from ${dashboard.recentAttempts[0].courseTitle || 'General'}${dashboard.recentAttempts[0].topicName ? ` • ${dashboard.recentAttempts[0].topicName}` : ''}.`,
          courseTitle: recommendedQuiz?.courseTitle || dashboard.recentAttempts[0].courseTitle || 'General',
          topicName: recommendedQuiz?.topicName || dashboard.recentAttempts[0].topicName || '',
          primaryLabel: recommendedQuiz?.id ? 'Start exam' : 'Review answers',
          primaryAction: () => {
            void nativeImpact(ImpactStyle.Light);
            navigate(recommendedQuiz?.id ? '/exams' : latestAttemptId ? `/review/${latestAttemptId}` : '/results');
          },
          secondaryLabel: recommendedQuiz?.id ? 'View last result' : 'View result',
          secondaryAction: () => {
            void nativeImpact(ImpactStyle.Light);
            navigate(latestAttemptId ? `/results/${latestAttemptId}` : '/results');
          },
        }
      : recommendedNote
        ? {
            eyebrow: 'Suggested lesson',
            subheading: 'Next study move',
            moveType: 'Lesson',
            title: recommendedNote.title,
            text: `Open ${recommendedNote.courseTitle || 'this lesson'}${recommendedNote.topicName ? ` • ${recommendedNote.topicName}` : ''} and keep your study flow moving.`,
            courseTitle: recommendedNote.courseTitle || 'Lesson',
            topicName: recommendedNote.topicName || '',
            primaryLabel: 'Open lesson',
            primaryAction: () => navigate(`/ai-notes/${recommendedNote.id}`),
            secondaryLabel: 'Browse notes',
            secondaryAction: () => navigate('/ai-notes'),
          }
        : null;

  const resumeProgressPercent = inProgressQuiz
    ? null
    : dashboard.recentAttempts[0]?.percentage
      ? Math.round(Number(dashboard.recentAttempts[0].percentage))
      : null;

  const [progressFill, setProgressFill] = useState(0);
  useEffect(() => {
    if (resumeProgressPercent === null) { setProgressFill(0); return; }
    const id = requestAnimationFrame(() => setProgressFill(Math.max(10, resumeProgressPercent)));
    return () => cancelAnimationFrame(id);
  }, [resumeProgressPercent]);

  const welcomeCard = continueCard
    ? {
        eyebrow: continueCard.eyebrow,
        subheading: continueCard.subheading,
        moveType: continueCard.moveType,
        title: continueCard.title,
        text: continueCard.text,
        courseTitle: continueCard.courseTitle || '',
        topicName: continueCard.topicName || '',
        progressPercent: resumeProgressPercent,
        primaryLabel: continueCard.primaryLabel,
        primaryAction: continueCard.primaryAction,
        secondaryLabel: continueCard.secondaryLabel,
        secondaryAction: continueCard.secondaryAction,
      }
    : {
        eyebrow: 'Start your learning journey',
        subheading: 'Next study move',
        moveType: 'Exam',
        title: 'Begin with one focused exam',
        text: 'Start a short exam first, then use lessons and review pages to build momentum.',
        courseTitle: '',
        topicName: '',
        progressPercent: null,
        primaryLabel: 'Start first exam',
        primaryAction: () => navigate('/exams'),
        secondaryLabel: 'Open lessons',
        secondaryAction: () => navigate('/ai-notes'),
      };

  const quickActions = [
    dashboard.recentAttempts[0]
      ? {
          key: 'review',
          type: 'review',
          label: 'Review answers',
          hint: 'Open explanations',
          action: () => {
            void nativeImpact(ImpactStyle.Light);
            navigate(latestAttemptId ? `/review/${latestAttemptId}` : '/results');
          },
        }
      : null,
    {
      key: 'practice',
      type: 'practice',
      label: inProgressQuiz ? 'Resume practice' : 'Start exam',
      hint: inProgressQuiz ? 'Continue active set' : 'Open exams',
      action: () => inProgressQuiz?.id ? navigate(`/quizzes/${inProgressQuiz.id}?mode=practice`) : navigate('/exams'),
    },
    recommendedNote?.id
      ? {
          key: 'lesson',
          type: 'lesson',
          label: 'Review lesson',
          hint: 'Study weak area',
          action: () => navigate(`/ai-notes/${recommendedNote.id}`),
        }
      : {
          key: 'lesson',
          type: 'lesson',
          label: 'Open lessons',
          hint: 'Browse notes',
          action: () => navigate('/ai-notes'),
    },
  ].filter(Boolean);

  const studyNextSteps = [
    recommendedQuiz
      ? {
          eyebrow: 'Study Next',
          title: dashboard.weakTopics[0]?.topicName ? `Exam practice: ${dashboard.weakTopics[0].topicName}` : recommendedQuiz.quizTitle,
          text: dashboard.weakTopics[0]
            ? `Your weakest area right now is ${dashboard.weakTopics[0].topicName} in ${dashboard.weakTopics[0].courseTitle}.`
            : 'Start an exam to build today’s study rhythm.',
          primaryLabel: recommendedQuiz.practiceSessionId ? 'Continue practice' : 'Start exam',
          primaryAction: () => recommendedQuiz.practiceSessionId ? navigate(`/quizzes/${recommendedQuiz.id}?mode=practice`) : navigate('/exams'),
          secondaryLabel: 'Open exams',
          secondaryAction: () => navigate('/exams'),
        }
      : null,
    recommendedNote
      ? {
          eyebrow: 'Review This Note',
          title: recommendedNote.title,
          text: `${recommendedNote.courseTitle || 'Lesson'}${recommendedNote.topicName ? ` • ${recommendedNote.topicName}` : ''}${recommendedNote.subtopicName ? ` • ${recommendedNote.subtopicName}` : ''}`,
          primaryLabel: 'Open lesson',
          primaryAction: () => navigate(`/ai-notes/${recommendedNote.id}`),
          secondaryLabel: 'All notes',
          secondaryAction: () => navigate('/ai-notes'),
        }
      : null,
    {
      eyebrow: 'Daily Goal',
      title: dashboard.totalAttempts === 0 ? 'Complete your first exam today' : 'Do one focused revision cycle',
      text:
        dashboard.totalAttempts === 0
          ? 'Start with one short exam, then review the result immediately.'
          : dashboard.weakTopics[0]
            ? `Do 1 exam on ${dashboard.weakTopics[0].topicName}, then review the lesson before finishing.`
            : 'Complete one exam and review one result to keep your streak alive.',
      primaryLabel: 'Start now',
      primaryAction: () => navigate('/exams'),
      secondaryLabel: 'See results',
      secondaryAction: () => navigate('/results'),
    },
  ].filter(Boolean);
  const studyNextPrimarySteps = studyNextSteps.filter((step) => step.eyebrow !== 'Daily Goal');

  const planAction = (actionType) => {
    if (actionType === 'note') {
      if (recommendedNote?.id) {
        navigate(`/ai-notes/${recommendedNote.id}`);
        return;
      }
      navigate('/ai-notes');
      return;
    }
    if (actionType === 'results') {
      if (latestAttemptId) {
        navigate(`/results/${latestAttemptId}`);
        return;
      }
      navigate('/results');
      return;
    }
    if (recommendedQuiz?.id) {
      navigate('/exams');
      return;
    }
    navigate('/exams');
  };

  const dailyGoalAction = (goal) => {
    const key = goal?.key;
    if (key === 'quiz_today') {
      navigate('/exams');
      return;
    }
    if (key === 'note_today') {
      if (recommendedNote?.id) {
        navigate(`/ai-notes/${recommendedNote.id}`);
        return;
      }
      navigate('/ai-notes');
      return;
    }
    if (key === 'weak_topic_today') {
      if (recommendedNote?.id) {
        navigate(`/ai-notes/${recommendedNote.id}`);
        return;
      }
      navigate('/exams');
      return;
    }
    navigate('/dashboard');
  };

  const planStatusClass = (status) => {
    if (status === 'done') {
      return 'border-brand-success/20 bg-brand-success/10 text-brand-success';
    }
    if (status === 'next') {
      return 'border-brand-primary/20 bg-brand-primary/10 text-brand-primary';
    }
    return 'border-line-medium bg-surface-2 text-ink-muted';
  };

  const xpTotal = Math.max(0, Math.round(
    dashboard.totalAttempts * 25 +
    dashboard.totalPassed * 35 +
    dashboard.dailyGoalsCompleted * 20 +
    dashboard.quizDayStreak * 15 +
    (dashboard.performanceSnapshot?.readinessScore || 0)
  ));
  const studentLevel = Math.max(1, Math.floor(xpTotal / 220) + 1);
  const levelProgress = xpTotal % 220;
  const levelProgressPercent = Math.round((levelProgress / 220) * 100);
  const earnedBadges = [
    dashboard.quizDayStreak >= 3 ? 'Streak Builder' : null,
    dashboard.passRate >= 70 ? 'Accuracy Climber' : null,
    dashboard.totalAttempts >= 5 ? 'Exam Regular' : null,
    dashboard.dailyGoalsCompleted >= 2 ? 'Daily Finisher' : null,
  ].filter(Boolean);
  const todayPrimary = inProgressQuiz
    ? {
        title: 'Resume your active practice',
        text: `Continue ${inProgressQuiz.quizTitle} from question ${Number(inProgressQuiz.lastQuestionIndex || 0) + 1}.`,
        label: 'Resume Practice',
        action: () => navigate(`/quizzes/${inProgressQuiz.id}?mode=practice`),
      }
    : dashboard.weakTopics[0]
      ? {
          title: `Review ${dashboard.weakTopics[0].topicName} today`,
          text: `${dashboard.weakTopics[0].courseTitle} is the clearest place to gain points right now.`,
          label: 'Start Exam',
          action: () => navigate('/exams'),
        }
      : {
          title: 'Complete one focused study loop',
          text: 'Read a lesson, answer a short exam, and review the result while it is fresh.',
          label: 'Open Exams',
          action: () => navigate('/exams'),
        };
  const masteryMapItems = [
    ...(dashboard.weakTopics || []).slice(0, 2).map((topic) => ({ ...topic, state: 'weak', label: 'Focus' })),
    ...(dashboard.topicMastery || []).filter((topic) => topic.mastery === 'improving').slice(0, 2).map((topic) => ({ ...topic, state: 'improving', label: 'Improving' })),
    ...(dashboard.strongTopics || []).slice(0, 2).map((topic) => ({ ...topic, state: 'strong', label: 'Strong' })),
  ].slice(0, 6);
  const masteryNodeClass = (state) => {
    if (state === 'strong') return dashboardUi.masteryNodeStrong;
    if (state === 'improving') return dashboardUi.masteryNodeImproving;
    return dashboardUi.masteryNodeWeak;
  };
  const masteryDotClass = (state) => {
    if (state === 'strong') return 'bg-brand-success';
    if (state === 'improving') return 'bg-amber-500';
    return 'bg-brand-error';
  };

  const premiumPreviewCards = [
    !hasNotesAccess
      ? {
          key: 'notes',
          title: 'Illustrated lessons',
          text: 'Browse the lesson library and unlock full reading, study mode, and exports with Standard.',
          featureKey: 'notesAccess',
        }
      : null,
    !hasExamMode
      ? {
          key: 'exam',
          title: 'Timed exam mode',
          text: 'Practice is visible now. Timer-based exam sessions are included with selected subscriptions.',
          featureKey: 'examMode',
        }
      : null,
    !hasAiTools
      ? {
          key: 'ai',
          title: 'AI study tools',
          text: 'See AI-powered study help across the LMS and unlock it when you are ready.',
          featureKey: 'aiTools',
        }
      : null,
  ].filter(Boolean);
  return (
    <main className={cx(ui.screenShell, 'dashboard-page')}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Study Hub"
          subtitle="Your personalized revision command center — progress, weak spots, and next steps at a glance."
        />

        {error ? (
          <div className={cx(ui.feedbackError, 'flex items-center justify-between gap-3')}>
            <span>{error}</span>
            <button type="button" className={ui.ghostSmall} onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
          </div>
        ) : null}

        {/* Hero — skeleton while loading, shared dashboard hero for every account state */}
        {loading ? (
          <div
            className="relative overflow-hidden rounded-xl border border-line-soft bg-surface-1 p-7 dark:border-white/10 dark:bg-white/[0.03]"
            aria-hidden="true"
          >
            <div className="grid gap-4">
              <div className={cx(ui.skeletonLine, 'h-3 w-16')} />
              <div className={cx(ui.skeletonLine, 'h-7 w-72 max-w-full')} />
              <div className={cx(ui.skeletonLine, 'h-4 w-96 max-w-full')} />
              <div className="mt-1 flex gap-2">
                <div className={cx(ui.skeletonLine, 'h-6 w-28 rounded-full')} />
                <div className={cx(ui.skeletonLine, 'h-6 w-20 rounded-full')} />
                <div className={cx(ui.skeletonLine, 'h-6 w-24 rounded-full')} />
              </div>
            </div>
          </div>
        ) : (
          (() => {
            const heroSc = resumeProgressPercent !== null ? scoreColor(resumeProgressPercent) : null;
            const heroBand = resumeProgressPercent !== null ? (resumeProgressPercent >= 70 ? 'pass' : resumeProgressPercent >= 50 ? 'mid' : 'fail') : 'none';
            const heroCourse = welcomeCard.courseTitle || null;
            const heroTopic = welcomeCard.topicName || null;
            const heroResultLabel = heroBand === 'mid' ? 'Average' : heroBand === 'fail' ? 'Needs Work' : null;
            return (
              <section
                className={cx(dashboardUi.hero, 'animate-fadePop')}
                aria-label="Study progress overview"
                data-score-band={dashboard.avgScore >= 70 ? 'pass' : dashboard.avgScore >= 50 ? 'mid' : 'fail'}
                data-study-move={String(welcomeCard.moveType || '').trim().toLowerCase()}
                style={heroSc ? { '--rc-score-color': heroSc.color, '--rc-score-bg': heroSc.bg, '--rc-score-border': heroSc.border } : {}}
              >
                <div className="lms-dashboard-welcome-copy relative">
                  <span className="lms-rc-eyebrow">{welcomeCard.eyebrow}</span>
                  <h2 className={dashboardUi.heroTitle}>
                    Welcome back,{' '}
                    <span className="lms-hero-name-gradient">{firstName}</span>
                    {' '}<WaveHandIcon />
                  </h2>
                  {welcomeCard.subheading && (
                    <p className="lms-hero-next-step">
                      <span>{welcomeCard.subheading}</span>
                      {welcomeCard.moveType ? <strong>{welcomeCard.moveType}</strong> : null}
                    </p>
                  )}
                  {(heroCourse || heroTopic) && (
                    <div className="lms-rc-tags">
                      {heroCourse && <span className="lms-rc-tag">{heroCourse}</span>}
                      {heroTopic && <span className="lms-rc-tag lms-rc-tag--topic">{heroTopic}</span>}
                    </div>
                  )}
                  {heroResultLabel && (
                    <span className="lms-rc-result-badge lms-hero-result-badge">
                      {heroBand === 'pass' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : heroBand === 'fail' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 3v3.5M6 9v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      )}
                      {heroResultLabel}
                    </span>
                  )}
                </div>
                <div className="lms-dashboard-welcome-mascot lms-mascot-breathing lms-hero-mascot-col flex items-center justify-center min-w-0">
                  <HeroMedicalIllustration />
                </div>
                <div className="lms-dashboard-hero-actions">
                  <button type="button" className="lms-dashboard-hero-primary" onClick={welcomeCard.primaryAction}>
                    <HeroCtaIcon />
                    <span>{welcomeCard.primaryLabel}</span>
                  </button>
                  {welcomeCard.secondaryLabel && (
                    <button type="button" className="lms-dashboard-hero-secondary" onClick={welcomeCard.secondaryAction}>
                      <HeroCtaIcon type="secondary" />
                      <span>{welcomeCard.secondaryLabel}</span>
                    </button>
                  )}
                </div>
              </section>
            );
          })()
        )}

        {!loading ? (
          <QuizStreakCard
            streak={dashboard.quizDayStreak}
            dailyGoalsCompleted={dashboard.dailyGoalsCompleted}
            totalGoals={dashboard.dailyGoals.length || 3}
          />
        ) : null}

        {!loading ? (
          <section className="lms-dashboard-quick-actions" aria-label="Quick actions">
            {quickActions.map((item) => (
              <button type="button" key={item.key} className={`lms-dashboard-quick-action lms-dashboard-quick-action--${item.type}`} onClick={item.action}>
                <span className="lms-dashboard-quick-action__icon"><QuickActionIcon type={item.type} /></span>
                <span className="lms-dashboard-quick-action__copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {/* Illustrated metric cards */}
        <div className="lms-imc-grid" role="region" aria-label="Performance overview">
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="lms-imc-card lms-imc-card--skeleton">
                  <div className={cx(ui.skeletonLine, 'h-full rounded-2xl')} />
                </div>
              ))
            : summaryCards.map((card) => (
                <div key={card.label} className={`lms-imc-card lms-imc-card--${card.accent} animate-fadePop`} aria-label={`${card.label}: ${card.value}`}>
                  <MetricCardArt type={card.accent} />
                  <div className="lms-imc-content">
                    <strong className="lms-imc-value">{card.value}</strong>
                    <span className="lms-imc-label">{card.label}</span>
                    {card.badge && (
                      <span className={`lms-imc-badge lms-imc-badge--${card.badge.tone}`}>
                        {card.badge.text}
                      </span>
                    )}
                  </div>
                </div>
              ))
          }
        </div>

        {!loading ? (
          <div className={cx('lms-score-today-grid', dashboard.recentAttempts.length < 2 && 'lms-score-today-grid--single')}>
            {/* Score Trend Chart */}
            {dashboard.recentAttempts.length >= 2 ? (
              <div className={cx(dashboardCard, 'lms-score-trend-card animate-fadePop')} aria-label="Score trend chart">
                <div className="lms-stc-header">
                  <div>
                    <span className={ui.eyebrow}>Score Trend</span>
                    <h2 className={dashboardCardTitle}>
                      Your last {Math.min(dashboard.recentAttempts.length, 8)} exam results
                    </h2>
                  </div>
                  <div className="lms-stc-badges">
                    <div className="lms-stc-stat">
                      <strong style={{ color: scoreColor(dashboard.avgScore).color }}>{dashboard.avgScore}%</strong>
                      <span>avg</span>
                    </div>
                    {dashboard.performanceSnapshot?.scoreDelta !== 0 && dashboard.performanceSnapshot?.scoreDelta != null && (
                      <div className={`lms-stc-delta lms-stc-delta--${dashboard.performanceSnapshot.scoreDelta >= 0 ? 'up' : 'down'}`}>
                        {dashboard.performanceSnapshot.scoreDelta >= 0 ? '▲' : '▼'}
                        {Math.abs(dashboard.performanceSnapshot.scoreDelta)}%
                      </div>
                    )}
                  </div>
                </div>
                <ScoreTrendChart attempts={dashboard.recentAttempts} />
              </div>
            ) : null}

            {/* Today's Study */}
            <section className={cx(dashboardCard, 'lms-dashboard-today-shell')} aria-label="Today's study plan">
              <div className={dashboardUi.todayCard}>
                <span className={ui.eyebrow}>Today's Study</span>
                <h2 className={dashboardUi.todayTitle}>{todayPrimary.title}</h2>
                <div className="sd-study-route" aria-label="Recommended study flow">
                  <span className="sd-study-node sd-study-node--review is-active">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 6.5h12M4 10h8M4 13.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                    Review
                  </span>
                  <span className="sd-study-line" aria-hidden="true" />
                  <span className="sd-study-node sd-study-node--practice">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M5 5h10v10H5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
                      <path d="M8 9h4M8 12h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                    Exam
                  </span>
                  <span className="sd-study-line" aria-hidden="true" />
                  <span className="sd-study-node sd-study-node--track">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 14.5 8 10l3 2.5 5-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 16h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                    Track
                  </span>
                </div>
                <p className={cx(dashboardUi.todayText, 'sd-today-summary')}>{todayPrimary.text}</p>
                <div className={dashboardUi.todayActions}>
                  <button type="button" className={cx(ui.primaryAction, 'sd-today-action sd-today-action-primary')} onClick={todayPrimary.action}>{todayPrimary.label}</button>
                  {recommendedNote?.id ? (
                    <button type="button" className={cx(ui.secondaryAction, 'sd-today-action')} onClick={() => navigate(`/ai-notes/${recommendedNote.id}`)}>Review Lesson</button>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!loading ? (
          <div className="lms-today-goals-grid lms-daily-goals-grid">
            {/* Daily Goals */}
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>Daily Goals</span>
              <h2 className={dashboardCardTitle}>{dashboard.dailyGoalsCompleted}/{dashboard.dailyGoals.length || 3} goals completed today.</h2>
              <div className="flex flex-col gap-2">
                {dashboard.dailyGoals.map((goal) => {
                  const meta = goalVisualMeta(goal);
                  return (
                    <button
                      className={cx(dashboardUi.insightRow, dashboardUi.insightRowButton, 'sd-data-row sd-goal-row')}
                      type="button"
                      key={goal.key}
                      onClick={() => dailyGoalAction(goal)}
                    >
                      <DailyGoalIcon goal={goal} />
                      <div className="sd-goal-main">
                        <div className="sd-goal-topline">
                          <strong style={{ opacity: goal.completed ? 0.58 : 1, textDecoration: goal.completed ? 'line-through' : 'none' }}>{goal.title}</strong>
                          <span className="sd-goal-label">{meta.label}</span>
                        </div>
                        <span className="sd-goal-hint">{meta.hint}</span>
                      </div>
                      {goal.completed ? (
                        <span className="sd-goal-check" aria-label="Completed">
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M5 10.4 8.4 13.8 15 6.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : (
                        <span className="sd-status-pill" style={{
                          background: 'rgba(148,163,184,.09)',
                          borderColor: 'rgba(148,163,184,.2)',
                          color: 'var(--ink-muted)',
                        }}>
                          {goal.progressText || 'Pending'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </article>
          </div>
        ) : null}

        {/* Recent Attempts */}
        <div className={cx(ui.dashboardCardGrid, 'lms-dashboard-main-grid lms-card-stagger')}>
          <article className={dashboardCard}>
            <span className={ui.eyebrow}>Recent Attempts</span>
            <h2 className={ui.dashboardCardTitle}>Return to the sessions that define your momentum.</h2>
            <div className="flex flex-col gap-2">
              {dashboard.recentAttempts.length === 0
                ? <div className={ui.emptyBox}>No submitted attempts yet.</div>
                : dashboard.recentAttempts.map((attempt) => {
                    const pct = Math.round(Number(attempt.percentage));
                    const sc = scoreColor(pct);
                    return (
                      <button className={cx(dashboardUi.insightRow, dashboardUi.insightRowButton, 'sd-data-row')}
                        type="button"
                        key={attempt.id}
                        onClick={() => navigate(`/results/${attempt.id}`)}
                      >
                        <MiniRing pct={pct} />
                        <div className="sd-attempt-copy">
                          <span className="sd-attempt-label">Exam</span>
                          <strong>{attempt.quizTitle || 'Untitled exam'}</strong>
                          <span>{attempt.courseTitle || 'General'}{attempt.topicName ? ` • ${attempt.topicName}` : ''}</span>
                        </div>
                        <span className="sd-status-pill" style={{ background: sc.bg, borderColor: sc.border, color: sc.color }}>
                          {attempt.passStatus}
                        </span>
                      </button>
                    );
                  })
              }
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
