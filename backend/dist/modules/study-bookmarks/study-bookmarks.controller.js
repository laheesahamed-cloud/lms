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
exports.StudyBookmarksController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const toggle_study_bookmark_dto_1 = require("./dto/toggle-study-bookmark.dto");
const study_bookmarks_service_1 = require("./study-bookmarks.service");
let StudyBookmarksController = class StudyBookmarksController {
    constructor(studyBookmarksService, authService) {
        this.studyBookmarksService = studyBookmarksService;
        this.authService = authService;
    }
    async list(authorization) {
        const student = await this.authService.requireStudent(authorization);
        return this.studyBookmarksService.list(student.id);
    }
    async toggle(authorization, dto) {
        const student = await this.authService.requireStudent(authorization);
        return this.studyBookmarksService.toggle(student.id, dto);
    }
};
exports.StudyBookmarksController = StudyBookmarksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StudyBookmarksController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('toggle'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, toggle_study_bookmark_dto_1.ToggleStudyBookmarkDto]),
    __metadata("design:returntype", Promise)
], StudyBookmarksController.prototype, "toggle", null);
exports.StudyBookmarksController = StudyBookmarksController = __decorate([
    (0, common_1.Controller)('study-bookmarks'),
    __metadata("design:paramtypes", [study_bookmarks_service_1.StudyBookmarksService,
        auth_service_1.AuthService])
], StudyBookmarksController);
//# sourceMappingURL=study-bookmarks.controller.js.map