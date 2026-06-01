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
exports.QuestionsService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];
const QUESTION_LOOKUP_TABLES = ['courses', 'topics', 'subtopics', 'lessons', 'papers'];
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
let QuestionsService = class QuestionsService {
    constructor(db) {
        this.db = db;
    }
    async findAll(filters) {
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
        COALESCE(qql.quiz_count, 0) AS quiz_count,
        (
          SELECT MAX(cv.version_number)
          FROM content_versions cv
          WHERE cv.entity_type = 'question' AND cv.entity_id = q.id
        ) AS content_version
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
        const params = [];
        const ids = Array.from(new Set(filters.ids || [])).filter((id) => Number.isInteger(id) && id > 0);
        const excludeIds = Array.from(new Set(filters.excludeIds || [])).filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length > 0) {
            sql += ` AND q.id IN (${(0, sql_safety_1.sqlPlaceholders)(ids)})`;
            params.push(...ids);
        }
        if (excludeIds.length > 0) {
            sql += ` AND q.id NOT IN (${(0, sql_safety_1.sqlPlaceholders)(excludeIds)})`;
            params.push(...excludeIds);
        }
        if (filters.search?.trim()) {
            sql += ' AND (q.question_text LIKE ? OR q.keywords_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)';
            const like = `%${filters.search.trim()}%`;
            params.push(like, like, like, like, like);
        }
        if (filters.keywords?.trim()) {
            sql += ' AND q.keywords_text LIKE ?';
            params.push(`%${filters.keywords.trim()}%`);
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
        if (filters.usage === 'unused') {
            sql += ' AND COALESCE(qql.quiz_count, 0) = 0';
        }
        if (filters.usage === 'used') {
            sql += ' AND COALESCE(qql.quiz_count, 0) > 0';
        }
        sql += filters.random ? ' ORDER BY RAND()' : ' ORDER BY q.id DESC';
        if (filters.limit && filters.limit > 0) {
            sql += ' LIMIT ?';
            params.push(Math.min(Math.trunc(filters.limit), 200));
        }
        const [rows] = await this.db.execute(sql, params);
        return rows.map((row) => this.mapQuestionSummary(row));
    }
    async meta() {
        const [courseRows] = await this.db.execute("SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC");
        const [subjectRows] = await this.db.execute("SELECT id, course_id, topic_name FROM topics WHERE status = 'active' ORDER BY topic_name ASC");
        const [topicRows] = await this.db.execute(`
        SELECT s.id, s.topic_id, t.course_id, s.subtopic_name
        FROM subtopics s
        INNER JOIN topics t ON t.id = s.topic_id
        WHERE s.status = 'active'
        ORDER BY s.subtopic_name ASC
      `);
        const [lessonRows] = await this.db.execute(`
        SELECT id, course_id, topic_id, subtopic_id, lesson_title
        FROM lessons
        WHERE status = 'active'
        ORDER BY lesson_title ASC
      `);
        const [paperRows] = await this.db.execute(`
        SELECT id, paper_title, year, exam_source, keywords_text
        FROM papers
        WHERE status = 'active'
        ORDER BY year DESC, paper_title ASC
      `);
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
    async findOne(id) {
        const [rows] = await this.db.execute(`
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
          (
            SELECT MAX(cv.version_number)
            FROM content_versions cv
            WHERE cv.entity_type = 'question' AND cv.entity_id = q.id
          ) AS content_version
        FROM questions q
        LEFT JOIN courses c ON c.id = q.course_id
        LEFT JOIN topics s ON s.id = q.topic_id
        LEFT JOIN subtopics st ON st.id = q.subtopic_id
        LEFT JOIN lessons l ON l.id = q.lesson_id
        LEFT JOIN papers p ON p.id = q.paper_id
        WHERE q.id = ?
        LIMIT 1
      `, [id]);
        const question = rows[0];
        if (!question) {
            throw new common_1.NotFoundException('Question not found');
        }
        const [optionRows] = await this.db.execute(`
        SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
        FROM question_options
        WHERE question_id = ?
        ORDER BY option_label ASC, id ASC
      `, [id]);
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
    async exportWorkbook(filters, actor) {
        const questions = await this.loadQuestionsForExport(filters);
        const ids = questions.map((question) => question.id);
        const optionsByQuestionId = await this.loadOptionsForQuestionIds(ids);
        const questionRows = questions.map((question) => {
            const optionMap = new Map((optionsByQuestionId.get(question.id) || []).map((option) => [option.option_label, option]));
            const row = {
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
        const rows = [IMPORT_COLUMNS, ...(questionRows.length > 0 ? questionRows : [this.buildEmptyExportRow()]).map((row) => (IMPORT_COLUMNS.map((column) => row[column] ?? '')))];
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
    async importWorkbook(file, actor) {
        if (!file?.buffer || !file.originalname) {
            throw new common_1.BadRequestException('Please upload a CSV file');
        }
        const rows = await this.readImportRows(file);
        if (rows.length === 0) {
            throw new common_1.BadRequestException('The uploaded sheet does not contain any question rows');
        }
        if (rows.length > 2000) {
            throw new common_1.BadRequestException('Question imports are limited to 2000 rows per file');
        }
        const lookups = await this.loadImportLookups();
        const payloads = [];
        const errors = [];
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
            }
            catch (error) {
                errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Invalid row'}`);
            }
        });
        if (payloads.length === 0) {
            throw new common_1.BadRequestException(errors[0] || 'No valid question rows found');
        }
        const duplicateRows = new Set();
        errors.push(...this.findInFileImportDuplicateErrors(payloads, duplicateRows));
        errors.push(...await this.findExistingImportDuplicateErrors(payloads, duplicateRows));
        const importedIds = [];
        for (const item of payloads.filter((payload) => !duplicateRows.has(payload.rowNumber))) {
            try {
                const result = await this.create(item.payload, actor);
                importedIds.push(Number(result.id));
            }
            catch (error) {
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
    async readImportRows(file) {
        const originalName = String(file.originalname || '').toLowerCase();
        if (!originalName.endsWith('.csv')) {
            throw new common_1.BadRequestException('Only CSV question imports are allowed');
        }
        return this.parseCsvRows(file.buffer.toString('utf8'));
    }
    parseCsvRows(csv) {
        const parsedRows = [];
        let cell = '';
        let row = [];
        let inQuotes = false;
        for (let index = 0; index < csv.length; index++) {
            const char = csv[index];
            const next = csv[index + 1];
            if (char === '"' && inQuotes && next === '"') {
                cell += '"';
                index++;
            }
            else if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
            }
            else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n')
                    index++;
                row.push(cell);
                parsedRows.push(row);
                row = [];
                cell = '';
            }
            else {
                cell += char;
            }
        }
        if (inQuotes) {
            throw new common_1.BadRequestException('CSV format is invalid: a quoted cell is not closed');
        }
        row.push(cell);
        parsedRows.push(row);
        const headers = parsedRows.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim()) || [];
        this.validateImportHeaders(headers);
        const extraCellRowIndex = parsedRows.findIndex((values) => values.length > headers.length);
        if (extraCellRowIndex >= 0) {
            throw new common_1.BadRequestException(`CSV row ${extraCellRowIndex + 2} has more cells than the header row`);
        }
        return parsedRows
            .filter((values) => values.some((value) => value.trim() !== ''))
            .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
    }
    validateImportHeaders(headers) {
        const cleanHeaders = headers.filter(Boolean);
        const seen = new Set();
        const duplicateHeaders = cleanHeaders.filter((header) => {
            if (seen.has(header))
                return true;
            seen.add(header);
            return false;
        });
        const headerSet = new Set(cleanHeaders);
        const missing = IMPORT_COLUMNS.filter((column) => !headerSet.has(column));
        const unsupported = cleanHeaders.filter((header) => !IMPORT_COLUMNS.includes(header));
        if (duplicateHeaders.length > 0) {
            throw new common_1.BadRequestException(`CSV headers are duplicated: ${Array.from(new Set(duplicateHeaders)).join(', ')}`);
        }
        if (missing.length > 0) {
            throw new common_1.BadRequestException(`CSV headers missing required columns: ${missing.join(', ')}`);
        }
        if (unsupported.length > 0) {
            throw new common_1.BadRequestException(`CSV contains unsupported columns: ${unsupported.join(', ')}`);
        }
    }
    validateImportRowSafety(row) {
        const mediaColumns = Object.entries(row)
            .filter(([, value]) => this.containsEmbeddedMediaPayload(value))
            .map(([column]) => column);
        if (mediaColumns.length > 0) {
            throw new Error(`Embedded media is not supported in CSV imports (${mediaColumns.join(', ')}). Upload media through approved LMS media tools and reference safe links only.`);
        }
    }
    containsEmbeddedMediaPayload(value) {
        const cell = String(value || '').trim().toLowerCase();
        if (!cell)
            return false;
        return (/data:(image|video|audio|application\/pdf)[/;]/.test(cell) ||
            /<\s*(img|video|audio|iframe|object|embed)\b/.test(cell) ||
            /!\[[^\]]*]\([^)]*\)/.test(cell) ||
            /\b(file|blob|javascript):/.test(cell));
    }
    buildImportFingerprint(question) {
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
    findInFileImportDuplicateErrors(payloads, duplicateRows) {
        const errors = [];
        const firstRowBySourceId = new Map();
        const firstRowByFingerprint = new Map();
        for (const item of payloads) {
            const sourceId = item.sourceQuestionId;
            if (sourceId) {
                const firstRow = firstRowBySourceId.get(sourceId);
                if (firstRow) {
                    duplicateRows.add(item.rowNumber);
                    errors.push(`Row ${item.rowNumber}: Duplicate question_id "${sourceId}" also appears on row ${firstRow}`);
                }
                else {
                    firstRowBySourceId.set(sourceId, item.rowNumber);
                }
            }
            const firstContentRow = firstRowByFingerprint.get(item.fingerprint);
            if (firstContentRow) {
                duplicateRows.add(item.rowNumber);
                errors.push(`Row ${item.rowNumber}: Duplicate question content matches row ${firstContentRow}`);
            }
            else {
                firstRowByFingerprint.set(item.fingerprint, item.rowNumber);
            }
        }
        return errors;
    }
    async findExistingImportDuplicateErrors(payloads, duplicateRows) {
        const candidates = payloads.filter((item) => !duplicateRows.has(item.rowNumber));
        const questionKeys = Array.from(new Set(candidates
            .map((item) => this.normalizeLookup(item.payload.questionText))
            .filter(Boolean)));
        if (questionKeys.length === 0) {
            return [];
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(questionKeys);
        const [rows] = await this.db.execute(`SELECT id, LOWER(TRIM(question_text)) AS question_key
       FROM questions
       WHERE LOWER(TRIM(question_text)) IN (${placeholders})`, questionKeys);
        const existingByKey = new Map();
        rows.forEach((row) => {
            const key = String(row.question_key || '').trim().toLowerCase();
            if (key && !existingByKey.has(key)) {
                existingByKey.set(key, Number(row.id));
            }
        });
        const errors = [];
        for (const item of candidates) {
            const existingId = existingByKey.get(this.normalizeLookup(item.payload.questionText));
            if (existingId) {
                duplicateRows.add(item.rowNumber);
                errors.push(`Row ${item.rowNumber}: Question text already exists as question #${existingId}`);
            }
        }
        return errors;
    }
    escapeCsvCell(value) {
        const cell = String(value ?? '');
        if (/[",\r\n]/.test(cell)) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    }
    async create(createQuestionDto, actor) {
        this.validateQuestionPayload(createQuestionDto);
        this.assertCanSaveStatus(actor, createQuestionDto.status);
        if (createQuestionDto.status === 'active') {
            this.validateQuestionPublishReady(createQuestionDto);
        }
        await this.ensureHierarchyExists(createQuestionDto);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(`
          INSERT INTO questions (
            course_id, topic_id, subtopic_id, lesson_id, paper_id, subtopic, category, question_category, question_type,
            question_text, keywords_text, explanation, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
            ]);
            await this.replaceOptions(connection, result.insertId, createQuestionDto.options, createQuestionDto.questionType);
            await this.syncQuestionKeywords(connection, result.insertId, createQuestionDto.keywordsText);
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async update(id, updateQuestionDto, actor) {
        const existing = await this.findOne(id);
        const merged = {
            courseId: updateQuestionDto.courseId ?? existing.courseId,
            subjectId: updateQuestionDto.subjectId ?? existing.subjectId,
            topicId: updateQuestionDto.topicId ?? existing.topicId ?? null,
            lessonId: updateQuestionDto.lessonId ?? existing.lessonId ?? null,
            paperId: updateQuestionDto.paperId ?? existing.paperId ?? null,
            topicLabel: updateQuestionDto.topicLabel ?? existing.topicLabel ?? '',
            category: (updateQuestionDto.category ?? existing.category),
            questionType: updateQuestionDto.questionType ?? existing.questionType,
            questionText: updateQuestionDto.questionText ?? existing.questionText,
            keywordsText: updateQuestionDto.keywordsText ?? existing.keywordsText ?? '',
            explanation: updateQuestionDto.explanation ?? existing.explanation ?? '',
            status: updateQuestionDto.status ?? existing.status,
            options: updateQuestionDto.options ??
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
            await connection.execute(`
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
        `, [
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
            ]);
            await this.replaceOptions(connection, id, merged.options, merged.questionType);
            await this.syncQuestionKeywords(connection, id, merged.keywordsText);
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async remove(id, actor) {
        const existing = await this.findOne(id);
        this.assertCanModifyExistingStatus(actor, existing.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM questions WHERE id = ?', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'question',
                entityId: id,
                action: 'deleted',
                summary: `Question ${id} deleted`,
                actorId: this.getActorId(actor),
                before: existing,
            });
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
        return { ok: true, id };
    }
    async bulkDelete(bulkDeleteQuestionsDto, actor) {
        const questionIds = Array.from(new Set((bulkDeleteQuestionsDto.questionIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)));
        if (questionIds.length === 0) {
            throw new common_1.BadRequestException('Please select at least one question');
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(questionIds);
        const [questionRows] = await this.db.execute(`SELECT id, status FROM questions WHERE id IN (${placeholders})`, questionIds);
        if (questionRows.length !== questionIds.length) {
            throw new common_1.NotFoundException('One or more questions could not be found');
        }
        if (!this.canReviewContent(actor) && questionRows.some((row) => String(row.status || '') === 'active')) {
            throw new common_1.ForbiddenException('Published questions require review permission before deletion');
        }
        const [linkRows] = await this.db.execute(`
        SELECT qq.question_id, COUNT(DISTINCT qq.quiz_id) AS quiz_count
        FROM question_quizzes qq
        WHERE qq.question_id IN (${placeholders})
        GROUP BY qq.question_id
      `, questionIds);
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
            const [result] = await connection.execute(`DELETE FROM questions WHERE id IN (${placeholders})`, questionIds);
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto, actor) {
        const questionIds = Array.from(new Set((bulkUpdateQuestionKeywordsDto.questionIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)));
        if (questionIds.length === 0) {
            throw new common_1.BadRequestException('Please select at least one question');
        }
        const nextKeywords = this.normalizeKeywordArray(bulkUpdateQuestionKeywordsDto.keywordsText);
        if (nextKeywords.length === 0) {
            throw new common_1.BadRequestException('Please enter at least one keyword');
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(questionIds);
        const [questionRows] = await this.db.execute(`SELECT id, keywords_text, status FROM questions WHERE id IN (${placeholders})`, questionIds);
        if (questionRows.length !== questionIds.length) {
            throw new common_1.NotFoundException('One or more questions could not be found');
        }
        if (!this.canReviewContent(actor) && questionRows.some((row) => String(row.status || '') === 'active')) {
            throw new common_1.ForbiddenException('Published questions require review permission before keyword changes');
        }
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            for (const row of questionRows) {
                const currentKeywords = this.normalizeKeywordArray(String(row.keywords_text || ''));
                const mergedKeywords = bulkUpdateQuestionKeywordsDto.mode === 'replace'
                    ? nextKeywords
                    : Array.from(new Set([...currentKeywords, ...nextKeywords]));
                const keywordsText = mergedKeywords.join(', ');
                await connection.execute('UPDATE questions SET keywords_text = ? WHERE id = ?', [keywordsText, Number(row.id)]);
                await this.syncQuestionKeywords(connection, Number(row.id), keywordsText);
                await this.recordContentAudit(connection, {
                    entityType: 'question',
                    entityId: Number(row.id),
                    action: 'keywords_updated',
                    summary: `Question ${row.id} keywords updated`,
                    actorId: this.getActorId(actor),
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async listVersions(id) {
        await this.findOne(id);
        const [rows] = await this.db.execute(`SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'question' AND entity_id = ?
       ORDER BY version_number DESC`, [id]);
        return rows.map((row) => ({
            id: Number(row.id),
            versionNumber: Number(row.version_number),
            createdBy: row.created_by === null || row.created_by === undefined ? null : Number(row.created_by),
            createdAt: row.created_at || null,
            snapshot: this.parseSnapshotJson(row.snapshot_json),
        }));
    }
    async markDraft(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'draft',
            status: 'inactive',
            action: 'marked_draft',
            summary: `Question ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Question ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Question ${id} published`,
            actor,
            requirePublishReady: true,
        });
    }
    async rollback(id, versionNumber, actor) {
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback published question content');
        }
        const existing = await this.findOne(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'question' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Content version not found');
        }
        const snapshot = this.parseQuestionSnapshot(versionRows[0].snapshot_json);
        this.validateQuestionPayload(snapshot);
        if (snapshot.status === 'active') {
            this.validateQuestionPublishReady(snapshot);
        }
        await this.ensureHierarchyExists(snapshot);
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeQuestionSnapshot(connection, id, snapshot);
            await this.replaceOptions(connection, id, snapshot.options, snapshot.questionType);
            await this.syncQuestionKeywords(connection, id, snapshot.keywordsText);
            await this.recordContentVersion(connection, 'question', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'question', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'question',
                entityId: id,
                action: 'rolled_back',
                summary: `Question ${id} rolled back to version ${versionNumber}`,
                actorId: this.getActorId(actor),
                before: existing,
                after: snapshot,
            });
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
        return {
            ok: true,
            id,
            rolledBackToVersion: versionNumber,
            status: snapshot.status,
            workflowState,
        };
    }
    async ensureHierarchyExists(question) {
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
    buildQuestionSnapshot(question) {
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
    buildQuestionSnapshotFromEntity(question, status) {
        return this.buildQuestionSnapshot({
            courseId: Number(question.courseId),
            subjectId: Number(question.subjectId),
            topicId: question.topicId === null || question.topicId === undefined ? null : Number(question.topicId),
            lessonId: question.lessonId === null || question.lessonId === undefined ? null : Number(question.lessonId),
            paperId: question.paperId === null || question.paperId === undefined ? null : Number(question.paperId),
            topicLabel: question.topicLabel || '',
            category: question.category,
            questionType: question.questionType,
            questionText: question.questionText,
            keywordsText: question.keywordsText || '',
            explanation: question.explanation || '',
            status,
            options: question.options.map((option) => ({
                optionLabel: option.optionLabel,
                optionText: option.optionText,
                isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
                whyIncorrect: option.whyIncorrect || '',
            })),
        });
    }
    async transitionWorkflow(id, input) {
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
        return {
            ok: true,
            id,
            status: input.status,
            workflowState: input.workflowState,
        };
    }
    async writeQuestionSnapshot(connection, id, question) {
        await connection.execute(`
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
      `, [
            question.courseId,
            question.subjectId,
            question.topicId ?? null,
            question.lessonId ?? null,
            question.paperId ?? null,
            (question.topicLabel || '').trim(),
            this.normalizeLegacyCategory(question.category),
            this.normalizeCategory(question.category),
            question.questionType,
            question.questionText.trim(),
            this.normalizeKeywords(question.keywordsText),
            (question.explanation || '').trim(),
            question.status,
            id,
        ]);
    }
    parseSnapshotJson(value) {
        if (value && typeof value === 'object') {
            return value;
        }
        const raw = String(value || '').trim();
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    parseQuestionSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
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
            keywordsText: String(snapshot.keywordsText || ''),
            explanation: String(snapshot.explanation || ''),
            status: snapshot.status === 'active' ? 'active' : 'inactive',
            options: Array.isArray(snapshot.options)
                ? snapshot.options.map((option) => ({
                    optionLabel: String(option?.optionLabel || option?.option_label || ''),
                    optionText: String(option?.optionText || option?.option_text || ''),
                    isCorrect: Number(option?.isCorrect ?? option?.is_correct) === 1 ? 1 : 0,
                    whyIncorrect: String(option?.whyIncorrect || option?.why_incorrect || ''),
                }))
                : [],
        };
    }
    async recordContentVersion(connection, entityType, entityId, snapshot, actorId) {
        const [rows] = await connection.execute('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM content_versions WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
        const versionNumber = Number(rows[0]?.next_version || 1);
        await connection.execute('INSERT INTO content_versions (entity_type, entity_id, version_number, snapshot_json, created_by) VALUES (?, ?, ?, ?, ?)', [entityType, entityId, versionNumber, JSON.stringify(snapshot), actorId || null]);
    }
    async setWorkflowState(connection, entityType, entityId, workflowState, actorId) {
        await connection.execute(`INSERT INTO content_workflow_states (entity_type, entity_id, workflow_state, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         workflow_state = VALUES(workflow_state),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`, [entityType, entityId, workflowState, actorId || null]);
    }
    async recordContentAudit(connection, event) {
        await connection.execute(`INSERT INTO content_audit_events
        (entity_type, entity_id, action, actor_id, summary, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            event.entityType,
            event.entityId,
            event.action,
            event.actorId || null,
            event.summary,
            event.before === undefined ? null : JSON.stringify(event.before),
            event.after === undefined ? null : JSON.stringify(event.after),
        ]);
    }
    async recordAdminAuditEvent(input) {
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
    serializeQuestionFilters(filters) {
        return {
            search: filters.search || '',
            status: filters.status || '',
            type: filters.type || '',
            category: filters.category || '',
            keywords: filters.keywords || '',
            usage: filters.usage || '',
            courseId: filters.courseId || null,
            subjectId: filters.subjectId || null,
            topicId: filters.topicId || null,
            lessonId: filters.lessonId || null,
            paperId: filters.paperId || null,
            unclassified: Boolean(filters.unclassified),
        };
    }
    getActorId(actor) {
        if (typeof actor === 'number')
            return actor;
        return actor?.id;
    }
    canReviewContent(actor) {
        if (!actor || typeof actor === 'number')
            return true;
        return actor.role === 'admin' || Boolean(actor.permissions?.includes('content.review'));
    }
    assertCanSaveStatus(actor, status) {
        if (status === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to publish question content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published questions require review permission before modification');
        }
    }
    async ensureExists(tableName, id, message) {
        const table = (0, sql_safety_1.sqlIdentifier)(tableName, QUESTION_LOOKUP_TABLES, 'question lookup table');
        const [rows] = await this.db.execute(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]);
        if (rows.length === 0) {
            throw new common_1.BadRequestException(message);
        }
    }
    validateQuestionPayload(question) {
        if (!question.courseId || question.courseId <= 0) {
            throw new common_1.BadRequestException('Please select a course');
        }
        if (!question.subjectId || question.subjectId <= 0) {
            throw new common_1.BadRequestException('Please select a subject');
        }
        if (!question.questionText.trim()) {
            throw new common_1.BadRequestException('Question text is required');
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
                throw new common_1.BadRequestException('SBA questions must contain exactly 5 options');
            }
            const correctCount = options.filter((option) => option.isCorrect === 1).length;
            if (correctCount !== 1) {
                throw new common_1.BadRequestException('Please select exactly one correct SBA answer');
            }
        }
        if (question.questionType === 'true_false') {
            if (options.length !== 5) {
                throw new common_1.BadRequestException('True / False questions must contain exactly 5 statements');
            }
            const invalid = options.find((option) => option.isCorrect !== 0 && option.isCorrect !== 1);
            if (invalid) {
                throw new common_1.BadRequestException(`Please choose True or False for statement ${invalid.optionLabel}`);
            }
        }
    }
    validateQuestionPublishReady(question) {
        if (!String(question.explanation || '').trim()) {
            throw new common_1.BadRequestException('A reviewed explanation is required before publishing a question');
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
            throw new common_1.BadRequestException(`Every incorrect option needs a review explanation before publishing (${missingRationales.map((option) => option.optionLabel).join(', ')})`);
        }
    }
    async replaceOptions(connection, questionId, options, questionType) {
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
            await connection.execute(`
          INSERT INTO question_options (question_id, option_label, option_text, is_correct, why_incorrect)
          VALUES (?, ?, ?, ?, ?)
        `, [questionId, option.optionLabel, option.optionText, option.isCorrect, questionType === 'sba' && option.isCorrect === 1 ? null : option.whyIncorrect || null]);
        }
    }
    normalizeWhyIncorrect(option) {
        const raw = option.whyIncorrect ?? option.why_incorrect ?? '';
        return String(raw || '').trim();
    }
    normalizeCategory(category) {
        if (category === 'mock')
            return 'mock';
        if (category === 'ai')
            return 'ai';
        return 'past_paper';
    }
    normalizeLegacyCategory(category) {
        if (category === 'mock')
            return 'mock';
        if (category === 'ai')
            return 'ai';
        return 'past';
    }
    async loadQuestionsForExport(filters) {
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
        const params = [];
        if (filters.search?.trim()) {
            sql += ' AND (q.question_text LIKE ? OR q.keywords_text LIKE ? OR q.subtopic LIKE ? OR st.subtopic_name LIKE ? OR p.paper_title LIKE ?)';
            const like = `%${filters.search.trim()}%`;
            params.push(like, like, like, like, like);
        }
        if (filters.keywords?.trim()) {
            sql += ' AND q.keywords_text LIKE ?';
            params.push(`%${filters.keywords.trim()}%`);
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
        if (filters.usage === 'unused') {
            sql += ' AND COALESCE(qql.quiz_count, 0) = 0';
        }
        if (filters.usage === 'used') {
            sql += ' AND COALESCE(qql.quiz_count, 0) > 0';
        }
        sql += ' ORDER BY q.id DESC';
        const [rows] = await this.db.execute(sql, params);
        return rows;
    }
    async loadOptionsForQuestionIds(questionIds) {
        const map = new Map();
        if (questionIds.length === 0) {
            return map;
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(questionIds);
        const [rows] = await this.db.execute(`SELECT id, question_id, option_label, option_text, is_correct, why_incorrect FROM question_options WHERE question_id IN (${placeholders}) ORDER BY question_id, option_label`, questionIds);
        rows.forEach((row) => {
            const questionId = Number(row.question_id);
            if (!map.has(questionId)) {
                map.set(questionId, []);
            }
            map.get(questionId)?.push(row);
        });
        return map;
    }
    buildEmptyExportRow() {
        return Object.fromEntries(IMPORT_COLUMNS.map((column) => [column, '']));
    }
    async loadImportLookups() {
        const [courseRows] = await this.db.execute("SELECT id, course_title FROM courses WHERE status = 'active'");
        const [subjectRows] = await this.db.execute("SELECT id, course_id, topic_name FROM topics WHERE status = 'active'");
        const [topicRows] = await this.db.execute(`
        SELECT s.id, s.topic_id, t.course_id, s.subtopic_name
        FROM subtopics s
        INNER JOIN topics t ON t.id = s.topic_id
        WHERE s.status = 'active'
      `);
        const [lessonRows] = await this.db.execute(`
        SELECT id, course_id, topic_id, subtopic_id, lesson_title
        FROM lessons
        WHERE status = 'active'
      `);
        const [paperRows] = await this.db.execute("SELECT id, paper_title FROM papers WHERE status = 'active'");
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
    mapImportRowToPayload(row, lookups) {
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
        const subject = lookups.subjects.find((item) => item.courseId === course.id &&
            this.normalizeLookup(item.name) === this.normalizeLookup(subjectName));
        if (!subject) {
            throw new Error(`Subject "${subjectName}" was not found under course "${courseName}"`);
        }
        const topic = topicName
            ? lookups.topics.find((item) => item.courseId === course.id &&
                item.subjectId === subject.id &&
                this.normalizeLookup(item.name) === this.normalizeLookup(topicName))
            : null;
        if (topicName && !topic) {
            throw new Error(`Topic "${topicName}" was not found under subject "${subjectName}"`);
        }
        const lesson = lessonTitle
            ? lookups.lessons.find((item) => item.courseId === course.id &&
                item.subjectId === subject.id &&
                String(item.topicId || '') === String(topic?.id || '') &&
                this.normalizeLookup(item.name) === this.normalizeLookup(lessonTitle))
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
    normalizeImportCategory(value) {
        const normalized = this.normalizeLookup(value);
        if (normalized === 'ai')
            return 'ai';
        if (normalized === 'mock')
            return 'mock';
        if (normalized === 'past_paper' || normalized === 'past paper' || normalized === 'past')
            return 'past_paper';
        throw new Error(`Category "${value || '(blank)'}" is invalid. Use ai, mock or past_paper`);
    }
    normalizeImportQuestionType(value) {
        const normalized = this.normalizeLookup(value);
        if (normalized === 'sba')
            return 'sba';
        if (normalized === 'true_false' || normalized === 'true false' || normalized === 'tf')
            return 'true_false';
        throw new Error(`Question type "${value || '(blank)'}" is invalid. Use sba or true_false`);
    }
    normalizeImportStatus(value) {
        const normalized = this.normalizeLookup(value || 'active');
        if (normalized === 'active')
            return 'active';
        if (normalized === 'inactive')
            return 'inactive';
        throw new Error(`Status "${value}" is invalid. Use active or inactive`);
    }
    parseImportBoolean(value) {
        const normalized = this.normalizeLookup(String(value ?? '0'));
        if (normalized === '1' || normalized === 'true' || normalized === 'yes')
            return 1;
        return 0;
    }
    normalizeLookup(value) {
        return String(value || '').trim().toLowerCase();
    }
    normalizeKeywords(raw) {
        return this.normalizeKeywordArray(raw).join(', ');
    }
    normalizeKeywordArray(raw) {
        return Array.from(new Set(String(raw || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)));
    }
    async getKeywordSuggestions() {
        const [keywordRows] = await this.db.execute('SELECT keyword_name FROM question_keywords ORDER BY keyword_name ASC');
        return keywordRows.map((row) => String(row.keyword_name)).filter(Boolean);
    }
    async syncQuestionKeywords(connection, questionId, rawKeywords) {
        const keywords = this.normalizeKeywordArray(rawKeywords);
        await connection.execute('DELETE FROM question_keyword_map WHERE question_id = ?', [questionId]);
        for (const keyword of keywords) {
            await connection.execute('INSERT IGNORE INTO question_keywords (keyword_name) VALUES (?)', [keyword]);
            const [keywordRows] = await connection.execute('SELECT id FROM question_keywords WHERE keyword_name = ? LIMIT 1', [keyword]);
            if (!keywordRows[0]) {
                continue;
            }
            await connection.execute('INSERT IGNORE INTO question_keyword_map (question_id, keyword_id) VALUES (?, ?)', [questionId, Number(keywordRows[0].id)]);
        }
    }
    mapQuestionSummary(row) {
        const normalizedCategory = row.question_category === 'ai' || row.category === 'ai'
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
            contentVersion: row.content_version ? Number(row.content_version) : null,
        };
    }
};
exports.QuestionsService = QuestionsService;
exports.QuestionsService = QuestionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], QuestionsService);
//# sourceMappingURL=questions.service.js.map