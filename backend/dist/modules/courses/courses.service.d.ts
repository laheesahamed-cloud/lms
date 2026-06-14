import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
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
    constructor(db: Pool, authService: AuthService, plansService: PlansService);
    findAll(): Promise<{
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
    listVersions(id: number): Promise<{
        id: number;
        versionNumber: number;
        createdBy: number | null;
        createdAt: any;
        snapshot: any;
    }[]>;
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
    rollback(id: number, versionNumber: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft";
    }>;
    findStudentCourses(authorization?: string): Promise<{
        subjectCount: any;
        progressPercent: any;
        completedLessonsCount: any;
        totalLessonsCount: any;
        actionLabel: string;
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
        ok: boolean;
        lessonId: number;
        status: "not_started" | "in_progress" | "completed";
        progressPercent: number;
        actionLabel: string;
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
