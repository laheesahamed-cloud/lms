"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizAttemptsService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_token_util_1 = require("../auth/auth-token.util");
const plans_service_1 = require("../plans/plans.service");
const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;
const QUIZ_CONTENT_CACHE_MS = 30000;
const PRACTICE_REVEAL_CACHE_MS = 120000;
let QuizAttemptsService = class QuizAttemptsService {
    constructor(db, plansService) {
        this.db = db;
        this.plansService = plansService;
        this.activeQuizCache = new Map();
        this.quizQuestionCache = new Map();
        this.practiceRevealCache = new Map();
    }
    async listQuizzes(authorization) {
        const user = await this.requireStudent(authorization);
        const [canPractice, canExam] = await Promise.all([
            this.plansService.hasFeatureAccess(user.id, 'practice_mode'),
            this.plansService.hasFeatureAccess(user.id, 'exam_mode'),
        ]);
        const accessProfile = await this.getQuizAccessProfile(user.id);
        const [rows] = await this.db.execute(`
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
      `, [user.id, user.id, user.id, user.id]);
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
    async listResults(authorization) {
        const user = await this.requireStudent(authorization);
        const [rows] = await this.db.execute(`
        SELECT
          qa.id,
          qa.quiz_id,
          qa.score,
          qa.percentage,
          qa.correct_answers,
          qa.wrong_answers,
          qa.pass_status,
          qa.submitted_at,
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
      `, [user.id]);
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
    async loadQuiz(authorization, quizId, mode, continuePractice, resetPractice, questionId) {
        if (mode !== 'practice' && mode !== 'exam') {
            throw new common_1.BadRequestException('Invalid quiz mode');
        }
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        const forcedMode = Number(quiz.exam_mode_only) === 1 ? 'exam' : mode;
        const scopedQuestionId = forcedMode === 'practice' && Number.isFinite(Number(questionId)) && Number(questionId) > 0
            ? Number(questionId)
            : null;
        const questions = await this.loadQuestionsForQuiz(quizId, scopedQuestionId);
        const isFreeQuiz = Number(quiz.is_free) === 1;
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        if (forcedMode === 'practice' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
            throw new common_1.BadRequestException('Practice mode is included with selected plans');
        }
        if (forcedMode === 'exam' && !isFreeQuiz && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
            throw new common_1.BadRequestException('Exam mode is included with selected plans');
        }
        if (forcedMode === 'exam') {
            const examSession = await this.ensureExamSession(user.id, quizId, quiz, questions);
            return {
                mode: 'exam',
                quiz: this.mapQuizForStudent(quiz),
                examSession,
                questions: questions.map((question) => ({
                    ...this.mapQuestionForActiveAttempt(question),
                    savedAnswer: null,
                })),
            };
        }
        const practiceState = await this.ensurePracticeSession(user.id, quizId, questions, continuePractice, resetPractice);
        const questionsWithAnswers = questions.map((question) => ({
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
    async savePractice(authorization, quizId, dto) {
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
            throw new common_1.BadRequestException('Practice mode is included with selected plans');
        }
        if (Number(quiz.exam_mode_only) === 1) {
            throw new common_1.BadRequestException('This quiz is exam mode only');
        }
        const question = await this.loadQuestionForPracticeSave(quizId, dto.questionId);
        if (!question) {
            throw new common_1.NotFoundException('Question not found in this quiz');
        }
        const session = await this.getLatestPracticeSession(user.id, quizId);
        if (!session) {
            throw new common_1.NotFoundException('Practice session not found');
        }
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM practice_answers WHERE practice_session_id = ? AND question_id = ?', [session.id, dto.questionId]);
            if (dto.questionType === 'sba') {
                const selected = Array.isArray(dto.selected) ? dto.selected.map((id) => Number(id)).filter((id) => id > 0) : [];
                for (const optionId of selected) {
                    await connection.execute('INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)', [session.id, dto.questionId, optionId]);
                }
            }
            else {
                const tfAnswers = dto.tfAnswers || {};
                for (const option of question.options) {
                    const raw = tfAnswers[String(option.id)];
                    if (raw !== 0 && raw !== 1 && raw !== '0' && raw !== '1') {
                        continue;
                    }
                    await connection.execute('INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)', [session.id, dto.questionId, option.id, Number(raw) === 1 ? 1 : 0]);
                }
            }
            await connection.execute('UPDATE practice_sessions SET last_question_index = ?, updated_at = NOW() WHERE id = ?', [dto.questionIndex, session.id]);
            await connection.commit();
            return { success: true };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async savePracticeDraft(authorization, quizId, dto) {
        return this.savePracticeProgress(authorization, quizId, dto, 'in_progress');
    }
    async finishPractice(authorization, quizId, dto) {
        return this.savePracticeProgress(authorization, quizId, dto, 'completed');
    }
    async prewarmPracticeAnswer(authorization, quizId, questionId) {
        const user = await this.requireStudent(authorization);
        await this.loadPracticeRevealPayload(user.id, quizId, questionId);
        return { success: true };
    }
    async revealPracticeAnswer(authorization, quizId, questionId) {
        const user = await this.requireStudent(authorization);
        const question = await this.loadPracticeRevealPayload(user.id, quizId, questionId);
        return { question };
    }
    async savePracticeProgress(authorization, quizId, dto, status) {
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'practice_mode'))) {
            throw new common_1.BadRequestException('Practice mode is included with selected plans');
        }
        if (Number(quiz.exam_mode_only) === 1) {
            throw new common_1.BadRequestException('This quiz is exam mode only');
        }
        const questions = await this.loadQuestionsForQuiz(quizId);
        const normalizedAnswers = this.normalizeSubmittedAnswers(dto.answers || {}, questions);
        const revealedQuestionIds = this.normalizeQuestionIdList(dto.revealedQuestionIds || [], questions);
        const questionIndex = this.normalizeQuestionIndex(dto.currentQuestionIndex, questions.length);
        const session = await this.getOrCreatePracticeSessionForWrite(user.id, quizId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.replacePracticeAnswers(connection, Number(session.id), questions, normalizedAnswers);
            await connection.execute(`
          UPDATE practice_sessions
          SET status = ?, last_question_index = ?, revealed_question_ids_json = ?, updated_at = NOW()
          WHERE id = ? AND user_id = ? AND quiz_id = ?
        `, [status, questionIndex, JSON.stringify(revealedQuestionIds), session.id, user.id, quizId]);
            await connection.commit();
            return {
                success: true,
                sessionId: Number(session.id),
                status,
                lastQuestionIndex: questionIndex,
                revealedQuestionIds,
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async saveExamProgress(authorization, quizId, dto) {
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
            throw new common_1.BadRequestException('Exam mode is included with selected plans');
        }
        const questions = await this.loadQuestionsForQuiz(quizId);
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
        const session = await this.ensureExamSession(user.id, quizId, quiz, questions);
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
        await this.db.execute(`
        UPDATE exam_sessions
        SET answers_json = ?, flagged_question_ids_json = ?, last_question_index = ?, updated_at = NOW()
        WHERE id = ? AND user_id = ? AND quiz_id = ? AND status = 'in_progress'
      `, [JSON.stringify(normalizedAnswers), JSON.stringify(flaggedIds), questionIndex, session.id, user.id, quizId]);
        const remainingSeconds = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000)) : null;
        return {
            success: true,
            serverTime: this.toIsoDate(new Date()),
            deadlineAt: this.toIsoDate(deadline),
            secondsRemaining: remainingSeconds,
        };
    }
    async submitExam(authorization, quizId, dto) {
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(user.id, 'exam_mode'))) {
            throw new common_1.BadRequestException('Exam mode is included with selected plans');
        }
        const questions = await this.loadQuestionsForQuiz(quizId);
        const incomingAnswers = this.normalizeSubmittedAnswers(dto.answers || {}, questions);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const session = await this.getLatestExamSession(user.id, quizId, connection, true);
            if (session?.status === 'submitted' && session.submitted_attempt_id) {
                await connection.commit();
                return { success: true, attemptId: Number(session.submitted_attempt_id) };
            }
            const sessionAnswers = session ? this.parseAnswerJson(session.answers_json) : {};
            const deadline = session ? this.parseDate(session.deadline_at) : null;
            const canAcceptIncomingAnswers = !deadline || deadline.getTime() > Date.now();
            const submittedAnswers = canAcceptIncomingAnswers ? incomingAnswers : sessionAnswers;
            if (session && canAcceptIncomingAnswers) {
                await connection.execute(`
            UPDATE exam_sessions
            SET answers_json = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ? AND quiz_id = ? AND status = 'in_progress'
          `, [JSON.stringify(submittedAnswers), session.id, user.id, quizId]);
            }
            const attemptId = await this.createExamAttempt(connection, user.id, quizId, quiz, questions, submittedAnswers);
            if (session) {
                await connection.execute(`
            UPDATE exam_sessions
            SET status = ?, submitted_attempt_id = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ? AND quiz_id = ?
          `, [canAcceptIncomingAnswers ? 'submitted' : 'expired', attemptId, session.id, user.id, quizId]);
            }
            await connection.commit();
            return { success: true, attemptId };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async result(authorization, attemptId) {
        const user = await this.requireStudent(authorization);
        const [rows] = await this.db.execute(`
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
      `, [attemptId, user.id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Result not found');
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
    async review(authorization, attemptId) {
        const user = await this.requireStudent(authorization);
        const [attemptRows] = await this.db.execute(`
        SELECT
          qa.id,
          qa.quiz_id,
          qa.score,
          qa.percentage,
          qa.correct_answers,
          qa.wrong_answers,
          qa.unanswered_questions,
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
      `, [attemptId, user.id]);
        const attempt = attemptRows[0];
        if (!attempt) {
            throw new common_1.NotFoundException('Review not found');
        }
        const questions = await this.loadQuestionsForQuiz(Number(attempt.quiz_id));
        const [answerRows] = await this.db.execute('SELECT question_id, option_id, is_selected FROM student_answers WHERE attempt_id = ?', [attemptId]);
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
    async practiceReview(authorization, quizId, complete, questionId) {
        const user = await this.requireStudent(authorization);
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(user.id, quiz);
        const session = await this.getLatestPracticeSession(user.id, quizId);
        if (!session) {
            throw new common_1.NotFoundException('No practice session found');
        }
        if (complete && session.status !== 'completed') {
            await this.db.execute('UPDATE practice_sessions SET status = ?, updated_at = NOW() WHERE id = ?', ['completed', session.id]);
        }
        const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
            ? Number(questionId)
            : null;
        const questions = await this.loadQuestionsForQuiz(quizId, scopedQuestionId);
        const [answerRows] = await this.db.execute('SELECT question_id, option_id, is_selected FROM practice_answers WHERE practice_session_id = ?', [session.id]);
        const answerMap = this.groupAnswerRows(answerRows);
        const reviewed = questions.map((question) => this.mapReviewQuestion(question, answerMap[question.id] || []));
        const summary = reviewed.reduce((acc, question) => {
            if (question.answerStatus === 'correct')
                acc.correct++;
            else if (question.answerStatus === 'wrong')
                acc.wrong++;
            else
                acc.unanswered++;
            acc.rawScore += Number(question.questionScore || 0);
            return acc;
        }, { correct: 0, wrong: 0, unanswered: 0, rawScore: 0 });
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
    async requireStudent(authorization) {
        const token = this.extractToken(authorization);
        const [rows] = await this.db.execute(`SELECT id, full_name, email, role, status, session_token
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(token)]);
        const user = rows[0];
        if (!user) {
            throw new common_1.UnauthorizedException('Session is invalid or has expired');
        }
        if (user.role !== 'student') {
            throw new common_1.UnauthorizedException('Student access required');
        }
        if (user.status !== 'active') {
            throw new common_1.UnauthorizedException('Account inactive');
        }
        return user;
    }
    extractToken(authorization) {
        const token = (0, auth_token_util_1.extractBearerToken)(authorization);
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing');
        }
        return token;
    }
    async ensureStudentCanAccessQuiz(userId, quiz) {
        const accessProfile = await this.getQuizAccessProfile(userId);
        if (!this.canAccessQuiz(quiz, accessProfile)) {
            throw new common_1.BadRequestException('This quiz is included with selected course plans');
        }
    }
    async getQuizAccessProfile(userId) {
        const [rows] = await this.db.execute(`
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
      `, [userId]);
        const profile = {
            hasAnyPaidQuizAccess: rows.length > 0,
            hasFullAccess: false,
            courseIds: new Set(),
        };
        for (const row of rows) {
            const courseIds = this.parseIdList(row.course_ids_json);
            const scope = this.resolveEffectiveAccessScope(row, courseIds);
            if (scope === 'all' && courseIds.length === 0) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach((id) => profile.courseIds.add(id));
            }
        }
        return profile;
    }
    parseIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed))
                return [];
            return parsed
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0);
        }
        catch {
            return [];
        }
    }
    resolveEffectiveAccessScope(row, courseIds) {
        const planSlug = String(row.plan_slug || '').trim();
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
            return 'courses';
        }
        return row.access_scope || (courseIds.length ? 'courses' : 'all');
    }
    canAccessQuiz(quiz, profile) {
        if (Number(quiz.is_free) === 1)
            return true;
        if (!profile.hasAnyPaidQuizAccess)
            return false;
        if (profile.hasFullAccess)
            return true;
        return profile.courseIds.has(Number(quiz.course_id));
    }
    async loadActiveQuiz(quizId) {
        const now = Date.now();
        const cached = this.activeQuizCache.get(quizId);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        const [rows] = await this.db.execute(`
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
      `, [quizId]);
        const quiz = rows[0];
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found or inactive');
        }
        this.activeQuizCache.set(quizId, { value: quiz, expiresAt: now + QUIZ_CONTENT_CACHE_MS });
        return quiz;
    }
    async loadQuestionsForQuiz(quizId, questionId) {
        const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
            ? Number(questionId)
            : null;
        const cacheKey = `${quizId}:${scopedQuestionId || 'all'}`;
        const now = Date.now();
        const cached = this.quizQuestionCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        const [questionRows] = await this.db.execute(`
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
      `, scopedQuestionId ? [quizId, scopedQuestionId] : [quizId]);
        if (questionRows.length === 0) {
            throw new common_1.NotFoundException(scopedQuestionId ? 'Question not found in this quiz' : 'No questions linked to this quiz');
        }
        const ids = questionRows.map((row) => row.id);
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(ids);
        const versionByQuestionId = await this.loadQuestionContentVersions(ids);
        const [optionRows] = await this.db.execute(`
        SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
        FROM question_options
        WHERE question_id IN (${placeholders})
        ORDER BY question_id, option_label ASC
      `, ids);
        const [recapRows] = await this.db.execute(`SELECT question_id, concept_name, hierarchy_course, hierarchy_subject, hierarchy_topic,
              hierarchy_lesson, etiology, pathophysiology, clinical_features, investigations,
              treatment, key_points, mnemonic
       FROM question_theory_recaps
       WHERE question_id IN (${placeholders})`, ids);
        const recapMap = new Map();
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
    async loadQuestionForPracticeSave(quizId, questionId) {
        const [question] = await this.loadQuestionsForQuiz(quizId, questionId);
        if (!question) {
            throw new common_1.NotFoundException('Question not found in this quiz');
        }
        return question;
    }
    async loadPracticeRevealPayload(userId, quizId, questionId) {
        const cacheKey = `${userId}:${quizId}:${questionId}`;
        const now = Date.now();
        const cached = this.practiceRevealCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        const quiz = await this.loadActiveQuiz(quizId);
        await this.ensureStudentCanAccessQuiz(userId, quiz);
        if (Number(quiz.is_free) !== 1 && !(await this.plansService.hasFeatureAccess(userId, 'practice_mode'))) {
            throw new common_1.BadRequestException('Practice mode is included with selected plans');
        }
        if (Number(quiz.exam_mode_only) === 1) {
            throw new common_1.BadRequestException('This quiz is exam mode only');
        }
        const question = await this.loadQuestionForPracticeSave(quizId, questionId);
        const value = this.mapPracticeRevealQuestion(question);
        this.practiceRevealCache.set(cacheKey, { value, expiresAt: now + PRACTICE_REVEAL_CACHE_MS });
        return value;
    }
    mapOptionsByQuestionId(optionRows) {
        const map = new Map();
        for (const option of optionRows) {
            const questionId = Number(option.question_id);
            if (!map.has(questionId)) {
                map.set(questionId, []);
            }
            map.get(questionId)?.push(option);
        }
        return map;
    }
    async loadQuestionContentVersions(questionIds) {
        if (!questionIds.length)
            return new Map();
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(questionIds);
        const [rows] = await this.db.execute(`
        SELECT entity_id, MAX(version_number) AS version_number, MAX(created_at) AS created_at
        FROM content_versions
        WHERE entity_type = 'question' AND entity_id IN (${placeholders})
        GROUP BY entity_id
      `, questionIds);
        return new Map(rows.map((row) => [
            Number(row.entity_id),
            {
                versionNumber: Number(row.version_number || 1),
                createdAt: row.created_at || null,
            },
        ]));
    }
    withQuestionTrace(question, versionByQuestionId) {
        const version = versionByQuestionId.get(Number(question.id));
        return {
            ...question,
            contentVersion: version?.versionNumber || 1,
            contentVersionedAt: version?.createdAt || question.updated_at || null,
            contentSourceLabel: `Question bank #${question.id}`,
        };
    }
    parseJsonArray(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        }
        catch {
            return [];
        }
    }
    parseNumberJsonArray(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? Array.from(new Set(parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)))
                : [];
        }
        catch {
            return [];
        }
    }
    parseAnswerJson(value) {
        if (!value)
            return {};
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed
                : {};
        }
        catch {
            return {};
        }
    }
    parseDate(value) {
        if (!value)
            return null;
        const date = value instanceof Date ? value : new Date(value);
        return Number.isFinite(date.getTime()) ? date : null;
    }
    toIsoDate(value) {
        const date = this.parseDate(value);
        return date ? date.toISOString() : null;
    }
    normalizeQuestionIndex(value, questionCount) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric))
            return 0;
        return Math.max(0, Math.min(Math.trunc(numeric), Math.max(questionCount - 1, 0)));
    }
    normalizeQuestionIdList(values, questions) {
        const validIds = new Set(questions.map((question) => Number(question.id)));
        return Array.from(new Set((values || [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && validIds.has(value))));
    }
    normalizeSubmittedAnswers(rawAnswers, questions) {
        const normalized = {};
        const questionById = new Map(questions.map((question) => [String(question.id), question]));
        for (const [rawQuestionId, rawValue] of Object.entries(rawAnswers || {})) {
            const questionId = String(Number(rawQuestionId));
            const question = questionById.get(questionId);
            if (!question)
                continue;
            if (question.question_type === 'sba') {
                const selectedId = Number(rawValue);
                if (question.options.some((option) => option.id === selectedId)) {
                    normalized[questionId] = selectedId;
                }
                continue;
            }
            const submitted = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
                ? rawValue
                : {};
            const tfMap = {};
            for (const option of question.options) {
                const value = submitted[String(option.id)];
                if (value !== 0 && value !== 1 && value !== '0' && value !== '1')
                    continue;
                tfMap[String(option.id)] = Number(value) === 1 ? 1 : 0;
            }
            if (Object.keys(tfMap).length) {
                normalized[questionId] = tfMap;
            }
        }
        return normalized;
    }
    async replacePracticeAnswers(connection, sessionId, questions, normalizedAnswers) {
        await connection.execute('DELETE FROM practice_answers WHERE practice_session_id = ?', [sessionId]);
        for (const question of questions) {
            const rawAnswer = normalizedAnswers[String(question.id)];
            if (question.question_type === 'sba') {
                const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
                if (!selectedId || !question.options.some((option) => option.id === selectedId))
                    continue;
                await connection.execute('INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)', [sessionId, question.id, selectedId]);
                continue;
            }
            const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer : {};
            for (const option of question.options) {
                const value = tfSubmitted[String(option.id)];
                if (value !== 0 && value !== 1 && value !== '0' && value !== '1')
                    continue;
                await connection.execute('INSERT INTO practice_answers (practice_session_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)', [sessionId, question.id, option.id, Number(value) === 1 ? 1 : 0]);
            }
        }
    }
    async ensurePracticeSession(userId, quizId, questions, continuePractice, resetPractice) {
        let session = await this.getLatestPracticeSession(userId, quizId);
        if (!session) {
            const [result] = await this.db.execute("INSERT INTO practice_sessions (user_id, quiz_id, status, last_question_index) VALUES (?, ?, 'in_progress', 0)", [userId, quizId]);
            session = { id: result.insertId, status: 'in_progress', last_question_index: 0 };
        }
        else if (resetPractice || session.status === 'completed') {
            await this.db.execute('DELETE FROM practice_answers WHERE practice_session_id = ?', [session.id]);
            await this.db.execute("UPDATE practice_sessions SET status = 'in_progress', last_question_index = 0, updated_at = NOW() WHERE id = ?", [session.id]);
            session = { ...session, status: 'in_progress', last_question_index: 0 };
        }
        const [answerRows] = await this.db.execute('SELECT question_id, option_id, is_selected FROM practice_answers WHERE practice_session_id = ?', [session.id]);
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
            answerMap: Object.fromEntries(questions.map((question) => [question.id, this.getAnswerState(question, answerMap[question.id] || [])])),
        };
    }
    async getOrCreatePracticeSessionForWrite(userId, quizId) {
        const session = await this.getLatestPracticeSession(userId, quizId);
        if (session)
            return session;
        const [result] = await this.db.execute("INSERT INTO practice_sessions (user_id, quiz_id, status, last_question_index) VALUES (?, ?, 'in_progress', 0)", [userId, quizId]);
        return {
            id: result.insertId,
            status: 'in_progress',
            last_question_index: 0,
            revealed_question_ids_json: null,
        };
    }
    async ensureExamSession(userId, quizId, quiz, questions) {
        let session = await this.getLatestExamSession(userId, quizId);
        if (session?.status === 'in_progress' && this.isExamSessionExpired(session)) {
            const attemptId = await this.finalizeExpiredExamSession(userId, quizId, session.id, questions);
            session = await this.getLatestExamSession(userId, quizId);
            return this.mapExamSession({
                ...session,
                status: 'expired',
                submitted_attempt_id: attemptId,
            });
        }
        if (!session || session.status !== 'in_progress') {
            const durationSeconds = Math.max(Number(quiz.time_limit || 0) * 60, 0);
            const deadlineExpression = durationSeconds > 0
                ? 'DATE_ADD(NOW(), INTERVAL ? SECOND)'
                : 'NULL';
            const values = durationSeconds > 0
                ? [userId, quizId, durationSeconds]
                : [userId, quizId];
            const [result] = await this.db.execute(`
          INSERT INTO exam_sessions (
            user_id, quiz_id, status, started_at, deadline_at,
            last_question_index, answers_json, flagged_question_ids_json
          ) VALUES (?, ?, 'in_progress', NOW(), ${deadlineExpression}, 0, '{}', '[]')
        `, values);
            session = await this.getExamSessionById(result.insertId);
        }
        return this.mapExamSession(session);
    }
    async getExamSessionById(sessionId) {
        const [rows] = await this.db.execute(`
        SELECT id, status, started_at, deadline_at, last_question_index,
               answers_json, flagged_question_ids_json, submitted_attempt_id
        FROM exam_sessions
        WHERE id = ?
        LIMIT 1
      `, [sessionId]);
        return rows[0] || null;
    }
    async getLatestExamSession(userId, quizId, connection = this.db, lock = false) {
        const [rows] = await connection.execute(`
        SELECT id, status, started_at, deadline_at, last_question_index,
               answers_json, flagged_question_ids_json, submitted_attempt_id
        FROM exam_sessions
        WHERE user_id = ? AND quiz_id = ?
        ORDER BY id DESC
        LIMIT 1
        ${lock ? 'FOR UPDATE' : ''}
      `, [userId, quizId]);
        return rows[0] || null;
    }
    mapExamSession(session) {
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
    isExamSessionExpired(session) {
        const deadline = this.parseDate(session.deadline_at);
        return Boolean(deadline && deadline.getTime() <= Date.now());
    }
    async finalizeExpiredExamSession(userId, quizId, sessionId, questions) {
        const quiz = await this.loadActiveQuiz(quizId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(`
          SELECT id, status, answers_json, submitted_attempt_id
          FROM exam_sessions
          WHERE id = ? AND user_id = ? AND quiz_id = ?
          LIMIT 1
          FOR UPDATE
        `, [sessionId, userId, quizId]);
            const session = rows[0];
            if (!session) {
                throw new common_1.NotFoundException('Exam session not found');
            }
            if (session.submitted_attempt_id) {
                await connection.commit();
                return Number(session.submitted_attempt_id);
            }
            const attemptId = await this.createExamAttempt(connection, userId, quizId, quiz, questions, this.parseAnswerJson(session.answers_json));
            await connection.execute(`
          UPDATE exam_sessions
          SET status = 'expired', submitted_attempt_id = ?, updated_at = NOW()
          WHERE id = ? AND user_id = ? AND quiz_id = ?
        `, [attemptId, sessionId, userId, quizId]);
            await connection.commit();
            return attemptId;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async getLatestPracticeSession(userId, quizId) {
        const [rows] = await this.db.execute(`
        SELECT id, status, last_question_index, revealed_question_ids_json
        FROM practice_sessions
        WHERE user_id = ? AND quiz_id = ?
        ORDER BY id DESC
        LIMIT 1
      `, [userId, quizId]);
        const row = rows[0];
        return row
            ? {
                id: Number(row.id),
                status: String(row.status),
                last_question_index: Number(row.last_question_index || 0),
                revealed_question_ids_json: row.revealed_question_ids_json ? String(row.revealed_question_ids_json) : null,
            }
            : null;
    }
    groupAnswerRows(rows) {
        const grouped = {};
        for (const row of rows) {
            const questionId = Number(row.question_id);
            if (!grouped[questionId])
                grouped[questionId] = [];
            grouped[questionId].push({
                optionId: Number(row.option_id),
                isSelected: Number(row.is_selected),
            });
        }
        return grouped;
    }
    getAnswerState(question, storedRows) {
        if (question.question_type === 'sba') {
            return {
                selectedIds: storedRows.filter((row) => row.isSelected === 1).map((row) => row.optionId),
                tfMap: {},
            };
        }
        const tfMap = {};
        for (const row of storedRows) {
            tfMap[row.optionId] = row.isSelected;
        }
        return {
            selectedIds: [],
            tfMap,
        };
    }
    evaluateAnswer(question, state) {
        if (question.question_type === 'sba') {
            const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id).sort((a, b) => a - b);
            const selected = [...state.selectedIds].sort((a, b) => a - b);
            if (selected.length === 0)
                return 'unanswered';
            return JSON.stringify(selected) === JSON.stringify(correctIds) ? 'correct' : 'wrong';
        }
        if (Object.keys(state.tfMap).length === 0)
            return 'unanswered';
        if (Object.keys(state.tfMap).length < question.options.length)
            return 'wrong';
        return question.options.every((opt) => state.tfMap[opt.id] === opt.isCorrect) ? 'correct' : 'wrong';
    }
    calculateQuestionScore(question, state) {
        if (question.question_type === 'sba') {
            const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id).sort((a, b) => a - b);
            const selected = [...state.selectedIds].sort((a, b) => a - b);
            if (!selected.length)
                return 0;
            return JSON.stringify(selected) === JSON.stringify(correctIds) ? SBA_QUESTION_MARKS : 0;
        }
        let correctStatements = 0;
        let wrongStatements = 0;
        for (const option of question.options) {
            if (!(option.id in state.tfMap))
                continue;
            if (state.tfMap[option.id] === option.isCorrect)
                correctStatements++;
            else
                wrongStatements++;
        }
        return this.calculateTrueFalseScore(correctStatements, wrongStatements).score;
    }
    calculateTrueFalseScore(correctStatements, wrongStatements) {
        const boundedCorrect = Math.max(0, Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION, Number(correctStatements) || 0));
        const boundedWrong = Math.max(0, Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION - boundedCorrect, Number(wrongStatements) || 0));
        const rawScore = TRUE_FALSE_STATEMENT_MARKS * (boundedCorrect - boundedWrong);
        const score = Math.max(0, Math.min(SBA_QUESTION_MARKS, Number(rawScore.toFixed(2))));
        const percentage = Number(((score / SBA_QUESTION_MARKS) * 100).toFixed(2));
        return {
            score,
            percentage,
        };
    }
    calculateSubmissionQuestionScore(question, rawAnswer) {
        if (question.question_type === 'sba') {
            const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
            const state = {
                selectedIds: selectedId ? [selectedId] : [],
                tfMap: {},
            };
            return this.calculateQuestionScore(question, state);
        }
        const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer : {};
        const tfMap = {};
        for (const option of question.options) {
            const value = tfSubmitted[String(option.id)];
            if (value !== 0 && value !== 1 && value !== '0' && value !== '1')
                continue;
            tfMap[option.id] = Number(value) === 1 ? 1 : 0;
        }
        return this.calculateQuestionScore(question, { selectedIds: [], tfMap });
    }
    scaleScoreToHundred(rawScore, questionCount) {
        if (!questionCount)
            return 0;
        const maxRawScore = questionCount * SBA_QUESTION_MARKS;
        if (!maxRawScore)
            return 0;
        return Number(((rawScore / maxRawScore) * QUIZ_TOTAL_MARKS).toFixed(2));
    }
    async createExamAttempt(connection, userId, quizId, quiz, questions, submittedAnswers) {
        const [attemptResult] = await connection.execute(`
        INSERT INTO quiz_attempts (
          user_id, quiz_id, attempt_mode, total_questions,
          correct_answers, wrong_answers, unanswered_questions,
          score, percentage, pass_status, started_at, submitted_at, status
        ) VALUES (?, ?, 'exam', ?, 0, 0, 0, 0, 0, 'fail', NOW(), NOW(), 'submitted')
      `, [userId, quizId, questions.length]);
        const attemptId = attemptResult.insertId;
        let correctAnswers = 0;
        let wrongAnswers = 0;
        let unansweredQuestions = 0;
        for (const question of questions) {
            const rawAnswer = submittedAnswers[String(question.id)];
            const status = await this.saveExamQuestionAnswers(connection, attemptId, question, rawAnswer);
            if (status === 'correct') {
                correctAnswers++;
            }
            else if (status === 'wrong') {
                wrongAnswers++;
            }
            else {
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
        await connection.execute(`
        UPDATE quiz_attempts
        SET correct_answers = ?, wrong_answers = ?, unanswered_questions = ?,
            score = ?, percentage = ?, pass_status = ?
        WHERE id = ?
      `, [correctAnswers, wrongAnswers, unansweredQuestions, score, percentage, passStatus, attemptId]);
        return attemptId;
    }
    async saveExamQuestionAnswers(connection, attemptId, question, rawAnswer) {
        if (question.question_type === 'sba') {
            const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
            const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id);
            if (!selectedId)
                return 'unanswered';
            await connection.execute('INSERT INTO student_answers (attempt_id, question_id, option_id, is_selected) VALUES (?, ?, ?, 1)', [attemptId, question.id, selectedId]);
            return correctIds.length === 1 && correctIds[0] === selectedId ? 'correct' : 'wrong';
        }
        const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer : {};
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
            await connection.execute('INSERT INTO student_answers (attempt_id, question_id, option_id, is_selected) VALUES (?, ?, ?, ?)', [attemptId, question.id, option.id, numeric]);
            if (numeric !== option.isCorrect) {
                allCorrect = false;
            }
        }
        if (answeredStatements === 0)
            return 'unanswered';
        return answeredStatements === question.options.length && allCorrect ? 'correct' : 'wrong';
    }
    mapQuizForStudent(quiz) {
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
    mapQuestion(question) {
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
    mapQuestionForPracticeAttempt(question) {
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
            canRevealAnswer: Boolean(question.options.length ||
                String(question.explanation || '').trim() ||
                question.theoryRecap),
        };
    }
    mapPracticeRevealQuestion(question) {
        return {
            ...this.mapQuestion(question),
            canRevealAnswer: true,
        };
    }
    buildAnswerKey(question) {
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
    mapQuestionForActiveAttempt(question) {
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
    mapReviewQuestion(question, storedRows) {
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
    resolvePassingMarks(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0)
            return QUIZ_PASS_MARK;
        return numeric;
    }
};
exports.QuizAttemptsService = QuizAttemptsService;
exports.QuizAttemptsService = QuizAttemptsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, plans_service_1.PlansService])
], QuizAttemptsService);
//# sourceMappingURL=quiz-attempts.service.js.map