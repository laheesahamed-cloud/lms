import { useEffect } from 'react';
import { detectPlatform } from '../platform/detect.js';

let secureContentConsumers = 0;
let secureContentEnabled = false;
let secureContentRetryTimer = 0;
const SCREEN_PROTECTION_PAUSED = true;

function postNativeSecureContentState(active) {
  if (typeof window === 'undefined') return false;

  const handler = window.webkit?.messageHandlers?.lmsSecureContent;
  if (!handler || typeof handler.postMessage !== 'function') return false;

  try {
    handler.postMessage({ active });
    return true;
  } catch {
    return false;
  }
}

async function enableSecureContentMode() {
  secureContentConsumers += 1;
  if (secureContentEnabled) return;

  secureContentEnabled = true;

  let attempts = 0;
  const sendEnable = () => {
    attempts += 1;
    if (!secureContentEnabled || postNativeSecureContentState(true) || attempts >= 24) {
      window.clearInterval(secureContentRetryTimer);
      secureContentRetryTimer = 0;
    }
  };

  sendEnable();
  if (typeof window !== 'undefined' && secureContentRetryTimer === 0 && attempts < 24) {
    secureContentRetryTimer = window.setInterval(sendEnable, 125);
  }
}

async function disableSecureContentMode() {
  secureContentConsumers = Math.max(0, secureContentConsumers - 1);
  if (secureContentConsumers > 0 || !secureContentEnabled) return;

  if (typeof window !== 'undefined') {
    window.clearInterval(secureContentRetryTimer);
  }
  secureContentRetryTimer = 0;
  postNativeSecureContentState(false);
  secureContentEnabled = false;
}

function normalizeSecurePath(pathname = '') {
  return pathname.replace(/^\/(?:app|student)(?=\/|$)/, '') || '/';
}

export function isSecureContentRoute(location) {
  const pathname = normalizeSecurePath(location?.pathname || '');
  const params = new URLSearchParams(location?.search || '');
  const state = location?.state || {};
  const quizIdSegment = '(?!new(?:/|$))[^/]+';

  const isQuizTaking = new RegExp(`^/quizzes/${quizIdSegment}/?$`).test(pathname);
  const isExamTaking = new RegExp(`^/exams/${quizIdSegment}/?$`).test(pathname);
  const isPracticeReview = new RegExp(`^/quizzes/${quizIdSegment}/practice-review/?$`).test(pathname);
  const isAttemptReview = /^\/review\/[^/]+\/?$/.test(pathname);
  const isStudentNotes = /^\/notes\/?$/.test(pathname);
  const isAiNotesList = /^\/ai-notes\/?$/.test(pathname);
  const isLessonNote = /^\/study\/lesson\/[^/]+\/?$/.test(pathname);
  const isAiNote = /^\/ai-notes\/[^/]+\/?$/.test(pathname);
  const isQuizLinkedNote =
    (isLessonNote || isAiNote) &&
    (
      params.get('secureQuiz') === '1' ||
      params.get('secureQuizMode') === '1' ||
      state.secureQuizMode === true ||
      state.fromSecureQuiz === true
    );

  return (
    isQuizTaking ||
    isExamTaking ||
    isPracticeReview ||
    isAttemptReview ||
    isStudentNotes ||
    isAiNotesList ||
    isLessonNote ||
    isAiNote ||
    isQuizLinkedNote
  );
}

export function useSecureContentMode(active) {
  useEffect(() => {
    if (SCREEN_PROTECTION_PAUSED) {
      void disableSecureContentMode();
      return undefined;
    }

    const platform = detectPlatform();
    if (!active || !platform.isNative) return undefined;

    void enableSecureContentMode();
    return () => {
      void disableSecureContentMode();
    };
  }, [active]);
}
