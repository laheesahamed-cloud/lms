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
exports.PapersController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const papers_service_1 = require("./papers.service");
const create_paper_dto_1 = require("./dto/create-paper.dto");
const update_paper_dto_1 = require("./dto/update-paper.dto");
let PapersController = class PapersController {
    constructor(papersService, authService) {
        this.papersService = papersService;
        this.authService = authService;
    }
    findAll(search, status) {
        return this.papersService.findAll({ search, status });
    }
    keywordSuggestions(query) {
        return this.papersService.keywordSuggestions(query);
    }
    findOne(id) {
        return this.papersService.findOne(id);
    }
    async create(authorization, createPaperDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.create(createPaperDto, actor);
    }
    async update(authorization, id, updatePaperDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.update(id, updatePaperDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.remove(id, actor);
    }
    listVersions(id) {
        return this.papersService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.papersService.rollback(id, versionNumber, actor);
    }
};
exports.PapersController = PapersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PapersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('keywords'),
    __param(0, (0, common_1.Query)('query')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PapersController.prototype, "keywordSuggestions", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PapersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_paper_dto_1.CreatePaperDto]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_paper_dto_1.UpdatePaperDto]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PapersController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], PapersController.prototype, "rollback", null);
exports.PapersController = PapersController = __decorate([
    (0, common_1.Controller)('papers'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __metadata("design:paramtypes", [papers_service_1.PapersService,
        auth_service_1.AuthService])
], PapersController);
//# sourceMappingURL=papers.controller.js.map