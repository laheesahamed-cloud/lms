import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadStudentQuiz, saveExamProgress, savePracticeAnswer, submitExam } from '../../../../shared/api/quizAttempts.api.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { createQuestionReport } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { XyndromeLogoMark } from '../../../../shared/brand/XyndromeBrand.jsx';
import { MedicalText } from '../../../../shared/components/MedicalText.jsx';
import { useThemeStore } from '../../../../shared/stores/themeStore.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { TheoryRecapPopupTrigger, hasQuickTheoryRecapContent, normalizeQuickTheoryRecap } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getQuizNumberLabel } from './quizLabels.js';
import { reviewPrimaryButtonClass, reviewSecondaryButtonClass } from '../results/ReviewWorkspace.jsx';
import { ImpactStyle, nativeImpact, nativeSuccess, nativeTransientHaptic } from '../../../../shared/utils/nativeHaptics.js';
import { detectPlatform } from '../../../../shared/platform/detect.js';

const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

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
const examScreenShellClass = `${ui.studentScreenShell} lms-quiz-taking-page lms-exam-page px-[clamp(16px,3vw,42px)] pb-[clamp(22px,3vw,36px)] pt-[clamp(12px,1.7vw,22px)] max-[700px]:pb-44 max-[600px]:px-3.5 max-[600px]:pb-44 max-[600px]:pt-3.5`;
const examLayoutClass = 'lms-exam-layout mx-auto grid w-full max-w-[1560px] gap-[clamp(16px,2vw,24px)] bg-[var(--exam-shell-bg)] pb-2.5';
const practiceQuizScreenShellClass = `${ui.studentScreenShell} lms-quiz-taking-page dashboard-page study-hub-page lms-review-page practice-review-page`;
const practiceQuizLayoutClass = 'study-hub-shell practice-review-shell grid grid-cols-1 min-w-0 gap-[clamp(16px,2vw,24px)]';
const practiceQuizWorkspaceClass =
  'lms-review-workspace lms-practice-workspace mx-auto grid w-full grid-cols-[minmax(220px,280px)_minmax(0,1040px)_minmax(220px,280px)] items-start justify-center gap-[clamp(16px,2vw,24px)] max-[1199px]:grid-cols-1';
const practiceQuizSidebarClass =
  'lms-review-sidebar lms-practice-quiz-sidebar sticky top-6 grid max-h-[calc(100dvh-48px)] gap-3.5 overflow-hidden max-[900px]:static max-[900px]:max-h-none max-[900px]:overflow-visible';
const practiceQuizMainClass = 'lms-review-main lms-practice-question-main min-w-0';
const practiceQuizAsideClass =
  'lms-review-explanation-side sticky top-6 grid max-h-[calc(100dvh-48px)] min-w-0 gap-3.5 overflow-auto overscroll-contain max-[1180px]:hidden';
const practiceQuizSummaryGridClass = 'lms-review-summary-grid lms-practice-summary-grid grid grid-cols-4 gap-2 max-[420px]:gap-1.5';
const practiceQuizSummaryTileClass =
  'lms-review-summary-tile grid min-h-[64px] place-items-center gap-1 rounded-[14px] border border-line-soft bg-surface-1 px-2 py-2 text-center shadow-none [&_span]:whitespace-nowrap [&_span]:text-[11px] [&_span]:font-bold [&_span]:uppercase [&_span]:leading-tight [&_span]:tracking-[0.06em] [&_span]:text-ink-soft [&_strong]:text-[20px] [&_strong]:font-bold [&_strong]:leading-none [&_strong]:tracking-normal [&_strong]:text-ink-strong max-[420px]:min-h-[58px] max-[420px]:rounded-xl max-[420px]:px-1.5 max-[420px]:[&_span]:text-[11px] max-[420px]:[&_strong]:text-[18px]';
const practiceQuizSideNavClass =
  'lms-review-side-nav grid min-h-0 gap-2.5 rounded-[18px] border border-line-soft bg-surface-1 p-3.5 shadow-none';
const practiceQuizNavHeadClass =
  'flex items-baseline justify-between gap-2.5 [&_h3]:m-0 [&_h3]:text-[13px] [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-soft';
const practiceQuizBubbleNavClass = 'lms-review-bubble-nav grid grid-cols-5 gap-2';
const practiceQuizBubbleClass =
  'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity] duration-150 active:opacity-80';
const practiceQuizBubbleActiveClass = 'border-brand-primary/38 bg-brand-primary/12 text-brand-primary shadow-none';
const practiceQuizBubbleAnsweredClass = 'border-brand-success/30 bg-brand-success/12 text-brand-success';
const practiceQuizBubbleSavedClass = 'border-[color-mix(in_srgb,#8b5cf6_30%,var(--line-soft))] bg-[color-mix(in_srgb,#8b5cf6_12%,var(--surface-2))] text-brand-violet';
const practiceQuizBubbleFlaggedClass = 'border-[color-mix(in_srgb,#d97706_30%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_12%,var(--surface-2))] text-[#92400e] dark:text-[#fbbf24]';
const practiceQuizBubbleLegendClass =
  'lms-review-bubble-legend mt-3 grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] items-center gap-2 text-[11px] font-bold leading-tight text-ink-soft [&_i]:inline-block [&_i]:size-2.5 [&_i]:shrink-0 [&_i]:rounded-full [&_i]:border [&_span]:inline-flex [&_span]:min-h-5 [&_span]:min-w-0 [&_span]:items-center [&_span]:gap-1.5 [&_span]:whitespace-nowrap';
const practiceQuizQuestionCardClass = 'lms-review-question-card grid gap-[clamp(16px,2vw,22px)] p-[clamp(24px,3vw,40px)] max-[640px]:gap-3.5 max-[640px]:p-4';
const practiceQuizQuestionTextClass =
  'lms-reading-question m-0 max-w-[82ch] whitespace-pre-line text-left text-[16px] font-medium leading-[1.62] tracking-normal text-ink-strong [text-wrap:pretty] max-[640px]:text-[16px] max-[640px]:leading-[1.6]';
const practiceQuizQuestionHeadClass = 'flex min-h-0 items-center justify-between gap-2 max-[640px]:flex-col max-[640px]:items-start';
const practiceQuizQuestionMetaClass = 'flex flex-wrap items-center gap-1.5';
const practiceQuizQuestionNumberClass = 'text-[11px] font-extrabold uppercase leading-none tracking-[0.02em] text-ink-soft';
const practiceQuizQuestionNavClass =
  'lms-review-question-nav grid gap-3 rounded-[18px] border border-line-soft bg-surface-2 p-3.5 shadow-none max-[640px]:rounded-2xl max-[640px]:p-3';
const practiceQuizQuestionNavActionsClass =
  'lms-quiz-action-grid grid grid-cols-[minmax(112px,0.72fr)_minmax(0,1.35fr)_minmax(122px,0.86fr)] items-center gap-2.5 max-[820px]:grid-cols-2 max-[640px]:grid-cols-1';
const quizActionStartGroupClass = 'lms-quiz-action-start flex min-w-0 items-center justify-end gap-2 max-[820px]:order-1';
const quizActionReviewGroupClass = 'lms-quiz-action-review flex min-w-0 flex-wrap items-center justify-end gap-2 max-[820px]:order-3 max-[820px]:col-span-2 max-[820px]:justify-end max-[640px]:col-span-1';
const quizActionPrimaryGroupClass = 'lms-quiz-action-primary flex min-w-0 items-center justify-end gap-2 max-[820px]:order-2 max-[640px]:justify-stretch max-[640px]:[&_button]:w-full';
const practiceQuizOptionsGridClass = 'lms-review-options-grid grid gap-3 max-[640px]:gap-2.5';
const practiceQuizOptionToplineClass = 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start';
const practiceQuizOptionLeadClass = 'flex min-w-0 flex-auto items-start gap-2';
const practiceQuizOptionTextClass =
  'lms-reading-answer m-0 min-w-0 flex-auto whitespace-pre-line text-left text-[15.5px] font-medium leading-[1.52] text-ink-strong max-[640px]:text-[15.5px] max-[640px]:leading-[1.5]';
const practiceQuizOptionLabelsClass = 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start';
const practiceQuizOptionCardClass =
  'lms-answer-card group/answer relative grid gap-2 overflow-hidden rounded-2xl border-[1.5px] border-line-soft bg-surface-1 px-4 py-3.5 transition-[background,border-color,transform] duration-150 ease-out focus-within:border-[color-mix(in_srgb,var(--color-primary)_32%,var(--line-soft))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_9%,transparent)]';
const practiceQuizOptionInteractiveClass =
  'cursor-pointer touch-manipulation hover:border-[color-mix(in_srgb,var(--color-primary)_22%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1))] active:scale-[0.997]';
const practiceQuizOptionSelectedClass =
  'is-selected border-[color-mix(in_srgb,var(--color-primary)_38%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_7%,var(--surface-1)),color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1)))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_8%,transparent),0_12px_28px_-24px_color-mix(in_srgb,var(--color-primary)_38%,transparent)]';
const practiceQuizOptionCorrectClass =
  'border-[color-mix(in_srgb,var(--color-success)_38%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-success)_12%,var(--surface-1)),color-mix(in_srgb,var(--color-success)_5%,var(--surface-1)))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_9%,transparent)]';
const practiceQuizOptionWrongClass =
  'border-[color-mix(in_srgb,var(--color-error)_40%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-error)_10%,var(--surface-1)),color-mix(in_srgb,var(--color-error)_4%,var(--surface-1)))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error)_8%,transparent)]';
const practiceQuizOptionUnansweredClass =
  'border-[color-mix(in_srgb,#d97706_30%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_6%,var(--surface-1))] shadow-[0_0_0_1px_color-mix(in_srgb,#d97706_12%,transparent)]';
const practiceQuizTfActionsClass = 'flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start';
const practiceQuizTfToggleClass =
  'min-h-10 touch-manipulation rounded-xl border border-[var(--exam-footer-btn-border,var(--sa-border))] bg-[var(--exam-footer-btn-bg,var(--sa-surface))] px-4 text-[13px] font-bold text-[var(--exam-footer-btn-text,var(--sa-ink))] shadow-none transition-colors active:opacity-85 max-[600px]:min-h-11 max-[600px]:flex-1';
const practiceQuizTfTrueActiveClass = '!border-[color-mix(in_srgb,var(--sa-ok)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_13%,var(--sa-surface))] !text-emerald-700 dark:!bg-[color-mix(in_srgb,var(--sa-ok)_19%,var(--sa-surface))] dark:!text-emerald-100';
const practiceQuizTfFalseActiveClass = '!border-[color-mix(in_srgb,var(--sa-danger)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_12%,var(--sa-surface))] !text-red-600 dark:!bg-[color-mix(in_srgb,var(--sa-danger)_18%,var(--sa-surface))] dark:!text-red-100';
const practiceQuizTfChoiceCorrectClass = '!border-[color-mix(in_srgb,var(--sa-ok)_34%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_14%,var(--sa-surface))] !text-emerald-700 dark:!bg-[color-mix(in_srgb,var(--sa-ok)_20%,var(--sa-surface))] dark:!text-emerald-100';
const practiceQuizTfChoiceWrongClass = '!border-[color-mix(in_srgb,var(--sa-danger)_34%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_12%,var(--sa-surface))] !text-red-600 dark:!bg-[color-mix(in_srgb,var(--sa-danger)_18%,var(--sa-surface))] dark:!text-red-100';
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
  '--exam-nav-idle-bg': '#FBFCFF',
  '--exam-nav-idle-border': '#D7E0EE',
  '--exam-nav-idle-text': '#334155',
  '--exam-jump-bg': '#FBFCFF',
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
  '--exam-block-bg': '#FBFCFF',
  '--exam-block-text': '#7A8DA7',
  '--exam-block-line': '#D7E0EE',
  '--exam-block-dot-border': '#D7E0EE',
  '--exam-block-dot-fill': '#FBFCFF',
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
  'lms-exam-header flex items-center justify-between gap-3 rounded-[18px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3 py-2.5 shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:flex-col max-[700px]:items-stretch';
const practiceHeaderClass = 'practice-review-header max-[700px]:!flex-row max-[700px]:!items-center max-[700px]:!justify-between max-[700px]:gap-3 max-[700px]:px-3.5 max-[700px]:py-3 [&_.quiz-header-actions]:shrink-0';
const examHeaderBrandClass = 'flex min-w-0 items-center gap-3';
const examHeaderLogoClass =
  'grid size-10 shrink-0 place-items-center text-[var(--xyndrome-logo-scope)]';
const examHeaderTitleClass = 'block text-[17px] font-extrabold leading-tight text-ink-strong';
const examHeaderSubtitleClass = 'mt-0.5 block max-w-[min(62vw,720px)] truncate text-xs text-ink-soft max-[700px]:max-w-full';
const examHeaderActionsClass = 'quiz-header-actions flex flex-wrap items-center justify-end gap-2 max-[700px]:justify-start';
const examHeaderChipClass =
  'inline-flex min-h-10 items-center gap-2 rounded-[13px] border border-[var(--exam-header-chip-border)] bg-[var(--exam-header-chip-bg)] px-3 text-sm text-ink-medium shadow-[var(--exam-header-chip-shadow)]';
const examHeaderChipValueClass = 'text-base font-extrabold text-ink-strong';
const examHeaderIconClass = 'inline-grid place-items-center text-ink-soft';
const examHeaderEndClass =
  'min-h-11 rounded-full border border-[var(--exam-end-border)] bg-[var(--exam-end-bg)] px-3.5 text-[12.5px] font-bold text-[var(--exam-end-text)] shadow-none transition-colors active:opacity-85 disabled:cursor-not-allowed disabled:opacity-60';
const practiceHeaderEndClass = 'border-brand-primary/22 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/14 dark:border-sky-300/22 dark:bg-sky-400/12 dark:text-sky-200';
const examGridClass = 'lms-exam-grid grid w-full max-w-none grid-cols-[minmax(220px,280px)_minmax(0,1120px)] items-start justify-center gap-[clamp(16px,2vw,24px)] max-[1180px]:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] max-[900px]:grid-cols-1';
const examSidebarClass = 'lms-exam-sidebar grid gap-[18px]';
const examPanelClass =
  'border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-[18px] shadow-[var(--exam-card-shadow)]';
const examProgressPanelClass =
  'relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))] before:content-[""]';
const examMainCardClass =
  'lms-exam-main-card grid min-h-[540px] grid-rows-[auto_auto_auto] border border-[var(--exam-card-border)] bg-[var(--exam-main-bg)] p-[clamp(24px,3.2vw,44px)] shadow-[var(--exam-card-shadow)] max-[600px]:min-h-[auto] max-[600px]:p-4';
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
const quizFlashQuestionCopyClass = 'lms-reading-question m-0 max-w-[82ch] whitespace-pre-line text-left text-[16px] font-medium leading-[1.62] tracking-normal text-ink-strong [text-wrap:pretty] max-[640px]:text-[16px] max-[640px]:leading-[1.6]';
const quizFlashFooterButtonClass = 'rounded-xl';
const examQuestionStartAnchorClass = 'scroll-mt-4';
const examQuestionNavClass = 'lms-exam-question-nav grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-2 max-[900px]:grid-cols-8 max-[600px]:grid-cols-5';
const examNavBubbleBaseClass =
  'lms-exam-nav-bubble min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none transition-[background,border-color,color,opacity] duration-150 active:opacity-85';
const examNavLegendClass = 'lms-exam-nav-legend mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold leading-tight text-ink-soft';
const examNavLegendItemClass = 'inline-flex min-w-0 items-center gap-1 whitespace-nowrap';
const examNavLegendDotClass = 'lms-exam-nav-legend-dot inline-block size-2.5 shrink-0 rounded border border-transparent';
const practiceLearningSupportClass = 'mt-0 grid gap-3 pt-0';
const quizReviewExplanationClass =
  'lms-learning-reveal-card mt-0 grid gap-3 rounded-[var(--ds-card-radius-compact)] border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_5%,var(--surface-2))_0%,var(--surface-2)_58%,color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1))_100%)] p-4 shadow-[var(--ds-card-shadow)] max-[640px]:rounded-[var(--ds-card-radius-inner)] max-[640px]:p-3.5';
const quizReviewIncorrectCardClass =
  'lms-learning-reveal-card mt-0 grid gap-3 rounded-[var(--ds-card-radius-compact)] border border-[color-mix(in_srgb,var(--color-warning)_24%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_7%,var(--surface-2))_0%,var(--surface-2)_62%,color-mix(in_srgb,var(--color-warning)_4%,var(--surface-1))_100%)] p-4 shadow-[var(--ds-card-shadow)] max-[640px]:rounded-[var(--ds-card-radius-inner)] max-[640px]:p-3.5';
const quizReviewExplanationHeaderClass =
  'flex items-center justify-between gap-2.5 border-b border-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] pb-2.5 max-[640px]:flex-col max-[640px]:items-start [&_h3]:m-0 [&_h3]:text-[12px] [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-[0.11em] [&_h3]:text-ink-soft max-[640px]:[&_h3]:text-[11px]';
const quizReviewExplanationGridClass = 'grid grid-cols-1 gap-3.5';
const quizReviewExplanationCopyClass =
  'lms-reading-explanation grid gap-2.5 text-left [&_p]:m-0 [&_p]:max-w-[78ch] [&_p]:whitespace-pre-line [&_p]:text-[15.5px] [&_p]:font-normal [&_p]:leading-[1.72] [&_p]:tracking-normal [&_p]:text-ink-medium [&_p]:[text-wrap:pretty] max-[640px]:[&_p]:text-[15.5px] max-[640px]:[&_p]:leading-[1.68]';
const quizReviewIncorrectListClass =
  'overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--color-warning)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_5%,var(--surface-2))]';
const quizReviewIncorrectItemClass =
  'grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 border-t border-[color-mix(in_srgb,var(--color-warning)_14%,var(--line-soft))] px-2.5 py-2 first:border-t-0 max-[640px]:grid-cols-[22px_minmax(0,1fr)] max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-1.5';
const quizReviewIncorrectBadgeClass =
  'inline-flex size-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-warning)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--surface-2))] text-[11px] font-black text-[#92400e] max-[640px]:size-[22px] max-[640px]:text-[11px]';
const quizReviewIncorrectCopyClass =
  'lms-reading-incorrect min-w-0 text-left [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[14px] [&_strong]:font-extrabold [&_strong]:leading-snug [&_strong]:text-ink-strong [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-[14.5px] [&_p]:font-normal [&_p]:leading-[1.6] [&_p]:text-ink-medium max-[640px]:[&_strong]:text-[14px] max-[640px]:[&_p]:text-[14.5px] max-[640px]:[&_p]:leading-[1.58]';
const quizReviewRecapActionClass = 'lms-study-recap-action flex justify-start';
const quizReviewStudyListClass = 'm-0 grid list-none gap-2 p-0';
const quizReviewStudyCardClass =
  'lms-key-points-card relative grid gap-3 rounded-[var(--ds-card-radius-compact)] border border-[color-mix(in_srgb,#8b5cf6_20%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_7%,var(--surface-1))_0%,var(--surface-1)_72%)] px-4 py-3.5 shadow-[var(--ds-card-shadow)] transition-colors hover:border-[color-mix(in_srgb,#8b5cf6_28%,var(--line-soft))] [&_h4]:m-0 [&_h4]:text-[11px] [&_h4]:font-extrabold [&_h4]:uppercase [&_h4]:tracking-[0.08em] [&_h4]:text-ink-soft [&_p]:m-0 [&_p]:whitespace-pre-line [&_p]:text-left [&_p]:text-[14.5px] [&_p]:font-normal [&_p]:leading-[1.66] [&_p]:text-ink-strong max-[640px]:rounded-[var(--ds-card-radius-inner)] max-[640px]:px-3.5 max-[640px]:[&_p]:text-[14.5px]';
const practiceKeyPointsClass = 'lms-quiz-key-points-card grid gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,#8b5cf6_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,#8b5cf6_5%,var(--surface-1))_0%,var(--surface-1)_74%)] p-4 shadow-none';
const practiceKeyPointClass = 'lms-reading-incorrect rounded-[12px] border border-[color-mix(in_srgb,var(--color-primary)_12%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--surface-2))] px-3 py-2 text-left text-[14.5px] font-medium leading-[1.62] text-ink-strong';
const examAnswerListClass = 'lms-review-options-grid grid gap-2.5';
const examTfActionsClass = 'flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start';
const examTfToggleClass =
  'min-h-10 touch-manipulation rounded-xl border border-[var(--exam-tf-border)] bg-[var(--exam-tf-bg)] px-4 text-[13px] font-bold text-[var(--exam-tf-text)] shadow-none transition-colors active:opacity-85 max-[600px]:min-h-11 max-[600px]:flex-1';
const examTfTrueActiveClass = '!border-[color-mix(in_srgb,var(--sa-ok)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-ok)_13%,var(--sa-surface))] !text-emerald-700 dark:!bg-[color-mix(in_srgb,var(--sa-ok)_19%,var(--sa-surface))] dark:!text-emerald-100';
const examTfFalseActiveClass = '!border-[color-mix(in_srgb,var(--sa-danger)_32%,var(--sa-border))] !bg-[color-mix(in_srgb,var(--sa-danger)_12%,var(--sa-surface))] !text-red-600 dark:!bg-[color-mix(in_srgb,var(--sa-danger)_18%,var(--sa-surface))] dark:!text-red-100';
const examMainFooterClass = 'lms-exam-main-footer grid gap-3 rounded-[18px] border border-line-soft bg-surface-2 p-3.5 shadow-none max-[700px]:hidden';
const examMainFooterActionsClass = 'lms-exam-footer-actions grid grid-cols-[minmax(112px,0.72fr)_minmax(132px,0.86fr)] items-center justify-between gap-2.5 max-[900px]:grid-cols-2';
const examMainFooterLeftClass = 'flex min-w-0 items-center justify-start gap-2';
const examMainFooterRightClass = 'flex min-w-0 items-center justify-end gap-2';
const examFooterIconButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] px-3.5 text-sm font-bold text-[var(--exam-footer-btn-text)] shadow-none transition-colors hover:border-[color-mix(in_srgb,var(--color-warning)_28%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-warning)_6%,var(--surface-1))] active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-55';
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
  'lms-mobile-quiz-bar fixed inset-x-0 bottom-0 z-[95] hidden rounded-t-[var(--ds-card-radius)] border-x-0 border-b-0 border-t border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[var(--ds-floating-shadow)] backdrop-blur-xl max-[700px]:block';
const mobileQuizBarTopClass = 'mb-2 flex items-center justify-between gap-3 text-[12px] font-bold text-ink-soft';
const mobileQuizBarActionsClass = 'lms-mobile-quiz-actions grid grid-cols-[minmax(76px,0.72fr)_minmax(92px,0.9fr)_minmax(118px,1.18fr)] gap-2';
const mobileQuizIconButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] px-2.5 text-[13px] font-extrabold text-[var(--exam-footer-btn-text)] transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_22%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))] active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-45';
const mobileQuizPrimaryClass =
  'min-h-11 rounded-xl border border-brand-primary/35 bg-[var(--color-primary-light)] px-3 text-[13px] font-extrabold text-brand-primary transition-colors hover:border-brand-primary/45 hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--surface-1))] active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-55';
const questionUtilityRowClass = 'lms-question-utility-row flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-3 max-[700px]:justify-start max-[700px]:pt-2.5';
const questionUtilityButtonClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-surface)] px-3.5 text-xs font-extrabold text-ink-soft shadow-none transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_26%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))] hover:text-brand-primary active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25 disabled:cursor-not-allowed disabled:opacity-55 max-[520px]:flex-1';
const questionUtilityIconOnlyClass = 'lms-question-utility-icon-only px-3';
const quizUnifiedMainCardClass =
  'lms-review-question-card grid w-full justify-self-stretch gap-[16px] p-[22px_24px] max-[640px]:gap-3.5 max-[640px]:p-3.5';
const quizUnifiedAnswerCardClass =
  'lms-answer-card group/answer relative grid cursor-pointer touch-manipulation gap-2 overflow-hidden rounded-2xl border-[1.5px] border-line-soft bg-surface-1 px-4 py-3.5 transition-[background,border-color,transform] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--color-primary)_22%,var(--line-soft))] hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1))] active:scale-[0.997] focus-within:border-[color-mix(in_srgb,var(--color-primary)_32%,var(--line-soft))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_9%,transparent)]';
const quizUnifiedAnswerSelectedClass =
  'is-selected border-[color-mix(in_srgb,var(--color-primary)_38%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_7%,var(--surface-1)),color-mix(in_srgb,var(--color-primary)_3%,var(--surface-1)))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_8%,transparent),0_12px_28px_-24px_color-mix(in_srgb,var(--color-primary)_38%,transparent)]';
const quizReviewOptionToplineClass = 'flex items-center justify-between gap-2.5 max-[640px]:flex-col max-[640px]:items-start';
const quizReviewOptionLeadClass = 'flex min-w-0 flex-auto items-start gap-2';
const quizReviewOptionTextClass = 'lms-reading-answer m-0 min-w-0 flex-auto whitespace-pre-line text-left text-[15.5px] font-medium leading-[1.52] text-ink-strong max-[640px]:text-[15.5px] max-[640px]:leading-[1.5]';
const quizReviewOptionLabelsClass = 'flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start';
const quizReviewChipToneClass = {
  correct: 'border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_12%,var(--surface-2))] text-brand-success',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-error)_11%,var(--surface-2))] text-brand-error',
  unanswered: 'border-[color-mix(in_srgb,#d97706_24%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_9%,var(--surface-2))] text-[#92400e] dark:text-[#fbbf24]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};
const quizReviewOptionIconToneClass = {
  selected: 'border-[color-mix(in_srgb,var(--color-primary)_42%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--surface-1))] text-brand-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_8%,transparent)]',
  correct: 'border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-brand-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_12%,transparent)]',
  wrong: 'border-[color-mix(in_srgb,var(--color-error)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)] text-brand-error shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error)_12%,transparent)]',
  unanswered: 'border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#92400e] dark:text-[#fbbf24]',
  neutral: 'border-line-soft bg-surface-2 text-ink-soft',
};

function quizReviewChipClass(tone = 'neutral') {
  return cx(
    'inline-flex min-h-[22px] items-center gap-1.5 rounded-full border px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.01em]',
    quizReviewChipToneClass[tone] || quizReviewChipToneClass.neutral
  );
}

function quizReviewOptionIconClass(tone = 'neutral') {
  return cx(
    'inline-grid size-6 shrink-0 place-items-center rounded-full border text-xs font-extrabold',
    quizReviewOptionIconToneClass[tone] || quizReviewOptionIconToneClass.neutral
  );
}

function PracticeSummaryTile({ label, value, tone = '' }) {
  return (
    <div className={cx(practiceQuizSummaryTileClass, tone)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function getPracticeQuizBubbleClass({ active, answered, flagged, saved }) {
  return cx(
    practiceQuizBubbleClass,
    active && 'is-current',
    !active && answered && 'is-answered',
    !active && !answered && 'is-idle',
    !active && saved && 'is-review',
    !active && flagged && 'is-flagged',
    active && practiceQuizBubbleActiveClass,
    !active && answered && practiceQuizBubbleAnsweredClass,
    !active && saved && practiceQuizBubbleSavedClass,
    !active && flagged && practiceQuizBubbleFlaggedClass
  );
}

function getQuestionNavButtonLabel(index, {
  active = false,
  answered = false,
  flagged = false,
  saved = false,
  review = false,
} = {}) {
  const states = [];
  if (active) states.push('current');
  states.push(answered ? 'answered' : 'not answered');
  if (flagged) states.push('flagged');
  if (saved || review) states.push('marked for review');
  return `Question ${index + 1}, ${states.join(', ')}`;
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
      <div
        className={examProgressBarClass}
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className={cx(mobileQuizBarActionsClass, 'mt-2')}>
        <button type="button" className={mobileQuizIconButtonClass} onClick={onPrevious} disabled={currentIndex === 0 || saving} aria-label="Previous question">
          Previous
        </button>
        <button
          type="button"
          className={cx(mobileQuizIconButtonClass, isExam && currentQuestionFlagged && examFooterFlagActiveClass)}
          onClick={isExam ? onFlag : onReveal}
          disabled={isExam ? saving : currentQuestionRevealed || !canRevealAnswers}
          aria-label={isExam ? (currentQuestionFlagged ? 'Remove flag from current question' : 'Flag current question') : (currentQuestionRevealed ? 'Answer explanation shown' : canRevealAnswers ? 'Show answer explanation' : 'Review unavailable')}
        >
          {isExam ? (
            <>
              <IcoFlag filled={currentQuestionFlagged} />
              {currentQuestionFlagged ? 'Flagged' : 'Flag'}
            </>
          ) : currentQuestionRevealed ? 'Shown' : canRevealAnswers ? 'Show' : 'Review'}
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
  flagged,
  busy,
  onFlag,
  onBookmark,
  onReport,
}) {
  return (
    <div className={questionUtilityRowClass} aria-label="Question utilities">
      <button
        className={cx(questionUtilityButtonClass, flagged && 'border-orange-500/30 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200')}
        type="button"
        onClick={onFlag}
        disabled={busy}
        title={flagged ? 'Remove flag' : 'Flag question'}
        aria-label={flagged ? 'Remove flag' : 'Flag question'}
      >
        <IcoFlag filled={flagged} />
        <span>{flagged ? 'Flagged' : 'Flag'}</span>
      </button>
      <button
        className={cx(questionUtilityButtonClass, questionUtilityIconOnlyClass, bookmarked && 'border-brand-violet/25 bg-purple-100 text-brand-violet dark:bg-purple-500/15 dark:text-purple-200')}
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
        <span>Report</span>
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

function parseTimestampMs(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readServerNowMs(clockRef) {
  const clock = clockRef.current;
  if (!clock?.serverTimeMs || !clock?.performanceTimeMs) return Date.now();
  return clock.serverTimeMs + (performance.now() - clock.performanceTimeMs);
}

function syncExamClock(clockRef, serverTime) {
  const serverTimeMs = parseTimestampMs(serverTime);
  if (!serverTimeMs) return;
  clockRef.current = {
    serverTimeMs,
    performanceTimeMs: performance.now(),
  };
}

function getExamSecondsRemaining(examSession, clockRef) {
  const deadlineMs = parseTimestampMs(examSession?.deadlineAt);
  if (!deadlineMs) return null;
  const serverNowMs = readServerNowMs(clockRef);
  return Math.max(0, Math.ceil((deadlineMs - serverNowMs) / 1000));
}

function getExamDraftStorageKey(quizId) {
  return `lms.examDraft.${quizId}`;
}

function readExamDraft(quizId, sessionId) {
  if (typeof window === 'undefined') return null;
  try {
    const draft = JSON.parse(window.localStorage.getItem(getExamDraftStorageKey(quizId)) || 'null');
    return draft && Number(draft.sessionId) === Number(sessionId) ? draft : null;
  } catch {
    return null;
  }
}

function writeExamDraft(quizId, draft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getExamDraftStorageKey(quizId), JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // Local recovery is best-effort; server autosave remains authoritative.
  }
}

function clearExamDraft(quizId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getExamDraftStorageKey(quizId));
  } catch {
    // Nothing to recover if storage is unavailable.
  }
}

function getPreferredScrollBehavior() {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function scrollQuestionContentIntoView(target, behavior = getPreferredScrollBehavior()) {
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
  const secondaryAccessibleLabel = secondaryLabel
    ? `${secondaryLabel}: ${resolvedSecondaryValue}`
    : `Time remaining: ${resolvedSecondaryValue}. Approved time accommodations are included when assigned to your account.`;

  return (
    <header className={cx(examHeaderClass, quizFlashPanelClass, className)}>
      <div className={examHeaderBrandClass}>
        <span className={examHeaderLogoClass} aria-hidden="true">
          <XyndromeLogoMark size={38} />
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
          <div
            className={examHeaderChipClass}
            role="timer"
            aria-label={secondaryAccessibleLabel}
            aria-atomic="true"
          >
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

function PracticeStudySupport({ currentQuestion, revealed = true, className = '' }) {
  const recap = normalizeQuickTheoryRecap(currentQuestion?.theoryRecap);
  const hasRecap = Boolean(currentQuestion && Object.prototype.hasOwnProperty.call(currentQuestion, 'theoryRecap'));
  const hasStudyCard = revealed && hasQuickTheoryRecapContent(recap);

  if (!hasRecap && !hasStudyCard) return null;

  return (
    <div className={cx('lms-study-support-stack grid gap-3', className)}>
      {hasRecap ? (
        <div className={quizReviewRecapActionClass}>
          <TheoryRecapPopupTrigger
            recap={recap}
            context="practice"
            revealed={revealed}
          />
        </div>
      ) : null}

      {hasStudyCard ? (
        <article className={quizReviewStudyCardClass}>
          <h4>Key Points</h4>
          {recap.conceptName ? <p><MedicalText as="strong" text={recap.conceptName} /></p> : null}
          {recap.keyPoints?.length ? (
            <ul className={quizReviewStudyListClass}>
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
                <MedicalText as="p" key={`${index}-${part.slice(0, 24)}`} text={part} />
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
                    {item.text ? <MedicalText as="strong" text={item.text} /> : null}
                    <MedicalText as="p" text={item.reason} />
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

function playNativeCompletionBell() {
  if (typeof window === 'undefined') return;

  const platform = detectPlatform();
  if (!platform.isNative || (!platform.isPhone && !platform.isTablet)) return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audioContext = new AudioContextCtor();
    const now = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.16, now + 0.018);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    masterGain.connect(audioContext.destination);

    [659.25, 987.77].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const toneGain = audioContext.createGain();
      const startAt = now + index * 0.055;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      toneGain.gain.setValueAtTime(index === 0 ? 0.82 : 0.54, startAt);
      oscillator.connect(toneGain);
      toneGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(now + 0.62 + index * 0.04);
    });

    window.setTimeout(() => {
      audioContext.close?.().catch(() => {});
    }, 900);
  } catch {
    // Native sound is a nice-to-have; never block quiz completion.
  }
}

function QuizCompletionOverlay({ quizLabel, onReview }) {
  const [textVisible, setTextVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const revealDelay = prefersReducedMotion ? 180 : 420;
    const reviewDelay = prefersReducedMotion ? 900 : 2600;
    const revealTimer = window.setTimeout(() => {
      setTextVisible(true);
      void nativeTransientHaptic({ intensity: 0.42, sharpness: 0.78 });
    }, revealDelay);
    const reviewTimer = window.setTimeout(onReview, reviewDelay);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(reviewTimer);
    };
  }, [onReview]);

  const overlay = (
    <div className="quiz-completion-overlay fixed inset-0 z-[140] grid h-dvh w-screen place-items-center bg-[color-mix(in_srgb,var(--surface-0)_76%,transparent)] p-4 backdrop-blur-2xl dark:bg-[rgba(2,6,23,0.78)]" role="dialog" aria-modal="true" aria-labelledby="quiz-complete-title">
      <section
        className={cx(
          'quiz-completion-capsule flex transform-gpu items-center justify-center overflow-hidden border border-[color-mix(in_srgb,var(--color-primary)_22%,var(--line-soft))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-card)_96%,transparent),color-mix(in_srgb,var(--surface-1)_94%,transparent))] text-left shadow-[var(--ds-floating-shadow)] transition-[width,padding,border-radius,gap,transform] duration-[720ms] ease-[cubic-bezier(0.23,1,0.32,1)] [contain:layout_paint_style] [will-change:transform] dark:border-sky-300/18 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,15,28,0.96))]',
          textVisible
            ? 'min-h-[104px] w-[min(420px,calc(100vw-32px))] gap-3.5 rounded-full py-3 pl-3 pr-6 max-[420px]:min-h-[96px] max-[420px]:pr-5'
            : 'size-[232px] rounded-[32px] p-5 max-[420px]:size-[206px]'
        )}
        aria-live="polite"
      >
        <div
          className={cx(
            'quiz-completion-mark relative grid shrink-0 place-items-center overflow-visible transition-[width,height,transform] duration-[720ms] ease-[cubic-bezier(0.23,1,0.32,1)] [will-change:transform]',
            textVisible ? 'size-[78px] max-[420px]:size-[70px]' : 'size-[190px] max-[420px]:size-[164px]'
          )}
        >
          <svg className={cx('quiz-completion-fallback-icon absolute left-1/2 top-1/2 size-20 origin-center -translate-x-1/2 -translate-y-1/2 transform-gpu text-brand-primary transition-transform duration-[720ms] ease-[cubic-bezier(0.23,1,0.32,1)]', textVisible ? 'scale-[0.42]' : 'scale-100')} viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <circle cx="48" cy="48" r="38" fill="currentColor" opacity="0.12" />
            <path d="M30 49.2 42.2 61 67 35" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div
          className={cx(
            'quiz-completion-copy grid min-w-0 gap-1 transition-[opacity,transform,max-width] duration-[540ms] ease-[cubic-bezier(0.23,1,0.32,1)]',
            textVisible ? 'max-w-[260px] translate-x-0 opacity-100' : 'max-w-0 translate-x-4 opacity-0'
          )}
        >
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-primary">Quiz finished</p>
          <h2 id="quiz-complete-title" className="m-0 truncate text-[18px] font-extrabold leading-tight text-ink-strong max-[420px]:text-[16px]">
            Wait for review
          </h2>
          <span className="truncate text-[11px] font-bold text-ink-soft dark:text-sky-100/72">{quizLabel} review is opening</span>
        </div>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
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
  const questionIdParam = searchParams.get('questionId') || '';
  const singleQuestionId = Number(questionIdParam);
  const isSingleQuestionPractice = mode === 'practice' && Number.isFinite(singleQuestionId) && singleQuestionId > 0;

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
  const [practiceCompleting, setPracticeCompleting] = useState(false);
  const [practiceReadyForReview, setPracticeReadyForReview] = useState(false);
  const [questionActionBusy, setQuestionActionBusy] = useState(false);
  const questionContentRef = useRef(null);
  const hasSkippedInitialPracticeScrollRef = useRef(false);
  const answersRef = useRef({});
  const examClockRef = useRef(null);
  const examAutosaveTimerRef = useRef(null);
  const examAutosaveRetryTimerRef = useRef(null);
  const examAutosaveRetryDelayRef = useRef(2500);
  const examAutosaveInFlightRef = useRef(false);
  const examAutosaveQueuedRef = useRef(false);
  const didHydrateExamStateRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        didHydrateExamStateRef.current = false;
        const [payload, savedItems] = await Promise.all([
          loadStudentQuiz(quizId, {
            mode,
            continue: continuePractice ? '1' : '0',
            resetPractice: resetPractice ? '1' : '0',
            questionId: isSingleQuestionPractice ? String(singleQuestionId) : undefined,
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

        if (payload.mode === 'exam' && payload.examSession?.submittedAttemptId) {
          setHasAutoSubmitted(true);
          navigate(`/results/${payload.examSession.submittedAttemptId}`, { replace: true });
          return;
        }

        const localExamDraft = payload.mode === 'exam' ? readExamDraft(quizId, payload.examSession?.id) : null;
        setData(shuffledPayload);
        setCurrentIndex(
          payload.mode === 'exam'
            ? Math.max(0, Math.min(
                Number(localExamDraft?.currentQuestionIndex ?? payload.examSession?.lastQuestionIndex ?? 0),
                Math.max(shuffledPayload.questions.length - 1, 0)
              ))
            : Math.max(0, Math.min(
                Number(payload.practiceSession?.lastQuestionIndex || 0),
                Math.max(shuffledPayload.questions.length - 1, 0)
              ))
        );
        setFlaggedQuestionIds(new Set(
          payload.mode === 'exam' && Array.isArray(payload.examSession?.flaggedQuestionIds)
            ? payload.examSession.flaggedQuestionIds.map(Number).filter(Boolean)
            : []
        ));
        setBookmarkedQuestionIds(new Set(
          (Array.isArray(savedItems) ? savedItems : [])
            .filter((item) => item.itemType === 'question')
            .map((item) => Number(item.itemId))
            .filter(Boolean)
        ));
        setRevealedAnswerIds(new Set());
        setHasAutoSubmitted(false);

        const initial = {};
        const serverExamAnswers = payload.mode === 'exam' && payload.examSession?.answers && typeof payload.examSession.answers === 'object'
          ? payload.examSession.answers
          : {};
        const examAnswers = localExamDraft?.answers && Object.keys(localExamDraft.answers).length >= Object.keys(serverExamAnswers).length
          ? localExamDraft.answers
          : serverExamAnswers;
        shuffledPayload.questions.forEach((q) => {
          if (q.savedAnswer) {
            initial[q.id] = isSbaQuestion(q)
              ? q.savedAnswer.selectedIds?.[0] ?? ''
              : normalizeTfAnswerMap(q.savedAnswer.tfMap);
            return;
          }
          const savedExamAnswer = examAnswers[String(q.id)] ?? examAnswers[q.id];
          if (savedExamAnswer !== undefined && savedExamAnswer !== null && savedExamAnswer !== '') {
            initial[q.id] = isSbaQuestion(q)
              ? Number(savedExamAnswer)
              : normalizeTfAnswerMap(savedExamAnswer);
          }
        });
        setAnswers(initial);
        answersRef.current = initial;
        if (payload.mode === 'exam' && Array.isArray(localExamDraft?.flaggedQuestionIds)) {
          setFlaggedQuestionIds(new Set(localExamDraft.flaggedQuestionIds.map(Number).filter(Boolean)));
        }
        if (shuffledPayload.mode === 'exam') {
          syncExamClock(examClockRef, payload.examSession?.serverTime);
          const serverSeconds = getExamSecondsRemaining(payload.examSession, examClockRef);
          const fallbackSeconds = Math.max(Number(shuffledPayload.quiz?.timeLimit || 0) * 60, 0);
          setSecondsRemaining(Number.isFinite(serverSeconds) ? serverSeconds : fallbackSeconds);
          didHydrateExamStateRef.current = true;
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
  }, [quizId, mode, continuePractice, resetPractice, isSingleQuestionPractice, singleQuestionId, navigate]);

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
  const shouldBlockQuizExit = Boolean(data && !loading && !isSingleQuestionPractice && !practiceReadyForReview && !hasAutoSubmitted);
  const quizExitBlocker = useBlocker(shouldBlockQuizExit);

  const examDurationSeconds = isExam ? Math.max(Number(data?.quiz?.timeLimit || 0) * 60, 0) : 0;

  useEffect(() => {
    const platform = detectPlatform();
    if (!platform.isNative || !platform.isAndroid || !shouldBlockQuizExit || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    document.documentElement.dataset.lmsNativeBackGuard = 'quiz';

    function handleAndroidBack() {
      writeCurrentExamRecoveryDraft(currentIndex);
      if (isExam) {
        void persistExamProgress({ nextIndex: currentIndex, silent: true });
      }
    }

    window.addEventListener('lms:android-back', handleAndroidBack);
    return () => {
      window.removeEventListener('lms:android-back', handleAndroidBack);
      if (document.documentElement.dataset.lmsNativeBackGuard === 'quiz') {
        delete document.documentElement.dataset.lmsNativeBackGuard;
      }
    };
  }, [answers, currentIndex, data, flaggedQuestionIds, hasAutoSubmitted, isExam, quizId, shouldBlockQuizExit]);

  useEffect(() => {
    if (!data || loading || practiceReadyForReview || hasAutoSubmitted) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data, hasAutoSubmitted, loading, practiceReadyForReview]);

  useEffect(() => {
    if (quizExitBlocker.state !== 'blocked') return;

    const shouldLeave = window.confirm(
      isExam
        ? 'Leave this exam? Submit before leaving to avoid losing the attempt.'
        : 'Leave this quiz? Your latest answer may not be saved yet.'
    );

    if (shouldLeave) {
      quizExitBlocker.proceed();
      return;
    }

    quizExitBlocker.reset();
  }, [isExam, quizExitBlocker]);

  useEffect(() => {
    hasSkippedInitialPracticeScrollRef.current = false;
  }, [quizId, mode]);

  useEffect(() => {
    if (!data || !currentQuestion) return;
    if (!isExam && !hasSkippedInitialPracticeScrollRef.current) {
      hasSkippedInitialPracticeScrollRef.current = true;
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const frame = window.requestAnimationFrame(() => {
      scrollQuestionContentIntoView(
        questionContentRef.current,
        prefersReducedMotion ? 'auto' : 'smooth'
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, currentQuestion?.id, data, isExam]);

  useEffect(() => {
    if (!isExam || !data?.examSession?.deadlineAt) return undefined;

    const timer = window.setInterval(() => {
      setSecondsRemaining(getExamSecondsRemaining(data.examSession, examClockRef));
    }, 1000);

    setSecondsRemaining(getExamSecondsRemaining(data.examSession, examClockRef));
    return () => window.clearInterval(timer);
  }, [data?.examSession?.deadlineAt, isExam]);

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

  function syncExamSessionFromSave(result) {
    if (!result?.serverTime) return;
    syncExamClock(examClockRef, result.serverTime);
    setData((current) => {
      if (!current?.examSession) return current;
      return {
        ...current,
        examSession: {
          ...current.examSession,
          serverTime: result.serverTime,
          deadlineAt: result.deadlineAt ?? current.examSession.deadlineAt,
          secondsRemaining: result.secondsRemaining ?? current.examSession.secondsRemaining,
          submittedAttemptId: result.attemptId ?? current.examSession.submittedAttemptId,
        },
      };
    });
    if (Number.isFinite(result.secondsRemaining)) {
      setSecondsRemaining(result.secondsRemaining);
    }
  }

  function clearExamAutosaveRetry() {
    if (examAutosaveRetryTimerRef.current) {
      window.clearTimeout(examAutosaveRetryTimerRef.current);
      examAutosaveRetryTimerRef.current = null;
    }
    examAutosaveRetryDelayRef.current = 2500;
  }

  function scheduleExamAutosaveRetry(nextIndex = currentIndex) {
    if (!isExam || hasAutoSubmitted || examAutosaveRetryTimerRef.current) return;
    const retryDelayMs = examAutosaveRetryDelayRef.current;
    examAutosaveRetryTimerRef.current = window.setTimeout(() => {
      examAutosaveRetryTimerRef.current = null;
      examAutosaveRetryDelayRef.current = Math.min(15000, Math.round(retryDelayMs * 1.75));
      void persistExamProgress({ nextIndex, silent: true });
    }, retryDelayMs);
  }

  async function persistExamProgress({ nextIndex = currentIndex, silent = false } = {}) {
    if (!isExam || !data?.questions?.length || hasAutoSubmitted) return true;
    if (examAutosaveInFlightRef.current) {
      examAutosaveQueuedRef.current = true;
      return true;
    }

    examAutosaveInFlightRef.current = true;
    try {
      const draftPayload = {
        sessionId: data.examSession?.id,
        answers: normalizeAnswersForBackend(answersRef.current || answers, data.questions),
        currentQuestionIndex: nextIndex,
        flaggedQuestionIds: Array.from(flaggedQuestionIds),
      };
      writeExamDraft(quizId, draftPayload);
      const result = await saveExamProgress(quizId, {
        answers: draftPayload.answers,
        currentQuestionIndex: draftPayload.currentQuestionIndex,
        flaggedQuestionIds: draftPayload.flaggedQuestionIds,
      });
      clearExamAutosaveRetry();
      syncExamSessionFromSave(result);
      if (result?.success) {
        clearExamDraft(quizId);
      }
      if (result?.attemptId && result?.submitted) {
        clearExamDraft(quizId);
        setHasAutoSubmitted(true);
        navigate(`/results/${result.attemptId}`, { replace: true });
      }
      if (result?.timeExpired) {
        setSecondsRemaining(0);
      }
      return Boolean(result?.success || result?.submitted || result?.timeExpired);
    } catch (e) {
      if (!silent) {
        setError(getErrorMessage(e, 'Unable to auto-save exam progress'));
      }
      scheduleExamAutosaveRetry(nextIndex);
      return false;
    } finally {
      examAutosaveInFlightRef.current = false;
      if (examAutosaveQueuedRef.current) {
        examAutosaveQueuedRef.current = false;
        void persistExamProgress({ nextIndex: currentIndex, silent: true });
      }
    }
  }

  function writeCurrentExamRecoveryDraft(nextIndex = currentIndex) {
    if (!isExam || !data?.questions?.length || hasAutoSubmitted) return;
    writeExamDraft(quizId, {
      sessionId: data.examSession?.id,
      answers: normalizeAnswersForBackend(answersRef.current || answers, data.questions),
      currentQuestionIndex: nextIndex,
      flaggedQuestionIds: Array.from(flaggedQuestionIds),
    });
  }

  async function goTo(idx) {
    const bounded = Math.max(0, Math.min(idx, (data?.questions?.length || 1) - 1));
    setError('');
    if (data?.mode === 'practice' && !(await practiceSave(bounded))) return;
    setCurrentIndex(bounded);
    if (data?.mode === 'exam') {
      void persistExamProgress({ nextIndex: bounded, silent: true });
    }
  }

  async function finishPractice() {
    if (practiceCompleting || practiceReadyForReview) return;
    setError('');
    setPracticeCompleting(true);
    if (data?.mode === 'practice') {
      const saved = await practiceSave(currentIndex);
      if (!saved) {
        setPracticeCompleting(false);
        return;
      }
    }
    if (isSingleQuestionPractice) {
      setPracticeCompleting(false);
      navigate('/bookmarks');
      return;
    }
    playNativeCompletionBell();
    void nativeSuccess();
    setPracticeReadyForReview(true);
    setPracticeCompleting(false);
  }

  async function handleSubmit() {
    setConfirmExamSubmitOpen(false);
    setError('');
    setSaving(true);
    try {
      if (isExam) {
        await persistExamProgress({ nextIndex: currentIndex, silent: true });
      }
      const result = await submitExam(quizId, {
        answers: normalizeAnswersForBackend(answersRef.current || answers, data?.questions || []),
      });
      clearExamAutosaveRetry();
      clearExamDraft(quizId);
      setHasAutoSubmitted(true);
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

  useEffect(() => {
    if (!isExam || !data?.questions?.length || !didHydrateExamStateRef.current || hasAutoSubmitted) {
      return undefined;
    }

    if (examAutosaveTimerRef.current) {
      window.clearTimeout(examAutosaveTimerRef.current);
    }

    examAutosaveTimerRef.current = window.setTimeout(() => {
      void persistExamProgress({ nextIndex: currentIndex });
    }, 650);

    return () => {
      if (examAutosaveTimerRef.current) {
        window.clearTimeout(examAutosaveTimerRef.current);
        examAutosaveTimerRef.current = null;
      }
    };
  }, [answers, currentIndex, data?.questions, flaggedQuestionIds, hasAutoSubmitted, isExam]);

  useEffect(() => {
    if (!isExam || !data?.questions?.length || !didHydrateExamStateRef.current || hasAutoSubmitted) {
      return undefined;
    }

    const saveForPauseOrNetworkChange = () => {
      writeCurrentExamRecoveryDraft(currentIndex);
      void persistExamProgress({ nextIndex: currentIndex, silent: true });
    };
    const saveLocalDraftOnly = () => {
      writeCurrentExamRecoveryDraft(currentIndex);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveForPauseOrNetworkChange();
      }
    };

    window.addEventListener('pagehide', saveForPauseOrNetworkChange);
    window.addEventListener('offline', saveLocalDraftOnly);
    window.addEventListener('online', saveForPauseOrNetworkChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', saveForPauseOrNetworkChange);
      window.removeEventListener('offline', saveLocalDraftOnly);
      window.removeEventListener('online', saveForPauseOrNetworkChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [answers, currentIndex, data, flaggedQuestionIds, hasAutoSubmitted, isExam, quizId]);

  useEffect(() => () => {
    clearExamAutosaveRetry();
  }, []);

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

  const handlePracticeReviewOpen = useCallback(() => {
    const questionParam = isSingleQuestionPractice ? `&questionId=${singleQuestionId}` : '';
    navigate(`/quizzes/${quizId}/practice-review?complete=1${questionParam}`);
  }, [isSingleQuestionPractice, navigate, quizId, singleQuestionId]);

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
    const questionTypeLabel = isSbaQuestion(currentQuestion) ? 'SBA' : 'True / False';
    const practiceEndLabel = isSingleQuestionPractice ? 'Done' : 'Finish';
    const practiceEndBusyLabel = isSingleQuestionPractice ? 'Saving...' : 'Submitting...';

    return (
      <main className={practiceQuizScreenShellClass}>
        <section className={practiceQuizLayoutClass}>
          {practiceReadyForReview && !isSingleQuestionPractice ? (
            <QuizCompletionOverlay
              quizLabel={getQuizNumberLabel(data.quiz)}
              onReview={handlePracticeReviewOpen}
            />
          ) : null}

          <ExamModeHeader
            title={data.quiz.quizTitle}
            quizLabel={getQuizNumberLabel(data.quiz)}
            isFree={data.quiz.isFree}
            secondaryLabel="Mode"
            secondaryValue="Practice"
            onEndSession={finishPractice}
            saving={saving || practiceCompleting || questionActionBusy}
            theme={theme}
            workspaceLabel=""
            endLabel={practiceCompleting ? practiceEndBusyLabel : practiceEndLabel}
            className={practiceHeaderClass}
            showThemeToggle
            showSecondary={false}
            endButtonClass={practiceHeaderEndClass}
          />

          {error ? <div className={ui.feedbackError} role="alert" aria-live="assertive">{error}</div> : null}

          <section className={practiceQuizWorkspaceClass}>
            <aside className={practiceQuizSidebarClass}>
              <div className={practiceQuizSummaryGridClass}>
                <PracticeSummaryTile label="Total" value={totalQuestions} />
                <PracticeSummaryTile label="Answered" value={answeredCount} />
                <PracticeSummaryTile label="Current" value={currentIndex + 1} />
                <PracticeSummaryTile label="Progress" value={`${progressPercent}%`} />
              </div>

              <section className={cx(practiceQuizSideNavClass, 'lms-practice-progress-card')} aria-label="Practice progress">
                <div className={practiceQuizNavHeadClass}>
                  <h3>Progress</h3>
                  <span>{progressPercent}% complete</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  aria-label="Practice progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <span
                    className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="m-0 text-xs font-semibold leading-relaxed text-ink-soft">
                  Question {currentIndex + 1} of {totalQuestions} / {questionTypeLabel}
                </p>
              </section>

              <section className={cx(practiceQuizSideNavClass, 'lms-practice-question-key')} aria-label="Question navigator">
                <div className={practiceQuizNavHeadClass}>
                  <h3>Question List</h3>
                  <span>{totalQuestions} total</span>
                </div>

                <div className={practiceQuizBubbleNavClass}>
                  {data.questions.map((question, index) => (
                    <button
                      className={getPracticeQuizBubbleClass({
                        active: index === currentIndex,
                        answered: isAnswered(question, answers[question.id]),
                        flagged: flaggedQuestionIds.has(question.id),
                        saved: bookmarkedQuestionIds.has(question.id),
                      })}
                      key={question.id}
                      type="button"
                      onClick={() => goTo(index)}
                      title={`Question ${index + 1}`}
                      aria-current={index === currentIndex ? 'step' : undefined}
                      aria-label={getQuestionNavButtonLabel(index, {
                        active: index === currentIndex,
                        answered: isAnswered(question, answers[question.id]),
                        flagged: flaggedQuestionIds.has(question.id),
                        saved: bookmarkedQuestionIds.has(question.id),
                      })}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className={practiceQuizBubbleLegendClass}>
                  <span><i className="border-brand-primary/30 bg-brand-primary/30" />Current</span>
                  <span><i className="border-brand-success/30 bg-brand-success/30" />Answered</span>
                  <span><i className="is-idle" />Not answered</span>
                  <span><i className="border-[color-mix(in_srgb,#8b5cf6_30%,var(--line-soft))] bg-[color-mix(in_srgb,#8b5cf6_30%,transparent)]" />Saved</span>
                  <span><i className="border-[color-mix(in_srgb,#d97706_30%,var(--line-soft))] bg-[color-mix(in_srgb,#d97706_30%,transparent)]" />Flagged</span>
                </div>
              </section>
            </aside>

            <section className={practiceQuizMainClass}>
              <article className={cx(practiceQuizQuestionCardClass, examQuestionStartAnchorClass)} ref={questionContentRef}>
                <MedicalText
                  as="p"
                  className={practiceQuizQuestionTextClass}
                  text={currentQuestion.questionText}
                  imageLoading="eager"
                  imageFetchPriority="high"
                  imageZoomable
                />


                <div className={practiceQuizQuestionHeadClass}>
                  <div className={practiceQuizQuestionMetaClass}>
                    <span className={practiceQuizQuestionNumberClass}>Question {currentIndex + 1} of {totalQuestions}</span>
                    <span className={quizReviewChipClass('neutral')}>{questionTypeLabel}</span>
                    {currentQuestionRevealed ? <span className={quizReviewChipClass('correct')}>Explanation shown</span> : null}
                  </div>
                  <span className={quizReviewChipClass(currentQuestionAnswered ? 'neutral' : 'unanswered')}>
                    {currentQuestionAnswered ? 'Answered' : 'Unanswered'}
                  </span>
                </div>
                <p className="sr-only" aria-live="polite">
                  Question {currentIndex + 1} of {totalQuestions}. {currentQuestionAnswered ? 'Answered.' : 'Not answered.'} {currentQuestionRevealed ? 'Explanation is shown.' : ''}
                </p>

                <div className={practiceQuizOptionsGridClass}>
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
                            practiceQuizOptionCardClass,
                            practiceQuizOptionInteractiveClass,
                            optionTone === 'selected' && practiceQuizOptionSelectedClass,
                            optionTone === 'correct' && practiceQuizOptionCorrectClass,
                            optionTone === 'wrong' && practiceQuizOptionWrongClass,
                            optionTone === 'correct' && 'is-correct',
                            optionTone === 'wrong' && 'is-wrong',
                            optionTone === 'unanswered' && 'is-unanswered'
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
                          <span className={practiceQuizOptionToplineClass}>
                            <span className={practiceQuizOptionLeadClass}>
                              <span className={quizReviewOptionIconClass(optionTone)} aria-hidden="true">{letterLabel}</span>
                              <MedicalText as="span" className={practiceQuizOptionTextClass} text={option.optionText} />
                            </span>
                            {currentQuestionRevealed ? (
                              <span className={practiceQuizOptionLabelsClass}>
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
                          practiceQuizOptionCardClass,
                          answerTone === 'selected' && practiceQuizOptionSelectedClass,
                          answerTone === 'correct' && practiceQuizOptionCorrectClass,
                          answerTone === 'wrong' && practiceQuizOptionWrongClass,
                          answerTone === 'unanswered' && practiceQuizOptionUnansweredClass,
                          answerTone === 'correct' && 'is-correct',
                          answerTone === 'wrong' && 'is-wrong',
                          answerTone === 'unanswered' && 'is-unanswered'
                        )} key={option.id}>
                          <div className={practiceQuizOptionToplineClass}>
                            <div className={practiceQuizOptionLeadClass}>
                              <span className={quizReviewOptionIconClass(answerTone)} aria-hidden="true">
                                {letterLabel}
                              </span>
                              <MedicalText as="span" className={practiceQuizOptionTextClass} text={option.optionText} />
                            </div>
                            {currentQuestionRevealed ? (
                              <span className={practiceQuizOptionLabelsClass}>
                                <span className={quizReviewChipClass(selectedCorrect ? 'correct' : hasSelectedValue ? 'wrong' : 'unanswered')}>
                                  Your Answer: {selectedLabel}
                                </span>
                                <span className={quizReviewChipClass('correct')}>
                                  Correct: {correctLabel}
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <div className={practiceQuizTfActionsClass}>
                            <button
                              className={cx(
                                practiceQuizTfToggleClass,
                                !currentQuestionRevealed && selectedValue === 1 && practiceQuizTfTrueActiveClass,
                                currentQuestionRevealed && correctValue === 1 && practiceQuizTfChoiceCorrectClass,
                                currentQuestionRevealed && selectedValue === 1 && correctValue !== 1 && practiceQuizTfChoiceWrongClass
                              )}
                              type="button"
                              aria-pressed={selectedValue === 1}
                              aria-label={`Question ${currentIndex + 1}, statement ${letterLabel}: answer True`}
                              onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                            >
                              True
                            </button>
                            <button
                              className={cx(
                                practiceQuizTfToggleClass,
                                !currentQuestionRevealed && selectedValue === 0 && practiceQuizTfFalseActiveClass,
                                currentQuestionRevealed && correctValue === 0 && practiceQuizTfChoiceCorrectClass,
                                currentQuestionRevealed && selectedValue === 0 && correctValue !== 0 && practiceQuizTfChoiceWrongClass
                              )}
                              type="button"
                              aria-pressed={selectedValue === 0}
                              aria-label={`Question ${currentIndex + 1}, statement ${letterLabel}: answer False`}
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
                  showStudySupport={false}
                />

                <PracticeStudySupport
                  currentQuestion={currentQuestion}
                  revealed={currentQuestionRevealed}
                  className="max-[1180px]:grid min-[1181px]:hidden"
                />


                <nav className={practiceQuizQuestionNavClass} aria-label="Practice question actions">
                  <div className={practiceQuizQuestionNavActionsClass}>
                    <div className={quizActionStartGroupClass}>
                      <button
                        className={reviewSecondaryButtonClass}
                        type="button"
                        onClick={() => goTo(currentIndex - 1)}
                        disabled={currentIndex === 0 || saving}
                      >
                        Previous
                      </button>
                    </div>

                    <div className={quizActionReviewGroupClass}>
                      <button
                        className={reviewSecondaryButtonClass}
                        type="button"
                        onClick={revealCurrentAnswer}
                        disabled={currentQuestionRevealed || !currentQuestionCanReveal}
                      >
                        {currentQuestionRevealed ? 'Shown' : currentQuestionCanReveal ? 'Show answer' : 'Review'}
                      </button>
                    </div>

                    <div className={quizActionPrimaryGroupClass}>
                      {currentIndex < totalQuestions - 1 ? (
                        <button
                          className={reviewPrimaryButtonClass}
                          type="button"
                          onClick={() => goTo(currentIndex + 1)}
                          disabled={saving || practiceCompleting}
                        >
                          {saving ? 'Saving...' : 'Next'}
                        </button>
                      ) : (
                        <button
                          className={reviewPrimaryButtonClass}
                          type="button"
                          onClick={finishPractice}
                          disabled={saving || practiceCompleting}
                        >
                          {practiceCompleting ? practiceEndBusyLabel : isSingleQuestionPractice ? 'Done' : 'Finish practice'}
                        </button>
                      )}
                    </div>
                  </div>
                </nav>
                <QuestionUtilityActions
                  bookmarked={currentQuestionBookmarked}
                  flagged={currentQuestionFlagged}
                  busy={questionActionBusy || saving || practiceCompleting}
                  onFlag={toggleFlagCurrentQuestion}
                  onBookmark={toggleBookmarkCurrentQuestion}
                  onReport={reportCurrentQuestion}
                />
              </article>
            </section>

            <aside className={practiceQuizAsideClass}>
              <PracticeStudySupport
                currentQuestion={currentQuestion}
                revealed={currentQuestionRevealed}
              />
            </aside>
          </section>
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

        {error ? <div className={ui.feedbackError} role="alert" aria-live="assertive">{error}</div> : null}

        <div className={examGridClass}>
          <aside className={examSidebarClass}>
            <div className={practiceQuizSummaryGridClass}>
              <PracticeSummaryTile label="Total" value={totalQuestions} />
              <PracticeSummaryTile label="Answered" value={answeredCount} />
              <PracticeSummaryTile label="Current" value={currentIndex + 1} />
              <PracticeSummaryTile label="Progress" value={`${progressPercent}%`} />
            </div>

            <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass, 'lms-practice-progress-card')}>
              <div className={examQuestionTypeRowClass}>
                <div className={examCardKickerClass}>Progress</div>
                <span className={examChipMiniClass}>{isSbaQuestion(currentQuestion) ? 'SBA' : 'T/F'}</span>
              </div>
              <div className={examProgressToplineClass}>
                <strong className={examProgressCurrentClass}>Question {currentIndex + 1} of {totalQuestions}</strong>
                <span className={examProgressPercentClass}>{progressPercent}% complete</span>
              </div>
              <div
                className={examProgressBarClass}
                role="progressbar"
                aria-label="Exam progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
              </div>
            </section>

            <section className={cx(examPanelClass, quizFlashPanelClass, 'lms-practice-question-key')}>
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
                      aria-current={index === currentIndex ? 'step' : undefined}
                      aria-label={getQuestionNavButtonLabel(index, {
                        active: index === currentIndex,
                        answered,
                        flagged,
                        review: reviewing,
                      })}
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
            <MedicalText
              as="div"
              className={quizFlashQuestionCopyClass}
              text={currentQuestion.questionText}
              imageLoading="eager"
              imageFetchPriority="high"
              imageZoomable
            />
            <p className="sr-only" aria-live="polite">
              Question {currentIndex + 1} of {totalQuestions}. {currentQuestionAnswered ? 'Answered.' : 'Not answered.'} {currentQuestionFlagged ? 'Flagged.' : ''}
            </p>

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
                          <MedicalText as="span" className={quizReviewOptionTextClass} text={option.optionText} />
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
                          <MedicalText as="span" className={quizReviewOptionTextClass} text={option.optionText} />
                        </div>
                      </div>
                      <div className={examTfActionsClass}>
                        <button className={cx(examTfToggleClass, selectedValue === 1 && examTfTrueActiveClass)}
                          type="button"
                          aria-pressed={selectedValue === 1}
                          aria-label={`Question ${currentIndex + 1}, statement ${letterLabel}: answer True`}
                          onClick={() => updateTf(currentQuestion.id, option.id, 1)}
                        >
                          True
                        </button>
                        <button className={cx(examTfToggleClass, selectedValue === 0 && examTfFalseActiveClass)}
                          type="button"
                          aria-pressed={selectedValue === 0}
                          aria-label={`Question ${currentIndex + 1}, statement ${letterLabel}: answer False`}
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
              <div className={examMainFooterActionsClass}>
                <div className={examMainFooterLeftClass}>
                  <button
                    className={cx(reviewSecondaryButtonClass)}
                    type="button"
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0 || saving}
                  >
                    Previous
                  </button>
                </div>

                <div className={examMainFooterRightClass}>
                  <button
                    className={cx(reviewPrimaryButtonClass, examFooterNextClass)}
                    type="button"
                    onClick={currentIndex < totalQuestions - 1 ? () => goTo(currentIndex + 1) : requestExamSubmit}
                    disabled={saving}
                  >
                    {currentIndex < totalQuestions - 1 ? 'Next' : saving ? 'Submitting...' : 'Submit exam'}
                  </button>
                </div>
              </div>

            </div>
            <QuestionUtilityActions
              bookmarked={currentQuestionBookmarked}
              flagged={currentQuestionFlagged}
              busy={questionActionBusy || saving}
              onFlag={toggleFlagCurrentQuestion}
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
            aria-describedby="exam-submit-confirm-description"
            onClick={() => setConfirmExamSubmitOpen(false)}
          >
            <div
              className="w-[min(420px,100%)] rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-card-elevated p-5 shadow-[var(--ds-floating-shadow)] dark:border-white/[0.09]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-2">
                <h2 id="exam-submit-confirm-title" className="m-0 text-[18px] font-extrabold text-ink-strong">
                  Submit exam?
                </h2>
                <p id="exam-submit-confirm-description" className="m-0 text-[13px] leading-relaxed text-ink-soft">
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
