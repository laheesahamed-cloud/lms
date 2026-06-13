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
exports.BootService = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const ai_notes_service_1 = require("../ai-notes/ai-notes.service");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const quiz_attempts_service_1 = require("../quiz-attempts/quiz-attempts.service");
const study_bookmarks_service_1 = require("../study-bookmarks/study-bookmarks.service");
const workspace_service_1 = require("../workspace/workspace.service");
function bearerToken(authorization) {
    return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}
let BootService = class BootService {
    constructor(authService, dashboardService, workspaceService, quizAttemptsService, studyBookmarksService, aiNotesService) {
        this.authService = authService;
        this.dashboardService = dashboardService;
        this.workspaceService = workspaceService;
        this.quizAttemptsService = quizAttemptsService;
        this.studyBookmarksService = studyBookmarksService;
        this.aiNotesService = aiNotesService;
    }
    async getStudentBoot(authorization, engineKey) {
        const student = await this.authService.requireStudent(authorization);
        const engine = this.aiNotesService.normalizeEngineKey(engineKey);
        const [dashboard, notifications, agenda, quizzes, bookmarks, aiNotes] = await Promise.allSettled([
            this.dashboardService.getStudentDashboard(authorization),
            this.workspaceService.listNotifications(authorization),
            this.workspaceService.getPlannerAgenda(authorization),
            this.quizAttemptsService.listQuizzes(authorization),
            this.studyBookmarksService.list(student.id),
            this.aiNotesService.studentList(bearerToken(authorization), engine),
        ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)));
        return { dashboard, notifications, agenda, quizzes, bookmarks, aiNotes, aiNotesEngine: engine };
    }
};
exports.BootService = BootService;
exports.BootService = BootService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        dashboard_service_1.DashboardService,
        workspace_service_1.WorkspaceService,
        quiz_attempts_service_1.QuizAttemptsService,
        study_bookmarks_service_1.StudyBookmarksService,
        ai_notes_service_1.AiNotesService])
], BootService);
//# sourceMappingURL=boot.service.js.map