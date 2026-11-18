import { NoticesService } from '../notices/notices.service';
import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
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
    private readonly plansService;
    private readonly pushNotificationsService;
    private readonly notices;
    constructor(db: Pool, authService: AuthService, plansService: PlansService, pushNotificationsService: PushNotificationsService, notices: NoticesService);
    listAdminAnnouncements(authorization?: string, _after?: number): Promise<{
        items: {
            id: number;
            style: "card" | "banner";
            title: string;
            body: string;
            imageUrl: string;
            actionLabel: string;
            actionPath: string;
            startAt: string | null;
            endAt: string | null;
            priority: number;
            audience: import("../notices/notices.service").Audience;
            targetRole: import("../notices/notices.service").Audience;
            status: "active" | "draft";
            createdAt: string;
            updatedAt: string;
        }[];
        next: null;
    }>;
    createAnnouncement(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        id: number;
        overlapping: number;
    }>;
    updateAnnouncement(authorization: string | undefined, id: number, input: any): Promise<{
        ok: boolean;
        id: number;
        overlapping: number;
    }>;
    deleteAnnouncement(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private overlappingPopups;
    private mapPopup;
    listNotifications(authorization?: string): Promise<{
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
    }[]>;
    dismissNotification(authorization: string | undefined, key: string): Promise<{
        ok: boolean;
        key: string;
    }>;
    clearNotifications(authorization?: string): Promise<{
        ok: boolean;
        cleared: number;
    }>;
    markAllNotificationsRead(authorization?: string): Promise<{
        ok: boolean;
        marked: number;
    }>;
    markNotificationRead(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private planItems;
    private sortPlanItems;
    private static readonly ITEM_PATH;
    listPlannerTasks(authorization?: string): Promise<{
        id: number;
        title: string;
        description: string;
        dueDate: string;
        status: string;
        category: PlannerTaskCategory;
        itemType: string | null;
        itemId: number | null;
        rule: Record<string, unknown> | null;
        priority: PlannerTaskPriority;
        estimatedMinutes: number | null;
        createdAt: string | null;
        updatedAt: string | null;
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
    private plannerItemFrom;
    private appendPlanItems;
    createPlannerTask(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    createPlannerTasksBulk(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        rules: boolean;
        ids: number[];
    }>;
    updatePlannerTask(authorization: string | undefined, id: number, input: any): Promise<{
        ok: boolean;
        id: number;
    }>;
    clearPlannerTasks(authorization?: string): Promise<{
        ok: boolean;
        deleted: number;
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
    private lessonBitmapStats;
    private appendUserFilter;
    private appendCourseFilter;
    private optionalPositiveInteger;
    private requiredString;
    private optionalString;
    private optionalDate;
    private normalizePlannerTaskCategory;
    private normalizePlannerTaskPriority;
    private optionalPlannerEstimatedMinutes;
    private normalizePlannerItemLink;
    private normalizePlannerRule;
    private parsePlannerRule;
    private mapPlannerItem;
    private mapPlannerTask;
    private mapQuestionReport;
}
export {};
