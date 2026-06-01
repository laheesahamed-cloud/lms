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
exports.PlansController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const create_plan_dto_1 = require("./dto/create-plan.dto");
const create_subscription_feature_dto_1 = require("./dto/create-subscription-feature.dto");
const update_plan_dto_1 = require("./dto/update-plan.dto");
const update_subscription_feature_dto_1 = require("./dto/update-subscription-feature.dto");
const plans_service_1 = require("./plans.service");
let PlansController = class PlansController {
    constructor(plansService, authService) {
        this.plansService = plansService;
        this.authService = authService;
    }
    findActive() {
        return this.plansService.findActive();
    }
    async findAdminAll(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.findAll();
    }
    async featureCatalog(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.getFeatureCatalog();
    }
    async create(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.create(dto);
    }
    async createFeature(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.createFeature(dto);
    }
    async update(authorization, id, dto) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.update(id, dto);
    }
    async updateFeature(authorization, id, dto) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.updateFeature(id, dto);
    }
    async remove(authorization, id) {
        await this.authService.requireAdmin(authorization);
        return this.plansService.remove(id);
    }
};
exports.PlansController = PlansController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "findActive", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "findAdminAll", null);
__decorate([
    (0, common_1.Get)('features'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "featureCatalog", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_plan_dto_1.CreatePlanDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('features'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_subscription_feature_dto_1.CreateSubscriptionFeatureDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "createFeature", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_plan_dto_1.UpdatePlanDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('features/:id'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_subscription_feature_dto_1.UpdateSubscriptionFeatureDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "updateFeature", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('plans.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "remove", null);
exports.PlansController = PlansController = __decorate([
    (0, common_1.Controller)('plans'),
    __metadata("design:paramtypes", [plans_service_1.PlansService,
        auth_service_1.AuthService])
], PlansController);
//# sourceMappingURL=plans.controller.js.map