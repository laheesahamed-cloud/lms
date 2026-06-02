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
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const ai_provider_utils_1 = require("../../common/utils/ai-provider.utils");
const WHATSAPP_NUMBER_SETTING_KEY = 'contact_whatsapp_number';
const LANDING_PAGE_SETTING_KEY = 'landing_page_content';
const AVAILABILITY_MODE_SETTING_KEY = 'site_availability_mode';
const AVAILABILITY_UNLOCK_CODE_SETTING_KEY = 'site_availability_unlock_code';
const AVAILABILITY_MODES = ['live', 'maintenance', 'coming-soon'];
const DEFAULT_AVAILABILITY_UNLOCK_CODE = '1122334455';
const DEFAULT_LANDING_PAGE_CONTENT = {
    metaTitle: 'Medical Study Platform',
    metaDescription: 'xyndrome helps medical students study with structured lessons, Q-Bank practice, exams, revision notes, bookmarks, subscriptions, and progress analytics.',
    heroKicker: 'Built for medical students in Sri Lanka',
    heroTitleLine1: 'The smarter way to',
    heroTitleAccent: 'prepare for',
    heroTitleLine3: 'medical exams.',
    heroSubtitle: 'Interactive lessons, timed quizzes, and performance analytics in one focused workspace for serious medical revision.',
    heroPrimaryLabel: 'Start Studying Free',
    heroSecondaryLabel: 'Explore Platform',
    featuresEyebrow: 'Platform Features',
    featuresTitle: 'The full study loop, not just a pile of MCQs.',
    featuresText: 'Read, revise, practise, and review - inside one calm academic workspace built for medical preparation.',
    howEyebrow: 'Getting Started',
    howTitle: 'Up and revising in three steps.',
    howText: 'No complicated setup. Sign up and start revising your medical subjects today.',
    whyEyebrow: 'Why Choose Us',
    whyTitle: 'More than just another MCQ bank.',
    whyText: 'While others give you a flat list of questions, we give you the full study experience - structured, visual, and data-driven.',
    testimonialsEyebrow: 'Student Stories',
    testimonialsTitle: 'What medical students say.',
    testimonialsText: 'Real feedback from students across Sri Lanka using the platform for their revision.',
    faqEyebrow: 'FAQ',
    faqTitle: 'Questions students usually ask first.',
    faqText: 'Clear answers about how the platform works before you start your revision journey.',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Transparent plans for Sri Lankan students.',
    pricingText: 'No hidden fees. Choose the plan that fits your exam timeline and study intensity.',
    customPlanTitle: 'Need a customized subscription?',
    customPlanText: 'Create a package around your courses, study timeline, and exam goals.',
    ctaEyebrow: 'Ready to begin?',
    ctaTitle: 'Join the most complete medical study platform in Sri Lanka.',
    ctaText: 'Interactive lessons, a full quiz engine, and performance tracking - everything you need to walk into your examination with confidence.',
    ctaPrimaryLabel: 'Create Free Account',
    ctaSecondaryLabel: 'Sign In',
    footerText: 'A focused study platform for medical students in Sri Lanka - notes, quizzes, and analytics in one place.',
    footerTagline: 'Built for Sri Lankan medical education.',
};
const PAYMENT_SETTING_KEYS = {
    enabled: 'payment_payhere_enabled',
    sandboxMode: 'payment_payhere_sandbox_mode',
    merchantId: 'payment_payhere_merchant_id',
    merchantSecret: 'payment_payhere_merchant_secret',
    currency: 'payment_payhere_currency',
    returnUrl: 'payment_payhere_return_url',
    cancelUrl: 'payment_payhere_cancel_url',
    notifyUrl: 'payment_payhere_notify_url',
    checkoutTitle: 'payment_payhere_checkout_title',
    buttonLabel: 'payment_payhere_button_label',
    supportText: 'payment_payhere_support_text',
    autoActivatePaidSubscriptions: 'payment_payhere_auto_activate_paid_subscriptions',
};
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
const POPUP_ALERT_SETTING_KEYS = {
    enabled: 'popup_alert_enabled',
    placement: 'popup_alert_placement',
    title: 'popup_alert_title',
    body: 'popup_alert_body',
    buttonLabel: 'popup_alert_button_label',
    buttonUrl: 'popup_alert_button_url',
    imageUrl: 'popup_alert_image_url',
    imageAlt: 'popup_alert_image_alt',
    imageFileName: 'popup_alert_image_file_name',
    imageWidth: 'popup_alert_image_width',
    imageHeight: 'popup_alert_image_height',
    imageBytes: 'popup_alert_image_bytes',
    version: 'popup_alert_version',
};
const POPUP_ALERT_MAX_IMAGE_BYTES = 2_000_000;
const POPUP_ALERT_ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const APNS_SETTING_KEYS = {
    keyId: 'apns_key_id',
    teamId: 'apns_team_id',
    bundleId: 'apns_bundle_id',
    useSandbox: 'apns_use_sandbox',
    privateKeyPath: 'apns_private_key_path',
    privateKey: 'apns_private_key',
};
const FCM_SETTING_KEYS = {
    projectId: 'fcm_project_id',
    serverKey: 'fcm_server_key',
    serviceAccountPath: 'fcm_service_account_path',
    serviceAccountJson: 'fcm_service_account_json',
};
let SettingsService = SettingsService_1 = class SettingsService {
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
        this.logger = new common_1.Logger(SettingsService_1.name);
        this.publicSettingsCache = null;
        this.publicAvailabilityCache = null;
    }
    clearPublicSettingsCache() {
        this.publicSettingsCache = null;
        this.publicAvailabilityCache = null;
    }
    async getGeneralSettings() {
        const whatsappNumber = await this.getSettingValue(WHATSAPP_NUMBER_SETTING_KEY);
        return {
            ok: true,
            whatsappNumber,
            whatsappUrl: this.toWhatsAppUrl(whatsappNumber),
            note: 'These lightweight system preferences are saved inside the LMS database and can be updated without changing environment files.',
        };
    }
    async getLandingPageSettings() {
        return {
            ok: true,
            content: await this.getLandingPageContent(),
            defaults: DEFAULT_LANDING_PAGE_CONTENT,
            note: 'Landing page text is stored in the LMS database. Visitors see saved edits without rebuilding the frontend.',
        };
    }
    async getAvailabilitySettings() {
        const [mode, unlockCode] = await Promise.all([
            this.getAvailabilityMode(),
            this.getAvailabilityUnlockCode(),
        ]);
        return {
            ok: true,
            ...this.serializeAvailabilitySettings(mode),
            unlockCode,
            unlockCodeLength: unlockCode.length,
            previewPaths: {
                maintenance: '/launch-preview/maintenance',
                comingSoon: '/launch-preview/coming-soon',
            },
            note: 'Maintenance mode pauses the public website, student app, and native shells. Coming Soon only covers the public website. Admins enter the secret code on the launch screen, then sign in with their admin account.',
        };
    }
    async getPublicSettings() {
        const now = Date.now();
        if (this.publicSettingsCache && this.publicSettingsCache.expiresAt > now) {
            return this.publicSettingsCache.value;
        }
        const value = await this.buildPublicSettings();
        this.publicSettingsCache = { expiresAt: now + 15_000, value };
        return value;
    }
    async getPublicAvailabilitySettings() {
        const now = Date.now();
        if (this.publicAvailabilityCache && this.publicAvailabilityCache.expiresAt > now) {
            return {
                ok: true,
                availability: this.publicAvailabilityCache.value,
            };
        }
        const availability = this.serializeAvailabilitySettings(await this.getAvailabilityMode());
        this.publicAvailabilityCache = { expiresAt: now + 5_000, value: availability };
        return {
            ok: true,
            availability,
        };
    }
    async buildPublicSettings() {
        const values = await this.getSettingMap([
            WHATSAPP_NUMBER_SETTING_KEY,
            LANDING_PAGE_SETTING_KEY,
            AVAILABILITY_MODE_SETTING_KEY,
            ...Object.values(POPUP_ALERT_SETTING_KEYS),
        ]);
        const whatsappNumber = values.get(WHATSAPP_NUMBER_SETTING_KEY) || '';
        const popupAlert = this.getRawPopupAlertSettingsFromValues(values);
        return {
            ok: true,
            whatsappUrl: this.toWhatsAppUrl(whatsappNumber),
            landingPage: this.getLandingPageContentFromRaw(values.get(LANDING_PAGE_SETTING_KEY) || ''),
            popupAlert: this.serializePublicPopupAlertSettings(popupAlert),
            availability: this.serializeAvailabilitySettings(this.normalizeAvailabilityMode(values.get(AVAILABILITY_MODE_SETTING_KEY), 'live')),
            auth: this.getPublicAuthSettings(),
        };
    }
    getPublicAuthSettings() {
        const googleClientId = this.getPublicGoogleClientId();
        return {
            googleClientId,
            googleConfigured: Boolean(googleClientId),
        };
    }
    getPublicGoogleClientId() {
        const primaryClientId = String(this.configService.get('GOOGLE_CLIENT_ID') || '').trim();
        if (primaryClientId)
            return primaryClientId;
        return String(this.configService.get('GOOGLE_CLIENT_IDS') || '')
            .split(',')
            .map((clientId) => clientId.trim())
            .find(Boolean) || '';
    }
    async updateGeneralSettings(input) {
        const whatsappNumber = this.normalizeWhatsAppNumber(input.whatsappNumber);
        await this.saveSettingValue(WHATSAPP_NUMBER_SETTING_KEY, whatsappNumber);
        this.clearPublicSettingsCache();
        return this.getGeneralSettings();
    }
    async updateLandingPageSettings(input) {
        const current = await this.getLandingPageContent();
        const next = this.normalizeLandingPageContent({ ...current, ...input });
        await this.saveSettingValue(LANDING_PAGE_SETTING_KEY, JSON.stringify(next));
        this.clearPublicSettingsCache();
        return this.getLandingPageSettings();
    }
    async updateAvailabilitySettings(input) {
        if (input.mode !== undefined) {
            await this.saveSettingValue(AVAILABILITY_MODE_SETTING_KEY, this.normalizeAvailabilityMode(input.mode));
            this.clearPublicSettingsCache();
        }
        if (input.unlockCode !== undefined) {
            await this.saveSettingValue(AVAILABILITY_UNLOCK_CODE_SETTING_KEY, this.normalizeAvailabilityUnlockCode(input.unlockCode));
        }
        return this.getAvailabilitySettings();
    }
    async verifyAvailabilityUnlock(input) {
        const submittedCode = this.normalizeAvailabilityUnlockAttempt(input.code);
        const unlockCode = await this.getAvailabilityUnlockCode();
        return {
            ok: submittedCode.endsWith(unlockCode),
            adminLoginPath: '/auth/login?admin=1&from=%2Fadmin%2Fsettings',
        };
    }
    async getPaymentSettings() {
        const settings = await this.getRawPaymentSettings();
        return {
            ok: true,
            provider: 'payhere',
            actionUrl: this.getPayHereCheckoutUrl(settings.sandboxMode),
            ...this.serializePaymentSettings(settings, true),
            note: 'PayHere is configured for hosted checkout. Merchant secrets stay encrypted in the LMS database and are only used on the server to generate and verify hashes.',
        };
    }
    async getSmtpSettings() {
        const settings = await this.getRawSmtpSettings();
        return {
            ok: true,
            ...this.serializeSmtpSettings(settings),
            note: 'SMTP credentials are stored encrypted in the LMS database. Password reset emails are sent only when SMTP is enabled and configured.',
        };
    }
    async getPopupAlertSettings() {
        const settings = await this.getRawPopupAlertSettings();
        return {
            ok: true,
            ...this.serializePopupAlertSettings(settings),
            recommendedImage: {
                width: 1200,
                height: 675,
                maxBytes: POPUP_ALERT_MAX_IMAGE_BYTES,
                formats: ['JPG', 'PNG', 'WEBP'],
            },
            note: 'Popup alerts can be shown on the landing page, login page, inside the app, or everywhere. Images are stored as public marketing assets.',
        };
    }
    async getApnsSettings() {
        const settings = await this.getRawApnsSettings();
        return {
            ok: true,
            ...this.serializeApnsSettings(settings),
            note: 'APNs credentials are stored encrypted in the LMS database. Use sandbox for simulator/debug builds and production for TestFlight/App Store builds.',
        };
    }
    async getFcmSettings() {
        const settings = await this.getRawFcmSettings();
        return {
            ok: true,
            ...this.serializeFcmSettings(settings),
            note: 'FCM credentials are stored encrypted in the LMS database. Use a Firebase service account JSON for current FCM HTTP v1 delivery.',
        };
    }
    async getStudentPaymentSettings() {
        const settings = await this.getRawPaymentSettings();
        return this.serializePaymentSettings(settings, false);
    }
    async getPayHereCheckoutSettings() {
        return this.getRawPaymentSettings();
    }
    async updatePaymentSettings(input) {
        const current = await this.getRawPaymentSettings();
        const next = {
            enabled: input.enabled ?? current.enabled,
            sandboxMode: input.sandboxMode ?? current.sandboxMode,
            merchantId: input.merchantId !== undefined ? this.normalizeOptionalValue(input.merchantId) : current.merchantId,
            merchantSecret: input.merchantSecret !== undefined
                ? this.normalizeSecretInput(input.merchantSecret) || current.merchantSecret
                : current.merchantSecret,
            currency: 'LKR',
            returnUrl: input.returnUrl !== undefined ? this.normalizeOptionalValue(input.returnUrl) : current.returnUrl,
            cancelUrl: input.cancelUrl !== undefined ? this.normalizeOptionalValue(input.cancelUrl) : current.cancelUrl,
            notifyUrl: input.notifyUrl !== undefined ? this.normalizeOptionalValue(input.notifyUrl) : current.notifyUrl,
            checkoutTitle: input.checkoutTitle !== undefined
                ? this.normalizeOptionalValue(input.checkoutTitle) || 'xyndrome subscription'
                : current.checkoutTitle,
            buttonLabel: input.buttonLabel !== undefined
                ? this.normalizeOptionalValue(input.buttonLabel) || 'Pay with PayHere'
                : current.buttonLabel,
            supportText: input.supportText !== undefined
                ? this.normalizeOptionalValue(input.supportText)
                : current.supportText,
            autoActivatePaidSubscriptions: input.autoActivatePaidSubscriptions ?? current.autoActivatePaidSubscriptions,
        };
        await Promise.all([
            this.saveSettingValue(PAYMENT_SETTING_KEYS.enabled, next.enabled ? 'true' : 'false'),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.sandboxMode, next.sandboxMode ? 'true' : 'false'),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.merchantId, next.merchantId),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.merchantSecret, this.encryptSecret(next.merchantSecret)),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.currency, next.currency),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.returnUrl, next.returnUrl),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.cancelUrl, next.cancelUrl),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.notifyUrl, next.notifyUrl),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.checkoutTitle, next.checkoutTitle),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.buttonLabel, next.buttonLabel),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.supportText, next.supportText),
            this.saveSettingValue(PAYMENT_SETTING_KEYS.autoActivatePaidSubscriptions, next.autoActivatePaidSubscriptions ? 'true' : 'false'),
        ]);
        return this.getPaymentSettings();
    }
    async updateSmtpSettings(input) {
        const current = await this.getRawSmtpSettings();
        const next = {
            enabled: input.enabled ?? current.enabled,
            host: input.host !== undefined ? this.normalizeOptionalValue(input.host) : current.host,
            port: Number(input.port || current.port || 587),
            security: input.security === 'ssl' ? 'ssl' : input.security === 'starttls' ? 'starttls' : current.security,
            username: input.username !== undefined ? this.normalizeOptionalValue(input.username) : current.username,
            password: input.password !== undefined
                ? this.normalizeSecretInput(input.password) || current.password
                : current.password,
            fromName: input.fromName !== undefined ? this.normalizeSmtpBrandText(this.normalizeOptionalValue(input.fromName)) || 'xyndrome' : current.fromName,
            fromEmail: input.fromEmail !== undefined ? this.normalizeOptionalValue(input.fromEmail) : current.fromEmail,
            publicUrl: input.publicUrl !== undefined ? this.normalizeOptionalValue(input.publicUrl) : current.publicUrl,
            subject: input.subject !== undefined
                ? this.normalizeSmtpBrandText(this.normalizeOptionalValue(input.subject)) || 'Reset your xyndrome password'
                : current.subject,
            heading: input.heading !== undefined
                ? this.normalizeSmtpBrandText(this.normalizeOptionalValue(input.heading)) || 'Reset your password'
                : current.heading,
            intro: input.intro !== undefined
                ? this.normalizeSmtpBrandText(this.normalizeOptionalValue(input.intro)) || 'We received a request to reset your xyndrome password.'
                : current.intro,
            buttonLabel: input.buttonLabel !== undefined
                ? this.normalizeOptionalValue(input.buttonLabel) || 'Reset password'
                : current.buttonLabel,
            footer: input.footer !== undefined
                ? this.normalizeSmtpBrandText(this.normalizeOptionalValue(input.footer)) || 'If you did not request this, you can safely ignore this email.'
                : current.footer,
        };
        await Promise.all([
            this.saveSettingValue(SMTP_SETTING_KEYS.enabled, next.enabled ? 'true' : 'false'),
            this.saveSettingValue(SMTP_SETTING_KEYS.host, next.host),
            this.saveSettingValue(SMTP_SETTING_KEYS.port, String(next.port || 587)),
            this.saveSettingValue(SMTP_SETTING_KEYS.security, next.security),
            this.saveSettingValue(SMTP_SETTING_KEYS.username, next.username),
            this.saveSettingValue(SMTP_SETTING_KEYS.password, this.encryptSecret(next.password)),
            this.saveSettingValue(SMTP_SETTING_KEYS.fromName, next.fromName),
            this.saveSettingValue(SMTP_SETTING_KEYS.fromEmail, next.fromEmail),
            this.saveSettingValue(SMTP_SETTING_KEYS.publicUrl, next.publicUrl),
            this.saveSettingValue(SMTP_SETTING_KEYS.subject, next.subject),
            this.saveSettingValue(SMTP_SETTING_KEYS.heading, next.heading),
            this.saveSettingValue(SMTP_SETTING_KEYS.intro, next.intro),
            this.saveSettingValue(SMTP_SETTING_KEYS.buttonLabel, next.buttonLabel),
            this.saveSettingValue(SMTP_SETTING_KEYS.footer, next.footer),
        ]);
        return this.getSmtpSettings();
    }
    async sendSmtpTestEmail(toEmail) {
        const settings = await this.getRawSmtpSettings();
        if (!settings.enabled) {
            throw new common_1.BadRequestException('Enable SMTP before sending a test email.');
        }
        if (!settings.host || !settings.port || !settings.username || !settings.password || !settings.fromEmail) {
            throw new common_1.BadRequestException('Save SMTP host, port, username, password, and sender email before sending a test email.');
        }
        const sentAt = new Date();
        const transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            secure: settings.security === 'ssl',
            auth: {
                user: settings.username,
                pass: settings.password,
            },
        });
        const subject = 'xyndrome SMTP test email';
        const text = [
            'SMTP test email',
            '',
            'Your xyndrome SMTP settings can send email successfully.',
            `Sent at: ${sentAt.toISOString()}`,
            `From: ${settings.fromName} <${settings.fromEmail}>`,
        ].join('\n');
        try {
            await transporter.sendMail({
                from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
                to: String(toEmail || '').trim().toLowerCase(),
                subject,
                text,
                html: this.renderSmtpTestHtml(settings, sentAt),
            });
        }
        catch (error) {
            const errorCode = String(error?.code || error?.responseCode || error?.name || 'smtp_test_error');
            this.logger.warn(`SMTP test email failed: ${errorCode}`);
            throw new common_1.BadGatewayException('SMTP test email failed. Check host, port, security, username, password, and sender email.');
        }
        return {
            ok: true,
            message: `Test email sent to ${String(toEmail || '').trim().toLowerCase()}.`,
            sentAt: sentAt.toISOString(),
        };
    }
    async updatePopupAlertSettings(input) {
        const current = await this.getRawPopupAlertSettings();
        const uploadedImage = input.imageDataUrl
            ? await this.savePopupAlertImage(input.imageDataUrl)
            : null;
        const explicitImageUrl = input.imageUrl !== undefined ? this.normalizeOptionalValue(input.imageUrl) : current.imageUrl;
        const imageUrl = uploadedImage?.imageUrl || explicitImageUrl;
        const imageFileName = uploadedImage?.imageFileName ||
            (input.imageUrl !== undefined && !explicitImageUrl ? '' : current.imageFileName);
        const next = {
            enabled: input.enabled ?? current.enabled,
            placement: this.normalizePopupPlacement(input.placement || current.placement),
            title: input.title !== undefined ? this.normalizeOptionalValue(input.title).slice(0, 120) : current.title,
            body: input.body !== undefined ? this.normalizeOptionalValue(input.body).slice(0, 900) : current.body,
            buttonLabel: '',
            buttonUrl: '',
            imageUrl,
            imageAlt: input.imageAlt !== undefined ? this.normalizeOptionalValue(input.imageAlt).slice(0, 160) : current.imageAlt,
            imageFileName,
            imageWidth: uploadedImage?.imageWidth ?? Number(input.imageWidth ?? current.imageWidth ?? 0),
            imageHeight: uploadedImage?.imageHeight ?? Number(input.imageHeight ?? current.imageHeight ?? 0),
            imageBytes: uploadedImage?.imageBytes ?? Number(input.imageBytes ?? current.imageBytes ?? 0),
            version: String(Date.now()),
        };
        if (next.enabled && !next.imageUrl) {
            throw new common_1.BadRequestException('Add a popup image before enabling the alert');
        }
        await Promise.all([
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.enabled, next.enabled ? 'true' : 'false'),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.placement, next.placement),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.title, next.title),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.body, next.body),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.buttonLabel, next.buttonLabel),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.buttonUrl, next.buttonUrl),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageUrl, next.imageUrl),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageAlt, next.imageAlt),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageFileName, next.imageFileName),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageWidth, String(next.imageWidth || 0)),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageHeight, String(next.imageHeight || 0)),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.imageBytes, String(next.imageBytes || 0)),
            this.saveSettingValue(POPUP_ALERT_SETTING_KEYS.version, next.version),
        ]);
        this.clearPublicSettingsCache();
        return this.getPopupAlertSettings();
    }
    async updateApnsSettings(input) {
        const current = await this.getRawApnsSettings();
        const next = {
            keyId: input.keyId !== undefined ? this.normalizeOptionalValue(input.keyId) : current.keyId,
            teamId: input.teamId !== undefined ? this.normalizeOptionalValue(input.teamId) : current.teamId,
            bundleId: input.bundleId !== undefined ? this.normalizeOptionalValue(input.bundleId) || 'com.erpm.medical.lms' : current.bundleId,
            useSandbox: input.useSandbox ?? current.useSandbox,
            privateKeyPath: input.privateKeyPath !== undefined ? this.normalizeOptionalValue(input.privateKeyPath) : current.privateKeyPath,
            privateKey: input.privateKey !== undefined
                ? this.normalizeSecretInput(input.privateKey) || current.privateKey
                : current.privateKey,
        };
        await Promise.all([
            this.saveSettingValue(APNS_SETTING_KEYS.keyId, next.keyId),
            this.saveSettingValue(APNS_SETTING_KEYS.teamId, next.teamId),
            this.saveSettingValue(APNS_SETTING_KEYS.bundleId, next.bundleId),
            this.saveSettingValue(APNS_SETTING_KEYS.useSandbox, next.useSandbox ? 'true' : 'false'),
            this.saveSettingValue(APNS_SETTING_KEYS.privateKeyPath, next.privateKeyPath),
            this.saveSettingValue(APNS_SETTING_KEYS.privateKey, this.encryptSecret(next.privateKey)),
        ]);
        return this.getApnsSettings();
    }
    async updateFcmSettings(input) {
        const current = await this.getRawFcmSettings();
        const next = {
            projectId: input.projectId !== undefined ? this.normalizeOptionalValue(input.projectId) : current.projectId,
            serverKey: input.serverKey !== undefined
                ? this.normalizeSecretInput(input.serverKey) || current.serverKey
                : current.serverKey,
            serviceAccountPath: input.serviceAccountPath !== undefined ? this.normalizeOptionalValue(input.serviceAccountPath) : current.serviceAccountPath,
            serviceAccountJson: input.serviceAccountJson !== undefined
                ? this.normalizeSecretInput(input.serviceAccountJson) || current.serviceAccountJson
                : current.serviceAccountJson,
        };
        await Promise.all([
            this.saveSettingValue(FCM_SETTING_KEYS.projectId, next.projectId),
            this.saveSettingValue(FCM_SETTING_KEYS.serverKey, this.encryptSecret(next.serverKey)),
            this.saveSettingValue(FCM_SETTING_KEYS.serviceAccountPath, next.serviceAccountPath),
            this.saveSettingValue(FCM_SETTING_KEYS.serviceAccountJson, this.encryptSecret(next.serviceAccountJson)),
        ]);
        return this.getFcmSettings();
    }
    async getAiProviderSettings() {
        const providers = await this.listAiProviders();
        const activeProvider = providers.find((provider) => provider.isActive) || null;
        const lessonProviderConfigured = providers.some((provider) => provider.status === 'active' && provider.hasApiKey) ||
            Boolean(String(this.configService.get('OPENROUTER_API_KEY') || '').trim());
        const encryptionKeyConfigured = Boolean(String(this.configService.get('SETTINGS_ENCRYPTION_KEY') || '').trim());
        return {
            ok: true,
            providers,
            activeProviderId: activeProvider?.id || null,
            activeProvider,
            lessonProviderConfigured,
            availableProviders: Object.entries(ai_provider_utils_1.AI_PROVIDER_LABELS).map(([providerKey, label]) => ({
                providerKey,
                label,
                defaultModel: (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey),
                modeOptions: ai_provider_utils_1.AI_PROVIDER_MODE_OPTIONS[providerKey] || [],
            })),
            note: 'Only the active provider powers AI-generated pages. Secrets are stored encrypted in the LMS database and returned to the dashboard in masked form only.',
            encryptionStatus: encryptionKeyConfigured
                ? 'Configured from SETTINGS_ENCRYPTION_KEY.'
                : 'Using the development fallback secret. Set SETTINGS_ENCRYPTION_KEY before production deployment.',
        };
    }
    async createAiProvider(input) {
        const providerKey = this.normalizeProviderKey(input.providerKey);
        const providerLabel = this.normalizeOptionalValue(input.providerLabel) || ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey];
        const apiKey = this.normalizeSecretInput(input.apiKey);
        const apiCode = this.normalizeSecretInput(input.runCode ?? input.apiCode);
        const baseUrl = (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(providerKey, input.baseUrl);
        const model = this.normalizeOptionalValue(input.model) || (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey);
        const status = input.status === 'inactive' ? 'inactive' : 'active';
        const isActive = Boolean(input.isActive);
        if (!providerLabel) {
            throw new common_1.BadRequestException('Provider label is required');
        }
        await this.db.execute(`
        INSERT INTO ai_provider_configs (
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, [
            providerKey,
            providerLabel,
            this.encryptSecret(apiKey),
            this.encryptSecret(apiCode),
            baseUrl,
            model,
            status,
        ]);
        const [rows] = await this.db.execute('SELECT LAST_INSERT_ID() AS id');
        const insertedId = Number(rows[0]?.id || 0);
        if (isActive || (status === 'active' && (await this.countActiveAiProviders()) === 0)) {
            await this.setActiveAiProvider(insertedId);
        }
        return this.getAiProviderSettings();
    }
    async testAiProvider(input) {
        const providerKey = this.normalizeProviderKey(input.providerKey);
        const apiKey = this.normalizeSecretInput(input.apiKey);
        if (!apiKey) {
            throw new common_1.BadRequestException('Paste an API key before testing the provider.');
        }
        const modeOptions = await this.runProviderConnectionTest(providerKey, apiKey);
        const normalizedOptions = modeOptions.length > 0 ? modeOptions : ai_provider_utils_1.AI_PROVIDER_MODE_OPTIONS[providerKey] || [];
        return {
            ok: true,
            providerKey,
            providerLabel: ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey],
            message: `${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} accepted the API key.`,
            modeOptions: normalizedOptions,
            defaultModel: normalizedOptions[0] || (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey),
            testedAt: new Date().toISOString(),
        };
    }
    async updateAiProvider(id, input) {
        const current = await this.getAiProviderRowOrThrow(id);
        const providerKey = input.providerKey ? this.normalizeProviderKey(input.providerKey) : this.normalizeProviderKey(current.provider_key);
        const providerLabel = input.providerLabel !== undefined
            ? this.normalizeOptionalValue(input.providerLabel) || ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]
            : current.provider_label;
        const baseUrl = input.baseUrl !== undefined
            ? (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(providerKey, input.baseUrl)
            : (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(providerKey, current.base_url);
        const model = input.model !== undefined
            ? this.normalizeOptionalValue(input.model) || (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey)
            : String(current.model || '').trim();
        const status = input.status === 'inactive' ? 'inactive' : input.status === 'active' ? 'active' : current.status;
        const nextApiKey = input.apiKey !== undefined ? this.normalizeSecretInput(input.apiKey) : '';
        const nextApiCode = input.runCode !== undefined || input.apiCode !== undefined
            ? this.normalizeSecretInput(input.runCode ?? input.apiCode)
            : '';
        const apiKeyEncrypted = input.apiKey !== undefined && nextApiKey
            ? this.encryptSecret(nextApiKey)
            : String(current.api_key_encrypted || '');
        const apiCodeEncrypted = (input.runCode !== undefined || input.apiCode !== undefined) && nextApiCode
            ? this.encryptSecret(nextApiCode)
            : String(current.api_code_encrypted || '');
        await this.db.execute(`
        UPDATE ai_provider_configs
        SET provider_key = ?,
            provider_label = ?,
            api_key_encrypted = ?,
            api_code_encrypted = ?,
            base_url = ?,
            model = ?,
            status = ?
        WHERE id = ?
      `, [providerKey, providerLabel, apiKeyEncrypted, apiCodeEncrypted, baseUrl, model, status, id]);
        if (input.isActive) {
            await this.setActiveAiProvider(id);
        }
        else if (status === 'inactive' && current.is_active) {
            await this.db.execute(`UPDATE ai_provider_configs SET is_active = 0 WHERE id = ?`, [id]);
            await this.activateFallbackProvider(id);
        }
        return this.getAiProviderSettings();
    }
    async activateAiProvider(id) {
        await this.getAiProviderRowOrThrow(id);
        await this.setActiveAiProvider(id);
        return this.getAiProviderSettings();
    }
    async deleteAiProvider(id) {
        const current = await this.getAiProviderRowOrThrow(id);
        await this.db.execute(`DELETE FROM ai_provider_configs WHERE id = ?`, [id]);
        if (current.is_active) {
            await this.activateFallbackProvider(id);
        }
        return this.getAiProviderSettings();
    }
    async getSettingValue(settingKey) {
        const [rows] = await this.db.execute(`
        SELECT setting_key, setting_value, updated_at
        FROM system_settings
        WHERE setting_key = ?
        LIMIT 1
      `, [settingKey]);
        return rows[0]?.setting_value?.trim() || '';
    }
    async getSettingMap(settingKeys) {
        if (settingKeys.length === 0) {
            return new Map();
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(settingKeys);
        const [rows] = await this.db.execute(`
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN (${placeholders})
      `, settingKeys);
        return new Map(rows.map((row) => [String(row.setting_key), String(row.setting_value || '').trim()]));
    }
    async getLandingPageContent() {
        return this.getLandingPageContentFromRaw(await this.getSettingValue(LANDING_PAGE_SETTING_KEY));
    }
    getLandingPageContentFromRaw(raw) {
        if (!raw) {
            return this.normalizeLandingPageContent({});
        }
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return this.normalizeLandingPageContent({});
            }
            return this.normalizeLandingPageContent(parsed);
        }
        catch {
            return this.normalizeLandingPageContent({});
        }
    }
    normalizeLandingPageContent(input) {
        const next = {};
        const maxByKey = {
            metaTitle: 80,
            metaDescription: 220,
            heroKicker: 90,
            heroSubtitle: 260,
            featuresText: 260,
            howText: 260,
            whyText: 260,
            testimonialsText: 260,
            faqText: 260,
            pricingText: 260,
            customPlanText: 220,
            ctaText: 280,
            footerText: 220,
            footerTagline: 120,
        };
        Object.keys(DEFAULT_LANDING_PAGE_CONTENT).forEach((key) => {
            const fallback = DEFAULT_LANDING_PAGE_CONTENT[key];
            const value = String(input[key] ?? fallback).trim() || fallback;
            const max = maxByKey[key] || 120;
            next[key] = value.slice(0, max);
        });
        return next;
    }
    async getAvailabilityMode() {
        return this.normalizeAvailabilityMode(await this.getSettingValue(AVAILABILITY_MODE_SETTING_KEY), 'live');
    }
    async getAvailabilityUnlockCode() {
        const value = await this.getSettingValue(AVAILABILITY_UNLOCK_CODE_SETTING_KEY);
        return value ? this.normalizeAvailabilityUnlockCode(value) : DEFAULT_AVAILABILITY_UNLOCK_CODE;
    }
    normalizeAvailabilityMode(value, fallback) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/_/g, '-');
        if (AVAILABILITY_MODES.includes(normalized)) {
            return normalized;
        }
        if (fallback) {
            return fallback;
        }
        throw new common_1.BadRequestException('Unsupported availability mode');
    }
    serializeAvailabilitySettings(mode) {
        return {
            mode,
            isLive: mode === 'live',
            isMaintenance: mode === 'maintenance',
            isComingSoon: mode === 'coming-soon',
            scope: mode === 'maintenance' ? 'all' : mode === 'coming-soon' ? 'website' : 'none',
        };
    }
    normalizeAvailabilityUnlockCode(value) {
        const code = String(value || '').trim();
        if (!/^\d{4,20}$/.test(code)) {
            throw new common_1.BadRequestException('Unlock code must be 4 to 20 digits');
        }
        return code;
    }
    normalizeAvailabilityUnlockAttempt(value) {
        return String(value || '').replace(/\D/g, '').slice(-40);
    }
    async getRawPaymentSettings() {
        const values = await this.getSettingMap(Object.values(PAYMENT_SETTING_KEYS));
        const encryptedMerchantSecret = values.get(PAYMENT_SETTING_KEYS.merchantSecret) || '';
        const currency = 'LKR';
        return {
            enabled: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.enabled), false),
            sandboxMode: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.sandboxMode), true),
            merchantId: values.get(PAYMENT_SETTING_KEYS.merchantId) || '',
            merchantSecret: encryptedMerchantSecret ? this.decryptSecret(encryptedMerchantSecret) : '',
            currency,
            returnUrl: values.get(PAYMENT_SETTING_KEYS.returnUrl) || '',
            cancelUrl: values.get(PAYMENT_SETTING_KEYS.cancelUrl) || '',
            notifyUrl: values.get(PAYMENT_SETTING_KEYS.notifyUrl) || '',
            checkoutTitle: values.get(PAYMENT_SETTING_KEYS.checkoutTitle) || 'xyndrome subscription',
            buttonLabel: values.get(PAYMENT_SETTING_KEYS.buttonLabel) || 'Pay with PayHere',
            supportText: values.get(PAYMENT_SETTING_KEYS.supportText) ||
                'Sandbox payments are simulated by PayHere and no real card will be charged.',
            autoActivatePaidSubscriptions: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.autoActivatePaidSubscriptions), true),
        };
    }
    async getRawSmtpSettings() {
        const values = await this.getSettingMap(Object.values(SMTP_SETTING_KEYS));
        const encryptedPassword = values.get(SMTP_SETTING_KEYS.password) || '';
        const publicUrl = values.get(SMTP_SETTING_KEYS.publicUrl) ||
            String(this.configService.get('APP_PUBLIC_URL') || 'http://localhost/lms').trim();
        return {
            enabled: this.parseBoolean(values.get(SMTP_SETTING_KEYS.enabled), false),
            host: values.get(SMTP_SETTING_KEYS.host) || '',
            port: Number(values.get(SMTP_SETTING_KEYS.port) || 587),
            security: values.get(SMTP_SETTING_KEYS.security) === 'ssl' ? 'ssl' : 'starttls',
            username: values.get(SMTP_SETTING_KEYS.username) || '',
            password: encryptedPassword ? this.decryptSecret(encryptedPassword) : '',
            fromName: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.fromName)) || 'xyndrome',
            fromEmail: values.get(SMTP_SETTING_KEYS.fromEmail) || '',
            publicUrl,
            subject: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.subject)) || 'Reset your xyndrome password',
            heading: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.heading)) || 'Reset your password',
            intro: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.intro)) || 'We received a request to reset your xyndrome password.',
            buttonLabel: values.get(SMTP_SETTING_KEYS.buttonLabel) || 'Reset password',
            footer: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.footer)) || 'If you did not request this, you can safely ignore this email.',
        };
    }
    normalizeSmtpBrandText(value) {
        let normalized = String(value || '').trim();
        for (const [pattern, replacement] of LEGACY_SMTP_BRAND_REPLACEMENTS) {
            normalized = normalized.replace(pattern, replacement);
        }
        return normalized;
    }
    renderSmtpTestHtml(settings, sentAt) {
        const safe = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char] || char));
        return `
      <div style="margin:0;padding:28px;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ef;border-radius:16px;overflow:hidden;">
          <div style="padding:22px 24px;background:#2563eb;color:#ffffff;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">xyndrome</div>
            <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">SMTP test email</h1>
          </div>
          <div style="padding:24px;font-size:14px;line-height:1.7;color:#334155;">
            <p style="margin:0 0 14px;">Your xyndrome SMTP settings can send email successfully.</p>
            <p style="margin:0;color:#64748b;">Sent at: ${safe(sentAt.toISOString())}</p>
            <p style="margin:8px 0 0;color:#64748b;">From: ${safe(settings.fromName)} &lt;${safe(settings.fromEmail)}&gt;</p>
          </div>
        </div>
      </div>
    `;
    }
    async getRawPopupAlertSettings() {
        const values = await this.getSettingMap(Object.values(POPUP_ALERT_SETTING_KEYS));
        return this.getRawPopupAlertSettingsFromValues(values);
    }
    getRawPopupAlertSettingsFromValues(values) {
        return {
            enabled: this.parseBoolean(values.get(POPUP_ALERT_SETTING_KEYS.enabled), false),
            placement: this.normalizePopupPlacement(values.get(POPUP_ALERT_SETTING_KEYS.placement) || 'landing'),
            title: values.get(POPUP_ALERT_SETTING_KEYS.title) || '',
            body: values.get(POPUP_ALERT_SETTING_KEYS.body) || '',
            buttonLabel: values.get(POPUP_ALERT_SETTING_KEYS.buttonLabel) || '',
            buttonUrl: values.get(POPUP_ALERT_SETTING_KEYS.buttonUrl) || '',
            imageUrl: values.get(POPUP_ALERT_SETTING_KEYS.imageUrl) || '',
            imageAlt: values.get(POPUP_ALERT_SETTING_KEYS.imageAlt) || '',
            imageFileName: values.get(POPUP_ALERT_SETTING_KEYS.imageFileName) || '',
            imageWidth: Number(values.get(POPUP_ALERT_SETTING_KEYS.imageWidth) || 0),
            imageHeight: Number(values.get(POPUP_ALERT_SETTING_KEYS.imageHeight) || 0),
            imageBytes: Number(values.get(POPUP_ALERT_SETTING_KEYS.imageBytes) || 0),
            version: values.get(POPUP_ALERT_SETTING_KEYS.version) || '',
        };
    }
    async getRawApnsSettings() {
        const values = await this.getSettingMap(Object.values(APNS_SETTING_KEYS));
        const encryptedPrivateKey = values.get(APNS_SETTING_KEYS.privateKey) || '';
        return {
            keyId: values.get(APNS_SETTING_KEYS.keyId) || String(this.configService.get('APNS_KEY_ID') || '').trim(),
            teamId: values.get(APNS_SETTING_KEYS.teamId) || String(this.configService.get('APNS_TEAM_ID') || '').trim(),
            bundleId: values.get(APNS_SETTING_KEYS.bundleId) || String(this.configService.get('APNS_BUNDLE_ID') || 'com.erpm.medical.lms').trim(),
            useSandbox: this.parseBoolean(values.get(APNS_SETTING_KEYS.useSandbox) || this.configService.get('APNS_USE_SANDBOX'), true),
            privateKeyPath: values.get(APNS_SETTING_KEYS.privateKeyPath) || String(this.configService.get('APNS_PRIVATE_KEY_PATH') || '').trim(),
            privateKey: encryptedPrivateKey
                ? this.decryptSecret(encryptedPrivateKey)
                : String(this.configService.get('APNS_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim(),
        };
    }
    async getRawFcmSettings() {
        const values = await this.getSettingMap(Object.values(FCM_SETTING_KEYS));
        const encryptedServerKey = values.get(FCM_SETTING_KEYS.serverKey) || '';
        const encryptedServiceAccountJson = values.get(FCM_SETTING_KEYS.serviceAccountJson) || '';
        return {
            projectId: values.get(FCM_SETTING_KEYS.projectId) || String(this.configService.get('FCM_PROJECT_ID') || '').trim(),
            serverKey: encryptedServerKey
                ? this.decryptSecret(encryptedServerKey)
                : String(this.configService.get('FCM_SERVER_KEY') || '').trim(),
            serviceAccountPath: values.get(FCM_SETTING_KEYS.serviceAccountPath) ||
                String(this.configService.get('FCM_SERVICE_ACCOUNT_PATH') || this.configService.get('GOOGLE_APPLICATION_CREDENTIALS') || '').trim(),
            serviceAccountJson: encryptedServiceAccountJson
                ? this.decryptSecret(encryptedServiceAccountJson)
                : String(this.configService.get('FCM_SERVICE_ACCOUNT_JSON') || '').trim(),
        };
    }
    serializeSmtpSettings(settings) {
        return {
            enabled: settings.enabled,
            host: settings.host,
            port: settings.port,
            security: settings.security,
            username: settings.username,
            fromName: settings.fromName,
            fromEmail: settings.fromEmail,
            publicUrl: settings.publicUrl,
            subject: settings.subject,
            heading: settings.heading,
            intro: settings.intro,
            buttonLabel: settings.buttonLabel,
            footer: settings.footer,
            hasPassword: Boolean(settings.password),
            maskedPassword: settings.password ? (0, ai_provider_utils_1.maskSecret)(settings.password) : '',
            configured: Boolean(settings.host && settings.port && settings.username && settings.password && settings.fromEmail),
        };
    }
    serializePopupAlertSettings(settings) {
        return {
            enabled: settings.enabled,
            placement: settings.placement,
            title: settings.title,
            body: settings.body,
            buttonLabel: settings.buttonLabel,
            buttonUrl: settings.buttonUrl,
            imageUrl: settings.imageUrl,
            imageAlt: settings.imageAlt,
            imageFileName: settings.imageFileName,
            imageWidth: settings.imageWidth,
            imageHeight: settings.imageHeight,
            imageBytes: settings.imageBytes,
            version: settings.version,
            configured: Boolean(settings.imageUrl),
        };
    }
    serializePublicPopupAlertSettings(settings) {
        if (!settings.enabled || !settings.imageUrl) {
            return { enabled: false };
        }
        return this.serializePopupAlertSettings(settings);
    }
    serializeApnsSettings(settings) {
        return {
            keyId: settings.keyId,
            teamId: settings.teamId,
            bundleId: settings.bundleId,
            useSandbox: settings.useSandbox,
            privateKeyPath: settings.privateKeyPath,
            hasPrivateKey: Boolean(settings.privateKey),
            maskedPrivateKey: settings.privateKey ? (0, ai_provider_utils_1.maskSecret)(settings.privateKey.replace(/\s+/g, '')) : '',
            configured: Boolean(settings.keyId && settings.teamId && settings.bundleId && (settings.privateKey || settings.privateKeyPath)),
        };
    }
    serializeFcmSettings(settings) {
        return {
            projectId: settings.projectId,
            privateKeyPath: settings.serviceAccountPath,
            serviceAccountPath: settings.serviceAccountPath,
            hasServerKey: Boolean(settings.serverKey),
            maskedServerKey: settings.serverKey ? (0, ai_provider_utils_1.maskSecret)(settings.serverKey) : '',
            hasServiceAccountJson: Boolean(settings.serviceAccountJson),
            maskedServiceAccountJson: settings.serviceAccountJson ? (0, ai_provider_utils_1.maskSecret)(settings.serviceAccountJson.replace(/\s+/g, '')) : '',
            configured: Boolean(settings.projectId && (settings.serviceAccountJson || settings.serviceAccountPath || settings.serverKey)),
        };
    }
    serializePaymentSettings(settings, includeAdminFields) {
        if (!includeAdminFields) {
            return {
                enabled: settings.enabled,
                currency: settings.currency,
                buttonLabel: settings.buttonLabel,
                configured: Boolean(settings.merchantId && settings.merchantSecret),
            };
        }
        return {
            enabled: settings.enabled,
            sandboxMode: settings.sandboxMode,
            currency: settings.currency,
            checkoutTitle: settings.checkoutTitle,
            buttonLabel: settings.buttonLabel,
            supportText: settings.supportText,
            configured: Boolean(settings.merchantId && settings.merchantSecret),
            merchantId: settings.merchantId,
            hasMerchantSecret: Boolean(settings.merchantSecret),
            maskedMerchantSecret: settings.merchantSecret ? (0, ai_provider_utils_1.maskSecret)(settings.merchantSecret) : '',
            returnUrl: settings.returnUrl,
            cancelUrl: settings.cancelUrl,
            notifyUrl: settings.notifyUrl,
            autoActivatePaidSubscriptions: settings.autoActivatePaidSubscriptions,
        };
    }
    getPayHereCheckoutUrl(sandboxMode) {
        return sandboxMode ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
    }
    parseBoolean(value, fallback) {
        const normalized = String(value || '').trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'off'].includes(normalized))
            return false;
        return fallback;
    }
    normalizeOptionalValue(value) {
        const normalized = String(value || '').trim();
        return normalized || '';
    }
    normalizeWhatsAppNumber(value) {
        const normalized = this.normalizeOptionalValue(value);
        if (!normalized) {
            return '';
        }
        return normalized.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    }
    normalizePopupPlacement(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return ['landing', 'login', 'app', 'all'].includes(normalized)
            ? normalized
            : 'landing';
    }
    async savePopupAlertImage(dataUrl) {
        const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
            throw new common_1.BadRequestException('Popup image must be a JPG, PNG, or WEBP file');
        }
        const mimeType = match[1];
        const extension = POPUP_ALERT_ALLOWED_IMAGE_TYPES[mimeType];
        const buffer = Buffer.from(match[2], 'base64');
        if (!extension || buffer.length === 0) {
            throw new common_1.BadRequestException('Popup image could not be read');
        }
        if (buffer.length > POPUP_ALERT_MAX_IMAGE_BYTES) {
            throw new common_1.BadRequestException('Popup image must be 2 MB or smaller');
        }
        const dimensions = this.readImageDimensions(buffer, mimeType);
        if (!dimensions.width || !dimensions.height) {
            throw new common_1.BadRequestException('Popup image file contents do not match the selected file type');
        }
        const uploadDir = (0, path_1.join)(process.cwd(), 'uploads', 'marketing-popups');
        await (0, promises_1.mkdir)(uploadDir, { recursive: true });
        const imageFileName = `${Date.now()}-${(0, crypto_1.randomUUID)()}.${extension}`;
        await (0, promises_1.writeFile)((0, path_1.join)(uploadDir, imageFileName), buffer, { flag: 'wx' });
        return {
            imageUrl: `/api/uploads/marketing-popups/${imageFileName}`,
            imageFileName,
            imageWidth: dimensions.width,
            imageHeight: dimensions.height,
            imageBytes: buffer.length,
        };
    }
    readImageDimensions(buffer, mimeType) {
        if (mimeType === 'image/png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
            return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
        }
        if (mimeType === 'image/webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
            const chunk = buffer.toString('ascii', 12, 16);
            if (chunk === 'VP8X' && buffer.length >= 30) {
                return {
                    width: 1 + buffer.readUIntLE(24, 3),
                    height: 1 + buffer.readUIntLE(27, 3),
                };
            }
            if (chunk === 'VP8 ' && buffer.length >= 30) {
                return {
                    width: buffer.readUInt16LE(26) & 0x3fff,
                    height: buffer.readUInt16LE(28) & 0x3fff,
                };
            }
            if (chunk === 'VP8L' && buffer.length >= 25) {
                const bits = buffer.readUInt32LE(21);
                return {
                    width: (bits & 0x3fff) + 1,
                    height: ((bits >> 14) & 0x3fff) + 1,
                };
            }
        }
        if (mimeType === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
            let offset = 2;
            while (offset < buffer.length - 9) {
                if (buffer[offset] !== 0xff) {
                    offset += 1;
                    continue;
                }
                const marker = buffer[offset + 1];
                const length = buffer.readUInt16BE(offset + 2);
                if (length < 2)
                    break;
                if (marker >= 0xc0 && marker <= 0xc3) {
                    return {
                        width: buffer.readUInt16BE(offset + 7),
                        height: buffer.readUInt16BE(offset + 5),
                    };
                }
                offset += 2 + length;
            }
        }
        return { width: 0, height: 0 };
    }
    toWhatsAppUrl(value) {
        const normalized = this.normalizeWhatsAppNumber(value);
        if (!normalized) {
            return '';
        }
        const digits = normalized.replace(/\D/g, '');
        return digits ? `https://wa.me/${digits}` : '';
    }
    normalizeSecretInput(value) {
        return value === undefined ? '' : String(value || '').trim();
    }
    normalizeProviderKey(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!(0, ai_provider_utils_1.isAiProviderKey)(normalized)) {
            throw new common_1.BadRequestException('Unsupported AI provider');
        }
        return normalized;
    }
    async saveSettingValue(settingKey, settingValue) {
        await this.db.execute(`
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, [settingKey, settingValue]);
    }
    async listAiProviders() {
        const [rows] = await this.db.execute(`
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active,
          created_at,
          updated_at
        FROM ai_provider_configs
        ORDER BY is_active DESC, updated_at DESC, id DESC
      `);
        return rows.map((row) => this.serializeAiProvider(row));
    }
    serializeAiProvider(row) {
        const apiKey = this.decryptSecret(String(row.api_key_encrypted || ''));
        const apiCode = this.decryptSecret(String(row.api_code_encrypted || ''));
        const providerKey = (0, ai_provider_utils_1.isAiProviderKey)(String(row.provider_key || '').trim().toLowerCase())
            ? String(row.provider_key || '').trim().toLowerCase()
            : 'openrouter';
        return {
            id: row.id,
            providerKey,
            providerLabel: String(row.provider_label || '').trim() || ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey],
            baseUrl: (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(providerKey, row.base_url),
            model: String(row.model || '').trim() || (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey),
            status: row.status,
            isActive: Boolean(row.is_active),
            hasApiKey: Boolean(apiKey),
            hasRunCode: Boolean(apiCode),
            maskedApiKey: apiKey ? (0, ai_provider_utils_1.maskSecret)(apiKey) : '',
            maskedRunCode: apiCode ? (0, ai_provider_utils_1.maskSecret)(apiCode) : '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    decryptSecret(value) {
        try {
            return (0, ai_provider_utils_1.decryptSecret)(value, this.getEncryptionSecret());
        }
        catch {
            return '';
        }
    }
    encryptSecret(value) {
        return (0, ai_provider_utils_1.encryptSecret)(value, this.getEncryptionSecret());
    }
    getEncryptionSecret() {
        const configured = String(this.configService.get('SETTINGS_ENCRYPTION_KEY') || '').trim();
        const nodeEnv = String(this.configService.get('NODE_ENV') || 'development').trim();
        if (!configured && nodeEnv === 'production') {
            throw new common_1.BadRequestException('SETTINGS_ENCRYPTION_KEY must be configured before managing AI provider secrets');
        }
        return configured || 'lms-dev-settings-key-change-me';
    }
    async countActiveAiProviders() {
        const [rows] = await this.db.execute(`SELECT COUNT(*) AS total FROM ai_provider_configs WHERE is_active = 1 AND status = 'active'`);
        return Number(rows[0]?.total || 0);
    }
    async getAiProviderRowOrThrow(id) {
        const [rows] = await this.db.execute(`
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active,
          created_at,
          updated_at
        FROM ai_provider_configs
        WHERE id = ?
        LIMIT 1
      `, [id]);
        if (!rows[0]) {
            throw new common_1.NotFoundException('AI provider configuration not found');
        }
        return rows[0];
    }
    async setActiveAiProvider(id) {
        await this.db.execute(`UPDATE ai_provider_configs SET is_active = 0`);
        await this.db.execute(`
        UPDATE ai_provider_configs
        SET is_active = 1,
            status = 'active'
        WHERE id = ?
      `, [id]);
    }
    async activateFallbackProvider(excludedId) {
        const [rows] = await this.db.execute(`
        SELECT id
        FROM ai_provider_configs
        WHERE id <> ? AND status = 'active'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `, [excludedId]);
        const fallbackId = Number(rows[0]?.id || 0);
        if (fallbackId > 0) {
            await this.setActiveAiProvider(fallbackId);
        }
    }
    async runProviderConnectionTest(providerKey, apiKey) {
        try {
            switch (providerKey) {
                case 'openai':
                    return await this.testOpenAiKey(apiKey);
                case 'claude':
                    return await this.testClaudeKey(apiKey);
                case 'gemini':
                    return await this.testGeminiKey(apiKey);
                case 'openrouter':
                default:
                    return await this.testOpenRouterKey(apiKey);
            }
        }
        catch (error) {
            if (error instanceof common_1.BadGatewayException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadGatewayException(this.formatProviderConnectionError(ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey], error));
        }
    }
    async testOpenRouterKey(apiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.extractProviderTestError('OpenRouter', response.status));
        }
        const payload = await response.json().catch(() => null);
        return this.extractModelIds(payload?.data, ['id']);
    }
    async testOpenAiKey(apiKey) {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.extractProviderTestError('OpenAI', response.status));
        }
        const payload = await response.json().catch(() => null);
        return this.extractModelIds(payload?.data, ['id'], ['gpt', 'o1', 'o3', 'o4']);
    }
    async testClaudeKey(apiKey) {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
        });
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.extractProviderTestError('Claude', response.status));
        }
        const payload = await response.json().catch(() => null);
        return this.extractModelIds(payload?.data, ['id', 'name'], ['claude']);
    }
    async testGeminiKey(apiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.extractProviderTestError('Gemini', response.status));
        }
        const payload = await response.json().catch(() => null);
        return (Array.isArray(payload?.models) ? payload.models : [])
            .filter((model) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
            .map((model) => String(model?.name || '').replace(/^models\//, '').trim())
            .filter((value) => value.startsWith('gemini-'))
            .slice(0, 30);
    }
    extractProviderTestError(providerLabel, statusCode) {
        if (statusCode === 401) {
            return `${providerLabel} rejected the API key.`;
        }
        if (statusCode === 403) {
            return `${providerLabel} denied access for this API key.`;
        }
        if (statusCode === 429) {
            return `${providerLabel} rate limit or quota was hit while testing the key.`;
        }
        return `${providerLabel} key test failed with status ${statusCode}.`;
    }
    formatProviderConnectionError(providerLabel, error) {
        const message = error instanceof Error ? error.message : String(error || 'Unknown error');
        const normalized = message.toLowerCase();
        if (normalized.includes('socket connection was closed') ||
            normalized.includes('connectionclosed') ||
            normalized.includes('fetch failed') ||
            normalized.includes('econnreset')) {
            return `${providerLabel} could not be reached. Check internet, VPN/proxy/firewall, DNS, or provider availability.`;
        }
        if (normalized.includes('abort') || normalized.includes('timeout') || normalized.includes('timed out')) {
            return `${providerLabel} did not respond in time. Try again or choose a faster model/provider.`;
        }
        return `${providerLabel} connection test failed: ${message}`;
    }
    extractModelIds(rows, candidateKeys, requiredFragments = []) {
        if (!Array.isArray(rows)) {
            return [];
        }
        return rows
            .map((row) => {
            for (const key of candidateKeys) {
                const value = String(row?.[key] || '').trim();
                if (value) {
                    return value;
                }
            }
            return '';
        })
            .filter((value) => value &&
            (requiredFragments.length === 0 ||
                requiredFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))))
            .slice(0, 30);
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map