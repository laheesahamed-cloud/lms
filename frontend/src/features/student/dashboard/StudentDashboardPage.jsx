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
  onboardingHero:
    'relative mb-6 overflow-hidden rounded-2xl border-[1.5px] border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1)),color-mix(in_srgb,var(--color-teal)_4%,var(--surface-1))_52%,var(--surface-1))] px-7 py-8 pb-7 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_8%_12%,color-mix(in_srgb,var(--color-primary)_16%,transparent)_0%,transparent_40%),radial-gradient(ellipse_at_94%_22%,color-mix(in_srgb,var(--color-secondary)_12%,transparent)_0%,transparent_36%),radial-gradient(ellipse_at_28%_100%,color-mix(in_srgb,var(--color-teal)_12%,transparent)_0%,transparent_45%)] before:content-[""] after:absolute after:left-0 after:right-0 after:top-0 after:h-0.5 after:rounded-t-full after:bg-[var(--brand-gradient-primary)] after:opacity-65 after:content-[""] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(37,99,235,0.11),rgba(20,184,166,0.055)_50%,rgba(255,255,255,0.035))] max-[560px]:rounded-xl max-[560px]:px-4 max-[560px]:py-5',
  onboardingGreeting: 'relative mb-6 grid items-center gap-5 min-[920px]:grid-cols-[190px_minmax(0,1fr)]',
  onboardingTitle: 'm-0 mb-1 text-[clamp(22px,2.4vw,30px)] font-extrabold leading-tight text-ink-strong dark:text-white/90',
  onboardingText: 'm-0 text-sm text-ink-soft dark:text-white/55',
  onboardingSteps: 'relative grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-0 max-[1020px]:grid-cols-1 max-[1020px]:gap-5',
  onboardingStep:
    'relative flex min-h-[260px] flex-col items-start overflow-hidden rounded-xl border border-line-soft bg-[color-mix(in_srgb,var(--surface-card)_90%,transparent)] shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] max-[560px]:min-h-0',
  onboardingStepNumber:
    'absolute left-4 top-4 z-[2] flex size-[26px] items-center justify-center rounded-full bg-brand-primary text-[11px] font-extrabold text-white shadow-[0_8px_18px_color-mix(in_srgb,var(--color-primary)_28%,transparent)]',
  onboardingStepArt:
    'relative grid h-[132px] w-full place-items-center overflow-hidden border-b border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_10%,var(--surface-2)),color-mix(in_srgb,var(--color-teal)_8%,var(--surface-2)))] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(59,130,246,0.18),rgba(20,184,166,0.09),rgba(255,255,255,0.035))] max-[560px]:h-[110px]',
  onboardingStepBody: 'flex flex-1 flex-col gap-1.5 px-5 py-[18px]',
  onboardingStepHeading: 'text-[16px] font-extrabold leading-snug text-ink-strong dark:text-white/90',
  onboardingStepText: 'm-0 text-[12.5px] leading-relaxed text-ink-soft dark:text-white/50',
  onboardingButton:
    'mt-auto inline-flex min-h-10 items-center justify-center self-start rounded-full border px-3.5 py-[7px] font-body text-[12.5px] font-bold transition hover:-translate-y-px hover:opacity-85 max-[560px]:w-full',
  onboardingDivider:
    'mt-[118px] flex items-center justify-center px-2.5 text-xl text-ink-muted opacity-50 max-[1020px]:hidden',
  onboardingTip:
    'relative mt-5 flex items-center gap-2 rounded-sm border border-line-soft bg-surface-0 px-3.5 py-2.5 text-[12.5px] text-ink-muted dark:border-white/10 dark:bg-white/[0.04]',
  onboardingKbd:
    'rounded border border-line-medium bg-surface-3 px-1.5 py-px font-[inherit] text-[10.5px] text-ink-medium',
  hero:
    'relative grid items-center gap-6 overflow-hidden rounded-2xl border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1)),color-mix(in_srgb,var(--color-teal)_5%,var(--surface-1))_55%,var(--surface-1))] px-8 py-7 shadow-md before:pointer-events-none before:absolute before:-right-10 before:-top-10 before:size-[240px] before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_70%)] before:content-[""] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(37,99,235,0.12),rgba(20,184,166,0.055)_55%,rgba(255,255,255,0.035))] min-[980px]:grid-cols-[180px_minmax(0,1fr)_auto] max-[979px]:grid-cols-1 max-[560px]:gap-4 max-[560px]:rounded-xl max-[560px]:px-4 max-[560px]:py-5',
  heroTitle: 'my-2.5 mb-2.5 text-[clamp(20px,2.5vw,26px)] font-extrabold leading-tight text-ink-strong',
  heroText: 'm-0 mb-4 max-w-[520px] text-sm leading-relaxed text-ink-soft',
  heroPills: 'mb-5 flex flex-wrap gap-2',
  heroPill:
    'rounded-full border border-line-medium bg-surface-glass px-3 py-1.5 text-xs font-semibold text-ink-medium backdrop-blur-lg',
  focusCard:
    'w-full min-w-[240px] max-w-[340px] rounded-lg border border-line-soft bg-surface-glass-strong p-5 shadow-lg backdrop-blur-2xl max-[860px]:max-w-none',
  focusTitle: 'my-1.5 mb-2 text-base font-extrabold leading-snug text-ink-strong',
  focusText: 'm-0 mb-2.5 text-[12.5px] leading-normal text-ink-soft',
  progressWrap: 'my-1 grid gap-2',
  progressTop: 'flex items-center justify-between gap-2.5 text-xs text-ink-soft',
  progressValue: 'text-sm font-bold text-ink-strong',
  progressTrack: 'my-2 h-[7px] overflow-hidden rounded-full bg-surface-3',
  progressFill:
    'relative block h-full overflow-hidden rounded-full bg-[var(--brand-gradient-primary)] shadow-[0_0_10px_rgba(37,99,235,0.35)] transition-[width] duration-700 ease-out after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] after:bg-[length:200%_100%] after:content-[""] after:animate-progressShimmer',
  focusStats: 'mt-2.5 flex gap-4',
  focusStat: 'flex flex-col gap-0.5',
  focusStatLabel: 'text-[10.5px] text-ink-muted',
  focusStatValue: 'text-base font-extrabold text-ink-strong',
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
    'pointer-events-none absolute bottom-2 right-2 grid size-[86px] place-items-center opacity-[0.78] dark:opacity-[0.9]',
  metricGlow:
    'pointer-events-none absolute -right-[30px] -top-[30px] size-[130px] rounded-full opacity-70 blur-[32px]',
  metricGlowTone: {
    blue: 'bg-[radial-gradient(circle,rgba(37,99,235,0.3),transparent_70%)] opacity-80',
    teal: 'bg-[radial-gradient(circle,rgba(13,148,136,0.3),transparent_70%)] opacity-70',
    slate: 'bg-[radial-gradient(circle,rgba(79,70,229,0.25),transparent_70%)] opacity-70',
    violet: 'bg-[radial-gradient(circle,rgba(124,58,237,0.25),transparent_70%)] opacity-65',
  },
  insightRow:
    'flex w-full items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-left transition [&>div:first-child]:flex [&>div:first-child]:flex-col [&>div:first-child]:gap-0.5 [&_strong]:text-[13.5px] [&_strong]:font-bold [&_strong]:text-ink-strong [&_span]:text-xs [&_span]:text-ink-soft',
  insightRowButton: 'hover:-translate-y-0.5 hover:border-brand-primary/20 hover:bg-surface-1 hover:shadow-sm',
  insightScore:
    'flex shrink-0 flex-col items-end gap-0.5 [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:text-[11px] [&_span]:text-ink-soft',
};

const onboardingTone = {
  blue: {
    icon: 'bg-brand-primary/10 text-brand-primary',
    button: 'bg-brand-primary/10 text-brand-primary',
  },
  green: {
    icon: 'bg-brand-success/10 text-brand-success',
    button: 'bg-brand-success/10 text-brand-success',
  },
  violet: {
    icon: 'bg-brand-violet/10 text-brand-violet',
    button: 'bg-brand-violet/10 text-brand-violet',
  },
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

function MedicalMascotIllustration({ compact = false }) {
  return (
    <svg
      className={cx('relative z-[1] h-auto w-full drop-shadow-[0_22px_44px_rgba(37,99,235,0.24)]', compact ? 'max-w-[150px]' : 'max-w-[190px]')}
      viewBox="0 0 190 195"
      role="img"
      aria-label="Friendly cartoon doctor waving with stethoscope and clipboard"
    >
      <defs>
        <linearGradient id="mmCoat" x1="56" y1="84" x2="134" y2="192" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EFF6FF" />
        </linearGradient>
        <linearGradient id="mmScrub" x1="80" y1="108" x2="110" y2="192" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0D9488" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <radialGradient id="mmSkin" cx="38%" cy="32%" r="62%" gradientUnits="objectBoundingBox">
          <stop stopColor="#FFCBA4" />
          <stop offset="1" stopColor="#F09860" />
        </radialGradient>
        <radialGradient id="mmMetal" cx="32%" cy="28%" r="68%" gradientUnits="objectBoundingBox">
          <stop stopColor="#94A3B8" />
          <stop offset="1" stopColor="#1E293B" />
        </radialGradient>
        <filter id="mmS" x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#1D4ED8" floodOpacity="0.14" />
        </filter>
        <filter id="mmG" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="mmG2" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── ATMOSPHERE ── */}
      <circle cx="158" cy="28" r="38" fill="rgba(96,165,250,0.20)" />
      <circle cx="30" cy="168" r="26" fill="rgba(13,148,136,0.17)" />
      <circle cx="174" cy="148" r="14" fill="rgba(167,139,250,0.14)" />

      {/* ── FLOATING MEDICAL ACCENTS ── */}
      {/* Heartbeat line — top-left */}
      <path d="M8 56 H20 L24 47 L28 65 L32 50 L36 58 H48"
        stroke="#F472B6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        fill="none" opacity=".52" />
      {/* Medical + cross — top-right */}
      <rect x="160" y="48" width="14" height="5" rx="2.5" fill="#EF4444" opacity=".58" />
      <rect x="164.5" y="43.5" width="5" height="14" rx="2.5" fill="#EF4444" opacity=".58" />
      {/* Molecule dots */}
      <circle cx="14" cy="108" r="4.5" fill="rgba(96,165,250,0.55)" filter="url(#mmG2)" />
      <circle cx="26" cy="124" r="3" fill="rgba(52,211,153,0.55)" />
      <path d="M14 112 L26 124" stroke="rgba(96,165,250,0.28)" strokeWidth="1.5" />

      {/* ── LEFT WAVING ARM (behind body, draw first) ── */}
      <path d="M62 88 Q44 82 30 68 Q18 56 24 44 Q30 34 42 40 Q54 48 58 64 Q60 76 62 88Z"
        fill="url(#mmCoat)" stroke="#BFDBFE" strokeWidth="1.5" filter="url(#mmS)" />
      {/* Left waving hand */}
      <ellipse cx="24" cy="42" rx="11" ry="12" fill="url(#mmSkin)" stroke="#E8956A" strokeWidth="1.2" />
      {/* Fingers spread — fanned upward */}
      <path d="M14 39 Q10 29 16 27 Q22 25 21 35" stroke="#FFCBA4" strokeWidth="6.5" strokeLinecap="round" fill="none" />
      <path d="M19 34 Q16 23 23 21 Q30 20 28 31" stroke="#FFCBA4" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M25 31 Q24 20 31 20 Q38 20 35 30" stroke="#FFCBA4" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      {/* Thumb */}
      <path d="M13 44 Q5 40 7 33 Q10 26 18 31" stroke="#FFCBA4" strokeWidth="5.5" strokeLinecap="round" fill="none" />

      {/* ── RIGHT ARM with CLIPBOARD (behind body) ── */}
      <path d="M128 88 Q148 90 158 108 Q166 124 158 132 Q150 138 142 126 Q134 114 130 100 Q128 94 128 88Z"
        fill="url(#mmCoat)" stroke="#BFDBFE" strokeWidth="1.5" filter="url(#mmS)" />
      {/* Clipboard */}
      <rect x="140" y="128" width="32" height="40" rx="5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" transform="rotate(10 156 148)" />
      <rect x="150" y="124" width="12" height="7" rx="3" fill="#CBD5E1" transform="rotate(10 156 127)" />
      <path d="M145 138 L167 135 M145 144 L164 141 M145 150 L160 147 M145 156 L162 153"
        stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" transform="rotate(10 155 148)" />
      {/* Right hand */}
      <ellipse cx="158" cy="131" rx="10.5" ry="11.5" fill="url(#mmSkin)" stroke="#E8956A" strokeWidth="1.2" />

      {/* ── COAT BODY ── */}
      <path d="M62 88 C60 110 56 144 54 192 H136 C134 144 130 110 128 88Z"
        fill="url(#mmCoat)" stroke="#BFDBFE" strokeWidth="1.5" filter="url(#mmS)" />

      {/* ── SCRUBS (center panel through open coat) ── */}
      <path d="M80 108 Q80 148 78 192 H112 Q110 148 110 108Z"
        fill="url(#mmScrub)" opacity=".92" />

      {/* ── COAT LAPELS (V-neck, clearly defined) ── */}
      <path d="M96 88 L76 112 L96 104Z" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1.3" />
      <path d="M96 88 L116 112 L96 104Z" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1.3" />

      {/* ── LEFT BREAST POCKET ── */}
      <rect x="62" y="120" width="20" height="16" rx="4" fill="rgba(224,242,254,0.72)" stroke="#BAE6FD" strokeWidth="1.2" />
      {/* Red medical cross in pocket */}
      <rect x="69" y="125" width="8" height="3" rx="1.5" fill="#EF4444" />
      <rect x="71.5" y="122.5" width="3" height="8" rx="1.5" fill="#EF4444" />

      {/* ── NAME BADGE (right chest) ── */}
      <rect x="108" y="120" width="24" height="15" rx="3.5" fill="rgba(239,246,255,0.9)" stroke="#93C5FD" strokeWidth="1.2" />
      <rect x="111" y="123" width="18" height="3.5" rx="1.75" fill="#3B82F6" opacity=".55" />
      <rect x="111" y="129" width="12" height="2.5" rx="1.25" fill="#93C5FD" opacity=".65" />

      {/* ── STETHOSCOPE ── (most important doctor cue) */}
      {/* Left tube: from collar, arching UP to left earpiece */}
      <path d="M80 94 Q74 90 70 80 Q66 70 72 62"
        stroke="#1E293B" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Right tube: from collar, arching UP to right earpiece */}
      <path d="M112 94 Q118 90 122 80 Q126 70 120 62"
        stroke="#1E293B" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Left earpiece tip */}
      <ellipse cx="72" cy="61" rx="6" ry="5" fill="#334155" />
      <ellipse cx="72" cy="61" rx="3" ry="2.5" fill="#64748B" />
      {/* Right earpiece tip */}
      <ellipse cx="120" cy="61" rx="6" ry="5" fill="#334155" />
      <ellipse cx="120" cy="61" rx="3" ry="2.5" fill="#64748B" />
      {/* Y-junction: left down to center */}
      <path d="M80 94 Q86 102 96 108"
        stroke="#1E293B" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Y-junction: right down to center */}
      <path d="M112 94 Q106 102 96 108"
        stroke="#1E293B" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Drop tube */}
      <path d="M96 108 L96 124"
        stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
      {/* Chest piece — large and unmissable */}
      <circle cx="96" cy="136" r="14" fill="#1E293B" />
      <circle cx="96" cy="136" r="10" fill="url(#mmMetal)" />
      <circle cx="96" cy="136" r="5.5" fill="#475569" />
      <circle cx="92.5" cy="132.5" r="2.8" fill="rgba(255,255,255,0.38)" />

      {/* ── COAT BUTTONS (below stethoscope chest piece) ── */}
      <circle cx="96" cy="158" r="3" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.1" />
      <circle cx="96" cy="170" r="3" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.1" />

      {/* ── HEAD ── */}
      <circle cx="96" cy="50" r="30" fill="url(#mmSkin)" stroke="#E8956A" strokeWidth="1.5" />
      {/* Ears */}
      <ellipse cx="66" cy="53" rx="5.5" ry="7.5" fill="#FFCBA4" stroke="#E8956A" strokeWidth="1.2" />
      <ellipse cx="66" cy="53" rx="2.5" ry="4" fill="#F09860" opacity=".45" />
      <ellipse cx="126" cy="53" rx="5.5" ry="7.5" fill="#FFCBA4" stroke="#E8956A" strokeWidth="1.2" />
      <ellipse cx="126" cy="53" rx="2.5" ry="4" fill="#F09860" opacity=".45" />

      {/* ── HAIR ── */}
      <path d="M66 46 C70 20 88 14 96 14 C104 14 122 20 126 46 C118 28 96 28 74 36 Z" fill="#2D1810" />
      {/* Hair shine */}
      <path d="M84 17 Q96 14 108 19" stroke="#4A2A18" strokeWidth="3.5" strokeLinecap="round" opacity=".45" />

      {/* ── EYEBROWS ── */}
      <path d="M79 43 Q86 40 92 42.5" stroke="#2D1810" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M100 42.5 Q106 40 113 43" stroke="#2D1810" strokeWidth="3.2" strokeLinecap="round" fill="none" />

      {/* ── EYES (big, cartoon-style, very expressive) ── */}
      {/* Eye white — sclera */}
      <ellipse cx="86" cy="51" rx="7.5" ry="8" fill="white" />
      <ellipse cx="106" cy="51" rx="7.5" ry="8" fill="white" />
      {/* Upper lid shadow */}
      <path d="M78.5 48 Q86 44 93.5 48" fill="rgba(45,24,16,0.08)" />
      <path d="M98.5 48 Q106 44 113.5 48" fill="rgba(45,24,16,0.08)" />
      {/* Iris — rich blue-navy */}
      <circle cx="86" cy="52" r="5.5" fill="#1A3A6E" />
      <circle cx="106" cy="52" r="5.5" fill="#1A3A6E" />
      {/* Pupil */}
      <circle cx="86" cy="52.5" r="3.2" fill="#0A1628" />
      <circle cx="106" cy="52.5" r="3.2" fill="#0A1628" />
      {/* Bright highlight — primary */}
      <circle cx="88.5" cy="49.5" r="2.4" fill="white" />
      <circle cx="108.5" cy="49.5" r="2.4" fill="white" />
      {/* Secondary sparkle */}
      <circle cx="84" cy="54.5" r="1.1" fill="white" opacity=".72" />
      <circle cx="104" cy="54.5" r="1.1" fill="white" opacity=".72" />
      {/* Eyelash suggestion */}
      <path d="M78.5 47 Q86 43.5 93.5 47" stroke="#2D1810" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M98.5 47 Q106 43.5 113.5 47" stroke="#2D1810" strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* ── NOSE ── */}
      <path d="M91 60 Q96 65 101 60" stroke="#E8956A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="91.5" cy="60.5" r="1.8" fill="#F09860" opacity=".35" />
      <circle cx="100.5" cy="60.5" r="1.8" fill="#F09860" opacity=".35" />

      {/* ── SMILE ── */}
      <path d="M81 67 Q96 79 111 67" stroke="#C05621" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {/* Teeth hint */}
      <path d="M82 67.5 Q96 78 110 67.5" stroke="white" strokeWidth="6" strokeLinecap="round" opacity=".25" />
      {/* Dimples */}
      <circle cx="82" cy="69" r="1.8" fill="#E8956A" opacity=".38" />
      <circle cx="110" cy="69" r="1.8" fill="#E8956A" opacity=".38" />

      {/* ── CHEEKS ── */}
      <ellipse cx="76" cy="63" rx="8" ry="5.5" fill="#FDA4AF" opacity=".52" />
      <ellipse cx="116" cy="63" rx="8" ry="5.5" fill="#FDA4AF" opacity=".52" />

      {/* ── BRAIN COMPANION (bottom-right, clearly a mascot) ── */}
      <ellipse cx="158" cy="156" rx="24" ry="22" fill="#FDA4AF" stroke="#F472B6" strokeWidth="2.2" />
      <path d="M136 152 Q141 141 151 144 Q153 137 162 139 Q171 137 175 144 Q181 142 183 152"
        stroke="#F472B6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M147 144 Q146 136 154 136 Q161 136 160 143"
        stroke="#F472B6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M162 139 Q162 132 169 133 Q175 134 173 140"
        stroke="#F472B6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M160 141 Q158 156 160 171" stroke="#EC4899" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="151" cy="155" r="3.2" fill="#BE185D" />
      <circle cx="166" cy="155" r="3.2" fill="#BE185D" />
      <circle cx="152" cy="153.5" r="1.4" fill="white" />
      <circle cx="167" cy="153.5" r="1.4" fill="white" />
      <path d="M147 165 Q159 173 172 165" stroke="#BE185D" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Tiny star above brain */}
      <path d="M147 136 L148.5 141 L153.5 142 L148.5 143 L147 148 L145.5 143 L140.5 142 L145.5 141 Z"
        fill="#FACC15" opacity=".92" filter="url(#mmG2)" />

      {/* ── SPARKLES & STARS ── */}
      <path d="M165 38 L167 45 L174 46.5 L167 48 L165 55 L163 48 L156 46.5 L163 45 Z"
        fill="#FACC15" filter="url(#mmG2)" />
      <path d="M15 82 L16.4 87 L21 88.5 L16.4 90 L15 95 L13.6 90 L9 88.5 L13.6 87 Z"
        fill="#60A5FA" opacity=".88" />
      <circle cx="178" cy="110" r="5" fill="#34D399" opacity=".8" />
      <circle cx="174" cy="74" r="2.8" fill="#60A5FA" opacity=".68" />
      <circle cx="12" cy="138" r="2.8" fill="#FACC15" opacity=".7" />
      <circle cx="182" cy="170" r="2.2" fill="#A78BFA" opacity=".78" />

      {/* ── GROUND SHADOW ── */}
      <ellipse cx="96" cy="190" rx="46" ry="5" fill="color-mix(in srgb, var(--ink-strong) 7%, transparent)" />
    </svg>
  );
}

function StepIllustration({ type }) {
  if (type === 'quiz') {
    return (
      <svg className="h-[118px] w-full max-w-[260px]" viewBox="0 0 260 118" role="img" aria-label="Illustration of a student taking a quiz with a brain character">
        {/* MCQ card */}
        <rect x="30" y="8" width="148" height="96" rx="12" fill="rgba(15,23,42,0.82)" stroke="#334155" strokeWidth="1.5" />
        {/* Question bar */}
        <rect x="46" y="20" width="116" height="8" rx="4" fill="rgba(148,163,184,0.38)" />
        <rect x="46" y="20" width="72" height="8" rx="4" fill="rgba(148,163,184,0.55)" />
        {/* Choice 1 — checked green */}
        <rect x="46" y="34" width="116" height="16" rx="8" fill="rgba(34,197,94,0.18)" stroke="#22C55E" strokeWidth="1.3" />
        <circle cx="58" cy="42" r="5" fill="none" stroke="#22C55E" strokeWidth="1.5" />
        <circle cx="58" cy="42" r="3" fill="#22C55E" />
        <rect x="68" y="38.5" width="68" height="7" rx="3.5" fill="rgba(148,163,184,0.45)" />
        {/* Choice 2 */}
        <rect x="46" y="56" width="116" height="16" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(148,163,184,0.25)" strokeWidth="1.2" />
        <circle cx="58" cy="64" r="5" fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="1.5" />
        <rect x="68" y="60.5" width="58" height="7" rx="3.5" fill="rgba(148,163,184,0.28)" />
        {/* Choice 3 */}
        <rect x="46" y="78" width="116" height="16" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(148,163,184,0.25)" strokeWidth="1.2" />
        <circle cx="58" cy="86" r="5" fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="1.5" />
        <rect x="68" y="82.5" width="48" height="7" rx="3.5" fill="rgba(148,163,184,0.28)" />

        {/* Brain character */}
        <ellipse cx="212" cy="60" rx="36" ry="34" fill="#FDA4AF" stroke="#F472B6" strokeWidth="2.5" />
        <path d="M178 56 Q183 45 194 48 Q197 40 208 42 Q219 40 224 48 Q235 46 238 56" stroke="#F472B6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M189 48 Q189 38 198 38 Q207 38 205 46" stroke="#F472B6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M210 43 Q210 35 218 36 Q224 37 222 44" stroke="#F472B6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M213 44 Q211 60 213 77" stroke="#EC4899" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {/* Brain eyes — thinking arches */}
        <path d="M199 57 Q203 53 207 57" stroke="#BE185D" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M218 57 Q222 53 226 57" stroke="#BE185D" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Thinking bubbles */}
        <circle cx="190" cy="40" r="3" fill="#F472B6" opacity=".7" />
        <circle cx="185" cy="32" r="2.2" fill="#F472B6" opacity=".5" />
        <circle cx="182" cy="25" r="1.5" fill="#F472B6" opacity=".3" />
        {/* Smile */}
        <path d="M200 70 Q212 78 225 70" stroke="#BE185D" strokeWidth="2.2" strokeLinecap="round" fill="none" />

        {/* Accent dots */}
        <circle cx="22" cy="22" r="5.5" fill="#60A5FA" opacity=".8" />
        <circle cx="244" cy="96" r="4.5" fill="#34D399" opacity=".8" />
        <path d="M18 96 H244" stroke="color-mix(in srgb, var(--ink-soft) 14%, transparent)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'results') {
    return (
      <svg className="h-[118px] w-full max-w-[260px]" viewBox="0 0 260 118" role="img" aria-label="Illustration of a doctor reviewing results with a bar chart">
        {/* Chart card */}
        <rect x="68" y="8" width="124" height="88" rx="12" fill="rgba(15,23,42,0.80)" stroke="#334155" strokeWidth="1.5" />
        {/* Grid lines */}
        <path d="M82 86 H180" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
        <path d="M82 71 H180" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
        <path d="M82 56 H180" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
        <path d="M82 41 H180" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        {/* Bars */}
        <rect x="88" y="64" width="18" height="22" rx="5" fill="#60A5FA" opacity=".92" />
        <rect x="112" y="50" width="18" height="36" rx="5" fill="#34D399" opacity=".92" />
        <rect x="136" y="36" width="18" height="50" rx="5" fill="#A78BFA" opacity=".92" />
        <rect x="160" y="22" width="18" height="64" rx="5" fill="#FACC15" opacity=".92" />
        {/* Trend line */}
        <path d="M97 68 L121 54 L145 40 L169 26" stroke="#8B5CF6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Arrow tip */}
        <path d="M162 22 L169 24 L167 31" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Large purple upward arrow */}
        <path d="M218 102 L218 32" stroke="#8B5CF6" strokeWidth="7" strokeLinecap="round" />
        <path d="M208 46 L218 32 L228 46" stroke="#8B5CF6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

        {/* Doctor mini figure */}
        <circle cx="38" cy="40" r="13" fill="#F6B48F" stroke="#E8956A" strokeWidth="1.2" />
        <path d="M26 36 Q30 24 38 24 Q46 24 50 36 Q46 28 38 29 Z" fill="#2D1810" />
        <circle cx="34" cy="40" r="2.2" fill="#1E293B" />
        <circle cx="42" cy="40" r="2.2" fill="#1E293B" />
        <path d="M34 48 Q38 52 42 48" stroke="#C05621" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Coat */}
        <path d="M26 53 Q25 72 25 84 Q32 82 38 84 Q44 82 51 84 Q51 72 50 53 Z" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.2" />
        <path d="M32 53 L30 84 H46 L44 53 Z" fill="#14B8A6" opacity=".72" />
        {/* Arm raised with star */}
        <path d="M26 55 Q12 50 8 38 Q4 28 14 26 Q24 24 26 34 Q28 46 26 55" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.2" />
        {/* Gold star */}
        <path d="M10 18 L12 24 L18.5 25.5 L12 27 L10 33 L8 27 L1.5 25.5 L8 24 Z" fill="#FACC15" stroke="#D97706" strokeWidth="1.3" />
        {/* Second star */}
        <path d="M238 38 L240 44.5 L247 46 L240 47.5 L238 54 L236 47.5 L229 46 L236 44.5 Z" fill="#FACC15" stroke="#D97706" strokeWidth="1.3" />

        <path d="M14 104 H246" stroke="color-mix(in srgb, var(--ink-soft) 14%, transparent)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  /* type === 'notes' — student at holographic anatomy display */
  return (
    <svg className="h-[118px] w-full max-w-[260px]" viewBox="0 0 260 118" role="img" aria-label="Illustration of browsing medical lessons with holographic anatomy">
      {/* Desk surface */}
      <rect x="28" y="94" width="204" height="8" rx="4" fill="rgba(148,163,184,0.25)" />
      {/* Monitor */}
      <rect x="72" y="28" width="120" height="76" rx="9" fill="rgba(15,23,42,0.84)" stroke="#334155" strokeWidth="1.5" />
      <rect x="78" y="34" width="108" height="62" rx="5" fill="rgba(7,14,32,0.9)" />
      {/* Monitor stand */}
      <rect x="126" y="94" width="12" height="10" rx="2" fill="rgba(148,163,184,0.4)" />
      <rect x="114" y="102" width="36" height="5" rx="2.5" fill="rgba(148,163,184,0.4)" />
      {/* Holographic body — head */}
      <circle cx="132" cy="48" r="9" fill="rgba(103,232,249,0.1)" stroke="#67E8F9" strokeWidth="1.5" opacity=".85" />
      {/* Body outline */}
      <path d="M123 57 Q120 64 116 82 Q120 84 132 85 Q144 84 148 82 Q144 64 141 57 Z" fill="rgba(103,232,249,0.1)" stroke="#67E8F9" strokeWidth="1.5" opacity=".85" />
      {/* Arms */}
      <path d="M123 59 Q113 66 111 80" stroke="#67E8F9" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
      <path d="M141 59 Q151 66 153 80" stroke="#67E8F9" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
      {/* Spine glow */}
      <path d="M132 57 L132 85" stroke="#34D399" strokeWidth="2" strokeLinecap="round" opacity=".65" strokeDasharray="3 2" />
      {/* Heart pulse line */}
      <path d="M112 70 H120 L124 65 L128 75 L132 62 L136 78 L140 70 H152" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      {/* Floating data dots */}
      <circle cx="110" cy="38" r="2.2" fill="#67E8F9" opacity=".8" />
      <circle cx="156" cy="42" r="2.2" fill="#34D399" opacity=".7" />
      <circle cx="106" cy="52" r="1.5" fill="#60A5FA" opacity=".6" />
      <circle cx="160" cy="58" r="1.5" fill="#67E8F9" opacity=".6" />

      {/* Sticky notes */}
      <rect x="22" y="14" width="30" height="30" rx="3.5" fill="#FDE68A" transform="rotate(-12 37 29)" />
      <path d="M26 26 L46 26 M26 32 L40 32" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="202" y="16" width="28" height="28" rx="3.5" fill="#FDA4AF" transform="rotate(9 216 30)" />
      <path d="M206 24 L226 24 M206 30 L220 30" stroke="#BE185D" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="198" y="62" width="26" height="26" rx="3.5" fill="#86EFAC" transform="rotate(-7 211 75)" />
      <path d="M202 71 L220 71 M202 77 L215 77" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="58" width="24" height="24" rx="3.5" fill="#C4B5FD" transform="rotate(8 26 70)" />
      <path d="M18 66 L34 66 M18 72 L30 72" stroke="#6D28D9" strokeWidth="1.5" strokeLinecap="round" />

      {/* Student figure */}
      <circle cx="50" cy="54" r="11" fill="#F6B48F" stroke="#E8956A" strokeWidth="1.2" />
      <path d="M39 50 Q43 40 50 40 Q57 40 61 50 Q57 44 50 44 Z" fill="#2D1810" />
      <circle cx="46" cy="54" r="1.8" fill="#1E293B" />
      <circle cx="54" cy="54" r="1.8" fill="#1E293B" />
      <path d="M46 61 Q50 65 54 61" stroke="#C05621" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M40 65 Q38 80 38 92 Q44 90 50 92 Q56 90 62 92 Q62 80 60 65 Z" fill="#2563EB" opacity=".7" />

      <path d="M18 104 H242" stroke="color-mix(in srgb, var(--ink-soft) 14%, transparent)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function MetricIllustration({ type }) {
  /* teal → Total Attempts → Coin purse */
  if (type === 'teal') {
    return (
      <svg viewBox="0 0 96 96" className="size-full" aria-hidden="true">
        {/* Purse body */}
        <ellipse cx="48" cy="60" rx="30" ry="27" fill="rgba(14,165,233,0.18)" stroke="#0EA5E9" strokeWidth="2.5" />
        {/* Purse top drawstring area */}
        <path d="M28 44 Q38 33 48 31 Q58 33 68 44" stroke="#0891B2" strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="36" y="24" width="24" height="9" rx="4.5" fill="#0891B2" />
        {/* Medical cross on purse */}
        <rect x="42" y="54" width="12" height="4" rx="2" fill="#14B8A6" />
        <rect x="46" y="50" width="4" height="12" rx="2" fill="#14B8A6" />
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

export function StudentDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || 'there';
  const hasAdvancedInsights = Boolean(user?.featureAccess?.advancedInsights);
  const hasNotesAccess = Boolean(user?.featureAccess?.notesAccess);
  const hasExamMode = Boolean(user?.featureAccess?.examMode);
  const hasAiTools = Boolean(user?.featureAccess?.aiTools);
  const [dashboard, setDashboard] = useState({
    totalQuizzes: 0, totalAttempts: 0, avgScore: 0, totalPassed: 0,
    passRate: 0, quizDayStreak: 0, recentAttempts: [], weakTopics: [], strongTopics: [],
    topicMastery: [],
    dailyGoals: [], dailyGoalsCompleted: 0,
    focusTopic: '', focusCourse: '', progressTone: 'steady', progressNote: '',
  });
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
        setDashboard(data);
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
  }, [reloadKey]);

  const summaryCards = useMemo(() => [
    { label: 'Active Quizzes',  value: dashboard.totalQuizzes,  hint: 'Ready to attempt',           accent: 'blue',   detail: 'practice flow' },
    { label: 'Total Attempts',  value: dashboard.totalAttempts, hint: 'Completed attempts',         accent: 'teal',   detail: 'history' },
    { label: 'Average Score',   value: `${dashboard.avgScore}%`, hint: 'Current performance',      accent: 'slate',  detail: 'mastery' },
    { label: 'Quiz Day Streak', value: `${dashboard.quizDayStreak} day${dashboard.quizDayStreak === 1 ? '' : 's'}`, hint: 'Consecutive quiz-active days', accent: 'violet', detail: 'consistency' },
  ], [dashboard.totalQuizzes, dashboard.totalAttempts, dashboard.avgScore, dashboard.quizDayStreak]);

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

  const continueCard = inProgressQuiz
    ? {
        eyebrow: 'Continue Where You Stopped',
        title: inProgressQuiz.quizTitle,
        text: `${inProgressQuiz.courseTitle || 'General'}${inProgressQuiz.topicName ? ` • ${inProgressQuiz.topicName}` : ''} • Question ${Number(inProgressQuiz.lastQuestionIndex || 0) + 1}`,
        primaryLabel: 'Continue practice',
        primaryAction: () => navigate(`/quizzes/${inProgressQuiz.id}?mode=practice`),
        secondaryLabel: 'Open all quizzes',
        secondaryAction: () => navigate('/quizzes'),
      }
    : dashboard.recentAttempts[0]
      ? {
          eyebrow: 'Continue Where You Stopped',
          title: dashboard.recentAttempts[0].quizTitle,
          text: `Last completed attempt • ${dashboard.recentAttempts[0].courseTitle || 'General'}${dashboard.recentAttempts[0].topicName ? ` • ${dashboard.recentAttempts[0].topicName}` : ''}`,
          primaryLabel: 'Review result',
          primaryAction: () => navigate(`/results/${dashboard.recentAttempts[0].id}`),
          secondaryLabel: 'Open review',
          secondaryAction: () => navigate(`/review/${dashboard.recentAttempts[0].id}`),
        }
      : recommendedNote
        ? {
            eyebrow: 'Continue Where You Stopped',
            title: recommendedNote.title,
            text: `${recommendedNote.courseTitle || 'Lesson'}${recommendedNote.topicName ? ` • ${recommendedNote.topicName}` : ''}`,
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
        eyebrow: 'Continue where you stopped',
        title: continueCard.title,
        text: continueCard.text,
        progressPercent: resumeProgressPercent,
        primaryLabel: continueCard.primaryLabel === 'Continue practice' ? 'Resume' : continueCard.primaryLabel,
        primaryAction: continueCard.primaryAction,
        secondaryLabel: continueCard.secondaryLabel,
        secondaryAction: continueCard.secondaryAction,
      }
    : {
        eyebrow: 'Start your learning journey',
        title: 'Choose your next study step',
        text: 'Browse your course lessons or begin a focused practice session to build momentum today.',
        progressPercent: null,
        primaryLabel: 'Browse Courses',
        primaryAction: () => navigate('/ai-notes'),
        secondaryLabel: 'Start Practice',
        secondaryAction: () => navigate('/quizzes'),
      };

  const studyNextSteps = [
    recommendedQuiz
      ? {
          eyebrow: 'Study Next',
          title: dashboard.weakTopics[0]?.topicName ? `Practice ${dashboard.weakTopics[0].topicName}` : recommendedQuiz.quizTitle,
          text: dashboard.weakTopics[0]
            ? `Your weakest area right now is ${dashboard.weakTopics[0].topicName} in ${dashboard.weakTopics[0].courseTitle}.`
            : 'Start a quiz to build today’s study rhythm.',
          primaryLabel: recommendedQuiz.practiceSessionId ? 'Continue quiz' : 'Start practice',
          primaryAction: () => navigate(`/quizzes/${recommendedQuiz.id}?mode=practice`),
          secondaryLabel: 'Open quizzes',
          secondaryAction: () => navigate('/quizzes'),
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
      title: dashboard.totalAttempts === 0 ? 'Complete your first quiz today' : 'Do one focused revision cycle',
      text:
        dashboard.totalAttempts === 0
          ? 'Start with one short practice quiz, then review the result immediately.'
          : dashboard.weakTopics[0]
            ? `Do 1 quiz on ${dashboard.weakTopics[0].topicName}, then review the lesson before finishing.`
            : 'Complete one quiz and review one result to keep your streak alive.',
      primaryLabel: 'Start now',
      primaryAction: () => navigate('/quizzes'),
      secondaryLabel: 'See results',
      secondaryAction: () => navigate('/results'),
    },
  ].filter(Boolean);

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
          text: 'Practice is visible now. Upgrade to unlock timer-based exam sessions and a test-day workflow.',
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
    <main className={ui.screenShell}>
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

        {/* Hero — skeleton while loading, onboarding for new, focus card for returning */}
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
        ) : dashboard.totalAttempts === 0 ? (
          <section className={cx(dashboardUi.onboardingHero, 'animate-fadePop')} aria-label="Getting started guide">
            <div className={dashboardUi.onboardingGreeting}>
              <MedicalMascotIllustration />
              <div>
                <h2 className={dashboardUi.onboardingTitle}>Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!</h2>
                <p className={dashboardUi.onboardingText}>Here's how to get the most out of the platform in three simple steps.</p>
              </div>
            </div>

            <div className={dashboardUi.onboardingSteps}>
              <div className={dashboardUi.onboardingStep}>
                <div className={dashboardUi.onboardingStepNumber}>1</div>
                <div className={dashboardUi.onboardingStepArt}>
                  <StepIllustration type="notes" />
                </div>
                <div className={dashboardUi.onboardingStepBody}>
                  <strong className={dashboardUi.onboardingStepHeading}>Browse lessons</strong>
                  <p className={dashboardUi.onboardingStepText}>Visual lessons with mnemonics, callouts and colour-coded highlights for each subject.</p>
                  <button type="button" className={cx(dashboardUi.onboardingButton, onboardingTone.blue.button)} onClick={() => navigate('/ai-notes')}>
                    Open Lessons →
                  </button>
                </div>
              </div>

              <div className={dashboardUi.onboardingDivider} aria-hidden="true">›</div>

              <div className={dashboardUi.onboardingStep}>
                <div className={dashboardUi.onboardingStepNumber}>2</div>
                <div className={dashboardUi.onboardingStepArt}>
                  <StepIllustration type="quiz" />
                </div>
                <div className={dashboardUi.onboardingStepBody}>
                  <strong className={dashboardUi.onboardingStepHeading}>Take a practice quiz</strong>
                  <p className={dashboardUi.onboardingStepText}>Practice mode gives instant feedback after each question — no timer pressure, just learning.</p>
                  <button type="button" className={cx(dashboardUi.onboardingButton, onboardingTone.green.button)} onClick={() => navigate('/quizzes')}>
                    Go to Quizzes →
                  </button>
                </div>
              </div>

              <div className={dashboardUi.onboardingDivider} aria-hidden="true">›</div>

              <div className={dashboardUi.onboardingStep}>
                <div className={dashboardUi.onboardingStepNumber}>3</div>
                <div className={dashboardUi.onboardingStepArt}>
                  <StepIllustration type="results" />
                </div>
                <div className={dashboardUi.onboardingStepBody}>
                  <strong className={dashboardUi.onboardingStepHeading}>Review your results</strong>
                  <p className={dashboardUi.onboardingStepText}>After submitting a quiz, see your score, which questions you missed, and where to focus next.</p>
                  <button type="button" className={cx(dashboardUi.onboardingButton, onboardingTone.violet.button)} onClick={() => navigate('/quizzes')}>
                    Start your first quiz →
                  </button>
                </div>
              </div>
            </div>

            <div className={dashboardUi.onboardingTip}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span>Tip: Use <kbd className={dashboardUi.onboardingKbd}>⌘K</kbd> at any time to search across notes and quizzes instantly.</span>
            </div>
          </section>
        ) : (
          <section className={cx(dashboardUi.hero, 'animate-fadePop')} aria-label="Study progress overview">
            <MedicalMascotIllustration compact />
            <div className="relative">
              <span className={ui.eyebrow}>Welcome Back</span>
              <h2 className={dashboardUi.heroTitle}>Welcome back, {firstName}</h2>
              <p className={dashboardUi.heroText}>
                Ready to continue your progress today? Pick up where you left off or jump into your next focused study session.
              </p>
              <div className={dashboardUi.heroPills}>
                {[
                  dashboard.focusCourse || 'Browse courses',
                  dashboard.focusTopic || 'Choose a topic',
                  `${dashboard.quizDayStreak} day streak`,
                ].map((item) => (
                  <span className={dashboardUi.heroPill} key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className={cx(dashboardUi.focusCard, focusTone[dashboard.progressTone] || focusTone.steady)}>
              <span className={ui.eyebrow}>{welcomeCard.eyebrow}</span>
              <h2 className={dashboardUi.focusTitle}>{welcomeCard.title}</h2>
              <p className={dashboardUi.focusText}>{welcomeCard.text}</p>
              {welcomeCard.progressPercent !== null ? (
                <div className={dashboardUi.progressWrap}>
                  <div className={dashboardUi.progressTop}>
                    <span>Progress</span>
                    <strong className={dashboardUi.progressValue}>{welcomeCard.progressPercent}%</strong>
                  </div>
                  <div
                    className={dashboardUi.progressTrack}
                    role="progressbar"
                    aria-valuenow={welcomeCard.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Quiz score"
                  >
                    <span className={dashboardUi.progressFill} style={{ width: `${progressFill}%` }} aria-hidden="true" />
                  </div>
                </div>
              ) : null}
              <div className={cx(ui.buttonRow, 'mt-1 items-center')}>
                <button className={ui.primaryAction} type="button" onClick={welcomeCard.primaryAction}>{welcomeCard.primaryLabel}</button>
                <button type="button" className={ui.secondaryAction} onClick={welcomeCard.secondaryAction}>{welcomeCard.secondaryLabel}</button>
              </div>
              <div className={dashboardUi.focusStats}>
                <div className={dashboardUi.focusStat}><small className={dashboardUi.focusStatLabel}>Pass rate</small><strong className={dashboardUi.focusStatValue}>{dashboard.passRate}%</strong></div>
                <div className={dashboardUi.focusStat}><small className={dashboardUi.focusStatLabel}>Avg score</small><strong className={dashboardUi.focusStatValue}>{dashboard.avgScore}%</strong></div>
              </div>
            </div>
          </section>
        )}

        {/* Metric strip */}
        <div className={ui.dashboardMetricStrip}>
          <div className={cx(ui.dashboardMetricGrid, ui.dashboardMetricGridFour, 'lms-metric-stagger')}>
            {loading
              ? <>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cx(ui.metricCard, ui.metricCardPremium, 'lms-dashboard-card')}>
                      <div className="mb-3 flex items-start justify-between">
                        <div className="grid gap-1.5">
                          <div className={cx(ui.skeletonLine, 'h-2.5 w-20')} />
                          <div className={cx(ui.skeletonLine, 'h-2.5 w-14')} />
                        </div>
                      </div>
                      <div className={cx(ui.skeletonLine, 'mb-1 h-8 w-16')} />
                      <div className={cx(ui.skeletonLine, 'h-3 w-24')} />
                    </div>
                  ))}
                </>
              : summaryCards.map((card) => (
                  <article
                    className={cx(
                      ui.metricCard,
                      ui.metricCardPremium,
                      ui[`metricCard${card.accent.charAt(0).toUpperCase()}${card.accent.slice(1)}`],
                      'lms-dashboard-card animate-fadePop'
                    )}
                    key={card.label}
                    aria-label={`${card.label}: ${card.value}`}
                  >
                    <span className={cx(dashboardUi.metricGlow, dashboardUi.metricGlowTone[card.accent])} aria-hidden="true" />
                    <div className="mb-3 flex items-start justify-between">
                      <div className={dashboardUi.metricTitleStack}>
                        <span className={ui.eyebrow}>{card.label}</span>
                        <small className="text-[11px] text-ink-muted">{card.detail}</small>
                      </div>
                    </div>
                    <p className="my-1.5 mb-1 text-[clamp(24px,3vw,32px)] font-extrabold leading-none text-ink-strong" aria-hidden="true">{card.value}</p>
                    <p className="m-0 text-[12.5px] text-ink-soft">{card.hint}</p>
                    <span className={dashboardUi.metricArt}>
                      <MetricIllustration type={card.accent} />
                    </span>
                  </article>
                ))
            }
          </div>
        </div>

        {/* Streak banner */}
        {!loading && dashboard.quizDayStreak > 0 && (
          <div className={cx(dashboardUi.streakBanner, 'animate-fadePop')} style={{ animationDelay: '160ms' }}>
            <svg className={dashboardUi.streakFlame} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-2-1-3.5-2-5-1 2-2 2.5-2 5a2 2 0 0 1-2-2c0-3 4-5 4-9l-2 1z" fill="currentColor" opacity=".9"/>
              <path d="M15 8c0 3-2 4-2 7a3 3 0 0 0 3-3c0-2-1-3-1-4z" fill="currentColor" opacity=".5"/>
            </svg>
            <div className={dashboardUi.streakBody}>
              <strong className={dashboardUi.streakStrong}>{dashboard.quizDayStreak}-day streak!</strong>
              <span className={dashboardUi.streakText}>You've studied {dashboard.quizDayStreak} day{dashboard.quizDayStreak === 1 ? '' : 's'} in a row. Keep it going.</span>
            </div>
            <div className={dashboardUi.streakDots} role="img" aria-label={`${Math.min(7, dashboard.quizDayStreak)} of 7 streak days active`}>
              {Array.from({ length: Math.min(7, dashboard.quizDayStreak) }).map((_, i) => (
                <span key={i} className={cx(dashboardUi.streakDot, dashboardUi.streakDotLit)} />
              ))}
              {Array.from({ length: Math.max(0, 7 - dashboard.quizDayStreak) }).map((_, i) => (
                <span key={`e${i}`} className={dashboardUi.streakDot} />
              ))}
            </div>
          </div>
        )}

        {!loading && premiumPreviewCards.length > 0 ? (
          <section className={cx(dashboardCard, 'mb-[18px]')} style={{ animationDelay: '80ms' }}>
            <span className={ui.eyebrow}>Premium Previews</span>
            <h2 className={ui.dashboardCardTitle}>Everything is visible. Some tools unlock as your plan grows.</h2>
            <div className="flex flex-col gap-2">
              {premiumPreviewCards.map((card) => (
                <div className={cx(dashboardUi.insightRow, 'cursor-default opacity-[0.88]')} key={card.key}>
                  <div>
                    <strong className="inline-flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" className="shrink-0 opacity-70">
                        <rect x="2" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M4 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      {card.title}
                    </strong>
                    <span>{card.text}</span>
                  </div>
                  <div className={ui.iconRow}>
                    <button type="button" className={ui.ghostSmall} onClick={() => navigate('/subscriptions', { state: { lockedFeature: card.featureKey } })}>
                      Upgrade
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Cards grid */}
        <div className={cx(ui.dashboardCardGrid, 'lms-card-stagger')}>
          <article className={dashboardStackCard}>
            <span className={ui.eyebrow}>Daily Goals</span>
            <h2 className={dashboardCardTitle}>{dashboard.dailyGoalsCompleted}/{dashboard.dailyGoals.length || 3} goals completed today.</h2>
            <div className="flex flex-col gap-2">
              {dashboard.dailyGoals.map((goal) => (
                <div className={cx(dashboardUi.insightRow, 'cursor-default')} key={goal.key}>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>{goal.description}</span>
                  </div>
                  <div className={dashboardUi.insightScore}>
                    <strong>{goal.progressText}</strong>
                    <span>{goal.completed ? 'Done' : 'Pending'}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {hasAdvancedInsights ? (
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>Topic Mastery</span>
              <h2 className={dashboardCardTitle}>See which topics are weak, improving, or becoming strong.</h2>
              <div className="flex flex-col gap-2">
                {dashboard.topicMastery.length === 0
                  ? <div className={ui.emptyBox}>Complete a few quizzes to unlock mastery tracking.</div>
                  : dashboard.topicMastery.map((topic) => (
                      <div className={cx(dashboardUi.insightRow, 'cursor-default')} key={`mastery-${topic.courseTitle}-${topic.topicName}`}>
                        <div>
                          <strong>{topic.topicName}</strong>
                          <span>{topic.courseTitle} • {topic.masteryNote}</span>
                        </div>
                        <div className={dashboardUi.insightScore}>
                          <strong>{Number(topic.averagePercentage).toFixed(1)}%</strong>
                          <span>{topic.attemptsCount} attempt{topic.attemptsCount !== 1 ? 's' : ''}</span>
                          <span className={statusPill(topic.mastery === 'strong' ? 'active' : topic.mastery === 'improving' ? 'pending' : 'inactive')}>
                            {topic.masteryLabel}
                          </span>
                        </div>
                      </div>
                    ))
                }
              </div>
            </article>
          ) : (
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>Advanced Insights</span>
              <h2 className={dashboardCardTitle}>Unlock weak topics, mastery tracking, and deeper study guidance.</h2>
              <p className={dashboardCardText}>Upgrade your subscription to access AI-driven study insights on the dashboard.</p>
              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={() => navigate('/subscriptions', { state: { lockedFeature: 'advancedInsights' } })}>View plans</button>
              </div>
            </article>
          )}

          {continueCard ? (
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>{continueCard.eyebrow}</span>
              <h2 className={dashboardCardTitle}>{continueCard.title}</h2>
              <p className={dashboardCardText}>{continueCard.text}</p>
              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={continueCard.primaryAction}>{continueCard.primaryLabel}</button>
                <button type="button" className={ui.secondaryAction} onClick={continueCard.secondaryAction}>{continueCard.secondaryLabel}</button>
              </div>
            </article>
          ) : null}

          {hasAdvancedInsights ? (
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>Study Next</span>
              <h2 className={dashboardCardTitle}>One clear next step is better than random revision.</h2>
              <div className="flex flex-col gap-2">
                {studyNextSteps.map((step) => (
                  <div className={cx(dashboardUi.insightRow, 'cursor-default')} key={`${step.eyebrow}-${step.title}`}>
                    <div>
                      <strong>{step.title}</strong>
                      <span>{step.text}</span>
                    </div>
                    <div className={ui.iconRow}>
                      <button type="button" className={ui.ghostSmall} onClick={step.primaryAction}>{step.primaryLabel}</button>
                      <button type="button" className={ui.ghostSmall} onClick={step.secondaryAction}>{step.secondaryLabel}</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          <article className={dashboardCard}>
            <span className={ui.eyebrow}>Recent Attempts</span>
            <h2 className={ui.dashboardCardTitle}>Return to the sessions that define your momentum.</h2>
            <div className="flex flex-col gap-2">
              {dashboard.recentAttempts.length === 0
                ? <div className={ui.emptyBox}>No submitted attempts yet.</div>
                : dashboard.recentAttempts.map((attempt) => (
                    <button className={cx(dashboardUi.insightRow, dashboardUi.insightRowButton)}
                      type="button"
                      key={attempt.id}
                     
                      onClick={() => navigate(`/results/${attempt.id}`)}
                    >
                      <div>
                        <strong>{attempt.quizTitle}</strong>
                        <span>{attempt.courseTitle || 'General'}{attempt.topicName ? ` • ${attempt.topicName}` : ''}</span>
                      </div>
                      <div className={dashboardUi.insightScore}>
                        <strong>{Number(attempt.percentage).toFixed(1)}%</strong>
                        <span>{attempt.passStatus}</span>
                      </div>
                    </button>
                  ))
              }
            </div>
          </article>

          {hasAdvancedInsights ? (
            <article className={dashboardStackCard}>
              <span className={ui.eyebrow}>Weak Topics</span>
              <h2 className={dashboardCardTitle}>Target areas where the next gains will matter most.</h2>
              <div className="flex flex-col gap-2">
                {dashboard.weakTopics.length === 0
                  ? <div className={ui.emptyBox}>Complete a few quizzes to unlock topic insights.</div>
                  : dashboard.weakTopics.map((topic) => (
                      <div className={cx(dashboardUi.insightRow, 'cursor-default')} key={`${topic.courseTitle}-${topic.topicName}`}>
                        <div>
                          <strong>{topic.topicName}</strong>
                          <span>{topic.courseTitle}</span>
                        </div>
                        <div className={dashboardUi.insightScore}>
                          <strong>{Number(topic.averagePercentage).toFixed(1)}%</strong>
                          <span>{topic.attemptsCount} attempt{topic.attemptsCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))
                }
              </div>
            </article>
          ) : null}

        </div>

        {/* Strong topics */}
        <section className={cx(ui.panelCard, dashboardCard)} style={{ animationDelay: '120ms' }}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.dashboardCardTitle}>Saved For Later</h2>
              <p className={ui.dashboardCardText}>Keep a short list of quizzes and lessons you want to come back to quickly.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {bookmarks.length === 0
              ? <div className={ui.emptyBox}>No saved items yet. Bookmark a quiz or lesson to build your study shortlist.</div>
              : bookmarks.slice(0, 6).map((item) => (
                  <button className={cx(dashboardUi.insightRow, dashboardUi.insightRowButton)}
                    type="button"
                   
                    key={`${item.itemType}-${item.itemId}`}
                    onClick={() => navigate(
                      item.itemType === 'quiz'
                        ? `/quizzes/${item.itemId}?mode=practice`
                        : `/ai-notes/${item.itemId}`
                    )}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.itemType === 'quiz' ? 'Quiz' : 'AI Note'}{item.courseTitle ? ` • ${item.courseTitle}` : ''}{item.topicName ? ` • ${item.topicName}` : ''}</span>
                    </div>
                    <div className={dashboardUi.insightScore}>
                      <strong>{item.itemType === 'quiz' ? 'Practice' : 'Review'}</strong>
                      <span>Saved</span>
                    </div>
                  </button>
                ))
            }
          </div>
        </section>

        {hasAdvancedInsights ? (
          <section className={cx(ui.panelCard, dashboardCard)} style={{ animationDelay: '180ms' }}>
            <div className={ui.panelTop}>
              <div>
                <h2 className={ui.dashboardCardTitle}>Strong Topics</h2>
                <p className={ui.dashboardCardText}>These subjects are becoming reliable strengths in your revision pattern.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {dashboard.strongTopics.length === 0
                ? <div className={ui.emptyBox}>No strong-topic insights yet. Complete more quizzes.</div>
                : dashboard.strongTopics.map((topic) => (
                    <div className={cx(dashboardUi.insightRow, 'cursor-default')} key={`${topic.courseTitle}-${topic.topicName}`}>
                      <div>
                        <strong>{topic.topicName}</strong>
                        <span>{topic.courseTitle}</span>
                      </div>
                      <div className={dashboardUi.insightScore}>
                        <strong>{Number(topic.averagePercentage).toFixed(1)}%</strong>
                        <span>{topic.attemptsCount} attempt{topic.attemptsCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))
              }
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
