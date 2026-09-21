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
var LessonsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LessonsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = require("fs");
const path = require("path");
const crypto_1 = require("crypto");
const pagination_1 = require("../../common/utils/pagination");
const app_only_content_exception_1 = require("../../common/exceptions/app-only-content.exception");
const database_tokens_1 = require("../../database/database.tokens");
const auth_token_util_1 = require("../auth/auth-token.util");
const ai_provider_utils_1 = require("../../common/utils/ai-provider.utils");
const fetch_with_retry_1 = require("../../common/utils/fetch-with-retry");
const mobile_client_util_1 = require("../../common/utils/mobile-client.util");
const push_notifications_service_1 = require("../push-notifications/push-notifications.service");
const AI_NOTES_REQUEST_TIMEOUT_MS = 240_000;
const FLASHCARD_IMAGE_LIMIT = 3;
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'];
const FALLBACK_COLORS = ['#A7D8FF', '#FFE680', '#FFB3B3', '#C7F0BD', '#CE93D8', '#80DEEA', '#F48FB1', '#FFCC80'];
class LessonJsonTruncatedError extends Error {
}
let LessonsService = LessonsService_1 = class LessonsService {
    constructor(db, config, pushNotificationsService) {
        this.db = db;
        this.config = config;
        this.pushNotificationsService = pushNotificationsService;
    }
    isAppOnlyBlocked(appClient) {
        return !(0, mobile_client_util_1.isMobileAppClient)(appClient);
    }
    async getMeta() {
        const [courses] = await this.db.execute("SELECT id, course_title, status FROM courses ORDER BY course_title ASC");
        const [topics] = await this.db.execute("SELECT id, course_id, topic_name, status FROM topics ORDER BY topic_name ASC");
        const [subtopics] = await this.db.execute("SELECT id, topic_id, subtopic_name, status FROM subtopics ORDER BY subtopic_name ASC");
        return {
            courses: courses.map((row) => ({
                id: row.id,
                courseTitle: row.course_title || '',
                status: row.status || 'inactive',
            })),
            topics: topics.map((row) => ({
                id: row.id,
                courseId: row.course_id || 0,
                topicName: row.topic_name || '',
                status: row.status || 'inactive',
            })),
            subtopics: subtopics.map((row) => ({
                id: row.id,
                topicId: row.topic_id || 0,
                subtopicName: row.subtopic_name || '',
                status: row.status || 'inactive',
            })),
        };
    }
    async findAdminList(filters) {
        const { limit, offset } = (0, pagination_1.normalizePagination)(filters, { defaultLimit: 50, maxLimit: 100 });
        const conditions = [];
        const params = [];
        if (filters.search?.trim()) {
            conditions.push('l.lesson_title LIKE ?');
            params.push(`%${filters.search.trim()}%`);
        }
        if (filters.courseId) {
            conditions.push('l.course_id = ?');
            params.push(filters.courseId);
        }
        if (filters.topicId) {
            conditions.push('l.topic_id = ?');
            params.push(filters.topicId);
        }
        if (filters.subtopicId) {
            conditions.push('l.subtopic_id = ?');
            params.push(filters.subtopicId);
        }
        if (filters.status?.trim()) {
            conditions.push('l.status = ?');
            params.push(filters.status.trim());
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await this.db.execute(`SELECT
        l.id,
        l.course_id,
        l.topic_id,
        l.subtopic_id,
        l.lesson_title,
        NULL AS lesson_content,
        l.video_url,
        l.pdf_url,
        l.is_free,
        l.status,
        l.created_at,
        c.course_title,
        t.topic_name,
        s.subtopic_name
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      ${whereClause}
      ORDER BY l.topic_id ASC, l.subtopic_id ASC, l.sort_order ASC, l.id ASC
      LIMIT ? OFFSET ?`, [...params, limit, offset]);
        return rows.map((row) => this.mapLesson(row));
    }
    async findStudentList(authorization) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const accessProfile = await this.getLessonAccessProfile(student.id);
        const [rows] = await this.db.execute(`SELECT
        l.id,
        l.course_id,
        l.topic_id,
        l.subtopic_id,
        l.lesson_title,
        NULL AS lesson_content,
        NULL AS video_url,
        l.is_free,
        l.status,
        l.created_at,
        c.course_title,
        t.topic_name,
        s.subtopic_name
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.status = 'active'
      ORDER BY l.topic_id ASC, l.subtopic_id ASC, l.sort_order ASC, l.id ASC`);
        return rows.map((row) => this.mapStudentLesson(row, accessProfile));
    }
    async findStudentLesson(id, authorization, appClient) {
        const student = await this.findActiveStudentByToken(this.extractToken(authorization));
        const lesson = await this.findById(id);
        if (lesson.status !== 'active') {
            throw new common_1.NotFoundException('Lesson not found');
        }
        if (Number(lesson.isFree ?? lesson.is_free) !== 1 && this.isAppOnlyBlocked(appClient)) {
            throw new app_only_content_exception_1.AppOnlyContentException();
        }
        const accessProfile = await this.getLessonAccessProfile(student.id);
        if (!this.canAccessLesson(lesson, accessProfile)) {
            throw new common_1.ForbiddenException('Your subscription does not include this premium lesson');
        }
        return {
            ...lesson,
            excerpt: this.toExcerpt(lesson.lessonContent || ''),
        };
    }
    async findStudentAnnotations(lessonId, authorization) {
        const user = await this.findActiveStudentByToken(this.extractToken(authorization));
        await this.ensureStudentCanAccessLesson(lessonId, user.id);
        const [rows] = await this.db.execute(`
        SELECT id, lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text, created_at, updated_at
        FROM lesson_annotations
        WHERE lesson_id = ? AND user_id = ?
        ORDER BY start_offset ASC, id ASC
      `, [lessonId, user.id]);
        return rows.map((row) => this.mapAnnotation(row));
    }
    async createStudentAnnotation(lessonId, dto, authorization) {
        const user = await this.findActiveStudentByToken(this.extractToken(authorization));
        const lesson = await this.ensureStudentCanAccessLesson(lessonId, user.id);
        const lessonText = this.toPlainText(lesson.lessonContent || '');
        this.validateAnnotationPayload(dto, lessonText.length);
        const [result] = await this.db.execute(`
        INSERT INTO lesson_annotations
          (lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
            lessonId,
            user.id,
            dto.type,
            dto.selectedText.trim(),
            dto.startOffset,
            dto.endOffset,
            (dto.color || '').trim() || '#fff59d',
            (dto.noteText || '').trim() || null,
        ]);
        const created = await this.findAnnotationById(result.insertId);
        return this.mapAnnotation(created);
    }
    async updateStudentAnnotation(lessonId, annotationId, dto, authorization) {
        const user = await this.findActiveStudentByToken(this.extractToken(authorization));
        await this.ensureStudentCanAccessLesson(lessonId, user.id);
        const annotation = await this.findOwnedAnnotation(annotationId, lessonId, user.id);
        await this.db.execute(`
        UPDATE lesson_annotations
        SET color = ?, note_text = ?
        WHERE id = ? AND lesson_id = ? AND user_id = ?
      `, [
            typeof dto.color === 'string' ? dto.color.trim() || annotation.color : annotation.color,
            typeof dto.noteText === 'string' ? dto.noteText.trim() || null : annotation.noteText,
            annotationId,
            lessonId,
            user.id,
        ]);
        const updated = await this.findAnnotationById(annotationId);
        return this.mapAnnotation(updated);
    }
    async removeStudentAnnotation(lessonId, annotationId, authorization) {
        const user = await this.findActiveStudentByToken(this.extractToken(authorization));
        await this.ensureStudentCanAccessLesson(lessonId, user.id);
        await this.findOwnedAnnotation(annotationId, lessonId, user.id);
        await this.db.execute('DELETE FROM lesson_annotations WHERE id = ? AND lesson_id = ? AND user_id = ?', [
            annotationId,
            lessonId,
            user.id,
        ]);
        return { ok: true, id: annotationId };
    }
    async create(createLessonDto, actor) {
        const snapshot = this.buildLessonSnapshot(createLessonDto);
        this.validateLessonPayload(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        if (snapshot.status === 'active') {
            this.validateLessonPublishReady(snapshot);
        }
        await this.ensureLessonHierarchyExists(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [orderRows] = await connection.execute(`SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM lessons WHERE topic_id <=> ? AND subtopic_id <=> ?`, [snapshot.topicId, snapshot.subtopicId || null]);
            const nextSortOrder = Number(orderRows[0]?.maxOrder || 0) + 10;
            const [result] = await connection.execute(`INSERT INTO lessons
          (course_id, topic_id, subtopic_id, lesson_title, lesson_content, video_url, is_free, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                snapshot.courseId,
                snapshot.topicId,
                snapshot.subtopicId || null,
                snapshot.lessonTitle,
                snapshot.lessonContent,
                snapshot.videoUrl,
                snapshot.isFree,
                snapshot.status,
                nextSortOrder,
            ]);
            await this.recordContentVersion(connection, 'lesson', result.insertId, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'lesson', result.insertId, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'lesson',
                entityId: result.insertId,
                action: 'created',
                summary: `Lesson ${result.insertId} created`,
                actorId: this.getActorId(actor),
                after: snapshot,
            });
            await connection.commit();
            if (snapshot.status === 'active') {
                void this.pushNotificationsService.notifyStudentsOfNewContent({
                    title: 'New lesson to study',
                    body: `${snapshot.lessonTitle} just dropped — dive in and keep the streak going.`,
                });
            }
            return {
                ok: true,
                id: result.insertId,
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
    async update(id, updateLessonDto, actor) {
        const existing = await this.findById(id);
        const snapshot = this.buildLessonSnapshot({
            courseId: updateLessonDto.courseId ?? existing.courseId,
            topicId: updateLessonDto.topicId ?? existing.topicId,
            subtopicId: updateLessonDto.subtopicId ?? existing.subtopicId,
            lessonTitle: updateLessonDto.lessonTitle ?? existing.lessonTitle,
            lessonContent: updateLessonDto.lessonContent ?? existing.lessonContent,
            videoUrl: updateLessonDto.videoUrl ?? existing.videoUrl,
            isFree: Number(updateLessonDto.isFree ?? existing.isFree) === 1 ? 1 : 0,
            status: updateLessonDto.status ?? existing.status,
        });
        this.validateLessonPayload(snapshot);
        this.assertCanModifyExistingStatus(actor, existing.status);
        this.assertCanSaveStatus(actor, snapshot.status, existing.status);
        if (snapshot.status === 'active') {
            this.validateLessonPublishReady(snapshot);
        }
        await this.ensureLessonHierarchyExists(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeLessonSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'lesson', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'lesson', id, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'lesson',
                entityId: id,
                action: 'updated',
                summary: `Lesson ${id} updated`,
                actorId: this.getActorId(actor),
                before: existing,
                after: snapshot,
            });
            await connection.commit();
            if (existing.status !== 'active' && snapshot.status === 'active') {
                void this.pushNotificationsService.notifyStudentsOfNewContent({
                    title: 'New lesson to study',
                    body: `${snapshot.lessonTitle} just dropped — dive in and keep the streak going.`,
                });
            }
            return {
                ok: true,
                id,
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
    async remove(id, actor) {
        const existing = await this.findById(id);
        this.assertCanModifyExistingStatus(actor, existing.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM lessons WHERE id = ?', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'lesson',
                entityId: id,
                action: 'deleted',
                summary: `Lesson ${id} deleted`,
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
        return {
            ok: true,
            id,
        };
    }
    async listVersions(id) {
        await this.findById(id);
        const [rows] = await this.db.execute(`SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'lesson' AND entity_id = ?
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
            summary: `Lesson ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Lesson ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Lesson ${id} published`,
            actor,
            requirePublishReady: true,
        });
    }
    async rollback(id, versionNumber, actor) {
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback published lesson content');
        }
        const existing = await this.findById(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'lesson' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Content version not found');
        }
        const snapshot = this.parseLessonSnapshot(versionRows[0].snapshot_json);
        this.validateLessonPayload(snapshot);
        if (snapshot.status === 'active') {
            this.validateLessonPublishReady(snapshot);
        }
        await this.ensureLessonHierarchyExists(snapshot);
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeLessonSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'lesson', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'lesson', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'lesson',
                entityId: id,
                action: 'rolled_back',
                summary: `Lesson ${id} rolled back to version ${versionNumber}`,
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
    async uploadPdf(id, file, actor) {
        await this.findById(id);
        const uploadsDir = path.join(process.cwd(), 'uploads', 'pdf');
        if (!fs.existsSync(uploadsDir))
            fs.mkdirSync(uploadsDir, { recursive: true });
        const safeName = `lesson-${id}-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, file.buffer);
        const pdfUrl = `/uploads/pdf/${safeName}`;
        await this.db.execute('UPDATE lessons SET pdf_url = ? WHERE id = ?', [pdfUrl, id]);
        await this.db.execute(`INSERT INTO content_audit_events (entity_type, entity_id, action, actor_id, summary) VALUES (?, ?, ?, ?, ?)`, ['lesson', id, 'pdf_uploaded', this.getActorId(actor) || null, `PDF uploaded for lesson ${id}`]);
        return { ok: true, id, pdfUrl };
    }
    async removePdf(id, actor) {
        const lesson = await this.findById(id);
        if (!lesson.pdfUrl)
            return { ok: true, id };
        const filePath = path.join(process.cwd(), lesson.pdfUrl);
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
        await this.db.execute('UPDATE lessons SET pdf_url = NULL WHERE id = ?', [id]);
        await this.db.execute(`INSERT INTO content_audit_events (entity_type, entity_id, action, actor_id, summary) VALUES (?, ?, ?, ?, ?)`, ['lesson', id, 'pdf_removed', this.getActorId(actor) || null, `PDF removed from lesson ${id}`]);
        return { ok: true, id };
    }
    async uploadVideo(id, file, actor) {
        await this.findById(id);
        const uploadsDir = path.join(process.cwd(), 'uploads', 'video');
        if (!fs.existsSync(uploadsDir))
            fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
        const safeName = `lesson-${id}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, file.buffer);
        const videoUrl = `/uploads/video/${safeName}`;
        await this.db.execute('UPDATE lessons SET video_url = ? WHERE id = ?', [videoUrl, id]);
        await this.db.execute(`INSERT INTO content_audit_events (entity_type, entity_id, action, actor_id, summary) VALUES (?, ?, ?, ?, ?)`, ['lesson', id, 'video_uploaded', this.getActorId(actor) || null, `Video uploaded for lesson ${id}`]);
        return { ok: true, id, videoUrl };
    }
    async removeVideo(id, actor) {
        const lesson = await this.findById(id);
        if (!lesson.videoUrl)
            return { ok: true, id };
        if (lesson.videoUrl.startsWith('/uploads/video/')) {
            const filePath = path.join(process.cwd(), lesson.videoUrl);
            if (fs.existsSync(filePath))
                fs.unlinkSync(filePath);
        }
        await this.db.execute('UPDATE lessons SET video_url = NULL WHERE id = ?', [id]);
        await this.db.execute(`INSERT INTO content_audit_events (entity_type, entity_id, action, actor_id, summary) VALUES (?, ?, ?, ?, ?)`, ['lesson', id, 'video_removed', this.getActorId(actor) || null, `Video removed from lesson ${id}`]);
        return { ok: true, id };
    }
    async transitionWorkflow(id, input) {
        const existing = await this.findById(id);
        this.assertCanModifyExistingStatus(input.actor, existing.status);
        this.assertCanSaveStatus(input.actor, input.status, existing.status);
        const snapshot = this.buildLessonSnapshotFromEntity(existing, input.status);
        this.validateLessonPayload(snapshot);
        if (input.requirePublishReady) {
            this.validateLessonPublishReady(snapshot);
        }
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE lessons SET status = ? WHERE id = ?', [input.status, id]);
            await this.recordContentVersion(connection, 'lesson', id, snapshot, this.getActorId(input.actor));
            await this.setWorkflowState(connection, 'lesson', id, input.workflowState, this.getActorId(input.actor));
            await this.recordContentAudit(connection, {
                entityType: 'lesson',
                entityId: id,
                action: input.action,
                summary: input.summary,
                actorId: this.getActorId(input.actor),
                before: existing,
                after: snapshot,
            });
            await connection.commit();
            if (input.status === 'active' && existing.status !== 'active') {
                void this.pushNotificationsService.notifyStudentsOfNewContent({
                    title: 'New lesson to study',
                    body: `${snapshot.lessonTitle} just dropped — dive in and keep the streak going.`,
                });
            }
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
    buildLessonSnapshot(lesson) {
        return {
            courseId: Number(lesson.courseId),
            topicId: Number(lesson.topicId),
            subtopicId: Number(lesson.subtopicId || 0),
            lessonTitle: String(lesson.lessonTitle || '').trim(),
            lessonContent: String(lesson.lessonContent || '').trim(),
            videoUrl: String(lesson.videoUrl || '').trim(),
            isFree: Number(lesson.isFree) === 1 ? 1 : 0,
            status: lesson.status === 'active' ? 'active' : 'inactive',
        };
    }
    buildLessonSnapshotFromEntity(lesson, status) {
        return this.buildLessonSnapshot({
            courseId: Number(lesson.courseId),
            topicId: Number(lesson.topicId),
            subtopicId: Number(lesson.subtopicId || 0),
            lessonTitle: lesson.lessonTitle,
            lessonContent: lesson.lessonContent || '',
            videoUrl: lesson.videoUrl || '',
            isFree: Number(lesson.isFree) === 1 ? 1 : 0,
            status,
        });
    }
    async writeLessonSnapshot(connection, id, lesson) {
        await connection.execute(`UPDATE lessons
       SET course_id = ?, topic_id = ?, subtopic_id = ?, lesson_title = ?, lesson_content = ?, video_url = ?, is_free = ?, status = ?
       WHERE id = ?`, [
            lesson.courseId,
            lesson.topicId,
            lesson.subtopicId || null,
            lesson.lessonTitle,
            lesson.lessonContent,
            lesson.videoUrl,
            lesson.isFree,
            lesson.status,
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
    parseLessonSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
        return this.buildLessonSnapshot({
            courseId: Number(snapshot.courseId),
            topicId: Number(snapshot.topicId),
            subtopicId: Number(snapshot.subtopicId || 0),
            lessonTitle: String(snapshot.lessonTitle || ''),
            lessonContent: String(snapshot.lessonContent || ''),
            videoUrl: String(snapshot.videoUrl || ''),
            isFree: Number(snapshot.isFree) === 1 ? 1 : 0,
            status: snapshot.status === 'active' ? 'active' : 'inactive',
        });
    }
    async ensureLessonHierarchyExists(lesson) {
        await this.ensureExists('courses', lesson.courseId, 'Selected course was not found');
        await this.ensureExists('topics', lesson.topicId, 'Selected subject was not found');
        if (lesson.subtopicId) {
            await this.ensureExists('subtopics', lesson.subtopicId, 'Selected topic was not found');
        }
    }
    async ensureExists(tableName, id, message) {
        if (!Number.isInteger(id) || id <= 0) {
            throw new common_1.BadRequestException(message);
        }
        const [rows] = await this.db.execute(`SELECT id FROM ${tableName} WHERE id = ? LIMIT 1`, [id]);
        if (rows.length === 0) {
            throw new common_1.BadRequestException(message);
        }
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
    canEditPublishedContent(actor) {
        if (!actor || typeof actor === 'number')
            return true;
        return this.canReviewContent(actor) || Boolean(actor.permissions?.includes('content.manage'));
    }
    assertCanSaveStatus(actor, status, previousStatus) {
        if (previousStatus !== undefined && previousStatus === status) {
            return;
        }
        if (status === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to publish lesson content');
        }
        if (previousStatus === 'active' && status !== 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to unpublish lesson content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canEditPublishedContent(actor)) {
            throw new common_1.ForbiddenException('Published lessons require review permission before modification');
        }
    }
    validateLessonPayload(lesson) {
        if (!lesson.courseId || lesson.courseId <= 0) {
            throw new common_1.BadRequestException('Please select a course');
        }
        if (!lesson.topicId || lesson.topicId <= 0) {
            throw new common_1.BadRequestException('Please select a subject');
        }
        if (!lesson.lessonTitle) {
            throw new common_1.BadRequestException('Lesson title is required');
        }
    }
    validateLessonPublishReady(lesson) {
    }
    async findById(id) {
        const [rows] = await this.db.execute(`SELECT
        l.id,
        l.course_id,
        l.topic_id,
        l.subtopic_id,
        l.lesson_title,
        l.lesson_content,
        l.video_url,
        l.pdf_url,
        l.is_free,
        l.status,
        l.created_at,
        c.course_title,
        t.topic_name,
        s.subtopic_name
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.id = ?
      LIMIT 1`, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Lesson not found');
        }
        return this.mapLesson(row);
    }
    async ensureActiveLessonExists(lessonId) {
        const lesson = await this.findById(lessonId);
        if (lesson.status !== 'active') {
            throw new common_1.NotFoundException('Lesson not found');
        }
        return lesson;
    }
    async ensureStudentCanAccessLesson(lessonId, userId) {
        const lesson = await this.ensureActiveLessonExists(lessonId);
        const accessProfile = await this.getLessonAccessProfile(userId);
        if (!this.canAccessLesson(lesson, accessProfile)) {
            throw new common_1.ForbiddenException('Your subscription does not include this premium lesson');
        }
        return lesson;
    }
    async getLessonAccessProfile(userId) {
        const [rows] = await this.db.execute(`
        SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
      `, [userId]);
        const profile = {
            hasAnyPaidLessonAccess: rows.length > 0,
            hasFullAccess: false,
            courseIds: new Set(),
            lessonIds: new Set(),
        };
        for (const row of rows) {
            const courseIds = this.parseIdList(row.course_ids_json);
            const lessonIds = this.parseIdList(row.lesson_ids_json);
            const scope = this.resolveEffectiveAccessScope(row, courseIds, lessonIds);
            if (scope === 'all' && courseIds.length === 0 && lessonIds.length === 0) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach((id) => profile.courseIds.add(id));
            }
            else if (scope === 'lessons') {
                lessonIds.forEach((id) => profile.lessonIds.add(id));
            }
        }
        return profile;
    }
    parseIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
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
    resolveEffectiveAccessScope(row, courseIds, lessonIds) {
        const planSlug = String(row.plan_slug || '').trim();
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
            return 'courses';
        }
        return row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
    }
    canAccessLesson(lesson, profile) {
        if (Number(lesson.isFree ?? lesson.is_free) === 1)
            return true;
        if (!profile.hasAnyPaidLessonAccess)
            return false;
        if (profile.hasFullAccess)
            return true;
        return profile.courseIds.has(Number(lesson.courseId ?? lesson.course_id)) || profile.lessonIds.has(Number(lesson.id));
    }
    validateAnnotationPayload(dto, lessonLength) {
        if (!dto.selectedText.trim()) {
            throw new common_1.BadRequestException('Selected text is required');
        }
        if (dto.endOffset <= dto.startOffset) {
            throw new common_1.BadRequestException('Annotation selection range is invalid');
        }
        if (dto.endOffset > lessonLength) {
            throw new common_1.BadRequestException('Annotation selection is outside the lesson content');
        }
        if (dto.type === 'note' && !(dto.noteText || '').trim()) {
            throw new common_1.BadRequestException('Note text is required for note annotations');
        }
    }
    async findAnnotationById(id) {
        const [rows] = await this.db.execute(`
        SELECT id, lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text, created_at, updated_at
        FROM lesson_annotations
        WHERE id = ?
        LIMIT 1
      `, [id]);
        const annotation = rows[0];
        if (!annotation) {
            throw new common_1.NotFoundException('Annotation not found');
        }
        return annotation;
    }
    async findOwnedAnnotation(annotationId, lessonId, userId) {
        const annotation = await this.findAnnotationById(annotationId);
        if (annotation.lesson_id !== lessonId || annotation.user_id !== userId) {
            throw new common_1.ForbiddenException('You can only edit or delete your own annotations');
        }
        return this.mapAnnotation(annotation);
    }
    mapLesson(row) {
        return {
            id: row.id,
            courseId: row.course_id,
            topicId: row.topic_id,
            subtopicId: row.subtopic_id || 0,
            lessonTitle: row.lesson_title,
            lessonContent: row.lesson_content || '',
            videoUrl: row.video_url || '',
            pdfUrl: row.pdf_url || '',
            isFree: Number(row.is_free) === 1 ? 1 : 0,
            status: row.status,
            createdAt: row.created_at || null,
            updatedAt: row.created_at || null,
            courseTitle: row.course_title || '',
            topicName: row.topic_name || '',
            subtopicName: row.subtopic_name || '',
        };
    }
    mapStudentLesson(row, accessProfile) {
        const lesson = this.mapLesson(row);
        const canAccess = this.canAccessLesson(row, accessProfile);
        return {
            ...lesson,
            lessonContent: canAccess ? lesson.lessonContent : '',
            videoUrl: canAccess ? lesson.videoUrl : '',
            excerpt: canAccess
                ? this.toExcerpt(row.lesson_content || '')
                : 'Premium lesson locked for your current course subscription.',
            canAccess,
            accessLocked: !canAccess,
            lockReason: canAccess ? '' : 'Your subscription does not include this premium lesson.',
        };
    }
    mapAnnotation(row) {
        return {
            id: row.id,
            lessonId: row.lesson_id,
            userId: row.user_id,
            type: row.type,
            selectedText: row.selected_text,
            startOffset: Number(row.start_offset),
            endOffset: Number(row.end_offset),
            color: row.color || '#fff59d',
            noteText: row.note_text || '',
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
    extractToken(authorization) {
        const token = (0, auth_token_util_1.extractBearerToken)(authorization);
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing');
        }
        return token;
    }
    async findActiveStudentByToken(sessionToken) {
        const [rows] = await this.db.execute(`SELECT id, role, status
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(sessionToken)]);
        const user = rows[0];
        if (!user || user.role !== 'student') {
            throw new common_1.UnauthorizedException('Student access required');
        }
        if (user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your student account is not active yet');
        }
        return user;
    }
    toExcerpt(content) {
        const plain = this.toPlainText(content);
        if (!plain) {
            return 'Lesson content available inside the lesson viewer.';
        }
        return plain.length > 180 ? `${plain.slice(0, 177)}...` : plain;
    }
    toPlainText(content) {
        return content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }
    normalizeEngineKey(value) {
        return value === 'openai' ? 'openai' : 'gemini';
    }
    async resolveToken(token) {
        if (!token)
            throw new common_1.UnauthorizedException('Missing auth token');
        const [rows] = await this.db.execute(`SELECT id, role, status FROM users WHERE session_token = ? AND session_expires_at > NOW() LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(token)]);
        if (!rows.length)
            throw new common_1.UnauthorizedException('Invalid or expired session');
        return rows[0];
    }
    async requireAdminToken(token) {
        const u = await this.resolveToken(token);
        if (u.role !== 'admin' || u.status !== 'active')
            throw new common_1.ForbiddenException('Active admin account required');
        return u;
    }
    async requireStudentToken(token) {
        const u = await this.resolveToken(token);
        if (u.role !== 'student' || u.status !== 'active')
            throw new common_1.ForbiddenException('Active student account required');
        return u;
    }
    canvasLessonSelect(includeNoteData) {
        return `
      l.id, l.lesson_title, l.engine_key, l.is_free, l.status, l.is_public,
      l.course_id, l.topic_id, l.subtopic_id, l.sort_order, l.video_url, l.pdf_url,
      l.created_at, l.updated_at,
      ${includeNoteData ? 'l.note_data, l.raw_text,' : 'NULL AS note_data, NULL AS raw_text,'}
      c.course_title, c.exam_type, t.topic_name, s.subtopic_name
    `;
    }
    async canvasAdminList(token, engineKey = 'gemini') {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute(`
      SELECT ${this.canvasLessonSelect(false)},
             (SELECT COUNT(*) FROM lesson_flashcards lf WHERE lf.lesson_id = l.id AND lf.status = 'approved') AS approved_flashcard_count
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.is_public = 1 AND l.engine_key = ?
      ORDER BY c.course_title ASC, t.sort_order ASC, s.sort_order ASC, l.sort_order ASC, l.id ASC`, [engineKey]);
        return rows.map(r => this.deserializeCanvas(r));
    }
    async canvasReorderLessons(orderedIds, token) {
        await this.requireAdminToken(token);
        const ids = orderedIds.filter((id) => Number.isFinite(id) && id > 0);
        if (!ids.length)
            return { ok: true };
        await Promise.all(ids.map((id, index) => this.db.execute(`UPDATE lessons SET sort_order = ? WHERE id = ?`, [(index + 1) * 10, id])));
        return { ok: true };
    }
    async canvasAdminFindOne(id, token, engineKey = 'gemini') {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute(`
      SELECT ${this.canvasLessonSelect(true)},
             (SELECT COUNT(*) FROM lesson_flashcards lf WHERE lf.lesson_id = l.id AND lf.status = 'approved') AS approved_flashcard_count
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.id = ? AND l.is_public = 1 AND l.engine_key = ?`, [id, engineKey]);
        if (!rows.length)
            throw new common_1.NotFoundException('Lesson not found');
        return this.deserializeCanvas(rows[0]);
    }
    async canvasAdminUpdate(id, patch, token, engineKey = 'gemini') {
        await this.requireAdminToken(token);
        const [existing] = await this.db.execute('SELECT id FROM lessons WHERE id = ? AND is_public = 1 AND engine_key = ?', [id, engineKey]);
        if (!existing.length)
            throw new common_1.NotFoundException('Lesson not found');
        if (patch.courseId && !patch.topicId) {
            try {
                const fallback = await this.ensureDefaultLessonHierarchy(Number(patch.courseId));
                patch.topicId = fallback.topicId;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new common_1.BadRequestException(`Could not resolve a default subject for this course: ${message}`);
            }
        }
        const fields = [];
        const values = [];
        if (patch.title !== undefined) {
            fields.push('lesson_title = ?');
            values.push(patch.title);
        }
        if (patch.rawText !== undefined) {
            fields.push('raw_text = ?');
            values.push(patch.rawText);
        }
        if (patch.status !== undefined) {
            fields.push('status = ?');
            values.push(patch.status === 'active' ? 'active' : 'inactive');
        }
        if (patch.courseId !== undefined) {
            fields.push('course_id = ?');
            values.push(patch.courseId ?? null);
        }
        if (patch.topicId !== undefined) {
            fields.push('topic_id = ?');
            values.push(patch.topicId ?? null);
        }
        if (patch.subtopicId !== undefined) {
            fields.push('subtopic_id = ?');
            values.push(patch.subtopicId ?? null);
        }
        if (patch.videoUrl !== undefined) {
            fields.push('video_url = ?');
            values.push(String(patch.videoUrl || '').trim() || null);
        }
        if (patch.isFree !== undefined) {
            fields.push('is_free = ?');
            values.push(Number(patch.isFree) === 1 ? 1 : 0);
        }
        if (patch.noteData !== undefined) {
            const serialized = JSON.stringify(patch.noteData);
            if (Buffer.byteLength(serialized, 'utf8') > 60 * 1024 * 1024)
                throw new common_1.BadRequestException('Lesson data exceeds the 60 MB save limit.');
            fields.push('note_data = ?');
            values.push(serialized);
        }
        if (!fields.length)
            return { id };
        values.push(id);
        try {
            await this.db.execute(`UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        catch (err) {
            const e = err;
            if (e?.code === 'ER_NET_PACKET_TOO_LARGE' || e?.errno === 1153)
                throw new common_1.BadRequestException('Lesson data is too large for the database.');
            throw err;
        }
        return { id };
    }
    async canvasAdminRemove(id, token, engineKey = 'gemini') {
        await this.requireAdminToken(token);
        await this.db.execute(`UPDATE lessons SET note_data = NULL, raw_text = NULL, is_public = 0 WHERE id = ? AND engine_key = ?`, [id, engineKey]);
        return { deleted: true };
    }
    async canvasAdminListFlashcards(id, token) {
        await this.requireAdminToken(token);
        await this.findCanvasLessonRow(id);
        return this.findFlashcardsForLesson(id);
    }
    async canvasAdminCreateFlashcard(id, payload, token) {
        const admin = await this.requireAdminToken(token);
        const lesson = await this.findCanvasLessonRow(id);
        const clean = this.normalizeFlashcardInput(payload);
        const status = this.normalizeFlashcardStatus(payload.status || 'draft');
        this.assertValidFlashcard(clean.question, clean.answer);
        const sortOrder = await this.getNextFlashcardSortOrder(id);
        const [result] = await this.db.execute(`INSERT INTO lesson_flashcards (note_id, lesson_id, question, answer, source_hint, image_url, image_fit, status, sort_order, generated_by, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`, [id, id, clean.question, clean.answer, clean.sourceHint || null,
            this.serializeFlashcardImageUrls(clean.imageUrls), clean.imageFit, status, sortOrder,
            status === 'approved' ? admin.id : null]);
        if (status === 'approved') {
            this.pushNotificationsService.notifyStudentsOfNewContentDebounced(`flashcards:${id}`, (count) => ({
                title: 'New flashcards to review',
                body: count === 1
                    ? `A new flashcard was added to ${lesson.lesson_title}. Quick reps, long-term memory.`
                    : `${count} new flashcards added to ${lesson.lesson_title}. Quick reps, long-term memory.`,
            }));
        }
        return this.findFlashcardById(result.insertId, id);
    }
    async canvasAdminUpdateFlashcard(id, cardId, patch, token) {
        const admin = await this.requireAdminToken(token);
        const lesson = await this.findCanvasLessonRow(id);
        const existing = await this.findFlashcardById(cardId, id);
        const question = patch.question !== undefined ? this.cleanFlashcardText(patch.question, 1000) : existing.question;
        const answer = patch.answer !== undefined ? this.cleanFlashcardText(patch.answer, 3000) : existing.answer;
        const sourceHint = patch.sourceHint !== undefined ? this.cleanFlashcardText(patch.sourceHint, 500) : existing.sourceHint;
        const imageUrls = patch.imageUrls !== undefined || patch.imageUrl !== undefined
            ? this.cleanFlashcardImageUrls(patch.imageUrls ?? patch.imageUrl) : existing.imageUrls;
        const imageFit = patch.imageFit !== undefined ? this.normalizeFlashcardImageFit(patch.imageFit) : existing.imageFit;
        const status = patch.status !== undefined ? this.normalizeFlashcardStatus(patch.status) : existing.status;
        const sortOrder = Number.isFinite(Number(patch.sortOrder)) ? Number(patch.sortOrder) : existing.sortOrder;
        this.assertValidFlashcard(question, answer);
        await this.db.execute(`UPDATE lesson_flashcards SET question=?, answer=?, source_hint=?, image_url=?, image_fit=?, status=?, sort_order=?, reviewed_by=?
       WHERE id = ? AND lesson_id = ?`, [question, answer, sourceHint || null, this.serializeFlashcardImageUrls(imageUrls), imageFit, status, sortOrder,
            status === 'approved' ? admin.id : existing.reviewedBy || null, cardId, id]);
        if (existing.status !== 'approved' && status === 'approved') {
            this.pushNotificationsService.notifyStudentsOfNewContentDebounced(`flashcards:${id}`, (count) => ({
                title: 'New flashcards to review',
                body: count === 1
                    ? `A new flashcard was added to ${lesson.lesson_title}. Quick reps, long-term memory.`
                    : `${count} new flashcards added to ${lesson.lesson_title}. Quick reps, long-term memory.`,
            }));
        }
        return this.findFlashcardById(cardId, id);
    }
    async canvasAdminRemoveFlashcard(id, cardId, token) {
        await this.requireAdminToken(token);
        await this.findFlashcardById(cardId, id);
        await this.db.execute('DELETE FROM lesson_flashcards WHERE id = ? AND lesson_id = ?', [cardId, id]);
        return { ok: true, id: cardId };
    }
    async canvasAdminGenerateFlashcards(id, options, token) {
        await this.requireAdminToken(token);
        const note = await this.findCanvasLessonRow(id);
        const sourceText = this.extractFlashcardSourceText(note);
        if (sourceText.length < 40)
            throw new common_1.BadRequestException('Add lesson notes before generating flashcards.');
        const count = Math.max(6, Math.min(60, Number(options.count || 24) || 24));
        const provider = await this.resolveActiveCanvasProvider();
        const rawPayload = await this.runFlashcardJsonPrompt(this.buildFlashcardPrompt({ title: note.lesson_title || 'Lesson', course: note.course_title || '', subject: note.topic_name || '', topic: note.subtopic_name || '', sourceText, count }), provider);
        const generated = this.normalizeGeneratedFlashcards(rawPayload).slice(0, count);
        if (!generated.length)
            throw new common_1.ServiceUnavailableException(`${provider.providerLabel} did not return usable Q&A flashcards.`);
        const existingRows = await this.findFlashcardRowsForLesson(id);
        const seen = new Set(existingRows.map(r => this.flashcardSignature(r.question, r.answer)));
        const fresh = generated.filter(item => {
            const sig = this.flashcardSignature(item.question, item.answer);
            if (!sig || seen.has(sig))
                return false;
            seen.add(sig);
            return true;
        });
        if (fresh.length > 0)
            await this.insertGeneratedFlashcards(id, fresh);
        return { ok: true, createdCount: fresh.length, provider: { key: provider.providerKey, label: provider.providerLabel, model: provider.model }, items: await this.findFlashcardsForLesson(id) };
    }
    async canvasGenerate(text, token, onProgress) {
        await this.requireAdminToken(token);
        const trimmed = String(text || '').trim();
        if (trimmed.length < 10)
            throw new common_1.BadRequestException('Text must be at least 10 characters');
        onProgress?.('provider', 'Connecting to your AI provider…');
        const provider = await this.resolveActiveCanvasProvider();
        const deadline = Date.now() + 6 * 60 * 1000;
        const CHUNK_LIMIT = 9000;
        let canvas;
        if (trimmed.length <= CHUNK_LIMIT) {
            onProgress?.('generate', `Writing your lesson with ${provider.providerLabel}…`);
            canvas = await this.generateChunkResilient(trimmed, provider, 0, onProgress, deadline);
        }
        else {
            const chunks = this.splitSourceIntoChunks(trimmed, CHUNK_LIMIT);
            const canvases = [];
            for (let i = 0; i < chunks.length; i += 1) {
                if (Date.now() > deadline) {
                    throw new common_1.ServiceUnavailableException(`Generation is taking too long (source is very long — ${chunks.length} parts). Try a shorter paste, or generate it in smaller sections.`);
                }
                onProgress?.('generate', `Writing part ${i + 1} of ${chunks.length}…`);
                canvases.push(await this.generateChunkResilient(chunks[i], provider, 0, onProgress, deadline));
            }
            canvas = this.mergeCanvases(canvases);
        }
        onProgress?.('completeness', 'Checking your source for anything the lesson missed…');
        const completed = await this.ensureCompleteness(trimmed, canvas, provider);
        onProgress?.('finalize', 'Grouping each topic into one card and numbering…');
        const finalCanvas = this.renumberSections(this.groupSectionFamilies(completed));
        onProgress?.('done', 'Lesson ready!');
        return finalCanvas;
    }
    async generateChunkResilient(chunkText, provider, depth = 0, onProgress, deadline = Infinity) {
        try {
            return await this.generateWithProvider(this.buildPrompt(chunkText), provider);
        }
        catch (err) {
            if (!(err instanceof LessonJsonTruncatedError)
                || depth >= 2
                || chunkText.length < 800
                || Date.now() > deadline)
                throw err;
            const half = Math.ceil(chunkText.length / 2);
            const pieces = this.splitSourceIntoChunks(chunkText, half);
            if (pieces.length < 2)
                throw err;
            onProgress?.('split', 'That part was too dense for one pass — splitting it into smaller pieces so nothing gets cut off…');
            const results = [];
            for (let i = 0; i < pieces.length; i += 1) {
                if (Date.now() > deadline)
                    throw err;
                onProgress?.('split', `Writing piece ${i + 1} of ${pieces.length}…`);
                results.push(await this.generateChunkResilient(pieces[i], provider, depth + 1, onProgress, deadline));
            }
            return this.mergeCanvases(results);
        }
    }
    async startCanvasGenerate(text, token) {
        await this.requireAdminToken(token);
        const trimmed = String(text || '').trim();
        if (trimmed.length < 10)
            throw new common_1.BadRequestException('Text must be at least 10 characters');
        await this.pruneOldGenerationJobs();
        const jobId = (0, crypto_1.randomUUID)();
        await this.db.execute(`INSERT INTO lesson_generation_jobs (id, status, stages_json) VALUES (?, 'running', '[]')`, [jobId]);
        const stages = [];
        void this.canvasGenerate(text, token, (stage, message) => {
            stages.push({ stage, message, at: Date.now() });
            this.db.execute(`UPDATE lesson_generation_jobs SET stages_json = ? WHERE id = ?`, [JSON.stringify(stages), jobId]).catch(() => { });
        })
            .then((result) => this.db.execute(`UPDATE lesson_generation_jobs SET status = 'done', result_json = ? WHERE id = ?`, [JSON.stringify(result), jobId]))
            .catch((err) => this.db.execute(`UPDATE lesson_generation_jobs SET status = 'error', error_text = ? WHERE id = ?`, [err instanceof Error ? err.message : String(err), jobId]).catch(() => { }));
        return { jobId };
    }
    async getCanvasGenerateJob(jobId, token) {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute(`SELECT status, stages_json, result_json, error_text, UNIX_TIMESTAMP(created_at) * 1000 AS created_at
       FROM lesson_generation_jobs WHERE id = ? LIMIT 1`, [jobId]);
        const row = rows[0];
        if (!row)
            throw new common_1.NotFoundException('Generation job not found — it may have expired.');
        return {
            status: row.status,
            stages: JSON.parse(row.stages_json || '[]'),
            result: row.result_json ? JSON.parse(row.result_json) : undefined,
            error: row.error_text || undefined,
            createdAt: Number(row.created_at),
        };
    }
    async pruneOldGenerationJobs() {
        await this.db.execute(`DELETE FROM lesson_generation_jobs WHERE created_at < (NOW() - INTERVAL 30 MINUTE)`);
    }
    splitSourceIntoChunks(text, limit) {
        const paras = text.split(/\n\s*\n/);
        const chunks = [];
        let cur = '';
        for (const p of paras) {
            if (cur && cur.length + p.length + 2 > limit) {
                chunks.push(cur);
                cur = '';
            }
            cur = cur ? `${cur}\n\n${p}` : p;
            while (cur.length > limit * 1.5) {
                chunks.push(cur.slice(0, limit));
                cur = cur.slice(limit);
            }
        }
        if (cur.trim())
            chunks.push(cur);
        return chunks.length ? chunks : [text];
    }
    stripHeadingNumber(heading) {
        return String(heading || '').replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/, '').trim();
    }
    normalizeTopicKey(heading) {
        return this.stripHeadingNumber(heading).toLowerCase().replace(/[:\s]+$/, '').trim();
    }
    topicFamily(heading) {
        const h = this.normalizeTopicKey(heading);
        if (!h)
            return null;
        return LessonsService_1.TOPIC_FAMILIES.find((f) => f.test.test(h)) || null;
    }
    reorderByCanonicalTopic(keys) {
        const known = keys.map((k) => {
            const idx = LessonsService_1.TOPIC_ORDER.indexOf(k);
            return idx === -1 ? null : idx;
        });
        const rank = new Array(keys.length);
        for (let i = 0; i < keys.length; i += 1) {
            if (known[i] !== null) {
                rank[i] = known[i];
                continue;
            }
            let leftRank = null, leftDist = 0;
            for (let j = i - 1; j >= 0; j -= 1) {
                if (known[j] !== null) {
                    leftRank = known[j];
                    leftDist = i - j;
                    break;
                }
            }
            let rightRank = null, rightDist = 0;
            for (let j = i + 1; j < keys.length; j += 1) {
                if (known[j] !== null) {
                    rightRank = known[j];
                    rightDist = j - i;
                    break;
                }
            }
            if (leftRank !== null && rightRank !== null) {
                rank[i] = leftRank + (rightRank - leftRank) * (leftDist / (leftDist + rightDist));
            }
            else if (leftRank !== null) {
                rank[i] = leftRank + 0.5;
            }
            else if (rightRank !== null) {
                rank[i] = rightRank - 0.5;
            }
            else {
                rank[i] = 1000 + i;
            }
        }
        return keys
            .map((key, i) => ({ key, i, rank: rank[i] }))
            .sort((a, b) => a.rank - b.rank || a.i - b.i)
            .map((x) => x.key);
    }
    isAsideHeading(heading) {
        const h = this.normalizeTopicKey(heading);
        if (!h)
            return false;
        return LessonsService_1.ASIDE_PATTERNS.some((re) => re.test(h));
    }
    mergeAsideFields(target, aside) {
        const append = (...items) => { target.bullets = [...(target.bullets || []), ...items.filter(Boolean)]; };
        if (aside.callout) {
            if (target.callout)
                append(aside.callout);
            else
                target.callout = aside.callout;
        }
        if (aside.sticky_note) {
            if (target.sticky_note)
                append(aside.sticky_note);
            else
                target.sticky_note = aside.sticky_note;
        }
        if (aside.mnemonic) {
            if (target.mnemonic)
                append(`**Mnemonic**: ${aside.mnemonic}`);
            else
                target.mnemonic = aside.mnemonic;
        }
    }
    foldAsideInto(target, aside) {
        const bullets = (aside.bullets || []).filter(Boolean);
        if (!target.callout && bullets.length === 1)
            target.callout = bullets[0];
        else if (bullets.length)
            target.bullets = [...(target.bullets || []), '**Note**:', ...bullets];
        this.mergeAsideFields(target, aside);
    }
    renumberSections(canvas) {
        let n = 1;
        for (const page of canvas.pages) {
            for (const section of page.sections) {
                if (section.type === 'image' || section.type === 'note' || !section.heading)
                    continue;
                section.heading = `${n}. ${this.stripHeadingNumber(section.heading)}`;
                n += 1;
            }
        }
        return canvas;
    }
    groupSectionFamilies(canvas) {
        const flat = canvas.pages.flatMap((p) => p.sections);
        const out = [];
        const anchorByFamily = new Map();
        const labelledFamilies = new Set();
        const append = (target, ...items) => {
            target.bullets = [...(target.bullets || []), ...items.filter(Boolean)];
        };
        let pendingAside = null;
        for (const section of flat) {
            const heading = this.stripHeadingNumber(section.heading || '');
            const isText = !section.type || section.type === 'text';
            if (isText && heading && this.isAsideHeading(heading)) {
                if (out.length) {
                    this.foldAsideInto(out[out.length - 1], section);
                }
                else if (pendingAside) {
                    this.foldAsideInto(pendingAside, section);
                }
                else {
                    pendingAside = { ...section, heading: '' };
                }
                continue;
            }
            const family = this.topicFamily(heading);
            const familyKey = heading ? (family?.key || this.normalizeTopicKey(heading)) : '';
            const anchorIndex = isText && familyKey ? anchorByFamily.get(familyKey) : undefined;
            if (anchorIndex !== undefined) {
                const target = out[anchorIndex];
                const sameLabel = this.normalizeTopicKey(target.heading) === this.normalizeTopicKey(heading);
                if (!sameLabel && !labelledFamilies.has(familyKey)) {
                    target.bullets = [`**${target.heading}**:`, ...(target.bullets || [])];
                    target.heading = family?.title || target.heading;
                    target.span = 'full';
                    labelledFamilies.add(familyKey);
                }
                if (!sameLabel)
                    append(target, `**${heading}**:`);
                append(target, ...(section.bullets || []));
                if (section.embedded_flow?.length && !target.embedded_flow) {
                    target.embedded_flow = section.embedded_flow;
                    if (section.embedded_label)
                        target.embedded_label = section.embedded_label;
                }
                if (section.embedded_table?.headers?.length && !target.embedded_table) {
                    target.embedded_table = section.embedded_table;
                    if (!target.embedded_flow && section.embedded_label)
                        target.embedded_label = section.embedded_label;
                }
                this.mergeAsideFields(target, section);
                continue;
            }
            const clone = { ...section, heading };
            if (!isText && section.type !== 'note' && familyKey && anchorByFamily.has(familyKey) && family) {
                clone.heading = family.title;
            }
            if (pendingAside && out.length === 0) {
                this.foldAsideInto(clone, pendingAside);
                pendingAside = null;
            }
            out.push(clone);
            if (isText && familyKey)
                anchorByFamily.set(familyKey, out.length - 1);
        }
        if (pendingAside)
            out.push({ ...pendingAside, heading: this.stripHeadingNumber(pendingAside.heading || '') || 'Notes' });
        const isImage = (s) => s.type === 'image' || s.type === 'image-explained';
        const isNote = (s) => s.type === 'note';
        const indexOf = new Map();
        out.forEach((s, i) => indexOf.set(s, i));
        const imagesAfter = new Map();
        const noteSections = [];
        const reorderable = [];
        let lastCardIndex = -1;
        for (const section of out) {
            if (isImage(section)) {
                const bucket = imagesAfter.get(lastCardIndex) || [];
                bucket.push(section);
                imagesAfter.set(lastCardIndex, bucket);
            }
            else if (isNote(section)) {
                noteSections.push(section);
            }
            else {
                reorderable.push(section);
                lastCardIndex = indexOf.get(section);
            }
        }
        const notesAfter = new Map();
        for (const note of noteSections) {
            const noteHeading = this.stripHeadingNumber(note.heading || '');
            const anchorTopicNorm = this.normalizeTopicKey(String(note.anchor_topic || ''));
            let anchor = anchorTopicNorm
                ? reorderable.find((s) => this.normalizeTopicKey(this.stripHeadingNumber(s.heading || '')) === anchorTopicNorm)
                : undefined;
            if (!anchor && anchorTopicNorm) {
                const anchorFamily = this.topicFamily(String(note.anchor_topic || ''));
                if (anchorFamily)
                    anchor = reorderable.find((s) => this.topicFamily(this.stripHeadingNumber(s.heading || ''))?.key === anchorFamily.key);
            }
            if (!anchor && noteHeading) {
                const ownFamily = this.topicFamily(noteHeading);
                if (ownFamily)
                    anchor = reorderable.find((s) => this.topicFamily(this.stripHeadingNumber(s.heading || ''))?.key === ownFamily.key);
            }
            const anchorIdx = anchor ? indexOf.get(anchor) : (reorderable.length ? indexOf.get(reorderable[reorderable.length - 1]) : -1);
            const bucket = notesAfter.get(anchorIdx) || [];
            bucket.push({ ...note, heading: noteHeading });
            notesAfter.set(anchorIdx, bucket);
        }
        const order = [];
        const buckets = new Map();
        for (const section of reorderable) {
            const heading = this.stripHeadingNumber(section.heading || '');
            const key = heading ? (this.topicFamily(heading)?.key || `__solo_${indexOf.get(section)}`) : `__solo_${indexOf.get(section)}`;
            if (!buckets.has(key)) {
                buckets.set(key, []);
                order.push(key);
            }
            buckets.get(key).push(section);
        }
        const canonicalOrder = this.reorderByCanonicalTopic(order);
        const grouped = [...(imagesAfter.get(-1) || []), ...(notesAfter.get(-1) || [])];
        for (const key of canonicalOrder) {
            for (const section of buckets.get(key)) {
                grouped.push(section);
                grouped.push(...(imagesAfter.get(indexOf.get(section)) || []));
                grouped.push(...(notesAfter.get(indexOf.get(section)) || []));
            }
        }
        const first = canvas.pages[0];
        return this.splitIntoPages({
            title: first?.title || 'Lesson',
            subtitle: first?.subtitle || '',
            sections: grouped,
            summary_box: canvas.pages.map((p) => p.summary_box).filter(Boolean).pop() || '',
            key_points: Array.from(new Set(canvas.pages.flatMap((p) => p.key_points || []))),
            visual_style: canvas.pages.find((p) => p.visual_style)?.visual_style,
        });
    }
    mergeCanvases(canvases) {
        const mergedSections = [];
        const sectionIndexByTopic = new Map();
        const allKeyPoints = [];
        let title = '';
        let subtitle = '';
        let summary = '';
        let visual;
        for (const c of canvases) {
            for (const page of c.pages) {
                if (!title && page.title)
                    title = page.title;
                if (!subtitle && page.subtitle)
                    subtitle = page.subtitle;
                if (page.summary_box)
                    summary = page.summary_box;
                if (page.visual_style && !visual)
                    visual = page.visual_style;
                allKeyPoints.push(...page.key_points);
                for (const section of page.sections) {
                    const isTextSection = !section.type || section.type === 'text';
                    const topicKey = isTextSection && section.heading ? this.normalizeTopicKey(section.heading) : '';
                    const existingIndex = topicKey ? sectionIndexByTopic.get(topicKey) : undefined;
                    if (existingIndex !== undefined) {
                        const target = mergedSections[existingIndex];
                        target.bullets = [...(target.bullets || []), ...(section.bullets || [])];
                        if (!target.callout && section.callout)
                            target.callout = section.callout;
                        if (!target.sticky_note && section.sticky_note)
                            target.sticky_note = section.sticky_note;
                        if (!target.mnemonic && section.mnemonic)
                            target.mnemonic = section.mnemonic;
                        if (section.embedded_flow?.length && !target.embedded_flow) {
                            target.embedded_flow = section.embedded_flow;
                            if (section.embedded_label)
                                target.embedded_label = section.embedded_label;
                        }
                        if (section.embedded_table?.headers?.length && !target.embedded_table) {
                            target.embedded_table = section.embedded_table;
                            if (!target.embedded_flow && section.embedded_label)
                                target.embedded_label = section.embedded_label;
                        }
                        continue;
                    }
                    const clone = { ...section, heading: this.stripHeadingNumber(section.heading || '') };
                    mergedSections.push(clone);
                    if (topicKey)
                        sectionIndexByTopic.set(topicKey, mergedSections.length - 1);
                }
            }
        }
        const merged = {
            title: title || 'Lesson', subtitle, sections: mergedSections,
            summary_box: summary, key_points: Array.from(new Set(allKeyPoints)), visual_style: visual,
        };
        return this.splitIntoPages(merged);
    }
    async ensureCompleteness(sourceText, canvas, provider) {
        try {
            const covered = canvas.pages.flatMap((p) => p.sections).map((s) => {
                if (s.type === 'table')
                    return `${s.heading}: ${(s.headers || []).join(' | ')} ${(s.rows || []).map((r) => r.join(' | ')).join(' ; ')}`;
                if (s.type === 'flow')
                    return `${s.heading}: ${(s.steps || []).join(' → ')}`;
                return `${s.heading}: ${(s.bullets || []).join(' ')} ${s.callout} ${s.sticky_note} ${s.mnemonic}`;
            }).join('\n').slice(0, 14000);
            const missing = await this.generateWithProvider(this.buildCompletenessPrompt(sourceText, covered), provider);
            const missingSections = missing.pages.flatMap((p) => p.sections);
            if (!missingSections.length)
                return canvas;
            return this.mergeCanvases([canvas, missing]);
        }
        catch {
            return canvas;
        }
    }
    buildCompletenessPrompt(sourceText, coveredText) {
        return [
            'You are auditing a study lesson for completeness against its SOURCE notes.',
            'Compare the SOURCE to what is ALREADY COVERED, and return ONLY the facts, details, examples or points from the SOURCE that are MISSING — formatted as new sections in the SAME JSON shape.',
            'Do NOT repeat anything already covered, under ANY heading. Before adding anything, check the WHOLE of ALREADY COVERED (every heading, not just the one you think it belongs under) — a mechanism, drug, or fact that already appears anywhere (e.g. under its own "Mechanism of action"/"Pathophysiology" card) must NOT be added again under "Management" or any other heading, even reworded. If it is already there in substance, skip it.',
            'Use the same style: short crisp bullets, "→ " sub-bullets for lists, tables for comparisons, flow for cause→effect.',
            'Highlighting is not optional: wrap every diagnosis, key term, mechanism word, and cut-off in ==highlights==, and every drug/dose/lab value in **bold** — including inside table cells, not just bullets. Be generous, not sparing.',
            'Headings: do NOT put any number on them (no "1.", no "1.1" — the app numbers cards itself).',
            '',
            '━━━ IF THE MISSING CONTENT BELONGS TO A TOPIC ALREADY COVERED LISTS (e.g. Investigations, Management, Pathophysiology) ━━━',
            '- Reuse that EXACT topic word as the heading, with the missing points as bullets, so it gets grouped into that same card.',
            '- If the missing content is a cause→effect chain or a comparison that genuinely doesn\'t exist ANYWHERE yet and can\'t be bullets, put it INSIDE that same section object as "embedded_flow" (an array of full-sentence steps) or "embedded_table" ({"headers":[...],"rows":[[...]]}), alongside "bullets" (which may be empty) — do NOT create a separate "flow"/"table" section for it. ALSO include "embedded_label": a short SPECIFIC label naming exactly what it is (e.g. "Ramipril mechanism", "Drug dose comparison") — never the bare generic word "Mechanism" or "Comparison", since the reader needs to know which one at a glance. Shape: {"heading":"<exact existing topic>","bullets":[],"embedded_flow":["step 1 as a full sentence","step 2","result"],"embedded_label":"<specific label>"}',
            '- Only ONE embedded_flow OR embedded_table per section — if you already added one for this heading, do not add a second; fold any further point into "bullets" as plain text instead.',
            '',
            '━━━ IF THE MISSING CONTENT DOES NOT FIT ANY TOPIC ALREADY COVERED LISTS ━━━',
            '- Return it as {"type":"note","heading":"short label","bullets":["..."],"anchor_topic":"<the EXACT heading text, from ALREADY COVERED, of whichever existing topic this is most closely related to>"}.',
            '- Pick anchor_topic by real clinical relevance, not just keyword overlap — e.g. a specific drug\'s mechanism that isn\'t itself "Pathophysiology" of the disease should anchor to "Management" (since that\'s the topic that uses the drug), not be left unanchored.',
            '- This never gets its own card number — it is a small floating note placed beside its anchor topic.',
            '',
            '━━━ TABLES MUST BE REAL TABLES ━━━',
            '- A comparison (drug classes, staging, differentials, anything with rows/columns) must use "type":"table" (standalone) or "embedded_table" (sub-part) with real "headers"/"rows" arrays — {"headers":["Col1","Col2"],"rows":[["a","b"],["c","d"]]}. NEVER write a table out as prose or bullets ("Type: X, Location: Y, Relevance: Z" as one long bullet) — that is a formatting failure. Keep every column and every row from the source.',
            '- A numbered/lettered classification or staging scheme (Type 0, 1, 2…, Stage I/II/III) is ALWAYS a table, one row per type/stage — never a bullet listing several types crammed into one line.',
            '',
            'If nothing is missing, return exactly: {"title":"","subtitle":"","sections":[],"summary_box":"","key_points":[]}',
            '',
            'ALREADY COVERED:',
            coveredText,
            '',
            'SOURCE (find anything here that is not covered above):',
            sourceText.slice(0, 40000),
            '',
            'Return ONLY this JSON: {"title":"","subtitle":"","sections":[{"heading":"...","bullets":["..."]},{"heading":"Management","bullets":[],"embedded_flow":["step 1","step 2"],"embedded_label":"specific label"},{"type":"note","heading":"...","bullets":["..."],"anchor_topic":"Management"}],"summary_box":"","key_points":[]}',
        ].join('\n');
    }
    async canvasStudentList(token, engineKey = 'gemini', appClient) {
        const student = await this.requireStudentToken(token);
        const accessProfile = await this.getCanvasAccessProfile(student.id, appClient);
        const [rows] = await this.db.execute(`
      SELECT ${this.canvasLessonSelect(false)},
             slp.status AS lesson_progress_status, slp.progress_percent AS lesson_progress_percent, slp.completed_at AS lesson_completed_at,
             (SELECT COUNT(*) FROM lesson_flashcards lf WHERE lf.lesson_id = l.id AND lf.status = 'approved') AS approved_flashcard_count
      FROM lessons l
      LEFT JOIN student_lesson_progress slp ON slp.lesson_id = l.id AND slp.user_id = ?
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.is_public = 1 AND (l.note_data IS NOT NULL OR l.pdf_url IS NOT NULL) AND l.status = 'active' AND l.engine_key = ?
      ORDER BY c.course_title ASC, t.sort_order ASC, s.sort_order ASC, l.sort_order ASC, l.id ASC`, [student.id, engineKey]);
        return rows.map(row => this.mapCanvasStudentNote(row, accessProfile, false));
    }
    async canvasStudentFindNote(id, token, engineKey = 'gemini', appClient) {
        const student = await this.requireStudentToken(token);
        const accessProfile = await this.getCanvasAccessProfile(student.id, appClient);
        const [rows] = await this.db.execute(`
      SELECT ${this.canvasLessonSelect(true)},
             slp.status AS lesson_progress_status, slp.progress_percent AS lesson_progress_percent, slp.completed_at AS lesson_completed_at,
             (SELECT COUNT(*) FROM lesson_flashcards lf WHERE lf.lesson_id = l.id AND lf.status = 'approved') AS approved_flashcard_count
      FROM lessons l
      LEFT JOIN student_lesson_progress slp ON slp.lesson_id = l.id AND slp.user_id = ?
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.id = ? AND l.is_public = 1 AND l.status = 'active' AND l.engine_key = ?`, [student.id, id, engineKey]);
        if (!rows.length) {
            const [lr] = await this.db.execute(`SELECT id, lesson_title, pdf_url, is_free, status, course_id FROM lessons WHERE id = ? LIMIT 1`, [id]);
            const lesson = lr[0];
            if (lesson && lesson.pdf_url && lesson.status === 'active') {
                const canAccess = this.canAccessCanvasLesson({ courseId: lesson.course_id, isFree: lesson.is_free, id: lesson.id }, accessProfile);
                const appOnly = !canAccess && Number(lesson.is_free) !== 1 && accessProfile.appOnlyBlocked;
                return {
                    lessonType: 'pdf', lessonId: id, lessonTitle: lesson.lesson_title || '',
                    pdfUrl: canAccess ? String(lesson.pdf_url) : '',
                    accessLocked: !canAccess,
                    appOnly,
                    lockReason: canAccess ? '' : appOnly ? 'This lesson is only available in the Xyndrome mobile app.' : 'Your subscription does not include this premium lesson.',
                };
            }
            throw new common_1.NotFoundException('Lesson not found');
        }
        return this.mapCanvasStudentNote(rows[0], accessProfile, true);
    }
    async canvasStudentFlashcards(id, token, engineKey = 'gemini', appClient) {
        const student = await this.requireStudentToken(token);
        const accessProfile = await this.getCanvasAccessProfile(student.id, appClient);
        const [rows] = await this.db.execute(`SELECT l.id, l.course_id, l.is_free, l.engine_key, l.status, l.is_public
       FROM lessons l WHERE l.id = ? AND l.is_public = 1 AND l.status = 'active' AND l.engine_key = ?`, [id, engineKey]);
        if (!rows.length)
            throw new common_1.NotFoundException('Lesson not found');
        const canAccess = this.canAccessCanvasLesson({ courseId: rows[0].course_id, isFree: rows[0].is_free, id: rows[0].id }, accessProfile);
        return { flashcards: canAccess ? await this.findApprovedFlashcardsForLesson(id) : [] };
    }
    async getCourses(token) {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute("SELECT id, course_title AS name FROM courses WHERE status = 'active' ORDER BY course_title ASC");
        return rows;
    }
    async getTopics(courseId, token) {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute(courseId ? "SELECT id, topic_name AS name FROM topics WHERE course_id = ? AND status = 'active' ORDER BY sort_order ASC, id ASC"
            : "SELECT id, topic_name AS name FROM topics WHERE status = 'active' ORDER BY sort_order ASC, id ASC", courseId ? [courseId] : []);
        return rows;
    }
    async getSubtopics(topicId, token) {
        await this.requireAdminToken(token);
        const [rows] = await this.db.execute(topicId ? "SELECT id, subtopic_name AS name FROM subtopics WHERE topic_id = ? AND status = 'active' ORDER BY sort_order ASC, id ASC"
            : "SELECT id, subtopic_name AS name FROM subtopics WHERE status = 'active' ORDER BY sort_order ASC, id ASC", topicId ? [topicId] : []);
        return rows;
    }
    async ensureDefaultLessonHierarchy(courseId) {
        const [tr] = await this.db.execute(`SELECT id FROM topics WHERE course_id = ? AND topic_name = 'General lessons' LIMIT 1`, [courseId]);
        let topicId = tr[0]?.id ? Number(tr[0].id) : 0;
        if (!topicId) {
            const [r] = await this.db.execute(`INSERT INTO topics (course_id, topic_name, topic_description, status) VALUES (?, 'General lessons', 'Auto-created bucket for course-level lessons.', 'active')`, [courseId]);
            topicId = r.insertId;
        }
        return { topicId };
    }
    async findCanvasLessonRow(id) {
        const [rows] = await this.db.execute(`
      SELECT l.*, c.course_title, t.topic_name, s.subtopic_name
      FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE l.id = ? AND l.is_public = 1 LIMIT 1`, [id]);
        if (!rows[0])
            throw new common_1.NotFoundException('Lesson not found');
        return rows[0];
    }
    async findFlashcardRowsForLesson(lessonId) {
        const [rows] = await this.db.execute(`SELECT id, lesson_id, question, answer, source_hint, image_url, image_fit, status, sort_order, generated_by, reviewed_by, created_at, updated_at
       FROM lesson_flashcards WHERE lesson_id = ? ORDER BY status='approved' DESC, sort_order ASC, id ASC`, [lessonId]);
        return rows;
    }
    async findFlashcardsForLesson(lessonId) {
        return (await this.findFlashcardRowsForLesson(lessonId)).map(r => this.mapFlashcard(r));
    }
    async findApprovedFlashcardsForLesson(lessonId) {
        const [rows] = await this.db.execute(`SELECT id, lesson_id, question, answer, source_hint, NULL AS image_url, 'contain' AS image_fit, status, sort_order, generated_by, reviewed_by, created_at, updated_at
       FROM lesson_flashcards WHERE lesson_id = ? AND status = 'approved' ORDER BY sort_order ASC, id ASC`, [lessonId]);
        return rows.map(r => this.mapFlashcard(r));
    }
    async findFlashcardById(cardId, lessonId) {
        const [rows] = await this.db.execute(`SELECT id, lesson_id, question, answer, source_hint, image_url, image_fit, status, sort_order, generated_by, reviewed_by, created_at, updated_at
       FROM lesson_flashcards WHERE id = ? AND lesson_id = ? LIMIT 1`, [cardId, lessonId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Flashcard not found');
        return this.mapFlashcard(rows[0]);
    }
    async getNextFlashcardSortOrder(lessonId) {
        const [rows] = await this.db.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM lesson_flashcards WHERE lesson_id = ?', [lessonId]);
        return Number(rows[0]?.next_order || 1);
    }
    async insertGeneratedFlashcards(lessonId, rows) {
        let sortOrder = await this.getNextFlashcardSortOrder(lessonId);
        for (const row of rows) {
            await this.db.execute(`INSERT INTO lesson_flashcards (note_id, lesson_id, question, answer, source_hint, status, sort_order, generated_by) VALUES (?, ?, ?, ?, ?, 'draft', ?, 'ai')`, [lessonId, lessonId, row.question, row.answer, row.sourceHint || null, sortOrder]);
            sortOrder += 1;
        }
    }
    mapFlashcard(row) {
        const imageUrls = this.parseFlashcardImageUrls(row.image_url);
        return {
            id: row.id, lessonId: row.lesson_id, noteId: row.lesson_id,
            question: row.question, answer: row.answer, sourceHint: row.source_hint || '',
            imageUrl: imageUrls[0] || '', imageUrls,
            imageFit: this.normalizeFlashcardImageFit(row.image_fit || 'contain'),
            status: row.status, sortOrder: Number(row.sort_order || 0),
            generatedBy: row.generated_by || 'ai', reviewedBy: row.reviewed_by ?? null,
            createdAt: row.created_at, updatedAt: row.updated_at,
        };
    }
    deserializeCanvas(row) {
        let noteData = null;
        try {
            noteData = row.note_data ? JSON.parse(row.note_data) : null;
        }
        catch {
            noteData = null;
        }
        return {
            id: row.id, title: row.lesson_title, lessonTitle: row.lesson_title,
            rawText: row.raw_text, noteData, engineKey: row.engine_key || 'gemini',
            courseId: row.course_id ?? null, topicId: row.topic_id ?? null, subtopicId: row.subtopic_id ?? null,
            sortOrder: Number(row.sort_order ?? 0),
            lessonId: row.id, videoUrl: row.video_url || '', pdfUrl: row.pdf_url || '',
            isFree: Number(row.is_free) === 1,
            status: row.status ?? 'active', isPublic: Number(row.is_public) === 1,
            courseTitle: row.course_title ?? null, examType: row.exam_type ?? null,
            topicName: row.topic_name ?? null, subtopicName: row.subtopic_name ?? null,
            lessonPdfUrl: row.pdf_url || '',
            lessonProgressStatus: row.lesson_progress_status || 'not_started',
            lessonProgressPercent: Number(row.lesson_progress_percent || 0),
            lessonCompletedAt: row.lesson_completed_at || null,
            lessonCompleted: row.lesson_progress_status === 'completed',
            approvedFlashcardCount: Math.max(0, Number(row.approved_flashcard_count || 0)),
            createdAt: row.created_at, updatedAt: row.updated_at,
        };
    }
    mapCanvasStudentNote(row, accessProfile, includeNoteData) {
        const note = this.deserializeCanvas(row);
        const canAccess = this.canAccessCanvasLesson({ courseId: row.course_id, isFree: row.is_free, id: row.id }, accessProfile);
        const appOnly = !canAccess && !note.isFree && accessProfile.appOnlyBlocked;
        const hasStudyMode = accessProfile.hasAnyPaidLessonAccess || note.isFree;
        return {
            ...note,
            cardCount: note.approvedFlashcardCount,
            canAccess, accessLocked: !canAccess,
            appOnly,
            upgradeLabel: appOnly ? 'Open in the app' : hasStudyMode ? 'Not included in your course package' : 'Available in Standard plan',
            lockReason: !canAccess
                ? (appOnly ? 'This lesson is only available in the Xyndrome mobile app.' : hasStudyMode ? 'Your package only unlocks selected course or lesson content.' : 'Upgrade to access this feature')
                : '',
            noteData: includeNoteData && canAccess ? note.noteData : null,
        };
    }
    async getCanvasAccessProfile(userId, appClient) {
        const [rows] = await this.db.execute(`SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
       FROM user_subscriptions us INNER JOIN plans ON plans.id = us.plan_id
       WHERE us.user_id = ? AND us.status = 'active' AND us.start_date <= CURDATE() AND us.end_date >= CURDATE()`, [userId]);
        const appOnlyBlocked = this.isAppOnlyBlocked(appClient);
        const profile = { hasAnyPaidLessonAccess: rows.length > 0, hasNotesCanvas: rows.length > 0, hasFullAccess: false, courseIds: new Set(), lessonIds: new Set(), appOnlyBlocked };
        for (const row of rows) {
            const courseIds = this.parseIdList(row.course_ids_json);
            const lessonIds = this.parseIdList(row.lesson_ids_json);
            const scope = this.resolveEffectiveAccessScope(row, courseIds, lessonIds);
            if (scope === 'all' && !courseIds.length && !lessonIds.length) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach(id => profile.courseIds.add(id));
            }
            else if (scope === 'lessons') {
                lessonIds.forEach(id => profile.lessonIds.add(id));
            }
        }
        return profile;
    }
    canAccessCanvasLesson(lesson, profile) {
        if (Number(lesson.isFree) === 1)
            return true;
        if (profile.appOnlyBlocked)
            return false;
        if (!profile.hasAnyPaidLessonAccess)
            return false;
        if (profile.hasFullAccess)
            return true;
        if (lesson.courseId && profile.courseIds.has(Number(lesson.courseId)))
            return true;
        if (profile.lessonIds.has(Number(lesson.id)))
            return true;
        return false;
    }
    async resolveActiveCanvasProvider() {
        let rows;
        try {
            [rows] = await this.db.execute(`SELECT provider_key, provider_label, api_key_encrypted, base_url, model FROM ai_provider_configs WHERE status = 'active' AND api_key_encrypted IS NOT NULL AND api_key_encrypted <> '' ORDER BY is_active DESC, updated_at DESC, id DESC LIMIT 1`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new common_1.ServiceUnavailableException(`Could not look up the AI provider configuration: ${message}`);
        }
        const row = rows[0];
        if (row) {
            const rawKey = String(row.provider_key || '').trim().toLowerCase();
            if (!(0, ai_provider_utils_1.isAiProviderKey)(rawKey))
                throw new common_1.ServiceUnavailableException('The active AI provider is invalid.');
            return { providerKey: rawKey, providerLabel: String(row.provider_label || '').trim() || ai_provider_utils_1.AI_PROVIDER_LABELS[rawKey], apiKey: this.safeDecryptSecret(String(row.api_key_encrypted || '')), model: String(row.model || '').trim() || (0, ai_provider_utils_1.getDefaultModelForProvider)(rawKey), baseUrl: (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(rawKey, row.base_url) };
        }
        const envKey = String(this.config.get('OPENROUTER_API_KEY') || '').trim();
        if (envKey)
            return { providerKey: 'openrouter', providerLabel: 'OpenRouter (.env fallback)', apiKey: envKey, model: String(this.config.get('OPENROUTER_MODEL') || (0, ai_provider_utils_1.getDefaultModelForProvider)('openrouter')).trim(), baseUrl: (0, ai_provider_utils_1.getDefaultBaseUrlForProvider)('openrouter') };
        throw new common_1.ServiceUnavailableException('No active AI provider configured. Go to Admin \u2192 Settings \u2192 AI.');
    }
    safeDecryptSecret(value) {
        try {
            const key = String(this.config.get('SETTINGS_ENCRYPTION_KEY') || '').trim() || 'lms-dev-settings-key-change-me';
            return (0, ai_provider_utils_1.decryptSecret)(value, key);
        }
        catch {
            return '';
        }
    }
    async generateWithProvider(prompt, provider) {
        if (!provider.apiKey)
            throw new common_1.ServiceUnavailableException(`No API key for ${provider.providerLabel}.`);
        if (provider.providerKey === 'gemini')
            return this.generateWithGeminiProvider(prompt, provider);
        return this.generateWithChatProvider(prompt, provider);
    }
    parseCanvasJson(raw) {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch (err) {
            throw new LessonJsonTruncatedError(err instanceof Error ? err.message : String(err));
        }
        return this.splitIntoPages(this.validate(parsed));
    }
    async generateWithGeminiProvider(prompt, provider) {
        const modelCandidates = Array.from(new Set([...GEMINI_MODELS, String(provider.model || (0, ai_provider_utils_1.getDefaultModelForProvider)('gemini')).trim()].filter(Boolean)));
        const errors = [];
        let sawTruncation = false;
        for (const model of modelCandidates) {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
            try {
                const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16384 }, contents: [{ parts: [{ text: prompt }] }] }) });
                if (!res.ok) {
                    let d = '';
                    try {
                        const b = await res.json();
                        d = b?.error?.message || '';
                    }
                    catch { }
                    errors.push(`${model}: HTTP ${res.status}${d ? ` \u2014 ${d}` : ''}`);
                    continue;
                }
                const json = await res.json();
                const raw = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text?.trim();
                if (!raw) {
                    errors.push(`${model}: empty`);
                    continue;
                }
                return this.parseCanvasJson(raw);
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException || err instanceof common_1.ServiceUnavailableException)
                    throw err;
                if (err instanceof LessonJsonTruncatedError) {
                    sawTruncation = true;
                    errors.push(`${model}: truncated response`);
                    continue;
                }
                const msg = err instanceof Error ? err.message : String(err);
                errors.push(`${model}: ${msg.includes('abort') || msg.includes('timeout') ? `timed out (${AI_NOTES_REQUEST_TIMEOUT_MS / 1000}s)` : msg}`);
            }
            finally {
                clearTimeout(t);
            }
        }
        if (sawTruncation)
            throw new LessonJsonTruncatedError(errors.join(' | '));
        throw new common_1.ServiceUnavailableException(`Gemini lesson generation failed: ${errors.join(' | ')}`);
    }
    async generateWithChatProvider(prompt, provider) {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
        try {
            let text = '';
            try {
                text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, true);
            }
            catch (error) {
                const m = error instanceof Error ? error.message : String(error);
                if (!this.isUnsupportedOpenAiJsonModeError(m))
                    throw error;
                text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, false);
            }
            if (!text)
                throw new common_1.ServiceUnavailableException(`${provider.providerLabel} returned empty`);
            return this.parseCanvasJson(text);
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException || error instanceof common_1.ServiceUnavailableException || error instanceof LessonJsonTruncatedError)
                throw error;
            const message = error instanceof Error ? error.message : String(error);
            const n = message.toLowerCase();
            throw new common_1.ServiceUnavailableException(n.includes('abort') || n.includes('timeout') ? `${provider.providerLabel} timed out` : n.includes('econnreset') || n.includes('fetch failed') ? `${provider.providerLabel} could not be reached` : `${provider.providerLabel} failed: ${message}`);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async sendChatCanvasPrompt(provider, prompt, signal, useJsonMode) {
        if (provider.providerKey === 'claude') {
            const res = await (0, fetch_with_retry_1.fetchWithRetry)((0, ai_provider_utils_1.normalizeAiProviderBaseUrl)('claude', provider.baseUrl), { method: 'POST', headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ model: provider.model, max_tokens: 16384, temperature: 0.7, system: 'Return ONLY raw valid JSON.', messages: [{ role: 'user', content: prompt }] }) });
            const p = await res.json().catch(() => null);
            if (!res.ok)
                throw new common_1.ServiceUnavailableException(`${provider.providerLabel}: ${p?.error?.message || 'error'}`);
            const content = p?.content;
            return Array.isArray(content) ? content.map(c => c?.type === 'text' ? c.text || '' : '').join('').trim() : '';
        }
        const res = await (0, fetch_with_retry_1.fetchWithRetry)((0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(provider.providerKey === 'openrouter' ? 'openrouter' : 'openai', provider.baseUrl), { method: 'POST', headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ model: provider.model, max_tokens: 16384, temperature: 0.7, top_p: 0.9, ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'system', content: 'Return valid JSON only.' }, { role: 'user', content: prompt }] }) });
        const p = await res.json().catch(() => null);
        if (!res.ok)
            throw new common_1.ServiceUnavailableException(`${provider.providerLabel}: ${p?.error?.message || 'error'}`);
        const content = p?.choices?.[0]?.message?.content;
        return typeof content === 'string' ? content.trim() : '';
    }
    isUnsupportedOpenAiJsonModeError(msg) {
        const n = String(msg || '').toLowerCase();
        return n.includes('response_format') && (n.includes('not supported') || n.includes('invalid parameter'));
    }
    async runFlashcardJsonPrompt(prompt, provider) {
        if (!provider.apiKey)
            throw new common_1.ServiceUnavailableException(`No API key for ${provider.providerLabel}.`);
        if (provider.providerKey === 'gemini') {
            const modelCandidates = Array.from(new Set([...GEMINI_MODELS, String(provider.model || (0, ai_provider_utils_1.getDefaultModelForProvider)('gemini')).trim()].filter(Boolean)));
            const errors = [];
            for (const model of modelCandidates) {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
                try {
                    const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 }, contents: [{ parts: [{ text: prompt }] }] }) });
                    if (!res.ok) {
                        let d = '';
                        try {
                            const b = await res.json();
                            d = b?.error?.message || '';
                        }
                        catch { }
                        errors.push(`${model}: HTTP ${res.status}${d ? ` \u2014 ${d}` : ''}`);
                        continue;
                    }
                    const json = await res.json();
                    const raw = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text?.trim();
                    if (!raw) {
                        errors.push(`${model}: empty`);
                        continue;
                    }
                    return this.parseJsonResponse(raw, provider.providerLabel);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    errors.push(`${model}: ${msg}`);
                }
                finally {
                    clearTimeout(t);
                }
            }
            throw new common_1.ServiceUnavailableException(`${provider.providerLabel} flashcard generation failed: ${errors.join(' | ')}`);
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
        try {
            let text = '';
            try {
                text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, true);
            }
            catch (e) {
                const m = e instanceof Error ? e.message : String(e);
                if (!this.isUnsupportedOpenAiJsonModeError(m))
                    throw e;
                text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, false);
            }
            if (!text)
                throw new common_1.ServiceUnavailableException(`${provider.providerLabel} returned empty flashcard response`);
            return this.parseJsonResponse(text, provider.providerLabel);
        }
        finally {
            clearTimeout(t);
        }
    }
    parseJsonResponse(text, label) {
        const s = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        try {
            return JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s);
        }
        catch {
            throw new common_1.ServiceUnavailableException(`${label} returned invalid flashcard JSON.`);
        }
    }
    buildFlashcardPrompt(input) {
        return `You are a senior medical educator creating reviewed flashcard drafts.\nReturn ONLY valid JSON: {"items":[{"question":"...","answer":"...","source_hint":"..."}]}\nRules:\n- Create up to ${input.count} high-yield Q&A flashcards.\n- Do NOT create SBA/MCQ/true-false.\n- Answer under 70 words unless list necessary.\nLesson: ${input.title}\nCourse: ${input.course || 'Not specified'}\nSubject: ${input.subject || 'Not specified'}\nTopic: ${input.topic || 'Not specified'}\nSOURCE NOTES:\n${input.sourceText}`;
    }
    extractFlashcardSourceText(row) {
        let noteData = null;
        try {
            noteData = row.note_data ? JSON.parse(row.note_data) : null;
        }
        catch {
            noteData = null;
        }
        const parts = [];
        const pages = Array.isArray(noteData?.pages) ? noteData.pages : noteData ? [noteData] : [];
        for (const page of pages) {
            const p = page;
            [p.title, p.subtitle].forEach(v => { const t = this.cleanFlashcardText(v, 500); if (t)
                parts.push(t); });
            if (Array.isArray(p.sections))
                for (const s of p.sections) {
                    const h = this.cleanFlashcardText(s.heading, 500);
                    if (h)
                        parts.push(`## ${h}`);
                    if (Array.isArray(s.bullets))
                        s.bullets.map(b => this.cleanFlashcardText(b, 600)).filter(Boolean).forEach(b => parts.push(`- ${b}`));
                    if (Array.isArray(s.steps))
                        s.steps.map(b => this.cleanFlashcardText(b, 600)).filter(Boolean).forEach(b => parts.push(`- ${b}`));
                    [s.callout, s.sticky_note, s.mnemonic].map(v => this.cleanFlashcardText(v, 600)).filter(Boolean).forEach(t => parts.push(`- ${t}`));
                }
            const sum = this.cleanFlashcardText(p.summary_box, 1000);
            if (sum)
                parts.push(`Summary: ${sum}`);
            if (Array.isArray(p.key_points))
                p.key_points.map(kp => this.cleanFlashcardText(kp, 600)).filter(Boolean).forEach(kp => parts.push(`Key point: ${kp}`));
        }
        if (parts.length < 4 && row.raw_text)
            parts.push(this.cleanFlashcardText(row.raw_text, 16000));
        return parts.join('\n').slice(0, 16000).trim();
    }
    normalizeGeneratedFlashcards(payload) {
        const rawItems = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
        const seen = new Set();
        const items = [];
        for (const raw of rawItems) {
            const item = raw;
            const question = this.cleanFlashcardText(item.question ?? item.front ?? item.q, 1000);
            const answer = this.cleanFlashcardText(item.answer ?? item.back ?? item.a ?? item.explanation, 3000);
            const sourceHint = this.cleanFlashcardText(item.source_hint ?? item.sourceHint ?? item.topic ?? item.heading, 500);
            try {
                this.assertValidFlashcard(question, answer);
            }
            catch {
                continue;
            }
            const sig = this.flashcardSignature(question, answer);
            if (!sig || seen.has(sig))
                continue;
            seen.add(sig);
            items.push({ question, answer, sourceHint });
        }
        return items;
    }
    normalizeFlashcardInput(payload) {
        return { question: this.cleanFlashcardText(payload.question, 1000), answer: this.cleanFlashcardText(payload.answer, 3000), sourceHint: this.cleanFlashcardText(payload.sourceHint, 500), imageUrls: this.cleanFlashcardImageUrls(payload.imageUrls ?? payload.imageUrl), imageFit: this.normalizeFlashcardImageFit(payload.imageFit) };
    }
    normalizeFlashcardImageFit(v) { return v === 'cover' ? 'cover' : 'contain'; }
    normalizeFlashcardStatus(v) { return v === 'approved' || v === 'rejected' ? v : 'draft'; }
    cleanFlashcardText(value, limit = 2000) {
        return String(value || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, limit).trim();
    }
    cleanFlashcardImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw)
            return '';
        if (raw.length > 1_500_000)
            throw new common_1.BadRequestException('Flashcard image is too large.');
        if (/^https?:\/\/\S+$/i.test(raw))
            return raw;
        if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw))
            return raw.replace(/\s+/g, '');
        throw new common_1.BadRequestException('Flashcard image must be http(s) URL or base64 PNG/JPG/WebP/GIF.');
    }
    cleanFlashcardImageUrls(value) {
        const items = Array.isArray(value) ? value : [value];
        const unique = new Set();
        for (const item of items) {
            const c = this.cleanFlashcardImageUrl(item);
            if (c) {
                unique.add(c);
                if (unique.size >= FLASHCARD_IMAGE_LIMIT)
                    break;
            }
        }
        return Array.from(unique);
    }
    parseFlashcardImageUrls(value) {
        const raw = String(value || '').trim();
        if (!raw)
            return [];
        if (raw.startsWith('[')) {
            try {
                return this.cleanFlashcardImageUrls(JSON.parse(raw));
            }
            catch {
                return [];
            }
        }
        return this.cleanFlashcardImageUrls(raw);
    }
    serializeFlashcardImageUrls(value) {
        const urls = this.cleanFlashcardImageUrls(value);
        if (!urls.length)
            return null;
        return urls.length === 1 ? urls[0] : JSON.stringify(urls);
    }
    assertValidFlashcard(question, answer) {
        const q = this.cleanFlashcardText(question, 1000);
        const a = this.cleanFlashcardText(answer, 3000);
        if (q.length < 8)
            throw new common_1.BadRequestException('Flashcard question is too short.');
        if (a.length < 12)
            throw new common_1.BadRequestException('Flashcard answer is too short.');
        if (q.toLowerCase() === a.toLowerCase())
            throw new common_1.BadRequestException('Question and answer must be different.');
        if (/^(true|false)\s*[:.-]/i.test(q) || /\b(select|choose)\s+(the\s+)?(correct|best)\s+answer\b/i.test(q))
            throw new common_1.BadRequestException('Use direct Q&A flashcards, not MCQ or true/false.');
    }
    flashcardSignature(question, answer) {
        return `${this.cleanFlashcardText(question, 500)}::${this.cleanFlashcardText(answer, 1000)}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    splitIntoPages(result) {
        return { pages: [result] };
    }
    degluedBullets(bullets) {
        const out = [];
        for (const raw of bullets) {
            const text = String(raw || '');
            const parts = text.split(/(?<=[a-z0-9,)\/])(?=[A-Z][a-z])/g).map((p) => p.trim()).filter(Boolean);
            if (parts.length > 1)
                out.push(...parts);
            else if (text.trim())
                out.push(text.trim());
        }
        return out;
    }
    validate(d) {
        const data = (d ?? {});
        return {
            title: String(data?.title || 'Lesson').trim().slice(0, 120),
            subtitle: String(data?.subtitle || '').trim().slice(0, 200),
            sections: (Array.isArray(data?.sections) ? data.sections : []).slice(0, 40).map((s) => {
                const sec = (s ?? {});
                if (String(sec?.type || '') === 'table') {
                    const headers = (Array.isArray(sec?.headers) ? sec.headers : []).map(String).slice(0, 12);
                    const rows = (Array.isArray(sec?.rows) ? sec.rows : []).slice(0, 60).map((r) => (Array.isArray(r) ? r : []).map(String).slice(0, 12));
                    return { type: 'table', heading: String(sec?.heading || '').trim().slice(0, 160), headers, rows, span: String(sec?.span || 'full'), bullets: [], callout: '', sticky_note: '', mnemonic: '' };
                }
                if (String(sec?.type || '') === 'flow') {
                    const steps = (Array.isArray(sec?.steps) ? sec.steps : []).map(String).map((t) => t.trim()).filter(Boolean).slice(0, 12).map((t) => t.slice(0, 500));
                    return { type: 'flow', heading: String(sec?.heading || '').trim().slice(0, 160), steps, span: String(sec?.span || 'full'), bullets: [], callout: '', sticky_note: '', mnemonic: '' };
                }
                if (String(sec?.type || '') === 'note') {
                    return {
                        type: 'note',
                        heading: String(sec?.heading || '').trim().slice(0, 160),
                        bullets: this.degluedBullets((Array.isArray(sec?.bullets) ? sec.bullets : []).map(String)).slice(0, 20),
                        anchor_topic: String(sec?.anchor_topic || '').trim().slice(0, 160),
                        callout: '', sticky_note: '', mnemonic: '',
                    };
                }
                const embeddedFlowRaw = Array.isArray(sec?.embedded_flow) ? sec.embedded_flow : [];
                const embedded_flow = embeddedFlowRaw.length
                    ? this.degluedBullets(embeddedFlowRaw.map(String)).filter(Boolean).slice(0, 12).map((t) => t.slice(0, 500))
                    : undefined;
                const embeddedTableRaw = sec?.embedded_table;
                const embedded_table = embeddedTableRaw && Array.isArray(embeddedTableRaw.headers)
                    ? {
                        headers: embeddedTableRaw.headers.map(String).slice(0, 12),
                        rows: (Array.isArray(embeddedTableRaw.rows) ? embeddedTableRaw.rows : []).slice(0, 60).map((r) => (Array.isArray(r) ? r : []).map(String).slice(0, 12)),
                    }
                    : undefined;
                const embedded_label = (embedded_flow || embedded_table)
                    ? String(sec?.embedded_label || '').trim().slice(0, 80) || undefined
                    : undefined;
                return {
                    heading: String(sec?.heading || '').trim(),
                    bullets: this.degluedBullets((Array.isArray(sec?.bullets) ? sec.bullets : []).map(String)).slice(0, 60),
                    callout: String(sec?.callout || '').trim().slice(0, 500),
                    sticky_note: String(sec?.sticky_note || '').trim().slice(0, 300),
                    mnemonic: String(sec?.mnemonic || '').trim().slice(0, 500),
                    ...(embedded_flow ? { embedded_flow } : {}),
                    ...(embedded_table ? { embedded_table } : {}),
                    ...(embedded_label ? { embedded_label } : {}),
                };
            }).filter(s => s.heading || s.bullets.length > 0 || (s.type === 'table' && (s.headers?.length ?? 0) > 0) || (s.type === 'flow' && (s.steps?.length ?? 0) > 0)),
            summary_box: String(data?.summary_box || '').trim().slice(0, 1000),
            key_points: (Array.isArray(data?.key_points) ? data.key_points : []).map(String).slice(0, 30),
            visual_style: { theme: 'notebook', look: 'hand-drawn academic', colors: this.normalizePalette(data?.visual_style?.colors) },
        };
    }
    normalizePalette(value) {
        const colors = Array.isArray(value) ? value.map(c => String(c || '').trim()).filter(c => /^#[0-9a-f]{6}$/i.test(c)) : [];
        return Array.from(new Set([...colors, ...FALLBACK_COLORS])).slice(0, 8);
    }
    buildPrompt(text) {
        return `You are a senior medical educator writing high-yield lessons for ERPM/SLMC exams.\n\n\u2501\u2501\u2501 CORE RULE: NEVER DROP CONTENT \u2501\u2501\u2501\n- Reproduce EVERY fact, definition, drug, dose, route, number, example and clinical pearl from the source. Leaving content out is the single worst error you can make.\n- Cause\u2192effect chains (pathophysiology, mechanisms) go into a "flow" section (see below) \u2014 everything else is crisp short bullets and \u21b3 sub-points, never long paragraphs.\n- Keep every secondary example and parenthetical detail (second-line drugs, alternative doses, qualifiers, routes). These are important \u2014 never trim them.\n- Preserve the author's structure and hierarchy. You MAY add accurate high-yield detail, but you may NEVER remove or shorten away the author's content.\n\n\u2501\u2501\u2501 BREAK IT UP (crisp, beautiful, one topic per card) \u2501\u2501\u2501\n- Give EACH topic its OWN section (Definition, Clinical features, Investigations, Management, Complications are SEPARATE sections). Number the headings flat and sequential — 1., 2., 3., 4. — NEVER nested/decimal numbers like 1.1 or 2.3. Generate as many sections as the content needs.\n- Keep every bullet SHORT \u2014 one idea per bullet, never a paragraph. To keep everything, add MORE bullets, never longer ones.\n\n\u2501\u2501\u2501 ONE CARD PER TOPIC \u2014 never split a topic across numbered cards \u2501\u2501\u2501\n- ALL management content goes in ONE "Management" section. Medical, surgical, conservative, first-line, second-line, step 1/2/3, method 1/2 are SUB-PARTS inside that single section \u2014 never their own numbered sections. The same rule applies to Investigations, Pathophysiology, Clinical features, Complications, Causes, Classification and every other topic.\n- NEVER output "12. Surgical management \u2014 method 1" and "13. Surgical management \u2014 method 2", and never "15. Medical management" ... "17. Surgical management". That is ONE card with labelled sub-parts.\n- Label each sub-part with a parent bullet that names it and ends with a colon, then put that sub-part\'s points under it as "\u2192 " sub-bullets. Example bullets array: ["**Medical management**:", "\u2192 **Ramipril** (==first-line== ACEi)", "\u2192 **Amlodipine** (==CCB==)", "**Surgical management**:", "\u2192 **Renal denervation** (for ==resistant hypertension==)"]\n- If a sub-part is a comparison or a cause\u2192effect chain, it CANNOT be bullets \u2014 but it is still the SAME card, not a new numbered section. Put it on that SAME section object as \"embedded_table\":{\"headers\":[...],\"rows\":[[...]]} or \"embedded_flow\":[\"step 1\",\"step 2\"], alongside its \"bullets\", plus \"embedded_label\":\"<short specific label, e.g. 'Ramipril mechanism' not just 'Mechanism'>\". Only use a standalone {\"type\":\"table\"}/{\"type\":\"flow\"} section when the WHOLE topic (not a sub-part of a bigger one) is a comparison or chain.\n- Grouping must NEVER cost content: keep every drug, dose, step, qualifier and detail from every sub-part. Group them, do not shorten them.\n\n\u2501\u2501\u2501 SIDE NOTES ARE NOT SECTIONS \u2501\u2501\u2501\n- A short note, aside, reminder or comment sitting between two topics in the source is NOT its own numbered section \u2014 it belongs in that topic\'s "callout" or "sticky_note" (both render as a box). Numbered cards stay one-topic-each, in order.\n\n\u2501\u2501\u2501 SUB-POINTS (\u21b3 arrows) \u2501\u2501\u2501\n- When a bullet introduces a list (tests, drugs, features, causes), put the list heading on the main bullet, then put EACH item on its OWN sub-bullet by starting that bullet string with "\u2192 ".\n- ALWAYS start each "\u2192 " sub-bullet with its key term in **bold** (the test / drug / feature name), then a SHORT reason in brackets (why it is done or used).\n- Each individual drug + dose goes on its OWN "\u2192 " sub-bullet \u2014 never put several drugs on one line.\n- Example bullets array: ["Blood tests:", "\u2192 **FBC** (screens for ==anaemia==)", "\u2192 **Lipids** (==cardiovascular risk==)", "\u2192 **HbA1c / glucose** (checks for ==diabetes==)"]\n\n\u2501\u2501\u2501 DRUGS & INVESTIGATIONS (always give a reason) \u2501\u2501\u2501\n- Every drug/class AND every investigation/test shows a SHORT reason in brackets the first time \u2014 WHY it is used or done, e.g. "**\u03b2-blocker** (\u2193 heart rate \u2192 \u2193 O\u2082 demand)", "**CTCA** (rules out obstructive disease)", "**FBC** (screens for anaemia)". Do NOT repeat that reason later \u2014 once each is enough.\n\n\u2501\u2501\u2501 DIFFERENTIAL DIAGNOSIS (DDx) \u2014 add when relevant \u2501\u2501\u2501\n- If the topic is a disease or clinical presentation with meaningful differentials, ADD a "Differential diagnosis" section. List each differential with ONE distinguishing feature (how to tell it apart), as \u21b3 sub-points ("\u2192 **Diagnosis** \u2014 distinguishing feature") or a 2-column table. Only add it where it makes clinical sense \u2014 skip it for pure pharmacology or definition-only topics.\n\n\u2501\u2501\u2501 RED FLAGS \u2014 add when relevant \u2501\u2501\u2501\n- For conditions where dangerous or emergency signs matter, add a short section titled "\ud83d\udea9 Red flags" listing the warning signs that need urgent action (one per bullet). Skip it for anatomy, pharmacology or non-clinical topics.\n\n\u2501\u2501\u2501 HIGHLIGHTS (mark up EVERY clinically important word \u2014 be generous, not sparing) \u2501\u2501\u2501\n- ==double equals== \u2192 highlight every diagnosis, disease name, key term, mechanism word, lab/vital cut-off, percentage and time frame. If it is something a student would circle while revising, wrap it in ==...==. Aim for at least one ==highlight== in nearly every bullet, sub-bullet, callout, sticky note, mnemonic line, flow step, AND table cell \u2014 sparse highlighting is a failure, not a style choice.\n- **double asterisks** \u2192 bold every drug name + dose, lab value, and numeric threshold.\n- Tables are NOT exempt: a cell like \\"\u2265140/90, confirmed on repeat\\" must come out as \\"\u2265**140/90**, confirmed on ==repeat measurement==\\" \u2014 bold the numbers AND highlight the diagnostic terms, in every row, not just the first one.\n\n\u2501\u2501\u2501 WORDING \u2501\u2501\u2501\n- Professional but clear: correct medical terms, with a SHORT plain-English gloss in brackets only for genuinely hard terms \u2014 e.g. lumen (the channel blood flows through). Do not oversimplify like a children's book.\n\n\u2501\u2501\u2501 FLOW RULE (cause \u2192 effect) \u2501\u2501\u2501\n- When content is a cause-and-effect chain, mechanism, or pathophysiology sequence, use a "flow" section instead of bullets so the reasoning reads top to bottom.\n- Flow sections use: {"type":"flow","heading":"Heading","steps":["first step as a full sentence","next step","result"],"span":"full"}\n- Each step is ONE complete sentence and keeps the cause\u2192effect logic (\u2192, because, but) inside it. Use 2\u20136 steps. Only use flow for genuine reasoning chains \u2014 lists stay bullets, comparisons stay tables.\n\n\u2501\u2501\u2501 TABLE RULE \u2501\u2501\u2501\n- When content is a comparison (e.g. drug classes, differentials, stages, classification), use a table section instead of bullets\n- A numbered or lettered classification/staging scheme (Type 0, 1, 2\u2026, Stage I, II, III\u2026, Grade A/B/C) is ALWAYS a table, one ROW per type/stage/grade \u2014 NEVER a bullet that lists several types crammed into one line like \"3 (contacts endometrium), 4 (intramural), 5 (subserosal)\u2026\". If several types share one column's value, that's fine \u2014 they still get their OWN row each.\n- Table sections use: {"type":"table","heading":"Heading","headers":["Col1","Col2"],"rows":[["a","b"],["c","d"]],"span":"full"}\n- Keep ALL columns and ALL rows from the source \u2014 never drop a column or row to make it fit\n- If the source already contains a table, keep it AS a table. Cells may hold a full phrase or short sentence \u2014 do NOT shrink them to 1\u20132 keywords\n\nReturn ONLY this JSON (no markdown, no code fences):\n{"title":"TOPIC IN CAPS","subtitle":"one fragment","sections":[{"heading":"1. Investigations","bullets":["**CTCA** (rules out ==obstructive disease==) — first-line imaging","Blood tests:","→ **FBC** (screens for ==anaemia==)","→ **Lipids** (==cardiovascular risk==)"],"callout":"[EXAM TRAP] fragment","sticky_note":"key fact","mnemonic":""},{"type":"table","heading":"2. Comparison","headers":["Drug","Dose"],"rows":[["==Drug A==","**5mg** once daily"],["==Drug B==","**10mg** twice daily"]],"span":"full"},{"type":"flow","heading":"3. Pathophysiology","steps":["Full sentence step","Next step with because/but logic","Result"],"span":"full"}],"summary_box":"fragment \u00b7 fragment","key_points":["==Term==: value"],"visual_style":{"theme":"notebook","look":"hand-drawn academic","colors":["#A7D8FF","#FFE680","#FFB3B3","#C7F0BD","#CE93D8","#80DEEA","#F48FB1","#FFCC80"]}}\n\nSource notes (reproduce ALL of this — nothing may be left out):\n${text.slice(0, 60000)}`;
    }
};
exports.LessonsService = LessonsService;
LessonsService.TOPIC_FAMILIES = [
    { key: 'definition', title: 'Definition', test: /definition|\bdefined\b/ },
    { key: 'differential', title: 'Differential diagnosis', test: /differential|\bddx\b/ },
    { key: 'red-flags', title: 'Red flags', test: /red flag/ },
    { key: 'mechanism-of-action', title: 'Mechanism of action', test: /mechanism of action|\bmoa\b/ },
    { key: 'risk-stratification', title: 'Risk stratification', test: /risk (stratification|score|assessment)/ },
    { key: 'adverse-effects', title: 'Side effects', test: /adverse (effect|reaction|event)|side[- ]?effect/ },
    { key: 'contraindications', title: 'Contraindications', test: /contraindicat/ },
    { key: 'dosing', title: 'Dosing', test: /\bdos(e|ing|age)\b/ },
    { key: 'follow-up', title: 'Follow-up & monitoring', test: /follow[- ]?up|monitoring/ },
    { key: 'management', title: 'Management', test: /manage|treat|therap/ },
    { key: 'investigations', title: 'Investigations', test: /investigat|work[- ]?up/ },
    { key: 'pathophysiology', title: 'Pathophysiology', test: /pathophysiolog|pathogenes|mechanism/ },
    { key: 'clinical-features', title: 'Clinical features', test: /clinical feature|symptom|\bsigns?\b|presentation/ },
    { key: 'complications', title: 'Complications', test: /complication/ },
    { key: 'aetiology', title: 'Causes & risk factors', test: /aetiolog|etiolog|\bcauses?\b|risk factor/ },
    { key: 'classification', title: 'Classification', test: /classification|staging|\bgrades?\b/ },
    { key: 'diagnosis', title: 'Diagnosis', test: /diagnos/ },
    { key: 'epidemiology', title: 'Epidemiology', test: /epidemiolog|incidence|prevalence/ },
    { key: 'prevention', title: 'Prevention & screening', test: /prevention|prophylax|screening/ },
    { key: 'prognosis', title: 'Prognosis', test: /prognos|outcome/ },
];
LessonsService.TOPIC_ORDER = [
    'definition', 'epidemiology', 'aetiology', 'risk-stratification', 'classification',
    'pathophysiology', 'mechanism-of-action', 'clinical-features', 'red-flags',
    'differential', 'investigations', 'diagnosis', 'management', 'dosing',
    'adverse-effects', 'contraindications', 'complications', 'follow-up',
    'prognosis', 'prevention',
];
LessonsService.ASIDE_PATTERNS = [
    /^(short|extra|additional|side|other|general|misc)?\s*-?\s*notes?$/,
    /^miscellaneous$/,
    /^(clinical\s+)?pearls?$/,
    /^tips?(\s+(&|and)\s+tricks?)?$/,
    /^(key|quick|high[- ]?yield|important)\s+(facts?|points?)$/,
    /^(summary|revision)\s+points?$/,
    /^points?\s+to\s+remember$/,
    /^faqs?$/,
];
exports.LessonsService = LessonsService = LessonsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService,
        push_notifications_service_1.PushNotificationsService])
], LessonsService);
//# sourceMappingURL=lessons.service.js.map