import { sortByName } from '../../common/utils/general-ci-sort';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { normalizePagination } from '../../common/utils/pagination';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlIdentifier, sqlPlaceholders } from '../../database/sql-safety';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { CreateQuestionDto, QuestionOptionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { cachedAdminRead } from '../../common/utils/admin-read-cache';
import { applyQuestionTotalChanges, fixCourseQuestionTotals, fixQuestionLinkCounts, readQuestionCourses } from '../../common/utils/quiz-counts';
import { forgetContentHistory } from '../../common/utils/content-history';
import { optionsJsonFor, optionsOf, sqlMissingFilter, MISSING_BITS, MissingKey } from '../../common/utils/question-content';
import { bumpQuizStamps, bumpQuizStampsForDeletedQuestions } from '../../common/utils/quiz-stamp';

type QuestionRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number;
  subtopic_id: number | null;
  lesson_id: number | null;
  paper_id: number | null;
  subtopic: string | null;
  category: 'past' | 'mock' | 'ai';
  question_category: 'past_paper' | 'mock' | 'ai';
  question_type: 'sba' | 'true_false';
  question_text: string;
  explanation: string | null;
  explanation_image_url?: string | null;
  question_approach?: string | null;
  question_approach_highlights?: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  course_title?: string | null;
  subject_name?: string | null;
  topic_name?: string | null;
  lesson_title?: string | null;
  paper_title?: string | null;
  quiz_count?: number;
  content_version?: number | null;
};

type OptionRow = RowDataPacket & {
  id: number;
  question_id: number;
  option_label: string;
  option_text: string;
  is_correct: number;
  why_incorrect: string | null;
};

type QuestionFilters = {
  search?: string;
  status?: string;
  type?: string;
  category?: string;
  usage?: string;
  courseId?: number;
  subjectId?: number;
  topicId?: number;
  lessonId?: number;
  paperId?: number;
  unclassified?: boolean;
  /// Narrow to questions that are still missing a piece of generated content,
  /// so a bulk run can be pointed at exactly those instead of re-walking the
  /// ones already done.
  missing?: 'explanation' | 'why_incorrect' | 'approach' | 'theory' | 'any';
  ids?: number[];
  excludeIds?: number[];
  limit?: number;
  page?: number;
  offset?: number;
  random?: boolean;
  /// Next page "after id X" (the list is newest first), instead of OFFSET.
  after?: number;
  /// The question bank list: no name lookups, no long text (explanation,
  /// approach); the page fills names from lists it already holds.
  slim?: boolean;
};

type ExportQuestionRow = QuestionRow & {
  course_title: string | null;
  subject_name: string | null;
  topic_name: string | null;
  lesson_title: string | null;
  paper_title: string | null;
};

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;

type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
type ImportPayload = {
  rowNumber: number;
  sourceQuestionId: string;
  fingerprint: string;
  payload: CreateQuestionDto;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
const QUESTION_LOOKUP_TABLES = ['courses', 'topics', 'subtopics', 'lessons', 'papers'] as const;

const IMPORT_COLUMNS = [
  'question_id',
  'course',
  'subject',
  'topic',
  'lesson',
  'paper',
  'topic_label',
  'category',
  'question_type',
  'question_text',
  'option_a_text',
  'option_a_correct',
  'option_a_why_incorrect',
  'option_b_text',
  'option_b_correct',
  'option_b_why_incorrect',
  'option_c_text',
  'option_c_correct',
  'option_c_why_incorrect',
  'option_d_text',
  'option_d_correct',
  'option_d_why_incorrect',
  'option_e_text',
  'option_e_correct',
  'option_e_why_incorrect',
  'explanation',
  'status',
];



@Injectable()
export class QuestionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(filters: QuestionFilters) {
    const slim = filters.slim === true;
    const needsSearchJoins = Boolean(filters.search?.trim());
    // Newest first straight from the narrowest index whose order is the id
    // (left alone, MariaDB merged the course and subject indexes and sorted:
    // 80 rows read for 40). Only for the plain list, not random picks or id lists.
    const plainList = !filters.random && !(filters.ids && filters.ids.length);
    const listIndexHint = !plainList ? ''
      : filters.lessonId ? 'FORCE INDEX (idx_questions_lesson_id)'
        : filters.topicId ? 'FORCE INDEX (idx_questions_subtopic_id)'
          : filters.subjectId ? 'FORCE INDEX (fk_questions_topic)'
            : filters.courseId ? 'FORCE INDEX (fk_questions_course)' : '';
    // "Used in N assessments" is stored on the question (questions.quiz_count,
    // kept by every link write), so no per-row count of links.
    let sql = slim
      ? `
      SELECT
        q.id, q.course_id, q.topic_id, q.subtopic_id, q.lesson_id, q.paper_id, q.subtopic,
        q.category, q.question_category, q.question_type, q.question_text,
        NULL AS explanation, NULL AS explanation_image_url, NULL AS question_approach, NULL AS question_approach_highlights,
        q.status, q.created_at,
        NULL AS course_title, NULL AS subject_name, NULL AS topic_name, NULL AS lesson_title, NULL AS paper_title,
        q.quiz_count, NULL AS content_version
      FROM questions q ${listIndexHint}
      ${needsSearchJoins ? 'LEFT JOIN subtopics st ON st.id = q.subtopic_id LEFT JOIN papers p ON p.id = q.paper_id' : ''}
      WHERE 1 = 1
    `
      : `
      SELECT
        q.id, q.course_id, q.topic_id, q.subtopic_id, q.lesson_id, q.paper_id, q.subtopic,
        q.category, q.question_category, q.question_type, q.question_text,
        q.explanation, q.explanation_image_url, q.question_approach, q.question_approach_highlights,
        q.status, q.created_at,
        c.course_title, s.topic_name AS subject_name, st.subtopic_name AS topic_name, l.lesson_title, p.paper_title,
        q.quiz_count, NULL AS content_version
      FROM questions q
      LEFT JOIN courses c ON c.id = q.course_id
      LEFT JOIN topics s ON s.id = q.topic_id
      LEFT JOIN subtopics st ON st.id = q.subtopic_id
      LEFT JOIN lessons l ON l.id = q.lesson_id
      LEFT JOIN papers p ON p.id = q.paper_id
      WHERE 1 = 1
    `;
    const params: Array<string | number> = [];

    const ids = Array.from(new Set(filters.ids || [])).filter((id) => Number.isInteger(id) && id > 0);
    const excludeIds = Array.from(new Set(filters.excludeIds || [])).filter((id) => Number.isInteger(id) && id > 0);
    const pagination = normalizePagination(filters, {
      defaultLimit: ids.length > 0 ? Math.min(ids.length, 200) : 50,
      maxLimit: 200,
    });

    if (ids.length > 0) {
      sql += ` AND q.id IN (${sqlPlaceholders(ids)})`;
      params.push(...ids);
    }

    if (excludeIds.length > 0) {
      sql += ` AND q.id NOT IN (${sqlPlaceholders(excludeIds)})`;
      params.push(...excludeIds);
    }

    if (filters.search?.trim()) {
      sql += ' AND (q.question_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)'; // 10.54: keywords removed
      const like = `%${filters.search.trim()}%`;
      params.push(like, like, like, like);
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      sql += ' AND q.status = ?';
      params.push(filters.status);
    }

    if (filters.type === 'sba' || filters.type === 'true_false') {
      sql += ' AND q.question_type = ?';
      params.push(filters.type);
    }

    if (filters.category === 'mock' || filters.category === 'past_paper' || filters.category === 'past' || filters.category === 'ai') {
      sql += " AND (q.question_category = ? OR (q.question_category IS NULL AND q.category = ?))";
      params.push(this.normalizeCategory(filters.category), this.normalizeLegacyCategory(filters.category));
    }

    if (filters.courseId && filters.courseId > 0) {
      sql += ' AND q.course_id = ?';
      params.push(filters.courseId);
    }

    if (filters.subjectId && filters.subjectId > 0) {
      sql += ' AND q.topic_id = ?';
      params.push(filters.subjectId);
    }

    if (filters.topicId && filters.topicId > 0) {
      sql += ' AND q.subtopic_id = ?';
      params.push(filters.topicId);
    }

    if (filters.lessonId && filters.lessonId > 0) {
      sql += ' AND q.lesson_id = ?';
      params.push(filters.lessonId);
    }

    if (filters.paperId && filters.paperId > 0) {
      sql += ' AND q.paper_id = ?';
      params.push(filters.paperId);
    }

    if (filters.unclassified) {
      sql += ' AND (q.subtopic_id IS NULL OR q.lesson_id IS NULL)';
    }

    // Each clause asks "is this piece absent", the same way the admin panel
    // decides whether to generate it. Kept as SQL rather than filtered in the
    // client because the list is paginated: a client-side filter would only
    // ever sift the page you happen to be looking at.
    // 10.47: one indexed stored flag column says what is missing (see
    // question-content.ts), so these filters read the index, not every row.
    if (filters.missing && (filters.missing === 'any' || filters.missing in MISSING_BITS)) {
      sql += ` AND ${sqlMissingFilter('q', filters.missing as MissingKey)}`;
    }

    if (filters.usage === 'unused') {
      sql += ' AND q.quiz_count = 0';
    }

    if (filters.usage === 'used') {
      sql += ' AND q.quiz_count > 0';
    }

    const after = !filters.random && Number.isInteger(filters.after) && Number(filters.after) > 0 ? Number(filters.after) : 0;
    if (after) {
      sql += ' AND q.id < ?';
      params.push(after);
    }
    sql += filters.random ? ' ORDER BY RAND()' : ' ORDER BY q.id DESC';

    sql += ' LIMIT ?';
    params.push(pagination.limit);
    if (pagination.offset > 0 && !after) {
      sql += ' OFFSET ?';
      params.push(pagination.offset);
    }

    const [rows] = await this.db.execute<QuestionRow[]>(sql, params);
    return rows.map((row) => this.mapQuestionSummary(row));
  }

  // Remembered per filter set; cleared on any content save (admin-read-cache.ts).
  countByFilters(filters: QuestionFilters) {
    return cachedAdminRead(`questions.counts:${JSON.stringify(filters)}`, () => this.loadCountsByFilters(filters));
  }

  private async loadCountsByFilters(filters: QuestionFilters) {
    // Used / unused come from the stored link count on each question, so this
    // reads only the matching questions (it used to re-read every assessment
    // link in the bank on every call: ~13,000 rows whatever the filter).
    const needsSearchJoins = Boolean(filters.search?.trim());
    let sql = `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(q.quiz_count = 0), 0) AS unused,
        COALESCE(SUM(q.quiz_count > 0), 0) AS used
      FROM questions q
      ${needsSearchJoins ? 'LEFT JOIN subtopics st ON st.id = q.subtopic_id LEFT JOIN papers p ON p.id = q.paper_id' : ''}
      WHERE 1 = 1
    `;
    const params: Array<string | number> = [];

    if (filters.search?.trim()) {
      sql += ' AND (q.question_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)'; // 10.54: keywords removed
      const like = `%${filters.search.trim()}%`;
      params.push(like, like, like, like);
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      sql += ' AND q.status = ?';
      params.push(filters.status);
    }

    if (filters.type === 'sba' || filters.type === 'true_false') {
      sql += ' AND q.question_type = ?';
      params.push(filters.type);
    }

    if (filters.category === 'mock' || filters.category === 'past_paper' || filters.category === 'past' || filters.category === 'ai') {
      sql += " AND (q.question_category = ? OR (q.question_category IS NULL AND q.category = ?))";
      params.push(this.normalizeCategory(filters.category), this.normalizeLegacyCategory(filters.category));
    }

    if (filters.courseId && filters.courseId > 0) {
      sql += ' AND q.course_id = ?';
      params.push(filters.courseId);
    }

    if (filters.subjectId && filters.subjectId > 0) {
      sql += ' AND q.topic_id = ?';
      params.push(filters.subjectId);
    }

    if (filters.topicId && filters.topicId > 0) {
      sql += ' AND q.subtopic_id = ?';
      params.push(filters.topicId);
    }

    if (filters.lessonId && filters.lessonId > 0) {
      sql += ' AND q.lesson_id = ?';
      params.push(filters.lessonId);
    }

    if (filters.paperId && filters.paperId > 0) {
      sql += ' AND q.paper_id = ?';
      params.push(filters.paperId);
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(sql, params);
    const row = rows[0] || {};
    return {
      total: Number(row.total || 0),
      unused: Number(row.unused || 0),
      used: Number(row.used || 0),
    };
  }

  // Form dropdowns; remembered, cleared on any content save (admin-read-cache.ts).
  meta() {
    return cachedAdminRead('questions.meta', () => this.loadMeta());
  }

  /** The Questions list page up front: courses, subjects and papers only
   * (examined = returned). Topics and lessons come per subject (metaSubject). */
  metaFolders() {
    return cachedAdminRead('questions.meta:folders', async () => {
      const [courseRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, course_title FROM courses WHERE status = 'active'");
      const [subjectRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, course_id, topic_name FROM topics WHERE status = 'active'");
      sortByName(courseRows, (r) => String(r.course_title));
      sortByName(subjectRows, (r) => String(r.topic_name));
      const [paperRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, paper_title, year, exam_source, keywords_text FROM papers WHERE status = 'active' ORDER BY year DESC, paper_title ASC");
      return {
        courses: courseRows.map((row) => ({ id: Number(row.id), courseTitle: String(row.course_title) })),
        subjects: subjectRows.map((row) => ({ id: Number(row.id), courseId: Number(row.course_id), subjectName: String(row.topic_name) })),
        topics: [],
        lessons: [],
        papers: paperRows.map((row) => ({
          id: Number(row.id), paperTitle: String(row.paper_title), year: Number(row.year),
          examSource: String(row.exam_source), keywordsText: String(row.keywords_text || ''),
        })),
      };
    });
  }

  /** One subject's active topics and lessons (same shapes as meta()). Each read
   * uses the subject's index, so rows examined = that subject's rows. */
  async metaSubject(topicId: number) {
    if (!Number.isInteger(topicId) || topicId <= 0) throw new BadRequestException('topicId is required');
    const [[subject]] = await this.db.query<RowDataPacket[]>('SELECT course_id FROM topics WHERE id = ?', [topicId]);
    const [rawTopicRows] = await this.db.query<RowDataPacket[]>(
      `SELECT s.id, s.topic_id, s.subtopic_name FROM subtopics s WHERE s.topic_id = ? AND s.status = 'active'`, [topicId]);
    const topicRows: Record<string, any>[] = rawTopicRows.map((row) => ({ ...row, course_id: subject ? subject.course_id : null }));
    const [lessonRows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, course_id, topic_id, subtopic_id, lesson_title
       FROM lessons WHERE topic_id = ? AND status = 'active'`, [topicId]);
    sortByName(topicRows, (r) => String(r.subtopic_name));
    sortByName(lessonRows, (r) => String(r.lesson_title));
    return {
      topicId,
      topics: topicRows.map((row) => ({
        id: Number(row.id), subjectId: Number(row.topic_id), courseId: Number(row.course_id), topicName: String(row.subtopic_name),
      })),
      lessons: lessonRows.map((row) => ({
        id: Number(row.id), courseId: Number(row.course_id), subjectId: Number(row.topic_id),
        topicId: row.subtopic_id === null ? null : Number(row.subtopic_id), lessonTitle: String(row.lesson_title),
      })),
    };
  }

  fixLinkCounts(after: number) {
    return fixQuestionLinkCounts(this.db, after);
  }

  /** Last step of the same fix: courses.question_total from the steps' per-course counts. */
  fixCourseQuestionTotals(counts: unknown, expected: unknown) {
    const clean = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, number> : {});
    return fixCourseQuestionTotals(this.db, clean(counts), clean(expected));
  }

  /** Several subjects' topics and lessons in one request (each read by the subject's index). */
  async metaSubjects(topicIds: number[]) {
    const ids = [...new Set(topicIds.filter((v) => Number.isInteger(v) && v > 0))].slice(0, 50);
    if (!ids.length) return { subjects: [] };
    // Each subject's course read once (not once per topic).
    const [subjectRows] = await this.db.query<RowDataPacket[]>('SELECT id, course_id FROM topics WHERE id IN (?)', [ids]);
    const courseOf = new Map(subjectRows.map((row) => [Number(row.id), Number(row.course_id)]));
    const [rawTopicRows] = await this.db.query<RowDataPacket[]>(
      `SELECT s.id, s.topic_id, s.subtopic_name FROM subtopics s WHERE s.topic_id IN (?) AND s.status = 'active'`, [ids]);
    const topicRows: Record<string, any>[] = rawTopicRows.map((row) => ({ ...row, course_id: courseOf.get(Number(row.topic_id)) ?? null }));
    const [lessonRows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, course_id, topic_id, subtopic_id, lesson_title
       FROM lessons WHERE topic_id IN (?) AND status = 'active'`, [ids]);
    sortByName(topicRows, (r) => String(r.subtopic_name));
    sortByName(lessonRows, (r) => String(r.lesson_title));
    return {
      subjects: ids.map((topicId) => ({
        topicId,
        topics: topicRows.filter((row) => Number(row.topic_id) === topicId).map((row) => ({
          id: Number(row.id), subjectId: Number(row.topic_id), courseId: Number(row.course_id), topicName: String(row.subtopic_name),
        })),
        lessons: lessonRows.filter((row) => Number(row.topic_id) === topicId).map((row) => ({
          id: Number(row.id), courseId: Number(row.course_id), subjectId: Number(row.topic_id),
          topicId: row.subtopic_id === null ? null : Number(row.subtopic_id), lessonTitle: String(row.lesson_title),
        })),
      })),
    };
  }

  private async loadMeta() {
    const [courseRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC"
    );
    const [subjectRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_id, topic_name FROM topics WHERE status = 'active' ORDER BY topic_name ASC"
    );
    const [topicRows] = await this.db.execute<RowDataPacket[]>(
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

    return {
      courses: courseRows.map((row) => ({
        id: Number(row.id),
        courseTitle: String(row.course_title),
      })),
      subjects: subjectRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        subjectName: String(row.topic_name),
      })),
      topics: topicRows.map((row) => ({
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
    };
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<QuestionRow[]>(
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
          q.question_category,
          q.question_type,
          q.question_text,
          q.explanation,
          q.explanation_image_url,
          q.question_approach,
          q.question_approach_highlights,
          q.status,
          q.created_at,
          q.updated_at,
          q.quiz_count,
          q.options_json,
          c.course_title,
          s.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          l.lesson_title,
          p.paper_title,
          1 AS content_version -- 10.39: version history no longer kept
        FROM questions q
        LEFT JOIN courses c ON c.id = q.course_id
        LEFT JOIN topics s ON s.id = q.topic_id
        LEFT JOIN subtopics st ON st.id = q.subtopic_id
        LEFT JOIN lessons l ON l.id = q.lesson_id
        LEFT JOIN papers p ON p.id = q.paper_id
        WHERE q.id = ?
        LIMIT 1
      `,
      [id]
    );

    const question = rows[0];
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const optionRows = optionsOf(id, (question as any).options_json); // 10.43

    return {
      ...this.mapQuestionSummary(question),
      options: optionRows.map((row) => ({
        id: row.id,
        optionLabel: row.option_label,
        optionText: row.option_text,
        isCorrect: Number(row.is_correct),
        whyIncorrect: row.why_incorrect || '',
      })),
    };
  }

  async exportWorkbook(filters: QuestionFilters, actor?: ContentActorInput) {
    const questions = await this.loadQuestionsForExport(filters);
    const ids = questions.map((question) => question.id);
    const optionsByQuestionId = await this.loadOptionsForQuestionIds(ids);

    const questionRows = questions.map((question) => {
      const optionMap = new Map(
        (optionsByQuestionId.get(question.id) || []).map((option) => [option.option_label, option])
      );

      const row: Record<string, string | number> = {
        question_id: question.id,
        course: String(question.course_title || ''),
        subject: String(question.subject_name || ''),
        topic: String(question.topic_name || ''),
        lesson: String(question.lesson_title || ''),
        paper: String(question.paper_title || ''),
        topic_label: String(question.subtopic || ''),
        category: this.mapQuestionSummary(question).category,
        question_type: String(question.question_type || ''),
        question_text: String(question.question_text || ''),
        explanation: String(question.explanation || ''),
        status: String(question.status || 'active'),
      };

      for (const label of OPTION_LABELS) {
        const option = optionMap.get(label);
        row[`option_${label.toLowerCase()}_text`] = String(option?.option_text || '');
        row[`option_${label.toLowerCase()}_correct`] = Number(option?.is_correct) === 1 ? 1 : 0;
        row[`option_${label.toLowerCase()}_why_incorrect`] = String(option?.why_incorrect || '');
      }

      return row;
    });

    const rows = [IMPORT_COLUMNS, ...(questionRows.length > 0 ? questionRows : [this.buildEmptyExportRow()]).map((row) => (
      IMPORT_COLUMNS.map((column) => row[column] ?? '')
    ))];

    await this.recordAdminAuditEvent({
      eventType: 'questions.exported',
      actorId: this.getActorId(actor),
      targetType: 'question_export',
      summary: 'Question CSV export generated',
      metadata: {
        filters: this.serializeQuestionFilters(filters),
        questionCount: questions.length,
      },
    });

    return Buffer.from(rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n'), 'utf8');
  }

  async importWorkbook(file: any, actor?: ContentActorInput) {
    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('Please upload a CSV file');
    }

    const rows = await this.readImportRows(file);

    if (rows.length === 0) {
      throw new BadRequestException('The uploaded sheet does not contain any question rows');
    }

    if (rows.length > 2000) {
      throw new BadRequestException('Question imports are limited to 2000 rows per file');
    }

    const lookups = await this.loadImportLookups();
    const payloads: ImportPayload[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const isBlank = IMPORT_COLUMNS.every((column) => String(row[column] ?? '').trim() === '');
      if (isBlank) {
        return;
      }

      try {
        this.validateImportRowSafety(row);
        const payload = this.mapImportRowToPayload(row, lookups);
        payloads.push({
          rowNumber,
          sourceQuestionId: String(row.question_id || '').trim(),
          fingerprint: this.buildImportFingerprint(payload),
          payload,
        });
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Invalid row'}`);
      }
    });

    if (payloads.length === 0) {
      throw new BadRequestException(errors[0] || 'No valid question rows found');
    }

    const duplicateRows = new Set<number>();
    errors.push(...this.findInFileImportDuplicateErrors(payloads, duplicateRows));
    errors.push(...await this.findExistingImportDuplicateErrors(payloads, duplicateRows));

    const importedIds: number[] = [];

    for (const item of payloads.filter((payload) => !duplicateRows.has(payload.rowNumber))) {
      try {
        const result = await this.create(item.payload, actor);
        importedIds.push(Number(result.id));
      } catch (error) {
        errors.push(`Row ${item.rowNumber}: ${error instanceof Error ? error.message : 'Unable to import row'}`);
      }
    }

    return {
      ok: true,
      importedCount: importedIds.length,
      failedCount: errors.length,
      importedIds,
      errors,
    };
  }

  private async readImportRows(file: { buffer: Buffer; originalname: string }) {
    const originalName = String(file.originalname || '').toLowerCase();
    if (!originalName.endsWith('.csv')) {
      throw new BadRequestException('Only CSV question imports are allowed');
    }
    return this.parseCsvRows(file.buffer.toString('utf8'));
  }

  private parseCsvRows(csv: string) {
    const parsedRows: string[][] = [];
    let cell = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let index = 0; index < csv.length; index++) {
      const char = csv[index];
      const next = csv[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') index++;
        row.push(cell);
        parsedRows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    if (inQuotes) {
      throw new BadRequestException('CSV format is invalid: a quoted cell is not closed');
    }

    row.push(cell);
    parsedRows.push(row);

    const headers = parsedRows.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim()) || [];
    this.validateImportHeaders(headers);

    const extraCellRowIndex = parsedRows.findIndex((values) => values.length > headers.length);
    if (extraCellRowIndex >= 0) {
      throw new BadRequestException(`CSV row ${extraCellRowIndex + 2} has more cells than the header row`);
    }

    return parsedRows
      .filter((values) => values.some((value) => value.trim() !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  private validateImportHeaders(headers: string[]) {
    const cleanHeaders = headers.filter(Boolean);
    const seen = new Set<string>();
    const duplicateHeaders = cleanHeaders.filter((header) => {
      if (seen.has(header)) return true;
      seen.add(header);
      return false;
    });
    const headerSet = new Set(cleanHeaders);
    const missing = IMPORT_COLUMNS.filter((column) => !headerSet.has(column));
    const unsupported = cleanHeaders.filter((header) => !IMPORT_COLUMNS.includes(header as (typeof IMPORT_COLUMNS)[number]));

    if (duplicateHeaders.length > 0) {
      throw new BadRequestException(`CSV headers are duplicated: ${Array.from(new Set(duplicateHeaders)).join(', ')}`);
    }

    if (missing.length > 0) {
      throw new BadRequestException(`CSV headers missing required columns: ${missing.join(', ')}`);
    }

    if (unsupported.length > 0) {
      throw new BadRequestException(`CSV contains unsupported columns: ${unsupported.join(', ')}`);
    }
  }

  private validateImportRowSafety(row: Record<string, unknown>) {
    const mediaColumns = Object.entries(row)
      .filter(([, value]) => this.containsEmbeddedMediaPayload(value))
      .map(([column]) => column);

    if (mediaColumns.length > 0) {
      throw new Error(`Embedded media is not supported in CSV imports (${mediaColumns.join(', ')}). Upload media through approved LMS media tools and reference safe links only.`);
    }
  }

  private containsEmbeddedMediaPayload(value: unknown) {
    const cell = String(value || '').trim().toLowerCase();
    if (!cell) return false;

    return (
      /data:(image|video|audio|application\/pdf)[/;]/.test(cell) ||
      /<\s*(img|video|audio|iframe|object|embed)\b/.test(cell) ||
      /!\[[^\]]*]\([^)]*\)/.test(cell) ||
      /\b(file|blob|javascript):/.test(cell)
    );
  }

  private buildImportFingerprint(question: CreateQuestionDto) {
    const options = question.options
      .map((option) => [
        this.normalizeLookup(option.optionLabel),
        this.normalizeLookup(option.optionText),
        Number(option.isCorrect) === 1 ? '1' : '0',
      ])
      .sort((left, right) => left[0].localeCompare(right[0]));

    return JSON.stringify([
      this.normalizeLookup(question.questionType),
      this.normalizeLookup(question.questionText),
      options,
    ]);
  }

  private findInFileImportDuplicateErrors(payloads: ImportPayload[], duplicateRows: Set<number>) {
    const errors: string[] = [];
    const firstRowBySourceId = new Map<string, number>();
    const firstRowByFingerprint = new Map<string, number>();

    for (const item of payloads) {
      const sourceId = item.sourceQuestionId;
      if (sourceId) {
        const firstRow = firstRowBySourceId.get(sourceId);
        if (firstRow) {
          duplicateRows.add(item.rowNumber);
          errors.push(`Row ${item.rowNumber}: Duplicate question_id "${sourceId}" also appears on row ${firstRow}`);
        } else {
          firstRowBySourceId.set(sourceId, item.rowNumber);
        }
      }

      const firstContentRow = firstRowByFingerprint.get(item.fingerprint);
      if (firstContentRow) {
        duplicateRows.add(item.rowNumber);
        errors.push(`Row ${item.rowNumber}: Duplicate question content matches row ${firstContentRow}`);
      } else {
        firstRowByFingerprint.set(item.fingerprint, item.rowNumber);
      }
    }

    return errors;
  }

  private async findExistingImportDuplicateErrors(payloads: ImportPayload[], duplicateRows: Set<number>) {
    const candidates = payloads.filter((item) => !duplicateRows.has(item.rowNumber));
    const questionKeys = Array.from(new Set(
      candidates
        .map((item) => this.normalizeLookup(item.payload.questionText))
        .filter(Boolean)
    ));

    if (questionKeys.length === 0) {
      return [];
    }

    const placeholders = sqlPlaceholders(questionKeys);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, LOWER(TRIM(question_text)) AS question_key
       FROM questions
       WHERE LOWER(TRIM(question_text)) IN (${placeholders})`,
      questionKeys
    );

    const existingByKey = new Map<string, number>();
    rows.forEach((row) => {
      const key = String(row.question_key || '').trim().toLowerCase();
      if (key && !existingByKey.has(key)) {
        existingByKey.set(key, Number(row.id));
      }
    });

    const errors: string[] = [];
    for (const item of candidates) {
      const existingId = existingByKey.get(this.normalizeLookup(item.payload.questionText));
      if (existingId) {
        duplicateRows.add(item.rowNumber);
        errors.push(`Row ${item.rowNumber}: Question text already exists as question #${existingId}`);
      }
    }

    return errors;
  }

  private escapeCsvCell(value: unknown) {
    const cell = String(value ?? '');
    if (/[",\r\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  async create(createQuestionDto: CreateQuestionDto, actor?: ContentActorInput) {
    this.validateQuestionPayload(createQuestionDto);
    this.assertCanSaveStatus(actor, createQuestionDto.status);
    if (createQuestionDto.status === 'active') {
      this.validateQuestionPublishReady(createQuestionDto);
    }
    await this.ensureHierarchyExists(createQuestionDto);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO questions (
            course_id, topic_id, subtopic_id, lesson_id, paper_id, subtopic, category, question_category, question_type,
            question_text, explanation, explanation_image_url, question_approach, question_approach_highlights, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createQuestionDto.courseId,
          // ?? null like its siblings. questions.topic_id is nullable — a past
          // paper spans a whole course rather than one subject — and mysql2
          // refuses to bind undefined, so a payload that simply omits it would
          // throw rather than store nothing.
          createQuestionDto.subjectId ?? null,
          createQuestionDto.topicId ?? null,
          createQuestionDto.lessonId ?? null,
          createQuestionDto.paperId ?? null,
          (createQuestionDto.topicLabel || '').trim(),
          this.normalizeLegacyCategory(createQuestionDto.category),
          this.normalizeCategory(createQuestionDto.category),
          createQuestionDto.questionType,
          createQuestionDto.questionText.trim(),
          (createQuestionDto.explanation || '').trim(),
          this.cleanExplanationImage(createQuestionDto.explanationImageUrl),
          (createQuestionDto.questionApproach || '').trim(),
          this.serializeApproachHighlights(createQuestionDto.questionApproachHighlights),
          createQuestionDto.status,
        ]
      );

      await applyQuestionTotalChanges(connection, [], [{ id: result.insertId, course_id: Number(createQuestionDto.courseId) }]);
      await this.replaceOptions(connection, result.insertId, createQuestionDto.options, createQuestionDto.questionType);
      await this.recordContentVersion(connection, 'question', result.insertId, this.buildQuestionSnapshot(createQuestionDto), this.getActorId(actor));
      await this.setWorkflowState(connection, 'question', result.insertId, createQuestionDto.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: result.insertId,
        action: 'created',
        summary: `Question ${result.insertId} created`,
        actorId: this.getActorId(actor),
        after: this.buildQuestionSnapshot(createQuestionDto),
      });

      await connection.commit();
      return { ok: true, id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updateQuestionDto: UpdateQuestionDto, actor?: ContentActorInput) {
    const existing = await this.findOne(id);
    const merged: CreateQuestionDto = {
      courseId: updateQuestionDto.courseId ?? existing.courseId,
      subjectId: updateQuestionDto.subjectId ?? existing.subjectId,
      topicId: updateQuestionDto.topicId ?? existing.topicId ?? null,
      lessonId: updateQuestionDto.lessonId ?? existing.lessonId ?? null,
      paperId: updateQuestionDto.paperId ?? existing.paperId ?? null,
      topicLabel: updateQuestionDto.topicLabel ?? existing.topicLabel ?? '',
      category:
        (updateQuestionDto.category ?? existing.category) as CreateQuestionDto['category'],
      questionType: updateQuestionDto.questionType ?? existing.questionType,
      questionText: updateQuestionDto.questionText ?? existing.questionText,
      explanation: updateQuestionDto.explanation ?? existing.explanation ?? '',
      explanationImageUrl:
        updateQuestionDto.explanationImageUrl !== undefined
          ? updateQuestionDto.explanationImageUrl
          : existing.explanationImageUrl ?? null,
      questionApproach: updateQuestionDto.questionApproach ?? existing.questionApproach ?? '',
      questionApproachHighlights:
        updateQuestionDto.questionApproachHighlights ?? existing.questionApproachHighlights ?? [],
      status: updateQuestionDto.status ?? existing.status,
      options:
        updateQuestionDto.options ??
        existing.options.map((option) => ({
          optionLabel: option.optionLabel,
          optionText: option.optionText,
          isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
          whyIncorrect: option.whyIncorrect || '',
        })),
    };

    this.validateQuestionPayload(merged);
    this.assertCanModifyExistingStatus(actor, existing.status);
    this.assertCanSaveStatus(actor, merged.status);
    if (merged.status === 'active') {
      this.validateQuestionPublishReady(merged);
    }
    await this.ensureHierarchyExists(merged);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the row first and move the course's question total if it changes.
      const courseBefore = await readQuestionCourses(connection, [id]);
      // 10.27 R1: the quizzes holding this question get a new content stamp.
      await bumpQuizStamps(connection, { questionIds: [id] });

      await connection.execute(
        `
          UPDATE questions SET
            course_id = ?,
            topic_id = ?,
            subtopic_id = ?,
            lesson_id = ?,
            paper_id = ?,
            subtopic = ?,
            category = ?,
            question_category = ?,
            question_type = ?,
            question_text = ?,
            explanation = ?,
            explanation_image_url = ?,
            question_approach = ?,
            question_approach_highlights = ?,
            status = ?
          WHERE id = ?
        `,
        [
          merged.courseId,
          merged.subjectId ?? null, // nullable: see the insert above
          merged.topicId ?? null,
          merged.lessonId ?? null,
          merged.paperId ?? null,
          (merged.topicLabel || '').trim(),
          this.normalizeLegacyCategory(merged.category),
          this.normalizeCategory(merged.category),
          merged.questionType,
          merged.questionText.trim(),
          (merged.explanation || '').trim(),
          this.cleanExplanationImage(merged.explanationImageUrl),
          (merged.questionApproach || '').trim(),
          this.serializeApproachHighlights(merged.questionApproachHighlights),
          merged.status,
          id,
        ]
      );
      await applyQuestionTotalChanges(connection, courseBefore, courseBefore.map((q) => ({ ...q, course_id: Number(merged.courseId) })));

      await this.replaceOptions(connection, id, merged.options, merged.questionType);
      await this.recordContentVersion(connection, 'question', id, this.buildQuestionSnapshot(merged), this.getActorId(actor));
      await this.setWorkflowState(connection, 'question', id, merged.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: id,
        action: 'updated',
        summary: `Question ${id} updated`,
        actorId: this.getActorId(actor),
        before: existing,
        after: this.buildQuestionSnapshot(merged),
      });

      await connection.commit();
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
      const courseBefore = await readQuestionCourses(connection, [id]);
      // 10.27 R1: the quizzes holding this question get a new content stamp,
      // and their stored size drops by it (the links go with the question).
      await bumpQuizStampsForDeletedQuestions(connection, [id]);
      await connection.execute('DELETE FROM questions WHERE id = ?', [id]);
      await forgetContentHistory(connection, 'question', [id]);
      await applyQuestionTotalChanges(connection, courseBefore, []);
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: id,
        action: 'deleted',
        summary: `Question ${id} deleted`,
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

  async bulkDelete(bulkDeleteQuestionsDto: BulkDeleteQuestionsDto, actor?: ContentActorInput) {
    const questionIds = Array.from(
      new Set(
        (bulkDeleteQuestionsDto.questionIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    if (questionIds.length === 0) {
      throw new BadRequestException('Please select at least one question');
    }

    const placeholders = sqlPlaceholders(questionIds);
    const [questionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, status FROM questions WHERE id IN (${placeholders})`,
      questionIds
    );

    if (questionRows.length !== questionIds.length) {
      throw new NotFoundException('One or more questions could not be found');
    }
    if (!this.canReviewContent(actor) && questionRows.some((row) => String(row.status || '') === 'active')) {
      throw new ForbiddenException('Published questions require review permission before deletion');
    }

    const [linkRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT qq.question_id, COUNT(DISTINCT qq.quiz_id) AS quiz_count
        FROM question_quizzes qq
        WHERE qq.question_id IN (${placeholders})
        GROUP BY qq.question_id
      `,
      questionIds
    );
    const linkedQuestionCount = linkRows.filter((row) => Number(row.quiz_count || 0) > 0).length;
    const linkedQuizCount = linkRows.reduce((total, row) => total + Number(row.quiz_count || 0), 0);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the questions first (questions → courses), then their courses' totals.
      const coursesBefore = await readQuestionCourses(connection, questionIds);
      // 10.27 R1: before the links go, so their quizzes get a new stamp and
      // their stored size without these questions.
      await bumpQuizStampsForDeletedQuestions(connection, questionIds);
      await connection.execute(`DELETE FROM question_quizzes WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM question_reports WHERE question_id IN (${placeholders})`, questionIds);
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM questions WHERE id IN (${placeholders})`,
        questionIds
      );
      await forgetContentHistory(connection, 'question', questionIds);
      await applyQuestionTotalChanges(connection, coursesBefore, []);
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: 0,
        action: 'bulk_deleted',
        summary: `${result.affectedRows} question(s) deleted`,
        actorId: this.getActorId(actor),
        before: { questionIds },
      });
      await connection.commit();

      return {
        ok: true,
        deletedCount: result.affectedRows,
        linkedQuestionCount,
        linkedQuizCount,
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
      summary: `Question ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Question ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Question ${id} published`,
      actor,
      requirePublishReady: true,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id; void versionNumber; void actor;
    throw new BadRequestException('Version history is not kept any more.');
  }

  private async ensureHierarchyExists(question: CreateQuestionDto) {
    await this.ensureExists('courses', question.courseId, 'Selected course was not found');
    // Only when one was given. A past paper, and a course-wide assessment,
    // file their questions against the course alone — there is no subject row
    // to look for, and asking for one by id 0 found nothing and refused the
    // save.
    if (question.subjectId) {
      await this.ensureExists('topics', question.subjectId, 'Selected subject was not found');
    }

    if (question.topicId) {
      await this.ensureExists('subtopics', question.topicId, 'Selected topic was not found');
    }

    if (question.lessonId) {
      await this.ensureExists('lessons', question.lessonId, 'Selected lesson was not found');
    }

    if (question.paperId) {
      await this.ensureExists('papers', question.paperId, 'Selected paper was not found');
    }
  }

  private buildQuestionSnapshot(question: CreateQuestionDto) {
    return {
      courseId: question.courseId,
      subjectId: question.subjectId,
      topicId: question.topicId ?? null,
      lessonId: question.lessonId ?? null,
      paperId: question.paperId ?? null,
      topicLabel: question.topicLabel || '',
      category: question.category,
      questionType: question.questionType,
      questionText: question.questionText,
      explanation: question.explanation || '',
      explanationImageUrl: question.explanationImageUrl || null,
      questionApproach: question.questionApproach || '',
      questionApproachHighlights: question.questionApproachHighlights || [],
      status: question.status,
      options: (question.options || []).map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: option.whyIncorrect || option.why_incorrect || '',
      })),
    };
  }

  private buildQuestionSnapshotFromEntity(question: Awaited<ReturnType<QuestionsService['findOne']>>, status: 'active' | 'inactive') {
    return this.buildQuestionSnapshot({
      courseId: Number(question.courseId),
      subjectId: Number(question.subjectId),
      topicId: question.topicId === null || question.topicId === undefined ? null : Number(question.topicId),
      lessonId: question.lessonId === null || question.lessonId === undefined ? null : Number(question.lessonId),
      paperId: question.paperId === null || question.paperId === undefined ? null : Number(question.paperId),
      topicLabel: question.topicLabel || '',
      category: question.category as CreateQuestionDto['category'],
      questionType: question.questionType as CreateQuestionDto['questionType'],
      questionText: question.questionText,
      explanation: question.explanation || '',
      explanationImageUrl: question.explanationImageUrl || null,
      questionApproach: question.questionApproach || '',
      questionApproachHighlights: question.questionApproachHighlights || [],
      status,
      options: question.options.map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: option.whyIncorrect || '',
      })),
    }) as CreateQuestionDto;
  }

  private async transitionWorkflow(
    id: number,
    input: {
      workflowState: ContentWorkflowState;
      status: 'active' | 'inactive';
      action: string;
      summary: string;
      actor?: ContentActorInput;
      requirePublishReady?: boolean;
    }
  ) {
    const existing = await this.findOne(id);
    this.assertCanModifyExistingStatus(input.actor, existing.status);
    this.assertCanSaveStatus(input.actor, input.status);
    const snapshot = this.buildQuestionSnapshotFromEntity(existing, input.status);
    this.validateQuestionPayload(snapshot);
    if (input.requirePublishReady) {
      this.validateQuestionPublishReady(snapshot);
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE questions SET status = ? WHERE id = ?', [input.status, id]);
      await bumpQuizStamps(connection, { questionIds: [id] }); // 10.27 R1
      await this.recordContentVersion(connection, 'question', id, snapshot, this.getActorId(input.actor));
      await this.setWorkflowState(connection, 'question', id, input.workflowState, this.getActorId(input.actor));
      await this.recordContentAudit(connection, {
        entityType: 'question',
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

  private async writeQuestionSnapshot(connection: PoolConnection, id: number, question: CreateQuestionDto) {
    const courseBefore = await readQuestionCourses(connection, [id]);
      // 10.27 R1: the quizzes holding this question get a new content stamp.
      await bumpQuizStamps(connection, { questionIds: [id] });
    await connection.execute(
      `
        UPDATE questions SET
          course_id = ?,
          topic_id = ?,
          subtopic_id = ?,
          lesson_id = ?,
          paper_id = ?,
          subtopic = ?,
          category = ?,
          question_category = ?,
          question_type = ?,
          question_text = ?,
          explanation = ?,
          explanation_image_url = ?,
          status = ?
        WHERE id = ?
      `,
      [
        question.courseId,
        question.subjectId ?? null,
        question.topicId ?? null,
        question.lessonId ?? null,
        question.paperId ?? null,
        (question.topicLabel || '').trim(),
        this.normalizeLegacyCategory(question.category),
        this.normalizeCategory(question.category),
        question.questionType,
        question.questionText.trim(),
        (question.explanation || '').trim(),
        this.cleanExplanationImage(question.explanationImageUrl),
        question.status,
        id,
      ]
    );
    await applyQuestionTotalChanges(connection, courseBefore, courseBefore.map((q) => ({ ...q, course_id: Number(question.courseId) })));
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

  private parseQuestionSnapshot(value: unknown): CreateQuestionDto {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<CreateQuestionDto>;
    return {
      courseId: Number(snapshot.courseId),
      subjectId: Number(snapshot.subjectId),
      topicId: snapshot.topicId === null || snapshot.topicId === undefined ? null : Number(snapshot.topicId),
      lessonId: snapshot.lessonId === null || snapshot.lessonId === undefined ? null : Number(snapshot.lessonId),
      paperId: snapshot.paperId === null || snapshot.paperId === undefined ? null : Number(snapshot.paperId),
      topicLabel: String(snapshot.topicLabel || ''),
      category: (snapshot.category === 'past' || snapshot.category === 'past_paper' || snapshot.category === 'ai') ? snapshot.category : 'mock',
      questionType: snapshot.questionType === 'true_false' ? 'true_false' : 'sba',
      questionText: String(snapshot.questionText || ''),
      explanation: String(snapshot.explanation || ''),
      status: snapshot.status === 'active' ? 'active' : 'inactive',
      options: Array.isArray(snapshot.options)
        ? snapshot.options.map((option: any) => ({
            optionLabel: String(option?.optionLabel || option?.option_label || ''),
            optionText: String(option?.optionText || option?.option_text || ''),
            isCorrect: Number(option?.isCorrect ?? option?.is_correct) === 1 ? 1 : 0,
            whyIncorrect: String(option?.whyIncorrect || option?.why_incorrect || ''),
          }))
        : [],
    };
  }

  private async recordContentVersion(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    snapshot: unknown,
    actorId?: number
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
    }
  ) {
    void 0; // 10.37: change history no longer stored (table dropped, never read)
  }

  private async recordAdminAuditEvent(input: {
    eventType: string;
    actorId?: number | null;
    targetType?: string | null;
    targetId?: number | null;
    summary: string;
    metadata?: unknown;
  }) {
    void 0; // 10.37: change history no longer stored (table dropped, never read)
  }

  private serializeQuestionFilters(filters: QuestionFilters) {
    return {
      search: filters.search || '',
      status: filters.status || '',
      type: filters.type || '',
      category: filters.category || '',
      usage: filters.usage || '',
      courseId: filters.courseId || null,
      subjectId: filters.subjectId || null,
      topicId: filters.topicId || null,
      lessonId: filters.lessonId || null,
      paperId: filters.paperId || null,
      unclassified: Boolean(filters.unclassified),
    };
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
      throw new ForbiddenException('Review permission is required to publish question content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published questions require review permission before modification');
    }
  }

  private async ensureExists(tableName: string, id: number, message: string) {
    const table = sqlIdentifier(tableName, QUESTION_LOOKUP_TABLES, 'question lookup table');
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) {
      throw new BadRequestException(message);
    }
  }

  private validateQuestionPayload(question: CreateQuestionDto) {
    if (!question.courseId || question.courseId <= 0) {
      throw new BadRequestException('Please select a course');
    }

    // No subject check. A question belongs to a COURSE; the subject is how it
    // is filed within one, and questions.topic_id is nullable precisely so a
    // past paper or a course-wide assessment can leave it out.
    //
    // This is the fourth place the same rule was written — the client
    // validator, the DTO's @IsInt(), ensureHierarchyExists, and here — and it
    // is the one that kept throwing after the other three were relaxed,
    // because nothing connects them. A value this check rejects, 0, can no
    // longer be produced either: the client sends null for "no subject" now,
    // since 0 is an id pointing at no row.

    if (!question.questionText.trim()) {
      throw new BadRequestException('Question text is required');
    }

    const options = question.options
      .map((option) => ({
        optionLabel: option.optionLabel.trim().toUpperCase(),
        optionText: option.optionText.trim(),
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: this.normalizeWhyIncorrect(option),
      }))
      .filter((option) => option.optionText !== '');

    if (question.questionType === 'sba') {
      if (options.length !== 5) {
        throw new BadRequestException('SBA questions must contain exactly 5 options');
      }

      const correctCount = options.filter((option) => option.isCorrect === 1).length;
      if (correctCount !== 1) {
        throw new BadRequestException('Please select exactly one correct SBA answer');
      }
    }

    if (question.questionType === 'true_false') {
      if (options.length !== 5) {
        throw new BadRequestException('True / False questions must contain exactly 5 statements');
      }

      const invalid = options.find((option) => option.isCorrect !== 0 && option.isCorrect !== 1);
      if (invalid) {
        throw new BadRequestException(`Please choose True or False for statement ${invalid.optionLabel}`);
      }
    }
  }

  private validateQuestionPublishReady(question: CreateQuestionDto) {
    if (!String(question.explanation || '').trim()) {
      throw new BadRequestException('A reviewed explanation is required before publishing a question');
    }

    const options = question.options
      .map((option) => ({
        optionLabel: String(option.optionLabel || '').trim().toUpperCase(),
        optionText: String(option.optionText || '').trim(),
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: this.normalizeWhyIncorrect(option),
      }))
      .filter((option) => option.optionText !== '');

    const missingRationales = options.filter((option) => option.isCorrect !== 1 && !option.whyIncorrect);
    if (missingRationales.length > 0) {
      throw new BadRequestException(`Every incorrect option needs a review explanation before publishing (${missingRationales.map((option) => option.optionLabel).join(', ')})`);
    }
  }

  private async replaceOptions(connection: PoolConnection, questionId: number, options: QuestionOptionDto[], questionType: string) {
    // 10.43: one write — the options go into the question row. An existing
    // option keeps its id (same label), so past answers still match.
    const cleaned = options
      .map((option) => ({
        optionLabel: option.optionLabel.trim().toUpperCase(),
        optionText: option.optionText.trim(),
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: this.normalizeWhyIncorrect(option),
      }))
      .filter((option) => option.optionText !== '')
      .map((option) => ({
        ...option,
        whyIncorrect: questionType === 'sba' && option.isCorrect === 1 ? null : option.whyIncorrect || null,
      }));
    const [prev] = await connection.execute<RowDataPacket[]>('SELECT options_json FROM questions WHERE id = ? LIMIT 1', [questionId]);
    await connection.execute('UPDATE questions SET options_json = ? WHERE id = ?', [
      optionsJsonFor(questionId, cleaned, prev[0]?.options_json),
      questionId,
    ]);
  }

  private normalizeWhyIncorrect(option: QuestionOptionDto) {
    const raw = option.whyIncorrect ?? option.why_incorrect ?? '';
    return String(raw || '').trim();
  }

  private normalizeCategory(category: string) {
    if (category === 'mock') return 'mock';
    if (category === 'ai') return 'ai';
    return 'past_paper';
  }

  private normalizeLegacyCategory(category: string) {
    if (category === 'mock') return 'mock';
    if (category === 'ai') return 'ai';
    return 'past';
  }

  private async loadQuestionsForExport(filters: QuestionFilters) {
    let sql = `
      SELECT
        q.id,
        q.course_id,
        q.topic_id,
        q.subtopic_id,
        q.lesson_id,
        q.paper_id,
        q.subtopic,
        q.category,
        q.question_category,
        q.question_type,
        q.question_text,
        q.explanation,
        q.status,
        q.created_at,
        c.course_title,
        s.topic_name AS subject_name,
        st.subtopic_name AS topic_name,
        l.lesson_title,
        p.paper_title,
        COALESCE(qql.quiz_count, 0) AS quiz_count
      FROM questions q
      LEFT JOIN courses c ON c.id = q.course_id
      LEFT JOIN topics s ON s.id = q.topic_id
      LEFT JOIN subtopics st ON st.id = q.subtopic_id
      LEFT JOIN lessons l ON l.id = q.lesson_id
      LEFT JOIN papers p ON p.id = q.paper_id
      LEFT JOIN (
        SELECT question_id, COUNT(DISTINCT quiz_id) AS quiz_count
        FROM question_quizzes
        GROUP BY question_id
      ) qql ON qql.question_id = q.id
      WHERE 1 = 1
    `;
    const params: Array<string | number> = [];

    if (filters.search?.trim()) {
      sql += ' AND (q.question_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)'; // 10.54: keywords removed
      const like = `%${filters.search.trim()}%`;
      params.push(like, like, like, like);
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      sql += ' AND q.status = ?';
      params.push(filters.status);
    }

    if (filters.type === 'sba' || filters.type === 'true_false') {
      sql += ' AND q.question_type = ?';
      params.push(filters.type);
    }

    if (filters.category === 'mock' || filters.category === 'past_paper' || filters.category === 'past' || filters.category === 'ai') {
      sql += " AND (q.question_category = ? OR (q.question_category IS NULL AND q.category = ?))";
      params.push(this.normalizeCategory(filters.category), this.normalizeLegacyCategory(filters.category));
    }

    if (filters.courseId && filters.courseId > 0) {
      sql += ' AND q.course_id = ?';
      params.push(filters.courseId);
    }

    if (filters.subjectId && filters.subjectId > 0) {
      sql += ' AND q.topic_id = ?';
      params.push(filters.subjectId);
    }

    if (filters.topicId && filters.topicId > 0) {
      sql += ' AND q.subtopic_id = ?';
      params.push(filters.topicId);
    }

    if (filters.lessonId && filters.lessonId > 0) {
      sql += ' AND q.lesson_id = ?';
      params.push(filters.lessonId);
    }

    if (filters.paperId && filters.paperId > 0) {
      sql += ' AND q.paper_id = ?';
      params.push(filters.paperId);
    }

    if (filters.unclassified) {
      sql += ' AND (q.subtopic_id IS NULL OR q.lesson_id IS NULL)';
    }

    // Each clause asks "is this piece absent", the same way the admin panel
    // decides whether to generate it. Kept as SQL rather than filtered in the
    // client because the list is paginated: a client-side filter would only
    // ever sift the page you happen to be looking at.
    // 10.47: one indexed stored flag column says what is missing (see
    // question-content.ts), so these filters read the index, not every row.
    if (filters.missing && (filters.missing === 'any' || filters.missing in MISSING_BITS)) {
      sql += ` AND ${sqlMissingFilter('q', filters.missing as MissingKey)}`;
    }

    if (filters.usage === 'unused') {
      sql += ' AND COALESCE(qql.quiz_count, 0) = 0';
    }

    if (filters.usage === 'used') {
      sql += ' AND COALESCE(qql.quiz_count, 0) > 0';
    }

    sql += ' ORDER BY q.id DESC';

    const [rows] = await this.db.execute<ExportQuestionRow[]>(sql, params);
    return rows;
  }

  private async loadOptionsForQuestionIds(questionIds: number[]) {
    // 10.43: options are in the question row.
    const map = new Map<number, OptionRow[]>();
    if (questionIds.length === 0) {
      return map;
    }
    const placeholders = sqlPlaceholders(questionIds);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, options_json FROM questions WHERE id IN (${placeholders})`,
      questionIds
    );
    rows.forEach((row) => {
      map.set(Number(row.id), optionsOf(Number(row.id), row.options_json) as unknown as OptionRow[]);
    });
    return map;
  }

  private buildEmptyExportRow() {
    return Object.fromEntries(IMPORT_COLUMNS.map((column) => [column, '']));
  }

  private async loadImportLookups() {
    const [courseRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_title FROM courses WHERE status = 'active'"
    );
    const [subjectRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_id, topic_name FROM topics WHERE status = 'active'"
    );
    const [topicRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT s.id, s.topic_id, t.course_id, s.subtopic_name
        FROM subtopics s
        INNER JOIN topics t ON t.id = s.topic_id
        WHERE s.status = 'active'
      `
    );
    const [lessonRows] = await this.db.execute<RowDataPacket[]>(
      `
        SELECT id, course_id, topic_id, subtopic_id, lesson_title
        FROM lessons
        WHERE status = 'active'
      `
    );
    const [paperRows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, paper_title FROM papers WHERE status = 'active'"
    );

    return {
      courses: courseRows.map((row) => ({
        id: Number(row.id),
        name: String(row.course_title || '').trim(),
      })),
      subjects: subjectRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        name: String(row.topic_name || '').trim(),
      })),
      topics: topicRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        subjectId: Number(row.topic_id),
        name: String(row.subtopic_name || '').trim(),
      })),
      lessons: lessonRows.map((row) => ({
        id: Number(row.id),
        courseId: Number(row.course_id),
        subjectId: Number(row.topic_id),
        topicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
        name: String(row.lesson_title || '').trim(),
      })),
      papers: paperRows.map((row) => ({
        id: Number(row.id),
        name: String(row.paper_title || '').trim(),
      })),
    };
  }

  private mapImportRowToPayload(
    row: Record<string, unknown>,
    lookups: Awaited<ReturnType<QuestionsService['loadImportLookups']>>
  ): CreateQuestionDto {
    const courseName = String(row.course || '').trim();
    const subjectName = String(row.subject || '').trim();
    const topicName = String(row.topic || '').trim();
    const lessonTitle = String(row.lesson || '').trim();
    const paperTitle = String(row.paper || '').trim();
    const category = this.normalizeImportCategory(String(row.category || '').trim());
    const questionType = this.normalizeImportQuestionType(String(row.question_type || '').trim());
    const questionText = String(row.question_text || '').trim();
    const explanation = String(row.explanation || '').trim();
    const topicLabel = String(row.topic_label || '').trim();
    const status = this.normalizeImportStatus(String(row.status || '').trim());

    if (!courseName) {
      throw new Error('Course is required');
    }
    if (!subjectName) {
      throw new Error('Subject is required');
    }
    if (!questionText) {
      throw new Error('Question text is required');
    }

    const course = lookups.courses.find((item) => this.normalizeLookup(item.name) === this.normalizeLookup(courseName));
    if (!course) {
      throw new Error(`Course "${courseName}" was not found`);
    }

    const subject = lookups.subjects.find((item) =>
      item.courseId === course.id &&
      this.normalizeLookup(item.name) === this.normalizeLookup(subjectName)
    );
    if (!subject) {
      throw new Error(`Subject "${subjectName}" was not found under course "${courseName}"`);
    }

    const topic = topicName
      ? lookups.topics.find((item) =>
          item.courseId === course.id &&
          item.subjectId === subject.id &&
          this.normalizeLookup(item.name) === this.normalizeLookup(topicName)
        )
      : null;
    if (topicName && !topic) {
      throw new Error(`Topic "${topicName}" was not found under subject "${subjectName}"`);
    }

    const lesson = lessonTitle
      ? lookups.lessons.find((item) =>
          item.courseId === course.id &&
          item.subjectId === subject.id &&
          String(item.topicId || '') === String(topic?.id || '') &&
          this.normalizeLookup(item.name) === this.normalizeLookup(lessonTitle)
        )
      : null;
    if (lessonTitle && !lesson) {
      throw new Error(`Lesson "${lessonTitle}" was not found for the selected hierarchy`);
    }

    const paper = paperTitle
      ? lookups.papers.find((item) => this.normalizeLookup(item.name) === this.normalizeLookup(paperTitle))
      : null;
    if (paperTitle && !paper) {
      throw new Error(`Paper "${paperTitle}" was not found`);
    }

    const options = OPTION_LABELS.map((label) => ({
      optionLabel: label,
      optionText: String(row[`option_${label.toLowerCase()}_text`] || '').trim(),
      isCorrect: this.parseImportBoolean(row[`option_${label.toLowerCase()}_correct`]),
      whyIncorrect: String(row[`option_${label.toLowerCase()}_why_incorrect`] || '').trim(),
    }));

    return {
      courseId: course.id,
      subjectId: subject.id,
      topicId: topic?.id ?? null,
      lessonId: lesson?.id ?? null,
      paperId: paper?.id ?? null,
      topicLabel,
      category,
      questionType,
      questionText,
      explanation,
      status,
      options,
    };
  }

  private normalizeImportCategory(value: string): 'mock' | 'past_paper' | 'ai' {
    const normalized = this.normalizeLookup(value);
    if (normalized === 'ai') return 'ai';
    if (normalized === 'mock') return 'mock';
    if (normalized === 'past_paper' || normalized === 'past paper' || normalized === 'past') return 'past_paper';
    throw new Error(`Category "${value || '(blank)'}" is invalid. Use ai, mock or past_paper`);
  }

  private normalizeImportQuestionType(value: string): 'sba' | 'true_false' {
    const normalized = this.normalizeLookup(value);
    if (normalized === 'sba') return 'sba';
    if (normalized === 'true_false' || normalized === 'true false' || normalized === 'tf') return 'true_false';
    throw new Error(`Question type "${value || '(blank)'}" is invalid. Use sba or true_false`);
  }

  private normalizeImportStatus(value: string): 'active' | 'inactive' {
    const normalized = this.normalizeLookup(value || 'active');
    if (normalized === 'active') return 'active';
    if (normalized === 'inactive') return 'inactive';
    throw new Error(`Status "${value}" is invalid. Use active or inactive`);
  }

  private parseImportBoolean(value: unknown): 0 | 1 {
    const normalized = this.normalizeLookup(String(value ?? '0'));
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return 1;
    return 0;
  }

  private normalizeLookup(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  // Explanation images are stored inline (http(s) URL or a base64 data: URI the
  // admin uploader produces). Validate + normalize; the client already compresses
  // to WebP, so this is a safety net, not the optimizer.
  private cleanExplanationImage(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (raw.length > 1_500_000) {
      throw new BadRequestException('Explanation image is too large. Use a compressed image under 1 MB.');
    }
    if (/^https?:\/\/\S+$/i.test(raw)) return raw;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw.replace(/\s+/g, '');
    throw new BadRequestException('Explanation image must be an http(s) image URL or a PNG/JPG/WebP/GIF image.');
  }

  private serializeApproachHighlights(value: string[] | undefined | null): string | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const cleaned = value.map((v) => String(v || '').trim()).filter(Boolean);
    return cleaned.length ? JSON.stringify(cleaned) : null;
  }

  private parseApproachHighlights(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private mapQuestionSummary(row: QuestionRow) {
    const normalizedCategory =
      row.question_category === 'ai' || row.category === 'ai'
        ? 'ai'
        : row.question_category === 'past_paper' || row.category === 'past'
          ? 'past_paper'
          : 'mock';

    return {
      id: row.id,
      courseId: row.course_id,
      subjectId: row.topic_id,
      topicId: row.subtopic_id,
      lessonId: row.lesson_id,
      paperId: row.paper_id,
      topicLabel: row.subtopic || '',
      category: normalizedCategory,
      questionType: row.question_type,
      questionText: row.question_text,
      explanation: row.explanation || '',
      explanationImageUrl: row.explanation_image_url || '',
      questionApproach: row.question_approach || '',
      questionApproachHighlights: this.parseApproachHighlights(row.question_approach_highlights),
      status: row.status,
      createdAt: row.created_at || null,
      updatedAt: (row as { updated_at?: string | Date | null }).updated_at || null,
      courseTitle: row.course_title || '',
      subjectName: row.subject_name || '',
      topicName: row.topic_name || '',
      lessonTitle: row.lesson_title || '',
      paperTitle: row.paper_title || '',
      quizCount: Number(row.quiz_count || 0),
      contentVersion: row.content_version ? Number(row.content_version) : null,
    };
  }
}
