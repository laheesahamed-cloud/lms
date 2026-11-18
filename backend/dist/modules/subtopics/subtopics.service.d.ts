import { Pool } from 'mysql2/promise';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class SubtopicsService {
    private readonly db;
    constructor(db: Pool);
    findAll(topicId?: number): Promise<{
        id: number;
        topicId: number;
        subtopicName: string;
        status: "inactive" | "active";
        sortOrder: number;
        createdAt: string | null;
    }[]>;
    create(createSubtopicDto: CreateSubtopicDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateSubtopicDto: UpdateSubtopicDto, actor?: ContentActorInput): Promise<{
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
        status: "inactive" | "active";
        workflowState: ContentWorkflowState;
    }>;
    submitForReview(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        status: "inactive" | "active";
        workflowState: ContentWorkflowState;
    }>;
    publish(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
        status: "inactive" | "active";
        workflowState: ContentWorkflowState;
    }>;
    rollback(id: number, versionNumber: number, actor?: ContentActorInput): Promise<void>;
    private transitionWorkflow;
    private buildSubtopicSnapshot;
    private buildSubtopicSnapshotFromEntity;
    private writeSubtopicSnapshot;
    private parseSnapshotJson;
    private parseSubtopicSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private validateSubtopicPayload;
    private findById;
    private ensureTopicExists;
    private mapSubtopic;
}
export {};
