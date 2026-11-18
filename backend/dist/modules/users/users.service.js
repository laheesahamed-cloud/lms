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
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const session_cache_1 = require("../auth/session-cache");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const bcrypt = require("bcryptjs");
const pagination_1 = require("../../common/utils/pagination");
const word_search_1 = require("../../common/utils/word-search");
const database_tokens_1 = require("../../database/database.tokens");
const role_permissions_1 = require("../auth/role-permissions");
const recent_results_1 = require("../../common/utils/recent-results");
let UsersService = class UsersService {
    constructor(db, authService) {
        this.db = db;
        this.authService = authService;
    }
    async findAll(actor, filters) {
        this.assertActiveStaff(actor);
        const { limit, offset } = (0, pagination_1.normalizePagination)(filters, { defaultLimit: 50, maxLimit: 100 });
        let sql = `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE 1 = 1 AND deleted_at IS NULL
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
    async findPage(actor, filters) {
        this.assertActiveStaff(actor);
        const role = this.resolveVisibleRoleFilter(actor, filters.role);
        const statuses = filters.status === 'active' || filters.status === 'inactive' ? [filters.status] : ['inactive', 'active'];
        const columns = 'id, full_name, email, role, status, created_at';
        const rank = (status) => (status === 'inactive' ? 0 : 1);
        const search = (0, word_search_1.wordSearchFilter)(['full_name', 'email'], (0, word_search_1.searchWords)(String(filters.search || '')));
        if (filters.search?.trim()) {
            if (!search)
                return { items: [], next: null };
            const where = [search.sql, 'deleted_at IS NULL', `status IN (${statuses.map(() => '?').join(', ')})`];
            const params = [...search.params, ...statuses];
            if (role) {
                where.push('role = ?');
                params.push(role);
            }
            const [rows] = await this.db.query(`SELECT ${columns} FROM users WHERE ${where.join(' AND ')} LIMIT 100`, params);
            rows.sort((a, b) => rank(String(a.status)) - rank(String(b.status)) || Number(b.id) - Number(a.id));
            return { items: rows.map((row) => this.mapUser(row)), next: null };
        }
        const PAGE = 50;
        const [afterStatus, afterIdRaw] = String(filters.after || '').split(':');
        const afterId = Number(afterIdRaw);
        const startAt = statuses.indexOf(afterStatus);
        const items = [];
        let next = null;
        for (let i = Math.max(0, startAt); i < statuses.length && !next; i += 1) {
            const status = statuses[i];
            const where = ['status = ?', 'deleted_at IS NULL'];
            const params = [status];
            if (role) {
                where.push('role = ?');
                params.push(role);
            }
            if (i === startAt && Number.isInteger(afterId) && afterId > 0) {
                where.push('id < ?');
                params.push(afterId);
            }
            const want = PAGE - items.length;
            const [rows] = await this.db.query(`SELECT ${columns} FROM users FORCE INDEX (${role ? 'idx_users_role_status_live' : 'idx_users_status_live'})
         WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`, [...params, want + 1]);
            items.push(...rows.slice(0, want));
            if (rows.length > want)
                next = `${status}:${items[items.length - 1].id}`;
            else if (items.length === PAGE && i < statuses.length - 1)
                next = `${status}:${items[items.length - 1].id}`;
        }
        return { items: items.map((row) => this.mapUser(row)), next };
    }
    async summary(actor, today, db = this.db) {
        this.assertActiveStaff(actor);
        const studentsOnly = !this.canManageStaff(actor);
        const hasDay = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today);
        const [groups] = await db.query('SELECT role, status, COUNT(*) AS n FROM users FORCE INDEX (idx_users_role_status_live) WHERE deleted_at IS NULL GROUP BY role, status');
        const [todayRows] = await db.query(`SELECT id, full_name, email, role, deleted_at IS NULL AS live
       FROM users FORCE INDEX (idx_users_created)
       WHERE ${hasDay
            ? 'created_at >= ? AND created_at < CAST(? AS DATE) + INTERVAL 1 DAY'
            : 'created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY'}`, hasDay ? [today, today] : []);
        const counts = { total: 0, pending: 0, active: 0, admin: 0, student: 0 };
        for (const g of groups) {
            if (studentsOnly && g.role !== 'student')
                continue;
            const n = Number(g.n || 0);
            counts.total += n;
            if (g.status === 'inactive')
                counts.pending += n;
            if (g.status === 'active')
                counts.active += n;
            if (g.role === 'admin')
                counts.admin += n;
            if (g.role === 'student')
                counts.student += n;
        }
        const newToday = todayRows
            .filter((u) => Number(u.live) === 1 && (!studentsOnly || u.role === 'student'))
            .sort((a, b) => Number(b.id) - Number(a.id));
        return {
            totalUsers: counts.total,
            pendingUsers: counts.pending,
            activeUsers: counts.active,
            adminUsers: counts.admin,
            studentUsers: counts.student,
            newToday: newToday.length,
            newTodayLatest: newToday.slice(0, 3).map((user) => ({ name: String(user.full_name || ''), email: String(user.email || '') })),
        };
    }
    async listStaff(actor) {
        this.assertActiveStaff(actor);
        this.assertCanManageStaffAccess(actor);
        const [rows] = await this.db.execute(`SELECT id, full_name, email, role, permissions, status, created_at
       FROM users
       WHERE role <> 'student' AND deleted_at IS NULL
       ORDER BY FIELD(role, 'admin') DESC, status DESC, id ASC`);
        return rows.map((row) => this.mapStaffUser(row));
    }
    async updateAccess(actor, id, dto) {
        this.assertActiveStaff(actor);
        this.assertCanManageStaffAccess(actor);
        const [rows] = await this.db.execute('SELECT id, full_name, email, role, permissions, status, created_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
        const user = rows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.role === 'student') {
            throw new common_1.BadRequestException('Manage student accounts from the Users page');
        }
        const nextRole = dto.role === 'admin' ? 'admin' : 'staff';
        if (id === actor.id && nextRole !== 'admin') {
            throw new common_1.ForbiddenException('Administrators cannot restrict their own account');
        }
        if (user.role === 'admin' && nextRole !== 'admin') {
            await this.assertAnotherActiveAdminExists(id);
        }
        const nextPermissions = nextRole === 'admin' ? null : JSON.stringify((0, role_permissions_1.sanitizePermissions)(dto.permissions ?? []));
        await this.db.execute('UPDATE users SET role = ?, permissions = ? WHERE id = ?', [nextRole, nextPermissions, id]);
        await this.logAdminAuditEvent({
            eventType: 'user.access_changed',
            actorId: actor.id,
            targetType: 'user',
            targetId: id,
            summary: `Updated admin access for user ${id} (${nextRole})`,
            metadata: {
                before: { role: user.role, permissions: (0, role_permissions_1.parseStoredPermissions)(user.permissions) },
                after: { role: nextRole, permissions: (0, role_permissions_1.parseStoredPermissions)(nextPermissions) },
            },
        });
        return this.mapStaffUser({ ...user, role: nextRole, permissions: nextPermissions });
    }
    async detail(actor, id) {
        this.assertActiveStaff(actor);
        const [userRows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
        const user = userRows[0];
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.assertCanManageTarget(actor, user);
        const [[subscriptionRows], [attemptRows], [progressRows]] = await Promise.all([
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
            (0, recent_results_1.loadRecentResults)(this.db, id).then(async (results) => {
                const info = await (0, recent_results_1.loadQuizInfo)(this.db, results.map((r) => r.quizId));
                return [results.map((r) => ({
                        id: r.quizId,
                        quiz_id: r.quizId,
                        quiz_title: (info.get(r.quizId)?.student_title || '').trim() || info.get(r.quizId)?.quiz_title || '',
                        score: r.pct,
                        percentage: r.pct,
                        pass_status: r.passed ? 'pass' : 'fail',
                        submitted_at: r.at || null,
                    })), []];
            }),
            this.db.execute(`SELECT lessons_done, last_active_day FROM student_study_summary WHERE user_id = ? LIMIT 1`, [id]).then(([rows]) => {
                const finished = (0, lesson_bits_1.lessonIdsFromBits)(rows[0]?.lessons_done).length;
                return [[{
                            tracked_lessons: finished,
                            completed_lessons: finished,
                            average_progress: finished ? 100 : null,
                            last_progress_at: rows[0]?.last_active_day || null,
                        }], []];
            }),
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
            if (updateUserDto.role !== 'staff') {
                updates.push('permissions = ?');
                params.push(null);
            }
        }
        if (updateUserDto.password) {
            updates.push('password = ?');
            params.push(await bcrypt.hash(updateUserDto.password, 10));
            updates.push('session_token = NULL', 'session_expires_at = NULL');
        }
        if (updates.length === 0) {
            return this.mapUser(user);
        }
        params.push(id);
        await this.db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        (0, session_cache_1.forgetUserSessions)(id);
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
        if (status === 'active') {
            await this.db.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
            (0, session_cache_1.forgetUserSessions)(id);
        }
        else {
            await this.db.execute('UPDATE users SET status = ?, session_token = NULL, session_expires_at = NULL WHERE id = ?', [status, id]);
            (0, session_cache_1.forgetUserSessions)(id);
        }
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
        const [rows] = await this.db.execute('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
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
        if (!this.authService)
            throw new Error('AuthService is required to delete users');
        await this.authService.softDeleteUser(id, 'admin');
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
    mapStaffUser(row) {
        return {
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            role: row.role,
            status: row.status,
            createdAt: row.created_at || null,
            permissions: (0, role_permissions_1.parseStoredPermissions)(row.permissions),
            effectivePermissions: (0, role_permissions_1.effectivePermissions)(row.role, row.permissions),
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
    assertCanManageStaffAccess(actor) {
        if (actor.role !== 'admin') {
            throw new common_1.ForbiddenException('Only administrators can manage staff access');
        }
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
        void 0;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService])
], UsersService);
//# sourceMappingURL=users.service.js.map