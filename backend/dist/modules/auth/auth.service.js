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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const ai_provider_utils_1 = require("../../common/utils/ai-provider.utils");
const subscription_catalog_1 = require("../plans/subscription-catalog");
const auth_token_util_1 = require("./auth-token.util");
const role_permissions_1 = require("./role-permissions");
const ALLOWED_AVATAR_KEYS = new Set(['blue-tie', 'teal-coat', 'pink-necklace', 'violet-scarf', 'amber-coat', 'cyan-necklace']);
const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_OTP_TTL_MINUTES = 10;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const SMTP_SETTING_KEYS = {
    enabled: 'smtp_enabled',
    host: 'smtp_host',
    port: 'smtp_port',
    security: 'smtp_security',
    username: 'smtp_username',
    password: 'smtp_password',
    fromName: 'smtp_from_name',
    fromEmail: 'smtp_from_email',
    publicUrl: 'smtp_public_url',
    subject: 'smtp_reset_subject',
    heading: 'smtp_reset_heading',
    intro: 'smtp_reset_intro',
    buttonLabel: 'smtp_reset_button_label',
    footer: 'smtp_reset_footer',
};
const LEGACY_SMTP_BRAND_REPLACEMENTS = [
    [/\bERPM LMS\b/g, 'xyndrome'],
    [/\bERPM\b/g, 'xyndrome'],
];
let AuthService = AuthService_1 = class AuthService {
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.appleKeysCache = null;
    }
    async login(loginDto) {
        const email = loginDto.email.trim().toLowerCase();
        const [rows] = await this.db.execute('SELECT id, full_name, email, password, role, permissions, status, avatar_key, email_verified FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1', [email]);
        const user = rows[0];
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const submittedPassword = loginDto.password;
        const passwordMatches = await bcrypt.compare(submittedPassword, user.password).catch(() => false);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        if ((0, role_permissions_1.isStaffRole)(user.role) && user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your admin account is not active right now');
        }
        if (user.role === 'student' && !this.isEmailVerified(user)) {
            return this.beginEmailVerification(user);
        }
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const sessionTtlDays = (0, role_permissions_1.isStaffRole)(user.role) ? auth_token_util_1.ADMIN_SESSION_TTL_DAYS : auth_token_util_1.SESSION_TTL_DAYS;
        await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ? WHERE id = ?', [
            (0, auth_token_util_1.hashSessionToken)(sessionToken),
            (0, auth_token_util_1.createSessionExpiry)(sessionTtlDays),
            user.id,
        ]);
        return {
            ok: true,
            sessionToken,
            sessionTtlDays,
            redirectPath: this.getRedirectPath(user.role, user.status),
            user: await this.serializeUser(user),
        };
    }
    async register(registerDto) {
        const fullName = registerDto.fullName.trim();
        const email = registerDto.email.trim().toLowerCase();
        if (registerDto.password !== registerDto.confirmPassword) {
            throw new common_1.BadRequestException('Passwords do not match');
        }
        if (!registerDto.acceptedTerms) {
            throw new common_1.BadRequestException('Please accept the terms and conditions');
        }
        const [existing] = await this.db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (existing.length > 0) {
            throw new common_1.BadRequestException('An account with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);
        const [result] = await this.db.execute('INSERT INTO users (full_name, email, password, role, status, email_verified) VALUES (?, ?, ?, ?, ?, 0)', [fullName, email, hashedPassword, 'student', 'active']);
        await this.assignDefaultEntryPlan(result.insertId);
        return this.beginEmailVerification({
            id: result.insertId,
            full_name: fullName,
            email,
            role: 'student',
            status: 'active',
        });
    }
    async loginWithGoogle(googleLoginDto) {
        const profile = await this.verifyGoogleCredential(googleLoginDto.credential);
        return this.loginWithGoogleProfile(profile);
    }
    async loginWithGoogleCode(googleCodeLoginDto, context = {}) {
        if (String(context.requestedWith || '').toLowerCase() !== 'xmlhttprequest') {
            throw new common_1.BadRequestException('Google sign-in request is invalid');
        }
        const redirectUri = this.resolveGoogleCodeRedirectUri(googleCodeLoginDto.redirectUri || context.origin);
        const idToken = await this.exchangeGoogleAuthorizationCode(googleCodeLoginDto.code, redirectUri);
        const profile = await this.verifyGoogleCredential(idToken);
        return this.loginWithGoogleProfile(profile);
    }
    async loginWithGoogleProfile(profile) {
        const email = String(profile.email || '').trim().toLowerCase();
        const fullName = this.getGoogleDisplayName(profile);
        const [rows] = await this.db.execute('SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1', [email]);
        let user = rows[0];
        if (!user) {
            const randomPassword = await bcrypt.hash(`google:${profile.sub}:${(0, crypto_1.randomBytes)(16).toString('hex')}`, 10);
            const [result] = await this.db.execute('INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', [fullName, email, randomPassword, 'student', 'active']);
            await this.assignDefaultEntryPlan(result.insertId);
            user = {
                id: result.insertId,
                full_name: fullName,
                email,
                password: randomPassword,
                role: 'student',
                status: 'active',
            };
        }
        if ((0, role_permissions_1.isStaffRole)(user.role) && user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your admin account is not active right now');
        }
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const sessionTtlDays = (0, role_permissions_1.isStaffRole)(user.role) ? auth_token_util_1.ADMIN_SESSION_TTL_DAYS : auth_token_util_1.SESSION_TTL_DAYS;
        await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ?, email_verified = 1 WHERE id = ?', [
            (0, auth_token_util_1.hashSessionToken)(sessionToken),
            (0, auth_token_util_1.createSessionExpiry)(sessionTtlDays),
            user.id,
        ]);
        return {
            ok: true,
            sessionToken,
            sessionTtlDays,
            redirectPath: this.getRedirectPath(user.role, user.status),
            user: await this.serializeUser(user),
        };
    }
    async loginWithApple(appleLoginDto) {
        const profile = await this.verifyAppleCredential(appleLoginDto.identityToken);
        return this.loginWithAppleProfile(profile, appleLoginDto.fullName);
    }
    async loginWithAppleProfile(profile, providedName) {
        const email = String(profile.email || '').trim().toLowerCase();
        if (!email) {
            throw new common_1.UnauthorizedException('Apple sign-in did not provide an email');
        }
        const fallbackName = email.includes('@') ? email.split('@')[0] : 'Student';
        const fullName = (providedName || '').trim() || fallbackName;
        const [rows] = await this.db.execute('SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1', [email]);
        let user = rows[0];
        if (!user) {
            const randomPassword = await bcrypt.hash(`apple:${profile.sub}:${(0, crypto_1.randomBytes)(16).toString('hex')}`, 10);
            const [result] = await this.db.execute('INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', [fullName, email, randomPassword, 'student', 'active']);
            await this.assignDefaultEntryPlan(result.insertId);
            user = {
                id: result.insertId,
                full_name: fullName,
                email,
                password: randomPassword,
                role: 'student',
                status: 'active',
            };
        }
        if ((0, role_permissions_1.isStaffRole)(user.role) && user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your admin account is not active right now');
        }
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const sessionTtlDays = (0, role_permissions_1.isStaffRole)(user.role) ? auth_token_util_1.ADMIN_SESSION_TTL_DAYS : auth_token_util_1.SESSION_TTL_DAYS;
        await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ?, email_verified = 1 WHERE id = ?', [
            (0, auth_token_util_1.hashSessionToken)(sessionToken),
            (0, auth_token_util_1.createSessionExpiry)(sessionTtlDays),
            user.id,
        ]);
        return {
            ok: true,
            sessionToken,
            sessionTtlDays,
            redirectPath: this.getRedirectPath(user.role, user.status),
            user: await this.serializeUser(user),
        };
    }
    async getAppleSigningKeys() {
        const now = Date.now();
        if (this.appleKeysCache && now - this.appleKeysCache.fetchedAt < 6 * 60 * 60 * 1000) {
            return this.appleKeysCache.keys;
        }
        const response = await fetch('https://appleid.apple.com/auth/keys');
        if (!response.ok) {
            throw new common_1.UnauthorizedException('Could not verify Apple sign-in right now');
        }
        const data = (await response.json());
        const keys = Array.isArray(data.keys) ? data.keys : [];
        this.appleKeysCache = { keys, fetchedAt: now };
        return keys;
    }
    getAppleAllowedAudiences() {
        const configured = String(this.configService.get('APPLE_CLIENT_IDS') ||
            this.configService.get('APPLE_BUNDLE_ID') ||
            'app.xyndrome.lk')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        return configured.length ? configured : ['app.xyndrome.lk'];
    }
    async verifyAppleCredential(identityToken) {
        const parts = String(identityToken || '').split('.');
        if (parts.length !== 3) {
            throw new common_1.UnauthorizedException('Invalid Apple identity token');
        }
        let header;
        let payload;
        try {
            header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
            payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid Apple identity token');
        }
        if (header?.alg !== 'RS256' || !header?.kid) {
            throw new common_1.UnauthorizedException('Unexpected Apple identity token format');
        }
        const keys = await this.getAppleSigningKeys();
        const jwk = keys.find((key) => key.kid === header.kid);
        if (!jwk) {
            throw new common_1.UnauthorizedException('Apple signing key not found');
        }
        const publicKey = (0, crypto_1.createPublicKey)({ key: jwk, format: 'jwk' });
        const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
        const signature = Buffer.from(parts[2], 'base64url');
        const signatureValid = (0, crypto_1.verify)('RSA-SHA256', signedContent, publicKey, signature);
        if (!signatureValid) {
            throw new common_1.UnauthorizedException('Apple identity token signature is invalid');
        }
        if (payload.iss !== 'https://appleid.apple.com') {
            throw new common_1.UnauthorizedException('Apple identity token issuer mismatch');
        }
        if (!this.getAppleAllowedAudiences().includes(String(payload.aud || ''))) {
            throw new common_1.UnauthorizedException('Apple identity token audience mismatch');
        }
        if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
            throw new common_1.UnauthorizedException('Apple identity token has expired');
        }
        return {
            sub: String(payload.sub || ''),
            email: String(payload.email || ''),
            email_verified: payload.email_verified === true || payload.email_verified === 'true',
        };
    }
    async me(authorization) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        return {
            ok: true,
            user: await this.serializeUser(user),
            redirectPath: this.getRedirectPath(user.role, user.status),
        };
    }
    async logout(authorization) {
        const token = (0, auth_token_util_1.extractBearerToken)(authorization);
        if ((0, auth_token_util_1.isValidSessionTokenFormat)(token)) {
            await this.db.execute('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE session_token = ?', [(0, auth_token_util_1.hashSessionToken)(token)]);
        }
        return {
            ok: true,
        };
    }
    async deleteAccount(authorization) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        if ((0, role_permissions_1.isStaffRole)(user.role)) {
            throw new common_1.BadRequestException('Staff accounts cannot be self-deleted here');
        }
        const scrambledEmail = `deleted+${user.id}-${(0, crypto_1.randomBytes)(6).toString('hex')}@deleted.invalid`;
        const lockedPassword = await bcrypt.hash(`deleted:${(0, crypto_1.randomBytes)(16).toString('hex')}`, 10);
        await this.db.execute(`UPDATE users
       SET full_name = 'Deleted user',
           email = ?,
           password = ?,
           avatar_key = NULL,
           session_token = NULL,
           session_expires_at = NULL,
           password_reset_token = NULL,
           password_reset_expires_at = NULL,
           deleted_at = NOW()
       WHERE id = ?`, [scrambledEmail, lockedPassword, user.id]);
        return {
            ok: true,
            message: 'Your account has been deleted.',
        };
    }
    canExposeDevResetToken(shouldSendEmail) {
        const nodeEnv = this.configService.get('NODE_ENV') || 'development';
        const exposeDevResetToken = String(this.configService.get('EXPOSE_DEV_RESET_TOKEN') || '').toLowerCase() === 'true';
        return nodeEnv !== 'production' && !shouldSendEmail && exposeDevResetToken;
    }
    async requestPasswordReset(forgotPasswordDto) {
        const email = forgotPasswordDto.email.trim().toLowerCase();
        let [rows] = await this.db.execute('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
        if (!rows.length) {
            [rows] = await this.db.execute('SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [email]);
        }
        const user = rows[0];
        if (!user) {
            return {
                ok: true,
                message: 'If an account exists for that email, a reset link is ready.',
            };
        }
        const resetToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await this.db.execute(`UPDATE users
       SET password_reset_token = ?,
           password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`, [(0, auth_token_util_1.hashSessionToken)(resetToken), PASSWORD_RESET_TTL_MINUTES, user.id]);
        const smtpSettings = await this.getPasswordResetSmtpSettings();
        const resetPath = `/auth/reset-password?token=${resetToken}`;
        const resetUrl = `${smtpSettings.publicUrl.replace(/\/+$/, '')}${resetPath}`;
        const shouldSendEmail = smtpSettings.enabled && smtpSettings.configured;
        const canExposeLocalResetLink = this.canExposeDevResetToken(shouldSendEmail);
        if (!shouldSendEmail) {
            this.logger.warn(`Password reset email skipped for user ${user.id}: SMTP ${smtpSettings.enabled ? 'incomplete' : 'disabled'}`);
        }
        const emailSent = shouldSendEmail
            ? await this.sendPasswordResetEmail({
                to: user.email,
                resetUrl,
                settings: smtpSettings,
            }).catch((error) => {
                const errorCode = String(error?.code || error?.responseCode || error?.name || 'email_error');
                this.logger.warn(`Password reset email failed for user ${user.id}: ${errorCode}`);
                return false;
            })
            : false;
        return {
            ok: true,
            message: emailSent
                ? 'Password reset email sent. Check your inbox.'
                : shouldSendEmail
                    ? 'If an account exists for that email, a reset link is ready.'
                    : canExposeLocalResetLink
                        ? 'Password reset link created.'
                        : 'If an account exists for that email, a reset link is ready.',
            emailSent,
            resetToken: canExposeLocalResetLink ? resetToken : undefined,
            resetPath: canExposeLocalResetLink ? resetPath : undefined,
            expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
        };
    }
    async resetPassword(resetPasswordDto) {
        if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
            throw new common_1.BadRequestException('New passwords do not match');
        }
        const [rows] = await this.db.execute(`SELECT id, password_reset_token, password_reset_expires_at
       FROM users
       WHERE password_reset_token = ?
         AND password_reset_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(resetPasswordDto.token.trim())]);
        const user = rows[0];
        if (!user) {
            throw new common_1.BadRequestException('Reset link is invalid or has expired');
        }
        const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
        await this.db.execute(`UPDATE users
       SET password = ?,
           password_reset_token = NULL,
           password_reset_expires_at = NULL,
           session_token = NULL,
           session_expires_at = NULL
       WHERE id = ?`, [hashedPassword, user.id]);
        return {
            ok: true,
            message: 'Password updated. You can sign in with your new password.',
        };
    }
    isEmailVerified(user) {
        const raw = String(user.email_verified ?? '1').trim().toLowerCase();
        return !['0', '', 'false', 'no'].includes(raw);
    }
    async beginEmailVerification(user) {
        const { emailSent, code } = await this.issueEmailOtp(user);
        const exposeDevCode = !emailSent && this.configService.get('NODE_ENV') !== 'production';
        return {
            ok: true,
            emailVerificationRequired: true,
            email: user.email,
            emailSent,
            expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
            message: emailSent
                ? `We sent a 6-digit verification code to ${user.email}.`
                : 'Enter the 6-digit verification code to continue.',
            ...(exposeDevCode ? { devCode: code } : {}),
        };
    }
    async issueEmailOtp(user) {
        const code = String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
        await this.db.execute(`UPDATE users
       SET email_otp_code = ?,
           email_otp_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           email_otp_attempts = 0,
           email_otp_last_sent_at = NOW()
       WHERE id = ?`, [(0, auth_token_util_1.hashSessionToken)(code), EMAIL_OTP_TTL_MINUTES, user.id]);
        const settings = await this.getPasswordResetSmtpSettings();
        const shouldSendEmail = settings.enabled && settings.configured;
        if (!shouldSendEmail) {
            this.logger.warn(`Email OTP not sent for user ${user.id}: SMTP ${settings.enabled ? 'incomplete' : 'disabled'}`);
            return { emailSent: false, code };
        }
        const emailSent = await this.sendEmailVerificationOtp({ to: user.email, code, settings }).catch((error) => {
            const errorCode = String(error?.code || error?.responseCode || error?.name || 'email_error');
            this.logger.warn(`Email OTP send failed for user ${user.id}: ${errorCode}`);
            return false;
        });
        return { emailSent, code };
    }
    async verifyEmailOtp(verifyEmailOtpDto) {
        const email = verifyEmailOtpDto.email.trim().toLowerCase();
        const code = String(verifyEmailOtpDto.code || '').trim();
        const [rows] = await this.db.execute(`SELECT id, full_name, email, password, role, status, avatar_key,
              email_verified, email_otp_code, email_otp_expires_at, email_otp_attempts
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`, [email]);
        const user = rows[0];
        if (!user) {
            throw new common_1.BadRequestException('Verification code is invalid or has expired');
        }
        if (this.isEmailVerified(user)) {
            return this.issueSessionForUser(user);
        }
        const attempts = Number(user.email_otp_attempts || 0);
        if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
            throw new common_1.BadRequestException('Too many attempts. Request a new code and try again.');
        }
        const expiresAt = user.email_otp_expires_at ? new Date(user.email_otp_expires_at) : null;
        const expired = !user.email_otp_code || !expiresAt || expiresAt.getTime() <= Date.now();
        if (expired) {
            throw new common_1.BadRequestException('Verification code is invalid or has expired');
        }
        if ((0, auth_token_util_1.hashSessionToken)(code) !== user.email_otp_code) {
            await this.db.execute('UPDATE users SET email_otp_attempts = email_otp_attempts + 1 WHERE id = ?', [user.id]);
            const remaining = Math.max(0, EMAIL_OTP_MAX_ATTEMPTS - (attempts + 1));
            throw new common_1.BadRequestException(remaining > 0
                ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
                : 'Incorrect code. Request a new code and try again.');
        }
        await this.db.execute(`UPDATE users
       SET email_verified = 1,
           email_otp_code = NULL,
           email_otp_expires_at = NULL,
           email_otp_attempts = 0
       WHERE id = ?`, [user.id]);
        return this.issueSessionForUser(user);
    }
    async resendEmailOtp(resendEmailOtpDto) {
        const email = resendEmailOtpDto.email.trim().toLowerCase();
        const [rows] = await this.db.execute(`SELECT id, email, role, email_verified, email_otp_last_sent_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`, [email]);
        const user = rows[0];
        const baseResponse = {
            ok: true,
            expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
            message: 'If your email still needs verification, a new code is on its way.',
        };
        if (!user || user.role !== 'student' || this.isEmailVerified(user)) {
            return baseResponse;
        }
        const lastSentAt = user.email_otp_last_sent_at ? new Date(user.email_otp_last_sent_at) : null;
        if (lastSentAt) {
            const secondsSince = (Date.now() - lastSentAt.getTime()) / 1000;
            if (secondsSince < EMAIL_OTP_RESEND_COOLDOWN_SECONDS) {
                return { ...baseResponse, retryAfterSeconds: Math.ceil(EMAIL_OTP_RESEND_COOLDOWN_SECONDS - secondsSince) };
            }
        }
        const { emailSent, code } = await this.issueEmailOtp(user);
        const exposeDevCode = !emailSent && this.configService.get('NODE_ENV') !== 'production';
        return {
            ...baseResponse,
            emailSent,
            ...(exposeDevCode ? { devCode: code } : {}),
        };
    }
    async issueSessionForUser(user) {
        if ((0, role_permissions_1.isStaffRole)(user.role) && user.status !== 'active') {
            throw new common_1.UnauthorizedException('Your admin account is not active right now');
        }
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const sessionTtlDays = (0, role_permissions_1.isStaffRole)(user.role) ? auth_token_util_1.ADMIN_SESSION_TTL_DAYS : auth_token_util_1.SESSION_TTL_DAYS;
        await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ? WHERE id = ?', [
            (0, auth_token_util_1.hashSessionToken)(sessionToken),
            (0, auth_token_util_1.createSessionExpiry)(sessionTtlDays),
            user.id,
        ]);
        return {
            ok: true,
            sessionToken,
            sessionTtlDays,
            redirectPath: this.getRedirectPath(user.role, user.status),
            user: await this.serializeUser(user),
        };
    }
    async sendEmailVerificationOtp(input) {
        const { settings, code, to } = input;
        const transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            secure: settings.security === 'ssl',
            auth: {
                user: settings.username,
                pass: settings.password,
            },
        });
        await transporter.sendMail({
            from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
            to,
            subject: `Your ${settings.fromName} verification code`,
            text: this.renderEmailOtpText(settings, code),
            html: this.renderEmailOtpHtml(settings, code),
        });
        return true;
    }
    renderEmailOtpText(settings, code) {
        return `Verify your email

Enter this 6-digit code to finish signing in to ${settings.fromName}:

${code}

This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes.

If you did not try to sign in, you can safely ignore this email.`;
    }
    renderEmailOtpHtml(settings, code) {
        const body = `
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">Enter this 6-digit code to finish signing in:</p>
            <div style="text-align:center;margin:8px 0 22px;">
              <span style="display:inline-block;font-size:32px;font-weight:900;letter-spacing:.2em;white-space:nowrap;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px 14px 24px;">${this.escapeHtml(code)}</span>
            </div>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes.</p>`;
        return this.renderBrandEmailDocument({
            settings,
            heading: 'Verify your email',
            bodyHtml: body,
            footerHtml: 'If you did not try to sign in, you can safely ignore this email.',
        });
    }
    escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char] || char));
    }
    renderBrandEmailDocument(input) {
        const { settings, heading, bodyHtml, footerHtml } = input;
        const safe = (value) => this.escapeHtml(value);
        const logoUrl = `${String(settings.publicUrl || '').replace(/\/+$/, '')}/landing/logo.png`;
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only;}</style>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;">
  <div style="margin:0;padding:32px;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ef;border-radius:18px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,.10);">
      <div style="padding:28px 28px 22px;background:#ffffff;text-align:center;">
        <img src="${safe(logoUrl)}" alt="${safe(settings.fromName)}" width="160" style="display:inline-block;max-width:160px;height:auto;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="padding:22px 28px;background:linear-gradient(135deg,#2563EB,#14B8A6);color:#ffffff;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#ffffff;">${safe(heading)}</h1>
      </div>
      <div style="padding:28px;background:#ffffff;color:#0f172a;">
        ${bodyHtml}
      </div>
      <div style="border-top:1px solid #e2e8f0;padding:18px 28px;font-size:12px;line-height:1.6;color:#64748b;background:#f8fafc;">${footerHtml}</div>
    </div>
  </div>
</body>
</html>`;
    }
    async updateProfile(authorization, updateProfileDto) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        const fullName = updateProfileDto.fullName.trim();
        const avatarKey = updateProfileDto.avatarKey?.trim() || null;
        if (avatarKey && !ALLOWED_AVATAR_KEYS.has(avatarKey)) {
            throw new common_1.BadRequestException('Selected avatar is not available');
        }
        await this.db.execute('UPDATE users SET full_name = ?, avatar_key = ? WHERE id = ?', [fullName, avatarKey, user.id]);
        return {
            ok: true,
            user: await this.serializeUser({
                ...user,
                full_name: fullName,
                avatar_key: avatarKey,
            }),
        };
    }
    async changePassword(authorization, changePasswordDto) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
            throw new common_1.BadRequestException('New passwords do not match');
        }
        const currentPassword = changePasswordDto.currentPassword;
        const passwordMatches = await bcrypt.compare(currentPassword, user.password).catch(() => false);
        if (!passwordMatches) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
        await this.db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        return {
            ok: true,
        };
    }
    async requireAdmin(authorization) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        if (!(0, role_permissions_1.isStaffRole)(user.role) || user.status !== 'active') {
            throw new common_1.UnauthorizedException('Admin access is required');
        }
        return this.serializeUser(user);
    }
    async requireAuthenticatedUser(authorization) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        return this.serializeUser(user);
    }
    async requireStudent(authorization) {
        const user = await this.findUserByToken(this.extractToken(authorization));
        if (user.role !== 'student' || user.status !== 'active') {
            throw new common_1.UnauthorizedException('Student access is required');
        }
        return this.serializeUser(user);
    }
    getRedirectPath(role, status) {
        if ((0, role_permissions_1.isStaffRole)(role)) {
            if (status !== 'active') {
                throw new common_1.UnauthorizedException('Your admin account is not active right now');
            }
            return '/admin/dashboard';
        }
        return status === 'active' ? '/app/dashboard' : '/app/pending';
    }
    extractToken(authorization) {
        const token = (0, auth_token_util_1.extractBearerToken)(authorization);
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing');
        }
        return token;
    }
    async findUserByToken(sessionToken) {
        const [rows] = await this.db.execute(`SELECT id, full_name, email, password, role, permissions, status, avatar_key, session_token, session_expires_at
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(sessionToken)]);
        const user = rows[0];
        if (!user) {
            throw new common_1.UnauthorizedException('Session is invalid or has expired');
        }
        return user;
    }
    async getPasswordResetSmtpSettings() {
        const keys = Object.values(SMTP_SETTING_KEYS);
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(keys);
        const [rows] = await this.db.execute(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
        const values = new Map(rows.map((row) => [String(row.setting_key), String(row.setting_value || '').trim()]));
        const encryptedPassword = values.get(SMTP_SETTING_KEYS.password) || '';
        const password = encryptedPassword ? this.decryptSettingsSecret(encryptedPassword) : '';
        const publicUrl = values.get(SMTP_SETTING_KEYS.publicUrl) ||
            String(this.configService.get('APP_PUBLIC_URL') || 'http://localhost/lms').trim();
        return {
            enabled: this.parseBoolean(values.get(SMTP_SETTING_KEYS.enabled), false),
            host: values.get(SMTP_SETTING_KEYS.host) || '',
            port: Number(values.get(SMTP_SETTING_KEYS.port) || 587),
            security: values.get(SMTP_SETTING_KEYS.security) === 'ssl' ? 'ssl' : 'starttls',
            username: values.get(SMTP_SETTING_KEYS.username) || '',
            password,
            fromName: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.fromName)) || 'xyndrome',
            fromEmail: values.get(SMTP_SETTING_KEYS.fromEmail) || '',
            publicUrl,
            subject: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.subject)) || 'Reset your xyndrome password',
            heading: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.heading)) || 'Reset your password',
            intro: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.intro)) || 'We received a request to reset your xyndrome password.',
            buttonLabel: values.get(SMTP_SETTING_KEYS.buttonLabel) || 'Reset password',
            footer: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.footer)) || 'If you did not request this, you can safely ignore this email.',
            configured: Boolean(values.get(SMTP_SETTING_KEYS.host) && password && values.get(SMTP_SETTING_KEYS.username) && values.get(SMTP_SETTING_KEYS.fromEmail)),
        };
    }
    normalizeSmtpBrandText(value) {
        let normalized = String(value || '').trim();
        for (const [pattern, replacement] of LEGACY_SMTP_BRAND_REPLACEMENTS) {
            normalized = normalized.replace(pattern, replacement);
        }
        return normalized;
    }
    async sendPasswordResetEmail(input) {
        const { settings, resetUrl, to } = input;
        const transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            secure: settings.security === 'ssl',
            auth: {
                user: settings.username,
                pass: settings.password,
            },
        });
        await transporter.sendMail({
            from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
            to,
            subject: settings.subject,
            text: this.renderPasswordResetText(settings, resetUrl),
            html: this.renderPasswordResetHtml(settings, resetUrl),
        });
        return true;
    }
    renderPasswordResetText(settings, resetUrl) {
        return `${settings.heading}

${settings.intro}

Reset link:
${resetUrl}

This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.

${settings.footer}`;
    }
    renderPasswordResetHtml(settings, resetUrl) {
        const safe = (value) => this.escapeHtml(value);
        const body = `
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${safe(settings.intro)}</p>
            <a href="${safe(resetUrl)}" style="display:inline-block;border-radius:10px;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 18px;">${safe(settings.buttonLabel)}</a>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">${safe(resetUrl)}</p>`;
        return this.renderBrandEmailDocument({
            settings,
            heading: settings.heading,
            bodyHtml: body,
            footerHtml: safe(settings.footer),
        });
    }
    parseBoolean(value, fallback) {
        const normalized = String(value || '').trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'off'].includes(normalized))
            return false;
        return fallback;
    }
    decryptSettingsSecret(value) {
        const configured = String(this.configService.get('SETTINGS_ENCRYPTION_KEY') || '').trim();
        return (0, ai_provider_utils_1.decryptSecret)(value, configured || 'lms-dev-settings-key-change-me');
    }
    getGoogleClientIds() {
        return String(this.configService.get('GOOGLE_CLIENT_IDS') ||
            this.configService.get('GOOGLE_CLIENT_ID') ||
            '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    getPrimaryGoogleClientId() {
        return this.getGoogleClientIds()[0] || '';
    }
    getWebGoogleClientId() {
        const explicit = String(this.configService.get('GOOGLE_WEB_CLIENT_ID') ||
            this.configService.get('GOOGLE_CLIENT_ID') ||
            '').trim();
        return explicit || this.getPrimaryGoogleClientId();
    }
    getGoogleClientSecret() {
        return String(this.configService.get('GOOGLE_CLIENT_SECRET') || '').trim();
    }
    resolveGoogleCodeRedirectUri(rawRedirectUri) {
        const raw = String(rawRedirectUri || '').trim();
        if (!raw) {
            throw new common_1.BadRequestException('Google sign-in redirect URI is missing');
        }
        try {
            const url = new URL(raw);
            return `${url.origin}${url.pathname}`;
        }
        catch {
            throw new common_1.BadRequestException('Google sign-in redirect URI is invalid');
        }
    }
    async exchangeGoogleAuthorizationCode(code, redirectUri) {
        const clientId = this.getWebGoogleClientId();
        const clientSecret = this.getGoogleClientSecret();
        if (!clientId) {
            throw new common_1.BadRequestException('Google sign-in is not configured yet');
        }
        if (!clientSecret) {
            throw new common_1.BadRequestException('Google sign-in server secret is not configured yet');
        }
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const tokenPayload = await response.json().catch(() => ({}));
        if (!response.ok || tokenPayload.error) {
            const errorMessage = tokenPayload.error_description || tokenPayload.error || 'Google sign-in authorization code is invalid';
            this.logger.warn(`Google code exchange failed (redirect_uri=${redirectUri}): ${errorMessage}`);
            throw new common_1.UnauthorizedException(`Google sign-in failed: ${tokenPayload.error || 'invalid_code'}`);
        }
        if (!tokenPayload.id_token) {
            throw new common_1.UnauthorizedException('Google sign-in did not return an identity token');
        }
        return tokenPayload.id_token;
    }
    async verifyGoogleCredential(credential) {
        const clientIds = this.getGoogleClientIds();
        if (clientIds.length === 0) {
            throw new common_1.BadRequestException('Google sign-in is not configured yet');
        }
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        const profile = await response.json().catch(() => ({}));
        if (!response.ok || profile.error) {
            throw new common_1.UnauthorizedException('Google sign-in token is invalid');
        }
        if (!profile.aud || !clientIds.includes(String(profile.aud))) {
            throw new common_1.UnauthorizedException('Google sign-in token was issued for a different app');
        }
        if (!profile.sub || !profile.email) {
            throw new common_1.UnauthorizedException('Google account details are incomplete');
        }
        if (String(profile.email_verified).toLowerCase() !== 'true') {
            throw new common_1.UnauthorizedException('Google email address is not verified');
        }
        return profile;
    }
    getGoogleDisplayName(profile) {
        const name = String(profile.name || '').trim();
        if (name.length >= 2)
            return name.slice(0, 120);
        const composed = `${String(profile.given_name || '').trim()} ${String(profile.family_name || '').trim()}`.trim();
        if (composed.length >= 2)
            return composed.slice(0, 120);
        const emailName = String(profile.email || '').split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Google Student';
        return emailName.length >= 2 ? emailName.slice(0, 120) : 'Google Student';
    }
    async serializeUser(user) {
        const accessProfile = user.role === 'student'
            ? await this.getStudentAccessProfile(user.id)
            : {
                hasActiveSubscription: true,
                subscriptionStatus: 'active',
                currentPlanName: '',
                featureAccess: {
                    aiNotes: true,
                    advancedInsights: true,
                    practiceMode: true,
                    examMode: true,
                    aiQuizGenerator: true,
                    resultsTracking: true,
                    notesCanvasStudyMode: true,
                    performanceAnalytics: true,
                    weakAreaAnalysis: true,
                    progressTrackingBasic: true,
                    progressTrackingAdvanced: true,
                    reportQuestion: true,
                    pastPaperAccess: true,
                    mockPaperAccess: true,
                    featureKeys: [],
                },
            };
        return {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            permissions: (0, role_permissions_1.effectivePermissions)(user.role, user.permissions),
            status: user.status,
            avatarKey: user.avatar_key || '',
            hasActiveSubscription: accessProfile.hasActiveSubscription,
            subscriptionStatus: accessProfile.subscriptionStatus,
            currentPlanName: accessProfile.currentPlanName,
            featureAccess: accessProfile.featureAccess,
        };
    }
    async getStudentAccessProfile(userId) {
        const [rows] = await this.db.execute(`SELECT plans.name AS plan_name, us.status AS subscription_status
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
       WHERE us.user_id = ?
         AND us.status = 'active'
         AND us.start_date <= CURDATE()
         AND us.end_date >= CURDATE()
       ORDER BY us.end_date DESC, us.id DESC
       LIMIT 1`, [userId]);
        const row = rows[0];
        if (!row) {
            return {
                hasActiveSubscription: false,
                subscriptionStatus: 'none',
                currentPlanName: '',
                featureAccess: {
                    aiNotes: false,
                    advancedInsights: false,
                    practiceMode: false,
                    examMode: false,
                    aiQuizGenerator: false,
                    resultsTracking: false,
                    notesCanvasStudyMode: false,
                    performanceAnalytics: false,
                    weakAreaAnalysis: false,
                    progressTrackingBasic: false,
                    progressTrackingAdvanced: false,
                    reportQuestion: false,
                    pastPaperAccess: false,
                    mockPaperAccess: false,
                    featureKeys: [],
                },
            };
        }
        const featureKeys = await this.getActiveFeatureKeysForUser(userId);
        const featureAccess = this.buildFeatureAccessMap(featureKeys);
        return {
            hasActiveSubscription: true,
            subscriptionStatus: String(row.subscription_status || 'active'),
            currentPlanName: String(row.plan_name || ''),
            featureAccess,
        };
    }
    async getActiveFeatureKeysForUser(userId) {
        const [rows] = await this.db.execute(`
        SELECT us.id
        FROM user_subscriptions us
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
        LIMIT 1
      `, [userId]);
        if (rows.length === 0)
            return [];
        return Array.from(new Set(subscription_catalog_1.DEFAULT_SUBSCRIPTION_FEATURES.map((feature) => feature.featureKey)));
    }
    buildFeatureAccessMap(featureKeys) {
        const has = (featureKey) => featureKeys.includes(featureKey);
        return {
            aiNotes: has('notes_canvas_study_mode'),
            advancedInsights: has('performance_analytics') || has('weak_area_analysis') || has('progress_tracking_advanced'),
            notesAccess: has('notes_canvas_study_mode'),
            aiTools: has('ai_quiz_generator'),
            analytics: has('performance_analytics') || has('weak_area_analysis') || has('progress_tracking_advanced'),
            lessonsAccess: has('lessons_access_full') || has('lessons_access_limited') || has('notes_canvas_study_mode'),
            practiceMode: has('practice_mode'),
            examMode: has('exam_mode'),
            aiQuizGenerator: has('ai_quiz_generator'),
            resultsTracking: has('results_tracking'),
            notesCanvasStudyMode: has('notes_canvas_study_mode'),
            performanceAnalytics: has('performance_analytics'),
            weakAreaAnalysis: has('weak_area_analysis'),
            progressTrackingBasic: has('progress_tracking_basic'),
            progressTrackingAdvanced: has('progress_tracking_advanced'),
            reportQuestion: has('report_question'),
            pastPaperAccess: has('past_paper_access'),
            mockPaperAccess: has('mock_paper_access'),
            featureKeys,
        };
    }
    async assignDefaultEntryPlan(userId) {
        const [planRows] = await this.db.execute(`SELECT id
       FROM plans
       WHERE slug = 'free'
       ORDER BY id ASC
       LIMIT 1`);
        const entryPlan = planRows[0];
        if (!entryPlan) {
            return;
        }
        const startDate = new Date();
        const toDateOnly = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        await this.db.execute(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date,
          access_scope, course_ids_json, lesson_ids_json
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on signup', 'active', 'free_plan', ?, ?,
          'lessons', '[]', '[]')
      `, [userId, Number(entryPlan.id), toDateOnly(startDate), '9999-12-31']);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map