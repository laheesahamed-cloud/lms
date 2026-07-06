import { AuthService } from '../auth/auth.service';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
export declare class TopicsController {
    private readonly topicsService;
    private readonly authService;
    constructor(topicsService: TopicsService, authService: AuthService);
    findAll(courseId?: string): Promise<{
        id: number;
        courseId: number;
        topicName: string;
        topicDescription: string;
        status: "active" | "inactive";
        createdAt: string | null;
        courseTitle?: string;
        subtopicCount?: number;
    }[]>;
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
    create(authorization: string | undefined, createTopicDto: CreateTopicDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updateTopicDto: UpdateTopicDto): Promise<{
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
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    submitForReview(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    publish(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft";
    }>;
}
