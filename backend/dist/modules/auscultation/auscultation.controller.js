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
exports.AuscultationController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const auscultation_service_1 = require("./auscultation.service");
let AuscultationController = class AuscultationController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    cat(c) {
        return c === 'lung' ? 'lung' : 'heart';
    }
    async topics(category, auth) {
        await this.authService.requireStudent(auth);
        const topics = await this.svc.listTopics(this.cat(category));
        return { topics };
    }
    async topic(id, auth) {
        await this.authService.requireStudent(auth);
        const data = await this.svc.getTopicWithCards(id);
        if (!data)
            return { topic: null, cards: [] };
        return data;
    }
    async quiz(category, count = '10', auth) {
        await this.authService.requireStudent(auth);
        return this.svc.getQuizBatch(this.cat(category), Number(count));
    }
    async cardAudio(id, res, auth) {
        await this.authService.requireStudent(auth);
        const audio = await this.svc.getCardAudio(id);
        if (!audio)
            throw new common_1.NotFoundException('Audio not found');
        this.sendAudio(res, audio);
    }
    async quizAudio(id, res, auth) {
        await this.authService.requireStudent(auth);
        const audio = await this.svc.getQuizAudio(id);
        if (!audio)
            throw new common_1.NotFoundException('Audio not found');
        this.sendAudio(res, audio);
    }
    sendAudio(res, audio) {
        res.setHeader('Content-Type', audio.mime || 'audio/mpeg');
        res.setHeader('Content-Length', audio.buffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(audio.buffer);
    }
};
exports.AuscultationController = AuscultationController;
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuscultationController.prototype, "topics", null);
__decorate([
    (0, common_1.Get)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuscultationController.prototype, "topic", null);
__decorate([
    (0, common_1.Get)('quiz'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('count')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationController.prototype, "quiz", null);
__decorate([
    (0, common_1.Get)('cards/:id/audio'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationController.prototype, "cardAudio", null);
__decorate([
    (0, common_1.Get)('quiz/:id/audio'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], AuscultationController.prototype, "quizAudio", null);
exports.AuscultationController = AuscultationController = __decorate([
    (0, common_1.Controller)('auscultation'),
    __metadata("design:paramtypes", [auscultation_service_1.AuscultationService,
        auth_service_1.AuthService])
], AuscultationController);
//# sourceMappingURL=auscultation.controller.js.map