import { Controller, Get, Inject } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database/database.tokens';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  @Get()
  check() {
    return {
      ok: true,
      service: 'lms-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  async ready() {
    const startedAt = Date.now();
    await this.db.query('SELECT 1');

    return {
      ok: true,
      service: 'lms-api',
      checks: {
        database: {
          ok: true,
          latencyMs: Date.now() - startedAt,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  async metrics() {
    const [rows] = await this.db.execute<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COUNT(*) FROM lessons) AS lessons,
        (SELECT COUNT(*) FROM questions) AS questions,
        (SELECT COUNT(*) FROM quiz_attempts) AS quiz_attempts
    `);
    const row = rows[0] || {};

    return {
      ok: true,
      service: 'lms-api',
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
      },
      totals: {
        users: Number(row.users || 0),
        courses: Number(row.courses || 0),
        lessons: Number(row.lessons || 0),
        questions: Number(row.questions || 0),
        quizAttempts: Number(row.quiz_attempts || 0),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
