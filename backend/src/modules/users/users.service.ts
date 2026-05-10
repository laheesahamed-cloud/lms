import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type UserRow = RowDataPacket & {
  id: number;
  full_name: string;
  email: string;
  role: 'admin' | 'student';
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

    if (filters.role === 'admin' || filters.role === 'student') {
      sql += ' AND role = ?';
      params.push(filters.role);
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
      `SELECT id, duration_days
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
    const durationDays = Math.max(Number(entryPlan.duration_days || 3650), 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays - 1);
    const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

    await this.db.execute(
      `
        INSERT INTO user_subscriptions (
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on admin-created student account', 'active', 'waived', ?, ?)
      `,
      [userId, Number(entryPlan.id), toDateOnly(startDate), toDateOnly(endDate)]
    );
  }
}
