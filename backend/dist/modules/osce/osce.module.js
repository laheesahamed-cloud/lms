"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsceModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const osce_controller_1 = require("./osce.controller");
const osce_admin_controller_1 = require("./osce-admin.controller");
const osce_service_1 = require("./osce.service");
const osce_generator_service_1 = require("./osce-generator.service");
const smart_notes_image_api_service_1 = require("../smart-notes/smart-notes-image-api.service");
let OsceModule = class OsceModule {
};
exports.OsceModule = OsceModule;
exports.OsceModule = OsceModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [osce_controller_1.OsceController, osce_admin_controller_1.OsceAdminController],
        providers: [osce_service_1.OsceService, osce_generator_service_1.OsceGeneratorService, smart_notes_image_api_service_1.SmartNotesImageApiService],
        exports: [osce_service_1.OsceService],
    })
], OsceModule);
//# sourceMappingURL=osce.module.js.map