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
exports.QuizzesService = void 0;
const common_1 = require("@nestjs/common");
const pagination_1 = require("../../common/utils/pagination");
const sql_safety_1 = require("../../database/sql-safety");
const auth_service_1 = require("../auth/auth.service");
const database_tokens_1 = require("../../database/database.tokens");
const DEFAULT_PASSING_MARKS = 45;
let QuizzesService = class QuizzesService {
    constructor(db, authService) {
        this.db = db;
        this.authService = authService;
    }
    resolvePassingMarks(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0)
            return DEFAULT_PASSING_MARKS;
        return numeric;
    }
    parseJsonArray(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
        }
        catch {
            return [];
        }
    }
    async findAll(filters) {
        const { limit, offset } = (0, pagination_1.normalizePagination)(filters, { defaultLimit: 50, maxLimit: 100 });
        let sql = `
      SELECT
        quizzes.id,
        quizzes.course_id,
        quizzes.topic_id,
        quizzes.subtopic_id,
        quizzes.lesson_id,
        quizzes.paper_id,
        quizzes.category,
        quizzes.collection_tags,
        quizzes.is_free,
        quizzes.subtopic,
        quizzes.is_general,
        quizzes.exam_mode_only,
        quizzes.admin_name,
        quizzes.student_title,
        quizzes.display_title_mode,
        quizzes.quiz_number,
        quizzes.quiz_title,
        quizzes.quiz_description,
        NULL AS blueprint_json,
        quizzes.randomization_mode,
        quizzes.total_questions,
        quizzes.total_marks,
        quizzes.time_limit,
        quizzes.hide_time_limit,
        quizzes.passing_marks,
        quizzes.hide_passing_marks,
        quizzes.status,
        quizzes.created_at,
        courses.course_title,
        topics.topic_name AS subject_name,
        subtopics.subtopic_name AS topic_name,
        lessons.lesson_title,
        papers.paper_title
      FROM quizzes
      INNER JOIN courses ON quizzes.course_id = courses.id
      LEFT JOIN topics ON quizzes.topic_id = topics.id
      LEFT JOIN subtopics ON quizzes.subtopic_id = subtopics.id
      LEFT JOIN lessons ON quizzes.lesson_id = lessons.id
      LEFT JOIN papers ON quizzes.paper_id = papers.id
      WHERE 1 = 1
    `;
        const params = [];
        if (filters.search?.trim()) {
            sql += ' AND (COALESCE(NULLIF(quizzes.admin_name, \'\'), quizzes.quiz_title) LIKE ? OR COALESCE(NULLIF(quizzes.student_title, \'\'), quizzes.quiz_title) LIKE ? OR quizzes.quiz_title LIKE ?)';
            const like = `%${filters.search.trim()}%`;
            params.push(like, like, like);
        }
        if (filters.courseId && filters.courseId > 0) {
            sql += ' AND quizzes.course_id = ?';
            params.push(filters.courseId);
        }
        if (filters.topicId) {
            if (filters.topicId === 'general') {
                sql += ' AND quizzes.is_general = 1';
            }
            else {
                sql += ' AND quizzes.topic_id = ? AND quizzes.is_general = 0';
                params.push(Number(filters.topicId));
            }
        }
        if (filters.status === 'active' || filters.status === 'inactive') {
            sql += ' AND quizzes.status = ?';
            params.push(filters.status);
        }
        sql += ' ORDER BY quizzes.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await this.db.execute(sql, params);
        return rows.map((row) => this.mapQuiz(row));
    }
    async meta(options) {
        const [courseRows] = await this.db.execute("SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC");
        const [topicRows] = await this.db.execute("SELECT id, course_id, topic_name FROM topics WHERE status = 'active' ORDER BY topic_name ASC");
        const [subtopicRows] = await this.db.execute(`
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
        const [categoryRows] = await this.db.execute(`
        SELECT DISTINCT COALESCE(NULLIF(question_category, ''), category) AS category
        FROM questions
        WHERE status = 'active'
        ORDER BY category ASC
      `);
        const [questionTypeRows] = await this.db.execute(`
        SELECT DISTINCT question_type
        FROM questions
        WHERE status = 'active'
        ORDER BY question_type ASC
      `);
        const includeQuestions = options?.includeQuestions === true;
        const usageRows = includeQuestions
            ? (await this.db.execute(`
            SELECT question_id, COUNT(DISTINCT quiz_id) AS usage_count
            FROM question_quizzes
            GROUP BY question_id
          `))[0]
            : [];
        const usageByQuestionId = new Map(usageRows.map((row) => [Number(row.question_id), Number(row.usage_count || 0)]));
        const questionRows = includeQuestions
            ? (await this.db.execute(`
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
              q.keywords_text,
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
          `))[0]
            : [];
        const keywordSuggestions = await this.getKeywordSuggestions(questionRows);
        const categories = Array.from(new Set((categoryRows.length ? categoryRows : questionRows)
            .map((row) => String(row.category || '').trim())
            .filter(Boolean))).sort((left, right) => left.localeCompare(right));
        const questionTypes = Array.from(new Set((questionTypeRows.length ? questionTypeRows : questionRows)
            .map((row) => String(row.question_type || '').trim())
            .filter(Boolean))).sort((left, right) => left.localeCompare(right));
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
            keywordSuggestions,
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
                    keywordsText: String(row.keywords_text || ''),
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
    async findOne(id) {
        const [rows] = await this.db.execute(`
        SELECT
          quizzes.id,
          quizzes.course_id,
          quizzes.topic_id,
          quizzes.subtopic_id,
          quizzes.lesson_id,
          quizzes.paper_id,
          quizzes.category,
          quizzes.collection_tags,
          quizzes.is_free,
          quizzes.subtopic,
          quizzes.is_general,
          quizzes.exam_mode_only,
          quizzes.admin_name,
          quizzes.student_title,
          quizzes.display_title_mode,
          quizzes.quiz_number,
          quizzes.quiz_title,
          quizzes.quiz_description,
          quizzes.blueprint_json,
          quizzes.randomization_mode,
          quizzes.total_questions,
          quizzes.total_marks,
          quizzes.time_limit,
          quizzes.hide_time_limit,
          quizzes.passing_marks,
          quizzes.hide_passing_marks,
          quizzes.status,
          quizzes.created_at,
          courses.course_title,
          topics.topic_name AS subject_name,
          subtopics.subtopic_name AS topic_name,
          lessons.lesson_title,
          papers.paper_title
        FROM quizzes
        INNER JOIN courses ON quizzes.course_id = courses.id
        LEFT JOIN topics ON quizzes.topic_id = topics.id
        LEFT JOIN subtopics ON quizzes.subtopic_id = subtopics.id
        LEFT JOIN lessons ON quizzes.lesson_id = lessons.id
        LEFT JOIN papers ON quizzes.paper_id = papers.id
        WHERE quizzes.id = ?
        LIMIT 1
      `, [id]);
        const quiz = rows[0];
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found');
        }
        const [questionRows] = await this.db.execute(`
        SELECT question_id
        FROM question_quizzes
        WHERE quiz_id = ?
        ORDER BY sort_order ASC, question_id ASC
      `, [id]);
        return {
            ...this.mapQuiz(quiz),
            questionIds: questionRows.map((row) => Number(row.question_id)),
        };
    }
    async create(createQuizDto, actor) {
        this.validateQuiz(createQuizDto);
        this.assertCanSaveStatus(actor, createQuizDto.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const questionIds = this.cleanQuestionIds(createQuizDto.questionIds);
            const linkedQuestionIds = this.resolveRandomizationMode(createQuizDto.randomizationMode) === 'dynamic' ? [] : questionIds;
            const totalQuestions = this.resolveQuizQuestionCount(createQuizDto, questionIds);
            const totalMarks = totalQuestions;
            const resolvedMode = this.resolveDisplayTitleMode(createQuizDto.displayTitleMode);
            const newQuizNumber = resolvedMode === 'number'
                ? await this.resolveNextQuizNumber(connection, createQuizDto)
                : null;
            const [result] = await connection.execute(`
          INSERT INTO quizzes (
            course_id, topic_id, subtopic_id, lesson_id, paper_id, category, collection_tags, is_free, subtopic, is_general, exam_mode_only, admin_name, student_title, display_title_mode, quiz_number, quiz_title,
            quiz_description, blueprint_json, randomization_mode, total_questions, total_marks, time_limit, hide_time_limit, passing_marks, hide_passing_marks, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                createQuizDto.courseId,
                createQuizDto.isGeneral === 1 ? null : createQuizDto.topicId ?? null,
                createQuizDto.isGeneral === 1 ? null : createQuizDto.subtopicId ?? null,
                createQuizDto.isGeneral === 1 ? null : createQuizDto.lessonId ?? null,
                createQuizDto.paperId ?? null,
                (createQuizDto.category || '').trim() || null,
                this.normalizeKeywords(createQuizDto.collectionTags),
                createQuizDto.isFree === 1 ? 1 : 0,
                (createQuizDto.subtopic || '').trim(),
                createQuizDto.isGeneral,
                createQuizDto.examModeOnly,
                this.resolveAdminName(createQuizDto),
                this.resolveStudentTitle(createQuizDto),
                resolvedMode,
                newQuizNumber,
                this.resolveStudentTitle(createQuizDto),
                (createQuizDto.quizDescription || '').trim(),
                this.stringifyBlueprint(createQuizDto.blueprint),
                this.resolveRandomizationMode(createQuizDto.randomizationMode),
                totalQuestions,
                totalMarks,
                createQuizDto.timeLimit,
                createQuizDto.hideTimeLimit,
                this.resolvePassingMarks(createQuizDto.passingMarks),
                createQuizDto.hidePassingMarks,
                createQuizDto.status,
            ]);
            await this.replaceQuestionLinks(connection, result.insertId, linkedQuestionIds);
            await this.appendKeywordsToQuestions(connection, linkedQuestionIds, createQuizDto.collectionTags);
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
    async update(id, updateQuizDto, actor) {
        const existing = await this.findOne(id);
        const merged = {
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
            adminName: updateQuizDto.adminName ?? existing.adminName,
            studentTitle: updateQuizDto.studentTitle ?? existing.studentTitle ?? existing.quizTitle,
            displayTitleMode: this.resolveDisplayTitleMode(updateQuizDto.displayTitleMode ?? existing.displayTitleMode),
            quizTitle: updateQuizDto.quizTitle ?? existing.studentTitle ?? existing.quizTitle,
            quizDescription: updateQuizDto.quizDescription ?? existing.quizDescription ?? '',
            blueprint: updateQuizDto.blueprint ?? existing.blueprint ?? null,
            randomizationMode: this.resolveRandomizationMode(updateQuizDto.randomizationMode ?? existing.randomizationMode),
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
            const questionIds = this.cleanQuestionIds(merged.questionIds);
            const linkedQuestionIds = this.resolveRandomizationMode(merged.randomizationMode) === 'dynamic' ? [] : questionIds;
            const totalQuestions = this.resolveQuizQuestionCount(merged, questionIds);
            const totalMarks = totalQuestions;
            const resolvedMode = this.resolveDisplayTitleMode(merged.displayTitleMode);
            let updatedQuizNumber;
            if (resolvedMode === 'number') {
                updatedQuizNumber = existing.quizNumber ?? await this.resolveNextQuizNumber(connection, merged, id);
            }
            else {
                updatedQuizNumber = null;
            }
            await connection.execute(`
          UPDATE quizzes SET
            course_id = ?,
            topic_id = ?,
            subtopic_id = ?,
            lesson_id = ?,
            paper_id = ?,
            category = ?,
            collection_tags = ?,
            is_free = ?,
            subtopic = ?,
            is_general = ?,
            exam_mode_only = ?,
            admin_name = ?,
            student_title = ?,
            display_title_mode = ?,
            quiz_number = ?,
            quiz_title = ?,
            quiz_description = ?,
            blueprint_json = ?,
            randomization_mode = ?,
            total_questions = ?,
            total_marks = ?,
            time_limit = ?,
            hide_time_limit = ?,
            passing_marks = ?,
            hide_passing_marks = ?,
            status = ?
          WHERE id = ?
        `, [
                merged.courseId,
                merged.isGeneral === 1 ? null : merged.topicId ?? null,
                merged.isGeneral === 1 ? null : merged.subtopicId ?? null,
                merged.isGeneral === 1 ? null : merged.lessonId ?? null,
                merged.paperId ?? null,
                (merged.category || '').trim() || null,
                this.normalizeKeywords(merged.collectionTags),
                merged.isFree === 1 ? 1 : 0,
                (merged.subtopic || '').trim(),
                merged.isGeneral,
                merged.examModeOnly,
                this.resolveAdminName(merged),
                this.resolveStudentTitle(merged),
                resolvedMode,
                updatedQuizNumber,
                this.resolveStudentTitle(merged),
                (merged.quizDescription || '').trim(),
                this.stringifyBlueprint(merged.blueprint),
                this.resolveRandomizationMode(merged.randomizationMode),
                totalQuestions,
                totalMarks,
                merged.timeLimit,
                merged.hideTimeLimit,
                this.resolvePassingMarks(merged.passingMarks),
                merged.hidePassingMarks,
                merged.status,
                id,
            ]);
            await this.replaceQuestionLinks(connection, id, linkedQuestionIds);
            await this.appendKeywordsToQuestions(connection, linkedQuestionIds, merged.collectionTags);
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
            await connection.execute('DELETE FROM question_quizzes WHERE quiz_id = ?', [id]);
            await connection.execute('DELETE FROM quizzes WHERE id = ?', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'quiz',
                entityId: id,
                action: 'deleted',
                summary: `Quiz ${id} deleted`,
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
    async listVersions(id) {
        await this.findOne(id);
        const [rows] = await this.db.execute(`SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'quiz' AND entity_id = ?
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
            summary: `Quiz ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Quiz ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Quiz ${id} published`,
            actor,
        });
    }
    async rollback(id, versionNumber, actor) {
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback quiz content');
        }
        const existing = await this.findOne(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'quiz' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Quiz version not found');
        }
        const snapshot = this.parseQuizSnapshot(versionRows[0].snapshot_json);
        this.validateQuiz(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        const questionIds = this.cleanQuestionIds(snapshot.questionIds);
        const linkedQuestionIds = this.resolveRandomizationMode(snapshot.randomizationMode) === 'dynamic' ? [] : questionIds;
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeQuizSnapshot(connection, id, snapshot);
            await this.replaceQuestionLinks(connection, id, linkedQuestionIds);
            await this.appendKeywordsToQuestions(connection, linkedQuestionIds, snapshot.collectionTags);
            await this.recordContentVersion(connection, 'quiz', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'quiz', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'quiz',
                entityId: id,
                action: 'rolled_back',
                summary: `Quiz ${id} rolled back to version ${versionNumber}`,
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
    validateQuiz(quiz) {
        if (!quiz.courseId || quiz.courseId <= 0) {
            throw new common_1.BadRequestException('Please select a course');
        }
        if (!this.resolveAdminName(quiz)) {
            throw new common_1.BadRequestException('Admin name is required');
        }
        if (!this.resolveStudentTitle(quiz)) {
            throw new common_1.BadRequestException('Student title is required');
        }
        if (quiz.subtopicId && (!quiz.topicId || quiz.topicId <= 0)) {
            throw new common_1.BadRequestException('Please select a subject before selecting a topic');
        }
        if (quiz.lessonId && (!quiz.topicId || quiz.topicId <= 0)) {
            throw new common_1.BadRequestException('Please select a subject before selecting a lesson');
        }
        const questionIds = this.cleanQuestionIds(quiz.questionIds || []);
        const randomizationMode = this.resolveRandomizationMode(quiz.randomizationMode);
        const blueprintQuestionCount = this.getBlueprintQuestionCount(quiz.blueprint);
        if (randomizationMode === 'static' && questionIds.length === 0) {
            throw new common_1.BadRequestException('Please add at least one question to the quiz');
        }
        if (randomizationMode === 'dynamic' && blueprintQuestionCount <= 0) {
            throw new common_1.BadRequestException('Dynamic randomized quizzes need at least one blueprint section with a target count');
        }
    }
    cleanQuestionIds(questionIds = []) {
        return Array.from(new Set((questionIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    }
    resolveRandomizationMode(value) {
        return value === 'dynamic' ? 'dynamic' : 'static';
    }
    getBlueprintQuestionCount(blueprint) {
        return this.normalizeBlueprintPayload(blueprint).sections.reduce((total, section) => {
            return total + Math.max(0, Number(section.targetCount || 0));
        }, 0);
    }
    resolveQuizQuestionCount(quiz, questionIds = this.cleanQuestionIds(quiz.questionIds)) {
        return this.resolveRandomizationMode(quiz.randomizationMode) === 'dynamic'
            ? this.getBlueprintQuestionCount(quiz.blueprint)
            : questionIds.length;
    }
    buildQuizSnapshot(quiz) {
        return {
            courseId: quiz.courseId,
            topicId: quiz.topicId ?? null,
            subtopicId: quiz.subtopicId ?? null,
            lessonId: quiz.lessonId ?? null,
            paperId: quiz.paperId ?? null,
            category: quiz.category || '',
            collectionTags: this.normalizeKeywords(quiz.collectionTags),
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
            blueprint: this.normalizeBlueprintPayload(quiz.blueprint),
            randomizationMode: this.resolveRandomizationMode(quiz.randomizationMode),
            timeLimit: quiz.timeLimit,
            hideTimeLimit: quiz.hideTimeLimit,
            passingMarks: this.resolvePassingMarks(quiz.passingMarks),
            hidePassingMarks: quiz.hidePassingMarks,
            status: quiz.status,
            questionIds: this.resolveRandomizationMode(quiz.randomizationMode) === 'dynamic' ? [] : this.cleanQuestionIds(quiz.questionIds),
        };
    }
    buildQuizSnapshotFromEntity(quiz, status) {
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
            blueprint: quiz.blueprint || null,
            randomizationMode: this.resolveRandomizationMode(quiz.randomizationMode),
            timeLimit: Number(quiz.timeLimit),
            hideTimeLimit: quiz.hideTimeLimit === 1 ? 1 : 0,
            passingMarks: this.resolvePassingMarks(quiz.passingMarks),
            hidePassingMarks: quiz.hidePassingMarks === 1 ? 1 : 0,
            status,
            questionIds: quiz.questionIds,
        });
    }
    async transitionWorkflow(id, input) {
        const existing = await this.findOne(id);
        this.assertCanModifyExistingStatus(input.actor, existing.status);
        this.assertCanSaveStatus(input.actor, input.status);
        const snapshot = this.buildQuizSnapshotFromEntity(existing, input.status);
        this.validateQuiz(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE quizzes SET status = ? WHERE id = ?', [input.status, id]);
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
    async writeQuizSnapshot(connection, id, quiz) {
        const questionIds = this.cleanQuestionIds(quiz.questionIds);
        const totalQuestions = this.resolveQuizQuestionCount(quiz, questionIds);
        await connection.execute(`
        UPDATE quizzes SET
          course_id = ?,
          topic_id = ?,
          subtopic_id = ?,
          lesson_id = ?,
          paper_id = ?,
          category = ?,
          collection_tags = ?,
          is_free = ?,
          subtopic = ?,
          is_general = ?,
          exam_mode_only = ?,
          admin_name = ?,
          student_title = ?,
          display_title_mode = ?,
          quiz_number = ?,
          quiz_title = ?,
          quiz_description = ?,
          blueprint_json = ?,
          randomization_mode = ?,
          total_questions = ?,
          total_marks = ?,
          time_limit = ?,
          hide_time_limit = ?,
          passing_marks = ?,
          hide_passing_marks = ?,
          status = ?
        WHERE id = ?
      `, [
            quiz.courseId,
            quiz.isGeneral === 1 ? null : quiz.topicId ?? null,
            quiz.isGeneral === 1 ? null : quiz.subtopicId ?? null,
            quiz.isGeneral === 1 ? null : quiz.lessonId ?? null,
            quiz.paperId ?? null,
            (quiz.category || '').trim() || null,
            this.normalizeKeywords(quiz.collectionTags),
            quiz.isFree === 1 ? 1 : 0,
            (quiz.subtopic || '').trim(),
            quiz.isGeneral,
            quiz.examModeOnly,
            this.resolveAdminName(quiz),
            this.resolveStudentTitle(quiz),
            this.resolveDisplayTitleMode(quiz.displayTitleMode),
            quiz.quizNumber ?? null,
            this.resolveStudentTitle(quiz),
            (quiz.quizDescription || '').trim(),
            this.stringifyBlueprint(quiz.blueprint),
            this.resolveRandomizationMode(quiz.randomizationMode),
            totalQuestions,
            totalQuestions,
            quiz.timeLimit,
            quiz.hideTimeLimit,
            this.resolvePassingMarks(quiz.passingMarks),
            quiz.hidePassingMarks,
            quiz.status,
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
    parseQuizSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Quiz version snapshot is invalid');
        }
        const snapshot = parsed;
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
            blueprint: this.normalizeBlueprintPayload(snapshot.blueprint),
            randomizationMode: this.resolveRandomizationMode(snapshot.randomizationMode),
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
            throw new common_1.ForbiddenException('Review permission is required to publish quiz content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published quizzes require review permission before modification');
        }
    }
    async replaceQuestionLinks(connection, quizId, questionIds) {
        await connection.execute('DELETE FROM question_quizzes WHERE quiz_id = ?', [quizId]);
        for (const [index, questionId] of questionIds.entries()) {
            await connection.execute('INSERT INTO question_quizzes (question_id, quiz_id, sort_order) VALUES (?, ?, ?)', [questionId, quizId, index + 1]);
        }
    }
    async appendKeywordsToQuestions(connection, questionIds, rawKeywords) {
        const keywords = this.normalizeKeywordArray(rawKeywords);
        if (keywords.length === 0 || questionIds.length === 0) {
            return;
        }
        for (const questionId of questionIds) {
            const [questionRows] = await connection.execute('SELECT keywords_text FROM questions WHERE id = ? LIMIT 1', [questionId]);
            if (!questionRows[0]) {
                continue;
            }
            const nextKeywords = Array.from(new Set([
                ...this.normalizeKeywordArray(String(questionRows[0].keywords_text || '')),
                ...keywords,
            ]));
            const keywordsText = nextKeywords.join(', ');
            await connection.execute('UPDATE questions SET keywords_text = ? WHERE id = ?', [keywordsText, questionId]);
            await connection.execute('DELETE FROM question_keyword_map WHERE question_id = ?', [questionId]);
            for (const keyword of nextKeywords) {
                await connection.execute('INSERT IGNORE INTO question_keywords (keyword_name) VALUES (?)', [keyword]);
                const [keywordRows] = await connection.execute('SELECT id FROM question_keywords WHERE keyword_name = ? LIMIT 1', [keyword]);
                if (!keywordRows[0]) {
                    continue;
                }
                await connection.execute('INSERT IGNORE INTO question_keyword_map (question_id, keyword_id) VALUES (?, ?)', [questionId, Number(keywordRows[0].id)]);
            }
        }
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
    resolveAdminName(quiz) {
        return String(quiz.adminName || quiz.quizTitle || '').trim();
    }
    resolveStudentTitle(quiz) {
        return String(quiz.studentTitle || quiz.quizTitle || '').trim();
    }
    resolveDisplayTitleMode(value) {
        return value === 'title' ? 'title' : 'number';
    }
    async resolveNextQuizNumber(connection, dto, excludeId) {
        const isGeneral = dto.isGeneral === 1;
        const courseId = dto.courseId;
        const topicId = isGeneral ? null : (dto.topicId ?? null);
        const subtopicId = isGeneral ? null : (dto.subtopicId ?? null);
        const lessonId = isGeneral ? null : (dto.lessonId ?? null);
        let sql = `SELECT COALESCE(MAX(quiz_number), 0) + 1 AS next_number FROM quizzes WHERE display_title_mode = 'number' AND quiz_number IS NOT NULL AND course_id = ?`;
        const params = [courseId];
        if (lessonId) {
            sql += ' AND lesson_id = ?';
            params.push(lessonId);
        }
        else if (subtopicId) {
            sql += ' AND subtopic_id = ? AND (lesson_id IS NULL OR lesson_id = 0)';
            params.push(subtopicId);
        }
        else if (topicId) {
            sql += ' AND topic_id = ? AND (subtopic_id IS NULL OR subtopic_id = 0) AND (lesson_id IS NULL OR lesson_id = 0)';
            params.push(topicId);
        }
        else {
            sql += ' AND (topic_id IS NULL OR topic_id = 0)';
        }
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        const [rows] = await connection.execute(sql, params);
        return Number(rows[0]?.next_number || 1);
    }
    optionalPositiveId(value) {
        const numeric = Number(value);
        return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    }
    normalizeBlueprintPayload(blueprint) {
        if (!blueprint || typeof blueprint !== 'object') {
            return { sections: [] };
        }
        const rawSections = Array.isArray(blueprint.sections)
            ? blueprint.sections
            : [];
        const sections = rawSections.slice(0, 30).map((rawSection, index) => {
            const section = rawSection && typeof rawSection === 'object'
                ? rawSection
                : {};
            const targetCount = Number(section.targetCount);
            return {
                id: String(section.id || `section-${index + 1}`).trim().slice(0, 80) || `section-${index + 1}`,
                title: String(section.title || `Section ${index + 1}`).trim().slice(0, 120),
                targetCount: Number.isFinite(targetCount) ? Math.min(Math.max(Math.trunc(targetCount), 0), 500) : 0,
                courseId: this.optionalPositiveId(section.courseId),
                subjectId: this.optionalPositiveId(section.subjectId),
                topicId: this.optionalPositiveId(section.topicId),
                lessonId: this.optionalPositiveId(section.lessonId),
                paperId: this.optionalPositiveId(section.paperId),
                category: String(section.category || '').trim().slice(0, 80),
                questionType: ['sba', 'true_false'].includes(String(section.questionType || ''))
                    ? String(section.questionType)
                    : '',
            };
        });
        return { sections };
    }
    stringifyBlueprint(blueprint) {
        const normalized = this.normalizeBlueprintPayload(blueprint);
        return normalized.sections.length > 0 ? JSON.stringify(normalized) : null;
    }
    parseBlueprint(raw) {
        if (!raw) {
            return { sections: [] };
        }
        try {
            return this.normalizeBlueprintPayload(JSON.parse(raw));
        }
        catch {
            return { sections: [] };
        }
    }
    async getKeywordSuggestions(questionRows) {
        const [keywordRows] = await this.db.execute('SELECT keyword_name FROM question_keywords ORDER BY keyword_name ASC');
        const tableKeywords = keywordRows.map((row) => String(row.keyword_name).trim()).filter(Boolean);
        if (tableKeywords.length > 0) {
            return tableKeywords;
        }
        return Array.from(new Set(questionRows
            .flatMap((row) => String(row.keywords_text || '').split(','))
            .map((keyword) => keyword.trim())
            .filter(Boolean))).sort((left, right) => left.localeCompare(right));
    }
    mapQuiz(row) {
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
            blueprint: this.parseBlueprint(row.blueprint_json),
            randomizationMode: this.resolveRandomizationMode(row.randomization_mode),
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
    async getCards(authorization, quizId) {
        const student = await this.authService.requireStudent(authorization);
        const [quizRows] = await this.db.execute("SELECT id, course_id, is_free, COALESCE(NULLIF(student_title, ''), quiz_title) AS quiz_title FROM quizzes WHERE id = ? AND status = 'active' LIMIT 1", [quizId]);
        if (!quizRows[0])
            throw new common_1.NotFoundException('Quiz not found');
        await this.ensureStudentCanAccessQuiz(student.id, {
            id: Number(quizRows[0].id),
            course_id: Number(quizRows[0].course_id),
            is_free: Number(quizRows[0].is_free),
        });
        const [questionRows] = await this.db.execute(`SELECT q.id, q.question_text, q.explanation, q.question_type
       FROM questions q
       INNER JOIN question_quizzes qq ON qq.question_id = q.id
       WHERE qq.quiz_id = ? AND q.status = 'active'
       ORDER BY qq.sort_order ASC, q.id ASC`, [quizId]);
        if (questionRows.length === 0) {
            return { quizTitle: String(quizRows[0].quiz_title), cards: [] };
        }
        const ids = questionRows.map((r) => r.id);
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(ids);
        const [optionRows] = await this.db.execute(`SELECT id, question_id, option_label, option_text, is_correct, why_incorrect
       FROM question_options WHERE question_id IN (${placeholders})
       ORDER BY question_id, option_label ASC`, ids);
        const [recapRows] = await this.db.execute(`SELECT question_id, concept_name, hierarchy_course, hierarchy_subject, hierarchy_topic, hierarchy_lesson,
              etiology, pathophysiology, clinical_features, investigations, treatment, key_points, mnemonic
       FROM question_theory_recaps
       WHERE question_id IN (${placeholders})`, ids);
        const recapMap = new Map();
        for (const recap of recapRows) {
            recapMap.set(recap.question_id, {
                conceptName: recap.concept_name || '',
                hierarchy: {
                    course: recap.hierarchy_course || '',
                    subject: recap.hierarchy_subject || '',
                    topic: recap.hierarchy_topic || '',
                    lesson: recap.hierarchy_lesson || '',
                },
                etiology: this.parseJsonArray(recap.etiology),
                pathophysiology: this.parseJsonArray(recap.pathophysiology),
                clinicalFeatures: this.parseJsonArray(recap.clinical_features),
                investigations: this.parseJsonArray(recap.investigations),
                treatment: this.parseJsonArray(recap.treatment),
                keyPoints: this.parseJsonArray(recap.key_points),
                mnemonic: recap.mnemonic || '',
            });
        }
        const cards = questionRows.map((q) => ({
            id: q.id,
            questionText: q.question_text,
            explanation: q.explanation || '',
            questionType: q.question_type,
            theoryRecap: recapMap.get(q.id) || null,
            options: optionRows
                .filter((o) => o.question_id === q.id)
                .map((o) => ({
                id: o.id,
                optionLabel: o.option_label,
                optionText: o.option_text,
                isCorrect: Number(o.is_correct) === 1,
                whyIncorrect: o.why_incorrect || '',
            })),
        }));
        return { quizTitle: String(quizRows[0].quiz_title), cards };
    }
    async ensureStudentCanAccessQuiz(userId, quiz) {
        if (Number(quiz.is_free) === 1) {
            return;
        }
        const accessProfile = await this.getQuizAccessProfile(userId);
        if (accessProfile.hasFullAccess || accessProfile.courseIds.has(Number(quiz.course_id))) {
            return;
        }
        throw new common_1.BadRequestException('This quiz is included with selected course plans');
    }
    async getQuizAccessProfile(userId) {
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
            const courseIds = this.parseIdList(row.course_ids_json);
            const scope = this.resolveEffectiveAccessScope(row, courseIds);
            if (scope === 'all' && courseIds.length === 0) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach((id) => profile.courseIds.add(id));
            }
        }
        return profile;
    }
    parseIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
                : [];
        }
        catch {
            return [];
        }
    }
    resolveEffectiveAccessScope(row, courseIds) {
        const planSlug = String(row.plan_slug || '').trim();
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
            return 'courses';
        }
        return row.access_scope || (courseIds.length ? 'courses' : 'all');
    }
};
exports.QuizzesService = QuizzesService;
exports.QuizzesService = QuizzesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService])
], QuizzesService);
//# sourceMappingURL=quizzes.service.js.map