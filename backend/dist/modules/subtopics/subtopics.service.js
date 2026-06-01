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
exports.SubtopicsService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
let SubtopicsService = class SubtopicsService {
    constructor(db) {
        this.db = db;
    }
    async findAll(topicId) {
        let sql = `
      SELECT id, topic_id, subtopic_name, status, created_at
      FROM subtopics
    `;
        const params = [];
        if (topicId) {
            sql += ' WHERE topic_id = ?';
            params.push(topicId);
        }
        sql += ' ORDER BY subtopic_name ASC';
        const [rows] = await this.db.execute(sql, params);
        return rows.map((row) => this.mapSubtopic(row));
    }
    async create(createSubtopicDto, actor) {
        const snapshot = this.buildSubtopicSnapshot(createSubtopicDto);
        this.validateSubtopicPayload(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        await this.ensureTopicExists(snapshot.topicId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute('INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)', [snapshot.topicId, snapshot.subtopicName, snapshot.status]);
            await this.recordContentVersion(connection, 'subtopic', result.insertId, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'subtopic', result.insertId, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'subtopic',
                entityId: result.insertId,
                action: 'created',
                summary: `Subtopic ${result.insertId} created`,
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
    async update(id, updateSubtopicDto, actor) {
        const existing = await this.findById(id);
        const snapshot = this.buildSubtopicSnapshot({
            topicId: updateSubtopicDto.topicId ?? existing.topicId,
            subtopicName: updateSubtopicDto.subtopicName ?? existing.subtopicName,
            status: updateSubtopicDto.status ?? existing.status,
        });
        this.validateSubtopicPayload(snapshot);
        this.assertCanModifyExistingStatus(actor, existing.status);
        this.assertCanSaveStatus(actor, snapshot.status);
        await this.ensureTopicExists(snapshot.topicId);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeSubtopicSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'subtopic', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'subtopic', id, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'subtopic',
                entityId: id,
                action: 'updated',
                summary: `Subtopic ${id} updated`,
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
        };
    }
    async remove(id, actor) {
        const existing = await this.findById(id);
        this.assertCanModifyExistingStatus(actor, existing.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM subtopics WHERE id = ?', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'subtopic',
                entityId: id,
                action: 'deleted',
                summary: `Subtopic ${id} deleted`,
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
       WHERE entity_type = 'subtopic' AND entity_id = ?
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
            summary: `Subtopic ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Subtopic ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Subtopic ${id} published`,
            actor,
        });
    }
    async rollback(id, versionNumber, actor) {
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback published subtopic content');
        }
        const existing = await this.findById(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'subtopic' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Content version not found');
        }
        const snapshot = this.parseSubtopicSnapshot(versionRows[0].snapshot_json);
        this.validateSubtopicPayload(snapshot);
        await this.ensureTopicExists(snapshot.topicId);
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writeSubtopicSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'subtopic', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'subtopic', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'subtopic',
                entityId: id,
                action: 'rolled_back',
                summary: `Subtopic ${id} rolled back to version ${versionNumber}`,
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
        const existing = await this.findById(id);
        this.assertCanModifyExistingStatus(input.actor, existing.status);
        this.assertCanSaveStatus(input.actor, input.status);
        const snapshot = this.buildSubtopicSnapshotFromEntity(existing, input.status);
        this.validateSubtopicPayload(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE subtopics SET status = ? WHERE id = ?', [input.status, id]);
            await this.recordContentVersion(connection, 'subtopic', id, snapshot, this.getActorId(input.actor));
            await this.setWorkflowState(connection, 'subtopic', id, input.workflowState, this.getActorId(input.actor));
            await this.recordContentAudit(connection, {
                entityType: 'subtopic',
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
    buildSubtopicSnapshot(subtopic) {
        return {
            topicId: Number(subtopic.topicId),
            subtopicName: String(subtopic.subtopicName || '').trim(),
            status: subtopic.status === 'active' ? 'active' : 'inactive',
        };
    }
    buildSubtopicSnapshotFromEntity(subtopic, status) {
        return this.buildSubtopicSnapshot({
            topicId: Number(subtopic.topicId),
            subtopicName: subtopic.subtopicName,
            status,
        });
    }
    async writeSubtopicSnapshot(connection, id, subtopic) {
        await connection.execute('UPDATE subtopics SET topic_id = ?, subtopic_name = ?, status = ? WHERE id = ?', [
            subtopic.topicId,
            subtopic.subtopicName,
            subtopic.status,
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
    parseSubtopicSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
        return this.buildSubtopicSnapshot({
            topicId: Number(snapshot.topicId),
            subtopicName: String(snapshot.subtopicName || ''),
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
            throw new common_1.ForbiddenException('Review permission is required to publish subtopic content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published subtopics require review permission before modification');
        }
    }
    validateSubtopicPayload(subtopic) {
        if (!subtopic.topicId || subtopic.topicId <= 0) {
            throw new common_1.BadRequestException('Please select a topic');
        }
        if (!subtopic.subtopicName) {
            throw new common_1.BadRequestException('Subtopic name is required');
        }
    }
    async findById(id) {
        const [rows] = await this.db.execute('SELECT id, topic_id, subtopic_name, status, created_at FROM subtopics WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Subtopic not found');
        }
        return this.mapSubtopic(row);
    }
    async ensureTopicExists(topicId) {
        const [rows] = await this.db.execute('SELECT id FROM topics WHERE id = ? LIMIT 1', [topicId]);
        if (rows.length === 0) {
            throw new common_1.BadRequestException('Selected topic was not found');
        }
    }
    mapSubtopic(row) {
        return {
            id: row.id,
            topicId: row.topic_id,
            subtopicName: row.subtopic_name,
            status: row.status,
            createdAt: row.created_at || null,
        };
    }
};
exports.SubtopicsService = SubtopicsService;
exports.SubtopicsService = SubtopicsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], SubtopicsService);
//# sourceMappingURL=subtopics.service.js.map