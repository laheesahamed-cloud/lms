import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

type TopicRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_name: string;
  topic_description: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  course_title?: string;
  subtopic_count?: number;
};

type TopicEntity = {
  id: number;
  courseId: number;
  topicName: string;
  topicDescription: string;
  status: 'active' | 'inactive';
  createdAt: string | null;
  courseTitle?: string;
  subtopicCount?: number;
};

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';

type TopicSnapshot = {
  courseId: number;
  topicName: string;
  topicDescription: string;
  subtopics: string[];
  status: 'active' | 'inactive';
};

@Injectable()
export class TopicsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(courseId?: number) {
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
    const params: Array<number> = [];

    if (courseId) {
      sql += ' WHERE t.course_id = ?';
      params.push(courseId);
    }

    sql += `
      GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.created_at, c.course_title
      ORDER BY t.topic_name ASC
    `;

    const [rows] = await this.db.execute<TopicRow[]>(sql, params);
    return rows.map((row) => this.mapTopic(row));
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<TopicRow[]>(
      `
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
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Topic not found');
    }

    const topic = this.mapTopic(row);
    const [subtopicRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT subtopic_name FROM subtopics WHERE topic_id = ? ORDER BY subtopic_name ASC',
      [id]
    );

    return {
      ...topic,
      subtopics: subtopicRows.map((item) => item.subtopic_name as string),
    };
  }

  async create(createTopicDto: CreateTopicDto, actor?: ContentActorInput) {
    const snapshot = this.buildTopicSnapshot(createTopicDto);
    this.validateTopicPayload(snapshot);
    this.assertCanSaveStatus(actor, snapshot.status);
    await this.ensureCourseExists(snapshot.courseId);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO topics (course_id, topic_name, topic_description, status) VALUES (?, ?, ?, ?)',
        [
          snapshot.courseId,
          snapshot.topicName,
          snapshot.topicDescription,
          snapshot.status,
        ]
      );

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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updateTopicDto: UpdateTopicDto, actor?: ContentActorInput) {
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

      await connection.execute(
        'UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ? WHERE id = ?',
        [
          snapshot.courseId,
          snapshot.topicName,
          snapshot.topicDescription,
          snapshot.status,
          id,
        ]
      );

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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async remove(id: number, actor?: ContentActorInput) {
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listVersions(id: number) {
    await this.findOne(id);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, version_number, created_by, created_at, snapshot_json
       FROM content_versions
       WHERE entity_type = 'topic' AND entity_id = ?
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
      summary: `Topic ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Topic ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Topic ${id} published`,
      actor,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
      throw new BadRequestException('Version number is invalid');
    }

    if (!this.canReviewContent(actor)) {
      throw new ForbiddenException('Review permission is required to rollback published topic content');
    }

    const existing = await this.findOne(id);
    const [versionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'topic' AND entity_id = ? AND version_number = ?
       LIMIT 1`,
      [id, versionNumber]
    );

    if (!versionRows[0]) {
      throw new NotFoundException('Content version not found');
    }

    const snapshot = this.parseTopicSnapshot(versionRows[0].snapshot_json);
    this.validateTopicPayload(snapshot);
    await this.ensureCourseExists(snapshot.courseId);

    const workflowState: ContentWorkflowState = snapshot.status === 'active' ? 'published' : 'draft';
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

  private buildTopicSnapshot(topic: CreateTopicDto | TopicSnapshot): TopicSnapshot {
    return {
      courseId: Number(topic.courseId),
      topicName: String(topic.topicName || '').trim(),
      topicDescription: String(topic.topicDescription || '').trim(),
      subtopics: this.normalizeSubtopicNames(topic.subtopics || []),
      status: topic.status === 'active' ? 'active' : 'inactive',
    };
  }

  private buildTopicSnapshotFromEntity(
    topic: Awaited<ReturnType<TopicsService['findOne']>>,
    status: 'active' | 'inactive',
  ) {
    return this.buildTopicSnapshot({
      courseId: Number(topic.courseId),
      topicName: topic.topicName,
      topicDescription: topic.topicDescription || '',
      subtopics: topic.subtopics || [],
      status,
    });
  }

  private async writeTopicSnapshot(connection: PoolConnection, id: number, topic: TopicSnapshot) {
    await connection.execute(
      'UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ? WHERE id = ?',
      [
        topic.courseId,
        topic.topicName,
        topic.topicDescription,
        topic.status,
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

  private parseTopicSnapshot(value: unknown): TopicSnapshot {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<TopicSnapshot>;
    return this.buildTopicSnapshot({
      courseId: Number(snapshot.courseId),
      topicName: String(snapshot.topicName || ''),
      topicDescription: String(snapshot.topicDescription || ''),
      subtopics: Array.isArray(snapshot.subtopics) ? snapshot.subtopics.map(String) : [],
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
      throw new ForbiddenException('Review permission is required to publish topic content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published topics require review permission before modification');
    }
  }

  private validateTopicPayload(topic: TopicSnapshot) {
    if (!topic.courseId || topic.courseId <= 0) {
      throw new BadRequestException('Please select a course');
    }

    if (!topic.topicName) {
      throw new BadRequestException('Topic name is required');
    }
  }

  private async ensureCourseExists(courseId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (rows.length === 0) {
      throw new BadRequestException('Selected course was not found');
    }
  }

  private async replaceSubtopics(connection: Pool | any, topicId: number, subtopics: string[]) {
    const cleaned = this.normalizeSubtopicNames(subtopics);

    await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [topicId]);

    for (const subtopic of cleaned) {
      await connection.execute(
        'INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)',
        [topicId, subtopic, 'active']
      );
    }
  }

  private normalizeSubtopicNames(subtopics: string[]) {
    return Array.from(
      new Map(
        subtopics
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => [item.toLowerCase(), item])
      ).values()
    );
  }

  private mapTopic(row: TopicRow): TopicEntity {
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
}
