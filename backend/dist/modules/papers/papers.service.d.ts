import { Pool } from 'mysql2/promise';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class PapersService {
    private readonly db;
    constructor(db: Pool);
    findAll(filters: {
        search?: string;
        status?: string;
    }): Promise<{
        id: number;
        paperTitle: string;
        year: number;
        examSource: "local" | "erpm";
        keywordsText: string;
        keywords: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        questionCount: number;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        paperTitle: string;
        year: number;
        examSource: "local" | "erpm";
        keywordsText: string;
        keywords: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        questionCount: number;
    }>;
    create(createPaperDto: CreatePaperDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updatePaperDto: UpdatePaperDto, actor?: ContentActorInput): Promise<{
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
    keywordSuggestions(query?: string): Promise<string[]>;
    private transitionWorkflow;
    private buildPaperSnapshot;
    private buildPaperSnapshotFromEntity;
    private writePaperSnapshot;
    private parseSnapshotJson;
    private parsePaperSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private validatePaperPayload;
    private normalizeKeywords;
    private mapPaper;
}
export {};
