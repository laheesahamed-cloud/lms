import { Pool, PoolConnection } from 'mysql2/promise';
import { sqlPlaceholders } from '../../database/sql-safety';

/**
 * Raise the content stamp of the quizzes whose student-facing content changed
 * (OPTIMIZE 10.27 R1). Call it inside the same save (transaction) as the
 * change. The stamp travels in the Q-Bank list, and the server's and the
 * phone's saved copy of a quiz is rebuilt only when its stamp changes — so an
 * edit to one question rebuilds only the quizzes that hold it.
 *
 *  - `quizIds`: the quiz itself changed (settings, title, links, status);
 *  - `questionIds`: one of its questions, options or theory recap changed —
 *    every quiz linked to those questions is raised.
 */
export async function bumpQuizStamps(
  db: Pool | PoolConnection,
  change: { quizIds?: number[]; questionIds?: number[] },
) {
  const quizIds = [...new Set((change.quizIds || []).map(Number).filter((id) => id > 0))];
  const questionIds = [...new Set((change.questionIds || []).map(Number).filter((id) => id > 0))];
  if (quizIds.length) {
    await db.execute(
      `UPDATE quizzes SET content_stamp = content_stamp + 1 WHERE id IN (${sqlPlaceholders(quizIds)})`,
      quizIds,
    );
  }
  if (questionIds.length) {
    await db.execute(
      `UPDATE quizzes SET content_stamp = content_stamp + 1
        WHERE id IN (SELECT quiz_id FROM question_quizzes WHERE question_id IN (${sqlPlaceholders(questionIds)}))`,
      questionIds,
    );
  }
}

/** Raise every quiz's stamp (after SQL imports: "Fix counts"). */
export async function bumpAllQuizStamps(db: Pool | PoolConnection) {
  await db.execute('UPDATE quizzes SET content_stamp = content_stamp + 1');
}

/**
 * Questions are about to be DELETED: raise the stamp of every quiz holding
 * them and store each quiz's new size (its links minus the deleted questions)
 * in `total_questions` / `total_marks` (marks = questions, as the quiz save
 * stores them). One statement; call it inside the delete's transaction BEFORE
 * the links go.
 */
export async function bumpQuizStampsForDeletedQuestions(db: Pool | PoolConnection, questionIds: number[]) {
  const ids = [...new Set(questionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return;
  const marks = sqlPlaceholders(ids);
  // Multi-table UPDATE: one assignment may not see another's new value, so the
  // count is written out for both columns.
  const remaining = `(SELECT COUNT(*) FROM question_quizzes left_links
                       WHERE left_links.quiz_id = qz.id AND left_links.question_id NOT IN (${marks}))`;
  await db.execute(
    `UPDATE quizzes qz
       JOIN (SELECT DISTINCT quiz_id FROM question_quizzes WHERE question_id IN (${marks})) hit ON hit.quiz_id = qz.id
        SET qz.content_stamp = qz.content_stamp + 1,
            qz.total_questions = ${remaining},
            qz.total_marks = ${remaining}`,
    [...ids, ...ids, ...ids],
  );
}
