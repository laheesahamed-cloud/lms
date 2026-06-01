import { Pool } from 'mysql2/promise';
import { PaginationInput } from '../../common/utils/pagination';
import { UserRole } from '../auth/role-permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
type UserManagementActor = {
    id: number;
    role: UserRole;
    status: string;
};
export declare class UsersService {
    private readonly db;
    constructor(db: Pool);
    findAll(actor: UserManagementActor, filters: {
        search?: string;
        status?: string;
        role?: string;
    } & PaginationInput): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    summary(actor: UserManagementActor): Promise<{
        totalUsers: number;
        pendingUsers: number;
        activeUsers: number;
        adminUsers: number;
        studentUsers: number;
    }>;
    detail(actor: UserManagementActor, id: number): Promise<{
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "student";
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
    create(actor: UserManagementActor, createUserDto: CreateUserDto): Promise<{
        ok: boolean;
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "student";
        status: string;
    }>;
    update(actor: UserManagementActor, id: number, updateUserDto: UpdateUserDto): Promise<{
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "student";
        status: "active" | "inactive";
        createdAt: string | null;
    } | {
        status: "active" | "inactive";
        role: "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "student";
        email: string;
        fullName: string;
        ok: boolean;
        id: number;
    }>;
    updateStatus(actor: UserManagementActor, id: number, updateUserStatusDto: UpdateUserStatusDto): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    delete(actor: UserManagementActor, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    private mapUser;
    private assignDefaultEntryPlan;
    private assertActiveStaff;
    private canManageStaff;
    private resolveVisibleRoleFilter;
    private assertCanManageTarget;
    private assertCanAssignRole;
    private assertAnotherActiveAdminExists;
    private logAdminAuditEvent;
}
export {};
