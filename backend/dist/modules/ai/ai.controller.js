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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const ai_service_1 = require("./ai.service");
const generate_ai_quiz_dto_1 = require("./dto/generate-ai-quiz.dto");
const beautify_lesson_dto_1 = require("./dto/beautify-lesson.dto");
const generate_why_incorrect_dto_1 = require("./dto/generate-why-incorrect.dto");
const generate_explanation_dto_1 = require("./dto/generate-explanation.dto");
let AiController = class AiController {
    constructor(aiService) {
        this.aiService = aiService;
    }
    generateQuiz(dto, engine, includeExplanations, includeWhyIncorrect) {
        return this.aiService.generateQuiz({
            ...dto,
            includeExplanations: parseQueryBoolean(includeExplanations, dto.includeExplanations),
            includeWhyIncorrect: parseQueryBoolean(includeWhyIncorrect, dto.includeWhyIncorrect),
        }, engine);
    }
    beautifyLesson(dto) {
        return this.aiService.beautifyLesson(dto);
    }
    generateWhyIncorrect(dto, questionType) {
        return this.aiService.generateWhyIncorrect({
            ...dto,
            questionType: questionType || dto.questionType,
        });
    }
    generateExplanation(dto) {
        return this.aiService.generateExplanation(dto);
    }
    generateTheoryCard(dto) {
        return this.aiService.generateTheoryCardFromQuestion(dto);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('generate-quiz'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Query)('includeExplanations')),
    __param(3, (0, common_1.Query)('includeWhyIncorrect')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_ai_quiz_dto_1.GenerateAiQuizDto, String, String, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateQuiz", null);
__decorate([
    (0, common_1.Post)('beautify-lesson'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [beautify_lesson_dto_1.BeautifyLessonDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "beautifyLesson", null);
__decorate([
    (0, common_1.Post)('generate-why-incorrect'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('questionType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_why_incorrect_dto_1.GenerateWhyIncorrectDto, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateWhyIncorrect", null);
__decorate([
    (0, common_1.Post)('generate-explanation'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_explanation_dto_1.GenerateExplanationDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateExplanation", null);
__decorate([
    (0, common_1.Post)('generate-theory-card'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateTheoryCard", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
function parseQueryBoolean(value, fallback) {
    if (value === undefined)
        return fallback;
    return value === 'true' || value === '1';
}
//# sourceMappingURL=ai.controller.js.map