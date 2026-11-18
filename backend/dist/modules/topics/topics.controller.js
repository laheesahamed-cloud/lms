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
exports.TopicsController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const topics_service_1 = require("./topics.service");
const create_topic_dto_1 = require("./dto/create-topic.dto");
const update_topic_dto_1 = require("./dto/update-topic.dto");
let TopicsController = class TopicsController {
    constructor(topicsService, authService) {
        this.topicsService = topicsService;
        this.authService = authService;
    }
    findAll(courseId) {
        return this.topicsService.findAll(courseId ? parseInt(courseId, 10) : undefined);
    }
    findOne(id) {
        return this.topicsService.findOne(id);
    }
    async create(authorization, createTopicDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.create(createTopicDto, actor);
    }
    async update(authorization, id, updateTopicDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.update(id, updateTopicDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.remove(id, actor);
    }
    listVersions(id) {
        return this.topicsService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.topicsService.rollback(id, versionNumber, actor);
    }
};
exports.TopicsController = TopicsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TopicsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TopicsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_topic_dto_1.CreateTopicDto]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_topic_dto_1.UpdateTopicDto]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TopicsController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], TopicsController.prototype, "rollback", null);
exports.TopicsController = TopicsController = __decorate([
    (0, common_1.Controller)('topics'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __metadata("design:paramtypes", [topics_service_1.TopicsService,
        auth_service_1.AuthService])
], TopicsController);
//# sourceMappingURL=topics.controller.js.map