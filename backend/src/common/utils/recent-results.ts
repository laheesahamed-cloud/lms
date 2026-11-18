// OPTIMIZE 10.44: exam results live only on each student's summary row
// (`student_study_summary.recent_results`, the newest 5 per student, written
// by every app / website exam — 10.16). The old `quiz_attempts` /
// `student_answers` / `exam_sessions` tables are gone; admin statistics and the
// website's recent-attempts list read these entries instead.
//
// One entry: {k, quizId, pct, passed, reviewed, at, ids, a, c?, w?}
//   a = answers by question id: SBA → option id; True/False → {optionId: 0|1}.

import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { optionsOf } from './question-content';

type Db = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;

export type RecentResult = {
  userId: number;
  quizId: number;
  pct: number;
  passed: boolean;
  reviewed: boolean;
  at: string;
  day: string; // YYYY-MM-DD of `at`
  questionCount: number;
  answers: Record<string, unknown>;
  correct: number | null;
  wrong: number | null;
};

/** The entries of one summary row's `recent_results`, newest first. */
export function parseRecentResults(userId: number, raw: unknown): RecentResult[] {
  let list: unknown;
  try { list = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
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
        answers: e.a && typeof e.a === 'object' && !Array.isArray(e.a) ? e.a as Record<string, unknown> : {},
        correct: e.c == null ? null : Number(e.c),
        wrong: e.w == null ? null : Number(e.w),
      };
    })
    .filter((r) => Number.isInteger(r.quizId) && r.quizId > 0)
    .sort((x, y) => y.at.localeCompare(x.at));
}

/** Every student's stored results (one row per student), or one student's. */
export async function loadRecentResults(db: Db, userId?: number | null): Promise<RecentResult[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    userId
      ? 'SELECT user_id, recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1'
      : 'SELECT user_id, recent_results FROM student_study_summary WHERE recent_results IS NOT NULL',
    userId ? [userId] : [],
  );
  return rows.flatMap((r) => parseRecentResults(Number(r.user_id), r.recent_results));
}

export type QuizInfo = {
  id: number; course_id: number | null; topic_id: number | null; quiz_title: string;
  student_title: string | null; quiz_number: number | null; display_title_mode: string | null; course_title: string | null;
};

/** Title / course of the quizzes these results belong to (one read). */
export async function loadQuizInfo(db: Db, quizIds: number[]): Promise<Map<number, QuizInfo>> {
  const ids = [...new Set(quizIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT q.id, q.course_id, q.topic_id, q.quiz_title, q.quiz_title AS student_title, q.quiz_number, 'title' AS display_title_mode, c.course_title
       FROM quizzes q LEFT JOIN courses c ON c.id = q.course_id
      WHERE q.id IN (?)`,
    [ids],
  );
  return new Map(rows.map((r) => [Number(r.id), r as unknown as QuizInfo]));
}

/**
 * Wrong answers per question across these results: each answered question
 * counts once per result when its answer is wrong (SBA: the picked option is
 * not the right one; True/False: any statement marked the wrong way).
 * Returns the `limit` most-missed questions with their stem (120 chars).
 */
export async function mostMissedQuestions(db: Db, results: RecentResult[], limit = 8) {
  const answered = new Map<number, unknown[]>();
  for (const r of results) {
    for (const [qid, value] of Object.entries(r.answers)) {
      const id = Number(qid);
      if (!Number.isInteger(id) || id <= 0) continue;
      const list = answered.get(id) || [];
      list.push(value);
      answered.set(id, list);
    }
  }
  if (!answered.size) return [];
  const ids = [...answered.keys()];
  const wrongById = new Map<number, number>();
  const textById = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const part = ids.slice(i, i + 1000);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, LEFT(question_text, 120) AS question_text, question_type, options_json FROM questions WHERE id IN (?)',
      [part],
    );
    for (const row of rows) {
      const id = Number(row.id);
      const options = optionsOf(id, row.options_json);
      const correctOf = new Map(options.map((o) => [String(o.id), o.is_correct]));
      let wrong = 0;
      for (const value of answered.get(id) || []) {
        if (value && typeof value === 'object') {
          if (Object.entries(value as Record<string, unknown>).some(([oid, v]) => correctOf.has(oid) && Number(v) !== correctOf.get(oid))) wrong += 1;
        } else if (correctOf.get(String(value)) === 0) {
          wrong += 1;
        }
      }
      if (wrong > 0) { wrongById.set(id, wrong); textById.set(id, String(row.question_text || '')); }
    }
  }
  return [...wrongById.entries()]
    .sort((x, y) => y[1] - x[1] || x[0] - y[0])
    .slice(0, limit)
    .map(([id, wrongCount]) => ({ id, text: textById.get(id) || '', wrongCount }));
}
