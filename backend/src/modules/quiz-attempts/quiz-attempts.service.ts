import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { PlansService } from '../plans/plans.service';
import { SaveExamProgressDto } from './dto/save-exam-progress.dto';
import { SavePracticeDto } from './dto/save-practice.dto';
import { SavePracticeProgressDto } from './dto/save-practice-progress.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

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
  quiz_title: string;
  quiz_description: string | null;
  blueprint_json?: string | null;
  randomization_mode?: 'static' | 'dynamic' | null;
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
  latest_attempt_id?: number | null;
  practice_completed_count?: number;
  practice_session_id?: number | null;
  last_question_index?: number | null;
  practice_answered_count?: number | null;
};

type QuestionRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number | null;
  subtopic: string | null;
  category: string | null;
  question_type: 'sba' | 'true_false';
  question_text: string;
  explanation: string | null;
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

type LatestContentVersionRow = RowDataPacket & {
  entity_id: number;
  version_number: number;
  created_at: string | Date | null;
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

type BlueprintSection = {
  id: string;
  title: string;
  targetCount: number;
  courseId: number | null;
  subjectId: number | null;
  topicId: number | null;
  lessonId: number | null;
  paperId: number | null;
  category: string;
  questionType: 'sba' | 'true_false' | '';
};

type PracticeSessionRecord = {
  id: number;
  status: string;
  last_question_index: number;
  question_ids_json?: string | null;
  revealed_question_ids_json?: string | null;
};

type ExamSessionRecord = RowDataPacket & {
  id: number;
  status: 'in_progress' | 'submitted' | 'expired';
  question_ids_json: string | null;
  started_at: string | Date | null;
  deadline_at: string | Date | null;
  last_question_index: number;
  answers_json: string | null;
  flagged_question_ids_json: string | null;
  submitted_attempt_id: number | null;
};

const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;
const QUIZ_CONTENT_CACHE_MS = 30000;
const PRACTICE_REVEAL_CACHE_MS = 120000;
const DYNAMIC_RANDOMIZATION_FEATURE = 'dynamic_quiz_randomization';

@Injectable()
export class QuizAttemptsService {
  private readonly activeQuizCache = new Map<number, { expiresAt: number; value: QuizRow }>();
  private readonly quizQuestionCache = new Map<string, { expiresAt: number; value: LoadedQuestion[] }>();
  private readonly practiceRevealCache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly plansService: PlansService
  ) {}

  async listQuizzes(authorization?: string) {
    const user = await this.requireStudent(authorization);
    const [canPractice, canExam, canDynamicRandomization] = await Promise.all([
      this.plansService.hasFeatureAccess(user.id, 'practice_mode'),
      this.plansService.hasFeatureAccess(user.id, 'exam_mode'),
      this.plansService.hasFeatureAccess(user.id, DYNAMIC_RANDOMIZATION_FEATURE),
    ]);
    const accessProfile = await this.getQuizAccessProfile(user.id);
    const [rows] = await this.db.execute<QuizRow[]>(
      `
        SELECT
          q.id,
          q.course_id,
          q.topic_id,
          q.subtopic_id,
          q.lesson_id,
          q.subtopic,
          q.is_general,
          q.is_free,
          q.exam_mode_only,
          q.student_title,
          q.display_title_mode,
          q.randomization_mode,
          q.quiz_title,
          q.quiz_description,
          q.total_questions,
          q.total_marks,
          q.time_limit,
          q.hide_time_limit,
          q.passing_marks,
          q.hide_passing_marks,
          q.status,
          q.updated_at,
          q.created_at,
          c.course_title,
          t.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          l.lesson_title,
          (
            SELECT COUNT(*)
            FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id AND qa.user_id = ?
          ) AS exam_attempt_count,
          (
            SELECT qa.id
            FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id AND qa.user_id = ?
            ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
            LIMIT 1
          ) AS latest_attempt_id,
          (
            SELECT COUNT(*)
            FROM practice_sessions cps
            WHERE cps.quiz_id = q.id
              AND cps.user_id = ?
              AND cps.status = 'completed'
          ) AS practice_completed_count,
          ps.id AS practice_session_id,
          ps.last_question_index,
          (
            SELECT COUNT(DISTINCT pa.question_id)
            FROM practice_answers pa
            WHERE pa.practice_session_id = ps.id
          ) AS practice_answered_count
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN subtopics st ON q.subtopic_id = st.id
        LEFT JOIN lessons l ON q.lesson_id = l.id
        LEFT JOIN practice_sessions ps
          ON ps.quiz_id = q.id
         AND ps.user_id = ?
         AND ps.status = 'in_progress'
        WHERE q.status = 'active'
        ORDER BY q.id DESC
      `,
      [user.id, user.id, user.id, user.id]
    );

    return rows.map((row) => {
      const canAccessQuiz = this.canAccessQuiz(row, accessProfile);
      const isFree = Number(row.is_free) === 1;
      const isDynamic = this.isDynamicQuiz(row);
      const canUseDynamic = !isDynamic || isFree || canDynamicRandomization;
      const accessMessage = !canAccessQuiz
        ? 'Your subscription does not include this course question bank.'
        : !canUseDynamic
          ? 'Dynamic randomized quizzes are included with premium plans.'
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
        quizDescription: row.quiz_description || '',
        totalQuestions: Number(row.total_questions || 0),
        totalMarks: Number(row.total_marks || 0),
        timeLimit: Number(row.time_limit || 0),
        hideTimeLimit: Number(row.hide_time_limit) === 1,
        passingMarks: this.resolvePassingMarks(Number(row.passing_marks || 0)),
        hidePassingMarks: Number(row.hide_passing_marks) === 1,
        updatedAt: row.updated_at || row.created_at || null,
        courseTitle: row.course_title || '',
        subjectName: row.subject_name || '',
        topicName: row.subject_name || '',
        subtopicName: row.topic_name || '',
        lessonTitle: row.lesson_title || '',
        examAttemptCount: Number(row.exam_attempt_count || 0),
        latestAttemptId: row.latest_attempt_id ? Number(row.latest_attempt_id) : null,
        practiceCompletedCount: Number(row.practice_completed_count || 0),
        practiceSessionId: row.practice_session_id ? Number(row.practice_session_id) : null,
        lastQuestionIndex: Number(row.last_question_index || 0),
        practiceAnsweredCount: Number(row.practice_answered_count || 0),
        isCompleted: Number(row.exam_attempt_count || 0) > 0 || Number(row.practice_completed_count || 0) > 0,
        isFree,
        randomizationMode: this.resolveRandomizationMode(row.randomization_mode),
        canAccess: canAccessQuiz && canUseDynamic,
        accessLocked: !canAccessQuiz || !canUseDynamic,
        accessMessage,
        canPracticeMode: canAccessQuiz && canUseDynamic && (canPractice || isFree),
        canExamMode: canAccessQuiz && canUseDynamic && (canExam || isFree),
      };
    });
  }

  async listResults(authorization?: string) {
    const user = await this.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT
          qa.id,
          qa.quiz_id,
          qa.score,
          qa.percentage,
          qa.correct_answers,
          qa.wrong_answers,
          qa.pass_status,
          qa.submitted_at,
          qa.reviewed_at,
          qa.created_at,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          q.course_id,
          q.topic_id,
          q.is_general,
          q.subtopic,
          c.course_title,
          t.topic_name
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON qa.quiz_id = q.id
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE qa.user_id = ?
        ORDER BY qa.id DESC
      `,
      [user.id]
    );

    return rows.map((row) => ({
      attemptId: Number(row.id),
      quizId: Number(row.quiz_id),
      quizTitle: String(row.quiz_title),
      subtopic: String(row.subtopic || ''),
      courseTitle: String(row.course_title || ''),
      topicDisplay: Number(row.is_general) === 1 ? 'General / Full Course Revision' : String(row.topic_name || 'No Topic'),
      score: Number(row.score || 0),
      percentage: Number(row.percentage || 0),
      correctAnswers: Number(row.correct_answers || 0),
      wrongAnswers: Number(row.wrong_answers || 0),
      passStatus: String(row.pass_status || 'fail'),
      submittedAt: row.submitted_at || row.created_at || null,
      reviewedAt: row.reviewed_at || null,
    }));
  }

  async loadQuiz(
    authorization: string | undefined,
    quizId: number,
    mode: string,
    continuePractice: boolean,
    resetPractice: boolean,
    questionId?: number | null
  ) {
    if (mode !== 'practice' && mode !== 'exam') {
      throw new BadRequestException('Invalid quiz mode');
    }

    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    const forcedMode = Number(quiz.exam_mode_only) === 1 ? 'exam' : mode;
    const scopedQuestionId = forcedMode === 'practice' && Number.isFinite(Number(questionId)) && Number(questionId) > 0
      ? Number(questionId)
      : null;

    const isFreeQuiz = Number(quiz.is_free) === 1;
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);

    if (forcedMode === 'practice' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }

    if (forcedMode === 'exam' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
      throw new BadRequestException('Exam mode is included with selected plans');
    }

    if (forcedMode === 'exam') {
      const examState = await this.ensureExamSession(user.id, quizId, quiz);
      return {
        mode: 'exam',
        quiz: this.mapQuizForStudent(quiz),
        examSession: examState.session,
        questions: examState.questions.map((question) => ({
          ...this.mapQuestionForActiveAttempt(question),
          savedAnswer: null,
        })),
      };
    }

    const practiceState = await this.ensurePracticeSession(user.id, quiz, continuePractice, resetPractice, scopedQuestionId);
    const questionsWithAnswers = practiceState.questions.map((question) => ({
      ...this.mapQuestionForPracticeAttempt(question),
      savedAnswer: practiceState.answerMap[question.id] || null,
    }));

    return {
      mode: 'practice',
      quiz: this.mapQuizForStudent(quiz),
      practiceSession: {
        id: practiceState.sessionId,
        lastQuestionIndex: practiceState.lastQuestionIndex,
        showContinuePopup: practiceState.showContinuePopup,
        revealedQuestionIds: practiceState.revealedQuestionIds,
      },
      questions: questionsWithAnswers,
    };
  }

  async savePractice(authorization: string | undefined, quizId: number, dto: SavePracticeDto) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }
    if (Number(quiz.exam_mode_only) === 1) {
      throw new BadRequestException('This quiz is exam mode only');
    }

    const session = await this.getLatestPracticeSession(user.id, quizId);
    if (!session) {
      throw new NotFoundException('Practice session not found');
    }
    const question = await this.loadQuestionForPracticeSave(quiz, session, dto.questionId);
    if (!question) {
      throw new NotFoundException('Question not found in this quiz');
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'DELETE FROM practice_answers WHERE practice_session_id = ? AND question_id = ?',
        [session.id, dto.questionId]
      );

      if (dto.questionType === 'sba') {
        const selected = Array.isArray(dto.selected) ? dto.selected.map((id) => Number(id)).filter((id) => id > 0) : [];
        for (const optionId of selected) {
          await connection.execute(
            'INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)',
            [session.id, dto.questionId, optionId]
          );
        }
      } else {
        const tfAnswers = dto.tfAnswers || {};
        for (const option of question.options) {
          const raw = (tfAnswers as Record<string, unknown>)[String(option.id)];
          if (raw !== 0 && raw !== 1 && raw !== '0' && raw !== '1') {
            continue;
          }
          await connection.execute(
            'INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)',
            [session.id, dto.questionId, option.id, Number(raw) === 1 ? 1 : 0]
          );
        }
      }

      await connection.execute(
        'UPDATE practice_sessions SET last_question_index = ?, updated_at = NOW() WHERE id = ?',
        [dto.questionIndex, session.id]
      );

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async savePracticeDraft(authorization: string | undefined, quizId: number, dto: SavePracticeProgressDto) {
    return this.savePracticeProgress(authorization, quizId, dto, 'in_progress');
  }

  async finishPractice(authorization: string | undefined, quizId: number, dto: SavePracticeProgressDto) {
    return this.savePracticeProgress(authorization, quizId, dto, 'completed');
  }

  async prewarmPracticeAnswer(authorization: string | undefined, quizId: number, questionId: number) {
    const user = await this.requireStudent(authorization);
    await this.loadPracticeRevealPayload(user.id, quizId, questionId);
    return { success: true };
  }

  async revealPracticeAnswer(authorization: string | undefined, quizId: number, questionId: number) {
    const user = await this.requireStudent(authorization);
    const question = await this.loadPracticeRevealPayload(user.id, quizId, questionId);
    return { question };
  }

  private async savePracticeProgress(
    authorization: string | undefined,
    quizId: number,
    dto: SavePracticeProgressDto,
    status: 'in_progress' | 'completed'
  ) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }
    if (Number(quiz.exam_mode_only) === 1) {
      throw new BadRequestException('This quiz is exam mode only');
    }

    const practiceState = await this.ensurePracticeSession(user.id, quiz, true, false);
    const questions = practiceState.questions;
    const normalizedAnswers = this.normalizeSubmittedAnswers(dto.answers || {}, questions);
    const revealedQuestionIds = this.normalizeQuestionIdList(dto.revealedQuestionIds || [], questions);
    const questionIndex = this.normalizeQuestionIndex(dto.currentQuestionIndex, questions.length);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await this.replacePracticeAnswers(connection, Number(practiceState.sessionId), questions, normalizedAnswers);
      await connection.execute(
        `
          UPDATE practice_sessions
          SET status = ?, last_question_index = ?, revealed_question_ids_json = ?, updated_at = NOW()
          WHERE id = ? AND user_id = ? AND quiz_id = ?
        `,
        [status, questionIndex, JSON.stringify(revealedQuestionIds), practiceState.sessionId, user.id, quizId]
      );
      await connection.commit();
      return {
        success: true,
        sessionId: Number(practiceState.sessionId),
        status,
        lastQuestionIndex: questionIndex,
        revealedQuestionIds,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async saveExamProgress(authorization: string | undefined, quizId: number, dto: SaveExamProgressDto) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
      throw new BadRequestException('Exam mode is included with selected plans');
    }

    const latestSession = await this.getLatestExamSession(user.id, quizId);
    if (latestSession && latestSession.status !== 'in_progress') {
      return {
        success: false,
        submitted: true,
        attemptId: latestSession.submitted_attempt_id ? Number(latestSession.submitted_attempt_id) : null,
        serverTime: this.toIsoDate(new Date()),
        deadlineAt: this.toIsoDate(latestSession.deadline_at),
        secondsRemaining: 0,
      };
    }
    const examState = await this.ensureExamSession(user.id, quizId, quiz);
    const { session, questions } = examState;
    if (session.status !== 'in_progress') {
      return {
        success: false,
        submitted: true,
        attemptId: session.submittedAttemptId,
        serverTime: this.toIsoDate(new Date()),
        deadlineAt: session.deadlineAt,
        secondsRemaining: 0,
      };
    }

    const deadline = this.parseDate(session.deadlineAt);
    const now = new Date();
    if (deadline && deadline.getTime() <= now.getTime()) {
      const attemptId = await this.finalizeExpiredExamSession(user.id, quizId, Number(session.id), questions);
      return {
        success: false,
        timeExpired: true,
        submitted: true,
        attemptId,
        serverTime: this.toIsoDate(now),
        deadlineAt: this.toIsoDate(deadline),
        secondsRemaining: 0,
      };
    }

    const normalizedAnswers = this.normalizeSubmittedAnswers(dto.answers || {}, questions);
    const flaggedIds = this.normalizeQuestionIdList(dto.flaggedQuestionIds || [], questions);
    const questionIndex = this.normalizeQuestionIndex(dto.currentQuestionIndex, questions.length);

    await this.db.execute(
      `
        UPDATE exam_sessions
        SET answers_json = ?, flagged_question_ids_json = ?, last_question_index = ?, updated_at = NOW()
        WHERE id = ? AND user_id = ? AND quiz_id = ? AND status = 'in_progress'
      `,
      [JSON.stringify(normalizedAnswers), JSON.stringify(flaggedIds), questionIndex, session.id, user.id, quizId]
    );

    const remainingSeconds = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000)) : null;
    return {
      success: true,
      serverTime: this.toIsoDate(new Date()),
      deadlineAt: this.toIsoDate(deadline),
      secondsRemaining: remainingSeconds,
    };
  }

  async submitExam(authorization: string | undefined, quizId: number, dto: SubmitExamDto) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
      throw new BadRequestException('Exam mode is included with selected plans');
    }
    await this.ensureExamSession(user.id, quizId, quiz);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const session = await this.getLatestExamSession(user.id, quizId, connection, true);
      if (session?.submitted_attempt_id && (session.status === 'submitted' || session.status === 'expired')) {
        await connection.commit();
        return { success: true, attemptId: Number(session.submitted_attempt_id) };
      }
      if (!session || session.status !== 'in_progress') {
        throw new NotFoundException('Exam session not found');
      }

      const questions = await this.loadQuestionsForExamSession(quiz, session);
      const incomingAnswers = this.normalizeSubmittedAnswers(dto.answers || {}, questions);

      const sessionAnswers = session ? this.parseAnswerJson(session.answers_json) : {};
      const deadline = session ? this.parseDate(session.deadline_at) : null;
      const canAcceptIncomingAnswers = !deadline || deadline.getTime() > Date.now();
      const submittedAnswers = canAcceptIncomingAnswers ? incomingAnswers : sessionAnswers;

      if (session && canAcceptIncomingAnswers) {
        await connection.execute(
          `
            UPDATE exam_sessions
            SET answers_json = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ? AND quiz_id = ? AND status = 'in_progress'
          `,
          [JSON.stringify(submittedAnswers), session.id, user.id, quizId]
        );
      }

      const attemptId = await this.createExamAttempt(connection, user.id, quizId, quiz, questions, submittedAnswers);

      if (session) {
        await connection.execute(
          `
            UPDATE exam_sessions
            SET status = ?, submitted_attempt_id = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ? AND quiz_id = ?
          `,
          [canAcceptIncomingAnswers ? 'submitted' : 'expired', attemptId, session.id, user.id, quizId]
        );
      }

      await connection.commit();
      return { success: true, attemptId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async result(authorization: string | undefined, attemptId: number) {
    const user = await this.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT
          qa.id,
          qa.quiz_id,
          qa.total_questions,
          qa.correct_answers,
          qa.wrong_answers,
          qa.unanswered_questions,
          qa.score,
          qa.percentage,
          qa.pass_status,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          q.passing_marks,
          q.is_general,
          c.course_title,
          t.topic_name
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON qa.quiz_id = q.id
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE qa.id = ? AND qa.user_id = ?
        LIMIT 1
      `,
      [attemptId, user.id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Result not found');
    }

    return {
      attemptId,
      quizTitle: String(row.quiz_title),
      courseTitle: String(row.course_title || ''),
      topicDisplay: Number(row.is_general) === 1 ? 'General / Full Course Revision' : String(row.topic_name || 'No Topic'),
      passStatus: String(row.pass_status || 'fail'),
      totalQuestions: Number(row.total_questions || 0),
      totalMarks: QUIZ_TOTAL_MARKS,
      correctAnswers: Number(row.correct_answers || 0),
      wrongAnswers: Number(row.wrong_answers || 0),
      unansweredQuestions: Number(row.unanswered_questions || 0),
      score: Number(row.score || 0),
      percentage: Number(row.percentage || 0),
      passingMarks: this.resolvePassingMarks(Number(row.passing_marks || 0)),
    };
  }

  async review(authorization: string | undefined, attemptId: number) {
    const user = await this.requireStudent(authorization);
    const [attemptRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT
          qa.id,
          qa.quiz_id,
          qa.score,
          qa.percentage,
          qa.correct_answers,
          qa.wrong_answers,
          qa.unanswered_questions,
          qa.question_ids_json,
          qa.pass_status,
          qa.submitted_at,
          qa.created_at,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          q.lesson_id,
          q.is_general,
          c.course_title,
          t.topic_name
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON qa.quiz_id = q.id
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE qa.id = ? AND qa.user_id = ?
        LIMIT 1
      `,
      [attemptId, user.id]
    );
    const attempt = attemptRows[0];
    if (!attempt) {
      throw new NotFoundException('Review not found');
    }

    const attemptQuestionIds = this.parseNumberJsonArray(attempt.question_ids_json ? String(attempt.question_ids_json) : null);
    const questions = await this.loadQuestionsForQuiz(
      Number(attempt.quiz_id),
      null,
      attemptQuestionIds.length ? attemptQuestionIds : undefined
    );
    const [answerRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT question_id, option_id, is_selected FROM student_answers WHERE attempt_id = ?',
      [attemptId]
    );
    const answerMap = this.groupAnswerRows(answerRows);

    return {
      attempt: {
        attemptId,
        quizId: Number(attempt.quiz_id),
        lessonId: attempt.lesson_id ? Number(attempt.lesson_id) : null,
        quizTitle: String(attempt.quiz_title),
        courseTitle: String(attempt.course_title || ''),
        topicDisplay: Number(attempt.is_general) === 1 ? 'General / Full Course Revision' : String(attempt.topic_name || 'No Topic'),
        score: Number(attempt.score || 0),
        percentage: Number(attempt.percentage || 0),
        passStatus: String(attempt.pass_status || 'fail'),
      },
      questions: questions.map((question) => this.mapReviewQuestion(question, answerMap[question.id] || [])),
    };
  }

  async completeReview(authorization: string | undefined, attemptId: number) {
    const user = await this.requireStudent(authorization);
    const [result] = await this.db.execute<ResultSetHeader>(
      `
        UPDATE quiz_attempts
        SET reviewed_at = COALESCE(reviewed_at, NOW())
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `,
      [attemptId, user.id]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException('Review not found');
    }

    return { attemptId, reviewed: true };
  }

  async practiceReview(authorization: string | undefined, quizId: number, complete: boolean, questionId?: number | null) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    await this.ensureStudentCanUseDynamicQuiz(user.id, quiz);
    const session = await this.getLatestPracticeSession(user.id, quizId);
    if (!session) {
      throw new NotFoundException('No practice session found');
    }

    if (complete && session.status !== 'completed') {
      await this.db.execute(
        'UPDATE practice_sessions SET status = ?, updated_at = NOW() WHERE id = ?',
        ['completed', session.id]
      );
    }

    const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
      ? Number(questionId)
      : null;
    const questions = await this.loadQuestionsForPracticeSession(quiz, session, scopedQuestionId);
    const [answerRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT question_id, option_id, is_selected FROM practice_answers WHERE practice_session_id = ?',
      [session.id]
    );
    const answerMap = this.groupAnswerRows(answerRows);

    const reviewed = questions.map((question) => this.mapReviewQuestion(question, answerMap[question.id] || []));
    const summary = reviewed.reduce(
      (acc, question) => {
        if (question.answerStatus === 'correct') acc.correct++;
        else if (question.answerStatus === 'wrong') acc.wrong++;
        else acc.unanswered++;
        acc.rawScore += Number(question.questionScore || 0);
        return acc;
      },
      { correct: 0, wrong: 0, unanswered: 0, rawScore: 0 }
    );
    const score = this.scaleScoreToHundred(summary.rawScore, reviewed.length);

    return {
      quiz: this.mapQuizForStudent(quiz),
      session: {
        id: session.id,
        status: session.status,
      },
      summary: {
        total: reviewed.length,
        correct: summary.correct,
        wrong: summary.wrong,
        unanswered: summary.unanswered,
        score,
        percentage: score,
        passingMarks: this.resolvePassingMarks(Number(quiz.passing_marks || 0)),
      },
      questions: reviewed,
    };
  }

  private async requireStudent(authorization?: string) {
    const token = this.extractToken(authorization);
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

  private async ensureStudentCanAccessQuiz(userId: number, quiz: Pick<QuizRow, 'id' | 'course_id' | 'is_free'>) {
    const accessProfile = await this.getQuizAccessProfile(userId);
    if (!this.canAccessQuiz(quiz, accessProfile)) {
      throw new BadRequestException('This quiz is included with selected course plans');
    }
  }

  private async ensureStudentCanUseDynamicQuiz(
    userId: number,
    quiz: Pick<QuizRow, 'randomization_mode' | 'is_free'>
  ) {
    if (!this.isDynamicQuiz(quiz) || Number(quiz.is_free) === 1) {
      return;
    }

    if (!(await this.plansService.hasFeatureAccess(userId, DYNAMIC_RANDOMIZATION_FEATURE))) {
      throw new BadRequestException('Dynamic randomized quizzes are included with premium plans');
    }
  }

  private resolveRandomizationMode(value?: string | null): 'static' | 'dynamic' {
    return value === 'dynamic' ? 'dynamic' : 'static';
  }

  private isDynamicQuiz(quiz: Pick<QuizRow, 'randomization_mode'>) {
    return this.resolveRandomizationMode(quiz.randomization_mode) === 'dynamic';
  }

  private async getQuizAccessProfile(userId: number): Promise<QuizAccessProfile> {
    const [rows] = await this.db.execute<QuizAccessScopeRow[]>(
      `
        SELECT sf.feature_key, plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND sf.feature_key IN ('question_bank_full', 'question_bank_limited', 'practice_mode', 'exam_mode')
      `,
      [userId]
    );

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
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
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

  private async loadActiveQuiz(quizId: number) {
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
          q.lesson_id,
          q.paper_id,
          q.subtopic,
          q.category,
          q.is_general,
          q.is_free,
          q.exam_mode_only,
          q.student_title,
          q.display_title_mode,
          q.blueprint_json,
          q.randomization_mode,
          q.quiz_title,
          q.quiz_description,
          q.total_questions,
          q.total_marks,
          q.time_limit,
          q.hide_time_limit,
          q.passing_marks,
          q.hide_passing_marks,
          q.status,
          q.updated_at,
          q.created_at,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          c.course_title,
          t.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          l.lesson_title
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN subtopics st ON q.subtopic_id = st.id
        LEFT JOIN lessons l ON q.lesson_id = l.id
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

    let questionRows: QuestionRow[] = [];
    if (frozenQuestionIds.length > 0) {
      const requestedIds = scopedQuestionId
        ? frozenQuestionIds.filter((id) => id === scopedQuestionId)
        : frozenQuestionIds;
      if (requestedIds.length === 0) {
        throw new NotFoundException('Question not found in this quiz');
      }

      const [rows] = await this.db.execute<QuestionRow[]>(
        `
          SELECT
            q.id,
            q.course_id,
            q.topic_id,
            q.subtopic,
            q.category,
            q.question_type,
            q.question_text,
            q.explanation,
            q.status,
            q.updated_at
          FROM questions q
          WHERE q.id IN (${sqlPlaceholders(requestedIds)})
            AND q.status = 'active'
        `,
        requestedIds
      );
      const orderById = new Map(frozenQuestionIds.map((id, index) => [id, index]));
      questionRows = rows.sort((left, right) => (
        (orderById.get(Number(left.id)) ?? 0) - (orderById.get(Number(right.id)) ?? 0)
      ));
    } else {
      const [rows] = await this.db.execute<QuestionRow[]>(
        `
          SELECT
            q.id,
            q.course_id,
            q.topic_id,
            q.subtopic,
            q.category,
            q.question_type,
            q.question_text,
            q.explanation,
            q.status,
            q.updated_at
          FROM questions q
          INNER JOIN question_quizzes qq ON qq.question_id = q.id
          WHERE qq.quiz_id = ? AND q.status = 'active'
            ${scopedQuestionId ? 'AND q.id = ?' : ''}
          ORDER BY qq.sort_order ASC, q.id ASC
        `,
        scopedQuestionId ? [quizId, scopedQuestionId] : [quizId]
      );
      questionRows = rows;
    }

    if (questionRows.length === 0) {
      throw new NotFoundException(scopedQuestionId ? 'Question not found in this quiz' : 'No questions linked to this quiz');
    }

    const ids = questionRows.map((row) => row.id);
    const placeholders = sqlPlaceholders(ids);
    const versionByQuestionId = await this.loadQuestionContentVersions(ids);
    const [optionRows] = await this.db.execute<OptionRow[]>(
      `
        SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
        FROM question_options
        WHERE question_id IN (${placeholders})
        ORDER BY question_id, option_label ASC
      `,
      ids
    );

    const [recapRows] = await this.db.execute<TheoryRecapRow[]>(
      `SELECT question_id, concept_name, hierarchy_course, hierarchy_subject, hierarchy_topic,
              hierarchy_lesson, etiology, pathophysiology, clinical_features, investigations,
              treatment, key_points, mnemonic
       FROM question_theory_recaps
       WHERE question_id IN (${placeholders})`,
      ids
    );
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

  private async loadQuestionForPracticeSave(
    quiz: QuizRow,
    session: PracticeSessionRecord,
    questionId: number
  ): Promise<LoadedQuestion> {
    const [question] = await this.loadQuestionsForPracticeSession(quiz, session, questionId);
    if (!question) {
      throw new NotFoundException('Question not found in this quiz');
    }
    return question;
  }

  private async loadQuestionsForPracticeSession(
    quiz: QuizRow,
    session: PracticeSessionRecord,
    questionId?: number | null
  ) {
    const questionIds = await this.resolvePracticeSessionQuestionIds(quiz, session);
    return this.loadQuestionsForQuiz(quiz.id, questionId, questionIds);
  }

  private async loadQuestionsForExamSession(quiz: QuizRow, session: ExamSessionRecord) {
    const questionIds = await this.resolveExamSessionQuestionIds(quiz, session);
    return this.loadQuestionsForQuiz(quiz.id, null, questionIds);
  }

  private async resolvePracticeSessionQuestionIds(quiz: QuizRow, session: PracticeSessionRecord) {
    const savedIds = this.parseNumberJsonArray(session.question_ids_json || null);
    if (!this.isDynamicQuiz(quiz)) {
      return savedIds.length ? savedIds : undefined;
    }
    if (savedIds.length) {
      return savedIds;
    }

    const questionIds = await this.generateDynamicQuestionIds(quiz);
    await this.db.execute(
      "UPDATE practice_sessions SET question_ids_json = ?, revealed_question_ids_json = '[]', updated_at = NOW() WHERE id = ?",
      [JSON.stringify(questionIds), session.id]
    );
    session.question_ids_json = JSON.stringify(questionIds);
    session.revealed_question_ids_json = '[]';
    return questionIds;
  }

  private async resolveExamSessionQuestionIds(quiz: QuizRow, session: ExamSessionRecord) {
    const savedIds = this.parseNumberJsonArray(session.question_ids_json || null);
    if (!this.isDynamicQuiz(quiz)) {
      return savedIds.length ? savedIds : undefined;
    }
    if (savedIds.length) {
      return savedIds;
    }

    const questionIds = await this.generateDynamicQuestionIds(quiz);
    await this.db.execute(
      'UPDATE exam_sessions SET question_ids_json = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(questionIds), session.id]
    );
    session.question_ids_json = JSON.stringify(questionIds);
    return questionIds;
  }

  private async generateDynamicQuestionIds(quiz: QuizRow) {
    const sections = this.parseBlueprint(quiz.blueprint_json).sections
      .filter((section) => Number(section.targetCount) > 0);
    if (!sections.length) {
      throw new BadRequestException('Dynamic randomized quizzes need at least one blueprint section with a target count');
    }

    const selectedIds: number[] = [];
    const selectedSet = new Set<number>();

    for (const section of sections) {
      const targetCount = Math.min(Math.max(Math.trunc(Number(section.targetCount) || 0), 0), 500);
      if (targetCount <= 0) continue;

      const params: Array<string | number> = [];
      let sql = `
        SELECT q.id
        FROM questions q
        WHERE q.status = 'active'
      `;

      const courseId = section.courseId || Number(quiz.course_id || 0) || null;
      const subjectId = section.subjectId || (Number(quiz.is_general) === 1 ? null : Number(quiz.topic_id || 0) || null);
      const topicId = section.topicId || (Number(quiz.is_general) === 1 ? null : Number(quiz.subtopic_id || 0) || null);
      const lessonId = section.lessonId || (Number(quiz.is_general) === 1 ? null : Number(quiz.lesson_id || 0) || null);
      const paperId = section.paperId || Number(quiz.paper_id || 0) || null;
      const category = section.category || String(quiz.category || '').trim();

      if (courseId) {
        sql += ' AND q.course_id = ?';
        params.push(courseId);
      }
      if (subjectId) {
        sql += ' AND q.topic_id = ?';
        params.push(subjectId);
      }
      if (topicId) {
        sql += ' AND q.subtopic_id = ?';
        params.push(topicId);
      }
      if (lessonId) {
        sql += ' AND q.lesson_id = ?';
        params.push(lessonId);
      }
      if (paperId) {
        sql += ' AND q.paper_id = ?';
        params.push(paperId);
      }
      if (category) {
        sql += " AND (q.question_category = ? OR (q.question_category IS NULL AND q.category = ?))";
        params.push(this.normalizeQuestionCategory(category), this.normalizeLegacyQuestionCategory(category));
      }
      if (section.questionType) {
        sql += ' AND q.question_type = ?';
        params.push(section.questionType);
      }
      if (selectedIds.length) {
        sql += ` AND q.id NOT IN (${sqlPlaceholders(selectedIds)})`;
        params.push(...selectedIds);
      }

      sql += ' ORDER BY RAND() LIMIT ?';
      params.push(targetCount);

      const [rows] = await this.db.execute<RowDataPacket[]>(sql, params);
      const drawnIds = rows
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0 && !selectedSet.has(id));

      if (drawnIds.length < targetCount) {
        throw new BadRequestException(
          `Not enough active questions for ${section.title || 'a blueprint section'}. Requested ${targetCount}, found ${drawnIds.length}.`
        );
      }

      for (const id of drawnIds) {
        selectedSet.add(id);
        selectedIds.push(id);
      }
    }

    if (!selectedIds.length) {
      throw new BadRequestException('Dynamic randomized quizzes need at least one matching active question');
    }

    return selectedIds;
  }

  private optionalPositiveId(value: unknown) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  private normalizeBlueprintPayload(blueprint: unknown): { sections: BlueprintSection[] } {
    if (!blueprint || typeof blueprint !== 'object') {
      return { sections: [] };
    }

    const rawSections = Array.isArray((blueprint as { sections?: unknown[] }).sections)
      ? (blueprint as { sections: unknown[] }).sections
      : [];

    return {
      sections: rawSections.slice(0, 30).map((rawSection, index) => {
        const section = rawSection && typeof rawSection === 'object'
          ? rawSection as Record<string, unknown>
          : {};
        const rawQuestionType = String(section.questionType || '').trim();
        const targetCount = Number(section.targetCount);

        return {
          id: String(section.id || `section-${index + 1}`).trim().slice(0, 80) || `section-${index + 1}`,
          title: String(section.title || `Section ${index + 1}`).trim().slice(0, 120),
          targetCount: Number.isFinite(targetCount) ? Math.min(Math.max(Math.trunc(targetCount), 0), 500) : 0,
          courseId: this.optionalPositiveId(section.courseId),
          subjectId: this.optionalPositiveId(section.subjectId),
          topicId: this.optionalPositiveId(section.topicId),
          lessonId: this.optionalPositiveId(section.lessonId),
          paperId: this.optionalPositiveId(section.paperId),
          category: String(section.category || '').trim().slice(0, 80),
          questionType: rawQuestionType === 'sba' || rawQuestionType === 'true_false' ? rawQuestionType : '',
        };
      }),
    };
  }

  private parseBlueprint(raw?: string | null) {
    if (!raw) {
      return { sections: [] };
    }

    try {
      return this.normalizeBlueprintPayload(JSON.parse(raw));
    } catch {
      return { sections: [] };
    }
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

  private async loadPracticeRevealPayload(userId: number, quizId: number, questionId: number) {
    const cacheKey = `${userId}:${quizId}:${questionId}`;
    const now = Date.now();
    const cached = this.practiceRevealCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(userId, quiz);
    await this.ensureStudentCanUseDynamicQuiz(userId, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(userId, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }
    if (Number(quiz.exam_mode_only) === 1) {
      throw new BadRequestException('This quiz is exam mode only');
    }

    const session = await this.getLatestPracticeSession(userId, quizId);
    if (!session) {
      throw new NotFoundException('Practice session not found');
    }

    const question = await this.loadQuestionForPracticeSave(quiz, session, questionId);
    const value = this.mapPracticeRevealQuestion(question);
    this.practiceRevealCache.set(cacheKey, { value, expiresAt: now + PRACTICE_REVEAL_CACHE_MS });
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

  private async loadQuestionContentVersions(questionIds: number[]) {
    if (!questionIds.length) return new Map<number, { versionNumber: number; createdAt: string | Date | null }>();

    const placeholders = sqlPlaceholders(questionIds);
    const [rows] = await this.db.execute<LatestContentVersionRow[]>(
      `
        SELECT entity_id, MAX(version_number) AS version_number, MAX(created_at) AS created_at
        FROM content_versions
        WHERE entity_type = 'question' AND entity_id IN (${placeholders})
        GROUP BY entity_id
      `,
      questionIds
    );

    return new Map(
      rows.map((row) => [
        Number(row.entity_id),
        {
          versionNumber: Number(row.version_number || 1),
          createdAt: row.created_at || null,
        },
      ])
    );
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

  private parseNumberJsonArray(value: string | null): number[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? Array.from(new Set(parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)))
        : [];
    } catch {
      return [];
    }
  }

  private parseAnswerJson(value: string | null | undefined): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  private parseDate(value: string | Date | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private toIsoDate(value: string | Date | null | undefined) {
    const date = this.parseDate(value);
    return date ? date.toISOString() : null;
  }

  private normalizeQuestionIndex(value: number | null | undefined, questionCount: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(Math.trunc(numeric), Math.max(questionCount - 1, 0)));
  }

  private normalizeQuestionIdList(values: number[], questions: LoadedQuestion[]) {
    const validIds = new Set(questions.map((question) => Number(question.id)));
    return Array.from(new Set(
      (values || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && validIds.has(value))
    ));
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

  private async replacePracticeAnswers(
    connection: PoolConnection,
    sessionId: number,
    questions: LoadedQuestion[],
    normalizedAnswers: Record<string, unknown>
  ) {
    await connection.execute('DELETE FROM practice_answers WHERE practice_session_id = ?', [sessionId]);

    for (const question of questions) {
      const rawAnswer = normalizedAnswers[String(question.id)];
      if (question.question_type === 'sba') {
        const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
        if (!selectedId || !question.options.some((option) => option.id === selectedId)) continue;
        await connection.execute(
          'INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)',
          [sessionId, question.id, selectedId]
        );
        continue;
      }

      const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer as Record<string, unknown> : {};
      for (const option of question.options) {
        const value = tfSubmitted[String(option.id)];
        if (value !== 0 && value !== 1 && value !== '0' && value !== '1') continue;
        await connection.execute(
          'INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)',
          [sessionId, question.id, option.id, Number(value) === 1 ? 1 : 0]
        );
      }
    }
  }

  private async ensurePracticeSession(
    userId: number,
    quiz: QuizRow,
    continuePractice: boolean,
    resetPractice: boolean,
    questionId?: number | null
  ) {
    const quizId = Number(quiz.id);
    let session: PracticeSessionRecord | null = await this.getLatestPracticeSession(userId, quizId);

    if (!session) {
      const questionIds = this.isDynamicQuiz(quiz) ? await this.generateDynamicQuestionIds(quiz) : [];
      const [result] = await this.db.execute<ResultSetHeader>(
        `
          INSERT INTO practice_sessions (
            user_id, quiz_id, status, last_question_index,
            question_ids_json, revealed_question_ids_json
          ) VALUES (?, ?, 'in_progress', 0, ?, '[]')
        `,
        [userId, quizId, questionIds.length ? JSON.stringify(questionIds) : null]
      );
      session = {
        id: result.insertId,
        status: 'in_progress',
        last_question_index: 0,
        question_ids_json: questionIds.length ? JSON.stringify(questionIds) : null,
        revealed_question_ids_json: '[]',
      };
    } else if (resetPractice || session.status === 'completed') {
      const questionIds = this.isDynamicQuiz(quiz) ? await this.generateDynamicQuestionIds(quiz) : [];
      await this.db.execute('DELETE FROM practice_answers WHERE practice_session_id = ?', [session.id]);
      await this.db.execute(
        `
          UPDATE practice_sessions
          SET status = 'in_progress',
              last_question_index = 0,
              question_ids_json = ?,
              revealed_question_ids_json = '[]',
              updated_at = NOW()
          WHERE id = ?
        `,
        [questionIds.length ? JSON.stringify(questionIds) : null, session.id]
      );
      session = {
        ...session,
        status: 'in_progress',
        last_question_index: 0,
        question_ids_json: questionIds.length ? JSON.stringify(questionIds) : null,
        revealed_question_ids_json: '[]',
      };
    }

    const questions = await this.loadQuestionsForPracticeSession(quiz, session, questionId);

    const [answerRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT question_id, option_id, is_selected FROM practice_answers WHERE practice_session_id = ?',
      [session.id]
    );
    const answerMap = this.groupAnswerRows(answerRows);

    const answeredCount = questions.reduce((count, question) => {
      const state = this.getAnswerState(question, answerMap[question.id] || []);
      return count + (this.evaluateAnswer(question, state) !== 'unanswered' ? 1 : 0);
    }, 0);

    return {
      sessionId: Number(session.id),
      lastQuestionIndex: Number(session.last_question_index || 0),
      showContinuePopup: session.status === 'in_progress' && answeredCount > 0 && !continuePractice,
      revealedQuestionIds: this.parseNumberJsonArray(session.revealed_question_ids_json || null),
      questions,
      answerMap: Object.fromEntries(
        questions.map((question) => [question.id, this.getAnswerState(question, answerMap[question.id] || [])])
      ),
    };
  }

  private async ensureExamSession(userId: number, quizId: number, quiz: QuizRow) {
    let session = await this.getLatestExamSession(userId, quizId);

    if (session?.status === 'in_progress' && this.isExamSessionExpired(session)) {
      const questions = await this.loadQuestionsForExamSession(quiz, session);
      const attemptId = await this.finalizeExpiredExamSession(userId, quizId, session.id, questions);
      session = await this.getLatestExamSession(userId, quizId);
      if (!session) {
        throw new NotFoundException('Exam session not found');
      }
      return {
        session: this.mapExamSession({
          ...(session as ExamSessionRecord),
          status: 'expired',
          submitted_attempt_id: attemptId,
        }),
        questions,
      };
    }

    if (!session || session.status !== 'in_progress') {
      const questionIds = this.isDynamicQuiz(quiz) ? await this.generateDynamicQuestionIds(quiz) : [];
      const durationSeconds = Math.max(Number(quiz.time_limit || 0) * 60, 0);
      const deadlineExpression = durationSeconds > 0
        ? 'DATE_ADD(NOW(), INTERVAL ? SECOND)'
        : 'NULL';
      const questionIdsJson = questionIds.length ? JSON.stringify(questionIds) : null;
      const values = durationSeconds > 0
        ? [userId, quizId, durationSeconds, questionIdsJson]
        : [userId, quizId, questionIdsJson];
      const [result] = await this.db.execute<ResultSetHeader>(
        `
          INSERT INTO exam_sessions (
            user_id, quiz_id, status, started_at, deadline_at,
            question_ids_json, last_question_index, answers_json, flagged_question_ids_json
          ) VALUES (?, ?, 'in_progress', NOW(), ${deadlineExpression}, ?, 0, '{}', '[]')
        `,
        values
      );
      session = await this.getExamSessionById(result.insertId);
      if (!session) {
        throw new NotFoundException('Exam session not found');
      }
    }

    const questions = await this.loadQuestionsForExamSession(quiz, session as ExamSessionRecord);
    return {
      session: this.mapExamSession(session as ExamSessionRecord),
      questions,
    };
  }

  private async getExamSessionById(sessionId: number) {
    const [rows] = await this.db.execute<ExamSessionRecord[]>(
      `
        SELECT id, status, started_at, deadline_at, last_question_index,
               question_ids_json, answers_json, flagged_question_ids_json, submitted_attempt_id
        FROM exam_sessions
        WHERE id = ?
        LIMIT 1
      `,
      [sessionId]
    );
    return rows[0] || null;
  }

  private async getLatestExamSession(
    userId: number,
    quizId: number,
    connection: PoolConnection | Pool = this.db,
    lock = false
  ): Promise<ExamSessionRecord | null> {
    const [rows] = await connection.execute<ExamSessionRecord[]>(
      `
        SELECT id, status, started_at, deadline_at, last_question_index,
               question_ids_json, answers_json, flagged_question_ids_json, submitted_attempt_id
        FROM exam_sessions
        WHERE user_id = ? AND quiz_id = ?
        ORDER BY id DESC
        LIMIT 1
        ${lock ? 'FOR UPDATE' : ''}
      `,
      [userId, quizId]
    );
    return rows[0] || null;
  }

  private mapExamSession(session: ExamSessionRecord) {
    const serverTime = new Date();
    const deadline = this.parseDate(session.deadline_at);
    return {
      id: Number(session.id),
      status: session.status,
      startedAt: this.toIsoDate(session.started_at),
      deadlineAt: this.toIsoDate(session.deadline_at),
      serverTime: this.toIsoDate(serverTime),
      secondsRemaining: deadline ? Math.max(0, Math.ceil((deadline.getTime() - serverTime.getTime()) / 1000)) : null,
      lastQuestionIndex: Number(session.last_question_index || 0),
      answers: this.parseAnswerJson(session.answers_json),
      flaggedQuestionIds: this.parseIdList(session.flagged_question_ids_json),
      submittedAttemptId: session.submitted_attempt_id ? Number(session.submitted_attempt_id) : null,
    };
  }

  private isExamSessionExpired(session: ExamSessionRecord) {
    const deadline = this.parseDate(session.deadline_at);
    return Boolean(deadline && deadline.getTime() <= Date.now());
  }

  private async finalizeExpiredExamSession(userId: number, quizId: number, sessionId: number, questions: LoadedQuestion[]) {
    const quiz = await this.loadActiveQuiz(quizId);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<ExamSessionRecord[]>(
        `
          SELECT id, status, answers_json, submitted_attempt_id
          FROM exam_sessions
          WHERE id = ? AND user_id = ? AND quiz_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [sessionId, userId, quizId]
      );
      const session = rows[0];
      if (!session) {
        throw new NotFoundException('Exam session not found');
      }
      if (session.submitted_attempt_id) {
        await connection.commit();
        return Number(session.submitted_attempt_id);
      }

      const attemptId = await this.createExamAttempt(
        connection,
        userId,
        quizId,
        quiz,
        questions,
        this.parseAnswerJson(session.answers_json)
      );
      await connection.execute(
        `
          UPDATE exam_sessions
          SET status = 'expired', submitted_attempt_id = ?, updated_at = NOW()
          WHERE id = ? AND user_id = ? AND quiz_id = ?
        `,
        [attemptId, sessionId, userId, quizId]
      );
      await connection.commit();
      return attemptId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async getLatestPracticeSession(userId: number, quizId: number): Promise<PracticeSessionRecord | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT id, status, last_question_index, question_ids_json, revealed_question_ids_json
        FROM practice_sessions
        WHERE user_id = ? AND quiz_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [userId, quizId]
    );
    const row = rows[0];
    return row
      ? {
          id: Number(row.id),
          status: String(row.status),
          last_question_index: Number(row.last_question_index || 0),
          question_ids_json: row.question_ids_json ? String(row.question_ids_json) : null,
          revealed_question_ids_json: row.revealed_question_ids_json ? String(row.revealed_question_ids_json) : null,
        }
      : null;
  }

  private groupAnswerRows(rows: RowDataPacket[]) {
    const grouped: Record<number, Array<{ optionId: number; isSelected: number }>> = {};
    for (const row of rows) {
      const questionId = Number(row.question_id);
      if (!grouped[questionId]) grouped[questionId] = [];
      grouped[questionId].push({
        optionId: Number(row.option_id),
        isSelected: Number(row.is_selected),
      });
    }
    return grouped;
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

  private async createExamAttempt(
    connection: PoolConnection,
    userId: number,
    quizId: number,
    quiz: QuizRow,
    questions: LoadedQuestion[],
    submittedAnswers: Record<string, unknown>
  ) {
    const [attemptResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO quiz_attempts (
          user_id, quiz_id, question_ids_json, attempt_mode, total_questions,
          correct_answers, wrong_answers, unanswered_questions,
          score, percentage, pass_status, started_at, submitted_at, status
        ) VALUES (?, ?, ?, 'exam', ?, 0, 0, 0, 0, 0, 'fail', NOW(), NOW(), 'submitted')
      `,
      [userId, quizId, JSON.stringify(questions.map((question) => Number(question.id))), questions.length]
    );

    const attemptId = attemptResult.insertId;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unansweredQuestions = 0;

    for (const question of questions) {
      const rawAnswer = submittedAnswers[String(question.id)];
      const status = await this.saveExamQuestionAnswers(connection, attemptId, question, rawAnswer);

      if (status === 'correct') {
        correctAnswers++;
      } else if (status === 'wrong') {
        wrongAnswers++;
      } else {
        unansweredQuestions++;
      }
    }

    const rawScore = questions.reduce((sum, question) => {
      const rawAnswer = submittedAnswers[String(question.id)];
      return sum + this.calculateSubmissionQuestionScore(question, rawAnswer);
    }, 0);
    const score = this.scaleScoreToHundred(rawScore, questions.length);
    const percentage = score;
    const effectivePassingMarks = this.resolvePassingMarks(Number(quiz.passing_marks || 0));
    const passStatus = score >= effectivePassingMarks ? 'pass' : 'fail';

    await connection.execute(
      `
        UPDATE quiz_attempts
        SET correct_answers = ?, wrong_answers = ?, unanswered_questions = ?,
            score = ?, percentage = ?, pass_status = ?
        WHERE id = ?
      `,
      [correctAnswers, wrongAnswers, unansweredQuestions, score, percentage, passStatus, attemptId]
    );

    return attemptId;
  }

  private async saveExamQuestionAnswers(
    connection: PoolConnection,
    attemptId: number,
    question: LoadedQuestion,
    rawAnswer: unknown
  ) {
    if (question.question_type === 'sba') {
      const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
      const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id);
      if (!selectedId) return 'unanswered';

      await connection.execute(
        'INSERT INTO student_answers (attempt_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)',
        [attemptId, question.id, selectedId]
      );

      return correctIds.length === 1 && correctIds[0] === selectedId ? 'correct' : 'wrong';
    }

    const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? (rawAnswer as Record<string, unknown>) : {};
    let answeredStatements = 0;
    let allCorrect = true;

    for (const option of question.options) {
      const value = tfSubmitted[String(option.id)];
      if (value !== 0 && value !== 1 && value !== '0' && value !== '1') {
        allCorrect = false;
        continue;
      }
      const numeric = Number(value) === 1 ? 1 : 0;
      answeredStatements++;
      await connection.execute(
        'INSERT INTO student_answers (attempt_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)',
        [attemptId, question.id, option.id, numeric]
      );
      if (numeric !== option.isCorrect) {
        allCorrect = false;
      }
    }

    if (answeredStatements === 0) return 'unanswered';
    return answeredStatements === question.options.length && allCorrect ? 'correct' : 'wrong';
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
      randomizationMode: this.resolveRandomizationMode(quiz.randomization_mode),
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

  private mapQuestionForPracticeAttempt(question: LoadedQuestion) {
    return {
      id: question.id,
      questionType: question.question_type,
      questionText: question.question_text,
      contentTrace: {
        source: question.contentSourceLabel,
        sourceId: question.id,
        version: question.contentVersion,
        versionLabel: `v${question.contentVersion}`,
        versionedAt: question.contentVersionedAt,
      },
      options: question.options.map((option) => ({
        id: option.id,
        optionLabel: option.optionLabel,
        optionText: option.optionText,
      })),
      canRevealAnswer: Boolean(
        question.options.length ||
        String(question.explanation || '').trim() ||
        question.theoryRecap
      ),
    };
  }

  private mapPracticeRevealQuestion(question: LoadedQuestion) {
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
