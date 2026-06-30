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
exports.AuscultationAdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const auscultation_service_1 = require("./auscultation.service");
let AuscultationAdminController = class AuscultationAdminController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    async requireAdmin(auth) {
        return this.authService.requireAdmin(auth);
    }
    cat(c) {
        if (c === 'heart' || c === 'lung')
            return c;
        return undefined;
    }
    async listTopics(category, auth) {
        await this.requireAdmin(auth);
        const topics = await this.svc.listTopicsAdmin(this.cat(category));
        return { topics };
    }
    async createTopic(body, auth) {
        await this.requireAdmin(auth);
        if (!body?.title?.trim())
            throw new common_1.BadRequestException('Title is required');
        return this.svc.createTopic(body);
    }
    async getTopic(id, auth) {
        await this.requireAdmin(auth);
        return this.svc.getTopic(id);
    }
    async updateTopic(id, body, auth) {
        await this.requireAdmin(auth);
        await this.svc.updateTopic(id, body);
        return { ok: true };
    }
    async toggleTopic(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.toggleTopic(id);
        return { ok: true };
    }
    async deleteTopic(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.deleteTopic(id);
        return { ok: true };
    }
    async listCards(id, auth) {
        await this.requireAdmin(auth);
        const cards = await this.svc.listCards(id);
        return { cards };
    }
    async listAllSounds(category, auth) {
        await this.requireAdmin(auth);
        const sounds = await this.svc.listAllCards(this.cat(category));
        return { sounds };
    }
    async createCard(body, auth) {
        await this.requireAdmin(auth);
        if (!body?.topic_id)
            throw new common_1.BadRequestException('topic_id is required');
        if (!body?.title?.trim())
            throw new common_1.BadRequestException('Title is required');
        return this.svc.createCard(body);
    }
    async updateCard(id, body, auth) {
        await this.requireAdmin(auth);
        await this.svc.updateCard(id, body);
        return { ok: true };
    }
    async toggleCard(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.toggleCard(id);
        return { ok: true };
    }
    async deleteCard(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.deleteCard(id);
        return { ok: true };
    }
    async listQuiz(category, auth) {
        await this.requireAdmin(auth);
        const questions = await this.svc.listQuizQuestions(this.cat(category));
        return { questions };
    }
    async createQuiz(body, auth) {
        await this.requireAdmin(auth);
        this.validateQuiz(body);
        if (!body.audio_data_url && !body.source_card_id) {
            throw new common_1.BadRequestException('Attach an audio clip or reuse an existing sound');
        }
        return this.svc.createQuizQuestion(body);
    }
    async updateQuiz(id, body, auth) {
        await this.requireAdmin(auth);
        this.validateQuiz(body);
        await this.svc.updateQuizQuestion(id, body);
        return { ok: true };
    }
    async toggleQuiz(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.toggleQuizQuestion(id);
        return { ok: true };
    }
    async deleteQuiz(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.deleteQuizQuestion(id);
        return { ok: true };
    }
    validateQuiz(body) {
        if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
            throw new common_1.BadRequestException('At least 2 options are required');
        }
        if (!body.options.some((o) => o?.correct)) {
            throw new common_1.BadRequestException('Mark one option as the correct answer');
        }
    }
};
exports.AuscultationAdminController = AuscultationAdminController;
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "listTopics", null);
__decorate([
    (0, common_1.Post)('topics'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "createTopic", null);
__decorate([
    (0, common_1.Get)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "getTopic", null);
__decorate([
    (0, common_1.Put)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "updateTopic", null);
__decorate([
    (0, common_1.Patch)('topics/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "toggleTopic", null);
__decorate([
    (0, common_1.Delete)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "deleteTopic", null);
__decorate([
    (0, common_1.Get)('topics/:id/cards'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "listCards", null);
__decorate([
    (0, common_1.Get)('sounds'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "listAllSounds", null);
__decorate([
    (0, common_1.Post)('cards'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "createCard", null);
__decorate([
    (0, common_1.Put)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "updateCard", null);
__decorate([
    (0, common_1.Patch)('cards/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "toggleCard", null);
__decorate([
    (0, common_1.Delete)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "deleteCard", null);
__decorate([
    (0, common_1.Get)('quiz'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "listQuiz", null);
__decorate([
    (0, common_1.Post)('quiz'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "createQuiz", null);
__decorate([
    (0, common_1.Put)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "updateQuiz", null);
__decorate([
    (0, common_1.Patch)('quiz/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "toggleQuiz", null);
__decorate([
    (0, common_1.Delete)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationAdminController.prototype, "deleteQuiz", null);
exports.AuscultationAdminController = AuscultationAdminController = __decorate([
    (0, common_1.Controller)('admin/auscultation'),
    __metadata("design:paramtypes", [auscultation_service_1.AuscultationService,
        auth_service_1.AuthService])
], AuscultationAdminController);
//# sourceMappingURL=auscultation-admin.controller.js.map