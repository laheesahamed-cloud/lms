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
exports.WorkspaceController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const workspace_service_1 = require("./workspace.service");
let WorkspaceController = class WorkspaceController {
    constructor(workspaceService) {
        this.workspaceService = workspaceService;
    }
    listAdminAnnouncements(authorization) {
        return this.workspaceService.listAdminAnnouncements(authorization);
    }
    createAnnouncement(authorization, body) {
        return this.workspaceService.createAnnouncement(authorization, body);
    }
    updateAnnouncement(authorization, id, body) {
        return this.workspaceService.updateAnnouncement(authorization, id, body);
    }
    deleteAnnouncement(authorization, id) {
        return this.workspaceService.deleteAnnouncement(authorization, id);
    }
    listNotifications(authorization) {
        return this.workspaceService.listNotifications(authorization);
    }
    markNotificationRead(authorization, id) {
        return this.workspaceService.markNotificationRead(authorization, id);
    }
    listPlannerTasks(authorization) {
        return this.workspaceService.listPlannerTasks(authorization);
    }
    getPlannerAgenda(authorization) {
        return this.workspaceService.getPlannerAgenda(authorization);
    }
    listPlannerSuggestions(authorization) {
        return this.workspaceService.listPlannerSuggestions(authorization);
    }
    createPlannerTask(authorization, body) {
        return this.workspaceService.createPlannerTask(authorization, body);
    }
    updatePlannerTask(authorization, id, body) {
        return this.workspaceService.updatePlannerTask(authorization, id, body);
    }
    deletePlannerTask(authorization, id) {
        return this.workspaceService.deletePlannerTask(authorization, id);
    }
    getAdminReports(authorization, startDate, endDate, courseId, userId) {
        return this.workspaceService.getAdminReports(authorization, { startDate, endDate, courseId, userId });
    }
    createQuestionReport(authorization, body) {
        return this.workspaceService.createQuestionReport(authorization, body);
    }
    listQuestionReports(authorization, status) {
        return this.workspaceService.listQuestionReports(authorization, status);
    }
    listLegacyQuestionReview(authorization, status) {
        return this.workspaceService.listQuestionReports(authorization, status);
    }
    createLegacyQuestionReview() {
        throw new common_1.BadRequestException('Use question reports for student-submitted question review items');
    }
    updateQuestionReport(authorization, id, body) {
        return this.workspaceService.updateQuestionReport(authorization, id, body);
    }
    updateLegacyQuestionReview(authorization, id, body) {
        return this.workspaceService.updateQuestionReport(authorization, id, body);
    }
};
exports.WorkspaceController = WorkspaceController;
__decorate([
    (0, common_1.Get)('announcements/admin'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listAdminAnnouncements", null);
__decorate([
    (0, common_1.Post)('announcements/admin'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "createAnnouncement", null);
__decorate([
    (0, common_1.Patch)('announcements/admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "updateAnnouncement", null);
__decorate([
    (0, common_1.Delete)('announcements/admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "deleteAnnouncement", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listNotifications", null);
__decorate([
    (0, common_1.Post)('notifications/:id/read'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "markNotificationRead", null);
__decorate([
    (0, common_1.Get)('study-planner'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listPlannerTasks", null);
__decorate([
    (0, common_1.Get)('study-planner/agenda'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "getPlannerAgenda", null);
__decorate([
    (0, common_1.Get)('study-planner/suggestions'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listPlannerSuggestions", null);
__decorate([
    (0, common_1.Post)('study-planner'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "createPlannerTask", null);
__decorate([
    (0, common_1.Patch)('study-planner/:id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "updatePlannerTask", null);
__decorate([
    (0, common_1.Delete)('study-planner/:id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "deletePlannerTask", null);
__decorate([
    (0, common_1.Get)('reports/admin'),
    (0, permissions_decorator_1.RequirePermissions)('reports.view'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('courseId')),
    __param(4, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "getAdminReports", null);
__decorate([
    (0, common_1.Post)('question-reports'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "createQuestionReport", null);
__decorate([
    (0, common_1.Get)('question-reports/admin'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listQuestionReports", null);
__decorate([
    (0, common_1.Get)('question-review/admin'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "listLegacyQuestionReview", null);
__decorate([
    (0, common_1.Post)('question-review/admin'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "createLegacyQuestionReview", null);
__decorate([
    (0, common_1.Patch)('question-reports/admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "updateQuestionReport", null);
__decorate([
    (0, common_1.Patch)('question-review/admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], WorkspaceController.prototype, "updateLegacyQuestionReview", null);
exports.WorkspaceController = WorkspaceController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [workspace_service_1.WorkspaceService])
], WorkspaceController);
//# sourceMappingURL=workspace.controller.js.map