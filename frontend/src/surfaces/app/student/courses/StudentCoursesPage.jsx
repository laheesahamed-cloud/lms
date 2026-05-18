import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentCourses } from '../../../../shared/api/courses.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

function BookIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4.75C5 3.78 5.78 3 6.75 3H19v16.5H7.25A2.25 2.25 0 0 0 5 21.75v-17Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.75A2.25 2.25 0 0 1 7.25 16.5H19M8.5 7.5h6.5M8.5 10.75h4.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const courseVisualPresets = [
  {
    key: 'cardio',
    label: 'Clinical rhythm',
    keywords: ['cardio', 'heart', 'ecg', 'physiology', 'circulation'],
  },
  {
    key: 'pharma',
    label: 'Therapy logic',
    keywords: ['pharma', 'drug', 'medicine', 'therapy', 'prescription'],
  },
  {
    key: 'micro',
    label: 'Pattern recall',
    keywords: ['micro', 'infection', 'pathogen', 'immunology', 'biology'],
  },
  {
    key: 'anatomy',
    label: 'Body systems',
    keywords: ['anatomy', 'body', 'organ', 'clinical', 'surgery'],
  },
  {
    key: 'default',
    label: 'Study pathway',
    keywords: [],
  },
];

function getCourseVisual(course, index = 0) {
  const haystack = `${course.courseTitle || ''} ${course.description || ''}`.toLowerCase();
  const matched = courseVisualPresets.find((preset) =>
    preset.key !== 'default' && preset.keywords.some((keyword) => haystack.includes(keyword))
  );

  return matched || courseVisualPresets[index % courseVisualPresets.length] || courseVisualPresets[courseVisualPresets.length - 1];
}

function MedicalCourseArtwork({ variant = 'default', className = '' }) {
  return (
    <svg
      className={cx('medical-course-art', `medical-course-art--${variant}`, className)}
      viewBox="0 0 180 132"
      fill="none"
      aria-hidden="true"
    >
      <path className="medical-course-art__grid" d="M18 32h144M18 58h144M18 84h144M38 18v96M74 18v96M110 18v96M146 18v96" />
      <rect className="medical-course-art__sheet" x="28" y="26" width="74" height="76" rx="16" />
      <path className="medical-course-art__sheet-line" d="M44 49h34M44 65h45M44 81h27" />
      <path className="medical-course-art__pulse" d="M88 70h17l8-18 13 35 9-17h28" />
      <path className="medical-course-art__tube" d="M117 36c0 19 24 19 24 0M117 36v-8M141 36v-8" />
      <circle className="medical-course-art__tube-end" cx="129" cy="80" r="13" />
      <path className="medical-course-art__tube-line" d="M129 67V55" />
      <g className="medical-course-art__molecule">
        <circle cx="132" cy="104" r="5" />
        <circle cx="150" cy="94" r="4" />
        <circle cx="155" cy="112" r="4" />
        <path d="M136 102l10-6M136 106l15 5" />
      </g>
    </svg>
  );
}

function clampPercent(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function getCourseStatus(progress) {
  if (progress >= 100) {
    return {
      label: 'Completed',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    };
  }

  if (progress > 0) {
    return {
      label: 'In progress',
      className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200',
    };
  }

  return {
    label: 'Ready',
    className: 'border-line-soft bg-surface-2 text-ink-medium dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70',
  };
}

function getLessonCounts(course) {
  const totalLessons = Number(course.totalLessonsCount || 0);
  const completedLessons = Number(course.completedLessonsCount || 0);

  return {
    totalLessons,
    completedLessons,
    remainingLessons: Math.max(0, totalLessons - completedLessons),
  };
}

function CourseMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-0 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
      <strong className="block text-[22px] font-extrabold leading-none text-ink-strong">{value}</strong>
      <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</span>
    </div>
  );
}

function CourseSkeleton() {
  return (
    <article className="lms-app-card grid min-h-[246px] gap-5 rounded-2xl border border-line-soft bg-surface-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className={cx(ui.shimmer, 'size-12 rounded-2xl')} />
        <div className={cx(ui.shimmer, 'h-7 w-24 rounded-full')} />
      </div>
      <div className="grid gap-2">
        <div className={cx(ui.shimmer, 'h-6 w-4/5 rounded-lg')} />
        <div className={cx(ui.shimmer, 'h-4 w-full rounded-lg')} />
        <div className={cx(ui.shimmer, 'h-4 w-2/3 rounded-lg')} />
      </div>
      <div className="grid gap-2">
        <div className={cx(ui.shimmer, 'h-3 w-full rounded-full')} />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className={cx(ui.shimmer, 'h-16 rounded-2xl')} />
          ))}
        </div>
      </div>
    </article>
  );
}

function CourseCard({ course, onOpen }) {
  const progress = clampPercent(course.progressPercent);
  const status = getCourseStatus(progress);
  const { totalLessons, completedLessons, remainingLessons } = getLessonCounts(course);
  const subjects = Number(course.subjectCount || 0);
  const visual = getCourseVisual(course, Number(course.id || 0));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${course.courseTitle}`}
      className={cx(
        'lms-app-card student-course-card group grid text-left outline-none transition-[transform,border-color,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-brand-primary/20',
        `student-course-card--${visual.key}`
      )}
    >
      <div className="student-course-card__media">
        <div className="student-course-card__media-copy">
          <span>{visual.label}</span>
          <strong>{progress}% pathway</strong>
        </div>
        <MedicalCourseArtwork variant={visual.key} className="student-course-card__art" />
      </div>

      <div className="student-course-card__body">
        <div className="flex items-start justify-between gap-4">
          <span className="student-course-card__icon">
            <BookIcon />
          </span>
          <span className={cx('rounded-full border px-3 py-1 text-[11px] font-extrabold', status.className)}>
            {status.label}
          </span>
        </div>

        <div className="grid gap-2">
          <h2 className="m-0 line-clamp-2 text-[17px] font-extrabold leading-snug text-ink-strong">
            {course.courseTitle}
          </h2>
          <p className="m-0 line-clamp-2 text-[13px] font-semibold leading-relaxed text-ink-soft">
            {course.description || 'Open the course to continue lessons, subjects, and practice.'}
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-[12px] font-bold">
            <span className="text-ink-medium">Progress</span>
            <strong className="text-ink-strong">{progress}%</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.08]">
            <span
              className="student-course-card__progress-fill block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <CourseMetric label="Subjects" value={subjects} />
          <CourseMetric label="Done" value={completedLessons} />
          <CourseMetric label="Left" value={remainingLessons || totalLessons} />
        </div>

        <div className="student-course-card__cta mt-auto flex min-h-11 items-center justify-between px-4 text-[13px] font-extrabold transition-colors duration-150">
          <span>{progress > 0 ? 'Continue course' : 'Start course'}</span>
          <ArrowIcon />
        </div>
      </div>
    </button>
  );
}

export function StudentCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        const data = await fetchStudentCourses();
        if (!cancelled) setCourses(data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to load courses'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const completed = courses.filter((course) => clampPercent(course.progressPercent) >= 100).length;
    const inProgress = courses.filter((course) => {
      const progress = clampPercent(course.progressPercent);
      return progress > 0 && progress < 100;
    }).length;

    return {
      total: courses.length,
      inProgress,
      completed,
    };
  }, [courses]);

  return (
    <main className={ui.studentScreenShell}>
      <section className={ui.studentManagementLayout}>
        <AppHeader title="Courses" subtitle="Study Library" />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section className="student-courses-hero lms-app-card">
          <div className="student-courses-hero__copy">
            <div className="grid max-w-3xl gap-2">
              <span className={ui.eyebrow}>Study library</span>
              <h1 className="m-0 font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[0.98] text-ink-strong">
                Courses
              </h1>
              <p className="m-0 text-sm font-semibold leading-relaxed text-ink-soft">
                Pick up where you left off, scan every learning track, and move from concepts to clinical recall with less friction.
              </p>
            </div>

            <div className="student-courses-hero__chips" aria-label="Course study cues">
              <span>Clinical map</span>
              <span>SBA ready</span>
              <span>Learn first</span>
            </div>
          </div>

          <div className="student-courses-hero__visual">
            <MedicalCourseArtwork variant="library" />
            <div>
              <span>Medicine desk</span>
              <strong>Review. Practice. Repeat.</strong>
            </div>
          </div>

          <div className="student-courses-hero__metrics">
            <CourseMetric label="Active courses" value={loading ? '-' : stats.total} />
            <CourseMetric label="In progress" value={loading ? '-' : stats.inProgress} />
            <CourseMetric label="Completed" value={loading ? '-' : stats.completed} />
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <span className={ui.eyebrow}>Available courses</span>
              <h2 className="m-0 text-[22px] font-extrabold leading-tight text-ink-strong">
                Your learning tracks
              </h2>
            </div>

            {!loading ? (
              <span className="rounded-full border border-line-soft bg-surface-card px-3 py-1.5 text-[12px] font-extrabold text-ink-medium dark:border-white/10 dark:bg-white/[0.04]">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,286px),1fr))] gap-4">
            {loading ? [1, 2, 3, 4, 5, 6].map((item) => <CourseSkeleton key={item} />) : null}

            {!loading && courses.length === 0 ? (
              <div className={cx(ui.emptyBox, 'col-span-full')}>
                No active courses are available yet.
              </div>
            ) : null}

            {!loading
              ? courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => navigate(`/courses/${course.id}`)}
                  />
                ))
              : null}
          </div>
        </section>
      </section>
    </main>
  );
}
