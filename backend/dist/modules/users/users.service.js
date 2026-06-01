"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const pagination_1 = require("../../common/utils/pagination");
const database_tokens_1 = require("../../database/database.tokens");
const role_permissions_1 = require("../auth/role-permissions");
let UsersService = class UsersService {
    constructor(db) {
        this.db = db;
    }
    async findAll(actor, filters) {
        this.assertActiveStaff(actor);
        const { limit, offset } = (0, pagination_1.normalizePagination)(filters, { defaultLimit: 50, maxLimit: 100 });
        let sql = `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE 1 = 1
    `;
        const params = [];
        if (filters.search?.trim()) {
            sql += ' AND (full_name LIKE ? OR email LIKE ?)';
            const like = `%${filters.search.trim()}%`;
            params.push(like, like);
        }
        if (filters.status === 'active' || filters.status === 'inactive') {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        const requestedRole = this.resolveVisibleRoleFilter(actor, filters.role);
        if (requestedRole) {
            sql += ' AND role = ?';
            params.push(requestedRole);
        }
        sql += ` ORDER BY FIELD(status, 'inactive', 'active'), id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        const [rows] = await this.db.execute(sql, params);
        return rows.map((row) => this.mapUser(row));
    }
    async summary(actor) {
        this.assertActiveStaff(actor);
        const where = this.canManageStaff(actor) ? '' : "WHERE role = 'student'";
        const [rows] = await this.db.execute(`
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS pending_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_users,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) AS student_users
      FROM users
      ${where}
    `);
        const row = rows[0] || {};
        return {
            totalUsers: Number(row.total_users || 0),
            pendingUsers: Number(row.pending_users || 0),
            activeUsers: Number(row.active_users || 0),
            adminUsers: Number(row.admin_users || 0),
            studentUsers: Number(row.student_users || 0),
        };
    }
    async detail(actor, id) {
        this.assertActiveStaff(actor);
        const [userRows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
        const user = userRows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.assertCanManageTarget(actor, user);
        const [[subscriptionRows], [attemptRows], [progressRows], [bookmarkRows]] = await Promise.all([
            this.db.execute(`SELECT
           us.id,
           us.status,
           us.payment_status,
           us.start_date,
           us.end_date,
           us.amount_paid,
           p.name AS plan_name
         FROM user_subscriptions us
         LEFT JOIN plans p ON p.id = us.plan_id
         WHERE us.user_id = ?
         ORDER BY us.end_date DESC, us.id DESC
         LIMIT 8`, [id]),
            this.db.execute(`SELECT qa.id, qa.quiz_id, COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
                qa.score, qa.percentage, qa.pass_status, qa.submitted_at
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.user_id = ?
         ORDER BY qa.submitted_at DESC, qa.id DESC
         LIMIT 10`, [id]),
            this.db.execute(`SELECT
           COUNT(*) AS tracked_lessons,
           SUM(status = 'completed') AS completed_lessons,
           AVG(progress_percent) AS average_progress,
           MAX(updated_at) AS last_progress_at
         FROM student_lesson_progress
         WHERE user_id = ?`, [id]),
            this.db.execute(`SELECT item_type, COUNT(*) AS total
         FROM study_bookmarks
         WHERE user_id = ?
         GROUP BY item_type`, [id]),
        ]);
        const progress = progressRows[0] || {};
        return {
            user: this.mapUser(user),
            progress: {
                trackedLessons: Number(progress.tracked_lessons || 0),
                completedLessons: Number(progress.completed_lessons || 0),
                averageProgress: Math.round(Number(progress.average_progress || 0)),
                lastProgressAt: progress.last_progress_at || null,
            },
            subscriptions: subscriptionRows.map((row) => ({
                id: Number(row.id),
                planName: String(row.plan_name || 'Plan'),
                status: String(row.status || ''),
                paymentStatus: String(row.payment_status || ''),
                startDate: row.start_date ? String(row.start_date).slice(0, 10) : '',
                endDate: row.end_date ? String(row.end_date).slice(0, 10) : '',
                amountPaid: row.amount_paid === null || row.amount_paid === undefined ? null : Number(row.amount_paid),
            })),
            attempts: attemptRows.map((row) => ({
                id: Number(row.id),
                quizId: Number(row.quiz_id),
                quizTitle: String(row.quiz_title || ''),
                score: Number(row.score || 0),
                percentage: Number(row.percentage || 0),
                passStatus: String(row.pass_status || ''),
                submittedAt: row.submitted_at || null,
            })),
            bookmarks: bookmarkRows.map((row) => ({
                itemType: String(row.item_type || ''),
                total: Number(row.total || 0),
            })),
        };
    }
    async create(actor, createUserDto) {
        this.assertActiveStaff(actor);
        this.assertCanAssignRole(actor, createUserDto.role);
        const normalizedEmail = createUserDto.email.trim().toLowerCase();
        const [existingRows] = await this.db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
        if (existingRows.length > 0) {
            throw new common_1.BadRequestException('A user with that email already exists');
        }
        const status = createUserDto.status === 'active' ? 'active' : 'inactive';
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const [result] = await this.db.execute('INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', [createUserDto.fullName.trim(), normalizedEmail, hashedPassword, createUserDto.role, status]);
        const insertId = result.insertId;
        if (createUserDto.role === 'student') {
            await this.assignDefaultEntryPlan(insertId);
        }
        await this.logAdminAuditEvent({
            eventType: (0, role_permissions_1.isStaffRole)(createUserDto.role) ? 'user.staff_created' : 'user.student_created',
            actorId: actor.id,
            targetType: 'user',
            targetId: insertId,
            summary: `Created ${createUserDto.role} account ${insertId}`,
            metadata: {
                role: createUserDto.role,
                status,
            },
        });
        return {
            ok: true,
            id: insertId,
            fullName: createUserDto.fullName.trim(),
            email: normalizedEmail,
            role: createUserDto.role,
            status,
        };
    }
    async update(actor, id, updateUserDto) {
        this.assertActiveStaff(actor);
        const [rows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
        const user = rows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.assertCanManageTarget(actor, user);
        if (updateUserDto.role) {
            this.assertCanAssignRole(actor, updateUserDto.role);
            if (id === actor.id && updateUserDto.role !== 'admin') {
                throw new common_1.ForbiddenException('Administrators cannot demote their own account');
            }
            if (user.role === 'admin' && updateUserDto.role !== 'admin') {
                await this.assertAnotherActiveAdminExists(id);
            }
        }
        const updates = [];
        const params = [];
        if (updateUserDto.fullName) {
            updates.push('full_name = ?');
            params.push(updateUserDto.fullName.trim());
        }
        if (updateUserDto.email) {
            const normalizedEmail = updateUserDto.email.trim().toLowerCase();
            if (normalizedEmail !== user.email) {
                const [existingEmailRows] = await this.db.execute('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [normalizedEmail, id]);
                if (existingEmailRows.length > 0) {
                    throw new common_1.BadRequestException('A user with that email already exists');
                }
            }
            updates.push('email = ?');
            params.push(normalizedEmail);
        }
        if (updateUserDto.role) {
            updates.push('role = ?');
            params.push(updateUserDto.role);
        }
        if (updateUserDto.password) {
            updates.push('password = ?');
            params.push(await bcrypt.hash(updateUserDto.password, 10));
        }
        if (updates.length === 0) {
            return this.mapUser(user);
        }
        params.push(id);
        await this.db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        await this.logAdminAuditEvent({
            eventType: updateUserDto.role && updateUserDto.role !== user.role ? 'user.role_changed' : 'user.updated',
            actorId: actor.id,
            targetType: 'user',
            targetId: id,
            summary: updateUserDto.role && updateUserDto.role !== user.role
                ? `Changed user ${id} role from ${user.role} to ${updateUserDto.role}`
                : `Updated user ${id}`,
            metadata: {
                before: {
                    role: user.role,
                    email: user.email,
                    fullName: user.full_name,
                },
                after: {
                    role: updateUserDto.role || user.role,
                    email: updateUserDto.email ? updateUserDto.email.trim().toLowerCase() : user.email,
                    fullName: updateUserDto.fullName ? updateUserDto.fullName.trim() : user.full_name,
                    passwordChanged: Boolean(updateUserDto.password),
                },
            },
        });
        return {
            ok: true,
            id,
            ...(updateUserDto.fullName ? { fullName: updateUserDto.fullName.trim() } : { fullName: user.full_name }),
            ...(updateUserDto.email ? { email: updateUserDto.email.trim().toLowerCase() } : { email: user.email }),
            ...(updateUserDto.role ? { role: updateUserDto.role } : { role: user.role }),
            status: user.status,
        };
    }
    async updateStatus(actor, id, updateUserStatusDto) {
        this.assertActiveStaff(actor);
        const [rows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
        const user = rows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.assertCanManageTarget(actor, user);
        const status = updateUserStatusDto.status === 'active' ? 'active' : 'inactive';
        if (id === actor.id && status !== 'active') {
            throw new common_1.ForbiddenException('Administrators cannot deactivate their own account');
        }
        if (user.role === 'admin' && user.status === 'active' && status !== 'active') {
            await this.assertAnotherActiveAdminExists(id);
        }
        await this.db.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        await this.logAdminAuditEvent({
            eventType: 'user.status_changed',
            actorId: actor.id,
            targetType: 'user',
            targetId: id,
            summary: `Changed user ${id} status from ${user.status} to ${status}`,
            metadata: {
                before: { status: user.status, role: user.role },
                after: { status, role: user.role },
            },
        });
        return {
            ok: true,
            id,
            status,
        };
    }
    async delete(actor, id) {
        this.assertActiveStaff(actor);
        const [rows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
        const user = rows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.assertCanManageTarget(actor, user);
        if (id === actor.id) {
            throw new common_1.ForbiddenException('Administrators cannot delete their own account');
        }
        if (user.role === 'admin' && user.status === 'active') {
            await this.assertAnotherActiveAdminExists(id);
        }
        await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
        await this.logAdminAuditEvent({
            eventType: (0, role_permissions_1.isStaffRole)(user.role) ? 'user.staff_deleted' : 'user.student_deleted',
            actorId: actor.id,
            targetType: 'user',
            targetId: id,
            summary: `Deleted ${user.role} account ${id}`,
            metadata: {
                role: user.role,
                status: user.status,
            },
        });
        return {
            ok: true,
            id,
        };
    }
    mapUser(row) {
        return {
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            role: row.role,
            status: row.status,
            createdAt: row.created_at || null,
        };
    }
    async assignDefaultEntryPlan(userId) {
        const [planRows] = await this.db.execute(`SELECT id
       FROM plans
       WHERE slug = 'free'
       ORDER BY id ASC
       LIMIT 1`);
        const entryPlan = planRows[0];
        if (!entryPlan) {
            return;
        }
        const startDate = new Date();
        const toDateOnly = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        await this.db.execute(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on admin-created student account', 'active', 'free_plan', ?, ?)
      `, [userId, Number(entryPlan.id), toDateOnly(startDate), '9999-12-31']);
    }
    assertActiveStaff(actor) {
        if (!(0, role_permissions_1.isStaffRole)(actor.role) || actor.status !== 'active') {
            throw new common_1.ForbiddenException('Active staff access is required');
        }
    }
    canManageStaff(actor) {
        return actor.role === 'admin';
    }
    resolveVisibleRoleFilter(actor, requestedRole) {
        if (!this.canManageStaff(actor)) {
            if (requestedRole && requestedRole !== 'student') {
                throw new common_1.ForbiddenException('Only administrators can list staff accounts');
            }
            return 'student';
        }
        return role_permissions_1.USER_ROLES.includes(requestedRole) ? requestedRole : undefined;
    }
    assertCanManageTarget(actor, target) {
        if (this.canManageStaff(actor)) {
            return;
        }
        if (target.role !== 'student') {
            throw new common_1.ForbiddenException('Only administrators can manage staff accounts');
        }
    }
    assertCanAssignRole(actor, role) {
        if (this.canManageStaff(actor)) {
            return;
        }
        if (role !== 'student') {
            throw new common_1.ForbiddenException('Only administrators can assign staff roles');
        }
    }
    async assertAnotherActiveAdminExists(excludedUserId) {
        const [rows] = await this.db.execute("SELECT COUNT(*) AS active_admins FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [excludedUserId]);
        if (Number(rows[0]?.active_admins || 0) < 1) {
            throw new common_1.BadRequestException('At least one active administrator account is required');
        }
    }
    async logAdminAuditEvent(input) {
        await this.db.execute(`INSERT INTO admin_audit_events
        (event_type, actor_id, target_type, target_id, summary, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            input.eventType,
            input.actorId || null,
            input.targetType || null,
            input.targetId || null,
            input.summary,
            input.metadata === undefined ? null : JSON.stringify(input.metadata),
        ]);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], UsersService);
//# sourceMappingURL=users.service.js.map