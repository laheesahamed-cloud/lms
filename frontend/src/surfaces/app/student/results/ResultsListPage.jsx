import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import { fetchStudentResults } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { ImpactStyle, nativeImpact } from '../../../../shared/utils/nativeHaptics.js';

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

function getAttemptType(result) {
  const rawType = String(result?.attemptType || result?.attemptMode || result?.mode || '').trim().toLowerCase();
  if (rawType.includes('practice') || rawType.includes('qbank')) return 'QBank';
  return 'Exam';
}

function getResultQuizTitle(result) {
  return `${getAttemptType(result)} attempt #${result?.attemptId || '-'}`;
}

function getAttemptSubtitle(result) {
  return [result?.courseTitle, result?.topicDisplay]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' • ') || String(result?.quizTitle || 'Quiz attempt').trim();
}

function getAttemptMarks(result) {
  const correct = Number(result?.correctAnswers || 0);
  const wrong = Number(result?.wrongAnswers || 0);
  const unanswered = Number(result?.unansweredQuestions || 0);
  const total = correct + wrong + unanswered;
  return total > 0 ? `${correct}/${total}` : '';
}

function getAttemptReviewStatus(result) {
  const status = String(result?.status || '').trim().toLowerCase();
  if (status && !['submitted', 'complete', 'completed'].includes(status)) {
    return { label: 'In progress', tone: 'progress' };
  }
  if (result?.passStatus === 'pass') {
    return { label: 'Passed', tone: 'passed' };
  }
  const percentage = Number(result?.percentage || 0);
  if (percentage > 0 && percentage < 40) {
    return { label: 'Failed', tone: 'failed' };
  }
  return { label: 'Needs review', tone: 'review' };
}

function getAttemptAriaLabel(result) {
  const score = `${formatPercentage(result?.percentage)}%`;
  const marks = getAttemptMarks(result);
  const status = getAttemptReviewStatus(result).label;
  return [
    getResultQuizTitle(result),
    getAttemptSubtitle(result),
    formatShortDate(result?.submittedAt),
    marks ? `${score}, ${marks}` : score,
    status,
    'open review',
  ].filter(Boolean).join(', ');
}

function AttemptChevron() {
  return (
    <span className="student-results-attempt-chevron" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" focusable="false">
        <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function scoreTone(score) {
  const pct = Number(score || 0);
  if (pct >= 70) return { color: '#10B981', bg: 'rgba(16,185,129,.12)', track: 'rgba(16,185,129,.18)' };
  if (pct >= 50) return { color: '#F59E0B', bg: 'rgba(245,158,11,.12)', track: 'rgba(245,158,11,.18)' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,.12)', track: 'rgba(239,68,68,.18)' };
}

function ScoreRing({ value = 0, size = 112 }) {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value || 0))));
  const tone = scoreTone(pct);
  const stroke = Math.max(9, Math.round(size * 0.1));
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
      <text x={center} y={center - 2} textAnchor="middle" fill="var(--ink-strong)" fontSize={Math.round(size * 0.24)} fontWeight="900">{pct}%</text>
      <text x={center} y={center + Math.round(size * 0.16)} textAnchor="middle" fill="var(--ink-soft)" fontSize={Math.round(size * 0.1)} fontWeight="800">avg</text>
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
      <div className="result-chart-card" aria-label="Last attempts chart">
        <span className={ui.eyebrow}>Last attempts</span>
        <p>Newest performance shape, from left to right.</p>
        <div className="result-spark-empty">
          <span>Complete at least two exams to show a trend chart.</span>
        </div>
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
  const firstScore = points[0];
  const latestScore = points[points.length - 1];
  return (
    <div className="result-chart-card" aria-label={`Score trend from ${firstScore}% to ${latestScore}% across ${points.length} recent attempts`}>
      <span className={ui.eyebrow}>Last attempts</span>
      <p>Newest performance shape, from left to right.</p>
      <div className="result-chart-card__plot">
        <svg className="result-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Line chart of recent exam percentages">
          <path d="M0 73 H240" stroke="rgba(148,163,184,.22)" strokeWidth="2" />
          <path d={d} fill="none" stroke="url(#resultSpark)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="resultSpark" x1="0" y1="0" x2="240" y2="0">
              <stop stopColor="#2563EB" />
              <stop offset="1" stopColor="#2F73FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function ResultStatBox({ value, label, tone }) {
  return (
    <article className={`student-results-performance-stat student-results-performance-stat--${tone}`}>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
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

  function handleAttemptKeyDown(event, attemptId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openAttemptReview(attemptId);
  }

  return (
    <main className="dashboard-page study-hub-page student-results-page">
      <section className="study-hub-shell student-results-layout">
        <AppHeader
          title="Results"
          subtitle={focusQuizId ? 'Filtered Results' : 'Performance'}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <section className="student-results-hero lms-page-header-card" aria-label="Results summary">
          <div className="student-results-hero__score" aria-label="Exam performance trend">
            <div className="student-results-performance-top">
              <ScoreRing value={averagePercentage} />
              <div>
                <span className={ui.eyebrow}>Performance</span>
                <h2>Your exam score trend</h2>
                <p>
                  {loading
                    ? 'Loading your latest score trend.'
                    : totalAttempts
                      ? 'Recent performance shape from your exam attempts.'
                      : 'Complete an exam to start building your score trend.'}
                </p>
              </div>
            </div>

            <div className="student-results-performance-stats" aria-label="Results statistics">
              <ResultStatBox value={loading ? '...' : totalAttempts} label="Attempts" tone="attempts" />
              <ResultStatBox value={loading ? '...' : passedAttempts} label="Passed" tone="passed" />
              <ResultStatBox value={loading ? '...' : `${averagePercentage}%`} label="Average" tone="average" />
            </div>

            <ScoreSparkline results={visibleResults} />
          </div>
        </section>

        {!loading && (weakTopics.length > 0 || missedPatterns.length > 0) ? (
          <section className="student-results-focus">
            <div className={ui.panelTop}>
              <div>
                <h2 className={ui.panelTitle}>Focus areas</h2>
                <p className={ui.panelText}>Weak topics and repeated mistake patterns from your recent attempts.</p>
              </div>
            </div>
            <div className="student-results-focus__grid">
              <div className="student-results-focus__column">
                <span className={ui.eyebrow}>Weak Topics</span>
                {weakTopics.length === 0 ? (
                  <div className={ui.emptyBox}>No weak-topic data yet.</div>
                ) : weakTopics.map((topic) => (
                  <button type="button" className="student-results-focus__row" key={`${topic.courseTitle}-${topic.topicName}`} onClick={() => navigate('/quizzes')}>
                    <span className="student-results-focus__score">{Math.round(Number(topic.averagePercentage || 0))}%</span>
                    <span>
                      <strong>{topic.topicName}</strong>
                      <small>{topic.courseTitle} • {topic.attemptsCount || 0} attempt{topic.attemptsCount === 1 ? '' : 's'}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="student-results-focus__column">
                <span className={ui.eyebrow}>Missed Patterns</span>
                {missedPatterns.length === 0 ? (
                  <div className={ui.emptyBox}>No repeated missed patterns yet.</div>
                ) : missedPatterns.map((pattern) => (
                  <button type="button" className="student-results-focus__row" key={`${pattern.courseTitle}-${pattern.topicName}-${pattern.patternLabel}`} onClick={() => navigate('/quizzes')}>
                    <span className="student-results-focus__miss">x{pattern.missCount || 0}</span>
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

        <section className="student-results-history">
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Attempt history</h2>
              <p className={cx(ui.panelText, 'max-[520px]:text-sm')}>Exam attempts, scores, submitted time, and review status.</p>
            </div>
          </div>

          {loading ? (
            <div className={ui.tableShell}>
              <table className={cx(ui.modernTable, 'min-w-[720px]')}>
                <tbody>
                  <tr>
                    <td colSpan="5" className={ui.tableEmpty}>Loading results...</td>
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
            <div className={cx(ui.tableShell, 'max-[820px]:hidden')}>
              <table className={cx(ui.modernTable, 'min-w-[720px]')}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Attempt</th>
                    <th className={ui.tableHeadCell}>Date</th>
                    <th className={ui.tableHeadCell}>Score</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell} aria-label="Open review" />
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((result) => {
                    const reviewStatus = getAttemptReviewStatus(result);
                    const marks = getAttemptMarks(result);
                    return (
                      <tr
                        key={result.attemptId}
                        className="student-results-attempt-row"
                        role="button"
                        tabIndex={0}
                        aria-label={getAttemptAriaLabel(result)}
                        onClick={() => openAttemptReview(result.attemptId)}
                        onKeyDown={(event) => handleAttemptKeyDown(event, result.attemptId)}
                      >
                        <td className={ui.tableCell}>
                          <strong className="block max-w-[260px] text-[13.5px] leading-snug text-ink-strong">{getResultQuizTitle(result)}</strong>
                          <div className={ui.tableSubtext}>{getAttemptSubtitle(result)}</div>
                        </td>
                        <td className={ui.tableCell}>
                          <span className="tabular-nums text-ink-medium">{formatShortDate(result.submittedAt)}</span>
                        </td>
                        <td className={ui.tableCell}>
                          <strong className="block tabular-nums text-[15px] text-ink-strong">{formatPercentage(result.percentage)}%</strong>
                          {marks ? <span className={ui.tableSubtext}>{marks}</span> : null}
                        </td>
                        <td className={ui.tableCell}>
                          <span className={`student-results-attempt-status student-results-attempt-status--${reviewStatus.tone}`}>
                            {reviewStatus.label}
                          </span>
                        </td>
                        <td className={cx(ui.tableCell, 'text-right')}>
                          <AttemptChevron />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="student-results-mobile-history">
              <div className="student-results-mobile-history__shell">
                <div className="student-results-mobile-history__head">
                  <span>Attempt</span>
                  <span className="text-right">Score</span>
                  <span className="text-right" aria-label="Open review" />
                </div>

                <div className="student-results-attempt-list">
                  {visibleResults.map((result) => {
                    const reviewStatus = getAttemptReviewStatus(result);
                    const marks = getAttemptMarks(result);
                    const score = Number(formatPercentage(result.percentage));
                    return (
                      <div
                        key={result.attemptId}
                        className="student-results-attempt-card"
                        role="button"
                        tabIndex={0}
                        aria-label={getAttemptAriaLabel(result)}
                        onClick={() => openAttemptReview(result.attemptId)}
                        onKeyDown={(event) => handleAttemptKeyDown(event, result.attemptId)}
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
                          <div className="mt-1 text-[11px] font-semibold text-ink-muted">
                            {formatShortDate(result.submittedAt)}
                          </div>
                        </div>

                        <div className="min-w-0 text-right">
                          <strong className="block text-[18px] font-extrabold leading-none text-ink-strong tabular-nums">
                            {score}%
                          </strong>
                          <span className="mt-0.5 block text-[11px] font-semibold text-ink-muted tabular-nums">
                            {marks}
                          </span>
                          <span className={`student-results-attempt-status student-results-attempt-status--${reviewStatus.tone}`}>
                            {reviewStatus.label}
                          </span>
                        </div>

                        <AttemptChevron />
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
