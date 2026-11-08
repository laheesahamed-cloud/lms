import { strict as assert } from 'node:assert';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';

// 1 = draft, 2 = draft with no questions (cannot be published), 3 = already active, 4 = draft.
const STATUS: Record<number, string> = { 1: 'inactive', 2: 'inactive', 3: 'active', 4: 'inactive' };

class FakeDb {
  statements: Array<{ sql: string; params: unknown[] }> = [];
  committed = false;
  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    const q = sql.replace(/\s+/g, ' ').trim();
    this.statements.push({ sql: q, params });
    if (q.startsWith('SELECT id, status FROM quizzes')) {
      return [params.filter((id) => STATUS[id]).map((id) => ({ id, status: STATUS[id] })), []];
    }
    return [{ affectedRows: 1 }, []];
  }
  async getConnection() {
    const db = this;
    return { beginTransaction: async () => {}, commit: async () => { db.committed = true; }, rollback: async () => {}, release: () => {}, execute: (s: string, p?: any[]) => db.execute(s, p) };
  }
}

function make(db: FakeDb, push: { calls: any[] }) {
  const service = new QuizzesService(db as any, {} as any, { notifyStudentsOfNewContent: async (m: any) => { push.calls.push(m); } } as any);
  (service as any).findOne = async (id: number) => ({
    id, courseId: 1, topicId: 1, adminName: `Quiz ${id}`, studentTitle: `Quiz ${id}`, displayTitleMode: 'title',
    questionIds: id === 2 ? [] : [10, 11], randomizationMode: 'static', status: STATUS[id], blueprint: null, collectionTags: [],
  });
  (service as any).recordContentVersion = async () => {};
  (service as any).setWorkflowState = async () => {};
  (service as any).recordContentAudit = async () => {};
  (service as any).buildQuizSnapshot = (quiz: any) => quiz;
  return service;
}

async function main() {
  const admin = { id: 1, role: 'admin' };

  // Approve: 1 and 4 change; 2 is skipped (no questions); 3 is already active; 99 does not exist.
  const db = new FakeDb(); const push = { calls: [] as any[] };
  const result = await make(db, push).bulkSetStatus({ quizIds: [1, 2, 3, 4, 99], status: 'active' }, admin);
  assert.equal(result.changed, 2);
  assert.deepEqual(result.skipped.map((s) => s.id).sort((a, b) => a - b), [2, 3, 99]);
  assert.match(result.skipped.find((s) => s.id === 2)!.reason, /at least one question/);
  assert.equal(result.skipped.find((s) => s.id === 3)!.reason, 'Already active');
  const update = db.statements.find((s) => s.sql.startsWith('UPDATE quizzes SET status'))!;
  assert.deepEqual(update.params, ['active', 1, 4], 'only the quizzes that can change are updated');
  assert.ok(db.committed);
  assert.equal(push.calls.length, 1, 'one notice for the whole batch');
  assert.match(push.calls[0].body, /2 new quizzes/);

  // A single approval uses the single-quiz wording.
  const one = new FakeDb(); const pushOne = { calls: [] as any[] };
  await make(one, pushOne).bulkSetStatus({ quizIds: [1], status: 'active' }, admin);
  assert.match(pushOne.calls[0].body, /Quiz 1 added to the Q-Bank/);

  // Back to draft: no notification, only the active quiz changes.
  const back = new FakeDb(); const pushBack = { calls: [] as any[] };
  const draft = await make(back, pushBack).bulkSetStatus({ quizIds: [1, 3], status: 'inactive' }, admin);
  assert.equal(draft.changed, 1);
  assert.equal(pushBack.calls.length, 0);

  // Staff without review permission cannot publish — nothing is written.
  const staffDb = new FakeDb(); const pushStaff = { calls: [] as any[] };
  await assert.rejects(() => make(staffDb, pushStaff).bulkSetStatus({ quizIds: [1], status: 'active' }, { id: 5, role: 'staff', permissions: ['quizzes.manage'] } as any), /Review permission/);
  assert.equal(staffDb.statements.filter((s) => s.sql.startsWith('UPDATE')).length, 0);

  // Nothing to change: nothing is written and nobody is notified.
  const none = new FakeDb(); const pushNone = { calls: [] as any[] };
  const noop = await make(none, pushNone).bulkSetStatus({ quizIds: [3], status: 'active' }, admin);
  assert.equal(noop.changed, 0);
  assert.equal(none.statements.filter((s) => s.sql.startsWith('UPDATE')).length, 0);
  assert.equal(pushNone.calls.length, 0);
  console.log('quiz bulk status checks passed');
}
main().catch((error) => { console.error(error); process.exit(1); });
