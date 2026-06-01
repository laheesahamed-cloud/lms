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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const MARKETING_POPUP_MIME_TYPES = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};
let UploadsController = class UploadsController {
    async getPaymentProof(fileName, response) {
        const cleanFileName = String(fileName || '').trim();
        if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|pdf|txt)$/i.test(cleanFileName)) {
            throw new common_1.BadRequestException('Invalid upload file name');
        }
        const uploadRoot = (0, path_1.resolve)(process.cwd(), 'uploads', 'payment-proofs');
        const filePath = (0, path_1.resolve)((0, path_1.join)(uploadRoot, cleanFileName));
        if (!filePath.startsWith(`${uploadRoot}/`)) {
            throw new common_1.BadRequestException('Invalid upload path');
        }
        const fileStats = await (0, promises_1.stat)(filePath).catch(() => null);
        if (!fileStats?.isFile()) {
            throw new common_1.NotFoundException('File not found');
        }
        response.setHeader('Content-Type', this.mimeTypeForPaymentProof(cleanFileName));
        response.setHeader('Content-Length', String(fileStats.size));
        response.setHeader('Content-Disposition', `attachment; filename="${cleanFileName.replace(/["\r\n]+/g, '_')}"`);
        response.setHeader('Cache-Control', 'private, max-age=60');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.sendFile(filePath);
    }
    async getMarketingPopupImage(fileName, response) {
        const cleanFileName = String(fileName || '').trim();
        if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(cleanFileName)) {
            throw new common_1.BadRequestException('Invalid upload file name');
        }
        const extension = cleanFileName.split('.').pop()?.toLowerCase() || '';
        const mimeType = MARKETING_POPUP_MIME_TYPES[extension];
        if (!mimeType) {
            throw new common_1.BadRequestException('Unsupported upload file type');
        }
        const uploadRoot = (0, path_1.resolve)(process.cwd(), 'uploads', 'marketing-popups');
        const filePath = (0, path_1.resolve)((0, path_1.join)(uploadRoot, cleanFileName));
        if (!filePath.startsWith(`${uploadRoot}/`)) {
            throw new common_1.BadRequestException('Invalid upload path');
        }
        const fileStats = await (0, promises_1.stat)(filePath).catch(() => null);
        if (!fileStats?.isFile()) {
            throw new common_1.NotFoundException('File not found');
        }
        response.setHeader('Content-Type', mimeType);
        response.setHeader('Content-Length', String(fileStats.size));
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.sendFile(filePath);
    }
    mimeTypeForPaymentProof(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        if (extension === 'pdf')
            return 'application/pdf';
        if (extension === 'png')
            return 'image/png';
        if (extension === 'jpg' || extension === 'jpeg')
            return 'image/jpeg';
        if (extension === 'webp')
            return 'image/webp';
        if (extension === 'txt')
            return 'text/plain; charset=utf-8';
        return 'application/octet-stream';
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Get)('payment-proofs/:fileName'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getPaymentProof", null);
__decorate([
    (0, common_1.Get)('marketing-popups/:fileName'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getMarketingPopupImage", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads')
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map