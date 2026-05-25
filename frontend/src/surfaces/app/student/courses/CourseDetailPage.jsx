import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudentCourseDetail,
  updateStudentLessonProgress,
} from '../../../../shared/api/courses.api.js';
import { getLessonAiNote, listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const subtleButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line-medium bg-surface-2 px-4 text-[13px] font-semibold text-ink-medium transition-[background,border-color,color] duration-150 hover:border-brand-primary/26 hover:bg-[var(--color-primary-light)] hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-sky-400/28 dark:hover:bg-sky-400/12 dark:hover:text-white';
const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand-primary/24 bg-[var(--color-primary-light)] px-4 text-[13px] font-semibold text-brand-primary transition-[background,border-color,color,opacity] duration-150 hover:border-brand-primary/36 hover:bg-brand-primary/14 disabled:cursor-not-allowed disabled:opacity-55 dark:border-sky-300/24 dark:bg-sky-400/12 dark:text-sky-200 dark:hover:bg-sky-400/18';
const surfaceCard = 'lms-app-card rounded-2xl border border-line-soft bg-surface-card shadow-sm';

const COURSE_SUBJECT_PALETTES = [
  { key: 'rose', group: 'warm', match: /(cardio|heart|coronar|arrhythm|myocard)/i, rgb: '214, 91, 145', bg: 'rgba(253, 242, 248, 0.86)', soft: 'rgba(214, 91, 145, 0.13)', border: 'rgba(214, 91, 145, 0.25)', text: '#d65b91' },
  { key: 'teal', group: 'cool', match: /(ha?emat|blood|transfusion|anaemia|anemia)/i, rgb: '43, 169, 155', bg: 'rgba(240, 253, 250, 0.86)', soft: 'rgba(43, 169, 155, 0.13)', border: 'rgba(43, 169, 155, 0.25)', text: '#2ba99b' },
  { key: 'sky', group: 'cool', match: /(resp|lung|pulmo|asthma|copd)/i, rgb: '58, 159, 205', bg: 'rgba(240, 249, 255, 0.86)', soft: 'rgba(58, 159, 205, 0.13)', border: 'rgba(58, 159, 205, 0.25)', text: '#3a9fcd' },
  { key: 'violet', group: 'violet', match: /(neuro|brain|stroke|seizure|parkinson)/i, rgb: '139, 107, 217', bg: 'rgba(245, 243, 255, 0.86)', soft: 'rgba(139, 107, 217, 0.13)', border: 'rgba(139, 107, 217, 0.25)', text: '#8b6bd9' },
  { key: 'green', group: 'green', match: /(rheum|joint|arthritis|ortho|anatomy|bone)/i, rgb: '53, 168, 107', bg: 'rgba(240, 253, 244, 0.86)', soft: 'rgba(53, 168, 107, 0.13)', border: 'rgba(53, 168, 107, 0.25)', text: '#35a86b' },
  { key: 'amber', group: 'warm', match: /(endocr|diabet|thyroid|micro|infect|physio)/i, rgb: '201, 151, 52', bg: 'rgba(254, 252, 232, 0.88)', soft: 'rgba(201, 151, 52, 0.14)', border: 'rgba(201, 151, 52, 0.25)', text: '#c99734' },
  { key: 'indigo', group: 'violet', match: /(renal|kidney|nephro|uro)/i, rgb: '102, 119, 216', bg: 'rgba(238, 242, 255, 0.88)', soft: 'rgba(102, 119, 216, 0.13)', border: 'rgba(102, 119, 216, 0.25)', text: '#6677d8' },
  { key: 'orange', group: 'warm', match: /(surg|path|trauma|emergency)/i, rgb: '207, 125, 60', bg: 'rgba(255, 247, 237, 0.9)', soft: 'rgba(207, 125, 60, 0.14)', border: 'rgba(207, 125, 60, 0.25)', text: '#cf7d3c' },
];

function hashSubjectPalette(label) {
  return [...String(label || 'subject')].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function getBaseSubjectPalette(label) {
  const text = String(label || '');
  return COURSE_SUBJECT_PALETTES.find((palette) => palette.match?.test(text)) ||
    COURSE_SUBJECT_PALETTES[Math.abs(hashSubjectPalette(text)) % COURSE_SUBJECT_PALETTES.length];
}

function buildSubjectPaletteMap(subjects) {
  const assigned = new Map();
  let previousGroup = '';
  let previousKey = '';

  subjects.forEach((subject, index) => {
    let palette = getBaseSubjectPalette(subject.subjectName);
    if ((palette.group === previousGroup || palette.key === previousKey) && COURSE_SUBJECT_PALETTES.length > 1) {
      const start = Math.abs(hashSubjectPalette(`${subject.subjectName}-${index}`)) % COURSE_SUBJECT_PALETTES.length;
      for (let offset = 0; offset < COURSE_SUBJECT_PALETTES.length; offset += 1) {
        const next = COURSE_SUBJECT_PALETTES[(start + offset) % COURSE_SUBJECT_PALETTES.length];
        if (next.group !== previousGroup && next.key !== previousKey) {
          palette = next;
          break;
        }
      }
    }
    assigned.set(subject.id, palette);
    previousGroup = palette.group;
    previousKey = palette.key;
  });

  return assigned;
}

function subjectAccentStyle(palette) {
  return {
    '--course-map-accent-rgb': palette.rgb,
    '--course-map-accent': palette.text,
    '--course-map-accent-bg': palette.bg,
    '--course-map-accent-soft': palette.soft,
    '--course-map-accent-border': palette.border,
  };
}

function LessonGlyph({ lesson }) {
  if (lesson.accessLocked) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M6.5 8V6.6a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="4.5" y="8" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (lesson.status === 'completed') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (lesson.status === 'in_progress') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h4l2-5 3 10 2-5h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 4.5h8M7 4.5v4.2a4 4 0 1 0 6 0V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function getLessonActionLabel(lesson) {
  if (lesson.accessLocked) return 'View Plans';
  if (lesson.status === 'completed') return 'Review';
  if (lesson.status === 'in_progress') return 'Continue';
  return lesson.actionLabel || 'Start';
}

function getLessonStateLabel(lesson) {
  if (lesson.accessLocked) return 'Locked';
  if (lesson.status === 'completed') return 'Completed';
  if (lesson.status === 'in_progress') return 'Current';
  return 'Available';
}

function getLessonProgressValue(lesson) {
  if (lesson.accessLocked) return 0;
  if (lesson.status === 'completed') return 100;
  return clampPercent(lesson.progressPercent);
}

function getLessonMetaItems(lesson) {
  const items = [];
  const progress = getLessonProgressValue(lesson);

  if (lesson.accessLocked) {
    items.push(lesson.accessMessage || 'Included with selected plans');
  } else if (lesson.status === 'completed') {
    items.push('Ready to review');
  } else if (progress > 0) {
    items.push(`${progress}% complete`);
  } else {
    items.push(lesson.duration || '~15 min');
  }

  if (lesson.lessonType) items.push(lesson.lessonType);
  if (lesson.isFree) items.push('Free access');

  return items.slice(0, 2);
}

export function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyLessonId, setBusyLessonId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetchStudentCourseDetail(courseId);

        if (cancelled) return;
        setData(response);
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
  const subjectPalettes = useMemo(() => buildSubjectPaletteMap(subjects), [subjects]);

  const overviewStats = useMemo(() => {
    if (!course) return [];
    return [
      { label: 'Subjects', value: course.totalSubjectsCount ?? subjects.length, icon: 'subject' },
      { label: 'Lessons', value: course.totalLessonsCount ?? 0, icon: 'lesson' },
      { label: 'Study Time', value: estimateStudyTime(course), icon: 'time' },
    ];
  }, [course, subjects.length]);

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

  if (loading) {
    return (
      <main className="dashboard-page study-hub-page student-course-detail-page min-h-dvh bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white">
        <section className="study-hub-shell max-w-[1180px]">
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
      <main className="dashboard-page study-hub-page student-course-detail-page min-h-dvh bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white">
        <section className="study-hub-shell max-w-[1180px]">
          <div className={cx(surfaceCard, 'p-6 text-[14px] text-ink-soft dark:text-slate-300')}>Course details are unavailable.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page study-hub-page lms-course-detail-page lms-course-map-page relative min-h-dvh overflow-hidden bg-surface-0 text-ink-strong dark:bg-[#020305] dark:text-white">
      <section className="study-hub-shell relative gap-5">
        {error ? (
          <div className="rounded-2xl border border-brand-error/20 bg-brand-error/8 px-4 py-3 text-[14px] font-semibold text-brand-error dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <section className="lms-course-detail-hero lms-page-header-card course-map-hero">
          <div className="course-map-hero__top">
            <button type="button" className={subtleButton} onClick={() => navigate('/courses')}>
              Back to Courses
            </button>
            {continueTarget ? (
              <button
                type="button"
                className={primaryButton}
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
                {continueTarget.lesson.status === 'in_progress' ? 'Continue Lesson' : 'Start Next Lesson'}
              </button>
            ) : null}
          </div>

          <div className="course-map-hero__body course-map-hero__body--simple">
            <div className="course-map-hero__copy">
              <span className="course-map-eyebrow">Lesson Map</span>
              <h1>{course.courseTitle}</h1>
              <p>
                Follow each subject, scan lesson progress, and continue from the next open lesson.
              </p>
            </div>

            <div className="course-map-progress" aria-label={`${clampPercent(course.progressPercent)} percent complete`}>
              <strong>{clampPercent(course.progressPercent)}%</strong>
              <span>Complete</span>
              <ProgressBar value={course.progressPercent} className="h-2" />
            </div>
          </div>

          <div className="course-map-stats" aria-label="Course overview">
            {overviewStats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

        </section>

        <section className="course-map-shell" aria-label="Course lesson map">
          <div className="course-map-shell__head">
            <div>
              <span className="course-map-eyebrow">Learning Path</span>
              <h2>Lesson Map</h2>
              <p>Follow the lessons in order and unlock your progress.</p>
            </div>
            <span className="course-map-count">{course.completedLessonsCount || 0} / {course.totalLessonsCount || 0} done</span>
          </div>

          <div className="course-map-units">
            {subjects.map((subject, subjectIndex) => (
              <article
                className="course-map-unit course-map-unit--simple"
                key={subject.id}
                style={subjectAccentStyle(subjectPalettes.get(subject.id) || COURSE_SUBJECT_PALETTES[0])}
              >
                <header className="course-map-unit__head">
                  <div className="course-map-unit__title">
                    <span>{subjectIndex + 1}</span>
                    <div>
                      <h3>{subject.subjectName}</h3>
                      <p>{subject.totalTopicsCount || subject.topics.length} topics · {subject.totalLessonsCount || 0} lessons</p>
                    </div>
                  </div>
                  <div className="course-map-unit__progress">
                    <span className={cx('course-map-status', statusTone(subject.status))}>{formatStatus(subject.status)}</span>
                    <strong>{subject.progressPercent}%</strong>
                    <ProgressBar value={subject.progressPercent} />
                  </div>
                </header>

                <div className="course-map-topics">
                  {subject.topics.map((topic, topicIndex) => {
                    const topicDone = topic.totalLessonsCount > 0 && topic.completedLessonsCount === topic.totalLessonsCount;

                    return (
                      <section className="course-map-topic" key={`${subject.id}:${topic.id}`}>
                        <header className="course-map-topic__head">
                          <div>
                            <span>{subjectIndex + 1}.{topicIndex + 1}</span>
                            <h4>{topic.topicName}</h4>
                          </div>
                          <div>
                            <span className={cx('course-map-status', statusTone(topic.status))}>{topicDone ? 'Done' : formatStatus(topic.status)}</span>
                            <small>{topic.completedLessonsCount || 0}/{topic.totalLessonsCount || 0} lessons</small>
                          </div>
                        </header>

                        <div className="course-map-lessons">
                          {topic.lessons.map((lesson, lessonIndex) => {
                            const lessonContext = {
                              ...lesson,
                              subjectId: subject.id,
                              topicId: topic.id,
                              subjectName: subject.subjectName,
                              topicName: topic.topicName,
                            };
                            const stateLabel = getLessonStateLabel(lesson);
                            const lessonProgress = getLessonProgressValue(lesson);
                            const lessonMetaItems = getLessonMetaItems(lesson);

                            return (
                              <div
                                className={cx(
                                  'course-map-lesson-row',
                                  lesson.status === 'completed' && 'is-done',
                                  lesson.status === 'in_progress' && 'is-active',
                                  !lesson.accessLocked && lesson.status === 'not_started' && 'is-available',
                                  lesson.accessLocked && 'is-locked'
                                )}
                                key={lesson.id}
                                style={{ '--course-map-lesson-delay': `${Math.min(lessonIndex, 8) * 90}ms` }}
                              >
                                <button
                                  type="button"
                                  className="course-map-lesson-title"
                                  onClick={() => handleOpenLesson(lessonContext)}
                                  disabled={busyLessonId === lesson.id}
                                >
                                  <span className="course-map-lesson-order">{subjectIndex + 1}.{topicIndex + 1}.{lessonIndex + 1}</span>
                                  <span className="course-map-lesson-glyph">
                                    <LessonGlyph lesson={lesson} />
                                  </span>
                                  <span className="course-map-lesson-copy">
                                    <strong>{lesson.lessonTitle}</strong>
                                    <span className="course-map-lesson-meta">
                                      {lessonMetaItems.map((item) => (
                                        <em key={item}>{item}</em>
                                      ))}
                                    </span>
                                  </span>
                                </button>

                                <span className={cx('course-map-status', statusTone(lesson.status))}>{stateLabel}</span>

                                <button
                                  type="button"
                                  className="course-map-lesson-action"
                                  onClick={() => handleOpenLesson(lessonContext)}
                                  disabled={busyLessonId === lesson.id}
                                  title={lesson.accessLocked ? lesson.accessMessage || 'Included with selected plans' : undefined}
                                >
                                  {busyLessonId === lesson.id ? 'Opening...' : getLessonActionLabel(lesson)}
                                </button>

                                <div className="course-map-lesson-progress" aria-label={`${lessonProgress} percent complete`}>
                                  <span style={{ width: `${lessonProgress}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
