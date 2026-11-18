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
exports.TopicsService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const structure_counts_1 = require("../../common/utils/structure-counts");
const quiz_counts_1 = require("../../common/utils/quiz-counts");
const content_history_1 = require("../../common/utils/content-history");
let TopicsService = class TopicsService {
    constructor(db) {
        this.db = db;
    }
    async findAll(courseId) {
        const columns = `t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.sort_order, t.created_at,
        t.subtopic_count, t.lesson_count`;
        if (courseId) {
            const [rows] = await this.db.execute(`SELECT ${columns} FROM topics t WHERE t.course_id = ? ORDER BY t.sort_order ASC, t.id ASC`, [courseId]);
            return rows.map((row) => this.mapTopic(row));
        }
        const [rows] = await this.db.execute(`SELECT ${columns}, c.course_title
       FROM topics t
       INNER JOIN courses c ON c.id = t.course_id
       ORDER BY t.sort_order ASC, t.id ASC`);
        return rows.map((row) => this.mapTopic(row));
    }
    async findOne(id) {
        const [rows] = await this.db.execute(`
        SELECT
          t.id,
          t.course_id,
          t.topic_name,
          t.topic_description,
          t.status,
          t.sort_order,
          t.created_at,
          c.course_title,
          COUNT(s.id) AS subtopic_count
        FROM topics t
        INNER JOIN courses c ON c.id = t.course_id
        LEFT JOIN subtopics s ON s.topic_id = t.id
        WHERE t.id = ?
        GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.sort_order, t.created_at, c.course_title
        LIMIT 1
      `, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Topic not found');
        }
        const topic = this.mapTopic(row);
        const [subtopicRows] = await this.db.execute('SELECT subtopic_name FROM subtopics WHERE topic_id = ? ORDER BY sort_order ASC, id ASC', [id]);
        return {
            ...topic,
            subtopics: subtopicRows.map((item) => item.subtopic_name),
        };
    }
    async create(createTopicDto, actor) {
        const snapshot = this.buildTopicSnapshot(createTopicDto);
        this.validateTopicPayload(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        await this.ensureCourseExists(snapshot.courseId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [orderRows] = await connection.execute(`SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM topics WHERE course_id = ?`, [snapshot.courseId]);
            const nextSortOrder = Number(orderRows[0]?.maxOrder || 0) + 1000;
            const [result] = await connection.execute('INSERT INTO topics (course_id, topic_name, topic_description, status, sort_order) VALUES (?, ?, ?, ?, ?)', [
                snapshot.courseId,
                snapshot.topicName,
                snapshot.topicDescription,
                snapshot.status,
                nextSortOrder,
            ]);
            await this.syncSubtopics(connection, result.insertId, snapshot.subtopics);
            await (0, structure_counts_1.bumpCounts)(connection, 'courses', 'subject_count', [[snapshot.courseId, 1]]);
            await this.recordContentVersion(connection, 'topic', result.insertId, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'topic', result.insertId, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'topic',
                entityId: result.insertId,
                action: 'created',
                summary: `Topic ${result.insertId} created`,
                actorId: this.getActorId(actor),
                after: snapshot,
            });
            await connection.commit();
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
    async update(id, updateTopicDto, actor) {
        const existing = await this.findOne(id);
        const snapshot = this.buildTopicSnapshot({
            courseId: updateTopicDto.courseId ?? existing.courseId,
            topicName: updateTopicDto.topicName ?? existing.topicName,
            topicDescription: updateTopicDto.topicDescription ?? existing.topicDescription,
            subtopics: updateTopicDto.subtopics ?? existing.subtopics,
            status: updateTopicDto.status ?? existing.status,
        });
        this.validateTopicPayload(snapshot);
        this.assertCanModifyExistingStatus(actor, existing.status);
        this.assertCanSaveStatus(actor, snapshot.status);
        await this.ensureCourseExists(snapshot.courseId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeTopicSnapshot(connection, id, snapshot);
            if (Array.isArray(updateTopicDto.subtopics)) {
                await this.syncSubtopics(connection, id, snapshot.subtopics);
            }
            await this.recordContentVersion(connection, 'topic', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'topic', id, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'topic',
                entityId: id,
                action: 'updated',
                summary: `Topic ${id} updated`,
                actorId: this.getActorId(actor),
                before: existing,
                after: snapshot,
            });
            await connection.commit();
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
        const existing = await this.findOne(id);
        this.assertCanModifyExistingStatus(actor, existing.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [counted] = await connection.execute(`SELECT course_id, SUM(${structure_counts_1.COUNTED_LESSON}) AS n FROM lessons WHERE topic_id = ? GROUP BY course_id FOR UPDATE`, [id]);
            const quizzesBefore = await (0, quiz_counts_1.readSubjectQuizStates)(connection, id);
            const [subjectRows] = await connection.execute('SELECT course_id FROM topics WHERE id = ? FOR UPDATE', [id]);
            const [goneSubtopics] = await connection.execute('SELECT id FROM subtopics WHERE topic_id = ?', [id]);
            await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [id]);
            await connection.execute('DELETE FROM topics WHERE id = ?', [id]);
            await (0, content_history_1.forgetContentHistory)(connection, 'topic', [id]);
            await (0, content_history_1.forgetContentHistory)(connection, 'subtopic', goneSubtopics.map((r) => Number(r.id)));
            await (0, quiz_counts_1.applyQuizCountChanges)(connection, quizzesBefore, quizzesBefore.map((q) => ({ ...q, topic_id: null })));
            if (subjectRows[0]) {
                await (0, structure_counts_1.bumpCounts)(connection, 'courses', 'subject_count', [[Number(subjectRows[0].course_id), -1]]);
                await (0, structure_counts_1.bumpCounts)(connection, 'courses', 'lesson_count', counted.map((r) => [Number(r.course_id), -Number(r.n || 0)]));
            }
            await this.recordContentAudit(connection, {
                entityType: 'topic',
                entityId: id,
                action: 'deleted',
                summary: `Topic ${id} deleted`,
                actorId: this.getActorId(actor),
                before: existing,
            });
            await connection.commit();
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
    async listVersions(id) {
        void id;
        return [];
    }
    async markDraft(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'draft',
            status: 'inactive',
            action: 'marked_draft',
            summary: `Topic ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Topic ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Topic ${id} published`,
            actor,
        });
    }
    async rollback(id, versionNumber, actor) {
        void id;
        void versionNumber;
        void actor;
        throw new common_1.BadRequestException('Version history is not kept any more.');
    }
    async transitionWorkflow(id, input) {
        const existing = await this.findOne(id);
        this.assertCanModifyExistingStatus(input.actor, existing.status);
        this.assertCanSaveStatus(input.actor, input.status);
        const snapshot = this.buildTopicSnapshotFromEntity(existing, input.status);
        this.validateTopicPayload(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE topics SET status = ? WHERE id = ?', [input.status, id]);
            await this.recordContentVersion(connection, 'topic', id, snapshot, this.getActorId(input.actor));
            await this.setWorkflowState(connection, 'topic', id, input.workflowState, this.getActorId(input.actor));
            await this.recordContentAudit(connection, {
                entityType: 'topic',
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
    buildTopicSnapshot(topic) {
        return {
            courseId: Number(topic.courseId),
            topicName: String(topic.topicName || '').trim(),
            topicDescription: String(topic.topicDescription || '').trim(),
            subtopics: this.normalizeSubtopicNames(topic.subtopics || []),
            status: topic.status === 'active' ? 'active' : 'inactive',
        };
    }
    buildTopicSnapshotFromEntity(topic, status) {
        return this.buildTopicSnapshot({
            courseId: Number(topic.courseId),
            topicName: topic.topicName,
            topicDescription: topic.topicDescription || '',
            subtopics: topic.subtopics || [],
            status,
        });
    }
    async writeTopicSnapshot(connection, id, topic) {
        const [current] = await connection.execute('SELECT course_id FROM topics WHERE id = ?', [id]);
        const movingCourse = current[0] && Number(current[0].course_id) !== Number(topic.courseId);
        if (movingCourse) {
            const [counted] = await connection.execute(`SELECT course_id, SUM(${structure_counts_1.COUNTED_LESSON}) AS n FROM lessons WHERE topic_id = ? GROUP BY course_id FOR UPDATE`, [id]);
            const quizzesBefore = (await (0, quiz_counts_1.readSubjectQuizStates)(connection, id)).filter((q) => q.is_general === 0);
            const [locked] = await connection.execute('SELECT course_id FROM topics WHERE id = ? FOR UPDATE', [id]);
            const oldCourse = Number(locked[0].course_id);
            await connection.execute('UPDATE lessons SET course_id = ? WHERE topic_id = ?', [topic.courseId, id]);
            await connection.execute('UPDATE quizzes SET course_id = ? WHERE topic_id = ? AND is_general = 0', [topic.courseId, id]);
            await (0, quiz_counts_1.applyQuizCountChanges)(connection, quizzesBefore, quizzesBefore.map((q) => ({ ...q, course_id: Number(topic.courseId) })));
            const lessonsMoved = counted.reduce((t, r) => t + Number(r.n || 0), 0);
            await connection.execute(`UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ?,
           sort_order = (SELECT next_rank FROM (SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_rank FROM topics WHERE course_id = ?) r)
         WHERE id = ?`, [topic.courseId, topic.topicName, topic.topicDescription, topic.status, topic.courseId, id]);
            await (0, structure_counts_1.bumpCounts)(connection, 'courses', 'subject_count', [[oldCourse, -1], [topic.courseId, 1]]);
            await (0, structure_counts_1.bumpCounts)(connection, 'courses', 'lesson_count', [
                ...counted.map((r) => [Number(r.course_id), -Number(r.n || 0)]),
                [topic.courseId, lessonsMoved],
            ]);
            return;
        }
        await connection.execute('UPDATE topics SET topic_name = ?, topic_description = ?, status = ? WHERE id = ?', [topic.topicName, topic.topicDescription, topic.status, id]);
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
    parseTopicSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
        return this.buildTopicSnapshot({
            courseId: Number(snapshot.courseId),
            topicName: String(snapshot.topicName || ''),
            topicDescription: String(snapshot.topicDescription || ''),
            subtopics: Array.isArray(snapshot.subtopics) ? snapshot.subtopics.map(String) : [],
            status: snapshot.status === 'active' ? 'active' : 'inactive',
        });
    }
    async recordContentVersion(connection, entityType, entityId, snapshot, actorId) {
        void connection;
        void entityType;
        void entityId;
        void snapshot;
        void actorId;
    }
    async setWorkflowState(connection, entityType, entityId, workflowState, actorId) {
        void connection;
        void entityType;
        void entityId;
        void workflowState;
        void actorId;
    }
    async recordContentAudit(connection, event) {
        void 0;
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
            throw new common_1.ForbiddenException('Review permission is required to publish topic content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published topics require review permission before modification');
        }
    }
    validateTopicPayload(topic) {
        if (!topic.courseId || topic.courseId <= 0) {
            throw new common_1.BadRequestException('Please select a course');
        }
        if (!topic.topicName) {
            throw new common_1.BadRequestException('Topic name is required');
        }
    }
    async ensureCourseExists(courseId) {
        const [rows] = await this.db.execute('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
        if (rows.length === 0) {
            throw new common_1.BadRequestException('Selected course was not found');
        }
    }
    async syncSubtopics(connection, topicId, subtopics) {
        const wanted = this.normalizeSubtopicNames(subtopics);
        const [rows] = await connection.execute('SELECT id, subtopic_name, sort_order FROM subtopics WHERE topic_id = ? FOR UPDATE', [topicId]);
        const key = (name) => String(name || '').trim().toLowerCase();
        const wantedKeys = new Set(wanted.map(key));
        const existingKeys = new Set(rows.map((r) => key(r.subtopic_name)));
        const toDelete = rows.filter((r) => !wantedKeys.has(key(r.subtopic_name))).map((r) => Number(r.id));
        const toAdd = wanted.filter((name) => !existingKeys.has(key(name)));
        if (toDelete.length) {
            await connection.execute(`DELETE FROM subtopics WHERE id IN (${toDelete.map(() => '?').join(', ')})`, toDelete);
            await (0, content_history_1.forgetContentHistory)(connection, 'subtopic', toDelete);
        }
        let rank = rows.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0);
        for (const name of toAdd) {
            rank += 1000;
            await connection.execute('INSERT INTO subtopics (topic_id, subtopic_name, status, sort_order) VALUES (?, ?, ?, ?)', [topicId, name, 'active', rank]);
        }
        await (0, structure_counts_1.bumpCounts)(connection, 'topics', 'subtopic_count', [[topicId, toAdd.length - toDelete.length]]);
    }
    normalizeSubtopicNames(subtopics) {
        return Array.from(new Map(subtopics
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => [item.toLowerCase(), item])).values());
    }
    mapTopic(row) {
        return {
            id: row.id,
            courseId: row.course_id,
            topicName: row.topic_name,
            topicDescription: row.topic_description || '',
            status: row.status,
            sortOrder: Number(row.sort_order ?? 0),
            createdAt: row.created_at || null,
            courseTitle: row.course_title,
            subtopicCount: Number(row.subtopic_count || 0),
            ...(row.lesson_count !== undefined ? { lessonCount: Number(row.lesson_count) } : {}),
        };
    }
};
exports.TopicsService = TopicsService;
exports.TopicsService = TopicsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], TopicsService);
//# sourceMappingURL=topics.service.js.map