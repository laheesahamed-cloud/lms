import { useEffect, useRef, useState } from 'react';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function isCorrectOption(option) {
  const value = option?.isCorrect ?? option?.is_correct ?? option?.correct;
  if (value === true) return true;
  if (value === false) return false;
  if (value === 1 || value === 0) return value === 1;
  return ['1', 'true', 'correct', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function normalizeTrueFalseValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'correct', 'yes'].includes(normalized)) return 1;
  if (['false', 'incorrect', 'no'].includes(normalized)) return 0;
  return null;
}

const reviewUi = {
  shell:
    'lms-review-workspace mx-auto grid w-full grid-cols-[minmax(240px,300px)_minmax(0,780px)_minmax(240px,300px)] items-start justify-center gap-[18px] max-[1180px]:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] max-[900px]:grid-cols-1',
  shellThree:
    '',
  shellFocus:
    'lms-review-workspace lms-review-workspace--focus mx-auto grid w-full grid-cols-1 items-start',
  sidebar:
    'lms-review-sidebar sticky top-6 grid max-h-[calc(100dvh-48px)] gap-3.5 overflow-hidden max-[900px]:static max-[900px]:max-h-none max-[900px]:overflow-visible',
  main: 'lms-review-main min-w-0',
  mainFocus: 'lms-review-main lms-review-main--focus w-full min-w-0',
  explanationSide:
    'lms-review-explanation-side sticky top-6 grid max-h-[calc(100dvh-48px)] min-w-0 gap-3.5 overflow-auto overscroll-contain max-[1180px]:col-span-2 max-[900px]:hidden',
  summaryGrid: 'lms-review-summary-grid grid grid-cols-4 gap-2 max-[420px]:gap-1.5',
  summaryTile:
    'lms-review-summary-tile grid min-h-[64px] place-items-center gap-1 rounded-[14px] border border-line-soft bg-surface-1 px-2 py-2 text-center shadow-none [&_span]:text-[9px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.06em] [&_span]:text-ink-soft [&_strong]:text-[clamp(17px,4.6vw,22px)] [&_strong]:font-bold [&_strong]:leading-none [&_strong]:tracking-normal [&_strong]:text-ink-strong max-[420px]:min-h-[58px] max-[420px]:rounded-xl max-[420px]:px-1.5 max-[420px]:[&_span]:text-[8px]',
  nav: 'lms-review-side-nav grid min-h-0 gap-2.5',
  navHead: 'flex items-baseline justify-between gap-2.5 [&_h3]:m-0 [&_h3]:text-[13px] [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-soft',
  navList: 'lms-review-nav-list grid min-h-0 gap-2 overflow-y-auto pr-1 max-[980px]:max-h-60',
  navItem:
    'relative grid w-full justify-items-start gap-[5px] rounded-[14px] border-[1.5px] border-line-soft bg-surface-1 px-3 py-2.5 text-left shadow-none transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_25%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))]',
  navItemActive:
    'border-[color-mix(in_srgb,var(--color-primary)_36%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1))] shadow-none before:absolute before:bottom-[20%] before:left-0 before:top-[20%] before:w-[3px] before:rounded-r-[3px] before:bg-[var(--brand-gradient-primary)] before:content-[""]',
  navItemIndex: 'text-xs font-extrabold tracking-[0.02em] text-brand-primary',
  navItemText:
    'line-clamp-2 overflow-hidden text-[13px] leading-[1.35] text-ink-strong [-webkit-box-orient:vertical] [display:-webkit-box]',
  questionCard: 'lms-review-question-card grid gap-[16px] p-[22px_24px] max-[640px]:gap-3.5 max-[640px]:p-3.5',
  questionText: 'lms-reading-question m-0 max-w-[76ch] whitespace-pre-line text-left text-[16px] font-medium leading-[1.62] tracking-normal text-ink-strong [text-wrap:pretty] max-[640px]:text-[15.5px] max-[640px]:leading-[1.6]',
  questionHead: 'flex min-h-0 items-center justify-between gap-2 max-[640px]:flex-col max-[640px]:items-start',
  questionMeta: 'flex flex-wrap items-center gap-1.5',
  questionNumber: 'text-[10.5px] font-extrabold uppercase leading-none tracking-[0.02em] text-ink-soft',
  questionNav:
    'lms-review-question-nav flex items-center justify-between gap-2.5 border-t border-line-soft pt-4 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-2',
  questionNavActions:
    'flex items-center justify-end gap-2.5 max-[640px]:grid max-[640px]:grid-cols-2 max-[640px]:[&_button]:w-full',
  position: 'text-xs font-extrabold text-ink-soft',
  optionsGrid: 'lms-review-options-grid grid gap-2.5',
  optionTopline: 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start',
  optionLead: 'flex min-w-0 flex-auto items-start gap-2',
  optionLabels: 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start',
  optionText: 'lms-reading-answer m-0 min-w-0 flex-auto whitespace-pre-line text-left text-[15px] font-medium leading-[1.48] text-ink-strong max-[640px]:text-sm max-[640px]:leading-[1.45]',
  explanation:
    'mt-0 grid gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_15%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-2))] p-4 shadow-none max-[640px]:rounded-xl max-[640px]:p-3',
  explanationEmpty:
    'grid gap-1 rounded-[16px] border border-dashed border-line-soft bg-surface-2 p-4 text-sm leading-relaxed text-ink-soft [&_strong]:text-ink-strong',
  explanationHeader:
    'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start [&_h3]:m-0 [&_h3]:text-[12px] [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-[0.11em] [&_h3]:text-ink-soft max-[640px]:[&_h3]:text-[11px]',
  explanationGrid: 'grid grid-cols-1 gap-3',
  explanationCopy:
    'lms-reading-explanation grid gap-2.5 text-left [&_p]:m-0 [&_p]:max-w-[78ch] [&_p]:whitespace-pre-line [&_p]:text-[15px] [&_p]:font-normal [&_p]:leading-[1.66] [&_p]:tracking-normal [&_p]:text-ink-medium [&_p]:[text-wrap:pretty] max-[640px]:[&_p]:text-[14.5px] max-[640px]:[&_p]:leading-[1.62]',
  studyList: 'm-0 grid list-none gap-[5px] p-0',
  incorrectList:
    'overflow-hidden rounded-[12px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-2))]',
  incorrectItem:
    'grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 border-t border-[color-mix(in_srgb,var(--color-warning)_14%,var(--line-soft))] px-2.5 py-2 first:border-t-0 max-[640px]:grid-cols-[22px_minmax(0,1fr)] max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-1.5',
  incorrectBadge:
    'inline-flex size-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-warning)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] text-[11px] font-black text-[#92400e] max-[640px]:size-[22px] max-[640px]:text-[10px]',
  incorrectCopy:
    'lms-reading-incorrect min-w-0 text-left [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:leading-snug [&_strong]:text-ink-strong [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-[13.5px] [&_p]:font-normal [&_p]:leading-[1.56] [&_p]:text-ink-medium max-[640px]:[&_strong]:text-[12.5px] max-[640px]:[&_p]:text-[13px] max-[640px]:[&_p]:leading-[1.52]',
  bubbleNav: 'lms-review-bubble-nav grid grid-cols-5 gap-2',
  bubble:
    'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity] duration-150 active:opacity-80',
  bubbleActive:
    'border-brand-primary/38 bg-brand-primary/12 text-brand-primary shadow-none',
  bubbleCorrect: 'border-brand-success/30 bg-brand-success/12 text-brand-success',
  bubbleWrong: 'border-brand-error/30 bg-brand-error/12 text-brand-error',
  bubbleUnanswered: 'border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-[var(--exam-nav-idle-text)]',
  bubbleLegend:
    'mt-3 grid grid-cols-4 items-center gap-1.5 text-[10.5px] font-bold leading-tight text-ink-soft [&_i]:inline-block [&_i]:size-2.5 [&_i]:shrink-0 [&_i]:rounded [&_i]:border [&_span]:inline-flex [&_span]:min-w-0 [&_span]:items-center [&_span]:gap-1 [&_span]:whitespace-nowrap',
  recapAction:
    'relative w-full max-w-none flex-none [&_.qtr-popup-trigger]:min-h-11 [&_.qtr-popup-trigger]:rounded-xl [&_.qtr-popup-trigger]:px-3 [&_.qtr-popup-trigger]:py-2.5 [&_.qtr-popup-trigger__label]:text-[13px] max-[640px]:w-full max-[640px]:max-w-none max-[640px]:[&_.qtr-popup-trigger]:min-h-12 max-[640px]:[&_.qtr-popup-trigger]:rounded-2xl max-[640px]:[&_.qtr-popup-trigger__concept]:max-w-[42vw]',
};

const reviewSecondaryButtonClass =
  'min-h-11 rounded-xl border border-[var(--exam-footer-btn-border,var(--sa-border))] bg-[var(--exam-footer-btn-bg,var(--sa-surface))] px-[18px] text-sm font-bold text-[var(--exam-footer-btn-text,var(--sa-ink))] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const reviewPrimaryButtonClass =
  'min-h-11 rounded-xl border border-brand-primary/30 bg-[var(--color-primary-light)] px-[18px] text-sm font-bold text-brand-primary shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';

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
    'border-[color-mix(in_srgb,var(--color-success)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--surface-1))] shadow-none',
  wrong:
    'border-[color-mix(in_srgb,var(--color-error)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_9%,var(--surface-1))] shadow-none',
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
    'border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))_0%,var(--surface-1)_72%)]',
  theory:
    'border-[color-mix(in_srgb,#8b5cf6_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_5%,var(--surface-1))_0%,var(--surface-1)_74%)]',
  incorrect:
    'border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_5%,var(--surface-1))_0%,var(--surface-1)_74%)]',
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
    'relative grid gap-2 rounded-[14px] border border-line-soft bg-surface-1 px-3.5 py-3 transition-colors hover:border-line-medium [&_h4]:m-0 [&_h4]:text-[11px] [&_h4]:font-extrabold [&_h4]:uppercase [&_h4]:tracking-[0.07em] [&_h4]:text-ink-soft [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-left [&_p]:text-[13.5px] [&_p]:font-normal [&_p]:leading-[1.58] [&_p]:text-ink-strong max-[640px]:[&_p]:text-sm',
    studyCardToneClass[tone],
    extra
  );
}

function getPreferredScrollBehavior() {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function getScrollableReviewRoot() {
  if (typeof document === 'undefined') return null;
  const candidates = [
    document.querySelector('.lms-app-scroll-root'),
    document.querySelector('.portal-content'),
    document.scrollingElement,
    document.documentElement,
  ].filter(Boolean);

  return candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight + 2) || null;
}

function getReviewScrollOffset() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 14;
  const header = document.querySelector('.practice-review-header');
  if (!header || window.innerWidth <= 760) return 14;
  return Math.min(header.getBoundingClientRect().height + 22, 96);
}

function scrollReviewTargetIntoView(target, behavior = getPreferredScrollBehavior()) {
  if (!target || typeof window === 'undefined') return;
  const scrollRoot = getScrollableReviewRoot();
  const offset = getReviewScrollOffset();

  if (scrollRoot && scrollRoot !== document.documentElement && scrollRoot !== document.body) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    scrollRoot.scrollTo({
      top: Math.max(scrollRoot.scrollTop + targetRect.top - rootRect.top - offset, 0),
      behavior,
    });
    return;
  }

  window.scrollTo({
    top: Math.max(window.scrollY + target.getBoundingClientRect().top - offset, 0),
    behavior,
  });
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
  const normalized = normalizeTrueFalseValue(value);
  if (normalized === null) return 'Unanswered';
  return normalized === 1 ? 'True' : 'False';
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
  const isCorrect = isCorrectOption(option);
  const isSelected = (question.answerState.selectedIds || []).map(Number).includes(Number(option.id));
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
  const studentValue = normalizeTrueFalseValue(question.answerState.tfMap?.[option.id]);
  const correctValue = isCorrectOption(option) ? 1 : 0;
  const answered = studentValue !== null;
  const isCorrect = answered && studentValue === correctValue;
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
  const isTrueFalse = question?.questionType === 'true_false' || question?.question_type === 'true_false';
  const hasIncorrectReasons = (question.options || []).some(
    (option) => (isTrueFalse || !isCorrectOption(option)) && String(option.whyIncorrect || '').trim()
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
  const isTrueFalse = question?.questionType === 'true_false' || question?.question_type === 'true_false';
  const explanationBlocks = String(question.explanation || '')
    .split(/\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const incorrectReasons = (question.options || [])
    .map((option, index) => ({
      ...option,
      displayLabel: DISPLAY_OPTION_LABELS[index] || option.optionLabel || String(index + 1),
    }))
    .filter((option) => (isTrueFalse || !isCorrectOption(option)) && String(option.whyIncorrect || '').trim())
    .map((option) => ({
      label: option.displayLabel,
      text: option.optionText,
      reason: String(option.whyIncorrect || '').trim(),
    }));
  if (explanationBlocks.length === 0 && incorrectReasons.length === 0) return null;
  const explanationTitle = explanationBlocks.length
    ? 'Explanation'
    : incorrectReasons.length
      ? 'Why other options are incorrect'
      : 'Explanation';

  return (
    <section className={reviewUi.explanation}>
      <div className={reviewUi.explanationHeader}>
        <h3>{explanationTitle}</h3>
      </div>
      <div className={reviewUi.explanationGrid}>
        {explanationBlocks.length ? (
          <div className={reviewUi.explanationCopy}>
            {explanationBlocks.map((block, index) => (
              <p key={`${index}-${block.slice(0, 16)}`}>{block}</p>
            ))}
          </div>
        ) : null}
        {question.theoryRecap !== undefined ? (
          <div className={reviewUi.recapAction}>
            <TheoryRecapPopupTrigger
              recap={question.theoryRecap}
              context="review"
              revealed={true}
            />
          </div>
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
          <div className={reviewUi.incorrectList} aria-label="Why other options are incorrect">
            {incorrectReasons.map((item) => (
              <div className={reviewUi.incorrectItem} key={item.label}>
                <span className={reviewUi.incorrectBadge}>{item.label}</span>
                <div className={reviewUi.incorrectCopy}>
                  <strong>{item.text}</strong>
                  <p>{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReviewExplanationEmpty() {
  return (
    <section className={reviewUi.explanationEmpty}>
      <strong>Explanation</strong>
      <span>No written explanation is available for this question.</span>
    </section>
  );
}

export function ReviewWorkspace({
  questions,
  summary = null,
  navigatorVariant = 'cards',
  exitLabel = 'Done',
  onExit = null,
  focusQuestionOnly = false,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const mainRef = useRef(null);
  const questionCardRef = useRef(null);
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
    const target = questionCardRef.current || mainRef.current;
    const frame = window.requestAnimationFrame(() => {
      scrollReviewTargetIntoView(target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeQuestion]);

  if (!safeQuestions.length) {
    return <div className={ui.emptyBox}>No review questions available.</div>;
  }

  const hasExplanation = hasReviewExplanation(activeQuestion);
  const showBubbleNavigator = navigatorVariant === 'bubbles';
  const shellClass = focusQuestionOnly
    ? reviewUi.shellFocus
    : cx(reviewUi.shell, reviewUi.shellThree);
  const questionNavigation = (
    <nav className={reviewUi.questionNav} aria-label="Review question navigation">
      <span className={reviewUi.position}>Question {activeIndex + 1} / {safeQuestions.length}</span>
      <div className={reviewUi.questionNavActions}>
        <button className={reviewSecondaryButtonClass}
          type="button"
          onClick={() => setActiveIndex((value) => Math.max(value - 1, 0))}
          disabled={activeIndex === 0}
        >
          Previous
        </button>
        {activeIndex >= safeQuestions.length - 1 ? (
          <button className={reviewPrimaryButtonClass}
            type="button"
            onClick={onExit || undefined}
            disabled={!onExit}
          >
            {exitLabel}
          </button>
        ) : (
          <button className={reviewPrimaryButtonClass}
            type="button"
            onClick={() => setActiveIndex((value) => Math.min(value + 1, safeQuestions.length - 1))}
          >
            Next
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <>
    <section className={shellClass}>
      {!focusQuestionOnly ? (
      <aside className={reviewUi.sidebar}>
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
                <span><i className="border-brand-primary/30 bg-brand-primary/30" />Current</span>
                <span><i className="border-brand-success/30 bg-brand-success/30" />Correct</span>
                <span><i className="border-brand-error/30 bg-brand-error/30" />Wrong</span>
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
      ) : null}

      <section className={focusQuestionOnly ? reviewUi.mainFocus : reviewUi.main} ref={mainRef}>
        <article className={reviewUi.questionCard} ref={questionCardRef}>
          <p className={reviewUi.questionText}>{activeQuestion.questionText}</p>

          <div className={reviewUi.questionHead}>
            <div className={reviewUi.questionMeta}>
              <span className={reviewUi.questionNumber}>Question {activeIndex + 1} of {safeQuestions.length}</span>
              <span className={reviewChipClass('neutral')}>
                {activeQuestion.questionType === 'true_false' ? 'True / False' : 'SBA'}
              </span>
            </div>
            <ReviewStatusChip status={activeQuestion.answerStatus} />
          </div>

          <ReviewAnswerGrid question={activeQuestion} />

          <div className={focusQuestionOnly ? '' : 'min-[901px]:hidden'}>
            {hasExplanation ? <ReviewExplanation question={activeQuestion} /> : <ReviewExplanationEmpty />}
          </div>

          {questionNavigation}
        </article>
      </section>

      {!focusQuestionOnly ? (
        <aside className={reviewUi.explanationSide}>
          {hasExplanation ? <ReviewExplanation question={activeQuestion} /> : <ReviewExplanationEmpty />}
        </aside>
      ) : null}
    </section>
    </>
  );
}
