"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const samples_module_1 = require("./modules/samples/samples.module");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const health_controller_1 = require("./health.controller");
const auth_module_1 = require("./modules/auth/auth.module");
const courses_module_1 = require("./modules/courses/courses.module");
const topics_module_1 = require("./modules/topics/topics.module");
const subtopics_module_1 = require("./modules/subtopics/subtopics.module");
const questions_module_1 = require("./modules/questions/questions.module");
const quizzes_module_1 = require("./modules/quizzes/quizzes.module");
const quiz_attempts_module_1 = require("./modules/quiz-attempts/quiz-attempts.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const app_start_module_1 = require("./modules/app-start/app-start.module");
const study_stats_module_1 = require("./modules/study-stats/study-stats.module");
const notices_module_1 = require("./modules/notices/notices.module");
const lessons_module_1 = require("./modules/lessons/lessons.module");
const users_module_1 = require("./modules/users/users.module");
const uploads_module_1 = require("./modules/uploads/uploads.module");
const papers_module_1 = require("./modules/papers/papers.module");
const schema_module_1 = require("./modules/schema/schema.module");
const ai_module_1 = require("./modules/ai/ai.module");
const settings_module_1 = require("./modules/settings/settings.module");
const flashcards_module_1 = require("./modules/flashcards/flashcards.module");
const plans_module_1 = require("./modules/plans/plans.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const theory_recap_module_1 = require("./modules/theory-recap/theory-recap.module");
const workspace_module_1 = require("./modules/workspace/workspace.module");
const push_notifications_module_1 = require("./modules/push-notifications/push-notifications.module");
const boot_module_1 = require("./modules/boot/boot.module");
const drugs_module_1 = require("./modules/drugs/drugs.module");
const ecg_module_1 = require("./modules/ecg/ecg.module");
const auscultation_module_1 = require("./modules/auscultation/auscultation.module");
const osce_module_1 = require("./modules/osce/osce.module");
const embed_module_1 = require("./modules/embed/embed.module");
const database_config_1 = require("./config/database.config");
const database_module_1 = require("./database/database.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [database_config_1.default],
                envFilePath: (0, path_1.join)(__dirname, '..', '.env'),
            }),
            database_module_1.DatabaseModule,
            schema_module_1.SchemaModule,
            ai_module_1.AiModule,
            settings_module_1.SettingsModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            courses_module_1.CoursesModule,
            samples_module_1.SamplesModule,
            topics_module_1.TopicsModule,
            subtopics_module_1.SubtopicsModule,
            lessons_module_1.LessonsModule,
            questions_module_1.QuestionsModule,
            quizzes_module_1.QuizzesModule,
            quiz_attempts_module_1.QuizAttemptsModule,
            dashboard_module_1.DashboardModule,
            app_start_module_1.AppStartModule,
            study_stats_module_1.StudyStatsModule,
            notices_module_1.NoticesModule,
            uploads_module_1.UploadsModule,
            papers_module_1.PapersModule,
            flashcards_module_1.FlashcardsModule,
            plans_module_1.PlansModule,
            subscriptions_module_1.SubscriptionsModule,
            theory_recap_module_1.TheoryRecapModule,
            push_notifications_module_1.PushNotificationsModule,
            workspace_module_1.WorkspaceModule,
            boot_module_1.BootModule,
            drugs_module_1.DrugsModule,
            ecg_module_1.EcgModule,
            auscultation_module_1.AuscultationModule,
            osce_module_1.OsceModule,
            embed_module_1.EmbedModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map