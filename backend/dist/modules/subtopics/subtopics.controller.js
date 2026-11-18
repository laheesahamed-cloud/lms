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
exports.SubtopicsController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const subtopics_service_1 = require("./subtopics.service");
const create_subtopic_dto_1 = require("./dto/create-subtopic.dto");
const update_subtopic_dto_1 = require("./dto/update-subtopic.dto");
let SubtopicsController = class SubtopicsController {
    constructor(subtopicsService, authService) {
        this.subtopicsService = subtopicsService;
        this.authService = authService;
    }
    findAll(topicId) {
        return this.subtopicsService.findAll(topicId ? parseInt(topicId, 10) : undefined);
    }
    async create(authorization, createSubtopicDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.create(createSubtopicDto, actor);
    }
    async update(authorization, id, updateSubtopicDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.update(id, updateSubtopicDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.remove(id, actor);
    }
    listVersions(id) {
        return this.subtopicsService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.subtopicsService.rollback(id, versionNumber, actor);
    }
};
exports.SubtopicsController = SubtopicsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('topicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubtopicsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_subtopic_dto_1.CreateSubtopicDto]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_subtopic_dto_1.UpdateSubtopicDto]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SubtopicsController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], SubtopicsController.prototype, "rollback", null);
exports.SubtopicsController = SubtopicsController = __decorate([
    (0, common_1.Controller)('subtopics'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __metadata("design:paramtypes", [subtopics_service_1.SubtopicsService,
        auth_service_1.AuthService])
], SubtopicsController);
//# sourceMappingURL=subtopics.controller.js.map