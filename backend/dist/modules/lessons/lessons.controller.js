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
    findAdminList(search, courseId, topicId, subtopicId, status) {
        return this.lessonsService.findAdminList({
            search,
            courseId: courseId ? Number(courseId) : undefined,
            topicId: topicId ? Number(topicId) : undefined,
            subtopicId: subtopicId ? Number(subtopicId) : undefined,
            status,
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
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
exports.LessonsController = LessonsController = __decorate([
    (0, common_1.Controller)('lessons'),
    __metadata("design:paramtypes", [lessons_service_1.LessonsService,
        auth_service_1.AuthService])
], LessonsController);
//# sourceMappingURL=lessons.controller.js.map