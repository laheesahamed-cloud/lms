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
exports.SetupService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const REQUIRED_TABLES = [
    ['users', 'Users'],
    ['courses', 'Courses'],
    ['topics', 'Topics'],
    ['subtopics', 'Subtopics'],
    ['lessons', 'Lessons'],
    ['questions', 'Questions'],
    ['quizzes', 'Quizzes'],
    ['system_settings', 'System settings'],
    ['ai_provider_configs', 'AI providers'],
];
const PAYMENT_KEYS = ['payment_payhere_enabled', 'payment_payhere_merchant_id', 'payment_payhere_merchant_secret'];
const SMTP_KEYS = ['smtp_enabled', 'smtp_host', 'smtp_username', 'smtp_password', 'smtp_from_email'];
let SetupService = class SetupService {
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
    }
    async getSetupStatus() {
        const generatedAt = new Date().toISOString();
        const database = await this.getDatabaseStatus();
        const storage = await this.getStorageStatus();
        const checks = [
            database.status,
            storage.status,
            ...(database.configuration?.map((item) => item.status) || []),
        ];
        const overall = checks.includes('error') ? 'error' : checks.includes('warning') ? 'warning' : 'ok';
        return {
            overall,
            generatedAt,
            database,
            storage,
        };
    }
    async getDatabaseStatus() {
        try {
            await this.db.query('SELECT 1 AS ok');
            const [tableRows] = await this.db.query('SHOW TABLES');
            const tableNames = new Set(tableRows.map((row) => String(Object.values(row)[0] || '').trim()).filter(Boolean));
            const tables = await Promise.all(REQUIRED_TABLES.map(async ([name, label]) => this.getTableCheck(name, label, tableNames.has(name))));
            const missingTables = tables.filter((table) => !table.present);
            const configuration = await this.getConfigurationChecks(tableNames);
            const hasActiveAdmin = !configuration.some((item) => item.key === 'admin-users' && item.status !== 'ok');
            const status = missingTables.length > 0 || !hasActiveAdmin
                ? 'warning'
                : configuration.some((item) => item.status === 'warning')
                    ? 'warning'
                    : 'ok';
            return {
                status,
                connected: true,
                message: missingTables.length > 0
                    ? `${missingTables.length} required database table(s) are missing.`
                    : 'Database is connected and required tables are present.',
                tables,
                configuration,
            };
        }
        catch (error) {
            return {
                status: 'error',
                connected: false,
                message: 'Database connection failed. Check backend database environment values and MySQL status.',
                tables: [],
                configuration: [],
            };
        }
    }
    async getTableCheck(name, label, present) {
        if (!present) {
            return { name, label, present: false, count: null };
        }
        try {
            const table = (0, sql_safety_1.sqlIdentifier)(name, REQUIRED_TABLES.map(([tableName]) => tableName), 'setup table');
            const [rows] = await this.db.query(`SELECT COUNT(*) AS total FROM ${table}`);
            return { name, label, present: true, count: Number(rows[0]?.total || 0) };
        }
        catch {
            return { name, label, present: true, count: null };
        }
    }
    async getConfigurationChecks(tableNames) {
        const settings = tableNames.has('system_settings') ? await this.getSettingsMap([...PAYMENT_KEYS, ...SMTP_KEYS]) : new Map();
        const aiProviderCount = tableNames.has('ai_provider_configs') ? await this.countAiProviders() : 0;
        const activeAdminCount = tableNames.has('users') ? await this.countActiveAdmins() : 0;
        const paymentEnabled = settings.get('payment_payhere_enabled') === 'true';
        const paymentConfigured = Boolean(settings.get('payment_payhere_merchant_id') && settings.get('payment_payhere_merchant_secret'));
        const smtpEnabled = settings.get('smtp_enabled') === 'true';
        const smtpConfigured = Boolean(settings.get('smtp_host') &&
            settings.get('smtp_username') &&
            settings.get('smtp_password') &&
            settings.get('smtp_from_email'));
        return [
            {
                key: 'admin-users',
                label: 'Admin users',
                status: activeAdminCount > 0 ? 'ok' : 'warning',
                value: `${activeAdminCount} active admin${activeAdminCount === 1 ? '' : 's'}`,
                detail: 'At least one active admin account should exist before handover.',
            },
            {
                key: 'payments',
                label: 'PayHere payments',
                status: paymentEnabled && !paymentConfigured ? 'warning' : 'ok',
                value: paymentConfigured ? 'Configured' : paymentEnabled ? 'Enabled, missing credentials' : 'Disabled',
                detail: 'Payment credentials stay encrypted in the LMS database.',
            },
            {
                key: 'smtp',
                label: 'SMTP email',
                status: smtpEnabled && !smtpConfigured ? 'warning' : 'ok',
                value: smtpConfigured ? 'Configured' : smtpEnabled ? 'Enabled, missing credentials' : 'Disabled',
                detail: 'Needed for real password reset emails.',
            },
            {
                key: 'ai',
                label: 'AI providers',
                status: aiProviderCount > 0 ? 'ok' : 'warning',
                value: `${aiProviderCount} saved provider${aiProviderCount === 1 ? '' : 's'}`,
                detail: 'AI-powered lessons and question tools use the active provider.',
            },
        ];
    }
    async getSettingsMap(keys) {
        if (keys.length === 0) {
            return new Map();
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(keys);
        const [rows] = await this.db.query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
        return new Map(rows.map((row) => [row.setting_key, String(row.setting_value || '').trim()]));
    }
    async countAiProviders() {
        const [rows] = await this.db.query(`SELECT COUNT(*) AS total FROM ai_provider_configs WHERE status = 'active' AND api_key_encrypted IS NOT NULL AND api_key_encrypted <> ''`);
        return Number(rows[0]?.total || 0);
    }
    async countActiveAdmins() {
        const [rows] = await this.db.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'`);
        return Number(rows[0]?.total || 0);
    }
    async getStorageStatus() {
        const uploadsPath = (0, path_1.join)(process.cwd(), 'uploads');
        try {
            await (0, promises_1.access)(uploadsPath, fs_1.constants.R_OK | fs_1.constants.W_OK);
            return {
                status: 'ok',
                message: 'Upload folder is readable and writable.',
            };
        }
        catch {
            return {
                status: 'warning',
                message: 'Upload folder is missing or not writable. Payment proofs and uploads may fail until it exists.',
            };
        }
    }
};
exports.SetupService = SetupService;
exports.SetupService = SetupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], SetupService);
//# sourceMappingURL=setup.service.js.map