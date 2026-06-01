import { Body, Controller, Get, Headers, Inject, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database/database.tokens';
import { getPerformanceMetricsSnapshot, recordClientPerformanceMetric } from './performance-metrics';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly configService: ConfigService
  ) {}

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

    try {
      await this.db.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'lms-api',
        checks: {
          database: {
            ok: false,
            latencyMs: Date.now() - startedAt,
            message: this.cleanErrorMessage(error),
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

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
  async metrics(@Headers('x-health-token') healthToken?: string) {
    this.requireMetricsAccess(healthToken);
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
      performance: getPerformanceMetricsSnapshot(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('client-performance')
  clientPerformance(@Body() body: unknown) {
    recordClientPerformanceMetric(body);
    return { ok: true };
  }

  private requireMetricsAccess(healthToken?: string) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (nodeEnv !== 'production') return;

    const configuredToken = this.configService.get<string>('HEALTH_METRICS_TOKEN') ||
      this.configService.get<string>('healthMetricsToken') ||
      '';
    if (!configuredToken || healthToken !== configuredToken) {
      throw new UnauthorizedException('Metrics access is restricted');
    }
  }

  private cleanErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown database error');
    return message
      .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^'",\s}&)]+/gi, '$1=[redacted]')
      .slice(0, 1000);
  }
}
