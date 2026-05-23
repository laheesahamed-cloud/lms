import { strict as assert } from 'node:assert';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PermissionGuard } from '../src/modules/auth/permission.guard';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';
import { SubscriptionsController } from '../src/modules/subscriptions/subscriptions.controller';

class QuizAccessMockPool {
  accessRows: any[];
  quizRows: any[];
  questionQueryCount = 0;

  constructor(input: { accessRows?: any[]; quizRows?: any[] }) {
    this.accessRows = input.accessRows || [];
    this.quizRows = input.quizRows || [{ id: 99, course_id: 55, is_free: 0, quiz_title: 'Locked Quiz' }];
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.startsWith("SELECT id, course_id, is_free, COALESCE(NULLIF(student_title, ''), quiz_title) AS quiz_title FROM quizzes")) {
      assert.equal(params[0], 99);
      return [this.quizRows as T, []];
    }

    if (normalizedSql.startsWith('SELECT sf.feature_key, plans.slug AS plan_slug, us.access_scope, us.course_ids_json')) {
      assert.equal(params[0], 10);
      return [this.accessRows as T, []];
    }

    if (normalizedSql.startsWith('SELECT q.id, q.question_text')) {
      this.questionQueryCount += 1;
      return [[{ id: 1, question_text: 'Q', explanation: 'E', question_type: 'sba' }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, question_id, option_label')) {
      return [[{ id: 11, question_id: 1, option_label: 'A', option_text: 'Answer', is_correct: 1, why_incorrect: null }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT question_id, concept_name')) {
      return [[] as T, []];
    }

    throw new Error(`Unexpected SQL in access control regression test: ${normalizedSql}`);
  }
}

const authService = {
  requireStudent: async () => ({ id: 10, role: 'student', status: 'active' }),
};

async function testQuizCardsDenyWithoutCourseAccess() {
  const db = new QuizAccessMockPool({});
  const service = new QuizzesService(db as any, authService as any);
  await assert.rejects(() => service.getCards('Bearer student-token', 99), BadRequestException);
  assert.equal(db.questionQueryCount, 0);
}

async function testQuizCardsAllowOwnedCourseAccess() {
  const db = new QuizAccessMockPool({
    accessRows: [{
      feature_key: 'question_bank_limited',
      plan_slug: 'custom-multi-question-bank-30',
      access_scope: 'courses',
      course_ids_json: '[55]',
    }],
  });
  const service = new QuizzesService(db as any, authService as any);
  const result = await service.getCards('Bearer student-token', 99);
  assert.equal(result.cards.length, 1);
  assert.equal(db.questionQueryCount, 1);
}

async function testSubscriptionDefaultRouteDeniesStaffWithoutBillingPermission() {
  const controller = new SubscriptionsController(
    { findAdminList: async () => [], getStudentBilling: async () => ({}) } as any,
    { requireAuthenticatedUser: async () => ({ id: 20, role: 'content_editor', status: 'active' }) } as any,
  );
  await assert.rejects(() => controller.defaultList('Bearer staff-token'), ForbiddenException);
}

async function testSubscriptionDefaultRouteAllowsFinanceAdminList() {
  let adminListCalled = false;
  const controller = new SubscriptionsController(
    {
      findAdminList: async () => {
        adminListCalled = true;
        return [{ id: 1 }];
      },
      getStudentBilling: async () => {
        throw new Error('Finance staff must not be treated as a student');
      },
    } as any,
    { requireAuthenticatedUser: async () => ({ id: 21, role: 'finance', status: 'active' }) } as any,
  );
  const result = await controller.defaultList('Bearer finance-token') as any[];
  assert.equal(adminListCalled, true);
  assert.equal(result.length, 1);
}

async function testSubscriptionDefaultRouteDeniesInactiveStaffSession() {
  const controller = new SubscriptionsController(
    {
      findAdminList: async () => {
        throw new Error('Inactive staff must not receive admin subscription lists');
      },
      getStudentBilling: async () => {
        throw new Error('Inactive staff must not be treated as a student');
      },
    } as any,
    { requireAuthenticatedUser: async () => ({ id: 23, role: 'finance', status: 'inactive' }) } as any,
  );
  await assert.rejects(() => controller.defaultList('Bearer inactive-finance-token'), UnauthorizedException);
}

async function testSubscriptionDefaultRouteScopesStudentsToSelf() {
  let billingUserId = 0;
  const controller = new SubscriptionsController(
    {
      findAdminList: async () => {
        throw new Error('Students must not receive admin subscription lists');
      },
      getStudentBilling: async (userId: number) => {
        billingUserId = userId;
        return { userId };
      },
    } as any,
    { requireAuthenticatedUser: async () => ({ id: 22, role: 'student', status: 'active' }) } as any,
  );
  const result = await controller.defaultList('Bearer student-token') as unknown as { userId: number };
  assert.equal(billingUserId, 22);
  assert.equal(result.userId, 22);
}

async function testPermissionGuardDeniesInactiveStaffSession() {
  const guard = new PermissionGuard(
    { requireAuthenticatedUser: async () => ({ id: 24, role: 'finance', status: 'inactive' }) } as any,
    { getAllAndOverride: () => ['subscriptions.manage'] } as any,
  );
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: 'Bearer inactive-finance-token' } }),
    }),
  } as any;

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
}

async function main() {
  await testQuizCardsDenyWithoutCourseAccess();
  await testQuizCardsAllowOwnedCourseAccess();
  await testSubscriptionDefaultRouteDeniesStaffWithoutBillingPermission();
  await testSubscriptionDefaultRouteAllowsFinanceAdminList();
  await testSubscriptionDefaultRouteDeniesInactiveStaffSession();
  await testSubscriptionDefaultRouteScopesStudentsToSelf();
  await testPermissionGuardDeniesInactiveStaffSession();
  console.log('Access control regression checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
