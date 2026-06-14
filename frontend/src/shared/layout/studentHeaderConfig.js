// Per-route default header descriptors for the persistent student app-shell
// header bar. These mirror the props each student page passes to <AppHeader> so
// the shell bar renders the correct title/subtitle/mode INSTANTLY on a hard
// refresh — before the lazy page chunk loads and registers its (possibly
// dynamic) descriptor. Routes NOT listed here return null, meaning "no shell
// bar" (immersive/reader/quiz/review/result-detail/profile keep their own
// chrome, exactly as before).

const STUDENT_HEADER_ROUTES = [
  { re: /^\/(?:app\/)?dashboard\/?$/, title: 'Study Hub', subtitle: 'Daily Focus' },
  { re: /^\/(?:app\/)?courses\/?$/, title: 'Courses', subtitle: 'Study Library' },
  { re: /^\/(?:app\/)?courses\/[^/]+\/?$/, title: 'Course', subtitle: 'Summary', compact: true },
  { re: /^\/(?:app\/)?quizzes\/?$/, title: 'Q-Bank', subtitle: 'Practice question sets' },
  { re: /^\/(?:app\/)?exams\/?$/, title: 'Exams', subtitle: 'Timed exam sets' },
  { re: /^\/(?:app\/)?results\/?$/, title: 'Results', subtitle: 'Performance' },
  { re: /^\/(?:app\/)?ai-notes\/?$/, title: 'Lessons', subtitle: 'Lesson Notes', compact: true },
  { re: /^\/(?:app\/)?flashcards\/?$/, title: 'Flashcards', subtitle: 'Spaced Review', compact: true },
  { re: /^\/(?:app\/)?planner\/?$/, title: 'Planner', subtitle: 'Study schedule', compact: true },
  { re: /^\/(?:app\/)?notes\/?$/, title: 'Notes', subtitle: 'Study Notebook' },
  { re: /^\/(?:app\/)?bookmarks\/?$/, title: 'Saved', subtitle: 'Bookmarks' },
  { re: /^\/(?:app\/)?subscriptions\/checkout\/[^/]+\/?$/, title: 'Checkout', subtitle: 'Plan Access', back: true, backTo: '/app/subscriptions' },
  { re: /^\/(?:app\/)?subscriptions\/?$/, title: 'Subscriptions' },
  { re: /^\/(?:app\/)?notifications\/?$/, title: 'Notifications', subtitle: 'Message Inbox' },
  { re: /^\/(?:app\/)?study\/?$/, title: 'Study', subtitle: 'AI notes and study canvas' },
];

// Returns the default header descriptor for a student route, or null when the
// route should not show the shell header bar.
export function resolveStudentHeader(pathname = '') {
  const match = STUDENT_HEADER_ROUTES.find((entry) => entry.re.test(pathname));
  if (!match) return null;
  const { re, ...descriptor } = match;
  return descriptor;
}
