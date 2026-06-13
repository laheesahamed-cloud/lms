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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateQuizDto = void 0;
const class_validator_1 = require("class-validator");
class CreateQuizDto {
}
exports.CreateQuizDto = CreateQuizDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "topicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "subtopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "subtopicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "lessonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "paperId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "collectionTags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([0, 1]),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "isFree", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([0, 1]),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "isGeneral", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([0, 1]),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "examModeOnly", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "adminName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "studentTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['number', 'title']),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "displayTitleMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "quizNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "quizTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "quizDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateQuizDto.prototype, "blueprint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['static', 'dynamic']),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "randomizationMode", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "timeLimit", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([0, 1]),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "hideTimeLimit", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "passingMarks", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([0, 1]),
    __metadata("design:type", Number)
], CreateQuizDto.prototype, "hidePassingMarks", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['active', 'inactive']),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], CreateQuizDto.prototype, "questionIds", void 0);
//# sourceMappingURL=create-quiz.dto.js.map