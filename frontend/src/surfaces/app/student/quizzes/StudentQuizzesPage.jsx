import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppOnlyGate } from '../../../../shared/ui/AppOnlyGate.jsx';
import { useNavigate } from 'react-router-dom';
import { fetchStudentQuizzes, prefetchStudentQuiz, readStudentQuizzesCache } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchStudyBookmarks, readStudyBookmarksCache, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { preloadRouteByPath } from '../../../../app/routePreloading.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { StudyMascot } from '../../../../shared/ui/StudyMascot.jsx';
import { CourseProgressCard } from '../../../../shared/ui/CourseProgressCard.jsx';
import { getQuizTitleText } from './quizLabels.js';
import { detectPlatform } from '../../../../shared/platform/detect.js';
import './qbank-course.css';

const PLATFORM = detectPlatform();

// How many of the top practice quizzes to warm during idle so a tap opens from
// cache. Bounded to stay gentle on shared hosting; payloads are deduped/cached.

function getQuizRowLabel(quiz, index) {
  // One name per quiz (10.25): no "Quiz N" number display.
  return getQuizTitleText(quiz) || quiz.quizTitle || `Practice set ${index + 1}`;
}

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

function IcoBookmark()    { return <svg width="14" height="14" viewBox="0 0 13 13" fill="none"><path d="M2.5 1.5h8a.5.5 0 0 1 .5.5v9l-4.5-2.5L2 11V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>; }
function IcoBookmarkFilled() { return <svg width="14" height="14" viewBox="0 0 13 13" fill="currentColor"><path d="M2.5 1.5h8a.5.5 0 0 1 .5.5v9l-4.5-2.5L2 11V2a.5.5 0 0 1 .5-.5z"/></svg>; }
function IcoChevron()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 4l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoChevronLeft() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 4l-4 3 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoLock()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 6V4.5A2.5 2.5 0 0 1 7 2A2.5 2.5 0 0 1 9.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function IcoCheck()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

function isQuizDone(quiz) {
  return quiz.isCompleted || quiz.completed || Number(quiz.examAttemptCount || 0) > 0;
}

function sortQuizzesByHierarchy(items) {
  return [...items].sort((a, b) => {
    // Full-course (general) sets go after every subject.
    const generalOrder = Number(Boolean(a.isGeneral)) - Number(Boolean(b.isGeneral));
    if (generalOrder) return generalOrder;
    const aKey = [a.topicName, a.subtopicName, a.lessonTitle, a.quizNumber, a.quizTitle].filter(Boolean).join('\u0001');
    const bKey = [b.topicName, b.subtopicName, b.lessonTitle, b.quizNumber, b.quizTitle].filter(Boolean).join('\u0001');
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function formatStartSheetMinutes(value) {
  const minutes = Math.round(Number(value || 0));
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = `${hours} hr${hours === 1 ? '' : 's'}`;
  return rest ? `${hourText} ${rest} min` : hourText;
}

function getQuestionSummary(quiz) {
  const total = Number(quiz?.totalQuestions || quiz?.questionCount || 0);
  return total > 0 ? `${total} question${total === 1 ? '' : 's'}` : 'Questions';
}

function getStartSheetDetail(quiz, mode) {
  const questionSummary = getQuestionSummary(quiz);
  if (mode === 'exam') {
    const timeText = quiz?.hideTimeLimit ? '' : formatStartSheetMinutes(quiz?.timeLimit);
    return timeText ? `${questionSummary}. ${timeText} timer.` : `${questionSummary}. Timer starts after you begin.`;
  }
  return `${questionSummary}. Progress saves automatically.`;
}

function QuizStartConfirmationSheet({ prompt, onCancel, onConfirm }) {
  const quiz = prompt?.quiz;
  const mode = prompt?.mode || 'practice';
  const isExamPrompt = mode === 'exam';
  const title = prompt?.title || getQuizTitleText(quiz) || quiz?.quizTitle || (isExamPrompt ? 'Exam' : 'Quiz');
  const detail = getStartSheetDetail(quiz, mode);
  const [closing, setClosing] = useState(false);

  const requestCancel = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onCancel, 270);
  }, [closing, onCancel]);

  useEffect(() => {
    if (!prompt || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestCancel();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prompt, requestCancel]);

  useEffect(() => {
    setClosing(false);
  }, [prompt]);

  if (!prompt || typeof document === 'undefined') return null;

  return createPortal((
    <>
      <button
        type="button"
        className="lms-quiz-start-backdrop"
        data-closing={closing ? 'true' : undefined}
        aria-label={`Cancel starting ${isExamPrompt ? 'exam' : 'quiz'}`}
        onClick={requestCancel}
      />
      <aside
        className="lms-quiz-start-sheet"
        data-closing={closing ? 'true' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-start-confirm-title"
      >
        <div className="lms-quiz-start-sheet__handle" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="quiz-start-confirm-title" className="m-0 text-[22px] font-black leading-tight text-ink-strong max-[420px]:text-[20px]">
            Start {isExamPrompt ? 'exam' : 'quiz'}?
          </h2>
          <p className="m-0 mt-2 text-[14px] font-semibold leading-relaxed text-ink-soft">
            {title}
          </p>
          <p className="m-0 mt-5 text-[14px] font-semibold leading-relaxed text-ink-soft">
            {detail}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-2 pt-5">
          <button
            type="button"
            className={cx(ui.secondaryButton, 'min-h-12 px-4 text-[13px]')}
            onClick={requestCancel}
          >
            Not now
          </button>
          <button
            type="button"
            className={cx(ui.primaryAction, 'min-h-12 px-4 text-[13px]')}
            onClick={onConfirm}
          >
            Start {isExamPrompt ? 'exam' : 'questions'}
          </button>
        </div>
      </aside>
    </>
  ), document.body);
}

function CoursePicker({ courses, onSelect, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const totalSets = courses.reduce((sum, course) => sum + course.quizzes.length, 0);
  const setLabel = isExamPage ? 'exam set' : 'practice set';

  return (
    <section className="student-lessons-hub">
      <div className="student-lessons-section-head student-quiz-course-picker-head mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="lms-quiz-mascot-strip student-lessons-mascot-strip">
          <div>
            <h2 className="m-0 text-[19px] font-black uppercase leading-tight text-ink-strong dark:text-white max-[520px]:text-[16px]">Choose a Course</h2>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft max-[520px]:text-[12px]">{totalSets} {setLabel}{totalSets !== 1 ? 's' : ''} available</p>
          </div>
        </div>
        <span className="student-lessons-count-pill student-quiz-course-count-pill rounded-full border border-line-soft bg-surface-2 px-3 py-1 text-[11px] font-extrabold text-ink-muted">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 max-[520px]:grid-cols-1 max-[520px]:gap-2">
        {courses.map((course, index) => {
          const total = course.quizzes.length;
          const done = course.quizzes.filter(isQuizDone).length;
          return (
            <CourseProgressCard
              key={course.name}
              title={course.name || 'General'}
              meta={`${total} ${isExamPage ? 'exam' : 'set'}${total === 1 ? '' : 's'}`}
              progress={total ? (done / total) * 100 : 0}
              index={index}
              onOpen={() => onSelect(course.name)}
            />
          );
        })}
      </div>
    </section>
  );
}

function getQuizScopeKey(quiz) {
  if (quiz.lessonId || quiz.lessonTitle) return 'lesson';
  if (quiz.isGeneral) return 'full-course';
  return 'subject';
}


function QuizLessonRow({ quiz, index, bookmarked, onStart, onBookmark, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const title = getQuizRowLabel(quiz, index) || `Untitled ${isExamPage ? 'exam' : 'practice set'}`;
  const locked = quiz.accessLocked || (isExamPage ? quiz.canExamMode === false : quiz.canPracticeMode === false);
  const completed = isQuizDone(quiz);
  const actionPath = `/quizzes/${quiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`;

  function preloadQuizRoute() {
    if (quiz.accessLocked) return;
    preloadRouteByPath(actionPath);
    if (!isExamPage) {
      prefetchStudentQuiz(quiz.id, { mode: 'practice' });
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onStart();
    }
  }

  return (
    <div
      className={cx('student-lessons-lesson-row', completed && 'is-completed')}
      style={{ '--lesson-row-delay': `${Math.min(index, 8) * 18}ms` }}
      role="button"
      tabIndex={0}
      onClick={onStart}
      onKeyDown={handleKeyDown}
      onPointerDown={preloadQuizRoute}
      onTouchStart={preloadQuizRoute}
      onPointerEnter={preloadQuizRoute}
      onFocus={preloadQuizRoute}
    >
      <strong>{index + 1}</strong>
      <span className="student-lessons-lesson-row__title">
        <span className="student-lessons-lesson-row__title-line">
          <span className="student-lessons-lesson-row__title-text">{title}</span>
          {completed ? (
            <i className="student-lessons-lesson-row__done" aria-label="Completed">
              <IcoCheck />
            </i>
          ) : null}
        </span>
      </span>
      <span className="student-lessons-lesson-row__actions">
        {locked ? (
          <span className="student-lessons-lesson-row__save is-locked" aria-label={`Locked ${title}`} role="img">
            <IcoLock />
          </span>
        ) : (
          <button
            type="button"
            className={cx('student-lessons-lesson-row__save', bookmarked && 'is-saved')}
            onClick={(event) => onBookmark(event, quiz.id)}
            aria-label={bookmarked ? `Saved ${title}` : `Save ${title}`}
            aria-pressed={bookmarked}
          >
            {bookmarked ? <IcoBookmarkFilled /> : <IcoBookmark />}
          </button>
        )}
        <span className="student-lessons-lesson-row__chevron" aria-hidden="true">
          <IcoChevron />
        </span>
      </span>
    </div>
  );
}

/**
 * Second level inside a subject: the quizzes split by topic, like the app. The
 * list endpoint's topicName once came back as the SUBJECT's name, so the
 * subtopic is read first and a topic that just repeats the subject is ignored.
 * Numbering restarts under each heading, and a lone topic that is only the
 * section's own name gets no heading.
 */
function groupQuizzesByTopic(subject) {
  const topicOf = (quiz) => {
    const sub = String(quiz.subtopicName || '').trim();
    if (sub) return sub;
    const topic = String(quiz.topicName || '').trim();
    return topic === String(quiz.subjectName || '').trim() ? '' : topic;
  };
  const order = [];
  const byTopic = new Map();
  subject.quizzes.forEach((quiz) => {
    const key = topicOf(quiz);
    if (!byTopic.has(key)) { byTopic.set(key, []); order.push(key); }
    byTopic.get(key).push(quiz);
  });
  const single = order.length === 1 && order[0] === subject.label;
  return order.map((key) => ({ label: single ? '' : key, quizzes: byTopic.get(key) }));
}

// ─── Course view (2026-11-20): same layout as the phone app ──────────────────
// "Subjects | Full course | Lessons" switch with counts → a sideways row of
// cards (progress ring per subject / paper series, plus "All") → a Continue
// card for the next unfinished set → the chosen card's sets. Built only from
// the list the page already holds: no request.

const SERIES_TAIL = /\s*[-–—:]*\s*\d+\s*$/;
const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
function plural(text) {
  const t = String(text || '').trim();
  const lw = t.toLowerCase();
  if (!t || lw.endsWith('s')) return t;
  if (lw.length > 1 && lw.endsWith('y') && !'aeiou'.includes(lw[lw.length - 2])) return `${t.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/.test(lw)) return `${t}es`;
  return `${t}s`;
}
const byPaperNumber = (a, b) => String(a.quizTitle || '').localeCompare(String(b.quizTitle || ''), undefined, { numeric: true, sensitivity: 'base' });

// Study order for full-course series (user, 2026-11-20): assessments, then
// exam papers, then final revision papers; every other series after, A–Z.
function seriesRank(name) {
  const n = name.toLowerCase();
  if (n.includes('assessment')) return 0;
  if (n.includes('exam paper')) return 1;
  if (n.includes('final revision')) return 2;
  return 3;
}

/** Full-course sets → series by name without the trailing number ("Medicine exam paper - 4" → "Exam papers"). */
function buildSeries(quizzes) {
  const order = [];
  const names = new Map();
  const map = new Map();
  [...quizzes].sort(byPaperNumber).forEach((quiz) => {
    const base = String(quiz.quizTitle || '').trim().replace(SERIES_TAIL, '').trim() || 'Other';
    const key = base.toLowerCase();
    if (!map.has(key)) { order.push(key); names.set(key, base); map.set(key, []); }
    map.get(key).push(quiz);
  });
  // Full name with the course in front (user, 2026-11-21): "Medicine papers",
  // "Medicine exam papers" — not "Papers".
  const label = (k) => capital(plural(names.get(k)));
  return order
    .map((k) => ({ key: `series:${k}`, label: label(k), quizzes: map.get(k).sort(byPaperNumber) }))
    .sort((a, b) => seriesRank(a.label) - seriesRank(b.label) || a.label.localeCompare(b.label));
}

function groupBySubject(quizzes, scope) {
  const map = new Map();
  sortQuizzesByHierarchy(quizzes).forEach((quiz) => {
    const label = scope === 'lesson'
      ? quiz.subjectName || quiz.topicName || quiz.lessonTitle || 'Lesson practice'
      : quiz.subjectName || 'General';
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(quiz);
  });
  return [...map.entries()].map(([label, items]) => ({ key: `${scope}:${label}`, label, quizzes: items }));
}

const COURSE_SCOPES = [
  { key: 'subject', label: 'Subjects' },
  { key: 'full-course', label: 'Full course' },
  { key: 'lesson', label: 'Lessons' },
];

function ProgressRing({ done, total, size = 40 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = total ? done / total : 0;
  return (
    <svg className="qbc-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--qbc-ring-track)" strokeWidth={stroke} />
      {p > 0 ? <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--qbc-ring-fill)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      /> : null}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="qbc-ring__text">
        {total ? Math.round(p * 100) : 0}%
      </text>
    </svg>
  );
}

function QuizCourseView({ courseName, quizzes, onBack, bookmarkedIds, onBookmark, onAccessNeeded, onStartReady, pageMode }) {
  const isExamPage = pageMode === 'exam';
  const [scope, setScope] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const shelfRef = useRef(null);

  const byScope = useMemo(() => {
    const out = { subject: [], 'full-course': [], lesson: [] };
    quizzes.forEach((quiz) => out[getQuizScopeKey(quiz)].push(quiz));
    return out;
  }, [quizzes]);
  const available = COURSE_SCOPES.filter((s) => byScope[s.key].length > 0);
  const current = available.some((s) => s.key === scope) ? scope : (available[0]?.key || 'subject');

  const cards = useMemo(() => (
    current === 'full-course' ? buildSeries(byScope['full-course']) : groupBySubject(byScope[current], current)
  ), [byScope, current]);

  const withProgress = cards.map((card) => {
    const done = card.quizzes.filter(isQuizDone).length;
    return { ...card, done, total: card.quizzes.length };
  });
  // Nothing chosen yet: where the student left off (in progress, else the first not started).
  const fallback = withProgress.find((c) => c.done > 0 && c.done < c.total)
    || withProgress.find((c) => c.done === 0)
    || withProgress[0];
  const selected = withProgress.find((c) => c.key === selectedKey) || fallback;
  const next = selected?.quizzes.find((q) => !isQuizDone(q));

  useEffect(() => {
    // Keep the chosen card in view in the slider.
    const node = shelfRef.current?.querySelector('[data-selected="true"]');
    node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selected?.key, current]);

  function changeScope(key) {
    setScope(key);
    setSelectedKey(null);
    setShowAll(false);
    shelfRef.current?.scrollTo?.({ left: 0, behavior: 'instant' });
  }

  function choose(key) {
    setSelectedKey(key);
    setShowAll(false);
  }

  function startQuiz(quiz, title) {
    const canOpenMode = isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false;
    if (canOpenMode) {
      onStartReady(quiz, title);
      return;
    }
    onAccessNeeded({
      ...quiz,
      accessFeature: isExamPage ? 'examMode' : 'practiceMode',
      accessMessage: quiz.accessMessage || `This premium ${isExamPage ? 'exam' : 'practice set'} is included with selected plans.`,
    });
  }

  const allLabel = current === 'full-course' ? 'All series' : current === 'lesson' ? 'All lessons' : 'All subjects';

  return (
    <div className="student-lessons-detail qbc space-y-4">
      <div className="student-lessons-detail-toolbar">
        <button type="button" className={cx(ui.secondaryButton, 'student-lessons-back-button')} onClick={onBack}>
          <IcoChevronLeft />
          <span>Back</span>
        </button>
        <div className="student-lessons-detail-course-name">{courseName || 'General'}</div>
        <span aria-hidden="true" />
      </div>

      {available.length > 1 ? (
        <div className="qbc-switch" role="tablist" aria-label="View sets by">
          {available.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === current}
              className={cx('qbc-switch__item', s.key === current && 'is-active')}
              onClick={() => changeScope(s.key)}
            >
              {s.label}<span>{byScope[s.key].length}</span>
            </button>
          ))}
        </div>
      ) : null}

      {withProgress.length ? (
        <div className="qbc-shelf" ref={shelfRef}>
          {withProgress.map((card) => (
            <button
              key={card.key}
              type="button"
              data-selected={card.key === selected?.key}
              className={cx('qbc-card', card.key === selected?.key && 'is-active', card.done >= card.total && 'is-done')}
              onClick={() => choose(card.key)}
            >
              <ProgressRing done={card.done} total={card.total} />
              <strong>{card.label}</strong>
              <small>{card.done}/{card.total} done</small>
            </button>
          ))}
          <button type="button" className={cx('qbc-card qbc-card--all', showAll && 'is-active')} onClick={() => setShowAll((v) => !v)}>
            <span className="qbc-card__grid" aria-hidden="true"><i /><i /><i /><i /></span>
            <strong>{allLabel}</strong>
            <small>{withProgress.length}</small>
          </button>
        </div>
      ) : null}

      {showAll ? (
        <div className="qbc-all">
          {withProgress.map((card) => (
            <button key={card.key} type="button" className={cx('qbc-all__item', card.key === selected?.key && 'is-active')} onClick={() => choose(card.key)}>
              <ProgressRing done={card.done} total={card.total} size={34} />
              <span><strong>{card.label}</strong><small>{card.done}/{card.total} done</small></span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="qbc-continue">
            <div>
              <span>{next ? (selected.done ? 'Continue' : 'Start here') : 'All done'}</span>
              <strong>{next ? getQuizRowLabel(next, selected.quizzes.indexOf(next)) : `${selected.label}: every set finished`}</strong>
            </div>
            {next ? (
              <button type="button" className={ui.primaryAction} onClick={() => startQuiz(next, getQuizRowLabel(next, selected.quizzes.indexOf(next)))}>
                {selected.done ? 'Continue' : 'Start'}
              </button>
            ) : null}
          </div>

          <section className="student-lessons-category">
            <div className="student-lessons-category__head qbc-head">
              <div className="student-lessons-category__title"><h2>{selected.label}</h2></div>
              <small>{selected.total} {isExamPage ? 'exam' : 'practice'} set{selected.total === 1 ? '' : 's'}</small>
            </div>
            <div className="student-lessons-lesson-list-shell">
              <div className="student-lessons-lesson-list">
                {current === 'full-course'
                  ? selected.quizzes.map((quiz, index) => (
                    <QuizLessonRow
                      key={quiz.id}
                      quiz={quiz}
                      index={index}
                      bookmarked={bookmarkedIds.has(quiz.id)}
                      onBookmark={onBookmark}
                      onStart={() => startQuiz(quiz, getQuizRowLabel(quiz, index))}
                      pageMode={pageMode}
                    />
                  ))
                  : groupQuizzesByTopic(selected).map((topic, topicIndex) => (
                    <Fragment key={`${topic.label || 'general'}-${topicIndex}`}>
                      {topic.label ? (
                        <div className="student-lessons-topic-divider"><span>{topic.label}</span></div>
                      ) : null}
                      {topic.quizzes.map((quiz, index) => (
                        <QuizLessonRow
                          key={quiz.id}
                          quiz={quiz}
                          index={index}
                          bookmarked={bookmarkedIds.has(quiz.id)}
                          onBookmark={onBookmark}
                          onStart={() => startQuiz(quiz, getQuizRowLabel(quiz, index))}
                          pageMode={pageMode}
                        />
                      ))}
                    </Fragment>
                  ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StudentQuizzesPage({ pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const navigate   = useNavigate();

  const [quizzes,       setQuizzes]       = useState(() => readStudentQuizzesCache() || []);
  const [loading,       setLoading]       = useState(() => readStudentQuizzesCache() === undefined);
  const [error,         setError]         = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set(
    (readStudyBookmarksCache() || []).filter(b => b.itemType === 'quiz').map(b => b.itemId)
  ));
  const [examTypeFilter, setExamTypeFilter] = useState('all');
  const [courseFilter,  setCourseFilter]  = useState('all');
  const [accessPromptQuiz, setAccessPromptQuiz] = useState(null);
  const [startPrompt, setStartPrompt] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const body = document.body;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const root = document.documentElement;
    const dashboardThemeColors = { light: '#dce6f4', dark: '#060d22' };
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
    let cancelPreload = () => {};
    fetchStudentQuizzes()
      .then(rows => {
        if (cancelled) return;
        setQuizzes(rows);
        const openQuizzes = (Array.isArray(rows) ? rows : []).filter((quiz) =>
          isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false
        );
        const firstOpenQuiz = openQuizzes[0];
        if (firstOpenQuiz) {
          cancelPreload = runWhenIdle(() => {
            const mode = isExamPage ? 'exam' : 'practice';
            preloadRouteByPath(`/quizzes/${firstOpenQuiz.id}?mode=${mode}`);
            // 10.21: no background pre-loading — a quiz file loads when it is opened.
          });
        }
        cancelBookmarks = runWhenIdle(async () => {
          const bm = await fetchStudyBookmarks().catch(() => []);
          if (cancelled) return;
          setBookmarkedIds(new Set(bm.filter(b => b.itemType === 'quiz').map(b => b.itemId)));
        });
      })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e, isExamPage ? 'Unable to load exams' : 'Unable to load question bank')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; cancelBookmarks(); cancelPreload(); };
  }, [isExamPage]);

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



  function handleSelectCourse(courseName) {
    setCourseFilter(courseName);
  }

  function handleBackToCourses() {
    setCourseFilter('all');
  }

  function handleExamTypeFilter(type) {
    setExamTypeFilter(type);
    setCourseFilter('all');
  }

  function handleRequestStart(quiz, title) {
    if (!quiz.accessLocked && !isExamPage) {
      prefetchStudentQuiz(quiz.id, { mode: 'practice' });
    }
    setStartPrompt({
      quiz,
      title,
      mode: isExamPage ? 'exam' : 'practice',
    });
  }

  function handleConfirmStart() {
    if (!startPrompt?.quiz?.id) return;
    const { quiz, mode } = startPrompt;
    setStartPrompt(null);
    prefetchStudentQuiz(quiz.id, { mode });
    navigate(`/quizzes/${quiz.id}?mode=${mode}`);
  }

  const modeQuizzes = useMemo(
    () => (isExamPage ? quizzes : quizzes.filter(q => !q.examModeOnly)),
    [isExamPage, quizzes],
  );

  const examTypes = useMemo(() => {
    const types = new Set(modeQuizzes.map(q => q.examType).filter(Boolean));
    return [...types].sort();
  }, [modeQuizzes]);

  const examTypeQuizzes = useMemo(
    () => examTypeFilter === 'all' ? modeQuizzes : modeQuizzes.filter(q => q.examType === examTypeFilter),
    [modeQuizzes, examTypeFilter],
  );

  const courseCards = useMemo(() => {
    const map = new Map();
    examTypeQuizzes.forEach((q) => {
      const name = q.courseTitle || 'General';
      if (!map.has(name)) map.set(name, { name, quizzes: [] });
      map.get(name).quizzes.push(q);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [examTypeQuizzes]);

  const visible = useMemo(
    () => examTypeQuizzes.filter(q => courseFilter === 'all' || (q.courseTitle || 'General') === courseFilter),
    [examTypeQuizzes, courseFilter],
  );

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

        {/* Q-Bank ⇄ Exams switch. On mobile/native the bottom tab bar has no
            Exams entry (it's grouped under Q-Bank), so this segmented control is
            how students reach exams from the first course-list page. */}
        {courseFilter === 'all' ? (
          <div className="mb-4 flex justify-center">
            {PLATFORM.isNative ? (
              <div className="relative flex w-full max-w-[420px] rounded-full border border-line-soft bg-surface-card p-1">
                {/* Sliding thumb glides between the two segments — native polish. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%_-_4px)] rounded-full bg-brand-primary transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
                    isExamPage ? 'translate-x-full' : 'translate-x-0',
                  )}
                />
                <button
                  type="button"
                  aria-pressed={!isExamPage}
                  onClick={() => { if (isExamPage) navigate('/quizzes'); }}
                  className={cx(
                    'relative z-[1] min-h-10 flex-1 appearance-none rounded-full border-0 bg-transparent text-[13px] font-extrabold transition-colors',
                    isExamPage ? 'text-ink-soft' : 'text-white',
                  )}
                >
                  Practice
                </button>
                <button
                  type="button"
                  aria-pressed={isExamPage}
                  onClick={() => { if (!isExamPage) navigate('/exams'); }}
                  className={cx(
                    'relative z-[1] min-h-10 flex-1 appearance-none rounded-full border-0 bg-transparent text-[13px] font-extrabold transition-colors',
                    isExamPage ? 'text-white' : 'text-ink-soft',
                  )}
                >
                  Exams
                </button>
              </div>
            ) : (
              <div className="grid w-full max-w-[420px] grid-cols-2 gap-1 rounded-full border border-line-soft bg-surface-card p-1">
                <button
                  type="button"
                  aria-pressed={!isExamPage}
                  onClick={() => { if (isExamPage) navigate('/quizzes'); }}
                  className={cx(
                    'min-h-10 appearance-none rounded-full border-0 px-4 text-[13px] font-extrabold transition-colors',
                    isExamPage ? 'text-ink-soft' : 'bg-brand-primary text-white',
                  )}
                >
                  Practice
                </button>
                <button
                  type="button"
                  aria-pressed={isExamPage}
                  onClick={() => { if (!isExamPage) navigate('/exams'); }}
                  className={cx(
                    'min-h-10 appearance-none rounded-full border-0 px-4 text-[13px] font-extrabold transition-colors',
                    isExamPage ? 'bg-brand-primary text-white' : 'text-ink-soft',
                  )}
                >
                  Exams
                </button>
              </div>
            )}
          </div>
        ) : null}

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={cx(ui.skeletonCard, 'h-[160px] max-[520px]:h-[132px]')} />
            ))}
          </div>
        ) : courseFilter === 'all' ? (
          courseCards.length === 0 && examTypes.length === 0 ? (
            <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
              <StudyMascot variant="review" mood="review" size="lg" label={isExamPage ? 'Empty exams mascot' : 'Empty practice exams mascot'} />
              <p className="m-0 text-center">
                {isExamPage ? 'No exams available yet.' : 'No question sets available yet.'}
              </p>
            </div>
          ) : (
            <>
              {examTypes.length > 1 ? (
                <div className="student-lessons-filter-bar mb-4">
                  <button
                    type="button"
                    className={cx('student-lessons-filter-chip', examTypeFilter === 'all' && 'is-active')}
                    onClick={() => handleExamTypeFilter('all')}
                  >
                    All
                  </button>
                  {examTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={cx('student-lessons-filter-chip', examTypeFilter === type && 'is-active')}
                      onClick={() => handleExamTypeFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              ) : null}
              {courseCards.length === 0 ? (
                <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
                  <StudyMascot variant="review" mood="review" size="lg" label="No courses mascot" />
                  <p className="m-0 text-center">No courses for this exam type.</p>
                </div>
              ) : (
                <CoursePicker courses={courseCards} onSelect={handleSelectCourse} pageMode={pageMode} />
              )}
            </>
          )
        ) : (
          <section>
            <QuizCourseView
              key={courseFilter}
              courseName={courseFilter}
              quizzes={visible}
              onBack={handleBackToCourses}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onAccessNeeded={setAccessPromptQuiz}
              onStartReady={handleRequestStart}
              pageMode={pageMode}
            />
          </section>
        )}
      </section>

      <QuizStartConfirmationSheet
        prompt={startPrompt}
        onCancel={() => setStartPrompt(null)}
        onConfirm={handleConfirmStart}
      />

      {accessPromptQuiz ? createPortal((
        <div
          className="fixed inset-0 z-[11000] bg-[rgba(15,23,42,0.30)] backdrop-blur-md dark:bg-[rgba(2,6,23,0.66)]"
          onClick={() => setAccessPromptQuiz(null)}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-card-elevated p-5 shadow-[var(--ds-floating-shadow)] dark:border-white/[0.09]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-access-title"
            onClick={(event) => event.stopPropagation()}
          >
            {/* 10.23 W7: a locked set is "Continue in the app" — decided from the
                list the browser holds, no request. */}
            <AppOnlyGate contentLabel={isExamPage ? 'exam' : 'practice set'} title="Continue in the app" />
            <div className="mt-3 grid">
              <button
                type="button"
                className={cx(ui.secondaryButton, 'min-h-11 px-4 text-xs')}
                onClick={() => setAccessPromptQuiz(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </main>
  );
}
