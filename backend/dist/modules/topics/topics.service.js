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
let TopicsService = class TopicsService {
    constructor(db) {
        this.db = db;
    }
    async findAll(courseId) {
        let sql = `
      SELECT
        t.id,
        t.course_id,
        t.topic_name,
        t.topic_description,
        t.status,
        t.created_at,
        c.course_title,
        COUNT(s.id) AS subtopic_count
      FROM topics t
      INNER JOIN courses c ON c.id = t.course_id
      LEFT JOIN subtopics s ON s.topic_id = t.id
    `;
        const params = [];
        if (courseId) {
            sql += ' WHERE t.course_id = ?';
            params.push(courseId);
        }
        sql += `
      GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.created_at, c.course_title
      ORDER BY t.topic_name ASC
    `;
        const [rows] = await this.db.execute(sql, params);
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
          t.created_at,
          c.course_title,
          COUNT(s.id) AS subtopic_count
        FROM topics t
        INNER JOIN courses c ON c.id = t.course_id
        LEFT JOIN subtopics s ON s.topic_id = t.id
        WHERE t.id = ?
        GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.created_at, c.course_title
        LIMIT 1
      `, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Topic not found');
        }
        const topic = this.mapTopic(row);
        const [subtopicRows] = await this.db.execute('SELECT subtopic_name FROM subtopics WHERE topic_id = ? ORDER BY subtopic_name ASC', [id]);
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
            const [result] = await connection.execute('INSERT INTO topics (course_id, topic_name, topic_description, status) VALUES (?, ?, ?, ?)', [
                snapshot.courseId,
                snapshot.topicName,
                snapshot.topicDescription,
                snapshot.status,
            ]);
            await this.replaceSubtopics(connection, result.insertId, snapshot.subtopics);
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
            await connection.execute('UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ? WHERE id = ?', [
                snapshot.courseId,
                snapshot.topicName,
                snapshot.topicDescription,
                snapshot.status,
                id,
            ]);
            if (Array.isArray(updateTopicDto.subtopics)) {
                await this.replaceSubtopics(connection, id, snapshot.subtopics);
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
            await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [id]);
            await connection.execute('DELETE FROM topics WHERE id = ?', [id]);
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
        await this.findOne(id);
        const [rows] = await this.db.execute(`SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'topic' AND entity_id = ?
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
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback published topic content');
        }
        const existing = await this.findOne(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'topic' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Content version not found');
        }
        const snapshot = this.parseTopicSnapshot(versionRows[0].snapshot_json);
        this.validateTopicPayload(snapshot);
        await this.ensureCourseExists(snapshot.courseId);
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeTopicSnapshot(connection, id, snapshot);
            await this.replaceSubtopics(connection, id, snapshot.subtopics);
            await this.recordContentVersion(connection, 'topic', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'topic', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'topic',
                entityId: id,
                action: 'rolled_back',
                summary: `Topic ${id} rolled back to version ${versionNumber}`,
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
        await connection.execute('UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ? WHERE id = ?', [
            topic.courseId,
            topic.topicName,
            topic.topicDescription,
            topic.status,
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
    async replaceSubtopics(connection, topicId, subtopics) {
        const cleaned = this.normalizeSubtopicNames(subtopics);
        await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [topicId]);
        for (const subtopic of cleaned) {
            await connection.execute('INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)', [topicId, subtopic, 'active']);
        }
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
            createdAt: row.created_at || null,
            courseTitle: row.course_title,
            subtopicCount: Number(row.subtopic_count || 0),
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