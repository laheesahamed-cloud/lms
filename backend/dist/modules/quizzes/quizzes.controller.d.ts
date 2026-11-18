import { AuthService } from '../auth/auth.service';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { BulkDeleteQuizzesDto } from './dto/bulk-delete-quizzes.dto';
import { BulkQuizStatusDto } from './dto/bulk-quiz-status.dto';
export declare class QuizzesController {
    private readonly quizzesService;
    private readonly authService;
    constructor(quizzesService: QuizzesService, authService: AuthService);
    findAll(search?: string, courseId?: string, topicId?: string, status?: string, limit?: string, page?: string, offset?: string, order?: string, after?: string, slim?: string): Promise<{
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
    summary(search?: string, courseId?: string, topicId?: string, status?: string): Promise<{
        courseId: number;
        courseTitle: string;
        isGeneral: boolean;
        topicId: number | null;
        subjectName: string;
        total: number;
        active: number;
    }[]>;
    meta(includeQuestions?: string, scope?: string): Promise<{
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
    create(authorization: string | undefined, createQuizDto: CreateQuizDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updateQuizDto: UpdateQuizDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    bulkDeletePreview(dto: BulkDeleteQuizzesDto): Promise<{
        quizzes: number;
        questionsInside: number;
        questionsOnlyHere: number;
        questionsShared: number;
        attempts: number;
    }>;
    bulkDelete(authorization: string | undefined, dto: BulkDeleteQuizzesDto): Promise<{
        ok: boolean;
        deletedQuizzes: number;
        deletedQuestions: number;
        keptQuestions: number;
    }>;
    bulkSetStatus(authorization: string | undefined, dto: BulkQuizStatusDto): Promise<{
        ok: boolean;
        status: "active" | "inactive";
        changed: number;
        skipped: {
            id: number;
            reason: string;
        }[];
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
