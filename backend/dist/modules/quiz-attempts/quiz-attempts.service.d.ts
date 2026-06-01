import { Pool } from 'mysql2/promise';
import { PlansService } from '../plans/plans.service';
import { SaveExamProgressDto } from './dto/save-exam-progress.dto';
import { SavePracticeDto } from './dto/save-practice.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
type TheoryRecapData = {
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
};
export declare class QuizAttemptsService {
    private readonly db;
    private readonly plansService;
    private readonly activeQuizCache;
    private readonly quizQuestionCache;
    constructor(db: Pool, plansService: PlansService);
    listQuizzes(authorization?: string): Promise<{
        id: number;
        courseId: number;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        subtopic: string;
        isGeneral: boolean;
        examModeOnly: boolean;
        quizTitle: string;
        studentTitle: string;
        displayTitleMode: string;
        quizDescription: string;
        totalQuestions: number;
        totalMarks: number;
        timeLimit: number;
        hideTimeLimit: boolean;
        passingMarks: number;
        hidePassingMarks: boolean;
        updatedAt: string | Date | null;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        subtopicName: string;
        lessonTitle: string;
        examAttemptCount: number;
        latestAttemptId: number | null;
        practiceCompletedCount: number;
        practiceSessionId: number | null;
        lastQuestionIndex: number;
        practiceAnsweredCount: number;
        isCompleted: boolean;
        isFree: boolean;
        canAccess: boolean;
        accessLocked: boolean;
        accessMessage: string;
        canPracticeMode: boolean;
        canExamMode: boolean;
    }[]>;
    listResults(authorization?: string): Promise<{
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
    loadQuiz(authorization: string | undefined, quizId: number, mode: string, continuePractice: boolean, resetPractice: boolean, questionId?: number | null): Promise<{
        mode: string;
        quiz: {
            id: number;
            courseId: number;
            topicId: number | null;
            subtopicId: number | null;
            lessonId: number | null;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            subtopicName: string;
            lessonTitle: string;
            isGeneral: boolean;
            isFree: boolean;
            examModeOnly: boolean;
            quizTitle: string;
            quizDescription: string;
            totalQuestions: number;
            totalMarks: number;
            timeLimit: number;
            hideTimeLimit: boolean;
            passingMarks: number;
            hidePassingMarks: boolean;
            subtopic: string;
        };
        examSession: {
            id: number;
            status: "in_progress" | "submitted" | "expired";
            startedAt: string | null;
            deadlineAt: string | null;
            serverTime: string | null;
            secondsRemaining: number | null;
            lastQuestionIndex: number;
            answers: Record<string, unknown>;
            flaggedQuestionIds: number[];
            submittedAttemptId: number | null;
        };
        questions: {
            savedAnswer: null;
            id: number;
            questionType: "sba" | "true_false";
            questionText: string;
            options: {
                id: number;
                optionLabel: string;
                optionText: string;
            }[];
        }[];
        practiceSession?: undefined;
    } | {
        mode: string;
        quiz: {
            id: number;
            courseId: number;
            topicId: number | null;
            subtopicId: number | null;
            lessonId: number | null;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            subtopicName: string;
            lessonTitle: string;
            isGeneral: boolean;
            isFree: boolean;
            examModeOnly: boolean;
            quizTitle: string;
            quizDescription: string;
            totalQuestions: number;
            totalMarks: number;
            timeLimit: number;
            hideTimeLimit: boolean;
            passingMarks: number;
            hidePassingMarks: boolean;
            subtopic: string;
        };
        practiceSession: {
            id: number;
            lastQuestionIndex: number;
            showContinuePopup: boolean;
        };
        questions: {
            savedAnswer: {
                selectedIds: number[];
                tfMap: Record<number, number>;
            };
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
            theoryRecap: TheoryRecapData | null;
        }[];
        examSession?: undefined;
    }>;
    savePractice(authorization: string | undefined, quizId: number, dto: SavePracticeDto): Promise<{
        success: boolean;
    }>;
    saveExamProgress(authorization: string | undefined, quizId: number, dto: SaveExamProgressDto): Promise<{
        success: boolean;
        submitted: boolean;
        attemptId: number | null;
        serverTime: string | null;
        deadlineAt: string | null;
        secondsRemaining: number;
        timeExpired?: undefined;
    } | {
        success: boolean;
        timeExpired: boolean;
        submitted: boolean;
        attemptId: number;
        serverTime: string | null;
        deadlineAt: string | null;
        secondsRemaining: number;
    } | {
        success: boolean;
        serverTime: string | null;
        deadlineAt: string | null;
        secondsRemaining: number | null;
        submitted?: undefined;
        attemptId?: undefined;
        timeExpired?: undefined;
    }>;
    submitExam(authorization: string | undefined, quizId: number, dto: SubmitExamDto): Promise<{
        success: boolean;
        attemptId: number;
    }>;
    result(authorization: string | undefined, attemptId: number): Promise<{
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
    review(authorization: string | undefined, attemptId: number): Promise<{
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
            theoryRecap: TheoryRecapData | null;
        }[];
    }>;
    practiceReview(authorization: string | undefined, quizId: number, complete: boolean, questionId?: number | null): Promise<{
        quiz: {
            id: number;
            courseId: number;
            topicId: number | null;
            subtopicId: number | null;
            lessonId: number | null;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            subtopicName: string;
            lessonTitle: string;
            isGeneral: boolean;
            isFree: boolean;
            examModeOnly: boolean;
            quizTitle: string;
            quizDescription: string;
            totalQuestions: number;
            totalMarks: number;
            timeLimit: number;
            hideTimeLimit: boolean;
            passingMarks: number;
            hidePassingMarks: boolean;
            subtopic: string;
        };
        session: {
            id: number;
            status: string;
        };
        summary: {
            total: number;
            correct: number;
            wrong: number;
            unanswered: number;
            score: number;
            percentage: number;
            passingMarks: number;
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
            theoryRecap: TheoryRecapData | null;
        }[];
    }>;
    private requireStudent;
    private extractToken;
    private ensureStudentCanAccessQuiz;
    private getQuizAccessProfile;
    private parseIdList;
    private resolveEffectiveAccessScope;
    private canAccessQuiz;
    private loadActiveQuiz;
    private loadQuestionsForQuiz;
    private loadQuestionForPracticeSave;
    private mapOptionsByQuestionId;
    private loadQuestionContentVersions;
    private withQuestionTrace;
    private parseJsonArray;
    private parseAnswerJson;
    private parseDate;
    private toIsoDate;
    private normalizeQuestionIndex;
    private normalizeQuestionIdList;
    private normalizeSubmittedAnswers;
    private ensurePracticeSession;
    private ensureExamSession;
    private getExamSessionById;
    private getLatestExamSession;
    private mapExamSession;
    private isExamSessionExpired;
    private finalizeExpiredExamSession;
    private getLatestPracticeSession;
    private groupAnswerRows;
    private getAnswerState;
    private evaluateAnswer;
    private calculateQuestionScore;
    private calculateTrueFalseScore;
    private calculateSubmissionQuestionScore;
    private scaleScoreToHundred;
    private createExamAttempt;
    private saveExamQuestionAnswers;
    private mapQuizForStudent;
    private mapQuestion;
    private buildAnswerKey;
    private mapQuestionForActiveAttempt;
    private mapReviewQuestion;
    private resolvePassingMarks;
}
export {};
