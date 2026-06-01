import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';

type PaperRow = RowDataPacket & {
  id: number;
  paper_title: string;
  year: number;
  exam_source: 'local' | 'erpm';
  keywords_text: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  question_count?: number;
};

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';

type PaperSnapshot = {
  paperTitle: string;
  year: number;
  examSource: 'local' | 'erpm';
  keywordsText: string;
  status: 'active' | 'inactive';
};

@Injectable()
export class PapersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(filters: { search?: string; status?: string }) {
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
    const params: Array<string> = [];

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

    const [rows] = await this.db.execute<PaperRow[]>(sql, params);
    return rows.map((row) => this.mapPaper(row));
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<PaperRow[]>(
      `
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
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapPaper(row);
  }

  async create(createPaperDto: CreatePaperDto, actor?: ContentActorInput) {
    const snapshot = this.buildPaperSnapshot(createPaperDto);
    this.validatePaperPayload(snapshot);
    this.assertCanSaveStatus(actor, snapshot.status);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO papers (paper_title, year, exam_source, keywords_text, status)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          snapshot.paperTitle,
          snapshot.year,
          snapshot.examSource,
          snapshot.keywordsText,
          snapshot.status,
        ]
      );
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updatePaperDto: UpdatePaperDto, actor?: ContentActorInput) {
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return { ok: true, id };
  }

  async remove(id: number, actor?: ContentActorInput) {
    const paper = await this.findOne(id);
    this.assertCanModifyExistingStatus(actor, paper.status);
    if (paper.questionCount > 0) {
      throw new BadRequestException('This paper is linked to existing questions and cannot be deleted');
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return { ok: true, id };
  }

  async listVersions(id: number) {
    await this.findOne(id);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'paper' AND entity_id = ?
       ORDER BY version_number DESC`,
      [id]
    );

    return rows.map((row) => ({
      id: Number(row.id),
      versionNumber: Number(row.version_number),
      createdBy: row.created_by === null || row.created_by === undefined ? null : Number(row.created_by),
      createdAt: row.created_at || null,
      snapshot: this.parseSnapshotJson(row.snapshot_json),
    }));
  }

  async markDraft(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'draft',
      status: 'inactive',
      action: 'marked_draft',
      summary: `Paper ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Paper ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Paper ${id} published`,
      actor,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
      throw new BadRequestException('Version number is invalid');
    }

    if (!this.canReviewContent(actor)) {
      throw new ForbiddenException('Review permission is required to rollback published paper content');
    }

    const existing = await this.findOne(id);
    const [versionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'paper' AND entity_id = ? AND version_number = ?
       LIMIT 1`,
      [id, versionNumber]
    );

    if (!versionRows[0]) {
      throw new NotFoundException('Content version not found');
    }

    const snapshot = this.parsePaperSnapshot(versionRows[0].snapshot_json);
    this.validatePaperPayload(snapshot);

    const workflowState: ContentWorkflowState = snapshot.status === 'active' ? 'published' : 'draft';
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
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

  async keywordSuggestions(query?: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT keywords_text FROM papers WHERE keywords_text IS NOT NULL AND TRIM(keywords_text) <> ""'
    );

    const suggestions = Array.from(
      new Set(
        rows
          .flatMap((row) => String(row.keywords_text || '').split(','))
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    if (!query?.trim()) {
      return suggestions;
    }

    const search = query.trim().toLowerCase();
    return suggestions.filter((item) => item.toLowerCase().includes(search));
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

  private buildPaperSnapshot(paper: CreatePaperDto | PaperSnapshot): PaperSnapshot {
    return {
      paperTitle: String(paper.paperTitle || '').trim(),
      year: Number(paper.year),
      examSource: paper.examSource === 'erpm' ? 'erpm' : 'local',
      keywordsText: this.normalizeKeywords(paper.keywordsText),
      status: paper.status === 'active' ? 'active' : 'inactive',
    };
  }

  private buildPaperSnapshotFromEntity(
    paper: Awaited<ReturnType<PapersService['findOne']>>,
    status: 'active' | 'inactive',
  ) {
    return this.buildPaperSnapshot({
      paperTitle: paper.paperTitle,
      year: Number(paper.year),
      examSource: paper.examSource,
      keywordsText: paper.keywordsText || '',
      status,
    });
  }

  private async writePaperSnapshot(connection: PoolConnection, id: number, paper: PaperSnapshot) {
    await connection.execute(
      `
        UPDATE papers
        SET paper_title = ?, year = ?, exam_source = ?, keywords_text = ?, status = ?
        WHERE id = ?
      `,
      [
        paper.paperTitle,
        paper.year,
        paper.examSource,
        paper.keywordsText,
        paper.status,
        id,
      ]
    );
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

  private parsePaperSnapshot(value: unknown): PaperSnapshot {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<PaperSnapshot>;
    return this.buildPaperSnapshot({
      paperTitle: String(snapshot.paperTitle || ''),
      year: Number(snapshot.year),
      examSource: snapshot.examSource === 'erpm' ? 'erpm' : 'local',
      keywordsText: String(snapshot.keywordsText || ''),
      status: snapshot.status === 'active' ? 'active' : 'inactive',
    });
  }

  private async recordContentVersion(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    snapshot: unknown,
    actorId?: number,
  ) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM content_versions WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    const versionNumber = Number(rows[0]?.next_version || 1);
    await connection.execute(
      'INSERT INTO content_versions (entity_type, entity_id, version_number, snapshot_json, created_by) VALUES (?, ?, ?, ?, ?)',
      [entityType, entityId, versionNumber, JSON.stringify(snapshot), actorId || null]
    );
  }

  private async setWorkflowState(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    workflowState: ContentWorkflowState,
    actorId?: number,
  ) {
    await connection.execute(
      `INSERT INTO content_workflow_states (entity_type, entity_id, workflow_state, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         workflow_state = VALUES(workflow_state),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [entityType, entityId, workflowState, actorId || null]
    );
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
    await connection.execute(
      `INSERT INTO content_audit_events
        (entity_type, entity_id, action, actor_id, summary, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.entityType,
        event.entityId,
        event.action,
        event.actorId || null,
        event.summary,
        event.before === undefined ? null : JSON.stringify(event.before),
        event.after === undefined ? null : JSON.stringify(event.after),
      ]
    );
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
      throw new ForbiddenException('Review permission is required to publish paper content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published papers require review permission before modification');
    }
  }

  private validatePaperPayload(paper: PaperSnapshot) {
    if (!paper.paperTitle) {
      throw new BadRequestException('Paper title is required');
    }

    if (!Number.isInteger(paper.year) || paper.year < 2000 || paper.year > 2100) {
      throw new BadRequestException('Paper year is invalid');
    }
  }

  private normalizeKeywords(raw?: string) {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).join(', ');
  }

  private mapPaper(row: PaperRow) {
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
}
