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
exports.QuestionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const questions_service_1 = require("./questions.service");
const bulk_delete_questions_dto_1 = require("./dto/bulk-delete-questions.dto");
const bulk_update_question_keywords_dto_1 = require("./dto/bulk-update-question-keywords.dto");
const create_question_dto_1 = require("./dto/create-question.dto");
const update_question_dto_1 = require("./dto/update-question.dto");
const workbookUploadOptions = {
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
        fields: 0,
        fieldNameSize: 80,
    },
    fileFilter: (_request, file, callback) => {
        const name = String(file.originalname || '').toLowerCase();
        const mimetype = String(file.mimetype || '').toLowerCase();
        const allowedExtension = name.endsWith('.csv');
        const allowedMime = mimetype === 'text/csv' ||
            mimetype === 'application/csv' ||
            mimetype === 'application/vnd.ms-excel';
        if (!allowedExtension || !allowedMime) {
            callback(new common_1.BadRequestException('Only CSV question imports are allowed'), false);
            return;
        }
        callback(null, true);
    },
};
let QuestionsController = class QuestionsController {
    constructor(questionsService, authService) {
        this.questionsService = questionsService;
        this.authService = authService;
    }
    findAll(search, status, type, courseId, subjectId, topicId, lessonId, paperId, category, unclassified, keywords, usage, ids, excludeIds, limit, page, offset, random) {
        return this.questionsService.findAll({
            search,
            status,
            type,
            category,
            keywords,
            usage,
            courseId: courseId ? Number(courseId) : undefined,
            subjectId: subjectId ? Number(subjectId) : undefined,
            topicId: topicId ? Number(topicId) : undefined,
            lessonId: lessonId ? Number(lessonId) : undefined,
            paperId: paperId ? Number(paperId) : undefined,
            unclassified: unclassified === '1' || unclassified === 'true',
            ids: this.parseIdList(ids),
            excludeIds: this.parseIdList(excludeIds),
            limit: this.parseLimit(limit),
            page: this.parsePositiveNumber(page),
            offset: this.parseNonNegativeNumber(offset),
            random: random === '1' || random === 'true',
        });
    }
    meta() {
        return this.questionsService.meta();
    }
    counts(search, status, type, courseId, subjectId, topicId, lessonId, paperId, category, keywords) {
        return this.questionsService.countByFilters({
            search,
            status,
            type,
            category,
            keywords,
            courseId: courseId ? Number(courseId) : undefined,
            subjectId: subjectId ? Number(subjectId) : undefined,
            topicId: topicId ? Number(topicId) : undefined,
            lessonId: lessonId ? Number(lessonId) : undefined,
            paperId: paperId ? Number(paperId) : undefined,
        });
    }
    async exportQuestions(authorization, search, status, type, courseId, subjectId, topicId, lessonId, paperId, category, unclassified, keywords, usage, response) {
        const actor = await this.authService.requireAdmin(authorization);
        const workbook = await this.questionsService.exportWorkbook({
            search,
            status,
            type,
            category,
            keywords,
            usage,
            courseId: courseId ? Number(courseId) : undefined,
            subjectId: subjectId ? Number(subjectId) : undefined,
            topicId: topicId ? Number(topicId) : undefined,
            lessonId: lessonId ? Number(lessonId) : undefined,
            paperId: paperId ? Number(paperId) : undefined,
            unclassified: unclassified === '1' || unclassified === 'true',
        }, actor);
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="questions-export-${Date.now()}.csv"`);
        response.send(workbook);
    }
    async exportQuestionsLegacy(authorization, search, status, type, courseId, subjectId, topicId, lessonId, paperId, category, unclassified, keywords, usage, response) {
        return this.exportQuestions(authorization, search, status, type, courseId, subjectId, topicId, lessonId, paperId, category, unclassified, keywords, usage, response);
    }
    async importQuestions(authorization, file) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.importWorkbook(file, actor);
    }
    async importQuestionsLegacy(authorization, file) {
        return this.importQuestions(authorization, file);
    }
    listVersions(id) {
        return this.questionsService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.rollback(id, versionNumber, actor);
    }
    findOne(id) {
        return this.questionsService.findOne(id);
    }
    async create(authorization, createQuestionDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.create(createQuestionDto, actor);
    }
    async bulkUpdateKeywords(authorization, bulkUpdateQuestionKeywordsDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto, actor);
    }
    async bulkDelete(authorization, bulkDeleteQuestionsDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.bulkDelete(bulkDeleteQuestionsDto, actor);
    }
    async update(authorization, id, updateQuestionDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.update(id, updateQuestionDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.questionsService.remove(id, actor);
    }
    parseIdList(raw) {
        return Array.from(new Set(String(raw || '')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0)));
    }
    parseLimit(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }
        return Math.min(Math.max(Math.trunc(value), 1), 200);
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
exports.QuestionsController = QuestionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('courseId')),
    __param(4, (0, common_1.Query)('subjectId')),
    __param(5, (0, common_1.Query)('topicId')),
    __param(6, (0, common_1.Query)('lessonId')),
    __param(7, (0, common_1.Query)('paperId')),
    __param(8, (0, common_1.Query)('category')),
    __param(9, (0, common_1.Query)('unclassified')),
    __param(10, (0, common_1.Query)('keywords')),
    __param(11, (0, common_1.Query)('usage')),
    __param(12, (0, common_1.Query)('ids')),
    __param(13, (0, common_1.Query)('excludeIds')),
    __param(14, (0, common_1.Query)('limit')),
    __param(15, (0, common_1.Query)('page')),
    __param(16, (0, common_1.Query)('offset')),
    __param(17, (0, common_1.Query)('random')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('meta'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "meta", null);
__decorate([
    (0, common_1.Get)('counts'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('courseId')),
    __param(4, (0, common_1.Query)('subjectId')),
    __param(5, (0, common_1.Query)('topicId')),
    __param(6, (0, common_1.Query)('lessonId')),
    __param(7, (0, common_1.Query)('paperId')),
    __param(8, (0, common_1.Query)('category')),
    __param(9, (0, common_1.Query)('keywords')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "counts", null);
__decorate([
    (0, common_1.Get)('export/workbook'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('courseId')),
    __param(5, (0, common_1.Query)('subjectId')),
    __param(6, (0, common_1.Query)('topicId')),
    __param(7, (0, common_1.Query)('lessonId')),
    __param(8, (0, common_1.Query)('paperId')),
    __param(9, (0, common_1.Query)('category')),
    __param(10, (0, common_1.Query)('unclassified')),
    __param(11, (0, common_1.Query)('keywords')),
    __param(12, (0, common_1.Query)('usage')),
    __param(13, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "exportQuestions", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('courseId')),
    __param(5, (0, common_1.Query)('subjectId')),
    __param(6, (0, common_1.Query)('topicId')),
    __param(7, (0, common_1.Query)('lessonId')),
    __param(8, (0, common_1.Query)('paperId')),
    __param(9, (0, common_1.Query)('category')),
    __param(10, (0, common_1.Query)('unclassified')),
    __param(11, (0, common_1.Query)('keywords')),
    __param(12, (0, common_1.Query)('usage')),
    __param(13, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "exportQuestionsLegacy", null);
__decorate([
    (0, common_1.Post)('import/workbook'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', workbookUploadOptions)),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "importQuestions", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', workbookUploadOptions)),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "importQuestionsLegacy", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "rollback", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_question_dto_1.CreateQuestionDto]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('keywords/bulk'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_update_question_keywords_dto_1.BulkUpdateQuestionKeywordsDto]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "bulkUpdateKeywords", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_delete_questions_dto_1.BulkDeleteQuestionsDto]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_question_dto_1.UpdateQuestionDto]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "remove", null);
exports.QuestionsController = QuestionsController = __decorate([
    (0, common_1.Controller)('questions'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('questions.manage'),
    __metadata("design:paramtypes", [questions_service_1.QuestionsService,
        auth_service_1.AuthService])
], QuestionsController);
//# sourceMappingURL=questions.controller.js.map