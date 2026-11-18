import { AuthService } from '../auth/auth.service';
import { QuestionsService } from './questions.service';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
export declare class QuestionsController {
    private readonly questionsService;
    private readonly authService;
    constructor(questionsService: QuestionsService, authService: AuthService);
    findAll(search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, usage?: string, missing?: string, ids?: string, excludeIds?: string, limit?: string, page?: string, offset?: string, random?: string, after?: string, slim?: string): Promise<{
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
    meta(scope?: string): Promise<{
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
    metaSubject(topicId?: string, topicIds?: string): Promise<{
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
    }> | Promise<{
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
    fixLinkCounts(after?: number): Promise<{
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
    fixCourseTotals(counts?: unknown, expected?: unknown): Promise<{
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
    counts(search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string): Promise<{
        total: number;
        unused: number;
        used: number;
    }>;
    exportQuestions(authorization?: string, search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, usage?: string, missing?: string, response?: any): Promise<void>;
    exportQuestionsLegacy(authorization?: string, search?: string, status?: string, type?: string, courseId?: string, subjectId?: string, topicId?: string, lessonId?: string, paperId?: string, category?: string, unclassified?: string, usage?: string, missing?: string, response?: any): Promise<void>;
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
    listVersions(id: number): Promise<never[]>;
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
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<void>;
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
    create(authorization: string | undefined, createQuestionDto: CreateQuestionDto): Promise<{
        ok: boolean;
        id: number;
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
