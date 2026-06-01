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
exports.AiNotesController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const ai_notes_service_1 = require("./ai-notes.service");
class GenerateDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    (0, class_validator_1.MaxLength)(12000),
    __metadata("design:type", String)
], GenerateDto.prototype, "text", void 0);
class CreateNoteDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateNoteDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12000),
    __metadata("design:type", String)
], CreateNoteDto.prototype, "rawText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateNoteDto.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateNoteDto.prototype, "topicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateNoteDto.prototype, "subtopicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateNoteDto.prototype, "lessonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateNoteDto.prototype, "isFree", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined && value !== null && value !== ''),
    (0, class_validator_1.IsUrl)({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Video URL must be a valid http:// or https:// URL' }),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateNoteDto.prototype, "videoUrl", void 0);
class UpdateNoteDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateNoteDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50000),
    __metadata("design:type", String)
], UpdateNoteDto.prototype, "rawText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Allow)(),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "noteData", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'inactive']),
    __metadata("design:type", String)
], UpdateNoteDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "topicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "subtopicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "lessonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined && value !== null && value !== ''),
    (0, class_validator_1.IsUrl)({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Video URL must be a valid http:// or https:// URL' }),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "videoUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], UpdateNoteDto.prototype, "isFree", void 0);
class GenerateLessonFlashcardsDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(6),
    (0, class_validator_1.Max)(60),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], GenerateLessonFlashcardsDto.prototype, "count", void 0);
class CreateLessonFlashcardDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateLessonFlashcardDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], CreateLessonFlashcardDto.prototype, "answer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateLessonFlashcardDto.prototype, "sourceHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'approved', 'rejected']),
    __metadata("design:type", String)
], CreateLessonFlashcardDto.prototype, "status", void 0);
class UpdateLessonFlashcardDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateLessonFlashcardDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], UpdateLessonFlashcardDto.prototype, "answer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateLessonFlashcardDto.prototype, "sourceHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'approved', 'rejected']),
    __metadata("design:type", String)
], UpdateLessonFlashcardDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateLessonFlashcardDto.prototype, "sortOrder", void 0);
function token(auth) {
    return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}
function engine(value, svc) {
    return svc.normalizeEngineKey(value);
}
let AiNotesController = class AiNotesController {
    constructor(svc) {
        this.svc = svc;
    }
    generate(dto, engineKey, auth) {
        return this.svc.generate(dto.text, token(auth), engine(engineKey, this.svc));
    }
    adminList(engineKey, auth) {
        return this.svc.adminList(token(auth), engine(engineKey, this.svc));
    }
    adminCreate(dto, engineKey, auth) {
        return this.svc.adminCreate(dto.title, dto.rawText, dto.courseId, dto.topicId, dto.subtopicId, dto.lessonId, dto.isFree, dto.videoUrl, token(auth), engine(engineKey, this.svc));
    }
    getLessonCanvases(engineKey, auth) {
        return this.svc.getLessonCanvases(token(auth), engine(engineKey, this.svc));
    }
    adminListFlashcards(id, engineKey, auth) {
        return this.svc.adminListFlashcards(id, token(auth), engine(engineKey, this.svc));
    }
    adminCreateFlashcard(id, dto, engineKey, auth) {
        return this.svc.adminCreateFlashcard(id, dto, token(auth), engine(engineKey, this.svc));
    }
    adminGenerateFlashcards(id, dto, engineKey, auth) {
        return this.svc.adminGenerateFlashcards(id, dto, token(auth), engine(engineKey, this.svc));
    }
    adminUpdateFlashcard(id, cardId, dto, engineKey, auth) {
        return this.svc.adminUpdateFlashcard(id, cardId, dto, token(auth), engine(engineKey, this.svc));
    }
    adminRemoveFlashcard(id, cardId, engineKey, auth) {
        return this.svc.adminRemoveFlashcard(id, cardId, token(auth), engine(engineKey, this.svc));
    }
    getCourses(auth) {
        return this.svc.getCourses(token(auth));
    }
    getTopics(courseId, auth) {
        return this.svc.getTopics(courseId ? Number(courseId) : undefined, token(auth));
    }
    getSubtopics(topicId, auth) {
        return this.svc.getSubtopics(topicId ? Number(topicId) : undefined, token(auth));
    }
    getLessons(subtopicId, auth) {
        return this.svc.getLessons(subtopicId ? Number(subtopicId) : undefined, token(auth));
    }
    adminFindOne(id, engineKey, auth) {
        return this.svc.adminFindOne(id, token(auth), engine(engineKey, this.svc));
    }
    adminUpdate(id, dto, engineKey, auth) {
        return this.svc.adminUpdate(id, dto, token(auth), engine(engineKey, this.svc));
    }
    adminRemove(id, engineKey, auth) {
        return this.svc.adminRemove(id, token(auth), engine(engineKey, this.svc));
    }
    studentList(engineKey, auth) {
        return this.svc.studentList(token(auth), engine(engineKey, this.svc));
    }
    studentFindByLesson(lessonId, engineKey, auth) {
        return this.svc.studentFindByLesson(lessonId, token(auth), engine(engineKey, this.svc));
    }
    studentFindOne(id, engineKey, auth) {
        return this.svc.studentFindOne(id, token(auth), engine(engineKey, this.svc));
    }
};
exports.AiNotesController = AiNotesController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GenerateDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('engine')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminList", null);
__decorate([
    (0, common_1.Post)('admin'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateNoteDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminCreate", null);
__decorate([
    (0, common_1.Get)('admin/lesson-canvases'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('engine')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "getLessonCanvases", null);
__decorate([
    (0, common_1.Get)('admin/:id/flashcards'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminListFlashcards", null);
__decorate([
    (0, common_1.Post)('admin/:id/flashcards'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('engine')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, CreateLessonFlashcardDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminCreateFlashcard", null);
__decorate([
    (0, common_1.Post)('admin/:id/flashcards/generate'),
    (0, permissions_decorator_1.RequirePermissions)('ai.manage'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('engine')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, GenerateLessonFlashcardsDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminGenerateFlashcards", null);
__decorate([
    (0, common_1.Patch)('admin/:id/flashcards/:cardId'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('engine')),
    __param(4, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, UpdateLessonFlashcardDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminUpdateFlashcard", null);
__decorate([
    (0, common_1.Delete)('admin/:id/flashcards/:cardId'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('engine')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminRemoveFlashcard", null);
__decorate([
    (0, common_1.Get)('admin/hierarchy/courses'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "getCourses", null);
__decorate([
    (0, common_1.Get)('admin/hierarchy/topics'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('courseId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "getTopics", null);
__decorate([
    (0, common_1.Get)('admin/hierarchy/subtopics'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('topicId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "getSubtopics", null);
__decorate([
    (0, common_1.Get)('admin/hierarchy/lessons'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('subtopicId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "getLessons", null);
__decorate([
    (0, common_1.Get)('admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminFindOne", null);
__decorate([
    (0, common_1.Patch)('admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('engine')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, UpdateNoteDto, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminUpdate", null);
__decorate([
    (0, common_1.Delete)('admin/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "adminRemove", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('engine')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "studentList", null);
__decorate([
    (0, common_1.Get)('student/lesson/:lessonId'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "studentFindByLesson", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('engine')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], AiNotesController.prototype, "studentFindOne", null);
exports.AiNotesController = AiNotesController = __decorate([
    (0, common_1.Controller)('ai-notes'),
    __metadata("design:paramtypes", [ai_notes_service_1.AiNotesService])
], AiNotesController);
//# sourceMappingURL=ai-notes.controller.js.map