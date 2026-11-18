"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINK_FIX_BATCH = void 0;
exports.readQuizStates = readQuizStates;
exports.readSubjectQuizStates = readSubjectQuizStates;
exports.applyQuizCountChanges = applyQuizCountChanges;
exports.recountQuizCounts = recountQuizCounts;
exports.recountCourseQuizTotals = recountCourseQuizTotals;
exports.readQuestionCourses = readQuestionCourses;
exports.applyQuestionTotalChanges = applyQuestionTotalChanges;
exports.recountCourseQuestionTotals = recountCourseQuestionTotals;
exports.linkCountsForQuizzes = linkCountsForQuizzes;
exports.bumpQuestionLinkCounts = bumpQuestionLinkCounts;
exports.recountQuestionLinks = recountQuestionLinks;
exports.fixQuestionLinkCounts = fixQuestionLinkCounts;
exports.fixCourseQuestionTotals = fixCourseQuestionTotals;
const structure_counts_1 = require("./structure-counts");
async function readQuizStates(conn, ids, lock) {
    const clean = [...new Set(ids.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
    if (!clean.length)
        return [];
    const [rows] = await conn.query(`SELECT id, course_id, topic_id, is_general, status FROM quizzes WHERE id IN (?) ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [clean]);
    return rows.map((r) => ({
        id: Number(r.id),
        course_id: r.course_id == null ? null : Number(r.course_id),
        topic_id: r.topic_id == null ? null : Number(r.topic_id),
        is_general: Number(r.is_general) === 1 ? 1 : 0,
        status: String(r.status),
    }));
}
async function readSubjectQuizStates(conn, topicId) {
    const [rows] = await conn.query('SELECT id FROM quizzes WHERE topic_id = ? ORDER BY id FOR UPDATE', [topicId]);
    return readQuizStates(conn, rows.map((r) => Number(r.id)), true);
}
async function applyQuizCountChanges(conn, before, after) {
    const subjectTotal = [];
    const subjectActive = [];
    const generalTotal = [];
    const generalActive = [];
    const unfiledTotal = [];
    const unfiledActive = [];
    const courseTotal = [];
    const add = (q, sign) => {
        const active = q.status === 'active' ? sign : 0;
        if (q.course_id)
            courseTotal.push([q.course_id, sign]);
        if (q.is_general === 1) {
            if (q.course_id) {
                generalTotal.push([q.course_id, sign]);
                if (active)
                    generalActive.push([q.course_id, active]);
            }
        }
        else if (q.topic_id) {
            subjectTotal.push([q.topic_id, sign]);
            if (active)
                subjectActive.push([q.topic_id, active]);
        }
        else if (q.course_id) {
            unfiledTotal.push([q.course_id, sign]);
            if (active)
                unfiledActive.push([q.course_id, active]);
        }
    };
    before.forEach((q) => add(q, -1));
    after.forEach((q) => add(q, 1));
    await (0, structure_counts_1.bumpCounts)(conn, 'topics', 'quiz_total', subjectTotal);
    await (0, structure_counts_1.bumpCounts)(conn, 'topics', 'quiz_active', subjectActive);
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'quiz_general_total', generalTotal);
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'quiz_general_active', generalActive);
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'quiz_unfiled_total', unfiledTotal);
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'quiz_unfiled_active', unfiledActive);
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'quiz_total', courseTotal);
}
async function recountQuizCounts(db) {
    await db.execute(`UPDATE topics t SET
    t.quiz_total = (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = t.id AND q.is_general = 0),
    t.quiz_active = (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = t.id AND q.is_general = 0 AND q.status = 'active')`);
    await db.execute(`UPDATE courses c SET
    c.quiz_general_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 1),
    c.quiz_general_active = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 1 AND q.status = 'active'),
    c.quiz_unfiled_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 0 AND q.topic_id IS NULL),
    c.quiz_unfiled_active = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 0 AND q.topic_id IS NULL AND q.status = 'active')`);
}
async function recountCourseQuizTotals(db) {
    await db.execute('UPDATE courses c SET c.quiz_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id)');
}
async function readQuestionCourses(conn, ids) {
    const clean = [...new Set(ids.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
    if (!clean.length)
        return [];
    const [rows] = await conn.query('SELECT id, course_id FROM questions WHERE id IN (?) FOR UPDATE', [clean]);
    return rows.map((r) => ({ id: Number(r.id), course_id: Number(r.course_id) }));
}
async function applyQuestionTotalChanges(conn, before, after) {
    await (0, structure_counts_1.bumpCounts)(conn, 'courses', 'question_total', [
        ...before.map((q) => [q.course_id, -1]),
        ...after.map((q) => [q.course_id, 1]),
    ]);
}
async function recountCourseQuestionTotals(db) {
    await db.execute('UPDATE courses c SET c.question_total = (SELECT COUNT(*) FROM questions q WHERE q.course_id = c.id)');
}
async function linkCountsForQuizzes(conn, quizIds) {
    const ids = [...new Set(quizIds.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
    if (!ids.length)
        return new Map();
    const [rows] = await conn.query('SELECT question_id, COUNT(*) AS n FROM question_quizzes WHERE quiz_id IN (?) GROUP BY question_id', [ids]);
    return new Map(rows.map((r) => [Number(r.question_id), Number(r.n)]));
}
async function bumpQuestionLinkCounts(conn, changes) {
    await (0, structure_counts_1.bumpCounts)(conn, 'questions', 'quiz_count', changes);
}
async function recountQuestionLinks(db) {
    await db.execute(`UPDATE questions q
    SET q.quiz_count = (SELECT COUNT(*) FROM question_quizzes qq WHERE qq.question_id = q.id)`);
}
exports.LINK_FIX_BATCH = 400;
async function fixQuestionLinkCounts(db, after) {
    const from = Number.isInteger(after) && after > 0 ? after : 0;
    const [rows] = await db.query(`SELECT q.id, q.quiz_count, q.course_id,
       (SELECT COUNT(*) FROM question_quizzes qq FORCE INDEX (unique_question_quiz) WHERE qq.question_id = q.id) AS real_count
     FROM questions q WHERE q.id > ? ORDER BY q.id LIMIT ?`, [from, exports.LINK_FIX_BATCH]);
    const fixed = [];
    const changed = [];
    for (const r of rows) {
        const stored = Number(r.quiz_count);
        const actual = Number(r.real_count);
        if (stored === actual)
            continue;
        const [res] = await db.execute('UPDATE questions SET quiz_count = ? WHERE id = ? AND quiz_count = ?', [actual, r.id, stored]);
        (res.affectedRows ? fixed : changed).push({ id: Number(r.id), stored, actual });
    }
    const courseCounts = {};
    for (const r of rows)
        courseCounts[Number(r.course_id)] = (courseCounts[Number(r.course_id)] || 0) + 1;
    let courseTotals;
    if (from === 0) {
        const [courses] = await db.query('SELECT id, question_total FROM courses');
        courseTotals = Object.fromEntries(courses.map((c) => [Number(c.id), Number(c.question_total)]));
    }
    const lastId = rows.length ? Number(rows[rows.length - 1].id) : from;
    const [[top]] = await db.query('SELECT MAX(id) AS max_id FROM questions');
    return { lastId, done: rows.length < exports.LINK_FIX_BATCH, maxId: Number(top?.max_id || 0), fixed, changed, courseCounts, courseTotals };
}
async function fixCourseQuestionTotals(db, counts, expected) {
    const [courses] = await db.query('SELECT id, course_title, question_total FROM courses');
    const fixed = [];
    const changed = [];
    for (const c of courses) {
        const id = Number(c.id);
        if (!(String(id) in expected))
            continue;
        const stored = Number(c.question_total);
        const actual = Math.max(0, Math.trunc(Number(counts[String(id)] || 0)));
        const issue = { id, name: String(c.course_title || ''), stored, actual };
        if (stored !== Number(expected[String(id)])) {
            if (stored !== actual)
                changed.push(issue);
            continue;
        }
        if (stored === actual)
            continue;
        const [res] = await db.execute('UPDATE courses SET question_total = ? WHERE id = ? AND question_total = ?', [actual, id, stored]);
        (res.affectedRows ? fixed : changed).push(issue);
    }
    return { fixed, changed };
}
//# sourceMappingURL=quiz-counts.js.map