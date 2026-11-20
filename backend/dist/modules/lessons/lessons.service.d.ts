import { ConfigService } from '@nestjs/config';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export type CanvasEngineKey = 'gemini' | 'openai';
type LessonFlashcardStatus = 'draft' | 'approved' | 'rejected';
type LessonFlashcardGeneratedBy = 'ai' | 'manual';
export interface NoteSection {
    heading: string;
    bullets: string[];
    callout: string;
    sticky_note: string;
    mnemonic: string;
    type?: string;
    headers?: string[];
    rows?: string[][];
    span?: string;
    steps?: string[];
    embedded_flow?: string[];
    embedded_table?: {
        headers: string[];
        rows: string[][];
    };
    embedded_label?: string;
    anchor_topic?: string;
    root?: string;
    branches?: Array<{
        label: string;
        detail?: string;
    }>;
    unnumbered?: boolean;
}
export interface NoteResult {
    title: string;
    subtitle: string;
    sections: NoteSection[];
    summary_box: string;
    key_points: string[];
    visual_style?: {
        theme: string;
        look: string;
        colors: string[];
    };
}
export interface NoteCanvas {
    pages: NoteResult[];
}
export type LessonGenerationProgress = (stage: string, message: string) => void;
export interface LessonGenerationJob {
    status: 'running' | 'done' | 'error';
    partial?: boolean;
    stages: Array<{
        stage: string;
        message: string;
        at: number;
    }>;
    result?: NoteCanvas;
    error?: string;
    createdAt: number;
}
export declare class LessonsService {
    private readonly db;
    private readonly config;
    private readonly pushNotificationsService;
    constructor(db: Pool, config: ConfigService, pushNotificationsService: PushNotificationsService);
    private isAppOnlyBlocked;
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
    uploadPdf(id: number, file: Express.Multer.File, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        pdfUrl: string;
    }>;
    uploadCanvasImage(id: number, file: Express.Multer.File, token: string): Promise<{
        ok: boolean;
        url: string;
    }>;
    static readonly CANVAS_IMAGE_TYPES: Record<string, string>;
    removePdf(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    uploadVideo(id: number, file: Express.Multer.File, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        videoUrl: string;
    }>;
    removeVideo(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    private transitionWorkflow;
    private buildLessonSnapshot;
    private buildLessonSnapshotFromEntity;
    private writeLessonSnapshot;
    private parseSnapshotJson;
    private parseLessonSnapshot;
    private ensureLessonHierarchyExists;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private canEditPublishedContent;
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
    private mapLesson;
    private mapStudentLesson;
    private extractToken;
    private findActiveStudentByToken;
    private toExcerpt;
    private toPlainText;
    normalizeEngineKey(value: string | undefined): CanvasEngineKey;
    private resolveToken;
    private requireAdminToken;
    private requireStudentToken;
    private canvasLessonSelect;
    canvasAdminStructureLessons(topicId: number, token: string, engineKey?: CanvasEngineKey): Promise<{
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
    canvasAdminStructureCounts(token: string, action: {
        step: 'check';
    } | {
        step: 'quick';
        bumpStamps?: boolean;
    } | {
        step: 'start';
        courseId?: number;
        bumpStamps?: boolean;
    } | {
        step: 'set';
        runId: string;
        subjectIds: number[];
        finish?: Array<{
            id: number;
            lessons: number;
            expectedLessons: number;
            expectedSubjects: number;
        }>;
    } | {
        step: 'finish';
        runId: string;
        courses: Array<{
            id: number;
            lessons: number;
            expectedLessons: number;
            expectedSubjects: number;
        }>;
    }): Promise<{
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
    canvasAdminStructureMove(body: {
        kind?: unknown;
        id?: unknown;
        aboveId?: unknown;
        belowId?: unknown;
    }, token: string): Promise<{
        ok: boolean;
        respread: boolean;
    }>;
    canvasAdminFindOne(id: number, token: string, engineKey?: CanvasEngineKey): Promise<{
        id: number;
        title: string;
        lessonTitle: string;
        rawText: string | null;
        noteData: unknown;
        engineKey: CanvasEngineKey;
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
    canvasAdminUpdate(id: number, patch: {
        title?: string;
        rawText?: string;
        noteData?: unknown;
        status?: string;
        courseId?: number | null;
        topicId?: number | null;
        subtopicId?: number | null;
        videoUrl?: string | null;
        isFree?: number | null;
    }, token: string, engineKey?: CanvasEngineKey): Promise<{
        id: number;
    }>;
    canvasAdminRemove(id: number, token: string, engineKey?: CanvasEngineKey): Promise<{
        deleted: boolean;
    }>;
    canvasAdminListFlashcards(id: number, token: string): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: LessonFlashcardStatus;
        sortOrder: number;
        generatedBy: LessonFlashcardGeneratedBy;
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    canvasAdminCreateFlashcard(id: number, payload: {
        question?: string;
        answer?: string;
        sourceHint?: string;
        imageUrl?: string;
        imageUrls?: string[];
        imageFit?: 'contain' | 'cover';
        status?: LessonFlashcardStatus;
    }, token: string): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: LessonFlashcardStatus;
        sortOrder: number;
        generatedBy: LessonFlashcardGeneratedBy;
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    canvasAdminUpdateFlashcard(id: number, cardId: number, patch: {
        question?: string;
        answer?: string;
        sourceHint?: string;
        imageUrl?: string;
        imageUrls?: string[];
        imageFit?: 'contain' | 'cover';
        status?: LessonFlashcardStatus;
        sortOrder?: number;
    }, token: string): Promise<{
        id: number;
        lessonId: number;
        noteId: number;
        question: string;
        answer: string;
        sourceHint: string;
        imageUrl: string;
        imageUrls: string[];
        imageFit: "contain" | "cover";
        status: LessonFlashcardStatus;
        sortOrder: number;
        generatedBy: LessonFlashcardGeneratedBy;
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    canvasAdminRemoveFlashcard(id: number, cardId: number, token: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    canvasAdminGenerateFlashcards(id: number, options: {
        count?: number;
    }, token: string): Promise<{
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
            status: LessonFlashcardStatus;
            sortOrder: number;
            generatedBy: LessonFlashcardGeneratedBy;
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    static readonly CHUNK_LIMIT = 9000;
    static readonly COMPLETENESS_LIMIT = 40000;
    previewSource(text: string, token: string, sourceFormat?: 'text' | 'html'): Promise<{
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
    private cleanSource;
    private countChunks;
    canvasGenerate(text: string, token: string, onProgress?: LessonGenerationProgress, sourceFormat?: 'text' | 'html', onPartial?: (canvas: NoteCanvas) => void): Promise<NoteCanvas>;
    private generateChunkResilient;
    startCanvasGenerate(text: string, token: string, sourceFormat?: 'text' | 'html'): Promise<{
        jobId: string;
    }>;
    getCanvasGenerateJob(jobId: string, token: string): Promise<LessonGenerationJob>;
    private pruneOldGenerationJobs;
    private splitSourceIntoChunks;
    private stripHeadingNumber;
    private normalizeTopicKey;
    private static readonly TOPIC_FAMILIES;
    private static readonly TOPIC_ORDER;
    private topicFamily;
    private reorderByCanonicalTopic;
    private static readonly ASIDE_PATTERNS;
    private isAsideHeading;
    private mergeAsideFields;
    private foldAsideInto;
    private renumberSections;
    private groupSectionFamilies;
    private mergeCanvases;
    private ensureCompleteness;
    regenerateSection(noteId: number, heading: string, token: string): Promise<NoteCanvas>;
    private buildSectionPrompt;
    private buildCompletenessPrompt;
    private static readonly CANVAS_CATALOG_TTL_MS;
    private readonly canvasCatalogCache;
    private readonly canvasCatalogInflight;
    private forgetCanvasCatalog;
    private getCanvasStudentCatalog;
    canvasStudentList(token: string, engineKey?: CanvasEngineKey, appClient?: string): Promise<{
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
        engineKey: CanvasEngineKey;
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
    freeSamples(): Promise<{
        lessons: {
            item: any;
            full: any;
        }[];
        decks: {
            lessonId: number;
            flashcards: unknown[];
        }[];
    }>;
    canvasStudentFindNote(id: number, token: string, engineKey?: CanvasEngineKey, appClient?: string): Promise<Record<string, unknown> | {
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
        engineKey: CanvasEngineKey;
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
    private appLessonOpen;
    canvasStudentFlashcards(id: number, token: string, engineKey?: CanvasEngineKey, appClient?: string): Promise<{
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
            status: LessonFlashcardStatus;
            sortOrder: number;
            generatedBy: LessonFlashcardGeneratedBy;
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    getCourses(token: string): Promise<RowDataPacket[]>;
    getTopics(courseId: number | undefined, token: string): Promise<RowDataPacket[]>;
    getSubtopics(topicId: number | undefined, token: string): Promise<RowDataPacket[]>;
    private ensureDefaultLessonHierarchy;
    private findCanvasLessonRow;
    private findFlashcardRowsForLesson;
    private findFlashcardsForLesson;
    private findApprovedFlashcardsForLesson;
    private findFlashcardById;
    private getNextFlashcardSortOrder;
    private insertGeneratedFlashcards;
    private mapFlashcard;
    private deserializeCanvas;
    private mapCanvasStudentNote;
    private getCanvasAccessProfile;
    private canAccessCanvasLesson;
    private resolveActiveCanvasProvider;
    private safeDecryptSecret;
    private generateWithProvider;
    private requestBudget;
    private parseCanvasJson;
    private generateWithGeminiProvider;
    private readGeminiStream;
    private generateWithChatProvider;
    private sendChatCanvasPrompt;
    private isUnsupportedOpenAiJsonModeError;
    private runFlashcardJsonPrompt;
    private parseJsonResponse;
    private buildFlashcardPrompt;
    private extractFlashcardSourceText;
    private normalizeGeneratedFlashcards;
    private normalizeFlashcardInput;
    private normalizeFlashcardImageFit;
    private normalizeFlashcardStatus;
    private cleanFlashcardText;
    private cleanFlashcardImageUrl;
    private cleanFlashcardImageUrls;
    private parseFlashcardImageUrls;
    private serializeFlashcardImageUrls;
    private assertValidFlashcard;
    private flashcardSignature;
    private splitIntoPages;
    private degluedBullets;
    private validate;
    private normalizePalette;
    private looksLikeHtml;
    private htmlToSourceText;
    private buildPrompt;
}
export {};
