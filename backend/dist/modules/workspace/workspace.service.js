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
exports.WorkspaceService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_service_1 = require("../auth/auth.service");
const push_notifications_service_1 = require("../push-notifications/push-notifications.service");
const PLANNER_TASK_CATEGORIES = ['general', 'lesson', 'quiz', 'exam', 'review', 'flashcards'];
const PLANNER_TASK_PRIORITIES = ['low', 'medium', 'high'];
const ADMIN_REPORT_FILTER_COLUMNS = [
    'COALESCE(qa.submitted_at, qa.created_at)',
    'qa.user_id',
    'q.course_id',
    'slp.updated_at',
    'slp.user_id',
    'slp.course_id',
    'sae.created_at',
    'sae.user_id',
    'COALESCE(q.course_id, quiz.course_id)',
    'u.id',
    'c.id',
    'us.updated_at',
    'us.user_id',
    'pt.created_at',
    'pt.user_id',
];
let WorkspaceService = class WorkspaceService {
    constructor(db, authService, pushNotificationsService) {
        this.db = db;
        this.authService = authService;
        this.pushNotificationsService = pushNotificationsService;
    }
    async listAdminAnnouncements(authorization) {
        await this.authService.requireAdmin(authorization);
        const [rows] = await this.db.execute(`
      SELECT a.*, u.full_name AS created_by_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
        return rows.map((row) => this.mapAnnouncement(row));
    }
    async createAnnouncement(authorization, input) {
        const admin = await this.authService.requireAdmin(authorization);
        const payload = this.normalizeAnnouncementInput(input);
        const [result] = await this.db.execute(`INSERT INTO announcements (title, body, target_role, status, publish_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`, [payload.title, payload.body, payload.targetRole, payload.status, payload.publishAt, admin.id]);
        if (payload.status === 'published' && !payload.publishAt) {
            this.pushNotificationsService.sendAnnouncementPush({
                title: payload.title,
                body: payload.body,
                targetRole: payload.targetRole,
                url: '/notifications',
            }).catch((error) => {
                console.warn(`Announcement push failed: ${error?.message || error}`);
            });
        }
        return { ok: true, id: result.insertId };
    }
    async updateAnnouncement(authorization, id, input) {
        await this.authService.requireAdmin(authorization);
        const payload = this.normalizeAnnouncementInput(input);
        await this.db.execute(`UPDATE announcements SET title = ?, body = ?, target_role = ?, status = ?, publish_at = ? WHERE id = ?`, [payload.title, payload.body, payload.targetRole, payload.status, payload.publishAt, id]);
        return { ok: true, id };
    }
    async deleteAnnouncement(authorization, id) {
        await this.authService.requireAdmin(authorization);
        await this.db.execute('DELETE FROM announcement_reads WHERE announcement_id = ?', [id]);
        await this.db.execute('DELETE FROM announcements WHERE id = ?', [id]);
        return { ok: true, id };
    }
    async listNotifications(authorization) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        const [rows] = await this.db.execute(`
        SELECT a.*, ar.id AS read_id
        FROM announcements a
        LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
        WHERE a.status = 'published'
          AND (a.publish_at IS NULL OR a.publish_at <= NOW())
          AND (a.target_role = 'all' OR a.target_role = ?)
        ORDER BY a.created_at DESC
        LIMIT 80
      `, [user.id, user.role]);
        const announcements = rows.map((row) => ({
            ...this.mapAnnouncement(row),
            kind: 'announcement',
            read: Boolean(row.read_id),
            actionPath: '',
        }));
        if (user.role !== 'student') {
            return announcements;
        }
        const [subscriptionRows] = await this.db.execute(`SELECT us.status, us.payment_status, us.end_date, p.name AS plan_name, us.updated_at
       FROM user_subscriptions us
       LEFT JOIN plans p ON p.id = us.plan_id
       WHERE us.user_id = ?
       ORDER BY us.updated_at DESC, us.id DESC
       LIMIT 3`, [user.id]);
        const [weakRows] = await this.db.execute(`SELECT t.topic_name, c.course_title, AVG(qa.percentage) AS average_percentage, MAX(COALESCE(qa.submitted_at, qa.created_at)) AS latest_at
       FROM quiz_attempts qa
       INNER JOIN quizzes q ON q.id = qa.quiz_id
       LEFT JOIN topics t ON t.id = q.topic_id
       LEFT JOIN courses c ON c.id = q.course_id
       WHERE qa.user_id = ? AND qa.status = 'submitted'
       GROUP BY q.topic_id, t.topic_name, c.course_title
       HAVING average_percentage < 55
       ORDER BY average_percentage ASC, latest_at DESC
       LIMIT 1`, [user.id]);
        const derived = [
            ...subscriptionRows.map((row) => {
                const isFreePlan = this.isFreePlanPaymentStatus(row.payment_status);
                return {
                    id: `subscription-${String(row.status)}-${String(row.updated_at)}`,
                    kind: 'subscription',
                    title: `${String(row.plan_name || 'Subscription')} ${String(row.status || 'updated')}`,
                    body: `Payment: ${this.formatPaymentStatusLabel(row.payment_status)}${!isFreePlan && row.end_date ? ` · Valid until ${String(row.end_date).slice(0, 10)}` : ''}`,
                    read: true,
                    createdAt: row.updated_at || null,
                    actionPath: '/subscriptions',
                };
            }),
            ...weakRows.map((row) => ({
                id: `weak-${String(row.course_title || '')}-${String(row.topic_name || '')}`,
                kind: 'weak-topic',
                title: `Review ${String(row.topic_name || 'a weak topic')}`,
                body: `${String(row.course_title || 'Course')} is averaging ${Number(row.average_percentage || 0).toFixed(1)}%. Add one focused practice round today.`,
                read: true,
                createdAt: row.latest_at || null,
                actionPath: '/dashboard',
            })),
        ];
        return [...announcements, ...derived]
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
            .slice(0, 80);
    }
    formatPaymentStatusLabel(value) {
        const status = String(value || '').trim().toLowerCase();
        if (this.isFreePlanPaymentStatus(status))
            return 'Free Plan';
        if (!status)
            return 'Manual';
        return status
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
    isFreePlanPaymentStatus(value) {
        const status = String(value || '').trim().toLowerCase();
        return status === 'waived' || status === 'free' || status === 'free_plan';
    }
    async markNotificationRead(authorization, id) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        await this.db.execute(`INSERT IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)`, [id, user.id]);
        return { ok: true, id };
    }
    async listPlannerTasks(authorization) {
        const student = await this.authService.requireStudent(authorization);
        const [rows] = await this.db.execute(`SELECT id, title, description, due_date, status, category, priority, estimated_minutes, created_at, updated_at
       FROM study_planner_tasks
       WHERE user_id = ?
       ORDER BY COALESCE(due_date, '9999-12-31') ASC, sort_order ASC, id DESC`, [student.id]);
        return rows.map((row) => this.mapPlannerTask(row));
    }
    async getPlannerAgenda(authorization) {
        const student = await this.authService.requireStudent(authorization);
        const today = this.todayDateKey();
        const quizAccessProfile = await this.getPlannerQuizAccessProfile(student.id);
        const [taskRows, lessonRows, quizRows, reviewRows] = await Promise.all([
            this.db.execute(`SELECT id, title, description, due_date, status, category, priority, estimated_minutes, created_at, updated_at
         FROM study_planner_tasks
         WHERE user_id = ?
         ORDER BY COALESCE(due_date, '9999-12-31') ASC, sort_order ASC, id DESC
         LIMIT 80`, [student.id]),
            this.db.execute(`SELECT
           slp.lesson_id,
           slp.status AS progress_status,
           slp.progress_percent,
           slp.started_at,
           slp.completed_at,
           slp.updated_at,
           l.lesson_title,
           c.course_title,
           subj.topic_name AS subject_name,
           sub.subtopic_name AS topic_name
         FROM student_lesson_progress slp
         INNER JOIN lessons l ON l.id = slp.lesson_id AND l.status = 'active'
         LEFT JOIN courses c ON c.id = l.course_id
         LEFT JOIN topics subj ON subj.id = l.topic_id
         LEFT JOIN subtopics sub ON sub.id = l.subtopic_id
         WHERE slp.user_id = ?
         ORDER BY FIELD(slp.status, 'in_progress', 'not_started', 'completed'), slp.updated_at DESC, slp.lesson_id DESC
         LIMIT 36`, [student.id]),
            this.db.execute(`SELECT
           q.id,
           q.course_id,
           q.is_free,
           q.exam_mode_only,
           COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
           q.total_questions,
           q.time_limit,
           q.created_at AS quiz_created_at,
           c.course_title,
           subj.topic_name AS subject_name,
           sub.subtopic_name AS topic_name,
           l.lesson_title,
           ps.id AS practice_session_id,
           ps.last_question_index,
           ps.updated_at AS practice_updated_at,
           (
             SELECT COUNT(DISTINCT pa.question_id)
             FROM practice_answers pa
             WHERE pa.practice_session_id = ps.id
           ) AS practice_answered_count,
           (
             SELECT COUNT(*)
             FROM practice_sessions cps
             WHERE cps.quiz_id = q.id
               AND cps.user_id = ?
               AND cps.status = 'completed'
           ) AS practice_completed_count,
           (
             SELECT COUNT(*)
             FROM quiz_attempts qa
             WHERE qa.quiz_id = q.id
               AND qa.user_id = ?
               AND qa.status = 'submitted'
           ) AS exam_attempt_count
         FROM quizzes q
         INNER JOIN courses c ON c.id = q.course_id
         LEFT JOIN topics subj ON subj.id = q.topic_id
         LEFT JOIN subtopics sub ON sub.id = q.subtopic_id
         LEFT JOIN lessons l ON l.id = q.lesson_id
         LEFT JOIN practice_sessions ps
           ON ps.quiz_id = q.id
          AND ps.user_id = ?
          AND ps.status = 'in_progress'
         WHERE q.status = 'active'
         ORDER BY ps.updated_at IS NULL ASC, ps.updated_at DESC, q.created_at DESC, q.id DESC
         LIMIT 60`, [student.id, student.id, student.id]),
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
         LIMIT 8`, [student.id]),
        ]);
        const personalItems = taskRows[0].map((row) => this.mapPlannerAgendaTask(row, today));
        const lessonItems = lessonRows[0].map((row) => this.mapPlannerAgendaLesson(row));
        const quizItems = quizRows[0].map((row) => this.mapPlannerAgendaQuiz(row, quizAccessProfile));
        const reviewItems = reviewRows[0].map((row, index) => this.mapPlannerAgendaReview(row, index, today));
        const items = [...personalItems, ...lessonItems, ...quizItems, ...reviewItems]
            .filter((item) => item.title)
            .sort((left, right) => this.comparePlannerAgendaItems(left, right))
            .slice(0, 120);
        return {
            generatedAt: new Date().toISOString(),
            items,
            filters: this.buildPlannerAgendaFilters(items),
            summary: this.summarizePlannerAgenda(items),
        };
    }
    async createPlannerTask(authorization, input) {
        const student = await this.authService.requireStudent(authorization);
        const title = this.requiredString(input?.title, 'Task title');
        const description = this.optionalString(input?.description);
        const dueDate = this.optionalDate(input?.dueDate);
        const category = this.normalizePlannerTaskCategory(input?.category);
        const priority = this.normalizePlannerTaskPriority(input?.priority);
        const estimatedMinutes = this.optionalPlannerEstimatedMinutes(input?.estimatedMinutes);
        const [result] = await this.db.execute(`INSERT INTO study_planner_tasks
         (user_id, title, description, due_date, status, category, priority, estimated_minutes)
       VALUES (?, ?, ?, ?, 'todo', ?, ?, ?)`, [student.id, title, description, dueDate, category, priority, estimatedMinutes]);
        return { ok: true, id: result.insertId };
    }
    async updatePlannerTask(authorization, id, input) {
        const student = await this.authService.requireStudent(authorization);
        const [rows] = await this.db.execute('SELECT id FROM study_planner_tasks WHERE id = ? AND user_id = ? LIMIT 1', [id, student.id]);
        if (!rows[0])
            throw new common_1.NotFoundException('Planner task not found');
        const updates = [];
        const values = [];
        if (input?.title !== undefined) {
            updates.push('title = ?');
            values.push(this.requiredString(input.title, 'Task title'));
        }
        if (input?.description !== undefined) {
            updates.push('description = ?');
            values.push(this.optionalString(input.description));
        }
        if (input?.dueDate !== undefined) {
            updates.push('due_date = ?');
            values.push(this.optionalDate(input.dueDate));
        }
        if (input?.status !== undefined) {
            const status = input.status === 'done' ? 'done' : input.status === 'todo' ? 'todo' : null;
            if (!status)
                throw new common_1.BadRequestException('Planner task status is invalid');
            updates.push('status = ?');
            values.push(status);
        }
        if (input?.category !== undefined) {
            updates.push('category = ?');
            values.push(this.normalizePlannerTaskCategory(input.category));
        }
        if (input?.priority !== undefined) {
            updates.push('priority = ?');
            values.push(this.normalizePlannerTaskPriority(input.priority));
        }
        if (input?.estimatedMinutes !== undefined) {
            updates.push('estimated_minutes = ?');
            values.push(this.optionalPlannerEstimatedMinutes(input.estimatedMinutes));
        }
        if (!updates.length) {
            return { ok: true, id };
        }
        values.push(id, student.id);
        await this.db.execute(`UPDATE study_planner_tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
        return { ok: true, id };
    }
    async deletePlannerTask(authorization, id) {
        const student = await this.authService.requireStudent(authorization);
        await this.db.execute('DELETE FROM study_planner_tasks WHERE id = ? AND user_id = ?', [id, student.id]);
        return { ok: true, id };
    }
    async getAdminReports(authorization, rawFilters = {}) {
        const admin = await this.authService.requireAdmin(authorization);
        const filters = this.normalizeAdminReportFilters(rawFilters);
        const canViewLearnerPii = this.canViewLearnerPii(admin);
        if (filters.userId && !canViewLearnerPii) {
            throw new common_1.ForbiddenException('Student management permission is required for learner-specific analytics');
        }
        await this.logAdminAuditEvent({
            eventType: 'analytics_report.viewed',
            actorId: admin.id,
            targetType: 'analytics_report',
            summary: 'Admin analytics report viewed',
            metadata: {
                filters,
                learnerPiiIncluded: canViewLearnerPii,
            },
        });
        const attemptWhere = ['qa.status = \'submitted\''];
        const attemptParams = [];
        this.appendDateFilter(attemptWhere, attemptParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
        this.appendUserFilter(attemptWhere, attemptParams, 'qa.user_id', filters);
        this.appendCourseFilter(attemptWhere, attemptParams, 'q.course_id', filters);
        const lessonWhere = ['1=1'];
        const lessonParams = [];
        this.appendDateFilter(lessonWhere, lessonParams, 'slp.updated_at', filters);
        this.appendUserFilter(lessonWhere, lessonParams, 'slp.user_id', filters);
        this.appendCourseFilter(lessonWhere, lessonParams, 'slp.course_id', filters);
        const hardQuestionWhere = [
            'qa.status = \'submitted\'',
            'sa.is_selected = 1',
            'qo.is_correct = 0',
        ];
        const hardQuestionParams = [];
        this.appendDateFilter(hardQuestionWhere, hardQuestionParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
        this.appendUserFilter(hardQuestionWhere, hardQuestionParams, 'qa.user_id', filters);
        this.appendCourseFilter(hardQuestionWhere, hardQuestionParams, 'COALESCE(q.course_id, quiz.course_id)', filters);
        const inactiveWhere = ['u.role = \'student\''];
        const inactiveParams = [];
        this.appendUserFilter(inactiveWhere, inactiveParams, 'u.id', filters);
        const activityParams = [];
        const activityQuizWhere = ['qa.status = \'submitted\''];
        this.appendActivityDateFilter(activityQuizWhere, activityParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
        this.appendUserFilter(activityQuizWhere, activityParams, 'qa.user_id', filters);
        this.appendCourseFilter(activityQuizWhere, activityParams, 'q.course_id', filters);
        const activityStudyWhere = ['1=1'];
        if (!filters.courseId) {
            this.appendActivityDateFilter(activityStudyWhere, activityParams, 'sae.created_at', filters);
            this.appendUserFilter(activityStudyWhere, activityParams, 'sae.user_id', filters);
        }
        const quizPerformanceWhere = ['qa.status = \'submitted\''];
        const quizPerformanceParams = [];
        this.appendDateFilter(quizPerformanceWhere, quizPerformanceParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
        this.appendUserFilter(quizPerformanceWhere, quizPerformanceParams, 'qa.user_id', filters);
        this.appendCourseFilter(quizPerformanceWhere, quizPerformanceParams, 'q.course_id', filters);
        const courseFunnelWhere = ['1=1'];
        const courseFunnelParams = [];
        this.appendCourseFilter(courseFunnelWhere, courseFunnelParams, 'c.id', filters);
        const courseFunnelJoinConditions = ['slp.course_id = c.id'];
        const courseFunnelJoinParams = [];
        this.appendDateFilter(courseFunnelJoinConditions, courseFunnelJoinParams, 'slp.updated_at', filters);
        this.appendUserFilter(courseFunnelJoinConditions, courseFunnelJoinParams, 'slp.user_id', filters);
        const subscriptionStatusWhere = ['1=1'];
        const subscriptionStatusParams = [];
        this.appendDateFilter(subscriptionStatusWhere, subscriptionStatusParams, 'us.updated_at', filters);
        this.appendUserFilter(subscriptionStatusWhere, subscriptionStatusParams, 'us.user_id', filters);
        const paymentStatusWhere = ['1=1'];
        const paymentStatusParams = [];
        this.appendDateFilter(paymentStatusWhere, paymentStatusParams, 'pt.created_at', filters);
        this.appendUserFilter(paymentStatusWhere, paymentStatusParams, 'pt.user_id', filters);
        const [[users], [attempts], [lessons], hardQuestions, inactiveStudents, activityHeatmap, quizPerformance, courseFunnel, subscriptionStatus, paymentStatus,] = await Promise.all([
            this.db.execute(`SELECT COUNT(*) total, SUM(role='student') students, SUM(status='inactive') pending FROM users`),
            this.db.execute(`SELECT COUNT(*) attempts, AVG(qa.percentage) avg_score, SUM(qa.pass_status='pass') passes
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         WHERE ${attemptWhere.join(' AND ')}`, attemptParams),
            this.db.execute(`SELECT COUNT(*) total, SUM(slp.status='completed') completed
         FROM student_lesson_progress slp
         WHERE ${lessonWhere.join(' AND ')}`, lessonParams),
            this.db.execute(`
        SELECT q.id, LEFT(q.question_text, 120) AS question_text, COUNT(sa.id) AS wrong_count
        FROM student_answers sa
        INNER JOIN question_options qo ON qo.id = sa.option_id
        INNER JOIN questions q ON q.id = sa.question_id
        INNER JOIN quiz_attempts qa ON qa.id = sa.attempt_id
        LEFT JOIN quizzes quiz ON quiz.id = qa.quiz_id
        WHERE ${hardQuestionWhere.join(' AND ')}
        GROUP BY q.id, q.question_text
        ORDER BY wrong_count DESC
        LIMIT 8
      `, hardQuestionParams),
            this.db.execute(`
        SELECT inactive.id, inactive.full_name, inactive.email, inactive.last_activity
        FROM (
          SELECT u.id, u.full_name, u.email, MAX(COALESCE(qa.submitted_at, sae.created_at, slp.updated_at)) AS last_activity
          FROM users u
          LEFT JOIN quiz_attempts qa ON qa.user_id = u.id
          LEFT JOIN study_activity_events sae ON sae.user_id = u.id
          LEFT JOIN student_lesson_progress slp ON slp.user_id = u.id
          WHERE ${inactiveWhere.join(' AND ')}
          GROUP BY u.id, u.full_name, u.email
        ) inactive
        ORDER BY inactive.last_activity IS NULL DESC, inactive.last_activity ASC
        LIMIT 10
      `, inactiveParams),
            this.db.execute(`
        SELECT
          day_key,
          COUNT(DISTINCT user_id) AS active_students,
          SUM(quiz_events) AS quiz_attempts,
          SUM(study_events) AS study_events
        FROM (
          SELECT DATE(COALESCE(qa.submitted_at, qa.created_at)) AS day_key, qa.user_id, 1 AS quiz_events, 0 AS study_events
          FROM quiz_attempts qa
          INNER JOIN quizzes q ON q.id = qa.quiz_id
          WHERE ${activityQuizWhere.join(' AND ')}
          UNION ALL
          SELECT DATE(sae.created_at) AS day_key, sae.user_id, 0 AS quiz_events, 1 AS study_events
          FROM study_activity_events sae
          ${filters.courseId ? 'WHERE 1=0' : `WHERE ${activityStudyWhere.join(' AND ')}`}
        ) activity
        GROUP BY day_key
        ORDER BY day_key ASC
      `, activityParams),
            this.db.execute(`
        SELECT
          q.id,
          COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
          c.course_title,
          COUNT(qa.id) AS attempts,
          SUM(qa.pass_status = 'pass') AS passes,
          SUM(qa.pass_status = 'fail') AS fails,
          AVG(qa.percentage) AS average_percentage
        FROM quizzes q
        INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id
        LEFT JOIN courses c ON c.id = q.course_id
        WHERE ${quizPerformanceWhere.join(' AND ')}
        GROUP BY q.id, q.quiz_title, q.student_title, c.course_title
        ORDER BY attempts DESC, average_percentage ASC
        LIMIT 10
      `, quizPerformanceParams),
            this.db.execute(`
        SELECT
          c.id,
          c.course_title,
          COUNT(DISTINCT l.id) AS total_lessons,
          COUNT(DISTINCT slp.user_id) AS students_started,
          SUM(slp.status = 'completed') AS completed_lessons,
          AVG(slp.progress_percent) AS average_progress
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id AND l.status = 'active'
        LEFT JOIN student_lesson_progress slp ON ${courseFunnelJoinConditions.join(' AND ')}
        WHERE ${courseFunnelWhere.join(' AND ')}
        GROUP BY c.id, c.course_title
        ORDER BY students_started DESC, c.course_title ASC
        LIMIT 8
      `, [...courseFunnelJoinParams, ...courseFunnelParams]),
            this.db.execute(`
        SELECT status, COUNT(*) AS count_value
        FROM user_subscriptions us
        WHERE ${subscriptionStatusWhere.join(' AND ')}
        GROUP BY status
      `, subscriptionStatusParams),
            this.db.execute(`
        SELECT status, 'LKR' AS currency, COUNT(*) AS count_value, SUM(amount) AS amount_total
        FROM payment_transactions pt
        WHERE ${paymentStatusWhere.join(' AND ')}
        GROUP BY status
      `, paymentStatusParams),
        ]);
        const userRow = users[0] || {};
        const attemptRow = attempts[0] || {};
        const lessonRow = lessons[0] || {};
        return {
            users: {
                total: Number(userRow.total || 0),
                students: Number(userRow.students || 0),
                pending: Number(userRow.pending || 0),
            },
            attempts: {
                total: Number(attemptRow.attempts || 0),
                averageScore: Number(Number(attemptRow.avg_score || 0).toFixed(1)),
                passRate: Number(attemptRow.attempts || 0) > 0 ? Math.round((Number(attemptRow.passes || 0) / Number(attemptRow.attempts || 1)) * 100) : 0,
            },
            lessons: {
                tracked: Number(lessonRow.total || 0),
                completed: Number(lessonRow.completed || 0),
            },
            hardQuestions: hardQuestions[0].map((row) => ({
                id: Number(row.id),
                text: String(row.question_text || ''),
                wrongCount: Number(row.wrong_count || 0),
            })),
            inactiveStudents: inactiveStudents[0].map((row) => ({
                id: canViewLearnerPii ? Number(row.id) : null,
                learnerRef: this.anonymizedLearnerRef(row.id),
                fullName: canViewLearnerPii ? String(row.full_name || '') : this.anonymizedLearnerRef(row.id),
                email: canViewLearnerPii ? String(row.email || '') : '',
                lastActivity: row.last_activity || null,
            })),
            activityHeatmap: activityHeatmap[0].map((row) => ({
                date: String(row.day_key || ''),
                activeStudents: Number(row.active_students || 0),
                quizAttempts: Number(row.quiz_attempts || 0),
                studyEvents: Number(row.study_events || 0),
            })),
            quizPerformance: quizPerformance[0].map((row) => {
                const totalAttempts = Number(row.attempts || 0);
                const passes = Number(row.passes || 0);
                return {
                    id: Number(row.id),
                    quizTitle: String(row.quiz_title || ''),
                    courseTitle: String(row.course_title || ''),
                    attempts: totalAttempts,
                    passes,
                    fails: Number(row.fails || 0),
                    passRate: totalAttempts > 0 ? Math.round((passes / totalAttempts) * 100) : 0,
                    averagePercentage: Number(Number(row.average_percentage || 0).toFixed(1)),
                };
            }),
            courseFunnel: courseFunnel[0].map((row) => ({
                id: Number(row.id),
                courseTitle: String(row.course_title || ''),
                totalLessons: Number(row.total_lessons || 0),
                studentsStarted: Number(row.students_started || 0),
                completedLessons: Number(row.completed_lessons || 0),
                averageProgress: Number(Number(row.average_progress || 0).toFixed(1)),
            })),
            subscriptions: {
                byStatus: subscriptionStatus[0].map((row) => ({
                    status: String(row.status || 'unknown'),
                    count: Number(row.count_value || 0),
                })),
                payments: paymentStatus[0].map((row) => ({
                    status: String(row.status || 'unknown'),
                    currency: String(row.currency || 'LKR'),
                    count: Number(row.count_value || 0),
                    amount: Number(row.amount_total || 0),
                })),
            },
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate,
                courseId: filters.courseId,
                userId: filters.userId,
            },
        };
    }
    async createQuestionReport(authorization, input) {
        const student = await this.authService.requireStudent(authorization);
        const questionId = Number(input?.questionId);
        if (!Number.isInteger(questionId) || questionId <= 0) {
            throw new common_1.BadRequestException('Question ID is required');
        }
        const reason = this.optionalString(input?.reason) || 'Student reported this question';
        const comment = this.optionalString(input?.comment);
        const [questionRows] = await this.db.execute("SELECT id FROM questions WHERE id = ? AND status = 'active' LIMIT 1", [questionId]);
        if (!questionRows[0])
            throw new common_1.NotFoundException('Question not found');
        const [result] = await this.db.execute(`INSERT INTO question_reports (question_id, user_id, reason, comment, status)
       VALUES (?, ?, ?, ?, 'open')`, [questionId, student.id, reason.slice(0, 120), comment]);
        return { ok: true, id: result.insertId, questionId };
    }
    async listQuestionReports(authorization, status) {
        await this.authService.requireAdmin(authorization);
        const params = [];
        let where = 'WHERE 1=1';
        if (['open', 'resolved', 'rejected'].includes(String(status || ''))) {
            where += ' AND qr.status = ?';
            params.push(status);
        }
        const [rows] = await this.db.execute(`
        SELECT
          qr.*,
          q.question_text,
          q.question_type,
          c.course_title,
          t.topic_name,
          u.full_name,
          u.email,
          (
            SELECT GROUP_CONCAT(DISTINCT qq.quiz_id ORDER BY qq.quiz_id SEPARATOR ', ')
            FROM question_quizzes qq
            WHERE qq.question_id = qr.question_id
          ) AS quiz_ids
        FROM question_reports qr
        INNER JOIN questions q ON q.id = qr.question_id
        INNER JOIN users u ON u.id = qr.user_id
        LEFT JOIN courses c ON c.id = q.course_id
        LEFT JOIN topics t ON t.id = q.topic_id
        ${where}
        ORDER BY FIELD(qr.status, 'open', 'rejected', 'resolved'), qr.created_at DESC
        LIMIT 100
      `, params);
        return rows.map((row) => this.mapQuestionReport(row));
    }
    async updateQuestionReport(authorization, id, input) {
        await this.authService.requireAdmin(authorization);
        const status = ['open', 'resolved', 'rejected'].includes(input?.status) ? input.status : null;
        if (!status)
            throw new common_1.BadRequestException('Report status is invalid');
        await this.db.execute(`UPDATE question_reports SET status = ? WHERE id = ?`, [status, id]);
        return { ok: true, id };
    }
    mapPlannerAgendaTask(row, today) {
        const dueAt = this.dateKey(row.due_date);
        const done = String(row.status || '') === 'done';
        const category = this.normalizePlannerTaskCategory(row.category);
        const priorityLevel = this.normalizePlannerTaskPriority(row.priority);
        const estimatedMinutes = this.optionalPlannerEstimatedMinutes(row.estimated_minutes);
        const status = done ? 'completed' : this.plannerStatusForDueDate(dueAt, today);
        const statusPriority = status === 'overdue' ? 100 : status === 'due_today' ? 88 : status === 'upcoming' ? 48 : status === 'completed' ? 4 : 28;
        const taskPriorityBoost = priorityLevel === 'high' ? 14 : priorityLevel === 'medium' ? 6 : 0;
        const type = category === 'general' ? 'task' : category;
        return {
            id: `task-${Number(row.id)}`,
            source: 'planner_task',
            sourceId: Number(row.id),
            type,
            title: String(row.title || '').trim(),
            course: '',
            subject: '',
            topic: '',
            lesson: '',
            status,
            dueAt,
            completedAt: done ? row.updated_at || row.created_at || null : null,
            progress: done ? 100 : 0,
            actionUrl: '/planner',
            actionLabel: done ? 'View task' : 'Mark complete',
            locked: false,
            accessMessage: '',
            priority: status === 'completed' ? statusPriority : statusPriority + taskPriorityBoost,
            meta: {
                description: String(row.description || ''),
                category,
                priority: priorityLevel,
                estimatedMinutes,
                createdAt: row.created_at || null,
                updatedAt: row.updated_at || null,
            },
        };
    }
    mapPlannerAgendaLesson(row) {
        const statusText = String(row.progress_status || 'in_progress');
        const completed = statusText === 'completed';
        const progress = this.clampPlannerPercent(row.progress_percent);
        return {
            id: `lesson-${Number(row.lesson_id)}`,
            source: 'lesson_progress',
            sourceId: Number(row.lesson_id),
            type: 'lesson',
            title: String(row.lesson_title || 'Lesson').trim(),
            course: String(row.course_title || ''),
            subject: String(row.subject_name || ''),
            topic: String(row.topic_name || ''),
            lesson: String(row.lesson_title || ''),
            status: completed ? 'completed' : 'in_progress',
            dueAt: null,
            completedAt: completed ? row.completed_at || row.updated_at || null : null,
            progress: completed ? 100 : progress,
            actionUrl: `/study/lesson/${Number(row.lesson_id)}`,
            actionLabel: completed ? 'Review lesson' : 'Continue lesson',
            locked: false,
            accessMessage: '',
            priority: completed ? 8 : 82,
            meta: {
                startedAt: row.started_at || null,
                updatedAt: row.updated_at || null,
            },
        };
    }
    mapPlannerAgendaQuiz(row, accessProfile) {
        const quizId = Number(row.id);
        const isExam = Number(row.exam_mode_only) === 1;
        const canAccess = this.canAccessPlannerQuiz(row, accessProfile);
        const inProgress = Boolean(row.practice_session_id);
        const completed = Number(row.exam_attempt_count || 0) > 0 || Number(row.practice_completed_count || 0) > 0;
        const totalQuestions = Number(row.total_questions || 0);
        const answered = Number(row.practice_answered_count || 0);
        const progress = completed ? 100 : inProgress && totalQuestions > 0 ? this.clampPlannerPercent((answered / totalQuestions) * 100) : 0;
        const mode = isExam ? 'exam' : 'practice';
        const status = !canAccess ? 'locked' : completed ? 'completed' : inProgress ? 'in_progress' : 'optional';
        return {
            id: `${isExam ? 'exam' : 'quiz'}-${quizId}`,
            source: 'quiz',
            sourceId: quizId,
            type: isExam ? 'exam' : 'quiz',
            title: String(row.quiz_title || (isExam ? 'Exam' : 'Quiz')).trim(),
            course: String(row.course_title || ''),
            subject: String(row.subject_name || ''),
            topic: String(row.topic_name || ''),
            lesson: String(row.lesson_title || ''),
            status,
            dueAt: null,
            completedAt: completed ? row.practice_updated_at || row.quiz_created_at || null : null,
            progress,
            actionUrl: `/quizzes/${quizId}?mode=${mode}`,
            actionLabel: !canAccess ? 'Locked' : completed ? 'Review' : inProgress ? 'Resume practice' : isExam ? 'Start exam' : 'Start quiz',
            locked: !canAccess,
            accessMessage: canAccess ? '' : 'Your subscription does not include this course question bank.',
            priority: !canAccess ? 18 : inProgress ? 78 : completed ? 5 : isExam ? 38 : 34,
            meta: {
                totalQuestions,
                answeredQuestions: answered,
                timeLimit: Number(row.time_limit || 0),
            },
        };
    }
    mapPlannerAgendaReview(row, index, today) {
        const title = String(row.lesson_title || row.topic_name || row.subject_name || 'Missed questions review').trim();
        const misses = Number(row.miss_count || 0);
        return {
            id: `review-${index}-${this.slugPlannerId(title)}`,
            source: 'review_signal',
            sourceId: null,
            type: 'review',
            title,
            course: String(row.course_title || ''),
            subject: String(row.subject_name || ''),
            topic: String(row.topic_name || ''),
            lesson: String(row.lesson_title || ''),
            status: 'due_today',
            dueAt: today,
            completedAt: null,
            progress: null,
            actionUrl: '/results',
            actionLabel: 'Review',
            locked: false,
            accessMessage: '',
            priority: 74 - index,
            meta: {
                missCount: misses,
                latestMissedAt: row.latest_missed_at || null,
                questionType: String(row.question_type || ''),
            },
        };
    }
    comparePlannerAgendaItems(left, right) {
        if (right.priority !== left.priority)
            return right.priority - left.priority;
        const leftDue = left.dueAt || '9999-12-31';
        const rightDue = right.dueAt || '9999-12-31';
        if (leftDue !== rightDue)
            return leftDue.localeCompare(rightDue);
        return left.title.localeCompare(right.title);
    }
    buildPlannerAgendaFilters(items) {
        const unique = (values) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
        return {
            courses: unique(items.map((item) => item.course)),
            subjects: unique(items.map((item) => item.subject)),
            topics: unique(items.map((item) => item.topic)),
            lessons: unique(items.map((item) => item.lesson)),
        };
    }
    summarizePlannerAgenda(items) {
        return {
            today: items.filter((item) => item.status === 'due_today' || item.status === 'in_progress').length,
            overdue: items.filter((item) => item.status === 'overdue').length,
            upcoming: items.filter((item) => item.status === 'upcoming' || item.status === 'optional' || item.status === 'locked').length,
            completed: items.filter((item) => item.status === 'completed').length,
            total: items.length,
        };
    }
    async getPlannerQuizAccessProfile(userId) {
        const [rows] = await this.db.execute(`
        SELECT sf.feature_key, plans.slug AS plan_slug, us.access_scope, us.course_ids_json
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
            const courseIds = this.parsePlannerIdList(row.course_ids_json);
            const scope = this.resolvePlannerAccessScope(row, courseIds);
            if (scope === 'all' && courseIds.length === 0) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach((id) => profile.courseIds.add(id));
            }
        }
        return profile;
    }
    canAccessPlannerQuiz(row, profile) {
        if (Number(row.is_free) === 1)
            return true;
        if (!profile.hasAnyPaidQuizAccess)
            return false;
        if (profile.hasFullAccess)
            return true;
        return profile.courseIds.has(Number(row.course_id));
    }
    resolvePlannerAccessScope(row, courseIds) {
        const planSlug = String(row.plan_slug || '').trim();
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
            return 'courses';
        }
        return row.access_scope || (courseIds.length ? 'courses' : 'all');
    }
    parsePlannerIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(String(raw)) : [];
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
    plannerStatusForDueDate(dueAt, today) {
        if (!dueAt)
            return 'optional';
        if (dueAt < today)
            return 'overdue';
        if (dueAt === today)
            return 'due_today';
        return 'upcoming';
    }
    clampPlannerPercent(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric))
            return 0;
        return Math.max(0, Math.min(100, Math.round(numeric)));
    }
    todayDateKey() {
        return this.formatPlannerDateKey(new Date());
    }
    dateKey(value) {
        if (!value)
            return null;
        if (value instanceof Date)
            return this.formatPlannerDateKey(value);
        const text = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(text))
            return text.slice(0, 10);
        const parsed = Date.parse(text);
        return Number.isFinite(parsed) ? this.formatPlannerDateKey(new Date(parsed)) : null;
    }
    formatPlannerDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    slugPlannerId(value) {
        return String(value || 'item')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48) || 'item';
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
    async logAdminAuditEvent(input) {
        await this.db.execute(`INSERT INTO admin_audit_events
        (event_type, actor_id, target_type, target_id, summary, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            input.eventType,
            input.actorId || null,
            input.targetType || null,
            input.targetId || null,
            input.summary,
            input.metadata === undefined ? null : JSON.stringify(input.metadata),
        ]);
    }
    normalizeAdminReportFilters(input) {
        return {
            startDate: this.optionalDate(input.startDate) || '',
            endDate: this.optionalDate(input.endDate) || '',
            courseId: this.optionalPositiveInteger(input.courseId),
            userId: this.optionalPositiveInteger(input.userId),
        };
    }
    appendDateFilter(where, params, column, filters) {
        const safeColumn = (0, sql_safety_1.allowedSqlFragment)(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report date column');
        if (filters.startDate) {
            where.push(`DATE(${safeColumn}) >= ?`);
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            where.push(`DATE(${safeColumn}) <= ?`);
            params.push(filters.endDate);
        }
    }
    appendActivityDateFilter(where, params, column, filters) {
        if (filters.startDate || filters.endDate) {
            this.appendDateFilter(where, params, column, filters);
            return;
        }
        const safeColumn = (0, sql_safety_1.allowedSqlFragment)(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report activity date column');
        where.push(`${safeColumn} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`);
    }
    appendUserFilter(where, params, column, filters) {
        if (!filters.userId)
            return;
        const safeColumn = (0, sql_safety_1.allowedSqlFragment)(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report user column');
        where.push(`${safeColumn} = ?`);
        params.push(filters.userId);
    }
    appendCourseFilter(where, params, column, filters) {
        if (!filters.courseId)
            return;
        const safeColumn = (0, sql_safety_1.allowedSqlFragment)(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report course column');
        where.push(`${safeColumn} = ?`);
        params.push(filters.courseId);
    }
    optionalPositiveInteger(value) {
        const numeric = Number(value);
        return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    }
    normalizeAnnouncementInput(input) {
        return {
            title: this.requiredString(input?.title, 'Title'),
            body: this.requiredString(input?.body, 'Message'),
            targetRole: ['all', 'student', 'admin'].includes(input?.targetRole) ? input.targetRole : 'student',
            status: ['draft', 'published', 'archived'].includes(input?.status) ? input.status : 'published',
            publishAt: input?.publishAt ? String(input.publishAt) : null,
        };
    }
    requiredString(value, label) {
        const text = String(value || '').trim();
        if (!text)
            throw new common_1.BadRequestException(`${label} is required`);
        return text;
    }
    optionalString(value) {
        return String(value || '').trim();
    }
    optionalDate(value) {
        const text = String(value || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
    }
    normalizePlannerTaskCategory(value) {
        const text = String(value || '').trim().toLowerCase();
        return PLANNER_TASK_CATEGORIES.includes(text) ? text : 'general';
    }
    normalizePlannerTaskPriority(value) {
        const text = String(value || '').trim().toLowerCase();
        return PLANNER_TASK_PRIORITIES.includes(text) ? text : 'medium';
    }
    optionalPlannerEstimatedMinutes(value) {
        if (value === null || value === undefined || value === '')
            return null;
        const minutes = Number(value);
        if (!Number.isInteger(minutes) || minutes < 0)
            throw new common_1.BadRequestException('Estimated minutes must be a non-negative whole number');
        return Math.min(minutes, 600);
    }
    mapAnnouncement(row) {
        return {
            id: Number(row.id),
            title: String(row.title || ''),
            body: String(row.body || ''),
            targetRole: String(row.target_role || 'student'),
            status: String(row.status || 'published'),
            publishAt: row.publish_at || null,
            createdByName: String(row.created_by_name || ''),
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
    mapPlannerTask(row) {
        return {
            id: Number(row.id),
            title: String(row.title || ''),
            description: String(row.description || ''),
            dueDate: this.dateKey(row.due_date) || '',
            status: String(row.status || 'todo'),
            category: this.normalizePlannerTaskCategory(row.category),
            priority: this.normalizePlannerTaskPriority(row.priority),
            estimatedMinutes: this.optionalPlannerEstimatedMinutes(row.estimated_minutes),
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
    mapQuestionReport(row) {
        return {
            id: Number(row.id),
            questionId: Number(row.question_id || 0),
            userId: Number(row.user_id || 0),
            fullName: String(row.full_name || ''),
            email: String(row.email || ''),
            reason: String(row.reason || ''),
            comment: String(row.comment || ''),
            status: String(row.status || 'open'),
            questionText: String(row.question_text || ''),
            questionType: String(row.question_type || ''),
            courseTitle: String(row.course_title || ''),
            topicName: String(row.topic_name || ''),
            quizIds: String(row.quiz_ids || ''),
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
};
exports.WorkspaceService = WorkspaceService;
exports.WorkspaceService = WorkspaceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        push_notifications_service_1.PushNotificationsService])
], WorkspaceService);
//# sourceMappingURL=workspace.service.js.map