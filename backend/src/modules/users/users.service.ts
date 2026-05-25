import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { USER_ROLES, UserRole } from '../auth/role-permissions';
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

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(filters: { search?: string; status?: string; role?: string }) {
    let sql = `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE 1 = 1
    `;
    const params: Array<string> = [];

    if (filters.search?.trim()) {
      sql += ' AND (full_name LIKE ? OR email LIKE ?)';
      const like = `%${filters.search.trim()}%`;
      params.push(like, like);
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (USER_ROLES.includes(filters.role as UserRole)) {
      sql += ' AND role = ?';
      params.push(filters.role as UserRole);
    }

    sql += ` ORDER BY FIELD(status, 'inactive', 'active'), id DESC`;

    const [rows] = await this.db.execute<UserRow[]>(sql, params);
    return rows.map((row) => this.mapUser(row));
  }

  async summary() {
    const [rows] = await this.db.execute<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS pending_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_users,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) AS student_users
      FROM users
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

  async detail(id: number) {
    const [userRows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [[subscriptionRows], [attemptRows], [progressRows], [bookmarkRows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT us.*, p.name AS plan_name
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

  async create(createUserDto: CreateUserDto) {
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

    return {
      ok: true,
      id: insertId,
      fullName: createUserDto.fullName.trim(),
      email: normalizedEmail,
      role: createUserDto.role,
      status,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
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

    return {
      ok: true,
      id,
      ...(updateUserDto.fullName ? { fullName: updateUserDto.fullName.trim() } : { fullName: user.full_name }),
      ...(updateUserDto.email ? { email: updateUserDto.email.trim().toLowerCase() } : { email: user.email }),
      ...(updateUserDto.role ? { role: updateUserDto.role } : { role: user.role }),
      status: user.status,
    };
  }

  async updateStatus(id: number, updateUserStatusDto: UpdateUserStatusDto) {
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const status = updateUserStatusDto.status === 'active' ? 'active' : 'inactive';
    await this.db.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);

    return {
      ok: true,
      id,
      status,
    };
  }

  async delete(id: number) {
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
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
}
