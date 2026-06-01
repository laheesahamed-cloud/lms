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
exports.ContentGovernanceController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const content_governance_service_1 = require("./content-governance.service");
let ContentGovernanceController = class ContentGovernanceController {
    constructor(contentGovernanceService, authService) {
        this.contentGovernanceService = contentGovernanceService;
        this.authService = authService;
    }
    async exportEvidence(authorization, entityType, entityId, workflowState, response) {
        const actor = await this.authService.requireAdmin(authorization);
        const csv = await this.contentGovernanceService.exportEvidence({
            entityType,
            entityId: entityId ? Number(entityId) : undefined,
            workflowState,
            actorId: actor.id,
        });
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="content-governance-evidence-${Date.now()}.csv"`);
        response.send(csv);
    }
    async listEvidence(authorization, entityType, entityId, workflowState) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.contentGovernanceService.listEvidence({
            entityType,
            entityId: entityId ? Number(entityId) : undefined,
            workflowState,
            actorId: actor.id,
        });
    }
};
exports.ContentGovernanceController = ContentGovernanceController;
__decorate([
    (0, common_1.Get)('evidence/export'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('entityType')),
    __param(2, (0, common_1.Query)('entityId')),
    __param(3, (0, common_1.Query)('workflowState')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ContentGovernanceController.prototype, "exportEvidence", null);
__decorate([
    (0, common_1.Get)('evidence'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('entityType')),
    __param(2, (0, common_1.Query)('entityId')),
    __param(3, (0, common_1.Query)('workflowState')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ContentGovernanceController.prototype, "listEvidence", null);
exports.ContentGovernanceController = ContentGovernanceController = __decorate([
    (0, common_1.Controller)('content-governance'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __metadata("design:paramtypes", [content_governance_service_1.ContentGovernanceService,
        auth_service_1.AuthService])
], ContentGovernanceController);
//# sourceMappingURL=content-governance.controller.js.map