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
exports.EcgController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const ecg_service_1 = require("./ecg.service");
let EcgController = class EcgController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    async topics(auth) {
        await this.authService.requireStudent(auth);
        const topics = await this.svc.listTopics();
        return { topics };
    }
    async topic(id, auth) {
        await this.authService.requireStudent(auth);
        const data = await this.svc.getTopicWithCards(id);
        if (!data)
            return { topic: null, cards: [] };
        return data;
    }
    async quiz(count = '10', auth) {
        await this.authService.requireStudent(auth);
        return this.svc.getQuizBatch(Number(count));
    }
};
exports.EcgController = EcgController;
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EcgController.prototype, "topics", null);
__decorate([
    (0, common_1.Get)('topics/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EcgController.prototype, "topic", null);
__decorate([
    (0, common_1.Get)('quiz'),
    __param(0, (0, common_1.Query)('count')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcgController.prototype, "quiz", null);
exports.EcgController = EcgController = __decorate([
    (0, common_1.Controller)('ecg'),
    __metadata("design:paramtypes", [ecg_service_1.EcgService,
        auth_service_1.AuthService])
], EcgController);
//# sourceMappingURL=ecg.controller.js.map