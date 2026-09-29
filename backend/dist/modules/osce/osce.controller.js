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
exports.OsceController = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const auth_service_1 = require("../auth/auth.service");
const osce_service_1 = require("./osce.service");
const MEDIA_MIME = {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    ogv: 'video/ogg',
};
let OsceController = class OsceController {
    constructor(svc, authService) {
        this.svc = svc;
        this.authService = authService;
    }
    baseUrl(req) {
        const host = req.get('host');
        if (host) {
            const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            return `${proto}://${host}`;
        }
        return String(process.env.API_PUBLIC_URL || process.env.APP_PUBLIC_URL || '')
            .trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
    }
    async courses(auth) {
        const user = await this.authService.requireStudent(auth);
        return { courses: await this.svc.listStudentCourses(Number(user.id)) };
    }
    async regions(req, auth) {
        const user = await this.authService.requireStudent(auth);
        return {
            regions: await this.svc.listRegions(this.baseUrl(req), Number(user.id)),
        };
    }
    async systems(courseId, auth) {
        const user = await this.authService.requireStudent(auth);
        return {
            systems: await this.svc.listCategories({
                courseId: courseId ? Number(courseId) : undefined,
                publishedOnly: true,
                userId: Number(user.id),
            }),
        };
    }
    async cases(req, system, auth) {
        const user = await this.authService.requireStudent(auth);
        return {
            cases: await this.svc.listCases({
                categoryId: system ? Number(system) : undefined,
                publishedOnly: true,
                userId: Number(user.id),
                baseUrl: this.baseUrl(req),
            }),
        };
    }
    async caseBySlug(slug, req, auth) {
        const user = await this.authService.requireStudent(auth);
        const found = await this.svc.hydrateCase(slug, this.baseUrl(req), true, Number(user.id));
        if (!found)
            throw new common_1.NotFoundException('Case not found');
        return found;
    }
    async progress(auth) {
        const user = await this.authService.requireStudent(auth);
        return { progress: await this.svc.getProgress(Number(user.id)) };
    }
    async saveProgress(caseId, body, auth) {
        const user = await this.authService.requireStudent(auth);
        return this.svc.saveProgress(Number(user.id), caseId, body || {});
    }
    async ecgImage(cardId, res) {
        const found = await this.svc.ecgImageBytes(cardId);
        if (!found)
            throw new common_1.NotFoundException('ECG image not found');
        res.setHeader('Content-Type', found.mime);
        res.setHeader('Content-Length', String(found.buffer.length));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(found.buffer);
    }
    async soundAudio(cardId, res) {
        const found = await this.svc.auscultationAudioBytes(cardId);
        if (!found)
            throw new common_1.NotFoundException('Sound not found');
        res.setHeader('Content-Type', found.mime);
        res.setHeader('Content-Length', String(found.buffer.length));
        res.setHeader('Accept-Ranges', 'none');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(found.buffer);
    }
    async media(caseSlug, fileName, res) {
        if (!/^[A-Za-z0-9._-]{1,200}$/.test(caseSlug))
            throw new common_1.BadRequestException('Invalid case');
        if (!/^[A-Za-z0-9._@-]+\.(?:webp|jpe?g|png|mp4|webm|mov|ogv)$/i.test(fileName)) {
            throw new common_1.BadRequestException('Invalid media file name');
        }
        const root = (0, path_1.resolve)(process.cwd(), 'uploads', 'osce');
        const filePath = (0, path_1.resolve)((0, path_1.join)(root, caseSlug, fileName));
        if (!filePath.startsWith(`${root}/`))
            throw new common_1.BadRequestException('Invalid media path');
        const stats = await (0, promises_1.stat)(filePath).catch(() => null);
        if (!stats?.isFile())
            throw new common_1.NotFoundException('Media not found');
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        res.setHeader('Content-Type', MEDIA_MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(filePath);
    }
};
exports.OsceController = OsceController;
__decorate([
    (0, common_1.Get)('courses'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "courses", null);
__decorate([
    (0, common_1.Get)('regions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "regions", null);
__decorate([
    (0, common_1.Get)('systems'),
    __param(0, (0, common_1.Query)('course')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "systems", null);
__decorate([
    (0, common_1.Get)('cases'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('system')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "cases", null);
__decorate([
    (0, common_1.Get)('cases/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "caseBySlug", null);
__decorate([
    (0, common_1.Get)('progress'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "progress", null);
__decorate([
    (0, common_1.Put)('progress/:caseId'),
    __param(0, (0, common_1.Param)('caseId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "saveProgress", null);
__decorate([
    (0, common_1.Get)('ecg/:cardId/image'),
    __param(0, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "ecgImage", null);
__decorate([
    (0, common_1.Get)('sound/:cardId/audio'),
    __param(0, (0, common_1.Param)('cardId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "soundAudio", null);
__decorate([
    (0, common_1.Get)('media/:caseSlug/:fileName'),
    __param(0, (0, common_1.Param)('caseSlug')),
    __param(1, (0, common_1.Param)('fileName')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], OsceController.prototype, "media", null);
exports.OsceController = OsceController = __decorate([
    (0, common_1.Controller)('osce'),
    __metadata("design:paramtypes", [osce_service_1.OsceService,
        auth_service_1.AuthService])
], OsceController);
//# sourceMappingURL=osce.controller.js.map