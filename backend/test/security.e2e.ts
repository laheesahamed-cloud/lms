import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import request = require('supertest');
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createConnection } from 'mysql2/promise';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { DATABASE_CONNECTION } from '../src/database/database.tokens';
import { SchemaSyncService } from '../src/modules/schema/schema-sync.service';
import { hashSessionToken } from '../src/modules/auth/auth-token.util';
import { encryptSecret } from '../src/common/utils/ai-provider.utils';

const TEST_ALLOWED_ORIGIN = 'https://app.example.test';
const TEST_API_ORIGIN = 'https://api.example.test';
const SETTINGS_ENCRYPTION_SECRET = 'test-settings-encryption-key-32-chars-long';
const PAYHERE_MERCHANT_ID = '1211149';
const PAYHERE_SECRET = 'payhere-secret-test';
const HEALTH_METRICS_TOKEN = 'test-health-metrics-token';

process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = TEST_ALLOWED_ORIGIN;
process.env.API_PUBLIC_URL = TEST_API_ORIGIN;
process.env.SETTINGS_ENCRYPTION_KEY = SETTINGS_ENCRYPTION_SECRET;
process.env.DB_PASSWORD = 'test-db-password';
process.env.ALLOW_LAN_ORIGINS = 'false';
process.env.HEALTH_METRICS_TOKEN = HEALTH_METRICS_TOKEN;

type DbCall = {
  sql: string;
  params: unknown[];
};

const TOKENS = {
  studentA: 'student-a-token',
  studentB: 'student-b-token',
  contentEditor: 'content-editor-token',
  inactiveFinance: 'inactive-finance-token',
  admin: 'admin-token',
};

const USERS_BY_HASH = new Map([
  [hashSessionToken(TOKENS.studentA), { id: 100, full_name: 'Student A', email: 'a@example.test', password: 'hash', role: 'student', status: 'active', avatar_key: null }],
  [hashSessionToken(TOKENS.studentB), { id: 200, full_name: 'Student B', email: 'b@example.test', password: 'hash', role: 'student', status: 'active', avatar_key: null }],
  [hashSessionToken(TOKENS.contentEditor), { id: 300, full_name: 'Editor', email: 'editor@example.test', password: 'hash', role: 'content_editor', status: 'active', avatar_key: null }],
  [hashSessionToken(TOKENS.inactiveFinance), { id: 500, full_name: 'Inactive Finance', email: 'inactive-finance@example.test', password: 'hash', role: 'finance', status: 'inactive', avatar_key: null }],
  [hashSessionToken(TOKENS.admin), { id: 400, full_name: 'Admin', email: 'admin@example.test', password: 'hash', role: 'admin', status: 'active', avatar_key: null }],
]);

const TEST_SETTINGS: Record<string, string> = {
  contact_whatsapp_number: '+94770000000',
  payment_payhere_enabled: 'true',
  payment_payhere_sandbox_mode: 'true',
  payment_payhere_merchant_id: PAYHERE_MERCHANT_ID,
  payment_payhere_merchant_secret: encryptSecret(PAYHERE_SECRET, SETTINGS_ENCRYPTION_SECRET),
  payment_payhere_currency: 'LKR',
  payment_payhere_return_url: '',
  payment_payhere_cancel_url: '',
  payment_payhere_notify_url: '',
  payment_payhere_checkout_title: 'xyndrome subscription',
  payment_payhere_button_label: 'Pay with PayHere',
  payment_payhere_support_text: 'Upload a receipt if you pay manually.',
  payment_payhere_auto_activate_paid_subscriptions: 'false',
};

class SecurityE2eDb {
  calls: DbCall[] = [];

  async execute<T = unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized === 'SELECT 1' || normalized === 'SELECT 1 AS ok') {
      return [[{ ok: 1 }] as T, []];
    }

    if (normalized.includes('(SELECT COUNT(*) FROM users) AS users')) {
      return [[{ users: 2, courses: 1, lessons: 1, questions: 1, quiz_attempts: 0 }] as T, []];
    }

    if (normalized.includes('FROM users') && normalized.includes('session_token = ?')) {
      const user = USERS_BY_HASH.get(String(params[0] || ''));
      return [[...(user ? [user] : [])] as T, []];
    }

    if (normalized.includes('SELECT id, full_name, email, status') && normalized.includes('FROM users') && normalized.includes("role = 'student'")) {
      const userId = Number(params[0]);
      const student = [...USERS_BY_HASH.values()].find((user) => Number(user.id) === userId && user.role === 'student');
      return [[...(student ? [student] : [])] as T, []];
    }

    if (normalized.includes('SELECT id, email FROM users WHERE email = ? LIMIT 1')) {
      return [[] as T, []];
    }

    if (normalized.includes('UPDATE users SET full_name = ?, avatar_key = ? WHERE id = ?')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('SELECT id, full_name, email, role, status, created_at') && normalized.includes('FROM users') && normalized.includes('WHERE 1 = 1')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM quiz_attempts qa') && normalized.includes('WHERE qa.user_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM quiz_attempts qa') && normalized.includes('WHERE qa.id = ? AND qa.user_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('SELECT plans.name AS plan_name') && normalized.includes('FROM user_subscriptions us')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM lessons l') && normalized.includes('WHERE l.id = ?')) {
      return [[{
        id: Number(params[0]),
        course_id: 10,
        topic_id: 20,
        subtopic_id: null,
        lesson_title: 'Accessible lesson',
        lesson_content: 'Lesson content',
        video_url: null,
        is_free: 1,
        status: 'active',
        created_at: null,
        course_title: 'Course',
        topic_name: 'Topic',
        subtopic_name: null,
      }] as T, []];
    }

    if (normalized.includes('FROM lessons') && normalized.includes("WHERE id = ? AND status = 'active'")) {
      return [[{
        id: Number(params[0]),
        course_id: 10,
        topic_id: 20,
        subtopic_id: 30,
        lesson_title: 'Accessible lesson',
        video_url: null,
        is_free: 1,
        status: 'active',
      }] as T, []];
    }

    if (normalized.includes('FROM user_subscriptions us') && normalized.includes('subscription_features')) {
      return [[{
        feature_key: 'lessons_access_full',
        plan_slug: 'test-full-access',
        access_scope: 'all',
        course_ids_json: null,
        lesson_ids_json: null,
      }] as T, []];
    }

    if (normalized.includes('SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses WHERE status =')) {
      return [[] as T, []];
    }

    if (normalized.includes('INSERT INTO student_lesson_progress')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM lesson_annotations') && normalized.includes('WHERE lesson_id = ? AND user_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM lesson_annotations') && normalized.includes('WHERE id = ?')) {
      return [[{
        id: Number(params[0]),
        lesson_id: 10,
        user_id: 200,
        type: 'note',
        selected_text: 'private selection',
        start_offset: 0,
        end_offset: 7,
        color: '#fff59d',
        note_text: 'other student private note',
        created_at: null,
        updated_at: null,
      }] as T, []];
    }

    if (normalized.includes('FROM plans') && normalized.includes('WHERE 1 = 1')) {
      const planId = params.find((value) => Number(value) === 1);
      if (params.length > 0 && !planId) {
        return [[] as T, []];
      }
      return [[{
        id: 1,
        name: 'Paid Plan',
        slug: 'paid-plan',
        description: 'Test paid plan',
        price: 100,
        regular_price: 100,
        offer_price: null,
        offer_enabled: 0,
        currency: 'LKR',
        billing_period: 'month',
        duration_days: 30,
        features_json: '[]',
        status: 'active',
        sort_order: 1,
        recommended: 0,
        created_at: null,
        updated_at: null,
      }] as T, []];
    }

    if (normalized.includes('FROM subscription_features') && normalized.includes('WHERE 1 = 1')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM subscription_plan_features') && normalized.includes('WHERE plan_id IN')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM study_bookmarks b')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM quizzes q') && normalized.includes("WHERE q.id = ? AND q.status = 'active'")) {
      return [[{
        id: Number(params[0]),
        course_id: 10,
        topic_id: 20,
        subtopic_id: 30,
        lesson_id: 10,
        subtopic: '',
        is_general: 0,
        is_free: 1,
        exam_mode_only: 0,
        student_title: 'Security quiz',
        display_title_mode: 'title',
        quiz_title: 'Security quiz',
        quiz_description: '',
        total_questions: 1,
        total_marks: 100,
        time_limit: 10,
        hide_time_limit: 0,
        passing_marks: 45,
        hide_passing_marks: 0,
        status: 'active',
        course_title: 'Course',
        subject_name: 'Subject',
        topic_name: 'Topic',
        lesson_title: 'Lesson',
      }] as T, []];
    }

    if (normalized.includes('FROM questions q') && normalized.includes('INNER JOIN question_quizzes qq') && normalized.includes('WHERE qq.quiz_id = ? AND q.status =')) {
      return [[{
        id: 701,
        course_id: 10,
        topic_id: 20,
        subtopic: '',
        category: 'mock',
        question_type: 'sba',
        question_text: 'Security question',
        explanation: '',
        status: 'active',
      }] as T, []];
    }

    if (normalized.includes('FROM questions q') && normalized.includes('INNER JOIN question_quizzes qq') && normalized.includes('WHERE qq.quiz_id = ? AND q.id = ?')) {
      return [[{
        id: Number(params[1]),
        course_id: 10,
        topic_id: 20,
        subtopic: '',
        category: 'mock',
        question_type: 'sba',
        question_text: 'Security question',
        explanation: '',
        status: 'active',
      }] as T, []];
    }

    if (normalized.includes('FROM question_options') && normalized.includes('WHERE question_id IN')) {
      return [[
        { id: 801, question_id: 701, option_label: 'A', option_text: 'Correct', is_correct: 1, why_incorrect: '' },
        { id: 802, question_id: 701, option_label: 'B', option_text: 'Wrong', is_correct: 0, why_incorrect: 'Wrong' },
      ] as T, []];
    }

    if (normalized.includes('FROM question_options') && normalized.includes('WHERE question_id = ?')) {
      return [[
        { id: 801, question_id: Number(params[0]), option_label: 'A', option_text: 'Correct', is_correct: 1, why_incorrect: '' },
        { id: 802, question_id: Number(params[0]), option_label: 'B', option_text: 'Wrong', is_correct: 0, why_incorrect: 'Wrong' },
      ] as T, []];
    }

    if (normalized.includes('FROM question_theory_recaps') && normalized.includes('WHERE question_id IN')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM practice_sessions') && normalized.includes('WHERE user_id = ? AND quiz_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('INSERT INTO practice_sessions')) {
      return [{ insertId: 333, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM practice_answers') && normalized.includes('WHERE practice_session_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('INSERT INTO quiz_attempts')) {
      return [{ insertId: 999, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('INSERT INTO student_answers')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('UPDATE quiz_attempts SET correct_answers')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes("SELECT id FROM quizzes WHERE id = ? AND status = 'active' LIMIT 1")) {
      return [[{ id: Number(params[0]) }] as T, []];
    }

    if (normalized.includes('SELECT id FROM study_bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ? LIMIT 1')) {
      return [[] as T, []];
    }

    if (normalized.includes('INSERT INTO study_bookmarks')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('SELECT * FROM question_theory_recaps WHERE question_id = ? LIMIT 1')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM subscription_requests') && normalized.includes("status = 'pending'")) {
      return [[] as T, []];
    }

    if (normalized.includes('INSERT IGNORE INTO system_settings')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes("SELECT setting_value FROM system_settings WHERE setting_key = 'subscription_invoice_next' FOR UPDATE")) {
      return [[{ setting_value: '1122' }] as T, []];
    }

    if (normalized.includes("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'subscription_invoice_next'")) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM system_settings') && normalized.includes('setting_key IN')) {
      const rows = params
        .map((key) => String(key))
        .filter((key) => TEST_SETTINGS[key] !== undefined)
        .map((key) => ({ setting_key: key, setting_value: TEST_SETTINGS[key], updated_at: null }));
      return [rows as T, []];
    }

    if (normalized.includes('FROM system_settings') && normalized.includes('setting_key = ?')) {
      const key = String(params[0] || '');
      return [[...(TEST_SETTINGS[key] !== undefined ? [{ setting_value: TEST_SETTINGS[key] }] : [])] as T, []];
    }

    if (normalized.includes('SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1')) {
      const orderId = String(params[0] || '');
      if (orderId === 'INV-VALID' || orderId === 'INV-REPLAY') {
        return [[{
          id: orderId === 'INV-REPLAY' ? 902 : 901,
          provider: 'payhere',
          order_id: orderId,
          invoice_id: orderId,
          user_id: 100,
          plan_id: 1,
          amount: 100,
          currency: 'LKR',
          coupon_code: null,
          discount_amount: 0,
          order_note: null,
          access_scope: 'all',
          course_ids_json: '[]',
          lesson_ids_json: '[]',
          status: orderId === 'INV-REPLAY' ? 'paid' : 'initiated',
          subscription_id: orderId === 'INV-REPLAY' ? 77 : null,
        }] as T, []];
      }
      return [[] as T, []];
    }

    if (normalized.includes('INSERT INTO payment_transactions')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('UPDATE payment_transactions SET status = ?')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('INSERT INTO subscription_audit_events')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM push_subscriptions') && normalized.includes('WHERE user_id = ?') && normalized.includes('ORDER BY updated_at DESC')) {
      return [[{ delivery_mode: 'both', enabled: 1 }] as T, []];
    }

    if (normalized.includes('SELECT id FROM native_push_tokens WHERE user_id = ? AND enabled = 1 LIMIT 1')) {
      return [[{ id: 88 }] as T, []];
    }

    if (normalized.includes('UPDATE push_subscriptions SET delivery_mode = ?, enabled = ? WHERE user_id = ?')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('INSERT INTO native_push_tokens')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('UPDATE native_push_tokens SET enabled = 0')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM announcements a') && normalized.includes('announcement_reads ar')) {
      return [[{
        id: 10,
        title: 'Exam window',
        body: 'A new exam window is open.',
        target_role: 'student',
        status: 'published',
        publish_at: null,
        created_at: '2026-05-23 10:00:00',
        created_by: 400,
        created_by_name: 'Admin',
        read_id: null,
      }] as T, []];
    }

    if (normalized.includes('INSERT IGNORE INTO announcement_reads')) {
      return [{ insertId: 1, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM user_subscriptions us') && normalized.includes('LEFT JOIN plans p')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM quiz_attempts qa') && normalized.includes('GROUP BY q.topic_id')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM study_planner_tasks') && normalized.includes('WHERE user_id = ?')) {
      return [[{
        id: 30,
        user_id: Number(params[0]),
        title: 'Owned task',
        description: 'Only this student can see it',
        due_date: null,
        status: 'todo',
        sort_order: 0,
        created_at: null,
        updated_at: null,
      }] as T, []];
    }

    if (normalized.includes('INSERT INTO study_planner_tasks')) {
      return [{ insertId: 31, affectedRows: 1 } as T, []];
    }

    if (normalized.includes('SELECT id FROM study_planner_tasks WHERE id = ? AND user_id = ? LIMIT 1')) {
      return [[...(Number(params[0]) === 30 && Number(params[1]) === 100 ? [{ id: 30 }] : [])] as T, []];
    }

    if (normalized.includes('UPDATE study_planner_tasks SET')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('DELETE FROM study_planner_tasks WHERE id = ? AND user_id = ?')) {
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalized.includes('FROM ai_illustrated_notes n')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM smart_notes WHERE id = ? AND user_id = ?')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM questions q')) {
      return [[] as T, []];
    }

    if (normalized.includes('FROM quizzes')) {
      return [[] as T, []];
    }

    throw new Error(`Unexpected SQL in security e2e test: ${normalized}`);
  }

  async query<T = unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    return this.execute<T>(sql, params);
  }

  async getConnection() {
    return {
      execute: this.execute.bind(this),
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
    };
  }

  reset() {
    this.calls = [];
  }

  findCall(pattern: RegExp) {
    return this.calls.find((call) => pattern.test(call.sql.replace(/\s+/g, ' ')));
  }
}

let app: INestApplication;
const db = new SecurityE2eDb();

async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE_CONNECTION)
    .useValue(db)
    .overrideProvider(SchemaSyncService)
    .useValue({ onModuleInit: async () => undefined })
    .compile();

  app = moduleRef.createNestApplication({ bodyParser: false });
  await configureApp(app);
  await app.init();
}

async function closeApp() {
  await app?.close();
}

function auth(token: string) {
  return `Bearer ${token}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function md5Upper(value: string) {
  return createHash('md5').update(value).digest('hex').toUpperCase();
}

function payHereNotificationHash(input: {
  merchantId?: string;
  orderId?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  secret?: string;
}) {
  const secretHash = md5Upper(input.secret || PAYHERE_SECRET);
  return md5Upper(`${input.merchantId || PAYHERE_MERCHANT_ID}${input.orderId || 'INV-VALID'}${input.amount || '100.00'}${input.currency || 'LKR'}${input.statusCode || '2'}${secretHash}`);
}

function payHerePayload(overrides: Record<string, string> = {}) {
  const payload = {
    merchant_id: PAYHERE_MERCHANT_ID,
    order_id: 'INV-VALID',
    payhere_amount: '100.00',
    payhere_currency: 'LKR',
    status_code: '2',
    payment_id: 'PAY-123',
    method: 'VISA',
    ...overrides,
  };
  return {
    ...payload,
    md5sig: Object.prototype.hasOwnProperty.call(overrides, 'md5sig') ? overrides.md5sig : payHereNotificationHash({
      merchantId: payload.merchant_id,
      orderId: payload.order_id,
      amount: payload.payhere_amount,
      currency: payload.payhere_currency,
      statusCode: payload.status_code,
    }),
  };
}

function assertNoSensitiveValueLeaked(body: unknown) {
  const raw = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['merchantsecret', 'merchant_secret', 'smtp', 'password', 'apikey', 'api_key', PAYHERE_SECRET.toLowerCase()]) {
    assert(!raw.includes(forbidden), `public response leaked sensitive token: ${forbidden}`);
  }
}

function expectUserScopedCall(pattern: RegExp, expectedUserId: number, message: string) {
  const call = db.findCall(pattern);
  assert(call, message);
  assert(call.params.includes(expectedUserId), `${message}; params must include authenticated user id ${expectedUserId}`);
  assert(!call.params.includes(200), `${message}; params must not include another student's id`);
  return call;
}

function tinyPngDataUrl() {
  return `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64')}`;
}

async function testStudentCannotAccessAdminSubscriptions() {
  db.reset();
  const response = await request(app.getHttpServer())
    .get('/api/subscriptions/admin')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(response.status, 403);
  assert(!db.findCall(/FROM user_subscriptions us INNER JOIN users/i), 'admin subscription data query must not run for students');

  db.reset();
  const adminBoundaryResponse = await request(app.getHttpServer())
    .get('/api/admin/subscriptions')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(adminBoundaryResponse.status, 401);
  assert(!db.findCall(/FROM user_subscriptions us INNER JOIN users/i), 'admin boundary subscription query must not run for students');
}

async function testStaffWithoutPermissionCannotAccessBillingAdminData() {
  db.reset();
  const response = await request(app.getHttpServer())
    .get('/api/subscriptions/admin')
    .set('Authorization', auth(TOKENS.contentEditor));

  assert.equal(response.status, 403);
  assert(!db.findCall(/FROM user_subscriptions us INNER JOIN users/i), 'admin subscription data query must not run for staff without subscriptions.manage');

  db.reset();
  const adminBoundaryResponse = await request(app.getHttpServer())
    .get('/api/admin/subscriptions')
    .set('Authorization', auth(TOKENS.contentEditor));

  assert.equal(adminBoundaryResponse.status, 403);
  assert(!db.findCall(/FROM user_subscriptions us INNER JOIN users/i), 'rewritten admin subscription query must not run for staff without subscriptions.manage');
}

async function testInactiveStaffCannotAccessPermissionProtectedRoutes() {
  db.reset();
  const response = await request(app.getHttpServer())
    .get('/api/subscriptions/admin')
    .set('Authorization', auth(TOKENS.inactiveFinance));

  assert.equal(response.status, 401);
  assert(!db.findCall(/FROM user_subscriptions us INNER JOIN users/i), 'permission-protected subscription data must not load for inactive staff');
}

async function testStudentCannotAccessAnotherStudentsQuizAttemptResultOrReview() {
  db.reset();
  const resultResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/result/777')
    .set('Cookie', [`lms_session=${encodeURIComponent(TOKENS.studentA)}`]);

  assert.equal(resultResponse.status, 404);
  const resultCall = db.findCall(/WHERE qa\.id = \? AND qa\.user_id = \?/);
  assert(resultCall, 'quiz result must query by attempt id and authenticated user id');
  assert.deepEqual(resultCall.params, [777, 100]);

  db.reset();
  const reviewResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/review/777')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(reviewResponse.status, 404);
  const reviewCall = db.findCall(/WHERE qa\.id = \? AND qa\.user_id = \?/);
  assert(reviewCall, 'quiz review must query by attempt id and authenticated user id');
  assert.deepEqual(reviewCall.params, [777, 100]);

  db.reset();
  const legacyResultResponse = await request(app.getHttpServer())
    .get('/api/results/777')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(legacyResultResponse.status, 404);
  const legacyResultCall = db.findCall(/WHERE qa\.id = \? AND qa\.user_id = \?/);
  assert(legacyResultCall, 'results detail route must query by attempt id and authenticated user id');
  assert.deepEqual(legacyResultCall.params, [777, 100]);

  db.reset();
  const legacyReviewResponse = await request(app.getHttpServer())
    .get('/api/results/review/777')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(legacyReviewResponse.status, 404);
  const legacyReviewCall = db.findCall(/WHERE qa\.id = \? AND qa\.user_id = \?/);
  assert(legacyReviewCall, 'results review route must query by attempt id and authenticated user id');
  assert.deepEqual(legacyReviewCall.params, [777, 100]);
}

async function testStudentCannotModifyAnotherStudentsLessonAnnotation() {
  db.reset();
  const listResponse = await request(app.getHttpServer())
    .get('/api/lessons/10/annotations')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(listResponse.status, 200);
  assert.deepEqual(listResponse.body, []);
  const listCall = db.findCall(/FROM lesson_annotations WHERE lesson_id = \? AND user_id = \?/);
  assert(listCall, 'annotation list must query by lesson id and authenticated user id');
  assert.deepEqual(listCall.params, [10, 100]);

  db.reset();
  const response = await request(app.getHttpServer())
    .patch('/api/lessons/10/annotations/55')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ color: '#fff59d', noteText: 'tamper' });

  assert.equal(response.status, 403);
  const annotationCall = db.findCall(/FROM lesson_annotations WHERE id = \?/);
  assert(annotationCall, 'annotation lookup must run by annotation id before ownership denial');
  assert.equal(annotationCall.params[0], 55);
}

async function testStudentCannotAccessAnotherStudentsSmartNote() {
  db.reset();
  const response = await request(app.getHttpServer())
    .get('/api/smart-notes/444')
    .set('Authorization', auth(TOKENS.studentA));

  assert.equal(response.status, 404);
  const smartNoteCall = db.findCall(/FROM smart_notes WHERE id = \? AND user_id = \?/);
  assert(smartNoteCall, 'smart note lookup must include authenticated user id');
  assert.deepEqual(smartNoteCall.params, [444, 100]);
}

async function testCrossSiteUnsafeCookieRequestsBlocked() {
  db.reset();
  const response = await request(app.getHttpServer())
    .post('/api/subscriptions/request')
    .set('Cookie', [`lms_session=${encodeURIComponent(TOKENS.studentA)}`])
    .set('Sec-Fetch-Site', 'cross-site')
    .send({ planId: 1 });

  assert.equal(response.status, 403);
  assert.match(String(response.body?.message || ''), /Cross-site cookie request was blocked/);
  assert.equal(db.calls.length, 0, 'cross-site unsafe cookie request must be blocked before authentication or database access');
}

async function testCsrfAndCorsControls() {
  await testCrossSiteUnsafeCookieRequestsBlocked();

  db.reset();
  const preflightResponse = await request(app.getHttpServer())
    .options('/api/auth/login')
    .set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(preflightResponse.status, 204);
  assert.equal(preflightResponse.headers['access-control-allow-origin'], undefined);
  assert.equal(db.calls.length, 0, 'disallowed CORS preflight must not touch the database');

  db.reset();
  const unsafeResponse = await request(app.getHttpServer())
    .post('/api/auth/forgot-password')
    .set('Origin', 'https://evil.example')
    .send({ email: 'student@example.test' });

  assert.equal(unsafeResponse.status, 403);
  assert.equal(unsafeResponse.headers['access-control-allow-origin'], undefined);
  assert.match(String(unsafeResponse.body?.message || ''), /Request origin is not allowed/);
  assert.equal(db.calls.length, 0, 'disallowed unsafe CORS request must be blocked before controller/database access');

  db.reset();
  const allowedResponse = await request(app.getHttpServer())
    .get('/api/settings/public')
    .set('Origin', TEST_ALLOWED_ORIGIN);

  assert.equal(allowedResponse.status, 200);
  assert.equal(allowedResponse.headers['access-control-allow-origin'], TEST_ALLOWED_ORIGIN);
  assert.equal(allowedResponse.headers.vary, 'Origin');
  assertNoSensitiveValueLeaked(allowedResponse.body);
}

async function testSecurityHeadersPresent() {
  db.reset();
  const response = await request(app.getHttpServer())
    .get('/api/settings/public')
    .set('Origin', TEST_ALLOWED_ORIGIN);

  assert.equal(response.status, 200);
  assert.match(String(response.headers['content-security-policy'] || ''), /frame-ancestors 'none'/);
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.match(String(response.headers['permissions-policy'] || ''), /camera=\(\)/);
  assert.equal(response.headers['cross-origin-resource-policy'], 'same-site');
}

async function testSqlInjectionPayloadsRemainParameterizedThroughHttpFilters() {
  const payload = "%' OR 1=1; DROP TABLE users; --";

  db.reset();
  const questionsResponse = await request(app.getHttpServer())
    .get('/api/questions')
    .query({ search: payload, status: 'active', type: 'sba', sort: 'id;DROP TABLE users' })
    .set('Authorization', auth(TOKENS.admin));

  assert.equal(questionsResponse.status, 200);
  const questionCall = db.findCall(/FROM questions q/);
  assert(questionCall, 'question search query must run');
  assert(!questionCall.sql.includes(payload), 'question SQL text must not contain payload');
  assert(questionCall.params.includes(`%${payload}%`), 'question payload must be passed as a parameter');
  assert(!/DROP TABLE|OR 1=1/.test(questionCall.sql), 'question SQL text must not contain injected logic');

  db.reset();
  const quizzesResponse = await request(app.getHttpServer())
    .get('/api/quizzes')
    .query({ search: payload, status: 'active', sort: 'id;DROP TABLE quizzes' })
    .set('Authorization', auth(TOKENS.admin));

  assert.equal(quizzesResponse.status, 200);
  const quizCall = db.findCall(/FROM quizzes/);
  assert(quizCall, 'quiz search query must run');
  assert(!quizCall.sql.includes(payload), 'quiz SQL text must not contain payload');
  assert(quizCall.params.includes(`%${payload}%`), 'quiz payload must be passed as a parameter');
  assert(!/DROP TABLE|OR 1=1/.test(quizCall.sql), 'quiz SQL text must not contain injected logic');

  db.reset();
  const usersResponse = await request(app.getHttpServer())
    .get('/api/users')
    .query({ search: payload, status: 'active', role: 'student', sort: 'role;DROP TABLE users' })
    .set('Authorization', auth(TOKENS.admin));

  assert.equal(usersResponse.status, 200);
  const usersCall = db.findCall(/FROM users WHERE 1 = 1/);
  assert(usersCall, 'user search/filter query must run');
  assert(!usersCall.sql.includes(payload), 'user SQL text must not contain payload');
  assert(usersCall.params.includes(`%${payload}%`), 'user payload must be passed as a parameter');
  assert(!/DROP TABLE|OR 1=1/.test(usersCall.sql), 'user SQL text must not contain injected logic');
}

async function testMaliciousFileUploadWithFakeMimeRejected() {
  db.reset();
  const fakePngDataUrl = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
  const response = await request(app.getHttpServer())
    .post('/api/subscriptions/manual-payment/request')
    .set('Authorization', auth(TOKENS.studentA))
    .send({
      planId: 1,
      proofDataUrl: fakePngDataUrl,
      proofMimeType: 'image/png',
      billingName: 'Student A',
      billingEmail: 'a@example.test',
    });

  assert.equal(response.status, 400);
  assert.match(String(response.body?.message || ''), /contents do not match/);
  assert(!db.findCall(/INSERT INTO subscription_requests/i), 'malicious payment proof must be rejected before creating a subscription request');
}

async function testPaymentProofUploadAndDownloadProtections() {
  await testMaliciousFileUploadWithFakeMimeRejected();

  db.reset();
  const payHereInitiateResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/initiate')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ planId: 1, billingName: 'Student A', billingEmail: 'a@example.test', userId: 200 });
  assert.equal(payHereInitiateResponse.status, 201);
  assert.equal(payHereInitiateResponse.body?.fields?.custom_1, '100');
  const transactionInsertCall = db.findCall(/INSERT INTO payment_transactions/i);
  assert(transactionInsertCall, 'PayHere initiation must create a payment transaction');
  assert.equal(transactionInsertCall.params[2], 100);
  assert(!transactionInsertCall.params.includes(200), 'PayHere initiation must not accept another student id from the request body');

  db.reset();
  const unsupportedMimeResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/manual-payment/request')
    .set('Authorization', auth(TOKENS.studentA))
    .send({
      planId: 1,
      proofDataUrl: `data:text/html;base64,${Buffer.from('<b>not a proof</b>').toString('base64')}`,
      proofMimeType: 'text/html',
    });
  assert.equal(unsupportedMimeResponse.status, 400);
  assert.match(String(unsupportedMimeResponse.body?.message || ''), /PNG, JPG, WEBP, or PDF/);

  db.reset();
  const mismatchedSignatureResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/manual-payment/request')
    .set('Authorization', auth(TOKENS.studentA))
    .send({
      planId: 1,
      proofDataUrl: tinyPngDataUrl().replace('image/png', 'application/pdf'),
      proofMimeType: 'application/pdf',
    });
  assert.equal(mismatchedSignatureResponse.status, 400);
  assert.match(String(mismatchedSignatureResponse.body?.message || ''), /contents do not match/);

  db.reset();
  const oversizedResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/manual-payment/request')
    .set('Authorization', auth(TOKENS.studentA))
    .send({
      planId: 1,
      proofDataUrl: `data:image/png;base64,${'A'.repeat(4_500_001)}`,
      proofMimeType: 'image/png',
    });
  assert.equal(oversizedResponse.status, 400);
  assert.match(String(oversizedResponse.body?.message || ''), /too large/);

  db.reset();
  const traversalResponse = await request(app.getHttpServer())
    .get('/api/uploads/payment-proofs/..%2Fsecret.txt')
    .set('Authorization', auth(TOKENS.admin));
  assert([400, 404].includes(traversalResponse.status), `path traversal should be blocked, got ${traversalResponse.status}`);

  db.reset();
  const noBillingPermissionResponse = await request(app.getHttpServer())
    .get('/api/uploads/payment-proofs/test-proof.png')
    .set('Authorization', auth(TOKENS.contentEditor));
  assert.equal(noBillingPermissionResponse.status, 403);

  const proofDir = join(process.cwd(), 'uploads', 'payment-proofs');
  const proofPath = join(proofDir, 'security-e2e-proof.txt');
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(proofPath, 'proof');
  try {
    db.reset();
    const downloadResponse = await request(app.getHttpServer())
      .get('/api/uploads/payment-proofs/security-e2e-proof.txt')
      .set('Authorization', auth(TOKENS.admin));
    assert.equal(downloadResponse.status, 200);
    assert.match(String(downloadResponse.headers['content-disposition'] || ''), /^attachment;/);
    assert.equal(downloadResponse.headers['x-content-type-options'], 'nosniff');
  } finally {
    rmSync(proofPath, { force: true });
  }
}

async function testPayHereWebhookValidation() {
  db.reset();
  const missingHashResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/notify')
    .send(payHerePayload({ md5sig: '' }));
  assert.equal(missingHashResponse.status, 400);
  assert.match(String(missingHashResponse.body?.message || ''), /incomplete|signature/i);
  assert(!db.findCall(/UPDATE payment_transactions/i), 'missing hash must not update payment transactions');

  db.reset();
  const invalidHashResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/notify')
    .send(payHerePayload({ md5sig: '00000000000000000000000000000000' }));
  assert.equal(invalidHashResponse.status, 400);
  assert.match(String(invalidHashResponse.body?.message || ''), /verification failed/i);
  assert(!db.findCall(/UPDATE payment_transactions/i), 'invalid hash must not update payment transactions');

  db.reset();
  const malformedResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/notify')
    .send(payHerePayload({ payhere_amount: '100.00 OR 1=1' }));
  assert.equal(malformedResponse.status, 400);
  assert.match(String(malformedResponse.body?.message || ''), /amount is invalid/i);

  db.reset();
  const replayPayload = payHerePayload({ order_id: 'INV-REPLAY' });
  replayPayload.md5sig = payHereNotificationHash({ orderId: 'INV-REPLAY' });
  const replayResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/notify')
    .send(replayPayload);
  assert.equal(replayResponse.status, 400);
  assert.match(String(replayResponse.body?.message || ''), /already processed/i);

  db.reset();
  const validResponse = await request(app.getHttpServer())
    .post('/api/subscriptions/payhere/notify')
    .send(payHerePayload());
  assert.equal(validResponse.status, 201);
  assert.equal(validResponse.body?.ok, true);
  const updateCall = db.findCall(/UPDATE payment_transactions SET status = \?/i);
  assert(updateCall, 'valid PayHere webhook must update the matching transaction');
  assert.equal(updateCall.params[0], 'paid');
}

async function expectBlocked(method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, token: string, body: Record<string, unknown> = {}) {
  const req = request(app.getHttpServer())[method](path).set('Authorization', auth(token));
  if (['post', 'patch', 'put', 'delete'].includes(method)) {
    req.send(body);
  }
  const response = await req;
  assert([401, 403].includes(response.status), `${method.toUpperCase()} ${path} should be blocked, got ${response.status}`);
  return response;
}

async function testSettingsRoutesRequireSettingsManageAndPublicSettingsAreSafe() {
  db.reset();
  await expectBlocked('get', '/api/settings/payments', TOKENS.studentA);
  await expectBlocked('put', '/api/settings/general', TOKENS.studentA, { whatsappNumber: '+94771111111' });
  await expectBlocked('get', '/api/settings/payments', TOKENS.contentEditor);
  await expectBlocked('put', '/api/settings/general', TOKENS.contentEditor, { whatsappNumber: '+94771111111' });
  assert(!db.findCall(/UPDATE system_settings/i), 'settings update must not run for unauthorized users');

  db.reset();
  const publicResponse = await request(app.getHttpServer()).get('/api/settings/public');
  assert.equal(publicResponse.status, 200);
  assertNoSensitiveValueLeaked(publicResponse.body);
}

async function testUsersAdminRoutesRequireStudentsManage() {
  const userRouteChecks: Array<['get' | 'post' | 'patch' | 'delete', string, Record<string, unknown>?]> = [
    ['get', '/api/users'],
    ['post', '/api/users', { fullName: 'Blocked User', email: 'blocked@example.test', password: 'Stronger1234', role: 'student', status: 'active' }],
    ['patch', '/api/users/900', { fullName: 'Blocked Update' }],
    ['patch', '/api/users/900/status', { status: 'inactive' }],
    ['delete', '/api/users/900'],
  ];

  for (const [method, path, body] of userRouteChecks) {
    db.reset();
    await expectBlocked(method, path, TOKENS.studentA, body || {});
    await expectBlocked(method, path, TOKENS.contentEditor, body || {});
    assert(!db.findCall(/FROM users WHERE 1 = 1/i), `${method.toUpperCase()} ${path} must not run user listing query`);
    assert(!db.findCall(/INSERT INTO users/i), `${method.toUpperCase()} ${path} must not create users`);
    assert(!db.findCall(/UPDATE users SET/i), `${method.toUpperCase()} ${path} must not update users`);
    assert(!db.findCall(/DELETE FROM users/i), `${method.toUpperCase()} ${path} must not delete users`);
  }
}

async function testPlansAdminRoutesRequirePlansManage() {
  const planRouteChecks: Array<['get' | 'post' | 'patch' | 'delete', string, Record<string, unknown>?]> = [
    ['get', '/api/plans/admin'],
    ['get', '/api/plans/features'],
    ['post', '/api/plans', { name: 'Blocked Plan', regularPrice: 100, durationDays: 30, status: 'active' }],
    ['post', '/api/plans/features', { featureName: 'Blocked Feature', featureKey: 'blocked_feature' }],
    ['patch', '/api/plans/1', { name: 'Blocked Update' }],
    ['patch', '/api/plans/features/1', { featureName: 'Blocked Feature Update' }],
    ['delete', '/api/plans/1'],
  ];

  for (const [method, path, body] of planRouteChecks) {
    db.reset();
    await expectBlocked(method, path, TOKENS.studentA, body || {});
    await expectBlocked(method, path, TOKENS.contentEditor, body || {});
    assert(!db.findCall(/INSERT INTO plans/i), `${method.toUpperCase()} ${path} must not create plans`);
    assert(!db.findCall(/UPDATE plans/i), `${method.toUpperCase()} ${path} must not update plans`);
    assert(!db.findCall(/DELETE FROM plans/i), `${method.toUpperCase()} ${path} must not delete plans`);
    assert(!db.findCall(/INSERT INTO subscription_features/i), `${method.toUpperCase()} ${path} must not create plan features`);
    assert(!db.findCall(/UPDATE subscription_features/i), `${method.toUpperCase()} ${path} must not update plan features`);
  }
}

async function testPushNativeTokenOwnershipAndNoHashLeak() {
  db.reset();
  const settingsResponse = await request(app.getHttpServer())
    .get('/api/push/settings')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(settingsResponse.status, 200);
  assert.equal(JSON.stringify(settingsResponse.body).includes('token'), false, 'push settings must not leak raw tokens or token hashes');
  expectUserScopedCall(/FROM push_subscriptions WHERE user_id = \?/i, 100, 'push settings must query by authenticated user id');
  expectUserScopedCall(/FROM native_push_tokens WHERE user_id = \?/i, 100, 'native token enabled check must query by authenticated user id');

  db.reset();
  const updateResponse = await request(app.getHttpServer())
    .put('/api/push/settings')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ deliveryMode: 'both', userId: 200 });
  assert.equal(updateResponse.status, 200);
  const updateCall = expectUserScopedCall(/UPDATE push_subscriptions SET delivery_mode = \?, enabled = \? WHERE user_id = \?/i, 100, 'push settings update must use authenticated user id');
  assert.equal(updateCall.params[2], 100);

  db.reset();
  const nativeToken = 'student-a-native-token';
  const saveResponse = await request(app.getHttpServer())
    .post('/api/push/native-token')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ token: nativeToken, platform: 'ios', deliveryMode: 'outside', userId: 200 });
  assert.equal(saveResponse.status, 201);
  assert.equal(JSON.stringify(saveResponse.body).includes(nativeToken), false, 'native token save response must not leak raw token');
  assert.equal(JSON.stringify(saveResponse.body).includes(sha256(nativeToken)), false, 'native token save response must not leak token hash');
  const insertCall = expectUserScopedCall(/INSERT INTO native_push_tokens/i, 100, 'native token insert must use authenticated user id');
  assert.equal(insertCall.params[1], sha256(nativeToken));

  db.reset();
  const otherStudentToken = 'student-b-native-token';
  const deleteResponse = await request(app.getHttpServer())
    .delete('/api/push/native-token')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ token: otherStudentToken, userId: 200 });
  assert.equal(deleteResponse.status, 200);
  const deleteCall = expectUserScopedCall(/UPDATE native_push_tokens SET enabled = 0/i, 100, 'native token delete must scope by authenticated user id');
  assert.equal(deleteCall.params[1], sha256(otherStudentToken));
}

async function testStudentWorkspaceOwnership() {
  db.reset();
  const plannerListResponse = await request(app.getHttpServer())
    .get('/api/study-planner')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(plannerListResponse.status, 200);
  expectUserScopedCall(/FROM study_planner_tasks\s+WHERE user_id = \?/i, 100, 'planner list must query by authenticated student');

  db.reset();
  const plannerCreateResponse = await request(app.getHttpServer())
    .post('/api/study-planner')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ title: 'Owned task', userId: 200 });
  assert.equal(plannerCreateResponse.status, 201);
  const plannerInsertCall = expectUserScopedCall(/INSERT INTO study_planner_tasks/i, 100, 'planner create must write authenticated student id');
  assert.equal(plannerInsertCall.params[0], 100);

  db.reset();
  const plannerUpdateResponse = await request(app.getHttpServer())
    .patch('/api/study-planner/900')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ title: 'Tamper other task', userId: 200 });
  assert.equal(plannerUpdateResponse.status, 404);
  const plannerLookupCall = db.findCall(/SELECT id FROM study_planner_tasks WHERE id = \? AND user_id = \?/i);
  assert(plannerLookupCall, 'planner update must look up by task id and authenticated user id');
  assert.deepEqual(plannerLookupCall.params, [900, 100]);
  assert(!db.findCall(/UPDATE study_planner_tasks SET/i), 'planner update must not run for another student task');

  db.reset();
  const plannerDeleteResponse = await request(app.getHttpServer())
    .delete('/api/study-planner/900')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(plannerDeleteResponse.status, 200);
  const plannerDeleteCall = db.findCall(/DELETE FROM study_planner_tasks WHERE id = \? AND user_id = \?/i);
  assert(plannerDeleteCall, 'planner delete must scope delete by authenticated user id');
  assert.deepEqual(plannerDeleteCall.params, [900, 100]);

  db.reset();
  const notificationsResponse = await request(app.getHttpServer())
    .get('/api/notifications')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(notificationsResponse.status, 200);
  expectUserScopedCall(/announcement_reads ar ON ar\.announcement_id = a\.id AND ar\.user_id = \?/i, 100, 'notification read join must use authenticated user id');
  expectUserScopedCall(/FROM user_subscriptions us LEFT JOIN plans p/i, 100, 'derived subscription notifications must use authenticated user id');
  expectUserScopedCall(/FROM quiz_attempts qa INNER JOIN quizzes q/i, 100, 'derived weak-topic notifications must use authenticated user id');

  db.reset();
  const markReadResponse = await request(app.getHttpServer())
    .post('/api/notifications/77/read')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(markReadResponse.status, 201);
  const markReadCall = db.findCall(/INSERT IGNORE INTO announcement_reads/i);
  assert(markReadCall, 'notification read marker must be inserted');
  assert.deepEqual(markReadCall.params, [77, 100]);

}

async function testHealthProfileAndPublicCatalogRoutes() {
  db.reset();
  const healthResponse = await request(app.getHttpServer()).get('/api/health');
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.body?.ok, true);
  assert.equal(healthResponse.body?.service, 'lms-api');
  assert.equal(healthResponse.body?.database, undefined, 'public health response must stay low-detail');

  db.reset();
  const readyResponse = await request(app.getHttpServer()).get('/api/health/ready');
  assert.equal(readyResponse.status, 200);
  assert.equal(readyResponse.body?.checks?.database?.ok, true);

  db.reset();
  const metricsDeniedResponse = await request(app.getHttpServer()).get('/api/health/metrics');
  assert.equal(metricsDeniedResponse.status, 401);
  assert(!db.findCall(/COUNT\(\*\) FROM users/i), 'metrics totals must not load without the health token');

  db.reset();
  const metricsAllowedResponse = await request(app.getHttpServer())
    .get('/api/health/metrics')
    .set('x-health-token', HEALTH_METRICS_TOKEN);
  assert.equal(metricsAllowedResponse.status, 200);
  assert.equal(metricsAllowedResponse.body?.totals?.users, 2);

  db.reset();
  const profileResponse = await request(app.getHttpServer())
    .patch('/api/auth/profile')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ fullName: 'Student A Updated', avatarKey: 'blue-tie', userId: 200 });
  assert.equal(profileResponse.status, 200);
  const profileCall = db.findCall(/UPDATE users SET full_name = \?, avatar_key = \? WHERE id = \?/i);
  assert(profileCall, 'profile update must write the authenticated user row');
  assert.deepEqual(profileCall.params, ['Student A Updated', 'blue-tie', 100]);

  db.reset();
  const plansResponse = await request(app.getHttpServer()).get('/api/plans');
  assert.equal(plansResponse.status, 200);
  const publicPlansRaw = JSON.stringify(plansResponse.body).toLowerCase();
  assert(!publicPlansRaw.includes('merchant'), 'public plans must not leak merchant settings');
  assert(!publicPlansRaw.includes('payment_proof'), 'public plans must not leak payment proof metadata');

  db.reset();
  const vapidResponse = await request(app.getHttpServer()).get('/api/push/vapid-public-key');
  assert.equal(vapidResponse.status, 200);
  assert.equal(vapidResponse.body?.enabled, false);
  assert.equal(vapidResponse.body?.publicKey, '');
}

async function testStudentLearningOwnershipAndEntitlementRoutes() {
  db.reset();
  const quizListResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/quizzes')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(quizListResponse.status, 200);
  const quizListCall = db.findCall(/FROM quizzes q/i);
  assert(quizListCall, 'quiz list query must run');
  assert(quizListCall.params.filter((param) => param === 100).length >= 4, 'quiz list subqueries must use authenticated student id');

  db.reset();
  const resultListResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/results')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(resultListResponse.status, 200);
  const resultListCall = db.findCall(/FROM quiz_attempts qa/i);
  assert(resultListCall, 'quiz result list query must run');
  assert.deepEqual(resultListCall.params, [100]);

  db.reset();
  const invalidQuizModeResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/quiz/501')
    .query({ mode: 'tampered' })
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(invalidQuizModeResponse.status, 400);

  db.reset();
  const practiceLoadResponse = await request(app.getHttpServer())
    .get('/api/quiz-attempts/quiz/501')
    .query({ mode: 'practice' })
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(practiceLoadResponse.status, 200);
  const practiceSessionInsertCall = db.findCall(/INSERT INTO practice_sessions/i);
  assert(practiceSessionInsertCall, 'practice quiz load must create a session when none exists');
  assert.deepEqual(practiceSessionInsertCall.params, [100, 501]);

  db.reset();
  const practiceSaveResponse = await request(app.getHttpServer())
    .post('/api/quiz-attempts/practice/501/save')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ questionId: 701, questionType: 'sba', selected: [801], questionIndex: 0, userId: 200 });
  assert.equal(practiceSaveResponse.status, 404);
  const practiceSessionLookupCall = db.findCall(/FROM practice_sessions/i);
  assert(practiceSessionLookupCall, 'practice save must look up the latest session by authenticated student and quiz');
  assert.deepEqual(practiceSessionLookupCall.params, [100, 501]);

  db.reset();
  const examSubmitResponse = await request(app.getHttpServer())
    .post('/api/quiz-attempts/exam/501/submit')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ answers: { 701: [801] }, userId: 200 });
  assert.equal(examSubmitResponse.status, 201);
  const examAttemptInsertCall = db.findCall(/INSERT INTO quiz_attempts/i);
  assert(examAttemptInsertCall, 'exam submit must create an attempt');
  assert.equal(examAttemptInsertCall.params[0], 100);
  assert.equal(examAttemptInsertCall.params[1], 501);
  assert(!examAttemptInsertCall.params.includes(200), 'exam submit must not accept another student id from the request body');

  db.reset();
  const staffPracticeSaveResponse = await request(app.getHttpServer())
    .post('/api/quiz-attempts/practice/501/save')
    .set('Authorization', auth(TOKENS.contentEditor))
    .send({ questionId: 701, questionType: 'sba', selected: [1], questionIndex: 0 });
  assert.equal(staffPracticeSaveResponse.status, 401);
  assert(!db.findCall(/practice_sessions/i), 'non-student practice save must not touch practice session tables');

  db.reset();
  const staffExamSubmitResponse = await request(app.getHttpServer())
    .post('/api/quiz-attempts/exam/501/submit')
    .set('Authorization', auth(TOKENS.contentEditor))
    .send({ answers: {} });
  assert.equal(staffExamSubmitResponse.status, 401);
  assert(!db.findCall(/INSERT INTO quiz_attempts/i), 'non-student exam submit must not create attempts');

  db.reset();
  const lessonResponse = await request(app.getHttpServer())
    .get('/api/lessons/student/10')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(lessonResponse.status, 200);
  expectUserScopedCall(/FROM user_subscriptions us/i, 100, 'student lesson access profile must use authenticated user id');

  db.reset();
  const progressResponse = await request(app.getHttpServer())
    .patch('/api/courses/student/lessons/10/progress')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ status: 'completed', progressPercent: 100, userId: 200 });
  assert.equal(progressResponse.status, 200);
  const progressCall = db.findCall(/INSERT INTO student_lesson_progress/i);
  assert(progressCall, 'lesson progress upsert must run');
  assert.equal(progressCall.params[0], 100);
  assert(!progressCall.params.includes(200), 'lesson progress must not accept another student id from the request body');

  db.reset();
  const coursesResponse = await request(app.getHttpServer())
    .get('/api/courses/student')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(coursesResponse.status, 200);

  db.reset();
  const bookmarksResponse = await request(app.getHttpServer())
    .get('/api/study-bookmarks')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(bookmarksResponse.status, 200);
  expectUserScopedCall(/FROM study_bookmarks b/i, 100, 'bookmark list must use authenticated student id');

  db.reset();
  const bookmarkToggleResponse = await request(app.getHttpServer())
    .post('/api/study-bookmarks/toggle')
    .set('Authorization', auth(TOKENS.studentA))
    .send({ itemType: 'quiz', itemId: 501, userId: 200 });
  assert.equal(bookmarkToggleResponse.status, 201);
  const bookmarkLookupCall = db.findCall(/SELECT id FROM study_bookmarks WHERE user_id = \?/i);
  assert(bookmarkLookupCall, 'bookmark toggle lookup must use authenticated user id');
  assert.equal(bookmarkLookupCall.params[0], 100);
  const bookmarkInsertCall = db.findCall(/INSERT INTO study_bookmarks/i);
  assert(bookmarkInsertCall, 'bookmark toggle insert must run for new bookmark');
  assert.equal(bookmarkInsertCall.params[0], 100);

  db.reset();
  const aiNoteResponse = await request(app.getHttpServer())
    .get('/api/ai-notes/99')
    .query({ engine: 'gemini' })
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(aiNoteResponse.status, 404);
  const aiNoteCall = db.findCall(/FROM ai_illustrated_notes n/i);
  assert(aiNoteCall, 'AI note detail query must run through student route');
  assert(aiNoteCall.params.includes(100), 'AI note progress join must use authenticated student id');
  assert(!aiNoteCall.params.includes(200), 'AI note route must not accept another student id');

  db.reset();
  const recapResponse = await request(app.getHttpServer())
    .get('/api/theory-recap/question/55')
    .set('Authorization', auth(TOKENS.studentA));
  assert.equal(recapResponse.status, 200);
  const recapCall = db.findCall(/question_theory_recaps WHERE question_id = \?/i);
  assert(recapCall, 'theory recap route must query by question id');
  assert.deepEqual(recapCall.params, [55]);
}

async function testRemainingAdminPermissionBoundaries() {
  const studentBlockedRoutes: Array<['get' | 'post' | 'patch' | 'put' | 'delete', string, Record<string, unknown>?]> = [
    ['get', '/api/lessons/meta'],
    ['get', '/api/lessons/admin'],
    ['post', '/api/lessons', { lessonTitle: 'Blocked' }],
    ['patch', '/api/lessons/1', { lessonTitle: 'Blocked' }],
    ['delete', '/api/lessons/1'],
    ['get', '/api/courses'],
    ['post', '/api/courses', { courseTitle: 'Blocked' }],
    ['patch', '/api/courses/1', { courseTitle: 'Blocked' }],
    ['delete', '/api/courses/1'],
    ['get', '/api/topics'],
    ['post', '/api/topics', { topicName: 'Blocked' }],
    ['patch', '/api/topics/1', { topicName: 'Blocked' }],
    ['delete', '/api/topics/1'],
    ['get', '/api/subtopics'],
    ['post', '/api/subtopics', { subtopicName: 'Blocked' }],
    ['patch', '/api/subtopics/1', { subtopicName: 'Blocked' }],
    ['delete', '/api/subtopics/1'],
    ['get', '/api/papers'],
    ['post', '/api/papers', { paperTitle: 'Blocked' }],
    ['patch', '/api/papers/1', { paperTitle: 'Blocked' }],
    ['delete', '/api/papers/1'],
    ['post', '/api/ai/generate-quiz', { topic: 'Blocked' }],
    ['post', '/api/ai-notes/generate', { text: 'This request should be blocked before AI execution.' }],
    ['get', '/api/ai-notes/admin'],
    ['post', '/api/ai-notes/admin', { title: 'Blocked' }],
    ['patch', '/api/ai-notes/admin/1', { title: 'Blocked' }],
    ['delete', '/api/ai-notes/admin/1'],
    ['put', '/api/theory-recap/question/55', { conceptName: 'Blocked' }],
    ['post', '/api/theory-recap/question/55/generate'],
    ['post', '/api/theory-recap/question/55/regenerate'],
    ['delete', '/api/theory-recap/question/55'],
    ['post', '/api/theory-recap/bulk-generate', { questionIds: [55] }],
    ['get', '/api/reports/admin'],
  ];

  for (const [method, path, body] of studentBlockedRoutes) {
    db.reset();
    await expectBlocked(method, path, TOKENS.studentA, body || {});
  }

  const staffBlockedRoutes: Array<['get' | 'post' | 'patch' | 'put' | 'delete', string, Record<string, unknown>?]> = [
    ['get', '/api/setup'],
    ['get', '/api/push/admin/status'],
    ['post', '/api/push/admin/send', { title: 'Blocked', body: 'Blocked' }],
    ['get', '/api/announcements/admin'],
    ['post', '/api/announcements/admin', { title: 'Blocked', body: 'Blocked' }],
    ['patch', '/api/announcements/admin/1', { title: 'Blocked', body: 'Blocked' }],
    ['delete', '/api/announcements/admin/1'],
    ['get', '/api/question-review/admin'],
    ['post', '/api/question-review/admin', { questionId: 1, reason: 'Blocked' }],
    ['patch', '/api/question-review/admin/1', { status: 'resolved' }],
  ];

  for (const [method, path, body] of staffBlockedRoutes) {
    db.reset();
    await expectBlocked(method, path, TOKENS.contentEditor, body || {});
  }
}

async function testRealMySqlSecurityIntegrationIfConfigured() {
  if (process.env.LMS_REAL_MYSQL_SECURITY_E2E !== '1') {
    console.log('Real MySQL security integration skipped: set LMS_REAL_MYSQL_SECURITY_E2E=1 and MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD or DB_HOST/DB_USER/DB_PASSWORD to allow creating and dropping a disposable test database.');
    return;
  }

  const user = process.env.MYSQL_USER || process.env.DB_USER;
  if (!user) {
    console.log('Real MySQL security integration skipped: missing MYSQL_USER or DB_USER for disposable database setup.');
    return;
  }

  const host = process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const password = process.env.MYSQL_PASSWORD ?? process.env.DB_PASSWORD ?? '';
  const database = `lms_security_e2e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const connection = await createConnection({ host, port, user, password, multipleStatements: false });

  try {
    await connection.execute(`CREATE DATABASE \`${database}\``);
    await connection.changeUser({ database });
    await connection.execute(`
      CREATE TABLE users (
        id INT PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(180) NOT NULL,
        role VARCHAR(40) NOT NULL,
        status VARCHAR(40) NOT NULL
      )
    `);
    await connection.execute(`
      CREATE TABLE study_planner_tasks (
        id INT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(180) NOT NULL,
        INDEX idx_study_planner_tasks_user (user_id)
      )
    `);
    await connection.execute(
      'INSERT INTO users (id, full_name, email, role, status) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      [100, 'Student A', 'a@example.test', 'student', 'active', 200, 'Student B', 'b@example.test', 'student', 'active']
    );
    await connection.execute(
      'INSERT INTO study_planner_tasks (id, user_id, title) VALUES (?, ?, ?)',
      [900, 200, 'Student B private task']
    );

    const injectionPayload = "%' OR 1=1; DROP TABLE users; --";
    const [searchRows] = await connection.execute(
      'SELECT id, email FROM users WHERE email LIKE ? ORDER BY id',
      [`%${injectionPayload}%`]
    );
    assert.equal((searchRows as unknown[]).length, 0, 'real MySQL parameterized search must not return injected rows');

    const [idorRows] = await connection.execute(
      'SELECT id FROM study_planner_tasks WHERE id = ? AND user_id = ? LIMIT 1',
      [900, 100]
    );
    assert.equal((idorRows as unknown[]).length, 0, 'real MySQL IDOR query must not return another student task');

    console.log('Real MySQL security integration passed.');
  } finally {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.end();
  }
}

async function main() {
  await createApp();
  try {
    await testStudentCannotAccessAdminSubscriptions();
    await testStaffWithoutPermissionCannotAccessBillingAdminData();
    await testInactiveStaffCannotAccessPermissionProtectedRoutes();
    await testStudentCannotAccessAnotherStudentsQuizAttemptResultOrReview();
    await testStudentCannotModifyAnotherStudentsLessonAnnotation();
    await testStudentCannotAccessAnotherStudentsSmartNote();
    await testCsrfAndCorsControls();
    await testSecurityHeadersPresent();
    await testSqlInjectionPayloadsRemainParameterizedThroughHttpFilters();
    await testPaymentProofUploadAndDownloadProtections();
    await testPayHereWebhookValidation();
    await testSettingsRoutesRequireSettingsManageAndPublicSettingsAreSafe();
    await testUsersAdminRoutesRequireStudentsManage();
    await testPlansAdminRoutesRequirePlansManage();
    await testPushNativeTokenOwnershipAndNoHashLeak();
    await testStudentWorkspaceOwnership();
    await testHealthProfileAndPublicCatalogRoutes();
    await testStudentLearningOwnershipAndEntitlementRoutes();
    await testRemainingAdminPermissionBoundaries();
    console.log('Security HTTP e2e checks passed with mocked DATABASE_CONNECTION.');
    console.log('Database boundary: mocked DATABASE_CONNECTION only; MySQL engine behavior, migrations, indexes, and transaction isolation are not covered by this e2e test.');
    await testRealMySqlSecurityIntegrationIfConfigured();
  } finally {
    await closeApp();
  }
}

main().catch(async (error) => {
  console.error(error);
  await closeApp();
  process.exit(1);
});
