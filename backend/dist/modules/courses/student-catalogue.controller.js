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
exports.StudentCatalogueController = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const auth_service_1 = require("../auth/auth.service");
const study_stats_service_1 = require("../study-stats/study-stats.service");
const student_catalogue_service_1 = require("./student-catalogue.service");
let StudentCatalogueController = class StudentCatalogueController {
    constructor(db, authService, catalogue, studyStats) {
        this.db = db;
        this.authService = authService;
        this.catalogue = catalogue;
        this.studyStats = studyStats;
    }
    async student(authorization, ifNoneMatch, acceptEncoding, res) {
        await this.authService.requireStudent(authorization);
        const current = await this.catalogue.get();
        const etag = `"catalogue-v${current.v}-f${student_catalogue_service_1.CATALOGUE_FORMAT}"`;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'private, no-cache');
        res.setHeader('X-Catalogue-Version', String(current.v));
        res.setHeader('X-Catalogue-Format', String(student_catalogue_service_1.CATALOGUE_FORMAT));
        if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(etag)) {
            res.status(304).end();
            return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (/\bgzip\b/i.test(String(acceptEncoding || ''))) {
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Vary', 'Accept-Encoding');
            res.status(200).end(current.gzip);
            return;
        }
        res.status(200).end(current.json);
    }
    async index(authorization, ifNoneMatch, acceptEncoding, res) {
        await this.authService.requireStudent(authorization);
        const current = await this.catalogue.get();
        const etag = `"catalogue-index-v${current.v}-f${student_catalogue_service_1.CATALOGUE_FORMAT}"`;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'private, no-cache');
        res.setHeader('X-Catalogue-Version', String(current.v));
        res.setHeader('X-Catalogue-Format', String(student_catalogue_service_1.CATALOGUE_FORMAT));
        if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(etag)) {
            res.status(304).end();
            return;
        }
        this.send(res, current.index.json, current.index.gzip, acceptEncoding);
    }
    async parts(authorization, courses, acceptEncoding, res, kind) {
        await this.authService.requireStudent(authorization);
        const ids = String(courses || '').split(',').map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
        const reply = await this.catalogue.partsFor(ids, kind);
        res.setHeader('Cache-Control', 'private, no-cache');
        res.setHeader('X-Catalogue-Version', String(reply.v));
        this.send(res, reply.json, reply.gzip, acceptEncoding);
    }
    send(res, json, gzip, acceptEncoding) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (/\bgzip\b/i.test(String(acceptEncoding || ''))) {
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Vary', 'Accept-Encoding');
            res.status(200).end(gzip);
            return;
        }
        res.status(200).end(json);
    }
    async progress(authorization, format, version) {
        const user = await this.authService.requireStudent(authorization);
        return this.catalogue.progressFor(Number(user.id), this.studyStats, (0, student_catalogue_service_1.progressOptions)(format, version));
    }
};
exports.StudentCatalogueController = StudentCatalogueController;
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], StudentCatalogueController.prototype, "student", null);
__decorate([
    (0, common_1.Get)('student/index'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], StudentCatalogueController.prototype, "index", null);
__decorate([
    (0, common_1.Get)('student/parts'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('courses')),
    __param(2, (0, common_1.Headers)('accept-encoding')),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], StudentCatalogueController.prototype, "parts", null);
__decorate([
    (0, common_1.Get)('student/progress'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Query)('v')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], StudentCatalogueController.prototype, "progress", null);
exports.StudentCatalogueController = StudentCatalogueController = __decorate([
    (0, common_1.Controller)('catalogue'),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        student_catalogue_service_1.StudentCatalogueService,
        study_stats_service_1.StudyStatsService])
], StudentCatalogueController);
//# sourceMappingURL=student-catalogue.controller.js.map