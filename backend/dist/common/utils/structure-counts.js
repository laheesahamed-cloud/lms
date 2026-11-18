"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountFixBusyError = exports.FIX_REQUEST_ROW_BUDGET = exports.COUNTED_LESSON = void 0;
exports.isCountedLesson = isCountedLesson;
exports.bumpCounts = bumpCounts;
exports.moveLessonCounts = moveLessonCounts;
exports.recountStructure = recountStructure;
exports.checkStructureCounts = checkStructureCounts;
exports.startCountFix = startCountFix;
exports.runCountFixSet = runCountFixSet;
exports.finishCountFix = finishCountFix;
exports.COUNTED_LESSON = "is_public = 1 AND engine_key = 'gemini'";
function isCountedLesson(row) {
    return Boolean(row) && Number(row.is_public) === 1 && String(row.engine_key ?? 'gemini') === 'gemini';
}
async function bumpCounts(conn, table, column, changes) {
    const byId = new Map();
    for (const [id, delta] of changes) {
        if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0 || !delta)
            continue;
        byId.set(Number(id), (byId.get(Number(id)) || 0) + delta);
    }
    const entries = [...byId.entries()].filter(([, d]) => d !== 0).sort((a, b) => a[0] - b[0]);
    if (!entries.length)
        return;
    const cases = entries.map(() => 'WHEN ? THEN ?').join(' ');
    const params = [];
    for (const [id, d] of entries)
        params.push(id, d);
    for (const [id] of entries)
        params.push(id);
    await conn.execute(`UPDATE ${table} SET ${column} = GREATEST(CAST(${column} AS SIGNED) + (CASE id ${cases} ELSE 0 END), 0)
     WHERE id IN (${entries.map(() => '?').join(', ')})`, params);
}
async function moveLessonCounts(conn, before, after) {
    const n = (v) => (v == null || v === '' ? null : Number(v));
    const courseChanges = [];
    const subjectChanges = [];
    if (before.counted) {
        courseChanges.push([n(before.course_id), -1]);
        subjectChanges.push([n(before.topic_id), -1]);
    }
    if (after.counted) {
        courseChanges.push([n(after.course_id), 1]);
        subjectChanges.push([n(after.topic_id), 1]);
    }
    await bumpCounts(conn, 'topics', 'lesson_count', subjectChanges);
    await bumpCounts(conn, 'courses', 'lesson_count', courseChanges);
}
async function recountStructure(db) {
    await db.execute(`
    UPDATE courses c
    SET c.lesson_count = (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.is_public = 1 AND l.engine_key = 'gemini')`);
    await db.execute(`
    UPDATE courses c
    SET c.subject_count = (SELECT COUNT(*) FROM topics t WHERE t.course_id = c.id)`);
    await db.execute(`
    UPDATE topics t
    SET t.lesson_count = (SELECT COUNT(*) FROM lessons l WHERE l.topic_id = t.id AND l.engine_key = 'gemini' AND l.is_public = 1)`);
    await db.execute(`
    UPDATE topics t
    SET t.subtopic_count = (SELECT COUNT(*) FROM subtopics s WHERE s.topic_id = t.id)`);
}
async function checkStructureCounts(db) {
    const [rows] = await db.query(`
    SELECT c.id, c.course_title, c.lesson_count, c.subject_count,
           COALESCE(SUM(t.lesson_count), 0) AS subjects_lessons, COUNT(t.id) AS subjects
    FROM courses c LEFT JOIN topics t ON t.course_id = c.id
    GROUP BY c.id, c.course_title, c.lesson_count, c.subject_count`);
    const issues = [];
    for (const r of rows) {
        if (Number(r.lesson_count) !== Number(r.subjects_lessons)) {
            issues.push({ level: 'course', id: Number(r.id), name: r.course_title, field: 'lesson_count', stored: Number(r.lesson_count), actual: Number(r.subjects_lessons) });
        }
        if (Number(r.subject_count) !== Number(r.subjects)) {
            issues.push({ level: 'course', id: Number(r.id), name: r.course_title, field: 'subject_count', stored: Number(r.subject_count), actual: Number(r.subjects) });
        }
    }
    return issues;
}
exports.FIX_REQUEST_ROW_BUDGET = 980;
class CountFixBusyError extends Error {
}
exports.CountFixBusyError = CountFixBusyError;
let fixRun = null;
let cooldownUntil = 0;
const FIX_RUN_IDLE_MS = 60_000;
function cooldownMs() {
    const v = Number(process.env.FIX_COUNTS_COOLDOWN_MS);
    return Number.isFinite(v) && v >= 0 ? v : 60_000;
}
function touchRun(runId) {
    if (!fixRun || fixRun.id !== runId || fixRun.expiresAt < Date.now()) {
        throw new CountFixBusyError('This fix has expired or another one is running. Start again.');
    }
    fixRun.expiresAt = Date.now() + FIX_RUN_IDLE_MS;
    return fixRun;
}
async function countSet(db, subjectIds) {
    const ids = [...new Set(subjectIds.map(Number).filter((v) => Number.isInteger(v) && v > 0))].slice(0, 1000);
    if (!ids.length)
        return { fixed: [], changed: [], courseLessons: {}, rowsRead: 0 };
    const [rows] = await db.query(`SELECT t.id, t.course_id, t.topic_name, t.lesson_count, t.subtopic_count, t.quiz_total, t.quiz_active,
       (SELECT COUNT(*) FROM lessons l FORCE INDEX (idx_lessons_topic_engine_pub_sort)
         WHERE l.topic_id = t.id AND l.is_public = 1 AND l.engine_key = 'gemini') AS real_lessons,
       (SELECT COUNT(*) FROM subtopics s FORCE INDEX (unique_topic_subtopic) WHERE s.topic_id = t.id) AS real_topics,
       -- Both assessment numbers from one pass over this subject's own index
       -- range ("total:active"). A grouped join over the whole set made
       -- MariaDB scan every assessment, general ones included, in each set.
       (SELECT CONCAT(COUNT(*), ':', COALESCE(SUM(q.status = 'active'), 0))
         FROM quizzes q FORCE INDEX (idx_quizzes_topic_general)
         WHERE q.topic_id = t.id AND q.is_general = 0) AS quiz_counts
     FROM topics t FORCE INDEX (PRIMARY) WHERE t.id IN (?)`, [ids]);
    const fixed = [];
    const changed = [];
    const courseLessons = {};
    let rowsRead = rows.length;
    for (const r of rows) {
        const [quizTotal, quizActive] = String(r.quiz_counts || '0:0').split(':').map(Number);
        r.real_quiz_total = quizTotal;
        r.real_quiz_active = quizActive;
        const id = Number(r.id);
        const realLessons = Number(r.real_lessons);
        const realTopics = Number(r.real_topics);
        rowsRead += realLessons + realTopics + Number(r.real_quiz_total);
        courseLessons[Number(r.course_id)] = (courseLessons[Number(r.course_id)] || 0) + realLessons;
        for (const [field, actual] of [
            ['lesson_count', realLessons], ['subtopic_count', realTopics],
            ['quiz_total', Number(r.real_quiz_total)], ['quiz_active', Number(r.real_quiz_active)],
        ]) {
            const before = Number(r[field]);
            if (before === actual)
                continue;
            const issue = { level: 'subject', id, name: r.topic_name, field, stored: before, actual };
            const [res] = await db.execute(`UPDATE topics SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, before]);
            (res.affectedRows ? fixed : changed).push(issue);
        }
    }
    return { fixed, changed, courseLessons, rowsRead };
}
async function finishCourses(db, totals) {
    await db.execute('UPDATE quizzes SET content_stamp = content_stamp + 1');
    const list = totals.filter((t) => Number.isInteger(Number(t.id)) && Number(t.id) > 0).slice(0, 1000);
    const ids = list.map((t) => Number(t.id));
    const fixed = [];
    const changed = [];
    if (!ids.length)
        return { fixed, changed };
    const [courses] = await db.query(`SELECT c.id, c.course_title, c.lesson_count, c.subject_count,
       c.quiz_general_total, c.quiz_general_active, c.quiz_unfiled_total, c.quiz_unfiled_active, c.quiz_total,
       COALESCE(g.total, 0) AS real_general_total, COALESCE(g.active, 0) AS real_general_active,
       COALESCE(u.total, 0) AS real_unfiled_total, COALESCE(u.active, 0) AS real_unfiled_active,
       -- Subject rows and their (already fixed) assessment counts, one pass:
       -- "subjects:assessments". Same rows as counting the subjects alone.
       (SELECT CONCAT(COUNT(*), ':', COALESCE(SUM(t.quiz_total), 0))
         FROM topics t FORCE INDEX (fk_topics_course) WHERE t.course_id = c.id) AS subject_counts,
       (SELECT COUNT(*) FROM lessons l FORCE INDEX (fk_lessons_topic)
         WHERE l.topic_id IS NULL AND l.course_id = c.id AND l.is_public = 1 AND l.engine_key = 'gemini') AS loose_lessons
     FROM courses c
     LEFT JOIN (
       -- General assessments, one pass, both numbers (index only).
       SELECT course_id, COUNT(*) AS total, SUM(status = 'active') AS active
       FROM quizzes FORCE INDEX (idx_quizzes_course_general)
       WHERE course_id IN (?) AND is_general = 1 GROUP BY course_id
     ) g ON g.course_id = c.id
     LEFT JOIN (
       -- Assessments with no subject (usually none).
       SELECT course_id, COUNT(*) AS total, SUM(status = 'active') AS active
       FROM quizzes FORCE INDEX (idx_quizzes_topic_general)
       WHERE topic_id IS NULL AND is_general = 0 AND course_id IN (?) GROUP BY course_id
     ) u ON u.course_id = c.id
     WHERE c.id IN (?)`, [ids, ids, ids]);
    for (const c of courses) {
        const id = Number(c.id);
        const t = list.find((x) => Number(x.id) === id);
        const [realSubjects, subjectQuizzes] = String(c.subject_counts || '0:0').split(':').map(Number);
        c.real_subjects = realSubjects;
        const checks = [
            ['lesson_count', Number(t.lessons || 0) + Number(c.loose_lessons || 0), Number(t.expectedLessons)],
            ['subject_count', Number(c.real_subjects || 0), Number(t.expectedSubjects)],
        ];
        for (const [field, actual, expected] of checks) {
            const now = Number(c[field]);
            if (now === actual)
                continue;
            const issue = { level: 'course', id, name: c.course_title, field, stored: now, actual };
            if (now !== expected) {
                changed.push(issue);
                continue;
            }
            const [res] = await db.execute(`UPDATE courses SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, now]);
            (res.affectedRows ? fixed : changed).push(issue);
        }
        for (const [field, actual] of [
            ['quiz_general_total', Number(c.real_general_total)], ['quiz_general_active', Number(c.real_general_active)],
            ['quiz_unfiled_total', Number(c.real_unfiled_total)], ['quiz_unfiled_active', Number(c.real_unfiled_active)],
            ['quiz_total', subjectQuizzes + Number(c.real_general_total) + Number(c.real_unfiled_total)],
        ]) {
            const now = Number(c[field]);
            if (now === actual)
                continue;
            const issue = { level: 'course', id, name: c.course_title, field, stored: now, actual };
            const [res] = await db.execute(`UPDATE courses SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, now]);
            (res.affectedRows ? fixed : changed).push(issue);
        }
    }
    return { fixed, changed };
}
function packSets(subjects, planRows, finishRows) {
    const B = exports.FIX_REQUEST_ROW_BUDGET;
    const total = subjects.reduce((t, s) => t + s.weight, 0);
    const sorted = [...subjects].sort((a, b) => b.weight - a.weight);
    for (let n = Math.max(1, Math.ceil((total + planRows + finishRows) / B)); n <= subjects.length + 1; n += 1) {
        const room = Array.from({ length: n }, (_, i) => B - (i === 0 ? planRows : 0) - (i === n - 1 ? finishRows : 0));
        const bins = Array.from({ length: n }, () => []);
        let ok = true;
        for (const s of sorted) {
            let i = room.findIndex((r) => r >= s.weight);
            if (i < 0) {
                if (bins.every((bin) => bin.length)) {
                    ok = false;
                    break;
                }
                i = bins.findIndex((bin) => !bin.length);
            }
            bins[i].push(s.id);
            room[i] -= s.weight;
        }
        if (ok) {
            const keep = bins.map((bin, i) => ({ bin, room: room[i], i })).filter((x) => x.bin.length || x.i === 0);
            const last = keep[keep.length - 1];
            return { sets: keep.map((x) => x.bin), finishFitsLast: last.i === n - 1 || last.room >= finishRows };
        }
    }
    return { sets: [subjects.map((s) => s.id)], finishFitsLast: false };
}
function endRun() {
    fixRun = null;
    cooldownUntil = Date.now() + cooldownMs();
}
async function startCountFix(db, courseId) {
    if (fixRun && fixRun.expiresAt > Date.now())
        throw new CountFixBusyError('Fix counts is already running.');
    if (cooldownUntil > Date.now()) {
        throw new CountFixBusyError(`Fix counts ran a moment ago. Try again in ${Math.ceil((cooldownUntil - Date.now()) / 1000)} s.`);
    }
    const [rows] = await db.query(`SELECT c.id AS course_id, c.course_title, c.lesson_count, c.subject_count,
            c.quiz_general_total, c.quiz_unfiled_total,
            t.id AS subject_id, t.lesson_count AS subject_lessons, t.subtopic_count AS subject_topics, t.quiz_total AS subject_quizzes
     FROM courses c LEFT JOIN topics t ON t.course_id = c.id
     ${courseId ? 'WHERE c.id = ?' : ''}`, courseId ? [courseId] : []);
    rows.sort((a, b) => Number(a.course_id) - Number(b.course_id) || Number(a.subject_id || 0) - Number(b.subject_id || 0));
    const courseMap = new Map();
    const subjects = [];
    for (const r of rows) {
        const cid = Number(r.course_id);
        if (!courseMap.has(cid))
            courseMap.set(cid, { id: cid, name: r.course_title, lessonCount: Number(r.lesson_count), subjectCount: Number(r.subject_count) });
        if (r.subject_id == null)
            continue;
        subjects.push({ id: Number(r.subject_id), weight: Number(r.subject_lessons || 0) + Number(r.subject_topics || 0) + Number(r.subject_quizzes || 0) + 1 });
    }
    const courses = [...courseMap.values()];
    const planRows = rows.length + courses.length;
    const courseQuizRows = [...new Map(rows.map((r) => [Number(r.course_id), Number(r.quiz_general_total || 0) + Number(r.quiz_unfiled_total || 0)])).values()]
        .reduce((t, n) => t + n, 0);
    const finishRows = courses.length + subjects.length + courseQuizRows;
    const total = subjects.reduce((t, s) => t + s.weight, 0);
    const { sets, finishFitsLast } = packSets(subjects, planRows, finishRows);
    fixRun = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), expiresAt: Date.now() + FIX_RUN_IDLE_MS, finishRows };
    try {
        const first = await countSet(db, sets[0] || []);
        const remaining = sets.slice(1);
        let finish = null;
        if (!remaining.length && planRows + first.rowsRead + finishRows <= exports.FIX_REQUEST_ROW_BUDGET) {
            finish = await finishCourses(db, courses.map((c) => ({ id: c.id, lessons: first.courseLessons[c.id] || 0, expectedLessons: c.lessonCount, expectedSubjects: c.subjectCount })));
            endRun();
        }
        return {
            runId: fixRun?.id ?? null,
            courses,
            first,
            remaining,
            finishWithLast: remaining.length > 0 && finishFitsLast,
            done: Boolean(finish),
            finish,
        };
    }
    catch (error) {
        fixRun = null;
        throw error;
    }
}
async function runCountFixSet(db, runId, subjectIds, finish) {
    touchRun(runId);
    const outcome = await countSet(db, subjectIds);
    if (!finish)
        return { ...outcome, done: false, finish: null };
    try {
        const totals = finish.map((c) => ({ ...c, lessons: Number(c.lessons || 0) + (outcome.courseLessons[Number(c.id)] || 0) }));
        const result = await finishCourses(db, totals);
        return { ...outcome, done: true, finish: result };
    }
    finally {
        endRun();
    }
}
async function finishCountFix(db, runId, totals) {
    touchRun(runId);
    try {
        return { ...(await finishCourses(db, totals)), done: true };
    }
    finally {
        endRun();
    }
}
//# sourceMappingURL=structure-counts.js.map