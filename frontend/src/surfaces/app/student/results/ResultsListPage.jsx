import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import { fetchStudentResults } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { ImpactStyle, nativeImpact } from '../../../../shared/utils/nativeHaptics.js';

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

function formatPercentage(value) {
  const percentage = Number(value || 0);
  return Number.isFinite(percentage) ? String(Math.round(percentage)) : '0';
}

function formatShortDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function getResultQuizTitle(result) {
  const title = String(result?.quizTitle || '').trim();
  if (title.length > 3) return title;
  return `Exam attempt #${result?.attemptId || '-'}`;
}

function AttemptsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M6.5 4.5h7.25a2 2 0 0 1 2 2v11H6.5a2.25 2.25 0 0 1 0-4.5h9.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.75 8h4.5M8.75 10.75h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PassedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M6.25 11.4 9.4 14.5 16 7.75" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
    </svg>
  );
}

function AverageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M5 15.5 9.25 11.25l2.75 2.5 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.75 7.75H17v3.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function scoreTone(score) {
  const pct = Number(score || 0);
  if (pct >= 70) return { color: '#10B981', bg: 'rgba(16,185,129,.12)', track: 'rgba(16,185,129,.18)' };
  if (pct >= 50) return { color: '#F59E0B', bg: 'rgba(245,158,11,.12)', track: 'rgba(245,158,11,.18)' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,.12)', track: 'rgba(239,68,68,.18)' };
}

function ScoreRing({ value = 0, size = 96 }) {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value || 0))));
  const tone = scoreTone(pct);
  const stroke = 9;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="result-score-ring" aria-hidden="true">
      <circle cx={center} cy={center} r={radius} stroke={tone.track} strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={tone.color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text x={center} y={center - 2} textAnchor="middle" fill="var(--ink-strong)" fontSize="24" fontWeight="900">{pct}%</text>
      <text x={center} y={center + 17} textAnchor="middle" fill="var(--ink-soft)" fontSize="10" fontWeight="800">avg</text>
    </svg>
  );
}

function ScoreSparkline({ results }) {
  const points = results
    .slice()
    .reverse()
    .slice(-8)
    .map((result) => Math.min(100, Math.max(0, Number(result.percentage || 0))));
  if (points.length < 2) {
    return (
      <div className="result-spark-empty">
        <AverageIcon />
        <span>Complete more exams to draw your score trend.</span>
      </div>
    );
  }
  const width = 240;
  const height = 78;
  const step = width / Math.max(1, points.length - 1);
  const d = points
    .map((score, index) => {
      const x = index * step;
      const y = height - (score / 100) * (height - 10) - 5;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="result-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 68 H240" stroke="rgba(148,163,184,.18)" strokeWidth="2" />
      <path d={d} fill="none" stroke="url(#resultSpark)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="resultSpark" x1="0" y1="0" x2="240" y2="0">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ResultsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusQuizId = searchParams.get('quizId') ? Number(searchParams.get('quizId')) : null;
  const [results, setResults] = useState([]);
  const [dashboardInsights, setDashboardInsights] = useState(null);
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
  const latestResult = visibleResults[0];
  const latestPercentage = latestResult ? formatPercentage(latestResult.percentage) : '0';
  const weakTopics = Array.isArray(dashboardInsights?.weakTopics) ? dashboardInsights.weakTopics.slice(0, 3) : [];
  const missedPatterns = Array.isArray(dashboardInsights?.missedPatterns) ? dashboardInsights.missedPatterns.slice(0, 3) : [];

  useEffect(() => {
    async function load() {
      try {
        const [resultData, dashboardData] = await Promise.all([
          fetchStudentResults(),
          fetchStudentDashboard().catch(() => null),
        ]);
        setResults(resultData);
        setDashboardInsights(dashboardData);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load results'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function openAttemptReview(attemptId) {
    void nativeImpact(ImpactStyle.Light);
    navigate(`/review/${attemptId}`);
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={focusedQuizTitle ? `${focusedQuizTitle} results` : 'My results'}
          subtitle={focusQuizId ? 'Showing only your submitted attempts for this question set.' : 'Review your submitted exam attempts in the new student area.'}
        />
        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section className="results-performance-board animate-fadePop" aria-label="Performance summary">
          <div className="results-performance-main">
            <ScoreRing value={averagePercentage} />
            <div className="min-w-0">
              <span className={ui.eyebrow}>Performance</span>
              <h2 className="results-performance-title">
                {loading ? 'Loading your progress...' : totalAttempts ? 'Your exam score trend' : 'Start your first exam'}
              </h2>
              <p className="results-performance-text">
                {totalAttempts
                  ? `Latest score ${latestPercentage}%. ${passedAttempts} of ${totalAttempts} attempts passed.`
                  : 'Submit an exam to see scores, review links, and focus areas here.'}
              </p>
            </div>
          </div>

          <div className="results-kpi-strip" aria-label="Results statistics">
            <div>
              <span><AttemptsIcon /></span>
              <strong>{loading ? '...' : totalAttempts}</strong>
              <small>Attempts</small>
            </div>
            <div>
              <span><PassedIcon /></span>
              <strong>{loading ? '...' : passedAttempts}</strong>
              <small>Passed</small>
            </div>
            <div>
              <span><AverageIcon /></span>
              <strong>{loading ? '...' : `${averagePercentage}%`}</strong>
              <small>Average</small>
            </div>
          </div>

          <div className="results-spark-panel">
            <div>
              <span className={ui.eyebrow}>Last Attempts</span>
              <p>Newest performance shape, from left to right.</p>
            </div>
            <ScoreSparkline results={visibleResults} />
          </div>
        </section>

        {!loading && (weakTopics.length > 0 || missedPatterns.length > 0) ? (
          <section className={cx(ui.panelCard, 'results-focus-board')}>
            <div className={ui.panelTop}>
              <div>
                <h2 className={ui.panelTitle}>Focus areas</h2>
                <p className={ui.panelText}>Weak topics and repeated mistake patterns live here now, not on the main dashboard.</p>
              </div>
            </div>
            <div className="results-focus-grid">
              <div className="results-focus-column">
                <span className={ui.eyebrow}>Weak Topics</span>
                {weakTopics.length === 0 ? (
                  <div className={ui.emptyBox}>No weak-topic data yet.</div>
                ) : weakTopics.map((topic) => (
                  <button type="button" className="results-focus-row" key={`${topic.courseTitle}-${topic.topicName}`} onClick={() => navigate('/quizzes')}>
                    <span className="results-focus-score">{Math.round(Number(topic.averagePercentage || 0))}%</span>
                    <span>
                      <strong>{topic.topicName}</strong>
                      <small>{topic.courseTitle} • {topic.attemptsCount || 0} attempt{topic.attemptsCount === 1 ? '' : 's'}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="results-focus-column">
                <span className={ui.eyebrow}>Missed Patterns</span>
                {missedPatterns.length === 0 ? (
                  <div className={ui.emptyBox}>No repeated missed patterns yet.</div>
                ) : missedPatterns.map((pattern) => (
                  <button type="button" className="results-focus-row" key={`${pattern.courseTitle}-${pattern.topicName}-${pattern.patternLabel}`} onClick={() => navigate('/quizzes')}>
                    <span className="results-focus-miss">x{pattern.missCount || 0}</span>
                    <span>
                      <strong>{pattern.topicName}</strong>
                      <small>{pattern.courseTitle}{pattern.patternLabel ? ` • ${pattern.patternLabel}` : ''}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className={cx(ui.panelCard, 'grid gap-3 max-[520px]:p-3.5')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Attempt history</h2>
              <p className={cx(ui.panelText, 'max-[520px]:text-sm')}>Exam attempts, scores, and review links.</p>
            </div>
          </div>

          {loading ? (
            <div className={ui.tableShell}>
              <table className={cx(ui.modernTable, 'min-w-[860px]')}>
                <tbody>
                  <tr>
                    <td colSpan="7" className={ui.tableEmpty}>Loading results...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : visibleResults.length === 0 ? (
            <div className={ui.emptyBox}>
              {focusQuizId ? 'No results yet for this exam set. Complete it once to see attempts here.' : 'No results yet. Complete an exam to see your attempts here.'}
            </div>
          ) : (
            <>
            <div className={cx(ui.tableShell, 'max-[640px]:hidden')}>
              <table className={cx(ui.modernTable, 'min-w-[860px]')}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Exam</th>
                    <th className={ui.tableHeadCell}>Course</th>
                    <th className={ui.tableHeadCell}>Topic</th>
                    <th className={ui.tableHeadCell}>Score</th>
                    <th className={ui.tableHeadCell}>Submitted</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((result) => {
                    const isPassed = result.passStatus === 'pass';
                    return (
                      <tr key={result.attemptId} className="transition-colors hover:bg-surface-2/70">
                        <td className={ui.tableCell}>
                          <strong className="block max-w-[260px] text-[13.5px] leading-snug text-ink-strong">{getResultQuizTitle(result)}</strong>
                          <div className={ui.tableSubtext}>Attempt #{result.attemptId}</div>
                        </td>
                        <td className={ui.tableCell}>
                          <span className="block max-w-[190px] text-ink-medium">{result.courseTitle || '-'}</span>
                        </td>
                        <td className={ui.tableCell}>
                          <span className="block max-w-[260px] leading-snug text-ink-medium">{result.topicDisplay || '-'}</span>
                        </td>
                        <td className={ui.tableCell}>
                          <strong className="tabular-nums text-[15px] text-ink-strong">{formatPercentage(result.percentage)}%</strong>
                        </td>
                        <td className={ui.tableCell}>
                          <span className="tabular-nums text-ink-medium">{formatDateTime(result.submittedAt)}</span>
                        </td>
                        <td className={ui.tableCell}>
                          <span className={statusPill(isPassed ? 'active' : 'inactive')}>
                            {isPassed ? 'Pass' : 'Review'}
                          </span>
                        </td>
                        <td className={ui.tableCell}>
                          <button type="button" className={cx(ui.ghostSmall, 'min-h-9 whitespace-nowrap')} onClick={() => openAttemptReview(result.attemptId)}>
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="hidden max-[640px]:block">
              <div className="overflow-hidden rounded-[18px] border border-line-soft bg-surface-1 shadow-sm">
                <div className="grid grid-cols-[minmax(0,1.55fr)_76px_44px] items-center gap-2 border-b border-line-soft bg-surface-2/55 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
                  <span>Exam</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">Open</span>
                </div>

                <div className="divide-y divide-line-soft">
                  {visibleResults.map((result) => {
                    const isPassed = result.passStatus === 'pass';
                    const score = Number(formatPercentage(result.percentage));
                    return (
                      <div
                        key={result.attemptId}
                        className="grid grid-cols-[minmax(0,1.55fr)_76px_44px] items-center gap-2 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-[14px] font-extrabold leading-tight text-ink-strong">
                            {getResultQuizTitle(result)}
                          </strong>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-snug text-ink-soft">
                            <span className="truncate">{result.courseTitle || 'Course'}</span>
                            <span aria-hidden="true">•</span>
                            <span className="truncate">{result.topicDisplay || 'Topic'}</span>
                          </div>
                          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">
                            Attempt #{result.attemptId} • {formatShortDate(result.submittedAt)}
                          </div>
                        </div>

                        <div className="min-w-0 text-right">
                          <strong className="block text-[18px] font-extrabold leading-none text-ink-strong tabular-nums">
                            {score}%
                          </strong>
                          <span
                            className={cx(
                              'mt-1 inline-flex min-h-5 items-center rounded-full px-2 text-[10px] font-extrabold uppercase tracking-[0.08em]',
                              isPassed
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            )}
                          >
                            {isPassed ? 'Pass' : 'Review'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="grid size-10 place-items-center justify-self-end rounded-full border border-line-soft bg-surface-2 text-ink-soft shadow-sm transition active:scale-95"
                          onClick={() => openAttemptReview(result.attemptId)}
                          aria-label={`Review attempt ${result.attemptId}`}
                        >
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
