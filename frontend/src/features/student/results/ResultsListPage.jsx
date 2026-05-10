import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchStudentResults } from '../../../api/quizAttempts.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ResultsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusQuizId = searchParams.get('quizId') ? Number(searchParams.get('quizId')) : null;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const visibleResults = useMemo(() => {
    if (!focusQuizId) return results;
    return results.filter((result) => Number(result.quizId) === focusQuizId);
  }, [focusQuizId, results]);

  const totalAttempts = visibleResults.length;
  const passedAttempts = visibleResults.filter((result) => result.passStatus === 'pass').length;
  const averagePercentage = totalAttempts
    ? (visibleResults.reduce((sum, result) => sum + Number(result.percentage || 0), 0) / totalAttempts).toFixed(1)
    : '0.0';
  const focusedQuizTitle = focusQuizId
    ? results.find((result) => Number(result.quizId) === focusQuizId)?.quizTitle
    : '';

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStudentResults();
        setResults(data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load results'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={focusedQuizTitle ? `${focusedQuizTitle} results` : 'My results'}
          subtitle={focusQuizId ? 'Showing only your submitted attempts for this question set.' : 'Review your submitted exam attempts in the new student area.'}
        />
        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 max-[780px]:grid-cols-1">
            <article className="animate-fadePop relative overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
              <span className="absolute -right-8 -top-8 size-28 rounded-full bg-blue-500/10" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className={ui.eyebrow}>Attempts</span>
                  <small className="block text-[11px] text-ink-muted">submitted</small>
                </div>
                <span className="text-2xl text-brand-primary" aria-hidden="true">◎</span>
              </div>
              <h2 className="mb-1 mt-4 text-3xl font-extrabold text-ink-strong">{loading ? '...' : totalAttempts}</h2>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Total completed quiz attempts</p>
            </article>

            <article className="animate-fadePop relative overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
              <span className="absolute -right-8 -top-8 size-28 rounded-full bg-teal-500/10" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className={ui.eyebrow}>Passed</span>
                  <small className="block text-[11px] text-ink-muted">successful</small>
                </div>
                <span className="text-2xl text-brand-success" aria-hidden="true">✓</span>
              </div>
              <h2 className="mb-1 mt-4 text-3xl font-extrabold text-ink-strong">{loading ? '...' : passedAttempts}</h2>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Attempts above the pass threshold</p>
            </article>

            <article className="animate-fadePop relative overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
              <span className="absolute -right-8 -top-8 size-28 rounded-full bg-violet-500/10" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className={ui.eyebrow}>Average</span>
                  <small className="block text-[11px] text-ink-muted">percentage</small>
                </div>
                <span className="text-2xl text-brand-violet" aria-hidden="true">↗</span>
              </div>
              <h2 className="mb-1 mt-4 text-3xl font-extrabold text-ink-strong">{loading ? '...' : `${averagePercentage}%`}</h2>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Your mean score across submitted attempts</p>
            </article>
          </div>
        </section>

        <section className={ui.panelCard}>
          {loading ? (
            <div className={ui.emptyBox}>Loading results...</div>
          ) : visibleResults.length === 0 ? (
            <div className={ui.emptyBox}>
              {focusQuizId ? 'No results yet for this question set. Complete it once to see attempts here.' : 'No results yet. Complete a quiz to see your attempts here.'}
            </div>
          ) : (
            <div className={ui.tableShell}>
              <table className={ui.modernTable}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Quiz</th>
                    <th className={ui.tableHeadCell}>Course</th>
                    <th className={ui.tableHeadCell}>Submitted</th>
                    <th className={ui.tableHeadCell}>Score</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((result) => (
                    <tr key={result.attemptId}>
                      <td className={ui.tableCell}>
                        <strong>{result.quizTitle}</strong>
                        <div className={ui.tableSubtext}>{result.topicDisplay}</div>
                      </td>
                      <td className={ui.tableCell}>{result.courseTitle}</td>
                      <td className={ui.tableCell}>{formatDateTime(result.submittedAt)}</td>
                      <td className={ui.tableCell}>{result.score} ({Number(result.percentage).toFixed(2)}%)</td>
                      <td className={ui.tableCell}>
                        <span className={statusPill(result.passStatus === 'pass' ? 'active' : 'inactive')}>
                          {result.passStatus}
                        </span>
                      </td>
                      <td className={ui.tableCell}>
                        <div className={cx(ui.buttonRow, 'gap-2')}>
                          <button type="button" className={ui.ghostSmall} onClick={() => navigate(`/results/${result.attemptId}`)}>
                            Result
                          </button>
                          <button type="button" className={ui.ghostSmall} onClick={() => navigate(`/review/${result.attemptId}`)}>
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
