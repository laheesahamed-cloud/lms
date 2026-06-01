"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheoryRecapModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const ai_module_1 = require("../ai/ai.module");
const auth_module_1 = require("../auth/auth.module");
const theory_recap_controller_1 = require("./theory-recap.controller");
const theory_recap_service_1 = require("./theory-recap.service");
let TheoryRecapModule = class TheoryRecapModule {
};
exports.TheoryRecapModule = TheoryRecapModule;
exports.TheoryRecapModule = TheoryRecapModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, ai_module_1.AiModule, auth_module_1.AuthModule],
        controllers: [theory_recap_controller_1.TheoryRecapController],
        providers: [theory_recap_service_1.TheoryRecapService],
        exports: [theory_recap_service_1.TheoryRecapService],
    })
], TheoryRecapModule);
//# sourceMappingURL=theory-recap.module.js.map