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
var RideAlongInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RideAlongInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const subscription_scope_1 = require("../auth/subscription-scope");
const progress_write_1 = require("../utils/progress-write");
const streak_1 = require("../../modules/xp/streak");
let RideAlongInterceptor = RideAlongInterceptor_1 = class RideAlongInterceptor {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(RideAlongInterceptor_1.name);
    }
    intercept(context, next) {
        if (context.getType() !== 'http')
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const body = req?.body;
        if (!body || typeof body !== 'object' || !('practices' in body))
            return next.handle();
        const list = (0, progress_write_1.parseRideAlong)(body);
        delete body.practices;
        if (!list.length)
            return next.handle();
        (0, progress_write_1.rememberRideAlong)(list);
        const res = context.switchToHttp().getResponse();
        return next.handle().pipe((0, rxjs_1.mergeMap)((data) => (0, rxjs_1.from)((async () => {
            if ((0, progress_write_1.rideAlongPending)()) {
                const ctx = subscription_scope_1.requestContext.getStore();
                const replyUser = data?.user;
                const fromReply = replyUser && String(replyUser.role || '') === 'student' ? Number(replyUser.id) : 0;
                const userId = Number(ctx?.userId || (0, subscription_scope_1.studentFromRequest)()?.id || fromReply || 0);
                if (userId > 0) {
                    try {
                        await (0, progress_write_1.applyProgress)(this.db, userId, (0, streak_1.localDateKey)(new Date()));
                    }
                    catch (error) {
                        (0, progress_write_1.returnRideAlong)();
                        this.logger.warn(`Practices not saved for ${userId}: ${error?.message || error}`);
                    }
                }
            }
            const saved = (0, progress_write_1.rideAlongSavedMax)();
            if (saved > 0 && res && !res.headersSent)
                res.setHeader('X-Practices-Applied', String(saved));
            return data;
        })())));
    }
};
exports.RideAlongInterceptor = RideAlongInterceptor;
exports.RideAlongInterceptor = RideAlongInterceptor = RideAlongInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], RideAlongInterceptor);
//# sourceMappingURL=ride-along.interceptor.js.map