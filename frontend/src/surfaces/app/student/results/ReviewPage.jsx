import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAttemptReview } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { ReviewWorkspace } from './ReviewWorkspace.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getQuizNumberLabel, getQuizTitleText } from '../quizzes/quizLabels.js';
import { safeNavigateBack } from '../../../../shared/routing/safeBack.js';

const reviewPageUi = {
  screen:
    cx(ui.studentScreenShell, 'dashboard-page study-hub-page lms-review-page practice-review-page'),
  layout:
    'study-hub-shell practice-review-shell grid grid-cols-1 min-w-0 gap-[clamp(16px,2vw,24px)]',
  header:
    'lms-exam-header practice-review-header flex items-center justify-between gap-3 rounded-[18px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3 py-2.5 shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:flex-row max-[700px]:items-center max-[700px]:justify-between max-[700px]:gap-3 max-[700px]:px-3.5 max-[700px]:py-3',
  brand:
    'flex min-w-0 flex-1 items-center gap-3',
  mark:
    'grid size-10 shrink-0 place-items-center rounded-[13px] border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_18%,var(--surface-card)),color-mix(in_srgb,var(--color-teal)_12%,var(--surface-card)))] text-brand-primary shadow-sm dark:border-white/10',
  titleWrap:
    'min-w-0',
  title:
    'm-0 truncate text-[17px] font-bold leading-tight text-ink-strong',
  subtitle:
    'mt-0.5 block max-w-[min(680px,52vw)] truncate text-xs text-ink-soft max-[760px]:max-w-full',
  actions:
    'quiz-header-actions flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 max-[700px]:justify-end max-[420px]:gap-1.5',
  scoreChip:
    'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-line-soft bg-surface-glass-subtle px-3 text-sm text-ink-medium shadow-xs dark:border-white/10 max-[420px]:min-h-9 max-[420px]:px-2.5 max-[420px]:text-[12px]',
  scoreValue:
    'text-base font-bold text-ink-strong max-[420px]:text-sm',
  actionButton:
    'inline-flex min-h-10 shrink-0 items-center justify-center rounded-[13px] border px-4 text-sm font-semibold transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] active:opacity-85 max-[420px]:min-h-9 max-[420px]:px-3 max-[420px]:text-[12px]',
  actionSecondary:
    'border-line-soft bg-surface-glass-subtle text-ink-medium hover:border-brand-primary/22 hover:bg-brand-primary/7 hover:text-brand-primary dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200',
};

function ReviewHeader({ attempt, onBack }) {
  const quizLabel = getQuizNumberLabel(attempt);
  const quizTitle = getQuizTitleText(attempt, 'Answer review');
  const topicName = attempt?.topicName || attempt?.topicDisplay || attempt?.subjectName || 'Review workspace';
  const percentage = Number(attempt?.percentage || 0);
  const hasScore = Number.isFinite(percentage);

  return (
    <header className={reviewPageUi.header}>
      <div className={reviewPageUi.brand}>
        <span className={reviewPageUi.mark} aria-hidden="true">
          <svg width="23" height="23" viewBox="0 0 23 23" fill="none">
            <rect x="3" y="3" width="17" height="17" rx="5" fill="url(#attempt-review-mark)" />
            <path d="M7.2 12.2 10.2 15.1 16 8.3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="attempt-review-mark" x1="3" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" />
                <stop offset="1" stopColor="#0EA5E9" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <div className={reviewPageUi.titleWrap}>
          <h1 className={reviewPageUi.title}>{quizLabel} review</h1>
          <span className={reviewPageUi.subtitle}>{quizTitle} - {topicName}</span>
        </div>
      </div>

      <div className={reviewPageUi.actions}>
        {hasScore ? (
          <div className={reviewPageUi.scoreChip} aria-label={`Score ${Math.round(percentage)} percent`}>
            <span>Score</span>
            <strong className={reviewPageUi.scoreValue}>{Math.round(percentage)}%</strong>
          </div>
        ) : null}
        <button type="button" className={`${reviewPageUi.actionButton} ${reviewPageUi.actionSecondary}`} onClick={onBack}>
          Back to results
        </button>
      </div>
    </header>
  );
}

export function ReviewPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const goBack = () => safeNavigateBack(navigate, { fallbackPath: '/results' });

  useEffect(() => {
    async function load() {
      try {
        setData(await fetchAttemptReview(attemptId));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load review'));
      }
    }
    load();
  }, [attemptId]);

  if (!data && !error) {
    return (
      <main className={reviewPageUi.screen}>
        <section className={reviewPageUi.layout}>
          <div className={ui.emptyBox}>Loading review...</div>
        </section>
      </main>
    );
  }

  const summary = data ? data.questions.reduce(
    (acc, question) => {
      if (question.answerStatus === 'correct') acc.correct += 1;
      else if (question.answerStatus === 'wrong') acc.wrong += 1;
      else acc.unanswered += 1;
      return acc;
    },
    {
      total: data.questions.length,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      score: Number(data.attempt.score || 0),
      percentage: Number(data.attempt.percentage || 0),
    }
  ) : null;
  const reviewNotesPath = data?.attempt?.lessonId ? `/study/lesson/${data.attempt.lessonId}` : '/ai-notes';

  return (
      <main className={reviewPageUi.screen}>
        <section className={reviewPageUi.layout}>
        {data ? <ReviewHeader attempt={data.attempt} onBack={goBack} /> : null}
        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {data ? (
          <ReviewWorkspace
            questions={data.questions}
            summary={summary}
            navigatorVariant="bubbles"
            exitLabel="Finish"
            onExit={goBack}
            notesPath={reviewNotesPath}
          />
        ) : null}
        </section>
      </main>
  );
}
