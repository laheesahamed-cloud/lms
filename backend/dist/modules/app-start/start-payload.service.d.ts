import { Pool } from 'mysql2/promise';
import { DashboardService } from '../dashboard/dashboard.service';
import { NoticesService } from '../notices/notices.service';
import { ProgressOptions, StudentCatalogueService } from '../courses/student-catalogue.service';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
export declare const START_PAYLOAD = "START_PAYLOAD";
export declare class StartPayloadService {
    private readonly db;
    private readonly dashboardService;
    private readonly notices;
    private readonly catalogue;
    private readonly studyStats;
    private readonly quizAttempts;
    private readonly flashcards;
    constructor(db: Pool, dashboardService: DashboardService, notices: NoticesService, catalogue: StudentCatalogueService, studyStats: StudyStatsService, quizAttempts: QuizAttemptsService, flashcards: FlashcardsService);
    build(role: string, accessToken: string, lastNoticeId?: number, userId?: number, progressOpts?: ProgressOptions, withCourses?: boolean): Promise<{
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
    }>;
}
