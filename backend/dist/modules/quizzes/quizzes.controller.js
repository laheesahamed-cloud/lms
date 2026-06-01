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
exports.QuizzesController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const student_guard_1 = require("../auth/student.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const quizzes_service_1 = require("./quizzes.service");
const create_quiz_dto_1 = require("./dto/create-quiz.dto");
const update_quiz_dto_1 = require("./dto/update-quiz.dto");
let QuizzesController = class QuizzesController {
    constructor(quizzesService, authService) {
        this.quizzesService = quizzesService;
        this.authService = authService;
    }
    findAll(search, courseId, topicId, status, limit, page, offset) {
        return this.quizzesService.findAll({
            search,
            courseId: courseId ? parseInt(courseId, 10) : undefined,
            topicId: topicId || undefined,
            status,
            limit: this.parsePositiveNumber(limit),
            page: this.parsePositiveNumber(page),
            offset: this.parseNonNegativeNumber(offset),
        });
    }
    meta(includeQuestions) {
        return this.quizzesService.meta({
            includeQuestions: includeQuestions === '1' || includeQuestions === 'true',
        });
    }
    getCards(id, authorization) {
        return this.quizzesService.getCards(authorization, id);
    }
    findOne(id) {
        return this.quizzesService.findOne(id);
    }
    listVersions(id) {
        return this.quizzesService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.rollback(id, versionNumber, actor);
    }
    async create(authorization, createQuizDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.create(createQuizDto, actor);
    }
    async update(authorization, id, updateQuizDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.update(id, updateQuizDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.quizzesService.remove(id, actor);
    }
    parsePositiveNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
    parseNonNegativeNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
};
exports.QuizzesController = QuizzesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('courseId')),
    __param(2, (0, common_1.Query)('topicId')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuizzesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('meta'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Query)('includeQuestions')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizzesController.prototype, "meta", null);
__decorate([
    (0, common_1.Get)(':id/cards'),
    (0, common_1.UseGuards)(student_guard_1.StudentGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], QuizzesController.prototype, "getCards", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QuizzesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QuizzesController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "rollback", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_quiz_dto_1.CreateQuizDto]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_quiz_dto_1.UpdateQuizDto]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('quizzes.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuizzesController.prototype, "remove", null);
exports.QuizzesController = QuizzesController = __decorate([
    (0, common_1.Controller)('quizzes'),
    __metadata("design:paramtypes", [quizzes_service_1.QuizzesService,
        auth_service_1.AuthService])
], QuizzesController);
//# sourceMappingURL=quizzes.controller.js.map