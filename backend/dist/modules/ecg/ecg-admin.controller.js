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
exports.EcgAdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const ecg_service_1 = require("./ecg.service");
let EcgAdminController = class EcgAdminController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    async requireAdmin(auth) {
        return this.authService.requireAdmin(auth);
    }
    async listTopics(auth) {
        await this.requireAdmin(auth);
        const topics = await this.svc.listTopicsAdmin();
        return { topics };
    }
    async createTopic(body, auth) {
        await this.requireAdmin(auth);
        if (!body?.title?.trim())
            throw new common_1.BadRequestException('Title is required');
        return this.svc.createTopic(body);
    }
    async reorderTopics(body, auth) {
        await this.requireAdmin(auth);
        await this.svc.reorderTopics(body?.ids || []);
        return { ok: true };
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
    async createCard(body, auth) {
        await this.requireAdmin(auth);
        if (!body?.topic_id)
            throw new common_1.BadRequestException('topic_id is required');
        if (!body?.title?.trim())
            throw new common_1.BadRequestException('Title is required');
        return this.svc.createCard(body);
    }
    async reorderCards(body, auth) {
        await this.requireAdmin(auth);
        await this.svc.reorderCards(body?.ids || []);
        return { ok: true };
    }
    async getCard(id, auth) {
        await this.requireAdmin(auth);
        return this.svc.getCard(id);
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
    async listQuiz(auth) {
        await this.requireAdmin(auth);
        const questions = await this.svc.listQuizQuestions();
        return { questions };
    }
    async createQuiz(body, auth) {
        await this.requireAdmin(auth);
        if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
            throw new common_1.BadRequestException('At least 2 options are required');
        }
        if (!body.options.some((o) => o?.correct)) {
            throw new common_1.BadRequestException('Mark one option as the correct answer');
        }
        return this.svc.createQuizQuestion(body);
    }
    async getQuiz(id, auth) {
        await this.requireAdmin(auth);
        return this.svc.getQuizQuestion(id);
    }
    async updateQuiz(id, body, auth) {
        await this.requireAdmin(auth);
        if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
            throw new common_1.BadRequestException('At least 2 options are required');
        }
        if (!body.options.some((o) => o?.correct)) {
            throw new common_1.BadRequestException('Mark one option as the correct answer');
        }
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
};
exports.EcgAdminController = EcgAdminController;
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "listTopics", null);
__decorate([
    (0, common_1.Post)('topics'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "createTopic", null);
__decorate([
    (0, common_1.Put)('topics/reorder'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "reorderTopics", null);
__decorate([
    (0, common_1.Get)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "getTopic", null);
__decorate([
    (0, common_1.Put)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "updateTopic", null);
__decorate([
    (0, common_1.Patch)('topics/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "toggleTopic", null);
__decorate([
    (0, common_1.Delete)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "deleteTopic", null);
__decorate([
    (0, common_1.Get)('topics/:id/cards'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "listCards", null);
__decorate([
    (0, common_1.Post)('cards'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "createCard", null);
__decorate([
    (0, common_1.Put)('cards/reorder'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "reorderCards", null);
__decorate([
    (0, common_1.Get)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "getCard", null);
__decorate([
    (0, common_1.Put)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "updateCard", null);
__decorate([
    (0, common_1.Patch)('cards/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "toggleCard", null);
__decorate([
    (0, common_1.Delete)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "deleteCard", null);
__decorate([
    (0, common_1.Get)('quiz'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "listQuiz", null);
__decorate([
    (0, common_1.Post)('quiz'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "createQuiz", null);
__decorate([
    (0, common_1.Get)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "getQuiz", null);
__decorate([
    (0, common_1.Put)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "updateQuiz", null);
__decorate([
    (0, common_1.Patch)('quiz/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "toggleQuiz", null);
__decorate([
    (0, common_1.Delete)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgAdminController.prototype, "deleteQuiz", null);
exports.EcgAdminController = EcgAdminController = __decorate([
    (0, common_1.Controller)('admin/ecg'),
    __metadata("design:paramtypes", [ecg_service_1.EcgService,
        auth_service_1.AuthService])
], EcgAdminController);
//# sourceMappingURL=ecg-admin.controller.js.map