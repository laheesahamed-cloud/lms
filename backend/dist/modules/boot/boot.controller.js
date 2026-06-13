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
exports.BootController = void 0;
const common_1 = require("@nestjs/common");
const boot_service_1 = require("./boot.service");
let BootController = class BootController {
    constructor(bootService) {
        this.bootService = bootService;
    }
    getStudentBoot(authorization, engine) {
        return this.bootService.getStudentBoot(authorization, engine);
    }
};
exports.BootController = BootController;
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('engine')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BootController.prototype, "getStudentBoot", null);
exports.BootController = BootController = __decorate([
    (0, common_1.Controller)('boot'),
    __metadata("design:paramtypes", [boot_service_1.BootService])
], BootController);
//# sourceMappingURL=boot.controller.js.map