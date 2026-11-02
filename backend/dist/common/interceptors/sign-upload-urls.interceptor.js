"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignUploadUrlsInterceptor = void 0;
exports.sign = sign;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const signed_media_util_1 = require("../utils/signed-media.util");
const URL_KEYS = new Set(['pdfUrl', 'videoUrl', 'lessonPdfUrl']);
const SKIP_KEYS = new Set(['noteData', 'rawText', 'lessonContent', 'questions']);
const MAX_DEPTH = 6;
let SignUploadUrlsInterceptor = class SignUploadUrlsInterceptor {
    intercept(_context, next) {
        return next.handle().pipe((0, operators_1.map)((body) => sign(body, 0)));
    }
};
exports.SignUploadUrlsInterceptor = SignUploadUrlsInterceptor;
exports.SignUploadUrlsInterceptor = SignUploadUrlsInterceptor = __decorate([
    (0, common_1.Injectable)()
], SignUploadUrlsInterceptor);
function sign(node, depth) {
    if (depth > MAX_DEPTH || node === null || typeof node !== 'object')
        return node;
    if (!Array.isArray(node)) {
        const proto = Object.getPrototypeOf(node);
        if (proto !== Object.prototype && proto !== null)
            return node;
    }
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++)
            node[i] = sign(node[i], depth + 1);
        return node;
    }
    const obj = node;
    const locked = obj.canAccess === false || obj.accessLocked === true;
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (URL_KEYS.has(key) && typeof value === 'string') {
            if (!locked)
                obj[key] = (0, signed_media_util_1.signUploadUrl)(value);
        }
        else if (value && typeof value === 'object' && !SKIP_KEYS.has(key)) {
            obj[key] = sign(value, depth + 1);
        }
    }
    return obj;
}
//# sourceMappingURL=sign-upload-urls.interceptor.js.map