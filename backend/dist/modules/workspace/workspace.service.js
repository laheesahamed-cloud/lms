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
var WorkspaceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const notices_service_1 = require("../notices/notices.service");
const admin_read_cache_1 = require("../../common/utils/admin-read-cache");
const run_in_batches_1 = require("../../common/utils/run-in-batches");
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_service_1 = require("../auth/auth.service");
const plans_service_1 = require("../plans/plans.service");
const push_notifications_service_1 = require("../push-notifications/push-notifications.service");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const recent_results_1 = require("../../common/utils/recent-results");
const planner_doc_1 = require("../../common/utils/planner-doc");
const MAX_BULK_PLANNER_TASKS = 600;
const PLANNER_TASK_CATEGORIES = ['general', 'lesson', 'quiz', 'exam', 'review', 'flashcards'];
const PLANNER_TASK_PRIORITIES = ['low', 'medium', 'high'];
const PLANNER_ITEM_TYPES = ['lesson', 'quiz', 'flashcards'];
const ADMIN_REPORT_FILTER_COLUMNS = [
    'q.course_id',
    'slp.updated_at',
    'slp.user_id',
    'slp.course_id',
    'sae.created_at',
    'sae.user_id',
    'u.id',
    'c.id',
    'us.updated_at',
    'us.user_id',
    'pt.created_at',
    'pt.user_id',
];
let WorkspaceService = WorkspaceService_1 = class WorkspaceService {
    constructor(db, authService, plansService, pushNotificationsService, notices) {
        this.db = db;
        this.authService = authService;
        this.plansService = plansService;
        this.pushNotificationsService = pushNotificationsService;
        this.notices = notices;
    }
    async listAdminAnnouncements(authorization, _after) {
        await this.authService.requireAdmin(authorization);
        return { items: this.notices.listPopups().map((p) => this.mapPopup(p)), next: null };
    }
    async createAnnouncement(authorization, input) {
        await this.authService.requireAdmin(authorization);
        const popup = this.notices.createPopup(input);
        return { ok: true, id: popup.id, overlapping: this.overlappingPopups(popup) };
    }
    async updateAnnouncement(authorization, id, input) {
        await this.authService.requireAdmin(authorization);
        const popup = this.notices.updatePopup(id, input);
        return { ok: true, id, overlapping: this.overlappingPopups(popup) };
    }
    async deleteAnnouncement(authorization, id) {
        await this.authService.requireAdmin(authorization);
        this.notices.deletePopup(id);
        return { ok: true, id };
    }
    overlappingPopups(popup) {
        if (popup.status !== 'active')
            return 0;
        const now = Date.now();
        const start = (p) => Math.max(now, p.startAt ? new Date(p.startAt).getTime() : now);
        const end = (p) => (p.endAt ? new Date(p.endAt).getTime() : Number.MAX_SAFE_INTEGER);
        const shared = (a, b) => a.audience === 'all' || b.audience === 'all' || a.audience === b.audience;
        return this.notices.listPopups().filter((p) => p.id !== popup.id && p.status === 'active'
            && shared(p, popup) && start(p) < end(popup) && start(popup) < end(p)).length;
    }
    mapPopup(p) {
        return {
            id: p.id,
            style: p.style,
            title: p.title,
            body: p.body,
            imageUrl: p.imageUrl,
            actionLabel: p.actionLabel,
            actionPath: p.actionPath,
            startAt: p.startAt,
            endAt: p.endAt,
            priority: p.priority,
            audience: p.audience,
            targetRole: p.audience,
            status: p.status,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
    async listNotifications(authorization) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        return this.notices.noticesFor(String(user.role)).items.map((n) => ({
            id: n.id,
            kind: n.kind === 'content' ? 'new-content' : 'announcement',
            title: n.title,
            body: n.body,
            targetRole: n.audience,
            status: 'published',
            createdAt: n.createdAt,
            updatedAt: n.createdAt,
            read: false,
            actionPath: n.url === '/notifications' ? '' : n.url,
        }));
    }
    async dismissNotification(authorization, key) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: true, key: String(key || '').trim().slice(0, 190) };
    }
    async clearNotifications(authorization) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: true, cleared: 0 };
    }
    async markAllNotificationsRead(authorization) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: true, marked: 0 };
    }
    async markNotificationRead(authorization, id) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: true, id };
    }
    async planItems(userId) {
        const [rows] = await this.db.execute('SELECT rule_json FROM study_planner_tasks WHERE plan_owner = ? LIMIT 1', [userId]);
        return (0, planner_doc_1.readPlanItems)(rows[0]?.rule_json);
    }
    sortPlanItems(items) {
        const key = (i) => (i.dueDate ? new Date(i.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
        return [...items].sort((a, b) => key(a) - key(b) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(b.id) - Number(a.id));
    }
    async listPlannerTasks(authorization) {
        const student = await this.authService.requireStudent(authorization);
        return this.sortPlanItems(await this.planItems(student.id)).map((item) => this.mapPlannerItem(item));
    }
    async getPlannerAgenda(authorization) {
        const student = await this.authService.requireStudent(authorization);
        const today = this.todayDateKey();
        const quizAccessProfile = null;
        const [taskRows, lessonRows, quizRows, reviewRows] = await Promise.all([
            this.planItems(student.id).then((items) => [this.sortPlanItems(items.filter((i) => !i.rule)).slice(0, 80).map((i) => ({
                    id: Number(i.id), title: i.title, description: i.description, due_date: i.dueDate || null, status: i.status,
                    category: i.category, priority: i.priority, estimated_minutes: i.estimatedMinutes, created_at: i.createdAt, updated_at: i.updatedAt,
                }))]),
            (0, lesson_bits_1.finishedLessons)(this.db, student.id).then(async (done) => {
                const ids = [...done].sort((a, b) => b - a).slice(0, 36);
                if (!ids.length)
                    return [[]];
                const [rows] = await this.db.execute(`SELECT l.id AS lesson_id, 'completed' AS progress_status, 100 AS progress_percent,
                  NULL AS started_at, NULL AS completed_at, NULL AS updated_at,
                  l.lesson_title, c.course_title, subj.topic_name AS subject_name, sub.subtopic_name AS topic_name
             FROM lessons l
             LEFT JOIN courses c ON c.id = l.course_id
             LEFT JOIN topics subj ON subj.id = l.topic_id
             LEFT JOIN subtopics sub ON sub.id = l.subtopic_id
            WHERE l.status = 'active' AND l.id IN (${ids.map(() => '?').join(', ')})
            ORDER BY l.id DESC`, ids);
                return [rows];
            }),
            Promise.resolve([[]]),
            Promise.resolve([[]]),
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
    plannerItemFrom(input, id, sortOrder) {
        const link = this.normalizePlannerItemLink(input);
        const ruleJson = this.normalizePlannerRule(input?.rule);
        const now = new Date().toISOString();
        return {
            id,
            title: this.requiredString(input?.title, 'Task title'),
            description: this.optionalString(input?.description) || '',
            dueDate: this.optionalDate(input?.dueDate) || '',
            status: 'todo',
            category: this.normalizePlannerTaskCategory(input?.category),
            priority: this.normalizePlannerTaskPriority(input?.priority),
            estimatedMinutes: this.optionalPlannerEstimatedMinutes(input?.estimatedMinutes),
            itemType: link.type,
            itemId: link.id,
            rule: ruleJson ? JSON.parse(ruleJson) : null,
            sortOrder,
            createdAt: now,
            updatedAt: now,
        };
    }
    async appendPlanItems(userId, items) {
        await this.db.execute(`INSERT INTO study_planner_tasks (user_id, title, status, category, rule_json)
       VALUES (?, ?, 'todo', 'plan', ?)
       ON DUPLICATE KEY UPDATE rule_json = JSON_MERGE_PRESERVE(COALESCE(rule_json, '{"v":1,"items":[]}'), ?)`, [userId, planner_doc_1.PLAN_ROW_TITLE, JSON.stringify({ v: 1, items }), JSON.stringify({ items })]);
    }
    async createPlannerTask(authorization, input) {
        const student = await this.authService.requireStudent(authorization);
        const [id] = (0, planner_doc_1.newPlannerIds)(1);
        await this.appendPlanItems(student.id, [this.plannerItemFrom(input, id, 0)]);
        return { ok: true, id: Number(id) };
    }
    async createPlannerTasksBulk(authorization, input) {
        const student = await this.authService.requireStudent(authorization);
        const scopes = await (0, subscription_scope_1.getScopeRows)(this.db, student.id);
        const paid = scopes.some((row) => String(row.plan_slug || '').toLowerCase() !== 'free');
        if (!paid) {
            throw new common_1.ForbiddenException('Generating a study plan is included with a subscription.');
        }
        const raw = Array.isArray(input?.tasks) ? input.tasks : null;
        if (!raw || !raw.length)
            throw new common_1.BadRequestException('No tasks to create');
        if (raw.length > MAX_BULK_PLANNER_TASKS) {
            throw new common_1.BadRequestException(`A plan can create at most ${MAX_BULK_PLANNER_TASKS} tasks at once.`);
        }
        const ids = (0, planner_doc_1.newPlannerIds)(raw.length);
        const items = raw.map((task, index) => this.plannerItemFrom(task, ids[index], index + 1));
        await this.appendPlanItems(student.id, items);
        return { ok: true, rules: true, ids: ids.map(Number) };
    }
    async updatePlannerTask(authorization, id, input) {
        const student = await this.authService.requireStudent(authorization);
        const fields = [];
        if (input?.title !== undefined)
            fields.push(['title', this.requiredString(input.title, 'Task title')]);
        if (input?.description !== undefined)
            fields.push(['description', this.optionalString(input.description) || '']);
        if (input?.dueDate !== undefined)
            fields.push(['dueDate', this.optionalDate(input.dueDate) || '']);
        if (input?.status !== undefined) {
            const status = input.status === 'done' ? 'done' : input.status === 'todo' ? 'todo' : null;
            if (!status)
                throw new common_1.BadRequestException('Planner task status is invalid');
            fields.push(['status', status]);
        }
        if (input?.category !== undefined)
            fields.push(['category', this.normalizePlannerTaskCategory(input.category)]);
        if (input?.priority !== undefined)
            fields.push(['priority', this.normalizePlannerTaskPriority(input.priority)]);
        if (input?.estimatedMinutes !== undefined)
            fields.push(['estimatedMinutes', this.optionalPlannerEstimatedMinutes(input.estimatedMinutes)]);
        if (!fields.length)
            return { ok: true, id };
        fields.push(['updatedAt', new Date().toISOString()]);
        const key = String(id);
        const path = WorkspaceService_1.ITEM_PATH;
        const sets = fields.map(([name]) => `CONCAT(${path}, '.${name}'), ?`).join(', ');
        const params = [];
        for (const [, value] of fields)
            params.push(key, value === null || value === undefined ? null : value);
        params.push(student.id, key);
        const [res] = await this.db.execute(`UPDATE study_planner_tasks SET rule_json = JSON_SET(rule_json, ${sets})
        WHERE plan_owner = ? AND JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id') IS NOT NULL`, params);
        if (!res.affectedRows)
            throw new common_1.NotFoundException('Planner task not found');
        return { ok: true, id };
    }
    async clearPlannerTasks(authorization) {
        const student = await this.authService.requireStudent(authorization);
        const [res] = await this.db.execute(`UPDATE study_planner_tasks
          SET id = id + 0 * LAST_INSERT_ID(COALESCE(JSON_LENGTH(rule_json, '$.items'), 0)),
              rule_json = '{"v":1,"items":[]}'
        WHERE plan_owner = ?`, [student.id]);
        return { ok: true, deleted: res.affectedRows ? Number(res.insertId || 0) : 0 };
    }
    async deletePlannerTask(authorization, id) {
        const student = await this.authService.requireStudent(authorization);
        const key = String(id);
        await this.db.execute(`UPDATE study_planner_tasks SET rule_json = JSON_REMOVE(rule_json, ${WorkspaceService_1.ITEM_PATH})
        WHERE plan_owner = ? AND JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id') IS NOT NULL`, [key, student.id, key]);
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
        const cacheKey = `reports:${canViewLearnerPii ? 'pii' : 'anon'}:${JSON.stringify(filters)}`;
        return (0, admin_read_cache_1.cachedAdminRead)(cacheKey, async () => {
            const allResults = await (0, recent_results_1.loadRecentResults)(this.db, filters.userId);
            const quizInfo = await (0, recent_results_1.loadQuizInfo)(this.db, allResults.map((r) => r.quizId));
            const inRange = (day) => (!filters.startDate || day >= filters.startDate) && (!filters.endDate || day <= filters.endDate);
            const inCourse = (r) => !filters.courseId || Number(quizInfo.get(r.quizId)?.course_id) === filters.courseId;
            const results = allResults.filter((r) => inRange(r.day) && inCourse(r));
            const activityFrom = filters.startDate || filters.endDate ? '' : new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
            const activityResults = activityFrom ? allResults.filter((r) => inCourse(r) && r.day >= activityFrom) : results;
            const inactiveWhere = ['u.role = \'student\''];
            const inactiveParams = [];
            this.appendUserFilter(inactiveWhere, inactiveParams, 'u.id', filters);
            const courseFunnelWhere = ['1=1'];
            const courseFunnelParams = [];
            this.appendCourseFilter(courseFunnelWhere, courseFunnelParams, 'c.id', filters);
            const courseFunnelJoinConditions = ['1=1'];
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
            const [[users], [attempts], [lessons], hardQuestions, inactiveStudents, activityHeatmap, quizPerformance, courseFunnel, subscriptionStatus, paymentStatus,] = await (0, run_in_batches_1.runInBatches)([
                () => this.db.execute(`SELECT COUNT(*) total, SUM(role='student') students, SUM(status='inactive') pending FROM users WHERE deleted_at IS NULL`),
                () => Promise.resolve([[{
                            attempts: results.length,
                            avg_score: results.length ? results.reduce((n, r) => n + r.pct, 0) / results.length : 0,
                            passes: results.filter((r) => r.passed).length,
                        }], []]),
                () => this.lessonBitmapStats(filters)
                    .then((st) => [[{ total: st.total, completed: st.total }], []]),
                () => (0, recent_results_1.mostMissedQuestions)(this.db, results, 8)
                    .then((list) => [list.map((q) => ({ id: q.id, question_text: q.text, wrong_count: q.wrongCount })), []]),
                () => this.db.execute(`
        -- Each student's latest quiz, study event and lesson progress, worked
        -- out per table first. Joining all three raw tables at once multiplied
        -- the rows (attempts x events x lessons for every student) before
        -- grouping, which made this the heaviest query on the Reports page.
        SELECT u.id, u.full_name, u.email,
          slp.last_active_day AS last_activity
        FROM users u
        -- 10.44: the summary row's last active day (lessons, exams, cards).
        LEFT JOIN student_study_summary slp ON slp.user_id = u.id
        WHERE ${inactiveWhere.join(' AND ')}
        ORDER BY last_activity IS NULL DESC, last_activity ASC, u.id ASC
        LIMIT 10
      `, inactiveParams),
                () => {
                    const days = new Map();
                    for (const r of activityResults) {
                        const d = days.get(r.day) || { students: new Set(), exams: 0 };
                        d.students.add(r.userId);
                        d.exams += 1;
                        days.set(r.day, d);
                    }
                    const rows = [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([day, d]) => ({
                        day_key: day, active_students: d.students.size, quiz_attempts: d.exams, study_events: 0,
                    }));
                    return Promise.resolve([rows, []]);
                },
                () => {
                    const perQuiz = new Map();
                    for (const r of results) {
                        const q = perQuiz.get(r.quizId) || { n: 0, passes: 0, sum: 0 };
                        q.n += 1;
                        q.passes += r.passed ? 1 : 0;
                        q.sum += r.pct;
                        perQuiz.set(r.quizId, q);
                    }
                    const rows = [...perQuiz.entries()]
                        .filter(([id]) => quizInfo.has(id))
                        .map(([id, q]) => {
                        const info = quizInfo.get(id);
                        return {
                            id, quiz_title: (info.student_title || '').trim() || info.quiz_title, course_title: info.course_title || '',
                            attempts: q.n, passes: q.passes, fails: q.n - q.passes, average_percentage: q.n ? q.sum / q.n : 0,
                        };
                    })
                        .sort((x, y) => y.attempts - x.attempts || x.average_percentage - y.average_percentage)
                        .slice(0, 10);
                    return Promise.resolve([rows, []]);
                },
                () => Promise.all([
                    this.db.execute(`
          SELECT c.id, c.course_title, COALESCE(lc.total_lessons, 0) AS total_lessons
          FROM courses c
          LEFT JOIN (
            SELECT course_id, COUNT(*) AS total_lessons
            FROM lessons
            WHERE status = 'active'
            GROUP BY course_id
          ) lc ON lc.course_id = c.id
          WHERE ${courseFunnelWhere.join(' AND ')}
        `, courseFunnelParams),
                    this.lessonBitmapStats({ ...filters, courseId: null }),
                ]).then(([[courses], st]) => {
                    const rows = courses.map((c) => {
                        const per = st.byCourse.get(Number(c.id));
                        const total = Number(c.total_lessons || 0);
                        const completed = per?.completed || 0;
                        const started = per?.students || 0;
                        return {
                            ...c,
                            course_title: String(c.course_title || ''),
                            students_started: started,
                            completed_lessons: completed,
                            average_progress: started && total ? (completed / started / total) * 100 : null,
                        };
                    });
                    rows.sort((a, b) => b.students_started - a.students_started || String(a.course_title).localeCompare(String(b.course_title)));
                    return [rows.slice(0, 8), []];
                }),
                () => this.db.execute(`
        SELECT status, COUNT(*) AS count_value
        FROM user_subscriptions us
        WHERE ${subscriptionStatusWhere.join(' AND ')}
        GROUP BY status
      `, subscriptionStatusParams),
                () => this.db.execute(`
        SELECT status, 'LKR' AS currency, COUNT(*) AS count_value, SUM(amount) AS amount_total
        FROM payment_transactions pt
        WHERE ${paymentStatusWhere.join(' AND ')}
        GROUP BY status
      `, paymentStatusParams),
            ], 3);
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
        }, 60_000);
    }
    async createQuestionReport(authorization, input) {
        const student = await this.authService.requireStudent(authorization);
        const questionId = Number(input?.questionId);
        if (!Number.isInteger(questionId) || questionId <= 0) {
            throw new common_1.BadRequestException('Question ID is required');
        }
        const reason = this.optionalString(input?.reason) || 'Student reported this question';
        const comment = this.optionalString(input?.comment);
        const [result] = await this.db.execute(`INSERT INTO question_reports (question_id, user_id, reason, comment, status)
       SELECT id, ?, ?, ?, 'open' FROM questions WHERE id = ? AND status = 'active'`, [student.id, reason.slice(0, 120), comment, questionId]);
        if (!result.affectedRows)
            throw new common_1.NotFoundException('Question not found');
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
        const completed = Number(row.exam_attempt_count || 0) > 0;
        const totalQuestions = Number(row.total_questions || 0);
        const progress = completed ? 100 : 0;
        const mode = isExam ? 'exam' : 'practice';
        const status = !canAccess ? 'locked' : completed ? 'completed' : 'optional';
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
            completedAt: completed ? row.quiz_created_at || null : null,
            progress,
            actionUrl: `/quizzes/${quizId}?mode=${mode}`,
            actionLabel: !canAccess ? 'Locked' : completed ? 'Review' : isExam ? 'Start exam' : 'Start quiz',
            locked: !canAccess,
            accessMessage: canAccess ? '' : 'Your subscription does not include this course question bank.',
            priority: !canAccess ? 18 : completed ? 5 : isExam ? 38 : 34,
            meta: {
                totalQuestions,
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
        SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())
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
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
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
        void 0;
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
    async lessonBitmapStats(filters) {
        const params = [];
        let where = 'lessons_done IS NOT NULL';
        if (filters.userId) {
            where += ' AND user_id = ?';
            params.push(filters.userId);
        }
        const [students] = await this.db.execute(`SELECT user_id, lessons_done FROM student_study_summary WHERE ${where}`, params);
        const [lessons] = await this.db.execute(`SELECT id, course_id FROM lessons WHERE status = 'active'`);
        const courseOf = new Map(lessons.map((l) => [Number(l.id), Number(l.course_id)]));
        const byCourse = new Map();
        let total = 0;
        for (const st of students) {
            const seen = new Set();
            for (const id of (0, lesson_bits_1.lessonIdsFromBits)(st.lessons_done)) {
                const course = courseOf.get(id);
                if (course === undefined)
                    continue;
                if (filters.courseId && course !== filters.courseId)
                    continue;
                total++;
                const entry = byCourse.get(course) || { students: 0, completed: 0 };
                entry.completed++;
                if (!seen.has(course)) {
                    entry.students++;
                    seen.add(course);
                }
                byCourse.set(course, entry);
            }
        }
        return { total, byCourse };
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
    normalizePlannerItemLink(input) {
        const type = PLANNER_ITEM_TYPES.includes(input?.itemType) ? String(input.itemType) : null;
        const id = Number(input?.itemId);
        if (!type || !Number.isInteger(id) || id <= 0)
            return { type: null, id: null };
        return { type, id };
    }
    normalizePlannerRule(raw) {
        if (!raw || typeof raw !== 'object')
            return null;
        const kind = String(raw.kind || '');
        if (!PLANNER_ITEM_TYPES.includes(kind)) {
            throw new common_1.BadRequestException('Unknown plan type');
        }
        const courseId = String(raw.courseId ?? '').trim().slice(0, 40);
        if (!courseId)
            throw new common_1.BadRequestException('A plan needs a course');
        const hours = Number(raw.hours);
        const until = this.optionalDate(raw.until);
        return JSON.stringify({
            kind,
            courseId,
            hours: Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : 2,
            byDay: raw.byDay === false ? false : true,
            order: raw.order === 'subject' ? 'subject' : 'lesson',
            ...(until ? { until } : {}),
            ...(Array.isArray(raw.skip)
                ? { skip: raw.skip.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 5000) }
                : {}),
        });
    }
    parsePlannerRule(value) {
        if (!value)
            return null;
        try {
            const parsed = JSON.parse(String(value));
            return parsed && typeof parsed === 'object' ? parsed : null;
        }
        catch {
            return null;
        }
    }
    mapPlannerItem(item) {
        return {
            id: Number(item.id),
            title: String(item.title || ''),
            description: String(item.description || ''),
            dueDate: item.dueDate || '',
            status: item.status === 'done' ? 'done' : 'todo',
            category: this.normalizePlannerTaskCategory(item.category),
            itemType: PLANNER_ITEM_TYPES.includes(item.itemType) ? String(item.itemType) : null,
            itemId: item.itemId ? Number(item.itemId) : null,
            rule: item.rule && typeof item.rule === 'object' ? item.rule : null,
            priority: this.normalizePlannerTaskPriority(item.priority),
            estimatedMinutes: this.optionalPlannerEstimatedMinutes(item.estimatedMinutes),
            createdAt: item.createdAt || null,
            updatedAt: item.updatedAt || null,
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
            itemType: PLANNER_ITEM_TYPES.includes(row.item_type) ? String(row.item_type) : null,
            itemId: row.item_id ? Number(row.item_id) : null,
            rule: this.parsePlannerRule(row.rule_json),
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
WorkspaceService.ITEM_PATH = "SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id')), '.id', 1)";
exports.WorkspaceService = WorkspaceService = WorkspaceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        plans_service_1.PlansService,
        push_notifications_service_1.PushNotificationsService,
        notices_service_1.NoticesService])
], WorkspaceService);
//# sourceMappingURL=workspace.service.js.map