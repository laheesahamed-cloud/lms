"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContentAccess = buildContentAccess;
exports.canOpenLesson = canOpenLesson;
function ids(raw) {
    try {
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    }
    catch {
        return [];
    }
}
function buildContentAccess(rows) {
    const access = {
        paid: rows.length > 0, full: false, courseIds: new Set(), lessonIds: new Set(), quizFull: false, quizCourseIds: new Set(),
    };
    for (const row of rows) {
        const courseIds = ids(row.course_ids_json);
        const lessonIds = ids(row.lesson_ids_json);
        const slug = String(row.plan_slug || '').trim();
        const fixedCourses = slug.startsWith('custom-single-') || slug.startsWith('custom-multi-') || slug === 'single-course-3m';
        const lessonScope = fixedCourses ? 'courses' : row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
        if (lessonScope === 'all' && !courseIds.length && !lessonIds.length)
            access.full = true;
        else if (lessonScope === 'courses')
            courseIds.forEach((id) => access.courseIds.add(id));
        else if (lessonScope === 'lessons')
            lessonIds.forEach((id) => access.lessonIds.add(id));
        const quizScope = fixedCourses ? 'courses' : row.access_scope || (courseIds.length ? 'courses' : 'all');
        if (quizScope === 'all' && !courseIds.length)
            access.quizFull = true;
        else if (quizScope === 'courses')
            courseIds.forEach((id) => access.quizCourseIds.add(id));
    }
    return access;
}
function canOpenLesson(a, lesson, appOnlyBlocked = false) {
    if (lesson.isFree)
        return true;
    if (appOnlyBlocked)
        return false;
    if (!a.paid)
        return false;
    return a.full || a.courseIds.has(lesson.courseId) || a.lessonIds.has(lesson.id);
}
//# sourceMappingURL=content-access.js.map