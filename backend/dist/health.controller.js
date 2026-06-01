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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_tokens_1 = require("./database/database.tokens");
const performance_metrics_1 = require("./performance-metrics");
let HealthController = class HealthController {
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
    }
    check() {
        return {
            ok: true,
            service: 'lms-api',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
        };
    }
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
    async metrics(healthToken) {
        this.requireMetricsAccess(healthToken);
        const [rows] = await this.db.execute(`
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
            performance: (0, performance_metrics_1.getPerformanceMetricsSnapshot)(),
            timestamp: new Date().toISOString(),
        };
    }
    clientPerformance(body) {
        (0, performance_metrics_1.recordClientPerformanceMetric)(body);
        return { ok: true };
    }
    requireMetricsAccess(healthToken) {
        const nodeEnv = this.configService.get('NODE_ENV') || 'development';
        if (nodeEnv !== 'production')
            return;
        const configuredToken = this.configService.get('HEALTH_METRICS_TOKEN') ||
            this.configService.get('healthMetricsToken') ||
            '';
        if (!configuredToken || healthToken !== configuredToken) {
            throw new common_1.UnauthorizedException('Metrics access is restricted');
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('metrics'),
    __param(0, (0, common_1.Headers)('x-health-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "metrics", null);
__decorate([
    (0, common_1.Post)('client-performance'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "clientPerformance", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], HealthController);
//# sourceMappingURL=health.controller.js.map