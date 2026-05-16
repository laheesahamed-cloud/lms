import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchPracticeReview } from '../../../api/quizAttempts.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { ThemeToggle } from '../../../components/layout/ThemeToggle.jsx';
import { ReviewWorkspace } from './ReviewWorkspace.jsx';
import { ui } from '../../../styles/tailwindClasses.js';
import { getQuizNumberLabel, getQuizTitleText } from '../quizzes/quizLabels.js';

const reviewPageUi = {
  screen:
    `${ui.screenShell} practice-review-page px-[clamp(18px,2.8vw,30px)] pb-[clamp(18px,2.8vw,30px)] pt-[clamp(10px,1.4vw,18px)] max-[600px]:p-3.5`,
  layout:
    'mx-auto grid w-[min(100%,1520px)] gap-[18px]',
  header:
    'sticky top-2.5 z-20 flex items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-[color-mix(in_srgb,var(--surface-0)_76%,transparent)] px-3 py-2.5 shadow-md backdrop-blur-[14px] dark:border-white/10 dark:bg-[rgba(8,14,26,0.74)] max-[760px]:static max-[760px]:grid max-[760px]:gap-2.5',
  brand:
    'flex min-w-0 items-center gap-3',
  mark:
    'grid size-10 shrink-0 place-items-center rounded-[13px] border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_18%,var(--surface-card)),color-mix(in_srgb,var(--color-teal)_12%,var(--surface-card)))] text-brand-primary shadow-sm dark:border-white/10',
  titleWrap:
    'min-w-0',
  title:
    'm-0 truncate text-[17px] font-bold leading-tight text-ink-strong',
  subtitle:
    'mt-0.5 block max-w-[min(680px,52vw)] truncate text-xs text-ink-soft max-[760px]:max-w-full',
  actions:
    'flex min-w-0 flex-nowrap items-center justify-end gap-2 max-[760px]:w-full max-[760px]:justify-start max-[420px]:gap-1.5',
  scoreChip:
    'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-line-soft bg-surface-glass-subtle px-3 text-sm text-ink-medium shadow-xs dark:border-white/10 max-[420px]:min-h-9 max-[420px]:px-2.5 max-[420px]:text-[12px]',
  scoreValue:
    'text-base font-bold text-ink-strong max-[420px]:text-sm',
  actionButton:
    'inline-flex min-h-10 shrink-0 items-center justify-center rounded-[13px] border px-4 text-sm font-semibold transition-[background,border-color,color,opacity] duration-150 active:opacity-85 max-[420px]:min-h-9 max-[420px]:px-3 max-[420px]:text-[12px]',
  actionSecondary:
    'border-line-soft bg-surface-glass-subtle text-ink-medium hover:border-brand-primary/22 hover:bg-brand-primary/7 hover:text-brand-primary dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200',
  actionPrimary:
    'border-brand-primary/22 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/14 dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200',
};

function ReviewHeader({ data, complete, onQuizzes, onHome }) {
  const quizLabel = getQuizNumberLabel(data?.quiz);
  const quizTitle = getQuizTitleText(data?.quiz, 'Practice review');
  const topicName = data?.quiz?.topicName || data?.quiz?.topicDisplay || 'Review workspace';
  const percentage = Number(data?.summary?.percentage ?? data?.summary?.score ?? 0);
  const hasScore = Number.isFinite(percentage) && data?.summary;

  return (
    <header className={reviewPageUi.header}>
      <div className={reviewPageUi.brand}>
        <span className={reviewPageUi.mark} aria-hidden="true">
          <svg width="23" height="23" viewBox="0 0 23 23" fill="none">
            <rect x="3" y="3" width="17" height="17" rx="5" fill="url(#practice-review-mark)" />
            <path d="M7.2 12.2 10.2 15.1 16 8.3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="practice-review-mark" x1="3" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" />
                <stop offset="1" stopColor="#0EA5E9" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <div className={reviewPageUi.titleWrap}>
          <h1 className={reviewPageUi.title}>{complete ? `${quizLabel} complete` : `${quizLabel} review`}</h1>
          <span className={reviewPageUi.subtitle}>{quizTitle} • {topicName}</span>
        </div>
      </div>

      <div className={reviewPageUi.actions}>
        <ThemeToggle />
        {hasScore ? (
          <div className={reviewPageUi.scoreChip} aria-label={`Score ${Math.round(percentage)} percent`}>
            <span>Score</span>
            <strong className={reviewPageUi.scoreValue}>{Math.round(percentage)}%</strong>
          </div>
        ) : null}
        <button type="button" className={`${reviewPageUi.actionButton} ${reviewPageUi.actionSecondary}`} onClick={onHome}>
          Home
        </button>
        <button className={`${reviewPageUi.actionButton} ${reviewPageUi.actionPrimary}`} type="button" onClick={onQuizzes}>
          Quizzes
        </button>
      </div>
    </header>
  );
}

export function PracticeReviewPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const complete = searchParams.get('complete') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setData(await fetchPracticeReview(quizId, complete ? { complete: '1' } : undefined));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load practice review'));
      }
    }
    load();
  }, [quizId, complete]);

  if (!data && !error) {
    return <main className={ui.screenShell}><div className={ui.emptyBox}>Loading practice review...</div></main>;
  }

  return (
      <main className={reviewPageUi.screen}>
        <section className={reviewPageUi.layout}>
        <ReviewHeader
          data={data}
          complete={complete}
          onQuizzes={() => navigate('/quizzes')}
          onHome={() => navigate('/dashboard')}
        />
        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {data ? (
          <ReviewWorkspace
            questions={data.questions}
            summary={data.summary}
            navigatorVariant="bubbles"
            exitLabel="Finish"
            onExit={() => navigate('/quizzes')}
          />
        ) : null}
        </section>
      </main>
  );
}
