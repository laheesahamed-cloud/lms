import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchStudentQuizzes } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { StudyMascot } from '../../../../shared/ui/StudyMascot.jsx';
import { ImpactStyle, nativeImpact } from '../../../../shared/utils/nativeHaptics.js';
import { getQuizTitleText } from './quizLabels.js';

function runWhenIdle(task) {
  if (typeof window === 'undefined') { task(); return () => {}; }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(task, 300);
  return () => window.clearTimeout(timer);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IcoBook()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 2h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4V2z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M7.5 3h4v9h-4" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M7.5 7h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function IcoClock()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4.5V7l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoPlay()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l8 4.5-8 4.5V2.5z" fill="currentColor"/></svg>; }
function IcoPen()         { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M4.5 5h5M4.5 7h5M4.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
function IcoTrophy()      { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2H10V6.5A3 3 0 0 1 4 6.5V2Z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M2 3H4M10 3H12M7 6.5V9.5M5 12H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
function IcoBookmark()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 1.5h8a.5.5 0 0 1 .5.5v9l-4.5-2.5L2 11V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>; }
function IcoSearch()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoChevron()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 4l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoBrain()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13C4.5 13 2 11 2 8C2 5.5 3.8 3.2 6 3C6.3 2 7 1.5 7.5 1.5C9.2 1.5 12 3.2 12 6C13.4 6.6 13.4 8.2 12.5 9.2C12.5 11.5 10 13 7 13Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/></svg>; }
function IcoLock()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 6V4.5A2.5 2.5 0 0 1 7 2A2.5 2.5 0 0 1 9.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function IcoCheck()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoLayers()      { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 5.5L8 9L2 5.5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/><path d="M2 9L8 12.5L14 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }

const TOPIC_TONES = [
  { iconBg: 'rgba(59, 130, 246, 0.13)', color: '#2563eb' },
  { iconBg: 'rgba(97, 165, 246, 0.13)', color: '#2563eb' },
  { iconBg: 'rgba(37, 99, 235, 0.11)', color: '#1d4ed8' },
  { iconBg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed' },
  { iconBg: 'rgba(97, 165, 246, 0.14)', color: '#2563eb' },
  { iconBg: 'rgba(67, 56, 202, 0.11)', color: '#4338ca' },
];

const QUIZ_COURSE_TONES = [
  {
    bg: 'bg-brand-primary/10 text-brand-primary dark:bg-sky-400/12 dark:text-sky-100',
    icon: <IcoLayers />,
    accent: '125, 211, 252',
    accent2: '96, 165, 250',
    artHue: '0deg',
  },
  {
    bg: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-300/12 dark:text-emerald-100',
    icon: <IcoBrain />,
    accent: '134, 239, 172',
    accent2: '45, 212, 191',
    artHue: '74deg',
  },
  {
    bg: 'bg-violet-500/10 text-violet-700 dark:bg-violet-300/12 dark:text-violet-100',
    icon: <IcoPen />,
    accent: '216, 180, 254',
    accent2: '192, 132, 252',
    artHue: '248deg',
  },
  {
    bg: 'bg-amber-500/10 text-amber-700 dark:bg-amber-300/12 dark:text-amber-100',
    icon: <IcoBook />,
    accent: '253, 186, 116',
    accent2: '251, 146, 60',
    artHue: '168deg',
  },
  {
    bg: 'bg-rose-500/10 text-rose-700 dark:bg-rose-300/12 dark:text-rose-100',
    icon: <IcoTrophy />,
    accent: '251, 207, 232',
    accent2: '244, 114, 182',
    artHue: '214deg',
  },
  {
    bg: 'bg-teal-500/10 text-teal-700 dark:bg-teal-300/12 dark:text-teal-100',
    icon: <IcoClock />,
    accent: '153, 246, 228',
    accent2: '94, 234, 212',
    artHue: '96deg',
  },
  {
    bg: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-300/12 dark:text-indigo-100',
    icon: <IcoSearch />,
    accent: '199, 210, 254',
    accent2: '129, 140, 248',
    artHue: '282deg',
  },
  {
    bg: 'bg-lime-500/10 text-lime-700 dark:bg-lime-300/12 dark:text-lime-100',
    icon: <IcoCheck />,
    accent: '217, 249, 157',
    accent2: '163, 230, 53',
    artHue: '52deg',
  },
];

const QUIZ_COURSE_STOCK_VISUALS = [
  {
    key: 'medicine',
    image: 'medicine-cutout.png',
    match: /(medicine|medical|clinical|internal|rheum|cardio|hema|renal|gastro|endo|neuro|resp|micro|pharma)/i,
  },
  {
    key: 'surgery',
    image: 'surgery-cutout.png',
    match: /(surgery|surgical|ortho|trauma|operative|anatomy|anaesth|anesth)/i,
  },
  {
    key: 'maternal',
    image: 'maternal-cutout.png',
    match: /(gyn|obst|preg|maternal|repro|paed|pediatr|child)/i,
  },
  {
    key: 'systems',
    image: 'systems-cutout.png',
    match: /(system|basic|foundation|general|revision|path)/i,
  },
];

const quizCourseArtBase = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}lms-assets/quiz-course-art/`;

function getQuizCourseTone(index) {
  return QUIZ_COURSE_TONES[index % QUIZ_COURSE_TONES.length];
}

function getQuizCourseStockVisual(name, index = 0) {
  const text = String(name || '');
  const matched = QUIZ_COURSE_STOCK_VISUALS.find((item) => item.match.test(text));
  return matched || QUIZ_COURSE_STOCK_VISUALS[index % QUIZ_COURSE_STOCK_VISUALS.length] || QUIZ_COURSE_STOCK_VISUALS[0];
}

function CourseStockArt({ visual }) {
  const src = `${quizCourseArtBase}${visual.image}`;
  return (
    <img
      className="quiz-course-stock-art"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
    />
  );
}

function TopicMarkerIcon({ index }) {
  const icon = index % 6;
  if (icon === 0) return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M2 6h8M2 8.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
  if (icon === 1) return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.8l4 2.3v4.6L6 11 2 8.7V4.1l4-2.3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M6 6.2l4-2.1M6 6.2L2 4.1M6 6.2V11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
  if (icon === 2) return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.25"/><path d="M6 3.2v3l2 1.3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (icon === 3) return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 8.8V3.2A1.2 1.2 0 0 1 3.7 2h4.6a1.2 1.2 0 0 1 1.2 1.2v5.6L6 7.1 2.5 8.8z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/></svg>;
  if (icon === 4) return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2h4.2L9 3.8V10H3V2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M7 2v2h2M4.3 6h3.4M4.3 8h2.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
}

function SubjectIcon({ name }) {
  const key = String(name || '').toLowerCase();
  if (/cardio|heart/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13.5S2.5 10.4 2.5 6.2A2.7 2.7 0 0 1 7.3 4.5L8 5.4l.7-.9a2.7 2.7 0 0 1 4.8 1.7C13.5 10.4 8 13.5 8 13.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>;
  if (/neuro|brain|psych/.test(key)) return <IcoBrain />;
  if (/resp|pulmo|lung/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 3.5v8M9 3.5v8M7 7c-2.3.2-3.7 1.8-3.7 4.2v1.3A2.1 2.1 0 0 0 5.4 14C6.5 14 7 12.9 7 11.7V7zM9 7c2.3.2 3.7 1.8 3.7 4.2v1.3a2.1 2.1 0 0 1-2.1 1.5C9.5 14 9 12.9 9 11.7V7z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (/hema|blood|leuk|leuc/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2.2s4 4.3 4 7.3A4 4 0 1 1 4 9.5c0-3 4-7.3 4-7.3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6.4 10.2h3.2M8 8.6v3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
  if (/renal|kidney|uro/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.8 3.2c-2.2.2-3.6 2.2-3.3 5.1.2 2.2 1.3 4 2.8 4 1 0 1.6-.8 1.6-2.1V5.4c0-1.5-.4-2.3-1.1-2.2zM9.2 3.2c2.2.2 3.6 2.2 3.3 5.1-.2 2.2-1.3 4-2.8 4-1 0-1.6-.8-1.6-2.1V5.4c0-1.5.4-2.3 1.1-2.2z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/></svg>;
  if (/gastro|hepato|liver|stomach/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.5 3.5h5.2c1.8 0 3.3 1.5 3.3 3.3 0 2.9-2.3 5.2-5.2 5.2H6.4A3.4 3.4 0 0 1 3 8.6V5a1.5 1.5 0 0 1 1.5-1.5z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/><path d="M6 6.2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
  if (/rheum|ortho|bone|joint/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5.2 4.4A1.7 1.7 0 1 1 6.8 2a1.7 1.7 0 0 1 2.4 2.4l-4.8 4.8A1.7 1.7 0 1 1 2 6.8a1.7 1.7 0 0 1 3.2-2.4zM10.8 11.6A1.7 1.7 0 1 0 9.2 14a1.7 1.7 0 0 0-2.4-2.4l4.8-4.8A1.7 1.7 0 1 0 14 9.2a1.7 1.7 0 0 0-3.2 2.4z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/></svg>;
  if (/endo|diabet|thyroid/.test(key)) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M5.2 4.5c0 1.2 1.1 2.2 2.8 2.2s2.8-1 2.8-2.2M5.2 11.5c0-1.2 1.1-2.2 2.8-2.2s2.8 1 2.8 2.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></svg>;
  return <IcoLayers />;
}

function isQuizDone(quiz) {
  return quiz.isCompleted || quiz.completed || quiz.practiceStatus === 'completed' || Number(quiz.examAttemptCount || 0) > 0 || Number(quiz.practiceCompletedCount || 0) > 0;
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, numeric));
}

function quizStatus(quiz) {
  if (isQuizDone(quiz)) return 'completed';
  if (quiz.practiceSessionId) return 'in_progress';
  return 'not_started';
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function statusTone(status) {
  if (status === 'completed') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/22 dark:bg-sky-400/10 dark:text-sky-100';
  if (status === 'in_progress') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-cyan-300/24 dark:bg-cyan-300/10 dark:text-cyan-100';
  return 'border-brand-primary/18 bg-brand-primary/7 text-brand-primary/80 dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-200';
}

function getQuizDisplay(quiz, quizIndex, label = 'Practice') {
  const numberLabel = `${label} ${String(quizIndex + 1).padStart(2, '0')}`;
  const title = String(quiz.studentTitle || quiz.quizTitle || numberLabel).trim();
  const numberFirst = quiz.displayTitleMode !== 'title';
  return {
    numberLabel,
    primary: numberFirst ? numberLabel : title,
    secondary: numberFirst && title !== numberLabel ? title : '',
    badge: numberFirst ? '' : numberLabel,
  };
}

const subscriptionProgressFillClass =
  'bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))]';

function unitTone(status) {
  if (status === 'completed') {
    return {
      card: 'border-brand-primary/18 dark:border-sky-300/20',
      header: 'bg-surface-card dark:bg-white/[0.035]',
      circle: 'bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:bg-sky-400/14 dark:text-sky-100',
      rail: 'border-brand-primary/34 dark:border-sky-300/42',
      accent: 'bg-brand-primary dark:bg-sky-400',
      progress: subscriptionProgressFillClass,
    };
  }
  if (status === 'in_progress') {
    return {
      card: 'border-brand-primary/18 dark:border-sky-300/20',
      header: 'bg-surface-card dark:bg-white/[0.035]',
      circle: 'bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:bg-sky-400/14 dark:text-sky-100',
      rail: 'border-brand-primary/34 dark:border-sky-300/42',
      accent: 'bg-brand-primary dark:bg-sky-400',
      progress: subscriptionProgressFillClass,
    };
  }
  return {
    card: 'border-line-soft dark:border-sky-300/12',
    header: 'bg-surface-card dark:bg-white/[0.035]',
    circle: 'bg-brand-primary/8 text-brand-primary dark:bg-sky-400/10 dark:text-sky-200',
    rail: 'border-brand-primary/20 dark:border-sky-300/24',
    accent: 'bg-brand-primary/70 dark:bg-sky-400/70',
    progress: subscriptionProgressFillClass,
  };
}

function groupStatus(items) {
  const total = items.length;
  const completed = items.filter(isQuizDone).length;
  if (total > 0 && completed === total) return 'completed';
  if (items.some((quiz) => quiz.practiceSessionId || isQuizDone(quiz))) return 'in_progress';
  return 'not_started';
}

function getNextQuiz(items) {
  return (
    items.find((quiz) => quiz.practiceSessionId && !isQuizDone(quiz)) ||
    items.find((quiz) => !isQuizDone(quiz)) ||
    items[0] ||
    null
  );
}

function ProgressBar({ value, className = '', fillClassName = subscriptionProgressFillClass }) {
  const percent = clampPercent(value);
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.09]', className)}>
      <span className={cx('block h-full rounded-full transition-[width] duration-700 ease-out', fillClassName)} style={{ width: `${percent}%` }} />
    </div>
  );
}

function sortQuizzesByHierarchy(items) {
  return [...items].sort((a, b) => {
    const aKey = [a.topicName, a.subtopicName, a.lessonTitle, a.quizTitle].filter(Boolean).join('\u0001');
    const bKey = [b.topicName, b.subtopicName, b.lessonTitle, b.quizTitle].filter(Boolean).join('\u0001');
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function groupQuizzesByTopic(items) {
  const map = new Map();
  sortQuizzesByHierarchy(items).forEach((quiz) => {
    const topicName = quiz.topicName && quiz.topicName !== quiz.subjectName ? quiz.topicName : '';
    const key = topicName || quiz.subtopicName || (quiz.isGeneral ? 'General Revision' : 'Other quizzes');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(quiz);
  });
  return [...map.entries()];
}

// ─── Quiz card ────────────────────────────────────────────────────────────────

function QBankRow({ quiz, quizIndex, bookmarked, onBookmark, onAccessNeeded, navigate, pageMode }) {
  const isExamPage    = pageMode === 'exam';
  const isDone        = isQuizDone(quiz);
  const canOpenMode   = isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false;
  const accessFeature = isExamPage ? 'examMode' : 'practiceMode';
  const actionPath    = `/quizzes/${quiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`;
  const accessMessage = quiz.accessMessage || `This premium ${isExamPage ? 'exam' : 'practice set'} is included with selected plans.`;
  const quizDisplay   = getQuizDisplay(quiz, quizIndex, isExamPage ? 'Exam' : 'Practice');

  function openQuiz() {
    if (canOpenMode) {
      navigate(actionPath);
      return;
    }
    onAccessNeeded({ ...quiz, accessFeature, accessMessage });
  }

  return (
    <article
      className="grid min-h-[92px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-transparent px-5 py-4 text-left transition-colors hover:bg-surface-2/55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 dark:hover:bg-white/[0.035] max-[540px]:min-h-[88px] max-[540px]:gap-3.5 max-[540px]:px-3.5 max-[540px]:py-3.5"
      role="button"
      tabIndex={0}
      onClick={openQuiz}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openQuiz();
        }
      }}
      title={!canOpenMode ? accessMessage : `Open ${quizDisplay.primary}`}
    >
      <div className="flex min-w-0 items-start gap-3.5 max-[540px]:gap-3">
        {quizDisplay.badge ? (
          <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line-soft bg-surface-2 px-2.5 text-[10px] font-black uppercase leading-none text-ink-muted dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-slate-400 max-[540px]:h-7 max-[540px]:rounded-md max-[540px]:px-2 max-[540px]:text-[9px]">
            {quizDisplay.badge}
          </span>
        ) : null}
        <div className="grid min-w-0 flex-1 gap-2">
            <h3 className="m-0 line-clamp-2 min-w-0 text-[15px] font-extrabold leading-[1.48] text-ink-strong dark:text-white max-[540px]:text-[14px] max-[540px]:leading-[1.45]">{quizDisplay.primary}</h3>
            {quizDisplay.secondary ? (
              <p className="m-0 line-clamp-2 text-[13px] font-semibold leading-[1.45] text-ink-muted dark:text-slate-400 max-[540px]:text-[12px]">{quizDisplay.secondary}</p>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold leading-4 text-ink-muted dark:text-slate-500 max-[540px]:gap-1.5 max-[540px]:text-[10px]">
            {isDone ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 font-black text-brand-primary">
                  <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-brand-primary/12 text-[9px] leading-none" aria-hidden="true">✓</span>
                  Completed
                </span>
            ) : null}
            {isExamPage && quiz.examModeOnly ? (
              <span className="rounded-full border border-brand-primary/22 bg-[var(--color-primary-light)] px-2 py-0.5 text-[9px] font-black uppercase leading-4 text-brand-primary">Exam only</span>
            ) : null}
            {!quiz.isFree && !canOpenMode ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase leading-4 text-amber-700 dark:text-amber-300">Premium</span>
            ) : null}
            </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 max-[540px]:gap-1.5">
        {isExamPage && isDone && (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-medium bg-surface-2 px-3 text-[11.5px] font-extrabold text-ink-strong dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-200 max-[540px]:size-8 max-[540px]:justify-center max-[540px]:p-0"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/results?quizId=${quiz.id}`);
            }}
          >
            <IcoTrophy/><span className="max-[540px]:hidden">Results</span>
          </button>
        )}

        <button
          type="button"
          className={cx(
            'grid size-9 place-items-center rounded-lg border max-[540px]:size-8',
            bookmarked
              ? 'border-brand-primary/28 bg-[var(--color-primary-light)] text-brand-primary'
              : 'border-line-medium bg-surface-2 text-ink-muted dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-400'
          )}
          onClick={(event) => {
            event.stopPropagation();
            onBookmark(event, quiz.id);
          }}
          title={bookmarked ? 'Remove bookmark' : 'Save for later'}
          aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
        >
          <IcoBookmark/>
        </button>
      </div>
    </article>
  );
}

// ─── Lesson-map style quiz group ──────────────────────────────────────────────

function QuizMapRow({ quiz, quizIndex, bookmarked, onBookmark, onAccessNeeded, navigate, pageMode }) {
  const isExamPage = pageMode === 'exam';
  const status = quizStatus(quiz);
  const canOpenMode = isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false;
  const hasPracticeReview = Number(quiz.practiceCompletedCount || 0) > 0;
  const hasExamReview = Boolean(quiz.latestAttemptId);
  const hasReviewTarget = hasPracticeReview || hasExamReview;
  const canReviewPractice = quiz.canAccess !== false && quiz.accessLocked !== true && hasReviewTarget;
  const accessFeature = isExamPage ? 'examMode' : 'practiceMode';
  const accessMessage = quiz.accessMessage || `This premium ${isExamPage ? 'exam' : 'practice set'} is included with selected plans.`;
  const actionPath = `/quizzes/${quiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`;
  const practiceReviewPath = hasPracticeReview
    ? `/quizzes/${quiz.id}/practice-review?complete=1`
    : hasExamReview
      ? `/review/${quiz.latestAttemptId}`
      : '';
  const quizDisplay = getQuizDisplay(quiz, quizIndex, isExamPage ? 'Exam' : 'Practice');
  const quizContextLabel = quiz.topicName || quiz.subtopicName || quiz.lessonTitle;
  const isLocked = !quiz.isFree && !canOpenMode;
  const displayTitle = quizDisplay.secondary || quizDisplay.primary;

  function openQuiz() {
    if (canOpenMode) { navigate(actionPath); return; }
    onAccessNeeded({ ...quiz, accessFeature, accessMessage });
  }

  function openPracticeReview() {
    void nativeImpact(ImpactStyle.Light);
    if (canReviewPractice) { navigate(practiceReviewPath); return; }
    if (!hasReviewTarget && canOpenMode) { navigate(actionPath); return; }
    onAccessNeeded({ ...quiz, accessFeature, accessMessage });
  }

  const cardBg = status === 'completed'
    ? 'border-brand-primary/18 bg-surface-card dark:border-sky-400/16 dark:bg-white/[0.035]'
    : status === 'in_progress'
      ? 'border-brand-primary/20 bg-surface-card dark:border-sky-400/18 dark:bg-white/[0.035]'
      : isLocked
        ? 'border-amber-400/18 bg-surface-card dark:border-amber-400/14 dark:bg-white/[0.035]'
        : 'border-line-soft bg-surface-card hover:border-brand-primary/22 hover:bg-surface-2/35 dark:border-sky-300/12 dark:bg-white/[0.035] dark:hover:border-sky-400/18 dark:hover:bg-white/[0.055]';

  const iconBg = status === 'completed'
    ? 'border-brand-primary/30 bg-brand-primary/14 text-brand-primary dark:bg-sky-400/16 dark:text-sky-100'
    : status === 'in_progress'
      ? 'border-brand-primary/32 bg-brand-primary/14 text-brand-primary dark:bg-sky-400/16 dark:text-sky-100'
      : isLocked ? 'border-amber-400/38 bg-amber-400/12 text-amber-700 dark:text-amber-300'
      : 'border-brand-primary/18 bg-brand-primary/8 text-brand-primary dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200';

  const statusIcon = status === 'completed' ? <IcoCheck/> : status === 'in_progress' ? <IcoPlay/> : isLocked ? <IcoLock/> : <IcoPen/>;

  const numChip = status === 'completed'
    ? 'bg-brand-primary/10 text-brand-primary dark:text-sky-200'
    : status === 'in_progress' ? 'bg-brand-primary/10 text-brand-primary dark:text-sky-200'
    : isLocked ? 'bg-amber-400/10 text-amber-700 dark:text-amber-400'
    : 'bg-brand-primary/7 text-brand-primary/80 dark:bg-sky-400/10 dark:text-sky-300';

  const actionBtn = isLocked
    ? 'border-amber-400/28 bg-amber-400/8 text-amber-700 hover:bg-amber-400/14 dark:border-amber-400/22 dark:text-amber-300'
    : status === 'completed'
      ? 'border-brand-primary/20 bg-brand-primary/8 text-brand-primary hover:bg-brand-primary/12 dark:border-sky-300/20 dark:text-sky-200 dark:hover:bg-sky-400/12'
      : 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary hover:bg-brand-primary/14 dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200 dark:hover:bg-sky-400/18';

  const nodeClass = status === 'completed'
    ? 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200'
    : status === 'in_progress'
      ? 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200'
      : isLocked
        ? 'border-amber-400/35 bg-amber-400 text-white shadow-none'
        : 'border-brand-primary/22 bg-brand-primary/10 text-brand-primary dark:border-sky-300/18 dark:bg-sky-400/12 dark:text-sky-200';

  return (
    <div className="relative pl-8 max-[640px]:pl-7">
      <span className={cx('absolute left-[2px] top-1/2 z-[1] grid size-6 -translate-y-1/2 place-items-center rounded-full border text-[11px]', nodeClass)} aria-hidden="true">
        {status === 'completed' ? <IcoCheck/> : status === 'in_progress' ? <IcoPlay/> : isLocked ? <IcoLock/> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <div className={cx('lms-quiz-set-card group relative overflow-hidden rounded-2xl border shadow-none transition-[border-color,background] duration-150', cardBg)}>
      <div className="grid min-h-[70px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 max-[560px]:grid-cols-1 max-[560px]:gap-2.5 max-[520px]:px-2.5">
        <button
          type="button"
          className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 max-[540px]:grid-cols-[34px_minmax(0,1fr)] max-[540px]:gap-2.5"
          onClick={openQuiz}
          title={!canOpenMode ? accessMessage : `Open ${quizDisplay.numberLabel}`}
        >
          <span className={cx('grid size-[38px] shrink-0 place-items-center rounded-2xl border max-[540px]:size-[34px] max-[540px]:rounded-xl', iconBg)}>
            {statusIcon}
          </span>
          <span className="min-w-0">
            <span className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={cx('inline-flex h-5 items-center rounded px-1.5 text-[9.5px] font-black uppercase leading-none', numChip)}>
                {quizDisplay.numberLabel}
              </span>
              {status === 'completed' && (
                <span className="inline-flex h-5 items-center gap-0.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 text-[9.5px] font-black text-brand-primary dark:text-sky-200">Done</span>
              )}
              {status === 'in_progress' && (
                <span className="inline-flex h-5 items-center rounded-full border border-brand-primary/22 bg-brand-primary/8 px-2 text-[9.5px] font-black text-brand-primary dark:text-sky-200">Active</span>
              )}
              {isExamPage && quiz.examModeOnly && (
                <span className="inline-flex h-5 items-center rounded-full border border-brand-primary/22 bg-[var(--color-primary-light)] px-2 text-[9px] font-black uppercase text-brand-primary">Exam only</span>
              )}
              {isLocked && (
                <span className="inline-flex h-5 items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">Premium</span>
              )}
            </span>
            <strong className="block truncate text-[14px] font-extrabold leading-snug text-ink-strong dark:text-slate-100 max-[540px]:text-[13px]">{displayTitle}</strong>
            {quizContextLabel ? (
              <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-ink-soft dark:text-slate-500 max-[540px]:text-[11px]">
                {[quizContextLabel, quiz.lessonTitle && quiz.lessonTitle !== quizContextLabel ? quiz.lessonTitle : null].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-[560px]:justify-start max-[560px]:pl-[44px] max-[540px]:gap-1.5 max-[540px]:pl-[42px]">
          <button
            type="button"
            className={cx('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold transition-[background,border-color,opacity] duration-150 max-[540px]:min-h-9 max-[540px]:px-2.5 max-[380px]:[&_span]:sr-only', actionBtn)}
            onClick={openQuiz}
            title={!canOpenMode ? accessMessage : undefined}
          >
            {isLocked ? <><IcoLock/><span>Unlock</span></> : isExamPage ? <span>Start Exam</span> : status === 'in_progress' ? <><IcoPlay/><span>Resume</span></> : status === 'completed' ? <><IcoPlay/><span>Retake</span></> : <><IcoPlay/><span>Start</span></>}
          </button>

          {!isExamPage && status === 'completed' && hasReviewTarget ? (
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/8 px-3 text-[12px] font-bold text-brand-primary transition-[background,border-color] duration-150 hover:bg-brand-primary/12 dark:border-sky-300/22 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/16 max-[540px]:min-h-9 max-[540px]:px-2.5"
              onClick={openPracticeReview}
              title="Review answers and explanations"
            >
              <IcoBook/><span>Review answers</span>
            </button>
          ) : null}

          {isExamPage && status === 'completed' ? (
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-brand-primary/18 bg-brand-primary/7 px-3 text-[12px] font-bold text-brand-primary hover:bg-brand-primary/12 dark:border-sky-300/18 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/16 max-[540px]:min-h-9"
              onClick={() => navigate(`/results?quizId=${quiz.id}`)}
            >
              <IcoTrophy/><span className="ml-1 max-[540px]:hidden">Results</span>
            </button>
          ) : null}

          <button
            type="button"
            className={cx(
              'grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border transition-[background,border-color] duration-150 max-[540px]:min-h-[40px] max-[540px]:min-w-[40px]',
              bookmarked
                ? 'border-brand-primary/28 bg-[var(--color-primary-light)] text-brand-primary'
                : 'border-brand-primary/16 bg-brand-primary/10 text-brand-primary/70 hover:bg-brand-primary/15 dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-200/75 dark:hover:bg-sky-400/15'
            )}
            onClick={(event) => onBookmark(event, quiz.id)}
            title={bookmarked ? 'Remove bookmark' : 'Save for later'}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
          >
            <IcoBookmark/>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function CourseGroup({ course, quizzes, groupIndex, bookmarkedIds, onBookmark, onAccessNeeded, navigate, pageMode }) {
  const [open, setOpen] = useState(false);
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const done = quizzes.filter(isQuizDone).length;
  const pct = quizzes.length ? Math.round((done / quizzes.length) * 100) : 0;
  const topicGroups = groupQuizzesByTopic(quizzes);
  const status = groupStatus(quizzes);
  const tone = unitTone(status);
  const setLabel = pageMode === 'exam' ? 'exam set' : 'practice set';
  let quizCounter = 0;

  function toggleTopic(topicIndex) {
    setOpenTopics((current) => {
      const next = new Set(current);
      if (next.has(topicIndex)) next.delete(topicIndex);
      else next.add(topicIndex);
      return next;
    });
  }

  return (
    <section className="grid gap-3.5">
      <button
        type="button"
        className={cx('lms-quiz-subject-card grid min-h-[104px] w-full overflow-hidden rounded-[18px] border px-4 py-3.5 text-left shadow-sm transition-[border-color,background] duration-150 hover:border-brand-primary/18 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 max-[520px]:min-h-[92px] max-[520px]:rounded-[16px] max-[520px]:px-3 max-[520px]:py-3 sm:grid-cols-[minmax(0,1fr)_minmax(190px,300px)] sm:items-center', tone.card, tone.header)}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={cx('relative grid size-12 shrink-0 place-items-center rounded-[18px] border border-current/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] max-[520px]:size-11 max-[520px]:rounded-2xl', tone.circle)}>
            {status === 'completed' ? <IcoCheck/> : status === 'in_progress' ? <IcoPlay/> : <SubjectIcon name={course} />}
          </span>
          <div className="relative grid min-w-0 gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-primary/14 bg-brand-primary/8 px-2.5 py-0.5 text-[9.5px] font-black uppercase text-brand-primary dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-200">
                Subject {String(groupIndex + 1).padStart(2, '0')}
              </span>
              <span className={cx('rounded-full border px-2.5 py-0.5 text-[9.5px] font-black uppercase', statusTone(status))}>
                {statusLabel(status)}
              </span>
            </div>
            <h3 className="m-0 min-w-0 truncate text-[clamp(18px,2vw,24px)] font-black leading-tight text-ink-strong dark:text-white">
              {course}
            </h3>
            <p className="m-0 truncate text-[11.5px] font-semibold text-ink-muted dark:text-slate-500">
              {topicGroups.length} topic{topicGroups.length === 1 ? '' : 's'} · {quizzes.length} {setLabel}{quizzes.length === 1 ? '' : 's'} · {done} done
            </p>
            {!open ? (
              <p className="m-0 text-[10.5px] font-black uppercase tracking-[0.06em] text-brand-primary/75 dark:text-sky-200/80">
                Open topics
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 max-[520px]:gap-2">
          <ProgressBar value={pct} className="h-1.5" fillClassName={tone.progress} />
          <strong className="min-w-11 text-right text-[20px] font-black tabular-nums text-ink-strong dark:text-white max-[520px]:text-[18px]">{pct}%</strong>
          <span className={cx('grid size-9 place-items-center rounded-xl border border-brand-primary/14 bg-brand-primary/8 text-brand-primary transition-transform duration-150 dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-200 max-[520px]:size-8', open && 'rotate-90')} aria-hidden="true">
            <IcoChevron/>
          </span>
        </div>
      </button>

      {open ? (
        <div className="grid gap-3">
            {topicGroups.map(([topicName, topicQuizzes], topicIndex) => {
              const topicKey = `${course}:${topicName}:${topicIndex}`;
              const topicOpen = openTopics.has(topicIndex);
              const topicDone = topicQuizzes.filter(isQuizDone).length;
              const topicComplete = topicQuizzes.length > 0 && topicDone === topicQuizzes.length;
              const topicPct = topicQuizzes.length ? Math.round((topicDone / topicQuizzes.length) * 100) : 0;
              const topicStartIndex = quizCounter;
              quizCounter += topicQuizzes.length;

              return (
                <section key={topicKey} className="lms-quiz-topic-card relative overflow-hidden rounded-[18px] border border-line-soft bg-surface-card p-3 shadow-sm dark:border-sky-300/12 dark:bg-white/[0.035] max-[520px]:rounded-[16px] max-[520px]:p-2.5">
                  <span className={cx('absolute bottom-5 left-[26px] top-[62px] w-px bg-gradient-to-b from-brand-primary/45 via-brand-primary/22 to-transparent dark:from-sky-300/44 dark:via-sky-300/20 max-[640px]:left-[23px]', !topicOpen && 'hidden')} aria-hidden="true" />
                  <button
                    type="button"
                    className="relative grid min-h-[58px] w-full grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-1.5 py-1 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 dark:hover:bg-sky-400/[0.035] max-[520px]:grid-cols-[40px_minmax(0,1fr)_auto] max-[520px]:gap-2"
                    onClick={() => toggleTopic(topicIndex)}
                  >
                    <span
                      className="grid size-10 place-items-center rounded-2xl border shadow-[0_8px_22px_rgba(15,23,42,0.04)] max-[520px]:size-9"
                      style={topicComplete
                        ? { background: 'rgba(37,99,235,0.14)', color: '#2563eb', borderColor: 'rgba(37,99,235,0.22)' }
                        : { background: TOPIC_TONES[topicIndex % TOPIC_TONES.length].iconBg, color: TOPIC_TONES[topicIndex % TOPIC_TONES.length].color, borderColor: 'rgba(148,163,184,0.16)' }
                      }
                    >
                      {topicComplete ? <IcoCheck/> : <TopicMarkerIcon index={topicIndex} />}
                    </span>
                    <div className="min-w-0">
                      <span className="mb-0.5 block text-[9.5px] font-black uppercase tracking-[0.06em] text-brand-primary dark:text-sky-300">
                        Topic {groupIndex + 1}.{topicIndex + 1}
                      </span>
                      <strong className="block truncate text-[clamp(14px,1.4vw,17px)] font-black leading-tight text-ink-strong dark:text-white">
                        {topicName}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-ink-muted dark:text-slate-500">
                        {topicDone}/{topicQuizzes.length} sets completed
                      </span>
                    </div>
                    <div className="flex min-w-[116px] shrink-0 items-center justify-end gap-2 text-[15px] text-ink-soft dark:text-slate-300 max-[520px]:min-w-[86px]">
                      <span className="grid min-w-[74px] gap-1 max-[520px]:min-w-[52px]">
                        <span className="justify-self-end text-[15px] font-black tabular-nums text-brand-primary dark:text-sky-300 max-[520px]:text-[13px]">
                          {topicDone}/{topicQuizzes.length}
                        </span>
                        <ProgressBar value={topicPct} className="h-1" />
                      </span>
                      <span className={cx('grid size-8 place-items-center rounded-xl border border-brand-primary/16 bg-brand-primary/7 text-brand-primary transition-transform duration-150 dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-200', topicOpen && 'rotate-90')} aria-hidden="true">
                        <IcoChevron/>
                      </span>
                    </div>
                  </button>

                  {topicOpen ? (
                    <div className="relative grid grid-cols-1 gap-2.5 py-1.5 pr-0.5">
                      {topicQuizzes.map((quiz, quizIndex) => {
                        const index = topicStartIndex + quizIndex;
                        return (
                          <QuizMapRow
                            key={quiz.id}
                            quiz={quiz}
                            quizIndex={index}
                            bookmarked={bookmarkedIds.has(quiz.id)}
                            onBookmark={onBookmark}
                            onAccessNeeded={onAccessNeeded}
                            navigate={navigate}
                            pageMode={pageMode}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
        </div>
      ) : null}
    </section>
  );
}

function QuizFilterPanel({
  isExamPage,
  statusItems,
  statusFilter,
  onStatusChange,
  visibleSubjects,
  subjectFilter,
  onSubjectChange,
  visibleTopics,
  topicFilter,
  onTopicChange,
}) {
  const showSubjects = visibleSubjects.length > 1;
  const showTopics = visibleTopics.length > 1;

  return (
    <div className="rounded-2xl border border-line-soft bg-surface-card p-3.5 shadow-sm shadow-slate-950/[0.03] dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.92)] dark:shadow-black/20 max-[520px]:rounded-xl max-[520px]:p-2.5">
      <div className="grid gap-3 max-[520px]:gap-2.5">
        {statusItems?.length ? (
          <div className="grid min-w-0 gap-1.5">
            <span className="text-[10.5px] font-black uppercase tracking-[0.08em] text-ink-muted">Categories</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1.5 [-webkit-overflow-scrolling:touch]">
              {statusItems.map((item) => {
                const active = statusFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cx(
                      'inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 text-[11.5px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 max-[520px]:min-h-8 max-[520px]:px-3 max-[520px]:text-[10.5px]',
                      active
                        ? 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200'
                        : 'border-brand-primary/12 bg-white/70 text-ink-soft hover:border-brand-primary/22 hover:bg-brand-primary/10 hover:text-ink-strong dark:border-sky-300/12 dark:bg-sky-400/[0.045] dark:text-slate-400 dark:hover:text-slate-200'
                    )}
                    onClick={() => onStatusChange(item.key)}
                  >
                    <span>{item.label}</span>
                    <span className={cx(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                      active
                        ? 'bg-white/70 text-brand-primary dark:bg-white/[0.12] dark:text-sky-100'
                        : 'bg-brand-primary/7 text-brand-primary/70 dark:bg-sky-400/10 dark:text-sky-200/70'
                    )}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showSubjects ? (
          <div className="grid min-w-0 gap-1.5">
            <span className="text-[10.5px] font-black uppercase tracking-[0.08em] text-ink-muted">Subjects</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
              {['all', ...visibleSubjects].map((subject) => {
                const active = subjectFilter === subject;
                const label = subject === 'all' ? 'All subjects' : subject;
                return (
                  <button
                    key={subject}
                    type="button"
                    className={cx(
                      'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[11.5px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 max-[520px]:min-h-8 max-[520px]:px-2.5 max-[520px]:text-[10.5px]',
                      active
                        ? 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200'
                        : 'border-brand-primary/12 bg-white/70 text-ink-soft hover:border-brand-primary/22 hover:bg-brand-primary/10 hover:text-ink-strong dark:border-sky-300/12 dark:bg-sky-400/[0.045] dark:text-slate-400 dark:hover:text-slate-200'
                    )}
                    onClick={() => {
                      onSubjectChange(subject);
                      onTopicChange('all');
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showTopics ? (
          <div className="grid min-w-0 gap-1.5">
            <span className="text-[10.5px] font-black uppercase tracking-[0.08em] text-ink-muted">Topics</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
              {['all', ...visibleTopics].map((topic) => {
                const active = topicFilter === topic;
                const label = topic === 'all' ? 'All topics' : topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    className={cx(
                      'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[11.5px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 max-[520px]:min-h-8 max-[520px]:px-2.5 max-[520px]:text-[10.5px]',
                      active
                        ? 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200'
                        : 'border-brand-primary/12 bg-white/70 text-ink-soft hover:border-brand-primary/22 hover:bg-brand-primary/10 hover:text-ink-strong dark:border-sky-300/12 dark:bg-sky-400/[0.045] dark:text-slate-400 dark:hover:text-slate-200'
                    )}
                    onClick={() => onTopicChange(topic)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CoursePicker({ courses, onSelect, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const totalSets = courses.reduce((sum, course) => sum + course.quizzes.length, 0);
  const setLabel = isExamPage ? 'exam set' : 'practice set';

  return (
    <section className="student-lessons-hub">
      <div className="student-lessons-section-head student-quiz-course-picker-head mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="lms-quiz-mascot-strip student-lessons-mascot-strip">
          <StudyMascot variant="stetho" mood="lesson" size="md" label={isExamPage ? 'Exam navigator mascot' : 'Q-Bank study buddy'} />
          <div>
            <h2 className="m-0 text-[19px] font-black uppercase leading-tight text-ink-strong dark:text-white max-[520px]:text-[16px]">Choose a Course</h2>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft max-[520px]:text-[12px]">{totalSets} {setLabel}{totalSets !== 1 ? 's' : ''} available</p>
          </div>
        </div>
        <span className="student-lessons-count-pill student-quiz-course-count-pill rounded-full border border-line-soft bg-surface-2 px-3 py-1 text-[11px] font-extrabold text-ink-muted">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </span>
      </div>

      <div className="student-lessons-course-grid grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
        {courses.map((course) => {
          const subjects = new Set(course.quizzes.map(q => q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'General')).filter(Boolean));
          return (
            <button
              key={course.name}
              type="button"
              onClick={() => onSelect(course.name)}
              className="glass-card student-lessons-course-card group flex min-h-[132px] w-full cursor-pointer flex-col justify-center text-left outline-none transition-[transform,border-color,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-brand-primary/22"
            >
              <div className="student-lessons-course-card__top flex items-start justify-between gap-4 px-5 py-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="student-lessons-course-card__icon grid size-11 shrink-0 place-items-center rounded-xl border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
                    <IcoBook />
                  </span>
                  <div>
                    <div className="line-clamp-2 text-[15px] font-extrabold leading-snug text-ink-strong">
                      {course.name || 'General'}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-ink-muted">
                      {subjects.size} subject{subjects.size !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="student-lessons-course-card__count text-right shrink-0">
                  <div className="text-[30px] font-extrabold leading-none text-ink-strong">{course.quizzes.length}</div>
                  <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">{isExamPage ? 'exams' : 'sets'}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QuizLessonRow({ quiz, index, bookmarked, onStart, onBookmark, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const title = getQuizTitleText(quiz) || quiz.quizTitle || `Untitled ${isExamPage ? 'exam' : 'practice set'}`;
  const statusLabel = quiz.accessLocked ? 'Locked' : quiz.isFree ? (isExamPage ? 'Free exam' : 'Free practice') : quiz.isFree === false ? 'Premium' : '';
  const completed = isQuizDone(quiz);
  const startLabel = isExamPage ? 'Start exam' : 'Start practice';

  return (
    <div className={cx('student-lessons-lesson-row', completed && 'is-completed')} style={{ '--lesson-row-delay': `${Math.min(index, 8) * 18}ms` }}>
      <strong>{String(index + 1).padStart(2, '0')}.</strong>
      <button type="button" className="student-lessons-lesson-row__title" onClick={onStart}>
        <span className="student-lessons-lesson-row__title-line">
          <span className="student-lessons-lesson-row__title-text">{title}</span>
          {completed ? (
            <i className="student-lessons-lesson-row__done" aria-label="Completed">
              <IcoCheck />
            </i>
          ) : null}
        </span>
        {statusLabel ? <small>{statusLabel}</small> : null}
      </button>
      <div className="student-lessons-lesson-row__actions">
        <button type="button" className="student-lessons-lesson-row__start" onClick={onStart}>
          {startLabel}
        </button>
        <button
          type="button"
          className={cx('student-lessons-lesson-row__save', bookmarked && 'is-saved')}
          onClick={(event) => onBookmark(event, quiz.id)}
          aria-label={bookmarked ? `Saved ${title}` : `Save ${title}`}
        >
          {bookmarked ? <IcoCheck /> : <IcoBookmark />}
          <span>{bookmarked ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}

function QuizLessonDetail({ courseName, quizzes, onBack, bookmarkedIds, onBookmark, onAccessNeeded, navigate, pageMode }) {
  const isExamPage = pageMode === 'exam';
  const setLabel = isExamPage ? 'Exam Set' : 'Practice Set';
  const setLabelLower = setLabel.toLowerCase();
  const [activeSubject, setActiveSubject] = useState(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState(new Set());
  const subjects = useMemo(() => {
    const map = new Map();
    sortQuizzesByHierarchy(quizzes).forEach((quiz) => {
      const label = quiz.subjectName || (quiz.isGeneral ? 'General / Full Course Revision' : 'General');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(quiz);
    });
    return [...map.entries()].map(([label, items]) => ({ label, quizzes: items }));
  }, [quizzes]);
  const visibleSubjects = activeSubject ? subjects.filter(subject => subject.label === activeSubject) : subjects;

  useEffect(() => {
    setCollapsedSubjects(new Set());
  }, [courseName, activeSubject]);

  function toggleSubject(key) {
    setCollapsedSubjects((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function startQuiz(quiz) {
    const canOpenMode = isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false;
    if (canOpenMode) {
      navigate(`/quizzes/${quiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`);
      return;
    }
    onAccessNeeded({
      ...quiz,
      accessFeature: isExamPage ? 'examMode' : 'practiceMode',
      accessMessage: quiz.accessMessage || `This premium ${isExamPage ? 'exam' : 'practice set'} is included with selected plans.`,
    });
  }

  return (
    <div className="student-lessons-detail space-y-4">
      <div className="student-lessons-detail-toolbar">
        <button className={cx(ui.secondaryButton, 'student-lessons-back-button')} onClick={onBack}>
          <IcoChevron />
          <span>Back</span>
        </button>
        <div className="student-lessons-detail-course-name">
          {courseName || 'General'}
        </div>
        <div className="student-lessons-detail-title">
          <strong>{quizzes.length} {setLabel}{quizzes.length === 1 ? '' : 's'}</strong>
        </div>
      </div>

      {subjects.length > 1 ? (
        <div className="student-lessons-filter-bar">
          <button className={cx('student-lessons-filter-chip', !activeSubject && 'is-active')} onClick={() => setActiveSubject(null)}>
            All subjects
          </button>
          {subjects.map((subject) => (
            <button
              key={subject.label}
              className={cx('student-lessons-filter-chip', activeSubject === subject.label && 'is-active')}
              onClick={() => setActiveSubject(activeSubject === subject.label ? null : subject.label)}
            >
              {subject.label || 'General'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="student-lessons-category-list">
        {visibleSubjects.map((subject, subjectIndex) => {
          const subjectKey = subject.label || `general-${subjectIndex}`;
          const isCollapsed = collapsedSubjects.has(subjectKey);
          return (
            <section className={cx('student-lessons-category', isCollapsed && 'is-collapsed')} key={subjectKey}>
              <button type="button" className="student-lessons-category__head" onClick={() => toggleSubject(subjectKey)} aria-expanded={!isCollapsed}>
                <div className="student-lessons-category__title">
                  <h2>{subject.label || 'General'}</h2>
                </div>
                <small>
                  {subject.quizzes.length} {setLabelLower}{subject.quizzes.length === 1 ? '' : 's'}
                  <IcoChevron />
                </small>
              </button>

              <div className="student-lessons-lesson-list-shell" aria-hidden={isCollapsed}>
                <div className="student-lessons-lesson-list">
                  {subject.quizzes.map((quiz, index) => (
                    <QuizLessonRow
                      key={quiz.id}
                      quiz={quiz}
                      index={index}
                      bookmarked={bookmarkedIds.has(quiz.id)}
                      onBookmark={onBookmark}
                      onStart={() => startQuiz(quiz)}
                      pageMode={pageMode}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MapHierarchyGuide({ pageMode }) {
  const setLabel = pageMode === 'exam' ? 'Exam sets' : 'Practice sets';
  return (
    <section className="lms-map-hierarchy-guide rounded-2xl border border-line-soft bg-surface-card p-3 shadow-sm dark:border-sky-300/12 dark:bg-white/[0.035] max-[520px]:rounded-xl max-[520px]:p-2.5" aria-label="Content hierarchy">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 max-[420px]:gap-1.5">
        {[
          ['01', 'Subject'],
          ['02', 'Topic'],
          ['03', setLabel],
        ].map(([num, label], index) => (
          <div className="contents" key={label}>
            <div className="grid min-h-14 place-items-center rounded-xl border border-brand-primary/12 bg-white/70 px-2 text-center dark:border-sky-300/12 dark:bg-white/[0.035] max-[420px]:min-h-12">
              <span className="text-[9px] font-black uppercase tracking-[0.08em] text-brand-primary dark:text-sky-200">{num}</span>
              <strong className="mt-0.5 text-[11px] font-black leading-tight text-ink-strong dark:text-white max-[420px]:text-[10px]">{label}</strong>
            </div>
            {index < 2 ? (
              <span className="grid size-7 place-items-center rounded-full bg-brand-primary/8 text-brand-primary dark:bg-sky-400/10 dark:text-sky-200" aria-hidden="true">
                <IcoChevron />
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="m-0 mt-2 text-center text-[11px] font-semibold text-ink-soft dark:text-slate-400">
        Subjects stay closed first. Open one subject, then a topic, then choose a set.
      </p>
    </section>
  );
}

function SelectedCourseHeader({ courseName, onBack, total, completed, subjectCount, topicCount, pageMode }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const stats = [
    { label: 'Subjects', value: subjectCount },
    { label: 'Topics', value: topicCount },
    { label: pageMode === 'exam' ? 'Exam Sets' : 'Practice Sets', value: total },
  ];

  return (
    <section className="lms-page-header-card relative overflow-hidden rounded-2xl border border-line-soft bg-surface-card p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] max-[520px]:rounded-xl max-[520px]:p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line-soft dark:bg-white/[0.08]" aria-hidden="true" />
      <div className="relative z-[1] grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={cx(ui.secondaryButton, 'min-h-10 shrink-0 px-4 text-xs max-[520px]:min-h-9 max-[520px]:px-3 max-[520px]:text-[11px]')} onClick={onBack}>
            All courses
          </button>
          <span className="rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-3 py-1 text-[10.5px] font-black uppercase text-brand-primary dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
            {pageMode === 'exam' ? 'Exam Sets' : 'Practice Sets'}
          </span>
        </div>

        <div className="grid gap-3">
          <div>
            <h2 className="m-0 break-words font-display text-[clamp(26px,4vw,42px)] font-extrabold leading-tight text-ink-strong dark:text-white">
              {courseName}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 rounded-xl border border-brand-primary/12 bg-[color-mix(in_srgb,var(--color-primary)_3%,transparent)] p-3.5 dark:border-sky-300/12 dark:bg-sky-400/[0.035] lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] lg:items-center">
          <div className="min-w-0">
            <p className="m-0 text-[10.5px] font-black uppercase text-ink-muted dark:text-slate-500">Course overview</p>
            <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
              {stats.map((item) => (
                <div key={item.label} className="grid min-w-[112px] shrink-0 gap-1 rounded-lg border border-brand-primary/10 bg-white/55 px-3 py-2 dark:border-sky-300/10 dark:bg-white/[0.025]">
                  <strong className="block truncate text-[clamp(16px,1.6vw,20px)] font-black leading-none text-ink-strong dark:text-white">{item.value}</strong>
                  <span className="block text-[11.5px] font-semibold text-ink-muted dark:text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 content-center gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink-soft dark:text-slate-300">Total Progress:</span>
              <strong className="text-right text-[clamp(15px,1.5vw,18px)] font-black text-ink-strong dark:text-white">{pct}%</strong>
            </div>
            <ProgressBar value={pct} className="h-2" />
            <p className="m-0 text-[12px] font-semibold text-ink-soft dark:text-slate-400">{completed}/{total} complete</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusTabs({ items, value, onChange }) {
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-6 gap-2 max-[520px]:gap-1">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            className={cx(
              'inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border px-4 text-[12px] font-extrabold shadow-sm shadow-slate-950/[0.02] transition-colors max-[520px]:min-h-9 max-[520px]:gap-0.5 max-[520px]:px-1 max-[520px]:text-[9.5px]',
              value === item.key
                ? 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary'
                : 'border-line-soft bg-surface-card text-ink-muted dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.88)]',
            )}
            onClick={() => onChange(item.key)}
          >
            <span className="truncate max-[520px]:hidden">{item.label}</span>
            <span className="hidden truncate max-[520px]:inline">{item.mobileLabel || item.label}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-black text-ink-muted dark:bg-white/[0.08] max-[520px]:px-1 max-[520px]:text-[8.5px]">
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StudentQuizzesPage({ pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const navigate   = useNavigate();

  const [quizzes,       setQuizzes]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [courseFilter,  setCourseFilter]  = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [topicFilter,   setTopicFilter]   = useState('all');
  const [accessPromptQuiz, setAccessPromptQuiz] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const body = document.body;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const root = document.documentElement;
    const dashboardThemeColors = { light: '#dce6f4', dark: '#151c24' };
    const getTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');
    const syncRouteThemeColor = () => {
      metaThemeColor?.setAttribute('content', dashboardThemeColors[getTheme()]);
    };

    body.classList.remove('student-quiz-night-screen');
    syncRouteThemeColor();

    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(syncRouteThemeColor)
      : null;
    observer?.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer?.disconnect();
      body.classList.remove('student-quiz-night-screen');
      metaThemeColor?.setAttribute('content', dashboardThemeColors[getTheme()]);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cancelBookmarks = () => {};
    fetchStudentQuizzes()
      .then(rows => {
        if (cancelled) return;
        setQuizzes(rows);
        cancelBookmarks = runWhenIdle(async () => {
          const bm = await fetchStudyBookmarks().catch(() => []);
          if (cancelled) return;
          setBookmarkedIds(new Set(bm.filter(b => b.itemType === 'quiz').map(b => b.itemId)));
        });
      })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e, isExamPage ? 'Unable to load exams' : 'Unable to load question bank')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; cancelBookmarks(); };
  }, []);

  async function handleBookmark(e, quizId) {
    e.stopPropagation();
    try {
      const result = await toggleStudyBookmark({ itemType: 'quiz', itemId: quizId });
      setBookmarkedIds(cur => {
        const next = new Set(cur);
        result.saved ? next.add(quizId) : next.delete(quizId);
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save'));
    }
  }

  function handleViewPackages() {
    if (!accessPromptQuiz) return;
    navigate('/subscriptions', {
      state: {
        lockedFeature: accessPromptQuiz.accessFeature || (isExamPage ? 'examMode' : 'practiceMode'),
        accessScope: accessPromptQuiz.courseId ? 'courses' : 'all',
        courseIds: accessPromptQuiz.courseId ? [accessPromptQuiz.courseId] : [],
      },
    });
    setAccessPromptQuiz(null);
  }

  function handleSelectCourse(courseName) {
    setCourseFilter(courseName);
    setSubjectFilter('all');
    setTopicFilter('all');
    setStatusFilter('all');
  }

  function handleBackToCourses() {
    setCourseFilter('all');
    setSubjectFilter('all');
    setTopicFilter('all');
    setStatusFilter('all');
  }

  const modeQuizzes = useMemo(
    () => (isExamPage ? quizzes : quizzes.filter(q => !q.examModeOnly)),
    [isExamPage, quizzes],
  );

  const courseCards = useMemo(() => {
    const map = new Map();
    modeQuizzes.forEach((q) => {
      const name = q.courseTitle || 'General';
      if (!map.has(name)) map.set(name, { name, quizzes: [] });
      map.get(name).quizzes.push(q);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [modeQuizzes]);

  const scopedQuizzes = useMemo(
    () => modeQuizzes.filter(q => courseFilter === 'all' || (q.courseTitle || 'General') === courseFilter),
    [modeQuizzes, courseFilter],
  );

  const total      = scopedQuizzes.length;
  const completed  = scopedQuizzes.filter(isQuizDone).length;
  const inProg     = scopedQuizzes.filter(q => q.practiceSessionId && !isQuizDone(q)).length;
  const freeCount  = scopedQuizzes.filter(q => q.isFree).length;
  const premiumCount = scopedQuizzes.filter(q => !q.isFree).length;
  const notStarted = total - completed - inProg;
  const scopedTopicCount = useMemo(() => (
    new Set(scopedQuizzes.map(q => q.topicName || q.subtopicName || q.lessonTitle || '').filter(Boolean)).size
  ), [scopedQuizzes]);

  const visibleSubjects = useMemo(() => (
    [...new Set(
      modeQuizzes
        .filter(q => courseFilter === 'all' || (q.courseTitle || 'General') === courseFilter)
        .map(q => q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject'))
        .filter(Boolean)
    )].sort()
  ), [modeQuizzes, courseFilter]);

  const visibleTopics = useMemo(() => (
    [...new Set(
      modeQuizzes
        .filter(q => courseFilter === 'all' || (q.courseTitle || 'General') === courseFilter)
        .filter(q => subjectFilter === 'all' || (q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject')) === subjectFilter)
        .map(q => q.subtopicName || q.lessonTitle || '')
        .filter(Boolean)
    )].sort()
  ), [modeQuizzes, courseFilter, subjectFilter]);

  const visible = useMemo(() => modeQuizzes.filter(q => {
    const done = isQuizDone(q);
    if (statusFilter === 'new'  && (done || q.practiceSessionId)) return false;
    if (statusFilter === 'prog' && !(q.practiceSessionId && !done)) return false;
    if (statusFilter === 'done' && !done) return false;
    if (statusFilter === 'free' && !q.isFree) return false;
    if (statusFilter === 'premium' && q.isFree) return false;
    if (courseFilter !== 'all'  && (q.courseTitle || 'General') !== courseFilter) return false;
    if (subjectFilter !== 'all' && (q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject')) !== subjectFilter) return false;
    if (topicFilter !== 'all'   && (q.subtopicName || q.lessonTitle || '') !== topicFilter) return false;
    return true;
  }), [modeQuizzes, statusFilter, courseFilter, subjectFilter, topicFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    visible.forEach(q => {
      const key = courseFilter === 'all'
        ? (q.courseTitle || 'General')
        : (q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject'));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    });
    map.forEach((items, key) => {
      map.set(key, sortQuizzesByHierarchy(items));
    });
    return map;
  }, [visible, courseFilter]);

  const statusItems = [
    { count: total, label: 'All', mobileLabel: 'All', key: 'all' },
    { count: notStarted, label: 'New', mobileLabel: 'New', key: 'new' },
    { count: inProg, label: 'In progress', mobileLabel: 'Active', key: 'prog' },
    { count: completed, label: 'Completed', mobileLabel: 'Done', key: 'done' },
    { count: freeCount, label: 'Free', mobileLabel: 'Free', key: 'free' },
    { count: premiumCount, label: 'Premium', mobileLabel: 'Prem', key: 'premium' },
  ];

  return (
    <main className={cx('dashboard-page study-hub-page student-lessons-page student-quiz-map-page', isExamPage ? 'student-exam-map-page' : 'student-qbank-map-page')}>
      <section className="study-hub-shell">
        <AppHeader
          title={isExamPage ? 'Exams' : 'Q-Bank'}
          subtitle={isExamPage
            ? 'Timed exam sets'
            : 'Practice question sets'
          }
        />

        {error && <div className={ui.feedbackError}>{error}</div>}

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={cx(ui.skeletonCard, 'h-[160px] max-[520px]:h-[132px]')} />
            ))}
          </div>
        ) : courseFilter === 'all' ? (
          courseCards.length === 0 ? (
            <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
              <StudyMascot variant="review" mood="review" size="lg" label={isExamPage ? 'Empty exams mascot' : 'Empty Q-Bank mascot'} />
              <p className="m-0 text-center">
                {isExamPage ? 'No exams available yet.' : 'No question sets available yet.'}
              </p>
            </div>
          ) : (
            <CoursePicker courses={courseCards} onSelect={handleSelectCourse} pageMode={pageMode} />
          )
        ) : grouped.size === 0 ? (
          <section>
            <QuizLessonDetail
              courseName={courseFilter}
              quizzes={visible}
              onBack={handleBackToCourses}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onAccessNeeded={setAccessPromptQuiz}
              navigate={navigate}
              pageMode={pageMode}
            />
            <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
              <StudyMascot variant="review" mood="review" size="lg" label={isExamPage ? 'No matching exams mascot' : 'No matching Q-Bank sets mascot'} />
              <p className="m-0 text-center">No sets match your filters.</p>
            </div>
          </section>
        ) : (
          <section>
            <QuizLessonDetail
              courseName={courseFilter}
              quizzes={visible}
              onBack={handleBackToCourses}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onAccessNeeded={setAccessPromptQuiz}
              navigate={navigate}
              pageMode={pageMode}
            />
          </section>
        )}
      </section>

      {accessPromptQuiz ? createPortal((
        <div
          className="fixed inset-0 z-[1200] bg-[rgba(15,23,42,0.30)] backdrop-blur-md dark:bg-[rgba(2,6,23,0.66)]"
          onClick={() => setAccessPromptQuiz(null)}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line-soft bg-surface-card-elevated p-5 shadow-2xl dark:border-white/[0.09]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-access-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid justify-items-center gap-3 text-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-amber-400/35 bg-amber-400/12 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] dark:text-amber-300">
                <IcoLock/>
              </span>
              <h2 id="quiz-access-title" className="m-0 text-[17px] font-extrabold text-ink-strong">
                Premium {isExamPage ? 'exam' : 'practice set'}
              </h2>
              <p className="m-0 max-w-[280px] text-[13px] leading-relaxed text-ink-soft">
                This {isExamPage ? 'exam' : 'practice set'} is not included in your current package.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cx(ui.secondaryButton, 'min-h-11 px-4 text-xs')}
                onClick={() => setAccessPromptQuiz(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cx(ui.primaryAction, 'min-h-11 px-4 text-xs')}
                onClick={handleViewPackages}
              >
                View packages
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </main>
  );
}
