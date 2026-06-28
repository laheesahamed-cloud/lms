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
var AuthController_1;
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
const apple_login_dto_1 = require("./dto/apple-login.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
const verify_email_otp_dto_1 = require("./dto/verify-email-otp.dto");
const resend_email_otp_dto_1 = require("./dto/resend-email-otp.dto");
let AuthController = AuthController_1 = class AuthController {
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
        this.logger = new common_1.Logger(AuthController_1.name);
    }
    async login(loginDto, nativeHeader, request, response) {
        const result = await this.authService.login(loginDto);
        if (result.sessionToken) {
            this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        }
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async register(registerDto, nativeHeader, request, response) {
        const result = await this.authService.register(registerDto);
        if (result.sessionToken) {
            this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        }
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async verifyEmailOtp(verifyEmailOtpDto, nativeHeader, request, response) {
        const result = await this.authService.verifyEmailOtp(verifyEmailOtpDto);
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    resendEmailOtp(resendEmailOtpDto) {
        return this.authService.resendEmailOtp(resendEmailOtpDto);
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
        let result;
        try {
            result = await this.authService.loginWithGoogleCode(googleCodeLoginDto, { origin, requestedWith });
        }
        catch (err) {
            if (err instanceof common_1.HttpException)
                throw err;
            throw new common_1.InternalServerErrorException(`Google sign-in error: ${err?.message || err}`);
        }
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async appleLogin(appleLoginDto, nativeHeader, request, response) {
        let result;
        try {
            result = await this.authService.loginWithApple(appleLoginDto);
        }
        catch (err) {
            if (err instanceof common_1.HttpException)
                throw err;
            this.logger.error(`Apple sign-in error: ${err?.message || err}`);
            throw new common_1.InternalServerErrorException(`Apple sign-in error: ${err?.message || err}`);
        }
        this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
        if (this.shouldExposeSessionToken(nativeHeader)) {
            return result;
        }
        const { sessionToken: _sessionToken, ...safeResult } = result;
        return safeResult;
    }
    async appleWebCallbackPost(body, request, response) {
        await this.handleAppleWebCallback(body || {}, request, response);
    }
    async appleWebCallbackGet(query, request, response) {
        await this.handleAppleWebCallback(query || {}, request, response);
    }
    async handleAppleWebCallback(payload, request, response) {
        const successUrl = String(this.configService.get('APPLE_WEB_SUCCESS_URL') || 'https://xyndrome.lk/auth/login?apple=success');
        const failureBase = String(this.configService.get('APPLE_WEB_FAILURE_URL') || 'https://xyndrome.lk/auth/login?apple=failed');
        const fail = (reason) => this.redirectTo(response, this.appendParam(failureBase, 'reason', reason));
        try {
            const expectedState = this.readCookie(request, 'xy_apple_state');
            try {
                response.clearCookie('xy_apple_state', { path: '/' });
            }
            catch { }
            if (payload.error)
                return fail('apple_error');
            if (payload.state && expectedState && payload.state !== expectedState) {
                this.logger.warn('Apple callback state mismatch — rejecting');
                return fail('state');
            }
            if (!payload.id_token)
                return fail('no_token');
            let fullName = '';
            if (payload.user) {
                try {
                    const parsed = typeof payload.user === 'string' ? JSON.parse(payload.user) : payload.user;
                    fullName = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ').trim();
                }
                catch {
                }
            }
            const result = await this.authService.loginWithApple({
                identityToken: String(payload.id_token || ''),
                fullName: fullName || undefined,
            });
            this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
            return this.redirectTo(response, successUrl);
        }
        catch (err) {
            this.logger.error(`Apple web callback failed: ${err?.message || err}`);
            return fail('verify');
        }
    }
    redirectTo(response, url) {
        try {
            response.redirect(302, url);
        }
        catch {
            try {
                response.statusCode = 302;
                response.setHeader('Location', url);
                response.end();
            }
            catch {
            }
        }
    }
    appendParam(url, key, value) {
        return url + (url.includes('?') ? '&' : '?') + `${key}=${encodeURIComponent(value)}`;
    }
    readCookie(request, name) {
        return String(request?.headers?.cookie || '')
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`))
            ?.slice(name.length + 1) || '';
    }
    me(authorization, cookie) {
        return this.authService.me(authorization || this.authorizationFromCookie(cookie));
    }
    async logout(authorization, cookie, request, response) {
        this.clearSessionCookie(response, request);
        return this.authService.logout(authorization || this.authorizationFromCookie(cookie));
    }
    async deleteAccount(authorization, cookie, request, response) {
        const result = await this.authService.deleteAccount(authorization || this.authorizationFromCookie(cookie));
        this.clearSessionCookie(response, request);
        return result;
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
    (0, common_1.Post)('verify-email-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_otp_dto_1.VerifyEmailOtpDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmailOtp", null);
__decorate([
    (0, common_1.Post)('resend-email-otp'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_email_otp_dto_1.ResendEmailOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendEmailOtp", null);
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
    (0, common_1.Post)('apple'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-lms-native')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [apple_login_dto_1.AppleLoginDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "appleLogin", null);
__decorate([
    (0, common_1.Post)('apple/callback'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "appleWebCallbackPost", null);
__decorate([
    (0, common_1.Get)('apple/callback'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "appleWebCallbackGet", null);
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
    (0, common_1.Delete)('account'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('cookie')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deleteAccount", null);
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
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map