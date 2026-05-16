import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudentCourseDetail,
  updateStudentLessonProgress,
} from '../../../api/courses.api.js';
import { getLessonAiNote, listAiNotes } from '../../../api/aiNotes.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const surfaceCard =
  'rounded-2xl border border-line-soft bg-surface-card dark:border-white/[0.08] dark:bg-[#050a13]';
const innerPanel =
  'rounded-xl border border-line-soft bg-surface-1 dark:border-white/[0.08] dark:bg-white/[0.035]';
const subtleButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line-medium bg-surface-2 px-4 text-[13px] font-semibold text-ink-medium transition-[background,border-color,color] duration-150 hover:border-brand-primary/26 hover:bg-[var(--color-primary-light)] hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-sky-400/28 dark:hover:bg-sky-400/12 dark:hover:text-white';
const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand-primary/24 bg-[var(--color-primary-light)] px-4 text-[13px] font-semibold text-brand-primary transition-[background,border-color,color,opacity] duration-150 hover:border-brand-primary/36 hover:bg-brand-primary/14 disabled:cursor-not-allowed disabled:opacity-55 dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200 dark:hover:bg-sky-400/18';

function IcoCheckFill() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="currentColor" opacity=".15"/><path d="M4.5 8.5L7 11L11.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoBookOpen()  { return <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 14V4M8.5 4C7 2.5 3 2 1.5 3v10c1.5-1 5.5-.5 7 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8.5 4C10 2.5 14 2 15.5 3v10c-1.5-1-5.5-.5-7 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>; }
function IcoBookProgress() { return <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 14V4M8.5 4C7 2.5 3 2 1.5 3v10c1.5-1 5.5-.5 7 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8.5 4C10 2.5 14 2 15.5 3v10c-1.5-1-5.5-.5-7 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 7l2-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M11 9.5l2-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, numeric));
}

function formatStatus(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function normalizeLookup(value) {
  return String(value || '').trim().toLowerCase();
}

function statusTone(status) {
  if (status === 'completed') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/22 dark:bg-sky-400/10 dark:text-sky-100';
  if (status === 'in_progress') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-cyan-300/24 dark:bg-cyan-300/10 dark:text-cyan-100';
  return 'border-line-medium bg-surface-2 text-ink-soft dark:border-slate-300/14 dark:bg-slate-300/7 dark:text-slate-300';
}

function statusDot(status) {
  if (status === 'completed') return 'bg-brand-primary dark:bg-sky-400';
  if (status === 'in_progress') return 'bg-brand-primary dark:bg-cyan-300';
  return 'bg-ink-muted dark:bg-slate-500';
}

function unitTone(status) {
  if (status === 'completed') {
    return {
      card: 'border-brand-primary/18 dark:border-sky-300/20',
      header: 'bg-surface-card dark:bg-white/[0.035]',
      circle: 'bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:bg-sky-400/14 dark:text-sky-100 dark:shadow-none',
      rail: 'border-brand-primary/34 dark:border-sky-300/42',
      accent: 'bg-brand-primary dark:bg-sky-400',
      progress: 'bg-[var(--brand-gradient-primary)] dark:bg-[linear-gradient(90deg,#38bdf8,#60a5fa)] dark:shadow-none',
    };
  }
  if (status === 'in_progress') {
    return {
      card: 'border-brand-primary/18 dark:border-sky-300/20',
      header: 'bg-surface-card dark:bg-white/[0.035]',
      circle: 'bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:bg-sky-400/14 dark:text-sky-100 dark:shadow-none',
      rail: 'border-brand-primary/34 dark:border-sky-300/42',
      accent: 'bg-brand-primary dark:bg-sky-400',
      progress: 'bg-[var(--brand-gradient-primary)] dark:bg-[linear-gradient(90deg,#38bdf8,#60a5fa)] dark:shadow-none',
    };
  }
  return {
    card: 'border-line-soft dark:border-slate-400/14',
    header: 'bg-surface-card dark:bg-white/[0.035]',
    circle: 'bg-surface-3 text-ink-soft dark:bg-slate-500/20 dark:text-slate-200',
    rail: 'border-line-medium dark:border-slate-500/34',
    accent: 'bg-ink-muted dark:bg-slate-500',
    progress: 'bg-ink-muted dark:bg-slate-600',
  };
}

function estimateStudyTime(course) {
  const explicit = Number(course?.totalStudyHours || course?.studyHours || course?.durationHours || 0);
  if (explicit > 0) {
    const minutes = Math.round(explicit * 60);
    return minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)} hrs`;
  }
  const lessonCount = Number(course?.totalLessonsCount || 0);
  const minutes = lessonCount * 15;
  if (!minutes) return '~0 min';
  if (minutes < 60) return `~${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `~${hours} hr${hours === 1 ? '' : 's'}` : `~${hours.toFixed(1)} hrs`;
}

function resolveLessonCanvas(notes, course, lessonContext) {
  const lessonId = String(lessonContext.id);
  const courseTitle = normalizeLookup(course?.courseTitle);
  const subjectName = normalizeLookup(lessonContext.subjectName);
  const topicName = normalizeLookup(lessonContext.topicName);
  const lessonTitle = normalizeLookup(lessonContext.lessonTitle);

  return (
    notes.find((note) => String(note.lessonId || '') === lessonId) ||
    notes.find((note) =>
      normalizeLookup(note.courseTitle) === courseTitle &&
      normalizeLookup(note.topicName) === subjectName &&
      normalizeLookup(note.subtopicName) === topicName &&
      normalizeLookup(note.lessonTitle || note.title) === lessonTitle
    ) ||
    null
  );
}

function noteMatchesCourse(note, course) {
  const noteCourse = normalizeLookup(note?.courseTitle);
  return !noteCourse || noteCourse === normalizeLookup(course?.courseTitle);
}

function findContinueLesson(subjects) {
  const lessons = subjects.flatMap((subject) =>
    subject.topics.flatMap((topic) =>
      topic.lessons.map((lesson) => ({
        lesson,
        subjectId: subject.id,
        topicId: topic.id,
        subjectName: subject.subjectName,
        topicName: topic.topicName,
      }))
    )
  );

  return (
    lessons.find(({ lesson }) => lesson.status === 'in_progress') ||
    lessons.find(({ lesson }) => lesson.status === 'not_started') ||
    lessons[0] ||
    null
  );
}

function ProgressBar({ value, className = '', fillClassName = 'bg-[var(--brand-gradient-primary)] dark:bg-[linear-gradient(90deg,#6d7cff,#22d3ee)] dark:shadow-none' }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.09]', className)}>
      <span
        className={cx('block h-full rounded-full', fillClassName)}
        style={{ width: `${clampPercent(value)}%` }}
      />
    </div>
  );
}

function LessonActionButton({ lesson, onOpen, busy }) {
  return (
    <button
      type="button"
      className={primaryButton}
      onClick={onOpen}
      disabled={busy}
      title={lesson.accessLocked ? lesson.accessMessage || 'Included with selected plans' : undefined}
    >
      {busy ? 'Opening...' : lesson.actionLabel}
    </button>
  );
}

export function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const [busyLessonId, setBusyLessonId] = useState(null);
  const [markingLessonId, setMarkingLessonId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetchStudentCourseDetail(courseId);

        if (cancelled) return;
        setData(response);
        setOpenSubjects(new Set(response.subjects.slice(0, 2).map((subject) => subject.id)));
        setOpenTopics(new Set(
          response.subjects
            .slice(0, 1)
            .flatMap((subject) => subject.topics.slice(0, 1).map((topic) => `${subject.id}:${topic.id}`))
        ));
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'Unable to load course details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const course = data?.course || null;
  const subjects = data?.subjects || [];
  const continueTarget = useMemo(() => findContinueLesson(subjects), [subjects]);

  const overviewStats = useMemo(() => {
    if (!course) return [];
    return [
      { label: 'Subjects', value: course.totalSubjectsCount ?? subjects.length, icon: 'subject' },
      { label: 'Lessons', value: course.totalLessonsCount ?? 0, icon: 'lesson' },
      { label: 'Study Time', value: estimateStudyTime(course), icon: 'time' },
    ];
  }, [course, subjects.length]);
  const activeUnitLabel = continueTarget?.subjectName || subjects[0]?.subjectName || 'Course';

  function toggleSubject(subjectId) {
    setOpenSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  function toggleTopic(subjectId, topicId) {
    const key = `${subjectId}:${topicId}`;
    setOpenTopics((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyLessonProgressUpdate(targetLessonId, payload) {
    setData((current) => {
      if (!current) return current;

      const nextSubjects = current.subjects.map((subject) => {
        const nextTopics = subject.topics.map((topic) => {
          const nextLessons = topic.lessons.map((lesson) => {
            if (lesson.id !== targetLessonId) return lesson;

            const status = payload.status;
            const progressPercent = payload.progressPercent;
            return {
              ...lesson,
              status,
              progressPercent,
              actionLabel: status === 'completed' ? 'Review' : status === 'in_progress' ? 'Continue' : 'Start',
            };
          });

          const completedLessonsCount = nextLessons.filter((lesson) => lesson.status === 'completed').length;
          const totalLessonsCount = nextLessons.length;
          const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
          const status =
            totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount
              ? 'completed'
              : nextLessons.some((lesson) => lesson.status !== 'not_started')
                ? 'in_progress'
                : 'not_started';

          return {
            ...topic,
            lessons: nextLessons,
            completedLessonsCount,
            totalLessonsCount,
            progressPercent,
            status,
          };
        });

        const completedLessonsCount = nextTopics.reduce((sum, topic) => sum + topic.completedLessonsCount, 0);
        const totalLessonsCount = nextTopics.reduce((sum, topic) => sum + topic.totalLessonsCount, 0);
        const completedTopicsCount = nextTopics.filter((topic) => topic.totalLessonsCount > 0 && topic.completedLessonsCount === topic.totalLessonsCount).length;
        const totalTopicsCount = nextTopics.length;
        const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
        const status =
          totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount
            ? 'completed'
            : nextTopics.some((topic) => topic.status !== 'not_started')
              ? 'in_progress'
              : 'not_started';

        return {
          ...subject,
          topics: nextTopics,
          completedLessonsCount,
          totalLessonsCount,
          completedTopicsCount,
          totalTopicsCount,
          progressPercent,
          status,
        };
      });

      const completedLessonsCount = nextSubjects.reduce((sum, subject) => sum + subject.completedLessonsCount, 0);
      const totalLessonsCount = nextSubjects.reduce((sum, subject) => sum + subject.totalLessonsCount, 0);
      const completedSubjectsCount = nextSubjects.filter((subject) => subject.totalLessonsCount > 0 && subject.completedLessonsCount === subject.totalLessonsCount).length;
      const totalSubjectsCount = nextSubjects.length;
      const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

      return {
        ...current,
        course: {
          ...current.course,
          completedLessonsCount,
          totalLessonsCount,
          completedSubjectsCount,
          totalSubjectsCount,
          progressPercent,
        },
        subjects: nextSubjects,
      };
    });
  }

  async function handleOpenLesson(lesson) {
    setBusyLessonId(lesson.id);
    setError('');
    try {
      if (lesson.accessLocked) {
        navigate('/subscriptions', {
          state: {
            lockedFeature: 'lessonsAccess',
            from: `/courses/${courseId}`,
            accessScope: 'lessons',
            lessonIds: [lesson.id],
            customSelectionNote: `Selected lesson: ${lesson.lessonTitle}`,
          },
        });
        return;
      }

      let matchingNote = null;
      try {
        matchingNote = await getLessonAiNote(lesson.id);
        if (!noteMatchesCourse(matchingNote, course)) {
          matchingNote = null;
        }
      } catch {
        const noteRows = await listAiNotes().catch(() => []);
        matchingNote = resolveLessonCanvas(noteRows, course, lesson);
      }
      if (!matchingNote) throw new Error('This lesson is being prepared.');

      if (lesson.status === 'not_started') {
        const result = await updateStudentLessonProgress(lesson.id, { status: 'in_progress', progressPercent: 15 });
        applyLessonProgressUpdate(lesson.id, result);
      }

      navigate(`/ai-notes/${matchingNote.id}?view=study`, {
        state: {
          returnToPath: `/courses/${courseId}`,
          returnLabel: course?.courseTitle || 'Course',
          courseId: Number(courseId),
          sourceCourse: course?.courseTitle || null,
          sourceSubject: lesson.subjectName || null,
          sourceTopic: lesson.topicName || null,
          lessonId: lesson.id,
        },
      });
    } catch (openError) {
      setError(getErrorMessage(openError, 'Unable to open lesson'));
    } finally {
      setBusyLessonId(null);
    }
  }

  async function handleCompleteLesson(lesson) {
    setMarkingLessonId(lesson.id);
    setError('');
    try {
      const nextStatus = lesson.status === 'completed' ? 'in_progress' : 'completed';
      const nextProgress = nextStatus === 'completed' ? 100 : 60;
      const result = await updateStudentLessonProgress(lesson.id, {
        status: nextStatus,
        progressPercent: nextProgress,
      });
      applyLessonProgressUpdate(lesson.id, result);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to update lesson progress'));
    } finally {
      setMarkingLessonId(null);
    }
  }

  if (loading) {
    return (
      <main className={cx(ui.screenShell, 'min-h-dvh bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white')}>
        <section className={cx(ui.managementLayout, 'max-w-[1180px]')}>
          <div className="grid gap-4">
            <div className="h-52 rounded-2xl bg-surface-2 dark:bg-white/[0.055]" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="h-96 rounded-2xl bg-surface-2 dark:bg-white/[0.045]" />
              <div className="h-80 rounded-2xl bg-surface-2 dark:bg-white/[0.045]" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!course) {
    return (
      <main className={cx(ui.screenShell, 'min-h-dvh bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white')}>
        <section className={cx(ui.managementLayout, 'max-w-[1180px]')}>
          <div className={cx(surfaceCard, 'p-6 text-[14px] text-ink-soft dark:text-slate-300')}>Course details are unavailable.</div>
        </section>
      </main>
    );
  }

  return (
    <main className={cx(ui.screenShell, 'lms-course-detail-page relative min-h-dvh overflow-hidden bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white')}>
      <div className="pointer-events-none absolute inset-0 bg-surface-0 dark:bg-[#020305]" aria-hidden="true" />

      <section className={cx(ui.managementLayout, 'relative max-w-[1320px] gap-5')}>
        {error ? (
          <div className="rounded-2xl border border-brand-error/20 bg-brand-error/8 px-4 py-3 text-[14px] font-semibold text-brand-error dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-5">
            <section className="lms-course-detail-hero lms-page-header-card relative overflow-hidden rounded-2xl border border-line-soft bg-surface-card p-7 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line-soft dark:bg-white/[0.08]" aria-hidden="true" />
              <div className="relative z-[1] grid gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={subtleButton} onClick={() => navigate('/courses')}>
                    ← Back to Courses
                  </button>
                </div>
                <div className="relative w-fit max-w-[760px]">
                  <h1 className="relative m-0 break-words font-display text-[clamp(28px,4vw,48px)] font-extrabold leading-tight text-ink-strong dark:text-white">
                    {course.courseTitle}
                  </h1>
                </div>
                <div className="grid gap-3 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
                  <div className={cx(innerPanel, 'p-3 sm:p-3.5')}>
                    <p className="m-0 text-[10.5px] font-black uppercase text-ink-muted dark:text-slate-500">Course Overview:</p>
                    <div className="course-overview-stats mt-3 grid grid-cols-3 gap-3">
                      {overviewStats.map((item) => (
                        <div key={item.label} className="course-overview-stat flex min-w-0 items-center gap-2.5">
                          <span className="course-overview-icon grid size-8 shrink-0 place-items-center rounded-lg border border-brand-primary/14 bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:border-cyan-300/18 dark:bg-cyan-300/10 dark:text-cyan-200 dark:shadow-none">
                            {item.icon === 'subject' ? (
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                                <path d="M2.5 3.2h4.2v8.6H2.5a1 1 0 0 1-1-1V4.2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M6.7 3.2h5.8a1 1 0 0 1 1 1v6.6a1 1 0 0 1-1 1H6.7V3.2Z" stroke="currentColor" strokeWidth="1.4" />
                              </svg>
                            ) : item.icon === 'lesson' ? (
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                                <rect x="2.3" y="2.3" width="10.4" height="10.4" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M5 5.5h5M5 8h5M5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                                <circle cx="7.5" cy="7.5" r="5.6" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M7.5 4.5v3.2l2.4 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <div className="min-w-0">
                            <strong className="block truncate text-[clamp(16px,1.6vw,20px)] font-black leading-none text-ink-strong dark:text-white">
                              {item.value}
                            </strong>
                            <span className="mt-0.5 block text-[11.5px] font-semibold text-ink-muted dark:text-slate-500">{item.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={cx(innerPanel, 'grid content-center gap-3 p-3 sm:p-3.5')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-ink-soft dark:text-slate-300">Total Progress:</span>
                      <strong className="text-right text-[clamp(15px,1.5vw,18px)] font-black text-ink-strong dark:text-white">{clampPercent(course.progressPercent)}%</strong>
                    </div>
                    <ProgressBar value={course.progressPercent} className="h-1.5" />
                  </div>
                </div>
              </div>
              <div className="absolute right-8 top-8 grid size-20 place-items-center rounded-xl border border-brand-primary/16 bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:border-cyan-300/[0.16] dark:bg-cyan-300/[0.08] dark:text-cyan-100 dark:shadow-none max-[900px]:hidden" aria-hidden="true">
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <path d="M8 9.5c0-2 1.6-3.5 3.5-3.5H30v25H11.5A3.5 3.5 0 0 1 8 27.5v-18Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M12 27.5A3.5 3.5 0 0 1 15.5 24H30M14 12h10M14 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </section>

              <div className="grid gap-4">
              <div className="grid gap-4 sm:items-center">
                <div>
                  <h2 className="m-0 text-[22px] font-black uppercase leading-tight text-ink-strong dark:text-white">Lessons</h2>
                  <p className="m-0 mt-2 max-w-[760px] text-[14px] leading-6 text-ink-soft dark:text-slate-400 max-[640px]:hidden">
                    Units, topics, and lessons are grouped for fast scanning, with progress visible before you expand each section.
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5">
                {subjects.map((subject, subjectIndex) => {
                  const subjectOpen = openSubjects.has(subject.id);
                  const tone = unitTone(subject.status);

                  return (
                    <section key={subject.id} className={cx('overflow-hidden rounded-2xl border bg-surface-card shadow-none transition-[border-color] duration-200 dark:bg-[#0a101a] dark:shadow-none', tone.card)}>
                      <button
                        type="button"
                        className={cx('grid min-h-[64px] w-full gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 dark:border-white/[0.08] dark:hover:bg-white/[0.025] dark:focus-visible:ring-cyan-300/12 sm:grid-cols-[minmax(0,1fr)_minmax(210px,360px)] sm:items-center', tone.header)}
                        onClick={() => toggleSubject(subject.id)}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl border border-current/14', tone.circle)}>
                            {subject.status === 'completed' ? <IcoCheckFill/> : subject.status === 'in_progress' ? <IcoBookProgress/> : <IcoBookOpen/>}
                          </span>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="m-0 min-w-0 text-[clamp(16px,1.8vw,21px)] font-black leading-tight text-ink-strong dark:text-white">
                              Unit {subjectIndex + 1}: {subject.subjectName}
                            </h3>
                            <span className={cx('rounded-full border px-2.5 py-0.5 text-[10.5px] font-black uppercase', statusTone(subject.status))}>
                              {formatStatus(subject.status)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                          <ProgressBar value={subject.progressPercent} fillClassName={tone.progress} />
                          <strong className="min-w-10 text-right text-[17px] font-semibold text-ink-strong dark:text-white">{subject.progressPercent}%</strong>
                        </div>
                      </button>

                      {subjectOpen ? (
                        <div className="relative px-3.5 py-2.5 sm:px-5">
                          <div className={cx('absolute bottom-6 left-[36px] top-0 border-l', tone.rail)} aria-hidden="true" />
                          <div className="grid gap-0">
                            {subject.topics.map((topic, topicIndex) => {
                              const topicKey = `${subject.id}:${topic.id}`;
                              const topicOpen = openTopics.has(topicKey);
                              const topicCompleted = topic.totalLessonsCount > 0 && topic.completedLessonsCount === topic.totalLessonsCount;

                              return (
                                <section key={topicKey} className="relative">
                                  <button
                                    type="button"
                                    className="relative grid min-h-11 w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-0 pr-2 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 dark:hover:bg-white/[0.025] dark:focus-visible:ring-cyan-300/12"
                                    onClick={() => toggleTopic(subject.id, topic.id)}
                                  >
                                    <span className={cx('ml-[34px] h-6 w-5 rounded-bl-xl border-b border-l', tone.rail)} aria-hidden="true" />
                                    <span className={cx(
                                      'absolute left-[50px] grid size-5 place-items-center rounded-full text-[11px] font-black',
                                      topicCompleted ? 'bg-brand-primary/14 text-brand-primary dark:bg-sky-400/14 dark:text-sky-100' : tone.accent
                                    )}>
                                      {topicCompleted ? '✓' : ''}
                                    </span>
                                    <div className="min-w-0">
                                      <strong className="block text-[clamp(13.5px,1.4vw,16px)] font-black leading-tight text-ink-strong dark:text-white">
                                        <span className="mr-1.5 text-ink-muted dark:text-slate-500">{subjectIndex + 1}.{topicIndex + 1}</span>{topic.topicName}
                                      </strong>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 text-[15px] text-ink-soft dark:text-slate-300">
                                      {!topicOpen ? (
                                        <span className="hidden rounded-full border border-line-soft bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted dark:border-white/[0.07] dark:bg-white/[0.04] sm:inline">
                                          {topic.totalLessonsCount} lessons
                                        </span>
                                      ) : null}
                                      <span className="text-[13px] text-ink-soft" aria-hidden="true">{topicOpen ? '▲' : '▼'}</span>
                                    </div>
                                  </button>

                                  {topicOpen ? (
                                    <div className="ml-[72px] grid grid-cols-1 gap-1.5 pb-3 pt-1.5 max-[640px]:ml-0">
                                      {topic.lessons.map((lesson, lessonIndex) => (
                                        <div
                                          key={lesson.id}
                                          className={cx(
                                            'course-lesson-row group grid grid-cols-1 gap-2 rounded-xl border px-3 py-2.5 transition-[border-color,background,box-shadow] duration-150 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
                                            lesson.status === 'completed'
                                              ? 'border-brand-primary/16 bg-brand-primary/5 dark:border-sky-400/14 dark:bg-sky-400/8'
                                              : lesson.status === 'in_progress'
                                                ? 'border-brand-primary/18 bg-[var(--color-primary-light)] dark:border-sky-400/18 dark:bg-sky-400/10'
                                                : 'border-line-soft bg-surface-card hover:border-brand-primary/20 hover:bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-card))] dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:border-sky-400/16 dark:hover:bg-white/[0.04]'
                                          )}
                                        >
                                          <button
                                            type="button"
                                            className="course-lesson-main grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-left"
                                            onClick={() => handleOpenLesson({
                                              ...lesson,
                                              subjectId: subject.id,
                                              topicId: topic.id,
                                              subjectName: subject.subjectName,
                                              topicName: topic.topicName,
                                            })}
                                            disabled={busyLessonId === lesson.id}
                                          >
                                            <span className={cx(
                                              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border',
                                              lesson.status === 'completed'
                                                ? 'border-brand-primary/35 bg-brand-primary/12 text-brand-primary dark:bg-sky-400/14 dark:text-sky-100'
                                                : lesson.status === 'in_progress'
                                                  ? 'border-brand-primary/35 bg-brand-primary/14 text-brand-primary dark:bg-sky-400/16 dark:text-sky-100'
                                                  : 'border-line-medium bg-surface-2 text-ink-muted dark:border-slate-500/40 dark:bg-white/[0.05]'
                                            )}>
                                              {lesson.status === 'completed'
                                                ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 7L5.5 10L10.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                : lesson.status === 'in_progress'
                                                  ? <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M3 2l5 3-5 3V2z"/></svg>
                                                  : <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3.5 4h4M3.5 5.5h4M3.5 7h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                                              }
                                            </span>
                                            <span className="min-w-0 pt-0.5">
                                              <strong className="flex flex-wrap items-center gap-2 text-[14px] font-semibold leading-snug text-ink-strong dark:text-slate-100">
                                                <span>{lesson.lessonTitle}</span>
                                                {lesson.isFree ? (
                                                  <span className="rounded-full border border-brand-primary/20 bg-brand-primary/8 px-2 py-0.5 text-[10px] font-black uppercase text-brand-primary dark:border-sky-300/18 dark:bg-sky-400/10 dark:text-sky-200">
                                                    Free
                                                  </span>
                                                ) : null}
                                                {lesson.accessLocked ? (
                                                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                                                    Locked
                                                  </span>
                                                ) : null}
                                              </strong>
                                              <span className="course-lesson-meta mt-0.5 block text-[11.5px] leading-snug text-ink-muted dark:text-slate-500">
                                                {[
                                                  `Lesson ${lessonIndex + 1}`,
                                                  '15 min study',
                                                  lesson.accessLocked ? lesson.accessMessage || 'Included with selected plans' : null,
                                                ].filter(Boolean).join(' · ')}
                                              </span>
                                            </span>
                                          </button>

                                          <div className="course-lesson-actions ml-[40px] flex flex-wrap items-center gap-2 sm:ml-0 sm:justify-end">
                                            <button
                                              type="button"
                                              className={cx(
                                                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold transition-[background,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                                                lesson.status === 'completed'
                                                  ? 'border-brand-primary/24 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/16 dark:border-sky-400/22 dark:text-sky-300'
                                                  : 'border-line-medium bg-surface-2 text-ink-muted hover:border-brand-primary/22 hover:text-brand-primary dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-400'
                                              )}
                                              onClick={() => handleCompleteLesson({
                                                ...lesson,
                                                subjectId: subject.id,
                                                topicId: topic.id,
                                                subjectName: subject.subjectName,
                                                topicName: topic.topicName,
                                              })}
                                              disabled={markingLessonId === lesson.id || lesson.accessLocked}
                                              title={lesson.accessLocked ? lesson.accessMessage || 'Included with selected plans' : undefined}
                                            >
                                              {markingLessonId === lesson.id ? (
                                                'Saving...'
                                              ) : lesson.status === 'completed' ? (
                                                <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 6L4 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Done</>
                                              ) : 'Mark done'}
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-primary/24 bg-[var(--color-primary-light)] px-3 text-[11.5px] font-semibold text-brand-primary transition-[background,border-color,color,opacity] duration-150 hover:border-brand-primary/36 hover:bg-brand-primary/14 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200 dark:hover:bg-sky-400/18"
                                              onClick={() => handleOpenLesson({
                                                ...lesson,
                                                subjectId: subject.id,
                                                topicId: topic.id,
                                                subjectName: subject.subjectName,
                                                topicName: topic.topicName,
                                              })}
                                              disabled={busyLessonId === lesson.id}
                                            >
                                              {busyLessonId === lesson.id ? 'Opening...' : lesson.actionLabel || 'Open'}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </section>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
          </div>
          </div>

          <aside className="grid gap-5 xl:sticky xl:top-5">
            <section className={cx(surfaceCard, 'p-5')}>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[18px] font-black uppercase text-ink-strong dark:text-white">Continue where you left off</span>
                <span className="rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-2.5 py-1 text-[10px] font-black uppercase text-brand-primary dark:border-sky-300/18 dark:bg-sky-300/10 dark:text-sky-200">
                  {continueTarget?.lesson?.status === 'completed' ? 'Review' : continueTarget?.lesson?.status === 'in_progress' ? 'Continue' : 'Next'}
                </span>
              </div>
              <p className="m-0 mt-5 text-[12px] font-black uppercase text-ink-muted dark:text-slate-500">Up Next</p>
              <h2 className="m-0 mt-3 text-[17px] font-black leading-snug text-ink-strong dark:text-white">
                {continueTarget?.lesson?.lessonTitle || 'All available lessons are complete.'}
              </h2>
              <p className="m-0 mt-3 text-[15px] leading-6 text-ink-soft dark:text-slate-400">
                {continueTarget ? (
                  <>
                    <span className="text-ink-strong dark:text-slate-100">{activeUnitLabel}</span>
                    {continueTarget.topicName ? ` • ${continueTarget.topicName}` : ''}
                    <span className="block text-[13px] text-ink-muted dark:text-slate-500">Average study time: 15 min</span>
                  </>
                ) : 'You have finished every lesson in this course.'}
              </p>
              {continueTarget ? (
                <button
                  type="button"
                  className={cx(primaryButton, 'mt-6 w-full')}
                  onClick={() =>
                    handleOpenLesson({
                      ...continueTarget.lesson,
                      subjectId: continueTarget.subjectId,
                      topicId: continueTarget.topicId,
                      subjectName: continueTarget.subjectName,
                      topicName: continueTarget.topicName,
                    })
                  }
                >
                  {continueTarget.lesson.status === 'in_progress' ? 'Continue Lesson' : 'Open Lesson'}
                </button>
              ) : null}
            </section>

            <section className={cx(surfaceCard, 'p-5')}>
              <h2 className="m-0 text-[18px] font-black uppercase text-ink-strong dark:text-white">Course Metrics</h2>
              <dl className="mt-4 grid gap-3">
                {[
                  ['Total units', course.totalSubjectsCount],
                  ['Total lessons', course.totalLessonsCount],
                  ['Completed lessons', course.completedLessonsCount],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-t border-line-soft pt-3 first:border-t-0 first:pt-0 dark:border-white/8">
                    <dt className="text-[13px] font-semibold text-ink-muted dark:text-slate-500">{label}</dt>
                    <dd className="m-0 text-[14px] font-black text-ink-strong dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
