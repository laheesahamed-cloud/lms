import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchStudentQuizzes, readStudentQuizzesCache } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchStudyBookmarks, readStudyBookmarksCache, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { preloadRouteByPath } from '../../../../app/routePreloading.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { StudyMascot } from '../../../../shared/ui/StudyMascot.jsx';
import { getQuizTitleText } from './quizLabels.js';

function getQuizRowLabel(quiz, index) {
  if (quiz.displayTitleMode === 'number' && quiz.quizNumber) {
    return `Quiz ${String(quiz.quizNumber).padStart(2, '0')}`;
  }
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

function IcoBook()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 2h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4V2z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M7.5 3h4v9h-4" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M7.5 7h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function IcoBookmark()    { return <svg width="14" height="14" viewBox="0 0 13 13" fill="none"><path d="M2.5 1.5h8a.5.5 0 0 1 .5.5v9l-4.5-2.5L2 11V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>; }
function IcoBookmarkFilled() { return <svg width="14" height="14" viewBox="0 0 13 13" fill="currentColor"><path d="M2.5 1.5h8a.5.5 0 0 1 .5.5v9l-4.5-2.5L2 11V2a.5.5 0 0 1 .5-.5z"/></svg>; }
function IcoChevron()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 4l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoChevronLeft() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 4l-4 3 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoLock()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 6V4.5A2.5 2.5 0 0 1 7 2A2.5 2.5 0 0 1 9.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function IcoCheck()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

function isQuizDone(quiz) {
  return quiz.isCompleted || quiz.completed || quiz.practiceStatus === 'completed' || Number(quiz.examAttemptCount || 0) > 0 || Number(quiz.practiceCompletedCount || 0) > 0;
}

function sortQuizzesByHierarchy(items) {
  return [...items].sort((a, b) => {
    const aKey = [a.topicName, a.subtopicName, a.lessonTitle, a.quizTitle].filter(Boolean).join('\u0001');
    const bKey = [b.topicName, b.subtopicName, b.lessonTitle, b.quizTitle].filter(Boolean).join('\u0001');
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
  });
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
              className="glass-card student-lessons-course-card group flex min-h-[132px] w-full cursor-pointer flex-col justify-center text-left outline-none transition-[transform,border-color,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-primary/22"
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
                  <div className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">{(isExamPage ? 'exam' : 'set') + (course.quizzes.length === 1 ? '' : 's')}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getQuizScopeKey(quiz) {
  if (quiz.isGeneral) return 'full-course';
  if (quiz.lessonId) return 'lesson';
  return 'subject';
}

function getSubjectPoolLabel(quiz) {
  return quiz.subjectName || quiz.topicName || 'Subject revision';
}

const QUIZ_SCOPE_OPTIONS = [
  {
    key: 'lesson',
    title: 'Lesson-wise',
    description: 'Practice sets attached to specific lessons.',
  },
  {
    key: 'subject',
    title: 'Subject-wise',
    description: 'Mixed quiz from all lessons under one subject.',
  },
  {
    key: 'full-course',
    title: 'Full course revision',
    description: 'Mixed sets covering the whole course.',
  },
];

function QuizScopePicker({ courseName, quizzes, onBack, onSelect, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const setLabel = isExamPage ? 'exam set' : 'practice set';
  const counts = quizzes.reduce((acc, quiz) => {
    const key = getQuizScopeKey(quiz);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="student-lessons-detail space-y-4">
      <div className="student-lessons-detail-toolbar">
        <button type="button" className={cx(ui.secondaryButton, 'student-lessons-back-button')} onClick={onBack}>
          <IcoChevronLeft />
          <span>Back</span>
        </button>
        <div className="student-lessons-detail-course-name">
          {courseName || 'General'}
        </div>
        <div className="student-lessons-detail-title">
          <strong>Choose practice type</strong>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
        {QUIZ_SCOPE_OPTIONS.map((option) => {
          const count = counts[option.key] || 0;
          return (
            <button
              type="button"
              key={option.key}
              className="glass-card student-lessons-course-card group flex min-h-[132px] w-full cursor-pointer flex-col justify-center text-left outline-none transition-[transform,border-color,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-4 focus-visible:ring-brand-primary/22"
              disabled={count === 0}
              onClick={() => onSelect(option.key)}
            >
              <div className="student-lessons-course-card__top flex items-start justify-between gap-4 px-5 py-5">
                <div className="min-w-0">
                  <h2 className="m-0 text-[16px] font-black leading-tight text-ink-strong">{option.title}</h2>
                  <p className="m-0 mt-1 text-[12.5px] font-semibold leading-relaxed text-ink-soft">{option.description}</p>
                </div>
                <div className="student-lessons-course-card__count shrink-0 text-right">
                  <div className="text-[30px] font-extrabold leading-none text-ink-strong">{count}</div>
                  <div className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">{setLabel}{count === 1 ? '' : 's'}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SubjectPoolPicker({ courseName, quizzes, onBack, onSelect, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const setLabel = isExamPage ? 'exam set' : 'practice set';
  const subjectPools = useMemo(() => {
    const map = new Map();
    quizzes.forEach((quiz) => {
      const label = getSubjectPoolLabel(quiz);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(quiz);
    });
    return [...map.entries()]
      .map(([label, items]) => ({ label, quizzes: items }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [quizzes]);

  return (
    <section className="student-lessons-detail space-y-4">
      <div className="student-lessons-detail-toolbar">
        <button type="button" className={cx(ui.secondaryButton, 'student-lessons-back-button')} onClick={onBack}>
          <IcoChevronLeft />
          <span>Back</span>
        </button>
        <div className="student-lessons-detail-course-name">
          {courseName || 'General'}
        </div>
        <div className="student-lessons-detail-title">
          <strong>Choose subject</strong>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
        {subjectPools.map((subject) => (
          <button
            type="button"
            key={subject.label}
            className="glass-card student-lessons-course-card group flex min-h-[132px] w-full cursor-pointer flex-col justify-center text-left outline-none transition-[transform,border-color,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-primary/22"
            onClick={() => onSelect(subject.label)}
          >
            <div className="student-lessons-course-card__top flex items-start justify-between gap-4 px-5 py-5">
              <div className="min-w-0">
                <h2 className="m-0 text-[16px] font-black leading-tight text-ink-strong">{subject.label}</h2>
                <p className="m-0 mt-1 text-[12.5px] font-semibold leading-relaxed text-ink-soft">Questions mixed from all lessons under this subject.</p>
              </div>
              <div className="student-lessons-course-card__count shrink-0 text-right">
                <div className="text-[30px] font-extrabold leading-none text-ink-strong">{subject.quizzes.length}</div>
                <div className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">{setLabel}{subject.quizzes.length === 1 ? '' : 's'}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuizLessonRow({ quiz, index, bookmarked, onStart, onBookmark, pageMode = 'practice' }) {
  const isExamPage = pageMode === 'exam';
  const title = getQuizRowLabel(quiz, index) || `Untitled ${isExamPage ? 'exam' : 'practice set'}`;
  const statusLabel = quiz.accessLocked ? 'Locked' : quiz.isFree ? (isExamPage ? 'Free exam' : 'Free practice') : quiz.isFree === false ? 'Premium' : '';
  const completed = isQuizDone(quiz);
  const actionPath = `/quizzes/${quiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`;

  function preloadQuizRoute() {
    if (!quiz.accessLocked) preloadRouteByPath(actionPath);
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
      <strong>{String(index + 1).padStart(2, '0')}</strong>
      <span className="student-lessons-lesson-row__title">
        <span className="student-lessons-lesson-row__title-line">
          <span className="student-lessons-lesson-row__title-text">{title}</span>
          {completed ? (
            <i className="student-lessons-lesson-row__done" aria-label="Completed">
              <IcoCheck />
            </i>
          ) : null}
        </span>
        {statusLabel ? <small data-status={quiz.accessLocked ? 'locked' : 'free'}>{statusLabel}</small> : null}
      </span>
      <span className="student-lessons-lesson-row__actions">
        <button
          type="button"
          className={cx('student-lessons-lesson-row__save', bookmarked && 'is-saved')}
          onClick={(event) => onBookmark(event, quiz.id)}
          aria-label={bookmarked ? `Saved ${title}` : `Save ${title}`}
          aria-pressed={bookmarked}
        >
          {bookmarked ? <IcoBookmarkFilled /> : <IcoBookmark />}
        </button>
        <span className="student-lessons-lesson-row__chevron" aria-hidden="true">
          <IcoChevron />
        </span>
      </span>
    </div>
  );
}

function QuizLessonDetail({ courseName, quizzes, onBack, bookmarkedIds, onBookmark, onAccessNeeded, navigate, pageMode, scope }) {
  const isExamPage = pageMode === 'exam';
  const setLabel = isExamPage ? 'Exam Set' : 'Practice Set';
  const setLabelLower = setLabel.toLowerCase();
  const groupingLabel = scope === 'lesson' ? 'lesson' : scope === 'full-course' ? 'revision group' : 'subject';
  const [activeSubject, setActiveSubject] = useState(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState(new Set());
  const subjects = useMemo(() => {
    const map = new Map();
    sortQuizzesByHierarchy(quizzes).forEach((quiz) => {
      const label = scope === 'lesson'
        ? quiz.lessonTitle || quiz.subjectName || 'Lesson practice'
        : quiz.subjectName || (quiz.isGeneral ? 'General / Full Course Revision' : 'General');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(quiz);
    });
    return [...map.entries()].map(([label, items]) => ({ label, quizzes: items }));
  }, [quizzes, scope]);
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
        <button type="button" className={cx(ui.secondaryButton, 'student-lessons-back-button')} onClick={onBack}>
          <IcoChevronLeft />
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
          <button type="button" className={cx('student-lessons-filter-chip', !activeSubject && 'is-active')} onClick={() => setActiveSubject(null)}>
            All {groupingLabel}s
          </button>
          {subjects.map((subject) => (
            <button
              type="button"
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
  const [courseFilter,  setCourseFilter]  = useState('all');
  const [scopeFilter, setScopeFilter] = useState('');
  const [subjectPoolFilter, setSubjectPoolFilter] = useState('');
  const [accessPromptQuiz, setAccessPromptQuiz] = useState(null);

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
        const firstOpenQuiz = (Array.isArray(rows) ? rows : []).find((quiz) =>
          isExamPage ? quiz.canExamMode !== false : quiz.canPracticeMode !== false
        );
        if (firstOpenQuiz) {
          cancelPreload = runWhenIdle(() => {
            preloadRouteByPath(`/quizzes/${firstOpenQuiz.id}?mode=${isExamPage ? 'exam' : 'practice'}`);
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
    setScopeFilter('');
    setSubjectPoolFilter('');
  }

  function handleBackToCourses() {
    setCourseFilter('all');
    setScopeFilter('');
    setSubjectPoolFilter('');
  }

  function handleBackToScopes() {
    setScopeFilter('');
    setSubjectPoolFilter('');
  }

  function handleSelectScope(scope) {
    setScopeFilter(scope);
    setSubjectPoolFilter('');
  }

  function handleBackToSubjectPools() {
    setSubjectPoolFilter('');
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

  const visible = useMemo(
    () => modeQuizzes.filter(q => courseFilter === 'all' || (q.courseTitle || 'General') === courseFilter),
    [modeQuizzes, courseFilter],
  );
  const scopedVisible = useMemo(
    () => visible.filter((quiz) => (
      (!scopeFilter || getQuizScopeKey(quiz) === scopeFilter)
      && (!subjectPoolFilter || getSubjectPoolLabel(quiz) === subjectPoolFilter)
    )),
    [scopeFilter, subjectPoolFilter, visible],
  );
  const subjectScopeQuizzes = useMemo(
    () => visible.filter((quiz) => getQuizScopeKey(quiz) === 'subject'),
    [visible],
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
            how students reach exams. Shown only ≤900px — desktop hides it
            because the sidebar already lists Q-Bank and Exams separately. */}
        <div className="mb-4 min-[901px]:hidden">
          <div className="grid w-full max-w-[420px] grid-cols-2 gap-1 rounded-full border border-line-soft bg-surface-card p-1">
            <button
              type="button"
              aria-pressed={!isExamPage}
              onClick={() => { if (isExamPage) navigate('/quizzes'); }}
              className={cx(
                'min-h-10 rounded-full px-4 text-[13px] font-extrabold transition-colors',
                isExamPage ? 'text-ink-soft' : 'bg-brand-primary text-white',
              )}
            >
              Q-Bank
            </button>
            <button
              type="button"
              aria-pressed={isExamPage}
              onClick={() => { if (!isExamPage) navigate('/exams'); }}
              className={cx(
                'min-h-10 rounded-full px-4 text-[13px] font-extrabold transition-colors',
                isExamPage ? 'bg-brand-primary text-white' : 'text-ink-soft',
              )}
            >
              Exams
            </button>
          </div>
        </div>

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

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
        ) : !scopeFilter ? (
          <QuizScopePicker
            courseName={courseFilter}
            quizzes={visible}
            onBack={handleBackToCourses}
            onSelect={handleSelectScope}
            pageMode={pageMode}
          />
        ) : scopeFilter === 'subject' && !subjectPoolFilter ? (
          <SubjectPoolPicker
            courseName={courseFilter}
            quizzes={subjectScopeQuizzes}
            onBack={handleBackToScopes}
            onSelect={setSubjectPoolFilter}
            pageMode={pageMode}
          />
        ) : scopedVisible.length === 0 ? (
          <section>
            <QuizLessonDetail
              courseName={courseFilter}
              quizzes={scopedVisible}
              onBack={scopeFilter === 'subject' ? handleBackToSubjectPools : handleBackToScopes}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onAccessNeeded={setAccessPromptQuiz}
              navigate={navigate}
              pageMode={pageMode}
              scope={scopeFilter}
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
              quizzes={scopedVisible}
              onBack={scopeFilter === 'subject' ? handleBackToSubjectPools : handleBackToScopes}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onAccessNeeded={setAccessPromptQuiz}
              navigate={navigate}
              pageMode={pageMode}
              scope={scopeFilter}
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
            className="fixed left-1/2 top-1/2 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-card-elevated p-5 shadow-[var(--ds-floating-shadow)] dark:border-white/[0.09]"
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
