import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchStudentCourses, fetchStudentCourseDetail, readStudentCoursesCache } from '../../../../shared/api/courses.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { CourseProgressCard } from '../../../../shared/ui/CourseProgressCard.jsx';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { CourseDetailPage } from './CourseDetailPage.jsx';

function getLessonCounts(course) {
  return { totalLessons: Number(course.totalLessonsCount || 0) };
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
  const { totalLessons } = getLessonCounts(course);

  return (
    <CourseProgressCard
      title={course.courseTitle}
      description={course.description}
      // Just the lesson count; the percentage beside it says how far along they are.
      meta={`${totalLessons} ${totalLessons === 1 ? 'lesson' : 'lessons'}`}
      progress={course.progressPercent}
      index={Number(course.id || 0)}
      onOpen={onOpen}
    />
  );
}

export function StudentCoursesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState(() => readStudentCoursesCache() || []);
  const [loading, setLoading] = useState(() => readStudentCoursesCache() === undefined);
  const [error, setError] = useState('');
  const [examTypeFilter, setExamTypeFilter] = useState('all');
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

  // Pre-warm each course's detail in the background (at idle), so opening any
  // course is instant — mirrors how the lesson list arrives fully pre-loaded.
  // Staggered + capped so it stays gentle on the API. fetchStudentCourseDetail
  // is cache-backed, so this never refetches a course already warm/fresh.
  useEffect(() => {
    if (!courses.length || typeof window === 'undefined') return undefined;
    let cancelled = false;
    const timers = [];
    const prefetch = () => {
      courses.slice(0, 8).forEach((course, index) => {
        const courseId = typeof course === 'object' && course ? course.id ?? course.courseId : course;
        if (!courseId) return;
        timers.push(window.setTimeout(() => {
          if (!cancelled) fetchStudentCourseDetail(courseId).catch(() => {});
        }, index * 500));
      });
    };
    let cancelIdle = () => {};
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(prefetch, { timeout: 1500 });
      cancelIdle = () => window.cancelIdleCallback(idleId);
    } else {
      const timer = window.setTimeout(prefetch, 600);
      cancelIdle = () => window.clearTimeout(timer);
    }
    return () => {
      cancelled = true;
      cancelIdle();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [courses]);

  useEffect(() => {
    setSelectedCourseId(location.state?.selectedCourseId || null);
  }, [location.state?.selectedCourseId]);

  const handleSelectCourse = useCallback((course) => {
    // Push to the real /courses/:courseId route (not an in-page state swap) so
    // the native push/pop slide + edge-swipe-back engage, the header shows the
    // course name, and the courses list is parked underneath for the gesture.
    // Carry the list's course summary in nav state so the detail header + hero
    // render instantly (no "Course" placeholder / skeleton flicker) while the
    // full detail loads.
    const courseId = typeof course === 'object' && course ? course.id ?? course.courseId : course;
    const courseSummary = typeof course === 'object' ? course : null;
    const base = location.pathname.startsWith('/app') ? '/app/courses' : '/courses';
    navigate(`${base}/${courseId}`, { state: { courseSummary } });
  }, [location.pathname, navigate]);

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

  const examTypes = useMemo(() => {
    const types = new Set(courses.map(c => c.examType).filter(Boolean));
    return [...types].sort();
  }, [courses]);

  const visibleCourses = useMemo(
    () => examTypeFilter === 'all' ? courses : courses.filter(c => c.examType === examTypeFilter),
    [courses, examTypeFilter],
  );

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

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

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
                {visibleCourses.length} {visibleCourses.length === 1 ? 'course' : 'courses'}
              </span>
            ) : null}
          </div>

          {!loading && examTypes.length > 0 ? (
            <div className="student-lessons-filter-bar">
              <button
                type="button"
                className={cx('student-lessons-filter-chip', examTypeFilter === 'all' && 'is-active')}
                onClick={() => setExamTypeFilter('all')}
              >
                All
              </button>
              {examTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={cx('student-lessons-filter-chip', examTypeFilter === type && 'is-active')}
                  onClick={() => setExamTypeFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 max-[520px]:grid-cols-1 max-[520px]:gap-2">
            {loading ? [1, 2, 3, 4, 5, 6].map((item) => <CourseSkeleton key={item} />) : null}

            {!loading && visibleCourses.length === 0 ? (
              <div className={cx(ui.emptyBox, 'col-span-full')}>
                No active courses are available yet.
              </div>
            ) : null}

            {!loading
              ? visibleCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => handleSelectCourse(course)}
                  />
                ))
              : null}
          </div>
        </section>
      </section>
    </main>
  );
}
