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
exports.SamplesController = void 0;
const common_1 = require("@nestjs/common");
const app_only_content_exception_1 = require("../../common/exceptions/app-only-content.exception");
const samples_service_1 = require("./samples.service");
let SamplesController = class SamplesController {
    constructor(samples) {
        this.samples = samples;
    }
    async index(inm, enc, res) {
        const bundle = await this.samples.get();
        this.send(res, bundle.v, 'index', bundle.index, inm, enc);
    }
    async lesson(id, inm, enc, res) {
        const bundle = await this.samples.get();
        const body = bundle.lessons.get(id);
        if (!body)
            throw new app_only_content_exception_1.AppOnlyContentException();
        this.send(res, bundle.v, `lesson-${id}`, body, inm, enc);
    }
    async quiz(id, inm, enc, res) {
        const bundle = await this.samples.get();
        const body = bundle.quizzes.get(id);
        if (!body)
            throw new app_only_content_exception_1.AppOnlyContentException();
        this.send(res, bundle.v, `quiz-${id}`, body, inm, enc);
    }
    async deck(id, inm, enc, res) {
        const bundle = await this.samples.get();
        const body = bundle.decks.get(id);
        if (!body)
            throw new app_only_content_exception_1.AppOnlyContentException();
        this.send(res, bundle.v, `deck-${id}`, body, inm, enc);
    }
    send(res, v, name, body, inm, enc) {
        const etag = `"samples-${name}-v${v}"`;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=300');
        if (inm && inm.split(',').map((t) => t.trim()).includes(etag)) {
            res.status(304).end();
            return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (/\bgzip\b/i.test(String(enc || ''))) {
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Vary', 'Accept-Encoding');
            res.status(200).end(body.gzip);
            return;
        }
        res.status(200).end(body.json);
    }
};
exports.SamplesController = SamplesController;
__decorate([
    (0, common_1.Get)('index'),
    __param(0, (0, common_1.Headers)('if-none-match')),
    __param(1, (0, common_1.Headers)('accept-encoding')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SamplesController.prototype, "index", null);
__decorate([
    (0, common_1.Get)('lesson/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SamplesController.prototype, "lesson", null);
__decorate([
    (0, common_1.Get)('quiz/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SamplesController.prototype, "quiz", null);
__decorate([
    (0, common_1.Get)('deck/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SamplesController.prototype, "deck", null);
exports.SamplesController = SamplesController = __decorate([
    (0, common_1.Controller)('samples'),
    __metadata("design:paramtypes", [samples_service_1.SamplesService])
], SamplesController);
//# sourceMappingURL=samples.controller.js.map