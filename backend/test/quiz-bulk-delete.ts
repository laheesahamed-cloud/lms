import { strict as assert } from 'node:assert';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';

// quiz 1 = {10, 11}, quiz 2 = {11, 12}, quiz 3 = {12}. Selecting quizzes 1 and 2:
// questions inside = 10, 11, 12; 12 is ALSO used by quiz 3, so only 10 and 11 are "only here".
const LINKS: Array<[number, number]> = [[1, 10], [1, 11], [2, 11], [2, 12], [3, 12]];

class FakeDb {
  statements: Array<{ sql: string; params: unknown[] }> = [];
  committed = false;
  constructor(private readonly quizStatus: Record<number, string> = { 1: 'inactive', 2: 'inactive', 3: 'active' }) {}

  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    const q = sql.replace(/\s+/g, ' ').trim();
    this.statements.push({ sql: q, params });
    if (q.startsWith('SELECT id, status FROM quizzes')) {
      return [params.filter((id) => this.quizStatus[id]).map((id) => ({ id, status: this.quizStatus[id] })), []];
    }
    if (q.startsWith('SELECT DISTINCT question_id FROM question_quizzes WHERE quiz_id IN')) {
      return [[...new Set(LINKS.filter(([quiz]) => params.includes(quiz)).map(([, question]) => question))].map((question_id) => ({ question_id })), []];
    }
    if (q.includes('FROM question_quizzes') && q.includes('NOT IN')) {
      const questionCount = (q.match(/question_id IN \(([^)]*)\)/)![1].match(/\?/g) || []).length;
      const questions = params.slice(0, questionCount);
      const quizzes = params.slice(questionCount);
      return [[...new Set(LINKS.filter(([quiz, question]) => questions.includes(question) && !quizzes.includes(quiz)).map(([, question]) => question))].map((question_id) => ({ question_id })), []];
    }
    // 10.44: results students hold, from their summary rows (quiz 1 ×2, quiz 2 ×1, quiz 3 ×4 → 3 for quizzes 1+2).
    if (q.startsWith('SELECT user_id, recent_results FROM student_study_summary')) {
      const at = '2026-11-17T10:00:00.000Z';
      return [[
        { user_id: 100, recent_results: JSON.stringify([{ k: '1', quizId: 1, pct: 50, at }, { k: '3', quizId: 3, pct: 50, at }]) },
        { user_id: 101, recent_results: JSON.stringify([{ k: '1', quizId: 1, pct: 80, at }, { k: '2', quizId: 2, pct: 80, at }, { k: '3', quizId: 3, pct: 80, at }]) },
        { user_id: 102, recent_results: JSON.stringify([{ k: '3', quizId: 3, pct: 10, at }, { k: '3', quizId: 3, pct: 10, at }]) },
      ], []];
    }
    if (q.includes('AS active_count')) return [[{ active_count: 0 }], []];
    if (q.startsWith('DELETE FROM questions')) return [{ affectedRows: params.length }, []];
    return [{ affectedRows: 0 }, []];
  }
  async query(sql: string, params: any[] = []): Promise<[any, any]> {
    const q = sql.replace(/\s+/g, ' ').trim();
    const flat = params.flat();
    this.statements.push({ sql: q, params: flat });
    if (q.startsWith('SELECT id, course_id, topic_id, is_general, status FROM quizzes')) {
      return [flat.filter((id) => this.quizStatus[id]).map((id) => ({ id, course_id: 10, topic_id: 20, is_general: 0, status: this.quizStatus[id] })), []];
    }
    if (q.startsWith('SELECT')) return [[], []];
    return [{ affectedRows: 0 }, []];
  }
  async getConnection() {
    const db = this;
    return {
      beginTransaction: async () => {},
      commit: async () => { db.committed = true; },
      rollback: async () => {},
      release: () => {},
      execute: (sql: string, params?: any[]) => db.execute(sql, params),
      // Stored counts (quiz-counts.ts) use query() with `IN (?)` array params.
      query: (sql: string, params?: any[]) => db.query(sql, params),
    };
  }
}

const make = (db: FakeDb) => new QuizzesService(db as any, {} as any, {} as any);
const deletedTables = (db: FakeDb) => db.statements.filter((s) => s.sql.startsWith('DELETE')).map((s) => s.sql.replace(/ WHERE.*/, ''));

async function main() {
  // Preview changes nothing and counts correctly.
  const previewDb = new FakeDb();
  const preview = await make(previewDb).bulkDeletePreview({ quizIds: [1, 2] });
  assert.deepEqual(preview, { quizzes: 2, questionsInside: 3, questionsOnlyHere: 2, questionsShared: 1, attempts: 3 });
  assert.equal(deletedTables(previewDb).length, 0, 'preview must not delete anything');

  // Assessments only: no question is deleted, all 3 stay.
  const onlyDb = new FakeDb();
  const only = await make(onlyDb).bulkDelete({ quizIds: [1, 2], deleteQuestions: false }, { id: 1, role: 'admin' });
  assert.deepEqual(only, { ok: true, deletedQuizzes: 2, deletedQuestions: 0, keptQuestions: 3 });
  assert(!deletedTables(onlyDb).some((s) => /FROM questions$|question_options|student_answers/.test(s)), 'questions must be left alone');

  // Assessments + questions: only 10 and 11 go; 12 (shared with quiz 3) is kept.
  const bothDb = new FakeDb();
  const both = await make(bothDb).bulkDelete({ quizIds: [1, 2], deleteQuestions: true }, { id: 1, role: 'admin' });
  assert.deepEqual(both, { ok: true, deletedQuizzes: 2, deletedQuestions: 2, keptQuestions: 1 });
  const questionDelete = bothDb.statements.find((s) => s.sql.startsWith('DELETE FROM questions'))!;
  assert.deepEqual([...(questionDelete.params as number[])].sort(), [10, 11]);
  assert(bothDb.committed);

  // A staff member without the questions permission cannot delete questions...
  await assert.rejects(
    () => make(new FakeDb()).bulkDelete({ quizIds: [1], deleteQuestions: true }, { id: 9, role: 'staff', permissions: ['quizzes.manage', 'content.review'] }),
    /questions permission/,
  );
  // ...but can still delete the assessments alone.
  const staffOk = await make(new FakeDb()).bulkDelete({ quizIds: [1], deleteQuestions: false }, { id: 9, role: 'staff', permissions: ['quizzes.manage'] });
  assert.equal(staffOk.deletedQuizzes, 1);

  // A published assessment needs review permission.
  await assert.rejects(
    () => make(new FakeDb()).bulkDelete({ quizIds: [3] }, { id: 9, role: 'staff', permissions: ['quizzes.manage'] }),
    /review permission/,
  );
  // Unknown id.
  await assert.rejects(() => make(new FakeDb()).bulkDeletePreview({ quizIds: [99] }), /could not be found/);

  console.log('Quiz bulk-delete checks passed.');
}

main().catch((error) => { console.error(error); process.exit(1); });
