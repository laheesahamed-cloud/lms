import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAttemptResult } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { ImpactStyle, nativeImpact } from '../../../../shared/utils/nativeHaptics.js';
import { useCountUp } from '../../../../shared/hooks/useCountUp.js';

// Score ring whose conic-gradient sweep + percentage count up together on mount.
function ScoreRing({ percentage, isPassed, score, totalMarks }) {
  const animated = useCountUp(percentage, { duration: 1100, decimals: 1 });
  const deg = Math.max(0, Math.min(100, animated)) * 3.6;
  const ringStyle = {
    background: `conic-gradient(${isPassed ? 'var(--sa-ok)' : 'var(--sa-warn)'} ${deg}deg, color-mix(in srgb, var(--sa-surface-2) 86%, transparent) 0deg)`,
  };
  return (
    <div className="student-result-score-card" aria-label={`${percentage.toFixed(2)} percent score`}>
      <div className="student-result-score-ring" style={ringStyle}>
        <div>
          <strong>{animated.toFixed(1)}%</strong>
          <span>{score.toFixed(2)} / {totalMarks}</span>
        </div>
      </div>
    </div>
  );
}

export function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setResult(await fetchAttemptResult(attemptId));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load result'));
      }
    }
    load();
  }, [attemptId]);

  if (!result && !error) {
    return (
      <main className={cx(ui.studentScreenShell, 'dashboard-page study-hub-page practice-review-page student-result-detail-page')}>
        <section className="study-hub-shell practice-review-shell student-result-detail-layout">
          <div className={ui.emptyBox}>Loading result...</div>
        </section>
      </main>
    );
  }

  const percentage = result ? Number(result.percentage || 0) : 0;
  const score = result ? Number(result.score || 0) : 0;
  const totalMarks = result?.totalMarks || 100;
  const isPassed = result?.passStatus === 'pass';
  const unanswered = result?.unansweredQuestions || 0;
  const answered = result ? Math.max(Number(result.totalQuestions || 0) - unanswered, 0) : 0;
  const accuracyNote = percentage >= 80
    ? 'Excellent command. Keep this topic warm with a short review later.'
    : percentage >= 60
      ? 'Good movement. Review the misses while the reasoning is still fresh.'
      : 'This is a useful diagnostic. Slow down, review explanations, then retry.';
  const focusItems = [
    result?.wrongAnswers > 0 ? { label: 'Mistakes to review', value: result.wrongAnswers, text: 'Open review and focus on why the selected answer was tempting.' } : null,
    unanswered > 0 ? { label: 'Time / confidence gap', value: unanswered, text: 'Unanswered items usually mean pacing or uncertainty needs attention.' } : null,
    result?.correctAnswers > 0 ? { label: 'Reliable answers', value: result.correctAnswers, text: 'Protect these strengths with a quick recap before the next attempt.' } : null,
  ].filter(Boolean);

  function openReviewAnswers() {
    void nativeImpact(ImpactStyle.Light);
    navigate(`/review/${attemptId}`);
  }

  return (
      <main className={cx(ui.studentScreenShell, 'dashboard-page study-hub-page practice-review-page student-result-detail-page')}>
        <section className="study-hub-shell practice-review-shell student-result-detail-layout">
        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}
        {result ? (
          <>
          <section className="student-result-detail-hero">
            <div className="student-result-detail-hero__copy">
                <span className={statusPill(isPassed ? 'active' : 'inactive')}>
                  {isPassed ? 'Passed' : 'Needs review'}
                </span>
                <h1>{result.quizTitle}</h1>
                <p>
                  {result.courseTitle}
                  {result.topicDisplay ? ` • ${result.topicDisplay}` : ''}
                </p>
                <p className="student-result-detail-note">
                  {accuracyNote}
                </p>
                <div className="student-result-detail-actions">
                  <button className="lms-app-btn lms-app-btn--primary" type="button" onClick={openReviewAnswers}>Review answers</button>
                  <button type="button" className="lms-app-btn lms-app-btn--ghost" onClick={() => navigate('/quizzes')}>Practice</button>
                  <button type="button" className="lms-app-btn lms-app-btn--ghost" onClick={() => navigate('/results')}>All results</button>
                </div>
              </div>

              <ScoreRing percentage={percentage} isPassed={isPassed} score={score} totalMarks={totalMarks} />
          </section>

            <section className="student-result-stat-grid lms-quiz-set-card" aria-label="Attempt score breakdown">
              <article className="student-result-stat-card"><span>Total</span><strong>{result.totalQuestions}</strong></article>
              <article className="student-result-stat-card is-correct"><span>Correct</span><strong>{result.correctAnswers}</strong></article>
              <article className="student-result-stat-card is-wrong"><span>Wrong</span><strong>{result.wrongAnswers}</strong></article>
              <article className="student-result-stat-card"><span>Unanswered</span><strong>{unanswered}</strong></article>
            </section>

            <section className="student-result-insight-grid" aria-label="Attempt insights">
              <article className="student-result-insight-card">
                <span className={ui.eyebrow}>Passing mark</span>
                <strong>{result.passingMarks} / {totalMarks}</strong>
                <p>Your score is {score.toFixed(2)} marks.</p>
              </article>
              <article className="student-result-insight-card">
                <span className={ui.eyebrow}>Answered</span>
                <strong>{answered} of {result.totalQuestions}</strong>
                <p>{unanswered > 0 ? `${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered.` : 'Every question was answered.'}</p>
              </article>
            </section>

            <section className="student-result-focus-grid" aria-label="Next focus areas">
              {focusItems.map((item) => (
                <article className="student-result-focus-card" key={item.label}>
                  <span className={ui.eyebrow}>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.text}</p>
                </article>
              ))}
            </section>
          </>
        ) : null}
        </section>
      </main>
  );
}
