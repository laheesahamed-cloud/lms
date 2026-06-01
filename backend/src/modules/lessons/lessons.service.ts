import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { normalizePagination, PaginationInput } from '../../common/utils/pagination';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';

type LessonRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number;
  subtopic_id: number | null;
  lesson_title: string;
  lesson_content: string | null;
  video_url: string | null;
  is_free: number;
  status: 'active' | 'inactive';
  created_at: string | null;
  course_title?: string | null;
  topic_name?: string | null;
  subtopic_name?: string | null;
};

type LookupRow = RowDataPacket & {
  id: number;
  course_title?: string;
  topic_name?: string;
  subtopic_name?: string;
  course_id?: number;
  topic_id?: number;
  status?: string;
};

type UserRow = RowDataPacket & {
  id: number;
  role: 'admin' | 'student';
  status: 'active' | 'inactive';
};

type AccessScopeRow = RowDataPacket & {
  feature_key: string | null;
  plan_slug: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
};

type LessonAccessProfile = {
  hasAnyPaidLessonAccess: boolean;
  hasFullAccess: boolean;
  courseIds: Set<number>;
  lessonIds: Set<number>;
};

type LessonAnnotationRow = RowDataPacket & {
  id: number;
  lesson_id: number;
  user_id: number;
  type: 'highlight' | 'note';
  selected_text: string;
  start_offset: number;
  end_offset: number;
  color: string | null;
  note_text: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';

type LessonSnapshot = {
  courseId: number;
  topicId: number;
  subtopicId: number;
  lessonTitle: string;
  lessonContent: string;
  videoUrl: string;
  isFree: 0 | 1;
  status: 'active' | 'inactive';
};

@Injectable()
export class LessonsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async getMeta() {
    const [courses] = await this.db.execute<LookupRow[]>(
      "SELECT id, course_title, status FROM courses ORDER BY course_title ASC"
    );
    const [topics] = await this.db.execute<LookupRow[]>(
      "SELECT id, course_id, topic_name, status FROM topics ORDER BY topic_name ASC"
    );
    const [subtopics] = await this.db.execute<LookupRow[]>(
      "SELECT id, topic_id, subtopic_name, status FROM subtopics ORDER BY subtopic_name ASC"
    );

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

  async findAdminList(filters: {
    search?: string;
    courseId?: number;
    topicId?: number;
    subtopicId?: number;
    status?: string;
  } & PaginationInput) {
    const { limit, offset } = normalizePagination(filters, { defaultLimit: 50, maxLimit: 100 });
    const conditions: string[] = [];
    const params: Array<string | number> = [];

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

    const [rows] = await this.db.execute<LessonRow[]>(
      `SELECT
        l.id,
        l.course_id,
        l.topic_id,
        l.subtopic_id,
        l.lesson_title,
        NULL AS lesson_content,
        l.video_url,
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
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows.map((row) => this.mapLesson(row));
  }

  async findStudentList(authorization?: string) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    const accessProfile = await this.getLessonAccessProfile(student.id);

    const [rows] = await this.db.execute<LessonRow[]>(
      `SELECT
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
      ORDER BY l.created_at DESC, l.id DESC`
    );

    return rows.map((row) => this.mapStudentLesson(row, accessProfile));
  }

  async findStudentLesson(id: number, authorization?: string) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    const lesson = await this.findById(id);

    if (lesson.status !== 'active') {
      throw new NotFoundException('Lesson not found');
    }

    const accessProfile = await this.getLessonAccessProfile(student.id);
    if (!this.canAccessLesson(lesson, accessProfile)) {
      throw new ForbiddenException('Your subscription does not include this premium lesson');
    }

    return {
      ...lesson,
      excerpt: this.toExcerpt(lesson.lessonContent || ''),
    };
  }

  async findStudentAnnotations(lessonId: number, authorization?: string) {
    const user = await this.findActiveStudentByToken(this.extractToken(authorization));
    await this.ensureStudentCanAccessLesson(lessonId, user.id);

    const [rows] = await this.db.execute<LessonAnnotationRow[]>(
      `
        SELECT id, lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text, created_at, updated_at
        FROM lesson_annotations
        WHERE lesson_id = ? AND user_id = ?
        ORDER BY start_offset ASC, id ASC
      `,
      [lessonId, user.id]
    );

    return rows.map((row) => this.mapAnnotation(row));
  }

  async createStudentAnnotation(lessonId: number, dto: CreateLessonAnnotationDto, authorization?: string) {
    const user = await this.findActiveStudentByToken(this.extractToken(authorization));
    const lesson = await this.ensureStudentCanAccessLesson(lessonId, user.id);
    const lessonText = this.toPlainText(lesson.lessonContent || '');
    this.validateAnnotationPayload(dto, lessonText.length);

    const [result] = await this.db.execute<ResultSetHeader>(
      `
        INSERT INTO lesson_annotations
          (lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        lessonId,
        user.id,
        dto.type,
        dto.selectedText.trim(),
        dto.startOffset,
        dto.endOffset,
        (dto.color || '').trim() || '#fff59d',
        (dto.noteText || '').trim() || null,
      ]
    );

    const created = await this.findAnnotationById(result.insertId);
    return this.mapAnnotation(created);
  }

  async updateStudentAnnotation(
    lessonId: number,
    annotationId: number,
    dto: UpdateLessonAnnotationDto,
    authorization?: string
  ) {
    const user = await this.findActiveStudentByToken(this.extractToken(authorization));
    await this.ensureStudentCanAccessLesson(lessonId, user.id);
    const annotation = await this.findOwnedAnnotation(annotationId, lessonId, user.id);

    await this.db.execute(
      `
        UPDATE lesson_annotations
        SET color = ?, note_text = ?
        WHERE id = ? AND lesson_id = ? AND user_id = ?
      `,
      [
        typeof dto.color === 'string' ? dto.color.trim() || annotation.color : annotation.color,
        typeof dto.noteText === 'string' ? dto.noteText.trim() || null : annotation.noteText,
        annotationId,
        lessonId,
        user.id,
      ]
    );

    const updated = await this.findAnnotationById(annotationId);
    return this.mapAnnotation(updated);
  }

  async removeStudentAnnotation(lessonId: number, annotationId: number, authorization?: string) {
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

  async create(createLessonDto: CreateLessonDto, actor?: ContentActorInput) {
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
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lessons
          (course_id, topic_id, subtopic_id, lesson_title, lesson_content, video_url, is_free, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapshot.courseId,
          snapshot.topicId,
          snapshot.subtopicId || null,
          snapshot.lessonTitle,
          snapshot.lessonContent,
          snapshot.videoUrl,
          snapshot.isFree,
          snapshot.status,
        ]
      );

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

  async update(id: number, updateLessonDto: UpdateLessonDto, actor?: ContentActorInput) {
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
    this.assertCanSaveStatus(actor, snapshot.status);
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
       WHERE entity_type = 'lesson' AND entity_id = ?
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
      summary: `Lesson ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Lesson ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Lesson ${id} published`,
      actor,
      requirePublishReady: true,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
      throw new BadRequestException('Version number is invalid');
    }

    if (!this.canReviewContent(actor)) {
      throw new ForbiddenException('Review permission is required to rollback published lesson content');
    }

    const existing = await this.findById(id);
    const [versionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT snapshot_json
       FROM content_versions
       WHERE entity_type = 'lesson' AND entity_id = ? AND version_number = ?
       LIMIT 1`,
      [id, versionNumber]
    );

    if (!versionRows[0]) {
      throw new NotFoundException('Content version not found');
    }

    const snapshot = this.parseLessonSnapshot(versionRows[0].snapshot_json);
    this.validateLessonPayload(snapshot);
    if (snapshot.status === 'active') {
      this.validateLessonPublishReady(snapshot);
    }
    await this.ensureLessonHierarchyExists(snapshot);

    const workflowState: ContentWorkflowState = snapshot.status === 'active' ? 'published' : 'draft';
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
      requirePublishReady?: boolean;
    }
  ) {
    const existing = await this.findById(id);
    this.assertCanModifyExistingStatus(input.actor, existing.status);
    this.assertCanSaveStatus(input.actor, input.status);
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

  private buildLessonSnapshot(lesson: CreateLessonDto | LessonSnapshot): LessonSnapshot {
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

  private buildLessonSnapshotFromEntity(
    lesson: Awaited<ReturnType<LessonsService['findById']>>,
    status: 'active' | 'inactive',
  ) {
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

  private async writeLessonSnapshot(connection: PoolConnection, id: number, lesson: LessonSnapshot) {
    await connection.execute(
      `UPDATE lessons
       SET course_id = ?, topic_id = ?, subtopic_id = ?, lesson_title = ?, lesson_content = ?, video_url = ?, is_free = ?, status = ?
       WHERE id = ?`,
      [
        lesson.courseId,
        lesson.topicId,
        lesson.subtopicId || null,
        lesson.lessonTitle,
        lesson.lessonContent,
        lesson.videoUrl,
        lesson.isFree,
        lesson.status,
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

  private parseLessonSnapshot(value: unknown): LessonSnapshot {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<LessonSnapshot>;
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

  private async ensureLessonHierarchyExists(lesson: LessonSnapshot) {
    await this.ensureExists('courses', lesson.courseId, 'Selected course was not found');
    await this.ensureExists('topics', lesson.topicId, 'Selected subject was not found');

    if (lesson.subtopicId) {
      await this.ensureExists('subtopics', lesson.subtopicId, 'Selected topic was not found');
    }
  }

  private async ensureExists(tableName: 'courses' | 'topics' | 'subtopics', id: number, message: string) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(message);
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM ${tableName} WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) {
      throw new BadRequestException(message);
    }
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
      throw new ForbiddenException('Review permission is required to publish lesson content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published lessons require review permission before modification');
    }
  }

  private validateLessonPayload(lesson: LessonSnapshot) {
    if (!lesson.courseId || lesson.courseId <= 0) {
      throw new BadRequestException('Please select a course');
    }

    if (!lesson.topicId || lesson.topicId <= 0) {
      throw new BadRequestException('Please select a subject');
    }

    if (!lesson.lessonTitle) {
      throw new BadRequestException('Lesson title is required');
    }
  }

  private validateLessonPublishReady(lesson: LessonSnapshot) {
    if (!lesson.lessonContent && !lesson.videoUrl) {
      throw new BadRequestException('Published lessons require lesson content or an approved video URL');
    }
  }

  private async findById(id: number) {
    const [rows] = await this.db.execute<LessonRow[]>(
      `SELECT
        l.id,
        l.course_id,
        l.topic_id,
        l.subtopic_id,
        l.lesson_title,
        l.lesson_content,
        l.video_url,
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
      LIMIT 1`,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }

    return this.mapLesson(row);
  }

  private async ensureActiveLessonExists(lessonId: number) {
    const lesson = await this.findById(lessonId);
    if (lesson.status !== 'active') {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  private async ensureStudentCanAccessLesson(lessonId: number, userId: number) {
    const lesson = await this.ensureActiveLessonExists(lessonId);
    const accessProfile = await this.getLessonAccessProfile(userId);

    if (!this.canAccessLesson(lesson, accessProfile)) {
      throw new ForbiddenException('Your subscription does not include this premium lesson');
    }

    return lesson;
  }

  private async getLessonAccessProfile(userId: number): Promise<LessonAccessProfile> {
    const [rows] = await this.db.execute<AccessScopeRow[]>(
      `
        SELECT sf.feature_key, plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND sf.feature_key IN ('lessons_access_full', 'lessons_access_limited', 'notes_canvas_study_mode')
      `,
      [userId]
    );

    const profile: LessonAccessProfile = {
      hasAnyPaidLessonAccess: rows.length > 0,
      hasFullAccess: false,
      courseIds: new Set<number>(),
      lessonIds: new Set<number>(),
    };

    for (const row of rows) {
      const courseIds = this.parseIdList(row.course_ids_json);
      const lessonIds = this.parseIdList(row.lesson_ids_json);
      const scope = this.resolveEffectiveAccessScope(row, courseIds, lessonIds);

      if (scope === 'all' && courseIds.length === 0 && lessonIds.length === 0) {
        profile.hasFullAccess = true;
      } else if (scope === 'courses') {
        courseIds.forEach((id) => profile.courseIds.add(id));
      } else if (scope === 'lessons') {
        lessonIds.forEach((id) => profile.lessonIds.add(id));
      }
    }

    return profile;
  }

  private parseIdList(raw: string | null) {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  private resolveEffectiveAccessScope(row: AccessScopeRow, courseIds: number[], lessonIds: number[]) {
    const planSlug = String(row.plan_slug || '').trim();
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
  }

  private canAccessLesson(
    lesson: { id: number; courseId?: number; course_id?: number; isFree?: number; is_free?: number },
    profile: LessonAccessProfile
  ) {
    if (Number(lesson.isFree ?? lesson.is_free) === 1) return true;
    if (!profile.hasAnyPaidLessonAccess) return false;
    if (profile.hasFullAccess) return true;
    return profile.courseIds.has(Number(lesson.courseId ?? lesson.course_id)) || profile.lessonIds.has(Number(lesson.id));
  }

  private validateAnnotationPayload(dto: CreateLessonAnnotationDto, lessonLength: number) {
    if (!dto.selectedText.trim()) {
      throw new BadRequestException('Selected text is required');
    }

    if (dto.endOffset <= dto.startOffset) {
      throw new BadRequestException('Annotation selection range is invalid');
    }

    if (dto.endOffset > lessonLength) {
      throw new BadRequestException('Annotation selection is outside the lesson content');
    }

    if (dto.type === 'note' && !(dto.noteText || '').trim()) {
      throw new BadRequestException('Note text is required for note annotations');
    }
  }

  private async findAnnotationById(id: number) {
    const [rows] = await this.db.execute<LessonAnnotationRow[]>(
      `
        SELECT id, lesson_id, user_id, type, selected_text, start_offset, end_offset, color, note_text, created_at, updated_at
        FROM lesson_annotations
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    const annotation = rows[0];
    if (!annotation) {
      throw new NotFoundException('Annotation not found');
    }

    return annotation;
  }

  private async findOwnedAnnotation(annotationId: number, lessonId: number, userId: number) {
    const annotation = await this.findAnnotationById(annotationId);

    if (annotation.lesson_id !== lessonId || annotation.user_id !== userId) {
      throw new ForbiddenException('You can only edit or delete your own annotations');
    }

    return this.mapAnnotation(annotation);
  }

  private mapLesson(row: LessonRow) {
    return {
      id: row.id,
      courseId: row.course_id,
      topicId: row.topic_id,
      subtopicId: row.subtopic_id || 0,
      lessonTitle: row.lesson_title,
      lessonContent: row.lesson_content || '',
      videoUrl: row.video_url || '',
      isFree: Number(row.is_free) === 1 ? 1 : 0,
      status: row.status,
      createdAt: row.created_at || null,
      updatedAt: row.created_at || null,
      courseTitle: row.course_title || '',
      topicName: row.topic_name || '',
      subtopicName: row.subtopic_name || '',
    };
  }

  private mapStudentLesson(row: LessonRow, accessProfile: LessonAccessProfile) {
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

  private mapAnnotation(row: LessonAnnotationRow) {
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

  private extractToken(authorization?: string) {
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    return token;
  }

  private async findActiveStudentByToken(sessionToken: string) {
    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, role, status
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(sessionToken)]
    );
    const user = rows[0];

    if (!user || user.role !== 'student') {
      throw new UnauthorizedException('Student access required');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Your student account is not active yet');
    }

    return user;
  }

  private toExcerpt(content: string) {
    const plain = this.toPlainText(content);
    if (!plain) {
      return 'Lesson content available inside the lesson viewer.';
    }
    return plain.length > 180 ? `${plain.slice(0, 177)}...` : plain;
  }

  private toPlainText(content: string) {
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

}
