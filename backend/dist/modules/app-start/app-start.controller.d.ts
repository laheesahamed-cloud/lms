import { NoticesService } from '../notices/notices.service';
import { StartPayloadService } from './start-payload.service';
import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';
export declare class AppStartController {
    private readonly db;
    private readonly authService;
    private readonly dashboardService;
    private readonly notices;
    private readonly startPayload;
    constructor(db: Pool, authService: AuthService, dashboardService: DashboardService, notices: NoticesService, startPayload: StartPayloadService);
    start(authorization?: string, appClient?: string, body?: {
        lastNoticeId?: number;
        progressFormat?: string;
        progressVersion?: number;
        courses?: boolean;
    }): Promise<{
        serverTime: string;
        notices: {
            items: import("../notices/notices.service").Notice[];
            latestId: number;
        };
        popups: import("../notices/notices.service").Popup[];
        flashHistory?: boolean | undefined;
        flashSettings?: (import("../flashcards/flashcard-scheduler.service").FlashcardFsrsSettings & {
            newPerDay: number;
            reviewsPerDay: number;
        }) | null | undefined;
        progress: {
            quizzes?: unknown[] | undefined;
            access: {
                paid: boolean;
                full: boolean;
                courseIds: number[];
                lessonIds: number[];
                quizFull: boolean;
                quizCourseIds: number[];
                features: boolean;
                paidPlan: boolean;
            };
        } | null;
        results?: any[] | never[] | undefined;
        contentVersion: number;
        dashboard: {
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
        } | null;
        ok: boolean;
        accessToken: string;
        accessExpiresIn: number;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "inactive" | "active";
            avatarKey: string;
            needsProfileSetup: boolean;
            hasActiveSubscription: any;
            subscriptionStatus: any;
            currentPlanName: any;
            featureAccess: any;
            accessUntil: string | null;
            accessRenews: boolean;
        };
    }>;
    listNotices(authorization?: string, after?: string): Promise<{
        notices: {
            items: import("../notices/notices.service").Notice[];
            latestId: number;
        };
        popups: import("../notices/notices.service").Popup[];
        contentVersion: number;
    }>;
}
