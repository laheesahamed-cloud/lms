import { Pool } from 'mysql2/promise';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
type QuestionFilters = {
    search?: string;
    status?: string;
    type?: string;
    category?: string;
    usage?: string;
    courseId?: number;
    subjectId?: number;
    topicId?: number;
    lessonId?: number;
    paperId?: number;
    unclassified?: boolean;
    missing?: 'explanation' | 'why_incorrect' | 'approach' | 'theory' | 'any';
    ids?: number[];
    excludeIds?: number[];
    limit?: number;
    page?: number;
    offset?: number;
    random?: boolean;
    after?: number;
    slim?: boolean;
};
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class QuestionsService {
    private readonly db;
    constructor(db: Pool);
    findAll(filters: QuestionFilters): Promise<{
        id: number;
        courseId: number;
        subjectId: number;
        topicId: number | null;
        lessonId: number | null;
        paperId: number | null;
        topicLabel: string;
        category: string;
        questionType: "sba" | "true_false";
        questionText: string;
        explanation: string;
        explanationImageUrl: string;
        questionApproach: string;
        questionApproachHighlights: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | Date | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        lessonTitle: string;
        paperTitle: string;
        quizCount: number;
        contentVersion: number | null;
    }[]>;
    countByFilters(filters: QuestionFilters): Promise<{
        total: number;
        unused: number;
        used: number;
    }>;
    private loadCountsByFilters;
    meta(): Promise<{
        courses: {
            id: number;
            courseTitle: string;
        }[];
        subjects: {
            id: number;
            courseId: number;
            subjectName: string;
        }[];
        topics: {
            id: number;
            subjectId: number;
            courseId: number;
            topicName: string;
        }[];
        lessons: {
            id: number;
            courseId: number;
            subjectId: number;
            topicId: number | null;
            lessonTitle: string;
        }[];
        papers: {
            id: number;
            paperTitle: string;
            year: number;
            examSource: string;
            keywordsText: string;
        }[];
    }>;
    metaFolders(): Promise<{
        courses: {
            id: number;
            courseTitle: string;
        }[];
        subjects: {
            id: number;
            courseId: number;
            subjectName: string;
        }[];
        topics: never[];
        lessons: never[];
        papers: {
            id: number;
            paperTitle: string;
            year: number;
            examSource: string;
            keywordsText: string;
        }[];
    }>;
    metaSubject(topicId: number): Promise<{
        topicId: number;
        topics: {
            id: number;
            subjectId: number;
            courseId: number;
            topicName: string;
        }[];
        lessons: {
            id: number;
            courseId: number;
            subjectId: number;
            topicId: number | null;
            lessonTitle: string;
        }[];
    }>;
    fixLinkCounts(after: number): Promise<{
        lastId: number;
        done: boolean;
        maxId: number;
        fixed: {
            id: number;
            stored: number;
            actual: number;
        }[];
        changed: {
            id: number;
            stored: number;
            actual: number;
        }[];
        courseCounts: Record<number, number>;
        courseTotals: Record<number, number> | undefined;
    }>;
    fixCourseQuestionTotals(counts: unknown, expected: unknown): Promise<{
        fixed: {
            id: number;
            name: string;
            stored: number;
            actual: number;
        }[];
        changed: {
            id: number;
            name: string;
            stored: number;
            actual: number;
        }[];
    }>;
    metaSubjects(topicIds: number[]): Promise<{
        subjects: {
            topicId: number;
            topics: {
                id: number;
                subjectId: number;
                courseId: number;
                topicName: string;
            }[];
            lessons: {
                id: number;
                courseId: number;
                subjectId: number;
                topicId: number | null;
                lessonTitle: string;
            }[];
        }[];
    }>;
    private loadMeta;
    findOne(id: number): Promise<{
        options: {
            id: number;
            optionLabel: string;
            optionText: string;
            isCorrect: number;
            whyIncorrect: string;
        }[];
        id: number;
        courseId: number;
        subjectId: number;
        topicId: number | null;
        lessonId: number | null;
        paperId: number | null;
        topicLabel: string;
        category: string;
        questionType: "sba" | "true_false";
        questionText: string;
        explanation: string;
        explanationImageUrl: string;
        questionApproach: string;
        questionApproachHighlights: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        updatedAt: string | Date | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        lessonTitle: string;
        paperTitle: string;
        quizCount: number;
        contentVersion: number | null;
    }>;
    exportWorkbook(filters: QuestionFilters, actor?: ContentActorInput): Promise<Buffer<ArrayBuffer>>;
    importWorkbook(file: any, actor?: ContentActorInput): Promise<{
        ok: boolean;
        importedCount: number;
        failedCount: number;
        importedIds: number[];
        errors: string[];
    }>;
    private readImportRows;
    private parseCsvRows;
    private validateImportHeaders;
    private validateImportRowSafety;
    private containsEmbeddedMediaPayload;
    private buildImportFingerprint;
    private findInFileImportDuplicateErrors;
    private findExistingImportDuplicateErrors;
    private escapeCsvCell;
    create(createQuestionDto: CreateQuestionDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateQuestionDto: UpdateQuestionDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    bulkDelete(bulkDeleteQuestionsDto: BulkDeleteQuestionsDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        deletedCount: number;
        linkedQuestionCount: number;
        linkedQuizCount: number;
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
    private ensureHierarchyExists;
    private buildQuestionSnapshot;
    private buildQuestionSnapshotFromEntity;
    private transitionWorkflow;
    private writeQuestionSnapshot;
    private parseSnapshotJson;
    private parseQuestionSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private recordAdminAuditEvent;
    private serializeQuestionFilters;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private ensureExists;
    private validateQuestionPayload;
    private validateQuestionPublishReady;
    private replaceOptions;
    private normalizeWhyIncorrect;
    private normalizeCategory;
    private normalizeLegacyCategory;
    private loadQuestionsForExport;
    private loadOptionsForQuestionIds;
    private buildEmptyExportRow;
    private loadImportLookups;
    private mapImportRowToPayload;
    private normalizeImportCategory;
    private normalizeImportQuestionType;
    private normalizeImportStatus;
    private parseImportBoolean;
    private normalizeLookup;
    private cleanExplanationImage;
    private serializeApproachHighlights;
    private parseApproachHighlights;
    private mapQuestionSummary;
}
export {};
