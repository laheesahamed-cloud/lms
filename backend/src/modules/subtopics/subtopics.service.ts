import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';

type SubtopicRow = RowDataPacket & {
  id: number;
  topic_id: number;
  subtopic_name: string;
  status: 'active' | 'inactive';
  created_at?: string | null;
};

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';

type SubtopicSnapshot = {
  topicId: number;
  subtopicName: string;
  status: 'active' | 'inactive';
};

@Injectable()
export class SubtopicsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(topicId?: number) {
    let sql = `
      SELECT id, topic_id, subtopic_name, status, created_at
      FROM subtopics
    `;
    const params: Array<number> = [];

    if (topicId) {
      sql += ' WHERE topic_id = ?';
      params.push(topicId);
    }

    sql += ' ORDER BY subtopic_name ASC';

    const [rows] = await this.db.execute<SubtopicRow[]>(sql, params);
    return rows.map((row) => this.mapSubtopic(row));
  }

  async create(createSubtopicDto: CreateSubtopicDto, actor?: ContentActorInput) {
    const snapshot = this.buildSubtopicSnapshot(createSubtopicDto);
    this.validateSubtopicPayload(snapshot);
    this.assertCanSaveStatus(actor, snapshot.status);
    await this.ensureTopicExists(snapshot.topicId);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)',
        [snapshot.topicId, snapshot.subtopicName, snapshot.status]
      );
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updateSubtopicDto: UpdateSubtopicDto, actor?: ContentActorInput) {
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      ok: true,
      id,
    };
  }

  async remove(id: number, actor?: ContentActorInput) {
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      ok: true,
      id,
    };
  }

  async listVersions(id: number) {
    await this.findById(id);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'subtopic' AND entity_id = ?
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
      summary: `Subtopic ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Subtopic ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Subtopic ${id} published`,
      actor,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
      throw new BadRequestException('Version number is invalid');
    }

    if (!this.canReviewContent(actor)) {
      throw new ForbiddenException('Review permission is required to rollback published subtopic content');
    }

    const existing = await this.findById(id);
    const [versionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'subtopic' AND entity_id = ? AND version_number = ?
       LIMIT 1`,
      [id, versionNumber]
    );

    if (!versionRows[0]) {
      throw new NotFoundException('Content version not found');
    }

    const snapshot = this.parseSubtopicSnapshot(versionRows[0].snapshot_json);
    this.validateSubtopicPayload(snapshot);
    await this.ensureTopicExists(snapshot.topicId);

    const workflowState: ContentWorkflowState = snapshot.status === 'active' ? 'published' : 'draft';
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

  private buildSubtopicSnapshot(subtopic: CreateSubtopicDto | SubtopicSnapshot): SubtopicSnapshot {
    return {
      topicId: Number(subtopic.topicId),
      subtopicName: String(subtopic.subtopicName || '').trim(),
      status: subtopic.status === 'active' ? 'active' : 'inactive',
    };
  }

  private buildSubtopicSnapshotFromEntity(
    subtopic: Awaited<ReturnType<SubtopicsService['findById']>>,
    status: 'active' | 'inactive',
  ) {
    return this.buildSubtopicSnapshot({
      topicId: Number(subtopic.topicId),
      subtopicName: subtopic.subtopicName,
      status,
    });
  }

  private async writeSubtopicSnapshot(connection: PoolConnection, id: number, subtopic: SubtopicSnapshot) {
    await connection.execute(
      'UPDATE subtopics SET topic_id = ?, subtopic_name = ?, status = ? WHERE id = ?',
      [
        subtopic.topicId,
        subtopic.subtopicName,
        subtopic.status,
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

  private parseSubtopicSnapshot(value: unknown): SubtopicSnapshot {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<SubtopicSnapshot>;
    return this.buildSubtopicSnapshot({
      topicId: Number(snapshot.topicId),
      subtopicName: String(snapshot.subtopicName || ''),
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
      throw new ForbiddenException('Review permission is required to publish subtopic content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published subtopics require review permission before modification');
    }
  }

  private validateSubtopicPayload(subtopic: SubtopicSnapshot) {
    if (!subtopic.topicId || subtopic.topicId <= 0) {
      throw new BadRequestException('Please select a topic');
    }

    if (!subtopic.subtopicName) {
      throw new BadRequestException('Subtopic name is required');
    }
  }

  private async findById(id: number) {
    const [rows] = await this.db.execute<SubtopicRow[]>(
      'SELECT id, topic_id, subtopic_name, status, created_at FROM subtopics WHERE id = ? LIMIT 1',
      [id]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Subtopic not found');
    }
    return this.mapSubtopic(row);
  }

  private async ensureTopicExists(topicId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT id FROM topics WHERE id = ? LIMIT 1', [topicId]);
    if (rows.length === 0) {
      throw new BadRequestException('Selected topic was not found');
    }
  }

  private mapSubtopic(row: SubtopicRow) {
    return {
      id: row.id,
      topicId: row.topic_id,
      subtopicName: row.subtopic_name,
      status: row.status,
      createdAt: row.created_at || null,
    };
  }
}
