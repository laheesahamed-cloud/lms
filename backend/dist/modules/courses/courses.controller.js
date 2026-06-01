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
exports.CoursesController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../auth/admin.guard");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const courses_service_1 = require("./courses.service");
const create_course_dto_1 = require("./dto/create-course.dto");
const update_course_dto_1 = require("./dto/update-course.dto");
const update_student_lesson_progress_dto_1 = require("./dto/update-student-lesson-progress.dto");
let CoursesController = class CoursesController {
    constructor(coursesService, authService) {
        this.coursesService = coursesService;
        this.authService = authService;
    }
    findStudentCourses(authorization) {
        return this.coursesService.findStudentCourses(authorization);
    }
    findStudentCourseDetail(id, authorization) {
        return this.coursesService.findStudentCourseDetail(id, authorization);
    }
    updateStudentLessonProgress(lessonId, dto, authorization) {
        return this.coursesService.updateStudentLessonProgress(lessonId, dto, authorization);
    }
    findAll() {
        return this.coursesService.findAll();
    }
    async create(authorization, createCourseDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.create(createCourseDto, actor);
    }
    async update(authorization, id, updateCourseDto) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.update(id, updateCourseDto, actor);
    }
    async remove(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.remove(id, actor);
    }
    listVersions(id) {
        return this.coursesService.listVersions(id);
    }
    async markDraft(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.markDraft(id, actor);
    }
    async submitForReview(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.submitForReview(id, actor);
    }
    async publish(authorization, id) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.publish(id, actor);
    }
    async rollback(authorization, id, versionNumber) {
        const actor = await this.authService.requireAdmin(authorization);
        return this.coursesService.rollback(id, versionNumber, actor);
    }
};
exports.CoursesController = CoursesController;
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findStudentCourses", null);
__decorate([
    (0, common_1.Get)('student/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findStudentCourseDetail", null);
__decorate([
    (0, common_1.Patch)('student/lessons/:lessonId/progress'),
    __param(0, (0, common_1.Param)('lessonId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_student_lesson_progress_dto_1.UpdateStudentLessonProgressDto, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "updateStudentLessonProgress", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_course_dto_1.CreateCourseDto]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_course_dto_1.UpdateCourseDto]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':id/draft'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "markDraft", null);
__decorate([
    (0, common_1.Post)(':id/submit-review'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, permissions_decorator_1.RequirePermissions)('content.review'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "publish", null);
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
], CoursesController.prototype, "rollback", null);
exports.CoursesController = CoursesController = __decorate([
    (0, common_1.Controller)('courses'),
    __metadata("design:paramtypes", [courses_service_1.CoursesService,
        auth_service_1.AuthService])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map