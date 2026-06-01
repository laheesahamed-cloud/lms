import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { CoursesService } from '../courses/courses.service';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';
export declare class DashboardService {
    private readonly db;
    private readonly authService;
    private readonly coursesService;
    constructor(db: Pool, authService: AuthService, coursesService: CoursesService);
    getAdminDashboard(authorization?: string): Promise<{
        totalUsers: number;
        totalCourses: number;
        totalSubjects: number;
        totalQuizzes: number;
        totalQuestions: number;
        totalLessons: number;
        engagementScore: number;
        generatedAt: string;
        analytics: {
            users: {
                date: string;
                value: number;
            }[];
            courses: {
                date: string;
                value: number;
            }[];
            lessons: {
                date: string;
                value: number;
            }[];
            quizzes: {
                date: string;
                value: number;
            }[];
            questions: {
                date: string;
                value: number;
            }[];
            attempts: {
                date: string;
                value: number;
            }[];
        };
        aiInsights: {
            id: string;
            label: string;
            value: number;
            delta: number;
            deltaLabel: string;
            tone: string;
            detail: string;
        }[];
        recommendations: {
            title: string;
            detail: string;
            actionLabel: string;
            actionPath: string;
            tone: string;
        }[];
        activityFeed: {
            id: string;
            type: string;
            typeLabel: string;
            tone: string;
            title: string;
            subtitle: string;
            status: string;
            createdAt: string | null;
        }[];
        shortcuts: {
            label: string;
            path: string;
        }[];
    }>;
    private buildDailySeries;
    private calculateAdminEngagementScore;
    private buildAdminRecommendations;
    private buildAdminAiInsights;
    private buildAdminActivityFeed;
    private canViewLearnerPii;
    private anonymizedLearnerRef;
    private calculateSeriesDelta;
    getStudentDashboard(authorization?: string): Promise<{
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
        avgScore: number;
        totalPassed: number;
        passRate: number;
        totalSmartNotes: number;
        generatedSmartNotes: number;
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
        recentAttempts: {
            id: number;
            quizTitle: string;
            courseTitle: string;
            topicName: string;
            score: number;
            totalQuestions: number;
            percentage: number;
            passStatus: string;
            submittedAt: string | null;
        }[];
        recentSmartNotes: {
            id: number;
            title: string;
            updatedAt: string;
            hasVisual: boolean;
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
        dailyGoals: {
            key: string;
            title: string;
            description: string;
            completed: boolean;
            progressText: string;
        }[];
        dailyGoalsCompleted: number;
        focusTopic: string;
        focusCourse: string;
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
        adaptivePlan: {
            key: string;
            title: string;
            description: string;
            actionType: string;
            status: string;
        }[];
        questionOfDay: {
            id: number;
            questionType: "sba" | "true_false";
            questionText: string;
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
            questionType: "sba" | "true_false";
            missCount: number;
            latestMissedAt: string | null;
            patternLabel: string;
        }[];
        progressTone: string;
        progressNote: string;
    }>;
    recordStudentActivity(authorization: string | undefined, dto: RecordStudyActivityDto): Promise<{
        ok: boolean;
    }>;
    private buildStudentPerformanceSnapshot;
    private buildServerClock;
    private formatDateKey;
    private buildCourseProgressSummary;
    private buildStudentAdaptivePlan;
    private getRandomDashboardQuestion;
    private getDashboardQuestionOffset;
    private extractToken;
    private findActiveStudentByToken;
    private calculateQuizDayStreak;
    private normalizeDateKey;
    private classifyTopicMastery;
    private getMasteryRank;
    private getTopicKey;
}
