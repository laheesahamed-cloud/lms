import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchStudentCourses } from '../../../../shared/api/courses.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { CourseDetailPage } from './CourseDetailPage.jsx';

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

function CourseSkeleton() {
  return (
    <article className="lms-quiz-card lms-quiz-course-card lms-card-skeleton grid min-h-[112px] gap-3.5 rounded-[var(--ds-card-radius)] border border-line-soft bg-surface-card p-4 shadow-[var(--ds-card-shadow)] dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.92)] max-[520px]:min-h-[100px] max-[520px]:rounded-[var(--ds-card-radius-compact)] max-[520px]:p-3.5">
      <div className="flex items-start gap-3">
        <div className={cx(ui.shimmer, 'size-10 rounded-xl')} />
        <div className="grid flex-1 gap-2 pt-0.5">
          <div className={cx(ui.shimmer, 'h-5 w-4/5 rounded-lg')} />
          <div className={cx(ui.shimmer, 'h-4 w-28 rounded-lg')} />
        </div>
      </div>
      <div className="grid gap-2">
        <div className={cx(ui.shimmer, 'h-4 w-full rounded-lg')} />
        <div className={cx(ui.shimmer, 'h-2 w-full rounded-full')} />
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
  const leftLabel = totalLessons ? `${remainingLessons} left` : 'No lessons yet';
  const metaLabel = `${totalLessons} lessons · ${completedLessons} done · ${leftLabel}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${course.courseTitle}`}
      className={cx(
        'lms-quiz-card lms-quiz-course-card student-course-card student-course-card--simple lms-card-clickable group grid min-h-[112px] gap-3.5 rounded-[var(--ds-card-radius)] border border-line-soft bg-surface-card p-4 text-left shadow-[var(--ds-card-shadow)] outline-none transition-[background,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/18 hover:bg-surface-2/35 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-primary/18 dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.92)] dark:hover:bg-white/[0.035] max-[520px]:min-h-[100px] max-[520px]:rounded-[var(--ds-card-radius-compact)] max-[520px]:p-3.5',
        `student-course-card--${visual.key}`
      )}
    >
      <div className="flex items-start gap-3">
        <span className="student-course-card__icon grid size-10 shrink-0 place-items-center rounded-xl">
          <BookIcon />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="lms-card-title line-clamp-2 dark:text-white max-[520px]:text-[14px]" title={course.courseTitle}>
            {course.courseTitle}
          </h2>
          <span className={cx('mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase', status.className)}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
          <span className="truncate text-ink-muted" title={metaLabel}>
            {metaLabel}
          </span>
          <span className={cx('font-extrabold', progress >= 100 ? 'text-brand-primary dark:text-sky-300' : 'text-ink-strong dark:text-white')}>
            {progress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.09]">
          <span
            className="student-course-card__progress-fill block h-full w-full origin-left rounded-full transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>
    </button>
  );
}

export function StudentCoursesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(() => location.state?.selectedCourseId || null);
  const [courseDetailCache, setCourseDetailCache] = useState({});

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

  useEffect(() => {
    setSelectedCourseId(location.state?.selectedCourseId || null);
  }, [location.state?.selectedCourseId]);

  const handleSelectCourse = useCallback((courseId) => {
    setSelectedCourseId(courseId);
    navigate('.', {
      state: {
        ...(location.state || {}),
        selectedCourseId: courseId,
      },
    });
  }, [location.state, navigate]);

  const handleBackToAllCourses = useCallback(() => {
    setSelectedCourseId(null);
    const nextState = { ...(location.state || {}) };
    delete nextState.selectedCourseId;
    navigate('.', { replace: true, state: nextState });
  }, [location.state, navigate]);

  const handleCourseDataChange = useCallback((courseId, data) => {
    setCourseDetailCache((current) => {
      if (current[courseId] === data) return current;
      return { ...current, [courseId]: data };
    });
  }, []);

  if (selectedCourseId) {
    return (
      <CourseDetailPage
        courseId={selectedCourseId}
        initialData={courseDetailCache[selectedCourseId] || null}
        onBack={handleBackToAllCourses}
        onDataChange={handleCourseDataChange}
      />
    );
  }

  return (
    <main className="dashboard-page study-hub-page student-courses-page">
      <section className="study-hub-shell">
        <AppHeader title="Courses" subtitle="Study Library" />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <span className={ui.eyebrow}>Available courses</span>
              <h2 className="m-0 text-[19px] font-black uppercase leading-tight text-ink-strong dark:text-white max-[520px]:text-[16px]">
                Choose a Course
              </h2>
            </div>

            {!loading ? (
              <span className="rounded-full border border-line-soft bg-surface-card px-3 py-1.5 text-[12px] font-extrabold text-ink-medium dark:border-white/10 dark:bg-white/[0.04]">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3 max-[520px]:grid-cols-1 max-[520px]:gap-2">
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
                    onOpen={() => handleSelectCourse(course.id)}
                  />
                ))
              : null}
          </div>
        </section>
      </section>
    </main>
  );
}
