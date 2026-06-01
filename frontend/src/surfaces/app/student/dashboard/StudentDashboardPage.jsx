import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import { listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchStudentQuizzes } from '../../../../shared/api/quizAttempts.api.js';
import { fetchStudyBookmarks } from '../../../../shared/api/studyBookmarks.api.js';
import { fetchPlannerAgenda } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { StudyMascot } from '../../../../shared/ui/StudyMascot.jsx';
import { ImpactStyle, nativeImpact, nativeSuccess, webVibrate } from '../../../../shared/utils/nativeHaptics.js';

const defaultDashboardState = {
  totalQuizzes: 0,
  totalAttempts: 0,
  avgScore: 0,
  totalPassed: 0,
  passRate: 0,
  quizDayStreak: 0,
  dailyGoalsCompleted: 0,
  recentAttempts: [],
  weakTopics: [],
  strongTopics: [],
  topicMastery: [],
  missedPatterns: [],
  dailyGoals: [],
  adaptivePlan: [],
  questionOfDay: null,
  serverClock: {
    nowIso: '',
    dateKey: '',
    timeZone: 'server-local',
    source: 'api-server',
  },
  totalCourses: 0,
  courseProgress: [],
  courseProgressSummary: {
    visibleCourses: 0,
    completedLessons: 0,
    totalLessons: 0,
    overallProgressPercent: 0,
    sourceLabel: 'Course lesson progress',
  },
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
    windowLabel: 'Last 7 days',
    comparisonLabel: 'Previous 7 days',
    dateRangeLabel: 'Server calendar: last 7 days',
    sourceLabel: 'Submitted quiz attempts',
    emptyState: 'No submitted quiz attempts in this window yet.',
  },
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
    courseProgress: Array.isArray(source.courseProgress) ? source.courseProgress : [],
    serverClock: {
      ...defaultDashboardState.serverClock,
      ...(source.serverClock && typeof source.serverClock === 'object' ? source.serverClock : {}),
    },
    courseProgressSummary: {
      ...defaultDashboardState.courseProgressSummary,
      ...(source.courseProgressSummary && typeof source.courseProgressSummary === 'object'
        ? source.courseProgressSummary
        : {}),
    },
    performanceSnapshot: {
      ...defaultDashboardState.performanceSnapshot,
      ...(source.performanceSnapshot && typeof source.performanceSnapshot === 'object'
        ? source.performanceSnapshot
        : {}),
    },
  };
}

function runWhenIdle(task) {
  if (typeof window === 'undefined') {
    task();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(task, 260);
  return () => window.clearTimeout(timer);
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function plural(value, singular, pluralLabel = `${singular}s`) {
  return `${value} ${Number(value) === 1 ? singular : pluralLabel}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function parsePlannerDate(value) {
  if (!value) return null;
  const raw = String(value);
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T00:00:00`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plannerDaysLeft(value) {
  const dueDate = parsePlannerDate(value);
  if (!dueDate) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function formatPlannerDaysLeft(value) {
  const days = plannerDaysLeft(value);
  if (days === null) return 'No due date';
  if (days < 0) return `${plural(Math.abs(days), 'day')} overdue`;
  return `${plural(days, 'day')} left`;
}

function dateKeyToUtcMs(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function daysFromServerDate(dueAt, serverDateKey) {
  const dueMs = dateKeyToUtcMs(dueAt);
  const baseMs = dateKeyToUtcMs(serverDateKey);
  if (dueMs === null || baseMs === null) return plannerDaysLeft(dueAt);
  return Math.round((dueMs - baseMs) / 86400000);
}

function formatServerDueLabel(dueAt, serverDateKey) {
  const days = daysFromServerDate(dueAt, serverDateKey);
  if (!dueAt) return 'No due date';
  if (days === null) return `Due ${String(dueAt).slice(0, 10)}`;
  if (days < 0) return `${plural(Math.abs(days), 'day')} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${plural(days, 'day')} left`;
}

function titleCaseLabel(value, fallback = 'Task') {
  return String(value || fallback)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAgendaItemComplete(item) {
  return ['completed', 'done'].includes(String(item?.status || '').toLowerCase());
}

function agendaRoute(item, fallback = '/planner') {
  const raw = String(item?.actionUrl || fallback || '/planner').trim() || '/planner';
  if (raw.startsWith('/app/')) return raw;
  return appRoute(raw.startsWith('/') ? raw : `/${raw}`);
}

function getAgendaCourseLabel(item) {
  return item?.course || item?.subject || item?.topic || 'General';
}

function cleanPlannerTitle(title) {
  return String(title || '')
    .replace(/^(Lesson|Q-Bank|Review|Quiz|Practice|Reminder):\s*/i, '')
    .trim() || 'Planner reminder';
}

function getFirstName(user) {
  const source = user?.fullName || user?.name || user?.email || '';
  const name = String(source).trim().split(/\s+/)[0];
  if (!name || name.includes('@')) return 'there';
  return name;
}

function getQuizId(quiz) {
  return quiz?.id || quiz?.quizId || quiz?.quiz?.id || null;
}

function getAttemptId(attempt) {
  return attempt?.id || attempt?.attemptId || null;
}

function getTopicLabel(item, fallback = 'General medicine') {
  const course = item?.courseTitle || item?.courseName || '';
  const topic = item?.topicName || item?.title || '';
  if (course && topic) return `${course} / ${topic}`;
  return course || topic || fallback;
}

function getQuizTitle(quiz, fallback = 'Focused exam') {
  return quiz?.studentTitle || quiz?.quizTitle || quiz?.title || fallback;
}

function isSameStudyDay(value, reference = new Date()) {
  const source = value || null;
  const date = source ? new Date(source) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate();
}

function getStudyMood({ attempts, readinessScore, streak }) {
  if (readinessScore >= 80) {
    return {
      label: 'Study status',
      value: 'Exam ready pace',
      text: 'Your readiness is strong. Keep reviewing weak areas to stay sharp.',
      meter: 92,
    };
  }
  if (streak >= 5) {
    return {
      label: 'Study status',
      value: 'Consistent progress',
      text: 'You have a strong streak. Keep one small task planned for today.',
      meter: 84,
    };
  }
  if (attempts >= 3) {
    return {
      label: 'Study status',
      value: 'Practice in progress',
      text: 'You have attempted several practice sets. Review mistakes before starting more.',
      meter: 72,
    };
  }
  if (readinessScore > 0) {
    return {
      label: 'Study status',
      value: 'Building readiness',
      text: 'You have started making progress. Finish one focused lesson or quiz next.',
      meter: Math.max(38, readinessScore),
    };
  }
  return {
    label: 'Study status',
    value: 'Ready to begin',
    text: 'Start with one short practice set or one lesson to build today’s progress.',
    meter: 34,
  };
}

function buildDashboardLevelProgress(dashboard) {
  const explicitXp = Number(dashboard.totalXp ?? dashboard.xp ?? dashboard.experiencePoints ?? 0);
  const earnedXp = explicitXp > 0
    ? explicitXp
    : Math.max(0, Math.round(
        (Number(dashboard.totalAttempts || 0) * 70) +
        (Number(dashboard.totalPassed || 0) * 110) +
        (Number(dashboard.dailyGoalsCompleted || 0) * 55) +
        (Number(dashboard.quizDayStreak || 0) * 35)
      ));
  const level = Math.max(1, Number(dashboard.level || dashboard.studyLevel || Math.floor(earnedXp / 300) + 1));
  const currentLevelBase = (level - 1) * 300;
  const nextLevelTarget = level * 300;
  const levelXp = Math.max(0, earnedXp - currentLevelBase);
  const nextLevelIn = Math.max(0, nextLevelTarget - earnedXp);
  const progress = clampPercent((levelXp / 300) * 100);

  return {
    xp: earnedXp,
    level,
    nextLevelIn,
    progress,
  };
}

function appRoute(path) {
  return `/app${path}`;
}

function Icon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (name === 'menu') {
    return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  if (name === 'search') {
    return <svg {...common}><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  if (name === 'play') {
    return <svg {...common}><path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" /></svg>;
  }
  if (name === 'book') {
    return <svg {...common}><path d="M5.5 4.5h6A2.5 2.5 0 0 1 14 7v12H7.5a2 2 0 0 1-2-2V4.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M14 7a2.5 2.5 0 0 1 2.5-2.5H18V19h-4" stroke="currentColor" strokeWidth="1.8" /><path d="M8 9.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'doc') {
    return <svg {...common}><path d="M6.5 3.5h7.2l3.8 3.8v13.2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" /><path d="M13.5 3.5v4h4M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'calendar') {
    return <svg {...common}><path d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v10.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V7a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M8 3v4M16 3v4M4 9h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M8 13h2M14 13h2M8 16h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'exam') {
    return <svg {...common}><path d="M7 3.5h8.2l3.3 3.3V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M15 3.5V7h3.5M8.5 12h3.2M8.5 16h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="m14 15.4 1.4 1.4 2.8-3.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === 'review') {
    return <svg {...common}><path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M9 10h6M9 14h4M9 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9.5 3h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'thumb') {
    return <svg {...common} fill="currentColor"><path d="M1.5 21h4V9h-4v12Zm21-11c0-1.1-.9-2-2-2h-6.28l.95-4.56.03-.32c0-.42-.17-.8-.44-1.07L13.7 1 7.1 7.6c-.37.36-.6.86-.6 1.4v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.85-1.22l3-7.05c.1-.23.15-.48.15-.73v-2Z" /></svg>;
  }
  if (name === 'chart') {
    return <svg {...common}><path d="M5 19V5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 15v-4M13 15V8M17 15v-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
  }
  if (name === 'bookmark') {
    return <svg {...common}><path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.8-6 3.8v-15a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
  }
  if (name === 'target') {
    return <svg {...common}><circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'check') {
    return <svg {...common}><path d="m5 12.5 4 4L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === 'spark') {
    return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" fill="currentColor" /></svg>;
  }
  if (name === 'flame') {
    return (
      <svg {...common} className="study-fire-svg" viewBox="0 0 24 24">
        <path className="study-fire-outer" d="M12 2.8s5.7 4.8 5.7 10.4a5.7 5.7 0 0 1-11.4 0c0-2.4 1.25-3.8 1.25-3.8s0 2.4 1.82 2.4C11.3 11.8 8.58 8.38 12 2.8Z" fill="currentColor" />
        <path className="study-fire-inner" d="M12.05 11.1s2.35 2.05 2.35 4.15a2.42 2.42 0 0 1-4.84 0c0-1.02.5-1.72.5-1.72s.26.9 1.02.9c.92 0-.38-1.55.97-3.33Z" fill="rgba(255, 238, 170, 0.96)" />
      </svg>
    );
  }
  if (name === 'cap') {
    return <svg {...common}><path d="m3.5 9 8.5-4 8.5 4-8.5 4-8.5-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7.5 11v4.2c0 1.6 2 2.8 4.5 2.8s4.5-1.2 4.5-2.8V11M19.5 10v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'stetho') {
    return <svg {...common}><path d="M6 4v6a4 4 0 0 0 8 0V4M5 4h2M13 4h2M10 14v3a4 4 0 0 0 8 0v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="18" cy="13" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (name === 'trophy') {
    return <svg {...common}><path d="M8 4.5h8v4.8a4 4 0 0 1-8 0V4.5Z" fill="currentColor" opacity=".22" /><path d="M8 5h8v4.5a4 4 0 0 1-8 0V5ZM9.5 18.5h5M12 13.5v5M6.5 20.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 7H5.5A2.5 2.5 0 0 0 8 11M16 7h2.5A2.5 2.5 0 0 1 16 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === 'badge-star') {
    return <svg {...common} viewBox="0 0 24 24"><path d="M12 2.8 16.6 5l4.9 1.5.8 5.1-.8 5.1-4.9 1.5L12 21.2l-4.6-3-4.9-1.5-.8-5.1.8-5.1L7.4 5 12 2.8Z" fill="currentColor" opacity=".22" /><path d="M12 2.8 16.6 5l4.9 1.5.8 5.1-.8 5.1-4.9 1.5L12 21.2l-4.6-3-4.9-1.5-.8-5.1.8-5.1L7.4 5 12 2.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="m12 7.5 1.25 2.55 2.82.41-2.04 1.98.48 2.8L12 13.9l-2.52 1.34.49-2.8-2.04-1.98 2.82-.41L12 7.5Z" fill="currentColor" /></svg>;
  }
  if (name === 'arrow') {
    return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg {...common}><path d="M12 3v18M4.2 7.5h15.6M4.2 16.5h15.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M7.5 4.5c2.4 2.4 2.4 12.6 0 15M16.5 4.5c-2.4 2.4-2.4 12.6 0 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/* ── Hero motif library ─────────────────────────────────────────
   Five SVG decorations that bloom inside the hero card. The dashboard
   picks one at random on mount, so every visit feels fresh. Every
   motif uses currentColor so light/dark/accent flip automatically.
   ────────────────────────────────────────────────────────────── */

const appAssetBase = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL;
const dashboardHeroMascotBase = `${appAssetBase.replace(/\/?$/, '/')}temp/mascots/`;
const DASHBOARD_HERO_MASCOTS = [
  { key: '2d-brain-dj', image: 'generated/2d/2d-brain-dj.webp', label: 'Brain DJ mascot' },
  { key: '2d-scope-wizard', image: 'generated/2d/2d-microscope-wizard.webp', label: 'Scope wizard mascot' },
  { key: 'hero-break', image: 'generated/hero-brain-coffee.webp', label: 'Break return mascot' },
  { key: 'hero-lesson', image: 'generated/hero-lesson-book.webp', label: 'Lesson complete mascot' },
  { key: '3d-stetho-rocket', image: 'generated/3d-neon/neon-stetho-rocket.webp', label: 'Stetho rocket mascot' },
  { key: '3d-brain-goggles', image: 'generated/3d-neon/neon-brain-goggles.webp', label: 'Goggle brain mascot' },
  { key: '3d-dna-hover', image: 'generated/3d-neon/neon-dna-hoverboard.webp', label: 'DNA hover mascot' },
  { key: '3d-chart-doctor', image: 'generated/3d-neon/neon-tablet-doctor.webp', label: 'Chart doctor mascot' },
  { key: 'vial-stetho', image: 'generated/vibe/vibe-vial-stetho.webp', label: 'Vial stetho mascot' },
  { key: 'focus-brain', image: 'generated/vibe/vibe-headphone-brain.webp', label: 'Focus brain mascot' },
  { key: 'dna-surf', image: 'generated/vibe/vibe-dna-surf.webp', label: 'DNA surf mascot' },
  { key: 'stetho-wave', image: 'generated/dashboard-hero-companion.webp', label: 'Stetho wave mascot' },
];

function pickDashboardHeroMascot() {
  return DASHBOARD_HERO_MASCOTS[Math.floor(Math.random() * DASHBOARD_HERO_MASCOTS.length)];
}

function DashboardHeroMascot({ mascot }) {
  if (!mascot) return null;
  const src = `${dashboardHeroMascotBase}${mascot.image}`;
  const handleImageError = (event) => {
    event.currentTarget.hidden = true;
  };

  return (
    <span className="study-hero-mascot-random" aria-hidden="true">
      <span className="study-hero-mascot-random__spark study-hero-mascot-random__spark--one" />
      <span className="study-hero-mascot-random__spark study-hero-mascot-random__spark--two" />
      <span className="study-hero-mascot-random__spark study-hero-mascot-random__spark--three" />
      <span className="study-hero-mascot-random__spark study-hero-mascot-random__spark--four" />
      <img
        src={src}
        alt=""
        width="512"
        height="512"
        draggable="false"
        decoding="async"
        loading="eager"
        fetchPriority="high"
        onError={handleImageError}
      />
    </span>
  );
}

function QuickActionArt({ type }) {
  if (type === 'practice') {
    return (
      <svg className="study-action-art study-action-art--target" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="78" cy="64" r="38" />
        <circle cx="78" cy="64" r="25" />
        <circle cx="78" cy="64" r="10" fill="currentColor" opacity=".14" />
        <path d="M15 82c16-18 28-24 43-20 11 3 17 0 25-10" />
        <path d="M63 52l20 0 0-20" />
        <path d="M64 51l32-32" />
      </svg>
    );
  }
  if (type === 'lesson') {
    return (
      <svg className="study-action-art study-action-art--lesson" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M27 35c14-4 29-2 43 8v53c-14-9-29-12-43-8z" fill="currentColor" opacity=".08" />
        <path d="M70 43c12-9 27-11 43-6v53c-15-5-29-3-43 6z" fill="currentColor" opacity=".08" />
        <path d="M27 35c14-4 29-2 43 8v53c-14-9-29-12-43-8z" />
        <path d="M70 43c12-9 27-11 43-6v53c-15-5-29-3-43 6z" />
        <path d="M70 43v53" />
        <path d="M39 54h18M39 67h22M39 80h16" />
        <path d="M84 54h18M84 67h14" />
      </svg>
    );
  }
  return (
    <svg className="study-action-art study-action-art--review" viewBox="0 0 120 120" aria-hidden="true">
      <rect x="31" y="25" width="58" height="72" rx="9" fill="currentColor" opacity=".08" />
      <path d="M31 25h43l15 15v57H31z" />
      <path d="M74 25v16h15" />
      <path d="M44 52h29M44 65h23M44 78h17" />
      <circle cx="79" cy="78" r="18" fill="currentColor" opacity=".08" />
      <path d="M69 78l7 7 16-20" />
      <path d="M23 39h-7v66h55v-7" />
    </svg>
  );
}

const DUST_PARTICLES = [
  { left: '8%',  delay: 0,    duration: 14 },
  { left: '18%', delay: 3.2,  duration: 16 },
  { left: '28%', delay: 6.4,  duration: 13 },
  { left: '38%', delay: 1.8,  duration: 17 },
  { left: '48%', delay: 8.1,  duration: 15 },
  { left: '58%', delay: 4.4,  duration: 14 },
  { left: '68%', delay: 11,   duration: 18 },
  { left: '78%', delay: 7.3,  duration: 12 },
  { left: '88%', delay: 2.5,  duration: 16 },
  { left: '95%', delay: 9.6,  duration: 14 },
];

/* Floating dust particles — dark mode atmospheric layer ────────── */
function DashboardDustLayer() {
  return (
    <div className="study-dust-layer" aria-hidden="true">
      {DUST_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="study-dust-particle"
          style={{
            left: p.left,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function StethoscopeMark() {
  return (
    <svg className="study-hero-mark" viewBox="0 0 180 180" role="img" aria-label="Study progress illustration">
      <defs>
        <linearGradient id="study-hero-mark-gradient" x1="22" y1="26" x2="152" y2="154" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r="78" fill="rgba(56,189,248,0.15)" />
      <path d="M56 43v35c0 18 14 32 32 32s32-14 32-32V43" stroke="url(#study-hero-mark-gradient)" strokeWidth="12" strokeLinecap="round" />
      <path d="M88 110v12c0 16 13 29 29 29s29-13 29-29v-12" stroke="#060c1a" strokeWidth="12" strokeLinecap="round" />
      <circle cx="146" cy="105" r="16" fill="#ffffff" stroke="#060c1a" strokeWidth="9" />
      <circle cx="56" cy="43" r="10" fill="#ffffff" />
      <circle cx="120" cy="43" r="10" fill="#ffffff" />
    </svg>
  );
}

function StudyButton({ children, tone = 'primary', icon = null, onClick }) {
  return (
    <button type="button" className={`study-button study-button--${tone}`} onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}

function MetricCard({ label, value, hint, icon, tone, progress = null }) {
  return (
    <article className={`study-metric study-metric--${tone}`}>
      <span className="study-metric__icon"><Icon name={icon} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <p>{hint}</p>
      </div>
      {progress !== null ? (
        <div className="study-mini-rail" aria-hidden="true">
          <span style={{ width: `${clampPercent(progress)}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function StreakHeatmap({ streak, goalsCompleted }) {
  const activeDays = Math.min(7, Math.max(Number(streak || 0), Number(goalsCompleted || 0)));
  const todayIndex = (new Date().getDay() + 6) % 7;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="study-heatmap" aria-label={`${activeDays} active study days this week`}>
      {labels.map((label, index) => {
        const active = activeDays > 0 && index >= labels.length - activeDays;
        const className = [
          'study-heatmap__cell',
          active ? 'is-active' : '',
          index === todayIndex ? 'is-today' : '',
        ].filter(Boolean).join(' ');
        return (
          <span className={className} key={`${label}-${index}`}>
            <span className="study-heatmap__dot" aria-hidden="true" />
            <span className="study-heatmap__label">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function ScoreTrend({ attempts, average }) {
  const values = attempts.length
    ? attempts.slice(0, 7).reverse().map((attempt) => clampPercent(attempt.percentage))
    : [Math.max(18, clampPercent(average) - 16), clampPercent(average), Math.min(100, clampPercent(average) + 10)];
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 92 - (value * 0.72);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="study-score-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 82H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <path d="M0 54H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <path d="M0 26H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#3d5afe" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TopicList({ title, items, emptyText, tone }) {
  return (
    <section className="study-card study-topic-card">
      <div className="study-card__head">
        <div>
          <span className="study-eyebrow">{title}</span>
          <h2>{tone === 'strong' ? 'Strong areas' : 'Focus areas'}</h2>
        </div>
        <span className={`study-soft-icon study-soft-icon--${tone}`}><Icon name={tone === 'strong' ? 'spark' : 'target'} /></span>
      </div>
      <div className="study-topic-list">
        {items.length ? items.slice(0, 4).map((item, index) => (
          <button
            type="button"
            className="study-topic-row"
            key={`${item.courseTitle || 'course'}-${item.topicName || item.title || index}`}
          >
            <span className={`study-topic-dot study-topic-dot--${tone}`} />
            <span>
              <strong>{item.topicName || item.title || 'Untitled topic'}</strong>
              <small>{item.courseTitle || item.courseName || 'General course'}</small>
            </span>
            <em>{clampPercent(item.averagePercentage || item.score || item.masteryScore)}%</em>
          </button>
        )) : (
          <p className="study-empty-copy">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function DailyQuestionCard({ question }) {
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [desktopAnswersVisible, setDesktopAnswersVisible] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia?.('(min-width: 1080px)').matches === true
      : false
  ));

  useEffect(() => {
    setSelectedOptionId(null);
    setAnswerFeedback(null);
    setExpanded(false);
  }, [question?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(min-width: 1080px)');
    const update = () => setDesktopAnswersVisible(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  if (!question?.questionText || !Array.isArray(question.options) || question.options.length === 0) {
    return (
      <section className="study-card study-question-card">
        <div className="study-card__head">
          <div>
            <span className="study-eyebrow">Question of the day</span>
            <h2>SBA practice</h2>
          </div>
          <span className="study-soft-icon study-soft-icon--indigo"><Icon name="review" /></span>
        </div>
        <div className="study-question-empty">
          <StudyMascot variant="review" mood="review" size="lg" label="Question bank review mascot" />
          <p>A random SBA will appear here once active questions are added to the bank.</p>
        </div>
      </section>
    );
  }

  const revealAnswer = selectedOptionId !== null;
  const answersVisible = expanded || desktopAnswersVisible;
  const answerListId = 'daily-question-answers';

  const triggerAnswerFeedback = (option) => {
    const isCorrect = Boolean(option.isCorrect);
    setExpanded(true);
    setSelectedOptionId(option.id);

    if (isCorrect) {
      void nativeSuccess();
    } else {
      webVibrate([24, 28, 24]);
      void nativeImpact(ImpactStyle.Medium);
    }

    const replayFeedback = () => {
      setAnswerFeedback({
        optionId: option.id,
        type: isCorrect ? 'correct' : 'wrong',
        id: `${option.id}-${Date.now()}`,
      });
    };

    setAnswerFeedback(null);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(replayFeedback);
    } else {
      replayFeedback();
    }
  };

  return (
    <section className={`study-card study-question-card ${expanded ? 'is-expanded' : 'is-collapsed'} ${desktopAnswersVisible ? 'has-desktop-answers' : ''}`}>
      <div className="study-card__head">
        <div>
          <span className="study-eyebrow">Question of the day</span>
          <h2>{question.topicName || question.subjectName || question.courseTitle || 'Question bank'}</h2>
        </div>
        <span className="study-soft-icon study-soft-icon--indigo"><Icon name="review" /></span>
      </div>
      <p className="study-question-text">{question.questionText}</p>
      <div
        id={answerListId}
        className="study-answer-list"
        role="list"
        aria-label="Question answers"
        aria-hidden={answersVisible ? undefined : 'true'}
      >
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const isCorrect = Boolean(option.isCorrect);
          const answerStateClass = [
            revealAnswer && isCorrect ? 'is-correct' : '',
            revealAnswer && isSelected && !isCorrect ? 'is-wrong' : '',
            isSelected ? 'is-selected' : '',
            answerFeedback?.type === 'wrong' && answerFeedback.optionId === option.id ? 'is-shaking' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              className={`study-answer-option ${answerStateClass}`}
              key={option.id}
              tabIndex={answersVisible ? 0 : -1}
              onClick={() => triggerAnswerFeedback(option)}
            >
              <span>{option.optionLabel}</span>
              <strong>{option.optionText}</strong>
              {answerFeedback?.type === 'correct' && answerFeedback.optionId === option.id ? (
                <span className="study-correct-burst" key={answerFeedback.id} aria-hidden="true">
                  <Icon name="thumb" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="study-question-toggle"
        aria-controls={answerListId}
        aria-expanded={answersVisible ? 'true' : 'false'}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Hide question' : 'Answer question'}
      </button>
    </section>
  );
}

function StudyMoodCard({ mood, todayLabel, className = '' }) {
  const cardClassName = ['study-card study-mood-card', className].filter(Boolean).join(' ');

  return (
    <section className={cardClassName} aria-label="Study mood">
      <span className="study-mood-orbit" aria-hidden="true" />
      <div className="study-mood-main">
        <StudyMascot variant="brain" mood="loading" size="sm" label="Study mood mascot" />
        <div>
          <span className="study-eyebrow">{mood.label}</span>
          <strong>{mood.value}</strong>
        </div>
      </div>
      <p>{mood.text}</p>
      <div className="study-mood-meter" aria-label={`${mood.value}: ${mood.meter}%`}>
        <span style={{ width: `${clampPercent(mood.meter)}%` }} />
      </div>
      <small>Based on today’s activity</small>
    </section>
  );
}

function StudyPlanCard({ items, onOpenPlanner }) {
  const icons = ['target', 'review', 'book'];
  const visibleItems = items.slice(0, 3);

  return (
    <section className="study-card study-plan-card" aria-label="Study plan">
      <div className="study-plan-card__head">
        <div>
          <span className="study-eyebrow">Study plan</span>
          <strong>Today's route</strong>
        </div>
        <button type="button" onClick={onOpenPlanner}>Planner</button>
      </div>
      <div className="study-plan-list">
        {visibleItems.map((item, index) => (
          <button
            type="button"
            className={`study-plan-row ${item.completed ? 'is-complete' : ''}`}
            key={item.label || item.title}
            onClick={item.action}
          >
            <span className="study-plan-row__icon"><Icon name={icons[index] || 'calendar'} /></span>
            <div>
              <small>{item.label || `Step ${index + 1}`}</small>
              <strong>{item.title}</strong>
              <em>{item.detail}</em>
            </div>
            <i aria-label={item.completed ? 'Completed' : `Step ${index + 1}`}>
              {item.completed ? <Icon name="check" /> : index + 1}
            </i>
          </button>
        ))}
      </div>
    </section>
  );
}

function StudyTodoCard({ todo, onOpen }) {
  return (
    <section className="study-card study-todo-card" aria-label="Today todo">
      <div className="study-todo-copy">
        <span className="study-eyebrow">{todo.eyebrow}</span>
        <strong>{todo.title}</strong>
        <small>{todo.text}</small>
      </div>
      <button type="button" className="study-todo-action" onClick={onOpen}>
        {todo.actionLabel}
      </button>
    </section>
  );
}

function CourseProgressCard({ courses, summary, onOpenCourse, onOpenCourses }) {
  const visibleCourses = [...courses]
    .sort((a, b) => Number(a.progressPercent || 0) - Number(b.progressPercent || 0))
    .slice(0, 3);
  const completedLessons = Number(summary?.completedLessons || 0);
  const totalLessons = Number(summary?.totalLessons || 0);
  const overallProgress = clampPercent(summary?.overallProgressPercent);

  return (
    <section
      className="study-card study-course-progress-card"
      aria-label="Course progress"
      style={{ '--course-progress': `${overallProgress}%` }}
    >
      <div className="study-plan-card__head">
        <div>
          <span className="study-eyebrow">Course progress</span>
          <strong>{overallProgress}% overall</strong>
        </div>
        <button type="button" onClick={onOpenCourses}>Courses</button>
      </div>

      <div className="study-course-overview">
        <div
          className="study-course-ring"
          role="progressbar"
          aria-label="Overall course lesson completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={overallProgress}
        >
          <span>{overallProgress}%</span>
        </div>
        <div>
          <strong>{completedLessons}/{totalLessons}</strong>
          <small>completed lessons from the course page source</small>
        </div>
      </div>

      <div className="study-course-list">
        {visibleCourses.length ? visibleCourses.map((course) => {
          const progress = clampPercent(course.progressPercent);
          return (
            <button
              type="button"
              className="study-course-row"
              key={course.id || course.courseTitle}
              onClick={() => onOpenCourse(course)}
            >
              <span>
                <strong>{course.courseTitle || 'Course'}</strong>
                <small>{Number(course.completedLessonsCount || 0)}/{Number(course.totalLessonsCount || 0)} lessons · {course.examType || 'Medical course'}</small>
              </span>
              <em>{progress}%</em>
              <i aria-hidden="true"><b style={{ width: `${progress}%` }} /></i>
            </button>
          );
        }) : (
          <p className="study-empty-copy">No active course lessons are available for this student account yet.</p>
        )}
      </div>
    </section>
  );
}

function UpcomingTasksCard({ items, serverDateKey, onOpenItem, onOpenPlanner }) {
  const visibleItems = items
    .filter((item) => item?.title && !isAgendaItemComplete(item))
    .slice(0, 3);

  return (
    <section className="study-card study-upcoming-card" aria-label="Upcoming tasks">
      <div className="study-plan-card__head">
        <div>
          <span className="study-eyebrow">Upcoming tasks</span>
          <strong>Sorted by urgency</strong>
        </div>
        <button type="button" onClick={onOpenPlanner}>Planner</button>
      </div>

      <div className="study-upcoming-list">
        {visibleItems.length ? visibleItems.map((item) => (
          <button
            type="button"
            className={`study-upcoming-row is-${String(item.status || 'optional').replace(/_/g, '-')}`}
            key={item.id}
            onClick={() => onOpenItem(item)}
          >
            <span className="study-upcoming-type">{titleCaseLabel(item.type)}</span>
            <span className="study-upcoming-copy">
              <strong>{cleanPlannerTitle(item.title)}</strong>
              <small>
                {formatServerDueLabel(item.dueAt, serverDateKey)} · {getAgendaCourseLabel(item)} · {item.actionLabel || 'Open'}
              </small>
            </span>
          </button>
        )) : (
          <p className="study-empty-copy">No upcoming planner tasks are due. Add the next exam or revision task in Planner.</p>
        )}
      </div>
    </section>
  );
}

function ExamCountdownCard({ item, serverClock, onOpen }) {
  const serverDateKey = serverClock?.dateKey || '';
  const hasDueDate = Boolean(item?.dueAt);
  const daysLeft = hasDueDate ? daysFromServerDate(item.dueAt, serverDateKey) : null;
  const countdownValue = hasDueDate
    ? daysLeft === 0
      ? 'Today'
      : daysLeft !== null
        ? Math.max(0, daysLeft)
        : '--'
    : item ? 'Open' : '--';
  const countdownLabel = hasDueDate && daysLeft !== 0 ? 'days left' : hasDueDate ? 'exam day' : 'no date set';

  return (
    <section className="study-card study-exam-countdown-card" aria-label="Exam countdown">
      <div className="study-plan-card__head">
        <div>
          <span className="study-eyebrow">Exam countdown</span>
          <strong>{item?.title || 'No exam scheduled'}</strong>
        </div>
        <button type="button" onClick={onOpen}>{item ? 'Open' : 'Exams'}</button>
      </div>
      <div className="study-exam-countdown-main">
        <span><Icon name="calendar" /></span>
        <div>
          <strong>{countdownValue}</strong>
          <small>{countdownLabel}</small>
        </div>
      </div>
      <p>
        {hasDueDate
          ? `${formatServerDueLabel(item.dueAt, serverDateKey)} · Due ${item.dueAt}`
          : item
            ? 'This exam is available, but Planner has no scheduled due date.'
            : 'Add an exam task in Planner to show a server-date countdown.'}
      </p>
      <small className="study-server-clock">Server date {serverDateKey || 'unknown'} · {serverClock?.timeZone || 'server-local'}</small>
    </section>
  );
}

function AnalyticsSnapshotCard({ snapshot, progressNote, attempts, onOpenResults }) {
  const weeklyAttempts = Number(snapshot?.weeklyAttempts || 0);
  const weeklyAverage = clampPercent(snapshot?.weeklyAverage);
  const hasAnalytics = weeklyAttempts > 0 || Number(snapshot?.previousWeeklyAverage || 0) > 0;

  return (
    <section className="study-card study-analytics-card" aria-label="Learning analytics">
      <div className="study-plan-card__head">
        <div>
          <span className="study-eyebrow">Learning analytics</span>
          <strong>{snapshot?.readinessLabel || 'Baseline not set'}</strong>
        </div>
        <button type="button" onClick={onOpenResults}>Results</button>
      </div>
      <div className="study-analytics-grid">
        <span>
          <small>{snapshot?.windowLabel || 'Last 7 days'}</small>
          <strong>{weeklyAttempts}</strong>
          <em>attempts</em>
        </span>
        <span>
          <small>Average</small>
          <strong>{weeklyAverage}%</strong>
          <em>{snapshot?.trendLabel || 'No trend yet'}</em>
        </span>
      </div>
      <ScoreTrend attempts={attempts} average={weeklyAverage} />
      <p>{hasAnalytics ? progressNote || snapshot?.trendLabel || 'Learning activity is available for review.' : snapshot?.emptyState || 'No submitted quiz attempts in this window yet.'}</p>
      <small className="study-analytics-source">
        {snapshot?.sourceLabel || 'Submitted quiz attempts'} · {snapshot?.comparisonLabel || 'Previous 7 days'}
      </small>
    </section>
  );
}

function StudyLevelSummary({ name, progress }) {
  return (
    <section className="study-level-summary" aria-label="Study progress summary">
      <span className="study-level-summary__icon" aria-hidden="true">
        <Icon name="trophy" />
      </span>
      <div className="study-level-summary__message">
        <strong>You're doing great, {name}!</strong>
        <p>Keep your focus high and your future will thank you.</p>
      </div>
      <div className="study-level-summary__stats" aria-label="Level statistics">
        <span>
          <small>XP</small>
          <strong>{formatNumber(progress.xp)}</strong>
        </span>
        <span>
          <small>Level</small>
          <strong>{progress.level}</strong>
        </span>
      </div>
    </section>
  );
}

export function StudentDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState(defaultDashboardState);
  const [studentQuizzes, setStudentQuizzes] = useState([]);
  const [aiNotes, setAiNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [plannerAgendaItems, setPlannerAgendaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [heroMascot] = useState(pickDashboardHeroMascot);

  useEffect(() => {
    let cancelled = false;
    let cancelSecondary = () => {};
    setLoading(true);
    setError('');

    async function loadDashboard() {
      try {
        const [data, quizzes, agenda] = await Promise.all([
          fetchStudentDashboard(),
          fetchStudentQuizzes().catch(() => []),
          fetchPlannerAgenda().catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setDashboard(normalizeDashboardState(data));
        setStudentQuizzes(Array.isArray(quizzes) ? quizzes : []);
        setPlannerAgendaItems(Array.isArray(agenda?.items) ? agenda.items : Array.isArray(agenda) ? agenda : []);
        cancelSecondary = runWhenIdle(async () => {
          const [notes, savedItems] = await Promise.all([
            listAiNotes().catch(() => []),
            fetchStudyBookmarks().catch(() => []),
          ]);
          if (cancelled) return;
          setAiNotes(Array.isArray(notes) ? notes : []);
          setBookmarks(Array.isArray(savedItems) ? savedItems : []);
        });
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'Unable to load dashboard'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
      cancelSecondary();
    };
  }, [reloadKey, user?.id, user?.role, user?.status]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function handleLessonProgressUpdate(event) {
      const progress = Number(event?.detail?.progressPercent || 0);
      if (event?.detail?.status === 'completed' || progress > 0) {
        setReloadKey((key) => key + 1);
      }
    }
    window.addEventListener('lms:lesson-progress-updated', handleLessonProgressUpdate);
    return () => window.removeEventListener('lms:lesson-progress-updated', handleLessonProgressUpdate);
  }, []);

  const firstName = getFirstName(user);
  const todayLabel = formatDateLabel();
  const inProgressQuiz = useMemo(
    () => studentQuizzes.find((quiz) => quiz.practiceSessionId),
    [studentQuizzes]
  );
  const latestAttempt = dashboard.recentAttempts[0] || null;
  const latestAttemptId = getAttemptId(latestAttempt);
  const weakTopic = dashboard.weakTopics[0] || null;
  const recommendedQuiz = useMemo(() => {
    if (!studentQuizzes.length) return null;
    if (inProgressQuiz) return inProgressQuiz;
    if (weakTopic) {
      const match = studentQuizzes.find((quiz) =>
        String(quiz.courseTitle || '') === String(weakTopic.courseTitle || '') &&
        String(quiz.topicName || '') === String(weakTopic.topicName || '')
      );
      if (match) return match;
    }
    return studentQuizzes.find((quiz) => !quiz.isCompleted && !quiz.completed) || studentQuizzes[0];
  }, [inProgressQuiz, studentQuizzes, weakTopic]);
  const recommendedNote = useMemo(() => {
    if (!aiNotes.length) return null;
    if (!weakTopic) return aiNotes[0];
    return aiNotes.find((note) =>
      String(note.courseTitle || '') === String(weakTopic.courseTitle || '') &&
      String(note.topicName || '') === String(weakTopic.topicName || '')
    ) || aiNotes[0];
  }, [aiNotes, weakTopic]);

  const readinessScore = clampPercent(dashboard.performanceSnapshot?.readinessScore || dashboard.avgScore);
  const levelProgress = useMemo(() => buildDashboardLevelProgress(dashboard), [dashboard]);
  const scoreDelta = Number(dashboard.performanceSnapshot?.scoreDelta || 0);
  const studyMood = getStudyMood({
    attempts: dashboard.totalAttempts,
    readinessScore,
    streak: dashboard.quizDayStreak,
  });
  const nextQuizId = getQuizId(recommendedQuiz);
  const continueTarget = inProgressQuiz && getQuizId(inProgressQuiz)
    ? appRoute(`/quizzes/${getQuizId(inProgressQuiz)}?mode=practice`)
    : nextQuizId
      ? appRoute(`/quizzes/${nextQuizId}`)
      : recommendedNote?.id
        ? appRoute(`/ai-notes/${recommendedNote.id}`)
        : appRoute('/quizzes');
  const continueLabel = inProgressQuiz ? 'Resume practice' : nextQuizId ? 'Start practice' : recommendedNote?.id ? 'Review lesson' : 'Open quizzes';
  const continueTitle = inProgressQuiz || recommendedQuiz
    ? getQuizTitle(inProgressQuiz || recommendedQuiz)
    : recommendedNote?.title || 'Build today\'s study rhythm';
  const continueText = inProgressQuiz
    ? `Next question ${Number(inProgressQuiz.lastQuestionIndex || 0) + 1}. Keep the set moving while it is fresh.`
    : weakTopic
      ? `${weakTopic.topicName} is the best place to gain marks today.`
      : latestAttempt
        ? `Your last attempt scored ${clampPercent(latestAttempt.percentage)}%. Review once, then try another focused set.`
        : 'Start with one compact practice set, review the answers, and finish with one lesson.';

  const courseProgress = dashboard.courseProgress;
  const courseProgressSummary = dashboard.courseProgressSummary;
  const serverDateKey = dashboard.serverClock?.dateKey || '';
  const courseCount = useMemo(() => {
    if (courseProgress.length) return courseProgress.length;
    const courseNames = new Set(
      [...studentQuizzes, ...aiNotes]
        .map((item) => item?.courseTitle || item?.courseName)
        .filter(Boolean)
        .map((name) => String(name).trim())
    );
    return courseNames.size || dashboard.totalCourses || dashboard.totalQuizzes || studentQuizzes.length || 0;
  }, [aiNotes, courseProgress.length, dashboard.totalCourses, dashboard.totalQuizzes, studentQuizzes]);

  const dashboardStats = [
    {
      label: 'Courses',
      value: courseCount,
      hint: courseProgressSummary.totalLessons
        ? `${clampPercent(courseProgressSummary.overallProgressPercent)}% lessons`
        : 'In progress',
      icon: 'book',
      tone: 'cyan',
      progress: courseProgressSummary.totalLessons ? courseProgressSummary.overallProgressPercent : null,
    },
    {
      label: 'Readiness',
      value: `${readinessScore}%`,
      hint: scoreDelta ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta}%` : 'Avg. readiness',
      icon: 'target',
      tone: 'violet',
      progress: readinessScore,
    },
    {
      label: 'Streak',
      value: dashboard.quizDayStreak,
      hint: dashboard.quizDayStreak > 0 ? plural(dashboard.quizDayStreak, 'active day') : 'Keep it going',
      icon: 'flame',
      tone: 'amber',
    },
  ];

  const quickActions = [
    {
      label: 'Exams',
      icon: 'exam',
      onClick: () => navigate(appRoute('/exams')),
    },
    {
      label: 'Planner',
      icon: 'calendar',
      onClick: () => navigate(appRoute('/planner')),
    },
    {
      label: 'Q-Bank',
      icon: 'target',
      onClick: () => navigate(appRoute('/quizzes')),
    },
    {
      label: 'Notes',
      icon: 'doc',
      onClick: () => navigate(appRoute('/ai-notes')),
    },
    {
      label: 'Bookmarks',
      icon: 'bookmark',
      onClick: () => navigate(appRoute('/bookmarks')),
    },
    {
      label: 'Weak areas',
      icon: 'chart',
      onClick: () => navigate(weakTopic ? continueTarget : appRoute('/results')),
    },
  ];

  const completedStudyText = [
    ...dashboard.dailyGoals.filter((goal) => goal.completed),
    ...dashboard.adaptivePlan.filter((item) => item.status === 'done'),
  ].map((item) => [
    item.key,
    item.title,
    item.description,
    item.actionType,
    item.progressText,
  ].filter(Boolean).join(' ').toLowerCase());
  const hasCompletedStudyItem = (...keywords) => completedStudyText.some((text) =>
    keywords.some((keyword) => text.includes(keyword))
  );
  const practiceFinishedToday = dashboard.recentAttempts.some((attempt) =>
    isSameStudyDay(attempt.submittedAt || attempt.completedAt || attempt.createdAt || attempt.updatedAt)
  ) || hasCompletedStudyItem('quiz', 'practice', 'question', 'weak_topic');
  const reviewFinished = hasCompletedStudyItem('review', 'result', 'answers');
  const lessonFinished = hasCompletedStudyItem('note', 'lesson', 'read');

  const planItems = [
    {
      label: 'Practice',
      title: weakTopic ? `Answer questions on ${weakTopic.topicName}` : 'Do one focused practice set',
      detail: weakTopic ? weakTopic.courseTitle : 'Use any short set you can finish today',
      completed: practiceFinishedToday,
      action: () => navigate(continueTarget),
    },
    {
      label: 'Review',
      title: latestAttemptId ? 'Review your latest answers' : 'Check your results page',
      detail: latestAttemptId ? getTopicLabel(latestAttempt, 'Latest result') : 'Create a result by completing an exam',
      completed: reviewFinished,
      action: () => navigate(latestAttemptId ? appRoute(`/review/${latestAttemptId}`) : appRoute('/results')),
    },
    {
      label: 'Lesson',
      title: recommendedNote?.title || 'Open one lesson note',
      detail: recommendedNote ? getTopicLabel(recommendedNote, 'Suggested note') : `${bookmarks.length} saved study items`,
      completed: lessonFinished,
      action: () => navigate(recommendedNote?.id ? appRoute(`/ai-notes/${recommendedNote.id}`) : appRoute('/ai-notes')),
    },
  ];

  const upcomingAgendaItems = [...plannerAgendaItems]
    .filter((item) => item?.title && !isAgendaItemComplete(item))
    .sort((a, b) => {
      const aDays = daysFromServerDate(a?.dueAt, serverDateKey);
      const bDays = daysFromServerDate(b?.dueAt, serverDateKey);
      const aOrder = aDays === null ? Number.POSITIVE_INFINITY : aDays;
      const bOrder = bDays === null ? Number.POSITIVE_INFINITY : bDays;
      return aOrder - bOrder || Number(b?.priority || 0) - Number(a?.priority || 0);
    });
  const nextExamItem = upcomingAgendaItems.find((item) => item.type === 'exam' && item.dueAt)
    || upcomingAgendaItems.find((item) => item.type === 'exam')
    || null;

  const onNavigate = (route) => {
    void nativeImpact(ImpactStyle.Light);
    if (route) navigate(route);
  };

  if (loading) {
    return (
      <main className="dashboard-page study-hub-page">
        <div className="study-hub-shell">
          <div className="study-loading-card">
            <div className="grid w-full max-w-[760px] gap-4" aria-hidden="true">
              <span className="skeleton-pulse h-6 w-44 rounded-full" />
              <span className="skeleton-pulse h-24 rounded-[18px]" />
              <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
                <span className="skeleton-pulse h-24 rounded-[18px]" />
                <span className="skeleton-pulse h-24 rounded-[18px]" />
                <span className="skeleton-pulse h-24 rounded-[18px]" />
              </div>
              <span className="skeleton-pulse h-32 rounded-[18px]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-page study-hub-page">
        <div className="study-hub-shell">
          <section className="study-error-card" role="alert">
            <span className="study-soft-icon study-soft-icon--danger"><Icon name="target" /></span>
            <div>
              <h1>Dashboard needs a refresh</h1>
              <p>{error}</p>
            </div>
            <StudyButton tone="primary" icon="arrow" onClick={() => setReloadKey((key) => key + 1)}>Try again</StudyButton>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page study-hub-page">
      <DashboardDustLayer />
      <div className="study-hub-shell">
        <AppHeader title="Study Hub" subtitle="Daily Focus" />

        <div className="study-hero-grid">
          <section className="study-continue-card" aria-label="Continue studying">
            <div className="study-hero-soft-shape" aria-hidden="true" />
            <DashboardHeroMascot mascot={heroMascot} />
            <div className="study-continue-card__copy">
              <span className="study-eyebrow">Continue where you left off</span>
              <div className="study-hero-name" title={`Welcome back, ${firstName}`}>
                <span className="study-hero-greeting">Welcome back,</span>
                <strong className="study-hero-name-nowrap">{firstName}</strong>
              </div>
              <p className="study-hero-lead">Next study move - <b>{inProgressQuiz ? 'PRACTICE' : recommendedNote ? 'LESSON' : 'PRACTICE'}</b></p>
              <div className="study-chip-row">
                <span><Icon name="stetho" /> {recommendedQuiz?.courseTitle || weakTopic?.courseTitle || 'Surgery'}</span>
                <span>{recommendedQuiz?.topicName || weakTopic?.topicName || recommendedNote?.topicName || 'Hernia'} · {readinessScore}% ready</span>
              </div>
              <div className="study-hero-actions">
                <StudyButton tone="primary" icon="play" onClick={() => onNavigate(continueTarget)}>{continueLabel}</StudyButton>
                <button type="button" className="study-square-action" aria-label="Open exams" onClick={() => onNavigate(appRoute('/quizzes'))}>
                  <Icon name="doc" />
                </button>
              </div>
            </div>
          </section>

          <StudyMoodCard mood={studyMood} todayLabel={todayLabel} className="study-mood-card--desktop" />
        </div>

        <section className="study-metric-grid" aria-label="Dashboard stats">
          {dashboardStats.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              icon={metric.icon}
              tone={metric.tone}
              progress={metric.progress}
            />
          ))}
        </section>

        <section className="study-medical-audit-grid" aria-label="Medical LMS dashboard checks">
          <CourseProgressCard
            courses={courseProgress}
            summary={courseProgressSummary}
            onOpenCourse={(course) => onNavigate(appRoute(`/courses/${course.id}`))}
            onOpenCourses={() => onNavigate(appRoute('/courses'))}
          />
          <ExamCountdownCard
            item={nextExamItem}
            serverClock={dashboard.serverClock}
            onOpen={() => onNavigate(nextExamItem ? agendaRoute(nextExamItem, '/exams') : appRoute('/exams'))}
          />
        </section>

        <section className="study-card study-streak-card">
          <div className="study-streak-top">
            <span className="study-streak-icon"><StudyMascot variant="streak" mood="streak" size="sm" label="Daily streak mascot" /></span>
            <div>
              <span className="study-eyebrow">Daily streak</span>
              <strong>{dashboard.quizDayStreak > 0 ? plural(dashboard.quizDayStreak, 'day') : 'Start your first streak today'}</strong>
            </div>
            <div className="study-streak-days">
              <strong>{dashboard.quizDayStreak}</strong>
              <span>days</span>
            </div>
          </div>
          <StreakHeatmap streak={dashboard.quizDayStreak} goalsCompleted={dashboard.dailyGoalsCompleted} />
          <div className="study-streak-footer">
            <span>Past 4 weeks · <b>{Math.max(dashboard.quizDayStreak, dashboard.dailyGoalsCompleted)}</b> active days</span>
            <button type="button" className="study-streak-link" onClick={() => onNavigate(appRoute('/results'))}>
              View history <span aria-hidden="true">&gt;</span>
            </button>
          </div>
        </section>

        <section className="study-section-head study-section-head--quick">
          <strong>Quick actions</strong>
        </section>

        <section className="study-action-grid" aria-label="Quick actions">
          {quickActions.map((action) => (
            <button type="button" className="study-action-card" key={action.label} onClick={() => onNavigate(null) || action.onClick()}>
              <span><Icon name={action.icon} /></span>
              <strong>{action.label}</strong>
            </button>
          ))}
        </section>

        <div className="study-readiness-stack">
          <StudyPlanCard
            items={planItems}
            onOpenPlanner={() => onNavigate(appRoute('/planner'))}
          />

          <UpcomingTasksCard
            items={upcomingAgendaItems}
            serverDateKey={serverDateKey}
            onOpenItem={(item) => onNavigate(agendaRoute(item))}
            onOpenPlanner={() => onNavigate(appRoute('/planner'))}
          />

          <AnalyticsSnapshotCard
            snapshot={dashboard.performanceSnapshot}
            progressNote={dashboard.progressNote}
            attempts={dashboard.recentAttempts}
            onOpenResults={() => onNavigate(appRoute('/results'))}
          />
        </div>

        <StudyMoodCard mood={studyMood} todayLabel={todayLabel} className="study-mood-card--mobile" />

        <DailyQuestionCard question={dashboard.questionOfDay} />

        <StudyLevelSummary name={firstName} progress={levelProgress} />
      </div>
    </main>
  );
}
