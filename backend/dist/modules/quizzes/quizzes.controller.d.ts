import { AuthService } from '../auth/auth.service';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
export declare class QuizzesController {
    private readonly quizzesService;
    private readonly authService;
    constructor(quizzesService: QuizzesService, authService: AuthService);
    findAll(search?: string, courseId?: string, topicId?: string, status?: string, limit?: string, page?: string, offset?: string): Promise<{
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
        quizNumber: number | null;
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
        randomizationMode: "static" | "dynamic";
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
    meta(includeQuestions?: string): Promise<{
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
    getCards(id: number, authorization?: string): Promise<{
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
        quizNumber: number | null;
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
        randomizationMode: "static" | "dynamic";
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
    create(authorization: string | undefined, createQuizDto: CreateQuizDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updateQuizDto: UpdateQuizDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
