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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const access_token_1 = require("../../common/auth/access-token");
const recent_results_1 = require("../../common/utils/recent-results");
const token_user_1 = require("../../common/auth/token-user");
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_tokens_1 = require("../../database/database.tokens");
const mobile_client_util_1 = require("../../common/utils/mobile-client.util");
const auth_service_1 = require("../auth/auth.service");
const auth_token_util_1 = require("../auth/auth-token.util");
const courses_service_1 = require("../courses/courses.service");
const streak_1 = require("../xp/streak");
const xp_service_1 = require("../xp/xp.service");
const word_search_1 = require("../../common/utils/word-search");
const users_service_1 = require("../users/users.service");
const subscriptions_service_1 = require("../subscriptions/subscriptions.service");
const study_stats_service_1 = require("../study-stats/study-stats.service");
const progress_write_1 = require("../../common/utils/progress-write");
const streak_2 = require("../xp/streak");
const course_structure_service_1 = require("../courses/course-structure.service");
const student_catalogue_service_1 = require("../courses/student-catalogue.service");
const question_content_1 = require("../../common/utils/question-content");
const content_version_1 = require("../../common/utils/content-version");
let DashboardService = DashboardService_1 = class DashboardService {
    constructor(db, authService, coursesService, xpService, usersService, subscriptionsService, studyStats, courseStructure, studentCatalogue) {
        this.db = db;
        this.authService = authService;
        this.coursesService = coursesService;
        this.xpService = xpService;
        this.usersService = usersService;
        this.subscriptionsService = subscriptionsService;
        this.studyStats = studyStats;
        this.courseStructure = courseStructure;
        this.studentCatalogue = studentCatalogue;
        this.namesCache = null;
        this.questionOfDayCache = new Map();
        this.questionOfDayInflight = new Map();
        this.webQuestionPoolCache = null;
        this.webQuestionPoolInflight = null;
        this.questionIdRange = null;
    }
    async getAdminDashboard(authorization, today) {
        const admin = await this.authService.requireAdmin(authorization);
        const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : null;
        const canSeeMoney = admin.role === 'admin' || Boolean(admin.permissions?.includes('subscriptions.manage'));
        const conn = await this.db.getConnection();
        try {
            const [courseRows] = await conn.query('SELECT lesson_count, question_total, quiz_total FROM courses');
            const users = await this.usersService.summary(admin, day ?? undefined, conn);
            const finance = canSeeMoney ? await this.subscriptionsService.adminDashboardFinance(conn, day) : null;
            return {
                totals: {
                    courses: courseRows.length,
                    lessons: courseRows.reduce((t, c) => t + Number(c.lesson_count || 0), 0),
                    questions: courseRows.reduce((t, c) => t + Number(c.question_total || 0), 0),
                    quizzes: courseRows.reduce((t, c) => t + Number(c.quiz_total || 0), 0),
                },
                users,
                finance,
                generatedAt: new Date().toISOString(),
            };
        }
        finally {
            conn.release();
        }
    }
    async adminSearch(authorization, query, only) {
        const admin = await this.authService.requireAdmin(authorization);
        const q = String(query || '').trim().slice(0, 100);
        const empty = { courses: [], lessons: [], quizzes: [], students: [] };
        if (q.length < 2)
            return empty;
        const can = (permission) => admin.role === 'admin' || Boolean(admin.permissions?.includes(permission));
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const words = (0, word_search_1.searchWords)(q);
        if (!words.length)
            return empty;
        const textFilter = (columns) => (0, word_search_1.wordSearchFilter)(columns, words);
        const lessonsOnly = only === 'lessons';
        const studentsOnly = only === 'students';
        const limit = lessonsOnly || studentsOnly ? 10 : 4;
        const conn = await this.db.getConnection();
        try {
            const result = { ...empty };
            if (can('content.manage') && !lessonsOnly && !studentsOnly) {
                const [rows] = await conn.query('SELECT id, course_title FROM courses WHERE course_title LIKE ? OR description LIKE ? LIMIT ?', [like, like, limit]);
                result.courses = rows.map((r) => ({ id: Number(r.id), title: String(r.course_title || '') }));
            }
            if (can('content.manage') && !studentsOnly) {
                const lessonText = textFilter(['l.lesson_title']);
                const [rows] = await conn.query(`SELECT l.id, l.lesson_title, l.status, l.course_id, l.topic_id, l.subtopic_id,
             c.course_title, t.topic_name, s.subtopic_name
           FROM lessons l
           LEFT JOIN courses c ON c.id = l.course_id
           LEFT JOIN topics t ON t.id = l.topic_id
           LEFT JOIN subtopics s ON s.id = l.subtopic_id
           WHERE ${lessonText.sql}
             AND l.is_public = 1 AND l.engine_key = 'gemini'
           LIMIT ?`, [...lessonText.params, limit]);
                result.lessons = rows.map((r) => ({
                    id: Number(r.id),
                    title: String(r.lesson_title || ''),
                    status: String(r.status || 'active'),
                    courseId: r.course_id == null ? null : Number(r.course_id),
                    topicId: r.topic_id == null ? null : Number(r.topic_id),
                    subtopicId: r.subtopic_id == null ? null : Number(r.subtopic_id),
                    courseTitle: String(r.course_title || ''),
                    topicName: String(r.topic_name || ''),
                    subtopicName: String(r.subtopic_name || ''),
                }));
            }
            if (can('quizzes.manage') && !lessonsOnly && !studentsOnly) {
                const quizText = textFilter(['q.quiz_title']);
                const [rows] = await conn.query(`SELECT q.id, q.quiz_title AS title, c.course_title, t.topic_name
           FROM quizzes q
           LEFT JOIN courses c ON c.id = q.course_id
           LEFT JOIN topics t ON t.id = q.topic_id
           WHERE ${quizText.sql}
           LIMIT ?`, [...quizText.params, limit]);
                result.quizzes = rows.map((r) => ({
                    id: Number(r.id), title: String(r.title || ''), courseTitle: String(r.course_title || ''), topicName: String(r.topic_name || ''),
                }));
            }
            if (can('students.manage') && !lessonsOnly) {
                const userText = textFilter(['full_name', 'email']);
                const [rows] = await conn.query(`SELECT id, full_name, email, status FROM users
           WHERE ${userText.sql} AND role = 'student' AND deleted_at IS NULL
           LIMIT ?`, [...userText.params, limit]);
                result.students = rows.map((r) => ({
                    id: Number(r.id), fullName: String(r.full_name || ''), email: String(r.email || ''), status: String(r.status || ''),
                }));
            }
            return result;
        }
        finally {
            conn.release();
        }
    }
    async getStudentDashboard(authorization, appClient) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const top = await this.hubTop(student, authorization);
        const more = await this.hubMore(student, appClient, top.__stats);
        const { __stats: _s, ...rest } = top;
        return { ...rest, ...more };
    }
    async getStudentHubTop(authorization, lite = false) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const { __stats: _s, ...top } = await this.hubTop(student, authorization, lite);
        return top;
    }
    async getStudentHubMore(authorization, appClient, webLite = false) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const phoneOrLite = (0, mobile_client_util_1.isMobileAppClient)(appClient) || webLite;
        return this.hubMore(student, appClient, undefined, phoneOrLite, phoneOrLite);
    }
    async getStudentQuestionOfDay(authorization) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        return this.getRandomDashboardQuestion(student.id, 'xyndrome-mobile-app');
    }
    async hubTop(student, authorization, lite = false) {
        const serverClock = this.buildServerClock(new Date());
        const stats = await this.studyStats.summary(student.id);
        const recentDays = stats.recentDays || [];
        const weakAreas = [];
        const [courseProgress, xpSummary, totalQuizzes, names, latestAttempt] = await Promise.all([
            lite ? Promise.resolve([]) : this.coursesService.findStudentCourses(authorization),
            this.xpService.getSummary(student.id, stats.today.xp, stats.totalXp),
            this.activeQuizCount(),
            this.areaNames(),
            lite ? Promise.resolve([]) : this.recentAttempts(student.id, 1),
        ]);
        const totalAttempts = stats.attemptsTotal;
        const totalPassed = stats.passedTotal;
        const averagePercentage = stats.averagePercentage;
        const passRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : 0;
        const weekStart = this.shiftDayKey(stats.today.day, -6);
        const recentActiveDays = [];
        if (stats.streak > 0 && stats.lastActiveDay && stats.lastActiveDay >= this.shiftDayKey(stats.today.day, -1)) {
            for (let i = 0; i < stats.streak; i++) {
                const day = this.shiftDayKey(stats.lastActiveDay, -i);
                if (day < weekStart)
                    break;
                recentActiveDays.unshift(day);
            }
        }
        const weakTopics = weakAreas.map((area) => this.subjectInsight(area, names));
        const quizDoneToday = stats.todayBits === progress_write_1.TODAY.ALL;
        const { dailyGoals, completedGoals, performanceSnapshot } = this.goalsAndSnapshot(stats, recentDays, weakAreas[0] || null, weakTopics[0] || null);
        return {
            __stats: { stats, recentDays, weakAreas },
            user: { id: student.id, fullName: student.full_name || '' },
            serverClock,
            totalQuizzes,
            totalCourses: lite ? (await this.courseStructure.get()).courses.length : courseProgress.length,
            totalAttempts,
            quizDayStreak: stats.streak,
            quizDoneToday,
            todayBits: stats.todayBits,
            streakGraceActive: stats.streakGraceActive,
            totalXp: xpSummary.totalXp,
            xpToday: xpSummary.xpToday,
            xpDailyCap: xpSummary.xpDailyCap,
            level: xpSummary.level,
            recentActiveDays,
            avgScore: Number(averagePercentage.toFixed(2)),
            totalPassed,
            passRate: Number(passRate.toFixed(2)),
            courseProgress: courseProgress.map((course) => ({
                id: Number(course.id),
                courseTitle: course.courseTitle,
                courseCode: course.courseCode,
                examType: course.examType,
                subjectCount: Number(course.subjectCount || 0),
                progressPercent: Number(course.progressPercent || 0),
                completedLessonsCount: Number(course.completedLessonsCount || 0),
                totalLessonsCount: Number(course.totalLessonsCount || 0),
                actionLabel: course.actionLabel || 'View Course',
            })),
            courseProgressSummary: this.buildCourseProgressSummary(courseProgress),
            weakTopics,
            dailyGoals,
            dailyGoalsCompleted: completedGoals,
            performanceSnapshot,
            recentAttempts: latestAttempt,
            focusTopic: weakTopics[0]?.topicName || 'Start your first quiz',
            focusCourse: weakTopics[0]?.courseTitle || 'No course data yet',
            progressTone: averagePercentage >= 75 ? 'strong' : averagePercentage >= 50 ? 'steady' : 'focus',
            progressNote: totalAttempts === 0
                ? 'No submitted quizzes yet. Start with one short quiz to build your baseline.'
                : averagePercentage >= 70
                    ? 'You are moving well. Keep revising your weakest subject to stay consistent.'
                    : averagePercentage >= 50
                        ? 'You are building momentum. Focus on one weak topic and one recent review each day.'
                        : 'Your recent results point to one focused review block. Revisit lessons first, then use practice mode before full exams.',
        };
    }
    async hubMore(student, appClient, known, lite = false, noQuestion = false) {
        const stats = known?.stats ?? await this.studyStats.summary(student.id);
        const ranked = { weakest: [], strongest: [], missed: [] };
        const [recentAttempts, noteRows, questionOfDay, names] = await Promise.all([
            lite ? Promise.resolve([]) : this.recentAttempts(student.id),
            Promise.resolve([]),
            noQuestion ? Promise.resolve(null) : this.getRandomDashboardQuestion(student.id, appClient),
            this.areaNames(),
        ]);
        const { weakest, strongest, missed: missedTopics } = ranked;
        const today = stats.today;
        const totalAttempts = stats.attemptsTotal;
        const insights = weakest.map((area) => this.subjectInsight(area, names));
        const weakTopics = insights.slice(0, 3);
        const weakIds = new Set(weakest.slice(0, 3).map((a) => a.area_id));
        const strongTopics = strongest.filter((a) => !weakIds.has(a.area_id)).map((area) => this.subjectInsight(area, names));
        const topicMastery = insights.map((topic) => ({ ...topic, ...this.classifyTopicMastery(topic.averagePercentage) }));
        const weakestTopic = weakTopics[0] || null;
        const todayQuizCount = today.exams + today.practice;
        const todayNoteCount = today.lessons;
        const adaptivePlan = this.buildStudentAdaptivePlan({
            totalAttempts,
            weakestTopic,
            recommendedNoteTitle: String(noteRows[0]?.title || ''),
            todayQuizCount,
            todayNoteCount,
            todayResultViewCount: today.results_viewed,
        });
        return {
            recentAttempts,
            topicMastery,
            weakTopics,
            strongTopics,
            adaptivePlan,
            questionOfDay,
            missedPatterns: missedTopics.map((area) => ({
                courseTitle: names.course.get(area.course_id) || 'General',
                subjectName: names.subject.get(area.subject_id) || '',
                topicName: (area.area_id > 0 ? names.topic.get(area.area_id) : '')
                    || names.subject.get(area.subject_id) || 'General',
                lessonTitle: '',
                questionType: '',
                missCount: area.wrong,
                answeredCount: area.answered,
                missRate: Math.round(area.wrong_rate * 100),
                latestMissedAt: area.last_wrong_at,
                patternLabel: `${Math.round(area.wrong_rate * 100)}% wrong of ${area.answered}`,
            })),
        };
    }
    goalsAndSnapshot(stats, recentDays, weakestArea, weakestTopic) {
        const today = stats.today;
        const bits = stats.todayBits || 0;
        const goal = (key, bit, title, description) => ({
            key, title, description, completed: (bits & bit) !== 0, progressText: `${(bits & bit) !== 0 ? 1 : 0}/1 done`,
        });
        const dailyGoals = [
            goal('lesson_today', progress_write_1.TODAY.LESSON, 'Finish 1 lesson', 'Read a lesson to the end and tap Done.'),
            goal('exam_today', progress_write_1.TODAY.EXAM, 'Finish 1 exam', 'Sit one exam from the Q-Bank.'),
            goal('practice_today', progress_write_1.TODAY.PRACTICE, 'Finish 1 practice', 'Complete one practice set.'),
            goal('flashcards_today', progress_write_1.TODAY.FLASHCARDS, 'Review flashcards', 'Study at least one flashcard.'),
        ];
        const completedGoals = dailyGoals.filter((goal) => goal.completed).length;
        const weekStart = this.shiftDayKey(today.day, -6);
        const twoWeeksStart = this.shiftDayKey(today.day, -13);
        const windows = [];
        for (const key of ['last_7', 'previous_7']) {
            const list = (stats.recentResults || []).filter((r) => {
                const day = (0, streak_2.localDateKey)(new Date(r.at));
                return key === 'last_7' ? day >= weekStart : day >= twoWeeksStart && day < weekStart;
            });
            if (!list.length)
                continue;
            const pct = list.reduce((sum, r) => sum + r.pct, 0);
            windows.push({ window_key: key, attempts_count: list.length, average_percentage: pct / list.length });
        }
        const totalAttempts = stats.attemptsTotal;
        const performanceSnapshot = this.buildStudentPerformanceSnapshot({
            totalAttempts,
            averagePercentage: stats.averagePercentage,
            passRate: totalAttempts > 0 ? (stats.passedTotal / totalAttempts) * 100 : 0,
            quizDayStreak: stats.streak,
            dailyGoalsCompleted: completedGoals,
            dailyGoalsTotal: dailyGoals.length,
            performanceWindows: windows,
        });
        return { dailyGoals, completedGoals, performanceSnapshot };
    }
    subjectInsight(area, names) {
        return {
            topicName: names.subject.get(area.area_id) || 'General',
            courseTitle: names.course.get(area.course_id) || 'General',
            averagePercentage: Number(((1 - area.wrong_rate) * 100).toFixed(2)),
            attemptsCount: area.answered,
        };
    }
    async recentAttempts(userId, limit = 5) {
        const attempts = (await (0, recent_results_1.loadRecentResults)(this.db, userId))
            .slice(0, Math.max(1, Math.min(5, limit)))
            .map((r) => ({
            id: r.quizId, quiz_id: r.quizId, score: r.correct ?? Math.round((r.pct / 100) * r.questionCount),
            total_questions: r.questionCount, percentage: r.pct, pass_status: r.passed ? 'pass' : 'fail', submitted_at: r.at,
        }));
        if (!attempts.length)
            return [];
        const byId = await (0, recent_results_1.loadQuizInfo)(this.db, attempts.map((a) => a.quiz_id));
        const names = await this.areaNames();
        return attempts.map((row) => {
            const quiz = byId.get(Number(row.quiz_id));
            return {
                id: row.id,
                quizTitle: (quiz?.student_title || '').trim() || quiz?.quiz_title || '',
                quizNumber: Number(quiz?.quiz_number || 0),
                displayTitleMode: quiz?.display_title_mode === 'title' ? 'title' : 'number',
                courseTitle: names.course.get(Number(quiz?.course_id)) || '',
                topicName: names.subject.get(Number(quiz?.topic_id)) || '',
                score: row.score,
                totalQuestions: row.total_questions,
                percentage: Number(row.percentage || 0),
                passStatus: row.pass_status,
                submittedAt: row.submitted_at,
            };
        });
    }
    async areaNames() {
        const structure = await this.courseStructure.get();
        if (this.namesCache?.builtAt === structure.builtAt)
            return this.namesCache.names;
        const names = {
            course: new Map(structure.courses.map((c) => [Number(c.id), String(c.course_title)])),
            subject: new Map(structure.subjects.map((s) => [Number(s.id), String(s.topic_name)])),
            topic: new Map(structure.topics.map((t) => [Number(t.id), String(t.subtopic_name)])),
            lessonSubject: new Map(structure.lessons.map((l) => [Number(l.id), Number(l.topic_id) || 0])),
        };
        this.namesCache = { builtAt: structure.builtAt, names };
        return names;
    }
    async activeQuizCount() {
        return (await this.studentCatalogue.get()).quizCount;
    }
    shiftDayKey(key, days) {
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d + days));
        return date.toISOString().slice(0, 10);
    }
    async recordStudentActivity(authorization, dto) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        if (dto.activityType === 'practice_completed') {
            await this.studyStats.ensureBuilt(student.id);
            const day = study_stats_service_1.StudyStatsService.todayKey();
            const w = (0, progress_write_1.progressWrite)(day, { practices: (0, progress_write_1.takeRideAlong)() });
            if (w.seq.params.length)
                await this.db.execute(`UPDATE student_study_summary SET ${w.streak.sql}, ${w.pay.sql}, ${w.seq.sql} WHERE user_id = ?`, [...w.streak.params, ...w.pay.params, ...w.seq.params, student.id]);
        }
        if (dto.activityType.endsWith('_protection_attempt')) {
            console.warn(JSON.stringify({
                event: 'content_protection_attempt',
                userId: student.id,
                activityType: dto.activityType,
                itemId: dto.itemId ?? null,
                eventType: dto.eventType || '',
            }));
        }
        return { ok: true };
    }
    buildStudentPerformanceSnapshot({ totalAttempts, averagePercentage, passRate, quizDayStreak, dailyGoalsCompleted, dailyGoalsTotal, performanceWindows, }) {
        const last7 = performanceWindows.find((row) => row.window_key === 'last_7');
        const previous7 = performanceWindows.find((row) => row.window_key === 'previous_7');
        const last7Attempts = Number(last7?.attempts_count || 0);
        const previous7Attempts = Number(previous7?.attempts_count || 0);
        const last7Average = Number(last7?.average_percentage || 0);
        const previous7Average = Number(previous7?.average_percentage || 0);
        const scoreDelta = previous7Attempts > 0
            ? Math.round(last7Average - previous7Average)
            : last7Attempts > 0 ? Math.round(last7Average) : 0;
        const goalCompletionRate = dailyGoalsTotal > 0 ? dailyGoalsCompleted / dailyGoalsTotal : 0;
        const readinessScore = totalAttempts === 0
            ? 0
            : Math.round(Math.min(100, Math.max(0, averagePercentage * 0.5 +
                passRate * 0.25 +
                Math.min(quizDayStreak, 7) * 3 +
                goalCompletionRate * 20)));
        return {
            windowLabel: 'Last 7 days',
            comparisonLabel: 'Previous 7 days',
            dateRangeLabel: 'Server calendar: last 7 days',
            sourceLabel: 'Submitted quiz attempts',
            emptyState: 'No submitted quiz attempts in this window yet.',
            readinessScore,
            readinessLabel: readinessScore >= 75 ? 'Ready to advance' :
                readinessScore >= 50 ? 'Building steadily' :
                    totalAttempts > 0 ? 'Focus review recommended' : 'Baseline not set',
            weeklyAttempts: last7Attempts,
            weeklyAverage: Number(last7Average.toFixed(2)),
            previousWeeklyAverage: Number(previous7Average.toFixed(2)),
            scoreDelta,
            scoreTrend: previous7Attempts === 0
                ? last7Attempts > 0 ? 'new' : 'empty'
                : scoreDelta > 3 ? 'up'
                    : scoreDelta < -3 ? 'down'
                        : 'steady',
            trendLabel: previous7Attempts === 0
                ? last7Attempts > 0 ? 'New activity this week' : 'No quiz activity yet'
                : scoreDelta > 3 ? `+${scoreDelta} pts vs last week`
                    : scoreDelta < -3 ? `${scoreDelta} pts vs last week`
                        : 'Stable vs last week',
            consistencyLabel: quizDayStreak >= 5 ? 'Excellent consistency' :
                quizDayStreak >= 2 ? 'Momentum building' :
                    last7Attempts > 0 ? 'Keep the rhythm going' : 'Start today',
        };
    }
    buildServerClock(now) {
        return {
            nowIso: now.toISOString(),
            dateKey: this.formatDateKey(now),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'server-local',
            source: 'api-server',
        };
    }
    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    buildCourseProgressSummary(courses) {
        const completedLessons = courses.reduce((sum, course) => sum + Number(course.completedLessonsCount || 0), 0);
        const totalLessons = courses.reduce((sum, course) => sum + Number(course.totalLessonsCount || 0), 0);
        const overallProgressPercent = totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;
        return {
            visibleCourses: courses.length,
            completedLessons,
            totalLessons,
            overallProgressPercent,
            sourceLabel: 'Course lesson progress',
        };
    }
    buildStudentAdaptivePlan({ totalAttempts, weakestTopic, recommendedNoteTitle, todayQuizCount, todayNoteCount, todayResultViewCount, }) {
        if (totalAttempts === 0) {
            return [
                {
                    key: 'baseline',
                    title: 'Set your baseline',
                    description: 'Take one practice quiz so the LMS can start personalizing your revision.',
                    actionType: 'quiz',
                    status: todayQuizCount > 0 ? 'done' : 'next',
                },
                {
                    key: 'first-review',
                    title: 'Review immediately',
                    description: 'Open the result after your first quiz and mark the questions that felt uncertain.',
                    actionType: 'results',
                    status: todayResultViewCount > 0 ? 'done' : 'queued',
                },
                {
                    key: 'lesson-primer',
                    title: recommendedNoteTitle || 'Read one lesson',
                    description: 'Pair quiz practice with one short lesson review to make the first score useful.',
                    actionType: 'note',
                    status: todayNoteCount > 0 ? 'done' : 'queued',
                },
            ];
        }
        return [
            {
                key: 'weak-topic-practice',
                title: weakestTopic ? `Practice ${weakestTopic.topicName}` : 'Practice your next quiz',
                description: weakestTopic
                    ? `${weakestTopic.courseTitle} is the clearest place to gain points right now.`
                    : 'Keep your quiz rhythm active with one focused practice session.',
                actionType: 'quiz',
                status: todayQuizCount > 0 ? 'done' : 'next',
            },
            {
                key: 'lesson-review',
                title: weakestTopic ? `Review ${weakestTopic.topicName}` : recommendedNoteTitle || 'Review one lesson',
                description: todayNoteCount > 0
                    ? 'Lesson review is already logged today. Use the next step for recall.'
                    : 'Read the matching lesson before repeating questions from memory.',
                actionType: 'note',
                status: todayNoteCount > 0 ? 'done' : 'next',
            },
            {
                key: 'result-loop',
                title: 'Close the feedback loop',
                description: 'Open your latest result and compare missed questions with the lesson notes.',
                actionType: 'results',
                status: todayResultViewCount > 0 || todayQuizCount > 0 ? 'done' : 'queued',
            },
        ];
    }
    async getRandomDashboardQuestion(studentId, appClient) {
        const client = (0, mobile_client_util_1.isMobileAppClient)(appClient) ? 'app' : 'web';
        const today = new Date();
        const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const key = `${dayKey}:${studentId}:${client}`;
        const now = Date.now();
        const cached = this.questionOfDayCache.get(key);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        const running = this.questionOfDayInflight.get(key);
        if (running) {
            return running;
        }
        const task = this.computeRandomDashboardQuestion(studentId, appClient)
            .then((value) => {
            if (this.questionOfDayCache.size > 5000) {
                for (const [k, entry] of this.questionOfDayCache) {
                    if (entry.expiresAt <= Date.now())
                        this.questionOfDayCache.delete(k);
                }
            }
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            this.questionOfDayCache.set(key, { value, expiresAt: midnight.getTime() });
            return value;
        })
            .finally(() => this.questionOfDayInflight.delete(key));
        this.questionOfDayInflight.set(key, task);
        return task;
    }
    async getWebQuestionPool() {
        const cached = this.webQuestionPoolCache;
        if (cached && cached.expiresAt > Date.now())
            return cached.ids;
        if (this.webQuestionPoolInflight)
            return this.webQuestionPoolInflight;
        const task = this.db.execute(`SELECT DISTINCT q.id
       FROM quizzes free_quiz
       -- STRAIGHT_JOIN keeps this order (free quizzes first). Left to itself the
       -- optimizer started from questions and checked the whole bank.
       STRAIGHT_JOIN question_quizzes qqf ON qqf.quiz_id = free_quiz.id
       STRAIGHT_JOIN questions q ON q.id = qqf.question_id
       WHERE free_quiz.status = 'active' AND free_quiz.is_free = 1
         AND ${DashboardService_1.DASHBOARD_QUESTION_ELIGIBLE}
       ORDER BY q.id ASC`)
            .then(([rows]) => {
            const ids = rows.map((row) => Number(row.id));
            this.webQuestionPoolCache = { ids, expiresAt: Date.now() + DashboardService_1.WEB_QUESTION_POOL_TTL_MS };
            return ids;
        })
            .finally(() => {
            this.webQuestionPoolInflight = null;
        });
        this.webQuestionPoolInflight = task;
        return task;
    }
    async appQuestionIdRange() {
        const version = await (0, content_version_1.getContentVersion)(this.db);
        if (this.questionIdRange?.version === version)
            return this.questionIdRange;
        const [[range]] = await this.db.execute(`SELECT MIN(id) AS min_id, MAX(id) AS max_id FROM questions`);
        this.questionIdRange = { version, min: Number(range?.min_id || 0), max: Number(range?.max_id || 0) };
        return this.questionIdRange;
    }
    async computeAppQuestion(studentId) {
        const { min, max } = await this.appQuestionIdRange();
        if (!min || !max)
            return null;
        let from = min + this.getDashboardQuestionOffset(studentId, max - min + 1);
        let wrapped = false;
        for (let tries = 0; tries < 6; tries += 1) {
            const [rows] = await this.db.execute(`SELECT id, question_text, question_type, course_id, topic_id, subtopic_id, options_json
           FROM questions FORCE INDEX (idx_questions_status_type_id)
          WHERE status = 'active' AND question_type = 'sba' AND id >= ?
          ORDER BY id ASC
          LIMIT 1`, [from]);
            const question = rows[0];
            if (!question) {
                if (wrapped)
                    return null;
                wrapped = true;
                from = min;
                continue;
            }
            const options = (0, question_content_1.optionsOf)(Number(question.id), question.options_json);
            const correct = options.filter((o) => o.is_correct === 1).length;
            if (options.length !== 5 || correct !== 1) {
                from = Number(question.id) + 1;
                continue;
            }
            const names = await this.areaNames();
            return {
                id: Number(question.id),
                questionType: question.question_type,
                questionText: question.question_text,
                courseTitle: names.course.get(Number(question.course_id)) || '',
                subjectName: names.subject.get(Number(question.topic_id)) || '',
                topicName: names.topic.get(Number(question.subtopic_id)) || names.subject.get(Number(question.topic_id)) || '',
                options: options.map((o) => ({
                    id: Number(o.id),
                    optionLabel: String(o.option_label ?? ''),
                    optionText: String(o.option_text ?? ''),
                    isCorrect: Number(o.is_correct) === 1,
                })),
            };
        }
        return null;
    }
    async computeRandomDashboardQuestion(studentId, appClient) {
        if ((0, mobile_client_util_1.isMobileAppClient)(appClient)) {
            return this.computeAppQuestion(studentId);
        }
        const pool = await this.getWebQuestionPool();
        const pickedId = pool.length ? pool[this.getDashboardQuestionOffset(studentId, pool.length)] : null;
        if (!pickedId) {
            return null;
        }
        const [questionRows] = await this.db.execute(`SELECT
         q.id,
         q.question_text,
         q.question_type,
         c.course_title,
         subj.topic_name AS subject_name,
         sub.subtopic_name AS topic_name,
         q.options_json
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics subj ON subj.id = q.topic_id
       LEFT JOIN subtopics sub ON sub.id = q.subtopic_id
       WHERE q.id = ?
       LIMIT 1`, [pickedId]);
        const question = questionRows[0];
        if (!question) {
            return null;
        }
        const optionRows = (0, question_content_1.optionsOf)(Number(question.id), question.options_json);
        return {
            id: Number(question.id),
            questionType: question.question_type,
            questionText: question.question_text,
            courseTitle: question.course_title || '',
            subjectName: question.subject_name || '',
            topicName: question.topic_name || question.subject_name || '',
            options: optionRows.map((option) => ({
                id: Number(option.id),
                optionLabel: option.option_label,
                optionText: option.option_text,
                isCorrect: Number(option.is_correct) === 1,
            })),
        };
    }
    getDashboardQuestionOffset(studentId, totalQuestions) {
        const today = new Date();
        const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const seed = (0, node_crypto_1.createHash)('sha256').update(`${dayKey}:${studentId}`).digest('hex').slice(0, 12);
        return parseInt(seed, 16) % totalQuestions;
    }
    extractToken(authorization) {
        const token = (0, auth_token_util_1.extractBearerToken)(authorization);
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing');
        }
        return token;
    }
    async findActiveStudentByToken(sessionToken) {
        if ((0, access_token_1.looksLikeAccessToken)(sessionToken)) {
            const user = (0, token_user_1.userFromAccessToken)(sessionToken);
            if (user.role !== 'student')
                throw new common_1.UnauthorizedException('Student access required');
            if (user.status !== 'active')
                throw new common_1.UnauthorizedException('Your student account is not active yet');
            return user;
        }
        const [rows] = await this.db.execute(`SELECT id, role, status, full_name
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(sessionToken)]);
        const user = rows[0];
        if (!user || user.role !== 'student') {
            throw new common_1.UnauthorizedException('Student access required');
        }
        if (user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your student account is not active yet');
        }
        return user;
    }
    calculateQuizDayStreak(days, todayKey) {
        const keys = days
            .filter(Boolean)
            .map((day) => this.normalizeDateKey(day))
            .filter(Boolean);
        return (0, streak_1.computeStreak)(keys, todayKey || this.localDateKey(new Date()));
    }
    localDateKey(d) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
    }
    normalizeDateKey(day) {
        if (day instanceof Date) {
            return this.localDateKey(day);
        }
        return String(day).slice(0, 10);
    }
    classifyTopicMastery(averagePercentage) {
        if (averagePercentage >= 75) {
            return {
                mastery: 'strong',
                masteryLabel: 'Strong',
                masteryNote: 'Mostly right answers across your recent questions.',
            };
        }
        if (averagePercentage >= 50) {
            return {
                mastery: 'improving',
                masteryLabel: 'Improving',
                masteryNote: 'Building consistency, but still worth revising.',
            };
        }
        return {
            mastery: 'weak',
            masteryLabel: 'Weak',
            masteryNote: 'Needs focused revision and more repetition.',
        };
    }
    getMasteryRank(mastery) {
        if (mastery === 'weak')
            return 0;
        if (mastery === 'improving')
            return 1;
        return 2;
    }
    getTopicKey(courseTitle, topicName) {
        return `${courseTitle.trim().toLowerCase()}::${topicName.trim().toLowerCase()}`;
    }
};
exports.DashboardService = DashboardService;
DashboardService.WEB_QUESTION_POOL_TTL_MS = 60 * 60 * 1000;
DashboardService.DASHBOARD_QUESTION_ELIGIBLE = `
       q.status = 'active'
         AND q.question_type = 'sba'
         AND ${(0, question_content_1.sqlOptionCount)('q')} = 5
         AND ${(0, question_content_1.sqlCorrectCount)('q')} = 1`;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        courses_service_1.CoursesService,
        xp_service_1.XpService,
        users_service_1.UsersService,
        subscriptions_service_1.SubscriptionsService,
        study_stats_service_1.StudyStatsService,
        course_structure_service_1.CourseStructureService,
        student_catalogue_service_1.StudentCatalogueService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map