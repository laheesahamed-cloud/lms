import { strict as assert } from 'node:assert';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PermissionGuard } from '../src/modules/auth/permission.guard';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';
import { QuizAttemptsService } from '../src/modules/quiz-attempts/quiz-attempts.service';
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
import { TheoryRecapService } from '../src/modules/theory-recap/theory-recap.service';
import { AppOnlyContentException } from '../src/common/exceptions/app-only-content.exception';

// XP is saved by its own service; these checks are about access, so it is
// stood in for here and never pays anything.
const studyStatsStub = {
  ensureBuilt: async () => undefined,
  recordExam: async () => ({ examAttempts: 1, xpBase: 0, xpAwarded: 0 }),
  recordActivity: async () => undefined,
};
const structureStub = {
  get: async () => ({
    version: 1, builtAt: 't',
    courses: [{ id: 10, course_title: 'Medicine' }],
    subjects: [{ id: 20, course_id: 10, topic_name: 'Cardiology' }],
    topics: [{ id: 30, topic_id: 20, course_id: 10, subtopic_name: 'Heart Failure' }],
    lessons: [],
  }),
};
const xpStub = {
  onExamSubmitted: async () => ({ awarded: 0, capped: false }),
  onLessonCompleted: async () => ({ awarded: 0, capped: false }),
  markLessonOpened: async () => undefined,
  getSummary: async () => ({ totalXp: 0, xpToday: 0, xpDailyCap: 100, level: 1 }),
};

// The student-facing "open this quiz" path used to be QuizzesService.getCards;
// it now lives in QuizAttemptsService.loadQuiz, which resolves the student
// itself instead of taking an injected AuthService.
class QuizAccessMockPool {
  accessRows: any[];
  quizRows: any[];
  questionQueryCount = 0;

  constructor(input: { accessRows?: any[]; quizRows?: any[] }) {
    this.accessRows = input.accessRows || [];
    this.quizRows = input.quizRows || [{
      id: 99,
      course_id: 55,
      topic_id: null,
      subtopic_id: null,
      lesson_id: null,
      paper_id: null,
      subtopic: null,
      category: null,
      is_general: 0,
      is_free: 0,
      exam_mode_only: 0,
      blueprint_json: null,
      randomization_mode: 'static',
      quiz_title: 'Locked Quiz',
      quiz_description: null,
      total_questions: 1,
      total_marks: 1,
      time_limit: 0,
      hide_time_limit: 0,
      passing_marks: 0,
      hide_passing_marks: 0,
      status: 'active',
    }];
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM users WHERE session_token = ? AND session_expires_at > NOW()')) {
      return [[{ id: 10, full_name: 'Student', email: 's@example.com', role: 'student', status: 'active', session_token: 'x' }] as T, []];
    }

    if (normalizedSql.includes('FROM quizzes q INNER JOIN courses c ON q.course_id = c.id')) {
      assert.equal(params[0], 99);
      return [this.quizRows as T, []];
    }

    if (normalizedSql.includes('FROM user_subscriptions us INNER JOIN plans ON plans.id = us.plan_id')) {
      assert.equal(params[0], 10);
      return [this.accessRows as T, []];
    }

    // Questions load as ONE joined statement (OPTIMIZE 10.16): one row per
    // question, its options packed in as JSON.
    if (normalizedSql.includes('AS options_json') && normalizedSql.includes('FROM questions q')) {
      this.questionQueryCount += 1;
      return [[{
        id: 1, course_id: 55, topic_id: null, subtopic: null, category: null, question_type: 'sba', question_text: 'Q',
        explanation: 'E', explanation_image_url: null, status: 'active',
        options_json: JSON.stringify([{ id: 11, label: 'A', text: 'Answer', correct: 1, why: null }]),
      }] as T, []];
    }

    if (normalizedSql.includes('FROM questions q INNER JOIN question_quizzes qq ON qq.question_id = q.id')) {
      this.questionQueryCount += 1;
      return [[{ id: 1, course_id: 55, topic_id: null, subtopic: null, category: null, question_type: 'sba', question_text: 'Q', explanation: 'E', explanation_image_url: null, status: 'active' }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, question_id, option_label')) {
      return [[{ id: 11, question_id: 1, option_label: 'A', option_text: 'Answer', is_correct: 1, why_incorrect: null }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT question_id, concept_name')) {
      return [[] as T, []];
    }

    if (normalizedSql.includes("FROM content_versions WHERE entity_type = 'question'")) {
      return [[] as T, []];
    }

    if (normalizedSql.includes('FROM questions q WHERE q.id IN')) {
      this.questionQueryCount += 1;
      return [[{ id: 1, course_id: 55, topic_id: null, subtopic: null, category: null, question_type: 'sba', question_text: 'Q', explanation: 'E', explanation_image_url: null, status: 'active' }] as T, []];
    }

    if (normalizedSql.includes('FROM student_answers WHERE attempt_id = ?')) {
      return [[] as T, []];
    }

    throw new Error(`Unexpected SQL in access control regression test: ${normalizedSql}`);
  }
}

// "Question of the day" on the student dashboard used to draw from every
// question in the bank, options and correct answer included, with no
// premium check — this pins the fix restricting the website's pool to
// questions that also appear in a free quiz.
class DashboardQuestionMockPool {
  freeEligibleCount: number;
  allEligibleCount: number;

  constructor(input: { freeEligibleCount: number; allEligibleCount: number }) {
    this.freeEligibleCount = input.freeEligibleCount;
    this.allEligibleCount = input.allEligibleCount;
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    return this.execute<T>(sql, params);
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes("setting_key = 'content_version'")) {
      return [[{ setting_value: '1' }] as T, []];
    }
    // App pick (by index): the first active single-best-answer question from
    // the day's start id, then its options (5, one right).
    if (normalizedSql.startsWith('SELECT id, question_text, question_type, course_id, topic_id, subtopic_id FROM questions')) {
      return [(this.allEligibleCount > 0
        ? [{ id: 49, question_text: 'Q', question_type: 'sba', course_id: 10, topic_id: 20, subtopic_id: 30 }]
        : []) as T, []];
    }
    // App pick in ONE statement (OPTIMIZE 10.17): the question with its 5
    // options (one right).
    // 10.43: the options are the question row's own options_json.
    if (normalizedSql.startsWith('SELECT id, question_text, question_type, course_id, topic_id, subtopic_id, options_json FROM questions')) {
      return [(this.allEligibleCount > 0
        ? [{ id: 49, question_text: 'Q', question_type: 'sba', course_id: 10, topic_id: 20, subtopic_id: 30,
            options_json: JSON.stringify(['A', 'B', 'C', 'D', 'E'].map((label, i) => ({ id: i + 1, option_label: label, option_text: label, is_correct: i === 0 ? 1 : 0, why_incorrect: null }))) }]
        : []) as T, []];
    }

    // Website pool: eligible questions reached through free quizzes only.
    if (normalizedSql.startsWith('SELECT DISTINCT q.id FROM quizzes free_quiz')) {
      return [Array.from({ length: this.freeEligibleCount }, () => ({ id: 49 })) as T, []];
    }
    // App pick: id range, then the first eligible question from a start id.
    if (normalizedSql.startsWith('SELECT MIN(id) AS min_id')) {
      return [[{ min_id: 1, max_id: 100 }] as T, []];
    }
    if (normalizedSql.startsWith('SELECT q.id FROM questions q WHERE q.id >= ?')) {
      return [(this.allEligibleCount > 0 ? [{ id: 49 }] : []) as T, []];
    }

    if (normalizedSql.includes('FROM questions q') && normalizedSql.includes('LEFT JOIN courses c')) {
      return [[{ id: 49, question_text: 'Q', question_type: 'sba', course_title: 'Medicine', subject_name: 'Cardiology', topic_name: 'Heart Failure' }] as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, question_id, option_label, option_text, is_correct')) {
      return [[{ id: 1, question_id: 49, option_label: 'A', option_text: 'Answer', is_correct: 1 }] as T, []];
    }

    throw new Error(`Unexpected SQL in dashboard question regression test: ${normalizedSql}`);
  }
}

// Theory recap is rich educational content fetched by raw question ID, with
// no relationship check otherwise — this pins the fix requiring the mobile
// header unless the question also appears in a free quiz.
class TheoryRecapMockPool {
  isFreeLinked: boolean;
  /** Does the student hold an active plan covering every course? */
  hasPlan: boolean;

  constructor(input: { isFreeLinked: boolean; hasPlan?: boolean }) {
    this.isFreeLinked = input.isFreeLinked;
    this.hasPlan = input.hasPlan ?? true;
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM question_quizzes qq') && normalizedSql.includes('q.is_free = 1')) {
      return [(this.isFreeLinked ? [{ 1: 1 }] : []) as T, []];
    }

    // Entitlement (question-access.util.ts): the question's course, the quizzes
    // that list it, and the student's active plans.
    if (normalizedSql.startsWith('SELECT course_id FROM questions WHERE id = ?')) {
      return [[{ course_id: 10 }] as T, []];
    }

    if (normalizedSql.includes('SELECT q.course_id, q.is_free') && normalizedSql.includes('FROM question_quizzes qq')) {
      return [[{ course_id: 10, is_free: this.isFreeLinked ? 1 : 0 }] as T, []];
    }

    if (normalizedSql.includes('FROM user_subscriptions us')) {
      return [(this.hasPlan ? [{ plan_slug: 'complete-prep-3m', access_scope: 'all', course_ids_json: null }] : []) as T, []];
    }

    // OPTIMIZE 10.43: the recap lives in questions.recap_json.
    if (normalizedSql.startsWith('SELECT recap_json FROM questions WHERE id = ?')) {
      return [[{ recap_json: JSON.stringify({
        id: 7, concept_name: 'HFrEF', hierarchy_course: 'Medicine', hierarchy_subject: 'Cardiology',
        hierarchy_topic: 'Heart Failure', hierarchy_lesson: 'Heart failure', etiology: '[]', pathophysiology: '[]',
        clinical_features: '[]', investigations: '[]', treatment: '[]', key_points: '[]', mnemonic: null,
        generated_by: 'manual', reviewed_status: 'reviewed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }) }] as T, []];
    }

    throw new Error(`Unexpected SQL in theory recap regression test: ${normalizedSql}`);
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
        // OPTIMIZE 10.43: options live in the question row.
        options_json: JSON.stringify(publishReadyQuestionPayload.options.map((option, index) => ({
          id: index + 1,
          option_label: option.optionLabel,
          option_text: option.optionText,
          is_correct: option.isCorrect,
          why_incorrect: option.whyIncorrect || null,
        }))),
      }] as T, []];
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
      // OPTIMIZE 10.27 R1: the quizzes holding the question get a new content stamp.
      normalizedSql.startsWith('UPDATE quizzes SET content_stamp = content_stamp + 1') ||
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

// Every feature gate is open (see the "feature gating removed" change); course
// scope is the only thing still limiting access, which is what these cover.
const plansService = {
  hasFeatureAccess: async () => true,
};

// Premium quizzes are permanently app-only (see AppOnlyContentException) —
// these tests exercise the subscription-scope check *behind* that gate, so
// they pass the mobile client header, same as the real app would.
const MOBILE_CLIENT = 'xyndrome-mobile-app';
const STUDENT_ID = 112;

async function testQuizContentDeniedWithoutCourseAccess() {
  const db = new QuizAccessMockPool({});
  const service = new QuizAttemptsService(db as any, plansService as any, studyStatsStub as any);
  await assert.rejects(
    () => service.loadQuiz('Bearer student-token', 99, 'practice', null, MOBILE_CLIENT),
    BadRequestException
  );
  assert.equal(db.questionQueryCount, 0, 'question content must not be read for an out-of-scope quiz');
}

async function testQuizContentAllowedForOwnedCourse() {
  const db = new QuizAccessMockPool({
    accessRows: [{
      plan_slug: 'custom-multi-question-bank-30',
      access_scope: 'courses',
      course_ids_json: '[55]',
      lesson_ids_json: null,
    }],
  });
  const service = new QuizAttemptsService(db as any, plansService as any, studyStatsStub as any);
  const result = await service.loadQuiz('Bearer student-token', 99, 'practice', null, MOBILE_CLIENT);
  assert.equal(result.questions.length, 1);
  assert.equal(db.questionQueryCount, 1);
}

async function testQuizContentDeniedForCourseOutsideSubscriptionScope() {
  // Active paid subscription, but scoped to a different course than the quiz's.
  const db = new QuizAccessMockPool({
    accessRows: [{
      plan_slug: 'custom-multi-question-bank-30',
      access_scope: 'courses',
      course_ids_json: '[56]',
      lesson_ids_json: null,
    }],
  });
  const service = new QuizAttemptsService(db as any, plansService as any, studyStatsStub as any);
  await assert.rejects(
    () => service.loadQuiz('Bearer student-token', 99, 'practice', null, MOBILE_CLIENT),
    BadRequestException
  );
  assert.equal(db.questionQueryCount, 0);
}

// The app-only gate is permanent and unconditional: even a student with full,
// unrestricted course access must not get premium quiz content on the web
// (no mobile client header) — there is no admin switch to bypass this.
async function testPremiumQuizContentDeniedWithoutMobileHeaderEvenWithFullAccess() {
  const db = new QuizAccessMockPool({
    accessRows: [{
      plan_slug: 'master-prep-6m',
      access_scope: 'all',
      course_ids_json: null,
      lesson_ids_json: null,
    }],
  });
  const service = new QuizAttemptsService(db as any, plansService as any, studyStatsStub as any);
  await assert.rejects(
    () => service.loadQuiz('Bearer student-token', 99, 'practice'),
    AppOnlyContentException
  );
  assert.equal(db.questionQueryCount, 0, 'premium quiz content must never reach the website, regardless of access');
}

async function testFreeQuizContentAllowedWithoutMobileHeader() {
  const db = new QuizAccessMockPool({
    quizRows: [{
      id: 99,
      course_id: 55,
      topic_id: null,
      subtopic_id: null,
      lesson_id: null,
      paper_id: null,
      subtopic: null,
      category: null,
      is_general: 0,
      is_free: 1,
      exam_mode_only: 0,
      blueprint_json: null,
      randomization_mode: 'static',
      quiz_title: 'Free Quiz',
      quiz_description: null,
      total_questions: 1,
      total_marks: 1,
      time_limit: 0,
      hide_time_limit: 0,
      passing_marks: 0,
      hide_passing_marks: 0,
      status: 'active',
    }],
  });
  const service = new QuizAttemptsService(db as any, plansService as any, studyStatsStub as any);
  const result = await service.loadQuiz('Bearer student-token', 99, 'practice');
  assert.equal(result.questions.length, 1, 'free content stays reachable from the website with no header at all');
}
async function testTheoryRecapDeniedForPremiumOnlyQuestionWithoutMobileHeader() {
  const db = new TheoryRecapMockPool({ isFreeLinked: false });
  const service = new TheoryRecapService(db as any, {} as any);
  await assert.rejects(
    () => service.getByQuestionIdForStudent(203, undefined, STUDENT_ID),
    AppOnlyContentException
  );
}

async function testTheoryRecapAllowedForPremiumOnlyQuestionWithMobileHeader() {
  const db = new TheoryRecapMockPool({ isFreeLinked: false });
  const service = new TheoryRecapService(db as any, {} as any);
  const recap = await service.getByQuestionIdForStudent(203, MOBILE_CLIENT, STUDENT_ID);
  assert.equal(recap?.questionId, 203);
}

// The mobile header is a value anyone can send, so it cannot be the only gate:
// a student with no plan is refused premium recaps even when it is present.
async function testTheoryRecapDeniedForUnentitledStudentEvenWithMobileHeader() {
  const db = new TheoryRecapMockPool({ isFreeLinked: false, hasPlan: false });
  const service = new TheoryRecapService(db as any, {} as any);
  await assert.rejects(
    () => service.getByQuestionIdForStudent(203, MOBILE_CLIENT, STUDENT_ID),
    ForbiddenException
  );
}

async function testTheoryRecapAllowedForFreeLinkedQuestionWithoutMobileHeader() {
  const db = new TheoryRecapMockPool({ isFreeLinked: true });
  const service = new TheoryRecapService(db as any, {} as any);
  const recap = await service.getByQuestionIdForStudent(203, undefined, STUDENT_ID);
  assert.equal(recap?.questionId, 203, 'a question that also appears in a free quiz stays reachable from the website');
}

async function testDashboardQuestionOfDayExcludesPremiumOnlyPoolWithoutMobileHeader() {
  const db = new DashboardQuestionMockPool({ freeEligibleCount: 0, allEligibleCount: 5 });
  const service = new DashboardService(db as any, {} as any, {} as any, xpStub as any, {} as any, {} as any, studyStatsStub as any, structureStub as any, { get: async () => ({ quizCount: 0 }) } as any);
  const question = await (service as any).getRandomDashboardQuestion(112);
  assert.equal(question, null, 'website must not surface a "question of the day" drawn only from premium quizzes');
}

async function testDashboardQuestionOfDayUsesFullPoolWithMobileHeader() {
  const db = new DashboardQuestionMockPool({ freeEligibleCount: 0, allEligibleCount: 5 });
  const service = new DashboardService(db as any, {} as any, {} as any, xpStub as any, {} as any, {} as any, studyStatsStub as any, structureStub as any, { get: async () => ({ quizCount: 0 }) } as any);
  const question = await (service as any).getRandomDashboardQuestion(112, MOBILE_CLIENT);
  assert.equal(question?.id, 49);
}

async function testSubscriptionDefaultRouteDeniesStaffWithoutBillingPermission() {
  const controller = new SubscriptionsController(
    { findAdminList: async () => [], getStudentBilling: async () => ({}) } as any,
    { requireFreshUser: async () => ({ id: 20, role: 'content_editor', status: 'active' }), requireAuthenticatedUser: async () => ({ id: 20, role: 'content_editor', status: 'active' }) } as any,
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
    { requireFreshUser: async () => ({ id: 21, role: 'finance', status: 'active' }), requireAuthenticatedUser: async () => ({ id: 21, role: 'finance', status: 'active' }) } as any,
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
    { requireFreshUser: async () => ({ id: 23, role: 'finance', status: 'inactive' }), requireAuthenticatedUser: async () => ({ id: 23, role: 'finance', status: 'inactive' }) } as any,
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
    { requireFreshUser: async () => ({ id: 22, role: 'student', status: 'active' }), requireAuthenticatedUser: async () => ({ id: 22, role: 'student', status: 'active' }) } as any,
  );
  const result = await controller.defaultList('Bearer student-token') as unknown as { userId: number };
  assert.equal(billingUserId, 22);
  assert.equal(result.userId, 22);
}

async function testPermissionGuardDeniesInactiveStaffSession() {
  const guard = new PermissionGuard(
    { requireFreshUser: async () => ({ id: 24, role: 'finance', status: 'inactive' }), requireAuthenticatedUser: async () => ({ id: 24, role: 'finance', status: 'inactive' }) } as any,
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
  assert.deepEqual(listCall.params, ['student', 50, 0]);
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
  // content_audit_events was dropped in OPTIMIZE 10.37 (written, never read): no audit row to check.
  assert(!db.calls.some((call) => /content_audit_events/i.test(call.sql)), 'the dropped audit table must not be written');
}

async function testContentEditorCannotCreatePublishedQuiz() {
  const service = new QuizzesService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.create(publishReadyQuizPayload, { id: 303, role: 'content_editor', permissions: ['quizzes.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedCourse() {
  const service = new CoursesService({} as any, {} as any, {} as any, xpStub as any, {} as any);
  await assert.rejects(
    () => service.create(publishReadyCoursePayload, { id: 304, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

async function testContentEditorCannotCreatePublishedLesson() {
  // (db, ConfigService, pushNotificationsService) — the create() guard
  // rejects before any of them is touched.
  const service = new LessonsService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.create(publishReadyLessonPayload, { id: 305, role: 'content_editor', permissions: ['content.manage'] }),
    ForbiddenException
  );
}

// Lessons split publishing from authoring: content.manage may edit a live lesson's
// body (editors maintain AI notes on published lessons) but may not change whether
// it is live. Only content.review/admin can flip that. These pin both halves —
// the publish side previously regressed open and went unnoticed for months.
async function testContentEditorCanEditLivePublishedLessonBody() {
  const service = new LessonsService({} as any, {} as any, {} as any) as any;
  const editor = { id: 305, role: 'content_editor', permissions: ['content.manage'] };
  assert.doesNotThrow(() => service.assertCanModifyExistingStatus(editor, 'active'));
  assert.doesNotThrow(() => service.assertCanSaveStatus(editor, 'active', 'active'));
}

async function testContentEditorCannotFlipLessonLiveState() {
  const service = new LessonsService({} as any, {} as any, {} as any) as any;
  const editor = { id: 305, role: 'content_editor', permissions: ['content.manage'] };
  assert.throws(() => service.assertCanSaveStatus(editor, 'active', 'inactive'), ForbiddenException, 'editors must not publish');
  assert.throws(() => service.assertCanSaveStatus(editor, 'inactive', 'active'), ForbiddenException, 'editors must not unpublish');

  const reviewer = { id: 306, role: 'reviewer', permissions: ['content.review'] };
  assert.doesNotThrow(() => service.assertCanSaveStatus(reviewer, 'active', 'inactive'));
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
  const service = new PapersService({} as any, {} as any);
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

// The Admin Hub no longer lists learner activity (no learner PII at all); its
// money numbers must stay hidden from staff without subscriptions.manage.
async function testDashboardHidesMoneyWithoutBillingPermission() {
  let financeCalls = 0;
  const conn = { query: async () => [[{ lesson_count: 2, question_total: 3, quiz_total: 1 }]], release: () => {} };
  const make = (actor: Record<string, unknown>) => new DashboardService(
    { getConnection: async () => conn } as any,
    { requireAdmin: async () => actor } as any,
    {} as any,
    xpStub as any,
    { summary: async () => ({ totalUsers: 1 }) } as any,
    { adminDashboardFinance: async () => { financeCalls += 1; return { todayRevenue: 990 }; } } as any,
    studyStatsStub as any,
    structureStub as any,
    { get: async () => ({ quizCount: 0 }) } as any,
  );
  const editor = await make({ id: 401, role: 'content_editor', permissions: ['reports.view'], status: 'active' }).getAdminDashboard('Bearer t');
  assert.equal(editor.finance, null, 'staff without subscriptions.manage must not get money numbers');
  assert.equal(financeCalls, 0, 'money queries must not even run for them');
  const billing = await make({ id: 402, role: 'staff', permissions: ['reports.view', 'subscriptions.manage'], status: 'active' }).getAdminDashboard('Bearer t');
  assert.equal((billing.finance as any)?.todayRevenue, 990);
  assert.equal(billing.totals.questions, 3);
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
    // pushNotificationsService. WorkspaceService gained a fourth constructor
    // dependency and this call was never updated, so the whole suite failed to
    // COMPILE — every assertion in this file was silently not running.
    {} as any,
    // noticesService (notifications without the database, step 4)
    {} as any,
  );

  await assert.rejects(
    () => service.getAdminReports('Bearer reports-token', { userId: '10' }),
    ForbiddenException
  );
}

async function main() {
  await testQuizContentDeniedWithoutCourseAccess();
  await testQuizContentAllowedForOwnedCourse();
  await testQuizContentDeniedForCourseOutsideSubscriptionScope();
  await testPremiumQuizContentDeniedWithoutMobileHeaderEvenWithFullAccess();
  await testFreeQuizContentAllowedWithoutMobileHeader();
  await testTheoryRecapDeniedForPremiumOnlyQuestionWithoutMobileHeader();
  await testTheoryRecapAllowedForPremiumOnlyQuestionWithMobileHeader();
  await testTheoryRecapDeniedForUnentitledStudentEvenWithMobileHeader();
  await testTheoryRecapAllowedForFreeLinkedQuestionWithoutMobileHeader();
  await testDashboardQuestionOfDayExcludesPremiumOnlyPoolWithoutMobileHeader();
  await testDashboardQuestionOfDayUsesFullPoolWithMobileHeader();
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
  await testContentEditorCanEditLivePublishedLessonBody();
  await testContentEditorCannotFlipLessonLiveState();
  await testContentEditorCannotCreatePublishedTopic();
  await testContentEditorCannotCreatePublishedSubtopic();
  await testContentEditorCannotCreatePublishedPaper();
  testQuestionImportRejectsInvalidHeaders();
  testQuestionImportRejectsEmbeddedMediaPayloads();
  testQuestionImportDetectsInFileDuplicates();
  await testDashboardHidesMoneyWithoutBillingPermission();
  await testReportsOnlyStaffCannotFilterSpecificLearner();
  console.log('Access control regression checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
