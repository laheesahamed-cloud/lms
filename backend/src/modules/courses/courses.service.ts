import { getScopeRows } from '../../common/auth/subscription-scope';
import { CourseStructureService } from './course-structure.service';
import { finishedLessons } from '../../common/utils/lesson-bits';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
import { XpService } from '../xp/xp.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';
import { forgetContentHistory } from '../../common/utils/content-history';
import { cachedAdminRead } from '../../common/utils/admin-read-cache';

type CourseRow = RowDataPacket & {
  id: number;
  course_title: string;
  course_code: string;
  description: string | null;
  exam_type: string;
  status: 'active' | 'inactive';
  created_at?: string | null;
  sort_order?: number;
  lesson_count?: number;
  subject_count?: number;
};

type SubjectRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_name: string;
  status?: string | null;
};

type TopicRow = RowDataPacket & {
  id: number;
  topic_id: number;
  subtopic_name: string;
  status?: string | null;
};

type LessonHierarchyRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_id: number;
  subtopic_id: number | null;
  lesson_title: string;
  video_url: string | null;
  is_free: number;
  status: 'active' | 'inactive';
};

type ProgressRow = RowDataPacket & {
  lesson_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
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

type ContentActor = {
  id: number;
  role?: string;
  permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';

type CourseSnapshot = {
  courseTitle: string;
  courseCode: string;
  description: string;
  examType: string;
  status: 'active' | 'inactive';
};

@Injectable()
export class CoursesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly plansService: PlansService,
    private readonly xpService: XpService,
    private readonly courseStructure: CourseStructureService,
  ) {}

  // Public, identical for every visitor: remembered 60s (cleared on content saves).
  getLandingSummary() {
    return cachedAdminRead('public.landing-summary', () => this.loadLandingSummary(), 60_000);
  }

  private async loadLandingSummary() {
    const [topics] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id, t.topic_name, COUNT(q.id) AS question_count
       FROM topics t
       LEFT JOIN questions q ON q.topic_id = t.id
       WHERE t.status = 'active'
       GROUP BY t.id, t.topic_name
       ORDER BY question_count DESC`
    );
    const [courses] = await this.db.execute<RowDataPacket[]>(
      "SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC"
    );
    return {
      topics: (topics as RowDataPacket[]).map((r) => ({
        id: r['id'] as number,
        name: r['topic_name'] as string,
        questionCount: Number(r['question_count']),
      })),
      courses: (courses as RowDataPacket[]).map((r) => ({
        id: r['id'] as number,
        title: r['course_title'] as string,
      })),
    };
  }

  async findAll() {
    const [rows] = await this.db.execute<CourseRow[]>(
      // Admin course list: stored counts and the course order index, so it reads
      // exactly one row per course. Waits for a recount only if a save made one due.
      // FORCE INDEX: with only a handful of courses MariaDB would otherwise scan and
      // sort (reading each row twice); the index already holds the order.
      'SELECT id, course_title, course_code, description, exam_type, status, created_at, sort_order, lesson_count, subject_count FROM courses FORCE INDEX (idx_courses_sort) ORDER BY sort_order ASC, id ASC'
    );

    return rows.map((row) => this.mapCourse(row));
  }

  async create(createCourseDto: CreateCourseDto, actor?: ContentActorInput) {
    const snapshot = this.buildCourseSnapshot(createCourseDto);
    this.validateCoursePayload(snapshot);
    this.assertCanSaveStatus(actor, snapshot.status);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // A new course goes to the end of the admin order.
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO courses (course_title, course_code, description, exam_type, status, sort_order)
         SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1000 FROM courses`,
        [
          snapshot.courseTitle,
          snapshot.courseCode,
          snapshot.description,
          snapshot.examType,
          snapshot.status,
        ]
      );

      await this.recordContentVersion(connection, 'course', result.insertId, snapshot, this.getActorId(actor));
      await this.setWorkflowState(connection, 'course', result.insertId, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'course',
        entityId: result.insertId,
        action: 'created',
        summary: `Course ${result.insertId} created`,
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

  async update(id: number, updateCourseDto: UpdateCourseDto, actor?: ContentActorInput) {
    const existing = await this.findById(id);
    const snapshot = this.buildCourseSnapshot({
      courseTitle: updateCourseDto.courseTitle ?? existing.courseTitle,
      courseCode: updateCourseDto.courseCode ?? existing.courseCode,
      description: updateCourseDto.description ?? existing.description,
      examType: updateCourseDto.examType ?? existing.examType,
      status: updateCourseDto.status ?? existing.status,
    });

    this.validateCoursePayload(snapshot);
    this.assertCanModifyExistingStatus(actor, existing.status);
    this.assertCanSaveStatus(actor, snapshot.status);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await this.writeCourseSnapshot(connection, id, snapshot);
      await this.recordContentVersion(connection, 'course', id, snapshot, this.getActorId(actor));
      await this.setWorkflowState(connection, 'course', id, snapshot.status === 'active' ? 'published' : 'draft', this.getActorId(actor));
      await this.recordContentAudit(connection, {
        entityType: 'course',
        entityId: id,
        action: 'updated',
        summary: `Course ${id} updated`,
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
      await connection.execute('DELETE FROM courses WHERE id = ?', [id]);
      await forgetContentHistory(connection, 'course', [id]);
      await this.recordContentAudit(connection, {
        entityType: 'course',
        entityId: id,
        action: 'deleted',
        summary: `Course ${id} deleted`,
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
      summary: `Course ${id} marked as draft`,
      actor,
    });
  }

  async submitForReview(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'in_review',
      status: 'inactive',
      action: 'submitted_for_review',
      summary: `Course ${id} submitted for review`,
      actor,
    });
  }

  async publish(id: number, actor?: ContentActorInput) {
    return this.transitionWorkflow(id, {
      workflowState: 'published',
      status: 'active',
      action: 'published',
      summary: `Course ${id} published`,
      actor,
    });
  }

  async rollback(id: number, versionNumber: number, actor?: ContentActorInput) {
    // 10.39: content history tables dropped (never read by the app, website or admin pages).
    void id; void versionNumber; void actor;
    throw new BadRequestException('Version history is not kept any more.');
  }

  async findStudentCourses(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    // Active courses, by title, from the shared snapshot (0 rows per request).
    const courseRows = (await this.courseStructure.get()).courses as unknown as CourseRow[];

    if (courseRows.length === 0) {
      return [];
    }

    const courseIds = courseRows.map((row) => row.id);
    const hierarchy = await this.loadHierarchyForCourses(courseIds, student.id);

    return courseRows.map((row) => {
      const summary = hierarchy.courseSummaries.get(row.id) || this.emptyProgressSummary();
      return {
        ...this.mapCourse(row),
        subjectCount: summary.subjectCount,
        progressPercent: summary.progressPercent,
        completedLessonsCount: summary.completedLessons,
        totalLessonsCount: summary.totalLessons,
        actionLabel:
          summary.progressPercent > 0 && summary.progressPercent < 100 && summary.totalLessons > 0
            ? 'Continue'
            : 'View Course',
      };
    });
  }

  async findStudentCourseDetail(courseId: number, authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const courseRow = (await this.courseStructure.get()).courses.find((c) => Number(c.id) === Number(courseId)) as unknown as CourseRow | undefined;
    if (!courseRow) {
      throw new NotFoundException('Course not found');
    }

    const hierarchy = await this.loadHierarchyForCourses([courseId], student.id);
    const subjects = hierarchy.subjectsByCourse.get(courseId) || [];
    const courseSummary = hierarchy.courseSummaries.get(courseId) || this.emptyProgressSummary();

    return {
      course: {
        ...this.mapCourse(courseRow),
        progressPercent: courseSummary.progressPercent,
        completedSubjectsCount: courseSummary.completedSubjects,
        totalSubjectsCount: courseSummary.subjectCount,
        completedLessonsCount: courseSummary.completedLessons,
        totalLessonsCount: courseSummary.totalLessons,
      },
      subjects,
    };
  }

  async updateStudentLessonProgress(lessonId: number, dto: UpdateStudentLessonProgressDto, authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    if (dto.status === 'completed') return this.completeLesson(student.id, lessonId, dto.readSeconds);
    // "In progress" / "not started" are no longer stored (10.15): lesson
    // progress is the finished-lessons bitmap only, and nothing reads a
    // started state. Answer as before, without a write.
    const normalized = this.normalizeProgressPayload(dto);
    return {
      ok: true,
      lessonId,
      status: normalized.status,
      progressPercent: normalized.progressPercent,
      actionLabel: this.getLessonActionLabel(normalized.status),
    };
  }

  /**
   * "Done" (OPTIMIZE 10.15): the lesson and the plan are checked from the
   * shared course snapshot (in memory) and the signed token — no SQL — and the
   * completion is ONE statement on the student's summary row (XpService):
   * bit, version, XP, streak, today's count. No per-lesson row, no day row.
   */
  private async completeLesson(userId: number, lessonId: number, readSeconds?: number) {
    const structure = await this.courseStructure.get();
    const lesson = structure.lessons.find((l) => Number(l.id) === lessonId);
    if (!lesson || lesson.status !== 'active') throw new NotFoundException('Lesson not found');
    const profile = await this.getLessonAccessProfile(userId);
    if (!this.canAccessLesson(lesson as unknown as LessonHierarchyRow, profile)) {
      throw new NotFoundException('Upgrade to access this lesson');
    }
    const { progressVersion, ...xp } = await this.xpService.onLessonCompleted(userId, lessonId, readSeconds);
    return {
      ok: true,
      lessonId,
      status: 'completed' as const,
      progressPercent: 100,
      actionLabel: this.getLessonActionLabel('completed'),
      xp,
      // The finished-lessons bitmap's new version (10.14): the phone flips the
      // bit itself and keeps this number instead of downloading progress again.
      ...(progressVersion ? { progressVersion } : {}),
    };
  }

  /**
   * The lesson screen has opened. Starts the clock the 60 second check reads
   * when the lesson is later marked complete. Does not touch progress.
   */
  async markLessonOpened(lessonId: number, authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    await this.xpService.markLessonOpened(student.id, lessonId);
    return { ok: true };
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
    const snapshot = this.buildCourseSnapshotFromEntity(existing, input.status);
    this.validateCoursePayload(snapshot);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE courses SET status = ? WHERE id = ?', [input.status, id]);
      await this.recordContentVersion(connection, 'course', id, snapshot, this.getActorId(input.actor));
      await this.setWorkflowState(connection, 'course', id, input.workflowState, this.getActorId(input.actor));
      await this.recordContentAudit(connection, {
        entityType: 'course',
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

  private buildCourseSnapshot(course: CreateCourseDto | CourseSnapshot): CourseSnapshot {
    return {
      courseTitle: String(course.courseTitle || '').trim(),
      courseCode: String(course.courseCode || '').trim(),
      description: String(course.description || '').trim(),
      examType: String(course.examType || '').trim(),
      status: course.status === 'active' ? 'active' : 'inactive',
    };
  }

  private buildCourseSnapshotFromEntity(
    course: Awaited<ReturnType<CoursesService['findById']>>,
    status: 'active' | 'inactive',
  ) {
    return this.buildCourseSnapshot({
      courseTitle: course.courseTitle,
      courseCode: course.courseCode,
      description: course.description || '',
      examType: course.examType,
      status,
    });
  }

  private async writeCourseSnapshot(connection: PoolConnection, id: number, course: CourseSnapshot) {
    await connection.execute(
      'UPDATE courses SET course_title = ?, course_code = ?, description = ?, exam_type = ?, status = ? WHERE id = ?',
      [
        course.courseTitle,
        course.courseCode,
        course.description,
        course.examType,
        course.status,
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

  private parseCourseSnapshot(value: unknown): CourseSnapshot {
    const parsed = this.parseSnapshotJson(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Content version snapshot is invalid');
    }

    const snapshot = parsed as Partial<CourseSnapshot>;
    return this.buildCourseSnapshot({
      courseTitle: String(snapshot.courseTitle || ''),
      courseCode: String(snapshot.courseCode || ''),
      description: String(snapshot.description || ''),
      examType: String(snapshot.examType || ''),
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
      throw new ForbiddenException('Review permission is required to publish course content');
    }
  }

  private assertCanModifyExistingStatus(actor: ContentActorInput, currentStatus: string) {
    if (currentStatus === 'active' && !this.canReviewContent(actor)) {
      throw new ForbiddenException('Published courses require review permission before modification');
    }
  }

  private validateCoursePayload(course: CourseSnapshot) {
    if (!course.courseTitle) {
      throw new BadRequestException('Course title is required');
    }

    if (!course.courseCode) {
      throw new BadRequestException('Course code is required');
    }

    if (!course.examType) {
      throw new BadRequestException('Exam type is required');
    }
  }

  private async findById(id: number) {
    const [rows] = await this.db.execute<CourseRow[]>(
      'SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses WHERE id = ? LIMIT 1',
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Course not found');
    }

    return this.mapCourse(row);
  }

  private async loadHierarchyForCourses(courseIds: number[], userId: number) {
    if (courseIds.length === 0) {
      return { courseSummaries: new Map(), subjectsByCourse: new Map() };
    }

    const accessProfile = await this.getLessonAccessProfile(userId);

    const placeholders = sqlPlaceholders(courseIds);
    const { subjectRows, topicRows, lessonRows } = await this.getCourseStructure(courseIds);
    // Finished lessons from the student's bitmap (10.15: 1 row by primary key,
    // the one place lesson progress is kept).
    const done = await finishedLessons(this.db, userId);
    const progressRows = lessonRows
      .filter((lesson) => done.has(Number(lesson.id)))
      .map((lesson) => ({ lesson_id: Number(lesson.id), status: 'completed', progress_percent: 100, started_at: null, completed_at: null }) as unknown as ProgressRow);
    return this.buildHierarchy(courseIds, subjectRows, topicRows, lessonRows, progressRows, accessProfile);
  }

  // Subjects, topics and ready lessons are the same for every student: they
  // come from the shared snapshot (CourseStructureService), built once per
  // catalogue version in small slices. Only the student's own progress is
  // read per request.
  private async getCourseStructure(courseIds: number[]) {
    const wanted = new Set(courseIds.map(Number));
    const structure = await this.courseStructure.get();
    return {
      subjectRows: structure.subjects.filter((row) => wanted.has(Number(row.course_id))) as unknown as SubjectRow[],
      topicRows: structure.topics.filter((row) => wanted.has(Number(row.course_id))) as unknown as TopicRow[],
      lessonRows: structure.lessons.filter((row) => wanted.has(Number(row.course_id))) as unknown as LessonHierarchyRow[],
    };
  }

  private buildHierarchy(
    courseIds: number[],
    subjectRows: SubjectRow[],
    topicRows: TopicRow[],
    lessonRows: LessonHierarchyRow[],
    progressRows: ProgressRow[],
    accessProfile: Awaited<ReturnType<CoursesService['getLessonAccessProfile']>>,
  ) {
    const progressByLessonId = new Map(progressRows.map((row) => [row.lesson_id, row]));
    const topicsBySubjectId = new Map<number, Array<{
      id: string | number;
      topicName: string;
      progressPercent: number;
      completedLessonsCount: number;
      totalLessonsCount: number;
      status: string;
      lessons: Array<Record<string, unknown>>;
    }>>();

    for (const subject of subjectRows) {
      topicsBySubjectId.set(subject.id, []);
    }

    for (const topic of topicRows) {
      const lessons = lessonRows.filter((lesson) => lesson.topic_id === topic.topic_id && Number(lesson.subtopic_id || 0) === topic.id);
      const topicProgress = this.buildLessonGroupProgress(lessons, progressByLessonId);
      const entry = {
        id: topic.id,
        topicName: topic.subtopic_name,
        progressPercent: topicProgress.progressPercent,
        completedLessonsCount: topicProgress.completedLessons,
        totalLessonsCount: topicProgress.totalLessons,
        status: topicProgress.status,
        lessons: lessons.map((lesson) => this.mapStudentLesson(lesson, progressByLessonId.get(lesson.id), accessProfile)),
      };
      topicsBySubjectId.get(topic.topic_id)?.push(entry);
    }

    for (const subject of subjectRows) {
      const directLessons = lessonRows.filter((lesson) => lesson.topic_id === subject.id && !lesson.subtopic_id);
      if (directLessons.length > 0) {
        const directProgress = this.buildLessonGroupProgress(directLessons, progressByLessonId);
        topicsBySubjectId.get(subject.id)?.unshift({
          id: `subject-${subject.id}-general`,
          topicName: 'General lessons',
          progressPercent: directProgress.progressPercent,
          completedLessonsCount: directProgress.completedLessons,
          totalLessonsCount: directProgress.totalLessons,
          status: directProgress.status,
          lessons: directLessons.map((lesson) => this.mapStudentLesson(lesson, progressByLessonId.get(lesson.id), accessProfile)),
        });
      }
    }

    const subjectsByCourse = new Map<number, Array<Record<string, unknown>>>();
    const courseSummaries = new Map<number, ReturnType<CoursesService['emptyProgressSummary']>>();

    for (const courseId of courseIds) {
      const courseSubjects = subjectRows
        .filter((subject) => subject.course_id === courseId)
        .map((subject) => {
          const topics = topicsBySubjectId.get(subject.id) || [];
          const subjectProgress = this.summarizeTopicGroups(topics);
          return {
            id: subject.id,
            subjectName: subject.topic_name,
            progressPercent: subjectProgress.progressPercent,
            completedTopicsCount: subjectProgress.completedTopics,
            totalTopicsCount: subjectProgress.totalTopics,
            completedLessonsCount: subjectProgress.completedLessons,
            totalLessonsCount: subjectProgress.totalLessons,
            status: subjectProgress.status,
            topics,
          };
        });

      subjectsByCourse.set(courseId, courseSubjects);
      courseSummaries.set(courseId, this.summarizeSubjects(courseSubjects));
    }

    return { courseSummaries, subjectsByCourse };
  }

  private async getLessonAccessProfile(userId: number): Promise<LessonAccessProfile> {
    // From this request's signed token when present (no SQL), else the database.
    const rows = await getScopeRows<AccessScopeRow>(this.db, userId);

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
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
  }

  private canAccessLesson(lesson: LessonHierarchyRow, profile: LessonAccessProfile) {
    if (Number(lesson.is_free) === 1) return true;
    if (!profile.hasAnyPaidLessonAccess) return false;
    if (profile.hasFullAccess) return true;
    return profile.courseIds.has(Number(lesson.course_id)) || profile.lessonIds.has(Number(lesson.id));
  }

  private mapStudentLesson(lesson: LessonHierarchyRow, progress: ProgressRow | undefined, accessProfile: LessonAccessProfile) {
    const status = progress?.status || 'not_started';
    const isFree = Number(lesson.is_free) === 1;
    const canAccess = this.canAccessLesson(lesson, accessProfile);
    return {
      id: lesson.id,
      lessonTitle: lesson.lesson_title,
      lessonType: lesson.video_url ? 'Video lesson' : 'Reading lesson',
      duration: null,
      isFree,
      canAccess,
      accessLocked: !canAccess,
      accessMessage: canAccess ? '' : 'Upgrade to access this lesson',
      status,
      progressPercent: Number(progress?.progress_percent || 0),
      actionLabel: canAccess ? this.getLessonActionLabel(status) : 'Unlock',
      startedAt: progress?.started_at || null,
      completedAt: progress?.completed_at || null,
    };
  }

  private buildLessonGroupProgress(lessons: LessonHierarchyRow[], progressByLessonId: Map<number, ProgressRow>) {
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((lesson) => progressByLessonId.get(lesson.id)?.status === 'completed').length;
    const inProgressLessons = lessons.filter((lesson) => {
      const status = progressByLessonId.get(lesson.id)?.status;
      return status === 'in_progress' || status === 'completed';
    }).length;
    return {
      totalLessons,
      completedLessons,
      progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      status: this.deriveAggregateStatus(completedLessons, totalLessons, inProgressLessons),
    };
  }

  private summarizeTopicGroups(
    topics: Array<{
      progressPercent: number;
      completedLessonsCount: number;
      totalLessonsCount: number;
      status: string;
    }>
  ) {
    const totalLessons = topics.reduce((sum, topic) => sum + topic.totalLessonsCount, 0);
    const completedLessons = topics.reduce((sum, topic) => sum + topic.completedLessonsCount, 0);
    const completedTopics = topics.filter((topic) => topic.totalLessonsCount > 0 && topic.completedLessonsCount === topic.totalLessonsCount).length;
    const inProgressTopics = topics.filter((topic) => topic.status !== 'not_started').length;
    return {
      totalLessons,
      completedLessons,
      totalTopics: topics.length,
      completedTopics,
      progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      status: this.deriveAggregateStatus(completedLessons, totalLessons, inProgressTopics),
    };
  }

  private summarizeSubjects(subjects: Array<{
    progressPercent: number;
    completedTopicsCount: number;
    totalTopicsCount: number;
    completedLessonsCount: number;
    totalLessonsCount: number;
    status: string;
  }>) {
    const totalLessons = subjects.reduce((sum, subject) => sum + subject.totalLessonsCount, 0);
    const completedLessons = subjects.reduce((sum, subject) => sum + subject.completedLessonsCount, 0);
    const subjectCount = subjects.length;
    const completedSubjects = subjects.filter((subject) => subject.totalLessonsCount > 0 && subject.completedLessonsCount === subject.totalLessonsCount).length;
    const inProgressSubjects = subjects.filter((subject) => subject.status !== 'not_started').length;
    return {
      totalLessons,
      completedLessons,
      subjectCount,
      completedSubjects,
      progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      status: this.deriveAggregateStatus(completedLessons, totalLessons, inProgressSubjects),
    };
  }

  private deriveAggregateStatus(completedLessons: number, totalLessons: number, startedCount: number) {
    if (totalLessons > 0 && completedLessons === totalLessons) {
      return 'completed';
    }
    if (startedCount > 0 || completedLessons > 0) {
      return 'in_progress';
    }
    return 'not_started';
  }

  private normalizeProgressPayload(dto: UpdateStudentLessonProgressDto) {
    if (dto.status === 'completed') {
      return {
        status: 'completed' as const,
        progressPercent: 100,
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    if (dto.status === 'in_progress') {
      const progressPercent = Math.min(99, Math.max(1, Number(dto.progressPercent || 15)));
      return {
        status: 'in_progress' as const,
        progressPercent,
        startedAt: new Date(),
        completedAt: null,
      };
    }

    return {
      status: 'not_started' as const,
      progressPercent: 0,
      startedAt: null,
      completedAt: null,
    };
  }

  private getLessonActionLabel(status: 'not_started' | 'in_progress' | 'completed') {
    if (status === 'completed') return 'Review';
    if (status === 'in_progress') return 'Continue';
    return 'Start';
  }

  private emptyProgressSummary() {
    return {
      totalLessons: 0,
      completedLessons: 0,
      subjectCount: 0,
      completedSubjects: 0,
      progressPercent: 0,
      status: 'not_started',
    };
  }

  private mapCourse(row: CourseRow) {
    return {
      id: row.id,
      courseTitle: row.course_title,
      courseCode: row.course_code,
      description: row.description || '',
      examType: row.exam_type,
      status: row.status,
      createdAt: row.created_at || null,
      // Only on the admin list, which selects the stored counts.
      ...(row.sort_order !== undefined ? { sortOrder: Number(row.sort_order) } : {}),
      ...(row.lesson_count !== undefined ? { lessonCount: Number(row.lesson_count) } : {}),
      ...(row.subject_count !== undefined ? { subjectCount: Number(row.subject_count) } : {}),
    };
  }
}
