import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAttemptResult } from '../../../api/quizAttempts.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';
import { ImpactStyle, nativeImpact } from '../../../utils/nativeHaptics.js';

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
    return <main className={ui.screenShell}><div className={ui.emptyBox}>Loading result...</div></main>;
  }

  const percentage = result ? Number(result.percentage || 0) : 0;
  const score = result ? Number(result.score || 0) : 0;
  const totalMarks = result?.totalMarks || 100;
  const isPassed = result?.passStatus === 'pass';
  const unanswered = result?.unansweredQuestions || 0;
  const answered = result ? Math.max(Number(result.totalQuestions || 0) - unanswered, 0) : 0;
  const boundedPercentage = Math.max(0, Math.min(100, percentage));
  const ringStyle = {
    background: `conic-gradient(${isPassed ? '#10b981' : '#f59e0b'} ${boundedPercentage * 3.6}deg, color-mix(in_srgb,var(--surface-3)_86%,transparent) 0deg)`,
  };
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
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
        <AppHeader title="Exam result" subtitle={`${result?.courseTitle || ''} • ${result?.topicDisplay || ''}`} />
        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {result ? (
          <section className={cx(ui.panelCard, 'grid gap-6 overflow-hidden')}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div>
                <span className={statusPill(isPassed ? 'active' : 'inactive')}>
                  {isPassed ? 'Passed' : 'Needs review'}
                </span>
                <h2 className="mb-2 mt-4 font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-tight text-ink-strong">{result.quizTitle}</h2>
                <p className="m-0 text-[15px] leading-relaxed text-ink-soft">
                  {result.courseTitle}
                  {result.topicDisplay ? ` • ${result.topicDisplay}` : ''}
                </p>
                <p className="mt-4 max-w-[680px] rounded-xl border border-line-soft bg-surface-2 px-4 py-3 text-[14px] font-semibold leading-relaxed text-ink-medium dark:border-white/10 dark:bg-white/[0.035]">
                  {accuracyNote}
                </p>
                <div className={cx(ui.buttonRow, 'mt-5')}>
                  <button className={ui.primaryAction} type="button" onClick={openReviewAnswers}>Review answers</button>
                  <button type="button" className={ui.secondaryAction} onClick={() => navigate('/quizzes')}>Retry practice</button>
                  <button type="button" className={ui.secondaryAction} onClick={() => navigate('/results')}>All results</button>
                </div>
              </div>

              <div className="grid place-items-center" aria-label={`${percentage.toFixed(2)} percent score`}>
                <div className="grid size-48 place-items-center rounded-full p-[14px] shadow-[0_18px_44px_rgba(15,23,42,0.10)] dark:shadow-none" style={ringStyle}>
                  <div className="grid size-full place-items-center rounded-full bg-surface-0 text-center dark:bg-[#07111f]">
                    <strong className="text-4xl font-extrabold text-ink-strong">{percentage.toFixed(1)}%</strong>
                    <span className="text-xs font-bold text-ink-muted">{score.toFixed(2)} / {totalMarks}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-[780px]:grid-cols-2">
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4"><span className="text-xs font-bold text-ink-muted">Total</span><strong className="mt-1 block text-2xl font-extrabold text-ink-strong">{result.totalQuestions}</strong></article>
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4"><span className="text-xs font-bold text-ink-muted">Correct</span><strong className="mt-1 block text-2xl font-extrabold text-brand-success">{result.correctAnswers}</strong></article>
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4"><span className="text-xs font-bold text-ink-muted">Wrong</span><strong className="mt-1 block text-2xl font-extrabold text-brand-error">{result.wrongAnswers}</strong></article>
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4"><span className="text-xs font-bold text-ink-muted">Unanswered</span><strong className="mt-1 block text-2xl font-extrabold text-ink-strong">{unanswered}</strong></article>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[780px]:grid-cols-1">
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4">
                <span className={ui.eyebrow}>Passing mark</span>
                <strong className="mt-2 block text-xl font-extrabold text-ink-strong">{result.passingMarks} / {totalMarks}</strong>
                <p className="m-0 mt-1 text-sm text-ink-soft">Your score is {score.toFixed(2)} marks.</p>
              </article>
              <article className="rounded-lg border border-line-soft bg-surface-2 p-4">
                <span className={ui.eyebrow}>Answered</span>
                <strong className="mt-2 block text-xl font-extrabold text-ink-strong">{answered} of {result.totalQuestions}</strong>
                <p className="m-0 mt-1 text-sm text-ink-soft">{unanswered > 0 ? `${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered.` : 'Every question was answered.'}</p>
              </article>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {focusItems.map((item) => (
                <article className="lms-student-delight rounded-xl border border-line-soft bg-surface-2 p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.label}>
                  <span className={ui.eyebrow}>{item.label}</span>
                  <strong className="mt-2 block text-3xl font-extrabold text-ink-strong">{item.value}</strong>
                  <p className="m-0 mt-2 text-[13px] leading-relaxed text-ink-soft">{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        </section>
      </main>
  );
}
