import { useEffect, useMemo, useState } from 'react';
import { fetchAdminReports } from '../../../../shared/api/workspace.api.js';
import { fetchCourses } from '../../../../shared/api/courses.api.js';
import { fetchUsers } from '../../../../shared/api/users.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../../../../shared/utils/userIdentity.js';

const emptyFilters = {
  startDate: '',
  endDate: '',
  courseId: '',
  userId: '',
};

const reportUi = {
  panel: ui.panelCard,
  panelTitle: 'm-0 text-[17px] font-extrabold text-ink-strong',
  panelText: 'm-0 text-[13px] leading-relaxed text-ink-soft',
  metric: cx(ui.metricCard, ui.metricCardPremium, 'min-h-[128px]'),
  list: 'flex flex-col gap-2',
  row:
    'flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-left dark:border-white/10 dark:bg-white/[0.03]',
  rowMain: 'min-w-0 [&_strong]:block [&_strong]:text-[13.5px] [&_strong]:font-bold [&_strong]:text-ink-strong [&_span]:block [&_span]:text-xs [&_span]:text-ink-soft',
  rowStat: 'shrink-0 text-right [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:block [&_span]:text-[11px] [&_span]:text-ink-soft',
  progressTrack: 'mt-2 h-2 overflow-hidden rounded-full bg-surface-3',
  progressFill: 'block h-full rounded-full bg-[var(--brand-gradient-primary)]',
  heatmap: 'grid grid-cols-10 gap-1.5 max-[640px]:grid-cols-6',
  heatCell:
    'min-h-[56px] rounded-md border border-line-soft bg-surface-2 p-1.5 text-[11px] leading-tight text-ink-muted dark:border-white/10',
  filterGrid: 'grid gap-3 min-[760px]:grid-cols-4',
};

function Metric({ label, value, hint }) {
  return (
    <article className={reportUi.metric}>
      <span className={ui.eyebrow}>{label}</span>
      <strong className="mt-2 block text-[30px] max-[640px]:text-[24px] font-extrabold leading-none text-ink-strong">{value}</strong>
      <p className="m-0 mt-2 text-[12.5px] text-ink-soft">{hint}</p>
    </article>
  );
}

function ProgressBar({ value }) {
  const width = Math.max(3, Math.min(100, Number(value || 0)));
  return (
    <div className={reportUi.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
      <span className={reportUi.progressFill} style={{ width: `${width}%` }} />
    </div>
  );
}

function PanelHeader({ title, text }) {
  return (
    <div className={ui.panelTop}>
      <div>
        <h2 className={reportUi.panelTitle}>{title}</h2>
        <p className={reportUi.panelText}>{text}</p>
      </div>
    </div>
  );
}

function cleanFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => String(value || '').trim() !== ''));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildReportCsvRows(data, filters, selectedCourse, selectedStudent) {
  const rows = [
    ['xyndrome Reports Export'],
    ['Generated At', new Date().toISOString()],
    ['Start Date', filters.startDate || 'All'],
    ['End Date', filters.endDate || 'All'],
    ['Course', selectedCourse?.courseTitle || 'All'],
    ['Student', selectedStudent ? getAdminUserIdentifier(selectedStudent) : 'All'],
    [],
    ['Section', 'Metric', 'Value', 'Notes'],
    ['Summary', 'Students', data.users.students, `${data.users.pending} pending or inactive accounts`],
    ['Summary', 'Average Score', `${data.attempts.averageScore}%`, `${data.attempts.total} submitted attempts`],
    ['Summary', 'Pass Rate', `${data.attempts.passRate}%`, 'Across filtered submitted quizzes'],
    ['Summary', 'Lesson Records', data.lessons.tracked, `${data.lessons.completed} completed`],
    [],
    ['Activity Date', 'Active Students', 'Quiz Attempts', 'Study Events'],
    ...(data.activityHeatmap || []).map((day) => [day.date, day.activeStudents, day.quizAttempts, day.studyEvents]),
    [],
    ['Quiz', 'Course', 'Attempts', 'Passes', 'Fails', 'Pass Rate', 'Average Percentage'],
    ...(data.quizPerformance || []).map((quiz) => [quiz.quizTitle, quiz.courseTitle || 'General', quiz.attempts, quiz.passes, quiz.fails, `${quiz.passRate}%`, `${quiz.averagePercentage}%`]),
    [],
    ['Course', 'Total Lessons', 'Students Started', 'Completed Lessons', 'Average Progress'],
    ...(data.courseFunnel || []).map((course) => [course.courseTitle, course.totalLessons, course.studentsStarted, course.completedLessons, `${course.averageProgress}%`]),
    [],
    ['Question ID', 'Question Text', 'Wrong Count'],
    ...(data.hardQuestions || []).map((question) => [question.id, question.text, question.wrongCount]),
    [],
    ['Subscription Status', 'Count'],
    ...((data.subscriptions?.byStatus || []).map((item) => [item.status, item.count])),
    [],
    ['Payment Status', 'Count', 'Amount (LKR)'],
    ...((data.subscriptions?.payments || []).map((item) => [item.status, item.count, Number(item.amount || 0).toFixed(2)])),
    [],
    ['Inactive Student Email', 'Student Name', 'Last Activity'],
    ...(data.inactiveStudents || []).map((student) => [getAdminUserIdentifier(student), getAdminUserSecondaryIdentifier(student), student.lastActivity || 'Never']),
  ];
  return rows;
}

export function AdminReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAdminReports(cleanFilters(appliedFilters))
      .then((reports) => {
        if (!cancelled) setData(reports);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load reports right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCourses().catch(() => []),
      fetchUsers({ role: 'student' }).catch(() => []),
    ]).then(([courseRows, studentRows]) => {
      if (cancelled) return;
      setCourses(courseRows);
      setStudents(studentRows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const paymentTotal = useMemo(
    () => (data?.subscriptions?.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [data]
  );
  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(appliedFilters.courseId)),
    [appliedFilters.courseId, courses]
  );
  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === String(appliedFilters.userId)),
    [appliedFilters.userId, students]
  );

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function handleResetFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  function handleExportCsv() {
    if (!data) return;
    const dateLabel = appliedFilters.startDate || appliedFilters.endDate
      ? `${appliedFilters.startDate || 'start'}-${appliedFilters.endDate || 'end'}`
      : 'all';
    downloadCsv(`lms-reports-${dateLabel}.csv`, buildReportCsvRows(data, appliedFilters, selectedCourse, selectedStudent));
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title="Reports" subtitle="Learning Signals" />

        <section className={reportUi.panel}>
          <form className={ui.stackForm} onSubmit={handleFilterSubmit}>
            <div className={ui.panelTop}>
              <div>
                <h2>Report filters</h2>
                <p>Filter analytics by date range, course, or one student before exporting.</p>
              </div>
              <div className={ui.buttonRow}>
                <button type="button" className={ui.secondaryAction} onClick={handleResetFilters}>Reset</button>
                <button type="button" className={ui.secondaryAction} onClick={handleExportCsv} disabled={!data || loading}>Export CSV</button>
                <button className={ui.primaryAction} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</button>
              </div>
            </div>
            <div className={reportUi.filterGrid}>
              <label className={ui.formLabel}>
                Start date
                <input className={ui.input} type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
              </label>
              <label className={ui.formLabel}>
                End date
                <input className={ui.input} type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
              </label>
              <label className={ui.formLabel}>
                Course
                <select className={ui.input} name="courseId" value={filters.courseId} onChange={handleFilterChange}>
                  <option value="">All courses</option>
                  {courses.map((course) => (
                    <option value={course.id} key={course.id}>{course.courseTitle}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Student
                <select className={ui.input} name="userId" value={filters.userId} onChange={handleFilterChange}>
                    <option value="">All students</option>
                    {students.map((student) => (
                      <option value={student.id} key={student.id}>{getAdminUserIdentifier(student)}</option>
                    ))}
                </select>
              </label>
            </div>
          </form>
        </section>

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {!data ? <div className={ui.emptyBox}>Loading reports...</div> : (
          <>
            <section className={cx(ui.dashboardMetricGrid, ui.dashboardMetricGridFour)}>
              <Metric label="Students" value={data.users.students} hint={`${data.users.pending} pending or inactive accounts`} />
              <Metric label="Avg Score" value={`${data.attempts.averageScore}%`} hint={`${data.attempts.total} submitted attempts`} />
              <Metric label="Pass Rate" value={`${data.attempts.passRate}%`} hint="Across all submitted quizzes" />
              <Metric label="Payments" value={formatLkr(paymentTotal)} hint="Recorded transaction volume" />
            </section>

            <section className={reportUi.panel}>
              <PanelHeader title="Student Activity Heatmap" text="Last 30 days of quiz attempts and study events." />
              <div className={reportUi.heatmap}>
                {data.activityHeatmap.length === 0 ? <div className={ui.emptyBox}>No activity recorded yet.</div> : data.activityHeatmap.map((day) => {
                  const intensity = Math.min(0.9, 0.12 + ((day.quizAttempts + day.studyEvents) / 20));
                  return (
                    <div
                      className={reportUi.heatCell}
                      key={day.date}
                      style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(intensity * 100)}%, var(--surface-2))` }}
                    >
                      <strong className="block text-ink-strong">{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
                      <span>{day.activeStudents} active</span>
                      <span className="block">{day.quizAttempts} quiz</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={ui.dashboardGrid}>
              <article className={reportUi.panel}>
                <PanelHeader title="Quiz Pass / Fail Rates" text="Quizzes with the most attempts, sorted to expose risk." />
                <div className={reportUi.list}>
                  {data.quizPerformance.length === 0 ? <div className={ui.emptyBox}>No quiz submissions yet.</div> : data.quizPerformance.map((quiz) => (
                    <div className={reportUi.row} key={quiz.id}>
                      <div className={reportUi.rowMain}>
                        <strong>{quiz.quizTitle}</strong>
                        <span>{quiz.courseTitle || 'General'} • {quiz.attempts} attempts • avg {quiz.averagePercentage}%</span>
                        <ProgressBar value={quiz.passRate} />
                      </div>
                      <div className={reportUi.rowStat}>
                        <strong>{quiz.passRate}%</strong>
                        <span>{quiz.passes} pass / {quiz.fails} fail</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={reportUi.panel}>
                <PanelHeader title="Course Completion Funnel" text="Lesson progress by course from tracked student activity." />
                <div className={reportUi.list}>
                  {data.courseFunnel.length === 0 ? <div className={ui.emptyBox}>No lesson progress tracked yet.</div> : data.courseFunnel.map((course) => (
                    <div className={reportUi.row} key={course.id}>
                      <div className={reportUi.rowMain}>
                        <strong>{course.courseTitle}</strong>
                        <span>{course.studentsStarted} students started • {course.completedLessons} completions</span>
                        <ProgressBar value={course.averageProgress} />
                      </div>
                      <div className={reportUi.rowStat}>
                        <strong>{course.averageProgress}%</strong>
                        <span>{course.totalLessons} lessons</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={reportUi.panel}>
                <PanelHeader title="Hardest Questions" text="Most wrong selected answers." />
                <div className={reportUi.list}>
                  {data.hardQuestions.length === 0 ? <div className={ui.emptyBox}>No wrong-answer data yet.</div> : data.hardQuestions.map((question) => (
                    <div className={reportUi.row} key={question.id}>
                      <div className={reportUi.rowMain}>
                        <strong>Question #{question.id}</strong>
                        <span>{question.text}</span>
                      </div>
                      <div className={reportUi.rowStat}>
                        <strong>{question.wrongCount}</strong>
                        <span>wrong</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={reportUi.panel}>
                <PanelHeader title="Subscriptions / Payments" text="Plan status and payment health." />
                <div className={reportUi.list}>
                  {(data.subscriptions?.byStatus || []).map((item) => (
                    <div className={reportUi.row} key={`sub-${item.status}`}>
                      <div className={reportUi.rowMain}>
                        <strong>{item.status}</strong>
                        <span>Subscription status</span>
                      </div>
                      <span className={statusPill(item.status === 'active' ? 'active' : item.status === 'pending' ? 'pending' : 'inactive')}>{item.count}</span>
                    </div>
                  ))}
                  {(data.subscriptions?.payments || []).map((item) => (
                    <div className={reportUi.row} key={`pay-${item.status}`}>
                      <div className={reportUi.rowMain}>
                        <strong>{item.status}</strong>
                        <span>Payment transactions</span>
                      </div>
                      <div className={reportUi.rowStat}>
                        <strong>{item.count}</strong>
                        <span>{formatLkr(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={reportUi.panel}>
                <PanelHeader title="Inactive Students" text="Oldest or missing learning activity." />
                <div className={reportUi.list}>
                    {data.inactiveStudents.length === 0 ? <div className={ui.emptyBox}>No students found.</div> : data.inactiveStudents.map((student) => (
                      <div className={reportUi.row} key={student.id}>
                        <div className={reportUi.rowMain}>
                          <strong>{getAdminUserIdentifier(student)}</strong>
                          <span>{getAdminUserSecondaryIdentifier(student) || 'No name on file'}</span>
                        </div>
                      <div className={reportUi.rowStat}>
                        <strong>{student.lastActivity ? new Date(student.lastActivity).toLocaleDateString() : 'Never'}</strong>
                        <span>last activity</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
