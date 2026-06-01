import { AuthService } from '../auth/auth.service';
import { QuestionsService } from './questions.service';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { BulkUpdateQuestionKeywordsDto } from './dto/bulk-update-question-keywords.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
export declare class QuestionsController {
    private readonly questionsService;
    private readonly authService;
    constructor(questionsService: QuestionsService, authService: AuthService);
    findAll(search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, keywords?: string, usage?: string, ids?: string, excludeIds?: string, limit?: string, page?: string, offset?: string, random?: string): Promise<{
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
    exportQuestions(authorization?: string, search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, keywords?: string, usage?: string, response?: any): Promise<void>;
    exportQuestionsLegacy(authorization?: string, search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, keywords?: string, usage?: string, response?: any): Promise<void>;
    importQuestions(authorization: string | undefined, file: any): Promise<{
        ok: boolean;
        importedCount: number;
        failedCount: number;
        importedIds: number[];
        errors: string[];
    }>;
    importQuestionsLegacy(authorization: string | undefined, file: any): Promise<{
        ok: boolean;
        importedCount: number;
        failedCount: number;
        importedIds: number[];
        errors: string[];
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
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "draft" | "published";
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
    create(authorization: string | undefined, createQuestionDto: CreateQuestionDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    bulkUpdateKeywords(authorization: string | undefined, bulkUpdateQuestionKeywordsDto: BulkUpdateQuestionKeywordsDto): Promise<{
        ok: boolean;
        updatedCount: number;
        keywords: string[];
    }>;
    bulkDelete(authorization: string | undefined, bulkDeleteQuestionsDto: BulkDeleteQuestionsDto): Promise<{
        ok: boolean;
        deletedCount: number;
        linkedQuestionCount: number;
        linkedQuizCount: number;
    }>;
    update(authorization: string | undefined, id: number, updateQuestionDto: UpdateQuestionDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private parseIdList;
    private parseLimit;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
