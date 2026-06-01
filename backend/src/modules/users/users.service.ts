import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { normalizePagination, PaginationInput } from '../../common/utils/pagination';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { isStaffRole, USER_ROLES, UserRole } from '../auth/role-permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type UserRow = RowDataPacket & {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at?: string | null;
};

type UserManagementActor = {
  id: number;
  role: UserRole;
  status: string;
};

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(actor: UserManagementActor, filters: { search?: string; status?: string; role?: string } & PaginationInput) {
    this.assertActiveStaff(actor);
    const { limit, offset } = normalizePagination(filters, { defaultLimit: 50, maxLimit: 100 });
    let sql = `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE 1 = 1
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

  async summary(actor: UserManagementActor) {
    this.assertActiveStaff(actor);
    const where = this.canManageStaff(actor) ? '' : "WHERE role = 'student'";
    const [rows] = await this.db.execute<RowDataPacket[]>(`
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

    const [[subscriptionRows], [attemptRows], [progressRows], [bookmarkRows]] = await Promise.all([
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
      this.db.execute<RowDataPacket[]>(
        `SELECT qa.id, qa.quiz_id, COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
                qa.score, qa.percentage, qa.pass_status, qa.submitted_at
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.user_id = ?
         ORDER BY qa.submitted_at DESC, qa.id DESC
         LIMIT 10`,
        [id]
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS tracked_lessons,
           SUM(status = 'completed') AS completed_lessons,
           AVG(progress_percent) AS average_progress,
           MAX(updated_at) AS last_progress_at
         FROM student_lesson_progress
         WHERE user_id = ?`,
        [id]
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT item_type, COUNT(*) AS total
         FROM study_bookmarks
         WHERE user_id = ?
         GROUP BY item_type`,
        [id]
      ),
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

  async updateStatus(actor: UserManagementActor, id: number, updateUserStatusDto: UpdateUserStatusDto) {
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

    const status = updateUserStatusDto.status === 'active' ? 'active' : 'inactive';
    if (id === actor.id && status !== 'active') {
      throw new ForbiddenException('Administrators cannot deactivate their own account');
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

  async delete(actor: UserManagementActor, id: number) {
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
    if (id === actor.id) {
      throw new ForbiddenException('Administrators cannot delete their own account');
    }
    if (user.role === 'admin' && user.status === 'active') {
      await this.assertAnotherActiveAdminExists(id);
    }

    await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
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
  }

  private assertActiveStaff(actor: UserManagementActor) {
    if (!isStaffRole(actor.role) || actor.status !== 'active') {
      throw new ForbiddenException('Active staff access is required');
    }
  }

  private canManageStaff(actor: UserManagementActor) {
    return actor.role === 'admin';
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
    await this.db.execute(
      `INSERT INTO admin_audit_events
        (event_type, actor_id, target_type, target_id, summary, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.eventType,
        input.actorId || null,
        input.targetType || null,
        input.targetId || null,
        input.summary,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
      ]
    );
  }
}
