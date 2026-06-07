import { QuizAttemptsService } from './quiz-attempts.service';
import { SavePracticeDto } from './dto/save-practice.dto';
import { SavePracticeProgressDto } from './dto/save-practice-progress.dto';
import { SaveExamProgressDto } from './dto/save-exam-progress.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
export declare class QuizAttemptsController {
    private readonly quizAttemptsService;
    constructor(quizAttemptsService: QuizAttemptsService);
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
        randomizationMode: "static" | "dynamic";
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
        reviewedAt: any;
    }[]>;
    loadQuiz(quizId: number, mode: string, continuePractice?: string, resetPractice?: string, questionId?: string, authorization?: string): Promise<{
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
            randomizationMode: "static" | "dynamic";
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
            status: "expired" | "in_progress" | "submitted";
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
            randomizationMode: "static" | "dynamic";
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
            revealedQuestionIds: number[];
        };
        questions: {
            savedAnswer: {
                selectedIds: number[];
                tfMap: Record<number, number>;
            };
            id: number;
            questionType: "sba" | "true_false";
            questionText: string;
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
            }[];
            canRevealAnswer: boolean;
        }[];
        examSession?: undefined;
    }>;
    savePractice(quizId: number, authorization: string | undefined, savePracticeDto: SavePracticeDto): Promise<{
        success: boolean;
    }>;
    savePracticeDraft(quizId: number, authorization: string | undefined, savePracticeProgressDto: SavePracticeProgressDto): Promise<{
        success: boolean;
        sessionId: number;
        status: "in_progress" | "completed";
        lastQuestionIndex: number;
        revealedQuestionIds: number[];
    }>;
    finishPractice(quizId: number, authorization: string | undefined, savePracticeProgressDto: SavePracticeProgressDto): Promise<{
        success: boolean;
        sessionId: number;
        status: "in_progress" | "completed";
        lastQuestionIndex: number;
        revealedQuestionIds: number[];
    }>;
    prewarmPracticeAnswer(quizId: number, questionId: number, authorization: string | undefined): Promise<{
        success: boolean;
    }>;
    revealPracticeAnswer(quizId: number, questionId: number, authorization: string | undefined): Promise<{
        question: Record<string, unknown> | {
            canRevealAnswer: boolean;
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
        };
    }>;
    submitExam(quizId: number, authorization: string | undefined, submitExamDto: SubmitExamDto): Promise<{
        success: boolean;
        attemptId: number;
    }>;
    saveExamProgress(quizId: number, authorization: string | undefined, saveExamProgressDto: SaveExamProgressDto): Promise<{
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
    result(attemptId: number, authorization?: string): Promise<{
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
    completeReview(attemptId: number, authorization?: string): Promise<{
        attemptId: number;
        reviewed: boolean;
    }>;
    practiceReview(quizId: number, complete?: string, questionId?: string, authorization?: string): Promise<{
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
            randomizationMode: "static" | "dynamic";
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
}
