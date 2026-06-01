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
exports.TheoryRecapController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const theory_recap_service_1 = require("./theory-recap.service");
const upsert_theory_recap_dto_1 = require("./dto/upsert-theory-recap.dto");
let TheoryRecapController = class TheoryRecapController {
    constructor(theoryRecapService, authService) {
        this.theoryRecapService = theoryRecapService;
        this.authService = authService;
    }
    async getByQuestionId(questionId, authorization) {
        await this.authService.requireAuthenticatedUser(authorization);
        return this.theoryRecapService.getByQuestionId(questionId);
    }
    async upsert(questionId, dto, authorization) {
        await this.authService.requireAdmin(authorization);
        return this.theoryRecapService.upsert(questionId, dto, 'manual');
    }
    async generate(questionId, authorization) {
        await this.authService.requireAdmin(authorization);
        return this.theoryRecapService.generateForQuestion(questionId);
    }
    async regenerate(questionId, authorization) {
        await this.authService.requireAdmin(authorization);
        await this.theoryRecapService.delete(questionId);
        return this.theoryRecapService.generateForQuestion(questionId);
    }
    async deleteRecap(questionId, authorization) {
        await this.authService.requireAdmin(authorization);
        return this.theoryRecapService.delete(questionId);
    }
    async bulkGenerate(body, authorization) {
        await this.authService.requireAdmin(authorization);
        return this.theoryRecapService.bulkGenerate(body.questionIds || []);
    }
};
exports.TheoryRecapController = TheoryRecapController;
__decorate([
    (0, common_1.Get)('question/:questionId'),
    __param(0, (0, common_1.Param)('questionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "getByQuestionId", null);
__decorate([
    (0, common_1.Put)('question/:questionId'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('questionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, upsert_theory_recap_dto_1.UpsertTheoryRecapDto, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "upsert", null);
__decorate([
    (0, common_1.Post)('question/:questionId/generate'),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    __param(0, (0, common_1.Param)('questionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('question/:questionId/regenerate'),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    __param(0, (0, common_1.Param)('questionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "regenerate", null);
__decorate([
    (0, common_1.Delete)('question/:questionId'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('questionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "deleteRecap", null);
__decorate([
    (0, common_1.Post)('bulk-generate'),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheoryRecapController.prototype, "bulkGenerate", null);
exports.TheoryRecapController = TheoryRecapController = __decorate([
    (0, common_1.Controller)('theory-recap'),
    __metadata("design:paramtypes", [theory_recap_service_1.TheoryRecapService,
        auth_service_1.AuthService])
], TheoryRecapController);
//# sourceMappingURL=theory-recap.controller.js.map