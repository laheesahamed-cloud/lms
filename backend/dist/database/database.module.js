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
var DatabaseWarmupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mysql = require("mysql2/promise");
const database_tokens_1 = require("./database.tokens");
let DatabaseWarmupService = DatabaseWarmupService_1 = class DatabaseWarmupService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(DatabaseWarmupService_1.name);
    }
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
    cleanErrorMessage(error) {
        return (error instanceof Error ? error.message : String(error || 'Unknown database error'))
            .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^'",\s}&)]+/gi, '$1=[redacted]')
            .slice(0, 500);
    }
};
DatabaseWarmupService = DatabaseWarmupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], DatabaseWarmupService);
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: database_tokens_1.DATABASE_CONNECTION,
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    return mysql.createPool({
                        host: configService.get('database.host'),
                        port: configService.get('database.port'),
                        user: configService.get('database.user'),
                        password: configService.get('database.password'),
                        database: configService.get('database.name'),
                        waitForConnections: true,
                        connectionLimit: configService.get('database.connectionLimit') || 8,
                        maxIdle: configService.get('database.maxIdle') || 4,
                        idleTimeout: configService.get('database.idleTimeout') || 60000,
                        connectTimeout: configService.get('database.connectTimeout') || 10000,
                        queueLimit: configService.get('database.queueLimit') || 100,
                        enableKeepAlive: true,
                        keepAliveInitialDelay: 0,
                    });
                },
            },
            DatabaseWarmupService,
        ],
        exports: [database_tokens_1.DATABASE_CONNECTION],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map