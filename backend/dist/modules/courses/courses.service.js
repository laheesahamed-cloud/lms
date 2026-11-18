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
exports.CoursesService = void 0;
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const course_structure_service_1 = require("./course-structure.service");
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_service_1 = require("../auth/auth.service");
const plans_service_1 = require("../plans/plans.service");
const xp_service_1 = require("../xp/xp.service");
const content_history_1 = require("../../common/utils/content-history");
const admin_read_cache_1 = require("../../common/utils/admin-read-cache");
let CoursesService = class CoursesService {
    constructor(db, authService, plansService, xpService, courseStructure) {
        this.db = db;
        this.authService = authService;
        this.plansService = plansService;
        this.xpService = xpService;
        this.courseStructure = courseStructure;
    }
    getLandingSummary() {
        return (0, admin_read_cache_1.cachedAdminRead)('public.landing-summary', () => this.loadLandingSummary(), 60_000);
    }
    async loadLandingSummary() {
        const [topics] = await this.db.execute(`SELECT t.id, t.topic_name, COUNT(q.id) AS question_count
       FROM topics t
       LEFT JOIN questions q ON q.topic_id = t.id
       WHERE t.status = 'active'
       GROUP BY t.id, t.topic_name
       ORDER BY question_count DESC`);
        const [courses] = await this.db.execute("SELECT id, course_title FROM courses WHERE status = 'active' ORDER BY course_title ASC");
        return {
            topics: topics.map((r) => ({
                id: r['id'],
                name: r['topic_name'],
                questionCount: Number(r['question_count']),
            })),
            courses: courses.map((r) => ({
                id: r['id'],
                title: r['course_title'],
            })),
        };
    }
    async findAll() {
        const [rows] = await this.db.execute('SELECT id, course_title, course_code, description, exam_type, status, created_at, sort_order, lesson_count, subject_count FROM courses FORCE INDEX (idx_courses_sort) ORDER BY sort_order ASC, id ASC');
        return rows.map((row) => this.mapCourse(row));
    }
    async create(createCourseDto, actor) {
        const snapshot = this.buildCourseSnapshot(createCourseDto);
        this.validateCoursePayload(snapshot);
        this.assertCanSaveStatus(actor, snapshot.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(`INSERT INTO courses (course_title, course_code, description, exam_type, status, sort_order)
         SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1000 FROM courses`, [
                snapshot.courseTitle,
                snapshot.courseCode,
                snapshot.description,
                snapshot.examType,
                snapshot.status,
            ]);
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async update(id, updateCourseDto, actor) {
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
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async remove(id, actor) {
        const existing = await this.findById(id);
        this.assertCanModifyExistingStatus(actor, existing.status);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM courses WHERE id = ?', [id]);
            await (0, content_history_1.forgetContentHistory)(connection, 'course', [id]);
            await this.recordContentAudit(connection, {
                entityType: 'course',
                entityId: id,
                action: 'deleted',
                summary: `Course ${id} deleted`,
                actorId: this.getActorId(actor),
                before: existing,
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
        };
    }
    async listVersions(id) {
        void id;
        return [];
    }
    async markDraft(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'draft',
            status: 'inactive',
            action: 'marked_draft',
            summary: `Course ${id} marked as draft`,
            actor,
        });
    }
    async submitForReview(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'in_review',
            status: 'inactive',
            action: 'submitted_for_review',
            summary: `Course ${id} submitted for review`,
            actor,
        });
    }
    async publish(id, actor) {
        return this.transitionWorkflow(id, {
            workflowState: 'published',
            status: 'active',
            action: 'published',
            summary: `Course ${id} published`,
            actor,
        });
    }
    async rollback(id, versionNumber, actor) {
        void id;
        void versionNumber;
        void actor;
        throw new common_1.BadRequestException('Version history is not kept any more.');
    }
    async findStudentCourses(authorization) {
        const student = await this.authService.requireStudent(authorization);
        const courseRows = (await this.courseStructure.get()).courses;
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
                actionLabel: summary.progressPercent > 0 && summary.progressPercent < 100 && summary.totalLessons > 0
                    ? 'Continue'
                    : 'View Course',
            };
        });
    }
    async findStudentCourseDetail(courseId, authorization) {
        const student = await this.authService.requireStudent(authorization);
        const courseRow = (await this.courseStructure.get()).courses.find((c) => Number(c.id) === Number(courseId));
        if (!courseRow) {
            throw new common_1.NotFoundException('Course not found');
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
    async updateStudentLessonProgress(lessonId, dto, authorization) {
        const student = await this.authService.requireStudent(authorization);
        if (dto.status === 'completed')
            return this.completeLesson(student.id, lessonId, dto.readSeconds);
        const normalized = this.normalizeProgressPayload(dto);
        return {
            ok: true,
            lessonId,
            status: normalized.status,
            progressPercent: normalized.progressPercent,
            actionLabel: this.getLessonActionLabel(normalized.status),
        };
    }
    async completeLesson(userId, lessonId, readSeconds) {
        const structure = await this.courseStructure.get();
        const lesson = structure.lessons.find((l) => Number(l.id) === lessonId);
        if (!lesson || lesson.status !== 'active')
            throw new common_1.NotFoundException('Lesson not found');
        const profile = await this.getLessonAccessProfile(userId);
        if (!this.canAccessLesson(lesson, profile)) {
            throw new common_1.NotFoundException('Upgrade to access this lesson');
        }
        const { progressVersion, ...xp } = await this.xpService.onLessonCompleted(userId, lessonId, readSeconds);
        return {
            ok: true,
            lessonId,
            status: 'completed',
            progressPercent: 100,
            actionLabel: this.getLessonActionLabel('completed'),
            xp,
            ...(progressVersion ? { progressVersion } : {}),
        };
    }
    async markLessonOpened(lessonId, authorization) {
        const student = await this.authService.requireStudent(authorization);
        await this.xpService.markLessonOpened(student.id, lessonId);
        return { ok: true };
    }
    async transitionWorkflow(id, input) {
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
    buildCourseSnapshot(course) {
        return {
            courseTitle: String(course.courseTitle || '').trim(),
            courseCode: String(course.courseCode || '').trim(),
            description: String(course.description || '').trim(),
            examType: String(course.examType || '').trim(),
            status: course.status === 'active' ? 'active' : 'inactive',
        };
    }
    buildCourseSnapshotFromEntity(course, status) {
        return this.buildCourseSnapshot({
            courseTitle: course.courseTitle,
            courseCode: course.courseCode,
            description: course.description || '',
            examType: course.examType,
            status,
        });
    }
    async writeCourseSnapshot(connection, id, course) {
        await connection.execute('UPDATE courses SET course_title = ?, course_code = ?, description = ?, exam_type = ?, status = ? WHERE id = ?', [
            course.courseTitle,
            course.courseCode,
            course.description,
            course.examType,
            course.status,
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
    parseCourseSnapshot(value) {
        const parsed = this.parseSnapshotJson(value);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Content version snapshot is invalid');
        }
        const snapshot = parsed;
        return this.buildCourseSnapshot({
            courseTitle: String(snapshot.courseTitle || ''),
            courseCode: String(snapshot.courseCode || ''),
            description: String(snapshot.description || ''),
            examType: String(snapshot.examType || ''),
            status: snapshot.status === 'active' ? 'active' : 'inactive',
        });
    }
    async recordContentVersion(connection, entityType, entityId, snapshot, actorId) {
        void connection;
        void entityType;
        void entityId;
        void snapshot;
        void actorId;
    }
    async setWorkflowState(connection, entityType, entityId, workflowState, actorId) {
        void connection;
        void entityType;
        void entityId;
        void workflowState;
        void actorId;
    }
    async recordContentAudit(connection, event) {
        void 0;
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
            throw new common_1.ForbiddenException('Review permission is required to publish course content');
        }
    }
    assertCanModifyExistingStatus(actor, currentStatus) {
        if (currentStatus === 'active' && !this.canReviewContent(actor)) {
            throw new common_1.ForbiddenException('Published courses require review permission before modification');
        }
    }
    validateCoursePayload(course) {
        if (!course.courseTitle) {
            throw new common_1.BadRequestException('Course title is required');
        }
        if (!course.courseCode) {
            throw new common_1.BadRequestException('Course code is required');
        }
        if (!course.examType) {
            throw new common_1.BadRequestException('Exam type is required');
        }
    }
    async findById(id) {
        const [rows] = await this.db.execute('SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Course not found');
        }
        return this.mapCourse(row);
    }
    async loadHierarchyForCourses(courseIds, userId) {
        if (courseIds.length === 0) {
            return { courseSummaries: new Map(), subjectsByCourse: new Map() };
        }
        const accessProfile = await this.getLessonAccessProfile(userId);
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(courseIds);
        const { subjectRows, topicRows, lessonRows } = await this.getCourseStructure(courseIds);
        const done = await (0, lesson_bits_1.finishedLessons)(this.db, userId);
        const progressRows = lessonRows
            .filter((lesson) => done.has(Number(lesson.id)))
            .map((lesson) => ({ lesson_id: Number(lesson.id), status: 'completed', progress_percent: 100, started_at: null, completed_at: null }));
        return this.buildHierarchy(courseIds, subjectRows, topicRows, lessonRows, progressRows, accessProfile);
    }
    async getCourseStructure(courseIds) {
        const wanted = new Set(courseIds.map(Number));
        const structure = await this.courseStructure.get();
        return {
            subjectRows: structure.subjects.filter((row) => wanted.has(Number(row.course_id))),
            topicRows: structure.topics.filter((row) => wanted.has(Number(row.course_id))),
            lessonRows: structure.lessons.filter((row) => wanted.has(Number(row.course_id))),
        };
    }
    buildHierarchy(courseIds, subjectRows, topicRows, lessonRows, progressRows, accessProfile) {
        const progressByLessonId = new Map(progressRows.map((row) => [row.lesson_id, row]));
        const topicsBySubjectId = new Map();
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
        const subjectsByCourse = new Map();
        const courseSummaries = new Map();
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
    async getLessonAccessProfile(userId) {
        const rows = await (0, subscription_scope_1.getScopeRows)(this.db, userId);
        const profile = {
            hasAnyPaidLessonAccess: rows.length > 0,
            hasFullAccess: false,
            courseIds: new Set(),
            lessonIds: new Set(),
        };
        for (const row of rows) {
            const courseIds = this.parseIdList(row.course_ids_json);
            const lessonIds = this.parseIdList(row.lesson_ids_json);
            const scope = this.resolveEffectiveAccessScope(row, courseIds, lessonIds);
            if (scope === 'all' && courseIds.length === 0 && lessonIds.length === 0) {
                profile.hasFullAccess = true;
            }
            else if (scope === 'courses') {
                courseIds.forEach((id) => profile.courseIds.add(id));
            }
            else if (scope === 'lessons') {
                lessonIds.forEach((id) => profile.lessonIds.add(id));
            }
        }
        return profile;
    }
    parseIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed))
                return [];
            return parsed
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0);
        }
        catch {
            return [];
        }
    }
    resolveEffectiveAccessScope(row, courseIds, lessonIds) {
        const planSlug = String(row.plan_slug || '').trim();
        if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-') || planSlug === 'single-course-3m') {
            return 'courses';
        }
        return row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
    }
    canAccessLesson(lesson, profile) {
        if (Number(lesson.is_free) === 1)
            return true;
        if (!profile.hasAnyPaidLessonAccess)
            return false;
        if (profile.hasFullAccess)
            return true;
        return profile.courseIds.has(Number(lesson.course_id)) || profile.lessonIds.has(Number(lesson.id));
    }
    mapStudentLesson(lesson, progress, accessProfile) {
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
    buildLessonGroupProgress(lessons, progressByLessonId) {
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
    summarizeTopicGroups(topics) {
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
    summarizeSubjects(subjects) {
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
    deriveAggregateStatus(completedLessons, totalLessons, startedCount) {
        if (totalLessons > 0 && completedLessons === totalLessons) {
            return 'completed';
        }
        if (startedCount > 0 || completedLessons > 0) {
            return 'in_progress';
        }
        return 'not_started';
    }
    normalizeProgressPayload(dto) {
        if (dto.status === 'completed') {
            return {
                status: 'completed',
                progressPercent: 100,
                startedAt: new Date(),
                completedAt: new Date(),
            };
        }
        if (dto.status === 'in_progress') {
            const progressPercent = Math.min(99, Math.max(1, Number(dto.progressPercent || 15)));
            return {
                status: 'in_progress',
                progressPercent,
                startedAt: new Date(),
                completedAt: null,
            };
        }
        return {
            status: 'not_started',
            progressPercent: 0,
            startedAt: null,
            completedAt: null,
        };
    }
    getLessonActionLabel(status) {
        if (status === 'completed')
            return 'Review';
        if (status === 'in_progress')
            return 'Continue';
        return 'Start';
    }
    emptyProgressSummary() {
        return {
            totalLessons: 0,
            completedLessons: 0,
            subjectCount: 0,
            completedSubjects: 0,
            progressPercent: 0,
            status: 'not_started',
        };
    }
    mapCourse(row) {
        return {
            id: row.id,
            courseTitle: row.course_title,
            courseCode: row.course_code,
            description: row.description || '',
            examType: row.exam_type,
            status: row.status,
            createdAt: row.created_at || null,
            ...(row.sort_order !== undefined ? { sortOrder: Number(row.sort_order) } : {}),
            ...(row.lesson_count !== undefined ? { lessonCount: Number(row.lesson_count) } : {}),
            ...(row.subject_count !== undefined ? { subjectCount: Number(row.subject_count) } : {}),
        };
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        plans_service_1.PlansService,
        xp_service_1.XpService,
        course_structure_service_1.CourseStructureService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map