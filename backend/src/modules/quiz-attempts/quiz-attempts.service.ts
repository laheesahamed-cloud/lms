import { getContentVersion } from '../../common/utils/content-version';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { getScopeRows, studentFromRequest } from '../../common/auth/subscription-scope';
import { looksLikeAccessToken } from '../../common/auth/access-token';
import { userFromAccessToken } from '../../common/auth/token-user';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StudentCatalogueService } from '../courses/student-catalogue.service';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { PlansService } from '../plans/plans.service';
import { XP } from '../xp/xp.rules';
import { newExamNonce, signExamToken, verifyExamToken } from '../../common/auth/exam-token';
import { oldByteSql, setByteSql, bytesFromMap } from '../../common/utils/lesson-bits';
import { progressWrite, returnRideAlong, takeRideAlong } from '../../common/utils/progress-write';
import { localDateKey } from '../xp/streak';
import { AppOnlyContentException } from '../../common/exceptions/app-only-content.exception';
import { isMobileAppClient } from '../../common/utils/mobile-client.util';
import { optionsOf, recapOf } from '../../common/utils/question-content';

type AuthUser = RowDataPacket & {
  id: number;
  full_name: string;
  email: string;
  role: 'admin' | 'student';
  status: 'active' | 'inactive';
  session_token: string | null;
};

type QuizRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number | null;
  subtopic_id?: number | null;
  lesson_id?: number | null;
  paper_id?: number | null;
  subtopic: string | null;
  category?: string | null;
  is_general: number;
  is_free: number;
  exam_mode_only: number;
  student_title?: string | null;
  display_title_mode?: string | null;
  quiz_number?: number | null;
  quiz_title: string;
  quiz_description: string | null;
  total_questions: number;
  total_marks: number;
  time_limit: number;
  hide_time_limit: number;
  passing_marks: number;
  hide_passing_marks: number;
  status: 'active' | 'inactive';
  updated_at?: string | Date | null;
  created_at?: string | Date | null;
  course_title?: string | null;
  topic_name?: string | null;
  subject_name?: string | null;
  lesson_title?: string | null;
  exam_attempt_count?: number;
  practice_completed_count?: number;
  latest_attempt_id?: number | null;
};

type QuestionRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number | null;
  subtopic_id?: number | null;
  subtopic: string | null;
  category: string | null;
  question_type: 'sba' | 'true_false';
  question_text: string;
  explanation: string | null;
  explanation_image_url?: string | null;
  question_approach?: string | null;
  question_approach_highlights?: string | null;
  status: 'active' | 'inactive';
  updated_at?: string | Date | null;
};

type OptionRow = RowDataPacket & {
  id: number;
  question_id: number;
  option_label: string;
  option_text: string;
  is_correct: number;
  why_incorrect: string | null;
};

type TheoryRecapData = {
  conceptName: string;
  hierarchy: { course: string; subject: string; topic: string; lesson: string };
  etiology: string[];
  pathophysiology: string[];
  clinicalFeatures: string[];
  investigations: string[];
  treatment: string[];
  keyPoints: string[];
  mnemonic: string;
};

type TheoryRecapRow = RowDataPacket & {
  question_id: number;
  concept_name: string | null;
  hierarchy_course: string | null;
  hierarchy_subject: string | null;
  hierarchy_topic: string | null;
  hierarchy_lesson: string | null;
  etiology: string | null;
  pathophysiology: string | null;
  clinical_features: string | null;
  investigations: string | null;
  treatment: string | null;
  key_points: string | null;
  mnemonic: string | null;
};

type QuizAccessScopeRow = RowDataPacket & {
  feature_key: string | null;
  plan_slug: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
};

type QuizAccessProfile = {
  hasAnyPaidQuizAccess: boolean;
  hasFullAccess: boolean;
  courseIds: Set<number>;
};

type LoadedQuestion = QuestionRow & {
  options: Array<{ id: number; optionLabel: string; optionText: string; isCorrect: number; whyIncorrect: string }>;
  theoryRecap: TheoryRecapData | null;
  contentVersion: number;
  contentVersionedAt: string | Date | null;
  contentSourceLabel: string;
};

type AnswerInsertRow = [number, number, number, number];

const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;
const QUIZ_CONTENT_CACHE_MS = 30000;

/**
 * A lean review question (10.26 P2): how the student answered, without the
 * question's text, options, explanation or recap (the phone joins those from
 * its saved practice quiz).
 */
const LEAN_REVIEW_KEYS = ['id', 'answerKey', 'courseId', 'subjectId', 'topicId', 'answerState', 'answerStatus', 'questionScore', 'maxQuestionScore'];

@Injectable()
export class QuizAttemptsService {
  private readonly activeQuizCache = new Map<number, { expiresAt: number; value: QuizRow }>();
  private readonly quizQuestionCache = new Map<string, { expiresAt: number; value: LoadedQuestion[] }>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly plansService: PlansService,
    private readonly studyStats: StudyStatsService,
    @Optional() private readonly catalogue?: StudentCatalogueService,
  ) {}

  // Active quizzes with their course/topic/lesson names: the same for every
  // student, so read once and shared for QUIZ_CATALOG_TTL_MS. Only the
  // student's own attempts are read per request.
  private static readonly QUIZ_CATALOG_TTL_MS = 30_000;
  private quizCatalogCache: { rows: QuizRow[]; expiresAt: number; version?: number } | null = null;
  private quizCatalogInflight: Promise<QuizRow[]> | null = null;

  private async getActiveQuizCatalog(): Promise<QuizRow[]> {
    // Kept until the catalogue version changes (any quiz / course save raises
    // it), not just 30 s (OPTIMIZE 10 step 6: the website's Q-Bank list).
    const version = await getContentVersion(this.db);
    if (this.quizCatalogCache && this.quizCatalogCache.version === version) return this.quizCatalogCache.rows;
    if (this.quizCatalogInflight) return this.quizCatalogInflight;
    const task = this.db.execute<QuizRow[]>(
      `
        SELECT
          q.id, q.course_id, q.topic_id, q.subtopic_id, NULL AS lesson_id, '' AS subtopic,
          q.is_general, q.is_free,
          -- 10.54: columns no set used were dropped; the fixed values every set had keep the replies identical.
          0 AS exam_mode_only, q.quiz_title AS student_title, 'title' AS display_title_mode,
          q.quiz_number, q.quiz_title, '' AS quiz_description,
          q.total_questions, q.total_marks, q.time_limit, 0 AS hide_time_limit,
          q.passing_marks, 0 AS hide_passing_marks, q.status, q.updated_at, q.created_at,
          c.course_title, c.exam_type,
          t.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          NULL AS lesson_title
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN subtopics st ON q.subtopic_id = st.id
        WHERE q.status = 'active'
        ORDER BY q.id DESC
      `
    )
      .then(([rows]) => {
        this.quizCatalogCache = { rows, expiresAt: Date.now() + QuizAttemptsService.QUIZ_CATALOG_TTL_MS, version };
        return rows;
      })
      .finally(() => {
        this.quizCatalogInflight = null;
      });
    this.quizCatalogInflight = task;
    return task;
  }

  async listQuizzes(authorization?: string) {
    const user = await this.requireStudent(authorization);
    // Any active plan unlocks all three (feature gating removed): one check,
    // from the signed token when present (was three identical queries).
    const hasPlan = await this.hasActivePlan(user);
    const [canPractice, canExam] = [hasPlan, hasPlan];
    const accessProfile = await this.getQuizAccessProfile(user.id);
    const catalog = await this.getActiveQuizCatalog();
    // 10.16-W: the student's quiz marks from the ONE summary row (byte per quiz:
    // passed bit + best % + 1) and the 5 recent results — no attempt rows.
    const [summaryRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT quiz_marks, recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    const marks = bytesFromMap(summaryRows[0]?.quiz_marks);
    const recentIds = new Set<number>();
    try {
      for (const e of JSON.parse(String(summaryRows[0]?.recent_results || '[]'))) recentIds.add(Number(e?.quizId));
    } catch { /* no recent results */ }
    // 10.28: practice runs aren't stored per quiz (the phone keeps its own).
    const attemptsByQuiz = new Map<number, { count: number; latestId: number | null; best: number; passed: boolean }>();
    for (const [quizId, byte] of marks) {
      attemptsByQuiz.set(quizId, { count: 1, latestId: recentIds.has(quizId) ? quizId : null, best: (byte & 127) - 1, passed: (byte & 128) !== 0 });
    }
    const rows = catalog.map((row) => {
      const attempts = attemptsByQuiz.get(Number(row.id));
      return {
        ...row,
        exam_attempt_count: attempts ? attempts.count : 0,
        practice_completed_count: 0,
        latest_attempt_id: attempts ? attempts.latestId : null,
        best_pct: attempts ? attempts.best : null,
        passed_once: attempts ? attempts.passed : false,
      } as QuizRow;
    });

    return rows.map((row) => {
      const canAccessQuiz = this.canAccessQuiz(row, accessProfile);
      const isFree = Number(row.is_free) === 1;
      const accessMessage = !canAccessQuiz
        ? 'Your subscription does not include this course question bank.'
        : '';
      // Full-course (general) sets have no subject, and the mobile app
      // re-sorts this list by topicName to order its Q-Bank groups. A leading
      // U+3000 sorts after every letter in the app's code-unit compare and is
      // stripped by Dart's trim() before display, so General lands last
      // without an app release. The web sorts with localeCompare, where a
      // space sorts first, so it places General last itself.
      const generalLabel =
        Number(row.is_general) === 1 && !row.subject_name
          ? 'General / Full Course Revision'
          : '';
      return {
        id: row.id,
        courseId: row.course_id,
        topicId: row.topic_id,
        subtopicId: row.subtopic_id ? Number(row.subtopic_id) : null,
        lessonId: row.lesson_id ? Number(row.lesson_id) : null,
        subtopic: row.subtopic || '',
        isGeneral: Number(row.is_general) === 1,
        examModeOnly: Number(row.exam_mode_only) === 1,
        quizTitle: row.quiz_title,
        studentTitle: row.student_title || row.quiz_title,
        displayTitleMode: row.display_title_mode === 'title' ? 'title' : 'number',
        quizNumber: row.quiz_number ? Number(row.quiz_number) : null,
        quizDescription: row.quiz_description || '',
        totalQuestions: Number(row.total_questions || 0),
        totalMarks: Number(row.total_marks || 0),
        timeLimit: Number(row.time_limit || 0),
        hideTimeLimit: Number(row.hide_time_limit) === 1,
        passingMarks: this.resolvePassingMarks(Number(row.passing_marks || 0)),
        hidePassingMarks: Number(row.hide_passing_marks) === 1,
        updatedAt: row.updated_at || row.created_at || null,
        courseTitle: row.course_title || '',
        examType: row.exam_type || '',
        // The SELECT aliases topics.topic_name AS subject_name and
        // subtopics.subtopic_name AS topic_name, so: subject is the course's
        // topic, topic is its subtopic. topicName was reading subject_name —
        // a copy-paste that made it a duplicate of subjectName, which is why
        // nothing could group by it.
        subjectName: row.subject_name || generalLabel,
        topicName: row.topic_name || (generalLabel ? `　${generalLabel}` : ''),
        subtopicName: row.topic_name || '',
        lessonTitle: row.lesson_title || '',
        examAttemptCount: Number(row.exam_attempt_count || 0),
        latestAttemptId: row.latest_attempt_id ? Number(row.latest_attempt_id) : null,
        bestPercentage: (row as any).best_pct ?? null,
        passed: Boolean((row as any).passed_once),
        // Completed = graded exam attempt OR a finished practice run. Practice
        // logs a study-activity event (not a quiz_attempt), so it must be
        // counted here too — otherwise the dashboard keeps recommending a quiz
        // the student already practiced.
        isCompleted:
          Number(row.exam_attempt_count || 0) > 0 ||
          Number(row.practice_completed_count || 0) > 0,
        isFree,
        randomizationMode: 'static', // 10.54: every set is a fixed list (field kept for installed apps)
        canAccess: canAccessQuiz,
        accessLocked: !canAccessQuiz,
        accessMessage,
        canPracticeMode: canAccessQuiz && (canPractice || isFree),
        canExamMode: canAccessQuiz && (canExam || isFree),
      };
    });
  }

  /**
   * Free quizzes for the public sample files (OPTIMIZE 10.21): each with its
   * questions, options, answer key and explanations (free content only), so
   * the website marks them in the browser — no database work per open.
   */
  async freeSamples() {
    const catalog = await this.getActiveQuizCatalog();
    const quizzes: Array<{ item: Record<string, unknown>; full: Record<string, unknown> }> = [];
    for (const row of catalog) {
      if (Number(row.is_free) !== 1) continue;
      const questions = await this.loadQuestionsForQuiz(Number(row.id), null, undefined);
      if (!questions.length) continue;
      const generalLabel = Number(row.is_general) === 1 && !row.subject_name ? 'General / Full Course Revision' : '';
      const item = {
        id: row.id,
        courseId: row.course_id,
        topicId: row.topic_id,
        subtopicId: row.subtopic_id ? Number(row.subtopic_id) : null,
        lessonId: row.lesson_id ? Number(row.lesson_id) : null,
        subtopic: row.subtopic || '',
        isGeneral: Number(row.is_general) === 1,
        examModeOnly: Number(row.exam_mode_only) === 1,
        quizTitle: row.quiz_title,
        studentTitle: row.student_title || row.quiz_title,
        displayTitleMode: row.display_title_mode === 'title' ? 'title' : 'number',
        quizNumber: row.quiz_number ? Number(row.quiz_number) : null,
        quizDescription: row.quiz_description || '',
        totalQuestions: questions.length,
        totalMarks: Number(row.total_marks || 0),
        timeLimit: Number(row.time_limit || 0),
        hideTimeLimit: Number(row.hide_time_limit) === 1,
        passingMarks: this.resolvePassingMarks(Number(row.passing_marks || 0)),
        hidePassingMarks: Number(row.hide_passing_marks) === 1,
        updatedAt: row.updated_at || row.created_at || null,
        courseTitle: row.course_title || '',
        examType: row.exam_type || '',
        subjectName: row.subject_name || generalLabel,
        topicName: row.topic_name || '',
        subtopicName: row.topic_name || '',
        lessonTitle: row.lesson_title || '',
        isFree: true,
        randomizationMode: 'static',
        canAccess: true,
        accessLocked: false,
        accessMessage: '',
        canPracticeMode: true,
        canExamMode: true,
      };
      quizzes.push({
        item,
        full: { mode: 'practice', quiz: this.mapQuizForStudent(row), questions: questions.map((q) => this.mapQuestionForPracticeAttempt(q)) },
      });
    }
    return { quizzes };
  }

  async listResults(authorization?: string) {
    const user = await this.requireStudent(authorization);
    // 10.16-W: the 5 recent results from the ONE summary row (newest first),
    // named from the quiz catalogue held in memory. The id is the quiz id (one
    // recent entry per quiz), as on the phone.
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    return this.resultsFromRecent(Number(user.id), rows[0]?.recent_results);
  }

  /**
   * The results list from a summary row's recent results already read (10.22:
   * the website's start-up reply carries it — 0 extra statements). Names come
   * from the quiz catalogue in server memory.
   */
  async resultsFromRecent(userId: number, raw: unknown) {
    const rows = [{ recent_results: raw }];
    const user = { id: userId };
    let recent: any[] = [];
    try { recent = JSON.parse(String(rows[0]?.recent_results || '[]')); } catch { recent = []; }
    if (!Array.isArray(recent) || !recent.length) return [];
    const catalog = new Map((await this.getActiveQuizCatalog()).map((q) => [Number(q.id), q]));
    const out: any[] = [];
    // Counts worked out for entries from before they were kept: saved back
    // ONCE (one UPDATE, guarded on the row being unchanged) so the next open
    // reads them instead of marking the questions again.
    const fills: Array<{ index: number; c: number; w: number }> = [];
    for (const e of [...recent].reverse()) {
      const quizId = Number(e?.quizId);
      const quiz: any = catalog.get(quizId);
      if (!quiz) continue;
      let correct = Number(e?.c), wrong = Number(e?.w);
      if (!Number.isFinite(correct) || !Number.isFinite(wrong)) {
        // Entries from before the counts were kept: marked once from the
        // questions in server memory.
        correct = 0; wrong = 0;
        try {
          const ids: number[] = Array.isArray(e?.ids) ? e.ids.map(Number) : [];
          const qs = await this.loadQuestionsForQuiz(quizId, null, ids.length ? ids : undefined);
          for (const q of qs) {
            const r = this.buildExamQuestionAnswerRows(0, q, (e?.a || {})[String(q.id)]);
            if (r.status === 'correct') correct++; else if (r.status === 'wrong') wrong++;
          }
          fills.push({ index: recent.indexOf(e), c: correct, w: wrong });
        } catch { /* counts stay 0 */ }
      }
      out.push({
        attemptId: quizId,
        quizId,
        quizTitle: String((quiz.student_title || '').length ? quiz.student_title : quiz.quiz_title),
        displayTitleMode: quiz.display_title_mode === 'title' ? 'title' : 'number',
        quizNumber: quiz.quiz_number ? Number(quiz.quiz_number) : null,
        subtopic: String(quiz.subtopic || ''),
        courseTitle: String(quiz.course_title || ''),
        topicDisplay: Number(quiz.is_general) === 1 ? 'General / Full Course Revision' : String(quiz.subject_name || 'No Topic'),
        score: Number(e?.pct || 0),
        percentage: Number(e?.pct || 0),
        correctAnswers: correct,
        wrongAnswers: wrong,
        passStatus: e?.passed ? 'pass' : 'fail',
        submittedAt: e?.at || null,
        reviewedAt: e?.reviewed ? (e?.at || true) : null,
      });
    }
    if (fills.length) {
      const paths = fills.map((f) => `'$[${f.index}].c', ?, '$[${f.index}].w', ?`).join(', ');
      await this.db.execute(
        `UPDATE student_study_summary SET recent_results = JSON_SET(recent_results, ${paths})
          WHERE user_id = ? AND recent_results = ?`,
        [...fills.flatMap((f) => [f.c, f.w]), user.id, String(rows[0]?.recent_results || '')],
      ).catch(() => undefined);
    }
    return out;
  }

  async loadQuiz(
    authorization: string | undefined,
    quizId: number,
    mode: string,
    questionId?: number | null,
    appClient?: string
  ) {
    if (mode !== 'practice' && mode !== 'exam') {
      throw new BadRequestException('Invalid quiz mode');
    }

    // requireStudent and loadActiveQuiz are independent — run them together so
    // we pay one round-trip instead of two on shared hosting.
    const [user, quiz] = await Promise.all([
      this.requireStudent(authorization),
      this.loadActiveQuiz(quizId),
    ]);
    // 10.44: exams open with POST exam/:id/start (signed exam token on the
    // progress row); the old server-side exam session is gone.
    if (mode === 'exam' || Number(quiz.exam_mode_only) === 1) {
      throw new BadRequestException('Start this exam from the exam screen');
    }
    const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
      ? Number(questionId)
      : null;

    const isFreeQuiz = Number(quiz.is_free) === 1;
    const featureMessage = 'Practice mode is included with selected plans';

    // The access and plan-feature checks both depend only on
    // (user, quiz) and are independent of each other — run them concurrently.
    await Promise.all([
      this.ensureStudentCanAccessQuiz(user.id, quiz, appClient),
      isFreeQuiz
        ? Promise.resolve()
        : this.hasActivePlan(user).then((hasAccess) => {
            if (!hasAccess) throw new BadRequestException(featureMessage);
          }),
    ]);

    const practiceQuestions = await this.loadQuestionsForLocalPractice(quiz, scopedQuestionId);
    return {
      mode: 'practice',
      quiz: this.mapQuizForStudent(quiz),
      questions: practiceQuestions.map((question) =>
        isMobileAppClient(appClient) ? this.mapQuestionForAppPractice(question) : this.mapQuestionForPracticeAttempt(question)),
    };
  }

  // Resolve the student + quiz and run all access/entitlement checks concurrently.
  // requireStudent and loadActiveQuiz are independent; the three checks each depend
  // only on (user, quiz) and not on each other — so two parallel waves replace the
  // ~5 serial round-trips that otherwise dominate exam submit/save on shared hosting.
  /** Any active plan unlocks exam mode: from the signed token when present (no SQL). */
  private async hasActivePlan(user: any) {
    const carried = user?.__accessProfile;
    if (carried && typeof carried.hasActiveSubscription === 'boolean') return carried.hasActiveSubscription;
    return this.plansService.hasFeatureAccess(Number(user.id), 'exam_mode');
  }

  private async authorizeQuizForExam(authorization: string | undefined, quizId: number, appClient?: string) {
    const [user, quiz] = await Promise.all([
      this.requireStudent(authorization),
      this.loadActiveQuiz(quizId),
    ]);
    const isFreeQuiz = Number(quiz.is_free) === 1;
    await Promise.all([
      // Passed through, exactly as loadQuiz does. Dropping it here made every
      // exam write look like a website request, so a premium exam could be
      // started but never saved or submitted.
      this.ensureStudentCanAccessQuiz(user.id, quiz, appClient),
      isFreeQuiz
        ? Promise.resolve()
        : this.hasActivePlan(user).then((hasAccess) => {
            if (!hasAccess) throw new BadRequestException('Exam mode is included with selected plans');
          }),
    ]);
    return { user, quiz };
  }

  async startExam(authorization: string | undefined, quizId: number, appClient?: string) {
    const { user, quiz } = await this.authorizeQuizForExam(authorization, quizId, appClient);
    const questions = await this.loadQuestionsForQuiz(quiz.id, null, undefined);
    await this.studyStats.ensureBuilt(Number(user.id));
    const nonce = newExamNonce();
    await this.db.execute(
      'UPDATE student_study_summary SET exam_nonce = ?, exam_quiz_id = ? WHERE user_id = ?',
      [nonce, quizId, user.id],
    );
    const startedAt = Date.now();
    const limitMs = Math.max(0, Number(quiz.time_limit || 0)) * 60_000;
    const deadline = startedAt + (limitMs || 3 * 60 * 60 * 1000);
    const examToken = signExamToken({
      u: Number(user.id), q: quizId, n: nonce, s: startedAt, d: deadline, ids: questions.map((q) => Number(q.id)),
    });
    return {
      mode: 'exam',
      quiz: this.mapQuizForStudent(quiz),
      questions: questions.map((question) => this.mapQuestionForActiveAttempt(question)),
      examToken,
      startedAt: new Date(startedAt).toISOString(),
      deadlineAt: new Date(deadline).toISOString(),
      timeLimitSeconds: limitMs / 1000,
    };
  }

  async finishExam(
    authorization: string | undefined, quizId: number, dto: { examToken?: string; answers?: Record<string, unknown>; lean?: boolean }, appClient?: string,
  ) {
    const user = await this.requireStudent(authorization);
    const claims = verifyExamToken(dto?.examToken, Number(user.id), quizId);
    if (!claims) throw new BadRequestException('This exam has expired or is not valid. Start it again.');
    const quiz = await this.loadActiveQuiz(quizId);
    const loaded = await this.loadQuestionsForQuiz(quizId, null, undefined);
    const byId = new Map(loaded.map((q) => [Number(q.id), q]));
    const questions = claims.ids.map((id) => byId.get(Number(id))).filter(Boolean) as LoadedQuestion[];
    const answers = this.normalizeSubmittedAnswers(dto?.answers || {}, questions);

    let correct = 0, wrong = 0, unanswered = 0, raw = 0;
    for (const question of questions) {
      const r = this.buildExamQuestionAnswerRows(0, question, answers[String(question.id)]);
      raw += r.rawScore;
      if (r.status === 'correct') correct++;
      else if (r.status === 'wrong') wrong++;
      else unanswered++;
    }
    const score = this.scaleScoreToHundred(raw, questions.length);
    const pct = Math.max(0, Math.min(100, Math.round(score)));
    const passed = score >= this.resolvePassingMarks(Number(quiz.passing_marks || 0)) ? 1 : 0;
    const eligible = pct >= XP.MIN_PERCENT ? 1 : 0;
    const day = localDateKey(new Date());

    // The quiz's old byte (passed bit + best % + 1) is read inside the statement.
    const old = oldByteSql('quiz_marks');
    const oldP = [quizId, quizId];
    // Option 1 (user): first try ≥ 30 % +4; a repeat +2 only when it raises the
    // best %; first pass +16 (once).
    const baseSql = `IF(?, IF(${old} = 0, ?, IF(? > (${old} & 127) - 1, ?, 0)), 0) + IF(? AND (${old} & 128) = 0, ?, 0)`;
    const baseParams = [eligible, ...oldP, XP.EXAM_TAKE, pct, ...oldP, XP.EXAM_RETAKE, passed, ...oldP, XP.EXAM_PASS];
    // 10.28: today's exam goal, the streak when all four goals are done, XP
    // (+ any practices riding along) — all in the one update below.
    const w = progressWrite(day, { baseXpSql: baseSql, baseXpParams: baseParams, practices: takeRideAlong() });
    const byte = setByteSql('quiz_marks', `IF((${old} & 128) <> 0 OR ?, 128, 0) + GREATEST(IF(${old} = 0, -1, (${old} & 127) - 1), ?) + 1`);
    const entry = JSON.stringify({
      k: String(quizId), quizId, pct, passed: passed === 1, reviewed: false, at: new Date().toISOString(),
      ids: questions.map((q) => Number(q.id)), a: answers, c: correct, w: wrong,
    });
    // 10.18: a redo replaces its own entry; under 5 the entry is added; at 5
    // the OLDEST FREE entry (passed AND reviewed) makes room — failed or
    // unreviewed results are never dropped (the phone only starts an exam
    // when a slot is free; older builds fall back to the oldest).
    const base = `COALESCE(recent_results, '[]')`;
    const found = `JSON_SEARCH(${base}, 'one', ?, NULL, '$[*].k')`;
    const freeSlot = `CASE ${[0, 1, 2, 3, 4]
      .map((i) => `WHEN JSON_EXTRACT(${base}, '$[${i}].passed') = 'true' AND JSON_EXTRACT(${base}, '$[${i}].reviewed') = 'true' THEN '$[${i}]'`)
      .join(' ')} ELSE '$[0]' END`;
    const room = `IF(${found} IS NOT NULL, JSON_REMOVE(${base}, SUBSTRING_INDEX(JSON_UNQUOTE(${found}), '.k', 1)),
                     IF(JSON_LENGTH(${base}) < 5, ${base}, JSON_REMOVE(${base}, ${freeSlot})))`;
    const recentSql = `JSON_ARRAY_APPEND(${room}, '$', JSON_EXTRACT(?, '$'))`;
    const key = String(quizId);
    const recentParams = [key, key, entry];

    const [res] = await this.db.execute<ResultSetHeader>(
      `UPDATE student_study_summary
          SET ${w.streak.sql},
              progress_version = LAST_INSERT_ID((progress_version + 1) * 1000 + ${w.amount.sql}) DIV 1000,
              ${w.pay.sql},
              recent_results = ${recentSql},
              quiz_marks = ${byte.sql},
              exam_nonce = NULL,
              exam_quiz_id = NULL,
              ${w.seq.sql}
        WHERE user_id = ? AND exam_nonce = ?`,
      [
        ...w.streak.params, ...w.amount.params, ...w.pay.params,
        ...recentParams,
        ...byte.params(quizId, [...oldP, passed, ...oldP, ...oldP, pct]),
        ...w.seq.params,
        user.id, claims.n,
      ] as any[],
    );
    if (!res.affectedRows) {
      // Already submitted (a double tap, a retry after a lost reply): nothing
      // is written twice; the phone keeps the result it already has.
      returnRideAlong(); // practices riding along are saved on their own
      return { success: true, duplicate: true };
    }
    const packed = Number(res.insertId || 0);
    return {
      success: true,
      quizId,
      percentage: pct,
      score,
      passed: passed === 1,
      correct, wrong, unanswered,
      total: questions.length,
      xp: { awarded: packed % 1000, capped: false, ...(eligible ? {} : { reason: 'low_score' as const }) },
      progressVersion: Math.floor(packed / 1000),
      // Review on the phone: the questions with their answers and explanations
      // plus what the student chose — kept locally, no review request.
      answers,
      // The result and the review in the same layout as the old result /
      // review endpoints (attempt id = quiz id: one recent entry per quiz), so
      // the phone keeps them and opens Result / Review with no request.
      ...this.recentPayloads(quiz, questions, answers, { pct, passed: passed === 1, score, correct, wrong, unanswered }, dto?.lean === true),
      ...(dto?.lean !== true && isMobileAppClient(appClient) ? { practiceQuiz: this.mapQuizForStudent(quiz) } : {}), // 10.27 R4
    };
  }

  /** Result + review payloads for one recent entry, in the existing layouts (10.16). */
  private recentPayloads(
    quiz: QuizRow,
    questions: LoadedQuestion[],
    answers: Record<string, unknown>,
    r: { pct: number; passed: boolean; score: number; correct: number; wrong: number; unanswered: number },
    lean = false,
  ) {
    const quizId = Number(quiz.id);
    const topic = Number(quiz.is_general) === 1 ? 'General / Full Course Revision' : String((quiz as any).subject_name || (quiz as any).topic_name || 'No Topic');
    const passStatus = r.passed ? 'pass' : 'fail';
    const stored = (question: LoadedQuestion) => {
      const a = answers[String(question.id)];
      if (a === undefined || a === null) return [];
      if (question.question_type === 'sba') return [{ optionId: Number(a), isSelected: 1 }];
      return Object.entries(a as Record<string, unknown>).map(([optionId, v]) => ({ optionId: Number(optionId), isSelected: Number(v) === 1 ? 1 : 0 }));
    };
    return {
      result: {
        attemptId: quizId,
        quizId,
        quizTitle: String(quiz.quiz_title || ''),
        displayTitleMode: quiz.display_title_mode === 'title' ? 'title' : 'number',
        quizNumber: Number((quiz as any).quiz_number || 0) || null,
        courseTitle: String((quiz as any).course_title || ''),
        topicDisplay: topic,
        passStatus,
        totalQuestions: questions.length,
        totalMarks: QUIZ_TOTAL_MARKS,
        correctAnswers: r.correct,
        wrongAnswers: r.wrong,
        unansweredQuestions: r.unanswered,
        score: r.score,
        percentage: r.pct,
        passingMarks: this.resolvePassingMarks(Number(quiz.passing_marks || 0)),
      },
      review: {
        attempt: {
          attemptId: quizId,
          quizId,
          lessonId: quiz.lesson_id ? Number(quiz.lesson_id) : null,
          quizTitle: String(quiz.quiz_title || ''),
          courseTitle: String((quiz as any).course_title || ''),
          topicDisplay: topic,
          score: r.score,
          percentage: r.pct,
          passStatus,
        },
        questions: questions.map((question) => {
          const full = this.mapReviewQuestion(question, stored(question)) as Record<string, unknown>;
          if (!lean) return full;
          // 10.26 P2: the phone already holds this quiz's text, options,
          // explanation and recap (its practice-quiz file) — send only how
          // this student answered each question.
          const out: Record<string, unknown> = {};
          for (const key of LEAN_REVIEW_KEYS) if (key in full) out[key] = full[key];
          return out;
        }),
      },
      ...(lean ? { lean: true } : {}),
    };
  }

  /**
   * One recent entry's result + review from the progress row (10.16) — for the
   * website and a phone without its saved copy: the row (1 statement) and the
   * entry's questions from server memory (ONE joined statement when cold).
   */
  async recentReview(authorization: string | undefined, quizId: number, appClient?: string, part?: string, lean = false) {
    const user = await this.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT JSON_EXTRACT(recent_results, SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k')), '.k', 1)) AS entry
         FROM student_study_summary WHERE user_id = ? LIMIT 1`,
      [String(quizId), user.id],
    );
    let entry: any = null;
    try { entry = rows[0]?.entry ? JSON.parse(String(rows[0].entry)) : null; } catch { entry = null; }
    if (!entry) throw new NotFoundException('Result not found');
    const quiz = await this.loadActiveQuiz(quizId);
    // Same rule as the old review: a premium quiz's review is app-only.
    // The result part alone (score, counts) stays open on the website, as the old
    // result endpoint was; only the question-by-question review is app-only.
    if (part !== 'result' && Number(quiz.is_free) !== 1 && !isMobileAppClient(appClient)) throw new AppOnlyContentException();
    const ids: number[] = Array.isArray(entry.ids) ? entry.ids.map(Number) : [];
    const loaded = await this.loadQuestionsForQuiz(quizId, null, ids.length ? ids : undefined);
    const byId = new Map(loaded.map((q) => [Number(q.id), q]));
    const questions = (ids.length ? ids.map((id) => byId.get(id)).filter(Boolean) : loaded) as LoadedQuestion[];
    const answers = (entry.a && typeof entry.a === 'object') ? entry.a as Record<string, unknown> : {};
    let correct = 0, wrong = 0, unanswered = 0, raw = 0;
    for (const question of questions) {
      const r = this.buildExamQuestionAnswerRows(0, question, answers[String(question.id)]);
      raw += r.rawScore;
      if (r.status === 'correct') correct++;
      else if (r.status === 'wrong') wrong++;
      else unanswered++;
    }
    const score = this.scaleScoreToHundred(raw, questions.length);
    const payloads = this.recentPayloads(quiz, questions, answers, { pct: Number(entry.pct) || 0, passed: Boolean(entry.passed), score, correct, wrong, unanswered }, lean);
    if (part === 'result') return { result: payloads.result, reviewed: Boolean(entry.reviewed), at: entry.at || null };
    // 10.27 R4: a full review also carries the practice header for the app,
    // so the phone keeps these questions as the practice quiz too.
    const practiceQuiz = !lean && isMobileAppClient(appClient) ? { practiceQuiz: this.mapQuizForStudent(quiz) } : {};
    return { ...payloads, ...practiceQuiz, reviewed: Boolean(entry.reviewed), at: entry.at || null };
  }

  /** Review finished (1 statement): the recent entry's "reviewed" flag, for the phone's lock rule. */
  async markRecentReviewed(authorization: string | undefined, quizId: number) {
    const user = await this.requireStudent(authorization);
    const key = String(quizId);
    const path = `SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k')), '.k', 1)`;
    const [res] = await this.db.execute<ResultSetHeader>(
      `UPDATE student_study_summary
          SET progress_version = LAST_INSERT_ID(progress_version + 1),
              recent_results = JSON_SET(recent_results, CONCAT(${path}, '.reviewed'), JSON_EXTRACT('true', '$'))
        WHERE user_id = ? AND JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k') IS NOT NULL
          -- 10.27 R2: already reviewed → nothing is written (no new progress version).
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(recent_results, CONCAT(${path}, '.reviewed'))), 'false') <> 'true'`,
      [key, user.id, key, key],
    );
    return res.affectedRows
      ? { ok: true, progressVersion: Number(res.insertId || 0) }
      : { ok: true, alreadyReviewed: true };
  }

  private async requireStudent(authorization?: string) {
    const token = this.extractToken(authorization);
    if (looksLikeAccessToken(token)) {
      const user = userFromAccessToken(token);
      if (user.role !== 'student') throw new UnauthorizedException('Student access required');
      if (user.status !== 'active') throw new UnauthorizedException('Your student account is not active yet');
      return user as any;
    }
    // The website's cookie session: the API boundary already resolved this
    // student for this request (10.16-W) — reuse it, no second lookup.
    const known = studentFromRequest();
    if (known && known.role === 'student' && known.status === 'active') return known as any;
    const [rows] = await this.db.execute<AuthUser[]>(
      `SELECT id, full_name, email, role, status, session_token
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(token)]
    );
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }
    if (user.role !== 'student') {
      throw new UnauthorizedException('Student access required');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account inactive');
    }
    return user;
  }

  private extractToken(authorization?: string) {
    const token = extractBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }
    return token;
  }

  private async ensureStudentCanAccessQuiz(
    userId: number,
    quiz: Pick<QuizRow, 'id' | 'course_id' | 'is_free'>,
    appClient?: string
  ) {
    // Premium quizzes are app-only, permanently, regardless of subscription —
    // checked before (and independent of) the subscription-scope check below.
    // See common/utils/mobile-client.util.ts.
    if (Number(quiz.is_free) !== 1 && !isMobileAppClient(appClient)) {
      throw new AppOnlyContentException();
    }

    const accessProfile = await this.getQuizAccessProfile(userId);
    if (!this.canAccessQuiz(quiz, accessProfile)) {
      throw new BadRequestException('This quiz is included with selected course plans');
    }
  }

  private async getQuizAccessProfile(userId: number): Promise<QuizAccessProfile> {
    // From this request's signed token when present (no SQL), else the database.
    const rows = await getScopeRows<QuizAccessScopeRow>(this.db, userId);

    const profile: QuizAccessProfile = {
      hasAnyPaidQuizAccess: rows.length > 0,
      hasFullAccess: false,
      courseIds: new Set<number>(),
    };

    for (const row of rows) {
      const courseIds = this.parseIdList(row.course_ids_json);
      const scope = this.resolveEffectiveAccessScope(row, courseIds);

      if (scope === 'all' && courseIds.length === 0) {
        profile.hasFullAccess = true;
      } else if (scope === 'courses') {
        courseIds.forEach((id) => profile.courseIds.add(id));
      }
    }

    return profile;
  }

  private parseIdList(raw: string | null) {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  private resolveEffectiveAccessScope(row: QuizAccessScopeRow, courseIds: number[]) {
    const planSlug = String(row.plan_slug || '').trim();
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : 'all');
  }

  private canAccessQuiz(quiz: Pick<QuizRow, 'id' | 'course_id' | 'is_free'>, profile: QuizAccessProfile) {
    if (Number(quiz.is_free) === 1) return true;
    if (!profile.hasAnyPaidQuizAccess) return false;
    if (profile.hasFullAccess) return true;
    return profile.courseIds.has(Number(quiz.course_id));
  }

  // ── Quiz content kept per quiz stamp (OPTIMIZE 10.27 R1) ──────────────────
  // A quiz's header and questions are the same for every student. They are
  // built once per quiz stamp (raised in the same save when the quiz or one of
  // its questions, options or recap changes; carried in the Q-Bank list) and
  // kept in memory and as a file, shared by every Node process and kept across
  // restarts. Practice opens, exams and reviews then read no rows; only an
  // edited quiz is rebuilt, once.
  private readonly quizContent = new Map<number, { stamp: number; quiz: QuizRow; questions: LoadedQuestion[] }>();
  private readonly quizContentBuilding = new Map<string, Promise<{ stamp: number; quiz: QuizRow; questions: LoadedQuestion[] } | null>>();
  private readonly quizContentDir = join(process.env.CACHE_DIR || join(process.cwd(), 'storage', 'cache'), 'quiz-content');
  private static readonly QUIZ_CONTENT_KEEP = 400; // quizzes held in memory (the files keep the rest)

  /** This quiz's stamp from the Q-Bank list in server memory (0 statements), or null. */
  private async quizStamp(quizId: number): Promise<number | null> {
    if (!this.catalogue) return null;
    try {
      const row = (await this.catalogue.names()).quiz.get(Number(quizId));
      return row ? Number(row[16]) || 1 : null;
    } catch {
      return null;
    }
  }

  /** The quiz's header and linked questions for its current stamp, or null (not in the list). */
  private async quizContentFor(quizId: number) {
    const stamp = await this.quizStamp(quizId);
    if (stamp === null) return null;
    const held = this.quizContent.get(quizId);
    if (held && held.stamp === stamp) return held;
    const key = `${quizId}-${stamp}`;
    const running = this.quizContentBuilding.get(key);
    if (running) return running;
    const work = (async () => {
      const file = join(this.quizContentDir, `${key}.json`);
      let content: { stamp: number; quiz: QuizRow; questions: LoadedQuestion[] } | null = null;
      try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        if (saved?.quiz && Array.isArray(saved.questions)) content = { stamp, quiz: saved.quiz, questions: saved.questions };
      } catch { /* not built yet */ }
      if (!content) {
        const quiz = await this.loadActiveQuizFromDb(quizId);
        let questions: LoadedQuestion[] = [];
        try { questions = await this.loadQuestionsForQuizFromDb(quizId); } catch { questions = []; }
        content = { stamp, quiz, questions };
        try {
          await mkdir(this.quizContentDir, { recursive: true });
          await writeFile(`${file}.${process.pid}.tmp`, JSON.stringify({ quiz, questions }));
          await rename(`${file}.${process.pid}.tmp`, file);
          // The quiz's older copies are no longer used.
          for (const name of await readdir(this.quizContentDir)) {
            if (name.startsWith(`${quizId}-`) && name !== `${key}.json` && name.endsWith('.json')) await unlink(join(this.quizContentDir, name)).catch(() => {});
          }
        } catch { /* the memory copy still serves */ }
      }
      this.quizContent.delete(quizId);
      this.quizContent.set(quizId, content);
      if (this.quizContent.size > QuizAttemptsService.QUIZ_CONTENT_KEEP) {
        this.quizContent.delete(this.quizContent.keys().next().value as number);
      }
      return content;
    })().finally(() => this.quizContentBuilding.delete(key));
    this.quizContentBuilding.set(key, work);
    return work;
  }

  private async loadActiveQuiz(quizId: number) {
    const content = await this.quizContentFor(quizId);
    if (content) return content.quiz;
    return this.loadActiveQuizFromDb(quizId);
  }

  private async loadActiveQuizFromDb(quizId: number) {
    const now = Date.now();
    const cached = this.activeQuizCache.get(quizId);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const [rows] = await this.db.execute<QuizRow[]>(
      `
        SELECT
          q.id,
          q.course_id,
          q.topic_id,
          q.subtopic_id,
          NULL AS lesson_id,
          NULL AS paper_id,
          '' AS subtopic,
          q.category,
          q.is_general,
          q.is_free,
          -- 10.54: dropped columns replaced by the fixed values every set had.
          0 AS exam_mode_only,
          q.quiz_title AS student_title,
          'title' AS display_title_mode,
          '' AS quiz_description,
          q.total_questions,
          q.total_marks,
          q.time_limit,
          0 AS hide_time_limit,
          q.passing_marks,
          0 AS hide_passing_marks,
          q.status,
          q.updated_at,
          q.created_at,
          q.quiz_title,
          c.course_title,
          t.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          NULL AS lesson_title
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN subtopics st ON q.subtopic_id = st.id
        WHERE q.id = ? AND q.status = 'active'
        LIMIT 1
      `,
      [quizId]
    );
    const quiz = rows[0];
    if (!quiz) {
      throw new NotFoundException('Quiz not found or inactive');
    }
    this.activeQuizCache.set(quizId, { value: quiz, expiresAt: now + QUIZ_CONTENT_CACHE_MS });
    return quiz;
  }

  private async loadQuestionsForQuiz(quizId: number, questionId?: number | null, questionIds?: number[]) {
    const content = await this.quizContentFor(quizId);
    if (content && content.questions.length) {
      const scoped = Number(questionId) > 0 ? Number(questionId) : null;
      const ids = Array.from(new Set((questionIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)));
      const byId = new Map(content.questions.map((q) => [Number(q.id), q]));
      // Linked questions (or a chosen subset of them) come from the kept copy;
      // anything not in it falls back to the database.
      if (ids.length === 0 || ids.every((id) => byId.has(id))) {
        const list = ids.length ? ids.map((id) => byId.get(id)!) : content.questions;
        if (!scoped) return list;
        const one = list.filter((q) => Number(q.id) === scoped);
        if (one.length) return one;
        throw new NotFoundException('Question not found in this quiz');
      }
    }
    return this.loadQuestionsForQuizFromDb(quizId, questionId, questionIds);
  }

  private async loadQuestionsForQuizFromDb(quizId: number, questionId?: number | null, questionIds?: number[]) {
    const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
      ? Number(questionId)
      : null;
    const frozenQuestionIds = Array.from(new Set(questionIds || []))
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const cacheKey = `${quizId}:${scopedQuestionId || 'all'}:${frozenQuestionIds.length ? `ids:${frozenQuestionIds.join(',')}` : 'links'}`;
    const now = Date.now();
    const cached = this.quizQuestionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    // ONE statement (OPTIMIZE 10.16): one row per question, its options packed
    // into that row as JSON (joined by question id) and its theory recap joined
    // in — 20 questions = 20 rows (was 3 queries: questions, options, recaps).
    const select = `
      SELECT
        q.id, q.course_id, q.topic_id, q.subtopic_id, q.subtopic, q.category, q.question_type,
        q.question_text, q.explanation, q.explanation_image_url, q.question_approach,
        q.question_approach_highlights, q.status, q.updated_at,
        q.options_json, q.recap_json
      FROM questions q`; // 10.43: options and recap are in the question row
    let joinedRows: RowDataPacket[] = [];
    if (frozenQuestionIds.length > 0) {
      const requestedIds = scopedQuestionId
        ? frozenQuestionIds.filter((id) => id === scopedQuestionId)
        : frozenQuestionIds;
      if (requestedIds.length === 0) {
        throw new NotFoundException('Question not found in this quiz');
      }
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `${select}
          WHERE q.id IN (${sqlPlaceholders(requestedIds)}) AND q.status = 'active'`,
        requestedIds
      );
      const orderById = new Map(frozenQuestionIds.map((id, index) => [id, index]));
      joinedRows = rows.sort((left, right) => (
        (orderById.get(Number(left.id)) ?? 0) - (orderById.get(Number(right.id)) ?? 0)
      ));
    } else {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `${select}
          INNER JOIN question_quizzes qq ON qq.question_id = q.id
          WHERE qq.quiz_id = ? AND q.status = 'active'
            ${scopedQuestionId ? 'AND q.id = ?' : ''}
          ORDER BY qq.sort_order ASC, qq.question_id ASC`,
        scopedQuestionId ? [quizId, scopedQuestionId] : [quizId]
      );
      joinedRows = rows;
    }

    if (joinedRows.length === 0) {
      throw new NotFoundException(scopedQuestionId ? 'Question not found in this quiz' : 'No questions linked to this quiz');
    }

    // Split the joined rows back into the shapes the mapping below uses.
    const questionRows = joinedRows as unknown as QuestionRow[];
    const optionRows: OptionRow[] = [];
    const recapRows: TheoryRecapRow[] = [];
    for (const row of joinedRows) {
      for (const o of optionsOf(Number(row.id), row.options_json)) optionRows.push(o as unknown as OptionRow);
      const recap = recapOf(Number(row.id), row.recap_json);
      if (recap) recapRows.push(recap as unknown as TheoryRecapRow);
    }
    // The question's content version is not shown by any app, so it is no
    // longer looked up on every quiz open (that read ~8 rows per question,
    // OPTIMIZE 10 step 5); contentTrace keeps its shape with version 1.
    const versionByQuestionId = new Map<number, { versionNumber: number; createdAt: string | Date | null }>();
    const recapMap = new Map<number, TheoryRecapData>();
    for (const recap of recapRows) {
      recapMap.set(recap.question_id, {
        conceptName: recap.concept_name || '',
        hierarchy: {
          course: recap.hierarchy_course || '',
          subject: recap.hierarchy_subject || '',
          topic: recap.hierarchy_topic || '',
          lesson: recap.hierarchy_lesson || '',
        },
        etiology: this.parseJsonArray(recap.etiology),
        pathophysiology: this.parseJsonArray(recap.pathophysiology),
        clinicalFeatures: this.parseJsonArray(recap.clinical_features),
        investigations: this.parseJsonArray(recap.investigations),
        treatment: this.parseJsonArray(recap.treatment),
        keyPoints: this.parseJsonArray(recap.key_points),
        mnemonic: recap.mnemonic || '',
      });
    }

    const optionsByQuestionId = this.mapOptionsByQuestionId(optionRows);

    const loadedQuestions = questionRows.map((question) => ({
      ...this.withQuestionTrace(question, versionByQuestionId),
      options: (optionsByQuestionId.get(question.id) || [])
        .map((option) => ({
          id: option.id,
          optionLabel: option.option_label,
          optionText: option.option_text,
          isCorrect: Number(option.is_correct) === 1 ? 1 : 0,
          whyIncorrect: option.why_incorrect || '',
        })),
      theoryRecap: recapMap.get(question.id) || null,
    }));
    this.quizQuestionCache.set(cacheKey, { value: loadedQuestions, expiresAt: now + QUIZ_CONTENT_CACHE_MS });
    return loadedQuestions;
  }

  private async loadQuestionsForLocalPractice(quiz: QuizRow, questionId?: number | null) {
    return this.loadQuestionsForQuiz(quiz.id, questionId, undefined);
  }

  private normalizeQuestionCategory(category: string) {
    const value = String(category || '').trim();
    if (value === 'past') return 'past_paper';
    return value;
  }

  private normalizeLegacyQuestionCategory(category: string) {
    const value = String(category || '').trim();
    if (value === 'past_paper') return 'past';
    return value;
  }

  private mapOptionsByQuestionId(optionRows: OptionRow[]) {
    const map = new Map<number, OptionRow[]>();
    for (const option of optionRows) {
      const questionId = Number(option.question_id);
      if (!map.has(questionId)) {
        map.set(questionId, []);
      }
      map.get(questionId)?.push(option);
    }
    return map;
  }


  private withQuestionTrace(
    question: QuestionRow,
    versionByQuestionId: Map<number, { versionNumber: number; createdAt: string | Date | null }>
  ) {
    const version = versionByQuestionId.get(Number(question.id));

    return {
      ...question,
      contentVersion: version?.versionNumber || 1,
      contentVersionedAt: version?.createdAt || question.updated_at || null,
      contentSourceLabel: `Question bank #${question.id}`,
    };
  }

  private parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private normalizeSubmittedAnswers(rawAnswers: Record<string, unknown>, questions: LoadedQuestion[]) {
    const normalized: Record<string, unknown> = {};
    const questionById = new Map(questions.map((question) => [String(question.id), question]));
    for (const [rawQuestionId, rawValue] of Object.entries(rawAnswers || {})) {
      const questionId = String(Number(rawQuestionId));
      const question = questionById.get(questionId);
      if (!question) continue;

      if (question.question_type === 'sba') {
        const selectedId = Number(rawValue);
        if (question.options.some((option) => option.id === selectedId)) {
          normalized[questionId] = selectedId;
        }
        continue;
      }

      const submitted = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
        ? rawValue as Record<string, unknown>
        : {};
      const tfMap: Record<string, number> = {};
      for (const option of question.options) {
        const value = submitted[String(option.id)];
        if (value !== 0 && value !== 1 && value !== '0' && value !== '1') continue;
        tfMap[String(option.id)] = Number(value) === 1 ? 1 : 0;
      }
      if (Object.keys(tfMap).length) {
        normalized[questionId] = tfMap;
      }
    }
    return normalized;
  }

  private getAnswerState(question: { question_type: 'sba' | 'true_false'; options: Array<{ id: number; isCorrect: number }> }, storedRows: Array<{ optionId: number; isSelected: number }>) {
    if (question.question_type === 'sba') {
      return {
        selectedIds: storedRows.filter((row) => row.isSelected === 1).map((row) => row.optionId),
        tfMap: {} as Record<number, number>,
      };
    }

    const tfMap: Record<number, number> = {};
    for (const row of storedRows) {
      tfMap[row.optionId] = row.isSelected;
    }
    return {
      selectedIds: [] as number[],
      tfMap,
    };
  }

  private evaluateAnswer(question: { question_type: 'sba' | 'true_false'; options: Array<{ id: number; isCorrect: number }> }, state: { selectedIds: number[]; tfMap: Record<number, number> }) {
    if (question.question_type === 'sba') {
      const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id).sort((a, b) => a - b);
      const selected = [...state.selectedIds].sort((a, b) => a - b);
      if (selected.length === 0) return 'unanswered';
      return JSON.stringify(selected) === JSON.stringify(correctIds) ? 'correct' : 'wrong';
    }

    if (Object.keys(state.tfMap).length === 0) return 'unanswered';
    if (Object.keys(state.tfMap).length < question.options.length) return 'wrong';
    return question.options.every((opt) => state.tfMap[opt.id] === opt.isCorrect) ? 'correct' : 'wrong';
  }

  private calculateQuestionScore(
    question: { question_type: 'sba' | 'true_false'; options: Array<{ id: number; isCorrect: number }> },
    state: { selectedIds: number[]; tfMap: Record<number, number> }
  ) {
    if (question.question_type === 'sba') {
      const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id).sort((a, b) => a - b);
      const selected = [...state.selectedIds].sort((a, b) => a - b);
      if (!selected.length) return 0;
      return JSON.stringify(selected) === JSON.stringify(correctIds) ? SBA_QUESTION_MARKS : 0;
    }

    let correctStatements = 0;
    let wrongStatements = 0;
    for (const option of question.options) {
      if (!(option.id in state.tfMap)) continue;
      if (state.tfMap[option.id] === option.isCorrect) correctStatements++;
      else wrongStatements++;
    }

    return this.calculateTrueFalseScore(correctStatements, wrongStatements).score;
  }

  private calculateTrueFalseScore(correctStatements: number, wrongStatements: number) {
    const boundedCorrect = Math.max(0, Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION, Number(correctStatements) || 0));
    const boundedWrong = Math.max(
      0,
      Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION - boundedCorrect, Number(wrongStatements) || 0)
    );
    const rawScore = TRUE_FALSE_STATEMENT_MARKS * (boundedCorrect - boundedWrong);
    const score = Math.max(0, Math.min(SBA_QUESTION_MARKS, Number(rawScore.toFixed(2))));
    const percentage = Number(((score / SBA_QUESTION_MARKS) * 100).toFixed(2));

    return {
      score,
      percentage,
    };
  }

  private calculateSubmissionQuestionScore(
    question: LoadedQuestion,
    rawAnswer: unknown
  ) {
    if (question.question_type === 'sba') {
      const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
      const state = {
        selectedIds: selectedId ? [selectedId] : [],
        tfMap: {} as Record<number, number>,
      };
      return this.calculateQuestionScore(question, state);
    }

    const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? (rawAnswer as Record<string, unknown>) : {};
    const tfMap: Record<number, number> = {};
    for (const option of question.options) {
      const value = tfSubmitted[String(option.id)];
      if (value !== 0 && value !== 1 && value !== '0' && value !== '1') continue;
      tfMap[option.id] = Number(value) === 1 ? 1 : 0;
    }

    return this.calculateQuestionScore(question, { selectedIds: [], tfMap });
  }

  private scaleScoreToHundred(rawScore: number, questionCount: number) {
    if (!questionCount) return 0;
    const maxRawScore = questionCount * SBA_QUESTION_MARKS;
    if (!maxRawScore) return 0;
    return Number(((rawScore / maxRawScore) * QUIZ_TOTAL_MARKS).toFixed(2));
  }

  private buildExamQuestionAnswerRows(
    attemptId: number,
    question: LoadedQuestion,
    rawAnswer: unknown
  ) {
    if (question.question_type === 'sba') {
      const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
      const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id);
      const rawScore = this.calculateSubmissionQuestionScore(question, rawAnswer);
      if (!selectedId) return { status: 'unanswered' as const, rawScore, rows: [] };

      return {
        status: correctIds.length === 1 && correctIds[0] === selectedId ? 'correct' as const : 'wrong' as const,
        rawScore,
        rows: [[attemptId, question.id, selectedId, 1] as AnswerInsertRow],
      };
    }

    const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? (rawAnswer as Record<string, unknown>) : {};
    let answeredStatements = 0;
    let allCorrect = true;
    const rows: AnswerInsertRow[] = [];

    for (const option of question.options) {
      const value = tfSubmitted[String(option.id)];
      if (value !== 0 && value !== 1 && value !== '0' && value !== '1') {
        allCorrect = false;
        continue;
      }
      const numeric = Number(value) === 1 ? 1 : 0;
      answeredStatements++;
      rows.push([attemptId, question.id, option.id, numeric]);
      if (numeric !== option.isCorrect) {
        allCorrect = false;
      }
    }

    const rawScore = this.calculateSubmissionQuestionScore(question, rawAnswer);
    if (answeredStatements === 0) return { status: 'unanswered' as const, rawScore, rows };
    return {
      status: answeredStatements === question.options.length && allCorrect ? 'correct' as const : 'wrong' as const,
      rawScore,
      rows,
    };
  }

  private mapQuizForStudent(quiz: QuizRow) {
    return {
      id: quiz.id,
      courseId: quiz.course_id,
      topicId: quiz.topic_id,
      subtopicId: quiz.subtopic_id ? Number(quiz.subtopic_id) : null,
      lessonId: quiz.lesson_id ? Number(quiz.lesson_id) : null,
      courseTitle: quiz.course_title || '',
      subjectName: Number(quiz.is_general) === 1 ? 'General / Full Course Revision' : quiz.subject_name || '',
      topicName: Number(quiz.is_general) === 1 ? 'General / Full Course Revision' : quiz.subject_name || 'No Topic',
      subtopicName: quiz.topic_name || '',
      lessonTitle: quiz.lesson_title || '',
      isGeneral: Number(quiz.is_general) === 1,
      isFree: Number(quiz.is_free) === 1,
      examModeOnly: Number(quiz.exam_mode_only) === 1,
      randomizationMode: 'static', // 10.54: kept for installed apps
      quizTitle: quiz.quiz_title,
      quizDescription: quiz.quiz_description || '',
      totalQuestions: Number(quiz.total_questions || 0),
      totalMarks: QUIZ_TOTAL_MARKS,
      timeLimit: Number(quiz.time_limit || 0),
      hideTimeLimit: Number(quiz.hide_time_limit) === 1,
      passingMarks: this.resolvePassingMarks(Number(quiz.passing_marks || 0)),
      hidePassingMarks: Number(quiz.hide_passing_marks) === 1,
      subtopic: quiz.subtopic || '',
    };
  }

  private mapQuestion(question: LoadedQuestion) {
    return {
      id: question.id,
      questionType: question.question_type,
      questionText: question.question_text,
      explanation: question.explanation || '',
      explanationImageUrl: question.explanation_image_url || '',
      questionApproach: question.question_approach || '',
      questionApproachHighlights: this.parseJsonArray(question.question_approach_highlights ?? null),
      contentTrace: {
        source: question.contentSourceLabel,
        sourceId: question.id,
        version: question.contentVersion,
        versionLabel: `v${question.contentVersion}`,
        versionedAt: question.contentVersionedAt,
      },
      options: question.options,
      answerKey: this.buildAnswerKey(question),
      theoryRecap: question.theoryRecap || null,
    };
  }

  /**
   * Practice in the phone app (OPTIMIZE 10 step 5): what the practice screen
   * shows, nothing more. The answer key is left out (the app reads the right
   * answers from each option's isCorrect), as are the content trace and the
   * reveal flag it never read. The app keeps the downloaded quiz until the
   * catalogue version changes.
   */
  private mapQuestionForAppPractice(question: LoadedQuestion) {
    const { answerKey: _a, contentTrace: _t, ...rest } = this.mapQuestion(question);
    return rest;
  }

  private mapQuestionForPracticeAttempt(question: LoadedQuestion) {
    return {
      ...this.mapQuestion(question),
      canRevealAnswer: true,
    };
  }

  private buildAnswerKey(question: LoadedQuestion) {
    if (question.question_type === 'true_false') {
      return {
        type: 'true_false',
        statements: question.options.map((option) => ({
          optionId: option.id,
          label: option.optionLabel,
          text: option.optionText,
          answer: option.isCorrect === 1 ? 'True' : 'False',
        })),
      };
    }

    return {
      type: 'sba',
      correctOptions: question.options
        .filter((option) => option.isCorrect === 1)
        .map((option) => ({
          optionId: option.id,
          label: option.optionLabel,
          text: option.optionText,
        })),
    };
  }

  private mapQuestionForActiveAttempt(question: LoadedQuestion) {
    return {
      id: question.id,
      questionType: question.question_type,
      questionText: question.question_text,
      options: question.options.map((option) => ({
        id: option.id,
        optionLabel: option.optionLabel,
        optionText: option.optionText,
      })),
    };
  }

  private mapReviewQuestion(
    question: LoadedQuestion,
    storedRows: Array<{ optionId: number; isSelected: number }>
  ) {
    const answerState = this.getAnswerState(question, storedRows);
    const answerStatus = this.evaluateAnswer(question, answerState);
    const questionScore = this.calculateQuestionScore(question, answerState);
    return {
      ...this.mapQuestion(question),
      // Where the question sits (10.17): the phone counts weak topics from these.
      courseId: Number(question.course_id) || 0,
      subjectId: Number(question.topic_id) || 0,
      topicId: Number(question.subtopic_id) || 0,
      answerState,
      answerStatus,
      questionScore,
      maxQuestionScore: SBA_QUESTION_MARKS,
    };
  }
  private resolvePassingMarks(value: number | null | undefined) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return QUIZ_PASS_MARK;
    return numeric;
  }
}
