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
exports.AppStartController = void 0;
const notices_service_1 = require("../notices/notices.service");
const student_catalogue_service_1 = require("../courses/student-catalogue.service");
const start_payload_service_1 = require("./start-payload.service");
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const auth_service_1 = require("../auth/auth.service");
const dashboard_service_1 = require("../dashboard/dashboard.service");
let AppStartController = class AppStartController {
    constructor(db, authService, dashboardService, notices, startPayload) {
        this.db = db;
        this.authService = authService;
        this.dashboardService = dashboardService;
        this.notices = notices;
        this.startPayload = startPayload;
    }
    async start(authorization, appClient, body) {
        const renewed = await this.authService.renewAccessToken(authorization);
        const start = await this.startPayload.build(String(renewed.user.role), renewed.accessToken, Number(body?.lastNoticeId) || 0, Number(renewed.user.id) || 0, (0, student_catalogue_service_1.progressOptions)(body?.progressFormat, body?.progressVersion), body?.courses === true);
        return {
            ok: true,
            accessToken: renewed.accessToken,
            accessExpiresIn: renewed.accessExpiresIn,
            user: renewed.user,
            ...start,
            serverTime: new Date().toISOString(),
        };
    }
    async listNotices(authorization, after) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        const role = String(user.role);
        return {
            notices: this.notices.noticesFor(role, Math.max(0, Number(after) || 0)),
            popups: this.notices.popupsFor(role),
            contentVersion: await (0, content_version_1.getContentVersion)(this.db),
        };
    }
};
exports.AppStartController = AppStartController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-app-client')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppStartController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('notices'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('after')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AppStartController.prototype, "listNotices", null);
exports.AppStartController = AppStartController = __decorate([
    (0, common_1.Controller)('app'),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        dashboard_service_1.DashboardService,
        notices_service_1.NoticesService,
        start_payload_service_1.StartPayloadService])
], AppStartController);
//# sourceMappingURL=app-start.controller.js.map