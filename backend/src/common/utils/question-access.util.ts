import { Pool, RowDataPacket } from 'mysql2/promise';

/**
 * May this student read content about this question?
 *
 * A question has no price of its own — it is reachable through the quizzes that
 * contain it — so it follows the same rule as opening one of those quizzes:
 * free quiz, or a current subscription that covers the quiz's course. This
 * mirrors QuizAttemptsService.canAccessQuiz; it lives here so the recap and
 * bookmark paths can ask the question without importing that service.
 */
export async function studentCanReadQuestion(db: Pool, userId: number, questionId: number) {
  const [questionRows] = await db.execute<RowDataPacket[]>(
    "SELECT course_id FROM questions WHERE id = ? AND status = 'active' LIMIT 1",
    [questionId]
  );
  if (!questionRows.length) return false;

  const [quizRows] = await db.execute<RowDataPacket[]>(
    `SELECT q.course_id, q.is_free
       FROM question_quizzes qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id AND q.status = 'active'
      WHERE qq.question_id = ?`,
    [questionId]
  );
  if (quizRows.some((row) => Number(row.is_free) === 1)) return true;

  // Courses this question is reachable through: the quizzes that list it, and
  // its own course — dynamic quizzes draw from the question bank by course
  // rather than through question_quizzes, so the question's own course counts.
  const reachableCourses = new Set<number>(quizRows.map((row) => Number(row.course_id)));
  if (questionRows[0].course_id) reachableCourses.add(Number(questionRows[0].course_id));

  const access = await loadStudentCourseAccess(db, userId);
  if (access.full) return true;
  return [...reachableCourses].some((id) => access.courseIds.has(id));
}

/** What the student's current plans unlock: everything, or a set of courses. */
export async function loadStudentCourseAccess(db: Pool, userId: number) {
  const [subs] = await db.execute<RowDataPacket[]>(
    `SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
      WHERE us.user_id = ?
        AND us.status = 'active'
        AND us.start_date <= CURDATE()
        AND us.end_date >= CURDATE()
        AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())`,
    [userId]
  );
  if (!subs.length) return { full: false, courseIds: new Set<number>() };

  const courseIds = new Set<number>();
  let full = false;
  for (const row of subs) {
    let ids: number[] = [];
    try {
      const parsed = row.course_ids_json ? JSON.parse(String(row.course_ids_json)) : [];
      ids = Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    } catch { ids = []; }

    const slug = String(row.plan_slug || '').trim();
    const scope = slug.startsWith('custom-single-') || slug.startsWith('custom-multi-') || slug === 'single-course-3m'
      ? 'courses'
      : row.access_scope || (ids.length ? 'courses' : 'all');

    if (scope === 'all' && ids.length === 0) full = true;
    if (scope === 'courses') ids.forEach((id) => courseIds.add(id));
  }
  return { full, courseIds };
}
