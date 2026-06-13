"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const ai_notes_module_1 = require("../ai-notes/ai-notes.module");
const dashboard_module_1 = require("../dashboard/dashboard.module");
const quiz_attempts_module_1 = require("../quiz-attempts/quiz-attempts.module");
const study_bookmarks_module_1 = require("../study-bookmarks/study-bookmarks.module");
const workspace_module_1 = require("../workspace/workspace.module");
const boot_controller_1 = require("./boot.controller");
const boot_service_1 = require("./boot.service");
let BootModule = class BootModule {
};
exports.BootModule = BootModule;
exports.BootModule = BootModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, dashboard_module_1.DashboardModule, workspace_module_1.WorkspaceModule, quiz_attempts_module_1.QuizAttemptsModule, study_bookmarks_module_1.StudyBookmarksModule, ai_notes_module_1.AiNotesModule],
        controllers: [boot_controller_1.BootController],
        providers: [boot_service_1.BootService],
    })
], BootModule);
//# sourceMappingURL=boot.module.js.map