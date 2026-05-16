import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
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
  }) {
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
      ${whereClause}
      ORDER BY l.created_at DESC, l.id DESC`,
      params
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

  async create(createLessonDto: CreateLessonDto) {
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO lessons
        (course_id, topic_id, subtopic_id, lesson_title, lesson_content, video_url, is_free, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createLessonDto.courseId,
        createLessonDto.topicId,
        createLessonDto.subtopicId,
        createLessonDto.lessonTitle.trim(),
        (createLessonDto.lessonContent || '').trim(),
        (createLessonDto.videoUrl || '').trim(),
        createLessonDto.isFree === 1 ? 1 : 0,
        createLessonDto.status,
      ]
    );

    return {
      ok: true,
      id: result.insertId,
    };
  }

  async update(id: number, updateLessonDto: UpdateLessonDto) {
    const existing = await this.findById(id);

    await this.db.execute(
      `UPDATE lessons
      SET course_id = ?, topic_id = ?, subtopic_id = ?, lesson_title = ?, lesson_content = ?, video_url = ?, is_free = ?, status = ?
      WHERE id = ?`,
      [
        updateLessonDto.courseId || existing.courseId,
        updateLessonDto.topicId || existing.topicId,
        updateLessonDto.subtopicId || existing.subtopicId,
        updateLessonDto.lessonTitle?.trim() || existing.lessonTitle,
        typeof updateLessonDto.lessonContent === 'string'
          ? updateLessonDto.lessonContent.trim()
          : existing.lessonContent,
        typeof updateLessonDto.videoUrl === 'string' ? updateLessonDto.videoUrl.trim() : existing.videoUrl,
        updateLessonDto.isFree !== undefined ? updateLessonDto.isFree : existing.isFree,
        updateLessonDto.status || existing.status,
        id,
      ]
    );

    return {
      ok: true,
      id,
    };
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db.execute('DELETE FROM lessons WHERE id = ?', [id]);

    return {
      ok: true,
      id,
    };
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
