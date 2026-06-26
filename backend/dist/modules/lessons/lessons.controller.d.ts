import { AuthService } from '../auth/auth.service';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';
export declare class LessonsController {
    private readonly lessonsService;
    private readonly authService;
    constructor(lessonsService: LessonsService, authService: AuthService);
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
    findAdminList(search?: string, courseId?: string, topicId?: string, subtopicId?: string, status?: string, limit?: string, page?: string, offset?: string): Promise<{
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
    createStudentAnnotation(lessonId: number, createLessonAnnotationDto: CreateLessonAnnotationDto, authorization?: string): Promise<{
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
    updateStudentAnnotation(lessonId: number, annotationId: number, updateLessonAnnotationDto: UpdateLessonAnnotationDto, authorization?: string): Promise<{
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
    create(authorization: string | undefined, createLessonDto: CreateLessonDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updateLessonDto: UpdateLessonDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
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
    markDraft(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    submitForReview(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    publish(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "draft" | "published";
    }>;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
