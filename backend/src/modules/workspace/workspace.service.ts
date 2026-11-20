import { NoticesService, Popup } from '../notices/notices.service';
import { cachedAdminRead } from '../../common/utils/admin-read-cache';
import { runInBatches } from '../../common/utils/run-in-batches';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { allowedSqlFragment } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
import { CourseStructureService } from '../courses/course-structure.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { getScopeRows } from '../../common/auth/subscription-scope';
import { finishedLessons, lessonIdsFromBits } from '../../common/utils/lesson-bits';
import { RecentResult, loadQuizInfo, loadRecentResults, mostMissedQuestions } from '../../common/utils/recent-results';
import { PLAN_ROW_TITLE, PlannerItem, newPlannerIds, readPlanItems } from '../../common/utils/planner-doc';
import { readSubscriptionGroups, readUserGroups } from '../../common/utils/admin-counters';

/// Ceiling on one generated plan. A plan covering every course is in the low
/// hundreds of items; this is clear of that and still stops a single request
/// becoming an unbounded insert.
const MAX_BULK_PLANNER_TASKS = 600;

type AdminReportFilterInput = {
  startDate?: string;
  endDate?: string;
  courseId?: string;
  userId?: string;
};

type AdminReportFilters = {
  startDate: string;
  endDate: string;
  courseId: number | null;
  userId: number | null;
};

type PlannerAgendaItem = {
  id: string;
  source: 'planner_task' | 'lesson_progress' | 'quiz' | 'review_signal';
  sourceId: number | null;
  type: 'task' | 'lesson' | 'quiz' | 'exam' | 'review' | 'flashcards';
  title: string;
  course: string;
  subject: string;
  topic: string;
  lesson: string;
  status: 'due_today' | 'overdue' | 'upcoming' | 'in_progress' | 'completed' | 'locked' | 'optional';
  dueAt: string | null;
  completedAt: unknown;
  progress: number | null;
  actionUrl: string;
  actionLabel: string;
  locked: boolean;
  accessMessage: string;
  priority: number;
  meta?: Record<string, unknown>;
};

type PlannerTaskCategory = 'general' | 'lesson' | 'quiz' | 'exam' | 'review' | 'flashcards';
type PlannerTaskPriority = 'low' | 'medium' | 'high';

const PLANNER_TASK_CATEGORIES = ['general', 'lesson', 'quiz', 'exam', 'review', 'flashcards'] as const;
const PLANNER_TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
// What a generated task can stand for. The app works out "done" for these from
// the lesson, Q-bank and flashcard data it already holds.
const PLANNER_ITEM_TYPES: readonly string[] = ['lesson', 'quiz', 'flashcards'];

type PlannerQuizAccessScopeRow = RowDataPacket & {
  feature_key: string | null;
  plan_slug: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
};

type PlannerQuizAccessProfile = {
  hasAnyPaidQuizAccess: boolean;
  hasFullAccess: boolean;
  courseIds: Set<number>;
};

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
] as const;

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly plansService: PlansService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly notices: NoticesService,
    private readonly structure: CourseStructureService,
  ) {}

  /**
   * Admin announcements = the in-app popups (OPTIMIZE 10 step 4): a centre
   * card or a Study Hub banner with a start/end time, a priority and an
   * audience, kept in a small JSON file (no database). Apps show one at a
   * time, highest priority first, once per device.
   */
  async listAdminAnnouncements(authorization?: string, _after?: number) {
    await this.authService.requireAdmin(authorization);
    return { items: this.notices.listPopups().map((p) => this.mapPopup(p)), next: null };
  }

  async createAnnouncement(authorization: string | undefined, input: any) {
    await this.authService.requireAdmin(authorization);
    const popup = this.notices.createPopup(input);
    return { ok: true, id: popup.id, overlapping: this.overlappingPopups(popup) };
  }

  async updateAnnouncement(authorization: string | undefined, id: number, input: any) {
    await this.authService.requireAdmin(authorization);
    const popup = this.notices.updatePopup(id, input);
    return { ok: true, id, overlapping: this.overlappingPopups(popup) };
  }

  async deleteAnnouncement(authorization: string | undefined, id: number) {
    await this.authService.requireAdmin(authorization);
    this.notices.deletePopup(id);
    return { ok: true, id };
  }

  /** Other active announcements whose time window overlaps this one (the page advises keeping one). */
  private overlappingPopups(popup: Popup) {
    if (popup.status !== 'active') return 0;
    const now = Date.now();
    // No start = shown from now; no end = shown for good. Only windows still
    // to come or running count, and only for people who would see both.
    const start = (p: Popup) => Math.max(now, p.startAt ? new Date(p.startAt).getTime() : now);
    const end = (p: Popup) => (p.endAt ? new Date(p.endAt).getTime() : Number.MAX_SAFE_INTEGER);
    const shared = (a: Popup, b: Popup) => a.audience === 'all' || b.audience === 'all' || a.audience === b.audience;
    return this.notices.listPopups().filter((p) => p.id !== popup.id && p.status === 'active'
      && shared(p, popup) && start(p) < end(popup) && start(popup) < end(p)).length;
  }

  private mapPopup(p: Popup) {
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

  /**
   * The notices list from the shared feed (no database): new content and
   * admin messages, newest first. Read and cleared state live on the device
   * (the app's inbox, the website's browser storage), so the endpoints below
   * that used to write it keep nothing.
   */
  async listNotifications(authorization?: string) {
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

  async dismissNotification(authorization: string | undefined, key: string) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: true, key: String(key || '').trim().slice(0, 190) };
  }

  async clearNotifications(authorization?: string) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: true, cleared: 0 };
  }

  async markAllNotificationsRead(authorization?: string) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: true, marked: 0 };
  }

  async markNotificationRead(authorization: string | undefined, id: number) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: true, id };
  }


  // ── Planner: ONE row per student (OPTIMIZE 10.12) ──────────────────────────
  // Every endpoint below keeps its old request and reply shape (the phone, the
  // website and older app builds use them unchanged) and is ONE statement on
  // the student's plan row, found by the UNIQUE plan_owner key.

  /** The plan row's items (1 row by the unique key), or none yet. */
  private async planItems(userId: number): Promise<PlannerItem[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT rule_json FROM study_planner_tasks WHERE plan_owner = ? LIMIT 1',
      [userId],
    );
    return readPlanItems(rows[0]?.rule_json);
  }

  /** Items in the old list order: no-date last, then plan position, newest first. */
  private sortPlanItems(items: PlannerItem[]): PlannerItem[] {
    const key = (i: PlannerItem) => (i.dueDate ? new Date(i.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
    return [...items].sort((a, b) => key(a) - key(b) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(b.id) - Number(a.id));
  }

  /** The JSON path of one item, found by its id inside the statement. */
  private static readonly ITEM_PATH =
    "SUBSTRING_INDEX(JSON_UNQUOTE(JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id')), '.id', 1)";

  async listPlannerTasks(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    return this.sortPlanItems(await this.planItems(student.id)).map((item) => this.mapPlannerItem(item));
  }

  async getPlannerAgenda(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const today = this.todayDateKey();
    const quizAccessProfile = null as any;

    const [taskRows, lessonRows, quizRows, reviewRows] = await Promise.all([
      // The student's own tasks from the plan row (1 row), as before: no plan
      // rules, first 80 in the list order.
      this.planItems(student.id).then((items) => [this.sortPlanItems(items.filter((i) => !i.rule)).slice(0, 80).map((i) => ({
        id: Number(i.id), title: i.title, description: i.description, due_date: i.dueDate || null, status: i.status,
        category: i.category, priority: i.priority, estimated_minutes: i.estimatedMinutes, created_at: i.createdAt, updated_at: i.updatedAt,
      }) as unknown as RowDataPacket)] as const),
      // Finished lessons from the student's bitmap (10.15), newest ids first.
      finishedLessons(this.db, student.id).then(async (done) => {
        const ids = [...done].sort((a, b) => b - a).slice(0, 36);
        if (!ids.length) return [[] as RowDataPacket[]] as const;
        // 2026-11-20: names from the course structure in memory (0 rows);
        // was 4 primary-key reads per lesson (72 rows for 18 lessons). Only a
        // finished lesson that is not in the structure (no notes, hidden) is
        // still read from the database.
        const snap = await this.structure.get().catch(() => null);
        const fromMemory: RowDataPacket[] = [];
        let missing = ids;
        if (snap) {
          const lessonById = new Map(snap.lessons.map((l) => [Number(l.id), l]));
          const courseById = new Map(snap.courses.map((c) => [Number(c.id), c]));
          const subjectById = new Map(snap.subjects.map((x) => [Number(x.id), x]));
          const topicById = new Map(snap.topics.map((t) => [Number(t.id), t]));
          missing = [];
          for (const id of ids) {
            const l = lessonById.get(id);
            if (!l) { missing.push(id); continue; }
            fromMemory.push({
              lesson_id: id, progress_status: 'completed', progress_percent: 100,
              started_at: null, completed_at: null, updated_at: null,
              lesson_title: l.lesson_title,
              course_title: courseById.get(Number(l.course_id))?.course_title ?? null,
              subject_name: subjectById.get(Number(l.topic_id))?.topic_name ?? null,
              topic_name: l.subtopic_id ? topicById.get(Number(l.subtopic_id))?.subtopic_name ?? null : null,
            } as unknown as RowDataPacket);
          }
          if (!missing.length) return [fromMemory] as const;
        }
        const [dbRows] = await this.db.execute<RowDataPacket[]>(
          `SELECT l.id AS lesson_id, 'completed' AS progress_status, 100 AS progress_percent,
                  NULL AS started_at, NULL AS completed_at, NULL AS updated_at,
                  l.lesson_title, c.course_title, subj.topic_name AS subject_name, sub.subtopic_name AS topic_name
             FROM lessons l
             LEFT JOIN courses c ON c.id = l.course_id
             LEFT JOIN topics subj ON subj.id = l.topic_id
             LEFT JOIN subtopics sub ON sub.id = l.subtopic_id
            WHERE l.status = 'active' AND l.id IN (${missing.map(() => '?').join(', ')})
            ORDER BY l.id DESC`,
          missing,
        );
        const rows = [...fromMemory, ...dbRows].sort((a, b) => Number(b.lesson_id) - Number(a.lesson_id));
        return [rows] as const;
      }),
      // 10.22: no quiz suggestions (premium sets are app-only on the website;
      // the attempt counts came from tables no longer written since 10.16) and
      // no "missed questions" scan over old per-answer rows (stale, ~5,000 rows).
      Promise.resolve([[] as RowDataPacket[]] as const),
      Promise.resolve([[] as RowDataPacket[]] as const),
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

  /** One new item from a request body (validated like the old row insert). */
  private plannerItemFrom(input: any, id: string, sortOrder: number): PlannerItem {
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

  /** Adds items to the plan row in ONE statement (creates the row the first time). */
  private async appendPlanItems(userId: number, items: PlannerItem[]) {
    await this.db.execute(
      `INSERT INTO study_planner_tasks (user_id, title, status, category, rule_json)
       VALUES (?, ?, 'todo', 'plan', ?)
       ON DUPLICATE KEY UPDATE rule_json = JSON_MERGE_PRESERVE(COALESCE(rule_json, '{"v":1,"items":[]}'), ?)`,
      [userId, PLAN_ROW_TITLE, JSON.stringify({ v: 1, items }), JSON.stringify({ items })],
    );
  }

  async createPlannerTask(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const [id] = newPlannerIds(1);
    await this.appendPlanItems(student.id, [this.plannerItemFrom(input, id, 0)]);
    return { ok: true, id: Number(id) };
  }

  /// Creates a whole generated plan in ONE request and ONE statement: the new
  /// items (normally one rule per course and kind) are added to the plan row,
  /// all or nothing. Generation is the paid part of the planner; the check
  /// reads the signed token's subscriptions (no SQL), else the database.
  async createPlannerTasksBulk(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const scopes = await getScopeRows(this.db, student.id);
    const paid = scopes.some((row) => String(row.plan_slug || '').toLowerCase() !== 'free');
    if (!paid) {
      throw new ForbiddenException('Generating a study plan is included with a subscription.');
    }
    const raw = Array.isArray(input?.tasks) ? input.tasks : null;
    if (!raw || !raw.length) throw new BadRequestException('No tasks to create');
    if (raw.length > MAX_BULK_PLANNER_TASKS) {
      throw new BadRequestException(`A plan can create at most ${MAX_BULK_PLANNER_TASKS} tasks at once.`);
    }
    // Validated before the write, every item, so a bad one fails the request
    // instead of saving half a plan. sortOrder keeps the plan's own order.
    const ids = newPlannerIds(raw.length);
    const items = raw.map((task: any, index: number) => this.plannerItemFrom(task, ids[index], index + 1));
    await this.appendPlanItems(student.id, items);
    return { ok: true, rules: true, ids: ids.map(Number) };
  }

  async updatePlannerTask(authorization: string | undefined, id: number, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const fields: Array<[string, unknown]> = [];
    if (input?.title !== undefined) fields.push(['title', this.requiredString(input.title, 'Task title')]);
    if (input?.description !== undefined) fields.push(['description', this.optionalString(input.description) || '']);
    if (input?.dueDate !== undefined) fields.push(['dueDate', this.optionalDate(input.dueDate) || '']);
    if (input?.status !== undefined) {
      const status = input.status === 'done' ? 'done' : input.status === 'todo' ? 'todo' : null;
      if (!status) throw new BadRequestException('Planner task status is invalid');
      fields.push(['status', status]);
    }
    if (input?.category !== undefined) fields.push(['category', this.normalizePlannerTaskCategory(input.category)]);
    if (input?.priority !== undefined) fields.push(['priority', this.normalizePlannerTaskPriority(input.priority)]);
    if (input?.estimatedMinutes !== undefined) fields.push(['estimatedMinutes', this.optionalPlannerEstimatedMinutes(input.estimatedMinutes)]);
    if (!fields.length) return { ok: true, id };
    fields.push(['updatedAt', new Date().toISOString()]);
    const key = String(id);
    const path = WorkspaceService.ITEM_PATH;
    // ONE statement: each field set at "<item path>.<field>", the item found by
    // its id inside the statement; no item with that id → nothing matched → 404.
    const sets = fields.map(([name]) => `CONCAT(${path}, '.${name}'), ?`).join(', ');
    const params: Array<string | number | null> = [];
    for (const [, value] of fields) params.push(key, value === null || value === undefined ? null : (value as string | number));
    params.push(student.id, key);
    const [res] = await this.db.execute<ResultSetHeader>(
      `UPDATE study_planner_tasks SET rule_json = JSON_SET(rule_json, ${sets})
        WHERE plan_owner = ? AND JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id') IS NOT NULL`,
      params,
    );
    if (!res.affectedRows) throw new NotFoundException('Planner task not found');
    return { ok: true, id };
  }

  /// Empties the student's plan row, in one statement. Only their own row:
  /// the WHERE is the student's unique plan key. The count comes back through
  /// LAST_INSERT_ID (no read).
  async clearPlannerTasks(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const [res] = await this.db.execute<ResultSetHeader>(
      `UPDATE study_planner_tasks
          SET id = id + 0 * LAST_INSERT_ID(COALESCE(JSON_LENGTH(rule_json, '$.items'), 0)),
              rule_json = '{"v":1,"items":[]}'
        WHERE plan_owner = ?`,
      [student.id],
    );
    return { ok: true, deleted: res.affectedRows ? Number(res.insertId || 0) : 0 };
  }

  async deletePlannerTask(authorization: string | undefined, id: number) {
    const student = await this.authService.requireStudent(authorization);
    const key = String(id);
    await this.db.execute(
      `UPDATE study_planner_tasks SET rule_json = JSON_REMOVE(rule_json, ${WorkspaceService.ITEM_PATH})
        WHERE plan_owner = ? AND JSON_SEARCH(rule_json, 'one', ?, NULL, '$.items[*].id') IS NOT NULL`,
      [key, student.id, key],
    );
    return { ok: true, id };
  }

  async getAdminReports(authorization?: string, rawFilters: AdminReportFilterInput = {}) {
    const admin = await this.authService.requireAdmin(authorization);
    const filters = this.normalizeAdminReportFilters(rawFilters);
    const canViewLearnerPii = this.canViewLearnerPii(admin);
    if (filters.userId && !canViewLearnerPii) {
      throw new ForbiddenException('Student management permission is required for learner-specific analytics');
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
    // Grouped statistics over all attempts/answers (an allowed exception in
    // OPTIMIZE section 0): the same filters within a minute reuse the result
    // instead of re-reading thousands of rows. The view is still audited above.
    const cacheKey = `reports:${canViewLearnerPii ? 'pii' : 'anon'}:${JSON.stringify(filters)}`;
    return cachedAdminRead(cacheKey, async () => {
    // 10.44: exam statistics come from the students' recent results (the
    // newest 5 per student on the summary row, written by every exam); the old
    // attempt / answer tables are gone. Date and course filters apply to each
    // result's day and its quiz's course.
    const allResults = await loadRecentResults(this.db, filters.userId);
    const quizInfo = await loadQuizInfo(this.db, allResults.map((r) => r.quizId));
    const inRange = (day: string) => (!filters.startDate || day >= filters.startDate) && (!filters.endDate || day <= filters.endDate);
    const inCourse = (r: RecentResult) => !filters.courseId || Number(quizInfo.get(r.quizId)?.course_id) === filters.courseId;
    const results = allResults.filter((r) => inRange(r.day) && inCourse(r));
    // The activity chart shows the last 30 days unless a date range is picked.
    const activityFrom = filters.startDate || filters.endDate ? '' : new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    const activityResults = activityFrom ? allResults.filter((r) => inCourse(r) && r.day >= activityFrom) : results;


    const courseFunnelWhere = ['1=1'];
    const courseFunnelParams: any[] = [];
    this.appendCourseFilter(courseFunnelWhere, courseFunnelParams, 'c.id', filters);
    const courseFunnelJoinConditions = ['1=1'];
    const courseFunnelJoinParams: any[] = [];
    this.appendDateFilter(courseFunnelJoinConditions, courseFunnelJoinParams, 'slp.updated_at', filters);
    this.appendUserFilter(courseFunnelJoinConditions, courseFunnelJoinParams, 'slp.user_id', filters);

    const subscriptionStatusWhere = ['1=1'];
    const subscriptionStatusParams: any[] = [];
    this.appendDateFilter(subscriptionStatusWhere, subscriptionStatusParams, 'us.updated_at', filters);
    this.appendUserFilter(subscriptionStatusWhere, subscriptionStatusParams, 'us.user_id', filters);

    const paymentStatusWhere = ['1=1'];
    const paymentStatusParams: any[] = [];
    this.appendDateFilter(paymentStatusWhere, paymentStatusParams, 'pt.created_at', filters);
    this.appendUserFilter(paymentStatusWhere, paymentStatusParams, 'pt.user_id', filters);

    const bitmapStats = this.lessonBitmapStats({ ...filters, courseId: null });
    bitmapStats.catch(() => undefined); // awaited below; avoids an unhandled rejection before the batch reaches it
    const [
      [users],
      [attempts],
      [lessons],
      hardQuestions,
      inactiveStudents,
      activityHeatmap,
      quizPerformance,
      courseFunnel,
      subscriptionStatus,
      paymentStatus,
    ] = await runInBatches([
      // 10.57: from the stored counters (live users by role / status), not a count over every user.
      (): Promise<[RowDataPacket[], unknown]> => readUserGroups(this.db).then((groups) => [[{
        total: groups.reduce((n, g) => n + g.n, 0),
        students: groups.filter((g) => g.role === 'student').reduce((n, g) => n + g.n, 0),
        pending: groups.filter((g) => g.status === 'inactive').reduce((n, g) => n + g.n, 0),
      } as unknown as RowDataPacket], []]),
      (): Promise<[RowDataPacket[], unknown]> => Promise.resolve([[{
        attempts: results.length,
        avg_score: results.length ? results.reduce((n, r) => n + r.pct, 0) / results.length : 0,
        passes: results.filter((r) => r.passed).length,
      } as unknown as RowDataPacket], []]),
      // Finished lessons from the students' bitmaps (10.15: no per-lesson rows
      // or dates any more, so the date filter does not apply to lessons).
      // 10.57: one bitmap pass (all courses) serves both this total and the course funnel.
      (): Promise<[RowDataPacket[], unknown]> => bitmapStats.then((st) => {
        const total = filters.courseId ? (st.byCourse.get(filters.courseId)?.completed || 0) : st.total;
        return [[{ total, completed: total } as unknown as RowDataPacket], []];
      }),
      // Most-missed questions: each result's answers checked against the
      // question's options (one read of the answered questions).
      (): Promise<[RowDataPacket[], unknown]> => mostMissedQuestions(this.db, results, 8)
        .then((list) => [list.map((q) => ({ id: q.id, question_text: q.text, wrong_count: q.wrongCount })) as unknown as RowDataPacket[], []]),
      // 10.57: students never active first (walking user ids, stops at 10), then
      // the least recently active by the summary's (last_active_day) index.
      // Deleted accounts are left out. Was a join + sort over every student.
      (): Promise<[RowDataPacket[], unknown]> => this.inactiveStudents(filters.userId).then((rows) => [rows, []]),
      // Exams per day (10.44: from the recent results; no activity log since 10.28).
      (): Promise<[RowDataPacket[], unknown]> => {
        const days = new Map<string, { students: Set<number>; exams: number }>();
        for (const r of activityResults) {
          const d = days.get(r.day) || { students: new Set<number>(), exams: 0 };
          d.students.add(r.userId); d.exams += 1; days.set(r.day, d);
        }
        const rows = [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([day, d]) => ({
          day_key: day, active_students: d.students.size, quiz_attempts: d.exams, study_events: 0,
        }));
        return Promise.resolve([rows as unknown as RowDataPacket[], []]);
      },
      // Per quiz (10.44: from the recent results): results, passes, average.
      (): Promise<[RowDataPacket[], unknown]> => {
        const perQuiz = new Map<number, { n: number; passes: number; sum: number }>();
        for (const r of results) {
          const q = perQuiz.get(r.quizId) || { n: 0, passes: 0, sum: 0 };
          q.n += 1; q.passes += r.passed ? 1 : 0; q.sum += r.pct; perQuiz.set(r.quizId, q);
        }
        const rows = [...perQuiz.entries()]
          .filter(([id]) => quizInfo.has(id))
          .map(([id, q]) => {
            const info = quizInfo.get(id)!;
            return {
              id, quiz_title: (info.student_title || '').trim() || info.quiz_title, course_title: info.course_title || '',
              attempts: q.n, passes: q.passes, fails: q.n - q.passes, average_percentage: q.n ? q.sum / q.n : 0,
            };
          })
          .sort((x, y) => y.attempts - x.attempts || x.average_percentage - y.average_percentage)
          .slice(0, 10);
        return Promise.resolve([rows as unknown as RowDataPacket[], []]);
      },
      (): Promise<[RowDataPacket[], unknown]> => Promise.all([
        // 10.57: lessons per course = the stored count (Structure page rule), not a count of every lesson.
        this.db.execute<RowDataPacket[]>(`
          SELECT c.id, c.course_title, c.lesson_count AS total_lessons
          FROM courses c
          WHERE ${courseFunnelWhere.join(' AND ')}
        `, courseFunnelParams),
        bitmapStats,
      ]).then(([[courses], st]) => {
        // Students started / lessons finished per course from the bitmaps (10.15).
        const rows = courses.map((c: RowDataPacket) => {
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
        return [rows.slice(0, 8) as unknown as RowDataPacket[], []];
      }),
      // 10.57: no date / student filter → the stored counters (summed by status).
      (): Promise<[RowDataPacket[], unknown]> => (subscriptionStatusParams.length
        ? this.db.execute<RowDataPacket[]>(`
          SELECT status, COUNT(*) AS count_value
          FROM user_subscriptions us
          WHERE ${subscriptionStatusWhere.join(' AND ')}
          GROUP BY status
        `, subscriptionStatusParams)
        : readSubscriptionGroups(this.db).then((groups) => {
          const byStatus = new Map<string, number>();
          for (const g of groups) byStatus.set(g.status, (byStatus.get(g.status) || 0) + g.n);
          return [[...byStatus.entries()].map(([status, n]) => ({ status, count_value: n })) as unknown as RowDataPacket[], []];
        })),
      () => this.db.execute<RowDataPacket[]>(`
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

  async createQuestionReport(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const questionId = Number(input?.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      throw new BadRequestException('Question ID is required');
    }
    const reason = this.optionalString(input?.reason) || 'Student reported this question';
    const comment = this.optionalString(input?.comment);
    // One statement (2026-11-17): the insert only happens when the question
    // exists and is active — no separate SELECT first.
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO question_reports (question_id, user_id, reason, comment, status)
       SELECT id, ?, ?, ?, 'open' FROM questions WHERE id = ? AND status = 'active'`,
      [student.id, reason.slice(0, 120), comment, questionId]
    );
    if (!result.affectedRows) throw new NotFoundException('Question not found');
    return { ok: true, id: result.insertId, questionId };
  }

  async listQuestionReports(authorization?: string, status?: string) {
    await this.authService.requireAdmin(authorization);
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (['open', 'resolved', 'rejected'].includes(String(status || ''))) {
      where += ' AND qr.status = ?';
      params.push(status);
    }
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
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
      `,
      params
    );
    return rows.map((row) => this.mapQuestionReport(row));
  }

  async updateQuestionReport(authorization: string | undefined, id: number, input: any) {
    await this.authService.requireAdmin(authorization);
    const status = ['open', 'resolved', 'rejected'].includes(input?.status) ? input.status : null;
    if (!status) throw new BadRequestException('Report status is invalid');
    await this.db.execute(
      `UPDATE question_reports SET status = ? WHERE id = ?`,
      [status, id]
    );
    return { ok: true, id };
  }

  private mapPlannerAgendaTask(row: RowDataPacket, today: string): PlannerAgendaItem {
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

  private mapPlannerAgendaLesson(row: RowDataPacket): PlannerAgendaItem {
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

  private mapPlannerAgendaQuiz(row: RowDataPacket, accessProfile: PlannerQuizAccessProfile): PlannerAgendaItem {
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

  private mapPlannerAgendaReview(row: RowDataPacket, index: number, today: string): PlannerAgendaItem {
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

  private comparePlannerAgendaItems(left: PlannerAgendaItem, right: PlannerAgendaItem) {
    if (right.priority !== left.priority) return right.priority - left.priority;
    const leftDue = left.dueAt || '9999-12-31';
    const rightDue = right.dueAt || '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return left.title.localeCompare(right.title);
  }

  private buildPlannerAgendaFilters(items: PlannerAgendaItem[]) {
    const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
    return {
      courses: unique(items.map((item) => item.course)),
      subjects: unique(items.map((item) => item.subject)),
      topics: unique(items.map((item) => item.topic)),
      lessons: unique(items.map((item) => item.lesson)),
    };
  }

  private summarizePlannerAgenda(items: PlannerAgendaItem[]) {
    return {
      today: items.filter((item) => item.status === 'due_today' || item.status === 'in_progress').length,
      overdue: items.filter((item) => item.status === 'overdue').length,
      upcoming: items.filter((item) => item.status === 'upcoming' || item.status === 'optional' || item.status === 'locked').length,
      completed: items.filter((item) => item.status === 'completed').length,
      total: items.length,
    };
  }

  private async getPlannerQuizAccessProfile(userId: number): Promise<PlannerQuizAccessProfile> {
    const [rows] = await this.db.execute<PlannerQuizAccessScopeRow[]>(
      `
        SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())
      `,
      [userId]
    );

    const profile: PlannerQuizAccessProfile = {
      hasAnyPaidQuizAccess: rows.length > 0,
      hasFullAccess: false,
      courseIds: new Set<number>(),
    };

    for (const row of rows) {
      const courseIds = this.parsePlannerIdList(row.course_ids_json);
      const scope = this.resolvePlannerAccessScope(row, courseIds);
      if (scope === 'all' && courseIds.length === 0) {
        profile.hasFullAccess = true;
      } else if (scope === 'courses') {
        courseIds.forEach((id) => profile.courseIds.add(id));
      }
    }

    return profile;
  }

  private canAccessPlannerQuiz(row: RowDataPacket, profile: PlannerQuizAccessProfile) {
    if (Number(row.is_free) === 1) return true;
    if (!profile.hasAnyPaidQuizAccess) return false;
    if (profile.hasFullAccess) return true;
    return profile.courseIds.has(Number(row.course_id));
  }

  private resolvePlannerAccessScope(row: PlannerQuizAccessScopeRow, courseIds: number[]) {
    const planSlug = String(row.plan_slug || '').trim();
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : 'all');
  }

  private parsePlannerIdList(raw: unknown) {
    try {
      const parsed = raw ? JSON.parse(String(raw)) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  private plannerStatusForDueDate(dueAt: string | null, today: string): PlannerAgendaItem['status'] {
    if (!dueAt) return 'optional';
    if (dueAt < today) return 'overdue';
    if (dueAt === today) return 'due_today';
    return 'upcoming';
  }

  private clampPlannerPercent(value: unknown) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  private todayDateKey() {
    return this.formatPlannerDateKey(new Date());
  }

  private dateKey(value: unknown) {
    if (!value) return null;
    if (value instanceof Date) return this.formatPlannerDateKey(value);
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? this.formatPlannerDateKey(new Date(parsed)) : null;
  }

  private formatPlannerDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private slugPlannerId(value: string) {
    return String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'item';
  }

  private canViewLearnerPii(user: { role?: string; permissions?: string[] }) {
    return user.role === 'admin' || Boolean(user.permissions?.includes('students.manage'));
  }

  private anonymizedLearnerRef(value: unknown) {
    const digest = createHash('sha256')
      .update(`learner:${String(value || '')}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
    return `Learner ${digest}`;
  }

  private async logAdminAuditEvent(input: {
    eventType: string;
    actorId?: number | null;
    targetType?: string | null;
    targetId?: number | null;
    summary: string;
    metadata?: unknown;
  }) {
    void 0; // 10.37: change history no longer stored (table dropped, never read)
  }

  private normalizeAdminReportFilters(input: AdminReportFilterInput): AdminReportFilters {
    return {
      startDate: this.optionalDate(input.startDate) || '',
      endDate: this.optionalDate(input.endDate) || '',
      courseId: this.optionalPositiveInteger(input.courseId),
      userId: this.optionalPositiveInteger(input.userId),
    };
  }

  private appendDateFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    const safeColumn = allowedSqlFragment(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report date column');
    if (filters.startDate) {
      where.push(`DATE(${safeColumn}) >= ?`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      where.push(`DATE(${safeColumn}) <= ?`);
      params.push(filters.endDate);
    }
  }



  /** Reports "inactive students" (10.57): up to 10, never-active first (by id),
   * then least recently active. Each read stops at the rows it returns. */
  private async inactiveStudents(userId: number | null): Promise<RowDataPacket[]> {
    if (userId) {
      const [rows] = await this.db.query<RowDataPacket[]>(
        `SELECT u.id, u.full_name, u.email, s.last_active_day AS last_activity
         FROM users u LEFT JOIN student_study_summary s ON s.user_id = u.id
         WHERE u.id = ? AND u.role = 'student' AND u.deleted_at IS NULL`, [userId]);
      return rows;
    }
    const [never] = await this.db.query<RowDataPacket[]>(
      `SELECT u.id, u.full_name, u.email, NULL AS last_activity
       FROM users u FORCE INDEX (PRIMARY)
       WHERE u.role = 'student' AND u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM student_study_summary s WHERE s.user_id = u.id AND s.last_active_day IS NOT NULL)
       ORDER BY u.id ASC LIMIT 10`);
    if (never.length >= 10) return never;
    const [quiet] = await this.db.query<RowDataPacket[]>(
      `SELECT u.id, u.full_name, u.email, s.last_active_day AS last_activity
       FROM student_study_summary s FORCE INDEX (idx_summary_last_active)
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.last_active_day IS NOT NULL AND u.role = 'student' AND u.deleted_at IS NULL
       ORDER BY s.last_active_day ASC, s.user_id ASC LIMIT ?`, [10 - never.length]);
    return [...never, ...quiet];
  }

  /**
   * Finished-lesson counts from the students' bitmaps (10.15): total, and per
   * course (students with any finished lesson there, lessons finished). Admin
   * reports only (cached with the report); reads the bitmaps of students who
   * have any, and each active lesson's course.
   */
  private async lessonBitmapStats(filters: AdminReportFilters) {
    const params: number[] = [];
    let where = 'lessons_done IS NOT NULL';
    if (filters.userId) { where += ' AND user_id = ?'; params.push(filters.userId); }
    const [students] = await this.db.execute<RowDataPacket[]>(`SELECT user_id, lessons_done FROM student_study_summary WHERE ${where}`, params);
    // 10.57: the course of the finished lessons only (by id), not every lesson.
    const finishedIds = [...new Set(students.flatMap((st) => lessonIdsFromBits(st.lessons_done)))];
    const [lessons] = finishedIds.length
      ? await this.db.query<RowDataPacket[]>(`SELECT id, course_id FROM lessons WHERE id IN (?) AND status = 'active'`, [finishedIds])
      : [[] as RowDataPacket[]];
    const courseOf = new Map(lessons.map((l) => [Number(l.id), Number(l.course_id)]));
    const byCourse = new Map<number, { students: number; completed: number }>();
    let total = 0;
    for (const st of students) {
      const seen = new Set<number>();
      for (const id of lessonIdsFromBits(st.lessons_done)) {
        const course = courseOf.get(id);
        if (course === undefined) continue;
        if (filters.courseId && course !== filters.courseId) continue;
        total++;
        const entry = byCourse.get(course) || { students: 0, completed: 0 };
        entry.completed++;
        if (!seen.has(course)) { entry.students++; seen.add(course); }
        byCourse.set(course, entry);
      }
    }
    return { total, byCourse };
  }

  private appendUserFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (!filters.userId) return;
    const safeColumn = allowedSqlFragment(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report user column');
    where.push(`${safeColumn} = ?`);
    params.push(filters.userId);
  }

  private appendCourseFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (!filters.courseId) return;
    const safeColumn = allowedSqlFragment(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report course column');
    where.push(`${safeColumn} = ?`);
    params.push(filters.courseId);
  }

  private optionalPositiveInteger(value: unknown) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  private requiredString(value: unknown, label: string) {
    const text = String(value || '').trim();
    if (!text) throw new BadRequestException(`${label} is required`);
    return text;
  }

  private optionalString(value: unknown) {
    return String(value || '').trim();
  }

  private optionalDate(value: unknown) {
    const text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  private normalizePlannerTaskCategory(value: unknown): PlannerTaskCategory {
    const text = String(value || '').trim().toLowerCase();
    return (PLANNER_TASK_CATEGORIES as readonly string[]).includes(text) ? text as PlannerTaskCategory : 'general';
  }

  private normalizePlannerTaskPriority(value: unknown): PlannerTaskPriority {
    const text = String(value || '').trim().toLowerCase();
    return (PLANNER_TASK_PRIORITIES as readonly string[]).includes(text) ? text as PlannerTaskPriority : 'medium';
  }

  private optionalPlannerEstimatedMinutes(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 0) throw new BadRequestException('Estimated minutes must be a non-negative whole number');
    return Math.min(minutes, 600);
  }

  /**
   * The lesson or quiz a task stands for. Both parts or neither: a type with
   * no id (or an id with no type) is dropped rather than half-saved.
   */
  private normalizePlannerItemLink(input: any): { type: string | null; id: number | null } {
    const type = PLANNER_ITEM_TYPES.includes(input?.itemType) ? String(input.itemType) : null;
    const id = Number(input?.itemId);
    if (!type || !Number.isInteger(id) || id <= 0) return { type: null, id: null };
    return { type, id };
  }

  /// A plan saved as ONE rule row ("Medicine, all lessons, 3 a day from
  /// 12 Nov") instead of a row per lesson. The phone already holds every lesson,
  /// quiz and deck, so it works the days out itself; the server only keeps the
  /// rule. Returns the JSON to store, or null for an ordinary task.
  private normalizePlannerRule(raw: any): string | null {
    if (!raw || typeof raw !== 'object') return null;
    const kind = String(raw.kind || '');
    if (!PLANNER_ITEM_TYPES.includes(kind)) {
      throw new BadRequestException('Unknown plan type');
    }
    const courseId = String(raw.courseId ?? '').trim().slice(0, 40);
    if (!courseId) throw new BadRequestException('A plan needs a course');
    const hours = Number(raw.hours);
    const until = this.optionalDate(raw.until);
    return JSON.stringify({
      kind,
      courseId,
      hours: Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : 2,
      byDay: raw.byDay === false ? false : true,
      // How the plan is ordered: lesson by lesson (default) or subject by subject.
      order: raw.order === 'subject' ? 'subject' : 'lesson',
      ...(until ? { until } : {}),
      // Ids already finished when the plan was made, so its days stay put.
      ...(Array.isArray(raw.skip)
        ? { skip: raw.skip.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 5000) }
        : {}),
    });
  }

  private parsePlannerRule(value: unknown) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /** A plan item in the old row reply shape (same fields, numeric id). */
  private mapPlannerItem(item: PlannerItem) {
    return {
      id: Number(item.id),
      title: String(item.title || ''),
      description: String(item.description || ''),
      dueDate: item.dueDate || '',
      status: item.status === 'done' ? 'done' : 'todo',
      category: this.normalizePlannerTaskCategory(item.category),
      itemType: PLANNER_ITEM_TYPES.includes(item.itemType as string) ? String(item.itemType) : null,
      itemId: item.itemId ? Number(item.itemId) : null,
      rule: item.rule && typeof item.rule === 'object' ? item.rule : null,
      priority: this.normalizePlannerTaskPriority(item.priority),
      estimatedMinutes: this.optionalPlannerEstimatedMinutes(item.estimatedMinutes),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    };
  }

  private mapPlannerTask(row: RowDataPacket) {
    return {
      id: Number(row.id),
      title: String(row.title || ''),
      description: String(row.description || ''),
      dueDate: this.dateKey(row.due_date) || '',
      status: String(row.status || 'todo'),
      category: this.normalizePlannerTaskCategory(row.category),
      // The real lesson or quiz this task stands for, when it was generated
      // from one. The app works out "done" from the lesson/quiz data it already
      // holds, so a linked task is finished by finishing the thing itself.
      itemType: PLANNER_ITEM_TYPES.includes(row.item_type) ? String(row.item_type) : null,
      itemId: row.item_id ? Number(row.item_id) : null,
      rule: this.parsePlannerRule(row.rule_json),
      priority: this.normalizePlannerTaskPriority(row.priority),
      estimatedMinutes: this.optionalPlannerEstimatedMinutes(row.estimated_minutes),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  private mapQuestionReport(row: RowDataPacket) {
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

}
