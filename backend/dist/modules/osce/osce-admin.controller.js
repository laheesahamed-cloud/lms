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
exports.OsceAdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const osce_service_1 = require("./osce.service");
const osce_generator_service_1 = require("./osce-generator.service");
const smart_notes_image_api_service_1 = require("../smart-notes/smart-notes-image-api.service");
let OsceAdminController = class OsceAdminController {
    constructor(svc, generator, imageApi, authService) {
        this.svc = svc;
        this.generator = generator;
        this.imageApi = imageApi;
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
    async systems(auth) {
        await this.authService.requireAdmin(auth);
        return {
            systems: await this.svc.listCategories(),
            courses: await this.svc.listCourses(),
        };
    }
    async createCategory(body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.createCategory(Number(body?.courseId), body?.name || '');
    }
    async updateCategory(id, body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.updateCategory(id, body || {});
    }
    async deleteCategory(id, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.deleteCategory(id);
    }
    async reorderCategories(body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.reorderCategories(body?.ids || []);
    }
    async reorderCases(body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.reorderCases(body?.ids || []);
    }
    async cases(system, auth) {
        await this.authService.requireAdmin(auth);
        return { cases: await this.svc.listCases({ categoryId: system ? Number(system) : undefined }) };
    }
    async caseById(id, auth) {
        await this.authService.requireAdmin(auth);
        const found = await this.svc.getCaseById(id);
        if (!found)
            throw new common_1.BadRequestException('Case not found');
        const shotList = await this.svc.shotList(id);
        return { case: found, shotList };
    }
    async createCase(body, auth) {
        const admin = await this.authService.requireAdmin(auth);
        return this.svc.createCase({ ...body, createdBy: Number(admin?.id) || null });
    }
    async generateCase(body, auth) {
        const admin = await this.authService.requireAdmin(auth);
        if (!body?.title?.trim())
            throw new common_1.BadRequestException('A condition name is required');
        if (!body?.categoryId)
            throw new common_1.BadRequestException('Pick a category first');
        const categoryName = await this.svc.categoryName(Number(body.categoryId));
        const draft = await this.generator.generateCase(body.title.trim(), categoryName, body.notes, body.stationType === 'long' ? 'long' : 'short');
        const created = await this.svc.createCase({
            categoryId: Number(body.categoryId),
            stationType: body.stationType === 'long' ? 'long' : 'short',
            title: body.title.trim(),
            summary: draft.summary,
            caseData: draft.document,
            createdBy: Number(admin?.id) || null,
        });
        return { case: created, warnings: draft.warnings };
    }
    async updateCase(id, body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.updateCase(id, body || {});
    }
    async deleteCase(id, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.deleteCase(id);
    }
    async preview(id, req, auth) {
        await this.authService.requireAdmin(auth);
        const found = await this.svc.getCaseById(id);
        if (!found)
            throw new common_1.BadRequestException('Case not found');
        return this.svc.hydrateCase(found.slug, this.baseUrl(req), false);
    }
    async shotList(id, auth) {
        await this.authService.requireAdmin(auth);
        return { shotList: await this.svc.shotList(id) };
    }
    async publish(id, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.publishCase(id);
    }
    async unpublish(id, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.unpublishCase(id);
    }
    async uploadSlot(id, slot, file, body, auth) {
        await this.authService.requireAdmin(auth);
        if (!file?.buffer)
            throw new common_1.BadRequestException('No file received');
        let thumbBuffer;
        if (body?.thumb) {
            const m = String(body.thumb).match(/^data:[^;,]+;base64,(.+)$/s);
            if (m)
                thumbBuffer = Buffer.from(m[1], 'base64');
        }
        return this.svc.saveSlotImage(id, slot, file, {
            width: body?.width ? Number(body.width) : undefined,
            height: body?.height ? Number(body.height) : undefined,
            thumbBuffer,
            source: body?.source === 'ai' ? 'ai' : undefined,
        });
    }
    async linkSlot(id, slot, body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.saveSlotLink(id, slot, String(body?.url || ''));
    }
    async generateSlot(id, slot, body, auth) {
        await this.authService.requireAdmin(auth);
        if (!this.svc.canGenerateSlot(slot)) {
            throw new common_1.BadRequestException('ECG, X-ray and echo images cannot be generated — an image model draws what the film '
                + 'looks like with no signal behind it. Link a real ECG or auscultation card instead.');
        }
        const prompt = body?.prompt?.trim() || await this.svc.promptForSlot(id, slot);
        const model = await this.svc.getImageModel();
        const dataUrl = (await this.generator.generateImage(prompt, model))
            || (await this.imageApi.generateIllustration(prompt));
        if (!dataUrl) {
            throw new common_1.BadRequestException('The image model returned no picture. Check the Gemini key in Admin → Settings → AI, '
                + 'and that the key has image generation enabled.');
        }
        return { dataUrl, prompt };
    }
    async slotPrompt(id, slot, auth) {
        await this.authService.requireAdmin(auth);
        return { prompt: await this.svc.promptForSlot(id, slot) };
    }
    async clearSlot(id, slot, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.clearSlot(id, slot);
    }
    async getSettings(auth) {
        await this.authService.requireAdmin(auth);
        return { imageModel: await this.svc.getImageModel() };
    }
    async imageModels(auth) {
        await this.authService.requireAdmin(auth);
        return {
            models: await this.generator.listImageModels(),
            selected: await this.svc.getImageModel(),
        };
    }
    async putSettings(body, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.setImageModel(body?.imageModel || '');
    }
    async linkable(req, q, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.listLinkableContent(q || '', this.baseUrl(req));
    }
    async globalMedia(req, auth) {
        await this.authService.requireAdmin(auth);
        return { cast: await this.svc.globalMedia(this.baseUrl(req)) };
    }
    async uploadGlobal(slot, file, auth) {
        await this.authService.requireAdmin(auth);
        return this.svc.saveGlobalImage(`global:${slot}`, file);
    }
    async generateGlobal(slot, auth) {
        await this.authService.requireAdmin(auth);
        const who = slot === 'doctor'
            ? 'a friendly doctor in a white coat with a stethoscope, seated, facing the camera'
            : 'a middle-aged patient seated in a clinic chair, calm, facing the camera';
        const prompt = `Clean photographic portrait for a medical teaching app: ${who}. `
            + 'Plain neutral background, even lighting, head and shoulders, warm and approachable. '
            + 'No text, no letters, no labels, no watermarks. Framed 4:3.';
        const model = await this.svc.getImageModel();
        const dataUrl = (await this.generator.generateImage(prompt, model))
            || (await this.imageApi.generateIllustration(prompt));
        if (!dataUrl)
            throw new common_1.BadRequestException('The image model returned nothing.');
        return { dataUrl };
    }
    async inbox(auth) {
        await this.authService.requireAdmin(auth);
        return { files: await this.svc.listInbox() };
    }
    async inboxFile(fileName, auth) {
        await this.authService.requireAdmin(auth);
        const { buffer } = await this.svc.takeFromInbox(fileName);
        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return { fileName, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
    }
    async archiveInboxFile(fileName, auth) {
        await this.authService.requireAdmin(auth);
        await this.svc.archiveInbox(fileName);
        return { archived: true };
    }
};
exports.OsceAdminController = OsceAdminController;
__decorate([
    (0, common_1.Get)('systems'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "systems", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Put)('categories/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Put)('categories-order'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "reorderCategories", null);
__decorate([
    (0, common_1.Put)('cases-order'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "reorderCases", null);
__decorate([
    (0, common_1.Get)('cases'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Query)('system')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "cases", null);
__decorate([
    (0, common_1.Get)('cases/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "caseById", null);
__decorate([
    (0, common_1.Post)('cases'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "createCase", null);
__decorate([
    (0, common_1.Post)('cases/generate'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "generateCase", null);
__decorate([
    (0, common_1.Put)('cases/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "updateCase", null);
__decorate([
    (0, common_1.Delete)('cases/:id'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "deleteCase", null);
__decorate([
    (0, common_1.Get)('cases/:id/preview'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "preview", null);
__decorate([
    (0, common_1.Get)('cases/:id/shot-list'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "shotList", null);
__decorate([
    (0, common_1.Post)('cases/:id/publish'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('cases/:id/unpublish'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "unpublish", null);
__decorate([
    (0, common_1.Post)('cases/:id/media/:slot'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 6 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "uploadSlot", null);
__decorate([
    (0, common_1.Post)('cases/:id/media/:slot/link'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "linkSlot", null);
__decorate([
    (0, common_1.Post)('cases/:id/media/:slot/generate'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "generateSlot", null);
__decorate([
    (0, common_1.Get)('cases/:id/media/:slot/prompt'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "slotPrompt", null);
__decorate([
    (0, common_1.Delete)('cases/:id/media/:slot'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('slot')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "clearSlot", null);
__decorate([
    (0, common_1.Get)('settings'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Get)('image-models'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "imageModels", null);
__decorate([
    (0, common_1.Put)('settings'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "putSettings", null);
__decorate([
    (0, common_1.Get)('linkable'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "linkable", null);
__decorate([
    (0, common_1.Get)('global-media'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "globalMedia", null);
__decorate([
    (0, common_1.Post)('global-media/:slot'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 6 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('slot')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "uploadGlobal", null);
__decorate([
    (0, common_1.Post)('global-media/:slot/generate'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('slot')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "generateGlobal", null);
__decorate([
    (0, common_1.Get)('inbox'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "inbox", null);
__decorate([
    (0, common_1.Get)('inbox/:fileName'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "inboxFile", null);
__decorate([
    (0, common_1.Post)('inbox/:fileName/archive'),
    (0, permissions_decorator_1.RequirePermissions)('content.manage'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OsceAdminController.prototype, "archiveInboxFile", null);
exports.OsceAdminController = OsceAdminController = __decorate([
    (0, common_1.Controller)('admin/osce'),
    __metadata("design:paramtypes", [osce_service_1.OsceService,
        osce_generator_service_1.OsceGeneratorService,
        smart_notes_image_api_service_1.SmartNotesImageApiService,
        auth_service_1.AuthService])
], OsceAdminController);
//# sourceMappingURL=osce-admin.controller.js.map