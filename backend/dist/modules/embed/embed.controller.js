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
var EmbedController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbedController = void 0;
const common_1 = require("@nestjs/common");
let EmbedController = EmbedController_1 = class EmbedController {
    youtube(id, res) {
        if (!EmbedController_1.YOUTUBE_ID.test(String(id || ''))) {
            throw new common_1.BadRequestException('Invalid video id');
        }
        const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');
        this.harden(res);
        res.end(this.page(`https://www.youtube.com/embed/${safeId}`
            + '?playsinline=1&rel=0&modestbranding=1&iv_load_policy=3'));
    }
    harden(res) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', [
            "default-src 'none'",
            "style-src 'unsafe-inline'",
            'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
            "base-uri 'none'",
            "form-action 'none'",
        ].join('; '));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');
        res.removeHeader('X-Frame-Options');
        res.setHeader('X-Frame-Options', 'DENY');
    }
    page(src) {
        return '<!DOCTYPE html>'
            + '<html lang="en"><head><meta charset="utf-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            + '<title>Video</title>'
            + '<style>'
            + 'html,body{margin:0;height:100%;background:#000;overflow:hidden}'
            + 'iframe{display:block;border:0;width:100%;height:100%}'
            + '</style></head><body>'
            + `<iframe src="${src}" title="Video"`
            + ' allow="accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture"'
            + ' allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>'
            + '</body></html>';
    }
};
exports.EmbedController = EmbedController;
EmbedController.YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
__decorate([
    (0, common_1.Get)('youtube'),
    __param(0, (0, common_1.Query)('v')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EmbedController.prototype, "youtube", null);
exports.EmbedController = EmbedController = EmbedController_1 = __decorate([
    (0, common_1.Controller)('embed')
], EmbedController);
//# sourceMappingURL=embed.controller.js.map