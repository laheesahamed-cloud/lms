import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadStudentQuiz, savePracticeAnswer, submitExam } from '../../../api/quizAttempts.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { useThemeStore } from '../../../stores/themeStore.js';
import { ThemeToggle } from '../../../components/layout/ThemeToggle.jsx';
import { TheoryRecapPopupTrigger } from '../components/QuickTheoryRecap.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const THEORY_RECAP_PRACTICE_COACHMARK_KEY = 'lms.practice.quickTheoryRecapCoachmark.dismissed';
const DISPLAY_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const recapCoachmarkClass =
  'absolute right-0 top-[calc(100%+12px)] z-20 w-[min(340px,82vw)] rounded-xl border border-blue-200/90 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-4 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.14)] ring-1 ring-blue-100/80 before:absolute before:right-7 before:top-[-7px] before:size-3.5 before:rotate-45 before:border-l before:border-t before:border-blue-200/90 before:bg-white before:content-[""] dark:border-brand-primary/25 dark:bg-surface-elevated dark:text-ink-strong dark:shadow-2xl dark:ring-white/10 dark:before:border-brand-primary/25 dark:before:bg-surface-elevated max-[640px]:fixed max-[640px]:inset-x-3 max-[640px]:bottom-3 max-[640px]:top-auto max-[640px]:w-auto max-[640px]:before:hidden';
const recapCoachmarkCopyClass =
  'grid gap-1.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-slate-600 dark:[&_p]:text-ink-medium [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:leading-tight [&_strong]:text-slate-950 dark:[&_strong]:text-ink-strong';
const recapCoachmarkActionsClass = 'mt-3 flex justify-end gap-2 max-[420px]:grid max-[420px]:grid-cols-1';
const recapCoachmarkLinkClass =
  'min-h-9 cursor-pointer rounded-md border border-transparent bg-[var(--brand-gradient-primary)] px-3.5 text-xs font-extrabold text-white shadow-glow transition hover:-translate-y-px hover:brightness-105';
const recapCoachmarkMuteClass =
  'min-h-9 cursor-pointer rounded-md border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 dark:border-line-soft dark:bg-surface-2 dark:text-ink-medium dark:hover:bg-surface-3 dark:hover:text-ink-strong';
const examCardKickerClass = 'text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary';
const examScreenShellClass = `${ui.screenShell} px-[clamp(18px,2.8vw,30px)] pb-[clamp(18px,2.8vw,30px)] pt-[clamp(10px,1.4vw,18px)] max-[600px]:p-3.5`;
const examLayoutClass = 'mx-auto grid w-[min(100%,1520px)] gap-[18px] bg-[var(--exam-shell-bg)] pb-2.5';
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
  '--exam-answer-hover-shadow': '0 12px 24px rgba(59,130,246,0.08)',
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
  '--exam-answer-hover-shadow': '0 14px 28px rgba(15,23,42,0.20)',
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
  'sticky top-2.5 z-10 flex items-center justify-between gap-[18px] rounded-[22px] border border-[var(--exam-card-border)] bg-[color-mix(in_srgb,var(--surface-0)_72%,transparent)] px-3.5 py-3 shadow-[var(--exam-card-shadow)] backdrop-blur-[14px] max-[700px]:static max-[700px]:flex-col max-[700px]:items-stretch';
const practiceHeaderClass = 'static';
const examHeaderBrandClass = 'flex min-w-0 items-center gap-3.5';
const examHeaderLogoClass =
  'grid size-11 shrink-0 place-items-center rounded-[14px] border border-[var(--exam-header-logo-border)] bg-[var(--exam-header-logo-bg)] shadow-[var(--exam-header-logo-shadow)]';
const examHeaderTitleClass = 'block text-lg font-extrabold text-ink-strong';
const examHeaderSubtitleClass = 'mt-[3px] block text-xs text-ink-soft';
const examHeaderActionsClass = 'flex flex-wrap items-center justify-end gap-2.5 max-[700px]:justify-start';
const examHeaderChipClass =
  'inline-flex min-h-11 items-center gap-2.5 rounded-[14px] border border-[var(--exam-header-chip-border)] bg-[var(--exam-header-chip-bg)] px-4 text-sm text-ink-medium shadow-[var(--exam-header-chip-shadow)]';
const examHeaderChipValueClass = 'text-lg font-extrabold text-ink-strong';
const examHeaderIconClass = 'inline-grid place-items-center text-ink-soft';
const examHeaderEndClass =
  'min-h-11 rounded-[14px] border border-[var(--exam-end-border)] bg-[var(--exam-end-bg)] px-[18px] text-sm font-bold text-[var(--exam-end-text)] shadow-none transition disabled:cursor-not-allowed disabled:opacity-60';
const examGridClass = 'grid grid-cols-[minmax(196px,236px)_minmax(0,1fr)_minmax(300px,360px)] items-start gap-[18px] max-[1180px]:grid-cols-[minmax(188px,224px)_minmax(0,1fr)] max-[900px]:grid-cols-1';
const practiceGridClass = 'min-[1181px]:grid-cols-[minmax(188px,220px)_minmax(0,900px)_minmax(300px,360px)] min-[1181px]:justify-center';
const examSidebarClass = 'grid gap-[18px] max-[900px]:order-2';
const examExplainerClass = 'grid gap-[18px] max-[1180px]:col-span-2 max-[900px]:order-3 max-[900px]:col-span-1';
const examPanelClass =
  'border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-[18px] shadow-[var(--exam-card-shadow)]';
const examProgressPanelClass =
  'relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,#2563EB,#7C3AED)] before:content-[""]';
const examMainCardClass =
  'grid min-h-[540px] grid-rows-[auto_1fr_auto] border border-[var(--exam-card-border)] bg-[var(--exam-main-bg)] p-[clamp(18px,3vw,34px)] shadow-[var(--exam-card-shadow)] max-[600px]:min-h-[auto]';
const examCardHeadClass = 'mb-4 flex items-start justify-between gap-3 text-ink-strong [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-extrabold';
const examQuestionTypeRowClass = 'mb-3 flex items-center justify-between';
const examChipMiniClass =
  'inline-flex min-h-7 items-center rounded-full border border-[var(--exam-header-chip-border)] bg-[var(--exam-chip-primary-bg)] px-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--exam-chip-text)]';
const examProgressStatsClass = 'mt-4 grid grid-cols-2 gap-2.5';
const examProgressStatClass =
  'rounded-[14px] border border-[var(--exam-stat-border)] bg-[var(--exam-stat-bg)] p-2.5 [&_small]:block [&_small]:text-[10px] [&_small]:uppercase [&_small]:tracking-[0.06em] [&_small]:text-ink-soft [&_strong]:mt-1 [&_strong]:block [&_strong]:text-lg [&_strong]:font-extrabold [&_strong]:text-ink-strong';
const examProgressAnsweredClass = 'text-[#16A34A]';
const examProgressFlaggedClass = 'text-[#EA580C]';
const examProgressReviewClass = 'text-brand-violet';
const examTipTitleClass = 'mb-2 text-[13px] font-extrabold text-brand-primary';
const examProgressToplineClass = 'mb-3 mt-3.5 flex items-center justify-between gap-3';
const examProgressCurrentClass = 'text-base font-bold text-ink-strong';
const examProgressPercentClass = 'text-[13px] text-ink-soft';
const examProgressBarClass = 'h-[7px] overflow-hidden rounded-full bg-[var(--exam-progress-track)]';
const examProgressFillClass = 'block h-full rounded-[inherit] bg-[linear-gradient(90deg,#2563EB,#7C3AED)] shadow-[0_0_10px_rgba(37,99,235,0.24)]';
const quizFlashPanelClass = 'rounded-[22px] backdrop-blur-md max-[600px]:rounded-[18px]';
const quizFlashQuestionCopyClass = 'relative pb-[22px] font-semibold max-[600px]:pl-3.5';
const quizFlashAnswerCardClass =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.88))] dark:bg-[linear-gradient(180deg,rgba(17,27,44,0.94),rgba(10,18,31,0.98))]';
const quizFlashSelectedAnswerClass = 'bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(230,240,255,0.92))]';
const quizFlashFooterButtonClass = 'rounded-xl';
const quizFlashNextButtonClass = 'shadow-[0_12px_24px_rgba(99,102,241,0.22)]';
const quizFlashTipClass = 'border border-slate-400/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.06))]';
const examTipCardClass = 'mt-[18px] rounded-[16px] p-4 text-sm leading-relaxed text-ink-medium [&_p]:m-0';
const examQuestionStartAnchorClass = 'h-0 scroll-mt-[14px]';
const examQuestionNavClass = 'grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-2 max-[900px]:grid-cols-8 max-[600px]:grid-cols-5';
const examNavBubbleBaseClass =
  'min-h-9 rounded-xl border border-[var(--exam-nav-idle-border)] bg-[var(--exam-nav-idle-bg)] text-sm font-bold text-[var(--exam-nav-idle-text)] shadow-none';
const examNavLegendClass = 'mt-4 flex flex-wrap gap-4 text-xs text-ink-soft';
const examNavLegendItemClass = 'inline-flex items-center gap-2';
const examNavLegendDotClass = 'inline-block size-3 rounded border border-transparent';
const examNavJumpsClass = 'mt-[18px] grid gap-2.5';
const examNavJumpClass =
  'flex min-h-[46px] items-center justify-between gap-3 rounded-[14px] border border-[var(--exam-jump-border)] bg-[var(--exam-jump-bg)] px-4 text-sm font-bold text-[var(--exam-jump-text)] shadow-none disabled:bg-[var(--exam-jump-disabled-bg)] disabled:text-[var(--exam-jump-disabled-text)]';
const examExplanationEmptyClass =
  'rounded-[16px] border border-dashed border-[var(--exam-card-border)] bg-[var(--exam-soft-panel)] p-[18px] text-sm leading-relaxed text-ink-soft [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[15px] [&_strong]:text-ink-strong [&_p]:m-0';
const examExplanationBodyClass = 'grid gap-3 text-[15px] leading-relaxed text-ink-medium [&_p]:m-0';
const examWhyIncorrectClass = 'mt-2 grid gap-3 rounded-[16px] border border-[var(--exam-card-border)] bg-[var(--exam-soft-panel)] p-4 [&>strong]:text-[13px] [&>strong]:text-ink-strong';
const examWhyIncorrectItemClass = 'grid gap-1 rounded-[12px] bg-[var(--surface-0)] p-3 [&_span]:text-[13px] [&_span]:font-bold [&_span]:text-ink-strong [&_p]:text-[13px] [&_p]:text-ink-soft';
const examAnswerListClass = 'mx-auto grid w-[min(100%,960px)] gap-3 px-0 pb-3.5 pt-3';
const examAnswerCardClass =
  'flex min-h-[58px] cursor-pointer items-center gap-3 rounded-[18px] border border-[var(--exam-answer-border)] px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-brand-primary/30 hover:-translate-y-px hover:border-[var(--exam-answer-hover-border)] hover:shadow-[var(--exam-answer-hover-shadow)]';
const examAnswerSelectedClass = 'border-[var(--exam-answer-selected-border)] shadow-[var(--exam-answer-selected-ring)]';
const examAnswerCorrectClass =
  'border-emerald-500/40 bg-[linear-gradient(180deg,rgba(236,253,243,0.98),rgba(220,252,231,0.94))] shadow-[0_0_0_3px_rgba(34,197,94,0.12)] dark:bg-[linear-gradient(180deg,rgba(7,52,39,0.94),rgba(7,39,31,0.96))]';
const examAnswerWrongClass =
  'border-red-500/40 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.92))] shadow-[0_0_0_3px_rgba(239,68,68,0.12)] dark:bg-[linear-gradient(180deg,rgba(69,18,25,0.94),rgba(45,14,20,0.96))]';
const examAnswerContentClass = 'flex w-full min-w-0 items-center justify-start gap-[13px]';
const examAnswerRadioClass =
  'relative size-5 shrink-0 rounded-full border-2 border-[var(--exam-answer-radio)] after:absolute after:inset-[3px] after:scale-0 after:rounded-full after:bg-brand-primary after:transition-transform after:content-[""]';
const examAnswerRadioSelectedClass = 'border-brand-primary after:scale-100';
const examAnswerRadioCorrectClass = 'border-brand-success after:bg-brand-success';
const examAnswerRadioWrongClass = 'border-brand-error after:bg-brand-error';
const examAnswerCopyClass = 'block min-w-0 flex-1 text-left text-[15px] font-medium leading-snug text-[var(--exam-answer-text)]';
const examTfCardClass =
  'flex min-h-[58px] flex-wrap items-center gap-3 rounded-[18px] border border-[var(--exam-answer-border)] px-4 py-3.5';
const examTfCopyClass = 'min-w-0 flex-1';
const examTfActionsClass = 'ml-auto flex shrink-0 justify-end gap-2 max-[600px]:ml-0 max-[600px]:w-full max-[600px]:justify-stretch';
const examTfToggleClass =
  'min-h-10 rounded-xl border border-[var(--exam-tf-border)] bg-[var(--exam-tf-bg)] px-4 text-[13px] font-bold text-[var(--exam-tf-text)] shadow-none transition max-[600px]:flex-1';
const examTfTrueActiveClass = 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
const examTfFalseActiveClass = 'border-red-500/20 bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200';
const examTfRevealClass =
  'basis-full rounded-[12px] px-3 py-2 text-[13px] font-bold';
const examTfRevealTrueClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
const examTfRevealFalseClass = 'bg-red-500/10 text-red-600 dark:text-red-200';
const examMainFooterClass = 'mt-5 flex items-center justify-between gap-3 border-t border-[var(--exam-card-border)] pt-4 max-[700px]:flex-col max-[700px]:items-stretch';
const examMainFooterLeftClass = 'flex flex-wrap gap-2.5';
const examFooterButtonClass =
  'min-h-11 rounded-xl border border-[var(--exam-footer-btn-border)] bg-[var(--exam-footer-btn-bg)] px-[18px] text-sm font-bold text-[var(--exam-footer-btn-text)] shadow-none transition disabled:cursor-not-allowed disabled:opacity-55';
const examFooterFlagActiveClass = 'border-orange-500/30 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200';
const examFooterNextClass = 'border-brand-primary bg-brand-primary text-white';
const examModeFooterClass =
  'flex items-center justify-between gap-4 border border-[var(--exam-card-border)] bg-[var(--exam-card-bg)] p-4 shadow-[var(--exam-card-shadow)] max-[800px]:flex-col max-[800px]:items-stretch';
const examModeFooterBlockClass = 'grid gap-0.5 [&_strong]:text-[15px] [&_strong]:text-ink-strong [&_small]:text-xs [&_small]:text-ink-soft';
const examModeFooterTrackerClass = 'flex flex-wrap items-center justify-end gap-2.5 max-[800px]:justify-start';
const examBlockClass =
  'inline-flex items-center gap-2 rounded-full border border-[var(--exam-block-line)] bg-[var(--exam-block-bg)] px-3 py-1.5 text-xs font-bold text-[var(--exam-block-text)]';
const examBlockDoneClass = 'border-emerald-500/25 text-emerald-700 dark:text-emerald-200';
const examBlockCurrentClass = 'border-brand-primary/25 text-brand-primary';
const examBlockDotClass = 'size-2.5 rounded-full border border-[var(--exam-block-dot-border)] bg-[var(--exam-block-dot-fill)]';
const examBlockDotDoneClass = 'border-emerald-500 bg-emerald-500';
const examBlockDotCurrentClass = 'border-brand-primary bg-brand-primary';

function getExamNavBubbleClass({ active, answered, flagged, review }) {
  return cx(
    examNavBubbleBaseClass,
    active && 'border-brand-primary bg-brand-primary text-white',
    !active && answered && 'border-brand-success/25 bg-[#4CC46A] text-white',
    !active && flagged && 'border-orange-500/20 bg-[#FB923C] text-white',
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

function ExamModeHeader({
  title,
  secondaryLabel = 'Time',
  secondaryValue,
  onEndSession,
  saving,
  theme,
  workspaceLabel = 'Exam workspace',
  endLabel = 'End session',
  className = '',
}) {
  const resolvedSecondaryValue = secondaryValue ?? formatDuration(0);

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
          <strong className={examHeaderTitleClass}>{title}</strong>
          <small className={examHeaderSubtitleClass}>{workspaceLabel}</small>
        </div>
      </div>

      <div className={examHeaderActionsClass}>
        <ThemeToggle />

        <div className={examHeaderChipClass}>
          <span className={examHeaderIconClass} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4.6v3.8l2.3 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>{secondaryLabel}</span>
          <strong className={examHeaderChipValueClass}>{resolvedSecondaryValue}</strong>
        </div>

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

function getIncorrectOptionReasons(question) {
  return (question?.options || [])
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
}

function ExplanationRail({
  isExam,
  currentQuestion,
  currentQuestionAnswered,
  currentQuestionRevealed,
  currentQuestionFlagged,
  currentQuestionBookmarked,
}) {
  const [showRecapCoachmark, setShowRecapCoachmark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEORY_RECAP_PRACTICE_COACHMARK_KEY) !== 'true';
  });
  const hasPracticeRecap = Boolean(currentQuestion?.theoryRecap && (
    currentQuestion.theoryRecap.etiology?.length ||
    currentQuestion.theoryRecap.pathophysiology?.length ||
    currentQuestion.theoryRecap.clinicalFeatures?.length ||
    currentQuestion.theoryRecap.investigations?.length ||
    currentQuestion.theoryRecap.treatment?.length ||
    currentQuestion.theoryRecap.keyPoints?.length ||
    currentQuestion.theoryRecap.mnemonic
  ));

  function dismissRecapCoachmark({ neverShowAgain = false } = {}) {
    if (neverShowAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(THEORY_RECAP_PRACTICE_COACHMARK_KEY, 'true');
    }
    setShowRecapCoachmark(false);
  }

  return (
    <aside className={examExplainerClass}>
      {!isExam && currentQuestion?.theoryRecap !== undefined ? (
        <div className="relative mb-2" data-recap-coachmark-root>
          <TheoryRecapPopupTrigger
            recap={currentQuestion.theoryRecap}
            context="practice"
            revealed={currentQuestionRevealed}
          />
          {showRecapCoachmark && hasPracticeRecap ? (
            <div className={recapCoachmarkClass} role="status">
              <div className={recapCoachmarkCopyClass}>
                <strong>Need a quick theory refresh?</strong>
                <p>Open the recap to review the key points behind this question.</p>
              </div>
              <div className={recapCoachmarkActionsClass}>
                <button className={recapCoachmarkLinkClass}
                  type="button"
                 
                  onClick={() => dismissRecapCoachmark()}
                >
                  Got it
                </button>
                <button className={recapCoachmarkMuteClass}
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

      <section className={cx(examPanelClass, quizFlashPanelClass)}>
        <div className={examCardHeadClass}>
          <div>
            <div className={examCardKickerClass}>Explanation</div>
            <strong>{isExam ? 'Locked during exam' : 'Learning support'}</strong>
          </div>
        </div>

        {isExam ? (
          <div className={examExplanationEmptyClass}>
            <strong>Explanation stays hidden</strong>
            <p>Exam mode keeps explanations and correct answers hidden until you submit the paper.</p>
          </div>
        ) : currentQuestionRevealed && (currentQuestion?.explanation || getIncorrectOptionReasons(currentQuestion).length) ? (
          <div className={examExplanationBodyClass}>
            {formatExplanationBlocks(currentQuestion.explanation).map((part, index) => (
              <p key={`${index}-${part.slice(0, 24)}`}>{part}</p>
            ))}
            {getIncorrectOptionReasons(currentQuestion).length ? (
              <div className={examWhyIncorrectClass}>
                <strong>Why other answers are incorrect</strong>
                {getIncorrectOptionReasons(currentQuestion).map((item) => (
                  <div className={examWhyIncorrectItemClass} key={item.label}>
                    <span>{item.label}. {item.text}</span>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={examExplanationEmptyClass}>
            <strong>{currentQuestionAnswered ? 'Ready when you are' : 'Answer first'}</strong>
            <p>
              {currentQuestionAnswered
                ? 'Use "Show answers" to reveal the explanation for this question.'
                : 'Select an answer, then use "Show answers" when you want to review the explanation.'}
            </p>
          </div>
        )}
      </section>
    </aside>
  );
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
  const questionStartRef = useRef(null);
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
  const flaggedCount = flaggedQuestionIds.size;
  const reviewCount = bookmarkedQuestionIds.size;
  const remainingCount = Math.max(totalQuestions - answeredCount, 0);
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentQuestionAnswered = currentQuestion ? isAnswered(currentQuestion, answers[currentQuestion.id]) : false;
  const currentQuestionFlagged = currentQuestion ? flaggedQuestionIds.has(currentQuestion.id) : false;
  const currentQuestionBookmarked = currentQuestion ? bookmarkedQuestionIds.has(currentQuestion.id) : false;
  const currentQuestionRevealed = currentQuestion ? revealedAnswerIds.has(currentQuestion.id) : false;

  const examDurationSeconds = isExam ? Math.max(Number(data?.quiz?.timeLimit || 0) * 60, 0) : 0;

  useEffect(() => {
    if (!data || !currentQuestion) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    window.requestAnimationFrame(() => {
      questionStartRef.current?.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
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
    setError('');
    if (data?.mode === 'practice') {
      const saved = await practiceSave(currentIndex);
      if (!saved) return;
    }
    navigate(`/quizzes/${quizId}/practice-review?complete=1`);
  }

  async function handleSubmit() {
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
    if (!currentQuestion) return;
    setRevealedAnswerIds((current) => {
      const next = new Set(current);
      next.add(currentQuestion.id);
      return next;
    });
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
    <main className={ui.screenShell}>
      <div className={ui.quizLoadingState}>
        <div className={ui.quizLoadingSpinner} />
        <p>Preparing your quiz…</p>
      </div>
    </main>
  );

  if (!data || !currentQuestion) return (
    <main className={ui.screenShell}>
      <div className={ui.emptyBox}>Quiz unavailable.</div>
    </main>
  );

  if (!isExam) {
    return (
      <main className={examScreenShellClass}>
        <section className={examLayoutClass} style={examThemeVars}>
          <ExamModeHeader
            title={data.quiz.quizTitle}
            secondaryLabel="Mode"
            secondaryValue="Practice"
            onEndSession={finishPractice}
            saving={saving}
            theme={theme}
            workspaceLabel="Practice workspace"
            endLabel="Finish practice"
            className={practiceHeaderClass}
          />

          {error ? <div className={ui.feedbackError}>{error}</div> : null}

          <div className={examQuestionStartAnchorClass} ref={questionStartRef} aria-hidden="true" />
          <div className={cx(examGridClass, practiceGridClass)}>
            <aside className={examSidebarClass}>
              <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
                <div className={examQuestionTypeRowClass}>
                  <span className={examChipMiniClass}>{currentQuestion.questionType === 'sba' ? 'SBA' : 'T/F'}</span>
                </div>
                <div className={examCardKickerClass}>Progress</div>
                <div className={examProgressToplineClass}>
                  <strong className={examProgressCurrentClass}>Question {currentIndex + 1} of {totalQuestions}</strong>
                  <span className={examProgressPercentClass}>{progressPercent}% complete</span>
                </div>
                <div className={examProgressBarClass}>
                  <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={examProgressStatsClass}>
                  <div className={examProgressStatClass}>
                    <small>Answered</small>
                    <strong className={examProgressAnsweredClass}>{answeredCount}</strong>
                  </div>
                  <div className={examProgressStatClass}>
                    <small>Remaining</small>
                    <strong>{remainingCount}</strong>
                  </div>
                  <div className={examProgressStatClass}>
                    <small>Flagged</small>
                    <strong className={examProgressFlaggedClass}>{flaggedCount}</strong>
                  </div>
                  <div className={examProgressStatClass}>
                    <small>Review</small>
                    <strong className={examProgressReviewClass}>{reviewCount}</strong>
                  </div>
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
                  <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#FB923C]')} />Flagged</span>
                </div>

                <div className={examNavJumpsClass}>
                  <button className={examNavJumpClass}
                    type="button"
                   
                    onClick={() => firstFlaggedIndex >= 0 && goTo(firstFlaggedIndex)}
                    disabled={firstFlaggedIndex < 0}
                  >
                    <span>Jump to flagged ({flaggedCount})</span>
                    <strong>›</strong>
                  </button>
                  <button className={examNavJumpClass}
                    type="button"
                   
                    onClick={() => firstUnansweredIndex >= 0 && goTo(firstUnansweredIndex)}
                    disabled={firstUnansweredIndex < 0}
                  >
                    <span>Jump to unanswered ({remainingCount})</span>
                    <strong>›</strong>
                  </button>
                </div>

                <div className={cx(examTipCardClass, quizFlashTipClass)}>
                  <div className={examTipTitleClass}>Tip</div>
                  <p>Take your time, answer freely, and use show answers only when you want the explanation.</p>
                </div>
              </section>
            </aside>

            <section className={cx(examMainCardClass, quizFlashPanelClass)}>
              <div className={quizFlashQuestionCopyClass}>
                {currentQuestion.questionText}
              </div>

              <div className={examAnswerListClass}>
                {currentQuestion.questionType === 'sba' ? (
                  currentQuestion.options.map((option) => {
                    const isSelected = Number(answers[currentQuestion.id]) === option.id;
                    const isCorrect = Number(option.isCorrect) === 1;
                    const isSelectedWrong = currentQuestionRevealed && isSelected && !isCorrect;

                    return (
                    <label className={cx(
                        examAnswerCardClass,
                        quizFlashAnswerCardClass,
                        isSelected && examAnswerSelectedClass,
                        isSelected && quizFlashSelectedAnswerClass,
                        currentQuestionRevealed && isCorrect && examAnswerCorrectClass,
                        isSelectedWrong && examAnswerWrongClass
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
                          examAnswerRadioClass,
                          isSelected && examAnswerRadioSelectedClass,
                          currentQuestionRevealed && isCorrect && examAnswerRadioCorrectClass,
                          isSelectedWrong && examAnswerRadioWrongClass
                        )} aria-hidden="true" />
                        <span className={examAnswerCopyClass}>{option.optionText}</span>
                      </span>
                    </label>
                    );
                  })
                ) : (
                  currentQuestion.options.map((option) => (
                    <div className={cx(examTfCardClass, quizFlashAnswerCardClass, currentQuestionRevealed && option.isCorrect === 1 && examAnswerCorrectClass)} key={option.id}>
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
                      {currentQuestionRevealed ? (
                        <div className={cx(examTfRevealClass, Number(option.isCorrect) === 1 ? examTfRevealTrueClass : examTfRevealFalseClass)}>
                          Correct answer: {Number(option.isCorrect) === 1 ? 'True' : 'False'}
                        </div>
                      ) : null}
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

                  <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass)}
                    type="button"
                   
                    onClick={revealCurrentAnswer}
                    disabled={currentQuestionRevealed}
                  >
                    {currentQuestionRevealed ? 'Answers shown' : 'Show answers'}
                  </button>

                  <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass, currentQuestionFlagged && examFooterFlagActiveClass)}
                    type="button"
                   
                    onClick={toggleFlagCurrentQuestion}
                  >
                    {currentQuestionFlagged ? 'Flagged' : 'Flag question'}
                  </button>
                </div>

                {currentIndex < totalQuestions - 1 ? (
                  <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                    type="button"
                   
                    onClick={() => goTo(currentIndex + 1)}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Next'}
                  </button>
                ) : (
                  <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                    type="button"
                   
                    onClick={finishPractice}
                    disabled={saving}
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
              currentQuestionFlagged={currentQuestionFlagged}
              currentQuestionBookmarked={currentQuestionBookmarked}
            />
          </div>

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
        </section>
      </main>
    );
  }

  return (
    <main className={examScreenShellClass}>
      <section className={examLayoutClass} style={examThemeVars}>
        <ExamModeHeader
          title={data.quiz.quizTitle}
          secondaryValue={formatDuration(secondsRemaining)}
          onEndSession={handleSubmit}
          saving={saving}
          theme={theme}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={examQuestionStartAnchorClass} ref={questionStartRef} aria-hidden="true" />
        <div className={examGridClass}>
          <aside className={examSidebarClass}>
            <section className={cx(examPanelClass, examProgressPanelClass, quizFlashPanelClass)}>
              <div className={examQuestionTypeRowClass}>
                <span className={examChipMiniClass}>{currentQuestion.questionType === 'sba' ? 'SBA' : 'T/F'}</span>
              </div>
              <div className={examCardKickerClass}>Progress</div>
              <div className={examProgressToplineClass}>
                <strong className={examProgressCurrentClass}>Question {currentIndex + 1} of {totalQuestions}</strong>
                <span className={examProgressPercentClass}>{progressPercent}% complete</span>
              </div>
              <div className={examProgressBarClass}>
                <span className={examProgressFillClass} style={{ width: `${progressPercent}%` }} />
              </div>
              <div className={examProgressStatsClass}>
                <div className={examProgressStatClass}>
                  <small>Answered</small>
                  <strong className={examProgressAnsweredClass}>{answeredCount}</strong>
                </div>
                <div className={examProgressStatClass}>
                  <small>Remaining</small>
                  <strong>{remainingCount}</strong>
                </div>
                <div className={examProgressStatClass}>
                  <small>Flagged</small>
                  <strong className={examProgressFlaggedClass}>{flaggedCount}</strong>
                </div>
                <div className={examProgressStatClass}>
                  <small>Review</small>
                  <strong className={examProgressReviewClass}>{reviewCount}</strong>
                </div>
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
                <span className={examNavLegendItemClass}><i className={cx(examNavLegendDotClass, 'bg-[#FB923C]')} />Flagged</span>
              </div>

              <div className={examNavJumpsClass}>
                <button className={examNavJumpClass}
                  type="button"
                 
                  onClick={() => firstFlaggedIndex >= 0 && goTo(firstFlaggedIndex)}
                  disabled={firstFlaggedIndex < 0}
                >
                  <span>Jump to flagged ({flaggedCount})</span>
                  <strong>›</strong>
                </button>
                <button className={examNavJumpClass}
                  type="button"
                 
                  onClick={() => firstUnansweredIndex >= 0 && goTo(firstUnansweredIndex)}
                  disabled={firstUnansweredIndex < 0}
                >
                  <span>Jump to unanswered ({remainingCount})</span>
                  <strong>›</strong>
                </button>
              </div>

              <div className={cx(examTipCardClass, quizFlashTipClass)}>
                <div className={examTipTitleClass}>Tip</div>
                <p>Read the question carefully and choose the single best answer.</p>
              </div>
            </section>
          </aside>

          <section className={cx(examMainCardClass, quizFlashPanelClass)}>
            <div className={quizFlashQuestionCopyClass}>
              {currentQuestion.questionText}
            </div>

            <div className={examAnswerListClass}>
              {currentQuestion.questionType === 'sba' ? (
                currentQuestion.options.map((option) => {
                  const isSelected = Number(answers[currentQuestion.id]) === option.id;

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
                      <span className={cx(examAnswerRadioClass, isSelected && examAnswerRadioSelectedClass)} aria-hidden="true" />
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
                <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass)}
                  type="button"
                 
                  onClick={() => goTo(Math.min(currentIndex + 1, totalQuestions - 1))}
                  disabled={currentIndex >= totalQuestions - 1 || saving}
                >
                  Skip
                </button>
                <button className={cx(examFooterButtonClass, quizFlashFooterButtonClass, currentQuestionFlagged && examFooterFlagActiveClass)}
                  type="button"
                 
                  onClick={toggleFlagCurrentQuestion}
                >
                  {currentQuestionFlagged ? 'Flagged' : 'Flag question'}
                </button>
              </div>

              <button className={cx(examFooterButtonClass, examFooterNextClass, quizFlashFooterButtonClass, quizFlashNextButtonClass)}
                type="button"
               
                onClick={currentIndex < totalQuestions - 1 ? () => goTo(currentIndex + 1) : handleSubmit}
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
              currentQuestionFlagged={currentQuestionFlagged}
              currentQuestionBookmarked={currentQuestionBookmarked}
            />
        </div>

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
      </section>
    </main>
  );
}
