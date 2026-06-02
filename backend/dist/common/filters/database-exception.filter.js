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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const DATABASE_UNAVAILABLE_CODE = 'DATABASE_UNAVAILABLE';
const DATABASE_AVAILABILITY_ERROR_CODES = new Set([
    'PROTOCOL_CONNECTION_LOST',
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'ER_CON_COUNT_ERROR',
    'ER_SERVER_SHUTDOWN',
    'ER_SERVER_GONE_ERROR',
    'CR_SERVER_GONE_ERROR',
    'CR_SERVER_LOST',
]);
function getErrorCode(error) {
    const code = error?.code;
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error || '');
}
function isDatabaseUnavailableError(error) {
    const code = getErrorCode(error);
    if (code && DATABASE_AVAILABILITY_ERROR_CODES.has(code)) {
        return true;
    }
    const message = getErrorMessage(error);
    return /(?:connect\s+ECONNREFUSED|connect\s+ETIMEDOUT|read\s+ECONNRESET|PROTOCOL_CONNECTION_LOST|server has gone away|pool is closed|connection is in closed state|can't enqueue .* after fatal error)/i.test(message);
}
let DatabaseExceptionFilter = class DatabaseExceptionFilter extends core_1.BaseExceptionFilter {
    constructor(adapterHost) {
        super(adapterHost.httpAdapter);
        this.adapterHost = adapterHost;
    }
    catch(exception, host) {
        if (!isDatabaseUnavailableError(exception)) {
            super.catch(exception, host);
            return;
        }
        const httpAdapter = this.adapterHost.httpAdapter;
        const context = host.switchToHttp();
        const response = context.getResponse();
        const request = context.getRequest();
        httpAdapter.setHeader(response, 'Retry-After', '3');
        httpAdapter.reply(response, {
            statusCode: 503,
            code: DATABASE_UNAVAILABLE_CODE,
            message: 'Database is temporarily unavailable. Please try again shortly.',
            checks: {
                database: {
                    ok: false,
                },
            },
            path: request?.originalUrl || request?.url || '',
            timestamp: new Date().toISOString(),
        }, 503);
    }
};
exports.DatabaseExceptionFilter = DatabaseExceptionFilter;
exports.DatabaseExceptionFilter = DatabaseExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [core_1.HttpAdapterHost])
], DatabaseExceptionFilter);
//# sourceMappingURL=database-exception.filter.js.map