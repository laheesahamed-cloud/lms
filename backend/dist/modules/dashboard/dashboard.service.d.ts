import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { CoursesService } from '../courses/courses.service';
import { XpService } from '../xp/xp.service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { CourseStructureService } from '../courses/course-structure.service';
import { StudentCatalogueService } from '../courses/student-catalogue.service';
export declare class DashboardService {
    private readonly db;
    private readonly authService;
    private readonly coursesService;
    private readonly xpService;
    private readonly usersService;
    private readonly subscriptionsService;
    private readonly studyStats;
    private readonly courseStructure;
    private readonly studentCatalogue;
    constructor(db: Pool, authService: AuthService, coursesService: CoursesService, xpService: XpService, usersService: UsersService, subscriptionsService: SubscriptionsService, studyStats: StudyStatsService, courseStructure: CourseStructureService, studentCatalogue: StudentCatalogueService);
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
    adminSearch(authorization: string | undefined, query: string | undefined, only?: string): Promise<{
        courses: never[];
        lessons: never[];
        quizzes: never[];
        students: never[];
    } | Record<string, unknown[]>>;
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
    getStudentHubTop(authorization?: string, lite?: boolean): Promise<{
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
    getStudentHubMore(authorization?: string, appClient?: string, webLite?: boolean): Promise<{
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
    private hubTop;
    private hubMore;
    private goalsAndSnapshot;
    private subjectInsight;
    private recentAttempts;
    private namesCache;
    private areaNames;
    private activeQuizCount;
    private shiftDayKey;
    recordStudentActivity(authorization: string | undefined, dto: RecordStudyActivityDto): Promise<{
        ok: boolean;
    }>;
    private buildStudentPerformanceSnapshot;
    private buildServerClock;
    private formatDateKey;
    private buildCourseProgressSummary;
    private buildStudentAdaptivePlan;
    private readonly questionOfDayCache;
    private readonly questionOfDayInflight;
    private webQuestionPoolCache;
    private webQuestionPoolInflight;
    private static readonly WEB_QUESTION_POOL_TTL_MS;
    private static readonly DASHBOARD_QUESTION_ELIGIBLE;
    private getRandomDashboardQuestion;
    private getWebQuestionPool;
    private questionIdRange;
    private appQuestionIdRange;
    private computeAppQuestion;
    private computeRandomDashboardQuestion;
    private getDashboardQuestionOffset;
    private extractToken;
    private findActiveStudentByToken;
    private calculateQuizDayStreak;
    private localDateKey;
    private normalizeDateKey;
    private classifyTopicMastery;
    private getMasteryRank;
    private getTopicKey;
}
