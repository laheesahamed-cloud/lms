import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { bumpCounts } from './structure-counts';

/**
 * Stored assessment counts for the Assessments folder view.
 *
 *   topics.quiz_total / quiz_active               — a subject's assessments (not general)
 *   courses.quiz_general_total / general_active   — a course's general assessments
 *   courses.quiz_unfiled_total / unfiled_active   — not general and no subject
 *                                                  (left behind when a subject is deleted)
 *   courses.quiz_total                            — every assessment of the course (dashboard)
 *
 * Every save that adds, removes, moves or (un)publishes an assessment reads
 * the affected rows before and after (locked, by id) and adjusts only those
 * counts in the same transaction. Lock order: quizzes → topics → courses.
 * Edits made outside the app are repaired by "Fix counts".
 */
type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;

export type QuizState = { id: number; course_id: number | null; topic_id: number | null; is_general: number; status: string };

export async function readQuizStates(conn: Executor, ids: number[], lock: boolean): Promise<QuizState[]> {
  const clean = [...new Set(ids.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
  if (!clean.length) return [];
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, course_id, topic_id, is_general, status FROM quizzes WHERE id IN (?) ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
    [clean],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    course_id: r.course_id == null ? null : Number(r.course_id),
    topic_id: r.topic_id == null ? null : Number(r.topic_id),
    is_general: Number(r.is_general) === 1 ? 1 : 0,
    status: String(r.status),
  }));
}

/** The quizzes of one subject, locked (used when a subject is deleted or moved). */
export async function readSubjectQuizStates(conn: Executor, topicId: number): Promise<QuizState[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM quizzes WHERE topic_id = ? ORDER BY id FOR UPDATE', [topicId]);
  return readQuizStates(conn, rows.map((r) => Number(r.id)), true);
}

/** Move each quiz's count from where it was (before) to where it is (after). 0 statements if nothing that counts changed. */
export async function applyQuizCountChanges(conn: Executor, before: QuizState[], after: QuizState[]) {
  const subjectTotal: Array<[number, number]> = [];
  const subjectActive: Array<[number, number]> = [];
  const generalTotal: Array<[number, number]> = [];
  const generalActive: Array<[number, number]> = [];
  const unfiledTotal: Array<[number, number]> = [];
  const unfiledActive: Array<[number, number]> = [];
  const courseTotal: Array<[number, number]> = [];
  const add = (q: QuizState, sign: number) => {
    const active = q.status === 'active' ? sign : 0;
    if (q.course_id) courseTotal.push([q.course_id, sign]);
    if (q.is_general === 1) {
      if (q.course_id) { generalTotal.push([q.course_id, sign]); if (active) generalActive.push([q.course_id, active]); }
    } else if (q.topic_id) {
      subjectTotal.push([q.topic_id, sign]); if (active) subjectActive.push([q.topic_id, active]);
    } else if (q.course_id) {
      unfiledTotal.push([q.course_id, sign]); if (active) unfiledActive.push([q.course_id, active]);
    }
  };
  before.forEach((q) => add(q, -1));
  after.forEach((q) => add(q, 1));
  // Subjects before courses (lock order); bumpCounts skips ids whose net change is 0.
  await bumpCounts(conn, 'topics', 'quiz_total', subjectTotal);
  await bumpCounts(conn, 'topics', 'quiz_active', subjectActive);
  await bumpCounts(conn, 'courses', 'quiz_general_total', generalTotal);
  await bumpCounts(conn, 'courses', 'quiz_general_active', generalActive);
  await bumpCounts(conn, 'courses', 'quiz_unfiled_total', unfiledTotal);
  await bumpCounts(conn, 'courses', 'quiz_unfiled_active', unfiledActive);
  // Every assessment of the course (dashboard total). Net 0 for a publish or
  // a move inside the course, so usually no statement.
  await bumpCounts(conn, 'courses', 'quiz_total', courseTotal);
}

/** Full recount of the assessment counts. Only used when the columns are first created. */
export async function recountQuizCounts(db: Executor) {
  await db.execute(`UPDATE topics t SET
    t.quiz_total = (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = t.id AND q.is_general = 0),
    t.quiz_active = (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = t.id AND q.is_general = 0 AND q.status = 'active')`);
  await db.execute(`UPDATE courses c SET
    c.quiz_general_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 1),
    c.quiz_general_active = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 1 AND q.status = 'active'),
    c.quiz_unfiled_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 0 AND q.topic_id IS NULL),
    c.quiz_unfiled_active = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_general = 0 AND q.topic_id IS NULL AND q.status = 'active')`);
}

/** courses.quiz_total. Only used when the column is first created. */
export async function recountCourseQuizTotals(db: Executor) {
  await db.execute('UPDATE courses c SET c.quiz_total = (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id)');
}

/**
 * courses.question_total: every question of a course, any status (admin
 * dashboard total). Lock order questions → courses: a save locks its question
 * rows first (by id), then adjusts the course rows in the same transaction.
 */
export type QuestionCourse = { id: number; course_id: number };

/** The questions' current courses, locked by primary key (examined = returned). */
export async function readQuestionCourses(conn: Executor, ids: number[]): Promise<QuestionCourse[]> {
  const clean = [...new Set(ids.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
  if (!clean.length) return [];
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id, course_id FROM questions WHERE id IN (?) FOR UPDATE', [clean]);
  return rows.map((r) => ({ id: Number(r.id), course_id: Number(r.course_id) }));
}

/** Move question totals: `before` rows leave their course, `after` rows join theirs. 0 statements when nothing moved. */
export async function applyQuestionTotalChanges(conn: Executor, before: QuestionCourse[], after: QuestionCourse[]) {
  await bumpCounts(conn, 'courses', 'question_total', [
    ...before.map((q) => [q.course_id, -1] as [number, number]),
    ...after.map((q) => [q.course_id, 1] as [number, number]),
  ]);
}

/** courses.question_total. Only used when the column is first created. */
export async function recountCourseQuestionTotals(db: Executor) {
  await db.execute('UPDATE courses c SET c.question_total = (SELECT COUNT(*) FROM questions q WHERE q.course_id = c.id)');
}

/**
 * questions.quiz_count: how many assessments use each question ("N quiz links"
 * in the question bank, and "unused" filters/counts). Adjusted wherever links
 * are written: an assessment's links replaced, an assessment deleted (one or
 * many). Deleting a question removes its own row, so nothing to adjust there.
 */
export async function linkCountsForQuizzes(conn: Executor, quizIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(quizIds.map(Number).filter((v) => Number.isInteger(v) && v > 0))];
  if (!ids.length) return new Map();
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT question_id, COUNT(*) AS n FROM question_quizzes WHERE quiz_id IN (?) GROUP BY question_id', [ids]);
  return new Map(rows.map((r) => [Number(r.question_id), Number(r.n)]));
}

export async function bumpQuestionLinkCounts(conn: Executor, changes: Array<[number, number]>) {
  await bumpCounts(conn, 'questions', 'quiz_count', changes);
}

/** Full recount of questions.quiz_count. Only used when the column is first created. */
export async function recountQuestionLinks(db: Executor) {
  await db.execute(`UPDATE questions q
    SET q.quiz_count = (SELECT COUNT(*) FROM question_quizzes qq WHERE qq.question_id = q.id)`);
}

/**
 * Manual repair of questions.quiz_count (after edits outside the app, e.g. an
 * SQL import of assessment links). One small step per request: the next 400
 * questions after `after`, each with its real link count from the
 * (question_id, quiz_id) index, ~2 rows per question (< 1,000 per request).
 * Only wrong numbers are written, and only if unchanged since read.
 */
export const LINK_FIX_BATCH = 400;
export async function fixQuestionLinkCounts(db: Executor, after: number) {
  const from = Number.isInteger(after) && after > 0 ? after : 0;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT q.id, q.quiz_count, q.course_id,
       (SELECT COUNT(*) FROM question_quizzes qq FORCE INDEX (unique_question_quiz) WHERE qq.question_id = q.id) AS real_count
     FROM questions q WHERE q.id > ? ORDER BY q.id LIMIT ?`, [from, LINK_FIX_BATCH]);
  const fixed: Array<{ id: number; stored: number; actual: number }> = [];
  const changed: Array<{ id: number; stored: number; actual: number }> = [];
  for (const r of rows) {
    const stored = Number(r.quiz_count);
    const actual = Number(r.real_count);
    if (stored === actual) continue;
    const [res] = await db.execute<any>('UPDATE questions SET quiz_count = ? WHERE id = ? AND quiz_count = ?', [actual, r.id, stored]);
    (res.affectedRows ? fixed : changed).push({ id: Number(r.id), stored, actual });
  }
  // Questions per course in this step; the page adds the steps up and checks
  // courses.question_total at the end (fixCourseQuestionTotals).
  const courseCounts: Record<number, number> = {};
  for (const r of rows) courseCounts[Number(r.course_id)] = (courseCounts[Number(r.course_id)] || 0) + 1;
  // Step 1 also hands out the stored totals, so the end can tell whether a
  // save changed them during the run (then it leaves them alone).
  let courseTotals: Record<number, number> | undefined;
  if (from === 0) {
    const [courses] = await db.query<RowDataPacket[]>('SELECT id, question_total FROM courses');
    courseTotals = Object.fromEntries(courses.map((c) => [Number(c.id), Number(c.question_total)]));
  }
  const lastId = rows.length ? Number(rows[rows.length - 1].id) : from;
  // Progress: the highest id is one index read.
  const [[top]] = await db.query<RowDataPacket[]>('SELECT MAX(id) AS max_id FROM questions');
  return { lastId, done: rows.length < LINK_FIX_BATCH, maxId: Number(top?.max_id || 0), fixed, changed, courseCounts, courseTotals };
}

/**
 * End of the question bank fix: `counts` = questions per course added up from
 * every step, `expected` = the stored totals step 1 saw. A course whose total
 * changed since then (a save during the run) is reported, not written.
 * Reads the course rows only.
 */
export async function fixCourseQuestionTotals(db: Executor, counts: Record<string, number>, expected: Record<string, number>) {
  const [courses] = await db.query<RowDataPacket[]>('SELECT id, course_title, question_total FROM courses');
  const fixed: Array<{ id: number; name: string; stored: number; actual: number }> = [];
  const changed: Array<{ id: number; name: string; stored: number; actual: number }> = [];
  for (const c of courses) {
    const id = Number(c.id);
    if (!(String(id) in expected)) continue; // course added during the run
    const stored = Number(c.question_total);
    const actual = Math.max(0, Math.trunc(Number(counts[String(id)] || 0)));
    const issue = { id, name: String(c.course_title || ''), stored, actual };
    if (stored !== Number(expected[String(id)])) { if (stored !== actual) changed.push(issue); continue; }
    if (stored === actual) continue;
    const [res] = await db.execute<any>('UPDATE courses SET question_total = ? WHERE id = ? AND question_total = ?', [actual, id, stored]);
    (res.affectedRows ? fixed : changed).push(issue);
  }
  return { fixed, changed };
}
