import { getScopeRows } from '../../common/auth/subscription-scope';
import { loadRecentResults } from '../../common/utils/recent-results';
import { sortByName } from '../../common/utils/general-ci-sort';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { normalizePagination, PaginationInput } from '../../common/utils/pagination';
import { sqlPlaceholders } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

type QuizAccessScopeRow = RowDataPacket & {
  feature_key: string | null;
  plan_slug: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
};
type QuizAccessProfile = {
  hasAnyPaidQuizAccess: boolean;
  hasFullAccess: boolean;
  courseIds: Set<number>;
};
type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { BulkDeleteQuizzesDto } from './dto/bulk-delete-quizzes.dto';
import { BulkQuizStatusDto } from './dto/bulk-quiz-status.dto';
import { cachedAdminRead } from '../../common/utils/admin-read-cache';
import { forgetContentHistory } from '../../common/utils/content-history';
import { applyQuestionTotalChanges, applyQuizCountChanges, bumpQuestionLinkCounts, linkCountsForQuizzes, QuestionCourse, readQuestionCourses, readQuizStates } from '../../common/utils/quiz-counts';

type QuizRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number | null;
  subtopic_id: number | null;
  lesson_id: number | null;
  paper_id: number | null;
  category: string | null;
  collection_tags: string | null;
  is_free: number;
  subtopic: string | null;
  is_general: number;
  exam_mode_only: number;
  admin_name: string | null;
  student_title: string | null;
  display_title_mode: 'number' | 'title' | null;
  quiz_number: number | null;
  quiz_title: string;
  quiz_description: string | null;
  total_questions: number;
  total_marks: number;
  time_limit: number;
  hide_time_limit: number;
  passing_marks: number;
  hide_passing_marks: number;
  status: 'active' | 'inactive';
  created_at?: string | null;
  course_title?: string | null;
  subject_name?: string | null;
  topic_name?: string | null;
  lesson_title?: string | null;
  paper_title?: string | null;
};

const DEFAULT_PASSING_MARKS = 45;



@Injectable()
export class QuizzesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  private resolvePassingMarks(value: number | null | undefined) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_PASSING_MARKS;
    return numeric;
  }

  /// WHERE fragment shared by the list and the folder summary, so a folder's count
  /// always matches what opening it will list.
  private buildListFilter(filters: { search?: string; courseId?: number; topicId?: string; status?: string }) {
    let where = '';
    const params: Array<string | number> = [];

    if (filters.search?.trim()) {
      where += ' AND quizzes.quiz_title LIKE ?'; // 10.54: one name column
      params.push(`%${filters.search.trim()}%`);
    }

    if (filters.courseId && filters.courseId > 0) {
      where += ' AND quizzes.course_id = ?';
      params.push(filters.courseId);
    }

    if (filters.topicId) {
      if (filters.topicId === 'general') {
        where += ' AND quizzes.is_general = 1';
      } else {
        where += ' AND quizzes.topic_id = ? AND quizzes.is_general = 0';
        params.push(Number(filters.topicId));
      }
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      where += ' AND quizzes.status = ?';
      params.push(filters.status);
    }

    return { where, params };
  }

  /// One row per folder (course + subject, or the course-wide "general" bucket)
  /// with its assessment counts. Drives the folder view of the Assessment Map,
  /// which only fetches a folder's assessments when it is opened.
  async summary(filters: { search?: string; courseId?: number; topicId?: string; status?: string }) {
    // Without a title search, the folder counts come from the stored counts
    // (topics.quiz_total/…, courses.quiz_general_total/…): one row per course
    // and subject, no counting. A title search has to look at the titles, so it
    // keeps the counting query below.
    if (!filters.search?.trim()) return this.summaryFromStoredCounts(filters);
    const { where, params } = this.buildListFilter(filters);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT
          quizzes.course_id,
          courses.course_title,
          quizzes.is_general,
          CASE WHEN quizzes.is_general = 1 THEN NULL ELSE quizzes.topic_id END AS topic_id,
          CASE WHEN quizzes.is_general = 1 THEN NULL ELSE topics.topic_name END AS subject_name,
          COUNT(*) AS total,
          SUM(CASE WHEN quizzes.status = 'active' THEN 1 ELSE 0 END) AS active_count
        FROM quizzes
        INNER JOIN courses ON quizzes.course_id = courses.id
        LEFT JOIN topics ON quizzes.topic_id = topics.id
        WHERE 1 = 1 ${where}
        GROUP BY quizzes.course_id, courses.course_title, quizzes.is_general,
                 CASE WHEN quizzes.is_general = 1 THEN NULL ELSE quizzes.topic_id END,
                 CASE WHEN quizzes.is_general = 1 THEN NULL ELSE topics.topic_name END
        ORDER BY courses.course_title ASC, quizzes.is_general DESC, subject_name ASC
      `,
      params
    );

    return rows.map((row) => ({
      courseId: Number(row.course_id),
      courseTitle: String(row.course_title || ''),
      isGeneral: Number(row.is_general) === 1,
      topicId: row.topic_id === null || row.topic_id === undefined ? null : Number(row.topic_id),
      subjectName: row.subject_name ? String(row.subject_name) : '',
      total: Number(row.total || 0),
      active: Number(row.active_count || 0),
    }));
  }

  /** 10.57: the Assessments page's first load in one request — the folder rows
   * plus the course and subject names, from the same two reads (was a second
   * request, `meta?scope=folders`, reading the same courses and topics again). */
  async summaryWithFolders() {
    const folders: { courses: RowDataPacket[]; subjects: RowDataPacket[] } = { courses: [], subjects: [] };
    const rows = await this.summaryFromStoredCounts({}, folders);
    const courses = folders.courses.filter((r) => r.status === 'active');
    const subjects = folders.subjects.filter((r) => r.status === 'active');
    sortByName(courses, (r) => String(r.course_title));
    sortByName(subjects, (r) => String(r.topic_name));
    return {
      rows,
      courses: courses.map((row) => ({ id: Number(row.id), courseTitle: String(row.course_title) })),
      subjects: subjects.map((row) => ({ id: Number(row.id), courseId: Number(row.course_id), subjectName: String(row.topic_name) })),
    };
  }

  private async summaryFromStoredCounts(
    filters: { courseId?: number; topicId?: string; status?: string },
    folders?: { courses: RowDataPacket[]; subjects: RowDataPacket[] },
  ) {
    const courseWhere = filters.courseId && filters.courseId > 0 ? 'WHERE id = ?' : '';
    const courseParams = courseWhere ? [filters.courseId] : [];
    const [courses] = await this.db.query<RowDataPacket[]>(
      `SELECT id, course_title, status, quiz_general_total, quiz_general_active, quiz_unfiled_total, quiz_unfiled_active FROM courses ${courseWhere}`,
      courseParams);
    const subjectFilter = filters.topicId === 'general'
      ? null
      : filters.topicId ? { sql: 'WHERE id = ?', params: [Number(filters.topicId)] }
        : courseWhere ? { sql: 'WHERE course_id = ?', params: courseParams }
          : { sql: '', params: [] as unknown[] };
    const [subjects] = subjectFilter
      ? await this.db.query<RowDataPacket[]>(
        `SELECT id, course_id, topic_name, status, quiz_total, quiz_active FROM topics ${subjectFilter.sql}`, subjectFilter.params)
      : [[] as RowDataPacket[]];
    if (folders) { folders.courses = [...courses]; folders.subjects = [...subjects]; }
    // Status filter: active = the active count; draft = total − active.
    const pick = (total: number, active: number) => (filters.status === 'active'
      ? { total: active, active }
      : filters.status === 'inactive' ? { total: total - active, active: 0 } : { total, active });
    const titleKey = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const out: Array<{ courseId: number; courseTitle: string; isGeneral: boolean; topicId: number | null; subjectName: string; total: number; active: number }> = [];
    for (const c of courses) {
      const id = Number(c.id);
      const title = String(c.course_title || '');
      // Same order as before: general first, then assessments with no subject, then subjects by name.
      if (filters.topicId === 'general' || !filters.topicId) {
        const g = pick(Number(c.quiz_general_total), Number(c.quiz_general_active));
        if (g.total > 0) out.push({ courseId: id, courseTitle: title, isGeneral: true, topicId: null, subjectName: '', ...g });
      }
      if (!filters.topicId) {
        const u = pick(Number(c.quiz_unfiled_total), Number(c.quiz_unfiled_active));
        if (u.total > 0) out.push({ courseId: id, courseTitle: title, isGeneral: false, topicId: null, subjectName: '', ...u });
      }
      const rows = subjects
        .filter((t) => Number(t.course_id) === id)
        .sort((a, b) => (titleKey(a.topic_name) < titleKey(b.topic_name) ? -1 : titleKey(a.topic_name) > titleKey(b.topic_name) ? 1 : Number(a.id) - Number(b.id)));
      for (const t of rows) {
        const v = pick(Number(t.quiz_total), Number(t.quiz_active));
        if (v.total > 0) out.push({ courseId: id, courseTitle: title, isGeneral: false, topicId: Number(t.id), subjectName: String(t.topic_name || ''), ...v });
      }
    }
    // Courses by title, as the counting query ordered them.
    return out.sort((a, b) => {
      const x = titleKey(a.courseTitle); const y = titleKey(b.courseTitle);
      return x < y ? -1 : x > y ? 1 : a.courseId - b.courseId;
    });
  }

  async findAll(filters: { search?: string; courseId?: number; topicId?: string; status?: string; order?: string; after?: number; slim?: boolean } & PaginationInput) {
    const { limit, offset: rawOffset } = normalizePagination(filters, { defaultLimit: 50, maxLimit: 100 });
    // Pages "after id X" (keyset) read only the rows they return; OFFSET reads
    // and throws away every earlier row. `after` wins when both are sent.
    const after = Number.isInteger(filters.after) && Number(filters.after) > 0 ? Number(filters.after) : 0;
    const offset = after ? 0 : rawOffset;
    // A folder's list in id order straight from its own index (examined =
    // returned). Left alone, MariaDB merged two single-column indexes and
    // sorted (28 rows read for 14).
    const folderIndexHint = filters.topicId === 'general'
      ? 'FORCE INDEX (idx_quizzes_course_general)'
      : filters.topicId ? 'FORCE INDEX (idx_quizzes_topic_general)' : '';
    let sql = `
      SELECT
        quizzes.id,
        quizzes.course_id,
        quizzes.topic_id,
        quizzes.subtopic_id,
        -- 10.54: the columns no set used were dropped; fixed values keep the admin replies identical.
        NULL AS lesson_id,
        NULL AS paper_id,
        quizzes.category,
        '' AS collection_tags,
        quizzes.is_free,
        '' AS subtopic,
        quizzes.is_general,
        0 AS exam_mode_only,
        quizzes.quiz_title AS admin_name,
        quizzes.quiz_title AS student_title,
        'title' AS display_title_mode,
        quizzes.quiz_number,
        quizzes.quiz_title,
        '' AS quiz_description,
        quizzes.total_questions,
        quizzes.total_marks,
        quizzes.time_limit,
        0 AS hide_time_limit,
        quizzes.passing_marks,
        0 AS hide_passing_marks,
        quizzes.status,
        quizzes.created_at,
        ${filters.slim
          // Slim: no name lookups. The Assessments page already holds the
          // course and subject names, so each row read is a row returned.
          ? 'NULL AS course_title, NULL AS subject_name, NULL AS topic_name, NULL AS lesson_title, NULL AS paper_title'
          : 'courses.course_title, topics.topic_name AS subject_name, subtopics.subtopic_name AS topic_name, NULL AS lesson_title, NULL AS paper_title'}
      FROM quizzes ${folderIndexHint}
      ${filters.slim ? '' : `INNER JOIN courses ON quizzes.course_id = courses.id
      LEFT JOIN topics ON quizzes.topic_id = topics.id
      LEFT JOIN subtopics ON quizzes.subtopic_id = subtopics.id`}
      WHERE 1 = 1
    `;
    const listFilter = this.buildListFilter(filters);
    sql += listFilter.where;
    const params: Array<string | number> = [...listFilter.params];
    if (after) {
      sql += filters.order === 'asc' ? ' AND quizzes.id > ?' : ' AND quizzes.id < ?';
      params.push(after);
    }

    sql += filters.order === 'asc' ? ' ORDER BY quizzes.id ASC LIMIT ? OFFSET ?' : ' ORDER BY quizzes.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await this.db.execute<QuizRow[]>(sql, params);
    return rows.map((row) => this.mapQuiz(row));
  }

  /** The Assessments list page: courses and subjects only (examined = returned). */
  metaFolders() {
    return cachedAdminRead('quizzes.meta:folders', async () => {
      const [courseRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, course_title FROM courses WHERE status = 'active'");
      const [topicRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, course_id, topic_name FROM topics WHERE status = 'active'");
      sortByName(courseRows, (r) => String(r.course_title));
      sortByName(topicRows, (r) => String(r.topic_name));
      return {
        courses: courseRows.map((row) => ({ id: Number(row.id), courseTitle: String(row.course_title) })),
        subjects: topicRows.map((row) => ({ id: Number(row.id), courseId: Number(row.course_id), subjectName: String(row.topic_name) })),
      };
    });
  }

  // Form dropdowns; remembered, cleared on any content save (admin-read-cache.ts).
  meta(options?: { includeQuestions?: boolean }) {
    return cachedAdminRead(`quizzes.meta:${options?.includeQuestions ? 1 : 0}`, () => this.loadMeta(options));
  }

  private async loadMeta(options?: { includeQuestions?: boolean }) {
    const [courseRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC"
    );
    const [topicRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_id, topic_name FROM topics WHERE status = 'active' ORDER BY topic_name ASC"
    );
    const [subtopicRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT s.id, s.topic_id, t.course_id, s.subtopic_name
        FROM subtopics s
        INNER JOIN topics t ON t.id = s.topic_id
        WHERE s.status = 'active'
        ORDER BY s.subtopic_name ASC
      `
    );
    const [lessonRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT id, course_id, topic_id, subtopic_id, lesson_title
        FROM lessons
        WHERE status = 'active'
        ORDER BY lesson_title ASC
      `
    );
    const [paperRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT id, paper_title, year, exam_source, keywords_text
        FROM papers
        WHERE status = 'active'
        ORDER BY year DESC, paper_title ASC
      `
    );
    const [categoryRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT DISTINCT COALESCE(NULLIF(question_category, ''), category) AS category
        FROM questions
        WHERE status = 'active'
        ORDER BY category ASC
      `
    );
    const [questionTypeRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT DISTINCT question_type
        FROM questions
        WHERE status = 'active'
        ORDER BY question_type ASC
      `
    );
    const includeQuestions = options?.includeQuestions === true;
    const usageRows = includeQuestions
      ? (await this.db.execute<RowDataPacket[]>(
          `
            SELECT question_id, COUNT(DISTINCT quiz_id) AS usage_count
            FROM question_quizzes
            GROUP BY question_id
          `
        ))[0]
      : [];
    const usageByQuestionId = new Map(
      usageRows.map((row) => [Number(row.question_id), Number(row.usage_count || 0)])
    );
    const questionRows = includeQuestions
      ? (await this.db.execute<RowDataPacket[]>(
          `
            SELECT
              q.id,
              q.course_id,
              q.topic_id,
              q.subtopic_id,
              q.lesson_id,
              q.paper_id,
              q.subtopic,
              q.category,
              q.question_type,
              q.question_text,
              c.course_title,
              t.topic_name AS subject_name,
              st.subtopic_name AS topic_name,
              l.lesson_title,
              p.paper_title
            FROM questions q
            INNER JOIN courses c ON q.course_id = c.id
            LEFT JOIN topics t ON q.topic_id = t.id
            LEFT JOIN subtopics st ON q.subtopic_id = st.id
            LEFT JOIN lessons l ON q.lesson_id = l.id
            LEFT JOIN papers p ON q.paper_id = p.id
            WHERE q.status = 'active'
            ORDER BY q.id DESC
          `
        ))[0]
      : [];


    const categories = Array.from(new Set(
      (categoryRows.length ? categoryRows : questionRows)
        .map((row) => String(row.category || '').trim())
        .filter(Boolean)
    )).sort((left, right) => left.localeCompare(right));

    const questionTypes = Array.from(new Set(
      (questionTypeRows.length ? questionTypeRows : questionRows)
        .map((row) => String(row.question_type || '').trim())
        .filter(Boolean)
    )).sort((left, right) => left.localeCompare(right));

    return {
      courses: courseRows.map((row) => ({
        id: Number(row.id),
        courseTitle: String(row.course_title),
      })),
      subjects: topicRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        subjectName: String(row.topic_name),
      })),
      topics: subtopicRows.map((row) => ({
        id: Number(row.id),
        subjectId: Number(row.topic_id),
        courseId: Number(row.course_id),
        topicName: String(row.subtopic_name),
      })),
      lessons: lessonRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        subjectId: Number(row.topic_id),
        topicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
        lessonTitle: String(row.lesson_title),
      })),
      papers: paperRows.map((row) => ({
        id: Number(row.id),
        paperTitle: String(row.paper_title),
        year: Number(row.year),
        examSource: String(row.exam_source),
        keywordsText: String(row.keywords_text || ''),
      })),
      categories,
      questionTypes,
      usedQuestionIds: Array.from(usageByQuestionId.keys()),
      questions: questionRows.map((row) => {
        const usageCount = usageByQuestionId.get(Number(row.id)) ?? 0;

        return {
          id: Number(row.id),
          courseId: Number(row.course_id),
          subjectId: row.topic_id === null ? null : Number(row.topic_id),
          topicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
          lessonId: row.lesson_id === null ? null : Number(row.lesson_id),
          paperId: row.paper_id === null ? null : Number(row.paper_id),
          subtopic: String(row.subtopic || ''),
          category: String(row.category || ''),
          questionType: String(row.question_type || ''),
          questionText: String(row.question_text || ''),
          usageCount,
          usedInAnyQuiz: usageCount > 0,
          courseTitle: String(row.course_title || ''),
          subjectName: String(row.subject_name || ''),
          topicName: String(row.topic_name || ''),
          lessonTitle: String(row.lesson_title || ''),
          paperTitle: String(row.paper_title || ''),
        };
      }),
    };
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<QuizRow[]>(
      `
        SELECT
          quizzes.id,
          quizzes.course_id,
          quizzes.topic_id,
          quizzes.subtopic_id,
          -- 10.54: the columns no set used were dropped; fixed values keep the admin replies identical.
          NULL AS lesson_id,
          NULL AS paper_id,
          quizzes.category,
          '' AS collection_tags,
          quizzes.is_free,
          '' AS subtopic,
          quizzes.is_general,
          0 AS exam_mode_only,
          quizzes.quiz_title AS admin_name,
          quizzes.quiz_title AS student_title,
          'title' AS display_title_mode,
          quizzes.quiz_number,
          quizzes.quiz_title,
          '' AS quiz_description,
          quizzes.total_questions,
          quizzes.total_marks,
          quizzes.time_limit,
          0 AS hide_time_limit,
          quizzes.passing_marks,
          0 AS hide_passing_marks,
          quizzes.status,
          quizzes.created_at,
          courses.course_title,
          topics.topic_name AS subject_name,
          subtopics.subtopic_name AS topic_name,
          NULL AS lesson_title,
          NULL AS paper_title
        FROM quizzes
        INNER JOIN courses ON quizzes.course_id = courses.id
        LEFT JOIN topics ON quizzes.topic_id = topics.id
        LEFT JOIN subtopics ON quizzes.subtopic_id = subtopics.id
        WHERE quizzes.id = ?
        LIMIT 1
      `,
      [id]
    );

    const quiz = rows[0];
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const [questionRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT question_id
        FROM question_quizzes
        WHERE quiz_id = ?
        ORDER BY sort_order ASC, question_id ASC
      `,
      [id]
    );

    return {
      ...this.mapQuiz(quiz),
      questionIds: questionRows.map((row) => Number(row.question_id)),
    };
  }

  async create(createQuizDto: CreateQuizDto, actor?: ContentActorInput) {
    this.validateQuiz(createQuizDto);
    this.assertCanSaveStatus(actor, createQuizDto.status);
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();
      const questionIds = this.cleanQuestionIds(createQuizDto.questionIds);
      // 10.54: every set is a fixed list (no random/blueprint sets), so all chosen questions are linked.
      const linkedQuestionIds = questionIds;
      const totalQuestions = this.resolveQuizQuestionCount(createQuizDto, questionIds);
      const totalMarks = totalQuestions;
      // One name per quiz (10.25): no quiz numbers are given out any more.
      const newQuizNumber: number | null = null;

      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO quizzes (
            course_id, topic_id, subtopic_id, category, is_free, is_general, quiz_number, quiz_title,
            total_questions, total_marks, time_limit, passing_marks, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createQuizDto.courseId,
          createQuizDto.isGeneral === 1 ? null : createQuizDto.topicId ?? null,
          createQuizDto.isGeneral === 1 ? null : createQuizDto.subtopicId ?? null,
          (createQuizDto.category || '').trim() || null,
          createQuizDto.isFree === 1 ? 1 : 0,
          createQuizDto.isGeneral,
          newQuizNumber,
          this.resolveStudentTitle(createQuizDto),
          totalQuestions,
          totalMarks,
          createQuizDto.timeLimit,
          this.resolvePassingMarks(createQuizDto.passingMarks),
          createQuizDto.status,
        ]
      );

      // One more assessment in its folder (subject, or the course's general one).
      await applyQuizCountChanges(connection, [], await readQuizStates(connection, [result.insertId], false));
      await this.replaceQuestionLinks(connection, result.insertId, linkedQuestionIds);
      const snapshot = this.buildQuizSnapshot(createQuizDto);
      await this.recordContentVersion(connection, 'quiz', result.insertId, snapshot, this.getActorId(actor));
      await this.setWorkflowState(connection, 'quiz', result.insertId, createQuizDto.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'quiz',
        entityId: result.insertId,
        action: 'created',
        summary: `Quiz ${result.insertId} created`,
        actorId: this.getActorId(actor),
        after: snapshot,
      });
      await connection.commit();
      if (createQuizDto.status === 'active') {
        // Fire-and-forget: never blocks the save, never throws (errors logged inside).
        void this.pushNotificationsService.notifyStudentsOfNewContent({
          title: 'New quiz — test yourself',
          body: `${this.resolveStudentTitle(createQuizDto)} added to the Q-Bank. Put your knowledge to the test.`,
        });
      }
      return { ok: true, id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updateQuizDto: UpdateQuizDto, actor?: ContentActorInput) {
    const existing = await this.findOne(id);
    const merged: CreateQuizDto = {
      courseId: updateQuizDto.courseId ?? existing.courseId,
      topicId: updateQuizDto.topicId ?? existing.topicId ?? null,
      subtopicId: updateQuizDto.subtopicId ?? existing.subtopicId ?? null,
      lessonId: updateQuizDto.lessonId ?? existing.lessonId ?? null,
      paperId: updateQuizDto.paperId ?? existing.paperId ?? null,
      category: updateQuizDto.category ?? existing.category ?? '',
      collectionTags: updateQuizDto.collectionTags ?? existing.collectionTags ?? '',
      isFree: updateQuizDto.isFree ?? (existing.isFree === 1 ? 1 : 0),
      subtopic: updateQuizDto.subtopic ?? existing.subtopic ?? '',
      isGeneral: updateQuizDto.isGeneral ?? (existing.isGeneral === 1 ? 1 : 0),
      examModeOnly: updateQuizDto.examModeOnly ?? (existing.examModeOnly === 1 ? 1 : 0),
      // One name (10.25): a new name from any of the three fields replaces all three.
      adminName: this.quizName(updateQuizDto) || this.quizName(existing),
      studentTitle: this.quizName(updateQuizDto) || this.quizName(existing),
      displayTitleMode: this.resolveDisplayTitleMode(),
      quizTitle: this.quizName(updateQuizDto) || this.quizName(existing),
      quizDescription: updateQuizDto.quizDescription ?? existing.quizDescription ?? '',
      timeLimit: updateQuizDto.timeLimit ?? existing.timeLimit,
      hideTimeLimit: updateQuizDto.hideTimeLimit ?? (existing.hideTimeLimit === 1 ? 1 : 0),
      passingMarks: updateQuizDto.passingMarks ?? this.resolvePassingMarks(existing.passingMarks),
      hidePassingMarks: updateQuizDto.hidePassingMarks ?? (existing.hidePassingMarks === 1 ? 1 : 0),
      status: updateQuizDto.status ?? existing.status,
      questionIds: updateQuizDto.questionIds ?? existing.questionIds,
    };

    this.validateQuiz(merged);
    this.assertCanModifyExistingStatus(actor, existing.status);
    this.assertCanSaveStatus(actor, merged.status);
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();
      // Its folder counts move if the save changes its course, subject, general
      // flag or status (row locked first).
      const countsBefore = await readQuizStates(connection, [id], true);
      const questionIds = this.cleanQuestionIds(merged.questionIds);
      const linkedQuestionIds = questionIds; // 10.54: fixed lists only
      const totalQuestions = this.resolveQuizQuestionCount(merged, questionIds);
      const totalMarks = totalQuestions;
      const updatedQuizNumber: number | null = null; // no number display (10.25)

      await connection.execute(
        `
          UPDATE quizzes SET
            content_stamp = content_stamp + 1,
            course_id = ?,
            topic_id = ?,
            subtopic_id = ?,
            category = ?,
            is_free = ?,
            is_general = ?,
            quiz_number = ?,
            quiz_title = ?,
            total_questions = ?,
            total_marks = ?,
            time_limit = ?,
            passing_marks = ?,
            status = ?
          WHERE id = ?
        `,
        [
          merged.courseId,
          merged.isGeneral === 1 ? null : merged.topicId ?? null,
          merged.isGeneral === 1 ? null : merged.subtopicId ?? null,
          (merged.category || '').trim() || null,
          merged.isFree === 1 ? 1 : 0,
          merged.isGeneral,
          updatedQuizNumber,
          this.resolveStudentTitle(merged),
          totalQuestions,
          totalMarks,
          merged.timeLimit,
          this.resolvePassingMarks(merged.passingMarks),
          merged.status,
          id,
        ]
      );

      await applyQuizCountChanges(connection, countsBefore, await readQuizStates(connection, [id], false));
      await this.replaceQuestionLinks(connection, id, linkedQuestionIds);
      const snapshot = this.buildQuizSnapshot(merged);
      await this.recordContentVersion(connection, 'quiz', id, snapshot, this.getActorId(actor));
      await this.setWorkflowState(connection, 'quiz', id, merged.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'quiz',
        entityId: id,
        action: 'updated',
        summary: `Quiz ${id} updated`,
        actorId: this.getActorId(actor),
        before: existing,
        after: snapshot,
      });
      await connection.commit();
      if (existing.status !== 'active' && merged.status === 'active') {
        void this.pushNotificationsService.notifyStudentsOfNewContent({
          title: 'New quiz — test yourself',
          body: `${this.resolveStudentTitle(merged)} added to the Q-Bank. Put your knowledge to the test.`,
        });
      }
      return { ok: true, id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async remove(id: number, actor?: ContentActorInput) {
    const existing = await this.findOne(id);
    this.assertCanModifyExistingStatus(actor, existing.status);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const countsBefore = await readQuizStates(connection, [id], true);
      const links = await linkCountsForQuizzes(connection, [id]);
      await connection.execute('DELETE FROM question_quizzes WHERE quiz_id = ?', [id]);
      await bumpQuestionLinkCounts(connection, [...links].map(([q, n]) => [q, -n] as [number, number]));
      await connection.execute('DELETE FROM quizzes WHERE id = ?', [id]);
      await forgetContentHistory(connection, 'quiz', [id]);
      await applyQuizCountChanges(connection, countsBefore, []);
      await this.recordContentAudit(connection, {
        entityType: 'quiz',
        entityId: id,
        action: 'deleted',
        summary: `Quiz ${id} deleted`,
        actorId: this.getActorId(actor),
        before: existing,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return { ok: true, id };
  }

  /// Everything a bulk delete would touch, worked out WITHOUT changing anything, so
  /// the admin can be told exactly what will go before choosing.
  private async planBulkDelete(quizIds: number[]) {
    const ids = Array.from(new Set((quizIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) throw new BadRequestException('Please select at least one assessment');
    const placeholders = sqlPlaceholders(ids);

    const [quizRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, status FROM quizzes WHERE id IN (${placeholders})`,
      ids
    );
    if (quizRows.length !== ids.length) throw new NotFoundException('One or more assessments could not be found');

    const [inside] = await this.db.execute<RowDataPacket[]>(
      `SELECT DISTINCT question_id FROM question_quizzes WHERE quiz_id IN (${placeholders})`,
      ids
    );
    const questionIds = inside.map((row) => Number(row.question_id)).filter((id) => id > 0);

    let sharedIds: number[] = [];
    if (questionIds.length) {
      const qPlaceholders = sqlPlaceholders(questionIds);
      const [shared] = await this.db.execute<RowDataPacket[]>(
        `SELECT DISTINCT question_id FROM question_quizzes
          WHERE question_id IN (${qPlaceholders}) AND quiz_id NOT IN (${placeholders})`,
        [...questionIds, ...ids]
      );
      sharedIds = shared.map((row) => Number(row.question_id));
    }
    const sharedSet = new Set(sharedIds);
    const onlyHereIds = questionIds.filter((id) => !sharedSet.has(id));


    return {
      ids,
      quizRows,
      questionIds,
      sharedIds,
      onlyHereIds,
    };
  }

  async bulkDeletePreview(dto: BulkDeleteQuizzesDto) {
    const plan = await this.planBulkDelete(dto.quizIds);
    // 10.44: results students hold for these quizzes (their recent results).
    const quizIdSet = new Set(plan.ids.map(Number));
    const attempts = (await loadRecentResults(this.db)).filter((r) => quizIdSet.has(r.quizId)).length;
    return {
      quizzes: plan.ids.length,
      questionsInside: plan.questionIds.length,
      questionsOnlyHere: plan.onlyHereIds.length,
      questionsShared: plan.sharedIds.length,
      attempts,
    };
  }

  /// Approve many drafts at once (status 'active') or move them back to draft ('inactive').
  /// Same rules as saving one quiz: publishing needs review permission, and a quiz that
  /// could not be published on its own (no title, no questions ...) is skipped with the
  /// reason instead of failing the whole batch.
  async bulkSetStatus(dto: BulkQuizStatusDto, actor?: ContentActorInput) {
    const ids = Array.from(new Set((dto.quizIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) throw new BadRequestException('Select at least one assessment');
    const target = dto.status;
    this.assertCanSaveStatus(actor, target);

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, status FROM quizzes WHERE id IN (${sqlPlaceholders(ids)})`,
      ids
    );
    const current = new Map(rows.map((row) => [Number(row.id), String(row.status)]));

    const skipped: Array<{ id: number; reason: string }> = [];
    const changes: Array<{ id: number; quiz: any }> = [];
    for (const id of ids) {
      const status = current.get(id);
      if (!status) { skipped.push({ id, reason: 'Not found' }); continue; }
      if (status === target) { skipped.push({ id, reason: target === 'active' ? 'Already active' : 'Already a draft' }); continue; }
      this.assertCanModifyExistingStatus(actor, status);
      const quiz = await this.findOne(id);
      if (target === 'active') {
        try {
          this.validateQuiz(quiz as unknown as CreateQuizDto);
        } catch (error) {
          skipped.push({ id, reason: error instanceof Error ? error.message : 'Cannot be published' });
          continue;
        }
      }
      changes.push({ id, quiz });
    }

    if (changes.length) {
      const changedIds = changes.map((change) => change.id);
      const connection = await this.db.getConnection();
      try {
        await connection.beginTransaction();
        const countsBefore = await readQuizStates(connection, changedIds, true);
        await connection.execute(`UPDATE quizzes SET status = ?, content_stamp = content_stamp + 1 WHERE id IN (${sqlPlaceholders(changedIds)})`, [target, ...changedIds]);
        await applyQuizCountChanges(connection, countsBefore, await readQuizStates(connection, changedIds, false));
        for (const { id, quiz } of changes) {
          const snapshot = this.buildQuizSnapshot({ ...quiz, status: target });
          await this.recordContentVersion(connection, 'quiz', id, snapshot, this.getActorId(actor));
          await this.setWorkflowState(connection, 'quiz', id, target === 'active' ? 'published' : 'draft', this.getActorId(actor));
          await this.recordContentAudit(connection, {
            entityType: 'quiz',
            entityId: id,
            action: 'updated',
            summary: `Quiz ${id} ${target === 'active' ? 'approved (bulk)' : 'moved to draft (bulk)'}`,
            actorId: this.getActorId(actor),
            before: quiz,
            after: snapshot,
          });
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      // ONE notice for the whole batch, so approving fifty quizzes is not fifty pushes.
      if (target === 'active') {
        const [first] = changes;
        void this.pushNotificationsService.notifyStudentsOfNewContent(
          changes.length === 1
            ? { title: 'New quiz — test yourself', body: `${this.resolveStudentTitle(first.quiz)} added to the Q-Bank. Put your knowledge to the test.` }
            : { title: 'New quizzes — test yourself', body: `${changes.length} new quizzes added to the Q-Bank. Put your knowledge to the test.` },
        );
      }
    }

    return { ok: true, status: target, changed: changes.length, skipped };
  }

  async bulkDelete(dto: BulkDeleteQuizzesDto, actor?: ContentActorInput) {
    const plan = await this.planBulkDelete(dto.quizIds);
    const deleteQuestions = dto.deleteQuestions === true;

    for (const row of plan.quizRows) this.assertCanModifyExistingStatus(actor, String(row.status || ''));

    if (deleteQuestions && plan.onlyHereIds.length) {
      const allowed = !actor || typeof actor === 'number'
        || actor.role === 'admin'
        || Boolean(actor.permissions?.includes('questions.manage'));
      if (!allowed) throw new ForbiddenException('Deleting questions requires the questions permission');

      const [statusRows] = await this.db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS active_count FROM questions WHERE id IN (${sqlPlaceholders(plan.onlyHereIds)}) AND status = 'active'`,
        plan.onlyHereIds
      );
      if (!this.canReviewContent(actor) && Number(statusRows[0]?.active_count || 0) > 0) {
        throw new ForbiddenException('Published questions require review permission before deletion');
      }
    }

    const placeholders = sqlPlaceholders(plan.ids);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the assessments first (same order as every assessment save).
      const countsBefore = await readQuizStates(connection, plan.ids, true);
      const links = await linkCountsForQuizzes(connection, plan.ids);
      await connection.execute(`DELETE FROM question_quizzes WHERE quiz_id IN (${placeholders})`, plan.ids);
      await bumpQuestionLinkCounts(connection, [...links].map(([q, n]) => [q, -n] as [number, number]));
      await connection.execute(`DELETE FROM quizzes WHERE id IN (${placeholders})`, plan.ids);
      await forgetContentHistory(connection, 'quiz', plan.ids);
      await applyQuizCountChanges(connection, countsBefore, []);
      for (const id of plan.ids) {
        await this.recordContentAudit(connection, {
          entityType: 'quiz',
          entityId: id,
          action: 'deleted',
          summary: `Quiz ${id} deleted (bulk)`,
          actorId: this.getActorId(actor),
          before: { id },
        });
      }

      let deletedQuestions = 0;
      const questionCourses: QuestionCourse[] = [];
      if (deleteQuestions) {
        // Same clean-up the question bank's own bulk delete does, so nothing is left
        // pointing at a question that no longer exists. Questions that another
        // assessment also uses are NOT in onlyHereIds and are left alone.
        for (let i = 0; i < plan.onlyHereIds.length; i += 500) {
          const chunk = plan.onlyHereIds.slice(i, i + 500);
          const qp = sqlPlaceholders(chunk);
          // Already locked by the link-count step above; courses adjusted below.
          questionCourses.push(...(await readQuestionCourses(connection, chunk)));
          await connection.execute(`DELETE FROM question_reports WHERE question_id IN (${qp})`, chunk);
          const [result] = await connection.execute<ResultSetHeader>(`DELETE FROM questions WHERE id IN (${qp})`, chunk);
          await forgetContentHistory(connection, 'question', chunk);
          deletedQuestions += result.affectedRows;
        }
        await applyQuestionTotalChanges(connection, questionCourses, []);
        if (deletedQuestions) {
          await this.recordContentAudit(connection, {
            entityType: 'question',
            entityId: 0,
            action: 'bulk_deleted',
            summary: `${deletedQuestions} question(s) deleted with ${plan.ids.length} assessment(s)`,
            actorId: this.getActorId(actor),
            before: { questionIds: plan.onlyHereIds },
          });
        }
      }

      await connection.commit();
      return {
        ok: true,
        deletedQuizzes: plan.ids.length,
        deletedQuestions,
        keptQuestions: deleteQuestions ? plan.sharedIds.length : plan.questionIds.length,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listVersions(id: number) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id;
    return [];
  }

  async markDraft(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'draft',
      status: 'inactive',
      action: 'marked_draft',
      summary: `Quiz ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Quiz ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Quiz ${id} published`,
      actor,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id; void versionNumber; void actor;
    throw new BadRequestException('Version history is not kept any more.');
  }

  private validateQuiz(quiz: CreateQuizDto) {
    if (!quiz.courseId || quiz.courseId <= 0) {
      throw new BadRequestException('Please select a course');
    }

    if (!this.quizName(quiz)) {
      throw new BadRequestException('Quiz name is required');
    }

    if (quiz.subtopicId && (!quiz.topicId || quiz.topicId <= 0)) {
      throw new BadRequestException('Please select a subject before selecting a topic');
    }

    if (quiz.lessonId && (!quiz.topicId || quiz.topicId <= 0)) {
      throw new BadRequestException('Please select a subject before selecting a lesson');
    }

    const questionIds = this.cleanQuestionIds(quiz.questionIds || []);
    if (questionIds.length === 0) {
      throw new BadRequestException('Please add at least one question to the quiz');
    }
  }

  private cleanQuestionIds(questionIds: number[] = []) {
    return Array.from(new Set((questionIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
  }

  private resolveQuizQuestionCount(quiz: CreateQuizDto, questionIds = this.cleanQuestionIds(quiz.questionIds)) {
    return questionIds.length; // 10.54: fixed lists only
  }

  private buildQuizSnapshot(quiz: CreateQuizDto) {
    return {
      courseId: quiz.courseId,
      topicId: quiz.topicId ?? null,
      subtopicId: quiz.subtopicId ?? null,
      lessonId: quiz.lessonId ?? null,
      paperId: quiz.paperId ?? null,
      category: quiz.category || '',
      collectionTags: '',
      isFree: quiz.isFree === 1 ? 1 : 0,
      subtopic: quiz.subtopic || '',
      isGeneral: quiz.isGeneral,
      examModeOnly: quiz.examModeOnly,
      adminName: this.resolveAdminName(quiz),
      studentTitle: this.resolveStudentTitle(quiz),
      displayTitleMode: this.resolveDisplayTitleMode(quiz.displayTitleMode),
      quizNumber: quiz.quizNumber ?? null,
      quizTitle: this.resolveStudentTitle(quiz),
      quizDescription: quiz.quizDescription || '',
      timeLimit: quiz.timeLimit,
      hideTimeLimit: quiz.hideTimeLimit,
      passingMarks: this.resolvePassingMarks(quiz.passingMarks),
      hidePassingMarks: quiz.hidePassingMarks,
      status: quiz.status,
      questionIds: this.cleanQuestionIds(quiz.questionIds),
    };
  }

  private buildQuizSnapshotFromEntity(quiz: Awaited<ReturnType<QuizzesService['findOne']>>, status: 'active' | 'inactive') {
    return this.buildQuizSnapshot({
      courseId: Number(quiz.courseId),
      topicId: quiz.topicId === null || quiz.topicId === undefined ? null : Number(quiz.topicId),
      subtopicId: quiz.subtopicId === null || quiz.subtopicId === undefined ? null : Number(quiz.subtopicId),
      lessonId: quiz.lessonId === null || quiz.lessonId === undefined ? null : Number(quiz.lessonId),
      paperId: quiz.paperId === null || quiz.paperId === undefined ? null : Number(quiz.paperId),
      category: quiz.category || '',
      collectionTags: quiz.collectionTags || '',
      isFree: quiz.isFree === 1 ? 1 : 0,
      subtopic: quiz.subtopic || '',
      isGeneral: quiz.isGeneral === 1 ? 1 : 0,
      examModeOnly: quiz.examModeOnly === 1 ? 1 : 0,
      adminName: quiz.adminName,
      studentTitle: quiz.studentTitle,
      displayTitleMode: this.resolveDisplayTitleMode(quiz.displayTitleMode),
      quizNumber: quiz.quizNumber ?? null,
      quizTitle: quiz.quizTitle,
      quizDescription: quiz.quizDescription || '',
      timeLimit: Number(quiz.timeLimit),
      hideTimeLimit: quiz.hideTimeLimit === 1 ? 1 : 0,
      passingMarks: this.resolvePassingMarks(quiz.passingMarks),
      hidePassingMarks: quiz.hidePassingMarks === 1 ? 1 : 0,
      status,
      questionIds: quiz.questionIds,
    }) as CreateQuizDto;
  }

  private async transitionWorkflow(
    id: number,
    input: {
      workflowState: ContentWorkflowState;
      status: 'active' | 'inactive';
      action: string;
      summary: string;
      actor?: ContentActorInput;
    }
  ) {
    const existing = await this.findOne(id);
    this.assertCanModifyExistingStatus(input.actor, existing.status);
    this.assertCanSaveStatus(input.actor, input.status);
    const snapshot = this.buildQuizSnapshotFromEntity(existing, input.status);
    this.validateQuiz(snapshot);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const countsBefore = await readQuizStates(connection, [id], true);
      await connection.execute('UPDATE quizzes SET status = ?, content_stamp = content_stamp + 1 WHERE id = ?', [input.status, id]);
      await applyQuizCountChanges(connection, countsBefore, await readQuizStates(connection, [id], false));
      await this.recordContentVersion(connection, 'quiz', id, snapshot, this.getActorId(input.actor));
      await this.setWorkflowState(connection, 'quiz', id, input.workflowState, this.getActorId(input.actor));
      await this.recordContentAudit(connection, {
        entityType: 'quiz',
        entityId: id,
        action: input.action,
        summary: input.summary,
        actorId: this.getActorId(input.actor),
        before: existing,
        after: snapshot,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      ok: true,
      id,
      status: input.status,
      workflowState: input.workflowState,
    };
  }

  private async writeQuizSnapshot(connection: PoolConnection, id: number, quiz: CreateQuizDto) {
    const questionIds = this.cleanQuestionIds(quiz.questionIds);
    const totalQuestions = this.resolveQuizQuestionCount(quiz, questionIds);
    // Used by the version rollback: its folder counts follow the restored state.
    const countsBefore = await readQuizStates(connection, [id], true);
    await connection.execute(
      `
        UPDATE quizzes SET
          content_stamp = content_stamp + 1,
          course_id = ?,
          topic_id = ?,
          subtopic_id = ?,
          category = ?,
          is_free = ?,
          is_general = ?,
          quiz_number = ?,
          quiz_title = ?,
          total_questions = ?,
          total_marks = ?,
          time_limit = ?,
          passing_marks = ?,
          status = ?
        WHERE id = ?
      `,
      [
        quiz.courseId,
        quiz.isGeneral === 1 ? null : quiz.topicId ?? null,
        quiz.isGeneral === 1 ? null : quiz.subtopicId ?? null,
        (quiz.category || '').trim() || null,
        quiz.isFree === 1 ? 1 : 0,
        quiz.isGeneral,
        quiz.quizNumber ?? null,
        this.resolveStudentTitle(quiz),
        totalQuestions,
        totalQuestions,
        quiz.timeLimit,
        this.resolvePassingMarks(quiz.passingMarks),
        quiz.status,
        id,
      ]
    );
    await applyQuizCountChanges(connection, countsBefore, await readQuizStates(connection, [id], false));
  }

  private parseSnapshotJson(value: unknown) {
    if (value && typeof value === 'object') {
      return value;
    }

    const raw = String(value || '').trim();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private parseQuizSnapshot(value: unknown): CreateQuizDto {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Quiz version snapshot is invalid');
    }

    const snapshot = parsed as Partial<CreateQuizDto>;
    return {
      courseId: Number(snapshot.courseId),
      topicId: snapshot.topicId === null || snapshot.topicId === undefined ? null : Number(snapshot.topicId),
      subtopicId: snapshot.subtopicId === null || snapshot.subtopicId === undefined ? null : Number(snapshot.subtopicId),
      lessonId: snapshot.lessonId === null || snapshot.lessonId === undefined ? null : Number(snapshot.lessonId),
      paperId: snapshot.paperId === null || snapshot.paperId === undefined ? null : Number(snapshot.paperId),
      category: String(snapshot.category || ''),
      collectionTags: String(snapshot.collectionTags || ''),
      isFree: Number(snapshot.isFree) === 1 ? 1 : 0,
      subtopic: String(snapshot.subtopic || ''),
      isGeneral: Number(snapshot.isGeneral) === 1 ? 1 : 0,
      examModeOnly: Number(snapshot.examModeOnly) === 1 ? 1 : 0,
      adminName: String(snapshot.adminName || snapshot.quizTitle || ''),
      studentTitle: String(snapshot.studentTitle || snapshot.quizTitle || ''),
      displayTitleMode: snapshot.displayTitleMode === 'title' ? 'title' : 'number',
      quizNumber: snapshot.quizNumber ? Number(snapshot.quizNumber) : null,
      quizTitle: String(snapshot.quizTitle || snapshot.studentTitle || ''),
      quizDescription: String(snapshot.quizDescription || ''),
      timeLimit: Math.max(1, Number(snapshot.timeLimit || 1)),
      hideTimeLimit: Number(snapshot.hideTimeLimit) === 1 ? 1 : 0,
      passingMarks: this.resolvePassingMarks(Number(snapshot.passingMarks || DEFAULT_PASSING_MARKS)),
      hidePassingMarks: Number(snapshot.hidePassingMarks) === 1 ? 1 : 0,
      status: snapshot.status === 'active' ? 'active' : 'inactive',
      questionIds: Array.isArray(snapshot.questionIds)
        ? snapshot.questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [],
    };
  }

  private async recordContentVersion(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    snapshot: unknown,
    actorId?: number,
  ) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void connection; void entityType; void entityId; void snapshot; void actorId;
  }

  private async setWorkflowState(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    workflowState: ContentWorkflowState,
    actorId?: number,
  ) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void connection; void entityType; void entityId; void workflowState; void actorId;
  }

  private async recordContentAudit(
    connection: PoolConnection,
    event: {
      entityType: string;
      entityId: number;
      action: string;
      summary: string;
      actorId?: number;
      before?: unknown;
      after?: unknown;
    },
  ) {
    void 0; // 10.37: change history no longer stored (table dropped, never read)
  }

  private getActorId(actor?: ContentActorInput) {
    if (typeof actor === 'number') return actor;
    return actor?.id;
  }

  private canReviewContent(actor?: ContentActorInput) {
    if (!actor || typeof actor === 'number') return true;
    return actor.role === 'admin' || Boolean(actor.permissions?.includes('content.review'));
  }

  private assertCanSaveStatus(actor: ContentActorInput, status: 'active' | 'inactive') {
    if (status === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Review permission is required to publish quiz content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published quizzes require review permission before modification');
    }
  }

  private async replaceQuestionLinks(connection: PoolConnection, quizId: number, questionIds: number[]) {
    // Each question's "used in N assessments" changes only for the questions
    // added to or removed from this assessment.
    const before = await linkCountsForQuizzes(connection, [quizId]);
    await connection.execute('DELETE FROM question_quizzes WHERE quiz_id = ?', [quizId]);

    for (const [index, questionId] of questionIds.entries()) {
      await connection.execute(
        'INSERT INTO question_quizzes (question_id, quiz_id, sort_order) VALUES (?, ?, ?)',
        [questionId, quizId, index + 1]
      );
    }
    const after = new Set(questionIds.map(Number));
    const changes: Array<[number, number]> = [];
    for (const id of before.keys()) if (!after.has(id)) changes.push([id, -1]);
    for (const id of after) if (!before.has(id)) changes.push([id, 1]);
    await bumpQuestionLinkCounts(connection, changes);
  }

  /**
   * One name per quiz (OPTIMIZE 10.25): the admin name, the student name and
   * the quiz title are always the same, saved from whichever the form sent.
   */
  private quizName(quiz: Partial<Pick<CreateQuizDto, 'adminName' | 'studentTitle' | 'quizTitle'>>) {
    return String(quiz.studentTitle || quiz.quizTitle || quiz.adminName || '').trim();
  }

  private resolveAdminName(quiz: Partial<Pick<CreateQuizDto, 'adminName' | 'studentTitle' | 'quizTitle'>>) {
    return this.quizName(quiz);
  }

  private resolveStudentTitle(quiz: Partial<Pick<CreateQuizDto, 'adminName' | 'studentTitle' | 'quizTitle'>>) {
    return this.quizName(quiz);
  }

  /** Every quiz shows its name (10.25): the "• Quiz 2" number display is gone. */
  private resolveDisplayTitleMode(_value?: string | null): 'title' {
    return 'title';
  }

  private optionalPositiveId(value: unknown) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  private mapQuiz(row: QuizRow) {
    return {
      id: row.id,
      courseId: row.course_id,
      topicId: row.topic_id,
      subtopicId: row.subtopic_id,
      lessonId: row.lesson_id,
      paperId: row.paper_id,
      category: row.category || '',
      collectionTags: row.collection_tags || '',
      isFree: Number(row.is_free) === 1 ? 1 : 0,
      subtopic: row.subtopic || '',
      isGeneral: Number(row.is_general) === 1 ? 1 : 0,
      examModeOnly: Number(row.exam_mode_only) === 1 ? 1 : 0,
      adminName: String(row.admin_name || row.quiz_title || ''),
      studentTitle: String(row.student_title || row.quiz_title || ''),
      displayTitleMode: this.resolveDisplayTitleMode(row.display_title_mode),
      quizNumber: row.quiz_number ? Number(row.quiz_number) : null,
      quizTitle: String(row.student_title || row.quiz_title || ''),
      quizDescription: row.quiz_description || '',
      totalQuestions: Number(row.total_questions || 0),
      totalMarks: Number(row.total_marks || 0),
      timeLimit: Number(row.time_limit || 0),
      hideTimeLimit: Number(row.hide_time_limit || 0),
      passingMarks: this.resolvePassingMarks(Number(row.passing_marks || 0)),
      hidePassingMarks: Number(row.hide_passing_marks || 0),
      status: row.status,
      createdAt: row.created_at || null,
      courseTitle: row.course_title || '',
      subjectName: row.subject_name || '',
      topicName: row.topic_name || '',
      lessonTitle: row.lesson_title || '',
      paperTitle: row.paper_title || '',
    };
  }

  private async ensureStudentCanAccessQuiz(userId: number, quiz: { id: number; course_id: number; is_free: number }) {
    if (Number(quiz.is_free) === 1) {
      return;
    }

    const accessProfile = await this.getQuizAccessProfile(userId);
    if (accessProfile.hasFullAccess || accessProfile.courseIds.has(Number(quiz.course_id))) {
      return;
    }

    throw new BadRequestException('This quiz is included with selected course plans');
  }

  private async getQuizAccessProfile(userId: number): Promise<QuizAccessProfile> {
    // From this request's signed token when present (no SQL), else the database.
    const rows = await getScopeRows<QuizAccessScopeRow>(this.db, userId);

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
      return Array.isArray(parsed)
        ? parsed.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
        : [];
    } catch {
      return [];
    }
  }

  private resolveEffectiveAccessScope(row: QuizAccessScopeRow, courseIds: number[]) {
    const planSlug = String(row.plan_slug || '').trim();
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : 'all');
  }
}
