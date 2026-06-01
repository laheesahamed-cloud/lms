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
exports.SmartNotesController = void 0;
const common_1 = require("@nestjs/common");
const smart_notes_service_1 = require("./smart-notes.service");
const create_smart_note_dto_1 = require("./dto/create-smart-note.dto");
const update_smart_note_dto_1 = require("./dto/update-smart-note.dto");
function extractToken(authHeader) {
    if (!authHeader?.startsWith('Bearer '))
        return '';
    return authHeader.slice(7).trim();
}
let SmartNotesController = class SmartNotesController {
    constructor(smartNotesService) {
        this.smartNotesService = smartNotesService;
    }
    list(auth) {
        return this.smartNotesService.list(extractToken(auth));
    }
    findOne(id, auth) {
        return this.smartNotesService.findOne(id, extractToken(auth));
    }
    create(dto, auth) {
        return this.smartNotesService.create(dto, extractToken(auth));
    }
    update(id, dto, auth) {
        return this.smartNotesService.update(id, dto, extractToken(auth));
    }
    processWithAi(id, auth) {
        return this.smartNotesService.processWithAi(id, extractToken(auth));
    }
    remove(id, auth) {
        return this.smartNotesService.remove(id, extractToken(auth));
    }
};
exports.SmartNotesController = SmartNotesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_smart_note_dto_1.CreateSmartNoteDto, String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_smart_note_dto_1.UpdateSmartNoteDto, String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/process'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "processWithAi", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], SmartNotesController.prototype, "remove", null);
exports.SmartNotesController = SmartNotesController = __decorate([
    (0, common_1.Controller)('smart-notes'),
    __metadata("design:paramtypes", [smart_notes_service_1.SmartNotesService])
], SmartNotesController);
//# sourceMappingURL=smart-notes.controller.js.map