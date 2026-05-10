import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentQuizzes } from '../../../api/quizAttempts.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../api/studyBookmarks.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

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

function IcoBook()     { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2V2z" stroke="currentColor" strokeWidth="1.25" fill="none"/><path d="M7 3h4v9H7" stroke="currentColor" strokeWidth="1.25" fill="none"/><path d="M7 6.5h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function IcoClock()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.25"/><path d="M6.5 4V6.5l2 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoPlay()     { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3.5 2.5l7 4-7 4V2.5z" fill="currentColor"/></svg>; }
function IcoPen()      { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function IcoTrophy()   { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3.5 2H9.5V6A3 3 0 0 1 3.5 6V2Z" stroke="currentColor" strokeWidth="1.1" fill="none"/><path d="M1.5 3H3.5M9.5 3H11.5M6.5 6V9M4.5 11H8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function IcoBookmark() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 1.5h8a.5.5 0 0 1 .5.5v8.5l-4.5-2.5L1.5 10.5V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/></svg>; }
function IcoSearch()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoChevron()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 4l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoStar()     { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/></svg>; }
function IcoBrain()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 12C4.5 12 2 10.2 2 7.5C2 5.3 3.5 3.2 5.5 3C5.8 2 6.3 1.5 7 1.5C8.5 1.5 11 3 11 5.5C12.2 6 12.2 7.5 11.5 8.5C11.5 10.5 9 12 6.5 12Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/></svg>; }

// ─── Course color palette ─────────────────────────────────────────────────────

const COURSE_PALETTES = [
  { bg: '#3B82F6', light: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.30)'  },
  { bg: '#8B5CF6', light: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.30)'  },
  { bg: '#10B981', light: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)'  },
  { bg: '#F59E0B', light: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)'  },
  { bg: '#EF4444', light: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.30)'   },
  { bg: '#06B6D4', light: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.30)'   },
  { bg: '#EC4899', light: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.30)'  },
  { bg: '#6366F1', light: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.30)'  },
];

// ─── Quiz row ─────────────────────────────────────────────────────────────────

function QBankRow({ quiz, bookmarked, onBookmark, navigate, pageMode }) {
  const isExamPage  = pageMode === 'exam';
  const inProg      = !!quiz.practiceSessionId;
  const isDone      = quiz.isCompleted;
  const practiceLocked = !quiz.canPracticeMode;
  const examLocked     = !quiz.canExamMode;

  // Left accent color by status
  const accentColor = isDone
    ? '#10B981'    // emerald — completed
    : inProg
    ? '#F59E0B'    // amber — in progress
    : '#64748B';   // slate — not started

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-line-soft bg-surface-card shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-brand-primary/22 hover:shadow-md dark:bg-[rgba(8,13,22,0.95)] dark:border-white/[0.07] dark:hover:border-white/[0.13]"
    >
      {/* Left status accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-all duration-200 group-hover:w-[4px]"
        style={{ background: accentColor }}
      />

      <div className="flex min-h-0 flex-col gap-3 px-5 py-4 pl-6">
        {/* Top row: title + status badge */}
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h3 className="m-0 min-w-0 flex-1 text-[14px] font-extrabold leading-snug text-ink-strong">
            {quiz.quizTitle}
          </h3>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {isDone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Done
              </span>
            )}
            {inProg && !isDone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse"/>
                In progress
              </span>
            )}
            {!isDone && !inProg && (
              <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-muted border border-line-soft">
                New
              </span>
            )}
            {isExamPage && quiz.examModeOnly && (
              <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[11px] font-extrabold text-brand-primary border border-brand-primary/20">
                Exam only
              </span>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {(quiz.courseTitle || quiz.topicName) && (
          <p className="m-0 text-[11.5px] leading-relaxed text-ink-muted">
            {quiz.isGeneral
              ? [quiz.courseTitle, 'General / Full Course Revision'].filter(Boolean).join(' › ')
              : [quiz.courseTitle, quiz.subjectName || quiz.topicName, quiz.subtopicName || null, quiz.lessonTitle || null].filter(Boolean).join(' › ')
            }
          </p>
        )}

        {/* Meta chips + actions row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Meta pills */}
          <div className="flex flex-wrap gap-1.5">
            <span className={cx(ui.tablePill, 'gap-1.5')}>
              <IcoBook/>{quiz.totalQuestions} questions
            </span>
            <span className={cx(ui.tablePill, 'gap-1.5')}>
              <IcoClock/>{quiz.timeLimit} min
            </span>
            {quiz.totalMarks > 0 && (
              <span className={cx(ui.tablePill, 'gap-1.5')}>
                <IcoStar/>{quiz.totalMarks} pts
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!isExamPage && (
              <button
                className={cx(ui.primaryAction, 'h-9 px-3.5 text-xs gap-1.5')}
                disabled={practiceLocked}
                title={practiceLocked ? 'Upgrade to unlock practice mode' : ''}
                onClick={() => practiceLocked
                  ? navigate('/subscriptions', { state: { lockedFeature: 'practiceMode' } })
                  : navigate(`/quizzes/${quiz.id}?mode=practice`)
                }
              >
                <IcoPlay/>
                {practiceLocked ? 'Upgrade' : inProg ? 'Continue' : 'Study'}
              </button>
            )}
            {isExamPage && (
              <button
                className={cx(ui.primaryAction, 'h-9 px-3.5 text-xs gap-1.5')}
                disabled={examLocked}
                title={examLocked ? 'Upgrade to unlock exam mode' : ''}
                onClick={() => examLocked
                  ? navigate('/subscriptions', { state: { lockedFeature: 'examMode' } })
                  : navigate(`/quizzes/${quiz.id}?mode=exam`)
                }
              >
                <IcoPen/>
                {examLocked ? 'Upgrade' : isDone ? 'Retake' : 'Start Exam'}
              </button>
            )}
            {isDone && (
              <button
                className={cx(ui.secondaryButton, 'h-9 px-3.5 text-xs gap-1.5')}
                onClick={() => navigate(`/results?quizId=${quiz.id}`)}
              >
                <IcoTrophy/>Results
              </button>
            )}
            <button
              className={cx(
                ui.secondaryButton, 'h-9 px-3.5 text-xs gap-1.5',
                bookmarked && 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary',
              )}
              onClick={e => onBookmark(e, quiz.id)}
              title={bookmarked ? 'Remove bookmark' : 'Save for later'}
            >
              <IcoBookmark/>
              {bookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Course group ─────────────────────────────────────────────────────────────

function CourseGroup({ course, quizzes, palette, bookmarkedIds, onBookmark, navigate, pageMode }) {
  const [open, setOpen] = useState(true);
  const done = quizzes.filter(q => q.isCompleted).length;
  const prog = quizzes.filter(q => q.practiceSessionId && !q.isCompleted).length;
  const pct  = quizzes.length > 0 ? Math.round((done / quizzes.length) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface-card shadow-sm dark:bg-[rgba(6,10,18,0.92)] dark:border-white/[0.07]">
      {/* Group header */}
      <button
        type="button"
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left hover:bg-surface-0 dark:hover:bg-white/[0.025] transition-colors duration-150"
        onClick={() => setOpen(o => !o)}
      >
        {/* Color swatch */}
        <span
          className="size-3 shrink-0 rounded-full shadow-sm"
          style={{ background: palette.bg, boxShadow: `0 0 8px ${palette.bg}55` }}
        />

        {/* Title */}
        <span className="min-w-0 flex-1 font-extrabold text-[14px] text-ink-strong leading-snug">
          {course}
        </span>

        {/* Progress + badges */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-[520px]:hidden">
          {done > 0 && (
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10.5px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {done} done
            </span>
          )}
          {prog > 0 && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10.5px] font-extrabold text-amber-600 dark:text-amber-400">
              {prog} in progress
            </span>
          )}
          <span className={cx(ui.tablePill)}>{quizzes.length} sets</span>
          {/* Compact progress ring */}
          {pct > 0 && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold border"
              style={{
                background: palette.light,
                borderColor: palette.border,
                color: palette.bg,
              }}
            >
              {pct}%
            </span>
          )}
        </div>

        <span className={cx('text-ink-muted transition-transform duration-150', open && 'rotate-90')}>
          <IcoChevron/>
        </span>
      </button>

      {/* Progress bar for the group */}
      {pct > 0 && (
        <div className="mx-5 h-[3px] overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: palette.bg }}
          />
        </div>
      )}

      {/* Quiz rows */}
      {open && (
        <div className="grid gap-2.5 bg-surface-0 p-3.5 dark:bg-white/[0.018] border-t border-line-soft dark:border-white/[0.05]">
          {quizzes.map(q => (
            <QBankRow
              key={q.id}
              quiz={q}
              bookmarked={bookmarkedIds.has(q.id)}
              onBookmark={onBookmark}
              navigate={navigate}
              pageMode={pageMode}
            />
          ))}
        </div>
      )}
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
  const [search,        setSearch]        = useState('');

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

  const modeQuizzes = useMemo(
    () => isExamPage ? quizzes : quizzes.filter(q => !q.examModeOnly),
    [isExamPage, quizzes],
  );

  const total      = modeQuizzes.length;
  const completed  = modeQuizzes.filter(q => q.isCompleted).length;
  const inProg     = modeQuizzes.filter(q => q.practiceSessionId && !q.isCompleted).length;
  const notStarted = total - completed - inProg;

  const courses = useMemo(
    () => [...new Set(modeQuizzes.map(q => q.courseTitle || 'General').filter(Boolean))].sort(),
    [modeQuizzes],
  );

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
    if (statusFilter === 'new'  && (q.isCompleted || q.practiceSessionId)) return false;
    if (statusFilter === 'prog' && !(q.practiceSessionId && !q.isCompleted)) return false;
    if (statusFilter === 'done' && !q.isCompleted) return false;
    if (courseFilter !== 'all'  && (q.courseTitle || 'General') !== courseFilter) return false;
    if (subjectFilter !== 'all' && (q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject')) !== subjectFilter) return false;
    if (topicFilter !== 'all'   && (q.subtopicName || q.lessonTitle || '') !== topicFilter) return false;
    if (search.trim()) {
      const str = [q.quizTitle, q.courseTitle, q.subjectName, q.subtopicName, q.lessonTitle]
        .filter(Boolean).join(' ').toLowerCase();
      if (!str.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [modeQuizzes, statusFilter, courseFilter, subjectFilter, topicFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    visible.forEach(q => {
      const key = courseFilter === 'all'
        ? (q.courseTitle || 'General')
        : (q.subjectName || (q.isGeneral ? 'General / Full Course Revision' : 'No subject'));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    });
    return map;
  }, [visible, courseFilter]);

  const STATUS_TABS = [
    { key: 'all',  label: 'All',         count: total      },
    { key: 'new',  label: 'Not started', count: notStarted },
    { key: 'prog', label: 'In progress', count: inProg     },
    { key: 'done', label: 'Completed',   count: completed  },
  ];

  // ── Stat card definitions ─────────────────────────────────
  const statCards = [
    { n: total,      label: 'Total sets',  color: '#6366F1', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.22)',  key: 'all',  icon: <IcoBook/> },
    { n: notStarted, label: 'Not started', color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.18)', key: 'new',  icon: <IcoBrain/> },
    { n: inProg,     label: 'In progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.22)',  key: 'prog', icon: <IcoPlay/> },
    { n: completed,  label: 'Completed',   color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.22)',  key: 'done', icon: <IcoTrophy/> },
  ];

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={isExamPage ? 'Exam Mode' : 'Q-Bank'}
          subtitle={isExamPage
            ? 'Timed quiz sets for exam-style practice, scoring, and retakes.'
            : 'Practice MCQs at your pace with instant feedback.'
          }
        />

        {error && <div className={ui.feedbackError}>{error}</div>}

        {/* ── Mode guide ── */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line-soft bg-surface-card p-4 shadow-sm dark:bg-[rgba(6,10,18,0.92)] dark:border-white/[0.07] max-[640px]:grid-cols-1">
          {isExamPage ? (
            <>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/18">
                  <IcoPen/>
                </span>
                <div>
                  <strong className="block text-[13px] font-extrabold text-ink-strong">Timed Exams</strong>
                  <span className="text-[12px] leading-relaxed text-ink-soft">Answer the full set under time pressure, then submit once to see your score.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/18">
                  <IcoTrophy/>
                </span>
                <div>
                  <strong className="block text-[13px] font-extrabold text-ink-strong">Results Review</strong>
                  <span className="text-[12px] leading-relaxed text-ink-soft">Retake completed papers and use results to guide your next study session.</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-light)] text-brand-primary border border-brand-primary/18">
                  <IcoPlay/>
                </span>
                <div>
                  <strong className="block text-[13px] font-extrabold text-ink-strong">Study Mode</strong>
                  <span className="text-[12px] leading-relaxed text-ink-soft">See the correct answer right after each question. No time pressure — use this to learn.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-violet-light)] text-[var(--color-violet)] border border-[rgba(124,58,237,0.18)]">
                  <IcoBrain/>
                </span>
                <div>
                  <strong className="block text-[13px] font-extrabold text-ink-strong">Spaced Review</strong>
                  <span className="text-[12px] leading-relaxed text-ink-soft">Bookmark sets to revisit later. Build long-term retention through repeated exposure.</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-3 max-[780px]:grid-cols-2 max-[420px]:grid-cols-1">
          {statCards.map(s => (
            <button
              key={s.key}
              type="button"
              className={cx(
                'group relative min-h-0 overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
                statusFilter === s.key
                  ? 'ring-2'
                  : 'border-line-soft bg-surface-card dark:bg-[rgba(6,10,18,0.88)] dark:border-white/[0.07]',
              )}
              style={statusFilter === s.key ? {
                borderColor: s.border,
                background: s.bg,
                boxShadow: `0 0 0 2px ${s.border}`,
              } : {}}
              onClick={() => setStatusFilter(s.key)}
            >
              {/* Icon */}
              <div
                className="mb-3 grid size-9 place-items-center rounded-xl border"
                style={{ background: s.bg, borderColor: s.border, color: s.color }}
              >
                {s.icon}
              </div>
              <span
                className="block text-[28px] font-black leading-none"
                style={{ color: s.color }}
              >
                {s.n}
              </span>
              <span className="mt-1 block text-[11.5px] font-bold text-ink-muted">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="grid gap-3 rounded-2xl border border-line-soft bg-surface-card p-4 shadow-sm dark:bg-[rgba(6,10,18,0.92)] dark:border-white/[0.07]">
          {/* Search */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <IcoSearch/>
            </span>
            <input
              className={cx(ui.input, 'pl-10')}
              placeholder={isExamPage ? 'Search exams…' : 'Search question sets…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status tab pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                className={cx(
                  ui.secondaryButton, 'h-9 rounded-full px-4 text-[12px]',
                  statusFilter === t.key && 'border-brand-primary/30 bg-[var(--color-primary-light)] text-brand-primary',
                )}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-extrabold dark:bg-white/[0.08]">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cascade selects */}
          {courses.length > 1 && (
            <select
              className={ui.input}
              value={courseFilter}
              onChange={e => { setCourseFilter(e.target.value); setSubjectFilter('all'); setTopicFilter('all'); }}
            >
              <option value="all">All courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {visibleSubjects.length > 1 && (
            <select
              className={ui.input}
              value={subjectFilter}
              onChange={e => { setSubjectFilter(e.target.value); setTopicFilter('all'); }}
            >
              <option value="all">All subjects</option>
              {visibleSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {visibleTopics.length > 1 && (
            <select className={ui.input} value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
              <option value="all">All topics</option>
              {visibleTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="grid gap-3">
            {[1,2,3,4,5].map(i => <div key={i} className={cx(ui.shimmer, 'h-[88px] rounded-xl')}/>)}
          </div>
        ) : grouped.size === 0 ? (
          <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="5" width="28" height="36" rx="5" stroke="currentColor" strokeWidth="1.6" fill="none" opacity=".2"/>
              <path d="M15 17h18M15 24h18M15 31h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".35"/>
            </svg>
            <p className="m-0 text-center">
              {modeQuizzes.length === 0
                ? (isExamPage ? 'No exams available yet.' : 'No question sets available yet.')
                : 'No sets match your filters.'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {[...grouped.entries()].map(([course, qs], idx) => (
              <CourseGroup
                key={course}
                course={course}
                quizzes={qs}
                palette={COURSE_PALETTES[idx % COURSE_PALETTES.length]}
                bookmarkedIds={bookmarkedIds}
                onBookmark={handleBookmark}
                navigate={navigate}
                pageMode={pageMode}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
