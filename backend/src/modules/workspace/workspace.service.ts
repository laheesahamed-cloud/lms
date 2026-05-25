import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { allowedSqlFragment } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

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
] as const;

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly pushNotificationsService: PushNotificationsService
  ) {}

  async listAdminAnnouncements(authorization?: string) {
    await this.authService.requireAdmin(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(`
      SELECT a.*, u.full_name AS created_by_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    return rows.map(this.mapAnnouncement);
  }

  async createAnnouncement(authorization: string | undefined, input: any) {
    const admin = await this.authService.requireAdmin(authorization);
    const payload = this.normalizeAnnouncementInput(input);
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO announcements (title, body, target_role, status, publish_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [payload.title, payload.body, payload.targetRole, payload.status, payload.publishAt, admin.id]
    );
    if (payload.status === 'published' && !payload.publishAt) {
      this.pushNotificationsService.sendAnnouncementPush({
        title: payload.title,
        body: payload.body,
        targetRole: payload.targetRole,
        url: '/notifications',
      }).catch((error) => {
        // The in-app announcement is already saved; push delivery is best-effort.
        // Invalid subscriptions are cleaned up inside PushNotificationsService.
        console.warn(`Announcement push failed: ${error?.message || error}`);
      });
    }
    return { ok: true, id: result.insertId };
  }

  async updateAnnouncement(authorization: string | undefined, id: number, input: any) {
    await this.authService.requireAdmin(authorization);
    const payload = this.normalizeAnnouncementInput(input);
    await this.db.execute(
      `UPDATE announcements SET title = ?, body = ?, target_role = ?, status = ?, publish_at = ? WHERE id = ?`,
      [payload.title, payload.body, payload.targetRole, payload.status, payload.publishAt, id]
    );
    return { ok: true, id };
  }

  async deleteAnnouncement(authorization: string | undefined, id: number) {
    await this.authService.requireAdmin(authorization);
    await this.db.execute('DELETE FROM announcement_reads WHERE announcement_id = ?', [id]);
    await this.db.execute('DELETE FROM announcements WHERE id = ?', [id]);
    return { ok: true, id };
  }

  async listNotifications(authorization?: string) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT a.*, ar.id AS read_id
        FROM announcements a
        LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
        WHERE a.status = 'published'
          AND (a.publish_at IS NULL OR a.publish_at <= NOW())
          AND (a.target_role = 'all' OR a.target_role = ?)
        ORDER BY a.created_at DESC
        LIMIT 80
      `,
      [user.id, user.role]
    );
    const announcements = rows.map((row) => ({
      ...this.mapAnnouncement(row),
      kind: 'announcement',
      read: Boolean(row.read_id),
      actionPath: '',
    }));

    if (user.role !== 'student') {
      return announcements;
    }

    const [subscriptionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT us.status, us.payment_status, us.end_date, p.name AS plan_name, us.updated_at
       FROM user_subscriptions us
       LEFT JOIN plans p ON p.id = us.plan_id
       WHERE us.user_id = ?
       ORDER BY us.updated_at DESC, us.id DESC
       LIMIT 3`,
      [user.id]
    );
    const [weakRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.topic_name, c.course_title, AVG(qa.percentage) AS average_percentage, MAX(COALESCE(qa.submitted_at, qa.created_at)) AS latest_at
       FROM quiz_attempts qa
       INNER JOIN quizzes q ON q.id = qa.quiz_id
       LEFT JOIN topics t ON t.id = q.topic_id
       LEFT JOIN courses c ON c.id = q.course_id
       WHERE qa.user_id = ? AND qa.status = 'submitted'
       GROUP BY q.topic_id, t.topic_name, c.course_title
       HAVING average_percentage < 55
       ORDER BY average_percentage ASC, latest_at DESC
       LIMIT 1`,
      [user.id]
    );

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

  private formatPaymentStatusLabel(value: unknown) {
    const status = String(value || '').trim().toLowerCase();
    if (this.isFreePlanPaymentStatus(status)) return 'Free Plan';
    if (!status) return 'Manual';
    return status
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private isFreePlanPaymentStatus(value: unknown) {
    const status = String(value || '').trim().toLowerCase();
    return status === 'waived' || status === 'free' || status === 'free_plan';
  }

  async markNotificationRead(authorization: string | undefined, id: number) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    await this.db.execute(
      `INSERT IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)`,
      [id, user.id]
    );
    return { ok: true, id };
  }

  async listPlannerTasks(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM study_planner_tasks WHERE user_id = ? ORDER BY COALESCE(due_date, '9999-12-31') ASC, sort_order ASC, id DESC`,
      [student.id]
    );
    return rows.map(this.mapPlannerTask);
  }

  async listPlannerSuggestions(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const [[summary]] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) attempts, AVG(percentage) avg_score
       FROM quiz_attempts
       WHERE user_id = ? AND status = 'submitted'`,
      [student.id]
    );
    const [weakRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT c.course_title, t.topic_name, AVG(qa.percentage) AS average_percentage, COUNT(*) attempts
       FROM quiz_attempts qa
       INNER JOIN quizzes q ON q.id = qa.quiz_id
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE qa.user_id = ? AND qa.status = 'submitted'
       GROUP BY q.topic_id, c.course_title, t.topic_name
       ORDER BY average_percentage ASC, attempts DESC
       LIMIT 3`,
      [student.id]
    );
    const [wrongRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT sa.question_id) wrong_questions
       FROM student_answers sa
       INNER JOIN quiz_attempts qa ON qa.id = sa.attempt_id
       INNER JOIN question_options qo ON qo.id = sa.option_id
       INNER JOIN questions q ON q.id = sa.question_id
       WHERE qa.user_id = ?
         AND qa.status = 'submitted'
         AND ((q.question_type = 'sba' AND sa.is_selected = 1 AND qo.is_correct = 0)
           OR (q.question_type = 'true_false' AND sa.is_selected <> qo.is_correct))`,
      [student.id]
    );
    const attempts = Number(summary?.attempts || 0);
    const avgScore = Number(summary?.avg_score || 0);
    const suggestions = weakRows.map((row, index) => ({
      key: `weak-${index}-${String(row.topic_name || 'general')}`,
      title: `Review ${String(row.topic_name || 'weak topic')}`,
      description: `${String(row.course_title || 'Course')} average is ${Number(row.average_percentage || 0).toFixed(1)}%. Revisit notes, then do practice questions.`,
      dueInDays: index + 1,
      priority: index === 0 ? 'high' : 'medium',
    }));

    if (Number(wrongRows[0]?.wrong_questions || 0) > 0) {
      suggestions.push({
        key: 'wrong-answer-loop',
        title: 'Redo missed questions',
        description: `${Number(wrongRows[0].wrong_questions || 0)} questions have recent wrong-answer signals. Review explanations before another full quiz.`,
        dueInDays: 1,
        priority: 'high',
      });
    }

    suggestions.push({
      key: 'catch-up',
      title: attempts === 0 ? 'Set a baseline quiz' : avgScore < 55 ? 'Catch-up revision block' : 'Maintain study streak',
      description: attempts === 0
        ? 'Take one short practice quiz so the planner can adapt to real performance.'
        : avgScore < 55
          ? 'Schedule a 30-minute review block before your next exam attempt.'
          : 'Add one light recall task to keep momentum active.',
      dueInDays: 0,
      priority: avgScore < 55 ? 'high' : 'medium',
    });

    return suggestions.slice(0, 5);
  }

  async createPlannerTask(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const title = this.requiredString(input?.title, 'Task title');
    const description = this.optionalString(input?.description);
    const dueDate = this.optionalDate(input?.dueDate);
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO study_planner_tasks (user_id, title, description, due_date, status) VALUES (?, ?, ?, ?, 'todo')`,
      [student.id, title, description, dueDate]
    );
    return { ok: true, id: result.insertId };
  }

  async updatePlannerTask(authorization: string | undefined, id: number, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT id FROM study_planner_tasks WHERE id = ? AND user_id = ? LIMIT 1', [id, student.id]);
    if (!rows[0]) throw new NotFoundException('Planner task not found');
    const updates: string[] = [];
    const values: any[] = [];
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
      if (!status) throw new BadRequestException('Planner task status is invalid');
      updates.push('status = ?');
      values.push(status);
    }
    if (!updates.length) {
      return { ok: true, id };
    }
    values.push(id, student.id);
    await this.db.execute(
      `UPDATE study_planner_tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    return { ok: true, id };
  }

  async deletePlannerTask(authorization: string | undefined, id: number) {
    const student = await this.authService.requireStudent(authorization);
    await this.db.execute('DELETE FROM study_planner_tasks WHERE id = ? AND user_id = ?', [id, student.id]);
    return { ok: true, id };
  }

  async getAdminReports(authorization?: string, rawFilters: AdminReportFilterInput = {}) {
    await this.authService.requireAdmin(authorization);
    const filters = this.normalizeAdminReportFilters(rawFilters);
    const attemptWhere = ['qa.status = \'submitted\''];
    const attemptParams: any[] = [];
    this.appendDateFilter(attemptWhere, attemptParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
    this.appendUserFilter(attemptWhere, attemptParams, 'qa.user_id', filters);
    this.appendCourseFilter(attemptWhere, attemptParams, 'q.course_id', filters);

    const lessonWhere = ['1=1'];
    const lessonParams: any[] = [];
    this.appendDateFilter(lessonWhere, lessonParams, 'slp.updated_at', filters);
    this.appendUserFilter(lessonWhere, lessonParams, 'slp.user_id', filters);
    this.appendCourseFilter(lessonWhere, lessonParams, 'slp.course_id', filters);

    const hardQuestionWhere = [
      'qa.status = \'submitted\'',
      'sa.is_selected = 1',
      'qo.is_correct = 0',
    ];
    const hardQuestionParams: any[] = [];
    this.appendDateFilter(hardQuestionWhere, hardQuestionParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
    this.appendUserFilter(hardQuestionWhere, hardQuestionParams, 'qa.user_id', filters);
    this.appendCourseFilter(hardQuestionWhere, hardQuestionParams, 'COALESCE(q.course_id, quiz.course_id)', filters);

    const inactiveWhere = ['u.role = \'student\''];
    const inactiveParams: any[] = [];
    this.appendUserFilter(inactiveWhere, inactiveParams, 'u.id', filters);

    const activityParams: any[] = [];
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
    const quizPerformanceParams: any[] = [];
    this.appendDateFilter(quizPerformanceWhere, quizPerformanceParams, 'COALESCE(qa.submitted_at, qa.created_at)', filters);
    this.appendUserFilter(quizPerformanceWhere, quizPerformanceParams, 'qa.user_id', filters);
    this.appendCourseFilter(quizPerformanceWhere, quizPerformanceParams, 'q.course_id', filters);

    const courseFunnelWhere = ['1=1'];
    const courseFunnelParams: any[] = [];
    this.appendCourseFilter(courseFunnelWhere, courseFunnelParams, 'c.id', filters);
    const courseFunnelJoinConditions = ['slp.course_id = c.id'];
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
    ] = await Promise.all([
      this.db.execute<RowDataPacket[]>(`SELECT COUNT(*) total, SUM(role='student') students, SUM(status='inactive') pending FROM users`),
      this.db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) attempts, AVG(qa.percentage) avg_score, SUM(qa.pass_status='pass') passes
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         WHERE ${attemptWhere.join(' AND ')}`,
        attemptParams
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) total, SUM(slp.status='completed') completed
         FROM student_lesson_progress slp
         WHERE ${lessonWhere.join(' AND ')}`,
        lessonParams
      ),
      this.db.execute<RowDataPacket[]>(`
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
      this.db.execute<RowDataPacket[]>(`
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
      this.db.execute<RowDataPacket[]>(`
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
      this.db.execute<RowDataPacket[]>(`
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
      this.db.execute<RowDataPacket[]>(`
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
      this.db.execute<RowDataPacket[]>(`
        SELECT status, COUNT(*) AS count_value
        FROM user_subscriptions us
        WHERE ${subscriptionStatusWhere.join(' AND ')}
        GROUP BY status
      `, subscriptionStatusParams),
      this.db.execute<RowDataPacket[]>(`
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
        id: Number(row.id),
        fullName: String(row.full_name || ''),
        email: String(row.email || ''),
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

  async createQuestionReport(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const questionId = Number(input?.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      throw new BadRequestException('Question ID is required');
    }
    const reason = this.optionalString(input?.reason) || 'Student reported this question';
    const comment = this.optionalString(input?.comment);
    const [questionRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id FROM questions WHERE id = ? AND status = 'active' LIMIT 1",
      [questionId]
    );
    if (!questionRows[0]) throw new NotFoundException('Question not found');

    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO question_reports (question_id, user_id, reason, comment, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [questionId, student.id, reason.slice(0, 120), comment]
    );
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
    return rows.map(this.mapQuestionReport);
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

  private appendActivityDateFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (filters.startDate || filters.endDate) {
      this.appendDateFilter(where, params, column, filters);
      return;
    }
    const safeColumn = allowedSqlFragment(column, ADMIN_REPORT_FILTER_COLUMNS, 'admin report activity date column');
    where.push(`${safeColumn} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`);
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

  private normalizeAnnouncementInput(input: any) {
    return {
      title: this.requiredString(input?.title, 'Title'),
      body: this.requiredString(input?.body, 'Message'),
      targetRole: ['all', 'student', 'admin'].includes(input?.targetRole) ? input.targetRole : 'student',
      status: ['draft', 'published', 'archived'].includes(input?.status) ? input.status : 'published',
      publishAt: input?.publishAt ? String(input.publishAt) : null,
    };
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

  private mapAnnouncement(row: RowDataPacket) {
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

  private mapPlannerTask(row: RowDataPacket) {
    return {
      id: Number(row.id),
      title: String(row.title || ''),
      description: String(row.description || ''),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : '',
      status: String(row.status || 'todo'),
      createdAt: row.created_at || null,
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
