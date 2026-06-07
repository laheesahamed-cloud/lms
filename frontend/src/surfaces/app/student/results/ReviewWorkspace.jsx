import { useEffect, useRef, useState } from 'react';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { createQuestionReport } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { MedicalText } from '../../../../shared/components/MedicalText.jsx';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { hasQuickTheoryRecapContent, normalizeQuickTheoryRecap } from '../components/quickTheoryRecapUtils.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';

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
    'lms-review-workspace mx-auto grid w-full grid-cols-[minmax(220px,280px)_minmax(0,1040px)_minmax(220px,280px)] items-start justify-center gap-[clamp(16px,2vw,24px)] max-[1199px]:grid-cols-1',
  shellThree:
    '',
  shellFocus:
    'lms-review-workspace lms-review-workspace--focus mx-auto grid w-full grid-cols-1 items-start',
  sidebar:
    'lms-review-sidebar sticky top-6 grid max-h-[calc(100dvh-48px)] gap-3.5 overflow-hidden max-[900px]:static max-[900px]:max-h-none max-[900px]:overflow-visible',
  main: 'lms-review-main min-w-0',
  mainFocus: 'lms-review-main lms-review-main--focus w-full min-w-0',
  explanationSide:
    'lms-review-explanation-side sticky top-6 grid max-h-[calc(100dvh-48px)] min-w-0 gap-3.5 overflow-auto overscroll-contain max-[1180px]:hidden',
  summaryGrid: 'lms-review-summary-grid grid grid-cols-4 gap-2 max-[420px]:gap-1.5',
  summaryTile:
    'lms-review-summary-tile grid min-h-[64px] place-items-center gap-1 rounded-[14px] border border-line-soft bg-surface-1 px-2 py-2 text-center shadow-none [&_span]:whitespace-nowrap [&_span]:text-[11px] [&_span]:font-bold [&_span]:uppercase [&_span]:leading-tight [&_span]:tracking-[0.06em] [&_span]:text-ink-soft [&_strong]:text-[20px] [&_strong]:font-bold [&_strong]:leading-none [&_strong]:tracking-normal [&_strong]:text-ink-strong max-[420px]:min-h-[58px] max-[420px]:rounded-xl max-[420px]:px-1.5 max-[420px]:[&_span]:text-[11px] max-[420px]:[&_strong]:text-[18px]',
  nav: 'lms-review-side-nav grid min-h-0 gap-2.5',
  navHead: 'flex items-baseline justify-between gap-2.5 [&_h3]:m-0 [&_h3]:text-[13px] [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-soft',
  navList: 'lms-review-nav-list grid min-h-0 gap-2 overflow-y-auto pr-1 max-[980px]:max-h-60',
  navItem:
    'relative grid w-full justify-items-start gap-[5px] rounded-[14px] border-[1.5px] border-line-soft bg-surface-1 px-3 py-2.5 text-left shadow-none transition-[background,border-color] duration-150 ease-[var(--ease-out)] hover:border-[color-mix(in_srgb,var(--color-primary)_25%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))]',
  navItemActive:
    'border-[color-mix(in_srgb,var(--color-primary)_36%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1))] shadow-none before:absolute before:bottom-[20%] before:left-0 before:top-[20%] before:w-[3px] before:rounded-r-[3px] before:bg-[var(--brand-gradient-primary)] before:content-[""]',
  navItemIndex: 'text-xs font-extrabold tracking-[0.02em] text-brand-primary',
  navItemText:
    'line-clamp-2 overflow-hidden text-[13px] leading-[1.35] text-ink-strong [-webkit-box-orient:vertical] [display:-webkit-box]',
  questionCard: 'lms-review-question-card grid gap-[clamp(16px,2vw,22px)] p-[clamp(24px,3vw,40px)] max-[640px]:gap-3.5 max-[640px]:p-4',
  questionText: 'lms-reading-question m-0 max-w-[82ch] whitespace-pre-line text-left text-[16px] font-medium leading-[1.62] tracking-normal text-ink-strong [text-wrap:pretty] max-[640px]:text-[16px] max-[640px]:leading-[1.6]',
  questionHead: 'flex min-h-0 items-center justify-between gap-2 max-[640px]:flex-col max-[640px]:items-start',
  questionMeta: 'flex flex-wrap items-center gap-1.5',
  questionNumber: 'text-[11px] font-extrabold uppercase leading-none tracking-[0.02em] text-ink-soft',
  questionNav:
    'lms-review-question-nav flex items-center justify-end gap-2.5 border-t border-line-soft pt-4 max-[640px]:items-end max-[640px]:gap-2',
  questionNavActions:
    'lms-review-nav-actions flex min-w-0 items-center justify-end gap-2.5',
  position: 'lms-review-position text-xs font-extrabold text-ink-soft',
  optionsGrid: 'lms-review-options-grid grid gap-3 max-[640px]:gap-2.5',
  optionTopline: 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start',
  optionLead: 'flex min-w-0 flex-auto items-start gap-2',
  optionLabels: 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start',
  optionText: 'lms-reading-answer m-0 min-w-0 flex-auto whitespace-pre-line text-left text-[15.5px] font-medium leading-[1.52] text-ink-strong max-[640px]:text-[15.5px] max-[640px]:leading-[1.5]',
  explanation:
    'lms-learning-reveal-card mt-0 grid gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_5%,var(--surface-2))_0%,var(--surface-2)_58%,color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1))_100%)] p-4 shadow-[0_14px_34px_color-mix(in_srgb,var(--color-primary)_7%,transparent)] max-[640px]:rounded-[16px] max-[640px]:p-3.5',
  incorrectExplanation:
    'lms-learning-reveal-card mt-0 grid gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_7%,var(--surface-2))_0%,var(--surface-2)_62%,color-mix(in_srgb,var(--color-warning)_4%,var(--surface-1))_100%)] p-4 shadow-[0_14px_34px_color-mix(in_srgb,var(--color-warning)_8%,transparent)] max-[640px]:rounded-[16px] max-[640px]:p-3.5',
  explanationEmpty:
    'grid gap-1 rounded-[16px] border border-dashed border-line-soft bg-surface-2 p-4 text-sm leading-relaxed text-ink-soft [&_strong]:text-ink-strong',
  explanationHeader:
    'flex items-center justify-between gap-2.5 border-b border-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] pb-2.5 max-[640px]:flex-col max-[640px]:items-start [&_h3]:m-0 [&_h3]:text-[12px] [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-[0.11em] [&_h3]:text-ink-soft max-[640px]:[&_h3]:text-[11px]',
  explanationGrid: 'grid grid-cols-1 gap-3.5',
  explanationCopy:
    'lms-reading-explanation grid gap-2.5 text-left [&_p]:m-0 [&_p]:max-w-[78ch] [&_p]:whitespace-pre-line [&_p]:text-[15.5px] [&_p]:font-normal [&_p]:leading-[1.72] [&_p]:tracking-normal [&_p]:text-ink-medium [&_p]:[text-wrap:pretty] max-[640px]:[&_p]:text-[15.5px] max-[640px]:[&_p]:leading-[1.68]',
  studyList: 'm-0 grid list-none gap-2 p-0',
  incorrectList:
    'overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-2))]',
  incorrectItem:
    'grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 border-t border-[color-mix(in_srgb,var(--color-warning)_14%,var(--line-soft))] px-2.5 py-2 first:border-t-0 max-[640px]:grid-cols-[22px_minmax(0,1fr)] max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-1.5',
  incorrectBadge:
    'inline-flex size-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-warning)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] text-[11px] font-black text-[#92400e] dark:text-[#fbbf24] max-[640px]:size-[22px] max-[640px]:text-[11px]',
  incorrectCopy:
    'lms-reading-incorrect min-w-0 text-left [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[14px] [&_strong]:font-extrabold [&_strong]:leading-snug [&_strong]:text-ink-strong [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-[14.5px] [&_p]:font-normal [&_p]:leading-[1.6] [&_p]:text-ink-medium max-[640px]:[&_strong]:text-[14px] max-[640px]:[&_p]:text-[14.5px] max-[640px]:[&_p]:leading-[1.58]',
  bubbleNav: 'lms-review-bubble-nav grid grid-cols-5 gap-2',
  bubble:
    'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] active:opacity-80',
  bubbleActive:
    'border-brand-primary/38 bg-brand-primary/12 text-brand-primary shadow-none',
  bubbleCorrect: 'border-brand-success/30 bg-brand-success/12 text-brand-success',
  bubbleWrong: 'border-brand-error/30 bg-brand-error/12 text-brand-error',
  bubbleUnanswered: 'border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-[var(--exam-nav-idle-text)]',
  bubbleLegend:
    'lms-review-bubble-legend mt-3 grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] items-center gap-2 text-[11px] font-bold leading-tight text-ink-soft [&_i]:inline-block [&_i]:size-2.5 [&_i]:shrink-0 [&_i]:rounded-full [&_i]:border [&_span]:inline-flex [&_span]:min-h-5 [&_span]:min-w-0 [&_span]:items-center [&_span]:gap-1.5 [&_span]:whitespace-nowrap',
  recapAction:
    'relative w-full max-w-none flex-none [&_.qtr-popup-trigger]:min-h-11 [&_.qtr-popup-trigger]:rounded-xl [&_.qtr-popup-trigger]:px-3 [&_.qtr-popup-trigger]:py-2.5 [&_.qtr-popup-trigger__label]:text-[13px] max-[640px]:w-full max-[640px]:max-w-none max-[640px]:[&_.qtr-popup-trigger]:min-h-12 max-[640px]:[&_.qtr-popup-trigger]:rounded-2xl max-[640px]:[&_.qtr-popup-trigger__concept]:max-w-[42vw]',
  questionActions:
    'lms-question-utility-row flex flex-wrap items-center justify-end gap-2.5 border-t border-line-soft pt-3 max-[640px]:justify-end',
};

export const reviewSecondaryButtonClass =
  'lms-assessment-btn lms-assessment-btn--secondary inline-flex min-h-11 min-w-[112px] touch-manipulation items-center justify-center gap-2 rounded-xl border border-[var(--exam-footer-btn-border,var(--sa-border))] bg-[var(--exam-footer-btn-bg,var(--sa-surface))] px-[18px] text-center text-sm font-bold leading-tight text-[var(--exam-footer-btn-text,var(--sa-ink))] shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/28 hover:bg-brand-primary/8 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] active:scale-[0.98] active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 max-[420px]:min-w-0 max-[420px]:px-3';
export const reviewPrimaryButtonClass =
  'lms-assessment-btn lms-assessment-btn--primary inline-flex min-h-11 min-w-[112px] touch-manipulation items-center justify-center rounded-xl border border-brand-primary/35 bg-[var(--color-primary-light)] px-[18px] text-center text-sm font-bold leading-tight text-brand-primary shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/45 hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--surface-1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] active:scale-[0.98] active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 max-[420px]:min-w-0 max-[420px]:px-3';

const summaryTileToneClass = {
  correct:
    'border-[color-mix(in_srgb,var(--color-success)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--surface-2))] [&_strong]:text-brand-success',
  wrong:
    'border-[color-mix(in_srgb,var(--color-error)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_9%,var(--surface-2))] [&_strong]:text-brand-error',
  unanswered:
    'border-[color-mix(in_srgb,#d97706_28%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_8%,var(--surface-2))] [&_strong]:text-[#92400e] dark:[&_strong]:text-[#fbbf24]',
};

const chipToneClass = {
  correct: 'border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_12%,var(--surface-2))] text-brand-success',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_11%,var(--surface-2))] text-brand-error',
  unanswered: 'border-[color-mix(in_srgb,#d97706_24%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_9%,var(--surface-2))] text-[#92400e] dark:text-[#fbbf24]',
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
  unanswered: 'border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#92400e] dark:text-[#fbbf24]',
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
    'inline-flex min-h-[22px] items-center gap-1.5 rounded-full border px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.01em]',
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
    'lms-key-points-card relative grid gap-3 rounded-[18px] border border-line-soft bg-surface-1 px-4 py-3.5 shadow-[0_12px_28px_color-mix(in_srgb,#8b5cf6_7%,transparent)] transition-[background,border-color] duration-150 ease-[var(--ease-out)] hover:border-line-medium [&_h4]:m-0 [&_h4]:text-[11px] [&_h4]:font-extrabold [&_h4]:uppercase [&_h4]:tracking-[0.08em] [&_h4]:text-ink-soft [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-left [&_p]:text-[14.5px] [&_p]:font-normal [&_p]:leading-[1.66] [&_p]:text-ink-strong max-[640px]:rounded-[16px] max-[640px]:px-3.5 max-[640px]:[&_p]:text-[14.5px]',
    studyCardToneClass[tone],
    extra
  );
}

function IcoBookmark({ filled = false }) {
  return (
    <svg aria-hidden="true" className="size-4" fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24">
      <path
        d="M7 4.75A2.25 2.25 0 0 1 9.25 2.5h5.5A2.25 2.25 0 0 1 17 4.75v15.1a.7.7 0 0 1-1.08.59L12 17.92l-3.92 2.52A.7.7 0 0 1 7 19.85V4.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IcoReport() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 8.25v4.25m0 3.25h.01M10.2 3.9 2.85 17.1A2.25 2.25 0 0 0 4.82 20.5h14.36a2.25 2.25 0 0 0 1.97-3.4L13.8 3.9a2.07 2.07 0 0 0-3.6 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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

function getReviewQuestionNavLabel(index, question, active = false) {
  return `Question ${index + 1}, ${active ? 'current, ' : ''}${getQuestionStatusLabel(question?.answerStatus).toLowerCase()}`;
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
  if (isCorrect) labels.push({ text: 'Correct', tone: 'correct' });
  if (isSelected && !isCorrect) labels.push({ text: 'Wrong', tone: 'wrong' });
  if (unanswered && isCorrect) labels.push({ text: 'Unanswered', tone: 'unanswered' });

  return (
    <article className={reviewOptionCardClass(tone)}>
      <div className={reviewUi.optionTopline}>
        <div className={reviewUi.optionLead}>
          <span className={reviewOptionIconClass(tone)} aria-hidden="true">
            {displayLabel}
          </span>
          <MedicalText as="p" className={reviewUi.optionText} text={option.optionText} />
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
          <span className={reviewOptionIconClass(tone)} aria-hidden="true">
            {!answered ? displayLabel : isCorrect ? '✓' : '×'}
          </span>
          <MedicalText as="p" className={reviewUi.optionText} text={option.optionText} />
        </div>
        <ReviewOptionLabels
          labels={[
            { text: `Your Answer: ${formatBooleanAnswer(studentValue)}`, tone: answered ? (isCorrect ? 'correct' : 'wrong') : 'unanswered' },
            { text: `Correct: ${formatBooleanAnswer(correctValue)}`, tone: 'correct' },
          ]}
        />
      </div>
    </article>
  );
}

function ReviewAnswerGrid({ question }) {
  return (
    <div className={reviewUi.optionsGrid} aria-label="Answer options and scoring">
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

function ReviewStudySupport({ question }) {
  const recap = normalizeQuickTheoryRecap(question?.theoryRecap);
  const hasRecap = Boolean(question && Object.prototype.hasOwnProperty.call(question, 'theoryRecap'));
  const hasStudyCard = hasQuickTheoryRecapContent(recap);

  if (!hasRecap && !hasStudyCard) return null;

  return (
    <div className="lms-study-support-stack grid gap-3">
      {hasRecap ? (
        <div className={reviewUi.recapAction}>
          <TheoryRecapPopupTrigger
            recap={recap}
            context="review"
            revealed={true}
          />
        </div>
      ) : null}
      {hasStudyCard ? (
        <article className={reviewStudyCardClass('theory')}>
          <h4>Key Points</h4>
          {recap.conceptName ? <p><MedicalText as="strong" text={recap.conceptName} /></p> : null}
          {recap.keyPoints?.length ? (
            <ul className={reviewUi.studyList}>
              {recap.keyPoints.slice(0, 4).map((point, index) => (
                <li
                  className="relative rounded-[12px] border border-[color-mix(in_srgb,#8b5cf6_12%,var(--line-soft))] bg-[color-mix(in_srgb,#8b5cf6_4%,var(--surface-2))] py-2 pl-8 pr-3 text-[14.5px] leading-[1.6] text-ink-strong before:absolute before:left-3 before:top-2 before:font-extrabold before:leading-[1.35] before:text-brand-primary before:content-['›'] max-[640px]:text-[14.5px]"
                  key={`${index}-${point.slice(0, 16)}`}
                >
                  <MedicalText text={point} />
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
    </div>
  );
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
    <div className="grid gap-3">
      {explanationBlocks.length ? (
        <section className={reviewUi.explanation} aria-label="Answer explanation">
          <div className={reviewUi.explanationHeader}>
            <h3>Explanation</h3>
          </div>
          <div className={reviewUi.explanationGrid}>
            <div className={reviewUi.explanationCopy}>
              {explanationBlocks.map((block, index) => (
                <MedicalText as="p" key={`${index}-${block.slice(0, 16)}`} text={block} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {incorrectReasons.length ? (
        <section className={reviewUi.incorrectExplanation} aria-label="Why other answers are incorrect">
          <div className={reviewUi.explanationHeader}>
            <h3>{explanationBlocks.length ? 'Why other answers are incorrect' : explanationTitle}</h3>
          </div>
          <div className={reviewUi.explanationGrid}>
            <div className={reviewUi.incorrectList}>
              {incorrectReasons.map((item) => (
                <div className={reviewUi.incorrectItem} key={item.label}>
                  <span className={reviewUi.incorrectBadge}>{item.label}</span>
                  <div className={reviewUi.incorrectCopy}>
                    <MedicalText as="strong" text={item.text} />
                    <MedicalText as="p" text={item.reason} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReviewExplanationEmpty() {
  return (
    <div className="grid gap-3">
      <section className={reviewUi.explanationEmpty}>
        <strong>Explanation</strong>
        <span>No written explanation is available for this question.</span>
      </section>
    </div>
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
  const [savedQuestionIds, setSavedQuestionIds] = useState(() => new Set());
  const [questionActionBusy, setQuestionActionBusy] = useState(false);
  const [questionActionError, setQuestionActionError] = useState('');
  const mainRef = useRef(null);
  const questionCardRef = useRef(null);
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const activeQuestion = safeQuestions[activeIndex] || null;
  const reviewAnsweredCount = summary
    ? Number(summary.answered ?? (Number(summary.total || 0) - Number(summary.unanswered || 0)))
    : safeQuestions.filter((question) => question.answerStatus !== 'unanswered').length;
  const reviewProgressPercent = safeQuestions.length ? Math.round(((activeIndex + 1) / safeQuestions.length) * 100) : 0;

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

  useEffect(() => {
    fetchStudyBookmarks()
      .then((items) => {
        setSavedQuestionIds(new Set(
          (Array.isArray(items) ? items : [])
            .filter((item) => item.itemType === 'question')
            .map((item) => Number(item.itemId))
            .filter(Boolean)
        ));
      })
      .catch(() => {});
  }, []);

  if (!safeQuestions.length) {
    return <div className={ui.emptyBox}>No review questions available.</div>;
  }

  const hasExplanation = hasReviewExplanation(activeQuestion);
  const activeQuestionSaved = savedQuestionIds.has(Number(activeQuestion.id));
  const showBubbleNavigator = navigatorVariant === 'bubbles';
  const shellClass = focusQuestionOnly
    ? reviewUi.shellFocus
    : cx(reviewUi.shell, reviewUi.shellThree);
  const questionNavigation = (
    <nav className={reviewUi.questionNav} aria-label="Review question navigation">
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

  async function toggleActiveQuestionBookmark() {
    if (!activeQuestion) return;
    setQuestionActionBusy(true);
    setQuestionActionError('');
    try {
      const result = await toggleStudyBookmark({ itemType: 'question', itemId: activeQuestion.id });
      setSavedQuestionIds((current) => {
        const next = new Set(current);
        if (result.saved) next.add(activeQuestion.id);
        else next.delete(activeQuestion.id);
        return next;
      });
    } catch (error) {
      setQuestionActionError(getErrorMessage(error, 'Unable to update question bookmark'));
    } finally {
      setQuestionActionBusy(false);
    }
  }

  async function reportActiveQuestion() {
    if (!activeQuestion) return;
    const comment = window.prompt('Tell admin what is wrong with this question. You can leave it blank if you only want to flag it.');
    if (comment === null) return;
    setQuestionActionBusy(true);
    setQuestionActionError('');
    try {
      await createQuestionReport({
        questionId: activeQuestion.id,
        reason: 'Student reported question',
        comment: comment.trim() || `Student reported question #${activeQuestion.id}`,
      });
      window.alert(`Question #${activeQuestion.id} was reported to admin.`);
    } catch (error) {
      setQuestionActionError(getErrorMessage(error, 'Unable to report question'));
    } finally {
      setQuestionActionBusy(false);
    }
  }

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
              <strong>{reviewAnsweredCount}</strong>
              <span>Answered</span>
            </div>
            <div className={reviewUi.summaryTile}>
              <strong>{activeIndex + 1}</strong>
              <span>Current</span>
            </div>
            <div className={cx(reviewUi.summaryTile, summaryTileToneClass.unanswered)}>
              <strong>{reviewProgressPercent}%</strong>
              <span>Progress</span>
            </div>
          </div>
        ) : null}
        <section className={cx(reviewUi.nav, 'lms-review-progress-card')} aria-label="Review progress">
          <div className={reviewUi.navHead}>
            <h3>Progress</h3>
            <span>{reviewProgressPercent}% viewed</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label="Review progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={reviewProgressPercent}
          >
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))]"
              style={{ width: `${reviewProgressPercent}%` }}
            />
          </div>
          <p className="m-0 text-xs font-semibold leading-relaxed text-ink-soft">
            Question {activeIndex + 1} of {safeQuestions.length} / {activeQuestion.questionType === 'true_false' ? 'True / False' : 'SBA'}
          </p>
        </section>
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
                      index === activeIndex && 'is-current',
                      index !== activeIndex && question.answerStatus === 'correct' && 'is-answered',
                      index !== activeIndex && question.answerStatus === 'wrong' && 'is-answered',
                      index !== activeIndex && question.answerStatus === 'unanswered' && 'is-idle',
                      index === activeIndex && reviewUi.bubbleActive,
                      index !== activeIndex && question.answerStatus === 'correct' && reviewUi.bubbleCorrect,
                      index !== activeIndex && question.answerStatus === 'wrong' && reviewUi.bubbleWrong,
                      index !== activeIndex && question.answerStatus === 'unanswered' && reviewUi.bubbleUnanswered
                    )}
                    key={question.id}
                    type="button"
                   
                    onClick={() => setActiveIndex(index)}
                    title={`Question ${index + 1} • ${getQuestionStatusLabel(question.answerStatus)}`}
                    aria-current={index === activeIndex ? 'step' : undefined}
                    aria-label={getReviewQuestionNavLabel(index, question, index === activeIndex)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <div className={reviewUi.bubbleLegend}>
                <span><i className="border-brand-primary/30 bg-brand-primary/30" />Current</span>
                <span><i className="border-brand-success/30 bg-brand-success/30" />Correct</span>
                <span><i className="border-brand-error/30 bg-brand-error/30" />Wrong</span>
                <span><i className="is-idle" />Not answered</span>
              </div>
            </>
          ) : (
            <div className={reviewUi.navList}>
              {safeQuestions.map((question, index) => (
                <button className={cx(reviewUi.navItem, index === activeIndex && reviewUi.navItemActive)}
                  key={question.id}
                  type="button"
                 
                  onClick={() => setActiveIndex(index)}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  aria-label={getReviewQuestionNavLabel(index, question, index === activeIndex)}
                >
                  <span className={reviewUi.navItemIndex}>Q{index + 1}</span>
                  <MedicalText as="span" className={reviewUi.navItemText} text={question.questionText} />
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
          <MedicalText
            as="p"
            className={reviewUi.questionText}
            text={activeQuestion.questionText}
            imageLoading="eager"
            imageFetchPriority="high"
            imageZoomable
          />

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

          <div className="grid gap-3">
            {hasExplanation ? <ReviewExplanation question={activeQuestion} /> : <ReviewExplanationEmpty />}
            <div className={focusQuestionOnly ? '' : 'min-[1181px]:hidden'}>
              <ReviewStudySupport question={activeQuestion} />
            </div>
          </div>

          {questionNavigation}

          {questionActionError ? <FeedbackNotice tone="error">{questionActionError}</FeedbackNotice> : null}
          <div className={reviewUi.questionActions}>
            <button
              className={cx(
                reviewSecondaryButtonClass,
                activeQuestionSaved && 'border-brand-violet/25 bg-purple-100 text-brand-violet dark:bg-purple-500/15 dark:text-purple-200'
              )}
              type="button"
              onClick={toggleActiveQuestionBookmark}
              disabled={questionActionBusy}
            >
              <IcoBookmark filled={activeQuestionSaved} />
              <span>{activeQuestionSaved ? 'Saved question' : 'Save question'}</span>
            </button>
            <button className={reviewSecondaryButtonClass} type="button" onClick={reportActiveQuestion} disabled={questionActionBusy}>
              <IcoReport />
              <span>Report question</span>
            </button>
          </div>
        </article>
      </section>

      {!focusQuestionOnly ? (
        <aside className={reviewUi.explanationSide}>
          <ReviewStudySupport question={activeQuestion} />
        </aside>
      ) : null}
    </section>
    </>
  );
}
