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
exports.FlashcardsController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const flashcards_service_1 = require("./flashcards.service");
const submit_reviews_dto_1 = require("./dto/submit-reviews.dto");
function rawToken(authorization) {
    return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}
function parseNoteIds(value) {
    return String(value || '')
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
}
let FlashcardsController = class FlashcardsController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    async decks(auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.listDecks(student.id, rawToken(auth));
    }
    async queue(noteIds, limit, newLimit, auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.getQueue(student.id, rawToken(auth), {
            noteIds: parseNoteIds(noteIds),
            limit: limit ? Number(limit) : undefined,
            newLimit: newLimit ? Number(newLimit) : undefined,
        });
    }
    async submit(dto, auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.submitReviews(student.id, dto.reviews);
    }
    async undo(cardId, auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.undo(student.id, cardId);
    }
    async flags(cardId, body, auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.setCardFlags(student.id, cardId, {
            suspended: body?.suspended,
            buried: body?.buried,
        });
    }
    async stats(auth) {
        const student = await this.authService.requireStudent(auth);
        return this.svc.stats(student.id);
    }
    async getSettings(auth) {
        await this.authService.requireStudent(auth);
        return this.svc.getSettings();
    }
    async patchSettings(body, auth) {
        await this.authService.requireStudent(auth);
        return this.svc.updateSettings(body || {});
    }
};
exports.FlashcardsController = FlashcardsController;
__decorate([
    (0, common_1.Get)('decks'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "decks", null);
__decorate([
    (0, common_1.Get)('queue'),
    __param(0, (0, common_1.Query)('noteIds')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('newLimit')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "queue", null);
__decorate([
    (0, common_1.Post)('reviews'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [submit_reviews_dto_1.SubmitReviewsDto, String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)('reviews/undo'),
    __param(0, (0, common_1.Body)('cardId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "undo", null);
__decorate([
    (0, common_1.Post)('cards/:cardId/flags'),
    __param(0, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "flags", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)('settings'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FlashcardsController.prototype, "patchSettings", null);
exports.FlashcardsController = FlashcardsController = __decorate([
    (0, common_1.Controller)('flashcards'),
    __metadata("design:paramtypes", [flashcards_service_1.FlashcardsService,
        auth_service_1.AuthService])
], FlashcardsController);
//# sourceMappingURL=flashcards.controller.js.map