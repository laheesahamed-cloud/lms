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
var QuizAttemptsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizAttemptsService = void 0;
const content_version_1 = require("../../common/utils/content-version");
const study_stats_service_1 = require("../study-stats/study-stats.service");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const access_token_1 = require("../../common/auth/access-token");
const token_user_1 = require("../../common/auth/token-user");
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const student_catalogue_service_1 = require("../courses/student-catalogue.service");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_token_util_1 = require("../auth/auth-token.util");
const plans_service_1 = require("../plans/plans.service");
const xp_rules_1 = require("../xp/xp.rules");
const exam_token_1 = require("../../common/auth/exam-token");
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const progress_write_1 = require("../../common/utils/progress-write");
const streak_1 = require("../xp/streak");
const app_only_content_exception_1 = require("../../common/exceptions/app-only-content.exception");
const mobile_client_util_1 = require("../../common/utils/mobile-client.util");
const question_content_1 = require("../../common/utils/question-content");
const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;
const QUIZ_CONTENT_CACHE_MS = 30000;
const LEAN_REVIEW_KEYS = ['id', 'answerKey', 'courseId', 'subjectId', 'topicId', 'answerState', 'answerStatus', 'questionScore', 'maxQuestionScore'];
let QuizAttemptsService = QuizAttemptsService_1 = class QuizAttemptsService {
    constructor(db, plansService, studyStats, catalogue) {
        this.db = db;
        this.plansService = plansService;
        this.studyStats = studyStats;
        this.catalogue = catalogue;
        this.activeQuizCache = new Map();
        this.quizQuestionCache = new Map();
        this.quizCatalogCache = null;
        this.quizCatalogInflight = null;
        this.quizContent = new Map();
        this.quizContentBuilding = new Map();
        this.quizContentDir = (0, node_path_1.join)(process.env.CACHE_DIR || (0, node_path_1.join)(process.cwd(), 'storage', 'cache'), 'quiz-content');
    }
    async getActiveQuizCatalog() {
        const version = await (0, content_version_1.getContentVersion)(this.db);
        if (this.quizCatalogCache && this.quizCatalogCache.version === version)
            return this.quizCatalogCache.rows;
        if (this.quizCatalogInflight)
            return this.quizCatalogInflight;
        const task = this.db.execute(`
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
      `)
            .then(([rows]) => {
            this.quizCatalogCache = { rows, expiresAt: Date.now() + QuizAttemptsService_1.QUIZ_CATALOG_TTL_MS, version };
            return rows;
        })
            .finally(() => {
            this.quizCatalogInflight = null;
        });
        this.quizCatalogInflight = task;
        return task;
    }
    async listQuizzes(authorization) {
        const user = await this.requireStudent(authorization);
        const hasPlan = await this.hasActivePlan(user);
        const [canPractice, canExam] = [hasPlan, hasPlan];
        const accessProfile = await this.getQuizAccessProfile(user.id);
        const catalog = await this.getActiveQuizCatalog();
        const [summaryRows] = await this.db.execute('SELECT quiz_marks, recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1', [user.id]);
        const marks = (0, lesson_bits_1.bytesFromMap)(summaryRows[0]?.quiz_marks);
        const recentIds = new Set();
        try {
            for (const e of JSON.parse(String(summaryRows[0]?.recent_results || '[]')))
                recentIds.add(Number(e?.quizId));
        }
        catch { }
        const attemptsByQuiz = new Map();
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
            };
        });
        return rows.map((row) => {
            const canAccessQuiz = this.canAccessQuiz(row, accessProfile);
            const isFree = Number(row.is_free) === 1;
            const accessMessage = !canAccessQuiz
                ? 'Your subscription does not include this course question bank.'
                : '';
            const generalLabel = Number(row.is_general) === 1 && !row.subject_name
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
                subjectName: row.subject_name || generalLabel,
                topicName: row.topic_name || (generalLabel ? `　${generalLabel}` : ''),
                subtopicName: row.topic_name || '',
                lessonTitle: row.lesson_title || '',
                examAttemptCount: Number(row.exam_attempt_count || 0),
                latestAttemptId: row.latest_attempt_id ? Number(row.latest_attempt_id) : null,
                bestPercentage: row.best_pct ?? null,
                passed: Boolean(row.passed_once),
                isCompleted: Number(row.exam_attempt_count || 0) > 0 ||
                    Number(row.practice_completed_count || 0) > 0,
                isFree,
                randomizationMode: 'static',
                canAccess: canAccessQuiz,
                accessLocked: !canAccessQuiz,
                accessMessage,
                canPracticeMode: canAccessQuiz && (canPractice || isFree),
                canExamMode: canAccessQuiz && (canExam || isFree),
            };
        });
    }
    async freeSamples() {
        const catalog = await this.getActiveQuizCatalog();
        const quizzes = [];
        for (const row of catalog) {
            if (Number(row.is_free) !== 1)
                continue;
            const questions = await this.loadQuestionsForQuiz(Number(row.id), null, undefined);
            if (!questions.length)
                continue;
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
    async listResults(authorization) {
        const user = await this.requireStudent(authorization);
        const [rows] = await this.db.execute('SELECT recent_results FROM student_study_summary WHERE user_id = ? LIMIT 1', [user.id]);
        return this.resultsFromRecent(Number(user.id), rows[0]?.recent_results);
    }
    async resultsFromRecent(userId, raw) {
        const rows = [{ recent_results: raw }];
        const user = { id: userId };
        let recent = [];
        try {
            recent = JSON.parse(String(rows[0]?.recent_results || '[]'));
        }
        catch {
            recent = [];
        }
        if (!Array.isArray(recent) || !recent.length)
            return [];
        const catalog = new Map((await this.getActiveQuizCatalog()).map((q) => [Number(q.id), q]));
        const out = [];
        const fills = [];
        for (const e of [...recent].reverse()) {
            const quizId = Number(e?.quizId);
            const quiz = catalog.get(quizId);
            if (!quiz)
                continue;
            let correct = Number(e?.c), wrong = Number(e?.w);
            if (!Number.isFinite(correct) || !Number.isFinite(wrong)) {
                correct = 0;
                wrong = 0;
                try {
                    const ids = Array.isArray(e?.ids) ? e.ids.map(Number) : [];
                    const qs = await this.loadQuestionsForQuiz(quizId, null, ids.length ? ids : undefined);
                    for (const q of qs) {
                        const r = this.buildExamQuestionAnswerRows(0, q, (e?.a || {})[String(q.id)]);
                        if (r.status === 'correct')
                            correct++;
                        else if (r.status === 'wrong')
                            wrong++;
                    }
                    fills.push({ index: recent.indexOf(e), c: correct, w: wrong });
                }
                catch { }
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
            await this.db.execute(`UPDATE student_study_summary SET recent_results = JSON_SET(recent_results, ${paths})
          WHERE user_id = ? AND recent_results = ?`, [...fills.flatMap((f) => [f.c, f.w]), user.id, String(rows[0]?.recent_results || '')]).catch(() => undefined);
        }
        return out;
    }
    async loadQuiz(authorization, quizId, mode, questionId, appClient) {
        if (mode !== 'practice' && mode !== 'exam') {
            throw new common_1.BadRequestException('Invalid quiz mode');
        }
        const [user, quiz] = await Promise.all([
            this.requireStudent(authorization),
            this.loadActiveQuiz(quizId),
        ]);
        if (mode === 'exam' || Number(quiz.exam_mode_only) === 1) {
            throw new common_1.BadRequestException('Start this exam from the exam screen');
        }
        const scopedQuestionId = Number.isFinite(Number(questionId)) && Number(questionId) > 0
            ? Number(questionId)
            : null;
        const isFreeQuiz = Number(quiz.is_free) === 1;
        const featureMessage = 'Practice mode is included with selected plans';
        await Promise.all([
            this.ensureStudentCanAccessQuiz(user.id, quiz, appClient),
            isFreeQuiz
                ? Promise.resolve()
                : this.hasActivePlan(user).then((hasAccess) => {
                    if (!hasAccess)
                        throw new common_1.BadRequestException(featureMessage);
                }),
        ]);
        const practiceQuestions = await this.loadQuestionsForLocalPractice(quiz, scopedQuestionId);
        return {
            mode: 'practice',
            quiz: this.mapQuizForStudent(quiz),
            questions: practiceQuestions.map((question) => (0, mobile_client_util_1.isMobileAppClient)(appClient) ? this.mapQuestionForAppPractice(question) : this.mapQuestionForPracticeAttempt(question)),
        };
    }
    async hasActivePlan(user) {
        const carried = user?.__accessProfile;
        if (carried && typeof carried.hasActiveSubscription === 'boolean')
            return carried.hasActiveSubscription;
        return this.plansService.hasFeatureAccess(Number(user.id), 'exam_mode');
    }
    async authorizeQuizForExam(authorization, quizId, appClient) {
        const [user, quiz] = await Promise.all([
            this.requireStudent(authorization),
            this.loadActiveQuiz(quizId),
        ]);
        const isFreeQuiz = Number(quiz.is_free) === 1;
        await Promise.all([
            this.ensureStudentCanAccessQuiz(user.id, quiz, appClient),
            isFreeQuiz
                ? Promise.resolve()
                : this.hasActivePlan(user).then((hasAccess) => {
                    if (!hasAccess)
                        throw new common_1.BadRequestException('Exam mode is included with selected plans');
                }),
        ]);
        return { user, quiz };
    }
    async startExam(authorization, quizId, appClient) {
        const { user, quiz } = await this.authorizeQuizForExam(authorization, quizId, appClient);
        const questions = await this.loadQuestionsForQuiz(quiz.id, null, undefined);
        await this.studyStats.ensureBuilt(Number(user.id));
        const nonce = (0, exam_token_1.newExamNonce)();
        await this.db.execute('UPDATE student_study_summary SET exam_nonce = ?, exam_quiz_id = ? WHERE user_id = ?', [nonce, quizId, user.id]);
        const startedAt = Date.now();
        const limitMs = Math.max(0, Number(quiz.time_limit || 0)) * 60_000;
        const deadline = startedAt + (limitMs || 3 * 60 * 60 * 1000);
        const examToken = (0, exam_token_1.signExamToken)({
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
    async finishExam(authorization, quizId, dto, appClient) {
        const user = await this.requireStudent(authorization);
        const claims = (0, exam_token_1.verifyExamToken)(dto?.examToken, Number(user.id), quizId);
        if (!claims)
            throw new common_1.BadRequestException('This exam has expired or is not valid. Start it again.');
        const quiz = await this.loadActiveQuiz(quizId);
        const loaded = await this.loadQuestionsForQuiz(quizId, null, undefined);
        const byId = new Map(loaded.map((q) => [Number(q.id), q]));
        const questions = claims.ids.map((id) => byId.get(Number(id))).filter(Boolean);
        const answers = this.normalizeSubmittedAnswers(dto?.answers || {}, questions);
        let correct = 0, wrong = 0, unanswered = 0, raw = 0;
        for (const question of questions) {
            const r = this.buildExamQuestionAnswerRows(0, question, answers[String(question.id)]);
            raw += r.rawScore;
            if (r.status === 'correct')
                correct++;
            else if (r.status === 'wrong')
                wrong++;
            else
                unanswered++;
        }
        const score = this.scaleScoreToHundred(raw, questions.length);
        const pct = Math.max(0, Math.min(100, Math.round(score)));
        const passed = score >= this.resolvePassingMarks(Number(quiz.passing_marks || 0)) ? 1 : 0;
        const eligible = pct >= xp_rules_1.XP.MIN_PERCENT ? 1 : 0;
        const day = (0, streak_1.localDateKey)(new Date());
        const old = (0, lesson_bits_1.oldByteSql)('quiz_marks');
        const oldP = [quizId, quizId];
        const baseSql = `IF(?, IF(${old} = 0, ?, IF(? > (${old} & 127) - 1, ?, 0)), 0) + IF(? AND (${old} & 128) = 0, ?, 0)`;
        const baseParams = [eligible, ...oldP, xp_rules_1.XP.EXAM_TAKE, pct, ...oldP, xp_rules_1.XP.EXAM_RETAKE, passed, ...oldP, xp_rules_1.XP.EXAM_PASS];
        const w = (0, progress_write_1.progressWrite)(day, { baseXpSql: baseSql, baseXpParams: baseParams, practices: (0, progress_write_1.takeRideAlong)() });
        const byte = (0, lesson_bits_1.setByteSql)('quiz_marks', `IF((${old} & 128) <> 0 OR ?, 128, 0) + GREATEST(IF(${old} = 0, -1, (${old} & 127) - 1), ?) + 1`);
        const entry = JSON.stringify({
            k: String(quizId), quizId, pct, passed: passed === 1, reviewed: false, at: new Date().toISOString(),
            ids: questions.map((q) => Number(q.id)), a: answers, c: correct, w: wrong,
        });
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
        const [res] = await this.db.execute(`UPDATE student_study_summary
          SET ${w.streak.sql},
              progress_version = LAST_INSERT_ID((progress_version + 1) * 1000 + ${w.amount.sql}) DIV 1000,
              ${w.pay.sql},
              recent_results = ${recentSql},
              quiz_marks = ${byte.sql},
              exam_nonce = NULL,
              exam_quiz_id = NULL,
              ${w.seq.sql}
        WHERE user_id = ? AND exam_nonce = ?`, [
            ...w.streak.params, ...w.amount.params, ...w.pay.params,
            ...recentParams,
            ...byte.params(quizId, [...oldP, passed, ...oldP, ...oldP, pct]),
            ...w.seq.params,
            user.id, claims.n,
        ]);
        if (!res.affectedRows) {
            (0, progress_write_1.returnRideAlong)();
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
            xp: { awarded: packed % 1000, capped: false, ...(eligible ? {} : { reason: 'low_score' }) },
            progressVersion: Math.floor(packed / 1000),
            answers,
            ...this.recentPayloads(quiz, questions, answers, { pct, passed: passed === 1, score, correct, wrong, unanswered }, dto?.lean === true),
            ...(dto?.lean !== true && (0, mobile_client_util_1.isMobileAppClient)(appClient) ? { practiceQuiz: this.mapQuizForStudent(quiz) } : {}),
        };
    }
    recentPayloads(quiz, questions, answers, r, lean = false) {
        const quizId = Number(quiz.id);
        const topic = Number(quiz.is_general) === 1 ? 'General / Full Course Revision' : String(quiz.subject_name || quiz.topic_name || 'No Topic');
        const passStatus = r.passed ? 'pass' : 'fail';
        const stored = (question) => {
            const a = answers[String(question.id)];
            if (a === undefined || a === null)
                return [];
            if (question.question_type === 'sba')
                return [{ optionId: Number(a), isSelected: 1 }];
            return Object.entries(a).map(([optionId, v]) => ({ optionId: Number(optionId), isSelected: Number(v) === 1 ? 1 : 0 }));
        };
        return {
            result: {
                attemptId: quizId,
                quizId,
                quizTitle: String(quiz.quiz_title || ''),
                displayTitleMode: quiz.display_title_mode === 'title' ? 'title' : 'number',
                quizNumber: Number(quiz.quiz_number || 0) || null,
                courseTitle: String(quiz.course_title || ''),
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
                    courseTitle: String(quiz.course_title || ''),
                    topicDisplay: topic,
                    score: r.score,
                    percentage: r.pct,
                    passStatus,
                },
                questions: questions.map((question) => {
                    const full = this.mapReviewQuestion(question, stored(question));
                    if (!lean)
                        return full;
                    const out = {};
                    for (const key of LEAN_REVIEW_KEYS)
                        if (key in full)
                            out[key] = full[key];
                    return out;
                }),
            },
            ...(lean ? { lean: true } : {}),
        };
    }
    async recentReview(authorization, quizId, appClient, part, lean = false) {
        const user = await this.requireStudent(authorization);
        const [rows] = await this.db.execute(`SELECT JSON_EXTRACT(recent_results, SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k')), '.k', 1)) AS entry
         FROM student_study_summary WHERE user_id = ? LIMIT 1`, [String(quizId), user.id]);
        let entry = null;
        try {
            entry = rows[0]?.entry ? JSON.parse(String(rows[0].entry)) : null;
        }
        catch {
            entry = null;
        }
        if (!entry)
            throw new common_1.NotFoundException('Result not found');
        const quiz = await this.loadActiveQuiz(quizId);
        if (part !== 'result' && Number(quiz.is_free) !== 1 && !(0, mobile_client_util_1.isMobileAppClient)(appClient))
            throw new app_only_content_exception_1.AppOnlyContentException();
        const ids = Array.isArray(entry.ids) ? entry.ids.map(Number) : [];
        const loaded = await this.loadQuestionsForQuiz(quizId, null, ids.length ? ids : undefined);
        const byId = new Map(loaded.map((q) => [Number(q.id), q]));
        const questions = (ids.length ? ids.map((id) => byId.get(id)).filter(Boolean) : loaded);
        const answers = (entry.a && typeof entry.a === 'object') ? entry.a : {};
        let correct = 0, wrong = 0, unanswered = 0, raw = 0;
        for (const question of questions) {
            const r = this.buildExamQuestionAnswerRows(0, question, answers[String(question.id)]);
            raw += r.rawScore;
            if (r.status === 'correct')
                correct++;
            else if (r.status === 'wrong')
                wrong++;
            else
                unanswered++;
        }
        const score = this.scaleScoreToHundred(raw, questions.length);
        const payloads = this.recentPayloads(quiz, questions, answers, { pct: Number(entry.pct) || 0, passed: Boolean(entry.passed), score, correct, wrong, unanswered }, lean);
        if (part === 'result')
            return { result: payloads.result, reviewed: Boolean(entry.reviewed), at: entry.at || null };
        const practiceQuiz = !lean && (0, mobile_client_util_1.isMobileAppClient)(appClient) ? { practiceQuiz: this.mapQuizForStudent(quiz) } : {};
        return { ...payloads, ...practiceQuiz, reviewed: Boolean(entry.reviewed), at: entry.at || null };
    }
    async markRecentReviewed(authorization, quizId) {
        const user = await this.requireStudent(authorization);
        const key = String(quizId);
        const path = `SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k')), '.k', 1)`;
        const [res] = await this.db.execute(`UPDATE student_study_summary
          SET progress_version = LAST_INSERT_ID(progress_version + 1),
              recent_results = JSON_SET(recent_results, CONCAT(${path}, '.reviewed'), JSON_EXTRACT('true', '$'))
        WHERE user_id = ? AND JSON_SEARCH(recent_results, 'one', ?, NULL, '$[*].k') IS NOT NULL
          -- 10.27 R2: already reviewed → nothing is written (no new progress version).
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(recent_results, CONCAT(${path}, '.reviewed'))), 'false') <> 'true'`, [key, user.id, key, key]);
        return res.affectedRows
            ? { ok: true, progressVersion: Number(res.insertId || 0) }
            : { ok: true, alreadyReviewed: true };
    }
    async requireStudent(authorization) {
        const token = this.extractToken(authorization);
        if ((0, access_token_1.looksLikeAccessToken)(token)) {
            const user = (0, token_user_1.userFromAccessToken)(token);
            if (user.role !== 'student')
                throw new common_1.UnauthorizedException('Student access required');
            if (user.status !== 'active')
                throw new common_1.UnauthorizedException('Your student account is not active yet');
            return user;
        }
        const known = (0, subscription_scope_1.studentFromRequest)();
        if (known && known.role === 'student' && known.status === 'active')
            return known;
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
    async ensureStudentCanAccessQuiz(userId, quiz, appClient) {
        if (Number(quiz.is_free) !== 1 && !(0, mobile_client_util_1.isMobileAppClient)(appClient)) {
            throw new app_only_content_exception_1.AppOnlyContentException();
        }
        const accessProfile = await this.getQuizAccessProfile(userId);
        if (!this.canAccessQuiz(quiz, accessProfile)) {
            throw new common_1.BadRequestException('This quiz is included with selected course plans');
        }
    }
    async getQuizAccessProfile(userId) {
        const rows = await (0, subscription_scope_1.getScopeRows)(this.db, userId);
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
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
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
    async quizStamp(quizId) {
        if (!this.catalogue)
            return null;
        try {
            const row = (await this.catalogue.names()).quiz.get(Number(quizId));
            return row ? Number(row[16]) || 1 : null;
        }
        catch {
            return null;
        }
    }
    async quizContentFor(quizId) {
        const stamp = await this.quizStamp(quizId);
        if (stamp === null)
            return null;
        const held = this.quizContent.get(quizId);
        if (held && held.stamp === stamp)
            return held;
        const key = `${quizId}-${stamp}`;
        const running = this.quizContentBuilding.get(key);
        if (running)
            return running;
        const work = (async () => {
            const file = (0, node_path_1.join)(this.quizContentDir, `${key}.json`);
            let content = null;
            try {
                const saved = JSON.parse(await (0, promises_1.readFile)(file, 'utf8'));
                if (saved?.quiz && Array.isArray(saved.questions))
                    content = { stamp, quiz: saved.quiz, questions: saved.questions };
            }
            catch { }
            if (!content) {
                const quiz = await this.loadActiveQuizFromDb(quizId);
                let questions = [];
                try {
                    questions = await this.loadQuestionsForQuizFromDb(quizId);
                }
                catch {
                    questions = [];
                }
                content = { stamp, quiz, questions };
                try {
                    await (0, promises_1.mkdir)(this.quizContentDir, { recursive: true });
                    await (0, promises_1.writeFile)(`${file}.${process.pid}.tmp`, JSON.stringify({ quiz, questions }));
                    await (0, promises_1.rename)(`${file}.${process.pid}.tmp`, file);
                    for (const name of await (0, promises_1.readdir)(this.quizContentDir)) {
                        if (name.startsWith(`${quizId}-`) && name !== `${key}.json` && name.endsWith('.json'))
                            await (0, promises_1.unlink)((0, node_path_1.join)(this.quizContentDir, name)).catch(() => { });
                    }
                }
                catch { }
            }
            this.quizContent.delete(quizId);
            this.quizContent.set(quizId, content);
            if (this.quizContent.size > QuizAttemptsService_1.QUIZ_CONTENT_KEEP) {
                this.quizContent.delete(this.quizContent.keys().next().value);
            }
            return content;
        })().finally(() => this.quizContentBuilding.delete(key));
        this.quizContentBuilding.set(key, work);
        return work;
    }
    async loadActiveQuiz(quizId) {
        const content = await this.quizContentFor(quizId);
        if (content)
            return content.quiz;
        return this.loadActiveQuizFromDb(quizId);
    }
    async loadActiveQuizFromDb(quizId) {
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
      `, [quizId]);
        const quiz = rows[0];
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found or inactive');
        }
        this.activeQuizCache.set(quizId, { value: quiz, expiresAt: now + QUIZ_CONTENT_CACHE_MS });
        return quiz;
    }
    async loadQuestionsForQuiz(quizId, questionId, questionIds) {
        const content = await this.quizContentFor(quizId);
        if (content && content.questions.length) {
            const scoped = Number(questionId) > 0 ? Number(questionId) : null;
            const ids = Array.from(new Set((questionIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)));
            const byId = new Map(content.questions.map((q) => [Number(q.id), q]));
            if (ids.length === 0 || ids.every((id) => byId.has(id))) {
                const list = ids.length ? ids.map((id) => byId.get(id)) : content.questions;
                if (!scoped)
                    return list;
                const one = list.filter((q) => Number(q.id) === scoped);
                if (one.length)
                    return one;
                throw new common_1.NotFoundException('Question not found in this quiz');
            }
        }
        return this.loadQuestionsForQuizFromDb(quizId, questionId, questionIds);
    }
    async loadQuestionsForQuizFromDb(quizId, questionId, questionIds) {
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
        const select = `
      SELECT
        q.id, q.course_id, q.topic_id, q.subtopic_id, q.subtopic, q.category, q.question_type,
        q.question_text, q.explanation, q.explanation_image_url, q.question_approach,
        q.question_approach_highlights, q.status, q.updated_at,
        q.options_json, q.recap_json
      FROM questions q`;
        let joinedRows = [];
        if (frozenQuestionIds.length > 0) {
            const requestedIds = scopedQuestionId
                ? frozenQuestionIds.filter((id) => id === scopedQuestionId)
                : frozenQuestionIds;
            if (requestedIds.length === 0) {
                throw new common_1.NotFoundException('Question not found in this quiz');
            }
            const [rows] = await this.db.execute(`${select}
          WHERE q.id IN (${(0, sql_safety_1.sqlPlaceholders)(requestedIds)}) AND q.status = 'active'`, requestedIds);
            const orderById = new Map(frozenQuestionIds.map((id, index) => [id, index]));
            joinedRows = rows.sort((left, right) => ((orderById.get(Number(left.id)) ?? 0) - (orderById.get(Number(right.id)) ?? 0)));
        }
        else {
            const [rows] = await this.db.execute(`${select}
          INNER JOIN question_quizzes qq ON qq.question_id = q.id
          WHERE qq.quiz_id = ? AND q.status = 'active'
            ${scopedQuestionId ? 'AND q.id = ?' : ''}
          ORDER BY qq.sort_order ASC, qq.question_id ASC`, scopedQuestionId ? [quizId, scopedQuestionId] : [quizId]);
            joinedRows = rows;
        }
        if (joinedRows.length === 0) {
            throw new common_1.NotFoundException(scopedQuestionId ? 'Question not found in this quiz' : 'No questions linked to this quiz');
        }
        const questionRows = joinedRows;
        const optionRows = [];
        const recapRows = [];
        for (const row of joinedRows) {
            for (const o of (0, question_content_1.optionsOf)(Number(row.id), row.options_json))
                optionRows.push(o);
            const recap = (0, question_content_1.recapOf)(Number(row.id), row.recap_json);
            if (recap)
                recapRows.push(recap);
        }
        const versionByQuestionId = new Map();
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
    async loadQuestionsForLocalPractice(quiz, questionId) {
        return this.loadQuestionsForQuiz(quiz.id, questionId, undefined);
    }
    normalizeQuestionCategory(category) {
        const value = String(category || '').trim();
        if (value === 'past')
            return 'past_paper';
        return value;
    }
    normalizeLegacyQuestionCategory(category) {
        const value = String(category || '').trim();
        if (value === 'past_paper')
            return 'past';
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
    buildExamQuestionAnswerRows(attemptId, question, rawAnswer) {
        if (question.question_type === 'sba') {
            const selectedId = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
            const correctIds = question.options.filter((opt) => opt.isCorrect === 1).map((opt) => opt.id);
            const rawScore = this.calculateSubmissionQuestionScore(question, rawAnswer);
            if (!selectedId)
                return { status: 'unanswered', rawScore, rows: [] };
            return {
                status: correctIds.length === 1 && correctIds[0] === selectedId ? 'correct' : 'wrong',
                rawScore,
                rows: [[attemptId, question.id, selectedId, 1]],
            };
        }
        const tfSubmitted = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer : {};
        let answeredStatements = 0;
        let allCorrect = true;
        const rows = [];
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
        if (answeredStatements === 0)
            return { status: 'unanswered', rawScore, rows };
        return {
            status: answeredStatements === question.options.length && allCorrect ? 'correct' : 'wrong',
            rawScore,
            rows,
        };
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
            randomizationMode: 'static',
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
    mapQuestionForAppPractice(question) {
        const { answerKey: _a, contentTrace: _t, ...rest } = this.mapQuestion(question);
        return rest;
    }
    mapQuestionForPracticeAttempt(question) {
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
            courseId: Number(question.course_id) || 0,
            subjectId: Number(question.topic_id) || 0,
            topicId: Number(question.subtopic_id) || 0,
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
QuizAttemptsService.QUIZ_CATALOG_TTL_MS = 30_000;
QuizAttemptsService.QUIZ_CONTENT_KEEP = 400;
exports.QuizAttemptsService = QuizAttemptsService = QuizAttemptsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, plans_service_1.PlansService,
        study_stats_service_1.StudyStatsService,
        student_catalogue_service_1.StudentCatalogueService])
], QuizAttemptsService);
//# sourceMappingURL=quiz-attempts.service.js.map