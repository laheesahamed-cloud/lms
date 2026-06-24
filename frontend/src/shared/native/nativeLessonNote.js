// Bridge to the native Swift lesson note + Apple Pencil ink canvas (iOS only).
//
// Tapping a lesson in the Study → Lessons list (the course → lesson flow) opens
// a fully native screen on iOS. The native side fetches the note itself, so we
// hand it the auth token + API base URL. On web/Android this is unavailable and
// callers fall back to their no-op (the list stays inert there).

import { getAuthToken } from '../stores/authToken.js';
import { API_BASE_URL } from '../api/client.js';

// The native message handler is only registered by the iOS Capacitor shell.
export function isNativeLessonNoteAvailable() {
  return typeof window !== 'undefined'
    && !!window.webkit?.messageHandlers?.lmsOpenLessonNote;
}

function isDarkTheme() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// note: a row from the AI-notes list (has id, lessonId, title, engine).
export function openNativeLessonNote(note) {
  const handler = window.webkit?.messageHandlers?.lmsOpenLessonNote;
  if (!handler) return false;
  handler.postMessage({
    aiNoteId: Number(note?.id || 0),
    lessonId: Number(note?.lessonId || 0),
    title: note?.title || note?.lessonTitle || 'Lesson',
    engine: note?.engine || 'gemini',
    token: getAuthToken() || '',
    apiBaseUrl: API_BASE_URL || '',
    dark: isDarkTheme(),
  });
  return true;
}
