import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
type AdminReportFilterInput = {
    startDate?: string;
    endDate?: string;
    courseId?: string;
    userId?: string;
};
type PlannerAgendaItem = {
    id: string;
    source: 'planner_task' | 'lesson_progress' | 'quiz' | 'review_signal';
    sourceId: number | null;
    type: 'task' | 'lesson' | 'quiz' | 'exam' | 'review' | 'flashcards';
    title: string;
    course: string;
    subject: string;
    topic: string;
    lesson: string;
    status: 'due_today' | 'overdue' | 'upcoming' | 'in_progress' | 'completed' | 'locked' | 'optional';
    dueAt: string | null;
    completedAt: unknown;
    progress: number | null;
    actionUrl: string;
    actionLabel: string;
    locked: boolean;
    accessMessage: string;
    priority: number;
    meta?: Record<string, unknown>;
};
type PlannerTaskCategory = 'general' | 'lesson' | 'quiz' | 'exam' | 'review' | 'flashcards';
type PlannerTaskPriority = 'low' | 'medium' | 'high';
export declare class WorkspaceService {
    private readonly db;
    private readonly authService;
    private readonly pushNotificationsService;
    constructor(db: Pool, authService: AuthService, pushNotificationsService: PushNotificationsService);
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
    createAnnouncement(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateAnnouncement(authorization: string | undefined, id: number, input: any): Promise<{
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
    private formatPaymentStatusLabel;
    private isFreePlanPaymentStatus;
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
        category: PlannerTaskCategory;
        priority: PlannerTaskPriority;
        estimatedMinutes: number | null;
        createdAt: any;
        updatedAt: any;
    }[]>;
    getPlannerAgenda(authorization?: string): Promise<{
        generatedAt: string;
        items: PlannerAgendaItem[];
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
    createPlannerTask(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    updatePlannerTask(authorization: string | undefined, id: number, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    deletePlannerTask(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    getAdminReports(authorization?: string, rawFilters?: AdminReportFilterInput): Promise<{
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
    createQuestionReport(authorization: string | undefined, input: any): Promise<{
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
    updateQuestionReport(authorization: string | undefined, id: number, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    private mapPlannerAgendaTask;
    private mapPlannerAgendaLesson;
    private mapPlannerAgendaQuiz;
    private mapPlannerAgendaReview;
    private comparePlannerAgendaItems;
    private buildPlannerAgendaFilters;
    private summarizePlannerAgenda;
    private getPlannerQuizAccessProfile;
    private canAccessPlannerQuiz;
    private resolvePlannerAccessScope;
    private parsePlannerIdList;
    private plannerStatusForDueDate;
    private clampPlannerPercent;
    private todayDateKey;
    private dateKey;
    private formatPlannerDateKey;
    private slugPlannerId;
    private canViewLearnerPii;
    private anonymizedLearnerRef;
    private logAdminAuditEvent;
    private normalizeAdminReportFilters;
    private appendDateFilter;
    private appendActivityDateFilter;
    private appendUserFilter;
    private appendCourseFilter;
    private optionalPositiveInteger;
    private normalizeAnnouncementInput;
    private requiredString;
    private optionalString;
    private optionalDate;
    private normalizePlannerTaskCategory;
    private normalizePlannerTaskPriority;
    private optionalPlannerEstimatedMinutes;
    private mapAnnouncement;
    private mapPlannerTask;
    private mapQuestionReport;
}
export {};
