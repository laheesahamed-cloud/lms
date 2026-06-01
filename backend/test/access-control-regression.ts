import { strict as assert } from 'node:assert';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PermissionGuard } from '../src/modules/auth/permission.guard';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';
import { SubscriptionsController } from '../src/modules/subscriptions/subscriptions.controller';
import { QuestionsService } from '../src/modules/questions/questions.service';
import { UsersService } from '../src/modules/users/users.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { CoursesService } from '../src/modules/courses/courses.service';
import { LessonsService } from '../src/modules/lessons/lessons.service';
import { TopicsService } from '../src/modules/topics/topics.service';
import { SubtopicsService } from '../src/modules/subtopics/subtopics.service';
import { PapersService } from '../src/modules/papers/papers.service';
import { WorkspaceService } from '../src/modules/workspace/workspace.service';

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

class UserManagementMockPool {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  listRows: any[];
  targetUserRows: any[];
  activeAdminCount: number;

  constructor(input: { listRows?: any[]; targetUserRows?: any[]; activeAdminCount?: number } = {}) {
    this.listRows = input.listRows || [];
    this.targetUserRows = input.targetUserRows || [];
    this.activeAdminCount = input.activeAdminCount ?? 1;
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    this.calls.push({ sql, params });
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM users') && normalizedSql.includes('WHERE 1 = 1')) {
      return [this.listRows as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1')) {
      return [this.targetUserRows as T, []];
    }

    if (normalizedSql.startsWith("SELECT COUNT(*) AS active_admins FROM users WHERE role = 'admin'")) {
      return [[{ active_admins: this.activeAdminCount }] as T, []];
    }

    if (normalizedSql.startsWith('UPDATE users SET')) {
      return [{ affectedRows: 1 } as T, []];
    }

    throw new Error(`Unexpected SQL in user management access regression test: ${normalizedSql}`);
  }
}

const publishReadyQuestionPayload = {
  courseId: 1,
  subjectId: 2,
  topicId: null,
  lessonId: null,
  paperId: null,
  topicLabel: 'Cardiology',
  category: 'mock' as const,
  questionType: 'sba' as const,
  questionText: 'Which finding best supports acute coronary syndrome?',
  keywordsText: 'cardiology, acute coronary syndrome',
  explanation: 'Troponin rise with ischemic symptoms supports the diagnosis.',
  status: 'active' as const,
  options: [
    { optionLabel: 'A', optionText: 'Dynamic troponin rise', isCorrect: 1 as const },
    { optionLabel: 'B', optionText: 'Normal serial ECG and biomarkers', isCorrect: 0 as const, whyIncorrect: 'Normal serial testing lowers the likelihood.' },
    { optionLabel: 'C', optionText: 'Pleuritic pain only', isCorrect: 0 as const, whyIncorrect: 'Pleuritic pain suggests an alternative diagnosis.' },
    { optionLabel: 'D', optionText: 'Pain reproducible on palpation', isCorrect: 0 as const, whyIncorrect: 'Reproducible pain is more consistent with chest wall pain.' },
    { optionLabel: 'E', optionText: 'Isolated fever', isCorrect: 0 as const, whyIncorrect: 'Fever alone does not establish ACS.' },
  ],
};

const publishReadyQuizPayload = {
  courseId: 1,
  topicId: 2,
  subtopicId: null,
  lessonId: null,
  paperId: null,
  category: 'mock',
  collectionTags: 'cardiology',
  isFree: 0 as const,
  subtopic: 'Cardiology',
  isGeneral: 0 as const,
  examModeOnly: 1 as const,
  adminName: 'ACS governance quiz',
  studentTitle: 'Acute coronary syndrome quiz',
  displayTitleMode: 'title' as const,
  quizTitle: 'Acute coronary syndrome quiz',
  quizDescription: 'Review-ready quiz',
  blueprint: null,
  timeLimit: 30,
  hideTimeLimit: 0 as const,
  passingMarks: 60,
  hidePassingMarks: 0 as const,
  status: 'active' as const,
  questionIds: [1, 2, 3],
};

const publishReadyCoursePayload = {
  courseTitle: 'MRCP Part 1',
  courseCode: 'MRCP1',
  description: 'Medical revision course',
  examType: 'MRCP',
  status: 'active' as const,
};

const publishReadyLessonPayload = {
  courseId: 1,
  topicId: 2,
  subtopicId: 0,
  lessonTitle: 'Acute coronary syndrome review',
  lessonContent: 'Reviewed clinical content for acute coronary syndrome.',
  videoUrl: '',
  isFree: 0 as const,
  status: 'active' as const,
};

const publishReadyTopicPayload = {
  courseId: 1,
  topicName: 'Cardiology',
  topicDescription: 'Reviewed topic metadata',
  subtopics: ['Acute coronary syndrome'],
  status: 'active' as const,
};

const publishReadySubtopicPayload = {
  topicId: 2,
  subtopicName: 'Acute coronary syndrome',
  status: 'active' as const,
};

const publishReadyPaperPayload = {
  paperTitle: 'MRCP Cardiology Mock Paper',
  year: 2026,
  examSource: 'local' as const,
  keywordsText: 'cardiology, ACS',
  status: 'active' as const,
};


class QuestionGovernanceMockPool {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  questionStatus: 'active' | 'inactive';

  constructor(input: { questionStatus?: 'active' | 'inactive' } = {}) {
    this.questionStatus = input.questionStatus || 'inactive';
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    this.calls.push({ sql, params });
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM questions q') && normalizedSql.includes('WHERE q.id = ?')) {
      return [[{
        id: params[0],
        course_id: publishReadyQuestionPayload.courseId,
        topic_id: publishReadyQuestionPayload.subjectId,
        subtopic_id: null,
        lesson_id: null,
        paper_id: null,
        subtopic: publishReadyQuestionPayload.topicLabel,
        category: 'mock',
        question_category: 'mock',
        question_type: 'sba',
        question_text: publishReadyQuestionPayload.questionText,
        keywords_text: publishReadyQuestionPayload.keywordsText,
        explanation: publishReadyQuestionPayload.explanation,
        status: this.questionStatus,
        created_at: null,
        content_version: 1,
      }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, question_id, option_label, option_text, is_correct, why_incorrect FROM question_options')) {
      return [publishReadyQuestionPayload.options.map((option, index) => ({
        id: index + 1,
        question_id: params[0],
        option_label: option.optionLabel,
        option_text: option.optionText,
        is_correct: option.isCorrect,
        why_incorrect: option.whyIncorrect || null,
      })) as T, []];
    }

    return this.executeWrite<T>(sql, params);
  }

  async executeWrite<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.startsWith('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version')) {
      return [[{ next_version: 2 }] as T, []];
    }

    if (
      normalizedSql.startsWith('UPDATE questions SET status = ? WHERE id = ?') ||
      normalizedSql.startsWith('INSERT INTO content_versions') ||
      normalizedSql.startsWith('INSERT INTO content_workflow_states') ||
      normalizedSql.startsWith('INSERT INTO content_audit_events')
    ) {
      return [{ affectedRows: 1 } as T, []];
    }

    throw new Error(`Unexpected SQL in question governance regression test: ${normalizedSql}`);
  }

  async getConnection() {
    return {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      execute: async <T = any>(sql: string, params: unknown[] = []) => {
        this.calls.push({ sql, params });
        return this.executeWrite<T>(sql, params);
      },
    };
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

async function testSupportUserListIsScopedToStudents() {
  const db = new UserManagementMockPool();
  const service = new UsersService(db as any);
  await service.findAll({ id: 31, role: 'support', status: 'active' }, {});
  const listCall = db.calls.find((call) => /FROM users/i.test(call.sql) && /WHERE 1 = 1/i.test(call.sql));
  assert(listCall, 'support user listing must query through the users list');
  assert(/role = \?/.test(listCall.sql), 'support user listing must force a role filter');
  assert.deepEqual(listCall.params, ['student']);
}

async function testSupportUserListCannotRequestStaffRoles() {
  const db = new UserManagementMockPool();
  const service = new UsersService(db as any);
  await assert.rejects(
    () => service.findAll({ id: 32, role: 'support', status: 'active' }, { role: 'admin' }),
    ForbiddenException
  );
  assert.equal(db.calls.length, 0, 'forbidden staff-list requests must not query user data');
}

async function testSupportCannotPromoteStudentToStaff() {
  const db = new UserManagementMockPool({
    targetUserRows: [{ id: 44, full_name: 'Student', email: 'student@example.test', role: 'student', status: 'active' }],
  });
  const service = new UsersService(db as any);
  await assert.rejects(
    () => service.update({ id: 33, role: 'support', status: 'active' }, 44, { role: 'admin' }),
    ForbiddenException
  );
  assert(!db.calls.some((call) => /^UPDATE users SET/i.test(call.sql)), 'support promotion attempt must not update users');
}

async function testAdminCannotRemoveLastActiveAdminRole() {
  const db = new UserManagementMockPool({
    targetUserRows: [{ id: 45, full_name: 'Admin', email: 'admin@example.test', role: 'admin', status: 'active' }],
    activeAdminCount: 0,
  });
  const service = new UsersService(db as any);
  await assert.rejects(
    () => service.update({ id: 99, role: 'admin', status: 'active' }, 45, { role: 'support' }),
    BadRequestException
  );
  assert(!db.calls.some((call) => /^UPDATE users SET/i.test(call.sql)), 'last active admin protection must block the update');
}

async function testContentEditorCannotCreatePublishedQuestion() {
  const db = new QuestionGovernanceMockPool();
  const service = new QuestionsService(db as any);
  await assert.rejects(
    () => service.create(publishReadyQuestionPayload, { id: 300, role: 'content_editor', permissions: ['questions.manage'] }),
    ForbiddenException
  );
  assert.equal(db.calls.length, 0, 'content editors must not reach the database when creating published questions');
}

async function testContentEditorCannotModifyPublishedQuestion() {
  const db = new QuestionGovernanceMockPool({ questionStatus: 'active' });
  const service = new QuestionsService(db as any);
  await assert.rejects(
    () => service.update(77, { questionText: 'Edited published stem' }, { id: 301, role: 'content_editor', permissions: ['questions.manage'] }),
    ForbiddenException
  );
  assert(!db.calls.some((call) => /^UPDATE questions SET/i.test(call.sql)), 'content editors must not update published question rows');
}

async function testReviewerCanPublishQuestionWithAuditTrail() {
  const db = new QuestionGovernanceMockPool({ questionStatus: 'inactive' });
  const service = new QuestionsService(db as any);
  const result = await service.publish(77, { id: 302, role: 'reviewer', permissions: ['content.review'] });
  assert.equal(result.workflowState, 'published');
  assert(db.calls.some((call) => /^UPDATE questions SET status = \? WHERE id = \?/i.test(call.sql) && call.params[0] === 'active' && call.params[1] === 77), 'publish must activate the question row');
  assert(db.calls.some((call) => /INSERT INTO content_audit_events/i.test(call.sql) && call.params.includes(302)), 'publish must record the reviewing actor');
}

async function testContentEditorCannotCreatePublishedQuiz() {
  const service = new QuizzesService({} as any, {} as any);
  await assert.rejects(
    () => service.create(publishReadyQuizPayload, { id: 303, role: 'content_editor', permissions: ['quizzes.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedCourse() {
  const service = new CoursesService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.create(publishReadyCoursePayload, { id: 304, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedLesson() {
  const service = new LessonsService({} as any);
  await assert.rejects(
    () => service.create(publishReadyLessonPayload, { id: 305, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedTopic() {
  const service = new TopicsService({} as any);
  await assert.rejects(
    () => service.create(publishReadyTopicPayload, { id: 306, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedSubtopic() {
  const service = new SubtopicsService({} as any);
  await assert.rejects(
    () => service.create(publishReadySubtopicPayload, { id: 307, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedPaper() {
  const service = new PapersService({} as any);
  await assert.rejects(
    () => service.create(publishReadyPaperPayload, { id: 308, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

function testQuestionImportRejectsInvalidHeaders() {
  const service = new QuestionsService({} as any);
  assert.throws(
    () => (service as any).parseCsvRows('question_text,status\nStem,active\n'),
    BadRequestException
  );
}

function testQuestionImportRejectsEmbeddedMediaPayloads() {
  const service = new QuestionsService({} as any);
  assert.throws(
    () => (service as any).validateImportRowSafety({ question_text: '![scan](data:image/png;base64,AAAA)' }),
    /Embedded media is not supported/
  );
}

function testQuestionImportDetectsInFileDuplicates() {
  const service = new QuestionsService({} as any);
  const duplicateRows = new Set<number>();
  const errors = (service as any).findInFileImportDuplicateErrors([
    { rowNumber: 2, sourceQuestionId: '', fingerprint: 'same-question', payload: publishReadyQuestionPayload },
    { rowNumber: 3, sourceQuestionId: '', fingerprint: 'same-question', payload: publishReadyQuestionPayload },
  ], duplicateRows) as string[];
  assert(duplicateRows.has(3), 'duplicate import rows must be skipped');
  assert(errors.some((error) => error.includes('Duplicate question content matches row 2')));
}

function testDashboardFeedRedactsLearnerPiiWithoutStudentPermission() {
  const service = new DashboardService({} as any, {} as any, {} as any);
  const feed = (service as any).buildAdminActivityFeed([
    {
      item_type: 'user',
      item_id: 100,
      title: 'Student A',
      subtitle: 'student@example.test',
      status: 'active',
      created_at: '2026-05-31',
    },
  ], false) as Array<{ title: string; subtitle: string }>;

  assert.notEqual(feed[0].title, 'Student A');
  assert.equal(feed[0].subtitle, '');
  assert.match(feed[0].title, /^Learner [A-F0-9]{10}$/);
}

async function testReportsOnlyStaffCannotFilterSpecificLearner() {
  const service = new WorkspaceService(
    {
      execute: async () => {
        throw new Error('learner-specific analytics must be denied before report queries');
      },
    } as any,
    { requireAdmin: async () => ({ id: 400, role: 'content_editor', permissions: ['reports.view'], status: 'active' }) } as any,
    {} as any,
  );

  await assert.rejects(
    () => service.getAdminReports('Bearer reports-token', { userId: '10' }),
    ForbiddenException
  );
}

async function main() {
  await testQuizCardsDenyWithoutCourseAccess();
  await testQuizCardsAllowOwnedCourseAccess();
  await testSubscriptionDefaultRouteDeniesStaffWithoutBillingPermission();
  await testSubscriptionDefaultRouteAllowsFinanceAdminList();
  await testSubscriptionDefaultRouteDeniesInactiveStaffSession();
  await testSubscriptionDefaultRouteScopesStudentsToSelf();
  await testPermissionGuardDeniesInactiveStaffSession();
  await testSupportUserListIsScopedToStudents();
  await testSupportUserListCannotRequestStaffRoles();
  await testSupportCannotPromoteStudentToStaff();
  await testAdminCannotRemoveLastActiveAdminRole();
  await testContentEditorCannotCreatePublishedQuestion();
  await testContentEditorCannotModifyPublishedQuestion();
  await testReviewerCanPublishQuestionWithAuditTrail();
  await testContentEditorCannotCreatePublishedQuiz();
  await testContentEditorCannotCreatePublishedCourse();
  await testContentEditorCannotCreatePublishedLesson();
  await testContentEditorCannotCreatePublishedTopic();
  await testContentEditorCannotCreatePublishedSubtopic();
  await testContentEditorCannotCreatePublishedPaper();
  testQuestionImportRejectsInvalidHeaders();
  testQuestionImportRejectsEmbeddedMediaPayloads();
  testQuestionImportDetectsInFileDuplicates();
  testDashboardFeedRedactsLearnerPiiWithoutStudentPermission();
  await testReportsOnlyStaffCannotFilterSpecificLearner();
  console.log('Access control regression checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
