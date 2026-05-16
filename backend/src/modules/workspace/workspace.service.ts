import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
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

    const [doubtRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, subject, reply, status, answered_at
       FROM lesson_doubts
       WHERE user_id = ? AND status IN ('answered','closed') AND answered_at IS NOT NULL
       ORDER BY answered_at DESC
       LIMIT 5`,
      [user.id]
    );
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
      ...doubtRows.map((row) => ({
        id: `doubt-${row.id}`,
        kind: 'doubt',
        title: `Reply: ${String(row.subject || 'Your doubt')}`,
        body: String(row.reply || 'Your doubt has been updated.'),
        read: true,
        createdAt: row.answered_at || null,
        actionPath: '/doubts',
      })),
      ...subscriptionRows.map((row) => ({
        id: `subscription-${String(row.status)}-${String(row.updated_at)}`,
        kind: 'subscription',
        title: `${String(row.plan_name || 'Subscription')} ${String(row.status || 'updated')}`,
        body: `Payment: ${String(row.payment_status || 'manual')}${row.end_date ? ` · Valid until ${String(row.end_date).slice(0, 10)}` : ''}`,
        read: true,
        createdAt: row.updated_at || null,
        actionPath: '/subscriptions',
      })),
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
    const title = input?.title !== undefined ? this.requiredString(input.title, 'Task title') : null;
    const description = input?.description !== undefined ? this.optionalString(input.description) : null;
    const dueDate = input?.dueDate !== undefined ? this.optionalDate(input.dueDate) : null;
    const status = input?.status === 'done' ? 'done' : input?.status === 'todo' ? 'todo' : null;
    await this.db.execute(
      `UPDATE study_planner_tasks
       SET title = COALESCE(?, title), description = ?, due_date = ?, status = COALESCE(?, status)
       WHERE id = ? AND user_id = ?`,
      [title, description, dueDate, status, id, student.id]
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
        SELECT u.id, u.full_name, u.email, MAX(COALESCE(qa.submitted_at, sae.created_at, slp.updated_at)) AS last_activity
        FROM users u
        LEFT JOIN quiz_attempts qa ON qa.user_id = u.id
        LEFT JOIN study_activity_events sae ON sae.user_id = u.id
        LEFT JOIN student_lesson_progress slp ON slp.user_id = u.id
        WHERE ${inactiveWhere.join(' AND ')}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY last_activity IS NULL DESC, last_activity ASC
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
        SELECT status, COUNT(*) AS count_value, SUM(amount) AS amount_total
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

  async listQuestionReviewItems(authorization?: string, status?: string) {
    await this.authService.requireAdmin(authorization);
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (['draft', 'reviewing', 'approved', 'rejected'].includes(String(status || ''))) {
      where += ' AND qri.status = ?';
      params.push(status);
    }
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT
          qri.*,
          LEFT(q.question_text, 180) AS question_text,
          q.question_text AS full_question_text,
          q.explanation,
          q.keywords_text,
          q.question_type,
          COALESCE(os.option_count, 0) AS option_count,
          COALESCE(os.correct_count, 0) AS correct_count,
          COALESCE(dupes.duplicate_count, 0) AS duplicate_count,
          u.full_name AS created_by_name,
          reviewer.full_name AS reviewed_by_name
        FROM question_review_items qri
        LEFT JOIN questions q ON q.id = qri.question_id
        LEFT JOIN (
          SELECT question_id, COUNT(*) AS option_count, SUM(is_correct = 1) AS correct_count
          FROM question_options
          GROUP BY question_id
        ) os ON os.question_id = q.id
        LEFT JOIN (
          SELECT LOWER(TRIM(question_text)) AS question_key, COUNT(*) AS duplicate_count
          FROM questions
          GROUP BY LOWER(TRIM(question_text))
          HAVING COUNT(*) > 1
        ) dupes ON dupes.question_key = LOWER(TRIM(q.question_text))
        LEFT JOIN users u ON u.id = qri.created_by
        LEFT JOIN users reviewer ON reviewer.id = qri.reviewed_by
        ${where}
        ORDER BY FIELD(qri.status, 'draft', 'reviewing', 'rejected', 'approved'), qri.created_at DESC
        LIMIT 100
      `,
      params
    );
    return rows.map(this.mapQuestionReviewItem);
  }

  async createQuestionReviewItem(authorization: string | undefined, input: any) {
    const admin = await this.authService.requireAdmin(authorization);
    const title = this.requiredString(input?.title, 'Review title');
    const source = ['ai', 'import', 'manual', 'report'].includes(input?.source) ? input.source : 'manual';
    const status = ['draft', 'reviewing', 'approved', 'rejected'].includes(input?.status) ? input.status : 'draft';
    const questionId = input?.questionId ? Number(input.questionId) : null;
    const notes = this.optionalString(input?.notes);
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO question_review_items (question_id, source, title, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [questionId, source, title, notes, status, admin.id]
    );
    return { ok: true, id: result.insertId };
  }

  async updateQuestionReviewItem(authorization: string | undefined, id: number, input: any) {
    const admin = await this.authService.requireAdmin(authorization);
    const status = ['draft', 'reviewing', 'approved', 'rejected'].includes(input?.status) ? input.status : null;
    const notes = input?.notes !== undefined ? this.optionalString(input.notes) : null;
    await this.db.execute(
      `UPDATE question_review_items
       SET status = COALESCE(?, status), notes = COALESCE(?, notes),
           reviewed_by = CASE WHEN ? IN ('approved','rejected') THEN ? ELSE reviewed_by END,
           reviewed_at = CASE WHEN ? IN ('approved','rejected') THEN NOW() ELSE reviewed_at END
       WHERE id = ?`,
      [status, notes, status, admin.id, status, id]
    );
    return { ok: true, id };
  }

  async listStudentDoubts(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT d.*, l.lesson_title FROM lesson_doubts d LEFT JOIN lessons l ON l.id = d.lesson_id WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT 100`,
      [student.id]
    );
    return rows.map(this.mapDoubt);
  }

  async createDoubt(authorization: string | undefined, input: any) {
    const student = await this.authService.requireStudent(authorization);
    const subject = this.requiredString(input?.subject, 'Subject');
    const message = this.requiredString(input?.message, 'Message');
    const lessonId = input?.lessonId ? Number(input.lessonId) : null;
    const questionId = input?.questionId ? Number(input.questionId) : null;
    const contextType = questionId ? 'question' : lessonId ? 'lesson' : 'general';
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO lesson_doubts (user_id, lesson_id, question_id, context_type, subject, message) VALUES (?, ?, ?, ?, ?, ?)`,
      [student.id, lessonId, questionId, contextType, subject, message]
    );
    return { ok: true, id: result.insertId };
  }

  async listAdminDoubts(authorization?: string, status?: string) {
    await this.authService.requireAdmin(authorization);
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (['open', 'answered', 'closed'].includes(String(status || ''))) {
      where += ' AND d.status = ?';
      params.push(status);
    }
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT d.*, u.full_name, u.email, l.lesson_title, LEFT(q.question_text, 160) AS question_text, admin.full_name AS answered_by_name
        FROM lesson_doubts d
        INNER JOIN users u ON u.id = d.user_id
        LEFT JOIN lessons l ON l.id = d.lesson_id
        LEFT JOIN questions q ON q.id = d.question_id
        LEFT JOIN users admin ON admin.id = d.answered_by
        ${where}
        ORDER BY FIELD(d.status, 'open', 'answered', 'closed'), d.created_at DESC
        LIMIT 150
      `,
      params
    );
    return rows.map(this.mapDoubt);
  }

  async answerDoubt(authorization: string | undefined, id: number, input: any) {
    const admin = await this.authService.requireAdmin(authorization);
    const reply = this.optionalString(input?.reply);
    const status = ['open', 'answered', 'closed'].includes(input?.status) ? input.status : (reply ? 'answered' : 'closed');
    const faqAnswer = input?.faqAnswer !== undefined ? this.optionalString(input.faqAnswer) : null;
    const convertedToFaq = input?.convertedToFaq === true ? 1 : 0;
    await this.db.execute(
      `UPDATE lesson_doubts
       SET reply = ?, status = ?, faq_answer = COALESCE(?, faq_answer), converted_to_faq = GREATEST(converted_to_faq, ?),
           answered_by = ?, answered_at = NOW()
       WHERE id = ?`,
      [reply, status, faqAnswer, convertedToFaq, admin.id, id]
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
    if (filters.startDate) {
      where.push(`DATE(${column}) >= ?`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      where.push(`DATE(${column}) <= ?`);
      params.push(filters.endDate);
    }
  }

  private appendActivityDateFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (filters.startDate || filters.endDate) {
      this.appendDateFilter(where, params, column, filters);
      return;
    }
    where.push(`${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`);
  }

  private appendUserFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (!filters.userId) return;
    where.push(`${column} = ?`);
    params.push(filters.userId);
  }

  private appendCourseFilter(where: string[], params: any[], column: string, filters: AdminReportFilters) {
    if (!filters.courseId) return;
    where.push(`${column} = ?`);
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

  private mapQuestionReviewItem(row: RowDataPacket) {
    const quality = this.buildQuestionQualitySignals(row);
    return {
      id: Number(row.id),
      questionId: row.question_id ? Number(row.question_id) : null,
      source: String(row.source || 'manual'),
      title: String(row.title || ''),
      notes: String(row.notes || ''),
      status: String(row.status || 'draft'),
      questionText: String(row.question_text || ''),
      createdByName: String(row.created_by_name || ''),
      reviewedByName: String(row.reviewed_by_name || ''),
      reviewedAt: row.reviewed_at || null,
      createdAt: row.created_at || null,
      duplicateCount: Number(row.duplicate_count || 0),
      qualityFlags: quality.flags,
      explanationScore: quality.explanationScore,
      reviewTags: quality.tags,
    };
  }

  private buildQuestionQualitySignals(row: RowDataPacket) {
    const questionText = String(row.full_question_text || row.question_text || '').trim();
    const explanation = String(row.explanation || '').trim();
    const keywords = String(row.keywords_text || '').trim();
    const questionType = String(row.question_type || '');
    const optionCount = Number(row.option_count || 0);
    const correctCount = Number(row.correct_count || 0);
    const duplicateCount = Number(row.duplicate_count || 0);
    const flags: string[] = [];
    const tags: string[] = [];

    if (!questionText) flags.push('Missing linked question');
    if (duplicateCount > 1) flags.push('Possible duplicate');
    if (questionText && questionText.length < 35) flags.push('Question too short');
    if (!explanation) flags.push('Missing explanation');
    if (explanation && explanation.length < 80) flags.push('Thin explanation');
    if (!keywords) flags.push('Needs source/keywords');
    if (optionCount < 2) flags.push('Missing answer options');
    if (questionType === 'sba' && correctCount !== 1) flags.push('SBA needs exactly one answer');
    if (questionType === 'true_false' && optionCount < 3) flags.push('True/false needs statements');

    if (questionText && /image|diagram|x-ray|ecg|ct|mri|figure|photo/i.test(questionText)) {
      tags.push('needs image');
    }
    if (!keywords) tags.push('needs source');
    if (/except|least|not true|incorrect/i.test(questionText)) tags.push('ambiguous wording');
    if (duplicateCount > 1) tags.push('duplicate');
    if (!explanation || explanation.length < 80) tags.push('explanation review');

    const explanationScore = Math.max(0, Math.min(100,
      (explanation ? 35 : 0) +
      Math.min(35, Math.floor(explanation.length / 8)) +
      (keywords ? 15 : 0) +
      (optionCount >= 4 ? 10 : 0) +
      (correctCount > 0 ? 5 : 0)
    ));

    return {
      flags,
      tags: [...new Set(tags)],
      explanationScore,
    };
  }

  private mapDoubt(row: RowDataPacket) {
    return {
      id: Number(row.id),
      userId: Number(row.user_id || 0),
      fullName: String(row.full_name || ''),
      email: String(row.email || ''),
      lessonId: row.lesson_id ? Number(row.lesson_id) : null,
      lessonTitle: String(row.lesson_title || ''),
      questionId: row.question_id ? Number(row.question_id) : null,
      questionText: String(row.question_text || ''),
      contextType: String(row.context_type || 'general'),
      subject: String(row.subject || ''),
      message: String(row.message || ''),
      reply: String(row.reply || ''),
      faqAnswer: String(row.faq_answer || ''),
      convertedToFaq: Number(row.converted_to_faq || 0) === 1,
      status: String(row.status || 'open'),
      answeredByName: String(row.answered_by_name || ''),
      answeredAt: row.answered_at || null,
      createdAt: row.created_at || null,
    };
  }
}
