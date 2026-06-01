import { Pool } from 'mysql2/promise';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { BulkUpdateQuestionKeywordsDto } from './dto/bulk-update-question-keywords.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
type QuestionFilters = {
    search?: string;
    status?: string;
    type?: string;
    category?: string;
    keywords?: string;
    usage?: string;
    courseId?: number;
    subjectId?: number;
    topicId?: number;
    lessonId?: number;
    paperId?: number;
    unclassified?: boolean;
    ids?: number[];
    excludeIds?: number[];
    limit?: number;
    random?: boolean;
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
        keywordsText: string;
        explanation: string;
        status: "active" | "inactive";
        createdAt: string | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        lessonTitle: string;
        paperTitle: string;
        quizCount: number;
        contentVersion: number | null;
    }[]>;
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
        keywordSuggestions: string[];
    }>;
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
        keywordsText: string;
        explanation: string;
        status: "active" | "inactive";
        createdAt: string | null;
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
    bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto: BulkUpdateQuestionKeywordsDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        updatedCount: number;
        keywords: string[];
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
    private normalizeKeywords;
    private normalizeKeywordArray;
    private getKeywordSuggestions;
    private syncQuestionKeywords;
    private mapQuestionSummary;
}
export {};
