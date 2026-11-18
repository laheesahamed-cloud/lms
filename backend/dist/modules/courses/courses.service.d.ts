import { CourseStructureService } from './course-structure.service';
import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
import { XpService } from '../xp/xp.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class CoursesService {
    private readonly db;
    private readonly authService;
    private readonly plansService;
    private readonly xpService;
    private readonly courseStructure;
    constructor(db: Pool, authService: AuthService, plansService: PlansService, xpService: XpService, courseStructure: CourseStructureService);
    getLandingSummary(): Promise<{
        topics: {
            id: number;
            name: string;
            questionCount: number;
        }[];
        courses: {
            id: number;
            title: string;
        }[];
    }>;
    private loadLandingSummary;
    findAll(): Promise<{
        subjectCount?: number | undefined;
        lessonCount?: number | undefined;
        sortOrder?: number | undefined;
        id: number;
        courseTitle: string;
        courseCode: string;
        description: string;
        examType: string;
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    create(createCourseDto: CreateCourseDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateCourseDto: UpdateCourseDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    listVersions(id: number): Promise<never[]>;
    markDraft(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: ContentWorkflowState;
    }>;
    submitForReview(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: ContentWorkflowState;
    }>;
    publish(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: ContentWorkflowState;
    }>;
    rollback(id: number, versionNumber: number, actor?: ContentActorInput): Promise<void>;
    findStudentCourses(authorization?: string): Promise<{
        subjectCount: any;
        progressPercent: any;
        completedLessonsCount: any;
        totalLessonsCount: any;
        actionLabel: string;
        lessonCount?: number | undefined;
        sortOrder?: number | undefined;
        id: number;
        courseTitle: string;
        courseCode: string;
        description: string;
        examType: string;
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    findStudentCourseDetail(courseId: number, authorization?: string): Promise<{
        course: {
            progressPercent: any;
            completedSubjectsCount: any;
            totalSubjectsCount: any;
            completedLessonsCount: any;
            totalLessonsCount: any;
            subjectCount?: number | undefined;
            lessonCount?: number | undefined;
            sortOrder?: number | undefined;
            id: number;
            courseTitle: string;
            courseCode: string;
            description: string;
            examType: string;
            status: "active" | "inactive";
            createdAt: string | null;
        };
        subjects: any;
    }>;
    updateStudentLessonProgress(lessonId: number, dto: UpdateStudentLessonProgressDto, authorization?: string): Promise<{
        progressVersion?: number | undefined;
        ok: boolean;
        lessonId: number;
        status: "completed";
        progressPercent: number;
        actionLabel: string;
        xp: {
            awarded: number;
            capped: boolean;
            reason?: "low_score" | "too_fast" | "unverified" | "too_soon" | "nothing_new";
        };
    } | {
        ok: boolean;
        lessonId: number;
        status: "completed" | "not_started" | "in_progress";
        progressPercent: number;
        actionLabel: string;
    }>;
    private completeLesson;
    markLessonOpened(lessonId: number, authorization?: string): Promise<{
        ok: boolean;
    }>;
    private transitionWorkflow;
    private buildCourseSnapshot;
    private buildCourseSnapshotFromEntity;
    private writeCourseSnapshot;
    private parseSnapshotJson;
    private parseCourseSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private validateCoursePayload;
    private findById;
    private loadHierarchyForCourses;
    private getCourseStructure;
    private buildHierarchy;
    private getLessonAccessProfile;
    private parseIdList;
    private resolveEffectiveAccessScope;
    private canAccessLesson;
    private mapStudentLesson;
    private buildLessonGroupProgress;
    private summarizeTopicGroups;
    private summarizeSubjects;
    private deriveAggregateStatus;
    private normalizeProgressPayload;
    private getLessonActionLabel;
    private emptyProgressSummary;
    private mapCourse;
}
export {};
