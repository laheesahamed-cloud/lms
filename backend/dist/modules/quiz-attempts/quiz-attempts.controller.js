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
const save_practice_dto_1 = require("./dto/save-practice.dto");
const save_exam_progress_dto_1 = require("./dto/save-exam-progress.dto");
const submit_exam_dto_1 = require("./dto/submit-exam.dto");
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
    loadQuiz(quizId, mode, continuePractice, resetPractice, questionId, authorization) {
        return this.quizAttemptsService.loadQuiz(authorization, quizId, mode, continuePractice === '1', resetPractice === '1', questionId ? Number(questionId) : null);
    }
    savePractice(quizId, authorization, savePracticeDto) {
        return this.quizAttemptsService.savePractice(authorization, quizId, savePracticeDto);
    }
    submitExam(quizId, authorization, submitExamDto) {
        return this.quizAttemptsService.submitExam(authorization, quizId, submitExamDto);
    }
    saveExamProgress(quizId, authorization, saveExamProgressDto) {
        return this.quizAttemptsService.saveExamProgress(authorization, quizId, saveExamProgressDto);
    }
    result(attemptId, authorization) {
        return this.quizAttemptsService.result(authorization, attemptId);
    }
    review(attemptId, authorization) {
        return this.quizAttemptsService.review(authorization, attemptId);
    }
    practiceReview(quizId, complete, questionId, authorization) {
        return this.quizAttemptsService.practiceReview(authorization, quizId, complete === '1', questionId ? Number(questionId) : null);
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
    __param(2, (0, common_1.Query)('continue')),
    __param(3, (0, common_1.Query)('resetPractice')),
    __param(4, (0, common_1.Query)('questionId')),
    __param(5, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "loadQuiz", null);
__decorate([
    (0, common_1.Post)('practice/:quizId/save'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, save_practice_dto_1.SavePracticeDto]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "savePractice", null);
__decorate([
    (0, common_1.Post)('exam/:quizId/submit'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, submit_exam_dto_1.SubmitExamDto]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "submitExam", null);
__decorate([
    (0, common_1.Post)('exam/:quizId/save'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, save_exam_progress_dto_1.SaveExamProgressDto]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "saveExamProgress", null);
__decorate([
    (0, common_1.Get)('result/:attemptId'),
    __param(0, (0, common_1.Param)('attemptId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "result", null);
__decorate([
    (0, common_1.Get)('review/:attemptId'),
    __param(0, (0, common_1.Param)('attemptId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "review", null);
__decorate([
    (0, common_1.Get)('practice-review/:quizId'),
    __param(0, (0, common_1.Param)('quizId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('complete')),
    __param(2, (0, common_1.Query)('questionId')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String]),
    __metadata("design:returntype", void 0)
], QuizAttemptsController.prototype, "practiceReview", null);
exports.QuizAttemptsController = QuizAttemptsController = __decorate([
    (0, common_1.Controller)('quiz-attempts'),
    __metadata("design:paramtypes", [quiz_attempts_service_1.QuizAttemptsService])
], QuizAttemptsController);
//# sourceMappingURL=quiz-attempts.controller.js.map