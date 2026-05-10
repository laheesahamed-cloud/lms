import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';

type CourseRow = RowDataPacket & {
  id: number;
  course_title: string;
  course_code: string;
  description: string | null;
  exam_type: string;
  status: 'active' | 'inactive';
  created_at?: string | null;
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

@Injectable()
export class CoursesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly plansService: PlansService,
  ) {}

  async findAll() {
    const [rows] = await this.db.execute<CourseRow[]>(
      'SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses ORDER BY course_title ASC'
    );

    return rows.map(this.mapCourse);
  }

  async create(createCourseDto: CreateCourseDto) {
    const [result] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO courses (course_title, course_code, description, exam_type, status) VALUES (?, ?, ?, ?, ?)',
      [
        createCourseDto.courseTitle.trim(),
        createCourseDto.courseCode.trim(),
        (createCourseDto.description || '').trim(),
        createCourseDto.examType.trim(),
        createCourseDto.status,
      ]
    );

    return {
      ok: true,
      id: result.insertId,
    };
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const existing = await this.findById(id);

    await this.db.execute(
      'UPDATE courses SET course_title = ?, course_code = ?, description = ?, exam_type = ?, status = ? WHERE id = ?',
      [
        updateCourseDto.courseTitle?.trim() || existing.courseTitle,
        updateCourseDto.courseCode?.trim() || existing.courseCode,
        typeof updateCourseDto.description === 'string' ? updateCourseDto.description.trim() : existing.description,
        updateCourseDto.examType?.trim() || existing.examType,
        updateCourseDto.status || existing.status,
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
    await this.db.execute('DELETE FROM courses WHERE id = ?', [id]);

    return {
      ok: true,
      id,
    };
  }

  async findStudentCourses(authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    const [courseRows] = await this.db.execute<CourseRow[]>(
      `SELECT id, course_title, course_code, description, exam_type, status, created_at
       FROM courses
       WHERE status = 'active'
       ORDER BY course_title ASC`
    );

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
    const [courseRows] = await this.db.execute<CourseRow[]>(
      `SELECT id, course_title, course_code, description, exam_type, status, created_at
       FROM courses
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
      [courseId]
    );

    const courseRow = courseRows[0];
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
    const [lessonRows] = await this.db.execute<LessonHierarchyRow[]>(
      `SELECT id, course_id, topic_id, subtopic_id, lesson_title, video_url, is_free, status
       FROM lessons
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
      [lessonId]
    );

    const lesson = lessonRows[0];
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const accessProfile = await this.getLessonAccessProfile(student.id);
    const hasLessonAccess = this.canAccessLesson(lesson, accessProfile);
    if (!hasLessonAccess) {
      throw new NotFoundException('Upgrade to access this lesson');
    }

    const normalized = this.normalizeProgressPayload(dto);

    await this.db.execute(
      `INSERT INTO student_lesson_progress
        (user_id, course_id, subject_id, topic_id, lesson_id, status, progress_percent, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        course_id = VALUES(course_id),
        subject_id = VALUES(subject_id),
        topic_id = VALUES(topic_id),
        status = VALUES(status),
        progress_percent = VALUES(progress_percent),
        started_at = VALUES(started_at),
        completed_at = VALUES(completed_at),
        updated_at = CURRENT_TIMESTAMP`,
      [
        student.id,
        lesson.course_id,
        lesson.topic_id,
        Number(lesson.subtopic_id || 0),
        lesson.id,
        normalized.status,
        normalized.progressPercent,
        normalized.startedAt,
        normalized.completedAt,
      ]
    );

    return {
      ok: true,
      lessonId: lesson.id,
      status: normalized.status,
      progressPercent: normalized.progressPercent,
      actionLabel: this.getLessonActionLabel(normalized.status),
    };
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

    const placeholders = courseIds.map(() => '?').join(',');
    const [subjectRows] = await this.db.execute<SubjectRow[]>(
      `SELECT id, course_id, topic_name, status
       FROM topics
       WHERE status = 'active' AND course_id IN (${placeholders})
       ORDER BY topic_name ASC`,
      courseIds
    );
    const [topicRows] = await this.db.execute<TopicRow[]>(
      `SELECT s.id, s.topic_id, s.subtopic_name, s.status
       FROM subtopics s
       INNER JOIN topics t ON t.id = s.topic_id
       WHERE s.status = 'active' AND t.course_id IN (${placeholders})
       ORDER BY s.subtopic_name ASC`,
      courseIds
    );
    const [lessonRows] = await this.db.execute<LessonHierarchyRow[]>(
      `SELECT id, course_id, topic_id, subtopic_id, lesson_title, video_url, is_free, status
       FROM lessons
       WHERE status = 'active' AND course_id IN (${placeholders})
       ORDER BY lesson_title ASC, id ASC`,
      courseIds
    );
    const [progressRows] = await this.db.execute<ProgressRow[]>(
      `SELECT lesson_id, status, progress_percent, started_at, completed_at
       FROM student_lesson_progress
       WHERE user_id = ? AND course_id IN (${placeholders})`,
      [userId, ...courseIds]
    );

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
    const [rows] = await this.db.execute<AccessScopeRow[]>(
      `
        SELECT sf.feature_key, us.access_scope, us.course_ids_json, us.lesson_ids_json
        FROM user_subscriptions us
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
          AND sf.feature_key IN ('lessons_access_full', 'lessons_access_limited')
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
      const scope = row.access_scope || 'all';
      if (scope === 'all') {
        profile.hasFullAccess = true;
      } else if (scope === 'courses') {
        this.parseIdList(row.course_ids_json).forEach((id) => profile.courseIds.add(id));
      } else if (scope === 'lessons') {
        this.parseIdList(row.lesson_ids_json).forEach((id) => profile.lessonIds.add(id));
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
    };
  }
}
