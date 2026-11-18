import { BootService } from './boot.service';
export declare class BootController {
    private readonly bootService;
    constructor(bootService: BootService);
    getStudentBoot(authorization?: string, engine?: string): Promise<{
        dashboard: {
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
        } | {
            id: number;
            kind: string;
            title: string;
            body: string;
            targetRole: import("../notices/notices.service").Audience;
            status: string;
            createdAt: string;
            updatedAt: string;
            read: boolean;
            actionPath: string;
        }[] | {
            generatedAt: string;
            items: {
                id: string;
                source: "planner_task" | "lesson_progress" | "quiz" | "review_signal";
                sourceId: number | null;
                type: "task" | "lesson" | "quiz" | "exam" | "review" | "flashcards";
                title: string;
                course: string;
                subject: string;
                topic: string;
                lesson: string;
                status: "due_today" | "overdue" | "upcoming" | "in_progress" | "completed" | "locked" | "optional";
                dueAt: string | null;
                completedAt: unknown;
                progress: number | null;
                actionUrl: string;
                actionLabel: string;
                locked: boolean;
                accessMessage: string;
                priority: number;
                meta?: Record<string, unknown>;
            }[];
            filters: {
                courses: string[];
                subjects: string[];
                topics: string[];
                lessons: string[];
            };
            summary: {
                today: number;
                overdue: number;
                upcoming: number;
                completed: number;
                total: number;
            };
        } | null;
        notifications: {
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
        } | {
            id: number;
            kind: string;
            title: string;
            body: string;
            targetRole: import("../notices/notices.service").Audience;
            status: string;
            createdAt: string;
            updatedAt: string;
            read: boolean;
            actionPath: string;
        }[] | {
            generatedAt: string;
            items: {
                id: string;
                source: "planner_task" | "lesson_progress" | "quiz" | "review_signal";
                sourceId: number | null;
                type: "task" | "lesson" | "quiz" | "exam" | "review" | "flashcards";
                title: string;
                course: string;
                subject: string;
                topic: string;
                lesson: string;
                status: "due_today" | "overdue" | "upcoming" | "in_progress" | "completed" | "locked" | "optional";
                dueAt: string | null;
                completedAt: unknown;
                progress: number | null;
                actionUrl: string;
                actionLabel: string;
                locked: boolean;
                accessMessage: string;
                priority: number;
                meta?: Record<string, unknown>;
            }[];
            filters: {
                courses: string[];
                subjects: string[];
                topics: string[];
                lessons: string[];
            };
            summary: {
                today: number;
                overdue: number;
                upcoming: number;
                completed: number;
                total: number;
            };
        } | null;
        agenda: {
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
        } | {
            id: number;
            kind: string;
            title: string;
            body: string;
            targetRole: import("../notices/notices.service").Audience;
            status: string;
            createdAt: string;
            updatedAt: string;
            read: boolean;
            actionPath: string;
        }[] | {
            generatedAt: string;
            items: {
                id: string;
                source: "planner_task" | "lesson_progress" | "quiz" | "review_signal";
                sourceId: number | null;
                type: "task" | "lesson" | "quiz" | "exam" | "review" | "flashcards";
                title: string;
                course: string;
                subject: string;
                topic: string;
                lesson: string;
                status: "due_today" | "overdue" | "upcoming" | "in_progress" | "completed" | "locked" | "optional";
                dueAt: string | null;
                completedAt: unknown;
                progress: number | null;
                actionUrl: string;
                actionLabel: string;
                locked: boolean;
                accessMessage: string;
                priority: number;
                meta?: Record<string, unknown>;
            }[];
            filters: {
                courses: string[];
                subjects: string[];
                topics: string[];
                lessons: string[];
            };
            summary: {
                today: number;
                overdue: number;
                upcoming: number;
                completed: number;
                total: number;
            };
        } | null;
        aiNotesEngine: import("../lessons/lessons.service").CanvasEngineKey;
    }>;
}
