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
exports.QuizAttemptsController = void 0;
const common_1 = require("@nestjs/common");
const quiz_attempts_service_1 = require("./quiz-attempts.service");
let QuizAttemptsController = class QuizAttemptsController {
    constructor(quizAttemptsService) {
        this.quizAttemptsService = quizAttemptsService;
    }
    listQuizzes(authorization) {
        return this.quizAttemptsService.listQuizzes(authorization);
    }
    listResults(authorization) {
        return this.quizAttemptsService.listResults(authorization);
    }
    loadQuiz(quizId, mode, questionId, authorization, appClient) {
        return this.quizAttemptsService.loadQuiz(authorization, quizId, mode, questionId ? Number(questionId) : null, appClient);
    }
    startExam(quizId, authorization, appClient) {
        return this.quizAttemptsService.startExam(authorization, quizId, appClient);
    }
    finishExam(quizId, authorization, body, appClient) {
        return this.quizAttemptsService.finishExam(authorization, quizId, body, appClient);
    }
    recentReview(quizId, authorization, appClient, part, lean) {
        return this.quizAttemptsService.recentReview(authorization, quizId, appClient, part, lean === '1');
    }
    markRecentReviewed(quizId, authorization) {
        return this.quizAttemptsService.markRecentReviewed(authorization, quizId);
    }
};
exports.QuizAttemptsController = QuizAttemptsController;
__decorate([
    (0, common_1.Get)('quizzes'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "listQuizzes", null);
__decorate([
    (0, common_1.Get)('results'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "listResults", null);
__decorate([
    (0, common_1.Get)('quiz/:quizId'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('mode')),
    __param(2, (0, common_1.Query)('questionId')),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-app-client')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "loadQuiz", null);
__decorate([
    (0, common_1.Post)('exam/:quizId/start'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-app-client')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "startExam", null);
__decorate([
    (0, common_1.Post)('exam/:quizId/finish'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('x-app-client')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "finishExam", null);
__decorate([
    (0, common_1.Get)('recent/:quizId/review'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-app-client')),
    __param(3, (0, common_1.Query)('part')),
    __param(4, (0, common_1.Query)('lean')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "recentReview", null);
__decorate([
    (0, common_1.Post)('recent/:quizId/reviewed'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "markRecentReviewed", null);
exports.QuizAttemptsController = QuizAttemptsController = __decorate([
    (0, common_1.Controller)('quiz-attempts'),
    __metadata("design:paramtypes", [quiz_attempts_service_1.QuizAttemptsService])
], QuizAttemptsController);
//# sourceMappingURL=quiz-attempts.controller.js.map