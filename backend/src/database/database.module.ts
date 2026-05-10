import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database.tokens';

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
          connectionLimit: configService.get<number>('database.connectionLimit') || 8,
          maxIdle: configService.get<number>('database.maxIdle') || 4,
          idleTimeout: configService.get<number>('database.idleTimeout') || 60000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
