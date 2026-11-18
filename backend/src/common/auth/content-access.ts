/**
 * Who may open which lesson / quiz, from the student's active subscription
 * scope rows (carried in the signed token, else read by user id). The same
 * rules the lessons, courses and quiz services apply, in one place for the
 * shared catalogue (OPTIMIZE 10 step 5): progress reply and flashcard decks.
 */
export type ScopeRowLike = {
  plan_slug: string | null;
  access_scope: string | null;
  course_ids_json: string | null;
  lesson_ids_json?: string | null;
};

export type ContentAccess = {
  paid: boolean;
  full: boolean;
  courseIds: Set<number>;
  lessonIds: Set<number>;
  quizFull: boolean;
  quizCourseIds: Set<number>;
};

function ids(raw: string | null | undefined) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

export function buildContentAccess(rows: ScopeRowLike[]): ContentAccess {
  const access: ContentAccess = {
    paid: rows.length > 0, full: false, courseIds: new Set(), lessonIds: new Set(), quizFull: false, quizCourseIds: new Set(),
  };
  for (const row of rows) {
    const courseIds = ids(row.course_ids_json);
    const lessonIds = ids(row.lesson_ids_json);
    const slug = String(row.plan_slug || '').trim();
    const fixedCourses = slug.startsWith('custom-single-') || slug.startsWith('custom-multi-') || slug === 'single-course-3m';
    const lessonScope = fixedCourses ? 'courses' : row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
    if (lessonScope === 'all' && !courseIds.length && !lessonIds.length) access.full = true;
    else if (lessonScope === 'courses') courseIds.forEach((id) => access.courseIds.add(id));
    else if (lessonScope === 'lessons') lessonIds.forEach((id) => access.lessonIds.add(id));
    const quizScope = fixedCourses ? 'courses' : row.access_scope || (courseIds.length ? 'courses' : 'all');
    if (quizScope === 'all' && !courseIds.length) access.quizFull = true;
    else if (quizScope === 'courses') courseIds.forEach((id) => access.quizCourseIds.add(id));
  }
  return access;
}

/** Free, or (not blocked as website-only premium) full access / course / lesson in the plan. */
export function canOpenLesson(a: ContentAccess, lesson: { id: number; courseId: number; isFree: boolean }, appOnlyBlocked = false) {
  if (lesson.isFree) return true;
  if (appOnlyBlocked) return false;
  if (!a.paid) return false;
  return a.full || a.courseIds.has(lesson.courseId) || a.lessonIds.has(lesson.id);
}
