import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { bumpCounts, COUNTED_LESSON } from '../../common/utils/structure-counts';
import { applyQuizCountChanges, readSubjectQuizStates } from '../../common/utils/quiz-counts';
import { CreateTopicDto } from './dto/create-topic.dto';
import { forgetContentHistory } from '../../common/utils/content-history';
import { UpdateTopicDto } from './dto/update-topic.dto';

type TopicRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_name: string;
  topic_description: string | null;
  status: 'active' | 'inactive';
  sort_order?: number | null;
  created_at?: string | null;
  course_title?: string;
  subtopic_count?: number;
  lesson_count?: number;
};

type TopicEntity = {
  id: number;
  courseId: number;
  topicName: string;
  topicDescription: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  createdAt: string | null;
  courseTitle?: string;
  subtopicCount?: number;
  lessonCount?: number;
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

  // Subject lists read the stored topic and lesson counts (structure-counts.ts)
  // instead of joining and counting every subtopic, so a course's subjects are
  // one indexed read of exactly those rows (idx_topics_sort: course_id, sort_order).
  async findAll(courseId?: number) {
    const columns = `t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.sort_order, t.created_at,
        t.subtopic_count, t.lesson_count`;

    if (courseId) {
      // One course: only its subjects. The caller (the Structure page) already
      // has the course and its name from the course it opened, so it isn't read
      // again: one row per subject listed.
      const [rows] = await this.db.execute<TopicRow[]>(
        `SELECT ${columns} FROM topics t WHERE t.course_id = ? ORDER BY t.sort_order ASC, t.id ASC`,
        [courseId]
      );
      return rows.map((row) => this.mapTopic(row));
    }

    const [rows] = await this.db.execute<TopicRow[]>(
      `SELECT ${columns}, c.course_title
       FROM topics t
       INNER JOIN courses c ON c.id = t.course_id
       ORDER BY t.sort_order ASC, t.id ASC`
    );
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
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Topic not found');
    }

    const topic = this.mapTopic(row);
    const [subtopicRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT subtopic_name FROM subtopics WHERE topic_id = ? ORDER BY sort_order ASC, id ASC',
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

      // New subjects land at the end of their course — admin then drags it
      // into position (e.g. moves "Introduction" up to #1) from the list.
      const [orderRows] = await connection.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM topics WHERE course_id = ?`,
        [snapshot.courseId]
      );
      const nextSortOrder = Number(orderRows[0]?.maxOrder || 0) + 1000; // gap rank (structure-order.ts)

      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO topics (course_id, topic_name, topic_description, status, sort_order) VALUES (?, ?, ?, ?, ?)',
        [
          snapshot.courseId,
          snapshot.topicName,
          snapshot.topicDescription,
          snapshot.status,
          nextSortOrder,
        ]
      );

      await this.syncSubtopics(connection, result.insertId, snapshot.subtopics);
      // One more subject on its course (same transaction).
      await bumpCounts(connection, 'courses', 'subject_count', [[snapshot.courseId, 1]]);
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
      // Deleting a subject also deletes its lessons (foreign key ON DELETE
      // CASCADE). Lock them first (lessons → subject → course, the same order
      // as lesson saves) and count the ones the Structure page counts, per
      // course, so the course loses exactly those.
      const [counted] = await connection.execute<RowDataPacket[]>(
        `SELECT course_id, SUM(${COUNTED_LESSON}) AS n FROM lessons WHERE topic_id = ? GROUP BY course_id FOR UPDATE`, [id],
      );
      // Its assessments stay (foreign key ON DELETE SET NULL) but lose their
      // subject, so their counts move to the course's "no subject" bucket.
      const quizzesBefore = await readSubjectQuizStates(connection, id);
      const [subjectRows] = await connection.execute<RowDataPacket[]>(
        'SELECT course_id FROM topics WHERE id = ? FOR UPDATE', [id],
      );
      const [goneSubtopics] = await connection.execute<RowDataPacket[]>('SELECT id FROM subtopics WHERE topic_id = ?', [id]);
      await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [id]);
      await connection.execute('DELETE FROM topics WHERE id = ?', [id]);
      await forgetContentHistory(connection, 'topic', [id]);
      await forgetContentHistory(connection, 'subtopic', goneSubtopics.map((r) => Number(r.id)));
      await applyQuizCountChanges(connection, quizzesBefore, quizzesBefore.map((q) => ({ ...q, topic_id: null })));
      if (subjectRows[0]) {
        await bumpCounts(connection, 'courses', 'subject_count', [[Number(subjectRows[0].course_id), -1]]);
        await bumpCounts(connection, 'courses', 'lesson_count', counted.map((r) => [Number(r.course_id), -Number(r.n || 0)] as [number, number]));
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

  // Used by the subject edit and the version rollback. Moving a subject to
  // another course takes its lessons with it, and moves its subject count and
  // its lessons' count from the old course to the new one (2 counter rows).
  // Lock order: lessons, then the subject, then courses (same as lesson saves).
  private async writeTopicSnapshot(connection: PoolConnection, id: number, topic: TopicSnapshot) {
    const [current] = await connection.execute<RowDataPacket[]>('SELECT course_id FROM topics WHERE id = ?', [id]);
    const movingCourse = current[0] && Number(current[0].course_id) !== Number(topic.courseId);
    if (movingCourse) {
      const [counted] = await connection.execute<RowDataPacket[]>(
        `SELECT course_id, SUM(${COUNTED_LESSON}) AS n FROM lessons WHERE topic_id = ? GROUP BY course_id FOR UPDATE`, [id],
      );
      // Its assessments move with it too (their counts are kept per subject).
      const quizzesBefore = (await readSubjectQuizStates(connection, id)).filter((q) => q.is_general === 0);
      const [locked] = await connection.execute<RowDataPacket[]>('SELECT course_id FROM topics WHERE id = ? FOR UPDATE', [id]);
      const oldCourse = Number(locked[0].course_id);
      await connection.execute('UPDATE lessons SET course_id = ? WHERE topic_id = ?', [topic.courseId, id]);
      await connection.execute('UPDATE quizzes SET course_id = ? WHERE topic_id = ? AND is_general = 0', [topic.courseId, id]);
      // Subject counts stay; only the courses' assessment totals move.
      await applyQuizCountChanges(connection, quizzesBefore, quizzesBefore.map((q) => ({ ...q, course_id: Number(topic.courseId) })));
      const lessonsMoved = counted.reduce((t, r) => t + Number(r.n || 0), 0);
      await connection.execute(
        `UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ?,
           sort_order = (SELECT next_rank FROM (SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_rank FROM topics WHERE course_id = ?) r)
         WHERE id = ?`,
        [topic.courseId, topic.topicName, topic.topicDescription, topic.status, topic.courseId, id],
      );
      await bumpCounts(connection, 'courses', 'subject_count', [[oldCourse, -1], [topic.courseId, 1]]);
      await bumpCounts(connection, 'courses', 'lesson_count', [
        ...counted.map((r) => [Number(r.course_id), -Number(r.n || 0)] as [number, number]),
        [topic.courseId, lessonsMoved],
      ]);
      return;
    }
    await connection.execute(
      'UPDATE topics SET topic_name = ?, topic_description = ?, status = ? WHERE id = ?',
      [topic.topicName, topic.topicDescription, topic.status, id],
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

  // Brings a subject's topics in line with a list of names WITHOUT recreating
  // them: existing topics keep their id and place (so their lessons stay with
  // them), names no longer listed are deleted, and new names are added at the
  // end. The subject's topic count changes by exactly that difference.
  private async syncSubtopics(connection: PoolConnection, topicId: number, subtopics: string[]) {
    const wanted = this.normalizeSubtopicNames(subtopics);
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, subtopic_name, sort_order FROM subtopics WHERE topic_id = ? FOR UPDATE', [topicId],
    );
    const key = (name: string) => String(name || '').trim().toLowerCase();
    const wantedKeys = new Set(wanted.map(key));
    const existingKeys = new Set(rows.map((r) => key(r.subtopic_name)));
    const toDelete = rows.filter((r) => !wantedKeys.has(key(r.subtopic_name))).map((r) => Number(r.id));
    const toAdd = wanted.filter((name) => !existingKeys.has(key(name)));
    if (toDelete.length) {
      await connection.execute(`DELETE FROM subtopics WHERE id IN (${toDelete.map(() => '?').join(', ')})`, toDelete);
      await forgetContentHistory(connection, 'subtopic', toDelete);
    }
    let rank = rows.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0);
    for (const name of toAdd) {
      rank += 1000; // gap rank (structure-order.ts)
      await connection.execute(
        'INSERT INTO subtopics (topic_id, subtopic_name, status, sort_order) VALUES (?, ?, ?, ?)',
        [topicId, name, 'active', rank],
      );
    }
    await bumpCounts(connection, 'topics', 'subtopic_count', [[topicId, toAdd.length - toDelete.length]]);
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
      sortOrder: Number(row.sort_order ?? 0),
      createdAt: row.created_at || null,
      courseTitle: row.course_title,
      subtopicCount: Number(row.subtopic_count || 0),
      ...(row.lesson_count !== undefined ? { lessonCount: Number(row.lesson_count) } : {}),
    };
  }
}
