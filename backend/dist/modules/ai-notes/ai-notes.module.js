"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiNotesModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("../../database/database.module");
const plans_module_1 = require("../plans/plans.module");
const ai_notes_controller_1 = require("./ai-notes.controller");
const ai_notes_service_1 = require("./ai-notes.service");
let AiNotesModule = class AiNotesModule {
};
exports.AiNotesModule = AiNotesModule;
exports.AiNotesModule = AiNotesModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, database_module_1.DatabaseModule, plans_module_1.PlansModule],
        controllers: [ai_notes_controller_1.AiNotesController],
        providers: [ai_notes_service_1.AiNotesService],
    })
], AiNotesModule);
//# sourceMappingURL=ai-notes.module.js.map