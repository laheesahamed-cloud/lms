import { DashboardService } from './dashboard.service';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getAdminDashboard(authorization?: string, today?: string): Promise<{
        totals: {
            courses: number;
            lessons: number;
            questions: number;
            quizzes: number;
        };
        users: {
            totalUsers: number;
            pendingUsers: number;
            activeUsers: number;
            adminUsers: number;
            studentUsers: number;
            newToday: number;
            newTodayLatest: {
                name: string;
                email: string;
            }[];
        };
        finance: {
            currency: string;
            activeSubscriptions: number;
            expiringSoon: number;
            todayRevenue: number;
            pendingRequests: number;
            pendingAmount: number;
            approvalQueue: {
                planName: string;
                invoiceId: string | null;
                paymentAmount: number | null;
                paymentCurrency: string;
                planCurrency: string;
                hasProof: boolean;
                requestedAt: string | null;
                studentName: string;
                studentEmail: string;
                id: number;
            }[];
            pendingPayments: {
                planName: string;
                invoiceId: string | null;
                paymentAmount: number | null;
                paymentCurrency: string;
                planCurrency: string;
                hasProof: boolean;
                requestedAt: string | null;
                studentName: string;
                studentEmail: string;
                id: number;
            }[];
            recentPayments: {
                planName: string;
                amountPaid: number;
                planCurrency: string;
                paymentStatus: string;
                collectedAt: string | null;
                studentName: string;
                studentEmail: string;
                id: number;
            }[];
        } | null;
        generatedAt: string;
    }>;
    adminSearch(authorization?: string, q?: string, only?: string): Promise<Record<string, unknown[]> | {
        courses: never[];
        lessons: never[];
        quizzes: never[];
        students: never[];
    }>;
    getStudentDashboard(authorization?: string, appClient?: string): Promise<{
        recentAttempts: {
            id: number;
            quizTitle: string;
            quizNumber: number;
            displayTitleMode: string;
            courseTitle: string;
            topicName: string;
            score: number;
            totalQuestions: number;
            percentage: number;
            passStatus: string;
            submittedAt: string;
        }[];
        topicMastery: {
            mastery: "weak" | "improving" | "strong";
            masteryLabel: "Weak" | "Improving" | "Strong";
            masteryNote: string;
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        weakTopics: {
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        strongTopics: {
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        adaptivePlan: {
            key: string;
            title: string;
            description: string;
            actionType: string;
            status: string;
        }[];
        questionOfDay: {
            id: number;
            questionType: any;
            questionText: any;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            options: {
                id: number;
                optionLabel: string;
                optionText: string;
                isCorrect: boolean;
            }[];
        } | null;
        missedPatterns: {
            courseTitle: string;
            subjectName: string;
            topicName: string;
            lessonTitle: string;
            questionType: string;
            missCount: number;
            answeredCount: number;
            missRate: number;
            latestMissedAt: string | null;
            patternLabel: string;
        }[];
        user: {
            id: number;
            fullName: string;
        };
        serverClock: {
            nowIso: string;
            dateKey: string;
            timeZone: string;
            source: string;
        };
        totalQuizzes: number;
        totalCourses: number;
        totalAttempts: number;
        quizDayStreak: number;
        quizDoneToday: boolean;
        todayBits: number;
        streakGraceActive: boolean;
        totalXp: number;
        xpToday: number;
        xpDailyCap: 100;
        level: number;
        recentActiveDays: string[];
        avgScore: number;
        totalPassed: number;
        passRate: number;
        courseProgress: {
            id: number;
            courseTitle: string;
            courseCode: string;
            examType: string;
            subjectCount: number;
            progressPercent: number;
            completedLessonsCount: number;
            totalLessonsCount: number;
            actionLabel: string;
        }[];
        courseProgressSummary: {
            visibleCourses: number;
            completedLessons: number;
            totalLessons: number;
            overallProgressPercent: number;
            sourceLabel: string;
        };
        dailyGoals: {
            key: string;
            title: string;
            description: string;
            completed: boolean;
            progressText: string;
        }[];
        dailyGoalsCompleted: number;
        performanceSnapshot: {
            windowLabel: string;
            comparisonLabel: string;
            dateRangeLabel: string;
            sourceLabel: string;
            emptyState: string;
            readinessScore: number;
            readinessLabel: string;
            weeklyAttempts: number;
            weeklyAverage: number;
            previousWeeklyAverage: number;
            scoreDelta: number;
            scoreTrend: string;
            trendLabel: string;
            consistencyLabel: string;
        };
        focusTopic: string;
        focusCourse: string;
        progressTone: string;
        progressNote: string;
    }>;
    getStudentHubTop(authorization?: string, appClient?: string): Promise<{
        user: {
            id: number;
            fullName: string;
        };
        serverClock: {
            nowIso: string;
            dateKey: string;
            timeZone: string;
            source: string;
        };
        totalQuizzes: number;
        totalCourses: number;
        totalAttempts: number;
        quizDayStreak: number;
        quizDoneToday: boolean;
        todayBits: number;
        streakGraceActive: boolean;
        totalXp: number;
        xpToday: number;
        xpDailyCap: 100;
        level: number;
        recentActiveDays: string[];
        avgScore: number;
        totalPassed: number;
        passRate: number;
        courseProgress: {
            id: number;
            courseTitle: string;
            courseCode: string;
            examType: string;
            subjectCount: number;
            progressPercent: number;
            completedLessonsCount: number;
            totalLessonsCount: number;
            actionLabel: string;
        }[];
        courseProgressSummary: {
            visibleCourses: number;
            completedLessons: number;
            totalLessons: number;
            overallProgressPercent: number;
            sourceLabel: string;
        };
        weakTopics: {
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        dailyGoals: {
            key: string;
            title: string;
            description: string;
            completed: boolean;
            progressText: string;
        }[];
        dailyGoalsCompleted: number;
        performanceSnapshot: {
            windowLabel: string;
            comparisonLabel: string;
            dateRangeLabel: string;
            sourceLabel: string;
            emptyState: string;
            readinessScore: number;
            readinessLabel: string;
            weeklyAttempts: number;
            weeklyAverage: number;
            previousWeeklyAverage: number;
            scoreDelta: number;
            scoreTrend: string;
            trendLabel: string;
            consistencyLabel: string;
        };
        recentAttempts: {
            id: number;
            quizTitle: string;
            quizNumber: number;
            displayTitleMode: string;
            courseTitle: string;
            topicName: string;
            score: number;
            totalQuestions: number;
            percentage: number;
            passStatus: string;
            submittedAt: string;
        }[];
        focusTopic: string;
        focusCourse: string;
        progressTone: string;
        progressNote: string;
    }>;
    getStudentQuestionOfDay(authorization?: string): Promise<{
        id: number;
        questionType: any;
        questionText: any;
        courseTitle: string;
        subjectName: string;
        topicName: string;
        options: {
            id: number;
            optionLabel: string;
            optionText: string;
            isCorrect: boolean;
        }[];
    } | null>;
    getStudentHubMore(authorization?: string, appClient?: string, lite?: string): Promise<{
        recentAttempts: {
            id: number;
            quizTitle: string;
            quizNumber: number;
            displayTitleMode: string;
            courseTitle: string;
            topicName: string;
            score: number;
            totalQuestions: number;
            percentage: number;
            passStatus: string;
            submittedAt: string;
        }[];
        topicMastery: {
            mastery: "weak" | "improving" | "strong";
            masteryLabel: "Weak" | "Improving" | "Strong";
            masteryNote: string;
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        weakTopics: {
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        strongTopics: {
            topicName: string;
            courseTitle: string;
            averagePercentage: number;
            attemptsCount: number;
        }[];
        adaptivePlan: {
            key: string;
            title: string;
            description: string;
            actionType: string;
            status: string;
        }[];
        questionOfDay: {
            id: number;
            questionType: any;
            questionText: any;
            courseTitle: string;
            subjectName: string;
            topicName: string;
            options: {
                id: number;
                optionLabel: string;
                optionText: string;
                isCorrect: boolean;
            }[];
        } | null;
        missedPatterns: {
            courseTitle: string;
            subjectName: string;
            topicName: string;
            lessonTitle: string;
            questionType: string;
            missCount: number;
            answeredCount: number;
            missRate: number;
            latestMissedAt: string | null;
            patternLabel: string;
        }[];
    }>;
    syncStudentProgress(): {
        ok: number;
    };
    recordStudentActivity(authorization: string | undefined, dto: RecordStudyActivityDto): Promise<{
        ok: boolean;
    }>;
}
