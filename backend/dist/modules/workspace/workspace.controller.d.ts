import { WorkspaceService } from './workspace.service';
export declare class WorkspaceController {
    private readonly workspaceService;
    constructor(workspaceService: WorkspaceService);
    listAdminAnnouncements(authorization?: string): Promise<{
        id: number;
        title: string;
        body: string;
        targetRole: string;
        status: string;
        publishAt: any;
        createdByName: string;
        createdAt: any;
        updatedAt: any;
    }[]>;
    createAnnouncement(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateAnnouncement(authorization: string | undefined, id: number, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteAnnouncement(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listNotifications(authorization?: string): Promise<({
        kind: string;
        read: boolean;
        actionPath: string;
        id: number;
        title: string;
        body: string;
        targetRole: string;
        status: string;
        publishAt: any;
        createdByName: string;
        createdAt: any;
        updatedAt: any;
    } | {
        id: string;
        kind: string;
        title: string;
        body: string;
        read: boolean;
        createdAt: any;
        actionPath: string;
    })[]>;
    markNotificationRead(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listPlannerTasks(authorization?: string): Promise<{
        id: number;
        title: string;
        description: string;
        dueDate: string;
        status: string;
        category: "quiz" | "lesson" | "exam" | "review" | "flashcards" | "general";
        priority: "low" | "medium" | "high";
        estimatedMinutes: number | null;
        createdAt: any;
        updatedAt: any;
    }[]>;
    getPlannerAgenda(authorization?: string): Promise<{
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
    }>;
    createPlannerTask(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    updatePlannerTask(authorization: string | undefined, id: number, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    deletePlannerTask(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    getAdminReports(authorization?: string, startDate?: string, endDate?: string, courseId?: string, userId?: string): Promise<{
        users: {
            total: number;
            students: number;
            pending: number;
        };
        attempts: {
            total: number;
            averageScore: number;
            passRate: number;
        };
        lessons: {
            tracked: number;
            completed: number;
        };
        hardQuestions: {
            id: number;
            text: string;
            wrongCount: number;
        }[];
        inactiveStudents: {
            id: number | null;
            learnerRef: string;
            fullName: string;
            email: string;
            lastActivity: any;
        }[];
        activityHeatmap: {
            date: string;
            activeStudents: number;
            quizAttempts: number;
            studyEvents: number;
        }[];
        quizPerformance: {
            id: number;
            quizTitle: string;
            courseTitle: string;
            attempts: number;
            passes: number;
            fails: number;
            passRate: number;
            averagePercentage: number;
        }[];
        courseFunnel: {
            id: number;
            courseTitle: string;
            totalLessons: number;
            studentsStarted: number;
            completedLessons: number;
            averageProgress: number;
        }[];
        subscriptions: {
            byStatus: {
                status: string;
                count: number;
            }[];
            payments: {
                status: string;
                currency: string;
                count: number;
                amount: number;
            }[];
        };
        filters: {
            startDate: string;
            endDate: string;
            courseId: number | null;
            userId: number | null;
        };
    }>;
    createQuestionReport(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        id: number;
        questionId: number;
    }>;
    listQuestionReports(authorization?: string, status?: string): Promise<{
        id: number;
        questionId: number;
        userId: number;
        fullName: string;
        email: string;
        reason: string;
        comment: string;
        status: string;
        questionText: string;
        questionType: string;
        courseTitle: string;
        topicName: string;
        quizIds: string;
        createdAt: any;
        updatedAt: any;
    }[]>;
    listLegacyQuestionReview(authorization?: string, status?: string): Promise<{
        id: number;
        questionId: number;
        userId: number;
        fullName: string;
        email: string;
        reason: string;
        comment: string;
        status: string;
        questionText: string;
        questionType: string;
        courseTitle: string;
        topicName: string;
        quizIds: string;
        createdAt: any;
        updatedAt: any;
    }[]>;
    createLegacyQuestionReview(): void;
    updateQuestionReport(authorization: string | undefined, id: number, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateLegacyQuestionReview(authorization: string | undefined, id: number, body: any): Promise<{
        ok: boolean;
        id: number;
    }>;
}
