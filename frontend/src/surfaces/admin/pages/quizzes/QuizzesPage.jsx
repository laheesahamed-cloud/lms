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
const overviewValue = 'text-[clamp(20px,2.2vw,26px)] leading-none text-ink-strong';
const overviewText = 'm-0 text-[12.5px] text-ink-soft';

function getStatusLabel(status) {
  return status === 'active' ? 'Active' : 'Draft';
}

function QuizTable({ title, subtitle, quizzes, loading, emptyLabel, onEdit, onView, onDelete, deletingId }) {
  return (
    <section className={cx(ui.panelCard, 'grid gap-3')}>
      <div className={ui.panelTop}>
        <div>
          <h2 className={ui.panelTitle}>{title}</h2>
          <p className={ui.panelText}>{subtitle}</p>
        </div>
      </div>

      <div className={ui.tableShell}>
        <table className={ui.modernTable}>
          <thead>
            <tr>
              <th className={ui.tableHeadCell}>Quiz</th>
              <th className={ui.tableHeadCell}>Course</th>
              <th className={ui.tableHeadCell}>Subject / Topic</th>
              <th className={ui.tableHeadCell}>Questions</th>
              <th className={ui.tableHeadCell}>Status</th>
              <th className={ui.tableHeadCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className={ui.tableEmpty}>Loading quizzes...</td>
              </tr>
            ) : null}
            {!loading && quizzes.length === 0 ? (
              <tr>
                <td colSpan="6" className={ui.tableEmpty}>{emptyLabel}</td>
              </tr>
            ) : null}
            {!loading && quizzes.map((quiz) => (
              <tr key={quiz.id}>
                <td className={ui.tableCell}>
                  <strong>{quiz.adminName || quiz.quizTitle}</strong>
                  <div className={ui.tableSubtext}>
                    {quiz.studentTitle || quiz.quizTitle}
                  </div>
                  {quiz.quizDescription ? <div className={ui.tableSubtext}>{quiz.quizDescription}</div> : null}
                </td>
                <td className={ui.tableCell}>{quiz.courseTitle || '-'}</td>
                <td className={ui.tableCell}>
                  {[quiz.isGeneral === 1 ? 'General / Full Course' : quiz.subjectName || '-', quiz.topicName || null, quiz.lessonTitle || null]
                    .filter(Boolean)
                    .join(' • ')}
                </td>
                <td className={ui.tableCell}>{quiz.totalQuestions}</td>
                <td className={ui.tableCell}>
                  <span className={statusPill(quiz.status)}>
                    {getStatusLabel(quiz.status)}
                  </span>
                </td>
                <td className={ui.tableCell}>
                  <div className={ui.iconRow}>
                    <button type="button" className="inline-flex min-h-8 items-center justify-center rounded-md border border-line-medium bg-surface-2 px-3 text-xs font-extrabold text-ink-medium transition hover:-translate-y-0.5 hover:text-ink-strong" onClick={() => onView(quiz.id)}>
                      View
                    </button>
                    <button className={ui.iconButton}
                      type="button"
                     
                      aria-label={`Edit quiz ${quiz.adminName || quiz.quizTitle}`}
                      title="Edit quiz"
                      onClick={() => onEdit(quiz.id)}
                    >
                      <EditActionIcon />
                    </button>
                    <button className={ui.dangerIconButton}
                      type="button"
                     
                      aria-label={`Delete quiz ${quiz.adminName || quiz.quizTitle}`}
                      title="Delete quiz"
                      onClick={() => onDelete(quiz)}
                      disabled={deletingId === quiz.id}
                    >
                      <DeleteActionIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      setError(getErrorMessage(loadError, 'Unable to load quiz metadata'));
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
      setError(getErrorMessage(loadError, 'Unable to load quizzes'));
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
      setSuccess('Quiz deleted successfully.');
      await loadQuizzes(filters);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete quiz'));
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
            <span className={overviewLabel}>Visible quizzes</span>
            <strong className={overviewValue}>{quizzes.length}</strong>
            <p className={overviewText}>All quizzes matching the current search and filters.</p>
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
              <h2>Quiz Library</h2>
              <p>Filter the assessment catalog, review status, and jump into the builder when needed.</p>
            </div>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="button" onClick={() => navigate('/quizzes/new')}>Create Quiz</button>
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

        <QuizTable
          title="Active Quizzes"
          subtitle="Active Quizzes"
          quizzes={activeQuizzes}
          loading={loading}
          emptyLabel="No active quizzes found."
          onEdit={(id) => navigate(`/quizzes/${id}/edit`)}
          onView={(id) => navigate(`/quizzes/${id}/edit`)}
          onDelete={handleDelete}
          deletingId={deletingId}
        />

        <QuizTable
          title="Draft Quizzes"
          subtitle="Draft Quizzes"
          quizzes={draftQuizzes}
          loading={loading}
          emptyLabel="No draft quizzes found."
          onEdit={(id) => navigate(`/quizzes/${id}/edit`)}
          onView={(id) => navigate(`/quizzes/${id}/edit`)}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      </section>
    </main>
  );
}
