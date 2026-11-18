import { Pool } from 'mysql2/promise';
import { PaginationInput } from '../../common/utils/pagination';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { BulkDeleteQuizzesDto } from './dto/bulk-delete-quizzes.dto';
import { BulkQuizStatusDto } from './dto/bulk-quiz-status.dto';
export declare class QuizzesService {
    private readonly db;
    private readonly authService;
    private readonly pushNotificationsService;
    constructor(db: Pool, authService: AuthService, pushNotificationsService: PushNotificationsService);
    private resolvePassingMarks;
    private buildListFilter;
    summary(filters: {
        search?: string;
        courseId?: number;
        topicId?: string;
        status?: string;
    }): Promise<{
        courseId: number;
        courseTitle: string;
        isGeneral: boolean;
        topicId: number | null;
        subjectName: string;
        total: number;
        active: number;
    }[]>;
    private summaryFromStoredCounts;
    findAll(filters: {
        search?: string;
        courseId?: number;
        topicId?: string;
        status?: string;
        order?: string;
        after?: number;
        slim?: boolean;
    } & PaginationInput): Promise<{
        id: number;
        courseId: number;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        paperId: number | null;
        category: string;
        collectionTags: string;
        isFree: number;
        subtopic: string;
        isGeneral: number;
        examModeOnly: number;
        adminName: string;
        studentTitle: string;
        displayTitleMode: "title";
        quizNumber: number | null;
        quizTitle: string;
        quizDescription: string;
        totalQuestions: number;
        totalMarks: number;
        timeLimit: number;
        hideTimeLimit: number;
        passingMarks: number;
        hidePassingMarks: number;
        status: "active" | "inactive";
        createdAt: string | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        lessonTitle: string;
        paperTitle: string;
    }[]>;
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
    }>;
    meta(options?: {
        includeQuestions?: boolean;
    }): Promise<{
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
        categories: string[];
        questionTypes: string[];
        usedQuestionIds: number[];
        questions: {
            id: number;
            courseId: number;
            subjectId: number | null;
            topicId: number | null;
            lessonId: number | null;
            paperId: number | null;
            subtopic: string;
            category: string;
            questionType: string;
            questionText: string;
            usageCount: number;
            usedInAnyQuiz: boolean;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            lessonTitle: string;
            paperTitle: string;
        }[];
    }>;
    private loadMeta;
    findOne(id: number): Promise<{
        questionIds: number[];
        id: number;
        courseId: number;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        paperId: number | null;
        category: string;
        collectionTags: string;
        isFree: number;
        subtopic: string;
        isGeneral: number;
        examModeOnly: number;
        adminName: string;
        studentTitle: string;
        displayTitleMode: "title";
        quizNumber: number | null;
        quizTitle: string;
        quizDescription: string;
        totalQuestions: number;
        totalMarks: number;
        timeLimit: number;
        hideTimeLimit: number;
        passingMarks: number;
        hidePassingMarks: number;
        status: "active" | "inactive";
        createdAt: string | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        lessonTitle: string;
        paperTitle: string;
    }>;
    create(createQuizDto: CreateQuizDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, updateQuizDto: UpdateQuizDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(id: number, actor?: ContentActorInput): Promise<{
        ok: boolean;
        id: number;
    }>;
    private planBulkDelete;
    bulkDeletePreview(dto: BulkDeleteQuizzesDto): Promise<{
        quizzes: number;
        questionsInside: number;
        questionsOnlyHere: number;
        questionsShared: number;
        attempts: number;
    }>;
    bulkSetStatus(dto: BulkQuizStatusDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        status: "active" | "inactive";
        changed: number;
        skipped: {
            id: number;
            reason: string;
        }[];
    }>;
    bulkDelete(dto: BulkDeleteQuizzesDto, actor?: ContentActorInput): Promise<{
        ok: boolean;
        deletedQuizzes: number;
        deletedQuestions: number;
        keptQuestions: number;
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
    private validateQuiz;
    private cleanQuestionIds;
    private resolveQuizQuestionCount;
    private buildQuizSnapshot;
    private buildQuizSnapshotFromEntity;
    private transitionWorkflow;
    private writeQuizSnapshot;
    private parseSnapshotJson;
    private parseQuizSnapshot;
    private recordContentVersion;
    private setWorkflowState;
    private recordContentAudit;
    private getActorId;
    private canReviewContent;
    private assertCanSaveStatus;
    private assertCanModifyExistingStatus;
    private replaceQuestionLinks;
    private quizName;
    private resolveAdminName;
    private resolveStudentTitle;
    private resolveDisplayTitleMode;
    private optionalPositiveId;
    private mapQuiz;
    private ensureStudentCanAccessQuiz;
    private getQuizAccessProfile;
    private parseIdList;
    private resolveEffectiveAccessScope;
}
export {};
