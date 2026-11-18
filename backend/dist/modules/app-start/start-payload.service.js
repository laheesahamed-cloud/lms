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
exports.StartPayloadService = exports.START_PAYLOAD = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const notices_service_1 = require("../notices/notices.service");
const student_catalogue_service_1 = require("../courses/student-catalogue.service");
const study_stats_service_1 = require("../study-stats/study-stats.service");
const quiz_attempts_service_1 = require("../quiz-attempts/quiz-attempts.service");
const flashcards_service_1 = require("../flashcards/flashcards.service");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const progress_write_1 = require("../../common/utils/progress-write");
const streak_1 = require("../xp/streak");
exports.START_PAYLOAD = 'START_PAYLOAD';
let StartPayloadService = class StartPayloadService {
    constructor(db, dashboardService, notices, catalogue, studyStats, quizAttempts, flashcards) {
        this.db = db;
        this.dashboardService = dashboardService;
        this.notices = notices;
        this.catalogue = catalogue;
        this.studyStats = studyStats;
        this.quizAttempts = quizAttempts;
        this.flashcards = flashcards;
    }
    async build(role, accessToken, lastNoticeId = 0, userId = 0, progressOpts = {}, withCourses = false) {
        const student = role === 'student';
        if (student && userId && (0, progress_write_1.rideAlongPending)())
            await (0, progress_write_1.applyProgress)(this.db, userId, (0, streak_1.localDateKey)(new Date()));
        const dashboard = student ? await this.dashboardService.getStudentHubTop(`Bearer ${accessToken}`, true) : null;
        return {
            contentVersion: await (0, content_version_1.getContentVersion)(this.db),
            dashboard,
            ...(student && withCourses
                ? { results: await this.quizAttempts.resultsFromRecent(userId, (0, subscription_scope_1.summaryRowFromRequest)(userId)?.recent_results).catch(() => []) }
                : {}),
            progress: student && userId ? await this.catalogue.progressFor(userId, this.studyStats, progressOpts) : null,
            ...(student && userId ? {
                flashHistory: Number((0, subscription_scope_1.summaryRowFromRequest)(userId)?.flash_history || 0) === 1,
                flashSettings: await this.flashcards.getSettings().catch(() => null),
            } : {}),
            notices: this.notices.noticesFor(role, Math.max(0, Number(lastNoticeId) || 0)),
            popups: this.notices.popupsFor(role),
        };
    }
};
exports.StartPayloadService = StartPayloadService;
exports.StartPayloadService = StartPayloadService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, dashboard_service_1.DashboardService,
        notices_service_1.NoticesService,
        student_catalogue_service_1.StudentCatalogueService,
        study_stats_service_1.StudyStatsService,
        quiz_attempts_service_1.QuizAttemptsService,
        flashcards_service_1.FlashcardsService])
], StartPayloadService);
//# sourceMappingURL=start-payload.service.js.map