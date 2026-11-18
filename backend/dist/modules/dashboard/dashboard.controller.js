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
exports.DashboardController = void 0;
const mobile_client_util_1 = require("../../common/utils/mobile-client.util");
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const dashboard_service_1 = require("./dashboard.service");
const record_study_activity_dto_1 = require("./dto/record-study-activity.dto");
let DashboardController = class DashboardController {
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    getAdminDashboard(authorization, today) {
        return this.dashboardService.getAdminDashboard(authorization, today);
    }
    adminSearch(authorization, q, only) {
        return this.dashboardService.adminSearch(authorization, q, only);
    }
    getStudentDashboard(authorization, appClient) {
        return this.dashboardService.getStudentDashboard(authorization, appClient);
    }
    getStudentHubTop(authorization, appClient) {
        return this.dashboardService.getStudentHubTop(authorization, (0, mobile_client_util_1.isMobileAppClient)(appClient));
    }
    getStudentQuestionOfDay(authorization) {
        return this.dashboardService.getStudentQuestionOfDay(authorization);
    }
    getStudentHubMore(authorization, appClient, lite) {
        return this.dashboardService.getStudentHubMore(authorization, appClient, lite === '1');
    }
    syncStudentProgress() {
        return { ok: 1 };
    }
    recordStudentActivity(authorization, dto) {
        return this.dashboardService.recordStudentActivity(authorization, dto);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('admin'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('reports.view'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('today')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getAdminDashboard", null);
__decorate([
    (0, common_1.Get)('admin/search'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('only')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "adminSearch", null);
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-app-client')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getStudentDashboard", null);
__decorate([
    (0, common_1.Get)('student/top'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-app-client')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getStudentHubTop", null);
__decorate([
    (0, common_1.Get)('student/question'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getStudentQuestionOfDay", null);
__decorate([
    (0, common_1.Get)('student/more'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-app-client')),
    __param(2, (0, common_1.Query)('lite')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getStudentHubMore", null);
__decorate([
    (0, common_1.Post)('student/sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "syncStudentProgress", null);
__decorate([
    (0, common_1.Post)('student/activity'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, record_study_activity_dto_1.RecordStudyActivityDto]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "recordStudentActivity", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map