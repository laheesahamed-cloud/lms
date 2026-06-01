"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartNotesModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const smart_notes_controller_1 = require("./smart-notes.controller");
const smart_notes_service_1 = require("./smart-notes.service");
const smart_notes_image_api_service_1 = require("./smart-notes-image-api.service");
let SmartNotesModule = class SmartNotesModule {
};
exports.SmartNotesModule = SmartNotesModule;
exports.SmartNotesModule = SmartNotesModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [smart_notes_controller_1.SmartNotesController],
        providers: [smart_notes_service_1.SmartNotesService, smart_notes_image_api_service_1.SmartNotesImageApiService],
    })
], SmartNotesModule);
//# sourceMappingURL=smart-notes.module.js.map