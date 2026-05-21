import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { BulkUpdateQuestionKeywordsDto } from './dto/bulk-update-question-keywords.dto';
import { CreateQuestionDto, QuestionOptionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

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
  keywords_text: string | null;
  explanation: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  course_title?: string | null;
  subject_name?: string | null;
  topic_name?: string | null;
  lesson_title?: string | null;
  paper_title?: string | null;
  quiz_count?: number;
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
  courseId?: number;
  subjectId?: number;
  topicId?: number;
  lessonId?: number;
  paperId?: number;
  unclassified?: boolean;
};

type ExportQuestionRow = QuestionRow & {
  course_title: string | null;
  subject_name: string | null;
  topic_name: string | null;
  lesson_title: string | null;
  paper_title: string | null;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

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
  'keywords',
  'explanation',
  'status',
];

@Injectable()
export class QuestionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(filters: QuestionFilters) {
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
        q.keywords_text,
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
      sql += ' AND (q.question_text LIKE ? OR q.keywords_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)';
      const like = `%${filters.search.trim()}%`;
      params.push(like, like, like, like, like);
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

    sql += ' ORDER BY q.id DESC';

    const [rows] = await this.db.execute<QuestionRow[]>(sql, params);
    return rows.map((row) => this.mapQuestionSummary(row));
  }

  async meta() {
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
    const keywordSuggestions = await this.getKeywordSuggestions();

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
      keywordSuggestions,
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
          q.keywords_text,
          q.explanation,
          q.status,
          q.created_at,
          c.course_title,
          s.topic_name AS subject_name,
          st.subtopic_name AS topic_name,
          l.lesson_title,
          p.paper_title
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

    const [optionRows] = await this.db.execute<OptionRow[]>(
      `
        SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
        FROM question_options
        WHERE question_id = ?
        ORDER BY option_label ASC, id ASC
      `,
      [id]
    );

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

  async exportWorkbook(filters: QuestionFilters) {
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
        keywords: String(question.keywords_text || ''),
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

    return Buffer.from(rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n'), 'utf8');
  }

  async importWorkbook(file: any) {
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
    const payloads: Array<{ rowNumber: number; payload: CreateQuestionDto }> = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const isBlank = IMPORT_COLUMNS.every((column) => String(row[column] ?? '').trim() === '');
      if (isBlank) {
        return;
      }

      try {
        payloads.push({
          rowNumber,
          payload: this.mapImportRowToPayload(row, lookups),
        });
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Invalid row'}`);
      }
    });

    if (payloads.length === 0) {
      throw new BadRequestException(errors[0] || 'No valid question rows found');
    }

    const importedIds: number[] = [];

    for (const item of payloads) {
      try {
        const result = await this.create(item.payload);
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

    row.push(cell);
    parsedRows.push(row);

    const headers = parsedRows.shift()?.map((header) => header.trim()) || [];
    return parsedRows
      .filter((values) => values.some((value) => value.trim() !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  private escapeCsvCell(value: unknown) {
    const cell = String(value ?? '');
    if (/[",\r\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  async create(createQuestionDto: CreateQuestionDto) {
    this.validateQuestionPayload(createQuestionDto);
    await this.ensureHierarchyExists(createQuestionDto);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO questions (
            course_id, topic_id, subtopic_id, lesson_id, paper_id, subtopic, category, question_category, question_type,
            question_text, keywords_text, explanation, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createQuestionDto.courseId,
          createQuestionDto.subjectId,
          createQuestionDto.topicId ?? null,
          createQuestionDto.lessonId ?? null,
          createQuestionDto.paperId ?? null,
          (createQuestionDto.topicLabel || '').trim(),
          this.normalizeLegacyCategory(createQuestionDto.category),
          this.normalizeCategory(createQuestionDto.category),
          createQuestionDto.questionType,
          createQuestionDto.questionText.trim(),
          this.normalizeKeywords(createQuestionDto.keywordsText),
          (createQuestionDto.explanation || '').trim(),
          createQuestionDto.status,
        ]
      );

      await this.replaceOptions(connection, result.insertId, createQuestionDto.options, createQuestionDto.questionType);
      await this.syncQuestionKeywords(connection, result.insertId, createQuestionDto.keywordsText);
      await this.recordContentVersion(connection, 'question', result.insertId, this.buildQuestionSnapshot(createQuestionDto));
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: result.insertId,
        action: 'created',
        summary: `Question ${result.insertId} created`,
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

  async update(id: number, updateQuestionDto: UpdateQuestionDto) {
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
      keywordsText: updateQuestionDto.keywordsText ?? existing.keywordsText ?? '',
      explanation: updateQuestionDto.explanation ?? existing.explanation ?? '',
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
    await this.ensureHierarchyExists(merged);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

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
            keywords_text = ?,
            explanation = ?,
            status = ?
          WHERE id = ?
        `,
        [
          merged.courseId,
          merged.subjectId,
          merged.topicId ?? null,
          merged.lessonId ?? null,
          merged.paperId ?? null,
          (merged.topicLabel || '').trim(),
          this.normalizeLegacyCategory(merged.category),
          this.normalizeCategory(merged.category),
          merged.questionType,
          merged.questionText.trim(),
          this.normalizeKeywords(merged.keywordsText),
          (merged.explanation || '').trim(),
          merged.status,
          id,
        ]
      );

      await this.replaceOptions(connection, id, merged.options, merged.questionType);
      await this.syncQuestionKeywords(connection, id, merged.keywordsText);
      await this.recordContentVersion(connection, 'question', id, this.buildQuestionSnapshot(merged));
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: id,
        action: 'updated',
        summary: `Question ${id} updated`,
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

  async remove(id: number) {
    const existing = await this.findOne(id);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM questions WHERE id = ?', [id]);
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: id,
        action: 'deleted',
        summary: `Question ${id} deleted`,
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

  async bulkDelete(bulkDeleteQuestionsDto: BulkDeleteQuestionsDto) {
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

    const placeholders = questionIds.map(() => '?').join(',');
    const [questionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM questions WHERE id IN (${placeholders})`,
      questionIds
    );

    if (questionRows.length !== questionIds.length) {
      throw new NotFoundException('One or more questions could not be found');
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
      await connection.execute(`DELETE FROM question_quizzes WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM question_theory_recaps WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM question_keyword_map WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM question_options WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM question_reports WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM practice_answers WHERE question_id IN (${placeholders})`, questionIds);
      await connection.execute(`DELETE FROM student_answers WHERE question_id IN (${placeholders})`, questionIds);
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM questions WHERE id IN (${placeholders})`,
        questionIds
      );
      await this.recordContentAudit(connection, {
        entityType: 'question',
        entityId: 0,
        action: 'bulk_deleted',
        summary: `${result.affectedRows} question(s) deleted`,
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

  async bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto: BulkUpdateQuestionKeywordsDto) {
    const questionIds = Array.from(
      new Set(
        (bulkUpdateQuestionKeywordsDto.questionIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    if (questionIds.length === 0) {
      throw new BadRequestException('Please select at least one question');
    }

    const nextKeywords = this.normalizeKeywordArray(bulkUpdateQuestionKeywordsDto.keywordsText);
    if (nextKeywords.length === 0) {
      throw new BadRequestException('Please enter at least one keyword');
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const [questionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, keywords_text FROM questions WHERE id IN (${placeholders})`,
      questionIds
    );

    if (questionRows.length !== questionIds.length) {
      throw new NotFoundException('One or more questions could not be found');
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      for (const row of questionRows) {
        const currentKeywords = this.normalizeKeywordArray(String(row.keywords_text || ''));
        const mergedKeywords =
          bulkUpdateQuestionKeywordsDto.mode === 'replace'
            ? nextKeywords
            : Array.from(new Set([...currentKeywords, ...nextKeywords]));
        const keywordsText = mergedKeywords.join(', ');

        await connection.execute(
          'UPDATE questions SET keywords_text = ? WHERE id = ?',
          [keywordsText, Number(row.id)]
        );
        await this.syncQuestionKeywords(connection, Number(row.id), keywordsText);
        await this.recordContentAudit(connection, {
          entityType: 'question',
          entityId: Number(row.id),
          action: 'keywords_updated',
          summary: `Question ${row.id} keywords updated`,
          before: { keywordsText: String(row.keywords_text || '') },
          after: { keywordsText },
        });
      }

      await connection.commit();
      return {
        ok: true,
        updatedCount: questionIds.length,
        keywords: nextKeywords,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async ensureHierarchyExists(question: CreateQuestionDto) {
    await this.ensureExists('courses', question.courseId, 'Selected course was not found');
    await this.ensureExists('topics', question.subjectId, 'Selected subject was not found');

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
      keywordsText: this.normalizeKeywords(question.keywordsText),
      explanation: question.explanation || '',
      status: question.status,
      options: (question.options || []).map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: option.whyIncorrect || option.why_incorrect || '',
      })),
    };
  }

  private async recordContentVersion(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    snapshot: unknown
  ) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM content_versions WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    const versionNumber = Number(rows[0]?.next_version || 1);
    await connection.execute(
      'INSERT INTO content_versions (entity_type, entity_id, version_number, snapshot_json) VALUES (?, ?, ?, ?)',
      [entityType, entityId, versionNumber, JSON.stringify(snapshot)]
    );
  }

  private async recordContentAudit(
    connection: PoolConnection,
    event: {
      entityType: string;
      entityId: number;
      action: string;
      summary: string;
      before?: unknown;
      after?: unknown;
    }
  ) {
    await connection.execute(
      `INSERT INTO content_audit_events
        (entity_type, entity_id, action, summary, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event.entityType,
        event.entityId,
        event.action,
        event.summary,
        event.before === undefined ? null : JSON.stringify(event.before),
        event.after === undefined ? null : JSON.stringify(event.after),
      ]
    );
  }

  private async ensureExists(tableName: string, id: number, message: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM ${tableName} WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) {
      throw new BadRequestException(message);
    }
  }

  private validateQuestionPayload(question: CreateQuestionDto) {
    if (!question.courseId || question.courseId <= 0) {
      throw new BadRequestException('Please select a course');
    }

    if (!question.subjectId || question.subjectId <= 0) {
      throw new BadRequestException('Please select a subject');
    }

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

  private async replaceOptions(connection: PoolConnection, questionId: number, options: QuestionOptionDto[], questionType: string) {
    await connection.execute('DELETE FROM question_options WHERE question_id = ?', [questionId]);

    const cleaned = options
      .map((option) => ({
        optionLabel: option.optionLabel.trim().toUpperCase(),
        optionText: option.optionText.trim(),
        isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
        whyIncorrect: this.normalizeWhyIncorrect(option),
      }))
      .filter((option) => option.optionText !== '');

    for (const option of cleaned) {
      await connection.execute(
        `
          INSERT INTO question_options (question_id, option_label, option_text, is_correct, why_incorrect)
          VALUES (?, ?, ?, ?, ?)
        `,
        [questionId, option.optionLabel, option.optionText, option.isCorrect, questionType === 'sba' && option.isCorrect === 1 ? null : option.whyIncorrect || null]
      );
    }
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
        q.keywords_text,
        q.explanation,
        q.status,
        q.created_at,
        c.course_title,
        s.topic_name AS subject_name,
        st.subtopic_name AS topic_name,
        l.lesson_title,
        p.paper_title
      FROM questions q
      LEFT JOIN courses c ON c.id = q.course_id
      LEFT JOIN topics s ON s.id = q.topic_id
      LEFT JOIN subtopics st ON st.id = q.subtopic_id
      LEFT JOIN lessons l ON l.id = q.lesson_id
      LEFT JOIN papers p ON p.id = q.paper_id
      WHERE 1 = 1
    `;
    const params: Array<string | number> = [];

    if (filters.search?.trim()) {
      sql += ' AND (q.question_text LIKE ? OR q.keywords_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)';
      const like = `%${filters.search.trim()}%`;
      params.push(like, like, like, like, like);
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

    sql += ' ORDER BY q.id DESC';

    const [rows] = await this.db.execute<ExportQuestionRow[]>(sql, params);
    return rows;
  }

  private async loadOptionsForQuestionIds(questionIds: number[]) {
    const map = new Map<number, OptionRow[]>();
    if (questionIds.length === 0) {
      return map;
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const [rows] = await this.db.execute<OptionRow[]>(
      `SELECT id, question_id, option_label, option_text, is_correct, why_incorrect FROM question_options WHERE question_id IN (${placeholders}) ORDER BY question_id, option_label`,
      questionIds
    );

    rows.forEach((row) => {
      const questionId = Number(row.question_id);
      if (!map.has(questionId)) {
        map.set(questionId, []);
      }
      map.get(questionId)?.push(row);
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
    const keywordsText = String(row.keywords || '').trim();
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
      keywordsText,
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

  private normalizeKeywords(raw?: string) {
    return this.normalizeKeywordArray(raw).join(', ');
  }

  private normalizeKeywordArray(raw?: string) {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  private async getKeywordSuggestions() {
    const [keywordRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT keyword_name FROM question_keywords ORDER BY keyword_name ASC'
    );

    return keywordRows.map((row) => String(row.keyword_name)).filter(Boolean);
  }

  private async syncQuestionKeywords(connection: PoolConnection, questionId: number, rawKeywords?: string) {
    const keywords = this.normalizeKeywordArray(rawKeywords);
    await connection.execute('DELETE FROM question_keyword_map WHERE question_id = ?', [questionId]);

    for (const keyword of keywords) {
      await connection.execute(
        'INSERT IGNORE INTO question_keywords (keyword_name) VALUES (?)',
        [keyword]
      );

      const [keywordRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM question_keywords WHERE keyword_name = ? LIMIT 1',
        [keyword]
      );

      if (!keywordRows[0]) {
        continue;
      }

      await connection.execute(
        'INSERT IGNORE INTO question_keyword_map (question_id, keyword_id) VALUES (?, ?)',
        [questionId, Number(keywordRows[0].id)]
      );
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
      keywordsText: row.keywords_text || '',
      explanation: row.explanation || '',
      status: row.status,
      createdAt: row.created_at || null,
      courseTitle: row.course_title || '',
      subjectName: row.subject_name || '',
      topicName: row.topic_name || '',
      lessonTitle: row.lesson_title || '',
      paperTitle: row.paper_title || '',
      quizCount: Number(row.quiz_count || 0),
    };
  }
}
