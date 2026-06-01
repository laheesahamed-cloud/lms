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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_tokens_1 = require("../../database/database.tokens");
const auth_service_1 = require("../auth/auth.service");
const auth_token_util_1 = require("../auth/auth-token.util");
const courses_service_1 = require("../courses/courses.service");
let DashboardService = class DashboardService {
    constructor(db, authService, coursesService) {
        this.db = db;
        this.authService = authService;
        this.coursesService = coursesService;
    }
    async getAdminDashboard(authorization) {
        const admin = await this.authService.requireAdmin(authorization);
        const canViewLearnerPii = this.canViewLearnerPii(admin);
        const [summaryResult, userGrowthResult, courseGrowthResult, lessonGrowthResult, quizGrowthResult, questionGrowthResult, attemptResult, recentUsersResult, recentCoursesResult, recentLessonsResult, recentAttemptsResult,] = await Promise.all([
            this.db.query(`SELECT
          (SELECT COUNT(*) FROM users) AS users_count,
          (SELECT COUNT(*) FROM courses) AS courses_count,
          (SELECT COUNT(*) FROM topics) AS topics_count,
          (SELECT COUNT(*) FROM quizzes) AS quizzes_count,
          (SELECT COUNT(*) FROM questions) AS questions_count,
          (SELECT COUNT(*) FROM lessons) AS lessons_count`),
            this.db.query(`SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
         FROM users
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`),
            this.db.query(`SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
         FROM courses
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`),
            this.db.query(`SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
         FROM lessons
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`),
            this.db.query(`SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
         FROM quizzes
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`),
            this.db.query(`SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
         FROM questions
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`),
            this.db.query(`SELECT DATE(COALESCE(submitted_at, created_at)) AS day_key, COUNT(*) AS count_value
         FROM quiz_attempts
         WHERE COALESCE(submitted_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY DATE(COALESCE(submitted_at, created_at))
         ORDER BY DATE(COALESCE(submitted_at, created_at)) ASC`),
            this.db.query(`SELECT
           'user' AS item_type,
           id AS item_id,
           full_name AS title,
           email AS subtitle,
           status,
           created_at
         FROM users
         ORDER BY created_at DESC, id DESC
         LIMIT 4`),
            this.db.query(`SELECT
           'course' AS item_type,
           id AS item_id,
           course_title AS title,
           course_code AS subtitle,
           status,
           created_at
         FROM courses
         ORDER BY created_at DESC, id DESC
         LIMIT 4`),
            this.db.query(`SELECT
           'lesson' AS item_type,
           l.id AS item_id,
           l.lesson_title AS title,
           CONCAT_WS(' / ', c.course_title, t.topic_name, s.subtopic_name) AS subtitle,
           l.status,
           l.created_at
         FROM lessons l
         LEFT JOIN courses c ON c.id = l.course_id
         LEFT JOIN topics t ON t.id = l.topic_id
         LEFT JOIN subtopics s ON s.id = l.subtopic_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 4`),
            this.db.query(`SELECT
           'attempt' AS item_type,
           qa.id AS item_id,
           COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS title,
           CONCAT('Score ', qa.score, '/', qa.total_questions) AS subtitle,
           qa.pass_status AS status,
           COALESCE(qa.submitted_at, qa.created_at) AS created_at
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
         LIMIT 6`),
        ]);
        const [summaryRows] = summaryResult;
        const [userGrowthRows] = userGrowthResult;
        const [courseGrowthRows] = courseGrowthResult;
        const [lessonGrowthRows] = lessonGrowthResult;
        const [quizGrowthRows] = quizGrowthResult;
        const [questionGrowthRows] = questionGrowthResult;
        const [attemptRows] = attemptResult;
        const [recentUsers] = recentUsersResult;
        const [recentCourses] = recentCoursesResult;
        const [recentLessons] = recentLessonsResult;
        const [recentAttempts] = recentAttemptsResult;
        const summary = summaryRows[0];
        const totals = {
            users: Number(summary?.users_count || 0),
            courses: Number(summary?.courses_count || 0),
            subjects: Number(summary?.topics_count || 0),
            quizzes: Number(summary?.quizzes_count || 0),
            questions: Number(summary?.questions_count || 0),
            lessons: Number(summary?.lessons_count || 0),
        };
        const userSeries = this.buildDailySeries(userGrowthRows);
        const courseSeries = this.buildDailySeries(courseGrowthRows);
        const lessonSeries = this.buildDailySeries(lessonGrowthRows);
        const quizSeries = this.buildDailySeries(quizGrowthRows);
        const questionSeries = this.buildDailySeries(questionGrowthRows);
        const attemptSeries = this.buildDailySeries(attemptRows);
        const engagementScore = this.calculateAdminEngagementScore({
            attemptsSeries: attemptSeries,
            totals,
        });
        const recommendations = this.buildAdminRecommendations({
            totals,
            engagementScore,
            questionSeries,
            quizSeries,
            lessonSeries,
        });
        const aiInsights = this.buildAdminAiInsights({
            totals,
            userSeries,
            lessonSeries,
            questionSeries,
            quizSeries,
            attemptSeries,
            engagementScore,
        });
        const activityFeed = this.buildAdminActivityFeed([
            ...recentUsers,
            ...recentCourses,
            ...recentLessons,
            ...recentAttempts,
        ], canViewLearnerPii);
        return {
            totalUsers: Number(summary?.users_count || 0),
            totalCourses: Number(summary?.courses_count || 0),
            totalSubjects: Number(summary?.topics_count || 0),
            totalQuizzes: Number(summary?.quizzes_count || 0),
            totalQuestions: Number(summary?.questions_count || 0),
            totalLessons: Number(summary?.lessons_count || 0),
            engagementScore,
            generatedAt: new Date().toISOString(),
            analytics: {
                users: userSeries,
                courses: courseSeries,
                lessons: lessonSeries,
                quizzes: quizSeries,
                questions: questionSeries,
                attempts: attemptSeries,
            },
            aiInsights,
            recommendations,
            activityFeed,
            shortcuts: [
                { label: 'Courses', path: '/courses' },
                { label: 'Structure', path: '/structure' },
                { label: 'Lessons', path: '/structure' },
                { label: 'Questions', path: '/questions' },
                { label: 'Quizzes', path: '/quizzes' },
                { label: 'Users', path: '/users' },
            ],
        };
    }
    buildDailySeries(rows, totalDays = 90) {
        const valueMap = new Map((rows || []).map((row) => [String(row.day_key).slice(0, 10), Number(row.count_value || 0)]));
        const result = [];
        const anchor = new Date();
        anchor.setHours(0, 0, 0, 0);
        for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
            const current = new Date(anchor);
            current.setDate(anchor.getDate() - offset);
            const key = current.toISOString().slice(0, 10);
            result.push({
                date: key,
                value: Number(valueMap.get(key) || 0),
            });
        }
        return result;
    }
    calculateAdminEngagementScore({ attemptsSeries, totals, }) {
        const trailing14 = attemptsSeries.slice(-14);
        const totalAttempts = trailing14.reduce((sum, point) => sum + point.value, 0);
        const activeDays = trailing14.filter((point) => point.value > 0).length;
        const contentDensityBase = totals.courses + totals.lessons + totals.questions + totals.quizzes;
        const contentDensity = Math.min(100, Math.round((contentDensityBase / Math.max(1, totals.users + 5)) * 20));
        const attemptScore = Math.min(100, totalAttempts * 4);
        const consistencyScore = Math.min(100, activeDays * 7);
        return Math.max(24, Math.round((attemptScore * 0.45) + (consistencyScore * 0.35) + (contentDensity * 0.2)));
    }
    buildAdminRecommendations({ totals, engagementScore, questionSeries, quizSeries, lessonSeries, }) {
        const recentQuestions = questionSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
        const recentQuizzes = quizSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
        const recentLessons = lessonSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
        const recommendations = [
            {
                title: recentQuestions < Math.max(6, recentQuizzes * 3)
                    ? 'Expand the question bank before the next assessment push'
                    : 'Question supply is keeping pace with new quiz creation',
                detail: recentQuestions < Math.max(6, recentQuizzes * 3)
                    ? 'The last two weeks added fewer questions than the quiz pipeline needs. Focus on question authoring or bulk import.'
                    : 'The last two weeks show enough new questions to support active assessment growth.',
                actionLabel: recentQuestions < Math.max(6, recentQuizzes * 3) ? 'Open bulk question input' : 'Open question bank',
                actionPath: '/questions/bulk',
                tone: recentQuestions < Math.max(6, recentQuizzes * 3) ? 'warning' : 'positive',
            },
            {
                title: recentLessons < Math.max(2, totals.courses)
                    ? 'Course content expansion is lagging behind course count'
                    : 'Lesson production is healthy across the course catalog',
                detail: recentLessons < Math.max(2, totals.courses)
                    ? 'Add more lessons to keep each course academically dense and easier to monetize.'
                    : 'Lesson creation stayed active recently, which supports better learner retention.',
                actionLabel: recentLessons < Math.max(2, totals.courses) ? 'Open structure manager' : 'Open lessons',
                actionPath: recentLessons < Math.max(2, totals.courses) ? '/structure' : '/ai-notes',
                tone: recentLessons < Math.max(2, totals.courses) ? 'warning' : 'positive',
            },
            {
                title: engagementScore < 55
                    ? 'Engagement score suggests a reactivation cycle is needed'
                    : 'Engagement score indicates healthy learner motion',
                detail: engagementScore < 55
                    ? 'Lean on quizzes, content releases, and AI-generated materials to drive another usage wave.'
                    : 'Learner interaction is stable enough to support new course launches or premium content pushes.',
                actionLabel: engagementScore < 55 ? 'Generate new quiz' : 'Create new course',
                actionPath: engagementScore < 55 ? '/quizzes/new' : '/courses',
                tone: engagementScore < 55 ? 'warning' : 'positive',
            },
        ];
        return recommendations;
    }
    buildAdminAiInsights({ totals, userSeries, lessonSeries, questionSeries, quizSeries, attemptSeries, engagementScore, }) {
        const userTrend = this.calculateSeriesDelta(userSeries, 14);
        const contentTrend = this.calculateSeriesDelta(lessonSeries, 14);
        const assessmentTrend = this.calculateSeriesDelta(questionSeries, 14);
        const attemptTrend = this.calculateSeriesDelta(attemptSeries, 14);
        return [
            {
                id: 'users',
                label: 'Learner Growth',
                value: totals.users,
                delta: userTrend.delta,
                deltaLabel: userTrend.label,
                tone: userTrend.delta >= 0 ? 'positive' : 'warning',
                detail: userTrend.delta >= 0
                    ? 'User growth is trending upward, likely supported by fresh learning inventory and active assessments.'
                    : 'User growth has softened. Consider launching new course value or quiz campaigns.',
            },
            {
                id: 'content',
                label: 'Content Velocity',
                value: totals.lessons,
                delta: contentTrend.delta,
                deltaLabel: contentTrend.label,
                tone: contentTrend.delta >= 0 ? 'positive' : 'neutral',
                detail: contentTrend.delta >= 0
                    ? 'Lesson output increased recently, which should improve learner return frequency.'
                    : 'Lesson creation slowed in the latest period. AI-assisted content could accelerate the pipeline.',
            },
            {
                id: 'assessment',
                label: 'Assessment Supply',
                value: totals.questions,
                delta: assessmentTrend.delta,
                deltaLabel: assessmentTrend.label,
                tone: assessmentTrend.delta >= 0 ? 'positive' : 'warning',
                detail: assessmentTrend.delta >= 0
                    ? 'Question growth is supporting more quizzes and richer practice sets.'
                    : 'Question authoring is lagging. Use bulk add or AI quiz generation to close the gap.',
            },
            {
                id: 'engagement',
                label: 'Engagement Score',
                value: engagementScore,
                delta: attemptTrend.delta,
                deltaLabel: attemptTrend.label,
                tone: engagementScore >= 70 ? 'positive' : engagementScore >= 45 ? 'neutral' : 'warning',
                detail: engagementScore >= 70
                    ? 'Recent attempt activity suggests a strong usage rhythm across the LMS.'
                    : engagementScore >= 45
                        ? 'Engagement is stable but still has room for a sharper content or quiz cadence.'
                        : 'Platform engagement is low enough to justify proactive intervention this week.',
            },
            {
                id: 'forecast',
                label: '30-Day Forecast',
                value: totals.quizzes + Math.max(1, Math.round((quizSeries.slice(-30).reduce((sum, point) => sum + point.value, 0) / 30) * 12)),
                delta: this.calculateSeriesDelta(quizSeries, 30).delta,
                deltaLabel: 'Projected active quiz inventory',
                tone: 'neutral',
                detail: 'Projected quiz inventory assumes the current publishing pace continues for the next month.',
            },
        ];
    }
    buildAdminActivityFeed(feedRows, canViewLearnerPii = false) {
        const typeMap = {
            user: { label: 'New user', tone: 'blue' },
            course: { label: 'Course update', tone: 'violet' },
            lesson: { label: 'Lesson published', tone: 'teal' },
            attempt: { label: 'Quiz submission', tone: 'amber' },
        };
        return [...feedRows]
            .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
            .slice(0, 12)
            .map((row) => {
            const isLearnerRow = row.item_type === 'user';
            return {
                id: `${row.item_type}-${row.item_id}`,
                type: row.item_type,
                typeLabel: typeMap[row.item_type]?.label || 'Activity',
                tone: typeMap[row.item_type]?.tone || 'blue',
                title: isLearnerRow && !canViewLearnerPii ? this.anonymizedLearnerRef(row.item_id) : row.title || 'Untitled item',
                subtitle: isLearnerRow && !canViewLearnerPii ? '' : row.subtitle || '',
                status: row.status || '',
                createdAt: row.created_at || null,
            };
        });
    }
    canViewLearnerPii(user) {
        return user.role === 'admin' || Boolean(user.permissions?.includes('students.manage'));
    }
    anonymizedLearnerRef(value) {
        const digest = (0, node_crypto_1.createHash)('sha256')
            .update(`learner:${String(value || '')}`)
            .digest('hex')
            .slice(0, 10)
            .toUpperCase();
        return `Learner ${digest}`;
    }
    calculateSeriesDelta(series, windowSize) {
        const currentWindow = series.slice(-windowSize);
        const previousWindow = series.slice(-windowSize * 2, -windowSize);
        const currentTotal = currentWindow.reduce((sum, point) => sum + point.value, 0);
        const previousTotal = previousWindow.reduce((sum, point) => sum + point.value, 0);
        const delta = previousTotal > 0
            ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
            : currentTotal > 0 ? 100 : 0;
        const label = delta > 0 ? `+${delta}% vs previous period` : `${delta}% vs previous period`;
        return { delta, label };
    }
    async getStudentDashboard(authorization) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const serverNow = new Date();
        const serverClock = this.buildServerClock(serverNow);
        const [summaryResult, recentAttemptsResult, topicRowsResult, smartNotesResult, attemptDaysResult, performanceWindowsResult, missedPatternsResult, todayQuizRowsResult, todayNoteRowsResult, questionOfDay, courseProgress,] = await Promise.all([
            this.db.execute(`SELECT
          (SELECT COUNT(*) FROM quizzes WHERE status = 'active') AS total_quizzes,
          (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ?) AS total_attempts,
          (SELECT AVG(percentage) FROM quiz_attempts WHERE user_id = ? AND status = 'submitted') AS average_percentage,
          (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ? AND pass_status = 'pass') AS total_passed,
          (SELECT COUNT(*) FROM smart_notes WHERE user_id = ?) AS total_smart_notes,
          (SELECT COUNT(*) FROM smart_notes WHERE user_id = ? AND (JSON_LENGTH(infographic_elements) > 0 OR representative_image_data IS NOT NULL)) AS generated_smart_notes`, [student.id, student.id, student.id, student.id, student.id]),
            this.db.execute(`SELECT
          qa.id,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          c.course_title,
          t.topic_name,
          qa.score,
          qa.total_questions,
          qa.percentage,
          qa.pass_status,
          qa.submitted_at
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        LEFT JOIN courses c ON c.id = q.course_id
        LEFT JOIN topics t ON t.id = q.topic_id
        WHERE qa.user_id = ?
        ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
        LIMIT 5`, [student.id]),
            this.db.execute(`SELECT
          t.topic_name,
          c.course_title,
          AVG(qa.percentage) AS average_percentage,
          COUNT(*) AS attempts_count
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        LEFT JOIN topics t ON t.id = q.topic_id
        LEFT JOIN courses c ON c.id = q.course_id
        WHERE qa.user_id = ? AND qa.status = 'submitted'
        GROUP BY q.topic_id, t.topic_name, c.course_title
        HAVING attempts_count > 0
        ORDER BY average_percentage ASC, attempts_count DESC`, [student.id]),
            this.db.execute(`SELECT
          id,
          title,
          updated_at,
          CASE
            WHEN (JSON_LENGTH(infographic_elements) > 0 OR representative_image_data IS NOT NULL) THEN 1
            ELSE 0
          END AS has_visual
        FROM smart_notes
        WHERE user_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 3`, [student.id]),
            this.db.execute(`SELECT DISTINCT DATE(COALESCE(submitted_at, created_at)) AS attempt_day
         FROM quiz_attempts
         WHERE user_id = ? AND status = 'submitted'
         ORDER BY attempt_day DESC`, [student.id]),
            this.db.execute(`SELECT
           CASE
             WHEN DATE(COALESCE(submitted_at, created_at)) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN 'last_7'
             ELSE 'previous_7'
           END AS window_key,
           COUNT(*) AS attempts_count,
           AVG(percentage) AS average_percentage
         FROM quiz_attempts
         WHERE user_id = ?
           AND status = 'submitted'
           AND DATE(COALESCE(submitted_at, created_at)) >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
         GROUP BY window_key`, [student.id]),
            this.db.execute(`SELECT
           c.course_title,
           subj.topic_name AS subject_name,
           sub.subtopic_name AS topic_name,
           l.lesson_title,
           qn.question_type,
           COUNT(*) AS miss_count,
           MAX(COALESCE(qa.submitted_at, qa.created_at)) AS latest_missed_at
         FROM student_answers sa
         INNER JOIN quiz_attempts qa ON qa.id = sa.attempt_id
         INNER JOIN questions qn ON qn.id = sa.question_id
         INNER JOIN question_options qo ON qo.id = sa.option_id
         LEFT JOIN courses c ON c.id = qn.course_id
         LEFT JOIN topics subj ON subj.id = qn.topic_id
         LEFT JOIN subtopics sub ON sub.id = qn.subtopic_id
         LEFT JOIN lessons l ON l.id = qn.lesson_id
         WHERE qa.user_id = ?
           AND qa.status = 'submitted'
           AND COALESCE(qa.submitted_at, qa.created_at) >= DATE_SUB(NOW(), INTERVAL 45 DAY)
           AND (
             (qn.question_type = 'sba' AND sa.is_selected = 1 AND qo.is_correct = 0)
             OR (qn.question_type = 'true_false' AND sa.is_selected <> qo.is_correct)
           )
         GROUP BY c.course_title, subj.topic_name, sub.subtopic_name, l.lesson_title, qn.question_type
         ORDER BY miss_count DESC, latest_missed_at DESC
         LIMIT 5`, [student.id]),
            this.db.execute(`SELECT q.id, c.course_title, t.topic_name
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         LEFT JOIN courses c ON c.id = q.course_id
         LEFT JOIN topics t ON t.id = q.topic_id
         WHERE qa.user_id = ?
           AND qa.status = 'submitted'
           AND DATE(COALESCE(qa.submitted_at, qa.created_at)) = CURDATE()
         ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC`, [student.id]),
            this.db.execute(`SELECT DISTINCT
           n.id,
           c.course_title,
           t.topic_name
         FROM study_activity_events e
         INNER JOIN ai_illustrated_notes n ON n.id = e.item_id
         LEFT JOIN courses c ON c.id = n.course_id
         LEFT JOIN topics t ON t.id = n.topic_id
         WHERE e.user_id = ?
           AND e.activity_type = 'ai_note_viewed'
           AND DATE(e.created_at) = CURDATE()
         ORDER BY n.id DESC`, [student.id]),
            this.getRandomDashboardQuestion(student.id),
            this.coursesService.findStudentCourses(authorization),
        ]);
        const [summaryRows] = summaryResult;
        const [recentAttempts] = recentAttemptsResult;
        const [topicRows] = topicRowsResult;
        const [smartNotes] = smartNotesResult;
        const [attemptDays] = attemptDaysResult;
        const [performanceWindows] = performanceWindowsResult;
        const [missedPatterns] = missedPatternsResult;
        const [todayQuizRows] = todayQuizRowsResult;
        const [todayNoteRows] = todayNoteRowsResult;
        const summary = summaryRows[0];
        const courseProgressSummary = this.buildCourseProgressSummary(courseProgress);
        const totalAttempts = Number(summary?.total_attempts || 0);
        const totalPassed = Number(summary?.total_passed || 0);
        const averagePercentage = Number(summary?.average_percentage || 0);
        const passRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : 0;
        const quizDayStreak = this.calculateQuizDayStreak(attemptDays.map((row) => row.attempt_day));
        const insights = topicRows
            .filter((row) => row.topic_name)
            .map((row) => ({
            topicName: row.topic_name || 'General',
            courseTitle: row.course_title || 'General',
            averagePercentage: Number(row.average_percentage || 0),
            attemptsCount: Number(row.attempts_count || 0),
        }));
        const weakTopics = [...insights].sort((a, b) => a.averagePercentage - b.averagePercentage).slice(0, 3);
        const weakTopicKeys = new Set(weakTopics.map((topic) => this.getTopicKey(topic.courseTitle, topic.topicName)));
        const strongTopics = [...insights]
            .filter((topic) => !weakTopicKeys.has(this.getTopicKey(topic.courseTitle, topic.topicName)))
            .sort((a, b) => b.averagePercentage - a.averagePercentage)
            .slice(0, 3);
        const topicMastery = [...insights]
            .sort((a, b) => {
            const masteryRankDiff = this.getMasteryRank(this.classifyTopicMastery(a.averagePercentage, a.attemptsCount).mastery)
                - this.getMasteryRank(this.classifyTopicMastery(b.averagePercentage, b.attemptsCount).mastery);
            if (masteryRankDiff !== 0) {
                return masteryRankDiff;
            }
            if (a.averagePercentage !== b.averagePercentage) {
                return a.averagePercentage - b.averagePercentage;
            }
            return b.attemptsCount - a.attemptsCount;
        })
            .slice(0, 6)
            .map((topic) => ({
            ...topic,
            ...this.classifyTopicMastery(topic.averagePercentage, topic.attemptsCount),
        }));
        const focusTopic = weakTopics[0]?.topicName || 'Start your first quiz';
        const focusCourse = weakTopics[0]?.courseTitle || 'No course data yet';
        const weakestTopic = weakTopics[0] || null;
        const weakestTopicReviewedToday = Boolean(weakestTopic &&
            (todayQuizRows.some((row) => String(row.course_title || '').trim() === String(weakestTopic.courseTitle || '').trim() &&
                String(row.topic_name || '').trim() === String(weakestTopic.topicName || '').trim()) ||
                todayNoteRows.some((row) => String(row.course_title || '').trim() === String(weakestTopic.courseTitle || '').trim() &&
                    String(row.topic_name || '').trim() === String(weakestTopic.topicName || '').trim())));
        const dailyGoals = [
            {
                key: 'quiz_today',
                title: 'Complete 1 quiz today',
                description: 'Build momentum by submitting at least one quiz attempt.',
                completed: todayQuizRows.length >= 1,
                progressText: `${Math.min(todayQuizRows.length, 1)}/1 done`,
            },
            {
                key: 'note_today',
                title: 'Review 1 lesson today',
                description: 'Open one lesson and revise a concept intentionally.',
                completed: todayNoteRows.length >= 1,
                progressText: `${Math.min(todayNoteRows.length, 1)}/1 done`,
            },
            {
                key: 'weak_topic_today',
                title: weakestTopic ? `Revisit ${weakestTopic.topicName}` : 'Revisit a weak topic',
                description: weakestTopic
                    ? `Focus on your weakest topic in ${weakestTopic.courseTitle}.`
                    : 'Complete more quizzes to unlock weak-topic targeting.',
                completed: weakestTopic ? weakestTopicReviewedToday : false,
                progressText: weakestTopic ? `${weakestTopicReviewedToday ? 1 : 0}/1 done` : 'Locked',
            },
        ];
        const completedGoals = dailyGoals.filter((goal) => goal.completed).length;
        const performanceSnapshot = this.buildStudentPerformanceSnapshot({
            totalAttempts,
            averagePercentage,
            passRate,
            quizDayStreak,
            dailyGoalsCompleted: completedGoals,
            dailyGoalsTotal: dailyGoals.length,
            performanceWindows,
        });
        const adaptivePlan = this.buildStudentAdaptivePlan({
            totalAttempts,
            weakestTopic,
            recommendedNoteTitle: smartNotes[0]?.title || '',
            todayQuizCount: todayQuizRows.length,
            todayNoteCount: todayNoteRows.length,
        });
        return {
            user: {
                id: student.id,
                fullName: student.full_name || '',
            },
            serverClock,
            totalQuizzes: Number(summary?.total_quizzes || 0),
            totalCourses: courseProgress.length,
            totalAttempts,
            quizDayStreak,
            avgScore: Number(averagePercentage.toFixed(2)),
            totalPassed,
            passRate: Number(passRate.toFixed(2)),
            totalSmartNotes: Number(summary?.total_smart_notes || 0),
            generatedSmartNotes: Number(summary?.generated_smart_notes || 0),
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
            courseProgressSummary,
            recentAttempts: recentAttempts.map((row) => ({
                id: row.id,
                quizTitle: row.quiz_title,
                courseTitle: row.course_title || '',
                topicName: row.topic_name || '',
                score: row.score,
                totalQuestions: row.total_questions,
                percentage: Number(row.percentage || 0),
                passStatus: row.pass_status,
                submittedAt: row.submitted_at,
            })),
            recentSmartNotes: smartNotes.map((row) => ({
                id: row.id,
                title: row.title,
                updatedAt: row.updated_at,
                hasVisual: Boolean(row.has_visual),
            })),
            topicMastery,
            weakTopics,
            strongTopics,
            dailyGoals,
            dailyGoalsCompleted: completedGoals,
            focusTopic,
            focusCourse,
            performanceSnapshot,
            adaptivePlan,
            questionOfDay,
            missedPatterns: missedPatterns.map((row) => ({
                courseTitle: row.course_title || 'General',
                subjectName: row.subject_name || '',
                topicName: row.topic_name || row.subject_name || 'General',
                lessonTitle: row.lesson_title || '',
                questionType: row.question_type,
                missCount: Number(row.miss_count || 0),
                latestMissedAt: row.latest_missed_at,
                patternLabel: row.question_type === 'true_false' ? 'True/false accuracy' : 'Answer selection',
            })),
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
    async recordStudentActivity(authorization, dto) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        await this.db.execute('INSERT INTO study_activity_events (user_id, activity_type, item_id, event_type) VALUES (?, ?, ?, ?)', [student.id, dto.activityType, dto.itemId ?? null, dto.eventType || null]);
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
    buildStudentAdaptivePlan({ totalAttempts, weakestTopic, recommendedNoteTitle, todayQuizCount, todayNoteCount, }) {
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
                    status: 'queued',
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
                status: todayQuizCount > 0 ? 'next' : 'queued',
            },
        ];
    }
    async getRandomDashboardQuestion(studentId) {
        const eligibleQuestionWhere = `
       q.status = 'active'
         AND q.question_type = 'sba'
         AND (
           SELECT COUNT(*)
           FROM question_options qo
           WHERE qo.question_id = q.id
         ) = 5
         AND (
           SELECT COUNT(*)
           FROM question_options qo
           WHERE qo.question_id = q.id
             AND qo.is_correct = 1
         ) = 1`;
        const [[countRow]] = await this.db.execute(`SELECT COUNT(*) AS total_questions
       FROM questions q
       WHERE ${eligibleQuestionWhere}`);
        const totalQuestions = Number(countRow?.total_questions || 0);
        if (totalQuestions <= 0) {
            return null;
        }
        const offset = this.getDashboardQuestionOffset(studentId, totalQuestions);
        const [questionRows] = await this.db.execute(`SELECT
         q.id,
         q.question_text,
         q.question_type,
         c.course_title,
         subj.topic_name AS subject_name,
         sub.subtopic_name AS topic_name
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics subj ON subj.id = q.topic_id
       LEFT JOIN subtopics sub ON sub.id = q.subtopic_id
       WHERE ${eligibleQuestionWhere}
       ORDER BY q.id ASC
       LIMIT 1 OFFSET ?`, [offset]);
        const question = questionRows[0];
        if (!question) {
            return null;
        }
        const [optionRows] = await this.db.execute(`SELECT id, question_id, option_label, option_text, is_correct
       FROM question_options
       WHERE question_id = ?
       ORDER BY option_label ASC, id ASC`, [question.id]);
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
    calculateQuizDayStreak(days) {
        if (!days.length) {
            return 0;
        }
        const normalizedDays = [
            ...new Set(days
                .filter(Boolean)
                .map((day) => this.normalizeDateKey(day))
                .filter(Boolean)),
        ].sort((a, b) => b.localeCompare(a));
        if (!normalizedDays.length) {
            return 0;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestAttemptDay = new Date(`${normalizedDays[0]}T00:00:00`);
        latestAttemptDay.setHours(0, 0, 0, 0);
        const msPerDay = 24 * 60 * 60 * 1000;
        const gapFromToday = Math.floor((today.getTime() - latestAttemptDay.getTime()) / msPerDay);
        if (gapFromToday > 1) {
            return 0;
        }
        let streak = 1;
        let previousDay = latestAttemptDay;
        for (let index = 1; index < normalizedDays.length; index += 1) {
            const currentDay = new Date(`${normalizedDays[index]}T00:00:00`);
            currentDay.setHours(0, 0, 0, 0);
            const diff = Math.floor((previousDay.getTime() - currentDay.getTime()) / msPerDay);
            if (diff === 1) {
                streak += 1;
                previousDay = currentDay;
                continue;
            }
            break;
        }
        return streak;
    }
    normalizeDateKey(day) {
        if (day instanceof Date) {
            return day.toISOString().slice(0, 10);
        }
        return String(day).slice(0, 10);
    }
    classifyTopicMastery(averagePercentage, attemptsCount) {
        if (attemptsCount >= 3 && averagePercentage >= 75) {
            return {
                mastery: 'strong',
                masteryLabel: 'Strong',
                masteryNote: 'Reliable scores across repeated attempts.',
            };
        }
        if (averagePercentage >= 50 || attemptsCount >= 2) {
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
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        courses_service_1.CoursesService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map