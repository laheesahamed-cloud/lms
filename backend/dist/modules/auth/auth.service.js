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
const auth_token_util_1 = require("./auth-token.util");
const role_permissions_1 = require("./role-permissions");
const ALLOWED_AVATAR_KEYS = new Set(['blue-tie', 'teal-coat', 'pink-necklace', 'violet-scarf', 'amber-coat', 'cyan-necklace']);
const PASSWORD_RESET_TTL_MINUTES = 30;
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
let AuthService = AuthService_1 = class AuthService {
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(loginDto) {
        const email = loginDto.email.trim().toLowerCase();
        const [rows] = await this.db.execute('SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [email]);
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
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const [result] = await this.db.execute('INSERT INTO users (full_name, email, password, role, status, session_token, session_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [fullName, email, hashedPassword, 'student', 'active', (0, auth_token_util_1.hashSessionToken)(sessionToken), (0, auth_token_util_1.createSessionExpiry)()]);
        await this.assignDefaultEntryPlan(result.insertId);
        return {
            ok: true,
            sessionToken,
            sessionTtlDays: auth_token_util_1.SESSION_TTL_DAYS,
            redirectPath: this.getRedirectPath('student', 'active'),
            user: await this.serializeUser({
                id: result.insertId,
                full_name: fullName,
                email,
                role: 'student',
                status: 'active',
            }),
        };
    }
    async loginWithGoogle(googleLoginDto) {
        const profile = await this.verifyGoogleCredential(googleLoginDto.credential);
        const email = String(profile.email || '').trim().toLowerCase();
        const fullName = this.getGoogleDisplayName(profile);
        const [rows] = await this.db.execute('SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [email]);
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
    canExposeDevResetToken(shouldSendEmail) {
        const nodeEnv = this.configService.get('NODE_ENV') || 'development';
        const exposeDevResetToken = String(this.configService.get('EXPOSE_DEV_RESET_TOKEN') || '').toLowerCase() === 'true';
        return nodeEnv !== 'production' && !shouldSendEmail && exposeDevResetToken;
    }
    async requestPasswordReset(forgotPasswordDto) {
        const email = forgotPasswordDto.email.trim().toLowerCase();
        const [rows] = await this.db.execute('SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [email]);
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
        const [rows] = await this.db.execute(`SELECT id, full_name, email, password, role, status, avatar_key, session_token, session_expires_at
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
            fromName: values.get(SMTP_SETTING_KEYS.fromName) || 'xyndrome',
            fromEmail: values.get(SMTP_SETTING_KEYS.fromEmail) || '',
            publicUrl,
            subject: values.get(SMTP_SETTING_KEYS.subject) || 'Reset your xyndrome password',
            heading: values.get(SMTP_SETTING_KEYS.heading) || 'Reset your password',
            intro: values.get(SMTP_SETTING_KEYS.intro) || 'We received a request to reset your xyndrome password.',
            buttonLabel: values.get(SMTP_SETTING_KEYS.buttonLabel) || 'Reset password',
            footer: values.get(SMTP_SETTING_KEYS.footer) || 'If you did not request this, you can safely ignore this email.',
            configured: Boolean(values.get(SMTP_SETTING_KEYS.host) && password && values.get(SMTP_SETTING_KEYS.username) && values.get(SMTP_SETTING_KEYS.fromEmail)),
        };
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
        const safe = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char] || char));
        return `
      <div style="margin:0;padding:32px;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ef;border-radius:18px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,.10);">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#2563EB,#14B8A6);color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">xyndrome</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;">${safe(settings.heading)}</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${safe(settings.intro)}</p>
            <a href="${safe(resetUrl)}" style="display:inline-block;border-radius:10px;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 18px;">${safe(settings.buttonLabel)}</a>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">${safe(resetUrl)}</p>
          </div>
          <div style="border-top:1px solid #e2e8f0;padding:18px 28px;font-size:12px;line-height:1.6;color:#64748b;background:#f8fafc;">${safe(settings.footer)}</div>
        </div>
      </div>
    `;
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
            permissions: (0, role_permissions_1.permissionsForRole)(user.role),
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
        SELECT sf.feature_key
        FROM user_subscriptions us
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
      `, [userId]);
        return Array.from(new Set(rows.map((row) => String(row.feature_key || '').trim()).filter(Boolean)));
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
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on signup', 'active', 'free_plan', ?, ?)
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