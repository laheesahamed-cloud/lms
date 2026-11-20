import { lessonIdsFromBits } from '../../common/utils/lesson-bits';
import { forgetUserSessions } from '../auth/session-cache';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { normalizePagination, PaginationInput } from '../../common/utils/pagination';
import { searchWords, wordSearchFilter } from '../../common/utils/word-search';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import {
  effectivePermissions,
  isStaffRole,
  parseStoredPermissions,
  sanitizePermissions,
  USER_ROLES,
  UserRole,
} from '../auth/role-permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { loadQuizInfo, loadRecentResults } from '../../common/utils/recent-results';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { bumpUserCounter, countNewSubscription, moveUserCounter, readUserGroups } from '../../common/utils/admin-counters';

type UserRow = RowDataPacket & {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  permissions?: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  deleted_at?: string | Date | null;
};

type UserManagementActor = {
  id: number;
  role: UserRole;
  status: string;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    // Deleting a user is the same soft delete as a student's own account deletion.
    @Optional() private readonly authService?: AuthService,
  ) {}

  async findAll(actor: UserManagementActor, filters: { search?: string; status?: string; role?: string } & PaginationInput) {
    this.assertActiveStaff(actor);
    const { limit, offset } = normalizePagination(filters, { defaultLimit: 50, maxLimit: 100 });
    let sql = `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE 1 = 1 AND deleted_at IS NULL
    `;
    const params: Array<string | number> = [];

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

    const [rows] = await this.db.execute<UserRow[]>(sql, params);
    return rows.map((row) => this.mapUser(row));
  }

  /**
   * Users page, in pages of 50: inactive accounts first, then active, newest
   * first inside each (the old order), read by index ("after" = the last row's
   * "status:id"), so each page reads only its own rows. Before, the page got
   * the first 100 and paged them in the browser: the rest couldn't be reached
   * without a search. A search (word start on name / e-mail, FULLTEXT) returns
   * its matches in the same order, up to 100.
   */
  async findPage(actor: UserManagementActor, filters: { search?: string; status?: string; role?: string; after?: string }) {
    this.assertActiveStaff(actor);
    const role = this.resolveVisibleRoleFilter(actor, filters.role);
    const statuses = filters.status === 'active' || filters.status === 'inactive' ? [filters.status] : ['inactive', 'active'];
    const columns = 'id, full_name, email, role, status, created_at';
    const rank = (status: string) => (status === 'inactive' ? 0 : 1);

    const search = wordSearchFilter(['full_name', 'email'], searchWords(String(filters.search || '')));
    if (filters.search?.trim()) {
      if (!search) return { items: [], next: null };
      const where = [search.sql, 'deleted_at IS NULL', `status IN (${statuses.map(() => '?').join(', ')})`];
      const params: Array<string | number> = [...search.params, ...statuses];
      if (role) { where.push('role = ?'); params.push(role); }
      const [rows] = await this.db.query<UserRow[]>(`SELECT ${columns} FROM users WHERE ${where.join(' AND ')} LIMIT 100`, params);
      rows.sort((a, b) => rank(String(a.status)) - rank(String(b.status)) || Number(b.id) - Number(a.id));
      return { items: rows.map((row) => this.mapUser(row)), next: null };
    }

    const PAGE = 50;
    const [afterStatus, afterIdRaw] = String(filters.after || '').split(':');
    const afterId = Number(afterIdRaw);
    const startAt = statuses.indexOf(afterStatus);
    const items: UserRow[] = [];
    let next: string | null = null;
    for (let i = Math.max(0, startAt); i < statuses.length && !next; i += 1) {
      const status = statuses[i];
      const where = ['status = ?', 'deleted_at IS NULL'];
      const params: Array<string | number> = [status];
      if (role) { where.push('role = ?'); params.push(role); }
      if (i === startAt && Number.isInteger(afterId) && afterId > 0) { where.push('id < ?'); params.push(afterId); }
      const want = PAGE - items.length;
      // (role, status) and (status) indexes both end in the primary key, so
      // "ORDER BY id DESC" walks the index and stops at the page's last row.
      const [rows] = await this.db.query<UserRow[]>(
        `SELECT ${columns} FROM users FORCE INDEX (${role ? 'idx_users_role_status_live' : 'idx_users_status_live'})
         WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`, [...params, want + 1]);
      items.push(...rows.slice(0, want));
      if (rows.length > want) next = `${status}:${items[items.length - 1].id}`;
      else if (items.length === PAGE && i < statuses.length - 1) next = `${status}:${items[items.length - 1].id}`;
    }
    return { items: items.map((row) => this.mapUser(row)), next };
  }

  /// `today` is the admin's own calendar date (YYYY-MM-DD) so "new today" follows
  /// the day they are looking at, not the server's clock; anything else falls back
  /// to the database's current date.
  ///
  /// Two index reads: one pass over (role, status) for the counts, and today's
  /// sign-ups by (created_at) — examined = returned for the second. `db` lets
  /// the Admin Hub run it on its own single connection.
  async summary(actor: UserManagementActor, today?: string, db: Pick<Pool, 'query'> | Pick<PoolConnection, 'query'> = this.db) {
    this.assertActiveStaff(actor);
    const studentsOnly = !this.canManageStaff(actor);
    const hasDay = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today);
    // 10.57: live users by role and status from the stored counters (a few rows),
    // not a count over every user. Deleted (anonymized) accounts are not counted.
    const groups = await readUserGroups(db);
    const [todayRows] = await db.query<RowDataPacket[]>(
      `SELECT id, full_name, email, role, deleted_at IS NULL AS live
       FROM users FORCE INDEX (idx_users_created)
       WHERE ${hasDay
         ? 'created_at >= ? AND created_at < CAST(? AS DATE) + INTERVAL 1 DAY'
         : 'created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY'}`,
      hasDay ? [today, today] : []);

    const counts = { total: 0, pending: 0, active: 0, admin: 0, student: 0 };
    for (const g of groups) {
      if (studentsOnly && g.role !== 'student') continue;
      const n = Number(g.n || 0);
      counts.total += n;
      if (g.status === 'inactive') counts.pending += n;
      if (g.status === 'active') counts.active += n;
      if (g.role === 'admin') counts.admin += n;
      if (g.role === 'student') counts.student += n;
    }
    // New today: not deleted (and students only for staff who cannot see staff).
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

  async listStaff(actor: UserManagementActor) {
    this.assertActiveStaff(actor);
    this.assertCanManageStaffAccess(actor);
    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, full_name, email, role, permissions, status, created_at
       FROM users
       WHERE role <> 'student' AND deleted_at IS NULL
       ORDER BY FIELD(role, 'admin') DESC, status DESC, id ASC`
    );
    return rows.map((row) => this.mapStaffUser(row));
  }

  async updateAccess(actor: UserManagementActor, id: number, dto: UpdateUserAccessDto) {
    this.assertActiveStaff(actor);
    this.assertCanManageStaffAccess(actor);

    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, permissions, status, created_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'student') {
      throw new BadRequestException('Manage student accounts from the Users page');
    }

    const nextRole: UserRole = dto.role === 'admin' ? 'admin' : 'staff';

    if (id === actor.id && nextRole !== 'admin') {
      throw new ForbiddenException('Administrators cannot restrict their own account');
    }
    if (user.role === 'admin' && nextRole !== 'admin') {
      await this.assertAnotherActiveAdminExists(id);
    }

    // Administrators are full-access (no stored grant); staff store exactly what was ticked.
    const nextPermissions = nextRole === 'admin' ? null : JSON.stringify(sanitizePermissions(dto.permissions ?? []));

    await this.db.execute('UPDATE users SET role = ?, permissions = ? WHERE id = ?', [nextRole, nextPermissions, id]);
    await moveUserCounter(this.db, user, { role: nextRole, status: user.status }); // 10.57
    await this.logAdminAuditEvent({
      eventType: 'user.access_changed',
      actorId: actor.id,
      targetType: 'user',
      targetId: id,
      summary: `Updated admin access for user ${id} (${nextRole})`,
      metadata: {
        before: { role: user.role, permissions: parseStoredPermissions(user.permissions) },
        after: { role: nextRole, permissions: parseStoredPermissions(nextPermissions) },
      },
    });

    return this.mapStaffUser({ ...user, role: nextRole, permissions: nextPermissions } as UserRow);
  }

  async detail(actor: UserManagementActor, id: number) {
    this.assertActiveStaff(actor);
    const [userRows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageTarget(actor, user);

    const [[subscriptionRows], [attemptRows], [progressRows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT
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
         LIMIT 8`,
        [id]
      ),
      // 10.44: the student's recent results (summary row) with quiz titles.
      loadRecentResults(this.db, id).then(async (results) => {
        const info = await loadQuizInfo(this.db, results.map((r) => r.quizId));
        return [results.map((r) => ({
          id: r.quizId,
          quiz_id: r.quizId,
          quiz_title: (info.get(r.quizId)?.student_title || '').trim() || info.get(r.quizId)?.quiz_title || '',
          score: r.pct,
          percentage: r.pct,
          pass_status: r.passed ? 'pass' : 'fail',
          submitted_at: r.at || null,
        })) as unknown as RowDataPacket[], []] as [RowDataPacket[], unknown];
      }),
      // Lesson progress from the student's summary row (10.15): the bitmap's
      // finished lessons and the last active day (1 row by primary key).
      this.db.execute<RowDataPacket[]>(
        `SELECT lessons_done, last_active_day FROM student_study_summary WHERE user_id = ? LIMIT 1`,
        [id]
      ).then(([rows]) => {
        const finished = lessonIdsFromBits(rows[0]?.lessons_done).length;
        return [[{
          tracked_lessons: finished,
          completed_lessons: finished,
          average_progress: finished ? 100 : null,
          last_progress_at: rows[0]?.last_active_day || null,
        } as unknown as RowDataPacket], []] as [RowDataPacket[], unknown];
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

  async create(actor: UserManagementActor, createUserDto: CreateUserDto) {
    this.assertActiveStaff(actor);
    this.assertCanAssignRole(actor, createUserDto.role);

    const normalizedEmail = createUserDto.email.trim().toLowerCase();
    const [existingRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingRows.length > 0) {
      throw new BadRequestException('A user with that email already exists');
    }

    const status = createUserDto.status === 'active' ? 'active' : 'inactive';
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const [result] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [createUserDto.fullName.trim(), normalizedEmail, hashedPassword, createUserDto.role, status]
    );
    await bumpUserCounter(this.db, createUserDto.role, status, 1); // 10.57

    const insertId = result.insertId;

    if (createUserDto.role === 'student') {
      await this.assignDefaultEntryPlan(insertId);
    }

    await this.logAdminAuditEvent({
      eventType: isStaffRole(createUserDto.role) ? 'user.staff_created' : 'user.student_created',
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

  async update(actor: UserManagementActor, id: number, updateUserDto: UpdateUserDto) {
    this.assertActiveStaff(actor);
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageTarget(actor, user);

    if (updateUserDto.role) {
      this.assertCanAssignRole(actor, updateUserDto.role);
      if (id === actor.id && updateUserDto.role !== 'admin') {
        throw new ForbiddenException('Administrators cannot demote their own account');
      }
      if (user.role === 'admin' && updateUserDto.role !== 'admin') {
        await this.assertAnotherActiveAdminExists(id);
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (updateUserDto.fullName) {
      updates.push('full_name = ?');
      params.push(updateUserDto.fullName.trim());
    }

    if (updateUserDto.email) {
      const normalizedEmail = updateUserDto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const [existingEmailRows] = await this.db.execute<RowDataPacket[]>(
          'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
          [normalizedEmail, id]
        );

        if (existingEmailRows.length > 0) {
          throw new BadRequestException('A user with that email already exists');
        }
      }
      updates.push('email = ?');
      params.push(normalizedEmail);
    }

    if (updateUserDto.role) {
      updates.push('role = ?');
      params.push(updateUserDto.role);
      // Administrators are always full-access and students have none — only custom
      // "staff" accounts keep a per-user permission grant, so clear it otherwise.
      if (updateUserDto.role !== 'staff') {
        updates.push('permissions = ?');
        params.push(null);
      }
    }

    if (updateUserDto.password) {
      updates.push('password = ?');
      params.push(await bcrypt.hash(updateUserDto.password, 10));
      // Whoever held the old password (or a session made with it) is signed out.
      updates.push('session_token = NULL', 'session_expires_at = NULL');
    }

    if (updates.length === 0) {
      return this.mapUser(user);
    }

    params.push(id);
    await this.db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    // Role, permissions or status may have changed: drop the remembered session.
    forgetUserSessions(id);
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

  async updateStatus(actor: UserManagementActor, id: number, updateUserStatusDto: UpdateUserStatusDto) {
    this.assertActiveStaff(actor);
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at, deleted_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageTarget(actor, user);

    const status = updateUserStatusDto.status === 'active' ? 'active' : 'inactive';
    if (id === actor.id && status !== 'active') {
      throw new ForbiddenException('Administrators cannot deactivate their own account');
    }
    if (user.role === 'admin' && user.status === 'active' && status !== 'active') {
      await this.assertAnotherActiveAdminExists(id);
    }
    // Deactivating a user ends their session as well. Several endpoints only ask
    // "is this a valid session" (requireAuthenticatedUser), so a deactivated
    // account kept working on those until the token expired on its own.
    if (status === 'active') {
      await this.db.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
      forgetUserSessions(id);
    } else {
      await this.db.execute(
        'UPDATE users SET status = ?, session_token = NULL, session_expires_at = NULL WHERE id = ?',
        [status, id]
      );
      forgetUserSessions(id);
    }
    if (!user.deleted_at) await moveUserCounter(this.db, user, { role: user.role, status }); // 10.57
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

  async delete(actor: UserManagementActor, id: number) {
    this.assertActiveStaff(actor);
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageTarget(actor, user);
    if (id === actor.id) {
      throw new ForbiddenException('Administrators cannot delete their own account');
    }
    if (user.role === 'admin' && user.status === 'active') {
      await this.assertAnotherActiveAdminExists(id);
    }

    // Soft delete (decision 2026-11-14): the row and its history stay, so the
    // student's subscriptions and payments still add up in Finance; name and
    // e-mail are anonymized, login locked, active subscriptions cancelled.
    // A hard delete left their subscriptions and requests behind as orphans.
    if (!this.authService) throw new Error('AuthService is required to delete users');
    await this.authService.softDeleteUser(id, 'admin');
    await this.logAdminAuditEvent({
      eventType: isStaffRole(user.role) ? 'user.staff_deleted' : 'user.student_deleted',
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

  private mapUser(row: UserRow) {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at || null,
    };
  }

  private mapStaffUser(row: UserRow) {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at || null,
      // Custom grant stored for this account (null = follows role defaults / full admin).
      permissions: parseStoredPermissions(row.permissions),
      // Resolved set actually enforced at request time — what the toggles should reflect.
      effectivePermissions: effectivePermissions(row.role, row.permissions),
    };
  }

  private async assignDefaultEntryPlan(userId: number) {
    const [planRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id
       FROM plans
       WHERE slug = 'free'
       ORDER BY id ASC
       LIMIT 1`
    );
    const entryPlan = planRows[0];
    if (!entryPlan) {
      return;
    }

    const startDate = new Date();
    const toDateOnly = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    await this.db.execute(
      `
        INSERT INTO user_subscriptions (
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on admin-created student account', 'active', 'free_plan', ?, ?)
      `,
      [userId, Number(entryPlan.id), toDateOnly(startDate), '9999-12-31']
    );
    await countNewSubscription(this.db, { plan_id: entryPlan.id, payment_status: 'free_plan', status: 'active' }); // 10.57
  }

  private assertActiveStaff(actor: UserManagementActor) {
    if (!isStaffRole(actor.role) || actor.status !== 'active') {
      throw new ForbiddenException('Active staff access is required');
    }
  }

  private canManageStaff(actor: UserManagementActor) {
    return actor.role === 'admin';
  }

  private assertCanManageStaffAccess(actor: UserManagementActor) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only administrators can manage staff access');
    }
  }

  private resolveVisibleRoleFilter(actor: UserManagementActor, requestedRole?: string) {
    if (!this.canManageStaff(actor)) {
      if (requestedRole && requestedRole !== 'student') {
        throw new ForbiddenException('Only administrators can list staff accounts');
      }
      return 'student' as UserRole;
    }

    return USER_ROLES.includes(requestedRole as UserRole) ? requestedRole as UserRole : undefined;
  }

  private assertCanManageTarget(actor: UserManagementActor, target: Pick<UserRow, 'role'>) {
    if (this.canManageStaff(actor)) {
      return;
    }

    if (target.role !== 'student') {
      throw new ForbiddenException('Only administrators can manage staff accounts');
    }
  }

  private assertCanAssignRole(actor: UserManagementActor, role: UserRole) {
    if (this.canManageStaff(actor)) {
      return;
    }

    if (role !== 'student') {
      throw new ForbiddenException('Only administrators can assign staff roles');
    }
  }

  private async assertAnotherActiveAdminExists(excludedUserId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS active_admins FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?",
      [excludedUserId]
    );
    if (Number(rows[0]?.active_admins || 0) < 1) {
      throw new BadRequestException('At least one active administrator account is required');
    }
  }

  private async logAdminAuditEvent(input: {
    eventType: string;
    actorId?: number | null;
    targetType?: string | null;
    targetId?: number | null;
    summary: string;
    metadata?: unknown;
  }) {
    void 0; // 10.37: change history no longer stored (table dropped, never read)
  }
}
