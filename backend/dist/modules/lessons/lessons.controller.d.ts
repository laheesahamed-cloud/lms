import { AuthService } from '../auth/auth.service';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
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
            sortOrder: number;
        }[];
        subtopics: {
            id: number;
            topicId: number;
            subtopicName: string;
            status: string;
            sortOrder: number;
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
        pdfUrl: string;
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
        pdfUrl: string;
        isFree: number;
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | null;
        courseTitle: string;
        topicName: string;
        subtopicName: string;
    }[]>;
    findStudentLesson(id: number, authorization?: string, appClient?: string): Promise<{
        excerpt: string;
        id: number;
        courseId: number;
        topicId: number;
        subtopicId: number;
        lessonTitle: string;
        lessonContent: string;
        videoUrl: string;
        pdfUrl: string;
        isFree: number;
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | null;
        courseTitle: string;
        topicName: string;
        subtopicName: string;
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
    uploadPdf(authorization: string | undefined, id: number, file: Express.Multer.File): Promise<{
        ok: boolean;
        id: number;
        pdfUrl: string;
    }>;
    uploadCanvasImage(authorization: string | undefined, id: number, file: Express.Multer.File): Promise<{
        ok: boolean;
        url: string;
    }>;
    removePdf(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    uploadVideo(authorization: string | undefined, id: number, file: Express.Multer.File): Promise<{
        ok: boolean;
        id: number;
        videoUrl: string;
    }>;
    removeVideo(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listVersions(id: number): Promise<never[]>;
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
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<void>;
    canvasRegenerateSection(auth: string, id: number, heading: string): Promise<import("./lessons.service").NoteCanvas>;
    canvasSourcePreview(auth: string, text: string, sourceFormat?: string): Promise<{
        wasHtml: boolean;
        rawLength: number;
        cleanedLength: number;
        chunks: number;
        completenessLimit: number;
        completenessCapped: boolean;
        budgetMinutes: number;
        preview: string;
        truncatedPreview: boolean;
    }>;
    canvasGenerate(auth: string, text: string, sourceFormat?: string): Promise<import("./lessons.service").NoteCanvas>;
    canvasGenerateStart(auth: string, text: string, sourceFormat?: string): Promise<{
        jobId: string;
    }>;
    canvasGenerateStatus(auth: string, jobId: string): Promise<import("./lessons.service").LessonGenerationJob>;
    canvasAdminStructureLessons(auth: string, topicId?: string, engineKey?: string): Promise<{
        id: number;
        title: any;
        lessonTitle: any;
        status: any;
        courseId: any;
        topicId: any;
        subtopicId: any;
        sortOrder: number;
        isFree: boolean;
        hasNote: boolean;
    }[]>;
    canvasAdminStructureCountsCheck(auth: string): Promise<{
        needFull: boolean;
        reason: "first-run";
        changedSubjects?: undefined;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        reason: "too-many-changes";
        changedSubjects: number;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        done: boolean;
        since: string;
        subjectsChecked: number;
        coursesChecked: number;
        rowsRead: number;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        reason?: undefined;
        changedSubjects?: undefined;
    } | {
        runId: string;
        courses: {
            id: number;
            name: string;
            lessonCount: number;
            subjectCount: number;
        }[];
        first: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
            courseLessons: Record<number, number>;
            rowsRead: number;
        };
        remaining: number[][];
        finishWithLast: boolean;
        done: boolean;
        bumpedStamps: boolean;
        finish: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
        } | null;
    } | {
        done: boolean;
        finish: null;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        courseLessons: Record<number, number>;
        rowsRead: number;
    } | {
        done: boolean;
        bumpedStamps: boolean;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
    } | {
        issues: import("../../common/utils/structure-counts").CountIssue[];
    }>;
    canvasAdminStructureCountsQuick(auth: string, bumpStamps?: boolean): Promise<{
        needFull: boolean;
        reason: "first-run";
        changedSubjects?: undefined;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        reason: "too-many-changes";
        changedSubjects: number;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        done: boolean;
        since: string;
        subjectsChecked: number;
        coursesChecked: number;
        rowsRead: number;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        reason?: undefined;
        changedSubjects?: undefined;
    } | {
        runId: string;
        courses: {
            id: number;
            name: string;
            lessonCount: number;
            subjectCount: number;
        }[];
        first: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
            courseLessons: Record<number, number>;
            rowsRead: number;
        };
        remaining: number[][];
        finishWithLast: boolean;
        done: boolean;
        bumpedStamps: boolean;
        finish: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
        } | null;
    } | {
        done: boolean;
        finish: null;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        courseLessons: Record<number, number>;
        rowsRead: number;
    } | {
        done: boolean;
        bumpedStamps: boolean;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
    } | {
        issues: import("../../common/utils/structure-counts").CountIssue[];
    }>;
    canvasAdminStructureCountsStart(auth: string, courseId?: number, bumpStamps?: boolean): Promise<{
        needFull: boolean;
        reason: "first-run";
        changedSubjects?: undefined;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        reason: "too-many-changes";
        changedSubjects: number;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        done: boolean;
        since: string;
        subjectsChecked: number;
        coursesChecked: number;
        rowsRead: number;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        reason?: undefined;
        changedSubjects?: undefined;
    } | {
        runId: string;
        courses: {
            id: number;
            name: string;
            lessonCount: number;
            subjectCount: number;
        }[];
        first: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
            courseLessons: Record<number, number>;
            rowsRead: number;
        };
        remaining: number[][];
        finishWithLast: boolean;
        done: boolean;
        bumpedStamps: boolean;
        finish: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
        } | null;
    } | {
        done: boolean;
        finish: null;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        courseLessons: Record<number, number>;
        rowsRead: number;
    } | {
        done: boolean;
        bumpedStamps: boolean;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
    } | {
        issues: import("../../common/utils/structure-counts").CountIssue[];
    }>;
    canvasAdminStructureCountsSet(auth: string, body: Record<string, unknown>): Promise<{
        needFull: boolean;
        reason: "first-run";
        changedSubjects?: undefined;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        reason: "too-many-changes";
        changedSubjects: number;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        done: boolean;
        since: string;
        subjectsChecked: number;
        coursesChecked: number;
        rowsRead: number;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        reason?: undefined;
        changedSubjects?: undefined;
    } | {
        runId: string;
        courses: {
            id: number;
            name: string;
            lessonCount: number;
            subjectCount: number;
        }[];
        first: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
            courseLessons: Record<number, number>;
            rowsRead: number;
        };
        remaining: number[][];
        finishWithLast: boolean;
        done: boolean;
        bumpedStamps: boolean;
        finish: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
        } | null;
    } | {
        done: boolean;
        finish: null;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        courseLessons: Record<number, number>;
        rowsRead: number;
    } | {
        done: boolean;
        bumpedStamps: boolean;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
    } | {
        issues: import("../../common/utils/structure-counts").CountIssue[];
    }>;
    canvasAdminStructureCountsFinish(auth: string, body: Record<string, unknown>): Promise<{
        needFull: boolean;
        reason: "first-run";
        changedSubjects?: undefined;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        reason: "too-many-changes";
        changedSubjects: number;
        done?: undefined;
        since?: undefined;
        subjectsChecked?: undefined;
        coursesChecked?: undefined;
        rowsRead?: undefined;
        fixed?: undefined;
        changed?: undefined;
    } | {
        needFull: boolean;
        done: boolean;
        since: string;
        subjectsChecked: number;
        coursesChecked: number;
        rowsRead: number;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        reason?: undefined;
        changedSubjects?: undefined;
    } | {
        runId: string;
        courses: {
            id: number;
            name: string;
            lessonCount: number;
            subjectCount: number;
        }[];
        first: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
            courseLessons: Record<number, number>;
            rowsRead: number;
        };
        remaining: number[][];
        finishWithLast: boolean;
        done: boolean;
        bumpedStamps: boolean;
        finish: {
            fixed: import("../../common/utils/structure-counts").CountIssue[];
            changed: import("../../common/utils/structure-counts").CountIssue[];
        } | null;
    } | {
        done: boolean;
        finish: null;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
        courseLessons: Record<number, number>;
        rowsRead: number;
    } | {
        done: boolean;
        bumpedStamps: boolean;
        fixed: import("../../common/utils/structure-counts").CountIssue[];
        changed: import("../../common/utils/structure-counts").CountIssue[];
    } | {
        issues: import("../../common/utils/structure-counts").CountIssue[];
    }>;
    canvasAdminStructureMove(auth: string, body: Record<string, unknown>): Promise<{
        ok: boolean;
        respread: boolean;
    }>;
    canvasGetCourses(auth: string): Promise<import("mysql2").RowDataPacket[]>;
    canvasGetTopics(auth: string, courseId?: string): Promise<import("mysql2").RowDataPacket[]>;
    canvasGetSubtopics(auth: string, topicId?: string): Promise<import("mysql2").RowDataPacket[]>;
    canvasAdminFindOne(auth: string, id: number, engineKey?: string): Promise<{
        id: number;
        title: string;
        lessonTitle: string;
        rawText: string | null;
        noteData: unknown;
        engineKey: import("./lessons.service").CanvasEngineKey;
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        sortOrder: number;
        lessonId: number;
        videoUrl: string;
        pdfUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        isPublic: boolean;
        courseTitle: string | null;
        examType: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonPdfUrl: string;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        approvedFlashcardCount: number;
        createdAt: string;
        updatedAt: string;
    }>;
    canvasAdminUpdate(auth: string, id: number, body: Record<string, unknown>, engineKey?: string): Promise<{
        id: number;
    }>;
    canvasAdminRemove(auth: string, id: number, engineKey?: string): Promise<{
        deleted: boolean;
    }>;
    canvasAdminListFlashcards(auth: string, id: number): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: "approved" | "rejected" | "draft";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    canvasAdminCreateFlashcard(auth: string, id: number, body: Record<string, unknown>): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: "approved" | "rejected" | "draft";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    canvasAdminGenerateFlashcards(auth: string, id: number, body: {
        count?: number;
    }): Promise<{
        ok: boolean;
        createdCount: number;
        provider: {
            key: "openai" | "gemini" | "claude" | "openrouter";
            label: string;
            model: string;
        };
        items: {
            id: number;
            lessonId: number;
            noteId: number;
            question: string;
            answer: string;
            sourceHint: string;
            imageUrl: string;
            imageUrls: string[];
            imageFit: "contain" | "cover";
            status: "approved" | "rejected" | "draft";
            sortOrder: number;
            generatedBy: "ai" | "manual";
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    canvasAdminUpdateFlashcard(auth: string, id: number, cardId: number, body: Record<string, unknown>): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: "approved" | "rejected" | "draft";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    canvasAdminRemoveFlashcard(auth: string, id: number, cardId: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    canvasStudentList(auth: string, engineKey?: string, appClient?: string): Promise<{
        cardCount: number;
        canAccess: boolean;
        accessLocked: boolean;
        showLock: boolean;
        appOnly: boolean;
        upgradeLabel: string;
        lockReason: string;
        noteData: unknown;
        id: number;
        title: string;
        lessonTitle: string;
        rawText: string | null;
        engineKey: import("./lessons.service").CanvasEngineKey;
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        sortOrder: number;
        lessonId: number;
        videoUrl: string;
        pdfUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        isPublic: boolean;
        courseTitle: string | null;
        examType: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonPdfUrl: string;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        approvedFlashcardCount: number;
        createdAt: string;
        updatedAt: string;
    }[]>;
    canvasStudentFindNote(auth: string, id: number, engineKey?: string, appClient?: string): Promise<Record<string, unknown> | {
        cardCount: number;
        canAccess: boolean;
        accessLocked: boolean;
        showLock: boolean;
        appOnly: boolean;
        upgradeLabel: string;
        lockReason: string;
        noteData: unknown;
        id: number;
        title: string;
        lessonTitle: string;
        rawText: string | null;
        engineKey: import("./lessons.service").CanvasEngineKey;
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        sortOrder: number;
        lessonId: number;
        videoUrl: string;
        pdfUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        isPublic: boolean;
        courseTitle: string | null;
        examType: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonPdfUrl: string;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        approvedFlashcardCount: number;
        createdAt: string;
        updatedAt: string;
    } | {
        lessonType: string;
        lessonId: number;
        lessonTitle: any;
        pdfUrl: string;
        accessLocked: boolean;
        appOnly: boolean;
        lockReason: string;
    }>;
    canvasStudentFlashcards(auth: string, id: number, engineKey?: string, appClient?: string): Promise<{
        flashcards: {
            id: number;
            lessonId: number;
            noteId: number;
            question: string;
            answer: string;
            sourceHint: string;
            imageUrl: string;
            imageUrls: string[];
            imageFit: "contain" | "cover";
            status: "approved" | "rejected" | "draft";
            sortOrder: number;
            generatedBy: "ai" | "manual";
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    private bearerToken;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
