"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStartModule = void 0;
const flashcards_module_1 = require("../flashcards/flashcards.module");
const quiz_attempts_module_1 = require("../quiz-attempts/quiz-attempts.module");
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const dashboard_module_1 = require("../dashboard/dashboard.module");
const courses_module_1 = require("../courses/courses.module");
const app_start_controller_1 = require("./app-start.controller");
const start_payload_service_1 = require("./start-payload.service");
let AppStartModule = class AppStartModule {
};
exports.AppStartModule = AppStartModule;
exports.AppStartModule = AppStartModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, dashboard_module_1.DashboardModule, courses_module_1.CoursesModule, quiz_attempts_module_1.QuizAttemptsModule, flashcards_module_1.FlashcardsModule],
        controllers: [app_start_controller_1.AppStartController],
        providers: [start_payload_service_1.StartPayloadService, { provide: start_payload_service_1.START_PAYLOAD, useExisting: start_payload_service_1.StartPayloadService }],
        exports: [start_payload_service_1.StartPayloadService, start_payload_service_1.START_PAYLOAD],
    })
], AppStartModule);
//# sourceMappingURL=app-start.module.js.map