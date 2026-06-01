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
exports.PapersService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
let PapersService = class PapersService {
    constructor(db) {
        this.db = db;
    }
    async findAll(filters) {
        let sql = `
      SELECT
        p.*,
        (
          SELECT COUNT(*)
          FROM questions q
          WHERE q.paper_id = p.id
        ) AS question_count
      FROM papers p
      WHERE 1 = 1
    `;
        const params = [];
        if (filters.search?.trim()) {
            sql += ' AND (p.paper_title LIKE ? OR p.keywords_text LIKE ?)';
            const like = `%${filters.search.trim()}%`;
            params.push(like, like);
        }
        if (filters.status === 'active' || filters.status === 'inactive') {
            sql += ' AND p.status = ?';
            params.push(filters.status);
        }
        sql += ' ORDER BY p.year DESC, p.id DESC';
        const [rows] = await this.db.execute(sql, params);
        return rows.map((row) => this.mapPaper(row));
    }
    async findOne(id) {
        const [rows] = await this.db.execute(`
        SELECT
          p.*,
          (
            SELECT COUNT(*)
            FROM questions q
            WHERE q.paper_id = p.id
          ) AS question_count
        FROM papers p
        WHERE p.id = ?
        LIMIT 1
      `, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Paper not found');
        }
        return this.mapPaper(row);
    }
    async create(createPaperDto, actor) {
        const snapshot = this.buildPaperSnapshot(createPaperDto);
        this.validatePaperPayload(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(`
          INSERT INTO papers (paper_title, year, exam_source, keywords_text, status)
          VALUES (?, ?, ?, ?, ?)
        `, [
                snapshot.paperTitle,
                snapshot.year,
                snapshot.examSource,
                snapshot.keywordsText,
                snapshot.status,
            ]);
            await this.recordContentVersion(connection, 'paper', result.insertId, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'paper', result.insertId, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'paper',
                entityId: result.insertId,
                action: 'created',
                summary: `Paper ${result.insertId} created`,
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
    async update(id, updatePaperDto, actor) {
        const existing = await this.findOne(id);
        const snapshot = this.buildPaperSnapshot({
            paperTitle: updatePaperDto.paperTitle ?? existing.paperTitle,
            year: updatePaperDto.year ?? existing.year,
            examSource: updatePaperDto.examSource ?? existing.examSource,
            keywordsText: updatePaperDto.keywordsText ?? existing.keywordsText,
            status: updatePaperDto.status ?? existing.status,
        });
        this.validatePaperPayload(snapshot);
        this.assertCanModifyExistingStatus(actor, existing.status);
        this.assertCanSaveStatus(actor, snapshot.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writePaperSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'paper', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'paper', id, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'paper',
                entityId: id,
                action: 'updated',
                summary: `Paper ${id} updated`,
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
        return { ok: true, id };
    }
    async remove(id, actor) {
        const paper = await this.findOne(id);
        this.assertCanModifyExistingStatus(actor, paper.status);
        if (paper.questionCount > 0) {
            throw new common_1.BadRequestException('This paper is linked to existing questions and cannot be deleted');
        }
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM papers WHERE id = ?', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'paper',
                entityId: id,
                action: 'deleted',
                summary: `Paper ${id} deleted`,
                actorId: this.getActorId(actor),
                before: paper,
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
       WHERE entity_type = 'paper' AND entity_id = ?
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
            summary: `Paper ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Paper ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Paper ${id} published`,
            actor,
        });
    }
    async rollback(id, versionNumber, actor) {
        if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
            throw new common_1.BadRequestException('Version number is invalid');
        }
        if (!this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Review permission is required to rollback published paper content');
        }
        const existing = await this.findOne(id);
        const [versionRows] = await this.db.execute(`SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'paper' AND entity_id = ? AND version_number = ?
       LIMIT 1`, [id, versionNumber]);
        if (!versionRows[0]) {
            throw new common_1.NotFoundException('Content version not found');
        }
        const snapshot = this.parsePaperSnapshot(versionRows[0].snapshot_json);
        this.validatePaperPayload(snapshot);
        const workflowState = snapshot.status === 'active' ? 'published' : 'draft';
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await this.writePaperSnapshot(connection, id, snapshot);
            await this.recordContentVersion(connection, 'paper', id, snapshot, this.getActorId(actor));
            await this.setWorkflowState(connection, 'paper', id, workflowState, this.getActorId(actor));
            await this.recordContentAudit(connection, {
                entityType: 'paper',
                entityId: id,
                action: 'rolled_back',
                summary: `Paper ${id} rolled back to version ${versionNumber}`,
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
    async keywordSuggestions(query) {
        const [rows] = await this.db.execute('SELECT keywords_text FROM papers WHERE keywords_text IS NOT NULL AND TRIM(keywords_text) <> ""');
        const suggestions = Array.from(new Set(rows
            .flatMap((row) => String(row.keywords_text || '').split(','))
            .map((item) => item.trim())
            .filter(Boolean))).sort((a, b) => a.localeCompare(b));
        if (!query?.trim()) {
            return suggestions;
        }
        const search = query.trim().toLowerCase();
        return suggestions.filter((item) => item.toLowerCase().includes(search));
    }
    async transitionWorkflow(id, input) {
        const existing = await this.findOne(id);
        this.assertCanModifyExistingStatus(input.actor, existing.status);
        this.assertCanSaveStatus(input.actor, input.status);
        const snapshot = this.buildPaperSnapshotFromEntity(existing, input.status);
        this.validatePaperPayload(snapshot);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE papers SET status = ? WHERE id = ?', [input.status, id]);
            await this.recordContentVersion(connection, 'paper', id, snapshot, this.getActorId(input.actor));
            await this.setWorkflowState(connection, 'paper', id, input.workflowState, this.getActorId(input.actor));
            await this.recordContentAudit(connection, {
                entityType: 'paper',
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
    buildPaperSnapshot(paper) {
        return {
            paperTitle: String(paper.paperTitle || '').trim(),
            year: Number(paper.year),
            examSource: paper.examSource === 'erpm' ? 'erpm' : 'local',
            keywordsText: this.normalizeKeywords(paper.keywordsText),
            status: paper.status === 'active' ? 'active' : 'inactive',
        };
    }
    buildPaperSnapshotFromEntity(paper, status) {
        return this.buildPaperSnapshot({
            paperTitle: paper.paperTitle,
            year: Number(paper.year),
            examSource: paper.examSource,
            keywordsText: paper.keywordsText || '',
            status,
        });
    }
    async writePaperSnapshot(connection, id, paper) {
        await connection.execute(`
        UPDATE papers
        SET paper_title = ?, year = ?, exam_source = ?, keywords_text = ?, status = ?
        WHERE id = ?
      `, [
            paper.paperTitle,
            paper.year,
            paper.examSource,
            paper.keywordsText,
            paper.status,
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
    parsePaperSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
        return this.buildPaperSnapshot({
            paperTitle: String(snapshot.paperTitle || ''),
            year: Number(snapshot.year),
            examSource: snapshot.examSource === 'erpm' ? 'erpm' : 'local',
            keywordsText: String(snapshot.keywordsText || ''),
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
            throw new common_1.ForbiddenException('Review permission is required to publish paper content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published papers require review permission before modification');
        }
    }
    validatePaperPayload(paper) {
        if (!paper.paperTitle) {
            throw new common_1.BadRequestException('Paper title is required');
        }
        if (!Number.isInteger(paper.year) || paper.year < 2000 || paper.year > 2100) {
            throw new common_1.BadRequestException('Paper year is invalid');
        }
    }
    normalizeKeywords(raw) {
        return Array.from(new Set(String(raw || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean))).join(', ');
    }
    mapPaper(row) {
        return {
            id: row.id,
            paperTitle: row.paper_title,
            year: Number(row.year),
            examSource: row.exam_source,
            keywordsText: row.keywords_text || '',
            keywords: String(row.keywords_text || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            status: row.status,
            createdAt: row.created_at || null,
            questionCount: Number(row.question_count || 0),
        };
    }
};
exports.PapersService = PapersService;
exports.PapersService = PapersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], PapersService);
//# sourceMappingURL=papers.service.js.map