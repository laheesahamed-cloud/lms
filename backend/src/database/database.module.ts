import { Global, Inject, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database.tokens';

@Injectable()
class DatabaseWarmupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseWarmupService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: mysql.Pool) {}

  onApplicationBootstrap() {
    const startedAt = Date.now();
    void this.db
      .query('SELECT 1')
      .then(() => {
        this.logger.log(`Database pool warmed in ${Date.now() - startedAt}ms`);
      })
      .catch((error) => {
        this.logger.warn(`Database pool warmup failed: ${this.cleanErrorMessage(error)}`);
      });
  }

  private cleanErrorMessage(error: unknown) {
    return (error instanceof Error ? error.message : String(error || 'Unknown database error'))
      .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^'",\s}&)]+/gi, '$1=[redacted]')
      .slice(0, 500);
  }
}

// Closes every database connection when the app is told to stop (the host's
// restart sends SIGTERM). Without this the old copy kept its connections open
// while the new copy opened its own, and the two together went over the cap.
// pool.end() lets a query already running finish, then closes the connection.
@Injectable()
class DatabaseShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseShutdownService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: mysql.Pool) {}

  async onApplicationShutdown(signal?: string) {
    try {
      await this.db.end();
      this.logger.log(`Database connections closed${signal ? ` (${signal})` : ''}`);
    } catch (error) {
      this.logger.warn(`Closing database connections failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return mysql.createPool({
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          user: configService.get<string>('database.user'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          waitForConnections: true,
          connectionLimit: configService.get<number>('database.connectionLimit') || 4,
          maxIdle: configService.get<number>('database.maxIdle') || 1,
          idleTimeout: configService.get<number>('database.idleTimeout') || 10000,
          connectTimeout: configService.get<number>('database.connectTimeout') || 10000,
          queueLimit: configService.get<number>('database.queueLimit') || 100,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
      },
    },
    DatabaseWarmupService,
    DatabaseShutdownService,
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
