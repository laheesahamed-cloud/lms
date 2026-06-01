import { Pool } from 'mysql2/promise';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
type TopicEntity = {
    id: number;
    courseId: number;
    topicName: string;
    topicDescription: string;
    status: 'active' | 'inactive';
    createdAt: string | null;
    courseTitle?: string;
    subtopicCount?: number;
};
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
export declare class TopicsService {
    private readonly db;
    constructor(db: Pool);
    findAll(courseId?: number): Promise<TopicEntity[]>;
    findOne(id: number): Promise<{
        subtopics: string[];
        id: number;
        courseId: number;
        topicName: string;
        topicDescription: string;
        status: "active" | "inactive";
        createdAt: string | null;
        courseTitle?: string;
        subtopicCount?: number;
    }>;
    create(createTopicDto: CreateTopicDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateTopicDto: UpdateTopicDto, actor?: ContentActorInput): Promise<{
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
    private buildTopicSnapshot;
    private buildTopicSnapshotFromEntity;
    private writeTopicSnapshot;
    private parseSnapshotJson;
    private parseTopicSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private validateTopicPayload;
    private ensureCourseExists;
    private replaceSubtopics;
    private normalizeSubtopicNames;
    private mapTopic;
}
export {};
