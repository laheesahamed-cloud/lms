import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadStudentQuiz, savePracticeAnswer, submitExam } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { useThemeStore } from '../../../../shared/stores/themeStore.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getQuizNumberLabel } from './quizLabels.js';
import { ImpactStyle, nativeImpact, nativeTransientHaptic } from '../../../../shared/utils/nativeHaptics.js';

const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function normalizeCorrectValue(option) {
  const raw = option?.isCorrect ?? option?.is_correct ?? option?.correct;
  if (raw === true) return 1;
  if (raw === false) return 0;
  if (raw === 1 || raw === 0) return raw;
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (['1', 'true', 'correct', 'yes'].includes(normalized)) return 1;
  if (['0', 'false', 'incorrect', 'no'].includes(normalized)) return 0;
  return null;
}

function hasOptionAnswerKey(option) {
  return normalizeCorrectValue(option) !== null;
}

function isCorrectOption(option) {
  return normalizeCorrectValue(option) === 1;
}

function getOptionDisplayLabel(option, index) {
  return DISPLAY_OPTION_LABELS[index] || option?.optionLabel || String(index + 1);
}

function getAnswerKeyItems(question) {
  if (!question) return [];

  if (question.questionType === 'true_false' || question.question_type === 'true_false') {
    const keyedStatements = Array.isArray(question.answerKey?.statements) ? question.answerKey.statements : [];
    if (keyedStatements.length) {
      return keyedStatements.map((statement, index) => {
        const optionIndex = (question.options || []).findIndex((option) => option.id === statement.optionId);
        const option = question.options?.[optionIndex >= 0 ? optionIndex : index];
        return {
        label: getOptionDisplayLabel(option, optionIndex >= 0 ? optionIndex : index),
        text: statement.text || option?.optionText || '',
        answer: statement.answer || '',
        };
      });
    }
    return (question.options || []).map((option, index) => ({
      label: getOptionDisplayLabel(option, index),
      text: option.optionText || '',
      answer: isCorrectOption(option) ? 'True' : 'False',
    }));
  }

  const keyedOptions = Array.isArray(question.answerKey?.correctOptions) ? question.answerKey.correctOptions : [];
  if (keyedOptions.length) {
    return keyedOptions.map((answerOption, index) => {
      const optionIndex = (question.options || []).findIndex((option) => option.id === answerOption.optionId);
      const option = question.options?.[optionIndex >= 0 ? optionIndex : index];
      return {
        label: getOptionDisplayLabel(option, optionIndex >= 0 ? optionIndex : index),
        text: answerOption.text || option?.optionText || '',
        answer: '',
      };
    });
  }
  return (question.options || [])
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => isCorrectOption(option))
    .map(({ option, index }) => ({
      label: getOptionDisplayLabel(option, index),
      text: option.optionText || '',
      answer: '',
    }));
}

function hasQuestionAnswerKey(question) {
  return getAnswerKeyItems(question).length > 0;
}

const examCardKickerClass = 'text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary';
const examScreenShellClass = `${ui.studentScreenShell} lms-exam-page px-[clamp(18px,2.8vw,30px)] pb-[clamp(18px,2.8vw,30px)] pt-[clamp(10px,1.4vw,18px)] max-[700px]:pb-28 max-[600px]:p-3.5 max-[600px]:pb-28`;
const examLayoutClass = 'lms-exam-layout mx-auto grid w-[min(100%,1520px)] gap-[18px] bg-[var(--exam-shell-bg)] pb-2.5';
const examThemeLightVars = {
  '--exam-shell-bg': 'radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 24%), radial-gradient(circle at top right, rgba(124,58,237,0.08), transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,255,0.95))',
  '--exam-card-bg': 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,249,255,0.92))',
  '--exam-card-border': 'rgba(214,224,240,0.95)',
  '--exam-card-shadow': '0 16px 34px rgba(15,23,42,0.05)',
  '--exam-main-bg': 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,249,255,0.92))',
  '--exam-header-chip-bg': 'rgba(255,255,255,0.9)',
  '--exam-header-chip-border': 'rgba(214,224,240,0.95)',
  '--exam-header-chip-shadow': '0 12px 26px rgba(15,23,42,0.04)',
  '--exam-header-logo-bg': 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(243,247,255,0.9))',
  '--exam-header-logo-border': 'rgba(214,224,240,0.9)',
  '--exam-header-logo-shadow': '0 8px 22px rgba(15,23,42,0.06)',
  '--exam-end-bg': 'rgba(255,255,255,0.88)',
  '--exam-end-border': 'rgba(239,68,68,0.22)',
  '--exam-end-text': '#DC2626',
  '--exam-progress-track': '#E6ECF7',
  '--exam-soft-panel': 'rgba(248,250,255,0.92)',
  '--exam-stat-bg': 'rgba(248,250,255,0.92)',
  '--exam-stat-border': 'rgba(214,224,240,0.95)',
  '--exam-nav-idle-bg': '#fff',
  '--exam-nav-idle-border': '#D7E0EE',
  '--exam-nav-idle-text': '#334155',
  '--exam-jump-bg': '#fff',
  '--exam-jump-border': '#E2E8F0',
  '--exam-jump-text': '#2563EB',
  '--exam-jump-disabled-bg': '#F8FAFC',
  '--exam-jump-disabled-text': '#94A3B8',
  '--exam-chip-primary-bg': '#EDF4FF',
  '--exam-chip-text': '#2563EB',
  '--exam-answer-border': 'rgba(214,224,240,0.95)',
  '--exam-answer-hover-border': 'rgba(59,130,246,0.28)',
  '--exam-answer-hover-shadow': 'none',
  '--exam-answer-selected-border': 'rgba(37,99,235,0.55)',
  '--exam-answer-selected-ring': '0 0 0 3px rgba(37,99,235,0.10)',
  '--exam-answer-radio': '#C3CFDF',
  '--exam-answer-text': '#223A5E',
  '--exam-tf-bg': '#F8FAFC',
  '--exam-tf-border': '#D7E0EE',
  '--exam-tf-text': 'var(--ink-medium)',
  '--exam-footer-btn-bg': 'rgba(255,255,255,0.86)',
  '--exam-footer-btn-border': 'rgba(214,224,240,0.95)',
  '--exam-footer-btn-text': 'var(--ink-strong)',
  '--exam-block-bg': '#fff',
  '--exam-block-text': '#7A8DA7',
  '--exam-block-line': '#D7E0EE',
  '--exam-block-dot-border': '#D7E0EE',
  '--exam-block-dot-fill': '#fff',
};
const examThemeDarkVars = {
  '--exam-shell-bg': 'radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 24%), radial-gradient(circle at top right, rgba(124,58,237,0.14), transparent 20%), linear-gradient(180deg, rgba(8,14,26,0.98), rgba(4,9,18,0.98))',
  '--exam-card-bg': 'linear-gradient(180deg, rgba(13,20,34,0.94), rgba(8,14,26,0.98))',
  '--exam-card-border': 'rgba(96,125,168,0.24)',
  '--exam-card-shadow': '0 20px 36px rgba(0,0,0,0.28)',
  '--exam-main-bg': 'linear-gradient(180deg, rgba(13,20,34,0.94), rgba(8,14,26,0.98))',
  '--exam-header-chip-bg': 'rgba(255,255,255,0.05)',
  '--exam-header-chip-border': 'rgba(96,125,168,0.24)',
  '--exam-header-chip-shadow': '0 14px 28px rgba(0,0,0,0.18)',
  '--exam-header-logo-bg': 'linear-gradient(180deg, rgba(15,28,48,0.96), rgba(10,20,36,0.92))',
  '--exam-header-logo-border': 'rgba(106,145,210,0.24)',
  '--exam-header-logo-shadow': '0 12px 28px rgba(0,0,0,0.28)',
  '--exam-end-bg': 'rgba(33,13,19,0.92)',
  '--exam-end-border': 'rgba(248,113,113,0.24)',
  '--exam-end-text': '#FCA5A5',
  '--exam-progress-track': 'rgba(255,255,255,0.08)',
  '--exam-soft-panel': 'rgba(255,255,255,0.03)',
  '--exam-stat-bg': 'rgba(255,255,255,0.03)',
  '--exam-stat-border': 'rgba(96,125,168,0.24)',
  '--exam-nav-idle-bg': 'rgba(16,30,50,0.92)',
  '--exam-nav-idle-border': 'rgba(104,136,184,0.18)',
  '--exam-nav-idle-text': '#D4DEEE',
  '--exam-jump-bg': 'rgba(12,25,43,0.94)',
  '--exam-jump-border': 'rgba(104,136,184,0.18)',
  '--exam-jump-text': '#8EB7FF',
  '--exam-jump-disabled-bg': 'rgba(12,22,38,0.7)',
  '--exam-jump-disabled-text': '#667A99',
  '--exam-chip-primary-bg': 'rgba(28,62,122,0.34)',
  '--exam-chip-text': '#9FC2FF',
  '--exam-answer-border': 'rgba(96,125,168,0.22)',
  '--exam-answer-hover-border': 'rgba(96,165,250,0.40)',
  '--exam-answer-hover-shadow': 'none',
  '--exam-answer-selected-border': 'rgba(96,165,250,0.72)',
  '--exam-answer-selected-ring': '0 0 0 3px rgba(59,130,246,0.14)',
  '--exam-answer-radio': 'rgba(132,157,196,0.6)',
  '--exam-answer-text': '#E2EAF7',
  '--exam-tf-bg': 'rgba(18,33,55,0.88)',
  '--exam-tf-border': 'rgba(104,136,184,0.18)',
  '--exam-tf-text': '#C7D4E7',
  '--exam-footer-btn-bg': 'rgba(255,255,255,0.04)',
  '--exam-footer-btn-border': 'rgba(96,125,168,0.24)',
  '--exam-footer-btn-text': '#E2EAF7',
  '--exam-block-bg': 'rgba(12,24,42,0.92)',
  '--exam-block-text': '#8FA5C4',
  '--exam-block-line': 'rgba(63,84,119,0.9)',
  '--exam-block-dot-border': 'rgba(93,118,159,0.95)',
  '--exam-block-dot-fill': '#081426',
};
const examHeaderClass =
  'lms-exam-header sticky top-2.5 z-10 flex items-center justify-between gap-3 rounded-[18px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3 py-2.5 shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:static max-[700px]:flex-col max-[700px]:items-stretch';
const practiceHeaderClass = 'static max-[700px]:!flex-row max-[700px]:!items-center max-[700px]:!justify-between max-[700px]:gap-3 max-[700px]:px-3.5 max-[700px]:py-3 [&_.quiz-header-actions]:shrink-0';
const examHeaderBrandClass = 'flex min-w-0 items-center gap-3';
const examHeaderLogoClass =
  'grid size-10 shrink-0 place-items-center rounded-[13px] border border-[var(--exam-header-logo-border)] bg-[var(--exam-header-logo-bg)] shadow-[var(--exam-header-logo-shadow)]';
const examHeaderTitleClass = 'block text-[17px] font-extrabold leading-tight text-ink-strong';
const examHeaderSubtitleClass = 'mt-0.5 block max-w-[min(62vw,720px)] truncate text-xs text-ink-soft max-[700px]:max-w-full';
const examHeaderActionsClass = 'quiz-header-actions flex flex-wrap items-center justify-end gap-2 max-[700px]:justify-start';
const examHeaderChipClass =
  'inline-flex min-h-10 items-center gap-2 rounded-[13px] border border-[var(--exam-header-chip-border)] bg-[var(--exam-header-chip-bg)] px-3 text-sm text-ink-medium shadow-[var(--exam-header-chip-shadow)]';
const examHeaderChipValueClass = 'text-base font-extrabold text-ink-strong';
const examHeaderIconClass = 'inline-grid place-items-center text-ink-soft';
const examHeaderEndClass =
  'min-h-9 rounded-full border border-[var(--exam-end-border)] bg-[var(--exam-end-bg)] px-3.5 text-[12.5px] font-bold text-[var(--exam-end-text)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-60';
const examGridClass = 'lms-exam-grid grid grid-cols-[minmax(240px,300px)_minmax(0,780px)_minmax(240px,300px)] items-start justify-center gap-[18px] max-[1180px]:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] max-[900px]:grid-cols-1';
const practiceGridClass = '';
const examSidebarClass = 'lms-exam-sidebar grid gap-[18px]';
const examExplainerClass = 'lms-exam-explainer grid gap-[18px] max-[1180px]:col-span-2 max-[900px]:hidden';
const examPanelClass =
  'border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-[18px] shadow-[var(--exam-card-shadow)]';
const examProgressPanelClass =
  'relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))] before:content-[""]';
const examMainCardClass =
  'lms-exam-main-card grid min-h-[540px] grid-rows-[auto_1fr_auto] border border-[var(--exam-card-border)] bg-[var(--exam-main-bg)] p-[clamp(20px,3vw,36px)] shadow-[var(--exam-card-shadow)] max-[600px]:min-h-[auto]';
const examQuestionNumberClass = 'sr-only';
const examCardHeadClass = 'mb-4 flex items-start justify-between gap-3 text-ink-strong [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-extrabold';
const examQuestionTypeRowClass = 'mb-2 flex items-center justify-between gap-2';
const examChipMiniClass =
  'inline-flex min-h-7 items-center rounded-full border border-[var(--exam-header-chip-border)] bg-[var(--exam-chip-primary-bg)] px-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--exam-chip-text)]';
const examProgressToplineClass = 'mb-3 mt-3.5 flex items-center justify-between gap-2';
const examProgressCurrentClass = 'text-base font-bold text-ink-strong';
const examProgressPercentClass = 'text-[13px] text-ink-soft';
const examProgressBarClass = 'h-[7px] overflow-hidden rounded-full border border-[var(--exam-card-border)] bg-[var(--exam-progress-track)]';
const examProgressFillClass = 'block h-full rounded-[inherit] bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))] shadow-none';
const quizFlashPanelClass = 'rounded-[22px] backdrop-blur-md max-[600px]:rounded-[18px]';
const quizFlashQuestionCopyClass = 'lms-reading-question relative max-w-[78ch] whitespace-pre-line pb-[22px] text-left text-[16px] font-medium leading-[1.64] tracking-normal text-[var(--exam-answer-text)] [text-wrap:pretty] max-[600px]:pb-4 max-[600px]:text-[15.5px] max-[600px]:leading-[1.6]';
const quizFlashAnswerCardClass =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.88))] dark:bg-[linear-gradient(180deg,rgba(17,27,44,0.94),rgba(10,18,31,0.98))]';
const quizFlashSelectedAnswerClass = 'bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(230,240,255,0.92))]';
const quizFlashFooterButtonClass = 'rounded-xl';
const quizFlashNextButtonClass = 'shadow-none';
const quizFlashTipClass = 'border border-slate-400/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.06))]';
const examQuestionStartAnchorClass = 'scroll-mt-4';
const examQuestionNavClass = 'lms-exam-question-nav grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-2 max-[900px]:grid-cols-8 max-[600px]:grid-cols-5';
const examNavBubbleBaseClass =
  'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity] duration-150 active:opacity-85';
const examNavLegendClass = 'lms-exam-nav-legend mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] font-bold leading-tight text-ink-soft';
const examNavLegendItemClass = 'inline-flex min-w-0 items-center gap-1 whitespace-nowrap';
const examNavLegendDotClass = 'inline-block size-2.5 shrink-0 rounded border border-transparent';
const examNavJumpsClass = 'mt-[18px] grid gap-2.5';
const examNavJumpClass =
  'flex min-h-[46px] items-center justify-between gap-3 rounded-[14px] border border-[var(--exam-jump-border)] bg-[var(--exam-jump-bg)] px-4 text-sm font-bold text-[var(--exam-jump-text)] shadow-none disabled:bg-[var(--exam-jump-disabled-bg)] disabled:text-[var(--exam-jump-disabled-text)]';
const examExplanationEmptyClass =
  'rounded-[14px] border border-dashed border-[var(--exam-card-border)] bg-[var(--exam-soft-panel)] p-4 text-sm leading-relaxed text-ink-soft [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[14px] [&_strong]:text-ink-strong [&_p]:m-0';
const examExplanationBodyClass = 'lms-reading-explanation grid gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_15%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-2))] p-4 text-left text-[14.5px] font-normal leading-[1.66] text-ink-medium shadow-none max-[640px]:rounded-xl max-[640px]:p-3 [&_p]:m-0 [&_p]:max-w-[78ch] [&_p]:whitespace-pre-line [&_p]:tracking-normal [&_p]:[text-wrap:pretty] max-[640px]:[&_p]:text-[14.5px] max-[640px]:[&_p]:leading-[1.62]';
const examWhyIncorrectClass = 'mt-1 grid gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-2))] p-3 [&>strong]:text-[12px] [&>strong]:font-extrabold [&>strong]:uppercase [&>strong]:tracking-[0.1em] [&>strong]:text-ink-soft';
const examWhyIncorrectItemClass = 'lms-reading-incorrect grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 border-t border-[color-mix(in_srgb,var(--color-warning)_14%,var(--line-soft))] px-0 py-2 first:border-t-0 max-[640px]:grid-cols-[22px_minmax(0,1fr)] max-[640px]:gap-1.5 max-[640px]:py-1.5 [&_span]:inline-flex [&_span]:size-6 [&_span]:items-center [&_span]:justify-center [&_span]:rounded-full [&_span]:border [&_span]:border-[color-mix(in_srgb,var(--color-warning)_30%,var(--line-soft))] [&_span]:bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] [&_span]:text-[11px] [&_span]:font-black [&_span]:leading-none [&_span]:text-[#92400e] max-[640px]:[&_span]:size-[22px] max-[640px]:[&_span]:text-[10px] [&_div]:min-w-0 [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:leading-snug [&_strong]:text-ink-strong max-[640px]:[&_strong]:text-[12.5px] [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-[13.5px] [&_p]:font-normal [&_p]:leading-[1.56] [&_p]:text-ink-medium max-[640px]:[&_p]:text-[13px] max-[640px]:[&_p]:leading-[1.52]';
const practiceLearningSupportClass = 'mt-4 grid gap-3.5 border-t border-[var(--exam-card-border)] pt-4 min-[901px]:hidden [&_.qtr-popup-trigger]:min-h-12 [&_.qtr-popup-trigger]:rounded-2xl [&_.qtr-popup-trigger]:px-3.5 [&_.qtr-popup-trigger]:py-3 [&_.qtr-popup-trigger__label]:text-sm [&_.qtr-popup-trigger__concept]:max-w-[42vw]';
const practiceKeyPointsClass = 'grid gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,#8b5cf6_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_5%,var(--surface-1))_0%,var(--surface-1)_74%)] p-4 shadow-none';
const practiceKeyPointClass = 'lms-reading-incorrect rounded-[12px] border border-[color-mix(in_srgb,var(--color-primary)_12%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-2))] px-3 py-2 text-left text-[13px] font-medium leading-[1.58] text-ink-strong';
const examAnswerListClass = 'mx-auto grid w-[min(100%,900px)] gap-2.5 px-0 pb-2.5 pt-2 max-[700px]:gap-2.5 max-[700px]:pb-4';
const examAnswerCardClass =
  'flex min-h-[48px] cursor-pointer touch-manipulation items-center gap-2.5 rounded-[14px] border border-[var(--exam-answer-border)] px-3.5 py-2.5 transition-[background,border-color,box-shadow,opacity] duration-150 active:opacity-90 focus-within:ring-2 focus-within:ring-brand-primary/30 hover:border-[var(--exam-answer-hover-border)] hover:shadow-[var(--exam-answer-hover-shadow)] max-[700px]:min-h-[52px] max-[700px]:rounded-[16px] max-[700px]:px-3.5 max-[700px]:py-3';
const examAnswerSelectedClass = 'border-[var(--exam-answer-selected-border)] shadow-[var(--exam-answer-selected-ring)]';
const examAnswerCorrectClass =
  'border-[color-mix(in_srgb,var(--sa-ok)_30%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_10%,var(--sa-surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--sa-ok)_10%,transparent)] dark:!bg-[color-mix(in_srgb,var(--sa-ok)_16%,var(--sa-surface))]';
const examAnswerWrongClass =
  'border-[color-mix(in_srgb,var(--sa-danger)_30%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_9%,var(--sa-surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--sa-danger)_9%,transparent)] dark:!bg-[color-mix(in_srgb,var(--sa-danger)_15%,var(--sa-surface))]';
const examAnswerContentClass = 'flex w-full min-w-0 items-center justify-start gap-2.5';
const examAnswerTextStackClass = 'grid min-w-0 flex-1 gap-1';
const examAnswerStateRowClass = 'flex flex-wrap items-center gap-1.5';
const examAnswerStatePillClass = 'inline-flex min-h-6 items-center rounded-full border px-2.5 text-[11px] font-extrabold leading-none';
const examAnswerStateCorrectClass = 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
const examAnswerStateWrongClass = 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-200';
const examAnswerRadioClass =
  'relative size-5 shrink-0 rounded-full border-2 border-[var(--exam-answer-radio)] after:absolute after:inset-[3px] after:scale-0 after:rounded-full after:bg-brand-primary after:transition-transform after:content-[""]';
const examAnswerRadioSelectedClass = 'border-brand-primary after:scale-100';
const examAnswerRadioCorrectClass = 'border-brand-success after:bg-brand-success';
const examAnswerRadioWrongClass = 'border-brand-error after:bg-brand-error';
const examAnswerCopyClass = 'lms-reading-answer block min-w-0 flex-1 whitespace-pre-line text-left text-[14.5px] font-medium leading-[1.45] text-[var(--exam-answer-text)] max-[600px]:leading-[1.48]';
const examTfCardClass =
  'flex min-h-[48px] flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--exam-answer-border)] px-3.5 py-2.5 max-[700px]:min-h-[52px] max-[700px]:rounded-[16px] max-[700px]:py-3';
const examTfCopyClass = 'min-w-0 flex-1';
const examTfActionsClass = 'ml-auto flex shrink-0 justify-end gap-2 max-[600px]:ml-0 max-[600px]:w-full max-[600px]:justify-stretch';
const examTfToggleClass =
  'min-h-10 touch-manipulation rounded-xl border border-[var(--exam-tf-border)] bg-[var(--exam-tf-bg)] px-4 text-[13px] font-bold text-[var(--exam-tf-text)] shadow-none transition-colors active:opacity-85 max-[600px]:min-h-11 max-[600px]:flex-1';
const examTfTrueActiveClass = 'border-[color-mix(in_srgb,var(--sa-ok)_26%,var(--sa-border))] bg-[color-mix(in_srgb,var(--sa-ok)_10%,var(--sa-surface))] text-emerald-700 dark:bg-[color-mix(in_srgb,var(--sa-ok)_15%,var(--sa-surface))] dark:text-emerald-200';
const examTfFalseActiveClass = 'border-[color-mix(in_srgb,var(--sa-danger)_26%,var(--sa-border))] bg-[color-mix(in_srgb,var(--sa-danger)_9%,var(--sa-surface))] text-red-600 dark:bg-[color-mix(in_srgb,var(--sa-danger)_14%,var(--sa-surface))] dark:text-red-200';
const examTfRevealClass =
  'basis-full rounded-[12px] px-3 py-2 text-[13px] font-bold';
const examTfRevealTrueClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
const examTfRevealFalseClass = 'bg-red-500/10 text-red-600 dark:text-red-200';
const examAnswerLetterBadgeClass = 'grid size-[30px] shrink-0 place-items-center rounded-lg border-2 text-[12px] font-black transition-[background,border-color,color] duration-150';
const examAnswerLetterIdleClass = 'border-[var(--exam-answer-border)] bg-transparent text-[var(--exam-answer-text)] opacity-75';
const examAnswerLetterSelectedClass = '!border-brand-primary/40 !bg-[var(--color-primary-light)] !text-brand-primary opacity-100';
const examAnswerLetterCorrectClass = '!border-emerald-500/40 !bg-emerald-500/12 !text-emerald-700 dark:!text-emerald-200 opacity-100';
const examAnswerLetterWrongClass = '!border-red-500/40 !bg-red-500/12 !text-red-600 dark:!text-red-200 opacity-100';
const practiceAnswerKeyClass =
  'lms-reading-explanation mt-1 grid gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--color-success)_24%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_7%,var(--surface-2))] p-4 text-left text-[13.5px] leading-[1.55] text-ink-medium shadow-none max-[640px]:rounded-xl max-[640px]:p-3';
const practiceAnswerKeyTitleClass = 'block text-[11px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-200';
const practiceAnswerKeyListClass = 'm-0 grid list-none gap-1.5 p-0';
const practiceAnswerKeyItemClass = 'grid grid-cols-[auto_minmax(0,1fr)] gap-2';
const practiceAnswerKeyBadgeClass = 'inline-grid min-w-7 place-items-center rounded-lg border border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_12%,var(--surface-2))] px-2 py-1 text-[12px] font-black text-emerald-700 dark:text-emerald-100';
const practiceAnswerKeyTextClass = 'min-w-0 whitespace-pre-line font-medium text-ink-strong';
const examMainFooterClass = 'lms-exam-main-footer mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--exam-card-border)] pt-4 max-[700px]:hidden';
const examMainFooterLeftClass = 'flex flex-wrap gap-2.5';
const examFooterButtonClass =
  'min-h-11 rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] px-[18px] text-sm font-bold text-[var(--exam-footer-btn-text)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const examFooterIconButtonClass =
  'grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] px-3 text-[var(--exam-footer-btn-text)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const examFooterFlagActiveClass = 'border-orange-500/30 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200';
const examFooterNextClass = 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary';
const examModeFooterClass =
  'flex items-center justify-between gap-4 border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-4 shadow-[var(--exam-card-shadow)] max-[800px]:flex-col max-[800px]:items-stretch max-[700px]:hidden';
const examModeFooterBlockClass = 'grid gap-0.5 [&_strong]:text-[15px] [&_strong]:text-ink-strong [&_small]:text-xs [&_small]:text-ink-soft';
const examModeFooterTrackerClass = 'flex flex-wrap items-center justify-end gap-2.5 max-[800px]:justify-start';
const examBlockClass =
  'inline-flex items-center gap-2 rounded-full border border-[var(--exam-block-line)] bg-[var(--exam-block-bg)] px-3 py-1.5 text-xs font-bold text-[var(--exam-block-text)]';
const examBlockDoneClass = 'border-emerald-500/25 text-emerald-700 dark:text-emerald-200';
const examBlockCurrentClass = 'border-brand-primary/25 text-brand-primary';
const examBlockDotClass = 'size-2.5 rounded-full border border-[var(--exam-block-dot-border)] bg-[var(--exam-block-dot-fill)]';
const examBlockDotDoneClass = 'border-emerald-500 bg-emerald-500/35';
const examBlockDotCurrentClass = 'border-brand-primary bg-brand-primary/35';
const mobileQuizBarClass =
  'lms-mobile-quiz-bar hidden rounded-[18px] border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-3 shadow-none max-[700px]:block';
const mobileQuizBarTopClass = 'mb-2 flex items-center justify-between gap-3 text-[12px] font-bold text-ink-soft';
const mobileQuizBarActionsClass = 'grid grid-cols-[40px_40px_minmax(86px,1fr)_minmax(124px,1.2fr)] gap-2';
const mobileQuizIconButtonClass =
  'grid min-h-10 place-items-center rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] text-[13px] font-extrabold text-[var(--exam-footer-btn-text)] disabled:opacity-45';
const mobileQuizPrimaryClass =
  'min-h-10 rounded-xl border border-brand-primary/35 bg-[var(--color-primary-light)] px-3 text-[13px] font-extrabold text-brand-primary disabled:opacity-55';

function IcoFlag({ filled = false }) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path
        d="M4.25 14.25V3.35M4.25 3.35c1.35-.85 2.7-.85 4.05-.18 1.25.62 2.5.65 3.95-.1v6.35c-1.45.75-2.7.72-3.95.1-1.35-.67-2.7-.67-4.05.18V3.35Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MobileQuizActionBar({
  isExam,
  currentIndex,
  totalQuestions,
  progressPercent,
  saving,
  currentQuestionFlagged,
  currentQuestionRevealed,
  canRevealAnswers,
  onPrevious,
  onReveal,
  onFlag,
  onNext,
  onFinish,
}) {
  const isLast = currentIndex >= totalQuestions - 1;
  return (
    <nav className={mobileQuizBarClass} aria-label="Quiz actions">
      <div className={mobileQuizBarTopClass}>
        <span>Question {currentIndex + 1} of {totalQuestions}</span>
        <span>{progressPercent}% complete</span>
      </div>
      <div className={examProgressBarClass} aria-hidden="true">
        <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className={cx(mobileQuizBarActionsClass, 'mt-2')}>
        <button type="button" className={mobileQuizIconButtonClass} onClick={onPrevious} disabled={currentIndex === 0 || saving} aria-label="Previous question">
          ‹
        </button>
        <button type="button" className={cx(mobileQuizIconButtonClass, currentQuestionFlagged && examFooterFlagActiveClass)} onClick={onFlag} aria-label="Flag question">
          <IcoFlag filled={currentQuestionFlagged} />
        </button>
        <button type="button" className={mobileQuizIconButtonClass} onClick={isExam ? onNext : onReveal} disabled={isExam ? isLast || saving : currentQuestionRevealed || !canRevealAnswers}>
          {isExam ? 'Next' : currentQuestionRevealed ? 'Shown' : canRevealAnswers ? 'Show' : 'Review'}
        </button>
        <button type="button" className={mobileQuizPrimaryClass} onClick={isLast ? onFinish : onNext} disabled={saving}>
          {isLast ? (isExam ? saving ? 'Submitting...' : 'Submit' : 'Finish') : saving ? 'Saving...' : 'Next'}
        </button>
      </div>
    </nav>
  );
}

function getExamNavBubbleClass({ active, answered, flagged, review }) {
  return cx(
    examNavBubbleBaseClass,
    active && 'border-brand-primary/38 bg-brand-primary/12 text-brand-primary shadow-none',
    !active && answered && 'border-brand-success/30 bg-brand-success/12 text-brand-success',
    !active && flagged && 'border-orange-500/25 bg-orange-500/12 text-orange-700 dark:text-orange-200',
    !active && !answered && !flagged && review && 'border-brand-violet/20 bg-purple-100 text-brand-violet'
  );
}

function isAnswered(question, value) {
  if (!question) return false;
  if (question.questionType === 'sba') return value !== undefined && value !== null && value !== '';
  return !!value && Object.keys(value).length > 0;
}

function shuffleArray(items = []) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function scrollQuestionContentIntoView(target, behavior = 'smooth') {
  if (!target || typeof window === 'undefined') return;

  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({
      behavior,
      block: 'start',
      inline: 'nearest',
    });
    return;
  }

  const scrollCandidates = [
    document.querySelector('.lms-app-scroll-root'),
    document.querySelector('.portal-content__frame'),
    document.querySelector('.portal-content'),
    document.scrollingElement,
    document.documentElement,
  ].filter(Boolean);
  const offset = 12;
  const scrollRoot = scrollCandidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight + 2);

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

function ExamModeHeader({
  title,
  quizLabel,
  secondaryLabel = 'Time',
  secondaryValue,
  onEndSession,
  saving,
  theme,
  workspaceLabel = 'Exam workspace',
  endLabel = 'End session',
  className = '',
  showThemeToggle = true,
  showSecondary = true,
}) {
  const resolvedSecondaryValue = secondaryValue ?? formatDuration(0);
  const resolvedTitle = quizLabel || getQuizNumberLabel({ quizTitle: title });
  const subtitle = title && title !== resolvedTitle ? title : workspaceLabel;

  return (
    <header className={cx(examHeaderClass, quizFlashPanelClass, className)}>
      <div className={examHeaderBrandClass}>
        <span className={examHeaderLogoClass} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1.5" y="1.5" width="19" height="19" rx="5" fill="url(#exam-header-logo)" />
            <path d="M10.2 6.1h1.6v3h3v1.6h-3v3h-1.6v-3h-3V9.1h3v-3Z" fill="#fff" />
            <circle cx="15.8" cy="6.2" r="1.2" fill="#fff" />
            <defs>
              <linearGradient id="exam-header-logo" x1="2" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#2563EB" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className={examHeaderTitleClass}>{resolvedTitle}</strong>
          </div>
          {subtitle ? <small className={examHeaderSubtitleClass}>{subtitle}</small> : null}
        </div>
      </div>

      <div className={examHeaderActionsClass}>
        {showThemeToggle ? <ThemeToggle /> : null}

        {showSecondary ? (
          <div className={examHeaderChipClass}>
            <span className={examHeaderIconClass} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4.6v3.8l2.3 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {secondaryLabel ? <span>{secondaryLabel}</span> : null}
            <strong className={examHeaderChipValueClass}>{resolvedSecondaryValue}</strong>
          </div>
        ) : null}

        <button className={examHeaderEndClass}
          type="button"
         
          onClick={onEndSession}
          disabled={saving}
        >
          {endLabel}
        </button>
      </div>
    </header>
  );
}

function formatExplanationBlocks(text) {
  return String(text || '')
    .split(/\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function PracticeAnswerKey({ question, revealed, className = '' }) {
  if (!revealed) return null;
  const items = getAnswerKeyItems(question);
  if (!items.length) return null;

  return (
    <section className={cx(practiceAnswerKeyClass, className)} aria-label="Answer key">
      <strong className={practiceAnswerKeyTitleClass}>Answer key</strong>
      <ul className={practiceAnswerKeyListClass}>
        {items.map((item, index) => (
          <li className={practiceAnswerKeyItemClass} key={`${item.label}-${index}`}>
            <span className={practiceAnswerKeyBadgeClass}>
              {item.answer ? `${item.label}: ${item.answer}` : item.label}
            </span>
            {item.text ? <span className={practiceAnswerKeyTextClass}>{item.text}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function getIncorrectOptionReasons(question) {
  const isTrueFalse = question?.questionType === 'true_false' || question?.question_type === 'true_false';
  return (question?.options || [])
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
}

function ExplanationRail({
  isExam,
  currentQuestion,
  currentQuestionAnswered,
  currentQuestionRevealed,
  canRevealAnswers,
}) {
  const keyPoints = currentQuestion?.theoryRecap?.keyPoints || [];

  return (
    <aside className={examExplainerClass}>
      <section className={cx(examPanelClass, quizFlashPanelClass)}>
        <div className={examCardHeadClass}>
          <div>
            <div className={examCardKickerClass}>Explanation</div>
            <strong>{isExam ? 'Available after submission' : 'Learning support'}</strong>
          </div>
        </div>

        {isExam ? (
          <div className={examExplanationEmptyClass}>
            <strong>Explanation stays hidden</strong>
            <p>Exam mode keeps explanations and correct answers hidden until you submit the paper.</p>
          </div>
        ) : !canRevealAnswers ? (
          <div className={examExplanationEmptyClass}>
            <strong>Available after review</strong>
            <p>Correct answers and explanations stay hidden while the practice session is active.</p>
          </div>
        ) : currentQuestionRevealed && (currentQuestion?.explanation || getIncorrectOptionReasons(currentQuestion).length) ? (
          <div className={examExplanationBodyClass}>
            <strong className="text-[13px] text-ink-strong">Answer explanation</strong>
            {formatExplanationBlocks(currentQuestion.explanation).map((part, index) => (
              <p key={`${index}-${part.slice(0, 24)}`}>{part}</p>
            ))}
            {getIncorrectOptionReasons(currentQuestion).length ? (
              <div className={examWhyIncorrectClass}>
                <strong>Why other answers are incorrect</strong>
                {getIncorrectOptionReasons(currentQuestion).map((item) => (
                  <div className={examWhyIncorrectItemClass} key={item.label}>
                    <span>{item.label}</span>
                    <div>
                      {item.text ? <strong>{item.text}</strong> : null}
                      <p>{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : currentQuestionRevealed ? (
          <div className={examExplanationEmptyClass}>
            <strong>Correct answer shown</strong>
            <p>The answer key is highlighted in the options for this question.</p>
          </div>
        ) : (
          <div className={examExplanationEmptyClass}>
            <strong>{currentQuestionAnswered ? 'Ready when you are' : 'Answer first'}</strong>
            <p>
              {currentQuestionAnswered
                ? 'Use "Show answer and explanation" to check this question and learn why.'
                : 'Select an answer first. Then reveal the explanation when you are ready to review.'}
            </p>
          </div>
        )}
      </section>

      {!isExam ? (
        <PracticeAnswerKey
          question={currentQuestion}
          revealed={currentQuestionRevealed}
        />
      ) : null}

      {!isExam && currentQuestion?.theoryRecap !== undefined ? (
        <div className="relative mt-2">
          <TheoryRecapPopupTrigger
            recap={currentQuestion.theoryRecap}
            context="practice"
            revealed={currentQuestionRevealed}
          />
        </div>
      ) : null}

      {!isExam && currentQuestionRevealed && keyPoints.length ? (
        <section className={cx(examPanelClass, quizFlashPanelClass, practiceKeyPointsClass)}>
          <div className={examCardKickerClass}>Key points</div>
          {keyPoints.map((point, index) => (
            <div className={practiceKeyPointClass} key={`${index}-${point.slice(0, 18)}`}>
              {point}
            </div>
          ))}
        </section>
      ) : null}
    </aside>
  );
}

function PracticeInlineLearningSupport({ currentQuestion, currentQuestionRevealed }) {
  const keyPoints = currentQuestion?.theoryRecap?.keyPoints || [];
  const hasRecap = Boolean(currentQuestion?.theoryRecap && (
    currentQuestion.theoryRecap.etiology?.length ||
    currentQuestion.theoryRecap.pathophysiology?.length ||
    currentQuestion.theoryRecap.clinicalFeatures?.length ||
    currentQuestion.theoryRecap.investigations?.length ||
    currentQuestion.theoryRecap.treatment?.length ||
    keyPoints.length ||
    currentQuestion.theoryRecap.mnemonic
  ));
  const explanationBlocks = formatExplanationBlocks(currentQuestion?.explanation);
  const incorrectReasons = getIncorrectOptionReasons(currentQuestion);
  const canShowRecapAlert = currentQuestion?.theoryRecap !== undefined;

  if (!canShowRecapAlert && !currentQuestionRevealed) return null;
  if (!hasRecap && !keyPoints.length && !explanationBlocks.length && !incorrectReasons.length) return null;

  return (
    <section className={practiceLearningSupportClass}>
      {currentQuestionRevealed && explanationBlocks.length ? (
        <div className={examExplanationBodyClass}>
          <strong className="text-[13px] text-ink-strong">Answer explanation</strong>
          {explanationBlocks.map((part, index) => (
            <p key={`${index}-${part.slice(0, 24)}`}>{part}</p>
          ))}
        </div>
      ) : null}

      {canShowRecapAlert ? (
        <TheoryRecapPopupTrigger
          recap={currentQuestion.theoryRecap}
          context="practice"
          revealed={currentQuestionRevealed}
        />
      ) : null}

      {currentQuestionRevealed && keyPoints.length ? (
        <div className={practiceKeyPointsClass}>
          <strong className="text-[13px] text-ink-strong">Key points</strong>
          {keyPoints.map((point, index) => (
            <div className={practiceKeyPointClass} key={`${index}-${point.slice(0, 18)}`}>
              {point}
            </div>
          ))}
        </div>
      ) : null}

      {currentQuestionRevealed && incorrectReasons.length ? (
        <div className={examWhyIncorrectClass}>
          <strong>Why other answers are incorrect</strong>
          {incorrectReasons.map((item) => (
            <div className={examWhyIncorrectItemClass} key={item.label}>
              <span>{item.label}</span>
              <div>
                {item.text ? <strong>{item.text}</strong> : null}
                <p>{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PracticeCelebrationOverlay({ quizTitle }) {
  const confetti = Array.from({ length: 132 }, (_, index) => index);
  return (
    <div className="practice-celebration" role="status" aria-live="polite" aria-label="Practice complete">
      <div className="practice-celebration__wash" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="practice-celebration__confetti" aria-hidden="true">
        {confetti.map((item) => (
          <i
            key={item}
            style={{
              '--pc-x': `${(item * 29) % 112 - 6}%`,
              '--pc-delay': `${item * 18}ms`,
              '--pc-drift': `${((item % 17) - 8) * 10}px`,
              '--pc-rot-a': `${item * 17}deg`,
              '--pc-rot-b': `${item * 53}deg`,
              '--pc-size': `${4 + (item % 5)}px`,
            }}
          />
        ))}
      </div>
      <section className="practice-celebration__center">
        <span className="practice-celebration__mark" aria-hidden="true">
          <span>🎉</span>
        </span>
        <p className="practice-celebration__kicker">Congratulations</p>
        <h2>Finally, we finished.</h2>
      </section>
    </div>
  );
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runPracticeCelebrationHaptics() {
  const start = performance.now();
  let pulse = 0;

  while (performance.now() - start < 1000) {
    await nativeTransientHaptic({
      intensity: 0.35 + ((pulse % 5) * 0.05),
      sharpness: 0.65 + ((pulse % 5) * 0.05),
    });
    await wait(pulse % 5 === 0 ? 36 : 44);
    pulse += 1;
  }
}

export function TakeQuizPage() {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const theme = useThemeStore((state) => state.theme);
  const examThemeVars = theme === 'dark' ? examThemeDarkVars : examThemeLightVars;
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'practice';
  const continuePractice = searchParams.get('continue') === '1';
  const resetPractice = searchParams.get('resetPractice') === '1';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState(() => new Set());
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState(() => new Set());
  const [revealedAnswerIds, setRevealedAnswerIds] = useState(() => new Set());
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [confirmExamSubmitOpen, setConfirmExamSubmitOpen] = useState(false);
  const [practiceCelebrating, setPracticeCelebrating] = useState(false);
  const questionContentRef = useRef(null);
  const answersRef = useRef({});

  useEffect(() => {
    async function load() {
      try {
        const payload = await loadStudentQuiz(quizId, {
          mode,
          continue: continuePractice ? '1' : '0',
          resetPractice: resetPractice ? '1' : '0',
        });
        const shuffledPayload = {
          ...payload,
          questions: payload.questions.map((question) => ({
            ...question,
            options: shuffleArray(question.options),
          })),
        };

        setData(shuffledPayload);
        setCurrentIndex(payload.practiceSession?.lastQuestionIndex || 0);
        setFlaggedQuestionIds(new Set());
        setBookmarkedQuestionIds(new Set());
        setRevealedAnswerIds(new Set());
        setHasAutoSubmitted(false);

        const initial = {};
        shuffledPayload.questions.forEach((q) => {
          if (q.savedAnswer) {
            initial[q.id] = q.questionType === 'sba'
              ? q.savedAnswer.selectedIds?.[0] ?? ''
              : q.savedAnswer.tfMap || {};
          }
        });
        setAnswers(initial);
        answersRef.current = initial;
        if (shuffledPayload.mode === 'exam') {
          const examSeconds = Math.max(Number(shuffledPayload.quiz?.timeLimit || 0) * 60, 0);
          setSecondsRemaining(examSeconds);
        } else {
          setSecondsRemaining(null);
        }
      } catch (e) {
        setError(getErrorMessage(e, 'Unable to load quiz'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [quizId, mode, continuePractice, resetPractice]);

  const isExam = data?.mode === 'exam';
  const totalQuestions = data?.questions?.length || 0;
  const currentQuestion = useMemo(() => data?.questions?.[currentIndex] || null, [data, currentIndex]);
  const answeredCount = useMemo(() => {
    if (!data?.questions?.length) return 0;
    return data.questions.reduce((count, question) => count + (isAnswered(question, answers[question.id]) ? 1 : 0), 0);
  }, [data, answers]);
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentQuestionAnswered = currentQuestion ? isAnswered(currentQuestion, answers[currentQuestion.id]) : false;
  const currentQuestionFlagged = currentQuestion ? flaggedQuestionIds.has(currentQuestion.id) : false;
  const currentQuestionBookmarked = currentQuestion ? bookmarkedQuestionIds.has(currentQuestion.id) : false;
  const currentQuestionRevealed = currentQuestion ? revealedAnswerIds.has(currentQuestion.id) : false;
  const currentQuestionCanReveal = Boolean(
    currentQuestion && !isExam && (
      hasQuestionAnswerKey(currentQuestion) ||
      currentQuestion.options?.some(hasOptionAnswerKey) ||
      currentQuestion.options?.length ||
      String(currentQuestion.explanation || '').trim() ||
      getIncorrectOptionReasons(currentQuestion).length ||
      currentQuestion.theoryRecap !== undefined
    )
  );

  const examDurationSeconds = isExam ? Math.max(Number(data?.quiz?.timeLimit || 0) * 60, 0) : 0;

  useEffect(() => {
    if (!data || !currentQuestion) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    window.requestAnimationFrame(() => {
      scrollQuestionContentIntoView(
        questionContentRef.current,
        prefersReducedMotion ? 'auto' : 'smooth'
      );
    });
  }, [currentIndex, currentQuestion?.id, data]);

  useEffect(() => {
    if (!isExam || !Number.isFinite(secondsRemaining) || secondsRemaining <= 0) return undefined;

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (!Number.isFinite(current) || current <= 1) return 0;
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isExam, secondsRemaining]);

  function updateSba(questionId, optionId) {
    setError('');
    const next = { ...(answersRef.current || {}), [questionId]: optionId };
    answersRef.current = next;
    setAnswers(next);
  }

  function updateTf(questionId, optionId, value) {
    setError('');
    const currentAnswers = answersRef.current || {};
    const next = {
      ...currentAnswers,
      [questionId]: { ...(currentAnswers[questionId] || {}), [optionId]: Number(value) },
    };
    answersRef.current = next;
    setAnswers(next);
  }

  async function practiceSave(nextIdx = currentIndex) {
    if (!currentQuestion || data?.mode !== 'practice') return true;
    const latestAnswers = answersRef.current || {};
    setSaving(true);
    try {
      const payload = currentQuestion.questionType === 'sba'
        ? {
            questionId: currentQuestion.id,
            questionIndex: nextIdx,
            questionType: 'sba',
            selected: latestAnswers[currentQuestion.id] ? [Number(latestAnswers[currentQuestion.id])] : [],
          }
        : {
            questionId: currentQuestion.id,
            questionIndex: nextIdx,
            questionType: 'true_false',
            tfAnswers: latestAnswers[currentQuestion.id] || {},
      };
      await savePracticeAnswer(quizId, payload);
      return true;
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to save progress'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(idx) {
    const bounded = Math.max(0, Math.min(idx, (data?.questions?.length || 1) - 1));
    setError('');
    if (data?.mode === 'practice' && !(await practiceSave(bounded))) return;
    setCurrentIndex(bounded);
  }

  async function finishPractice() {
    if (practiceCelebrating) return;
    setError('');
    if (data?.mode === 'practice') {
      const saved = await practiceSave(currentIndex);
      if (!saved) return;
    }
    setPracticeCelebrating(true);
    await Promise.all([
      runPracticeCelebrationHaptics(),
      wait(1000),
    ]);
    navigate(`/quizzes/${quizId}/practice-review?complete=1`);
  }

  async function handleSubmit() {
    setConfirmExamSubmitOpen(false);
    setError('');
    setSaving(true);
    try {
      const result = await submitExam(quizId, { answers: answersRef.current || answers });
      navigate(`/results/${result.attemptId}`);
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to submit exam'));
      setHasAutoSubmitted(false);
    } finally {
      setSaving(false);
    }
  }

  function requestExamSubmit() {
    if (saving) return;
    setConfirmExamSubmitOpen(true);
  }

  useEffect(() => {
    if (!isExam || secondsRemaining !== 0 || saving || hasAutoSubmitted) return;
    setHasAutoSubmitted(true);
    handleSubmit();
  }, [isExam, secondsRemaining, saving, hasAutoSubmitted]);

  function toggleFlagCurrentQuestion() {
    if (!currentQuestion) return;
    setFlaggedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }

  function toggleBookmarkCurrentQuestion() {
    if (!currentQuestion) return;
    setBookmarkedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }

  function revealCurrentAnswer() {
    if (!currentQuestion || !currentQuestionCanReveal) return;
    const questionId = currentQuestion.id;
    setError('');
    setRevealedAnswerIds((current) => {
      if (current.has(questionId)) return current;
      const next = new Set(current);
      next.add(questionId);
      return next;
    });
    void nativeImpact(ImpactStyle.Light);
  }

  const firstFlaggedIndex = data?.questions?.findIndex((question) => flaggedQuestionIds.has(question.id)) ?? -1;
  const firstUnansweredIndex = data?.questions?.findIndex((question) => !isAnswered(question, answers[question.id])) ?? -1;

  const blockSize = 10;
  const examBlocks = useMemo(() => {
    if (!totalQuestions) return [];
    return Array.from({ length: Math.ceil(totalQuestions / blockSize) }, (_, index) => {
      const start = index * blockSize + 1;
      const end = Math.min((index + 1) * blockSize, totalQuestions);
      const questionSlice = data.questions.slice(index * blockSize, end);
      const answeredInBlock = questionSlice.filter((question) => isAnswered(question, answers[question.id])).length;
      const currentBlock = currentIndex >= index * blockSize && currentIndex < end;
      const done = answeredInBlock === questionSlice.length;
      return {
        id: `block-${index + 1}`,
        label: `${start}-${end}`,
        current: currentBlock,
        done,
      };
    });
  }, [answers, currentIndex, data, totalQuestions]);

  if (loading) return (
    <main className={ui.studentScreenShell}>
      <div className={ui.quizLoadingState}>
        <div className={ui.quizLoadingSpinner} />
        <p>Preparing your quiz…</p>
      </div>
    </main>
  );

  if (!data || !currentQuestion) return (
    <main className={ui.studentScreenShell}>
      <div className={ui.emptyBox}>
        {error || 'Quiz unavailable.'}
        {error ? (
          <div className="mt-4">
            <button className={ui.primaryAction} type="button" onClick={() => navigate('/subscriptions')}>
              View plans
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );

  if (!isExam) {
    return (
      <main className={examScreenShellClass}>
        <section className={examLayoutClass} style={examThemeVars}>
          <ExamModeHeader
            title={data.quiz.quizTitle}
            quizLabel={getQuizNumberLabel(data.quiz)}
            isFree={data.quiz.isFree}
            secondaryLabel="Mode"
            secondaryValue="Practice"
            onEndSession={finishPractice}
            saving={saving || practiceCelebrating}
            theme={theme}
            workspaceLabel=""
            endLabel="Finish"
            className={practiceHeaderClass}
            showThemeToggle={false}
            showSecondary={false}
          />

          {error ? <div className={ui.feedbackError}>{error}</div> : null}

          <div className={cx(examGridClass, practiceGridClass)}>
            <aside className={examSidebarClass}>
              <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
                <div className={examQuestionTypeRowClass}>
                  <div className={examCardKickerClass}>Progress</div>
                  <span className={examChipMiniClass}>{currentQuestion.questionType === 'sba' ? 'SBA' : 'T/F'}</span>
                </div>
                <div className={examProgressToplineClass}>
                  <strong className={examProgressCurrentClass}>Question {currentIndex + 1} of {totalQuestions}</strong>
                  <span className={examProgressPercentClass}>{progressPercent}% complete</span>
                </div>
                <div className={examProgressBarClass}>
                  <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
                </div>
              </section>

              <section className={cx(examPanelClass, quizFlashPanelClass)}>
                <div className={examCardHeadClass}>
                  <div>
                    <div className={examCardKickerClass}>Question navigator</div>
                    <strong>Move through practice</strong>
                  </div>
                </div>

                <div className={examQuestionNavClass}>
                  {data.questions.map((question, index) => (
                    <button className={getExamNavBubbleClass({
                        active: index === currentIndex,
                        answered: isAnswered(question, answers[question.id]),
                        flagged: flaggedQuestionIds.has(question.id),
                        review: bookmarkedQuestionIds.has(question.id),
                      })}
                      key={question.id}
                      type="button"
                     
                      onClick={() => goTo(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className={examNavLegendClass}>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-brand-primary')} />Current</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#4CC46A]')} />Answered</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'border-[var(--exam-nav-idle-border)] bg-[var(--exam-progress-track)]')} />Not answered</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-purple-400')} />Review</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#FB923C]')} />Flagged</span>
                </div>

              </section>
            </aside>

            <section className={cx(examMainCardClass, quizFlashPanelClass, examQuestionStartAnchorClass)} ref={questionContentRef}>
              <div className={quizFlashQuestionCopyClass}>
                <div className={examQuestionNumberClass}>
                  Question {currentIndex + 1} <span aria-hidden="true">·</span> {currentQuestion.questionType === 'sba' ? 'Single best answer' : 'True / False'}
                </div>
                {currentQuestion.questionText}
              </div>

              <div className={examAnswerListClass}>
                {currentQuestion.questionType === 'sba' ? (
                  currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = Number(answers[currentQuestion.id]) === option.id;
                    const isCorrect = isCorrectOption(option);
                    const isWrong = currentQuestionRevealed && !isCorrect;
                    const letterLabel = getOptionDisplayLabel(option, optionIndex);

                    return (
                    <label className={cx(
                        examAnswerCardClass,
                        quizFlashAnswerCardClass,
                        isSelected && examAnswerSelectedClass,
                        isSelected && quizFlashSelectedAnswerClass,
                        currentQuestionRevealed && isCorrect && examAnswerCorrectClass,
                        isWrong && examAnswerWrongClass
                      )}
                      key={option.id}
                    >
                      <input className="sr-only"
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        checked={isSelected}
                        onChange={() => updateSba(currentQuestion.id, option.id)}
                      />
                      <span className={examAnswerContentClass}>
                        <span className={cx(
                          examAnswerLetterBadgeClass,
                          currentQuestionRevealed && isCorrect ? examAnswerLetterCorrectClass :
                          isWrong ? examAnswerLetterWrongClass :
                          isSelected ? examAnswerLetterSelectedClass : examAnswerLetterIdleClass
                        )} aria-hidden="true">{letterLabel}</span>
                        <span className={examAnswerTextStackClass}>
                          <span className={examAnswerCopyClass}>{option.optionText}</span>
                          {currentQuestionRevealed ? (
                            <span className={examAnswerStateRowClass}>
                              {isSelected ? (
                                <span className={cx(
                                  examAnswerStatePillClass,
                                  isCorrect ? examAnswerStateCorrectClass : examAnswerStateWrongClass
                                )}>
                                  Your answer · {isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                              ) : null}
                              {isCorrect ? (
                                <span className={cx(examAnswerStatePillClass, examAnswerStateCorrectClass)}>
                                  Correct answer
                                </span>
                              ) : !isSelected ? (
                                <span className={cx(examAnswerStatePillClass, examAnswerStateWrongClass)}>
                                  Incorrect
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                    );
                  })
                ) : (
                  currentQuestion.options.map((option) => {
                    const correctValue = isCorrectOption(option) ? 1 : 0;
                    const selectedValue = answers[currentQuestion.id]?.[option.id];
                    const hasSelectedValue = selectedValue === 1 || selectedValue === 0;
                    const selectedCorrect = hasSelectedValue && Number(selectedValue) === correctValue;

                    return (
                      <div className={cx(
                        examTfCardClass,
                        quizFlashAnswerCardClass,
                        currentQuestionRevealed && (correctValue === 1 ? examAnswerCorrectClass : examAnswerWrongClass)
                      )} key={option.id}>
                        <div className={examTfCopyClass}>
                          <span className={examAnswerCopyClass}>{option.optionText}</span>
                        </div>
                        <div className={examTfActionsClass}>
                          <button className={cx(examTfToggleClass, selectedValue === 1 && examTfTrueActiveClass)}
                            type="button"
                            onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                          >
                            True
                          </button>
                          <button className={cx(examTfToggleClass, selectedValue === 0 && examTfFalseActiveClass)}
                            type="button"
                            onClick={() => updateTf(currentQuestion.id, option.id, 0)}
                          >
                            False
                          </button>
                        </div>
                        {currentQuestionRevealed ? (
                          <div className={cx(examTfRevealClass, selectedCorrect ? examTfRevealTrueClass : examTfRevealFalseClass)}>
                            Your answer: {hasSelectedValue ? (selectedValue === 1 ? 'True' : 'False') : 'Not answered'} · Correct answer: {correctValue === 1 ? 'True' : 'False'}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <PracticeAnswerKey
                question={currentQuestion}
                revealed={currentQuestionRevealed}
                className="min-[901px]:hidden"
              />

              <PracticeInlineLearningSupport
                currentQuestion={currentQuestion}
                currentQuestionRevealed={currentQuestionRevealed}
              />

              <div className={examMainFooterClass}>
                <div className={examMainFooterLeftClass}>
                  <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass)}
                    type="button"
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0 || saving}
                  >
                    Previous
                  </button>

                  <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass)}
                    type="button"
                    onClick={revealCurrentAnswer}
                    disabled={currentQuestionRevealed || !currentQuestionCanReveal}
                  >
                    {currentQuestionRevealed ? 'Explanation shown' : currentQuestionCanReveal ? 'Show answer and explanation' : 'Available after review'}
                  </button>

                  <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass, currentQuestionBookmarked && 'border-brand-violet/25 bg-purple-100 text-brand-violet dark:bg-purple-500/15 dark:text-purple-200')}
                    type="button"
                    onClick={toggleBookmarkCurrentQuestion}
                  >
                    {currentQuestionBookmarked ? 'Review marked' : 'Mark review'}
                  </button>

                  <button
                    className={cx(examFooterIconButtonClass, quizFlashFooterButtonClass, currentQuestionFlagged && examFooterFlagActiveClass)}
                    type="button"
                    onClick={toggleFlagCurrentQuestion}
                    title={currentQuestionFlagged ? 'Remove flag' : 'Flag question'}
                    aria-label={currentQuestionFlagged ? 'Remove flag' : 'Flag question'}
                  >
                    <IcoFlag filled={currentQuestionFlagged} />
                  </button>
                </div>

                {currentIndex < totalQuestions - 1 ? (
                  <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                    type="button"
                   
                    onClick={() => goTo(currentIndex + 1)}
                    disabled={saving || practiceCelebrating}
                  >
                    {saving ? 'Saving…' : 'Next'}
                  </button>
                ) : (
                  <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                    type="button"
                   
                    onClick={finishPractice}
                    disabled={saving || practiceCelebrating}
                  >
                    Finish practice
                  </button>
                )}
              </div>
            </section>

            <ExplanationRail
              isExam={false}
              currentQuestion={currentQuestion}
              currentQuestionAnswered={currentQuestionAnswered}
              currentQuestionRevealed={currentQuestionRevealed}
              canRevealAnswers={currentQuestionCanReveal}
            />

          </div>

          <MobileQuizActionBar
            isExam={false}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            progressPercent={progressPercent}
            saving={saving || practiceCelebrating}
            currentQuestionFlagged={currentQuestionFlagged}
            currentQuestionRevealed={currentQuestionRevealed}
            canRevealAnswers={currentQuestionCanReveal}
            onPrevious={() => goTo(currentIndex - 1)}
            onReveal={revealCurrentAnswer}
            onFlag={toggleFlagCurrentQuestion}
            onNext={() => goTo(currentIndex + 1)}
            onFinish={finishPractice}
          />

          <section className={cx(examModeFooterClass, quizFlashPanelClass)}>
            <div className={examModeFooterBlockClass}>
              <strong>Block {Math.floor(currentIndex / blockSize) + 1} of {examBlocks.length}</strong>
              <small>{Math.min(blockSize, totalQuestions)} questions per block</small>
            </div>

            <div className={examModeFooterTrackerClass}>
              {examBlocks.map((block) => (
                <div key={block.id} className={cx(examBlockClass, block.done && examBlockDoneClass, block.current && examBlockCurrentClass)}>
                  <span className={cx(examBlockDotClass, block.done && examBlockDotDoneClass, block.current && examBlockDotCurrentClass)} />
                  <small>{block.label}</small>
                </div>
              ))}
            </div>

          </section>
          {practiceCelebrating ? <PracticeCelebrationOverlay quizTitle={data?.quiz?.quizTitle} /> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={examScreenShellClass}>
      <section className={examLayoutClass} style={examThemeVars}>
        <ExamModeHeader
          title={data.quiz.quizTitle}
          quizLabel={getQuizNumberLabel(data.quiz)}
          isFree={data.quiz.isFree}
          secondaryLabel=""
          secondaryValue={formatDuration(secondsRemaining)}
          onEndSession={requestExamSubmit}
          saving={saving}
          theme={theme}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={examGridClass}>
          <aside className={examSidebarClass}>
            <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
              <div className={examQuestionTypeRowClass}>
                <div className={examCardKickerClass}>Progress</div>
                <span className={examChipMiniClass}>{currentQuestion.questionType === 'sba' ? 'SBA' : 'T/F'}</span>
              </div>
              <div className={examProgressToplineClass}>
                <strong className={examProgressCurrentClass}>Question {currentIndex + 1} of {totalQuestions}</strong>
                <span className={examProgressPercentClass}>{progressPercent}% complete</span>
              </div>
              <div className={examProgressBarClass}>
                <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
              </div>
            </section>

            <section className={cx(examPanelClass, quizFlashPanelClass)}>
              <div className={examCardHeadClass}>
                <div>
                  <div className={examCardKickerClass}>Question navigator</div>
                  <strong>Move through the paper</strong>
                </div>
              </div>

              <div className={examQuestionNavClass}>
                {data.questions.map((question, index) => {
                  const answered = isAnswered(question, answers[question.id]);
                  const flagged = flaggedQuestionIds.has(question.id);
                  const reviewing = bookmarkedQuestionIds.has(question.id);
                  return (
                    <button className={getExamNavBubbleClass({
                        active: index === currentIndex,
                        answered,
                        flagged,
                        review: reviewing,
                      })}
                      key={question.id}
                      type="button"
                     
                      onClick={() => goTo(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className={examNavLegendClass}>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-brand-primary')} />Current</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#4CC46A]')} />Answered</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'border-[var(--exam-nav-idle-border)] bg-[var(--exam-progress-track)]')} />Not answered</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-purple-400')} />Review</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#FB923C]')} />Flagged</span>
              </div>

            </section>
          </aside>

          <section className={cx(examMainCardClass, quizFlashPanelClass, examQuestionStartAnchorClass)} ref={questionContentRef}>
            <div className={quizFlashQuestionCopyClass}>
              {currentQuestion.questionText}
            </div>

            <div className={examAnswerListClass}>
              {currentQuestion.questionType === 'sba' ? (
                currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = Number(answers[currentQuestion.id]) === option.id;
                  const letterLabel = DISPLAY_OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

                  return (
                  <label className={cx(
                      examAnswerCardClass,
                      quizFlashAnswerCardClass,
                      isSelected && examAnswerSelectedClass,
                      isSelected && quizFlashSelectedAnswerClass
                    )}
                    key={option.id}
                  >
                    <input className="sr-only"
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={isSelected}
                      onChange={() => updateSba(currentQuestion.id, option.id)}
                    />
                    <span className={examAnswerContentClass}>
                      <span className={cx(
                        examAnswerLetterBadgeClass,
                        isSelected ? examAnswerLetterSelectedClass : examAnswerLetterIdleClass
                      )} aria-hidden="true">{letterLabel}</span>
                      <span className={examAnswerCopyClass}>{option.optionText}</span>
                    </span>
                  </label>
                  );
                })
              ) : (
                currentQuestion.options.map((option) => (
                  <div className={cx(examTfCardClass, quizFlashAnswerCardClass)} key={option.id}>
                    <div className={examTfCopyClass}>
                      <span className={examAnswerCopyClass}>{option.optionText}</span>
                    </div>
                    <div className={examTfActionsClass}>
                      <button className={cx(examTfToggleClass, answers[currentQuestion.id]?.[option.id] === 1 && examTfTrueActiveClass)}
                        type="button"
                       
                        onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                      >
                        True
                      </button>
                      <button className={cx(examTfToggleClass, answers[currentQuestion.id]?.[option.id] === 0 && examTfFalseActiveClass)}
                        type="button"
                       
                        onClick={() => updateTf(currentQuestion.id, option.id, 0)}
                      >
                        False
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={examMainFooterClass}>
              <div className={examMainFooterLeftClass}>
                <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass)}
                  type="button"
                 
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={currentIndex === 0 || saving}
                >
                  Previous
                </button>
                <button
                  className={cx(examFooterButtonClass, quizFlashFooterButtonClass, currentQuestionBookmarked && 'border-brand-violet/25 bg-purple-100 text-brand-violet dark:bg-purple-500/15 dark:text-purple-200')}
                  type="button"
                  onClick={toggleBookmarkCurrentQuestion}
                >
                  {currentQuestionBookmarked ? 'Review marked' : 'Mark review'}
                </button>
                <button
                  className={cx(examFooterIconButtonClass, quizFlashFooterButtonClass, currentQuestionFlagged && examFooterFlagActiveClass)}
                  type="button"
                  onClick={toggleFlagCurrentQuestion}
                  title={currentQuestionFlagged ? 'Remove flag' : 'Flag question'}
                  aria-label={currentQuestionFlagged ? 'Remove flag' : 'Flag question'}
                >
                  <IcoFlag filled={currentQuestionFlagged} />
                </button>
              </div>

              <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                type="button"
               
                onClick={currentIndex < totalQuestions - 1 ? () => goTo(currentIndex + 1) : requestExamSubmit}
                disabled={saving}
              >
                {currentIndex < totalQuestions - 1 ? 'Next' : saving ? 'Submitting…' : 'Submit exam'}
              </button>
            </div>
          </section>

            <ExplanationRail
              isExam
              currentQuestion={currentQuestion}
              currentQuestionAnswered={currentQuestionAnswered}
              currentQuestionRevealed={false}
            />
        </div>

        <MobileQuizActionBar
          isExam
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          progressPercent={progressPercent}
          saving={saving}
          currentQuestionFlagged={currentQuestionFlagged}
          currentQuestionRevealed={false}
          onPrevious={() => goTo(currentIndex - 1)}
          onReveal={() => {}}
          onFlag={toggleFlagCurrentQuestion}
          onNext={() => goTo(Math.min(currentIndex + 1, totalQuestions - 1))}
          onFinish={requestExamSubmit}
        />

        <section className={cx(examModeFooterClass, quizFlashPanelClass)}>
          <div className={examModeFooterBlockClass}>
            <strong>Block {Math.floor(currentIndex / blockSize) + 1} of {examBlocks.length}</strong>
            <small>{Math.min(blockSize, totalQuestions)} questions per block</small>
          </div>

          <div className={examModeFooterTrackerClass}>
            {examBlocks.map((block) => (
              <div key={block.id} className={cx(examBlockClass, block.done && examBlockDoneClass, block.current && examBlockCurrentClass)}>
                <span className={cx(examBlockDotClass, block.done && examBlockDotDoneClass, block.current && examBlockDotCurrentClass)} />
                <small>{block.label}</small>
              </div>
            ))}
          </div>

        </section>

        {confirmExamSubmitOpen ? (
          <div
            className="fixed inset-0 z-[130] grid place-items-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-md dark:bg-[rgba(2,6,23,0.72)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-submit-confirm-title"
            onClick={() => setConfirmExamSubmitOpen(false)}
          >
            <div
              className="w-[min(420px,100%)] rounded-2xl border border-line-soft bg-surface-card-elevated p-5 shadow-2xl dark:border-white/[0.09]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-2">
                <h2 id="exam-submit-confirm-title" className="m-0 text-[18px] font-extrabold text-ink-strong">
                  Submit exam?
                </h2>
                <p className="m-0 text-[13px] leading-relaxed text-ink-soft">
                  This will end the exam session and send your answers for scoring.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cx(ui.secondaryButton, 'min-h-11 px-4 text-xs')}
                  onClick={() => setConfirmExamSubmitOpen(false)}
                  disabled={saving}
                >
                  Keep working
                </button>
                <button
                  type="button"
                  className={cx(ui.primaryAction, 'min-h-11 px-4 text-xs')}
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? 'Submitting…' : 'Submit exam'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
