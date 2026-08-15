import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
export declare class UsersController {
    private readonly usersService;
    private readonly authService;
    constructor(usersService: UsersService, authService: AuthService);
    findAll(authorization?: string, search?: string, status?: string, role?: string, limit?: string, page?: string, offset?: string): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    summary(authorization?: string): Promise<{
        totalUsers: number;
        pendingUsers: number;
        activeUsers: number;
        adminUsers: number;
        studentUsers: number;
    }>;
    listStaff(authorization?: string): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
        permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[] | null;
        effectivePermissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
    }[]>;
    updateAccess(authorization: string | undefined, id: number, updateUserAccessDto: UpdateUserAccessDto): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
        permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[] | null;
        effectivePermissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
    }>;
    detail(authorization: string | undefined, id: number): Promise<{
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
            status: "active" | "inactive";
            createdAt: string | null;
        };
        progress: {
            trackedLessons: number;
            completedLessons: number;
            averageProgress: number;
            lastProgressAt: any;
        };
        subscriptions: {
            id: number;
            planName: string;
            status: string;
            paymentStatus: string;
            startDate: string;
            endDate: string;
            amountPaid: number | null;
        }[];
        attempts: {
            id: number;
            quizId: number;
            quizTitle: string;
            score: number;
            percentage: number;
            passStatus: string;
            submittedAt: any;
        }[];
        bookmarks: {
            itemType: string;
            total: number;
        }[];
    }>;
    create(authorization: string | undefined, createUserDto: CreateUserDto): Promise<{
        ok: boolean;
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        status: string;
    }>;
    update(authorization: string | undefined, id: number, updateUserDto: UpdateUserDto): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
    } | {
        status: "active" | "inactive";
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff" | "student";
        email: string;
        fullName: string;
        ok: boolean;
        id: number;
    }>;
    updateStatus(authorization: string | undefined, id: number, updateUserStatusDto: UpdateUserStatusDto): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    delete(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private parsePositiveNumber;
    private parseNonNegativeNumber;
}
