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
exports.DrugsController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const drugs_service_1 = require("./drugs.service");
const database_tokens_1 = require("../../database/database.tokens");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
let DrugsController = class DrugsController {
    constructor(svc, authService, db) {
        this.svc = svc;
        this.authService = authService;
        this.db = db;
    }
    async paidPlan(userId) {
        return (await (0, subscription_scope_1.getScopeRows)(this.db, userId)).some((r) => String(r.plan_slug || '') !== 'free');
    }
    async list(auth, have) {
        const student = await this.authService.requireStudent(auth);
        const settings = this.svc.getSettings();
        if (!settings.enabled)
            return { blocked: true, reason: 'feature_disabled' };
        const [list, paid] = await Promise.all([this.svc.drugList(), this.paidPlan(student.id)]);
        const spin = { paid, used: paid ? 0 : await this.svc.spinsUsed(student.id) };
        const same = Number(have) > 0 && Number(have) === list.v;
        return { v: list.v, ...(same ? { unchanged: true } : { drugs: list.drugs }), useCount: spin.used, freeLimit: settings.freeLimit, hasSubscription: spin.paid };
    }
    async item(id, auth) {
        await this.authService.requireStudent(auth);
        if (!this.svc.getSettings().enabled)
            return { blocked: true, reason: 'feature_disabled' };
        const drug = await this.svc.drugItem(id);
        if (!drug)
            throw new common_1.NotFoundException('Drug not found');
        return { drug };
    }
    async batch(count = '10', auth) {
        const student = await this.authService.requireStudent(auth);
        const settings = this.svc.getSettings();
        if (!settings.enabled) {
            return { blocked: true, reason: 'feature_disabled' };
        }
        const [hasSubscription, result] = await Promise.all([
            this.svc.checkSubscription(student.id),
            this.svc.getBatch(student.id, Number(count)),
        ]);
        return {
            ...result,
            hasSubscription,
        };
    }
    async record(auth, body) {
        const student = await this.authService.requireStudent(auth);
        if (body && body.count !== undefined) {
            if (await this.paidPlan(student.id))
                return { ok: true };
            await this.svc.recordSpins(student.id, Number(body.count));
            return { ok: true };
        }
        const hasSubscription = await this.svc.checkSubscription(student.id);
        const settings = this.svc.getSettings();
        const useCount = await this.svc.getSpinCount(student.id);
        if (!hasSubscription && useCount >= settings.freeLimit) {
            return { ok: false, reason: 'limit_reached', useCount, freeLimit: settings.freeLimit };
        }
        await this.svc.recordSpin(student.id);
        return { ok: true, useCount: useCount + 1, freeLimit: settings.freeLimit };
    }
};
exports.DrugsController = DrugsController;
__decorate([
    (0, common_1.Get)('list'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('have')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DrugsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('item/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DrugsController.prototype, "item", null);
__decorate([
    (0, common_1.Get)('batch'),
    __param(0, (0, common_1.Query)('count')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DrugsController.prototype, "batch", null);
__decorate([
    (0, common_1.Post)('record'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DrugsController.prototype, "record", null);
exports.DrugsController = DrugsController = __decorate([
    (0, common_1.Controller)('drugs'),
    __param(2, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [drugs_service_1.DrugsService,
        auth_service_1.AuthService, Object])
], DrugsController);
//# sourceMappingURL=drugs.controller.js.map