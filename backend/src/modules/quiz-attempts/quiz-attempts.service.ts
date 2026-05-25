import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { PlansService } from '../plans/plans.service';
import { SavePracticeDto } from './dto/save-practice.dto';
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
  subtopic: string | null;
  is_general: number;
  is_free: number;
  exam_mode_only: number;
  student_title?: string | null;
  display_title_mode?: string | null;
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
};

type PracticeSessionRecord = {
  id: number;
  status: string;
  last_question_index: number;
};

const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;

@Injectable()
export class QuizAttemptsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly plansService: PlansService
  ) {}

  async listQuizzes(authorization?: string) {
    const user = await this.requireStudent(authorization);
    const [canPractice, canExam] = await Promise.all([
      this.plansService.hasFeatureAccess(user.id, 'practice_mode'),
      this.plansService.hasFeatureAccess(user.id, 'exam_mode'),
    ]);
    const accessProfile = await this.getQuizAccessProfile(user.id);
    const [rows] = await this.db.execute<QuizRow[]>(
      `
        SELECT
          q.*,
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
        canAccess: canAccessQuiz,
        accessLocked: !canAccessQuiz,
        accessMessage: canAccessQuiz ? '' : 'Your subscription does not include this course question bank.',
        canPracticeMode: canAccessQuiz && (canPractice || isFree),
        canExamMode: canAccessQuiz && (canExam || isFree),
      };
    });
  }

  async listResults(authorization?: string) {
    const user = await this.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT qa.*, COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title, q.course_id, q.topic_id, q.is_general, q.subtopic, c.course_title, t.topic_name
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
    }));
  }

  async loadQuiz(authorization: string | undefined, quizId: number, mode: string, continuePractice: boolean, resetPractice: boolean) {
    if (mode !== 'practice' && mode !== 'exam') {
      throw new BadRequestException('Invalid quiz mode');
    }

    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    const questions = await this.loadQuestionsForQuiz(quizId);
    const forcedMode = Number(quiz.exam_mode_only) === 1 ? 'exam' : mode;

    const isFreeQuiz = Number(quiz.is_free) === 1;
    await this.ensureStudentCanAccessQuiz(user.id, quiz);

    if (forcedMode === 'practice' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }

    if (forcedMode === 'exam' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
      throw new BadRequestException('Exam mode is included with selected plans');
    }

    if (forcedMode === 'exam') {
      return {
        mode: 'exam',
        quiz: this.mapQuizForStudent(quiz),
        questions: questions.map((question) => ({
          ...this.mapQuestionForActiveAttempt(question),
          savedAnswer: null,
        })),
      };
    }

    const practiceState = await this.ensurePracticeSession(user.id, quizId, questions, continuePractice, resetPractice);
    const questionsWithAnswers = questions.map((question) => ({
      ...this.mapQuestion(question),
      savedAnswer: practiceState.answerMap[question.id] || null,
    }));

    return {
      mode: 'practice',
      quiz: this.mapQuizForStudent(quiz),
      practiceSession: {
        id: practiceState.sessionId,
        lastQuestionIndex: practiceState.lastQuestionIndex,
        showContinuePopup: practiceState.showContinuePopup,
      },
      questions: questionsWithAnswers,
    };
  }

  async savePractice(authorization: string | undefined, quizId: number, dto: SavePracticeDto) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
      throw new BadRequestException('Practice mode is included with selected plans');
    }
    if (Number(quiz.exam_mode_only) === 1) {
      throw new BadRequestException('This quiz is exam mode only');
    }

    const question = await this.loadQuestionForPracticeSave(quizId, dto.questionId);
    if (!question) {
      throw new NotFoundException('Question not found in this quiz');
    }

    const session = await this.getLatestPracticeSession(user.id, quizId);
    if (!session) {
      throw new NotFoundException('Practice session not found');
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

  async submitExam(authorization: string | undefined, quizId: number, dto: SubmitExamDto) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
    if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
      throw new BadRequestException('Exam mode is included with selected plans');
    }
    const questions = await this.loadQuestionsForQuiz(quizId);
    const submittedAnswers = (dto.answers || {}) as Record<string, unknown>;

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [attemptResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO quiz_attempts (
            user_id, quiz_id, attempt_mode, total_questions,
            correct_answers, wrong_answers, unanswered_questions,
            score, percentage, pass_status, started_at, submitted_at, status
          ) VALUES (?, ?, 'exam', ?, 0, 0, 0, 0, 0, 'fail', NOW(), NOW(), 'submitted')
        `,
        [user.id, quizId, questions.length]
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
        SELECT qa.*, COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title, q.passing_marks, q.is_general, c.course_title, t.topic_name
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
        SELECT qa.*, COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title, q.id AS quiz_id, q.is_general, c.course_title, t.topic_name
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

    const questions = await this.loadQuestionsForQuiz(Number(attempt.quiz_id));
    const [answerRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT question_id, option_id, is_selected FROM student_answers WHERE attempt_id = ?',
      [attemptId]
    );
    const answerMap = this.groupAnswerRows(answerRows);

    return {
      attempt: {
        attemptId,
        quizId: Number(attempt.quiz_id),
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

  async practiceReview(authorization: string | undefined, quizId: number, complete: boolean) {
    const user = await this.requireStudent(authorization);
    const quiz = await this.loadActiveQuiz(quizId);
    await this.ensureStudentCanAccessQuiz(user.id, quiz);
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

    const questions = await this.loadQuestionsForQuiz(quizId);
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
    const [rows] = await this.db.execute<QuizRow[]>(
      `
        SELECT
          q.*,
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
    return quiz;
  }

  private async loadQuestionsForQuiz(quizId: number) {
    const [questionRows] = await this.db.execute<QuestionRow[]>(
      `
        SELECT q.*
        FROM questions q
        INNER JOIN question_quizzes qq ON qq.question_id = q.id
        WHERE qq.quiz_id = ? AND q.status = 'active'
        ORDER BY qq.sort_order ASC, q.id ASC
      `,
      [quizId]
    );
    if (questionRows.length === 0) {
      throw new NotFoundException('No questions linked to this quiz');
    }

    const ids = questionRows.map((row) => row.id);
    const placeholders = sqlPlaceholders(ids);
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

    return questionRows.map((question) => ({
      ...question,
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
  }

  private async loadQuestionForPracticeSave(quizId: number, questionId: number): Promise<LoadedQuestion> {
    const [questionRows] = await this.db.execute<QuestionRow[]>(
      `
        SELECT q.*
        FROM questions q
        INNER JOIN question_quizzes qq ON qq.question_id = q.id
        WHERE qq.quiz_id = ? AND q.id = ? AND q.status = 'active'
        LIMIT 1
      `,
      [quizId, questionId]
    );
    const question = questionRows[0];
    if (!question) {
      throw new NotFoundException('Question not found in this quiz');
    }

    const [optionRows] = await this.db.execute<OptionRow[]>(
      `
        SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
        FROM question_options
        WHERE question_id = ?
        ORDER BY option_label ASC
      `,
      [questionId]
    );

    return {
      ...question,
      options: optionRows.map((option) => ({
        id: option.id,
        optionLabel: option.option_label,
        optionText: option.option_text,
        isCorrect: Number(option.is_correct) === 1 ? 1 : 0,
        whyIncorrect: option.why_incorrect || '',
      })),
      theoryRecap: null,
    };
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

  private parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private async ensurePracticeSession(
    userId: number,
    quizId: number,
    questions: LoadedQuestion[],
    continuePractice: boolean,
    resetPractice: boolean
  ) {
    let session: PracticeSessionRecord | null = await this.getLatestPracticeSession(userId, quizId);

    if (!session) {
      const [result] = await this.db.execute<ResultSetHeader>(
        "INSERT INTO practice_sessions (user_id, quiz_id, status, last_question_index) VALUES (?, ?, 'in_progress', 0)",
        [userId, quizId]
      );
      session = { id: result.insertId, status: 'in_progress', last_question_index: 0 };
    } else if (resetPractice || session.status === 'completed') {
      await this.db.execute('DELETE FROM practice_answers WHERE practice_session_id = ?', [session.id]);
      await this.db.execute(
        "UPDATE practice_sessions SET status = 'in_progress', last_question_index = 0, updated_at = NOW() WHERE id = ?",
        [session.id]
      );
      session = { ...session, status: 'in_progress', last_question_index: 0 };
    }

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
      answerMap: Object.fromEntries(
        questions.map((question) => [question.id, this.getAnswerState(question, answerMap[question.id] || [])])
      ),
    };
  }

  private async getLatestPracticeSession(userId: number, quizId: number): Promise<PracticeSessionRecord | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT id, status, last_question_index
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
      options: question.options,
      answerKey: this.buildAnswerKey(question),
      theoryRecap: question.theoryRecap || null,
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
