import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteQuiz, fetchQuizzes, fetchQuizzesMeta } from '../../../../shared/api/quizzes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const overviewGrid = 'grid grid-cols-3 gap-4 max-[900px]:grid-cols-1';
const overviewCard = cx(
  ui.panelCard,
  'grid gap-2 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.04)),var(--surface-1)] px-[18px] py-4'
);
const overviewLabel = 'text-[11px] font-bold uppercase tracking-[0.06em] text-ink-soft';
const overviewValue = 'text-[24px] max-[640px]:text-[20px] leading-none text-ink-strong';
const overviewText = 'm-0 text-[12.5px] text-ink-soft';

function getStatusLabel(status) {
  return status === 'active' ? 'Active' : 'Draft';
}

function getQuizTitle(quiz) {
  return quiz.adminName || quiz.quizTitle || quiz.studentTitle || `Assessment #${quiz.id}`;
}

function getQuizSubtitle(quiz) {
  return quiz.studentTitle && quiz.studentTitle !== getQuizTitle(quiz) ? quiz.studentTitle : quiz.quizDescription;
}

function getCourseLabel(quiz) {
  return quiz.courseTitle || 'General Library';
}

function getSubjectLabel(quiz) {
  if (quiz.isGeneral === 1) {
    return 'General / Full Course';
  }
  return quiz.subjectName || 'Unmapped Subject';
}

function getTopicLabel(quiz) {
  return quiz.topicName || quiz.lessonTitle || 'No lesson map link';
}

function buildQuizMap(quizzes) {
  const courseMap = new Map();

  quizzes.forEach((quiz) => {
    const courseKey = getCourseLabel(quiz);
    const subjectKey = getSubjectLabel(quiz);
    const topicKey = getTopicLabel(quiz);

    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        name: courseKey,
        total: 0,
        active: 0,
        draft: 0,
        subjects: new Map(),
      });
    }

    const course = courseMap.get(courseKey);
    course.total += 1;
    if (quiz.status === 'active') {
      course.active += 1;
    } else {
      course.draft += 1;
    }

    if (!course.subjects.has(subjectKey)) {
      course.subjects.set(subjectKey, {
        name: subjectKey,
        total: 0,
        topics: new Map(),
      });
    }

    const subject = course.subjects.get(subjectKey);
    subject.total += 1;

    if (!subject.topics.has(topicKey)) {
      subject.topics.set(topicKey, {
        name: topicKey,
        quizzes: [],
      });
    }

    subject.topics.get(topicKey).quizzes.push(quiz);
  });

  return Array.from(courseMap.values()).map((course) => ({
    ...course,
    subjects: Array.from(course.subjects.values()).map((subject) => ({
      ...subject,
      topics: Array.from(subject.topics.values()),
    })),
  }));
}

function QuizMapRow({ quiz, index, onEdit, onView, onDelete, deletingId }) {
  const title = getQuizTitle(quiz);
  const subtitle = getQuizSubtitle(quiz);

  return (
    <article className="relative pl-8 max-[640px]:pl-7">
      <span className={cx(
        'absolute left-[2px] top-1/2 z-[1] grid size-6 -translate-y-1/2 place-items-center rounded-full border text-[11px] font-black',
        quiz.status === 'active'
          ? 'border-emerald-400/35 bg-emerald-500 text-white'
          : 'border-amber-400/35 bg-amber-400 text-white'
      )}>
        {index + 1}
      </span>
      <div className="rounded-2xl border border-line-soft bg-surface-card px-3 py-2.5 transition hover:border-brand-primary/22 hover:bg-surface-2/50 dark:border-sky-300/12 dark:bg-white/[0.035] dark:hover:border-sky-400/18">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-[640px]:grid-cols-1">
          <button
            type="button"
            className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16"
            onClick={() => onView(quiz.id)}
          >
            <span className="grid size-[38px] place-items-center rounded-2xl border border-brand-primary/18 bg-brand-primary/8 text-[12px] font-black text-brand-primary dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
              Q
            </span>
            <span className="min-w-0">
              <span className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-5 items-center rounded px-1.5 text-[11px] font-black uppercase leading-none text-brand-primary bg-brand-primary/7 dark:bg-sky-400/10 dark:text-sky-300">
                  {Number(quiz.totalQuestions || 0)} Questions
                </span>
                <span className={statusPill(quiz.status)}>
                  {getStatusLabel(quiz.status)}
                </span>
                <span className="inline-flex h-5 items-center rounded px-1.5 text-[11px] font-black uppercase leading-none text-ink-soft bg-surface-2">
                  {quiz.randomizationMode === 'dynamic' ? 'Dynamic' : 'Static'}
                </span>
              </span>
              <strong className="block truncate text-[14px] font-extrabold leading-snug text-ink-strong dark:text-slate-100">{title}</strong>
              {subtitle ? (
                <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-ink-soft dark:text-slate-500">{subtitle}</span>
              ) : null}
            </span>
          </button>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-[640px]:justify-start max-[640px]:pl-[50px]">
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-full border border-line-medium bg-surface-2 px-3 text-xs font-extrabold text-ink-medium transition hover:-translate-y-0.5 hover:text-ink-strong" onClick={() => onView(quiz.id)}>
              View
            </button>
            <button className={ui.iconButton}
              type="button"
              aria-label={`Edit assessment ${title}`}
              title="Edit assessment"
              onClick={() => onEdit(quiz.id)}
            >
              <EditActionIcon />
            </button>
            <button className={ui.dangerIconButton}
              type="button"
              aria-label={`Delete assessment ${title}`}
              title="Delete assessment"
              onClick={() => onDelete(quiz)}
              disabled={deletingId === quiz.id}
            >
              <DeleteActionIcon />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuizMap({ quizzes, loading, onEdit, onView, onDelete, deletingId }) {
  const groupedCourses = useMemo(() => buildQuizMap(quizzes), [quizzes]);

  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={ui.panelTop}>
        <div>
          <h2 className={ui.panelTitle}>Assessment Map</h2>
          <p className={ui.panelText}>Assessments are grouped by course, subject, topic, and set.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-line-medium bg-surface-2/50 px-5 py-8 text-center text-sm font-bold text-ink-soft">
          Loading assessments...
        </div>
      ) : null}

      {!loading && groupedCourses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-medium bg-surface-2/50 px-5 py-8 text-center text-sm font-bold text-ink-soft">
          No assessments found for the selected filters.
        </div>
      ) : null}

      <div className="grid gap-4">
        {!loading && groupedCourses.map((course, courseIndex) => (
          <article key={course.name} className="lms-card overflow-hidden rounded-[var(--ds-card-radius)] border border-line-soft bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.03)),var(--surface-1)] shadow-[var(--ds-card-shadow)] dark:border-sky-300/12 dark:bg-white/[0.035]">
            <header className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft px-4 py-4 max-[720px]:grid-cols-[42px_minmax(0,1fr)] max-[720px]:[&>div:last-child]:col-span-2">
              <span className="grid size-12 place-items-center rounded-2xl border border-brand-primary/18 bg-brand-primary/10 text-sm font-black text-brand-primary dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200 max-[720px]:size-10">
                {courseIndex + 1}
              </span>
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-soft">Course</span>
                <h3 className="truncate text-[18px] font-black text-ink-strong dark:text-slate-100">{course.name}</h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-black uppercase tracking-[0.05em] text-ink-soft max-[720px]:justify-start">
                <span className="rounded-full border border-line-soft bg-surface-2 px-3 py-1">{course.total} assessments</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">{course.active} active</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-700 dark:text-amber-300">{course.draft} draft</span>
              </div>
            </header>

            <div className="grid gap-4 p-4">
              {course.subjects.map((subject) => (
                <section key={subject.name} className="rounded-[22px] border border-line-soft bg-surface-card p-4 dark:border-sky-300/10 dark:bg-white/[0.03]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-soft">Subject</span>
                      <h4 className="text-[15px] font-black text-ink-strong dark:text-slate-100">{subject.name}</h4>
                    </div>
                    <span className="rounded-full border border-line-soft bg-surface-2 px-3 py-1 text-[11px] font-black text-ink-soft">{subject.total} assessments</span>
                  </div>

                  <div className="grid gap-4">
                    {subject.topics.map((topic) => (
                      <div key={topic.name} className="relative">
                        <div className="mb-2 ml-8 flex items-center gap-2 max-[640px]:ml-7">
                          <span className="size-2 rounded-full bg-brand-primary/70" />
                          <span className="text-[12px] font-black uppercase tracking-[0.08em] text-ink-soft">{topic.name}</span>
                        </div>
                        <div className="relative grid gap-2 before:absolute before:left-[13px] before:top-0 before:h-full before:w-px before:bg-line-soft max-[640px]:before:left-[12px]">
                          {topic.quizzes.map((quiz, index) => (
                            <QuizMapRow
                              key={quiz.id}
                              quiz={quiz}
                              index={index}
                              onEdit={onEdit}
                              onView={onView}
                              onDelete={onDelete}
                              deletingId={deletingId}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function QuizzesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [filters, setFilters] = useState({ search: '', courseId: '', subjectId: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMeta();
    loadQuizzes();
  }, []);

  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => !filters.courseId || String(subject.courseId) === String(filters.courseId)),
    [subjects, filters.courseId]
  );

  const activeQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.status === 'active'),
    [quizzes]
  );

  const draftQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.status !== 'active'),
    [quizzes]
  );

  async function loadMeta() {
    try {
      const meta = await fetchQuizzesMeta();
      setCourses(meta.courses || []);
      setSubjects(meta.subjects || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load assessment metadata'));
    }
  }

  async function loadQuizzes(nextFilters = filters) {
    setLoading(true);
    try {
      const params = {};
      if (nextFilters.search.trim()) params.search = nextFilters.search.trim();
      if (nextFilters.courseId) params.courseId = nextFilters.courseId;
      if (nextFilters.subjectId) params.topicId = nextFilters.subjectId;
      if (nextFilters.status) params.status = nextFilters.status === 'draft' ? 'inactive' : nextFilters.status;
      const data = await fetchQuizzes(params);
      setQuizzes(data);
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load assessments'));
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (name === 'courseId') {
        next.subjectId = '';
      }
      return next;
    });
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadQuizzes(filters);
  }

  async function handleReset() {
    const nextFilters = { search: '', courseId: '', subjectId: '', status: '' };
    setFilters(nextFilters);
    await loadQuizzes(nextFilters);
  }

  async function handleDelete(quiz) {
      const confirmed = window.confirm(`Delete "${quiz.adminName || quiz.quizTitle}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(quiz.id);
    setError('');
    setSuccess('');

    try {
      await deleteQuiz(quiz.id);
      setSuccess('Assessment deleted successfully.');
      await loadQuizzes(filters);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete assessment'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Assessments"
          subtitle="Assessment Library"
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}

        <section className={overviewGrid}>
          <article className={overviewCard}>
            <span className={overviewLabel}>Visible assessments</span>
            <strong className={overviewValue}>{quizzes.length}</strong>
            <p className={overviewText}>All assessments matching the current search and filters.</p>
          </article>
          <article className={overviewCard}>
            <span className={overviewLabel}>Active</span>
            <strong className={overviewValue}>{activeQuizzes.length}</strong>
            <p className={overviewText}>Published assessments students can access right now.</p>
          </article>
          <article className={overviewCard}>
            <span className={overviewLabel}>Drafts</span>
            <strong className={overviewValue}>{draftQuizzes.length}</strong>
            <p className={overviewText}>Works in progress waiting for review or activation.</p>
          </article>
        </section>

        <section className={cx(ui.panelCard, 'grid gap-[18px]')}>
          <div className={ui.panelTop}>
            <div>
              <h2>Assessment Library</h2>
              <p>Filter the catalog, review status, and jump into the builder when needed.</p>
            </div>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="button" onClick={() => navigate('/quizzes/new')}>Create Assessment</button>
            </div>
          </div>

          <form className={ui.quizListFilters} onSubmit={handleFilterSubmit}>
            <label className={ui.formLabel}>
              Search
              <input className={ui.input} name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search admin or student title" />
            </label>
            <label className={ui.formLabel}>
              Course
              <select className={ui.input} name="courseId" value={filters.courseId} onChange={handleFilterChange}>
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.courseTitle}</option>
                ))}
              </select>
            </label>
            <label className={ui.formLabel}>
              Subject
              <select className={ui.input} name="subjectId" value={filters.subjectId} onChange={handleFilterChange}>
                <option value="">All subjects</option>
                {visibleSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                ))}
              </select>
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input} name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit">Apply Filters</button>
              <button type="button" className={ui.secondaryAction} onClick={handleReset}>Reset</button>
            </div>
          </form>
        </section>

        <QuizMap
          quizzes={quizzes}
          loading={loading}
          onEdit={(id) => navigate(`/quizzes/${id}/edit`)}
          onView={(id) => navigate(`/quizzes/${id}/edit`)}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      </section>
    </main>
  );
}
