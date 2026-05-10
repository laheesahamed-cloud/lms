import { useEffect, useRef, useState } from 'react';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const THEORY_RECAP_COACHMARK_KEY = 'lms.review.quickTheoryRecapCoachmark.dismissed';
const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const reviewUi = {
  shell:
    'grid grid-cols-[minmax(188px,236px)_minmax(0,1fr)] items-start gap-[18px] max-[980px]:grid-cols-1 min-[901px]:group-[.compact-focus-mode]/shell:grid-cols-[minmax(180px,220px)_minmax(520px,1fr)]',
  shellThree:
    'grid-cols-[minmax(188px,236px)_minmax(520px,1fr)_minmax(300px,360px)] max-[980px]:grid-cols-1 min-[901px]:group-[.compact-focus-mode]/shell:grid-cols-[minmax(180px,220px)_minmax(520px,1fr)_minmax(300px,360px)]',
  sidebar:
    'sticky top-6 grid max-h-[calc(100vh-48px)] gap-3.5 overflow-hidden max-[980px]:static max-[980px]:max-h-none max-[980px]:overflow-visible',
  main: 'min-w-0',
  explanationSide:
    'sticky top-6 max-h-[calc(100vh-48px)] min-w-0 overflow-auto overscroll-contain max-[980px]:static max-[980px]:max-h-none max-[980px]:overflow-visible',
  summaryGrid: 'grid grid-cols-2 gap-2.5',
  summaryTile:
    'grid gap-1 rounded-[14px] border-[1.5px] border-line-soft bg-surface-2 px-2.5 py-2.5 text-center [&_span]:text-[10px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.06em] [&_span]:text-ink-soft [&_strong]:text-lg [&_strong]:font-extrabold [&_strong]:leading-none [&_strong]:tracking-normal [&_strong]:text-ink-strong',
  nav: 'grid min-h-0 gap-2.5',
  navHead: 'flex items-baseline justify-between gap-2.5 [&_h3]:m-0 [&_h3]:text-[13px] [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-soft',
  navList: 'grid min-h-0 gap-2 overflow-y-auto pr-1 max-[980px]:max-h-60',
  navItem:
    'relative grid w-full justify-items-start gap-[5px] rounded-[14px] border-[1.5px] border-line-soft bg-surface-1 px-3 py-2.5 text-left shadow-none transition hover:border-[color-mix(in_srgb,var(--color-primary)_25%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))] hover:shadow-[0_2px_8px_rgba(37,99,235,0.08)]',
  navItemActive:
    'border-[color-mix(in_srgb,var(--color-primary)_36%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1))] shadow-[0_2px_12px_rgba(37,99,235,0.12)] before:absolute before:bottom-[20%] before:left-0 before:top-[20%] before:w-[3px] before:rounded-r-[3px] before:bg-[var(--brand-gradient-primary)] before:content-[""]',
  navItemIndex: 'text-xs font-extrabold tracking-[0.02em] text-brand-primary',
  navItemText:
    'line-clamp-2 overflow-hidden text-[13px] leading-[1.35] text-ink-strong [-webkit-box-orient:vertical] [display:-webkit-box]',
  questionCard: 'grid gap-[18px] p-[22px_24px] max-[640px]:gap-3 max-[640px]:p-3.5',
  questionText: 'm-0 text-[clamp(17px,1.55vw,19px)] font-extrabold leading-[1.3] text-ink-strong',
  questionHead: 'flex min-h-0 items-center justify-between gap-2 max-[640px]:flex-col max-[640px]:items-start',
  questionMeta: 'flex flex-wrap items-center gap-1.5',
  questionNumber: 'text-[10.5px] font-extrabold uppercase leading-none tracking-[0.02em] text-ink-soft',
  unansweredNotice:
    'rounded-xl border border-[color-mix(in_srgb,#d97706_26%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_10%,var(--surface-2))] px-3 py-2.5 text-[13px] font-bold text-[color-mix(in_srgb,#92400e_82%,var(--ink-strong))]',
  footer:
    'mt-1 flex items-center justify-between gap-2.5 border-t border-line-soft pt-3.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2 max-[640px]:[&_button]:w-full',
  position: 'text-xs font-extrabold text-ink-soft',
  optionsGrid: 'grid gap-2.5',
  optionTopline: 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start',
  optionLead: 'flex min-w-0 flex-auto items-start gap-2',
  optionLabels: 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start',
  optionText: 'm-0 min-w-0 flex-auto text-[15px] font-medium leading-normal text-ink-strong max-[640px]:text-sm',
  explanation:
    'mt-0 grid gap-2.5 rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_15%,var(--line-soft))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_4%,transparent),transparent_42%),var(--surface-2)] p-3.5',
  explanationHeader:
    'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start [&_h3]:m-0 [&_h3]:text-sm [&_h3]:font-extrabold [&_h3]:tracking-normal [&_h3]:text-ink-strong',
  explanationGrid: 'grid grid-cols-1 gap-2',
  studyList: 'm-0 grid list-none gap-[5px] p-0',
  incorrectList: 'grid gap-[7px]',
  bubbleNav: 'grid grid-cols-5 gap-2',
  bubble:
    'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none',
  bubbleActive: 'border-brand-primary bg-brand-primary text-white',
  bubbleCorrect: 'border-brand-success/25 bg-brand-success text-white',
  bubbleWrong: 'border-brand-error/25 bg-brand-error text-white',
  bubbleUnanswered: 'border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-[var(--exam-nav-idle-text)]',
  bubbleLegend:
    'mt-3 flex flex-wrap gap-4 text-xs text-ink-soft [&_i]:inline-block [&_i]:size-3 [&_i]:rounded [&_i]:border [&_span]:inline-flex [&_span]:items-center [&_span]:gap-2',
  recapAction:
    'relative w-full max-w-none flex-none [&_.qtr-popup-trigger]:min-h-[34px] [&_.qtr-popup-trigger]:whitespace-nowrap [&_.qtr-popup-trigger]:rounded-xl [&_.qtr-popup-trigger]:px-2.5 [&_.qtr-popup-trigger]:py-[7px] [&_.qtr-popup-trigger__label]:overflow-hidden [&_.qtr-popup-trigger__label]:text-ellipsis [&_.qtr-popup-trigger__label]:whitespace-nowrap [&_.qtr-popup-trigger__label]:text-xs max-[640px]:w-full max-[640px]:max-w-none',
  recapCoachmark:
    'absolute right-0 top-[calc(100%+12px)] z-20 w-[min(340px,82vw)] rounded-xl border border-blue-200/90 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-4 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.14)] ring-1 ring-blue-100/80 before:absolute before:right-7 before:top-[-7px] before:size-3.5 before:rotate-45 before:border-l before:border-t before:border-blue-200/90 before:bg-white before:content-[""] dark:border-brand-primary/25 dark:bg-surface-elevated dark:text-ink-strong dark:shadow-2xl dark:ring-white/10 dark:before:border-brand-primary/25 dark:before:bg-surface-elevated max-[640px]:fixed max-[640px]:inset-x-3 max-[640px]:bottom-3 max-[640px]:top-auto max-[640px]:w-auto max-[640px]:before:hidden',
  recapCopy:
    'grid gap-1.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-slate-600 dark:[&_p]:text-ink-medium [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:leading-tight [&_strong]:text-slate-950 dark:[&_strong]:text-ink-strong',
  recapActions: 'mt-3 flex justify-end gap-2 max-[420px]:grid max-[420px]:grid-cols-1',
  recapLink:
    'min-h-9 cursor-pointer rounded-md border border-transparent bg-[var(--brand-gradient-primary)] px-3.5 text-xs font-extrabold text-white shadow-glow transition hover:-translate-y-px hover:brightness-105',
  recapMute:
    'min-h-9 cursor-pointer rounded-md border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 dark:border-line-soft dark:bg-surface-2 dark:text-ink-medium dark:hover:bg-surface-3 dark:hover:text-ink-strong',
};

const summaryTileToneClass = {
  correct:
    'border-[color-mix(in_srgb,var(--color-success)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--surface-2))] [&_strong]:text-brand-success',
  wrong:
    'border-[color-mix(in_srgb,var(--color-error)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_9%,var(--surface-2))] [&_strong]:text-brand-error',
  unanswered:
    'border-[color-mix(in_srgb,#d97706_28%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_8%,var(--surface-2))] [&_strong]:text-[#d97706]',
};

const chipToneClass = {
  correct: 'border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_12%,var(--surface-2))] text-brand-success',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_11%,var(--surface-2))] text-brand-error',
  unanswered: 'border-[color-mix(in_srgb,#d97706_24%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_9%,var(--surface-2))] text-[#b45309]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};

const optionCardToneClass = {
  neutral: 'bg-surface-1',
  correct:
    'border-[color-mix(in_srgb,var(--color-success)_40%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-success)_10%,var(--surface-1))_0%,color-mix(in_srgb,var(--color-success)_5%,var(--surface-1))_100%)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-success)_18%,transparent),0_2px_12px_color-mix(in_srgb,var(--color-success)_12%,transparent)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-r-sm before:bg-brand-success before:content-[""]',
  wrong:
    'border-[color-mix(in_srgb,var(--color-error)_40%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-error)_9%,var(--surface-1))_0%,color-mix(in_srgb,var(--color-error)_4%,var(--surface-1))_100%)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-error)_16%,transparent),0_2px_10px_color-mix(in_srgb,var(--color-error)_10%,transparent)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-r-sm before:bg-brand-error before:content-[""]',
  unanswered:
    'border-[color-mix(in_srgb,#d97706_30%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_6%,var(--surface-1))] shadow-[0_0_0_1px_color-mix(in_srgb,#d97706_12%,transparent)]',
};

const optionIconToneClass = {
  correct:
    'border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-brand-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_12%,transparent)]',
  wrong:
    'border-[color-mix(in_srgb,var(--color-error)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)] text-brand-error shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error)_12%,transparent)]',
  unanswered: 'border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#b45309]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};

const studyCardToneClass = {
  summary:
    'border-[color-mix(in_srgb,var(--color-primary)_22%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-1))_0%,var(--surface-1)_60%)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-r-sm before:bg-[var(--brand-gradient-primary)] before:content-[""]',
  theory:
    'border-[color-mix(in_srgb,#8b5cf6_24%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_7%,var(--surface-1))_0%,var(--surface-1)_70%)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-r-sm before:bg-[linear-gradient(180deg,#7c3aed,#2563eb)] before:content-[""]',
  incorrect:
    'border-[color-mix(in_srgb,var(--color-warning)_24%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_7%,var(--surface-1))_0%,var(--surface-1)_72%)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-r-sm before:bg-[linear-gradient(180deg,#f59e0b,#f97316)] before:content-[""]',
};

function reviewChipClass(tone = 'neutral') {
  return cx(
    'inline-flex min-h-[22px] items-center gap-1.5 rounded-full border px-[7px] py-[3px] text-[10.5px] font-extrabold tracking-[0.01em]',
    chipToneClass[tone] || chipToneClass.neutral
  );
}

function reviewOptionCardClass(tone) {
  return cx(
    'relative grid gap-2 overflow-hidden rounded-2xl border-[1.5px] border-line-soft bg-surface-1 px-4 py-3.5 transition-shadow',
    optionCardToneClass[tone] || optionCardToneClass.neutral
  );
}

function reviewOptionIconClass(tone) {
  return cx(
    'inline-grid size-6 shrink-0 place-items-center rounded-full border text-xs font-extrabold',
    ['correct', 'wrong'].includes(tone) && 'text-sm',
    optionIconToneClass[tone] || optionIconToneClass.neutral
  );
}

function reviewStudyCardClass(tone, extra = '') {
  return cx(
    'relative grid gap-2 overflow-hidden rounded-xl border border-line-soft bg-surface-1 px-3 py-[11px] transition hover:border-line-medium hover:shadow-sm [&_h4]:m-0 [&_h4]:text-[11px] [&_h4]:font-extrabold [&_h4]:uppercase [&_h4]:tracking-[0.07em] [&_h4]:text-ink-soft [&_p]:m-0 [&_p]:text-[13.5px] [&_p]:leading-normal [&_p]:text-ink-strong max-[640px]:[&_p]:text-sm',
    studyCardToneClass[tone],
    extra
  );
}

function getQuestionStatusLabel(status) {
  if (status === 'correct') return 'Correct';
  if (status === 'wrong') return 'Wrong';
  return 'Unanswered';
}

function getQuestionStatusTone(status) {
  if (status === 'correct') return 'correct';
  if (status === 'wrong') return 'wrong';
  return 'unanswered';
}

function formatBooleanAnswer(value) {
  if (value === undefined || value === null) return 'Unanswered';
  return Number(value) === 1 || value === true ? 'True' : 'False';
}

function ReviewStatusChip({ status }) {
  return (
    <span className={reviewChipClass(getQuestionStatusTone(status))}>
      {getQuestionStatusLabel(status)}
    </span>
  );
}

function ReviewOptionLabels({ labels }) {
  if (!labels.length) return null;
  return (
    <div className={reviewUi.optionLabels}>
      {labels.map((label) => (
        <span className={reviewChipClass(label.tone)} key={`${label.tone}-${label.text}`}>
          {label.text}
        </span>
      ))}
    </div>
  );
}

function ReviewSbaOption({ option, question, displayLabel }) {
  const isCorrect = option.isCorrect === 1;
  const isSelected = question.answerState.selectedIds?.includes(option.id);
  const unanswered = question.answerStatus === 'unanswered';
  const tone = isSelected && !isCorrect ? 'wrong' : isCorrect ? 'correct' : unanswered ? 'unanswered' : 'neutral';
  const labels = [];

  if (isSelected) labels.push({ text: 'Your Answer', tone: isCorrect ? 'correct' : 'wrong' });
  if (isCorrect) labels.push({ text: 'Correct Answer', tone: 'correct' });
  if (isSelected && !isCorrect) labels.push({ text: 'Wrong', tone: 'wrong' });
  if (unanswered && isCorrect) labels.push({ text: 'Unanswered', tone: 'unanswered' });

  return (
    <article className={reviewOptionCardClass(tone)}>
      <div className={reviewUi.optionTopline}>
        <div className={reviewUi.optionLead}>
          <span className={reviewOptionIconClass(tone)}>
            {displayLabel}
          </span>
          <p className={reviewUi.optionText}>{option.optionText}</p>
        </div>
        <ReviewOptionLabels labels={labels} />
      </div>
    </article>
  );
}

function ReviewTrueFalseOption({ option, question, displayLabel }) {
  const studentValue = question.answerState.tfMap?.[option.id];
  const correctValue = option.isCorrect === 1 ? 1 : 0;
  const answered = studentValue !== undefined;
  const isCorrect = answered && Number(studentValue) === correctValue;
  const tone = !answered ? 'unanswered' : isCorrect ? 'correct' : 'wrong';

  return (
    <article className={reviewOptionCardClass(tone)}>
      <div className={reviewUi.optionTopline}>
        <div className={reviewUi.optionLead}>
          <span className={reviewOptionIconClass(tone)}>
            {!answered ? displayLabel : isCorrect ? '✓' : '×'}
          </span>
          <p className={reviewUi.optionText}>{option.optionText}</p>
        </div>
        <ReviewOptionLabels
          labels={[
            { text: `Your Answer: ${formatBooleanAnswer(studentValue)}`, tone: answered ? (isCorrect ? 'correct' : 'wrong') : 'unanswered' },
            { text: `Correct Answer: ${formatBooleanAnswer(correctValue)}`, tone: 'correct' },
          ]}
        />
      </div>
    </article>
  );
}

function ReviewAnswerGrid({ question }) {
  return (
    <div className={reviewUi.optionsGrid}>
      {question.options.map((option, index) => (
        question.questionType === 'true_false' ? (
          <ReviewTrueFalseOption
            key={option.id}
            option={option}
            question={question}
            displayLabel={DISPLAY_OPTION_LABELS[index] || option.optionLabel || String(index + 1)}
          />
        ) : (
          <ReviewSbaOption
            key={option.id}
            option={option}
            question={question}
            displayLabel={DISPLAY_OPTION_LABELS[index] || option.optionLabel || String(index + 1)}
          />
        )
      ))}
    </div>
  );
}

function hasReviewExplanation(question) {
  const hasDatabaseExplanation = String(question.explanation || '').trim();
  const hasIncorrectReasons = (question.options || []).some(
    (option) => Number(option.isCorrect) !== 1 && String(option.whyIncorrect || '').trim()
  );

  return Boolean(hasDatabaseExplanation || hasIncorrectReasons);
}

function hasTheoryRecap(recap) {
  return Boolean(recap && (
    recap.etiology?.length ||
    recap.pathophysiology?.length ||
    recap.clinicalFeatures?.length ||
    recap.investigations?.length ||
    recap.treatment?.length ||
    recap.keyPoints?.length ||
    recap.mnemonic
  ));
}

function ReviewExplanation({ question }) {
  const explanationBlocks = String(question.explanation || '')
    .split(/\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const [showRecapCoachmark, setShowRecapCoachmark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEORY_RECAP_COACHMARK_KEY) !== 'true';
  });
  const incorrectReasons = (question.options || [])
    .map((option, index) => ({
      ...option,
      displayLabel: DISPLAY_OPTION_LABELS[index] || option.optionLabel || String(index + 1),
    }))
    .filter((option) => Number(option.isCorrect) !== 1 && String(option.whyIncorrect || '').trim())
    .map((option) => ({
      label: option.displayLabel,
      text: option.optionText,
      reason: String(option.whyIncorrect || '').trim(),
    }));
  if (explanationBlocks.length === 0 && incorrectReasons.length === 0) return null;

  const canShowRecapCoachmark = showRecapCoachmark && hasTheoryRecap(question.theoryRecap);

  function dismissRecapCoachmark({ neverShowAgain = false } = {}) {
    if (neverShowAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(THEORY_RECAP_COACHMARK_KEY, 'true');
    }
    setShowRecapCoachmark(false);
  }

  return (
    <section className={reviewUi.explanation}>
      {question.theoryRecap !== undefined ? (
        <div className={reviewUi.recapAction} data-recap-coachmark-root>
          <TheoryRecapPopupTrigger
            recap={question.theoryRecap}
            context="review"
            revealed={true}
          />
          {canShowRecapCoachmark ? (
            <div className={reviewUi.recapCoachmark} role="status">
              <div className={reviewUi.recapCopy}>
                <strong>Need a quick theory refresh?</strong>
                <p>Open the recap to review the key points behind this question.</p>
              </div>
              <div className={reviewUi.recapActions}>
                <button className={reviewUi.recapLink}
                  type="button"
                 
                  onClick={() => dismissRecapCoachmark()}
                >
                  Got it
                </button>
                <button className={reviewUi.recapMute}
                  type="button"
                 
                  onClick={() => dismissRecapCoachmark({ neverShowAgain: true })}
                >
                  Don't show again
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={reviewUi.explanationHeader}>
        <h3>Explanation</h3>
      </div>
      <div className={reviewUi.explanationGrid}>
        {explanationBlocks.length ? (
          <article className={reviewStudyCardClass('summary', '[&_p]:whitespace-pre-wrap [&_p]:text-[13px] [&_p]:leading-[1.62]')}>
            <h4>Explanation</h4>
            {explanationBlocks.map((block, index) => (
              <p key={`${index}-${block.slice(0, 16)}`}>{block}</p>
            ))}
          </article>
        ) : null}
        {hasTheoryRecap(question.theoryRecap) ? (
          <article className={reviewStudyCardClass('theory')}>
            <h4>Key Points</h4>
            {question.theoryRecap.conceptName ? <p><strong>{question.theoryRecap.conceptName}</strong></p> : null}
            {question.theoryRecap.keyPoints?.length ? (
              <ul className={reviewUi.studyList}>
                {question.theoryRecap.keyPoints.slice(0, 4).map((point, index) => (
                  <li
                    className="relative pl-[15px] text-[13px] leading-[1.45] text-ink-strong before:absolute before:left-1 before:top-0 before:font-extrabold before:leading-[1.55] before:text-brand-primary before:content-['›'] max-[640px]:text-sm"
                    key={`${index}-${point.slice(0, 16)}`}
                  >
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}
        {incorrectReasons.length ? (
          <article className={reviewStudyCardClass('incorrect')}>
            <h4>Why other options are incorrect</h4>
            <div className={reviewUi.incorrectList}>
              {incorrectReasons.map((item) => (
                <div
                  className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2 rounded-[10px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-1))] px-[9px] py-2"
                  key={item.label}
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-warning)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] text-[11px] font-black text-[#92400e]">{item.label}</span>
                  <div>
                    <strong className="mb-[3px] block text-[12.5px] leading-[1.35] text-ink-strong">{item.text}</strong>
                    <p className="m-0 text-[13px] leading-[1.45] text-ink-strong">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

export function ReviewWorkspace({ questions, summary = null, navigatorVariant = 'cards' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const mainRef = useRef(null);
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const activeQuestion = safeQuestions[activeIndex] || null;

  useEffect(() => {
    setActiveIndex((current) => {
      if (!safeQuestions.length) return 0;
      return Math.min(current, safeQuestions.length - 1);
    });
  }, [safeQuestions.length]);

  useEffect(() => {
    if (!activeQuestion) return;
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeQuestion]);

  if (!safeQuestions.length) {
    return <div className={ui.emptyBox}>No review questions available.</div>;
  }

  const hasExplanation = hasReviewExplanation(activeQuestion);
  const showBubbleNavigator = navigatorVariant === 'bubbles';

  return (
    <section className={cx(reviewUi.shell, hasExplanation && reviewUi.shellThree)}>
      <aside className={cx(ui.compactPanelCard, reviewUi.sidebar)}>
        {summary ? (
          <div className={reviewUi.summaryGrid}>
            <div className={reviewUi.summaryTile}>
              <strong>{summary.total}</strong>
              <span>Total</span>
            </div>
            <div className={cx(reviewUi.summaryTile, summaryTileToneClass.correct)}>
              <strong>{summary.correct}</strong>
              <span>Correct</span>
            </div>
            <div className={cx(reviewUi.summaryTile, summaryTileToneClass.wrong)}>
              <strong>{summary.wrong}</strong>
              <span>Wrong</span>
            </div>
            <div className={cx(reviewUi.summaryTile, summaryTileToneClass.unanswered)}>
              <strong>{summary.unanswered}</strong>
              <span>Unanswered</span>
            </div>
          </div>
        ) : null}
        <div className={reviewUi.nav}>
          <div className={reviewUi.navHead}>
            <h3>Question List</h3>
            <span>{safeQuestions.length} total</span>
          </div>
          {showBubbleNavigator ? (
            <>
              <div className={reviewUi.bubbleNav}>
                {safeQuestions.map((question, index) => (
                  <button className={cx(
                      reviewUi.bubble,
                      index === activeIndex && reviewUi.bubbleActive,
                      index !== activeIndex && question.answerStatus === 'correct' && reviewUi.bubbleCorrect,
                      index !== activeIndex && question.answerStatus === 'wrong' && reviewUi.bubbleWrong,
                      index !== activeIndex && question.answerStatus === 'unanswered' && reviewUi.bubbleUnanswered
                    )}
                    key={question.id}
                    type="button"
                   
                    onClick={() => setActiveIndex(index)}
                    title={`Question ${index + 1} • ${getQuestionStatusLabel(question.answerStatus)}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <div className={reviewUi.bubbleLegend}>
                <span><i className="border-transparent bg-[#2563EB]" />Current</span>
                <span><i className="border-transparent bg-[#4CC46A]" />Correct</span>
                <span><i className="border-transparent bg-[#ef4444]" />Wrong</span>
                <span><i className="border-[var(--exam-nav-idle-border)] bg-[var(--exam-progress-track)]" />Unanswered</span>
              </div>
            </>
          ) : (
            <div className={reviewUi.navList}>
              {safeQuestions.map((question, index) => (
                <button className={cx(reviewUi.navItem, index === activeIndex && reviewUi.navItemActive)}
                  key={question.id}
                  type="button"
                 
                  onClick={() => setActiveIndex(index)}
                >
                  <span className={reviewUi.navItemIndex}>Q{index + 1}</span>
                  <span className={reviewUi.navItemText}>{question.questionText}</span>
                  <ReviewStatusChip status={question.answerStatus} />
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className={reviewUi.main} ref={mainRef}>
        <article className={cx(ui.panelCard, reviewUi.questionCard)}>
          <h2 className={reviewUi.questionText}>{activeQuestion.questionText}</h2>

          <div className={reviewUi.questionHead}>
            <div className={reviewUi.questionMeta}>
              <span className={reviewUi.questionNumber}>Question {activeIndex + 1} of {safeQuestions.length}</span>
              <span className={reviewChipClass('neutral')}>
                {activeQuestion.questionType === 'true_false' ? 'True / False' : 'SBA'}
              </span>
            </div>
            <ReviewStatusChip status={activeQuestion.answerStatus} />
          </div>

          {activeQuestion.answerStatus === 'unanswered' ? (
            <div className={reviewUi.unansweredNotice}>
              Unanswered question. The correct answer is still highlighted below.
            </div>
          ) : null}

          <ReviewAnswerGrid question={activeQuestion} />

          <div className={reviewUi.footer}>
            <button className={ui.secondaryAction}
              type="button"
             
              onClick={() => setActiveIndex((value) => Math.max(value - 1, 0))}
              disabled={activeIndex === 0}
            >
              Previous
            </button>
            <span className={reviewUi.position}>Question {activeIndex + 1} / {safeQuestions.length}</span>
            <button className={ui.primaryAction}
              type="button"
             
              onClick={() => setActiveIndex((value) => Math.min(value + 1, safeQuestions.length - 1))}
              disabled={activeIndex >= safeQuestions.length - 1}
            >
              Next
            </button>
          </div>
        </article>
      </section>

      {hasExplanation ? (
        <aside className={reviewUi.explanationSide}>
          <ReviewExplanation question={activeQuestion} />
        </aside>
      ) : null}
    </section>
  );
}
