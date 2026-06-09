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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const auth_token_util_1 = require("./auth-token.util");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const google_login_dto_1 = require("./dto/google-login.dto");
const google_code_login_dto_1 = require("./dto/google-code-login.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
let AuthController = class AuthController {
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    async login(loginDto, nativeHeader, request, response) {
        const result = await this.authService.login(loginDto);
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async register(registerDto, nativeHeader, request, response) {
        const result = await this.authService.register(registerDto);
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async googleLogin(googleLoginDto, nativeHeader, request, response) {
        const result = await this.authService.loginWithGoogle(googleLoginDto);
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async googleCodeLogin(googleCodeLoginDto, nativeHeader, requestedWith, origin, request, response) {
        const result = await this.authService.loginWithGoogleCode(googleCodeLoginDto, { origin, requestedWith });
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    me(authorization, cookie) {
        return this.authService.me(authorization || this.authorizationFromCookie(cookie));
    }
    async logout(authorization, cookie, request, response) {
        this.clearSessionCookie(response, request);
        return this.authService.logout(authorization || this.authorizationFromCookie(cookie));
    }
    requestPasswordReset(forgotPasswordDto) {
        return this.authService.requestPasswordReset(forgotPasswordDto);
    }
    resetPassword(resetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }
    updateProfile(authorization, updateProfileDto) {
        return this.authService.updateProfile(authorization, updateProfileDto);
    }
    changePassword(authorization, changePasswordDto) {
        return this.authService.changePassword(authorization, changePasswordDto);
    }
    setSessionCookie(response, request, token, ttlDays = auth_token_util_1.SESSION_TTL_DAYS) {
        response.cookie('lms_session', token, {
            httpOnly: true,
            secure: this.shouldUseSecureSessionCookie(request),
            sameSite: 'lax',
            path: '/',
            maxAge: ttlDays * 24 * 60 * 60 * 1000,
        });
    }
    clearSessionCookie(response, request) {
        const secure = this.shouldUseSecureSessionCookie(request);
        response.clearCookie('lms_session', {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/',
        });
    }
    shouldUseSecureSessionCookie(request) {
        const explicit = this.getBooleanConfig('SESSION_COOKIE_SECURE') ?? this.getBooleanConfig('COOKIE_SECURE');
        if (explicit !== null)
            return explicit;
        if (this.isInsecureLocalOrLanRequest(request))
            return false;
        if (this.configService.get('NODE_ENV') === 'production')
            return true;
        const configuredUrls = [
            this.configService.get('frontendUrl'),
            this.configService.get('FRONTEND_URL'),
            this.configService.get('APP_PUBLIC_URL'),
            this.configService.get('API_PUBLIC_URL'),
            ...String(this.configService.get('FRONTEND_URLS') || '').split(','),
        ];
        return configuredUrls.some((value) => {
            const clean = String(value || '').trim();
            if (!clean || ['null', 'undefined'].includes(clean.toLowerCase()))
                return false;
            try {
                const origin = new URL(clean).origin;
                return origin.startsWith('https://') &&
                    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) &&
                    !/^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
            }
            catch {
                return false;
            }
        });
    }
    getBooleanConfig(name) {
        const value = this.configService.get(name);
        const normalized = String(value || '').trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'off'].includes(normalized))
            return false;
        return null;
    }
    isInsecureLocalOrLanRequest(request) {
        const host = String(request?.headers?.host || '').trim();
        const forwardedProto = String(request?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
        const protocol = forwardedProto || String(request?.protocol || '').trim();
        const origin = String(request?.headers?.origin || '').trim();
        const referer = String(request?.headers?.referer || '').trim();
        const requestUrl = host ? `${protocol || 'http'}://${host}` : '';
        return [requestUrl, origin, referer].some((value) => this.isInsecureLocalOrLanUrl(value));
    }
    isInsecureLocalOrLanUrl(value) {
        if (!value)
            return false;
        try {
            const url = new URL(value);
            return url.protocol === 'http:' && (/^(localhost|127\.0\.0\.1)$/i.test(url.hostname) ||
                /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(url.hostname));
        }
        catch {
            return false;
        }
    }
    shouldExposeSessionToken(nativeHeader) {
        return /^(1|true|native|ios|android)$/i.test(String(nativeHeader || '').trim());
    }
    authorizationFromCookie(cookieHeader) {
        const token = String(cookieHeader || '')
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('lms_session='))
            ?.slice('lms_session='.length) || '';
        return token ? `Bearer ${decodeURIComponent(token)}` : undefined;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('google'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_login_dto_1.GoogleLoginDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleLogin", null);
__decorate([
    (0, common_1.Post)('google/code'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Headers)('x-requested-with')),
    __param(3, (0, common_1.Headers)('origin')),
    __param(4, (0, common_1.Req)()),
    __param(5, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_code_login_dto_1.GoogleCodeLoginDto, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCodeLogin", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('cookie')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('cookie')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestPasswordReset", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Patch)('profile'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Patch)('password'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map