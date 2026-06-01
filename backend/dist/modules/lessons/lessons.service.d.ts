import { Pool } from 'mysql2/promise';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class LessonsService {
    private readonly db;
    constructor(db: Pool);
    getMeta(): Promise<{
        courses: {
            id: number;
            courseTitle: string;
            status: string;
        }[];
        topics: {
            id: number;
            courseId: number;
            topicName: string;
            status: string;
        }[];
        subtopics: {
            id: number;
            topicId: number;
            subtopicName: string;
            status: string;
        }[];
    }>;
    findAdminList(filters: {
        search?: string;
        courseId?: number;
        topicId?: number;
        subtopicId?: number;
        status?: string;
    } & PaginationInput): Promise<{
        id: number;
        courseId: number;
        topicId: number;
        subtopicId: number;
        lessonTitle: string;
        lessonContent: string;
        videoUrl: string;
        isFree: number;
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | null;
        courseTitle: string;
        topicName: string;
        subtopicName: string;
    }[]>;
    findStudentList(authorization?: string): Promise<{
        lessonContent: string;
        videoUrl: string;
        excerpt: string;
        canAccess: boolean;
        accessLocked: boolean;
        lockReason: string;
        id: number;
        courseId: number;
        topicId: number;
        subtopicId: number;
        lessonTitle: string;
        isFree: number;
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | null;
        courseTitle: string;
        topicName: string;
        subtopicName: string;
    }[]>;
    findStudentLesson(id: number, authorization?: string): Promise<{
        excerpt: string;
        id: number;
        courseId: number;
        topicId: number;
        subtopicId: number;
        lessonTitle: string;
        lessonContent: string;
        videoUrl: string;
        isFree: number;
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | null;
        courseTitle: string;
        topicName: string;
        subtopicName: string;
    }>;
    findStudentAnnotations(lessonId: number, authorization?: string): Promise<{
        id: number;
        lessonId: number;
        userId: number;
        type: "note" | "highlight";
        selectedText: string;
        startOffset: number;
        endOffset: number;
        color: string;
        noteText: string;
        createdAt: string | null;
        updatedAt: string | null;
    }[]>;
    createStudentAnnotation(lessonId: number, dto: CreateLessonAnnotationDto, authorization?: string): Promise<{
        id: number;
        lessonId: number;
        userId: number;
        type: "note" | "highlight";
        selectedText: string;
        startOffset: number;
        endOffset: number;
        color: string;
        noteText: string;
        createdAt: string | null;
        updatedAt: string | null;
    }>;
    updateStudentAnnotation(lessonId: number, annotationId: number, dto: UpdateLessonAnnotationDto, authorization?: string): Promise<{
        id: number;
        lessonId: number;
        userId: number;
        type: "note" | "highlight";
        selectedText: string;
        startOffset: number;
        endOffset: number;
        color: string;
        noteText: string;
        createdAt: string | null;
        updatedAt: string | null;
    }>;
    removeStudentAnnotation(lessonId: number, annotationId: number, authorization?: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    create(createLessonDto: CreateLessonDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateLessonDto: UpdateLessonDto, actor?: ContentActorInput): Promise<{
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
        workflowState: "draft" | "published";
    }>;
    private transitionWorkflow;
    private buildLessonSnapshot;
    private buildLessonSnapshotFromEntity;
    private writeLessonSnapshot;
    private parseSnapshotJson;
    private parseLessonSnapshot;
    private ensureLessonHierarchyExists;
    private ensureExists;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private validateLessonPayload;
    private validateLessonPublishReady;
    private findById;
    private ensureActiveLessonExists;
    private ensureStudentCanAccessLesson;
    private getLessonAccessProfile;
    private parseIdList;
    private resolveEffectiveAccessScope;
    private canAccessLesson;
    private validateAnnotationPayload;
    private findAnnotationById;
    private findOwnedAnnotation;
    private mapLesson;
    private mapStudentLesson;
    private mapAnnotation;
    private extractToken;
    private findActiveStudentByToken;
    private toExcerpt;
    private toPlainText;
}
export {};
