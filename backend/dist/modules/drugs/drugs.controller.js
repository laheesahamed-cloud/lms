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
let DrugsController = class DrugsController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
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
    async record(auth) {
        const student = await this.authService.requireStudent(auth);
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DrugsController.prototype, "record", null);
exports.DrugsController = DrugsController = __decorate([
    (0, common_1.Controller)('drugs'),
    __metadata("design:paramtypes", [drugs_service_1.DrugsService,
        auth_service_1.AuthService])
], DrugsController);
//# sourceMappingURL=drugs.controller.js.map