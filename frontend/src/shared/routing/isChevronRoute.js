// Single source of truth for "chevron pages" — student detail/deep routes that
// render a back chevron in AppHeader. Both the header (which chevron/compact
// treatment to use) and the native push/pop route transition (whether to slide)
// consume this so the two never drift.
//
// Two buckets:
//  - FOCUS routes: immersive/reader pages (quiz, review, ai-notes reader,
//    lesson) — compact bar only, no large title.
//  - COMPACT-PROP pages: top-level study tools + detail pages that opt into the
//    fixed compact bar via the AppHeader `compact` prop (course detail, results
//    detail, ai-notes list, planner, flashcards).

// Immersive/reader routes (kept in sync with AppShell focus flags).
export const FOCUS_HEADER_PATTERNS = [
  /^\/(?:app\/)?quizzes\/[^/]+$/, // taking a quiz/exam
  /^\/(?:app\/)?quizzes\/[^/]+\/practice-review$/,
  /^\/(?:app\/)?review\/[^/]+$/,
  /^\/(?:app\/|admin\/)?ai-notes\/[^/]+$/, // AI-notes reader
  /^\/(?:app\/)?study\/lesson\/[^/]+$/,
];

// Detail/sub pages and study tools that show a back chevron (compact bar).
const CHEVRON_PATTERNS = [
  ...FOCUS_HEADER_PATTERNS,
  /^\/(?:app\/)?courses\/[^/]+$/, // course detail
  /^\/(?:app\/)?results\/[^/]+$/, // result detail
  /^\/(?:app\/)?ai-notes\/?$/, // AI notes list (compact)
  /^\/(?:app\/)?planner\/?$/, // planner (compact)
  /^\/(?:app\/)?flashcards\/?$/, // flashcards (compact)
];

export function headerRouteIsFocus(pathname) {
  return FOCUS_HEADER_PATTERNS.some((re) => re.test(pathname));
}

// True when the route shows a back chevron — i.e. a page the native transition
// should slide in/out (push when entering one, pop when leaving one).
export function isChevronRoute(pathname) {
  if (!pathname) return false;
  return CHEVRON_PATTERNS.some((re) => re.test(pathname));
}
