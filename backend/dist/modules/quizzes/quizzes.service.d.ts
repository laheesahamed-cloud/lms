import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
type ContentActor = {
    id: number;
    role?: string;
    permissions?: readonly string[];
};
type ContentActorInput = ContentActor | number | undefined;
type ContentWorkflowState = 'draft' | 'in_review' | 'published' | 'archived';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
export declare class QuizzesService {
    private readonly db;
    private readonly authService;
    constructor(db: Pool, authService: AuthService);
    private resolvePassingMarks;
    private parseJsonArray;
    findAll(filters: {
        search?: string;
        courseId?: number;
        topicId?: string;
        status?: string;
    }): Promise<{
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
        displayTitleMode: string;
        quizTitle: string;
        quizDescription: string;
        blueprint: {
            sections: {
                id: string;
                title: string;
                targetCount: number;
                courseId: number | null;
                subjectId: number | null;
                topicId: number | null;
                lessonId: number | null;
                paperId: number | null;
                category: string;
                questionType: string;
            }[];
        };
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
        keywordSuggestions: string[];
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
            keywordsText: string;
            usageCount: number;
            usedInAnyQuiz: boolean;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            lessonTitle: string;
            paperTitle: string;
        }[];
    }>;
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
        displayTitleMode: string;
        quizTitle: string;
        quizDescription: string;
        blueprint: {
            sections: {
                id: string;
                title: string;
                targetCount: number;
                courseId: number | null;
                subjectId: number | null;
                topicId: number | null;
                lessonId: number | null;
                paperId: number | null;
                category: string;
                questionType: string;
            }[];
        };
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
    private validateQuiz;
    private cleanQuestionIds;
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
    private appendKeywordsToQuestions;
    private normalizeKeywords;
    private normalizeKeywordArray;
    private resolveAdminName;
    private resolveStudentTitle;
    private resolveDisplayTitleMode;
    private optionalPositiveId;
    private normalizeBlueprintPayload;
    private stringifyBlueprint;
    private parseBlueprint;
    private getKeywordSuggestions;
    private mapQuiz;
    getCards(authorization: string | undefined, quizId: number): Promise<{
        quizTitle: string;
        cards: {
            id: number;
            questionText: string;
            explanation: string;
            questionType: string;
            theoryRecap: {} | null;
            options: {
                id: number;
                optionLabel: string;
                optionText: string;
                isCorrect: boolean;
                whyIncorrect: string;
            }[];
        }[];
    }>;
    private ensureStudentCanAccessQuiz;
    private getQuizAccessProfile;
    private parseIdList;
    private resolveEffectiveAccessScope;
}
export {};
