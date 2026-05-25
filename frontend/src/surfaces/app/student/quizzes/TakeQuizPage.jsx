import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadStudentQuiz, savePracticeAnswer, submitExam } from '../../../../shared/api/quizAttempts.api.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { createQuestionReport } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { useThemeStore } from '../../../../shared/stores/themeStore.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getQuizNumberLabel } from './quizLabels.js';
import { ImpactStyle, nativeImpact, nativeSuccess } from '../../../../shared/utils/nativeHaptics.js';

const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const PRACTICE_CELEBRATION_CONFETTI = Array.from({ length: 56 }, (_, index) => ({
  id: index,
  x: `${(index * 37) % 112 - 6}%`,
  delay: `${index * 14}ms`,
  drift: `${((index % 13) - 6) * 9}px`,
  rotA: `${index * 23}deg`,
  rotB: `${index * 61}deg`,
  size: `${5 + (index % 4)}px`,
  tone: index % 6,
}));

function normalizeCorrectValue(option) {
  const raw = option?.isCorrect ?? option?.is_correct ?? option?.correct;
  return normalizeTrueFalseValue(raw);
}

function normalizeTrueFalseValue(raw) {
  if (raw === true) return 1;
  if (raw === false) return 0;
  if (raw === 1 || raw === 0) return raw;
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (['1', 'true', 'correct', 'yes'].includes(normalized)) return 1;
  if (['0', 'false', 'incorrect', 'no'].includes(normalized)) return 0;
  return null;
}

function getQuestionType(question) {
  return question?.questionType || question?.question_type || '';
}

function isSbaQuestion(question) {
  return getQuestionType(question) === 'sba';
}

function normalizeTfAnswerMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.entries(raw).reduce((next, [optionId, value]) => {
    const normalized = normalizeTrueFalseValue(value);
    if (normalized !== null) next[String(optionId)] = normalized;
    return next;
  }, {});
}

function getTfSelectedValue(answerMap, optionId) {
  return normalizeTrueFalseValue(normalizeTfAnswerMap(answerMap)[String(optionId)]);
}

function normalizeAnswersForBackend(answerMap, questions = []) {
  const normalized = {};
  for (const question of questions) {
    const questionId = String(question.id);
    const value = answerMap?.[question.id] ?? answerMap?.[questionId];
    if (isSbaQuestion(question)) {
      if (value !== undefined && value !== null && value !== '') normalized[questionId] = Number(value);
      continue;
    }
    const tfAnswers = normalizeTfAnswerMap(value);
    if (Object.keys(tfAnswers).length) normalized[questionId] = tfAnswers;
  }
  return normalized;
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
const examScreenShellClass = `${ui.studentScreenShell} lms-exam-page px-[clamp(12px,2vw,24px)] pb-[clamp(18px,2.8vw,30px)] pt-[clamp(10px,1.4vw,18px)] max-[700px]:pb-28 max-[600px]:p-3.5 max-[600px]:pb-28`;
const examLayoutClass = 'lms-exam-layout mx-auto grid w-full max-w-none gap-[18px] bg-[var(--exam-shell-bg)] pb-2.5';
const practiceScreenShellClass = `${ui.studentScreenShell} dashboard-page study-hub-page lms-exam-page practice-review-page practice-quiz-page max-[700px]:pb-28`;
const practiceLayoutClass = 'study-hub-shell practice-review-shell lms-exam-layout mx-auto grid w-full max-w-none min-w-0 grid-cols-1 gap-[18px] bg-transparent pb-2.5';
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
  '--exam-answer-text': '#3b4b68',
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
  'lms-exam-header sticky top-2.5 z-20 flex items-center justify-between gap-3 rounded-[18px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3 py-2.5 shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:static max-[700px]:flex-col max-[700px]:items-stretch';
const practiceHeaderClass = 'practice-review-header max-[700px]:!flex-row max-[700px]:!items-center max-[700px]:!justify-between max-[700px]:gap-3 max-[700px]:px-3.5 max-[700px]:py-3 [&_.quiz-header-actions]:shrink-0';
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
const practiceHeaderEndClass = 'border-brand-primary/22 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/14 dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200';
const examGridClass = 'lms-exam-grid grid w-full max-w-none grid-cols-[minmax(240px,300px)_minmax(0,980px)_minmax(240px,300px)] items-start justify-center gap-[18px] max-[1180px]:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] max-[900px]:grid-cols-1';
const practiceGridClass = 'lms-review-workspace';
const examSidebarClass = 'lms-exam-sidebar grid gap-[18px]';
const examExplainerClass = 'lms-exam-explainer col-start-3 col-span-1 grid self-start gap-[18px] max-[1180px]:hidden';
const examPanelClass =
  'border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-[18px] shadow-[var(--exam-card-shadow)]';
const examProgressPanelClass =
  'relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))] before:content-[""]';
const examMainCardClass =
  'lms-exam-main-card grid min-h-[540px] grid-rows-[auto_auto_auto] border border-[var(--exam-card-border)] bg-[var(--exam-main-bg)] p-[clamp(20px,3vw,36px)] shadow-[var(--exam-card-shadow)] max-[600px]:min-h-[auto]';
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
const quizFlashQuestionCopyClass = 'lms-reading-question m-0 max-w-[76ch] whitespace-pre-line text-left text-[16px] font-medium leading-[1.62] tracking-normal text-ink-strong [text-wrap:pretty] max-[640px]:text-[15.5px] max-[640px]:leading-[1.6]';
const quizFlashAnswerCardClass =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.88))] dark:bg-[linear-gradient(180deg,rgba(17,27,44,0.94),rgba(10,18,31,0.98))]';
const quizFlashSelectedAnswerClass = 'bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(230,240,255,0.92))]';
const quizFlashFooterButtonClass = 'rounded-xl';
const quizFlashNextButtonClass = 'shadow-none';
const quizFlashTipClass = 'border border-slate-400/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.06))]';
const examQuestionStartAnchorClass = 'scroll-mt-4';
const examQuestionNavClass = 'lms-exam-question-nav grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-2 max-[900px]:grid-cols-8 max-[600px]:grid-cols-5';
const examNavBubbleBaseClass =
  'lms-exam-nav-bubble min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity] duration-150 active:opacity-85';
const examNavLegendClass = 'lms-exam-nav-legend mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] font-bold leading-tight text-ink-soft';
const examNavLegendItemClass = 'inline-flex min-w-0 items-center gap-1 whitespace-nowrap';
const examNavLegendDotClass = 'lms-exam-nav-legend-dot inline-block size-2.5 shrink-0 rounded border border-transparent';
const examNavJumpsClass = 'mt-[18px] grid gap-2.5';
const examNavJumpClass =
  'flex min-h-[46px] items-center justify-between gap-3 rounded-[14px] border border-[var(--exam-jump-border)] bg-[var(--exam-jump-bg)] px-4 text-sm font-bold text-[var(--exam-jump-text)] shadow-none disabled:bg-[var(--exam-jump-disabled-bg)] disabled:text-[var(--exam-jump-disabled-text)]';
const examExplanationEmptyClass =
  'rounded-[14px] border border-dashed border-[var(--exam-card-border)] bg-[var(--exam-soft-panel)] p-4 text-sm leading-relaxed text-ink-soft [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[14px] [&_strong]:text-ink-strong [&_p]:m-0';
const practiceLearningSupportClass = 'mt-0 grid gap-3 pt-0';
const quizReviewExplanationClass =
  'lms-learning-reveal-card mt-0 grid gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_5%,var(--surface-2))_0%,var(--surface-2)_58%,color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1))_100%)] p-4 shadow-[0_14px_34px_color-mix(in_srgb,var(--color-primary)_7%,transparent)] max-[640px]:rounded-[16px] max-[640px]:p-3.5';
const quizReviewIncorrectCardClass =
  'lms-learning-reveal-card mt-0 grid gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_7%,var(--surface-2))_0%,var(--surface-2)_62%,color-mix(in_srgb,var(--color-warning)_4%,var(--surface-1))_100%)] p-4 shadow-[0_14px_34px_color-mix(in_srgb,var(--color-warning)_8%,transparent)] max-[640px]:rounded-[16px] max-[640px]:p-3.5';
const quizReviewExplanationHeaderClass =
  'flex items-center justify-between gap-2.5 border-b border-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] pb-2.5 max-[640px]:flex-col max-[640px]:items-start [&_h3]:m-0 [&_h3]:text-[12px] [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-[0.11em] [&_h3]:text-ink-soft max-[640px]:[&_h3]:text-[11px]';
const quizReviewExplanationGridClass = 'grid grid-cols-1 gap-3.5';
const quizReviewExplanationCopyClass =
  'lms-reading-explanation grid gap-2.5 text-left [&_p]:m-0 [&_p]:max-w-[78ch] [&_p]:whitespace-pre-line [&_p]:text-[15px] [&_p]:font-normal [&_p]:leading-[1.72] [&_p]:tracking-normal [&_p]:text-ink-medium [&_p]:[text-wrap:pretty] max-[640px]:[&_p]:text-[14.5px] max-[640px]:[&_p]:leading-[1.66]';
const quizReviewIncorrectListClass =
  'overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-2))]';
const quizReviewIncorrectItemClass =
  'grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 border-t border-[color-mix(in_srgb,var(--color-warning)_14%,var(--line-soft))] px-2.5 py-2 first:border-t-0 max-[640px]:grid-cols-[22px_minmax(0,1fr)] max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-1.5';
const quizReviewIncorrectBadgeClass =
  'inline-flex size-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-warning)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] text-[11px] font-black text-[#92400e] max-[640px]:size-[22px] max-[640px]:text-[10px]';
const quizReviewIncorrectCopyClass =
  'lms-reading-incorrect min-w-0 text-left [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:leading-snug [&_strong]:text-ink-strong [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-[13.5px] [&_p]:font-normal [&_p]:leading-[1.56] [&_p]:text-ink-medium max-[640px]:[&_strong]:text-[12.5px] max-[640px]:[&_p]:text-[13px] max-[640px]:[&_p]:leading-[1.52]';
const quizReviewRecapActionClass = 'lms-study-recap-action flex justify-start';
const quizReviewStudyListClass = 'm-0 grid list-none gap-2 p-0';
const quizReviewStudyCardClass =
  'lms-key-points-card relative grid gap-3 rounded-[18px] border border-[color-mix(in_srgb,#8b5cf6_20%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_7%,var(--surface-1))_0%,var(--surface-1)_72%)] px-4 py-3.5 shadow-[0_12px_28px_color-mix(in_srgb,#8b5cf6_7%,transparent)] transition-colors hover:border-[color-mix(in_srgb,#8b5cf6_28%,var(--line-soft))] [&_h4]:m-0 [&_h4]:text-[11px] [&_h4]:font-extrabold [&_h4]:uppercase [&_h4]:tracking-[0.08em] [&_h4]:text-ink-soft [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-left [&_p]:text-[13.5px] [&_p]:font-normal [&_p]:leading-[1.62] [&_p]:text-ink-strong max-[640px]:rounded-[16px] max-[640px]:px-3.5 max-[640px]:[&_p]:text-sm';
const practiceKeyPointsClass = 'lms-quiz-key-points-card grid gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,#8b5cf6_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_5%,var(--surface-1))_0%,var(--surface-1)_74%)] p-4 shadow-none';
const practiceKeyPointClass = 'lms-reading-incorrect rounded-[12px] border border-[color-mix(in_srgb,var(--color-primary)_12%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-2))] px-3 py-2 text-left text-[13px] font-medium leading-[1.58] text-ink-strong';
const examAnswerListClass = 'lms-review-options-grid grid gap-2.5';
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
const examTfCopyClass = 'flex min-w-0 flex-1 items-center gap-2.5';
const examTfActionsClass = 'flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start';
const examTfToggleClass =
  'min-h-10 touch-manipulation rounded-xl border border-[var(--exam-tf-border)] bg-[var(--exam-tf-bg)] px-4 text-[13px] font-bold text-[var(--exam-tf-text)] shadow-none transition-colors active:opacity-85 max-[600px]:min-h-11 max-[600px]:flex-1';
const examTfAnsweredClass = 'border-[var(--exam-answer-selected-border)] shadow-[var(--exam-answer-selected-ring)]';
const examTfTrueActiveClass = '!border-[color-mix(in_srgb,var(--sa-ok)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_13%,var(--sa-surface))] !text-emerald-700 dark:!bg-[color-mix(in_srgb,var(--sa-ok)_19%,var(--sa-surface))] dark:!text-emerald-100';
const examTfFalseActiveClass = '!border-[color-mix(in_srgb,var(--sa-danger)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_12%,var(--sa-surface))] !text-red-600 dark:!bg-[color-mix(in_srgb,var(--sa-danger)_18%,var(--sa-surface))] dark:!text-red-100';
const examTfChoiceCorrectClass = '!border-[color-mix(in_srgb,var(--sa-ok)_34%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_14%,var(--sa-surface))] !text-emerald-700 dark:!bg-[color-mix(in_srgb,var(--sa-ok)_20%,var(--sa-surface))] dark:!text-emerald-100';
const examTfChoiceWrongClass = '!border-[color-mix(in_srgb,var(--sa-danger)_34%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_12%,var(--sa-surface))] !text-red-600 dark:!bg-[color-mix(in_srgb,var(--sa-danger)_18%,var(--sa-surface))] dark:!text-red-100';
const examTfRevealClass =
  'basis-full grid grid-cols-2 gap-2 rounded-[12px] border px-3 py-2 text-left max-[600px]:grid-cols-1';
const examTfRevealTrueClass = 'border-emerald-500/20 bg-emerald-500/8 text-emerald-800 dark:text-emerald-100';
const examTfRevealFalseClass = 'border-red-500/20 bg-red-500/8 text-red-700 dark:text-red-100';
const examTfRevealMissingClass = 'border-amber-500/24 bg-amber-500/10 text-amber-800 dark:text-amber-100';
const examTfRevealItemClass = 'rounded-[10px] border border-black/5 bg-white/65 px-2.5 py-2 dark:border-white/10 dark:bg-white/5';
const examTfRevealItemCorrectClass = 'border-emerald-500/18 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100';
const examTfRevealItemWrongClass = 'border-red-500/18 bg-red-500/10 text-red-700 dark:text-red-100';
const examTfRevealItemMissingClass = 'border-amber-500/20 bg-amber-500/12 text-amber-800 dark:text-amber-100';
const examTfRevealLabelClass = 'block text-[10px] font-black uppercase leading-none tracking-[0.08em] opacity-70';
const examTfRevealValueClass = 'mt-1 block text-[13.5px] font-extrabold leading-tight';
const examAnswerLetterBadgeClass = 'grid size-[30px] shrink-0 place-items-center rounded-lg border-2 text-[12px] font-black transition-[background,border-color,color] duration-150';
const examAnswerLetterIdleClass = 'border-[var(--exam-answer-border)] bg-transparent text-[var(--exam-answer-text)] opacity-75';
const examAnswerLetterSelectedClass = '!border-brand-primary/40 !bg-[var(--color-primary-light)] !text-brand-primary opacity-100';
const examAnswerLetterCorrectClass = '!border-emerald-500/40 !bg-emerald-500/12 !text-emerald-700 dark:!text-emerald-200 opacity-100';
const examAnswerLetterWrongClass = '!border-red-500/40 !bg-red-500/12 !text-red-600 dark:!text-red-200 opacity-100';
const examMainFooterClass = 'lms-exam-main-footer flex items-center justify-between gap-2.5 rounded-[18px] border border-line-soft bg-surface-2 p-2.5 max-[700px]:hidden [&>*]:min-w-0 [&>div]:flex [&>div]:flex-wrap [&>div]:items-center [&>div]:gap-2.5';
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
  'lms-mobile-quiz-bar fixed inset-x-0 bottom-0 z-[95] hidden rounded-t-[24px] border-x-0 border-b-0 border-t border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_44px_rgba(15,23,42,0.13)] backdrop-blur-xl max-[700px]:block';
const mobileQuizBarTopClass = 'mb-2 flex items-center justify-between gap-3 text-[12px] font-bold text-ink-soft';
const mobileQuizBarActionsClass = 'grid grid-cols-[44px_44px_minmax(88px,1fr)_minmax(118px,1.18fr)] gap-2';
const mobileQuizIconButtonClass =
  'grid min-h-11 place-items-center rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] text-[13px] font-extrabold text-[var(--exam-footer-btn-text)] disabled:opacity-45';
const mobileQuizPrimaryClass =
  'min-h-11 rounded-xl border border-brand-primary/35 bg-[var(--color-primary-light)] px-3 text-[13px] font-extrabold text-brand-primary disabled:opacity-55';
const questionMiniActionClass =
  'min-h-11 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-surface)] px-[18px] text-sm font-bold text-[var(--sa-ink)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const questionCardActionRowClass = 'mt-3 flex flex-wrap items-center gap-2 max-[700px]:hidden';
const questionUtilityRowClass = 'lms-question-utility-row mt-4 flex items-center justify-start gap-2 border-t border-line-soft pt-3 max-[700px]:pt-2.5';
const questionUtilityButtonClass =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--sa-border)] bg-[var(--sa-surface)] text-ink-soft shadow-none transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_26%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))] hover:text-brand-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const quizUnifiedMainCardClass =
  'lms-review-question-card grid w-full justify-self-stretch gap-[16px] p-[22px_24px] max-[640px]:gap-3.5 max-[640px]:p-3.5';
const quizUnifiedAnswerCardClass =
  'relative grid gap-2 overflow-hidden rounded-2xl border-[1.5px] border-line-soft bg-surface-1 px-4 py-3.5 transition-shadow';
const quizUnifiedAnswerSelectedClass =
  'border-[color-mix(in_srgb,var(--color-primary)_36%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1))] shadow-none';
const quizUnifiedAnswerCorrectClass =
  'border-[color-mix(in_srgb,var(--color-success)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--surface-1))] shadow-none';
const quizUnifiedAnswerWrongClass =
  'border-[color-mix(in_srgb,var(--color-error)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_9%,var(--surface-1))] shadow-none';
const quizUnifiedAnswerUnansweredClass =
  'border-[color-mix(in_srgb,#d97706_30%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_6%,var(--surface-1))] shadow-[0_0_0_1px_color-mix(in_srgb,#d97706_12%,transparent)]';
const quizUnifiedFooterButtonClass =
  'min-h-11 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-surface)] px-[18px] text-sm font-bold text-[var(--sa-ink)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const quizUnifiedPrimaryFooterButtonClass =
  'min-h-11 rounded-xl border border-brand-primary/30 bg-[var(--color-primary-light)] px-[18px] text-sm font-bold text-brand-primary shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55';
const quizReviewOptionToplineClass = 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start';
const quizReviewOptionLeadClass = 'flex min-w-0 flex-auto items-start gap-2';
const quizReviewOptionTextClass = 'lms-reading-answer m-0 min-w-0 flex-auto whitespace-pre-line text-left text-[15px] font-medium leading-[1.48] text-ink-strong max-[640px]:text-sm max-[640px]:leading-[1.45]';
const quizReviewOptionLabelsClass = 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start';
const quizReviewQuestionTextClass = quizFlashQuestionCopyClass;
const quizReviewChipToneClass = {
  correct: 'border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_12%,var(--surface-2))] text-brand-success',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_11%,var(--surface-2))] text-brand-error',
  unanswered: 'border-[color-mix(in_srgb,#d97706_24%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_9%,var(--surface-2))] text-[#b45309]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};
const quizReviewOptionIconToneClass = {
  selected: 'border-brand-primary/45 bg-brand-primary/15 text-brand-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]',
  correct: 'border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-brand-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_12%,transparent)]',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)] text-brand-error shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error)_12%,transparent)]',
  unanswered: 'border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#b45309]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};

function quizReviewChipClass(tone = 'neutral') {
  return cx(
    'inline-flex min-h-[22px] items-center gap-1.5 rounded-full border px-[7px] py-[3px] text-[10.5px] font-extrabold tracking-[0.01em]',
    quizReviewChipToneClass[tone] || quizReviewChipToneClass.neutral
  );
}

function quizReviewOptionIconClass(tone = 'neutral') {
  return cx(
    'inline-grid size-6 shrink-0 place-items-center rounded-full border text-xs font-extrabold',
    quizReviewOptionIconToneClass[tone] || quizReviewOptionIconToneClass.neutral
  );
}

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
  currentQuestionBookmarked,
  currentQuestionRevealed,
  canRevealAnswers,
  onPrevious,
  onReveal,
  onFlag,
  onBookmark,
  onReport,
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

function QuestionUtilityActions({
  bookmarked,
  busy,
  onBookmark,
  onReport,
}) {
  return (
    <div className={questionUtilityRowClass} aria-label="Question utilities">
      <button
        className={cx(questionUtilityButtonClass, bookmarked && 'border-brand-violet/25 bg-purple-100 text-brand-violet dark:bg-purple-500/15 dark:text-purple-200')}
        type="button"
        onClick={onBookmark}
        disabled={busy}
        title={bookmarked ? 'Saved question' : 'Save question'}
        aria-label={bookmarked ? 'Saved question' : 'Save question'}
      >
        <IcoBookmark filled={bookmarked} />
      </button>
      <button
        className={questionUtilityButtonClass}
        type="button"
        onClick={onReport}
        disabled={busy}
        title="Report question"
        aria-label="Report question"
      >
        <IcoReport />
      </button>
    </div>
  );
}

function getExamNavBubbleClass({ active, answered, flagged, review }) {
  const stateClass = active
    ? 'is-current'
    : flagged
      ? 'is-flagged'
      : review
        ? 'is-review'
        : answered
          ? 'is-answered'
          : 'is-idle';

  return cx(
    examNavBubbleBaseClass,
    stateClass
  );
}

function isAnswered(question, value) {
  if (!question) return false;
  if (isSbaQuestion(question)) return value !== undefined && value !== null && value !== '';
  return Object.keys(normalizeTfAnswerMap(value)).length > 0;
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
  endButtonClass = '',
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

        <button className={cx(examHeaderEndClass, endButtonClass)}
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

function formatPrimaryExplanationBlocks(text, hasStructuredDistractors = false) {
  const blocks = formatExplanationBlocks(text);
  if (!hasStructuredDistractors) return blocks;

  const distractorStartIndex = blocks.findIndex((block) => /why\s+(not\s+)?(the\s+)?others/i.test(block));
  return distractorStartIndex >= 0 ? blocks.slice(0, distractorStartIndex) : blocks;
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

function ExplanationRail({
  isExam,
  currentQuestion,
  currentQuestionRevealed,
}) {
  return (
    <aside className={examExplainerClass}>
      {!isExam ? (
        <PracticeStudySupport
          currentQuestion={currentQuestion}
          revealed={currentQuestionRevealed}
        />
      ) : (
        <section className={cx(examPanelClass, quizFlashPanelClass)}>
          <div className={examCardHeadClass}>
            <div>
              <div className={examCardKickerClass}>Explanation</div>
              <strong>Available after submission</strong>
            </div>
          </div>
          <div className={examExplanationEmptyClass}>
            <strong>Explanation stays hidden</strong>
            <p>Exam mode keeps explanations and correct answers hidden until you submit the paper.</p>
          </div>
        </section>
      )}
    </aside>
  );
}

function PracticeStudySupport({ currentQuestion, revealed = true, className = '' }) {
  const hasRecap = currentQuestion?.theoryRecap !== undefined;
  const hasStudyCard = revealed && hasTheoryRecap(currentQuestion?.theoryRecap);

  if (!hasRecap && !hasStudyCard) return null;

  return (
    <div className={cx('lms-study-support-stack grid gap-3', className)}>
      {hasRecap ? (
        <div className={quizReviewRecapActionClass}>
          <TheoryRecapPopupTrigger
            recap={currentQuestion.theoryRecap}
            context="practice"
            revealed={revealed}
          />
        </div>
      ) : null}

      {hasStudyCard ? (
        <article className={quizReviewStudyCardClass}>
          <h4>Key Points</h4>
          {currentQuestion.theoryRecap.conceptName ? <p><strong>{currentQuestion.theoryRecap.conceptName}</strong></p> : null}
          {currentQuestion.theoryRecap.keyPoints?.length ? (
            <ul className={quizReviewStudyListClass}>
              {currentQuestion.theoryRecap.keyPoints.slice(0, 4).map((point, index) => (
                <li
                  className="relative rounded-[12px] border border-[color-mix(in_srgb,#8b5cf6_12%,var(--line-soft))] bg-[color-mix(in_srgb,#8b5cf6_4%,var(--surface-2))] py-2 pl-8 pr-3 text-[13px] leading-[1.48] text-ink-strong before:absolute before:left-3 before:top-2 before:font-extrabold before:leading-[1.35] before:text-brand-primary before:content-['›'] max-[640px]:text-sm"
                  key={`${index}-${point.slice(0, 16)}`}
                >
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}

function PracticeInlineLearningSupport({ currentQuestion, currentQuestionRevealed, className = '', showStudySupport = false }) {
  const incorrectReasons = getIncorrectOptionReasons(currentQuestion);
  const explanationBlocks = formatPrimaryExplanationBlocks(currentQuestion?.explanation, incorrectReasons.length > 0);
  const explanationTitle = explanationBlocks.length
    ? 'Explanation'
    : incorrectReasons.length
      ? 'Why other options are incorrect'
      : 'Explanation';

  if (!currentQuestionRevealed) return null;
  if (!explanationBlocks.length && !incorrectReasons.length) return null;

  return (
    <div className={cx(practiceLearningSupportClass, className)}>
      {explanationBlocks.length ? (
        <section className={quizReviewExplanationClass} aria-label="Answer explanation">
          <div className={quizReviewExplanationHeaderClass}>
            <h3>Explanation</h3>
          </div>
          <div className={quizReviewExplanationGridClass}>
            <div className={quizReviewExplanationCopyClass}>
              {explanationBlocks.map((part, index) => (
                <p key={`${index}-${part.slice(0, 24)}`}>{part}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {incorrectReasons.length ? (
        <section className={quizReviewIncorrectCardClass} aria-label="Why other answers are incorrect">
          <div className={quizReviewExplanationHeaderClass}>
            <h3>{explanationBlocks.length ? 'Why other answers are incorrect' : explanationTitle}</h3>
          </div>
          <div className={quizReviewExplanationGridClass}>
            <div className={quizReviewIncorrectListClass}>
              {incorrectReasons.map((item) => (
                <div className={quizReviewIncorrectItemClass} key={item.label}>
                  <span className={quizReviewIncorrectBadgeClass}>{item.label}</span>
                  <div className={quizReviewIncorrectCopyClass}>
                    {item.text ? <strong>{item.text}</strong> : null}
                    <p>{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {showStudySupport ? (
        <PracticeStudySupport
          currentQuestion={currentQuestion}
          revealed={true}
        />
      ) : null}
    </div>
  );
}


function PracticeCelebrationOverlay({ quizTitle }) {
  return (
    <div className="practice-celebration" role="status" aria-live="polite" aria-label="Practice complete">
      <div className="practice-celebration__wash" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="practice-celebration__confetti" aria-hidden="true">
        {PRACTICE_CELEBRATION_CONFETTI.map((item) => (
          <i
            key={item.id}
            className={`practice-celebration__piece practice-celebration__piece--${item.tone}`}
            style={{
              '--pc-x': item.x,
              '--pc-delay': item.delay,
              '--pc-drift': item.drift,
              '--pc-rot-a': item.rotA,
              '--pc-rot-b': item.rotB,
              '--pc-size': item.size,
            }}
          />
        ))}
      </div>
      <section className="practice-celebration__center">
        <span className="practice-celebration__mark" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path d="M8.5 17.8 14 23.2 25.8 10.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="practice-celebration__kicker">Congratulations</p>
        <h2>Finally, we finished.</h2>
        {quizTitle ? <small>{quizTitle}</small> : null}
      </section>
    </div>
  );
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runPracticeCelebrationHaptics() {
  await nativeSuccess();
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
  const [questionActionBusy, setQuestionActionBusy] = useState(false);
  const questionContentRef = useRef(null);
  const answersRef = useRef({});

  useEffect(() => {
    async function load() {
      try {
        const [payload, savedItems] = await Promise.all([
          loadStudentQuiz(quizId, {
            mode,
            continue: continuePractice ? '1' : '0',
            resetPractice: resetPractice ? '1' : '0',
          }),
          fetchStudyBookmarks().catch(() => []),
        ]);
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
        setBookmarkedQuestionIds(new Set(
          (Array.isArray(savedItems) ? savedItems : [])
            .filter((item) => item.itemType === 'question')
            .map((item) => Number(item.itemId))
            .filter(Boolean)
        ));
        setRevealedAnswerIds(new Set());
        setHasAutoSubmitted(false);

        const initial = {};
        shuffledPayload.questions.forEach((q) => {
          if (q.savedAnswer) {
            initial[q.id] = isSbaQuestion(q)
              ? q.savedAnswer.selectedIds?.[0] ?? ''
              : normalizeTfAnswerMap(q.savedAnswer.tfMap);
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
    const currentQuestionAnswers = normalizeTfAnswerMap(currentAnswers[questionId]);
    const normalizedValue = normalizeTrueFalseValue(value);
    if (normalizedValue === null) return;
    const next = {
      ...currentAnswers,
      [questionId]: { ...currentQuestionAnswers, [String(optionId)]: normalizedValue },
    };
    answersRef.current = next;
    setAnswers(next);
  }

  async function practiceSave(nextIdx = currentIndex) {
    if (!currentQuestion || data?.mode !== 'practice') return true;
    const latestAnswers = answersRef.current || {};
    setSaving(true);
    try {
      const payload = isSbaQuestion(currentQuestion)
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
            tfAnswers: normalizeTfAnswerMap(latestAnswers[currentQuestion.id]),
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
      wait(850),
    ]);
    navigate(`/quizzes/${quizId}/practice-review?complete=1`);
  }

  async function handleSubmit() {
    setConfirmExamSubmitOpen(false);
    setError('');
    setSaving(true);
    try {
      const result = await submitExam(quizId, {
        answers: normalizeAnswersForBackend(answersRef.current || answers, data?.questions || []),
      });
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

  async function toggleBookmarkCurrentQuestion() {
    if (!currentQuestion) return;
    setQuestionActionBusy(true);
    setError('');
    try {
      const result = await toggleStudyBookmark({ itemType: 'question', itemId: currentQuestion.id });
      setBookmarkedQuestionIds((current) => {
        const next = new Set(current);
        if (result.saved) next.add(currentQuestion.id);
        else next.delete(currentQuestion.id);
        return next;
      });
    } catch (bookmarkError) {
      setError(getErrorMessage(bookmarkError, 'Unable to update question bookmark'));
    } finally {
      setQuestionActionBusy(false);
    }
  }

  async function reportCurrentQuestion() {
    if (!currentQuestion) return;
    const comment = window.prompt('Tell admin what is wrong with this question. You can leave it blank if you only want to flag it.');
    if (comment === null) return;
    setQuestionActionBusy(true);
    setError('');
    try {
      await createQuestionReport({
        questionId: currentQuestion.id,
        reason: 'Student reported question',
        comment: comment.trim() || `Student reported question #${currentQuestion.id}`,
      });
      window.alert(`Question #${currentQuestion.id} was reported to admin.`);
    } catch (reportError) {
      setError(getErrorMessage(reportError, 'Unable to report question'));
    } finally {
      setQuestionActionBusy(false);
    }
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
      <main className={practiceScreenShellClass}>
        <section className={practiceLayoutClass} style={examThemeVars}>
          <ExamModeHeader
            title={data.quiz.quizTitle}
            quizLabel={getQuizNumberLabel(data.quiz)}
            isFree={data.quiz.isFree}
            secondaryLabel="Mode"
            secondaryValue="Practice"
            onEndSession={finishPractice}
            saving={saving || practiceCelebrating || questionActionBusy}
            theme={theme}
            workspaceLabel=""
            endLabel="Finish"
            className={practiceHeaderClass}
            showThemeToggle
            showSecondary={false}
            endButtonClass={practiceHeaderEndClass}
          />

          {error ? <div className={ui.feedbackError}>{error}</div> : null}

          <div className={cx(examGridClass, practiceGridClass)}>
            <aside className={examSidebarClass}>
              <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
                <div className={examQuestionTypeRowClass}>
                  <div className={examCardKickerClass}>Progress</div>
                  <span className={examChipMiniClass}>{isSbaQuestion(currentQuestion) ? 'SBA' : 'T/F'}</span>
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
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-current')} />Current</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-answered')} />Answered</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-idle')} />Not answered</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-review')} />Review</span>
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-flagged')} />Flagged</span>
                </div>

              </section>
            </aside>

          <section className={cx(examMainCardClass, quizFlashPanelClass, examQuestionStartAnchorClass, quizUnifiedMainCardClass)} ref={questionContentRef}>
            <div className={examQuestionNumberClass}>
              Question {currentIndex + 1} <span aria-hidden="true">·</span> {isSbaQuestion(currentQuestion) ? 'Single best answer' : 'True / False'}
            </div>
            <p className={quizReviewQuestionTextClass}>{currentQuestion.questionText}</p>

            <div className={examAnswerListClass}>
              {isSbaQuestion(currentQuestion) ? (
                currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = Number(answers[currentQuestion.id]) === option.id;
                  const isCorrect = isCorrectOption(option);
                  const isWrong = currentQuestionRevealed && isSelected && !isCorrect;
                  const optionTone = currentQuestionRevealed && isCorrect
                    ? 'correct'
                    : isWrong
                      ? 'wrong'
                      : isSelected
                        ? 'selected'
                        : 'neutral';
                  const letterLabel = getOptionDisplayLabel(option, optionIndex);

                  return (
                    <label
                      className={cx(
                        quizUnifiedAnswerCardClass,
                        optionTone === 'selected' && quizUnifiedAnswerSelectedClass,
                        optionTone === 'correct' && quizUnifiedAnswerCorrectClass,
                        optionTone === 'wrong' && quizUnifiedAnswerWrongClass
                      )}
                      key={option.id}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        checked={isSelected}
                        onChange={() => updateSba(currentQuestion.id, option.id)}
                      />
                      <span className={quizReviewOptionToplineClass}>
                        <span className={quizReviewOptionLeadClass}>
                          <span className={quizReviewOptionIconClass(optionTone)} aria-hidden="true">{letterLabel}</span>
                          <span className={quizReviewOptionTextClass}>{option.optionText}</span>
                        </span>
                        {currentQuestionRevealed ? (
                          <span className={quizReviewOptionLabelsClass}>
                            {isSelected ? (
                              <span className={quizReviewChipClass(isCorrect ? 'correct' : 'wrong')}>
                                Your Answer
                              </span>
                            ) : null}
                            {isCorrect ? (
                              <span className={quizReviewChipClass('correct')}>
                                Correct
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              ) : (
                currentQuestion.options.map((option, optionIndex) => {
                  const correctValue = isCorrectOption(option) ? 1 : 0;
                  const selectedValue = getTfSelectedValue(answers[currentQuestion.id], option.id);
                  const hasSelectedValue = selectedValue !== null;
                  const selectedCorrect = hasSelectedValue && Number(selectedValue) === correctValue;
                  const selectedLabel = hasSelectedValue ? (selectedValue === 1 ? 'True' : 'False') : 'Not answered';
                  const correctLabel = correctValue === 1 ? 'True' : 'False';
                  const letterLabel = getOptionDisplayLabel(option, optionIndex);
                  const answerTone = currentQuestionRevealed
                    ? !hasSelectedValue
                      ? 'unanswered'
                      : selectedCorrect
                        ? 'correct'
                        : 'wrong'
                    : hasSelectedValue
                      ? 'selected'
                      : 'neutral';

                  return (
                    <div className={cx(
                      quizUnifiedAnswerCardClass,
                      answerTone === 'selected' && quizUnifiedAnswerSelectedClass,
                      answerTone === 'correct' && quizUnifiedAnswerCorrectClass,
                      answerTone === 'wrong' && quizUnifiedAnswerWrongClass,
                      answerTone === 'unanswered' && quizUnifiedAnswerUnansweredClass
                    )} key={option.id}>
                      <div className={quizReviewOptionToplineClass}>
                        <div className={quizReviewOptionLeadClass}>
                          <span className={quizReviewOptionIconClass(answerTone)} aria-hidden="true">
                            {letterLabel}
                          </span>
                          <span className={quizReviewOptionTextClass}>{option.optionText}</span>
                        </div>
                        {currentQuestionRevealed ? (
                          <span className={quizReviewOptionLabelsClass}>
                            <span className={quizReviewChipClass(selectedCorrect ? 'correct' : hasSelectedValue ? 'wrong' : 'unanswered')}>
                              Your Answer: {selectedLabel}
                            </span>
                            <span className={quizReviewChipClass('correct')}>
                              Correct: {correctLabel}
                            </span>
                          </span>
                        ) : null}
                      </div>
                        <div className={examTfActionsClass}>
                          <button className={cx(
                            examTfToggleClass,
                            !currentQuestionRevealed && selectedValue === 1 && examTfTrueActiveClass,
                            currentQuestionRevealed && correctValue === 1 && examTfChoiceCorrectClass,
                            currentQuestionRevealed && selectedValue === 1 && correctValue !== 1 && examTfChoiceWrongClass
                          )}
                            type="button"
                            aria-pressed={selectedValue === 1}
                            onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                          >
                            True
                          </button>
                          <button className={cx(
                            examTfToggleClass,
                            !currentQuestionRevealed && selectedValue === 0 && examTfFalseActiveClass,
                            currentQuestionRevealed && correctValue === 0 && examTfChoiceCorrectClass,
                            currentQuestionRevealed && selectedValue === 0 && correctValue !== 0 && examTfChoiceWrongClass
                          )}
                            type="button"
                            aria-pressed={selectedValue === 0}
                            onClick={() => updateTf(currentQuestion.id, option.id, 0)}
                          >
                            False
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <PracticeInlineLearningSupport
                currentQuestion={currentQuestion}
                currentQuestionRevealed={currentQuestionRevealed}
                className="mt-4"
                showStudySupport={false}
              />

              {currentQuestionRevealed ? (
                <PracticeStudySupport
                  currentQuestion={currentQuestion}
                  revealed={true}
                  className="mt-4 max-[1180px]:grid min-[1181px]:hidden"
                />
              ) : null}

              <div className={examMainFooterClass}>
                <div className={examMainFooterLeftClass}>
                  <button className={cx(quizUnifiedFooterButtonClass)}
                    type="button"
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0 || saving}
                  >
                    Previous
                  </button>

                  <button className={cx(quizUnifiedFooterButtonClass)}
                    type="button"
                    onClick={revealCurrentAnswer}
                    disabled={currentQuestionRevealed || !currentQuestionCanReveal}
                  >
                    {currentQuestionRevealed ? 'Explanation shown' : currentQuestionCanReveal ? 'Show answer and explanation' : 'Available after review'}
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
                  <button className={cx(quizUnifiedPrimaryFooterButtonClass, examFooterNextClass)}
                    type="button"
                   
                    onClick={() => goTo(currentIndex + 1)}
                    disabled={saving || practiceCelebrating}
                  >
                    {saving ? 'Saving…' : 'Next'}
                  </button>
                ) : (
                  <button className={cx(quizUnifiedPrimaryFooterButtonClass, examFooterNextClass)}
                    type="button"
                   
                    onClick={finishPractice}
                    disabled={saving || practiceCelebrating}
                  >
                    Finish practice
                  </button>
                )}
              </div>

              {!currentQuestionRevealed ? (
                <PracticeStudySupport
                  currentQuestion={currentQuestion}
                  revealed={false}
                  className="mt-4 max-[700px]:hidden max-[1180px]:grid min-[1181px]:hidden"
                />
              ) : null}

              <QuestionUtilityActions
                bookmarked={currentQuestionBookmarked}
                busy={questionActionBusy}
                onBookmark={toggleBookmarkCurrentQuestion}
                onReport={reportCurrentQuestion}
              />
            </section>

            <ExplanationRail
              isExam={false}
              currentQuestion={currentQuestion}
              currentQuestionRevealed={currentQuestionRevealed}
            />
          </div>

          <MobileQuizActionBar
            isExam={false}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            progressPercent={progressPercent}
            saving={saving || practiceCelebrating}
            currentQuestionFlagged={currentQuestionFlagged}
            currentQuestionBookmarked={currentQuestionBookmarked}
            currentQuestionRevealed={currentQuestionRevealed}
            canRevealAnswers={currentQuestionCanReveal}
            onPrevious={() => goTo(currentIndex - 1)}
            onReveal={revealCurrentAnswer}
            onFlag={toggleFlagCurrentQuestion}
            onBookmark={toggleBookmarkCurrentQuestion}
            onReport={reportCurrentQuestion}
            onNext={() => goTo(currentIndex + 1)}
            onFinish={finishPractice}
          />

          {!currentQuestionRevealed ? (
            <PracticeStudySupport
              currentQuestion={currentQuestion}
              revealed={false}
              className="hidden max-[700px]:grid"
            />
          ) : null}

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
          saving={saving || questionActionBusy}
          theme={theme}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={examGridClass}>
          <aside className={examSidebarClass}>
            <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
              <div className={examQuestionTypeRowClass}>
                <div className={examCardKickerClass}>Progress</div>
                <span className={examChipMiniClass}>{isSbaQuestion(currentQuestion) ? 'SBA' : 'T/F'}</span>
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
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-current')} />Current</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-answered')} />Answered</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-idle')} />Not answered</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-review')} />Review</span>
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'is-flagged')} />Flagged</span>
              </div>

            </section>
          </aside>

          <section className={cx(examMainCardClass, quizFlashPanelClass, examQuestionStartAnchorClass, quizUnifiedMainCardClass)} ref={questionContentRef}>
            <div className={quizFlashQuestionCopyClass}>
              {currentQuestion.questionText}
            </div>

            <div className={examAnswerListClass}>
              {isSbaQuestion(currentQuestion) ? (
                currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = Number(answers[currentQuestion.id]) === option.id;
                  const letterLabel = DISPLAY_OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

                  return (
                    <label
                      className={cx(
                        quizUnifiedAnswerCardClass,
                        isSelected && quizUnifiedAnswerSelectedClass
                      )}
                      key={option.id}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        checked={isSelected}
                        onChange={() => updateSba(currentQuestion.id, option.id)}
                      />
                      <span className={quizReviewOptionToplineClass}>
                        <span className={quizReviewOptionLeadClass}>
                          <span className={quizReviewOptionIconClass(isSelected ? 'selected' : 'neutral')} aria-hidden="true">
                            {letterLabel}
                          </span>
                          <span className={quizReviewOptionTextClass}>{option.optionText}</span>
                        </span>
                      </span>
                    </label>
                  );
                })
              ) : (
                currentQuestion.options.map((option, optionIndex) => {
                  const selectedValue = getTfSelectedValue(answers[currentQuestion.id], option.id);
                  const hasSelectedValue = selectedValue !== null;
                  const letterLabel = getOptionDisplayLabel(option, optionIndex);

                  return (
                    <div className={cx(
                      quizUnifiedAnswerCardClass,
                      hasSelectedValue && quizUnifiedAnswerSelectedClass
                    )} key={option.id}>
                      <div className={quizReviewOptionToplineClass}>
                        <div className={quizReviewOptionLeadClass}>
                          <span className={quizReviewOptionIconClass(hasSelectedValue ? 'selected' : 'neutral')} aria-hidden="true">
                            {letterLabel}
                          </span>
                          <span className={quizReviewOptionTextClass}>{option.optionText}</span>
                        </div>
                      </div>
                      <div className={examTfActionsClass}>
                        <button className={cx(examTfToggleClass, selectedValue === 1 && examTfTrueActiveClass)}
                          type="button"
                          aria-pressed={selectedValue === 1}
                          onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                        >
                          True
                        </button>
                        <button className={cx(examTfToggleClass, selectedValue === 0 && examTfFalseActiveClass)}
                          type="button"
                          aria-pressed={selectedValue === 0}
                          onClick={() => updateTf(currentQuestion.id, option.id, 0)}
                        >
                          False
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={examMainFooterClass}>
              <div className={examMainFooterLeftClass}>
                <button className={cx(quizUnifiedFooterButtonClass)}
                  type="button"
                 
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={currentIndex === 0 || saving}
                >
                  Previous
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

              <button className={cx(quizUnifiedPrimaryFooterButtonClass, examFooterNextClass)}
                type="button"
               
                onClick={currentIndex < totalQuestions - 1 ? () => goTo(currentIndex + 1) : requestExamSubmit}
                disabled={saving}
              >
                {currentIndex < totalQuestions - 1 ? 'Next' : saving ? 'Submitting…' : 'Submit exam'}
              </button>
            </div>

            <QuestionUtilityActions
              bookmarked={currentQuestionBookmarked}
              busy={questionActionBusy}
              onBookmark={toggleBookmarkCurrentQuestion}
              onReport={reportCurrentQuestion}
            />
          </section>
        </div>

        <MobileQuizActionBar
          isExam
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          progressPercent={progressPercent}
          saving={saving}
          currentQuestionFlagged={currentQuestionFlagged}
          currentQuestionBookmarked={currentQuestionBookmarked}
          currentQuestionRevealed={false}
          onPrevious={() => goTo(currentIndex - 1)}
          onReveal={() => {}}
          onFlag={toggleFlagCurrentQuestion}
          onBookmark={toggleBookmarkCurrentQuestion}
          onReport={reportCurrentQuestion}
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
