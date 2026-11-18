"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpQuizStamps = bumpQuizStamps;
exports.bumpAllQuizStamps = bumpAllQuizStamps;
exports.bumpQuizStampsForDeletedQuestions = bumpQuizStampsForDeletedQuestions;
const sql_safety_1 = require("../../database/sql-safety");
async function bumpQuizStamps(db, change) {
    const quizIds = [...new Set((change.quizIds || []).map(Number).filter((id) => id > 0))];
    const questionIds = [...new Set((change.questionIds || []).map(Number).filter((id) => id > 0))];
    if (quizIds.length) {
        await db.execute(`UPDATE quizzes SET content_stamp = content_stamp + 1 WHERE id IN (${(0, sql_safety_1.sqlPlaceholders)(quizIds)})`, quizIds);
    }
    if (questionIds.length) {
        await db.execute(`UPDATE quizzes SET content_stamp = content_stamp + 1
        WHERE id IN (SELECT quiz_id FROM question_quizzes WHERE question_id IN (${(0, sql_safety_1.sqlPlaceholders)(questionIds)}))`, questionIds);
    }
}
async function bumpAllQuizStamps(db) {
    await db.execute('UPDATE quizzes SET content_stamp = content_stamp + 1');
}
async function bumpQuizStampsForDeletedQuestions(db, questionIds) {
    const ids = [...new Set(questionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length)
        return;
    const marks = (0, sql_safety_1.sqlPlaceholders)(ids);
    const remaining = `(SELECT COUNT(*) FROM question_quizzes left_links
                       WHERE left_links.quiz_id = qz.id AND left_links.question_id NOT IN (${marks}))`;
    await db.execute(`UPDATE quizzes qz
       JOIN (SELECT DISTINCT quiz_id FROM question_quizzes WHERE question_id IN (${marks})) hit ON hit.quiz_id = qz.id
        SET qz.content_stamp = qz.content_stamp + 1,
            qz.total_questions = ${remaining},
            qz.total_marks = ${remaining}`, [...ids, ...ids, ...ids]);
}
//# sourceMappingURL=quiz-stamp.js.map