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
exports.LessonsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const lessons_service_1 = require("./lessons.service");
const create_lesson_dto_1 = require("./dto/create-lesson.dto");
const update_lesson_dto_1 = require("./dto/update-lesson.dto");
const create_lesson_annotation_dto_1 = require("./dto/create-lesson-annotation.dto");
const update_lesson_annotation_dto_1 = require("./dto/update-lesson-annotation.dto");
let LessonsController = class LessonsController {
    constructor(lessonsService, authService) {
        this.lessonsService = lessonsService;
        this.authService = authService;
    }
    getMeta() {
        return this.lessonsService.getMeta();
    }
    findAdminList(search, courseId, topicId, subtopicId, status, limit, page, offset) {
        return this.lessonsService.findAdminList({
            search,
            courseId: courseId ? Number(courseId) : undefined,
            topicId: topicId ? Number(topicId) : undefined,
            subtopicId: subtopicId ? Number(subtopicId) : undefined,
            status,
            limit: this.parsePositiveNumber(limit),
            page: this.parsePositiveNumber(page),
            offset: this.parseNonNegativeNumber(offset),
        });
    }
    findStudentList(authorization) {
        return this.lessonsService.findStudentList(authorization);
    }
    findStudentLesson(id, authorization) {
        return this.lessonsService.findStudentLesson(id, authorization);
    }
    findStudentAnnotations(lessonId, authorization) {
        return this.lessonsService.findStudentAnnotations(lessonId, authorization);
    }
    createStudentAnnotation(lessonId, createLessonAnnotationDto, authorization) {
        return this.lessonsService.createStudentAnnotation(lessonId, createLessonAnnotationDto, authorization);
    }
    updateStudentAnnotation(lessonId, annotationId, updateLessonAnnotationDto, authorization) {
        return this.lessonsService.updateStudentAnnotation(lessonId, annotationId, updateLessonAnnotationDto, authorization);
    }
    removeStudentAnnotation(lessonId, annotationId, authorization) {
        return this.lessonsService.removeStudentAnnotation(lessonId, annotationId, authorization);
    }
    async create(authorization, createLessonDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.create(createLessonDto, actor);
    }
    async update(authorization, id, updateLessonDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.update(id, updateLessonDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.remove(id, actor);
    }
    async uploadPdf(authorization, id, file) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        if (file.mimetype !== 'application/pdf')
            throw new common_1.BadRequestException('Only PDF files are allowed');
        if (file.size > 50 * 1024 * 1024)
            throw new common_1.BadRequestException('PDF must be under 50 MB');
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.uploadPdf(id, file, actor);
    }
    async removePdf(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.removePdf(id, actor);
    }
    async uploadVideo(authorization, id, file) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
        if (!allowed.includes(file.mimetype))
            throw new common_1.BadRequestException('Only MP4, WebM, MOV or OGG videos are allowed');
        if (file.size > 500 * 1024 * 1024)
            throw new common_1.BadRequestException('Video must be under 500 MB');
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.uploadVideo(id, file, actor);
    }
    async removeVideo(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.removeVideo(id, actor);
    }
    listVersions(id) {
        return this.lessonsService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.lessonsService.rollback(id, versionNumber, actor);
    }
    canvasGenerate(auth, text) {
        return this.lessonsService.canvasGenerate(text, this.bearerToken(auth));
    }
    canvasAdminList(auth, engineKey) {
        return this.lessonsService.canvasAdminList(this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasGetCourses(auth) {
        return this.lessonsService.getCourses(this.bearerToken(auth));
    }
    canvasGetTopics(auth, courseId) {
        return this.lessonsService.getTopics(courseId ? Number(courseId) : undefined, this.bearerToken(auth));
    }
    canvasGetSubtopics(auth, topicId) {
        return this.lessonsService.getSubtopics(topicId ? Number(topicId) : undefined, this.bearerToken(auth));
    }
    canvasAdminFindOne(auth, id, engineKey) {
        return this.lessonsService.canvasAdminFindOne(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasAdminUpdate(auth, id, body, engineKey) {
        return this.lessonsService.canvasAdminUpdate(id, { title: body.title, rawText: body.rawText, noteData: body.noteData, status: body.status, courseId: body.courseId != null ? Number(body.courseId) : undefined, topicId: body.topicId != null ? Number(body.topicId) : undefined, subtopicId: body.subtopicId != null ? Number(body.subtopicId) : undefined, videoUrl: body.videoUrl, isFree: body.isFree != null ? Number(body.isFree) : undefined }, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasAdminRemove(auth, id, engineKey) {
        return this.lessonsService.canvasAdminRemove(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasAdminListFlashcards(auth, id) {
        return this.lessonsService.canvasAdminListFlashcards(id, this.bearerToken(auth));
    }
    canvasAdminCreateFlashcard(auth, id, body) {
        return this.lessonsService.canvasAdminCreateFlashcard(id, body, this.bearerToken(auth));
    }
    canvasAdminGenerateFlashcards(auth, id, body) {
        return this.lessonsService.canvasAdminGenerateFlashcards(id, body, this.bearerToken(auth));
    }
    canvasAdminUpdateFlashcard(auth, id, cardId, body) {
        return this.lessonsService.canvasAdminUpdateFlashcard(id, cardId, body, this.bearerToken(auth));
    }
    canvasAdminRemoveFlashcard(auth, id, cardId) {
        return this.lessonsService.canvasAdminRemoveFlashcard(id, cardId, this.bearerToken(auth));
    }
    canvasStudentList(auth, engineKey) {
        return this.lessonsService.canvasStudentList(this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasStudentFindNote(auth, id, engineKey) {
        return this.lessonsService.canvasStudentFindNote(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    canvasStudentFlashcards(auth, id, engineKey) {
        return this.lessonsService.canvasStudentFlashcards(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
    }
    bearerToken(auth) {
        if (!auth)
            return '';
        const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
        return m ? m[1].trim() : '';
    }
    parsePositiveNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
    parseNonNegativeNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
};
exports.LessonsController = LessonsController;
__decorate([
    (0, common_1.Get)('meta'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "getMeta", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('courseId')),
    __param(2, (0, common_1.Query)('topicId')),
    __param(3, (0, common_1.Query)('subtopicId')),
    __param(4, (0, common_1.Query)('status')),
    __param(5, (0, common_1.Query)('limit')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "findAdminList", null);
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "findStudentList", null);
__decorate([
    (0, common_1.Get)('student/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "findStudentLesson", null);
__decorate([
    (0, common_1.Get)(':lessonId/annotations'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "findStudentAnnotations", null);
__decorate([
    (0, common_1.Post)(':lessonId/annotations'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_lesson_annotation_dto_1.CreateLessonAnnotationDto, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "createStudentAnnotation", null);
__decorate([
    (0, common_1.Patch)(':lessonId/annotations/:annotationId'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('annotationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, update_lesson_annotation_dto_1.UpdateLessonAnnotationDto, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "updateStudentAnnotation", null);
__decorate([
    (0, common_1.Delete)(':lessonId/annotations/:annotationId'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('annotationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "removeStudentAnnotation", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_lesson_dto_1.CreateLessonDto]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_lesson_dto_1.UpdateLessonDto]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/pdf'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)() })),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "uploadPdf", null);
__decorate([
    (0, common_1.Delete)(':id/pdf'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "removePdf", null);
__decorate([
    (0, common_1.Post)(':id/video'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)() })),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "uploadVideo", null);
__decorate([
    (0, common_1.Delete)(':id/video'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "removeVideo", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:versionNumber'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('versionNumber', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], LessonsController.prototype, "rollback", null);
__decorate([
    (0, common_1.Post)('canvas/generate'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)('text')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasGenerate", null);
__decorate([
    (0, common_1.Get)('canvas/admin'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminList", null);
__decorate([
    (0, common_1.Get)('canvas/hierarchy/courses'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasGetCourses", null);
__decorate([
    (0, common_1.Get)('canvas/hierarchy/topics'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasGetTopics", null);
__decorate([
    (0, common_1.Get)('canvas/hierarchy/subtopics'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('topicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasGetSubtopics", null);
__decorate([
    (0, common_1.Get)('canvas/admin/:id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminFindOne", null);
__decorate([
    (0, common_1.Patch)('canvas/admin/:id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminUpdate", null);
__decorate([
    (0, common_1.Delete)('canvas/admin/:id'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminRemove", null);
__decorate([
    (0, common_1.Get)('canvas/admin/:id/flashcards'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminListFlashcards", null);
__decorate([
    (0, common_1.Post)('canvas/admin/:id/flashcards'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminCreateFlashcard", null);
__decorate([
    (0, common_1.Post)('canvas/admin/:id/flashcards/generate'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminGenerateFlashcards", null);
__decorate([
    (0, common_1.Patch)('canvas/admin/:id/flashcards/:cardId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, Object]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminUpdateFlashcard", null);
__decorate([
    (0, common_1.Delete)('canvas/admin/:id/flashcards/:cardId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasAdminRemoveFlashcard", null);
__decorate([
    (0, common_1.Get)('canvas/student/notes'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasStudentList", null);
__decorate([
    (0, common_1.Get)(':id/note'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasStudentFindNote", null);
__decorate([
    (0, common_1.Get)(':id/flashcards'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('engineKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", void 0)
], LessonsController.prototype, "canvasStudentFlashcards", null);
exports.LessonsController = LessonsController = __decorate([
    (0, common_1.Controller)('lessons'),
    __metadata("design:paramtypes", [lessons_service_1.LessonsService,
        auth_service_1.AuthService])
], LessonsController);
//# sourceMappingURL=lessons.controller.js.map