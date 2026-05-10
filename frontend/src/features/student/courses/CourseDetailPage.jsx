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
  'rounded-2xl border border-line-soft bg-surface-card shadow-none dark:border-white/[0.08] dark:bg-[#050a13] dark:shadow-none';
const innerPanel =
  'rounded-xl border border-line-soft bg-surface-1 shadow-none dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none';
const subtleButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-medium bg-[var(--btn-secondary-bg)] px-4 text-[13px] font-extrabold text-ink-medium shadow-none transition-[background,border-color,color] duration-150 hover:border-brand-primary/28 hover:bg-[var(--color-primary-light)] hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/12 dark:bg-white/[0.035] dark:text-slate-200 dark:shadow-none dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/10 dark:hover:text-white dark:focus-visible:ring-cyan-300/15';
const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-primary/22 bg-[var(--color-primary-light)] px-4 text-[13px] font-extrabold text-brand-primary shadow-none transition-[background,border-color,color] duration-150 hover:border-brand-primary/36 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-55 dark:border-cyan-300/28 dark:bg-cyan-300/10 dark:text-cyan-100 dark:shadow-none dark:hover:border-cyan-200/46 dark:hover:bg-cyan-300/16';

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
  if (status === 'completed') return 'border-brand-success/24 bg-[var(--color-success-light)] text-brand-success dark:border-emerald-300/22 dark:bg-emerald-300/10 dark:text-emerald-200';
  if (status === 'in_progress') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-cyan-300/24 dark:bg-cyan-300/10 dark:text-cyan-100';
  return 'border-line-medium bg-surface-2 text-ink-soft dark:border-slate-300/14 dark:bg-slate-300/7 dark:text-slate-300';
}

function statusDot(status) {
  if (status === 'completed') return 'bg-brand-success dark:bg-emerald-300';
  if (status === 'in_progress') return 'bg-brand-primary dark:bg-cyan-300';
  return 'bg-ink-muted dark:bg-slate-500';
}

function unitTone(status) {
  if (status === 'completed') {
    return {
      card: 'border-emerald-300/20',
      header: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-success)_12%,var(--surface-1)),var(--surface-1))] dark:bg-[linear-gradient(90deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08),rgba(5,10,18,0.18))]',
      circle: 'bg-[var(--color-success-light)] text-brand-success shadow-none dark:bg-emerald-300/14 dark:text-emerald-100 dark:shadow-none',
      rail: 'border-brand-success/38 dark:border-emerald-300/50',
      accent: 'bg-brand-success dark:bg-emerald-300',
      progress: 'bg-[linear-gradient(90deg,var(--color-success),#34d399)] dark:bg-[linear-gradient(90deg,#34d399,#4ade80)] dark:shadow-none',
    };
  }
  if (status === 'in_progress') {
    return {
      card: 'border-brand-primary/18 dark:border-sky-300/20',
      header: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-primary)_10%,var(--surface-1)),var(--surface-1))] dark:bg-[linear-gradient(90deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08),rgba(5,10,18,0.18))]',
      circle: 'bg-[var(--color-primary-light)] text-brand-primary shadow-none dark:bg-sky-400/14 dark:text-sky-100 dark:shadow-none',
      rail: 'border-brand-primary/34 dark:border-sky-300/42',
      accent: 'bg-brand-primary dark:bg-sky-400',
      progress: 'bg-[var(--brand-gradient-primary)] dark:bg-[linear-gradient(90deg,#38bdf8,#60a5fa)] dark:shadow-none',
    };
  }
  return {
    card: 'border-line-soft dark:border-slate-400/14',
    header: 'bg-surface-1 dark:bg-[linear-gradient(90deg,rgba(100,116,139,0.12),rgba(30,41,59,0.08),rgba(5,10,18,0.16))]',
    circle: 'bg-surface-3 text-ink-soft dark:bg-slate-500/20 dark:text-slate-200',
    rail: 'border-line-medium dark:border-slate-500/34',
    accent: 'bg-ink-muted dark:bg-slate-500',
    progress: 'bg-ink-muted dark:bg-slate-600',
  };
}

function estimateStudyHours(course) {
  const explicit = Number(course?.totalStudyHours || course?.studyHours || course?.durationHours || 0);
  if (explicit > 0) return `~${Math.round(explicit)} hrs`;
  const lessonCount = Number(course?.totalLessonsCount || 0);
  if (!lessonCount) return '~0 hrs';
  return `~${Math.max(1, Math.round(lessonCount * 1.25))} hrs`;
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
      title={lesson.accessLocked ? lesson.accessMessage || 'Upgrade to access this lesson' : undefined}
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
      { label: 'Subjects', value: course.totalSubjectsCount ?? subjects.length, index: '01' },
      { label: 'Core Lessons', value: course.totalLessonsCount ?? 0, index: '02' },
      { label: 'Total Study', value: estimateStudyHours(course), index: '03' },
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--surface-0)_0%,color-mix(in_srgb,var(--color-primary)_2%,var(--surface-0))_54%,var(--surface-0)_100%)] dark:bg-[#020305]" aria-hidden="true" />

      <section className={cx(ui.managementLayout, 'relative max-w-[1320px] gap-5')}>
        {error ? (
          <div className="rounded-2xl border border-brand-error/20 bg-brand-error/8 px-4 py-3 text-[14px] font-semibold text-brand-error dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-5">
            <section className="relative overflow-hidden rounded-2xl border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_5%,var(--surface-card))_0%,var(--surface-card)_64%,color-mix(in_srgb,var(--color-accent)_3%,var(--surface-card))_100%)] p-7 shadow-none dark:border-white/[0.08] dark:bg-[#050a13] dark:shadow-none">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line-soft dark:bg-white/[0.08]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,color-mix(in_srgb,var(--color-primary)_3%,transparent)_0%,transparent_44%,color-mix(in_srgb,var(--color-accent)_2%,transparent)_100%)] dark:bg-[linear-gradient(115deg,rgba(34,211,238,0.035)_0%,transparent_48%,rgba(96,165,250,0.025)_100%)]" aria-hidden="true" />
              <div className="relative z-[1] grid gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={subtleButton} onClick={() => navigate('/courses')}>
                    ← Back to Courses
                  </button>
                </div>
                <div className="relative w-fit max-w-[760px]">
                  <h1 className="gradient-text relative m-0 break-words font-display text-[clamp(28px,4vw,48px)] font-extrabold leading-tight dark:[filter:none]">
                    {course.courseTitle}
                  </h1>
                </div>
                <div className="grid gap-3 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
                  <div className={cx(innerPanel, 'p-3 sm:p-3.5')}>
                    <p className="m-0 text-[10.5px] font-black uppercase text-ink-muted dark:text-slate-500">Course Overview:</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 max-[780px]:grid-cols-1">
                      {overviewStats.map((item) => (
                        <div key={item.label} className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-brand-primary/14 bg-[var(--color-primary-light)] text-[10.5px] font-black text-brand-primary shadow-none dark:border-cyan-300/18 dark:bg-cyan-300/10 dark:text-cyan-200 dark:shadow-none">
                            {item.index}
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
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                <div>
                  <h2 className="m-0 text-[22px] font-black uppercase leading-tight text-ink-strong dark:text-white">Learning Map</h2>
                  <p className="m-0 mt-2 max-w-[760px] text-[14px] leading-6 text-ink-soft dark:text-slate-400">
                    Units, topics, and lessons are grouped for fast scanning, with progress visible before you expand each section.
                  </p>
                </div>
                <div className="rounded-xl border border-line-soft bg-surface-card p-4 shadow-none dark:border-white/[0.08] dark:bg-[#050a13]/70 dark:shadow-none">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-ink-soft dark:text-slate-400">Progress</span>
                    <strong className="text-[24px] font-black text-ink-strong dark:text-white">{clampPercent(course.progressPercent)}%</strong>
                  </div>
                  <ProgressBar value={course.progressPercent} className="mt-3" />
                  <p className="m-0 mt-2 text-[12px] font-semibold text-ink-soft dark:text-slate-400">
                    {course.completedLessonsCount}/{course.totalLessonsCount} lessons complete
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5">
                {subjects.map((subject, subjectIndex) => {
                  const subjectOpen = openSubjects.has(subject.id);
                  const tone = unitTone(subject.status);

                  return (
                    <section key={subject.id} className={cx('overflow-hidden rounded-xl border bg-surface-card shadow-none dark:bg-[#0a101a] dark:shadow-none', tone.card)}>
                      <button
                        type="button"
                        className={cx('grid min-h-[56px] w-full gap-3 border-b border-line-soft px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 dark:border-white/[0.08] dark:hover:bg-white/[0.025] dark:focus-visible:ring-cyan-300/12 sm:grid-cols-[minmax(0,1fr)_minmax(210px,360px)] sm:items-center', tone.header)}
                        onClick={() => toggleSubject(subject.id)}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg border border-current/10 text-[15px] font-black', tone.circle)}>
                            {subjectIndex + 1}
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
                                    className="relative grid min-h-10 w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16 dark:hover:bg-white/[0.018] dark:focus-visible:ring-cyan-300/12"
                                    onClick={() => toggleTopic(subject.id, topic.id)}
                                  >
                                    <span className={cx('ml-[34px] h-6 w-5 rounded-bl-xl border-b border-l', tone.rail)} aria-hidden="true" />
                                    <span className={cx(
                                      'absolute left-[50px] grid size-5 place-items-center rounded-full text-[11px] font-black',
                                      topicCompleted ? 'bg-brand-success text-white dark:bg-emerald-300 dark:text-[#062116]' : tone.accent
                                    )}>
                                      {topicCompleted ? '✓' : ''}
                                    </span>
                                    <div className="min-w-0">
                                      <strong className="block text-[clamp(14px,1.45vw,18px)] font-black leading-tight text-ink-strong dark:text-white">
                                        Topic {subjectIndex + 1}.{topicIndex + 1}: {topic.topicName}
                                      </strong>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 text-[15px] text-ink-soft dark:text-slate-300">
                                      {!topicOpen ? (
                                        <span className="hidden text-[13px] font-semibold text-ink-soft dark:text-slate-400 sm:inline">
                                          {topic.totalLessonsCount} lessons, {formatStatus(topic.status)}
                                        </span>
                                      ) : null}
                                      <span aria-hidden="true">{topicOpen ? '⌃' : '⌄'}</span>
                                    </div>
                                  </button>

                                  {topicOpen ? (
                                    <div className="ml-[72px] grid gap-2 pb-3 pt-1.5">
                                      {topic.lessons.map((lesson, lessonIndex) => (
                                        <div
                                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                          key={lesson.id}
                                        >
                                          <button
                                            type="button"
                                            className="grid min-w-0 grid-cols-[22px_20px_minmax(0,1fr)] items-start gap-2.5 text-left"
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
                                              'mt-0.5 grid size-5 place-items-center rounded-md border text-[11px] font-black',
                                              lesson.status === 'completed'
                                                ? 'border-brand-success/30 bg-brand-success text-white dark:border-emerald-300/30 dark:bg-emerald-300/70 dark:text-[#092015]'
                                                : lesson.status === 'in_progress'
                                                  ? 'border-brand-primary/30 bg-brand-primary text-white dark:border-sky-300/30 dark:bg-sky-400/80 dark:text-[#061827]'
                                                  : 'border-line-medium bg-transparent text-transparent dark:border-slate-500/50'
                                            )}>
                                              {lesson.status !== 'not_started' ? '✓' : ''}
                                            </span>
                                            <span className="mt-0.5 text-ink-muted dark:text-slate-400" aria-hidden="true">
                                              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                                                <path d="M6 3.5h6.4L16 7.1v11.4H6V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                                <path d="M12.25 3.75V7.5H16M8.5 11h5M8.5 14h5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                                              </svg>
                                            </span>
                                            <span className="min-w-0">
                                              <strong className="block text-[14.5px] font-semibold leading-tight text-ink-strong dark:text-slate-100">
                                                Lesson {subjectIndex + 1}.{topicIndex + 1}.{lessonIndex + 1}: {lesson.lessonTitle}
                                              </strong>
                                              <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted dark:text-slate-500">
                                                {[lesson.lessonType, lesson.duration, lesson.accessLocked ? lesson.accessMessage || 'Premium lesson' : null].filter(Boolean).join(' · ') || formatStatus(lesson.status)}
                                              </span>
                                            </span>
                                          </button>

                                          <div className="ml-[52px] flex flex-wrap items-center gap-2 sm:ml-0 sm:justify-end">
                                            {lesson.status === 'in_progress' ? (
                                              <span className="rounded-full border border-brand-primary/26 bg-[var(--color-primary-light)] px-2.5 py-0.5 text-[10.5px] font-black uppercase text-brand-primary dark:border-sky-300/32 dark:bg-sky-400/12 dark:text-sky-200">
                                                In Progress
                                              </span>
                                            ) : null}
                                            <button
                                              type="button"
                                              className="inline-flex min-h-8 items-center justify-center rounded-md border border-line-medium bg-surface-1 px-2.5 text-[11px] font-extrabold text-ink-medium shadow-none transition-[background,border-color,color] duration-150 hover:border-brand-primary/26 hover:bg-[var(--color-primary-light)] hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-cyan-300/22 dark:hover:bg-cyan-300/8 dark:hover:text-white"
                                              onClick={() => handleCompleteLesson({
                                                ...lesson,
                                                subjectId: subject.id,
                                                topicId: topic.id,
                                                subjectName: subject.subjectName,
                                                topicName: topic.topicName,
                                              })}
                                              disabled={markingLessonId === lesson.id || lesson.accessLocked}
                                              title={lesson.accessLocked ? lesson.accessMessage || 'Upgrade to access this lesson' : undefined}
                                            >
                                              {markingLessonId === lesson.id
                                                ? 'Saving...'
                                                : lesson.status === 'completed'
                                                  ? 'Review'
                                                  : 'Mark complete'}
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
                <span className="text-[18px] font-black uppercase text-ink-strong dark:text-white">Study Mode</span>
                <strong className="text-[20px] font-black text-brand-primary dark:text-sky-300">{clampPercent(course.progressPercent)}%</strong>
              </div>
              <ProgressBar value={course.progressPercent} className="mt-4" />
              <p className="m-0 mt-7 text-[12px] font-black uppercase text-ink-muted dark:text-slate-500">Up Next</p>
              <h2 className="m-0 mt-3 text-[17px] font-black leading-snug text-ink-strong dark:text-white">
                {continueTarget?.lesson?.lessonTitle || 'All available lessons are complete.'}
              </h2>
              <p className="m-0 mt-3 text-[15px] leading-6 text-ink-soft dark:text-slate-400">
                Next in Unit: <span className="text-ink-strong dark:text-slate-100">{activeUnitLabel}</span>
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
                  View Lesson
                </button>
              ) : null}
            </section>

            <section className={cx(surfaceCard, 'p-5')}>
              <h2 className="m-0 text-[18px] font-black uppercase text-ink-strong dark:text-white">Related Resources</h2>
              <div className="mt-5 grid gap-3">
                {[
                  [`${course.totalLessonsCount || 0} Lesson Documents`, 'Docs', '/ai-notes'],
                  [`${activeUnitLabel} Question Bank`, 'Q&A', '/quizzes'],
                  ['Practice Quiz: Key Concepts', 'Quiz', '/quizzes'],
                ].map(([label, meta, path]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => navigate(path)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line-medium bg-surface-1 px-4 text-left text-[14px] font-semibold text-ink-medium shadow-none transition-[background,border-color,color] duration-150 hover:border-brand-primary/24 hover:bg-[var(--color-primary-light)] hover:text-brand-primary dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-200 dark:hover:border-cyan-300/24 dark:hover:bg-cyan-300/8 dark:hover:text-slate-100"
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <span className="shrink-0 text-[11px] font-black uppercase text-ink-muted dark:text-slate-500">{meta}</span>
                  </button>
                ))}
              </div>
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
