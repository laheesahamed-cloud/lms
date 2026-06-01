import { ResultsService } from './results.service';
export declare class ResultsController {
    private readonly resultsService;
    constructor(resultsService: ResultsService);
    list(authorization?: string): Promise<{
        attemptId: number;
        quizId: number;
        quizTitle: string;
        subtopic: string;
        courseTitle: string;
        topicDisplay: string;
        score: number;
        percentage: number;
        correctAnswers: number;
        wrongAnswers: number;
        passStatus: string;
        submittedAt: any;
    }[]>;
    review(attemptId: number, authorization?: string): Promise<{
        attempt: {
            attemptId: number;
            quizId: number;
            lessonId: number | null;
            quizTitle: string;
            courseTitle: string;
            topicDisplay: string;
            score: number;
            percentage: number;
            passStatus: string;
        };
        questions: {
            answerState: {
                selectedIds: number[];
                tfMap: Record<number, number>;
            };
            answerStatus: string;
            questionScore: number;
            maxQuestionScore: number;
            id: number;
            questionType: "sba" | "true_false";
            questionText: string;
            explanation: string;
            contentTrace: {
                source: string;
                sourceId: number;
                version: number;
                versionLabel: string;
                versionedAt: string | Date | null;
            };
            options: {
                id: number;
                optionLabel: string;
                optionText: string;
                isCorrect: number;
                whyIncorrect: string;
            }[];
            answerKey: {
                type: string;
                statements: {
                    optionId: number;
                    label: string;
                    text: string;
                    answer: string;
                }[];
                correctOptions?: undefined;
            } | {
                type: string;
                correctOptions: {
                    optionId: number;
                    label: string;
                    text: string;
                }[];
                statements?: undefined;
            };
            theoryRecap: {
                conceptName: string;
                hierarchy: {
                    course: string;
                    subject: string;
                    topic: string;
                    lesson: string;
                };
                etiology: string[];
                pathophysiology: string[];
                clinicalFeatures: string[];
                investigations: string[];
                treatment: string[];
                keyPoints: string[];
                mnemonic: string;
            } | null;
        }[];
    }>;
    detail(attemptId: number, authorization?: string): Promise<{
        attemptId: number;
        quizTitle: string;
        courseTitle: string;
        topicDisplay: string;
        passStatus: string;
        totalQuestions: number;
        totalMarks: number;
        correctAnswers: number;
        wrongAnswers: number;
        unansweredQuestions: number;
        score: number;
        percentage: number;
        passingMarks: number;
    }>;
}
