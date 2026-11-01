"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentCanReadQuestion = studentCanReadQuestion;
exports.loadStudentCourseAccess = loadStudentCourseAccess;
async function studentCanReadQuestion(db, userId, questionId) {
    const [questionRows] = await db.execute("SELECT course_id FROM questions WHERE id = ? AND status = 'active' LIMIT 1", [questionId]);
    if (!questionRows.length)
        return false;
    const [quizRows] = await db.execute(`SELECT q.course_id, q.is_free
       FROM question_quizzes qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id AND q.status = 'active'
      WHERE qq.question_id = ?`, [questionId]);
    if (quizRows.some((row) => Number(row.is_free) === 1))
        return true;
    const reachableCourses = new Set(quizRows.map((row) => Number(row.course_id)));
    if (questionRows[0].course_id)
        reachableCourses.add(Number(questionRows[0].course_id));
    const access = await loadStudentCourseAccess(db, userId);
    if (access.full)
        return true;
    return [...reachableCourses].some((id) => access.courseIds.has(id));
}
async function loadStudentCourseAccess(db, userId) {
    const [subs] = await db.execute(`SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
      WHERE us.user_id = ?
        AND us.status = 'active'
        AND us.start_date <= CURDATE()
        AND us.end_date >= CURDATE()
        AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())`, [userId]);
    if (!subs.length)
        return { full: false, courseIds: new Set() };
    const courseIds = new Set();
    let full = false;
    for (const row of subs) {
        let ids = [];
        try {
            const parsed = row.course_ids_json ? JSON.parse(String(row.course_ids_json)) : [];
            ids = Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
        }
        catch {
            ids = [];
        }
        const slug = String(row.plan_slug || '').trim();
        const scope = slug.startsWith('custom-single-') || slug.startsWith('custom-multi-') || slug === 'single-course-3m'
            ? 'courses'
            : row.access_scope || (ids.length ? 'courses' : 'all');
        if (scope === 'all' && ids.length === 0)
            full = true;
        if (scope === 'courses')
            ids.forEach((id) => courseIds.add(id));
    }
    return { full, courseIds };
}
//# sourceMappingURL=question-access.util.js.map