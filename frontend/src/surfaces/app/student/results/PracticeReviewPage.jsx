import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchPracticeReview } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { ReviewWorkspace } from './ReviewWorkspace.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { getQuizDisplayLabel, getQuizTitleText } from '../quizzes/quizLabels.js';

const reviewPageUi = {
  screen:
    cx(ui.studentScreenShell, 'lms-quiz-taking-page lms-quiz-take dashboard-page study-hub-page lms-review-page practice-review-page'),
  layout:
    'study-hub-shell practice-review-shell grid grid-cols-1 min-w-0 gap-[clamp(16px,2vw,24px)]',
  header:
    'lms-exam-header practice-review-header max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-[60] max-[900px]:rounded-t-none max-[900px]:bg-[var(--surface-0)] max-[900px]:backdrop-blur-none max-[900px]:[transform:translateZ(0)] flex items-center justify-between gap-3 rounded-[18px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3 pb-2.5 pt-[calc(10px+var(--lms-safe-top,env(safe-area-inset-top,0px)))] shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:flex-row max-[700px]:items-center max-[700px]:justify-between max-[700px]:gap-3 max-[700px]:px-3.5 max-[700px]:pb-3 max-[700px]:pt-[calc(10px+var(--lms-safe-top,env(safe-area-inset-top,0px)))]',
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
    'quiz-header-actions flex min-w-0 flex-wrap items-center justify-end gap-2 max-[700px]:justify-end max-[420px]:gap-1.5',
  scoreChip:
    'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-line-soft bg-surface-glass-subtle px-3 text-sm text-ink-medium shadow-xs dark:border-white/10 max-[420px]:min-h-9 max-[420px]:px-2.5 max-[420px]:text-[12px]',
  scoreValue:
    'text-base font-bold text-ink-strong max-[420px]:text-sm',
  actionButton:
    'inline-flex min-h-10 shrink-0 items-center justify-center rounded-[13px] border px-4 text-sm font-semibold transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] active:opacity-85 max-[420px]:min-h-9 max-[420px]:px-3 max-[420px]:text-[12px]',
  actionSecondary:
    'border-line-soft bg-surface-glass-subtle text-ink-medium hover:border-brand-primary/22 hover:bg-brand-primary/7 hover:text-brand-primary dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200',
  actionPrimary:
    'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary hover:border-brand-primary/45 hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--surface-1))] dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200',
};

function ReviewHeader({ data, complete, onQuizzes, onHome }) {
  const barRef = useRef(null);
  const quizLabel = getQuizDisplayLabel(data?.quiz);
  const quizTitle = getQuizTitleText(data?.quiz, 'Practice review');
  const topicName = data?.quiz?.topicName || data?.quiz?.topicDisplay || 'Review workspace';
  const percentage = Number(data?.summary?.percentage ?? data?.summary?.score ?? 0);
  const hasScore = Number.isFinite(percentage) && data?.summary;

  // Publish the live bar height (safe-area inset included) so the in-flow spacer
  // reserves exactly the right room beneath the fixed, body-portaled bar.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const measure = () => {
      const height = Math.ceil(barRef.current?.getBoundingClientRect?.().height || 0);
      if (height) root.style.setProperty('--lms-quiz-bar-height', `${height}px`);
    };
    const frame = window.requestAnimationFrame(measure);
    let observer = null;
    if (barRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(barRef.current);
    }
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      root.style.removeProperty('--lms-quiz-bar-height');
    };
  }, []);

  // Fixed full-width bar portaled to <body> (same pattern as the take-quiz bar)
  // so its solid fill reaches up behind the status bar and covers the whole safe
  // area, instead of sitting as an inset panel below the notch.
  const bar = (
    <div className="lms-quiz-bar-layer">
      <header ref={barRef} className="lms-quiz-topbar">
        <div className="lms-quiz-topbar__title">
          <strong>{complete ? `${quizLabel} complete` : `${quizLabel} review`}</strong>
          <small>{quizTitle} • {topicName}</small>
        </div>

        <div className={reviewPageUi.actions}>
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
    </div>
  );

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(bar, document.body) : bar}
      <div className="lms-quiz-topbar__spacer" aria-hidden="true" />
    </>
  );
}

export function PracticeReviewPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const complete = searchParams.get('complete') === '1';
  const questionIdParam = searchParams.get('questionId') || '';
  const questionId = Number(questionIdParam);
  const isSingleQuestionReview = Number.isFinite(questionId) && questionId > 0;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setData(await fetchPracticeReview(quizId, {
          ...(complete ? { complete: '1' } : {}),
          ...(isSingleQuestionReview ? { questionId: String(questionId) } : {}),
        }));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load practice review'));
      }
    }
    load();
  }, [quizId, complete, isSingleQuestionReview, questionId]);

  if (!data && !error) {
    return (
      <main className={reviewPageUi.screen}>
        <section className={reviewPageUi.layout}>
          <div className={ui.emptyBox}>Loading practice review...</div>
        </section>
      </main>
    );
  }

  return (
      <main className={reviewPageUi.screen}>
        <section className={reviewPageUi.layout}>
        {data ? (
          <ReviewHeader
            data={data}
            complete={complete}
            onQuizzes={() => navigate('/quizzes')}
            onHome={() => navigate('/dashboard')}
          />
        ) : null}
        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}
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
