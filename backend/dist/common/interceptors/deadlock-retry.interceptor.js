"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadlockRetryInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const DEADLOCK_ERRNO = 1213;
function isDeadlock(error) {
    const e = error;
    return e?.errno === DEADLOCK_ERRNO || e?.code === 'ER_LOCK_DEADLOCK';
}
let DeadlockRetryInterceptor = class DeadlockRetryInterceptor {
    intercept(context, next) {
        const method = String(context.switchToHttp().getRequest()?.method || 'GET').toUpperCase();
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
            return next.handle();
        return next.handle().pipe((0, rxjs_1.retry)({
            count: 2,
            delay: (error) => (isDeadlock(error) ? (0, rxjs_1.timer)(20 + Math.floor(Math.random() * 60)) : (0, rxjs_1.throwError)(() => error)),
        }));
    }
};
exports.DeadlockRetryInterceptor = DeadlockRetryInterceptor;
exports.DeadlockRetryInterceptor = DeadlockRetryInterceptor = __decorate([
    (0, common_1.Injectable)()
], DeadlockRetryInterceptor);
//# sourceMappingURL=deadlock-retry.interceptor.js.map