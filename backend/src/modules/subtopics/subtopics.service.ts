import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { bumpCounts, COUNTED_LESSON } from '../../common/utils/structure-counts';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { forgetContentHistory } from '../../common/utils/content-history';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';

type SubtopicRow = RowDataPacket & {
  id: number;
  topic_id: number;
  subtopic_name: string;
  status: 'active' | 'inactive';
  sort_order?: number | null;
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
      SELECT id, topic_id, subtopic_name, status, sort_order, created_at
      FROM subtopics
    `;
    const params: Array<number> = [];

    if (topicId) {
      sql += ' WHERE topic_id = ?';
      params.push(topicId);
    }

    sql += ' ORDER BY sort_order ASC, id ASC';

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

      // New topics land at the end of their subject — admin then drags it
      // into position (e.g. moves "Introduction" up to #1) from the list.
      const [orderRows] = await connection.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM subtopics WHERE topic_id = ?`,
        [snapshot.topicId]
      );
      const nextSortOrder = Number(orderRows[0]?.maxOrder || 0) + 1000; // gap rank (structure-order.ts)

      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO subtopics (topic_id, subtopic_name, status, sort_order) VALUES (?, ?, ?, ?)',
        [snapshot.topicId, snapshot.subtopicName, snapshot.status, nextSortOrder]
      );
      // One more topic on its subject (same transaction).
      await bumpCounts(connection, 'topics', 'subtopic_count', [[snapshot.topicId, 1]]);
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
      // Its lessons stay in the subject (shown as "No topic"), so only the
      // subject's topic count changes.
      const [locked] = await connection.execute<RowDataPacket[]>('SELECT topic_id FROM subtopics WHERE id = ? FOR UPDATE', [id]);
      await connection.execute('DELETE FROM subtopics WHERE id = ?', [id]);
      await forgetContentHistory(connection, 'subtopic', [id]);
      if (locked[0]) await bumpCounts(connection, 'topics', 'subtopic_count', [[Number(locked[0].topic_id), -1]]);
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
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id;
    return [];
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
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id; void versionNumber; void actor;
    throw new BadRequestException('Version history is not kept any more.');
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

  // Used by the topic edit and the version rollback. Moving a topic to another
  // subject takes its lessons with it (and to that subject's course), goes to
  // the end of the new subject, and moves the counts: topic count on both
  // subjects, and the lessons' count on both subjects and, across courses, both
  // courses. Lock order: lessons, then topic/subject rows, then courses.
  private async writeSubtopicSnapshot(connection: PoolConnection, id: number, subtopic: SubtopicSnapshot) {
    const [current] = await connection.execute<RowDataPacket[]>('SELECT topic_id FROM subtopics WHERE id = ?', [id]);
    const moving = current[0] && Number(current[0].topic_id) !== Number(subtopic.topicId);
    if (!moving) {
      await connection.execute(
        'UPDATE subtopics SET subtopic_name = ?, status = ? WHERE id = ?',
        [subtopic.subtopicName, subtopic.status, id],
      );
      return;
    }
    const [counted] = await connection.execute<RowDataPacket[]>(
      `SELECT topic_id, course_id, SUM(${COUNTED_LESSON}) AS n FROM lessons WHERE subtopic_id = ? GROUP BY topic_id, course_id FOR UPDATE`, [id],
    );
    const [locked] = await connection.execute<RowDataPacket[]>('SELECT topic_id FROM subtopics WHERE id = ? FOR UPDATE', [id]);
    const oldSubject = Number(locked[0].topic_id);
    const [target] = await connection.execute<RowDataPacket[]>('SELECT course_id FROM topics WHERE id = ?', [subtopic.topicId]);
    if (!target[0]) throw new BadRequestException('Selected subject was not found');
    const newCourse = Number(target[0].course_id);
    await connection.execute('UPDATE lessons SET topic_id = ?, course_id = ? WHERE subtopic_id = ?', [subtopic.topicId, newCourse, id]);
    await connection.execute(
      `UPDATE subtopics SET topic_id = ?, subtopic_name = ?, status = ?,
         sort_order = (SELECT next_rank FROM (SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_rank FROM subtopics WHERE topic_id = ?) r)
       WHERE id = ?`,
      [subtopic.topicId, subtopic.subtopicName, subtopic.status, subtopic.topicId, id],
    );
    const moved = counted.reduce((t, r) => t + Number(r.n || 0), 0);
    await bumpCounts(connection, 'topics', 'subtopic_count', [[oldSubject, -1], [subtopic.topicId, 1]]);
    await bumpCounts(connection, 'topics', 'lesson_count', [
      ...counted.map((r) => [Number(r.topic_id), -Number(r.n || 0)] as [number, number]),
      [subtopic.topicId, moved],
    ]);
    await bumpCounts(connection, 'courses', 'lesson_count', [
      ...counted.map((r) => [Number(r.course_id), -Number(r.n || 0)] as [number, number]),
      [newCourse, moved],
    ]);
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
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void connection; void entityType; void entityId; void snapshot; void actorId;
  }

  private async setWorkflowState(
    connection: PoolConnection,
    entityType: string,
    entityId: number,
    workflowState: ContentWorkflowState,
    actorId?: number,
  ) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void connection; void entityType; void entityId; void workflowState; void actorId;
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
    void 0; // 10.37: change history no longer stored (table dropped, never read)
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
      'SELECT id, topic_id, subtopic_name, status, sort_order, created_at FROM subtopics WHERE id = ? LIMIT 1',
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
      sortOrder: Number(row.sort_order ?? 0),
      createdAt: row.created_at || null,
    };
  }
}
