"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRecentResults = parseRecentResults;
exports.loadRecentResults = loadRecentResults;
exports.loadQuizInfo = loadQuizInfo;
exports.mostMissedQuestions = mostMissedQuestions;
const question_content_1 = require("./question-content");
function parseRecentResults(userId, raw) {
    let list;
    try {
        list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    catch {
        list = [];
    }
    if (!Array.isArray(list))
        return [];
    return list
        .filter((e) => !!e && typeof e === 'object')
        .map((e) => {
        const at = String(e.at || '');
        return {
            userId: Number(userId),
            quizId: Number(e.quizId ?? e.k),
            pct: Number(e.pct) || 0,
            passed: e.passed === true || e.passed === 1,
            reviewed: e.reviewed === true || e.reviewed === 1,
            at,
            day: at.slice(0, 10),
            questionCount: Array.isArray(e.ids) ? e.ids.length : 0,
            answers: e.a && typeof e.a === 'object' && !Array.isArray(e.a) ? e.a : {},
            correct: e.c == null ? null : Number(e.c),
            wrong: e.w == null ? null : Number(e.w),
        };
    })
        .filter((r) => Number.isInteger(r.quizId) && r.quizId > 0)
        .sort((x, y) => y.at.localeCompare(x.at));
}
async function loadRecentResults(db, userId) {
    const [rows] = await db.execute(userId
        ? 'SELECT user_id, recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1'
        : 'SELECT user_id, recent_results FROM student_study_summary WHERE recent_results IS NOT NULL', userId ? [userId] : []);
    return rows.flatMap((r) => parseRecentResults(Number(r.user_id), r.recent_results));
}
async function loadQuizInfo(db, quizIds) {
    const ids = [...new Set(quizIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length)
        return new Map();
    const [rows] = await db.query(`SELECT q.id, q.course_id, q.topic_id, q.quiz_title, q.quiz_title AS student_title, q.quiz_number, 'title' AS display_title_mode, c.course_title
       FROM quizzes q LEFT JOIN courses c ON c.id = q.course_id
      WHERE q.id IN (?)`, [ids]);
    return new Map(rows.map((r) => [Number(r.id), r]));
}
async function mostMissedQuestions(db, results, limit = 8) {
    const answered = new Map();
    for (const r of results) {
        for (const [qid, value] of Object.entries(r.answers)) {
            const id = Number(qid);
            if (!Number.isInteger(id) || id <= 0)
                continue;
            const list = answered.get(id) || [];
            list.push(value);
            answered.set(id, list);
        }
    }
    if (!answered.size)
        return [];
    const ids = [...answered.keys()];
    const wrongById = new Map();
    const textById = new Map();
    for (let i = 0; i < ids.length; i += 1000) {
        const part = ids.slice(i, i + 1000);
        const [rows] = await db.query('SELECT id, LEFT(question_text, 120) AS question_text, question_type, options_json FROM questions WHERE id IN (?)', [part]);
        for (const row of rows) {
            const id = Number(row.id);
            const options = (0, question_content_1.optionsOf)(id, row.options_json);
            const correctOf = new Map(options.map((o) => [String(o.id), o.is_correct]));
            let wrong = 0;
            for (const value of answered.get(id) || []) {
                if (value && typeof value === 'object') {
                    if (Object.entries(value).some(([oid, v]) => correctOf.has(oid) && Number(v) !== correctOf.get(oid)))
                        wrong += 1;
                }
                else if (correctOf.get(String(value)) === 0) {
                    wrong += 1;
                }
            }
            if (wrong > 0) {
                wrongById.set(id, wrong);
                textById.set(id, String(row.question_text || ''));
            }
        }
    }
    return [...wrongById.entries()]
        .sort((x, y) => y[1] - x[1] || x[0] - y[0])
        .slice(0, limit)
        .map(([id, wrongCount]) => ({ id, text: textById.get(id) || '', wrongCount }));
}
//# sourceMappingURL=recent-results.js.map